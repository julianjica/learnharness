/**
 * The Claude Code engine (docs/claude-code-engine.md): ClaudeCodeAgent
 * driven by a scripted fake of Claude Code's query(). The fake behaves
 * like the real CLI where it matters: it reads streaming input, streams
 * Anthropic events, runs PreToolUse / PostToolBatch hooks, honors
 * { continue: false }, and calls our tools over a REAL MCP connection to
 * the in-process server. No CLI, no network.
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { Type } from "typebox";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { HookCallbackMatcher, Options, SDKMessage, SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import type { AgentEvent, AgentMessage, AgentTool } from "@earendil-works/pi-agent-core";
import type { Api, AssistantMessage, Model, ToolResultMessage } from "@earendil-works/pi-ai";
import { ClaudeCodeAgent, claudeCodeRuntime, type QueryFn } from "../src/agent/claude-code/agent.ts";
import { memoryLedger } from "../src/agent/claude-code/sessions.ts";
import { claudeCodeStreamFn } from "../src/agent/claude-code/stream.ts";
import { createTeacherAgent, bareQuestionTools } from "../src/agent/teacher-agent.ts";
import { runSubagent } from "../src/agent/subagents/pi-run.ts";
import { effortFor } from "../src/agent/claude-code/catalog.ts";
import { normalizeContext } from "@earendil-works/pi-ai";

const MODEL = {
	id: "claude-sonnet-5-5",
	name: "Claude Sonnet 5.5 (Claude Code)",
	api: "anthropic-messages",
	provider: "claude-code",
	baseUrl: "",
	reasoning: true,
	input: ["text", "image"],
	cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
	contextWindow: 1_000_000,
	maxTokens: 64_000,
} as unknown as Model<Api>;

const QUIZ_INPUT = {
	question: "Which planet is closest to the sun?",
	options: [{ label: "Venus" }, { label: "Mercury" }, { label: "Mars" }],
	correctAnswer: "Mercury",
	explanation: "Mercury is the innermost planet.",
	type: "check",
	nodeId: "planet-order",
};

interface Turn {
	thinking?: string;
	text?: string;
	tools?: { name: string; input: unknown }[];
}

interface FakeLog {
	options?: Options;
	inputs: SDKUserMessage[];
	listed: { name: string; inputSchema: unknown }[];
	hookOutputs: Record<string, unknown>[];
	toolResponses: unknown[];
	runs: number;
}

const usage = (input: number, output: number) => ({ input_tokens: input, output_tokens: output, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 });

async function runHooks(matchers: HookCallbackMatcher[] | undefined, input: Record<string, unknown>): Promise<Record<string, unknown>[]> {
	const out: Record<string, unknown>[] = [];
	for (const m of matchers ?? []) for (const h of m.hooks) out.push((await h(input as never, (input.tool_use_id as string) ?? undefined, { signal: new AbortController().signal })) as Record<string, unknown>);
	return out;
}

/** A scripted Claude Code. Turns are consumed across inputs in order. */
function fakeClaudeCode(turns: Turn[], log: FakeLog, opts: { onToolDone?: () => void; early?: boolean } = {}): QueryFn {
	let next = 0;
	return ({ prompt, options }) =>
		(async function* (): AsyncGenerator<SDKMessage> {
			log.runs++;
			log.options = options;
			const input = prompt[Symbol.asyncIterator]();
			const first = await input.next();
			if (first.done) return;
			log.inputs.push(first.value);
			const server = (options.mcpServers!.lh as unknown as { instance: McpServer }).instance;
			const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
			const client = new Client({ name: "fake-claude-code", version: "1" });
			await server.connect(serverSide);
			await client.connect(clientSide);
			log.listed = (await client.listTools()).tools as never;
			const sessionId = options.resume ?? options.sessionId ?? "no-session";
			yield { type: "system", subtype: "init", session_id: sessionId } as unknown as SDKMessage;
			const signal = options.abortController?.signal;
			const result = () => ({ type: "result", subtype: "success", is_error: false, result: "", session_id: sessionId } as unknown as SDKMessage);
			try {
				for (;;) {
					const turn = turns[next++];
					if (!turn) {
						yield result();
						const more = await input.next();
						if (more.done) return;
						log.inputs.push(more.value);
						continue;
					}
					const id = `msg_${next}`;
					const ev = (event: unknown) => ({ type: "stream_event", event, parent_tool_use_id: null, uuid: id, session_id: sessionId }) as unknown as SDKMessage;
					yield ev({ type: "message_start", message: { id, model: MODEL.id, usage: usage(100, 0) } });
					let index = 0;
					if (turn.thinking) {
						yield ev({ type: "content_block_start", index, content_block: { type: "thinking", thinking: "" } });
						yield ev({ type: "content_block_delta", index, delta: { type: "thinking_delta", thinking: turn.thinking } });
						yield ev({ type: "content_block_stop", index });
						index++;
					}
					if (turn.text) {
						yield ev({ type: "content_block_start", index, content_block: { type: "text", text: "" } });
						const half = Math.floor(turn.text.length / 2);
						yield ev({ type: "content_block_delta", index, delta: { type: "text_delta", text: turn.text.slice(0, half) } });
						yield ev({ type: "content_block_delta", index, delta: { type: "text_delta", text: turn.text.slice(half) } });
						yield ev({ type: "content_block_stop", index });
						index++;
					}
					const calls = (turn.tools ?? []).map((c, i) => ({ ...c, id: `toolu_${next}_${i}` }));
					for (const call of calls) {
						yield ev({ type: "content_block_start", index, content_block: { type: "tool_use", id: call.id, name: `mcp__lh__${call.name}`, input: {} } });
						yield ev({ type: "content_block_delta", index, delta: { type: "input_json_delta", partial_json: JSON.stringify(call.input) } });
						yield ev({ type: "content_block_stop", index });
						index++;
					}
					const closeMessage = function* () {
						yield ev({ type: "message_delta", delta: { stop_reason: calls.length ? "tool_use" : "end_turn" }, usage: { output_tokens: 42 } });
						yield ev({ type: "message_stop" });
					};
					// Real Claude Code may run tools before the message's closing
					// events arrive (streaming tool execution) — `early` models that.
					if (!opts.early || calls.length === 0) yield* closeMessage();
					if (calls.length === 0) {
						yield result();
						const more = await input.next();
						if (more.done) return;
						log.inputs.push(more.value);
						continue;
					}
					let stopped = false;
					for (const call of calls) {
						const outs = await runHooks(options.hooks?.PreToolUse, { hook_event_name: "PreToolUse", tool_name: `mcp__lh__${call.name}`, tool_input: call.input, tool_use_id: call.id });
						log.hookOutputs.push(...outs);
						if (outs.some((o) => o.continue === false)) stopped = true;
					}
					const responses: unknown[] = [];
					if (!stopped) {
						for (const call of calls) {
							responses.push(await client.callTool({ name: call.name, arguments: call.input as Record<string, unknown> }));
							opts.onToolDone?.();
							if (signal?.aborted) {
								const err = new Error("aborted");
								err.name = "AbortError";
								throw err;
							}
						}
						log.toolResponses.push(...responses);
						const outs = await runHooks(options.hooks?.PostToolBatch, {
							hook_event_name: "PostToolBatch",
							tool_calls: calls.map((c, i) => ({ tool_name: `mcp__lh__${c.name}`, tool_input: c.input, tool_use_id: c.id, tool_response: responses[i] })),
						});
						log.hookOutputs.push(...outs);
						if (outs.some((o) => o.continue === false)) stopped = true;
					}
					if (opts.early) yield* closeMessage();
					if (stopped) {
						yield result();
						const more = await input.next();
						if (more.done) return;
						log.inputs.push(more.value);
					}
				}
			} finally {
				await client.close();
			}
		})();
}

