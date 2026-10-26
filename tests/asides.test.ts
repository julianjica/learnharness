/**
 * Asides — side questions while a check or problem waits (owner design
 * 2026-10-26, src/core/contracts/asides.ts). Pinned here: where the side
 * thread may hang (never a probe question), the redaction-by-construction
 * of its context (no answer key, no model solution), the delivery fold
 * (a check's answer/dismissal carries its asides; practice gets a marker),
 * the store's pending list, and COMPATIBILITY WITH PREVIOUS SAVES: the
 * golden pre-aside records produce byte-identical view, markdown, wire,
 * model-facing answers and cost as the pre-feature build did
 * (tests/fixtures/asides-compat.json was recorded from that build).
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { after, describe, it } from "node:test";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GOLDEN = path.join(HERE, "fixtures", "golden-data");

// ── the seam, BEFORE any config-loading import ──────────────────────────────
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "lh-asides-"));
fs.cpSync(GOLDEN, TMP, { recursive: true });
process.env.LH_DATA_DIR = TMP;

const { chatStore } = await import("../src/store/chats.ts");
const { asideAnchorOf, asideContext, asidesFor, undeliveredAsides } = await import("../src/core/asides.ts");
const { dismissAppends, inputAppends } = await import("../src/core/input-events.ts");
const { compactAnswerForModel, dismissedAnswer } = await import("../src/core/question-core.ts");
const { sessionMarkdown } = await import("../src/core/session-markdown.ts");
const { projectView } = await import("../src/core/view.ts");
const { asAgentMessages, toLlmMessages } = await import("../src/core/native-messages.ts");
const { sessionCost } = await import("../src/server/pricing.ts");
type LhMessage = import("../src/core/native-messages.ts").LhMessage;
type PendingAside = import("../src/core/contracts.ts").PendingAside;
type QuestionAnswerData = import("../src/core/question-core.ts").QuestionAnswerData;

after(() => fs.rmSync(TMP, { recursive: true, force: true }));

const user = (id: string, text: string): LhMessage => ({ id, role: "user", content: text, timestamp: 1 }) as never;
const said = (id: string, text: string): LhMessage =>
	({ id, role: "assistant", content: [{ type: "text", text }], api: "x", provider: "x", model: "x", usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, stopReason: "stop", timestamp: 1 }) as never;
const call = (id: string, callId: string, name: string, args: unknown, text?: string): LhMessage =>
	({ id, role: "assistant", content: [...(text ? [{ type: "text", text }] : []), { type: "toolCall", id: callId, name, arguments: args }], api: "x", provider: "x", model: "x", usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, stopReason: "toolUse", timestamp: 1 }) as never;
const ack = (id: string, callId: string, name: string): LhMessage =>
	({ id, role: "toolResult", toolCallId: callId, toolName: name, content: [{ type: "text", text: "ok" }], details: {}, isError: false, timestamp: 1 }) as never;

const QUIZ = { question: "Which way does the sign go?", options: [{ label: "Up" }, { label: "Down" }], correctAnswer: "Down", explanation: "SECRET_EXPLANATION" };
const PROBE = { question: "What do you know?", options: [{ label: "A" }, { label: "B" }], correctAnswer: "A" };
const PROBLEM = { statement: "Show that the sum is even.", modelSolution: "SECRET_SOLUTION", target: [] };

/** Teach phase: probe concluded, teaching prose, a check waiting. */
const teachRecord = (): { messages: LhMessage[]; pendingAsides?: PendingAside[] } => ({
	messages: [
		user("u1", "teach me signs"),
		call("a1", "pd1", "probe_done", { summary: "s" }),
		ack("r1", "pd1", "probe_done"),
		call("a2", "q1", "quiz", QUIZ, "The sign flips because the slope turns."),
	],
});
/** Practice: one problem posed and active. */
const practiceRecord = (): { messages: LhMessage[]; kind: string; pendingAsides?: PendingAside[] } => ({
	kind: "practice",
	messages: [user("u1", "practice parity"), call("a1", "p1", "problem", PROBLEM), ack("r1", "p1", "problem")],
});
const aside = (id: string, anchorId: string): PendingAside => ({ id, anchorId, question: `why ${id}?`, answer: `because ${id}.`, at: "2026-10-26T12:00:00Z", model: "x:y" });
const quizAnswer = (): QuestionAnswerData => ({ kind: "quiz", questionText: QUIZ.question, dontKnow: false, answers: [{ label: "Down", value: "Down", index: 2 }], answeredAt: "t" }) as QuestionAnswerData;

