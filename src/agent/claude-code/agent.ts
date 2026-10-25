import { Agent, runToolCall, type AgentEvent, type AgentMessage, type AgentTool, type AgentToolCall, type ThinkingLevel } from "@earendil-works/pi-agent-core";
import type { Api, AssistantMessage, AssistantMessageEvent, ImageContent, Model, TextContent, ToolResultMessage, Usage } from "@earendil-works/pi-ai";
import type { HookCallbackMatcher, Options, SDKMessage, SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { QUESTION_TOOLS } from "../../core/pending.ts";
import { toLlmMessages } from "../../core/native-messages.ts";
import { claudeCodeExecutable, effortFor } from "./catalog.ts";
import { createToolServer, mcpToolName, recordToolName } from "./mcp.ts";
import { renderDelta, renderTranscript, type InputBlock } from "./render.ts";
import { noteClaudeRateLimitEvent } from "../plan-limits.ts";
import { CLAUDE_CODE_WORKDIR, fileLedger, fingerprintOf, type SessionLedger } from "./sessions.ts";

/**
 * ClaudeCodeAgent — pi's Agent surface, driven by Claude Code
 * (docs/claude-code-engine.md, "Architecture: one adapter").
 *
 * The app consumes exactly one agent surface: subscribe / continue /
 * prompt / steer / abort / state.messages and pi's AgentEvent stream.
 * This class keeps that surface and swaps what runs underneath: a Claude
 * Code `query()` with OUR system prompt, NO built-in tools, and our
 * AgentTools exposed through an in-process MCP server. Everything it
 * emits — events, AssistantMessage / ToolResultMessage shapes — is what
 * pi would have emitted, so ui-stream, the record, the steer registry and
 * the usage channel run unchanged.
 *
 * Semantics carried over from pi's loop:
 *   - tools run through pi's runToolCall (heal → validate → execute);
 *   - a batch whose results ALL terminate, or that `finishTurn` ends
 *     (the question-stop rule), stops the run — via Claude Code's
 *     PostToolBatch hook returning { continue: false };
 *   - steering drains at turn boundaries: markers queued during a run are
 *     appended to the transcript (message_start/end) and handed to the
 *     model as PostToolBatch additionalContext; markers waiting when the
 *     model finishes start one more turn as a user message;
 *   - an ended run leaves its steering queue untouched (pi's "end exits
 *     before the steering poll" — the registry settles stranded markers).
 */

export type QueryFn = (params: { prompt: AsyncIterable<SDKUserMessage>; options: Options }) => AsyncIterable<SDKMessage>;

/** Process-wide seams: tests swap in a scripted query() and an
 *  in-memory ledger without threading them through every factory. */
export const claudeCodeRuntime: { query?: QueryFn; ledger: SessionLedger } = { ledger: fileLedger };

let defaultQuery: QueryFn | undefined;
async function loadQuery(): Promise<QueryFn> {
	if (claudeCodeRuntime.query) return claudeCodeRuntime.query;
	if (!defaultQuery) {
		const sdk = await import("@anthropic-ai/claude-agent-sdk");
		defaultQuery = sdk.query as unknown as QueryFn;
	}
	return defaultQuery;
}

export interface TurnOutcome {
	message: AssistantMessage;
	toolResults: ToolResultMessage[];
}

export interface ClaudeCodeAgentOptions {
	systemPrompt: string;
	model: Model<Api>;
	thinkingLevel?: ThinkingLevel;
	tools: AgentTool<any, any>[];
	messages?: AgentMessage[];
	/** Ledger key: the chat id. Absent → one-shot session, never resumed. */
	chatId?: string;
	ledger?: SessionLedger;
	/** True → end the run after this completed turn (pi's finishTurn "end"). */
	finishTurn?: (turn: TurnOutcome) => boolean;
	/** One model call, no tool execution (the pi streamFn contract — see
	 *  stream.ts): the run ends right after the first assistant message. */
	singleCall?: boolean;
	/** Test seam: a scripted query(). */
	query?: QueryFn;
	/** Extra env for the Claude Code process (tests, debugging). */
	env?: Record<string, string>;
	/** Claude Code stderr (debugging). */
	stderr?: (data: string) => void;
}

/** A tiny push-based async iterable — the SDK's streaming-input channel. */
class InputChannel implements AsyncIterable<SDKUserMessage> {
	private items: SDKUserMessage[] = [];
	private waiting: ((r: IteratorResult<SDKUserMessage>) => void) | undefined;
	private closed = false;
	push(item: SDKUserMessage) {
		if (this.closed) return;
		if (this.waiting) {
			const w = this.waiting;
			this.waiting = undefined;
			w({ value: item, done: false });
		} else this.items.push(item);
	}
	close() {
		this.closed = true;
		if (this.waiting) {
			const w = this.waiting;
			this.waiting = undefined;
			w({ value: undefined, done: true });
		}
	}
	[Symbol.asyncIterator](): AsyncIterator<SDKUserMessage> {
		return {
			next: () => {
				const item = this.items.shift();
				if (item) return Promise.resolve({ value: item, done: false });
				if (this.closed) return Promise.resolve({ value: undefined, done: true });
				return new Promise((resolve) => (this.waiting = resolve));
			},
			return: () => {
				this.close();
				return Promise.resolve({ value: undefined, done: true });
			},
		};
	}
}

const EMPTY_USAGE = (): Usage => ({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } });

