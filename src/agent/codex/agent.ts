import { Agent, runToolCall, type AgentEvent, type AgentMessage, type AgentTool, type AgentToolCall, type ThinkingLevel } from "@earendil-works/pi-agent-core";
import type { Api, AssistantMessage, AssistantMessageEvent, ImageContent, Model, TextContent, ToolResultMessage, Usage } from "@earendil-works/pi-ai";
import fs from "node:fs";
import { persistedView, steerText } from "../claude-code/agent.ts";
import { effortFor } from "./catalog.ts";
import { renderDelta, renderTranscript, textInput, type UserInput } from "./render.ts";
import { CodexClient, codexEnv, spawnCodex, type ConnectFn } from "./rpc.ts";
import { recordCodexRateLimits } from "../plan-limits.ts";
import { CODEX_WORKDIR, fileLedger, fingerprintOf, toolsFingerprintOf, type ThreadLedger } from "./sessions.ts";

/**
 * CodexAgent — pi's Agent surface, driven by a local `codex app-server`
 * (docs/codex-engine.md, "Architecture: one adapter").
 *
 * Same contract as ClaudeCodeAgent: the app consumes subscribe / continue
 * / prompt / steer / abort / state.messages and pi's AgentEvent stream;
 * this class runs a Codex thread underneath with OUR system prompt
 * (baseInstructions), Codex's built-ins switched off (rpc.ts), and our
 * AgentTools registered as the thread's dynamic tools. Codex calls them
 * back with `item/tool/call`; pi's runToolCall executes them.
 *
 * One pi turn = one Codex STEP: a model response plus the tool batch its
 * code-mode `exec` ran. Codex reports the end of every step with
 * `thread/tokenUsage/updated` (after the batch's last tool result), so
 * that is where the assistant message ends and pi's boundary rules run:
 *   - a batch whose results ALL terminate, or that `finishTurn` ends
 *     (the question-stop rule), stops the run — `turn/interrupt`;
 *   - steering drains at the boundary: markers are appended to the
 *     transcript (message_start/end) and handed to the model with
 *     `turn/steer`; markers waiting when the turn completes start one
 *     more turn as input;
 *   - an ended run leaves its steering queue untouched.
 * Tool events wait for their message's end (pi's order), because Codex
 * runs tools before the step is over.
 */

/** Process-wide seams: tests swap in a scripted app-server and an
 *  in-memory ledger without threading them through every factory. */
export const codexRuntime: { connect?: ConnectFn; ledger: ThreadLedger } = { ledger: fileLedger };

export interface TurnOutcome {
	message: AssistantMessage;
	toolResults: ToolResultMessage[];
}

export interface CodexAgentOptions {
	systemPrompt: string;
	model: Model<Api>;
	thinkingLevel?: ThinkingLevel;
	tools: AgentTool<any, any>[];
	messages?: AgentMessage[];
	/** Ledger key: the chat id. Absent → one ephemeral thread, never resumed. */
	chatId?: string;
	ledger?: ThreadLedger;
	/** True → end the run after this completed turn (pi's finishTurn "end"). */
	finishTurn?: (turn: TurnOutcome) => boolean;
	/** One model call, no tool execution (the pi streamFn contract — see
	 *  stream.ts): the run ends after the first step, its calls unexecuted. */
	singleCall?: boolean;
	/** Test seam: a scripted app-server. */
	connect?: ConnectFn;
	/** Extra env for the Codex process (tests, debugging). */
	env?: Record<string, string>;
	/** Codex stderr (debugging). */
	stderr?: (data: string) => void;
}

const EMPTY_USAGE = (): Usage => ({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } });

interface CodexItem { type: string; id: string; text?: string; summary?: string[]; tool?: string; arguments?: unknown }
interface CodexTurn { id: string; status: "completed" | "interrupted" | "failed" | "inProgress"; error?: { message?: string } | null }
interface TokenBreakdown { totalTokens: number; inputTokens: number; cachedInputTokens: number; cacheWriteInputTokens: number; outputTokens: number }

type ToolOutputItem = { type: "inputText"; text: string } | { type: "inputImage"; imageUrl: string };

export class CodexAgent extends Agent {
	private readonly cx: CodexAgentOptions;
	private readonly cxListeners = new Set<(event: AgentEvent, signal: AbortSignal) => Promise<void> | void>();
	private steering: AgentMessage[] = [];
	private follow: AgentMessage[] = [];
	private controller: AbortController | undefined;
	private running: Promise<void> | undefined;