describe("where the side thread hangs", () => {
	it("a teach-phase check anchors it — question and option labels only", () => {
		const anchor = asideAnchorOf(teachRecord());
		assert.deepEqual(anchor, { kind: "check", anchorId: "q1", question: QUIZ.question, options: ["Up", "Down"] });
	});

	it("never a probe question, and nothing when no question waits", () => {
		const probing = { messages: [user("u1", "hi"), call("a1", "pq", "probe", PROBE)] };
		assert.equal(asideAnchorOf(probing), null, "the probe measures unaided knowledge");
		const answered = teachRecord();
		answered.messages.push({ ...ack("r2", "q1", "quiz"), details: quizAnswer() } as never);
		assert.equal(asideAnchorOf(answered), null);
	});

	it("a practice session's active problem anchors it — the statement only", () => {
		assert.deepEqual(asideAnchorOf(practiceRecord()), { kind: "problem", anchorId: "p1", statement: PROBLEM.statement });
	});
});

describe("the side thread's context is redacted by construction", () => {
	it("a waiting check shows question + options, never the answer key", () => {
		const record = teachRecord();
		const context = asideContext(record.messages, asideAnchorOf(record)!);
		assert.match(context, /The sign flips because the slope turns\./);
		assert.match(context, /Which way does the sign go\?/);
		assert.match(context, /1\. Up\n2\. Down/);
		assert.ok(!context.includes("SECRET_EXPLANATION"));
		assert.ok(!/correct/i.test(context), "no correctAnswer leaks");
	});

	it("an active problem shows its statement, never the model solution", () => {
		const record = practiceRecord();
		record.messages.push({ id: "t1", role: "custom", customType: "practice-thinking", content: "Your thinking:\nmaybe pairs", display: true, details: { problemCallId: "p1", text: "maybe pairs" }, timestamp: 1 } as never);
		const context = asideContext(record.messages, asideAnchorOf(record)!);
		assert.match(context, /Show that the sum is even\./);
		assert.match(context, /maybe pairs/, "the learner's submissions are part of the lesson");
		assert.ok(!context.includes("SECRET_SOLUTION"));
	});
});

describe("delivery", () => {
	it("a check's answer carries the asides hung on it (and only those)", () => {
		const record = { ...teachRecord(), pendingAsides: [aside("as1", "q1"), aside("as2", "other")] };
		const [result] = inputAppends(record, { type: "answer", toolCallId: "q1", answer: quizAnswer() });
		const details = (result as { details: QuestionAnswerData }).details;
		assert.deepEqual(details.asides?.map((a) => a.id), ["as1"]);
		const wire = JSON.parse((result as { content: { text: string }[] }).content[0]!.text);
		assert.deepEqual(wire.asides, [{ question: "why as1?", answer: "because as1." }], "the model sees Q/A only");
	});

	it("an answer with nothing waiting is exactly the pre-aside answer", () => {
		const [result] = inputAppends(teachRecord(), { type: "answer", toolCallId: "q1", answer: quizAnswer() });
		assert.equal("asides" in ((result as { details: object }).details), false);
		assert.equal((result as { content: { text: string }[] }).content[0]!.text, JSON.stringify(compactAnswerForModel(quizAnswer())));
	});

	it("a dismissal carries them too", () => {
		const record = { ...teachRecord(), pendingAsides: [aside("as1", "q1")] };
		const [result] = dismissAppends(record, { type: "dismiss", toolCallId: "q1", answer: dismissedAnswer("quiz", QUIZ.question) });
		assert.equal(JSON.parse((result as { content: { text: string }[] }).content[0]!.text).asides.length, 1);
		assert.deepEqual(compactAnswerForModel(dismissedAnswer("quiz", "q")), { kind: "quiz", dismissed: true });
	});

	it("practice: one aside marker rides ahead of the next input", () => {
		const record = { ...practiceRecord(), pendingAsides: [aside("as1", "p1")] };
		const appends = inputAppends(record, { type: "thinking", problemCallId: "p1", text: "pairs cancel" });
		assert.deepEqual(appends.map((m) => (m as { customType?: string }).customType), ["aside", "practice-thinking"]);
		assert.match((appends[0] as { content: string }).content, /^\[SIDE THREAD\][\s\S]*Q: why as1\?\nA: because as1\./);
		const view = projectView([...record.messages, ...appends]);
		assert.ok(view.some((m) => m.parts.some((p) => p.type === "data-asides")));
		assert.deepEqual(inputAppends(practiceRecord(), { type: "thinking", problemCallId: "p1", text: "x" }).length, 1, "nothing waits → no marker");
	});

	it("answered checks render their asides for extraction", () => {
		const record = teachRecord();
		const [result] = inputAppends({ ...record, pendingAsides: [aside("as1", "q1")] }, { type: "answer", toolCallId: "q1", answer: quizAnswer() });
		const md = sessionMarkdown([...record.messages, result!]);
		assert.match(md, /\*\*Side question:\*\* why as1\?\n\n\*\*Side answer:\*\* because as1\./);
	});

	it("pending entries leave once their ids are in the messages", () => {
		const record = { ...teachRecord(), pendingAsides: [aside("as1", "q1"), aside("as2", "q1")] };
		const [result] = inputAppends(record, { type: "answer", toolCallId: "q1", answer: quizAnswer() });
		assert.deepEqual(undeliveredAsides(record.pendingAsides, [...record.messages, result!]), []);
		assert.deepEqual(asidesFor(record.pendingAsides, "q1").map((a) => a.id), ["as1", "as2"]);
	});
});

