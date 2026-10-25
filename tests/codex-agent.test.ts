/**
 * The Codex engine (docs/codex-engine.md): CodexAgent driven by a
 * scripted fake of `codex app-server` (tests/fixtures/fake-codex.ts). The
 * fake speaks the real JSON-RPC messages in the order the live CLI uses
 * them: dynamic tool calls as server requests, the step's end as
 * thread/tokenUsage/updated, turn/interrupt honored at the boundary.
 * No CLI, no network.
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { Type } from "typebox";
import type { AgentEvent, AgentMessage, AgentTool } from "@earendil-works/pi-agent-core";
import type { Api, AssistantMessage, Model, ToolResultMessage } from "@earendil-works/pi-ai";
import { normalizeContext } from "@earendil-works/pi-ai";
import { CodexAgent, codexRuntime } from "../src/agent/codex/agent.ts";
import { effortFor } from "../src/agent/codex/catalog.ts";
import { codexArgs, codexEnv } from "../src/agent/codex/rpc.ts";
import { memoryLedger, toolsFingerprintOf } from "../src/agent/codex/sessions.ts";
import { codexStreamFn } from "../src/agent/codex/stream.ts";
import { createTeacherAgent, bareQuestionTools } from "../src/agent/teacher-agent.ts";
import { runSubagent } from "../src/agent/subagents/pi-run.ts";
import { fakeCodex, newCodexLog } from "./fixtures/fake-codex.ts";

const MODEL = {
	id: "gpt-5.6-sol",
	name: "GPT-5.6 Sol (Codex)",
	api: "openai-codex-responses",
	provider: "codex",
	baseUrl: "",
	reasoning: true,
	input: ["text", "image"],
	cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
	contextWindow: 400_000,
	maxTokens: 128_000,
} as unknown as Model<Api>;

const QUIZ_INPUT = {
	question: "Which planet is closest to the sun?",
	options: [{ label: "Venus" }, { label: "Mercury" }, { label: "Mars" }],
	correctAnswer: "Mercury",
	explanation: "Mercury is the innermost planet.",
	type: "check",
	nodeId: "planet-order",
};

const roles = (messages: AgentMessage[]) => messages.map((m) => (m as { role: string }).role).filter((r) => r !== "system");
const inputText = (params: Record<string, unknown>) => (params.input as { type: string; text?: string }[]).filter((i) => i.type === "text").map((i) => i.text).join("\n");

const echoTool: AgentTool<any, any> = {
	name: "echo",
	label: "echo",
	description: "Echo a word back.",
	parameters: Type.Object({ word: Type.String({ description: "The word" }) }),
	execute: async (_id, input) => ({ content: [{ type: "text", text: `echo: ${(input as { word: string }).word}` }], details: { echoed: (input as { word: string }).word } }),
};

const realLedger = codexRuntime.ledger;
afterEach(() => {
	codexRuntime.connect = undefined;
	codexRuntime.ledger = realLedger;
});

describe("CodexAgent", () => {
	it("registers our schemas as dynamic tools and runs them through pi", async () => {
		const log = newCodexLog();
		const ledger = memoryLedger();
		const agent = new CodexAgent({
			systemPrompt: "You are a tutor.",
			model: MODEL,
			tools: [echoTool],
			messages: [{ role: "user", content: "say hi", timestamp: 1 } as AgentMessage],
			chatId: "chat-1",
			ledger,
			connect: fakeCodex([{ text: "Calling echo.", tools: [{ name: "echo", input: { word: "hi" } }] }, { text: "Done." }], log),
		});
		const events: AgentEvent[] = [];
		agent.subscribe((e) => void events.push(e));
		await agent.continue();

		const start = log.threadStarts[0]!;
		assert.equal(start.baseInstructions, "You are a tutor.");
		assert.equal(start.model, "gpt-5.6-sol");
		assert.equal(start.sandbox, "read-only");
		assert.equal(start.approvalPolicy, "never");
		assert.equal(start.ephemeral, false, "a chat's thread persists so it can resume");
		const tool = (start.dynamicTools as { name: string; inputSchema: { required: string[] } }[])[0]!;
		assert.equal(tool.name, "echo");
		assert.deepEqual(tool.inputSchema.required, ["word"], "the TypeBox schema goes over verbatim");
		assert.equal(inputText(log.turnStarts[0]!), "say hi");

		assert.deepEqual(roles(agent.state.messages), ["user", "assistant", "toolResult", "assistant"]);
		const call = (agent.state.messages[2] as AssistantMessage).content.find((c) => c.type === "toolCall");
		assert.equal(call?.type === "toolCall" && call.name, "echo");
		assert.equal((agent.state.messages[2] as AssistantMessage).stopReason, "toolUse");
		const result = agent.state.messages[3] as ToolResultMessage;
		assert.equal(result.toolCallId, "exec-1-0", "result correlates to Codex's call id");
		assert.deepEqual(result.details, { echoed: "hi" });
		assert.deepEqual(log.toolResponses[0]!.result, { contentItems: [{ type: "inputText", text: "echo: hi" }], success: true });

		const types = events.map((e) => e.type);
		assert.equal(types[0], "agent_start");
		assert.equal(types.at(-1), "agent_end");
		assert.equal(types.filter((t) => t === "turn_end").length, 2);
		const order = events
			.filter((e) => e.type === "message_end" || e.type.startsWith("tool_execution") || e.type === "turn_end")
			.map((e) => `${e.type}${e.type === "message_end" ? `:${(e.message as { role: string }).role}` : ""}`);
		assert.deepEqual(order.slice(0, 5), ["message_end:assistant", "tool_execution_start", "tool_execution_end", "message_end:toolResult", "turn_end"], "pi's order: tool events after their message ends");

		const usage = (agent.state.messages[2] as AssistantMessage).usage;
		assert.equal(usage.input, 60, "cached tokens are split out of inputTokens");
		assert.equal(usage.cacheRead, 40);
		assert.equal(usage.output, 42);
		assert.deepEqual(ledger.get("chat-1"), { threadId: "thread-1", covered: 4, fingerprint: `assistant:${(agent.state.messages[4] as AssistantMessage).timestamp}`, toolsFingerprint: toolsFingerprintOf([echoTool]) });
		assert.equal(log.closed, 1, "the app-server process is closed after the run");
	});

	it("streams text and reasoning deltas as pi message updates", async () => {
		const log = newCodexLog();
		const agent = new CodexAgent({ systemPrompt: "s", model: MODEL, thinkingLevel: "high", tools: [], messages: [{ role: "user", content: "go", timestamp: 1 } as AgentMessage], connect: fakeCodex([{ reasoning: "Think first.", text: "Hello there." }], log) });
		const updates: string[] = [];
		agent.subscribe((e) => { if (e.type === "message_update") updates.push(e.assistantMessageEvent.type); });
		await agent.continue();
		const last = agent.state.messages.at(-1) as AssistantMessage;
		assert.deepEqual(last.content.map((c) => c.type), ["thinking", "text"]);
		assert.equal((last.content[1] as { text: string }).text, "Hello there.");
		assert.ok(updates.includes("thinking_delta") && updates.includes("text_delta") && updates.includes("text_end"));
		assert.equal(log.turnStarts[0]!.effort, "high");
		assert.equal(log.turnStarts[0]!.summary, "auto");
		assert.equal(log.threadStarts[0]!.ephemeral, true, "no chat id → an ephemeral thread");
	});

	it("rejects invalid arguments through pi validation (Codex gets a failed result)", async () => {
		const log = newCodexLog();
		const agent = new CodexAgent({ systemPrompt: "s", model: MODEL, tools: [echoTool], messages: [{ role: "user", content: "go", timestamp: 1 } as AgentMessage], connect: fakeCodex([{ tools: [{ name: "echo", input: { nope: 1 } }] }, { text: "ok" }], log) });
		await agent.continue();
		const result = agent.state.messages.find((m) => (m as { role: string }).role === "toolResult") as ToolResultMessage;
		assert.equal(result.isError, true);
		assert.equal(log.toolResponses[0]!.result.success, false);
	});
});

describe("teacher on Codex", () => {
	it("ends the turn at a posed question and resumes the thread with the learner's answer", async () => {
		const log = newCodexLog();
		codexRuntime.ledger = memoryLedger();
		codexRuntime.connect = fakeCodex([{ reasoning: "Probe first.", text: "Quick check:", tools: [{ name: "quiz", input: QUIZ_INPUT }] }, { text: "Correct — Mercury." }], log, { leakAfterInterrupt: true });
		const engine = { model: MODEL, streamFn: () => { throw new Error("unused"); }, level: "medium" as const };
		const opening = { role: "user", content: "Teach me planets", timestamp: 10 } as AgentMessage;

		const first = createTeacherAgent(undefined, { engine, tools: bareQuestionTools(), messages: [opening], chatId: "chat-q" });
		assert.ok(first instanceof CodexAgent);
		await first.continue();

		assert.deepEqual(roles(first.state.messages), ["user", "assistant", "toolResult"]);
		assert.equal(log.interrupts, 1, "the question stop interrupts the Codex turn");
		assert.ok(!JSON.stringify(first.state.messages).includes("LEAKED"), "nothing after the stop lands in the record");
		const entry = codexRuntime.ledger.get("chat-q")!;
		assert.equal(entry.covered, 2, "the in-memory question placeholder is not counted");

		const assistant = first.state.messages[2] as AssistantMessage;
		const callId = (assistant.content.find((c) => c.type === "toolCall") as { id: string }).id;
		const answer = { role: "toolResult", toolCallId: callId, toolName: "quiz", content: [{ type: "text", text: '{"picked":"Mercury","correct":true}' }], details: { picked: "Mercury" }, isError: false, timestamp: 30 } as AgentMessage;
		const second = createTeacherAgent(undefined, { engine, tools: bareQuestionTools(), messages: [opening, assistant, answer], chatId: "chat-q" });
		await second.continue();

		assert.equal(log.threadStarts.length, 1, "no second thread");
		assert.equal(log.threadResumes[0]!.threadId, entry.threadId, "the answer resumes the thread");
		assert.equal(typeof log.threadResumes[0]!.baseInstructions, "string", "the resumed thread gets the current system prompt");
		const sent = inputText(log.turnStarts.at(-1)!);
		assert.match(sent, /\[Result for your quiz call\]/);
		assert.match(sent, /Mercury/);
		assert.deepEqual(roles(second.state.messages), ["user", "assistant", "toolResult", "assistant"]);
	});

	it("a different tool set (prober → teacher) starts a fresh thread seeded with the transcript", async () => {
		const log = newCodexLog();
		const ledger = memoryLedger();
		const messages = [
			{ role: "user", content: "Teach me", timestamp: 1 },
			{ role: "assistant", content: [{ type: "text", text: "Sure, first a question." }], api: "openai-codex-responses", provider: "codex", model: MODEL.id, usage: {}, stopReason: "stop", timestamp: 2 },
			{ role: "user", content: "ok go", timestamp: 3 },
		] as unknown as AgentMessage[];
		ledger.set("chat-t", { threadId: "old-thread", covered: 2, fingerprint: "assistant:2", toolsFingerprint: "prober-tools" });
		const agent = new CodexAgent({ systemPrompt: "s", model: MODEL, tools: [echoTool], messages, chatId: "chat-t", ledger, connect: fakeCodex([{ text: "Here we go." }], log) });
		await agent.continue();
		assert.equal(log.threadResumes.length, 0);
		assert.equal(log.threadStarts.length, 1);
		const seed = inputText(log.turnStarts[0]!);
		assert.match(seed, /<learner>\nTeach me\n<\/learner>/);
		assert.match(seed, /<you>\nSure, first a question.\n<\/you>/);
		assert.match(seed, /ok go/);
		assert.equal(ledger.get("chat-t")!.toolsFingerprint, toolsFingerprintOf([echoTool]));
	});

	it("a record that diverged from the ledger seeds a new thread", async () => {
		const log = newCodexLog();
		const ledger = memoryLedger();
		ledger.set("chat-x", { threadId: "old", covered: 1, fingerprint: "user:999", toolsFingerprint: toolsFingerprintOf([]) });
		const agent = new CodexAgent({ systemPrompt: "s", model: MODEL, tools: [], messages: [{ role: "user", content: "hello", timestamp: 1 } as AgentMessage], chatId: "chat-x", ledger, connect: fakeCodex([{ text: "Hi." }], log) });
		await agent.continue();
		assert.equal(log.threadResumes.length, 0);
		assert.equal(ledger.get("chat-x")!.threadId, "thread-1");
	});

	it("a thread Codex no longer has falls back to a fresh seeded thread", async () => {
		const log = newCodexLog();
		const ledger = memoryLedger();
		const opening = { role: "user", content: "Teach me", timestamp: 1 } as AgentMessage;
		const reply = { role: "assistant", content: [{ type: "text", text: "First, a question." }], api: "openai-codex-responses", provider: "codex", model: MODEL.id, usage: {}, stopReason: "stop", timestamp: 2 } as unknown as AgentMessage;
		const followUp = { role: "user", content: "go on", timestamp: 3 } as AgentMessage;
		ledger.set("chat-m", { threadId: "gone", covered: 2, fingerprint: "assistant:2", toolsFingerprint: toolsFingerprintOf([]) });
		const agent = new CodexAgent({ systemPrompt: "s", model: MODEL, tools: [], messages: [opening, reply, followUp], chatId: "chat-m", ledger, connect: fakeCodex([{ text: "Continuing." }], log, { missingThreads: ["gone"] }) });
		await agent.continue();
		assert.equal(log.threadResumes.length, 1);
		assert.equal(log.threadStarts.length, 1);
		assert.match(inputText(log.turnStarts[0]!), /<you>\nFirst, a question.\n<\/you>/, "the fallback sends the whole transcript, not the delta");
		assert.equal(ledger.get("chat-m")!.threadId, "thread-1");
	});
});

describe("steering, abort and failures", () => {
	const steerMarker = { id: "steer_j1", role: "custom", customType: "subagent-steer", content: "Research finished: Mercury has no moons.", display: true, details: {}, timestamp: 5 } as unknown as AgentMessage;

	it("injects a steer at the step boundary (transcript + turn/steer)", async () => {
		const log = newCodexLog();
		let agent!: CodexAgent;
		let sent = false;
		agent = new CodexAgent({
			systemPrompt: "s", model: MODEL, tools: [echoTool],
			messages: [{ role: "user", content: "go", timestamp: 1 } as AgentMessage],
			connect: fakeCodex([{ tools: [{ name: "echo", input: { word: "a" } }] }, { text: "Noted the research." }], log, { onToolDone: () => { if (!sent) { sent = true; agent.steer(steerMarker); } } }),
		});
		const ends: AgentMessage[] = [];
		agent.subscribe((e) => { if (e.type === "message_end") ends.push(e.message); });
		await agent.continue();
		assert.ok(ends.some((m) => (m as { id?: string }).id === "steer_j1"), "steer is visible (message_end)");
		assert.ok(agent.state.messages.some((m) => (m as { id?: string }).id === "steer_j1"), "steer is in the record (consumed)");
		assert.equal(log.steers.length, 1);
		assert.equal(log.steers[0]!.expectedTurnId, "turn-1");
		assert.match(inputText(log.steers[0]!), /Mercury has no moons/);
		assert.equal(agent.hasQueuedMessages(), false);
	});

	it("a steer Codex refuses mid-turn is sent as the next turn's input", async () => {
		const log = newCodexLog();
		let agent!: CodexAgent;
		let sent = false;
		agent = new CodexAgent({
			systemPrompt: "s", model: MODEL, tools: [echoTool],
			messages: [{ role: "user", content: "go", timestamp: 1 } as AgentMessage],
			connect: fakeCodex([{ tools: [{ name: "echo", input: { word: "a" } }] }, { text: "Finished." }, { text: "Saw the research." }], log, { refuseSteer: true, onToolDone: () => { if (!sent) { sent = true; agent.steer(steerMarker); } } }),
		});
		await agent.continue();
		assert.equal(log.turnStarts.length, 2);
		assert.match(inputText(log.turnStarts[1]!), /Mercury has no moons/);
		assert.equal((agent.state.messages.at(-1) as AssistantMessage).content[0]!.type, "text");
	});

	it("abort interrupts, settles the run and drops the ledger entry", async () => {
		const log = newCodexLog();
		const ledger = memoryLedger();
		ledger.set("chat-a", { threadId: "t", covered: 0, fingerprint: "", toolsFingerprint: "" });
		let agent!: CodexAgent;
		agent = new CodexAgent({
			systemPrompt: "s", model: MODEL, tools: [echoTool],
			messages: [{ role: "user", content: "go", timestamp: 1 } as AgentMessage],
			chatId: "chat-a", ledger,
			connect: fakeCodex([{ tools: [{ name: "echo", input: { word: "a" } }] }, { text: "never" }], log, { onToolDone: () => agent.abort() }),
		});
		const end = new Promise<AgentEvent>((resolve) => agent.subscribe((e) => { if (e.type === "agent_end") resolve(e); }));
		await agent.continue();
		await end;
		assert.equal(ledger.get("chat-a"), undefined);
		assert.ok(!JSON.stringify(agent.state.messages).includes("never"));
		const last = agent.state.messages.at(-1) as AssistantMessage;
		assert.equal(last.stopReason, "aborted");
	});

	it("a process that dies at startup surfaces as an error assistant message", async () => {
		const log = newCodexLog();
		const agent = new CodexAgent({ systemPrompt: "s", model: MODEL, tools: [], messages: [{ role: "user", content: "go", timestamp: 1 } as AgentMessage], connect: fakeCodex([], log, { crash: "Codex CLI not found (codex). Install Codex or set LH_CODEX_PATH." }) });
		await agent.continue();
		const last = agent.state.messages.at(-1) as AssistantMessage;
		assert.equal(last.stopReason, "error");
		assert.match(last.errorMessage!, /LH_CODEX_PATH/);
	});

	it("a failed turn (not signed in, rate limit) carries Codex's own message", async () => {
		const log = newCodexLog();
		const ledger = memoryLedger();
		const agent = new CodexAgent({ systemPrompt: "s", model: MODEL, tools: [], messages: [{ role: "user", content: "go", timestamp: 1 } as AgentMessage], chatId: "chat-f", ledger, connect: fakeCodex([], log, { failTurn: "You've hit your usage limit." }) });
		await agent.continue();
		const last = agent.state.messages.at(-1) as AssistantMessage;
		assert.equal(last.stopReason, "error");
		assert.match(last.errorMessage!, /usage limit/);
		assert.equal(ledger.get("chat-f"), undefined);
	});
});

describe("background agents on Codex", () => {
	it("runSubagent honors maxTurns on one ephemeral thread", async () => {
		const log = newCodexLog();
		codexRuntime.connect = fakeCodex([{ tools: [{ name: "echo", input: { word: "1" } }] }, { tools: [{ name: "echo", input: { word: "2" } }] }, { text: "unreached" }], log);
		const engine = { model: MODEL, streamFn: () => { throw new Error("unused"); } };
		const out = await runSubagent([echoTool], { role: "researcher" as never, engine, systemPrompt: "research", prompt: "find", maxTurns: 2 });
		assert.equal(log.threadStarts[0]!.ephemeral, true);
		assert.equal(log.interrupts, 1);
		assert.equal(out.newMessages.filter((m) => (m as { role: string }).role === "assistant").length, 2);
	});

	it("the single-call streamFn returns the step's tool calls unexecuted", async () => {
		const log = newCodexLog();
		let executed = false;
		const tool: AgentTool<any, any> = { ...echoTool, execute: async () => { executed = true; return { content: [], details: {} }; } };
		const streamFn = codexStreamFn("medium", fakeCodex([{ text: "Drawing.", tools: [{ name: "echo", input: { word: "svg" } }] }], log));
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
		assert.equal(log.toolResponses[0]!.result.contentItems[0]!.text, "Recorded.");
		assert.equal(final!.stopReason, "toolUse");
		assert.equal(final!.content.find((c) => c.type === "toolCall")?.type, "toolCall");
		assert.equal(log.threadStarts[0]!.baseInstructions, "draw");
		assert.equal(log.interrupts, 1);
	});
});

describe("Codex process configuration", () => {
	it("maps thinking levels to Codex effort (never ultra)", () => {
		assert.deepEqual(effortFor("off"), { effort: "low", summary: "none" });
		assert.deepEqual(effortFor("minimal"), { effort: "low", summary: "auto" });
		assert.deepEqual(effortFor("xhigh"), { effort: "xhigh", summary: "auto" });
		assert.deepEqual(effortFor("max"), { effort: "max", summary: "auto" });
		assert.deepEqual(effortFor(undefined), { summary: "auto" });
	});

	it("switches Codex's built-ins off but keeps code mode", () => {
		const args = codexArgs().join(" ");
		assert.ok(args.startsWith("app-server"));
		for (const feature of ["shell_tool", "unified_exec", "apps", "plugins", "multi_agent"]) assert.ok(args.includes(`--disable ${feature}`), feature);
		assert.ok(!args.includes("code_mode_host"), "code-mode-only models reach our tools through code mode");
		assert.ok(args.includes('web_search="disabled"'));
		assert.ok(args.includes("mcp_servers={}"));
	});

	it("strips API keys from the child env unless LH_CODEX_USE_API_KEY=1", () => {
		const saved = { OPENAI_API_KEY: process.env.OPENAI_API_KEY, LH_CODEX_USE_API_KEY: process.env.LH_CODEX_USE_API_KEY };
		try {
			process.env.OPENAI_API_KEY = "sk-test";
			delete process.env.LH_CODEX_USE_API_KEY;
			assert.equal(codexEnv().OPENAI_API_KEY, undefined);
			process.env.LH_CODEX_USE_API_KEY = "1";
			assert.equal(codexEnv().OPENAI_API_KEY, "sk-test");
		} finally {
			for (const [k, v] of Object.entries(saved)) if (v === undefined) delete process.env[k]; else process.env[k] = v;
		}
	});
});