const newLog = (): FakeLog => ({ inputs: [], listed: [], hookOutputs: [], toolResponses: [], runs: 0 });
const inputText = (m: SDKUserMessage) => (m.message.content as { type: string; text?: string }[]).filter((b) => b.type === "text").map((b) => b.text).join("\n");
const roles = (messages: AgentMessage[]) => messages.map((m) => (m as { role: string }).role).filter((r) => r !== "system");

const echoTool: AgentTool<any, any> = {
	name: "echo",
	label: "echo",
	description: "Echo a word back.",
	parameters: Type.Object({ word: Type.String({ description: "The word" }) }),
	execute: async (_id, input) => ({ content: [{ type: "text", text: `echo: ${(input as { word: string }).word}` }], details: { echoed: (input as { word: string }).word } }),
};

afterEach(() => {
	claudeCodeRuntime.query = undefined;
});

describe("ClaudeCodeAgent", () => {
	it("lists our TypeBox schemas verbatim over MCP and runs tools through pi", async () => {
		const log = newLog();
		const ledger = memoryLedger();
		const agent = new ClaudeCodeAgent({
			systemPrompt: "You are a tutor.",
			model: MODEL,
			tools: [echoTool],
			messages: [{ role: "user", content: "say hi", timestamp: 1 } as AgentMessage],
			chatId: "chat-1",
			ledger,
			query: fakeClaudeCode([{ text: "Calling echo.", tools: [{ name: "echo", input: { word: "hi" } }] }, { text: "Done." }], log),
		});
		const events: AgentEvent[] = [];
		agent.subscribe((e) => void events.push(e));
		await agent.continue();

		assert.equal(log.listed[0]!.name, "echo");
		assert.deepEqual((log.listed[0]!.inputSchema as { required: string[] }).required, ["word"]);
		assert.deepEqual(log.options!.tools, []);
		assert.deepEqual(log.options!.allowedTools, ["mcp__lh__echo"]);
		assert.deepEqual(log.options!.settingSources, []);
		assert.equal(log.options!.systemPrompt, "You are a tutor.");
		assert.equal(log.options!.model, "claude-sonnet-5-5");
		assert.equal(log.options!.resume, undefined, "first turn starts a new session");
		assert.equal(inputText(log.inputs[0]!), "say hi");

		assert.deepEqual(roles(agent.state.messages), ["user", "assistant", "toolResult", "assistant"]);
		const call = (agent.state.messages[2] as AssistantMessage).content.find((c) => c.type === "toolCall");
		assert.equal(call?.type === "toolCall" && call.name, "echo", "record keeps the bare tool name");
		const result = agent.state.messages[3] as ToolResultMessage;
		assert.equal(result.toolCallId, "toolu_1_0", "result correlates to Claude Code's tool_use id");
		assert.deepEqual(result.details, { echoed: "hi" });

		const types = events.map((e) => e.type);
		assert.equal(types[0], "agent_start");
		assert.equal(types.at(-1), "agent_end");
		assert.ok(types.includes("message_update"));
		assert.deepEqual(types.filter((t) => t === "turn_end").length, 2);
		const order = types.filter((t) => t.startsWith("tool_execution") || t === "turn_end");
		assert.deepEqual(order.slice(0, 3), ["tool_execution_start", "tool_execution_end", "turn_end"]);
		const end = events.at(-1) as Extract<AgentEvent, { type: "agent_end" }>;
		assert.equal(end.messages.length, 3, "agent_end carries only this run's messages");

		const usageOf = (agent.state.messages[2] as AssistantMessage).usage;
		assert.equal(usageOf.input, 100);
		assert.equal(usageOf.output, 42);
		assert.deepEqual(ledger.get("chat-1"), { sessionId: log.options!.sessionId, covered: 4, fingerprint: `assistant:${(agent.state.messages[4] as AssistantMessage).timestamp}` });
	});

	it("keeps pi's event order when Claude Code runs a tool before the message closes", async () => {
		const log = newLog();
		const agent = new ClaudeCodeAgent({
			systemPrompt: "s",
			model: MODEL,
			tools: [echoTool],
			messages: [{ role: "user", content: "go", timestamp: 1 } as AgentMessage],
			query: fakeClaudeCode([{ tools: [{ name: "echo", input: { word: "a" } }] }, { text: "done" }], log, { early: true }),
		});
		const order: string[] = [];
		agent.subscribe((e) => {
			if (e.type === "message_end" || e.type === "tool_execution_start" || e.type === "tool_execution_end" || e.type === "turn_end") order.push(`${e.type}${e.type === "message_end" ? `:${(e.message as { role: string }).role}` : ""}`);
		});
		await agent.continue();
		assert.deepEqual(order.slice(0, 5), ["message_end:assistant", "tool_execution_start", "tool_execution_end", "message_end:toolResult", "turn_end"]);
		const first = agent.state.messages.find((m) => (m as { role: string }).role === "assistant") as AssistantMessage;
		assert.equal(first.stopReason, "toolUse");
		assert.equal(first.usage.output, 42, "late usage still lands on the message");
	});

	it("rejects invalid arguments through pi validation (the model gets an error result)", async () => {
		const log = newLog();
		const agent = new ClaudeCodeAgent({
			systemPrompt: "s",
			model: MODEL,
			tools: [echoTool],
			messages: [{ role: "user", content: "go", timestamp: 1 } as AgentMessage],
			query: fakeClaudeCode([{ tools: [{ name: "echo", input: { nope: 1 } }] }, { text: "ok" }], log),
		});
		await agent.continue();
		const result = agent.state.messages.find((m) => (m as { role: string }).role === "toolResult") as ToolResultMessage;
		assert.equal(result.isError, true);
		assert.equal((log.toolResponses[0] as { isError: boolean }).isError, true);
	});
});

