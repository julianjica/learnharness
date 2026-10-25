/**
 * A scripted `codex app-server` for the Codex engine tests
 * (docs/codex-engine.md). It speaks the same JSON-RPC messages as the
 * real CLI, in the order the live CLI was observed to use them:
 *
 *   item/started (reasoning | agentMessage) → deltas → item/completed
 *   item/started dynamicToolCall → SERVER request item/tool/call → our
 *   response → item/completed  (repeated per call of the step's exec)
 *   thread/tokenUsage/updated   — the end of the step (after its batch)
 *   turn/completed              — after a step without tool calls, or
 *                                 promptly once turn/interrupt arrives
 *
 * Steps are consumed in order across turns. No CLI, no network.
 */
import type { CodexTransport, ConnectFn, RpcMessage, SpawnOptions } from "../../src/agent/codex/rpc.ts";

export interface FakeStep {
	reasoning?: string;
	text?: string;
	tools?: { name: string; input: unknown }[];
}

export interface FakeCodexLog {
	spawns: SpawnOptions[];
	threadStarts: Record<string, unknown>[];
	threadResumes: Record<string, unknown>[];
	turnStarts: Record<string, unknown>[];
	steers: Record<string, unknown>[];
	interrupts: number;
	toolResponses: { callId: string; result: { contentItems: { type: string; text?: string }[]; success: boolean } }[];
	closed: number;
}

export interface FakeCodexOptions {
	/** Thread ids thread/resume reports as missing. */
	missingThreads?: string[];
	/** Called after each tool response lands (steer/abort hooks). */
	onToolDone?: () => void;
	/** Reject turn/steer (the turn is not steerable). */
	refuseSteer?: boolean;
	/** Emit a stray agent message between turn/interrupt and turn/completed. */
	leakAfterInterrupt?: boolean;
	/** Fail every turn with this message (turn/completed status "failed"). */
	failTurn?: string;
	/** The process dies at startup with this reason. */
	crash?: string;
	/** Push this RateLimitSnapshot as account/rateLimits/updated after each step. */
	rateLimits?: unknown;
}

export const newCodexLog = (): FakeCodexLog => ({ spawns: [], threadStarts: [], threadResumes: [], turnStarts: [], steers: [], interrupts: 0, toolResponses: [], closed: 0 });

export const usageOf = (input: number, cached: number, output: number) => ({ totalTokens: input + output, inputTokens: input, cachedInputTokens: cached, cacheWriteInputTokens: 0, outputTokens: output, reasoningOutputTokens: 0 });

