/**
 * The Codex engine through the REAL turn pipeline (docs/codex-engine.md):
 * a chat whose model is provider "codex" runs the production prober —
 * settings resolution, engine build, the turn gate, ui-stream,
 * persistence — with only the app-server scripted. Pins what unit tests
 * cannot: the thread ledger's watermark survives the record's real
 * persistence, so the learner's answer RESUMES the thread instead of
 * re-seeding it.
 *
 * Isolated LH_DATA_DIR, set before any config-loading import.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, describe, it } from "node:test";

const TMP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lh-codex-"));
process.env.LH_DATA_DIR = TMP_DATA;
process.env.LH_CODEX = "1";

const { handleChatRequest } = await import("../src/server/chat-handler.ts");
const { runningTurn } = await import("../src/server/turn-runs.ts");
const { chatStore } = await import("../src/store/chats.ts");
const { codexRuntime } = await import("../src/agent/codex/agent.ts");
const { fileLedger } = await import("../src/agent/codex/sessions.ts");
const { buildAnswer, normalizeOptions, resolveCorrect } = await import("../src/core/question-core.ts");
const { fakeCodex, newCodexLog } = await import("./fixtures/fake-codex.ts");
const { createTeacherTools } = await import("../src/agent/tools.ts");
const { jobStore } = await import("../src/store/jobs.ts");
const { toolsFingerprintOf } = await import("../src/agent/codex/sessions.ts");

after(() => {
	codexRuntime.connect = undefined;
	fs.rmSync(TMP_DATA, { recursive: true, force: true });
});

// The prober's quizzing tool is "probe" (no nodeId, no type).
const QUIZ_INPUT = {
	question: "Which planet is closest to the sun?",
	options: [{ label: "Venus" }, { label: "Mercury" }, { label: "Mars" }],
	correctAnswer: "Mercury",
	explanation: "Mercury is the innermost planet.",
};

function post(chatId: string, input: unknown): Request {
	return new Request("http://test/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chatId, input }) });
}

async function runTurn(req: Request): Promise<void> {
	const cloned = req.clone();
	const ack = await handleChatRequest(req);
	assert.equal(ack.status, 200, await ack.clone().text());
	const { chatId } = (await cloned.json()) as { chatId: string };
	const handle = runningTurn(chatId);
	if (handle) await new Response(handle.subscribe()).text();
	// settle: the record write follows agent_end
	for (let i = 0; i < 100 && runningTurn(chatId); i++) await new Promise((r) => setTimeout(r, 10));
}

const inputText = (params: Record<string, unknown>) => (params.input as { type: string; text?: string }[]).map((i) => i.text ?? "").join("\n");

describe("a Codex chat through the real turn pipeline", () => {
	it("persists the quiz, then resumes the same thread with the learner's answer", async () => {
		const log = newCodexLog();
		codexRuntime.connect = fakeCodex([{ tools: [{ name: "probe", input: QUIZ_INPUT }] }, { text: "Right — Mercury." }], log);
		const chat = chatStore.createChat("Test: Codex");
		chatStore.saveSettings(chat.id, { model: { provider: "codex", id: "gpt-5.6-sol" }, thinkingLevel: "medium" });

		await runTurn(post(chat.id, { type: "text", text: "teach me the solar system" }));
		const saved1 = chatStore.getChat(chat.id)!;
		assert.deepEqual(saved1.messages.map((m) => m.role), ["user", "assistant"], "the question placeholder never persists");
		assert.equal(log.threadStarts.length, 1);
		assert.equal(log.threadStarts[0]!.model, "gpt-5.6-sol");
		assert.equal(log.turnStarts[0]!.effort, "medium");
		assert.ok(String(log.threadStarts[0]!.baseInstructions).length > 1000, "the prober's composed prompt is the base instructions");
		const entry = fileLedger.get(chat.id);
		assert.equal(entry?.covered, 2);

		const call = (saved1.messages[1]!.content as { type: string }[]).find((b) => b.type === "toolCall") as unknown as { id: string; name: string };
		assert.equal(call.name, "probe", "the record keeps the prober's tool name");
		const options = normalizeOptions(QUIZ_INPUT.options);
		const answer = buildAnswer(
			{ id: call.id, kind: "quiz", question: QUIZ_INPUT.question, mode: "single-select", options, correctIndices: resolveCorrect(QUIZ_INPUT.correctAnswer, options).indices, explanation: QUIZ_INPUT.explanation, createdAt: new Date().toISOString() },
			{ values: ["Mercury"] },
		);
		await runTurn(post(chat.id, { type: "answer", toolCallId: call.id, answer }));

		const saved2 = chatStore.getChat(chat.id)!;
		assert.deepEqual(saved2.messages.map((m) => m.role), ["user", "assistant", "toolResult", "assistant"]);
		assert.equal(log.threadResumes.length, 1);
		assert.equal(log.threadResumes[0]!.threadId, entry!.threadId, "the answer resumes the same Codex thread");
		assert.match(inputText(log.turnStarts[1]!), /\[Result for your probe call\]/);
		assert.equal(fileLedger.get(chat.id)?.covered, 4);
	});

	it("the teacher's tool set fingerprints the same turn over turn (no silent reseed)", async () => {
		const chat = chatStore.createChat("Test: Codex teacher tools");
		const build = () => Object.values(createTeacherTools({ chatId: chat.id, chatStore, jobStore, spawn: () => {} }));
		const before = toolsFingerprintOf(build());
		chatStore.saveMessages(chat.id, [{ role: "user", content: "teach me", timestamp: 1 } as never]);
		assert.equal(toolsFingerprintOf(build()), before, "tool descriptions and schemas carry no per-turn state");
		assert.notEqual(toolsFingerprintOf(Object.values(createTeacherTools({ chatId: chat.id, chatStore, jobStore, spawn: () => {} }, { explain: true }))), before, "a settings change (quiz → explain) does reseed");
	});
});
