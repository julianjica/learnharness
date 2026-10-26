/**
 * The side-question route (asides, owner 2026-10-26 — src/server/aside.ts):
 * the gates (no anchor / probe / busy refuse), the streamed answer, what
 * persists (the pending aside + its usage), and the wire the model
 * receives — the waiting check WITHOUT its answer key. The engine is a
 * scripted stream behind the asideRuntime seam; no network.
 *
 * Isolated LH_DATA_DIR, set before any config-loading import.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, afterEach, describe, it } from "node:test";
import { AssistantMessageEventStream } from "@earendil-works/pi-ai/utils/event-stream";
import type { Api, Context, Model } from "@earendil-works/pi-ai";

const TMP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lh-aside-route-"));
process.env.LH_DATA_DIR = TMP_DATA;
process.env.LH_CLAUDE_CODE = "1";

const { handleAsideRequest, asideRuntime } = await import("../src/server/aside.ts");
const { chatStore } = await import("../src/store/chats.ts");
const { beginTurn, endTurn } = await import("../src/server/turn-liveness.ts");
const { inputAppends } = await import("../src/core/input-events.ts");
type LhMessage = import("../src/core/native-messages.ts").LhMessage;

after(() => fs.rmSync(TMP_DATA, { recursive: true, force: true }));
afterEach(() => {
	asideRuntime.engineFor = undefined;
});

const usage = { input: 120, output: 30, cacheRead: 0, cacheWrite: 0, totalTokens: 150, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } };
const contexts: Context[] = [];
/** A scripted engine: streams `chunks` as text deltas, then done. */
function scriptedEngine(chunks: string[]) {
	const model = { id: "claude-sonnet-5-5", provider: "claude-code", api: "anthropic-messages" } as unknown as Model<Api>;
	return () => ({
		model,
		level: "off" as const,
		streamFn: (_m: Model<Api>, context: Context) => {
			contexts.push(context);
			const stream = new AssistantMessageEventStream();
			const message = { role: "assistant" as const, provider: "claude-code", api: model.api, model: model.id, content: [{ type: "text" as const, text: chunks.join("") }], stopReason: "stop" as const, timestamp: 2, usage };
			queueMicrotask(() => {
				stream.push({ type: "start", partial: message });
				for (const delta of chunks) stream.push({ type: "text_delta", contentIndex: 0, delta, partial: message });
				stream.push({ type: "done", reason: "stop", message });
				stream.end();
			});
			return stream;
		},
	});
}

const call = (id: string, callId: string, name: string, args: unknown, text?: string): LhMessage =>
	({ id, role: "assistant", content: [...(text ? [{ type: "text", text }] : []), { type: "toolCall", id: callId, name, arguments: args }], api: "x", provider: "x", model: "x", usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, stopReason: "toolUse", timestamp: 1 }) as never;
const ack = (id: string, callId: string, name: string): LhMessage =>
	({ id, role: "toolResult", toolCallId: callId, toolName: name, content: [{ type: "text", text: "ok" }], details: {}, isError: false, timestamp: 1 }) as never;
const QUIZ = { question: "Which way does the sign go?", options: [{ label: "Up" }, { label: "Down" }], correctAnswer: "Down", explanation: "SECRET_EXPLANATION" };

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

describe("POST /api/chats/[id]/aside", () => {
	it("streams the answer, persists it as pending, and logs its usage", async () => {
		asideRuntime.engineFor = scriptedEngine(["Because ", "the slope ", "turns."]);
		const chatId = teachChat();
		const res = await ask(chatId, { anchorId: "q1", question: "why does it flip?" });
		assert.equal(res.status, 200);
		assert.equal(await res.text(), "Because the slope turns.");
		const record = chatStore.getChat(chatId)!;
		assert.equal(record.pendingAsides?.length, 1);
		const [aside] = record.pendingAsides!;
		assert.deepEqual({ anchorId: aside!.anchorId, question: aside!.question, answer: aside!.answer, model: aside!.model }, { anchorId: "q1", question: "why does it flip?", answer: "Because the slope turns.", model: "claude-code:claude-sonnet-5-5" });
		assert.equal(res.headers.get("X-Aside-Id"), aside!.id);
		const turn = record.turns!.find((t) => t.id === aside!.id)!;
		assert.equal(turn.steps[0]!.inputTokens, 120);
		assert.equal(record.messages.length, 4, "not a turn: the lesson record is untouched");
	});

	it("the model sees the lesson and the waiting check, never its answer key", async () => {
		asideRuntime.engineFor = scriptedEngine(["ok"]);
		contexts.length = 0;
		const chatId = teachChat();
		await (await ask(chatId, { anchorId: "q1", question: "first?" })).text();
		await (await ask(chatId, { anchorId: "q1", question: "second?" })).text();
		const wire = JSON.stringify(contexts[1]);
		assert.match(wire, /The sign flips because the slope turns/);
		assert.match(wire, /Which way does the sign go\?/);
		assert.match(wire, /Learner: first\?/, "earlier asides on the anchor ride along");
		assert.ok(!wire.includes("SECRET_EXPLANATION"));
		assert.ok(!wire.includes("correctAnswer"));
		assert.match(wire, /Never do the waiting work for them/, "the side-thread prompt is the system prompt");
	});

	it("the next answer delivers what the route stored", async () => {
		asideRuntime.engineFor = scriptedEngine(["Because."]);
		const chatId = teachChat();
		await (await ask(chatId, { anchorId: "q1", question: "why?" })).text();
		const record = chatStore.getChat(chatId)!;
		const appends = inputAppends(record, { type: "answer", toolCallId: "q1", answer: { kind: "quiz", questionText: QUIZ.question, dontKnow: false, answers: [], answeredAt: "t" } });
		assert.match((appends[0] as { content: { text: string }[] }).content[0]!.text, /"asides":\[\{"question":"why\?","answer":"Because\."\}\]/);
		chatStore.saveMessages(chatId, [...record.messages, ...appends]);
		assert.equal(chatStore.getChat(chatId)!.pendingAsides, undefined);
	});

	it("refuses: bad body 400, unknown chat 404, stale or probe anchor 409, running turn 409", async () => {
		asideRuntime.engineFor = scriptedEngine(["x"]);
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

	it("a failed call persists nothing", async () => {
		asideRuntime.engineFor = () => ({
			model: { id: "m", provider: "claude-code", api: "anthropic-messages" } as unknown as Model<Api>,
			level: "off" as const,
			streamFn: () => {
				const stream = new AssistantMessageEventStream();
				queueMicrotask(() => {
					stream.push({ type: "error", reason: "error", error: { role: "assistant", content: [], errorMessage: "boom", provider: "claude-code", api: "anthropic-messages", model: "m", usage, stopReason: "error", timestamp: 1 } } as never);
					stream.end();
				});
				return stream;
			},
		});
		const chatId = teachChat();
		const res = await ask(chatId, { anchorId: "q1", question: "why?" });
		await assert.rejects(res.text());
		assert.equal(chatStore.getChat(chatId)!.pendingAsides, undefined);
	});
});