/** The env every Claude Code process gets: the parent's, minus API
 *  credentials LearnHarness itself may have exported (its keys seam
 *  reflects saved keys into process.env) — the CLI's OWN login decides
 *  how the run is billed. LH_CLAUDE_CODE_USE_API_KEY=1 keeps them. */
export function claudeCodeEnv(extra?: Record<string, string>): Record<string, string> {
	const env: Record<string, string> = {};
	for (const [k, v] of Object.entries(process.env)) if (v !== undefined) env[k] = v;
	if (process.env.LH_CLAUDE_CODE_USE_API_KEY !== "1") {
		delete env.ANTHROPIC_API_KEY;
		delete env.ANTHROPIC_AUTH_TOKEN;
	}
	return { ...env, ...extra };
}

/** Record messages the persisted transcript will hold after this run:
 *  no seeded system message, no in-memory question placeholders
 *  (persistTurn drops them — the learner's answer takes their place). */
export function persistedView(messages: readonly AgentMessage[]): AgentMessage[] {
	return messages.filter((m) => {
		const role = (m as { role?: string }).role;
		if (role === "system") return false;
		if (role === "toolResult") {
			const r = m as ToolResultMessage;
			if ((QUESTION_TOOLS as readonly string[]).includes(r.toolName) && !r.isError && r.details == null) return false;
		}
		return true;
	});
}

function stopReasonOf(reason: string | null | undefined): AssistantMessage["stopReason"] {
	switch (reason) {
		case "tool_use":
			return "toolUse";
		case "max_tokens":
		case "model_context_window_exceeded":
			return "length";
		case "refusal":
			return "error";
		default:
			return "stop";
	}
}

function userMessage(blocks: InputBlock[]): SDKUserMessage {
	return { type: "user", message: { role: "user", content: blocks as never }, parent_tool_use_id: null } as SDKUserMessage;
}

export function steerText(message: AgentMessage): string {
	return toLlmMessages([message])
		.filter((m) => m.role === "user")
		.map((m) => (typeof (m as { content: unknown }).content === "string" ? (m as { content: string }).content : ((m as { content: (TextContent | ImageContent)[] }).content.filter((p) => p.type === "text") as TextContent[]).map((p) => p.text).join("\n")))
		.join("\n\n");
}

interface PendingCall { id: string; name: string; input: unknown }

export class ClaudeCodeAgent extends Agent {
	private readonly cc: ClaudeCodeAgentOptions;
	private readonly ccListeners = new Set<(event: AgentEvent, signal: AbortSignal) => Promise<void> | void>();
	private steering: AgentMessage[] = [];
	private follow: AgentMessage[] = [];
	private controller: AbortController | undefined;
	private running: Promise<void> | undefined;