describe("teacher on Claude Code", () => {
	it("ends the turn at a posed question and resumes with the learner's answer", async () => {
		const log = newLog();
		const ledger = memoryLedger();
		claudeCodeRuntime.query = fakeClaudeCode([{ thinking: "Probe first.", text: "Quick check:", tools: [{ name: "quiz", input: QUIZ_INPUT }] }, { text: "Correct — Mercury." }], log);
		const engine = { model: MODEL, streamFn: () => { throw new Error("unused"); }, level: "high" as const };
		const opening = { role: "user", content: "Teach me planets", timestamp: 10 } as AgentMessage;

		const first = createTeacherAgent(undefined, { engine, tools: bareQuestionTools(), messages: [opening], chatId: "chat-q" });
		assert.ok(first instanceof ClaudeCodeAgent);
		(first as unknown as { cc: { ledger: unknown } }).cc.ledger = ledger;
		await first.continue();

		assert.deepEqual(roles(first.state.messages), ["user", "assistant", "toolResult"]);
		assert.ok(log.hookOutputs.some((o) => o.continue === false), "PostToolBatch stopped the run");
		assert.equal(log.options!.effort, "high");
		assert.deepEqual(log.options!.thinking, { type: "adaptive", display: "summarized" });
		const entry = ledger.get("chat-q")!;
		assert.equal(entry.covered, 2, "the in-memory question placeholder is not counted");

		// The learner answers: the record gains the answer as the call's result.
		const assistant = first.state.messages[2] as AssistantMessage;
		const callId = (assistant.content.find((c) => c.type === "toolCall") as { id: string }).id;
		const answer = { role: "toolResult", toolCallId: callId, toolName: "quiz", content: [{ type: "text", text: '{"picked":"Mercury","correct":true}' }], details: { picked: "Mercury" }, isError: false, timestamp: 30 } as AgentMessage;
		const record = [opening, assistant, answer];
		const second = createTeacherAgent(undefined, { engine, tools: bareQuestionTools(), messages: record, chatId: "chat-q" });
		(second as unknown as { cc: { ledger: unknown } }).cc.ledger = ledger;
		await second.continue();

		assert.equal(log.options!.resume, entry.sessionId, "second turn resumes the session");
		const sent = inputText(log.inputs.at(-1)!);
		assert.match(sent, /\[Result for your quiz call\]/);
		assert.match(sent, /Mercury/);
		assert.deepEqual(roles(second.state.messages), ["user", "assistant", "toolResult", "assistant"]);
	});

	it("starts a fresh session with the rendered transcript when the record diverged", async () => {
		const log = newLog();
		const ledger = memoryLedger();
		ledger.set("chat-x", { sessionId: "old-session", covered: 2, fingerprint: "assistant:999" });
		const messages = [
			{ role: "user", content: "Teach me", timestamp: 1 },
			{ role: "assistant", content: [{ type: "text", text: "Sure, first a question." }], api: "anthropic-messages", provider: "claude-code", model: MODEL.id, usage: {}, stopReason: "stop", timestamp: 2 },
			{ role: "user", content: "ok go", timestamp: 3 },
		] as unknown as AgentMessage[];
		const agent = new ClaudeCodeAgent({ systemPrompt: "s", model: MODEL, tools: [], messages, chatId: "chat-x", ledger, query: fakeClaudeCode([{ text: "Here we go." }], log) });
		await agent.continue();
		assert.equal(log.options!.resume, undefined);
		assert.notEqual(log.options!.sessionId, "old-session");
		const seed = inputText(log.inputs[0]!);
		assert.match(seed, /<learner>\nTeach me\n<\/learner>/);
		assert.match(seed, /<you>\nSure, first a question.\n<\/you>/);
		assert.match(seed, /ok go/);
		assert.equal(ledger.get("chat-x")!.sessionId, log.options!.sessionId);
	});
});

