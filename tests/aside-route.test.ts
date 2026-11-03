/**
 * The side-question route (asides — the main teacher answers them since
 * owner 2026-11-03; src/server/aside.ts): the gates (no anchor / probe /
 * busy refuse), the side turn's run on an out-of-band copy of the record
 * (the record's messages stay byte-identical), what persists (the pending
 * aside, its plan revision, its usage), the silent in-flight lock, and the
 * wire the model receives — the lesson's own system prompt, the waiting
 * check's placeholder result, the side-thread rules in the user message,
 * and the side tool set. The engine is a scripted stream behind the
 * asideRuntime seam (a pi-side provider, so the real Agent loop runs); no
 * network.
 *
 * Isolated LH_DATA_DIR, set before any config-loading import.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, afterEach, describe, it } from "node:test";
import { AssistantMessageEventStream } from "@earendil-works/pi-ai/utils/event-stream";
import type { Api, AssistantMessage, Context, Model } from "@earendil-works/pi-ai";

const TMP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lh-aside-route-"));
process.env.LH_DATA_DIR = TMP_DATA;
process.env.LH_CLAUDE_CODE = "1";

const { handleAsideRequest, asideRuntime } = await import("../src/server/aside.ts");
const { chatStore } = await import("../src/store/chats.ts");
const { beginTurn, endTurn, isTurnRunning } = await import("../src/server/turn-liveness.ts");
const { inputAppends } = await import("../src/core/input-events.ts");
const { SIDE_PENDING_TEXT } = await import("../src/agent/aside.ts");
type LhMessage = import("../src/core/native-messages.ts").LhMessage;

after(() => fs.rmSync(TMP_DATA, { recursive: true, force: true }));
afterEach(() => {
	asideRuntime.engineFor = undefined;
});

const usage = { input: 120, output: 30, cacheRead: 0, cacheWrite: 0, totalTokens: 150, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } };
const contexts: Context[] = [];
type Reply = { text?: string[]; tool?: { name: string; args: unknown } };

/** A scripted engine: one reply per model call — text deltas, or a single
 *  tool call. The model reports a pi-side provider so the session's spec
 *  (claude-code) passes the gates while the in-process Agent loop runs. */
function scriptedEngine(replies: Reply[], gate?: Promise<void>) {
	const model = { id: "claude-sonnet-5-5", provider: "faux", api: "anthropic-messages" } as unknown as Model<Api>;
	let n = 0;
	return () => ({
		model,
		level: "off" as const,
		streamFn: (_m: Model<Api>, context: Context) => {
			contexts.push(context);
			const reply = replies[Math.min(n++, replies.length - 1)]!;
			const stream = new AssistantMessageEventStream();
			const content = reply.tool
				? [{ type: "toolCall" as const, id: `call_${n}`, name: reply.tool.name, arguments: reply.tool.args }]
				: [{ type: "text" as const, text: (reply.text ?? []).join("") }];
			const message = { role: "assistant", provider: "faux", api: model.api, model: model.id, content, stopReason: reply.tool ? "toolUse" : "stop", timestamp: 2, usage } as AssistantMessage;
			void (async () => {
				if (gate) await gate;
				stream.push({ type: "start", partial: message });
				for (const delta of reply.text ?? []) stream.push({ type: "text_delta", contentIndex: 0, delta, partial: message });
				stream.push({ type: "done", reason: reply.tool ? "toolUse" : "stop", message });
				stream.end();
			})();
			return stream;
		},
	});
}

const call = (id: string, callId: string, name: string, args: unknown, text?: string): LhMessage =>
	({ id, role: "assistant", content: [...(text ? [{ type: "text", text }] : []), { type: "toolCall", id: callId, name, arguments: args }], api: "x", provider: "x", model: "x", usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, stopReason: "toolUse", timestamp: 1 }) as never;
const ack = (id: string, callId: string, name: string): LhMessage =>
	({ id, role: "toolResult", toolCallId: callId, toolName: name, content: [{ type: "text", text: "ok" }], details: {}, isError: false, timestamp: 1 }) as never;
const QUIZ = { question: "Which way does the sign go?", options: [{ label: "Up" }, { label: "Down" }], correctAnswer: "Down", explanation: "SECRET_EXPLANATION" };
const MERMAID = "graph TD\n  slope[Slope] --> sign[Sign flip]";