describe("the store's pending list", () => {
	it("appends, then prunes on delivery, dropping the field when empty", () => {
		const chat = chatStore.createChat("asides store");
		const base = teachRecord().messages;
		chatStore.saveMessages(chat.id, base);
		chatStore.appendPendingAside(chat.id, aside("as1", "q1"));
		assert.equal(chatStore.getChat(chat.id)!.pendingAsides?.length, 1);
		const record = chatStore.getChat(chat.id)!;
		const appends = inputAppends(record, { type: "answer", toolCallId: "q1", answer: quizAnswer() });
		chatStore.saveMessages(chat.id, [...record.messages, ...appends]);
		const after = JSON.parse(fs.readFileSync(path.join(TMP, "chats", `${chat.id}.json`), "utf-8"));
		assert.equal("pendingAsides" in after, false);
		assert.equal(after.version, 1, "no schema bump — older builds keep reading new records");
	});
});

describe("compatibility with previous saves", () => {
	const sha = (v: unknown) => createHash("sha256").update(typeof v === "string" ? v : JSON.stringify(v)).digest("hex");
	const expected = JSON.parse(fs.readFileSync(path.join(HERE, "fixtures", "asides-compat.json"), "utf-8")) as Record<string, Record<string, string>>;

	for (const [id, hashes] of Object.entries(expected)) {
		it(`${id}: view, markdown, wire, answers and cost are byte-identical to the pre-aside build`, () => {
			const record = chatStore.getChat(id)!;
			const answers = record.messages
				.filter((m) => m.role === "toolResult" && (m as { details?: unknown }).details && typeof (m as { details?: unknown }).details === "object" && "questionText" in ((m as { details: object }).details))
				.map((m) => compactAnswerForModel((m as unknown as { details: never }).details));
			assert.deepEqual(
				{
					view: sha(projectView(record.messages)),
					markdown: sha(sessionMarkdown(record.messages)),
					wire: sha(toLlmMessages(asAgentMessages(record.messages))),
					answers: sha(answers),
					cost: sha(sessionCost(record)),
				},
				hashes,
			);
		});
	}

	it("old records read as having nothing pending, and a rewrite adds no aside field", () => {
		for (const id of Object.keys(expected)) {
			const record = chatStore.getChat(id)!;
			assert.equal(record.pendingAsides, undefined);
			chatStore.saveMessages(id, record.messages);
			assert.equal("pendingAsides" in JSON.parse(fs.readFileSync(path.join(TMP, "chats", `${id}.json`), "utf-8")), false);
		}
	});
});