export function fakeCodex(steps: FakeStep[], log: FakeCodexLog, opts: FakeCodexOptions = {}): ConnectFn {
	let next = 0;
	let threadCounter = 0;
	return (spawn) => {
		log.spawns.push(spawn);
		const listeners = new Set<(m: RpcMessage) => void>();
		const closers = new Set<(reason?: string) => void>();
		let closed = false;
		let serverId = 1000;
		const waiting = new Map<number, (result: unknown) => void>();
		let threadId = "";
		let interrupted = false;
		let turnCounter = 0;
		const deliver = (message: RpcMessage) => {
			setImmediate(() => {
				if (closed) return;
				for (const l of listeners) l(JSON.parse(JSON.stringify(message)) as RpcMessage);
			});
		};
		const notify = (method: string, params: Record<string, unknown>) => deliver({ method, params: { threadId, ...params } });
		const ask = (method: string, params: Record<string, unknown>) =>
			new Promise<unknown>((resolve) => {
				const id = serverId++;
				waiting.set(id, resolve);
				deliver({ id, method, params: { threadId, ...params } });
			});
		const tick = () => new Promise((r) => setImmediate(r));
		const close = (reason?: string) => {
			if (closed) return;
			closed = true;
			log.closed++;
			for (const c of closers) c(reason);
		};

		const runTurn = async (turnId: string) => {
			notify("turn/started", { turn: { id: turnId, status: "inProgress", items: [], error: null } });
			const complete = (status: string, error: unknown = null) => notify("turn/completed", { turn: { id: turnId, status, items: [], error } });
			if (opts.failTurn) {
				notify("error", { turnId, error: { message: opts.failTurn }, willRetry: false });
				complete("failed", { message: opts.failTurn });
				return;
			}
			for (;;) {
				const step = steps[next++];
				if (!step) return complete("completed");
				const n = next;
				if (step.reasoning) {
					const id = `rs_${n}`;
					notify("item/started", { turnId, item: { type: "reasoning", id, summary: [], content: [] } });
					notify("item/reasoning/summaryTextDelta", { turnId, itemId: id, delta: step.reasoning, summaryIndex: 0 });
					notify("item/completed", { turnId, item: { type: "reasoning", id, summary: [step.reasoning], content: [] } });
				}
				if (step.text) {
					const id = `msg_${n}`;
					const half = Math.floor(step.text.length / 2);
					notify("item/started", { turnId, item: { type: "agentMessage", id, text: "", phase: "final_answer" } });
					notify("item/agentMessage/delta", { turnId, itemId: id, delta: step.text.slice(0, half) });
					notify("item/agentMessage/delta", { turnId, itemId: id, delta: step.text.slice(half) });
					notify("item/completed", { turnId, item: { type: "agentMessage", id, text: step.text, phase: "final_answer" } });
				}
				const calls = (step.tools ?? []).map((c, i) => ({ ...c, id: `exec-${n}-${i}` }));
				for (const call of calls) {
					if (interrupted) break;
					notify("item/started", { turnId, item: { type: "dynamicToolCall", id: call.id, namespace: null, tool: call.name, arguments: call.input, status: "inProgress" } });
					const result = (await ask("item/tool/call", { turnId, callId: call.id, namespace: null, tool: call.name, arguments: call.input })) as FakeCodexLog["toolResponses"][number]["result"];
					log.toolResponses.push({ callId: call.id, result });
					notify("item/completed", { turnId, item: { type: "dynamicToolCall", id: call.id, tool: call.name, arguments: call.input, status: result.success ? "completed" : "failed" } });
					opts.onToolDone?.();
					await tick();
				}
				notify("thread/tokenUsage/updated", { turnId, tokenUsage: { total: usageOf(100, 40, 42), last: usageOf(100, 40, 42), modelContextWindow: 400000 } });
				if (opts.rateLimits) deliver({ method: "account/rateLimits/updated", params: { rateLimits: opts.rateLimits } });
				// Let the client react to the step's end (interrupt / steer).
				for (let i = 0; i < 5; i++) await tick();
				if (interrupted) {
					if (opts.leakAfterInterrupt) {
						notify("item/started", { turnId, item: { type: "agentMessage", id: "leak", text: "", phase: "final_answer" } });
						notify("item/completed", { turnId, item: { type: "agentMessage", id: "leak", text: "LEAKED", phase: "final_answer" } });
					}
					return complete("interrupted");
				}
				if (calls.length === 0) return complete("completed");
			}
		};

		const handle = async (message: RpcMessage) => {
			if (message.method === undefined && message.id !== undefined) {
				const resolve = waiting.get(message.id as number);
				waiting.delete(message.id as number);
				resolve?.(message.result);
				return;
			}
			const params = (message.params ?? {}) as Record<string, unknown>;
			const reply = (result: unknown) => deliver({ id: message.id, result });
			const fail = (text: string) => deliver({ id: message.id, error: { code: -32600, message: text } });
			switch (message.method) {
				case "initialize":
					return reply({ userAgent: "fake-codex", codexHome: "/tmp/fake", platformFamily: "unix", platformOs: "macos" });
				case "initialized":
					return;
				case "thread/start":
					log.threadStarts.push(params);
					threadId = `thread-${++threadCounter}`;
					return reply({ thread: { id: threadId } });
				case "thread/resume":
					log.threadResumes.push(params);
					if (opts.missingThreads?.includes(params.threadId as string)) return fail("no rollout found for thread id");
					threadId = params.threadId as string;
					// The real CLI replays the thread's last usage on resume.
					notify("thread/tokenUsage/updated", { turnId: "old-turn", tokenUsage: { total: usageOf(1, 0, 1), last: usageOf(1, 0, 1), modelContextWindow: 400000 } });
					return reply({ thread: { id: threadId } });
				case "turn/start": {
					log.turnStarts.push(params);
					interrupted = false;
					const turnId = `turn-${++turnCounter}`;
					reply({ turn: { id: turnId, status: "inProgress", items: [], error: null } });
					void runTurn(turnId);
					return;
				}
				case "turn/steer":
					if (opts.refuseSteer) return fail("active turn is not steerable");
					log.steers.push(params);
					return reply({ turnId: params.expectedTurnId });
				case "turn/interrupt":
					log.interrupts++;
					interrupted = true;
					return reply({});
				default:
					return fail(`unknown method ${message.method}`);
			}
		};

		const transport: CodexTransport = {
			send: (message) => {
				if (!closed) void handle(JSON.parse(JSON.stringify(message)) as RpcMessage);
			},
			onMessage: (l) => void listeners.add(l),
			onClose: (l) => void closers.add(l),
			close: () => close(),
		};
		if (opts.crash) setImmediate(() => close(opts.crash));
		return transport;
	};
}