describe("steering and abort", () => {
	it("injects a steer at the tool-batch boundary (transcript + additionalContext)", async () => {
		const log = newLog();
		let agent!: ClaudeCodeAgent;
		const steer = { id: "steer_j1", role: "custom", customType: "subagent-steer", content: "Research finished: Mercury has no moons.", display: true, details: {}, timestamp: 5 } as unknown as AgentMessage;
		let sent = false;
		agent = new ClaudeCodeAgent({
			systemPrompt: "s",
			model: MODEL,
			tools: [echoTool],
			messages: [{ role: "user", content: "go", timestamp: 1 } as AgentMessage],
			query: fakeClaudeCode([{ tools: [{ name: "echo", input: { word: "a" } }] }, { text: "Noted the research." }], log, {
				onToolDone: () => { if (!sent) { sent = true; agent.steer(steer); } },
			}),
		});
		const ends: AgentMessage[] = [];
		agent.subscribe((e) => { if (e.type === "message_end") ends.push(e.message); });
		await agent.continue();
		assert.ok(ends.some((m) => (m as { id?: string }).id === "steer_j1"), "steer is visible (message_end)");
		assert.ok(agent.state.messages.some((m) => (m as { id?: string }).id === "steer_j1"), "steer is in the record (consumed)");
		const context = log.hookOutputs.map((o) => (o.hookSpecificOutput as { additionalContext?: string } | undefined)?.additionalContext).find(Boolean);
		assert.ok(context && context.length > 0, "the model receives the steer at the boundary");
		assert.equal(agent.hasQueuedMessages(), false);
	});

	it("abort settles an aborted turn and drops the ledger entry", async () => {
		const log = newLog();
		const ledger = memoryLedger();
		ledger.set("chat-a", { sessionId: "s", covered: 0, fingerprint: "" });
		let agent!: ClaudeCodeAgent;
		agent = new ClaudeCodeAgent({
			systemPrompt: "s",
			model: MODEL,
			tools: [echoTool],
			messages: [{ role: "user", content: "go", timestamp: 1 } as AgentMessage],
			chatId: "chat-a",
			ledger,
			query: fakeClaudeCode([{ tools: [{ name: "echo", input: { word: "a" } }] }, { text: "never" }], log, { onToolDone: () => agent.abort() }),
		});
		await agent.continue();
		assert.equal(ledger.get("chat-a"), undefined);
		assert.ok(!agent.state.messages.some((m) => (m as AssistantMessage).content?.[0]?.type === "text" && ((m as AssistantMessage).content[0] as { text: string }).text === "never"));
	});

	it("a startup failure surfaces as an error assistant message", async () => {
		const agent = new ClaudeCodeAgent({
			systemPrompt: "s",
			model: MODEL,
			tools: [],
			messages: [{ role: "user", content: "go", timestamp: 1 } as AgentMessage],
			query: () => (async function* (): AsyncGenerator<SDKMessage> { throw new Error("Not logged in · Please run /login"); })(),
		});
		await agent.continue();
		const last = agent.state.messages.at(-1) as AssistantMessage;
		assert.equal(last.stopReason, "error");
		assert.match(last.errorMessage!, /run \/login/);
	});
});