	constructor(options: CodexAgentOptions) {
		super({
			initialState: {
				systemPrompt: options.systemPrompt,
				model: options.model,
				thinkingLevel: options.thinkingLevel ?? "off",
				tools: options.tools,
				messages: options.messages ?? [],
			},
			streamFn: () => {
				throw new Error("CodexAgent does not stream through pi");
			},
		});
		this.cx = options;
	}

	// ─── pi's public surface ────────────────────────────────────────────────

	override subscribe(listener: (event: AgentEvent, signal: AbortSignal) => Promise<void> | void): () => void {
		this.cxListeners.add(listener);
		return () => this.cxListeners.delete(listener);
	}
	override steer(message: AgentMessage): void { this.steering.push(message); }
	override followUp(message: AgentMessage): void { this.follow.push(message); }
	override clearSteeringQueue(): void { this.steering = []; }
	override clearFollowUpQueue(): void { this.follow = []; }
	override clearAllQueues(): void { this.steering = []; this.follow = []; }
	override hasQueuedMessages(): boolean { return this.steering.length > 0 || this.follow.length > 0; }
	override peekQueuedMessages(): AgentMessage[] { return [...this.steering, ...this.follow]; }
	override get signal(): AbortSignal | undefined { return this.controller?.signal; }
	override abort(): void { this.controller?.abort(); }
	override async waitForIdle(): Promise<void> { await this.running?.catch(() => undefined); }

	override async prompt(input: AgentMessage | AgentMessage[] | string, images?: ImageContent[]): Promise<void> {
		const added: AgentMessage[] =
			typeof input === "string"
				? [{ role: "user", content: images?.length ? [{ type: "text", text: input }, ...images] : input, timestamp: Date.now() } as AgentMessage]
				: Array.isArray(input) ? input : [input];
		this.state.messages = [...this.state.messages, ...added];
		for (const m of added) {
			await this.emit({ type: "message_start", message: m });
			await this.emit({ type: "message_end", message: m });
		}
		await this.continue();
	}

	override async continue(): Promise<void> {
		if (this.running) throw new Error("Agent is already running");
		this.running = this.run();
		try { await this.running; } finally { this.running = undefined; }
	}

	// ─── the run ────────────────────────────────────────────────────────────

	private async emit(event: AgentEvent): Promise<void> {
		const signal = this.controller?.signal ?? new AbortController().signal;
		for (const listener of this.cxListeners) await listener(event, signal);
	}

	private push(message: AgentMessage) { this.state.messages = [...this.state.messages, message]; }

	private async injectQueued(queue: AgentMessage[]): Promise<AgentMessage[]> {
		for (const m of queue) {
			await this.emit({ type: "message_start", message: m });
			await this.emit({ type: "message_end", message: m });
			this.push(m);
		}
		return queue;
	}