	constructor(options: ClaudeCodeAgentOptions) {
		super({
			initialState: {
				systemPrompt: options.systemPrompt,
				model: options.model,
				thinkingLevel: options.thinkingLevel ?? "off",
				tools: options.tools,
				messages: options.messages ?? [],
			},
			streamFn: () => {
				throw new Error("ClaudeCodeAgent does not stream through pi");
			},
		});
		this.cc = options;
	}

	// ─── pi's public surface ────────────────────────────────────────────────

	override subscribe(listener: (event: AgentEvent, signal: AbortSignal) => Promise<void> | void): () => void {
		this.ccListeners.add(listener);
		return () => this.ccListeners.delete(listener);
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
		for (const listener of this.ccListeners) await listener(event, signal);
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
		const ledger = this.cc.chatId ? this.cc.ledger ?? claudeCodeRuntime.ledger : undefined;
		const startCount = this.state.messages.filter((m) => (m as { role?: string }).role !== "system").length;
		const newMessages = (): AgentMessage[] => this.state.messages.filter((m) => (m as { role?: string }).role !== "system").slice(startCount);

		await this.emit({ type: "agent_start" });
		await this.emit({ type: "turn_start" });
		// The run's start steering poll (pi: a continuation drains the queue first).
		const startSteers = this.steering.splice(0);
		await this.injectQueued(startSteers);

		// ── input: resume with the record's new tail, or seed a fresh session
		const persisted = persistedView(this.state.messages);
		const entry = this.cc.chatId ? ledger!.get(this.cc.chatId) : undefined;
		let resume: string | undefined;
		let first: InputBlock[] | null = null;
		if (entry && entry.covered <= persisted.length && entry.covered > 0 && fingerprintOf(persisted[entry.covered - 1]) === entry.fingerprint) {
			first = renderDelta(persisted.slice(entry.covered));
			if (first) resume = entry.sessionId;
		}
		if (!resume) first = renderTranscript(persisted);
		if (!first || first.length === 0) first = [{ type: "text", text: "Continue." }];
		let sessionId = resume ?? randomUUID();

		const input = new InputChannel();
		input.push(userMessage(first));

		// ── turn state
		let current: AssistantMessage | undefined;
		let lastAssistant: AssistantMessage | undefined;
		const jsonBuffers = new Map<number, string>();
		const pendingCalls: PendingCall[] = [];
		const results = new Map<string, { message: ToolResultMessage; terminate: boolean }>();
		let stopRequested = false;
		let failure: string | undefined;
		let sawAbort = false;
		let turnOpen = true; // a turn_start was emitted and its turn_end is owed

		const tools = this.state.tools as AgentTool<any, any>[];
		const startTurn = async () => {
			if (turnOpen) return;
			turnOpen = true;
			await this.emit({ type: "turn_start" });
		};
		const endTurn = async (message: AssistantMessage, toolResults: ToolResultMessage[]) => {
			turnOpen = false;
			await this.emit({ type: "turn_end", message, toolResults });
		};

		const beginAssistant = async (model: string) => {
			await startTurn();
			current = { role: "assistant", content: [], api: this.cc.model.api, provider: this.cc.model.provider, model: this.cc.model.id, responseModel: model, usage: EMPTY_USAGE(), stopReason: "stop", timestamp: Date.now() };
			jsonBuffers.clear();
			this.push(current);
			await this.emit({ type: "message_start", message: { ...current, content: [...current.content] } });
		};
		const update = async (assistantMessageEvent: AssistantMessageEvent) => {
			if (!current) return;
			await this.emit({ type: "message_update", message: current, assistantMessageEvent });
		};
		// Claude Code starts a tool as soon as its tool_use block closes —
		// before the message's own end. pi's order is message_end, then the
		// tool events; tool events for the still-open message wait here.
		let deferredToolEvents: AgentEvent[] = [];
		const emitToolEvent = async (event: AgentEvent) => {
			if (current) deferredToolEvents.push(event);
			else await this.emit(event);
		};
		const finishAssistant = async () => {
			if (!current) return;
			const done = current;
			current = undefined;
			lastAssistant = done;
			if (this.cc.singleCall) stopRequested = true;
			await this.emit({ type: "message_end", message: done });
			const deferred = deferredToolEvents;
			deferredToolEvents = [];
			for (const event of deferred) await this.emit(event);
			if (done.stopReason === "aborted" || done.stopReason === "error") {
				await endTurn(done, []);
				return;
			}
			if (this.cc.singleCall || !done.content.some((c) => c.type === "toolCall")) {
				const stop = this.cc.finishTurn?.({ message: done, toolResults: [] }) === true;
				await endTurn(done, []);
				if (stop) stopRequested = true;
			}
		};

		// ── tools: PreToolUse records ids; the MCP handler runs pi's runToolCall
		const callTool = async (name: string, args: unknown): Promise<CallToolResult> => {
			const recordName = recordToolName(name);
			const key = JSON.stringify(args);
			let index = pendingCalls.findIndex((c) => c.name === recordName && JSON.stringify(c.input) === key);
			if (index < 0) index = pendingCalls.findIndex((c) => c.name === recordName);
			const pending = index >= 0 ? pendingCalls.splice(index, 1)[0]! : { id: `cc_${randomUUID()}`, name: recordName, input: args };
			const toolCall: AgentToolCall = { type: "toolCall", id: pending.id, name: recordName, arguments: (args ?? {}) as AgentToolCall["arguments"] };
			await emitToolEvent({ type: "tool_execution_start", toolCallId: toolCall.id, toolName: recordName, args: toolCall.arguments });
			const outcome = await runToolCall(toolCall, {
				tools,
				assistantMessage: lastAssistant ?? ({ role: "assistant", content: [toolCall], api: this.cc.model.api, provider: this.cc.model.provider, model: this.cc.model.id, usage: EMPTY_USAGE(), stopReason: "toolUse", timestamp: Date.now() } as AssistantMessage),
				context: { messages: this.state.messages, tools },
				signal: controller.signal,
				onUpdate: (partialResult) => emitToolEvent({ type: "tool_execution_update", toolCallId: toolCall.id, toolName: recordName, args: toolCall.arguments, partialResult }),
			});
			await emitToolEvent({ type: "tool_execution_end", toolCallId: toolCall.id, toolName: recordName, result: outcome.result, isError: outcome.isError, ...(outcome.durationMs === undefined ? {} : { durationMs: outcome.durationMs }) });
			const message = {
				role: "toolResult",
				toolCallId: toolCall.id,
				toolName: recordName,
				content: outcome.result.content ?? [],
				details: outcome.result.details,
				usage: outcome.result.usage,
				isError: outcome.isError,
				...(outcome.durationMs === undefined ? {} : { durationMs: outcome.durationMs }),
				timestamp: Date.now(),
			} as ToolResultMessage;
			results.set(toolCall.id, { message, terminate: outcome.result.terminate === true });
			return { content: (message.content as (TextContent | ImageContent)[]).map((p) => (p.type === "text" ? { type: "text" as const, text: p.text } : { type: "image" as const, data: p.data, mimeType: p.mimeType })), isError: outcome.isError };
		};

		const preToolUse: HookCallbackMatcher = {
			hooks: [async (hookInput) => {
				if (hookInput.hook_event_name !== "PreToolUse") return {};
				if (this.cc.singleCall) {
					stopRequested = true;
					return { continue: false, stopReason: "Single model call" };
				}
				pendingCalls.push({ id: hookInput.tool_use_id, name: recordToolName(hookInput.tool_name), input: hookInput.tool_input });
				return {};
			}],
		};
		const postToolBatch: HookCallbackMatcher = {
			hooks: [async (hookInput) => {
				if (hookInput.hook_event_name !== "PostToolBatch") return {};
				// The batch is done, so the issuing message is complete even if
				// its closing stream events have not arrived yet.
				if (current) {
					if (current.stopReason === "stop") current.stopReason = "toolUse";
					await finishAssistant();
				}
				const toolResults: ToolResultMessage[] = [];
				let allTerminate = hookInput.tool_calls.length > 0;
				for (const call of hookInput.tool_calls) {
					const done = results.get(call.tool_use_id);
					results.delete(call.tool_use_id);
					// A call Claude Code refused before our handler ran (unknown
					// tool, denied) still needs its result in the record.
					const message = done?.message ?? ({
						role: "toolResult",
						toolCallId: call.tool_use_id,
						toolName: recordToolName(call.tool_name),
						content: [{ type: "text", text: typeof call.tool_response === "string" ? call.tool_response : JSON.stringify(call.tool_response ?? "Tool call was not executed.") }],
						details: {},
						isError: true,
						timestamp: Date.now(),
					} as ToolResultMessage);
					if (!done?.terminate) allTerminate = false;
					toolResults.push(message);
					this.push(message);
					await this.emit({ type: "message_start", message });
					await this.emit({ type: "message_end", message });
				}
				const assistant = lastAssistant!;
				const stop = allTerminate || this.cc.finishTurn?.({ message: assistant, toolResults }) === true;
				await endTurn(assistant, toolResults);
				if (stop) {
					stopRequested = true;
					return { continue: false, stopReason: "Turn ended by LearnHarness" };
				}
				// Steering at the boundary: transcript first, then the model.
				const steers = this.steering.splice(0);
				if (steers.length === 0) return {};
				await startTurn();
				await this.injectQueued(steers);
				const text = steers.map(steerText).filter(Boolean).join("\n\n");
				return text ? { hookSpecificOutput: { hookEventName: "PostToolBatch", additionalContext: text } } : {};
			}],
		};

		const { effort, thinkingOff } = effortFor(this.cc.thinkingLevel);
		const toolServer = createToolServer(tools, callTool);
		fs.mkdirSync(CLAUDE_CODE_WORKDIR, { recursive: true });
		const executable = claudeCodeExecutable();
		const options: Options = {
			systemPrompt: this.cc.systemPrompt,
			model: this.cc.model.id,
			tools: [],
			mcpServers: { [toolServer.name]: toolServer },
			allowedTools: tools.map((t) => mcpToolName(t.name)),
			permissionMode: "dontAsk",
			settingSources: [],
			strictMcpConfig: true,
			includePartialMessages: true,
			abortController: controller,
			cwd: CLAUDE_CODE_WORKDIR,
			env: claudeCodeEnv(this.cc.env),
			persistSession: !!this.cc.chatId,
			hooks: { PreToolUse: [preToolUse], PostToolBatch: [postToolBatch] },
			...(resume ? { resume } : { sessionId }),
			...(effort ? { effort } : {}),
			...(thinkingOff ? { thinking: { type: "disabled" } } : { thinking: { type: "adaptive", display: "summarized" } }),
			...(executable ? { pathToClaudeCodeExecutable: executable } : {}),
			...(this.cc.stderr ? { stderr: this.cc.stderr } : {}),
		};

		const streamed = new Set<string>(); // assistant message ids seen via stream events
		try {
			const query = this.cc.query ?? (await loadQuery());
			for await (const msg of query({ prompt: input, options })) {
				if (msg.type === "system" && (msg as { subtype?: string }).subtype === "init") {
					sessionId = (msg as { session_id: string }).session_id ?? sessionId;
					continue;
				}
				if (msg.type === "rate_limit_event") {
					noteClaudeRateLimitEvent();
					continue;
				}
				if (msg.type === "stream_event") {
					if (msg.parent_tool_use_id) continue;
					const ev = msg.event;
					switch (ev.type) {
						case "message_start": {
							await finishAssistant();
							streamed.add(ev.message.id);
							await beginAssistant(ev.message.model);
							current!.responseId = ev.message.id;
							this.applyUsage(current!, ev.message.usage as never);
							break;
						}
						case "content_block_start": {
							if (!current) break;
							const block = ev.content_block as { type: string; id?: string; name?: string; text?: string; thinking?: string; data?: string };
							const contentIndex = current.content.length;
							if (block.type === "text") {
								current.content.push({ type: "text", text: block.text ?? "" });
								await update({ type: "text_start", contentIndex, partial: current } as AssistantMessageEvent);
							} else if (block.type === "thinking" || block.type === "redacted_thinking") {
								current.content.push({ type: "thinking", thinking: block.thinking ?? "", ...(block.type === "redacted_thinking" ? { redacted: true, thinkingSignature: block.data } : {}) });
								await update({ type: "thinking_start", contentIndex, partial: current } as AssistantMessageEvent);
							} else if (block.type === "tool_use") {
								current.content.push({ type: "toolCall", id: block.id!, name: recordToolName(block.name!), arguments: {} });
								jsonBuffers.set(contentIndex, "");
								await update({ type: "toolcall_start", contentIndex, partial: current } as AssistantMessageEvent);
							} else {
								current.content.push({ type: "text", text: "" }); // keep indices aligned
							}
							break;
						}
						case "content_block_delta": {
							if (!current) break;
							const part = current.content[ev.index];
							const delta = ev.delta as { type: string; text?: string; thinking?: string; signature?: string; partial_json?: string };
							if (!part) break;
							if (delta.type === "text_delta" && part.type === "text") {
								part.text += delta.text ?? "";
								await update({ type: "text_delta", contentIndex: ev.index, delta: delta.text ?? "", partial: current } as AssistantMessageEvent);
							} else if (delta.type === "thinking_delta" && part.type === "thinking") {
								part.thinking += delta.thinking ?? "";
								await update({ type: "thinking_delta", contentIndex: ev.index, delta: delta.thinking ?? "", partial: current } as AssistantMessageEvent);
							} else if (delta.type === "signature_delta" && part.type === "thinking") {
								part.thinkingSignature = (part.thinkingSignature ?? "") + (delta.signature ?? "");
							} else if (delta.type === "input_json_delta" && part.type === "toolCall") {
								jsonBuffers.set(ev.index, (jsonBuffers.get(ev.index) ?? "") + (delta.partial_json ?? ""));
								await update({ type: "toolcall_delta", contentIndex: ev.index, delta: delta.partial_json ?? "", partial: current } as AssistantMessageEvent);
							}
							break;
						}
						case "content_block_stop": {
							if (!current) break;
							const part = current.content[ev.index];
							if (part?.type === "toolCall") {
								const raw = jsonBuffers.get(ev.index) ?? "";
								try { part.arguments = raw.trim() ? JSON.parse(raw) : {}; } catch { part.argumentsError = "Malformed tool arguments"; }
								await update({ type: "toolcall_end", contentIndex: ev.index, toolCall: part, partial: current } as AssistantMessageEvent);
							} else if (part?.type === "text") {
								await update({ type: "text_end", contentIndex: ev.index, content: part.text, partial: current } as AssistantMessageEvent);
							} else if (part?.type === "thinking") {
								await update({ type: "thinking_end", contentIndex: ev.index, content: part.thinking, partial: current } as AssistantMessageEvent);
							}
							break;
						}
						case "message_delta": {
							if (!current) {
								if (lastAssistant) this.applyUsage(lastAssistant, ev.usage as never);
								break;
							}
							current.stopReason = stopReasonOf(ev.delta.stop_reason);
							current.rawStopReason = ev.delta.stop_reason ?? undefined;
							this.applyUsage(current, ev.usage as never);
							break;
						}
						case "message_stop": {
							if (current) current.content = current.content.filter((c) => !(c.type === "text" && c.text === "" ));
							await finishAssistant();
							break;
						}
					}
					continue;
				}
				if (msg.type === "assistant") {
					if (msg.parent_tool_use_id) continue;
					// Fallback for a message that arrived without stream events
					// (partial messages off, or a replay): emit it whole.
					if (streamed.has(msg.message.id)) {
						if (msg.error && lastAssistant?.responseId === msg.message.id) {
							lastAssistant.stopReason = "error";
							lastAssistant.errorMessage = msg.error;
						}
						continue;
					}
					streamed.add(msg.message.id);
					await finishAssistant();
					await beginAssistant(msg.message.model);
					const target = current!;
					target.responseId = msg.message.id;
					for (const block of msg.message.content as unknown as { type: string; [k: string]: unknown }[]) {
						if (block.type === "text") target.content.push({ type: "text", text: String(block.text ?? "") });
						else if (block.type === "thinking") target.content.push({ type: "thinking", thinking: String(block.thinking ?? ""), thinkingSignature: block.signature as string | undefined });
						else if (block.type === "tool_use") target.content.push({ type: "toolCall", id: String(block.id), name: recordToolName(String(block.name)), arguments: (block.input ?? {}) as AgentToolCall["arguments"] });
					}
					target.stopReason = msg.error ? "error" : stopReasonOf(msg.message.stop_reason);
					if (msg.error) target.errorMessage = msg.error;
					this.applyUsage(target, msg.message.usage as never);
					await update({ type: "done", reason: target.stopReason, message: target } as AssistantMessageEvent);
					await finishAssistant();
					continue;
				}
				if (msg.type === "result") {
					await finishAssistant();
					if (msg.subtype !== "success") {
						const errors = (msg as { errors?: string[] }).errors ?? [];
						failure = errors.join("; ") || msg.subtype;
					} else if ((msg as { is_error?: boolean }).is_error) {
						failure = String((msg as { result?: string }).result ?? "Claude Code reported an error");
					}
					if (failure || stopRequested) { input.close(); continue; }
					// The model finished on its own: steering then follow-ups start
					// one more turn (pi's end-of-run polls); otherwise we are done.
					const next = this.steering.length > 0 ? this.steering.splice(0) : this.follow.splice(0);
					if (next.length === 0) { input.close(); continue; }
					await startTurn();
					await this.injectQueued(next);
					const blocks = next.flatMap((m) => renderDelta([m]) ?? []);
					input.push(userMessage(blocks.length ? blocks : [{ type: "text", text: "Continue." }]));
				}
			}
		} catch (error) {
			if (controller.signal.aborted) sawAbort = true;
			else failure = error instanceof Error ? error.message : String(error);
		} finally {
			input.close();
		}

		if (controller.signal.aborted) sawAbort = true;
		// An abort mid-message settles that message as aborted (pi's shape).
		if (current) {
			const open: AssistantMessage = current;
			open.stopReason = sawAbort ? "aborted" : "error";
			if (!sawAbort) open.errorMessage = failure ?? "Claude Code ended mid-message";
			await finishAssistant();
		} else if (failure && !sawAbort) {
			// A failure with no message in flight (startup, auth, rate limit)
			// surfaces the way pi surfaces provider errors: an error message.
			await beginAssistant(this.cc.model.id);
			const err: AssistantMessage = current!;
			err.stopReason = "error";
			err.errorMessage = failure;
			await finishAssistant();
		} else if (sawAbort && turnOpen && lastAssistant) {
			await endTurn(lastAssistant, []);
		}

		// The ledger: a clean run's session now covers the persisted record.
		if (ledger && this.cc.chatId) {
			if (sawAbort || failure) ledger.delete(this.cc.chatId);
			else {
				const after = persistedView(this.state.messages);
				if (after.length > 0) ledger.set(this.cc.chatId, { sessionId, covered: after.length, fingerprint: fingerprintOf(after[after.length - 1]) });
			}
		}
		this.controller = undefined;
		await this.emit({ type: "agent_end", messages: newMessages() });
	}

	private applyUsage(message: AssistantMessage, usage: { input_tokens?: number | null; output_tokens?: number | null; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null } | undefined) {
		if (!usage) return;
		const u = message.usage;
		if (usage.input_tokens != null) u.input = usage.input_tokens;
		if (usage.output_tokens != null) u.output = usage.output_tokens;
		if (usage.cache_read_input_tokens != null) u.cacheRead = usage.cache_read_input_tokens;
		if (usage.cache_creation_input_tokens != null) u.cacheWrite = usage.cache_creation_input_tokens;
		u.totalTokens = u.input + u.output + u.cacheRead + u.cacheWrite;
		const c = this.cc.model.cost;
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