describe("background agents on Claude Code", () => {
	it("runSubagent honors maxTurns and returns the final text", async () => {
		const log = newLog();
		claudeCodeRuntime.query = fakeClaudeCode([{ tools: [{ name: "echo", input: { word: "1" } }] }, { tools: [{ name: "echo", input: { word: "2" } }] }, { text: "unreached" }], log);
		const engine = { model: MODEL, streamFn: () => { throw new Error("unused"); } };
		const out = await runSubagent([echoTool], { role: "researcher" as never, engine, systemPrompt: "research", prompt: "find", maxTurns: 2 });
		assert.equal(log.options!.persistSession, false);
		assert.equal(out.newMessages.filter((m) => (m as { role: string }).role === "assistant").length, 2);
	});

	it("the single-call streamFn returns tool calls unexecuted", async () => {
		const log = newLog();
		let executed = false;
		const tool: AgentTool<any, any> = { ...echoTool, execute: async () => { executed = true; return { content: [], details: {} }; } };
		const streamFn = claudeCodeStreamFn("medium", fakeClaudeCode([{ text: "Drawing.", tools: [{ name: "echo", input: { word: "svg" } }] }], log));
		const stream = streamFn(MODEL, normalizeContext({ systemPrompt: "draw", messages: [{ role: "user", content: "a circle", timestamp: 1 }], tools: [tool] }));
		const types: string[] = [];
		let final: AssistantMessage | undefined;
		for await (const event of stream) {
			types.push(event.type);
			if (event.type === "done") final = event.message;
		}
		assert.equal(types[0], "start");
		assert.equal(types.at(-1), "done");
		assert.equal(executed, false);
		assert.equal(final!.stopReason, "toolUse");
		assert.equal(final!.content.find((c) => c.type === "toolCall")?.type, "toolCall");
		assert.equal(log.options!.systemPrompt, "draw");
	});

	it("maps thinking levels to Claude Code effort", () => {
		assert.deepEqual(effortFor("off"), { thinkingOff: true });
		assert.deepEqual(effortFor("minimal"), { effort: "low", thinkingOff: false });
		assert.deepEqual(effortFor("xhigh"), { effort: "xhigh", thinkingOff: false });
		assert.deepEqual(effortFor("max"), { effort: "max", thinkingOff: false });
	});
});