	private async run(): Promise<void> {
		const controller = new AbortController();
		this.controller = controller;
		const ledger = this.cx.chatId ? this.cx.ledger ?? codexRuntime.ledger : undefined;
		const startCount = this.state.messages.filter((m) => (m as { role?: string }).role !== "system").length;
		const newMessages = (): AgentMessage[] => this.state.messages.filter((m) => (m as { role?: string }).role !== "system").slice(startCount);

		await this.emit({ type: "agent_start" });
		await this.emit({ type: "turn_start" });
		// The run's start steering poll (pi: a continuation drains the queue first).
		await this.injectQueued(this.steering.splice(0));

		const tools = this.state.tools as AgentTool<any, any>[];
		const toolsFingerprint = toolsFingerprintOf(tools);

		// ── input: resume with the record's new tail, or seed a fresh thread
		const persisted = persistedView(this.state.messages);
		const seed = (): UserInput[] => {
			const blocks = renderTranscript(persisted);
			return blocks.length > 0 ? blocks : [textInput("Continue.")];
		};
		const entry = this.cx.chatId ? ledger!.get(this.cx.chatId) : undefined;
		let resumeId: string | undefined;
		let input: UserInput[] | null = null;
		if (entry && entry.toolsFingerprint === toolsFingerprint && entry.covered > 0 && entry.covered <= persisted.length && fingerprintOf(persisted[entry.covered - 1]) === entry.fingerprint) {
			input = renderDelta(persisted.slice(entry.covered));
			if (input) resumeId = entry.threadId;
		}
		if (!resumeId) input = seed();
		if (!input || input.length === 0) input = [textInput("Continue.")];

		// ── turn state
		let current: AssistantMessage | undefined;
		let lastAssistant: AssistantMessage | undefined;
		const parts = new Map<string, number>(); // Codex item id → content index
		const results = new Map<string, { message: ToolResultMessage; terminate: boolean }>();
		let deferred: AgentEvent[] = [];
		let pendingInput: UserInput[] = []; // steer text Codex would not take mid-turn
		let stopRequested = false;
		let failure: string | undefined;
		let sawAbort = false;
		let turnOpen = true; // a turn_start was emitted and its turn_end is owed
		let threadId: string | undefined;
		let turnId: string | undefined;
		let finished = false;
		let resolveDone!: () => void;
		const done = new Promise<void>((resolve) => (resolveDone = resolve));
		const finish = () => {
			finished = true;
			resolveDone();
		};

		const startTurn = async () => {
			if (turnOpen) return;
			turnOpen = true;
			await this.emit({ type: "turn_start" });
		};
		const endTurn = async (message: AssistantMessage, toolResults: ToolResultMessage[]) => {
			turnOpen = false;
			await this.emit({ type: "turn_end", message, toolResults });
		};
		const beginAssistant = async () => {
			await startTurn();
			current = { role: "assistant", content: [], api: this.cx.model.api, provider: this.cx.model.provider, model: this.cx.model.id, usage: EMPTY_USAGE(), stopReason: "stop", timestamp: Date.now() };
			this.push(current);
			await this.emit({ type: "message_start", message: { ...current, content: [...current.content] } });
		};
		const ensureAssistant = async (): Promise<AssistantMessage> => {
			if (!current) await beginAssistant();
			return current!;
		};
		const update = async (assistantMessageEvent: AssistantMessageEvent) => {
			if (!current) return;
			await this.emit({ type: "message_update", message: current, assistantMessageEvent });
		};
		const emitToolEvent = async (event: AgentEvent) => {
			if (current) deferred.push(event);
			else await this.emit(event);
		};
		const addToolCall = async (id: string, name: string, args: unknown) => {
			const target = await ensureAssistant();
			if (target.content.some((c) => c.type === "toolCall" && c.id === id)) return;
			const contentIndex = target.content.length;
			const toolCall: AgentToolCall = { type: "toolCall", id, name, arguments: (args ?? {}) as AgentToolCall["arguments"] };
			target.content.push(toolCall);
			await update({ type: "toolcall_start", contentIndex, partial: target } as AssistantMessageEvent);
			await update({ type: "toolcall_end", contentIndex, toolCall, partial: target } as AssistantMessageEvent);
		};

		let client!: CodexClient;
		const interrupt = () => {
			if (threadId && turnId) client.request("turn/interrupt", { threadId, turnId }).catch(() => undefined);
		};
		const steerCodex = (text: string) => {
			const steerInput = [textInput(text)];
			if (!threadId || !turnId) {
				pendingInput.push(...steerInput);
				return;
			}
			client.request("turn/steer", { threadId, input: steerInput, expectedTurnId: turnId }).catch(() => pendingInput.push(...steerInput));
		};
		const startCodexTurn = async (turnInput: UserInput[]) => {
			const { effort, summary } = effortFor(this.cx.thinkingLevel);
			const response = await client.request<{ turn: CodexTurn }>("turn/start", { threadId, input: turnInput, model: this.cx.model.id, summary, ...(effort ? { effort } : {}) });
			turnId = response.turn.id;
		};

		// The end of a step: close the message, then pi's boundary rules.
		const endStep = async () => {
			if (!current) return;
			const step = current;
			current = undefined;
			lastAssistant = step;
			parts.clear();
			step.content = step.content.filter((c) => !(c.type === "text" && c.text === "") && !(c.type === "thinking" && c.thinking === ""));
			const calls = step.content.filter((c): c is AgentToolCall => c.type === "toolCall");
			if (calls.length > 0 && step.stopReason === "stop") step.stopReason = "toolUse";
			await this.emit({ type: "message_end", message: step });
			const flushed = deferred;
			deferred = [];
			for (const event of flushed) await this.emit(event);
			if (step.stopReason === "aborted" || step.stopReason === "error") {
				await endTurn(step, []);
				return;
			}
			if (this.cx.singleCall || calls.length === 0) {
				const stop = this.cx.singleCall || this.cx.finishTurn?.({ message: step, toolResults: [] }) === true;
				await endTurn(step, []);
				if (stop) {
					stopRequested = true;
					interrupt();
				}
				return;
			}
			const toolResults: ToolResultMessage[] = [];
			let allTerminate = true;
			for (const call of calls) {
				const done = results.get(call.id);
				results.delete(call.id);
				// A call Codex dispatched without reaching our handler still
				// needs its result in the record.
				const message = done?.message ?? ({
					role: "toolResult", toolCallId: call.id, toolName: call.name,
					content: [{ type: "text", text: "Tool call was not executed." }], details: {}, isError: true, timestamp: Date.now(),
				} as ToolResultMessage);
				if (!done?.terminate) allTerminate = false;
				toolResults.push(message);
				this.push(message);
				await this.emit({ type: "message_start", message });
				await this.emit({ type: "message_end", message });
			}
			const stop = allTerminate || this.cx.finishTurn?.({ message: step, toolResults }) === true;
			await endTurn(step, toolResults);
			if (stop) {
				stopRequested = true;
				interrupt();
				return;
			}
			// Steering at the boundary: transcript first, then the model.
			const steers = this.steering.splice(0);
			if (steers.length === 0) return;
			await startTurn();
			await this.injectQueued(steers);
			const text = steers.map(steerText).filter(Boolean).join("\n\n");
			if (text) steerCodex(text);
		};

		const onTurnCompleted = async (turn: CodexTurn) => {
			if (turnId && turn.id !== turnId) return;
			await endStep();
			if (stopRequested || failure) return finish();
			if (turn.status === "failed") {
				failure = turn.error?.message ?? "Codex turn failed";
				return finish();
			}
			if (turn.status === "interrupted") {
				failure = "Codex interrupted the turn";
				return finish();
			}
			// The model finished on its own: steering then follow-ups start
			// one more turn (pi's end-of-run polls); otherwise we are done.
			const next = this.steering.length > 0 ? this.steering.splice(0) : this.follow.splice(0);
			if (next.length === 0 && pendingInput.length === 0) return finish();
			await startTurn();
			await this.injectQueued(next);
			const turnInput = [...pendingInput, ...next.flatMap((m) => renderDelta([m]) ?? [])];
			pendingInput = [];
			await startCodexTurn(turnInput.length > 0 ? turnInput : [textInput("Continue.")]);
		};

		const onNotification = async (method: string, params: Record<string, unknown>) => {
			if (method === "account/rateLimits/updated") return recordCodexRateLimits(params.rateLimits);
			if (finished) return;
			if (threadId && params.threadId !== undefined && params.threadId !== threadId) return;
			if (method === "turn/started") {
				turnId = (params.turn as CodexTurn).id;
				return;
			}
			if (method === "turn/completed") return onTurnCompleted(params.turn as CodexTurn);
			if (method === "error") {
				if (params.willRetry !== true) failure ??= (params.error as { message?: string })?.message ?? "Codex reported an error";
				return;
			}
			// After a stop (or for a stale turn) nothing more lands in the record.
			if (stopRequested || (turnId && params.turnId !== undefined && params.turnId !== turnId)) return;
			switch (method) {
				case "item/started": {
					const item = params.item as CodexItem;
					if (item.type === "agentMessage" || item.type === "reasoning") {
						const target = await ensureAssistant();
						const contentIndex = target.content.length;
						parts.set(item.id, contentIndex);
						if (item.type === "agentMessage") {
							target.content.push({ type: "text", text: item.text ?? "" });
							await update({ type: "text_start", contentIndex, partial: target } as AssistantMessageEvent);
						} else {
							target.content.push({ type: "thinking", thinking: (item.summary ?? []).join("\n\n") });
							await update({ type: "thinking_start", contentIndex, partial: target } as AssistantMessageEvent);
						}
					} else if (item.type === "dynamicToolCall") {
						await addToolCall(item.id, item.tool ?? "", item.arguments);
					}
					return;
				}
				case "item/agentMessage/delta":
				case "item/reasoning/summaryTextDelta":
				case "item/reasoning/textDelta": {
					const index = parts.get(params.itemId as string);
					const part = index === undefined ? undefined : current?.content[index];
					const delta = String(params.delta ?? "");
					if (part?.type === "text") {
						part.text += delta;
						await update({ type: "text_delta", contentIndex: index, delta, partial: current } as AssistantMessageEvent);
					} else if (part?.type === "thinking") {
						part.thinking += delta;
						await update({ type: "thinking_delta", contentIndex: index, delta, partial: current } as AssistantMessageEvent);
					}
					return;
				}
				case "item/reasoning/summaryPartAdded": {
					const index = parts.get(params.itemId as string);
					const part = index === undefined ? undefined : current?.content[index];
					if (part?.type === "thinking" && part.thinking) part.thinking += "\n\n";
					return;
				}
				case "item/completed": {
					const item = params.item as CodexItem;
					const index = parts.get(item.id);
					const part = index === undefined ? undefined : current?.content[index];
					if (part?.type === "text") {
						if (typeof item.text === "string") part.text = item.text;
						await update({ type: "text_end", contentIndex: index, content: part.text, partial: current } as AssistantMessageEvent);
					} else if (part?.type === "thinking") {
						if (!part.thinking && item.summary?.length) part.thinking = item.summary.join("\n\n");
						await update({ type: "thinking_end", contentIndex: index, content: part.thinking, partial: current } as AssistantMessageEvent);
					}
					return;
				}
				case "thread/tokenUsage/updated": {
					if (!current) return;
					this.applyUsage(current, (params.tokenUsage as { last?: TokenBreakdown })?.last);
					return endStep();
				}
			}
		};

		// ── tools: Codex calls back; pi's runToolCall executes
		const onToolCall = async (params: { callId: string; tool: string; arguments: unknown }): Promise<{ contentItems: ToolOutputItem[]; success: boolean }> => {
			if (finished || stopRequested || controller.signal.aborted) return { contentItems: [{ type: "inputText", text: "The turn has ended." }], success: false };
			await addToolCall(params.callId, params.tool, params.arguments);
			if (this.cx.singleCall) return { contentItems: [{ type: "inputText", text: "Recorded." }], success: true };
			const toolCall: AgentToolCall = { type: "toolCall", id: params.callId, name: params.tool, arguments: (params.arguments ?? {}) as AgentToolCall["arguments"] };
			await emitToolEvent({ type: "tool_execution_start", toolCallId: toolCall.id, toolName: toolCall.name, args: toolCall.arguments });
			const outcome = await runToolCall(toolCall, {
				tools,
				assistantMessage: current ?? lastAssistant!,
				context: { messages: this.state.messages, tools },
				signal: controller.signal,
				onUpdate: (partialResult) => emitToolEvent({ type: "tool_execution_update", toolCallId: toolCall.id, toolName: toolCall.name, args: toolCall.arguments, partialResult }),
			});
			await emitToolEvent({ type: "tool_execution_end", toolCallId: toolCall.id, toolName: toolCall.name, result: outcome.result, isError: outcome.isError, ...(outcome.durationMs === undefined ? {} : { durationMs: outcome.durationMs }) });
			const message = {
				role: "toolResult",
				toolCallId: toolCall.id,
				toolName: toolCall.name,
				content: outcome.result.content ?? [],
				details: outcome.result.details,
				usage: outcome.result.usage,
				isError: outcome.isError,
				...(outcome.durationMs === undefined ? {} : { durationMs: outcome.durationMs }),
				timestamp: Date.now(),
			} as ToolResultMessage;
			results.set(toolCall.id, { message, terminate: outcome.result.terminate === true });
			const contentItems = (message.content as (TextContent | ImageContent)[]).map((p): ToolOutputItem => (p.type === "text" ? { type: "inputText", text: p.text } : { type: "inputImage", imageUrl: `data:${p.mimeType};base64,${p.data}` }));
			return { contentItems: contentItems.length > 0 ? contentItems : [{ type: "inputText", text: "" }], success: !outcome.isError };
		};

		// Codex messages are handled strictly in arrival order (one chain):
		// a tool call is answered only after the items before it landed.
		let chain: Promise<unknown> = Promise.resolve();
		const serial = <T>(fn: () => Promise<T>): Promise<T> => {
			const next = chain.then(fn);
			chain = next.catch(() => undefined);
			return next;
		};
		const fail = (error: unknown) => {
			if (!controller.signal.aborted) failure ??= error instanceof Error ? error.message : String(error);
			finish();
		};

		const onAbort = () => {
			interrupt();
			finish();
		};
		controller.signal.addEventListener("abort", onAbort, { once: true });

		try {
			fs.mkdirSync(CODEX_WORKDIR, { recursive: true });
			const connect = this.cx.connect ?? codexRuntime.connect ?? spawnCodex;
			client = new CodexClient(connect({ cwd: CODEX_WORKDIR, env: codexEnv(this.cx.env), ...(this.cx.stderr ? { stderr: this.cx.stderr } : {}) }), {
				notification: (method, params) => void serial(() => onNotification(method, (params ?? {}) as Record<string, unknown>)).catch(fail),
				request: (method, params) => {
					if (method === "item/tool/call") return serial(() => onToolCall(params as never));
					return Promise.reject(new Error(`LearnHarness does not handle ${method}`));
				},
				closed: (reason) => {
					if (!finished && !controller.signal.aborted) failure ??= reason ?? "Codex closed the connection";
					finish();
				},
			});
			await client.request("initialize", { clientInfo: { name: "learnharness", title: "LearnHarness", version: "1" }, capabilities: { experimentalApi: true } });
			client.notify("initialized");
			const common = { model: this.cx.model.id, baseInstructions: this.cx.systemPrompt, approvalPolicy: "never", sandbox: "read-only", cwd: CODEX_WORKDIR };
			if (resumeId) {
				try {
					threadId = (await client.request<{ thread: { id: string } }>("thread/resume", { threadId: resumeId, ...common })).thread.id;
				} catch {
					input = seed(); // the thread is gone: the record seeds a new one
				}
			}
			if (!threadId) {
				const dynamicTools = tools.map((t) => ({ type: "function", name: t.name, description: t.description, inputSchema: t.parameters }));
				threadId = (await client.request<{ thread: { id: string } }>("thread/start", { ...common, ephemeral: !this.cx.chatId, dynamicTools })).thread.id;
			}
			await startCodexTurn(input);
			await done;
			await chain;
		} catch (error) {
			if (controller.signal.aborted) sawAbort = true;
			else failure ??= error instanceof Error ? error.message : String(error);
		} finally {
			controller.signal.removeEventListener("abort", onAbort);
			finished = true;
			client?.close();
		}

		if (controller.signal.aborted) sawAbort = true;
		// An abort mid-message settles that message as aborted (pi's shape).
		if (current) {
			const open: AssistantMessage = current;
			open.stopReason = sawAbort ? "aborted" : "error";
			if (!sawAbort) open.errorMessage = failure ?? "Codex ended mid-message";
			await endStep();
		} else if (failure && !sawAbort) {
			// A failure with no message in flight (startup, auth, rate limit)
			// surfaces the way pi surfaces provider errors: an error message.
			await beginAssistant();
			const err: AssistantMessage = current!;
			err.stopReason = "error";
			err.errorMessage = failure;
			await endStep();
		} else if (sawAbort && turnOpen && lastAssistant) {
			await endTurn(lastAssistant, []);
		}

		// The ledger: a clean run's thread now covers the persisted record.
		if (ledger && this.cx.chatId) {
			if (sawAbort || failure || !threadId) ledger.delete(this.cx.chatId);
			else {
				const after = persistedView(this.state.messages);
				if (after.length > 0) ledger.set(this.cx.chatId, { threadId, covered: after.length, fingerprint: fingerprintOf(after[after.length - 1]), toolsFingerprint });
			}
		}
		this.controller = undefined;
		await this.emit({ type: "agent_end", messages: newMessages() });
	}

	private applyUsage(message: AssistantMessage, usage: TokenBreakdown | undefined) {
		if (!usage) return;
		const u = message.usage;
		// OpenAI counts cached and cache-write tokens inside inputTokens.
		u.cacheRead = usage.cachedInputTokens ?? 0;
		u.cacheWrite = usage.cacheWriteInputTokens ?? 0;
		u.input = Math.max(0, (usage.inputTokens ?? 0) - u.cacheRead - u.cacheWrite);
		u.output = usage.outputTokens ?? 0;
		u.totalTokens = usage.totalTokens ?? u.input + u.output + u.cacheRead + u.cacheWrite;
		const c = this.cx.model.cost;
		u.cost = {
			input: (u.input * c.input) / 1e6,
			output: (u.output * c.output) / 1e6,
			cacheRead: (u.cacheRead * c.cacheRead) / 1e6,
			cacheWrite: (u.cacheWrite * c.cacheWrite) / 1e6,
			total: 0,
		};
		u.cost.total = u.cost.input + u.cost.output + u.cost.cacheRead + u.cost.cacheWrite;
	}
}