function teachChat(): string {
	const chat = chatStore.createChat("aside route");
	chatStore.saveSettings(chat.id, { model: { provider: "claude-code", id: "claude-sonnet-5-5" } });
	chatStore.saveMessages(chat.id, [
		{ id: "u1", role: "user", content: "teach me signs", timestamp: 1 } as never,
		call("a1", "pd1", "probe_done", { summary: "s" }),
		ack("r1", "pd1", "probe_done"),
		call("a2", "q1", "quiz", QUIZ, "The sign flips because the slope turns."),
	]);
	return chat.id;
}
const ask = (chatId: string, body: unknown) =>
	handleAsideRequest(chatId, new Request("http://test/aside", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
const messagesOf = (chatId: string) => JSON.stringify(chatStore.getChat(chatId)!.messages);

describe("POST /api/chats/[id]/aside — the side turn", () => {
	it("streams the answer, persists it as pending, logs its usage, and leaves the record's messages byte-identical", async () => {
		asideRuntime.engineFor = scriptedEngine([{ text: ["Because ", "the slope ", "turns."] }]);
		const chatId = teachChat();
		const before = messagesOf(chatId);
		const res = await ask(chatId, { anchorId: "q1", question: "why does it flip?" });
		assert.equal(res.status, 200);
		assert.equal(await res.text(), "Because the slope turns.");
		const record = chatStore.getChat(chatId)!;
		assert.equal(record.pendingAsides?.length, 1);
		const [aside] = record.pendingAsides!;
		assert.deepEqual({ anchorId: aside!.anchorId, question: aside!.question, answer: aside!.answer, model: aside!.model }, { anchorId: "q1", question: "why does it flip?", answer: "Because the slope turns.", model: "faux:claude-sonnet-5-5" });
		assert.equal(aside!.planRevision, undefined);
		assert.equal(res.headers.get("X-Aside-Id"), aside!.id);
		const turn = record.turns!.find((t) => t.id === aside!.id)!;
		assert.equal(turn.steps[0]!.inputTokens, 120);
		assert.equal(messagesOf(chatId), before, "a side turn appends nothing to the record");
		assert.equal(isTurnRunning(chatId), false, "the lock is released");
	});

	it("the model gets the lesson's own prompt and full context, the check's placeholder, the side rules, and the side tools only", async () => {
		asideRuntime.engineFor = scriptedEngine([{ text: ["ok"] }]);
		contexts.length = 0;
		const chatId = teachChat();
		await (await ask(chatId, { anchorId: "q1", question: "first?" })).text();
		await (await ask(chatId, { anchorId: "q1", question: "second?" })).text();
		const context = contexts[1]!;
		// pi ships the prompt and tools as leading system messages.
		const system = context.messages.filter((m) => (m as { role: string }).role === "system");
		const turn = context.messages.filter((m) => (m as { role: string }).role !== "system");
		const wire = JSON.stringify(turn);
		assert.match(wire, /The sign flips because the slope turns/);
		assert.match(wire, /Which way does the sign go\?/);
		assert.ok(wire.includes(JSON.stringify(SIDE_PENDING_TEXT).slice(1, -1)), "the waiting check gets the placeholder result");
		assert.match(wire, /Never do the waiting work for them/, "the side rules ride the user message");
		assert.match(wire, /Learner: first\?/, "earlier asides on the anchor ride along");
		assert.ok(!JSON.stringify(system).includes("[SIDE THREAD]"), "the lesson's system prompt is untouched");
		const tools = [
			...(context.tools ?? []),
			...system.flatMap((m) => (m as { toolsAdded?: { name: string }[] }).toolsAdded ?? []),
		].map((t) => t.name).sort();
		assert.ok(tools.includes("plan_init") && tools.includes("read"), `side tools: ${tools}`);
		for (const banned of ["quiz", "ask_user_question", "demo", "visual"]) assert.ok(!tools.includes(banned), `${banned} is not a side tool`);
	});

	it("a plan_init in the side turn saves the tree at once and rides the aside; the answer delivers it to the model", async () => {
		asideRuntime.engineFor = scriptedEngine([{ tool: { name: "plan_init", args: { mermaid: MERMAID } } }, { text: ["Added a node on slopes."] }]);
		const chatId = teachChat();
		const before = messagesOf(chatId);
		assert.equal(await (await ask(chatId, { anchorId: "q1", question: "what is a slope?" })).text(), "Added a node on slopes.");
		const record = chatStore.getChat(chatId)!;
		assert.deepEqual(record.tree?.nodes.map((n) => n.id), ["slope", "sign"], "the tree is saved right away");
		const [aside] = record.pendingAsides!;
		assert.equal(aside!.planRevision?.mermaid, MERMAID);
		assert.deepEqual(aside!.planRevision?.tree.nodes.map((n) => n.id), ["slope", "sign"]);
		assert.equal(messagesOf(chatId), before);

		const appends = inputAppends(record, { type: "answer", toolCallId: "q1", answer: { kind: "quiz", questionText: QUIZ.question, dontKnow: false, answers: [], answeredAt: "t" } });
		const text = (appends[0] as { content: { text: string }[] }).content[0]!.text;
		assert.ok(text.includes(`"planRevision":${JSON.stringify(MERMAID)}`), text);
	});

	it("holds the chat's in-flight slot silently while it runs", async () => {
		let release!: () => void;
		const gate = new Promise<void>((r) => (release = r));
		asideRuntime.engineFor = scriptedEngine([{ text: ["done"] }], gate);
		const chatId = teachChat();
		const res = await ask(chatId, { anchorId: "q1", question: "slow?" });
		assert.equal(isTurnRunning(chatId), true);
		assert.equal(beginTurn(chatId), false, "a check answer cannot start a turn meanwhile");
		assert.equal((await ask(chatId, { anchorId: "q1", question: "again?" })).status, 409, "one side turn at a time");
		release();
		assert.equal(await res.text(), "done");
		assert.equal(isTurnRunning(chatId), false);
	});

	it("the next answer delivers what the route stored", async () => {
		asideRuntime.engineFor = scriptedEngine([{ text: ["Because."] }]);
		const chatId = teachChat();
		await (await ask(chatId, { anchorId: "q1", question: "why?" })).text();
		const record = chatStore.getChat(chatId)!;
		const appends = inputAppends(record, { type: "answer", toolCallId: "q1", answer: { kind: "quiz", questionText: QUIZ.question, dontKnow: false, answers: [], answeredAt: "t" } });
		assert.match((appends[0] as { content: { text: string }[] }).content[0]!.text, /"asides":\[\{"question":"why\?","answer":"Because\."\}\]/);
		chatStore.saveMessages(chatId, [...record.messages, ...appends]);
		assert.equal(chatStore.getChat(chatId)!.pendingAsides, undefined);
	});

	it("refuses: bad body 400, unknown chat 404, stale or probe anchor 409, running turn 409", async () => {
		asideRuntime.engineFor = scriptedEngine([{ text: ["x"] }]);
		const chatId = teachChat();
		assert.equal((await ask(chatId, { anchorId: "q1", question: "  " })).status, 400);
		assert.equal((await ask("chat_nope_00000000", { anchorId: "q1", question: "q" })).status, 404);
		assert.equal((await ask(chatId, { anchorId: "other", question: "q" })).status, 409);

		const probing = chatStore.createChat("probing");
		chatStore.saveSettings(probing.id, { model: { provider: "claude-code", id: "claude-sonnet-5-5" } });
		chatStore.saveMessages(probing.id, [{ id: "u1", role: "user", content: "hi", timestamp: 1 } as never, call("a1", "pq", "probe", QUIZ)]);
		assert.equal((await ask(probing.id, { anchorId: "pq", question: "q" })).status, 409, "never during the probe");

		assert.ok(beginTurn(chatId));
		try {
			assert.equal((await ask(chatId, { anchorId: "q1", question: "q" })).status, 409);
		} finally {
			endTurn(chatId);
		}
		assert.equal(chatStore.getChat(chatId)!.pendingAsides, undefined, "refusals persist nothing");
	});

	it("a failed call persists nothing and releases the lock", async () => {
		asideRuntime.engineFor = () => ({
			model: { id: "m", provider: "faux", api: "anthropic-messages" } as unknown as Model<Api>,
			level: "off" as const,
			streamFn: () => {
				const stream = new AssistantMessageEventStream();
				queueMicrotask(() => {
					stream.push({ type: "error", reason: "error", error: { role: "assistant", content: [], errorMessage: "boom", provider: "faux", api: "anthropic-messages", model: "m", usage, stopReason: "error", timestamp: 1 } } as never);
					stream.end();
				});
				return stream;
			},
		});
		const chatId = teachChat();
		const res = await ask(chatId, { anchorId: "q1", question: "why?" });
		await assert.rejects(res.text());
		assert.equal(chatStore.getChat(chatId)!.pendingAsides, undefined);
		assert.equal(isTurnRunning(chatId), false);
	});
});
