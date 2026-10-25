/**
 * The Claude Code engine through the REAL turn pipeline
 * (docs/claude-code-engine.md): a chat whose model is provider
 * "claude-code" runs the production prober — settings resolution, engine
 * build, the turn gate, ui-stream, persistence — with only Claude Code's
 * query() scripted. Pins the one thing unit tests cannot: the session
 * ledger's watermark survives the record's real persistence, so the
 * learner's answer RESUMES the session instead of re-seeding it.
 *
 * Isolated LH_DATA_DIR, set before any config-loading import.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, describe, it } from "node:test";
import type { Options, SDKMessage, SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

const TMP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lh-claude-code-"));
process.env.LH_DATA_DIR = TMP_DATA;
process.env.LH_CLAUDE_CODE = "1";

const { handleChatRequest } = await import("../src/server/chat-handler.ts");
const { runningTurn } = await import("../src/server/turn-runs.ts");
const { chatStore } = await import("../src/store/chats.ts");
const { claudeCodeRuntime } = await import("../src/agent/claude-code/agent.ts");
const { fileLedger } = await import("../src/agent/claude-code/sessions.ts");
const { buildAnswer, normalizeOptions, resolveCorrect } = await import("../src/core/question-core.ts");

after(() => {
	claudeCodeRuntime.query = undefined;
	fs.rmSync(TMP_DATA, { recursive: true, force: true });
});

// The prober's quizzing tool is "probe" (no nodeId, no type).
const QUIZ_INPUT = {
	question: "Which planet is closest to the sun?",
	options: [{ label: "Venus" }, { label: "Mercury" }, { label: "Mars" }],
	correctAnswer: "Mercury",
	explanation: "Mercury is the innermost planet.",
};

interface Seen { options: Options; input: SDKUserMessage }
const seen: Seen[] = [];

/** One scripted reply per query() call: [quiz call] then [plain text]. */
function scripted(): (params: { prompt: AsyncIterable<SDKUserMessage>; options: Options }) => AsyncIterable<SDKMessage> {
	let call = 0;
	return ({ prompt, options }) =>
		(async function* (): AsyncGenerator<SDKMessage> {
			const n = call++;
			const it = prompt[Symbol.asyncIterator]();
			const first = await it.next();
			seen.push({ options, input: first.value as SDKUserMessage });
			const sid = options.resume ?? options.sessionId!;
			yield { type: "system", subtype: "init", session_id: sid } as unknown as SDKMessage;
			const id = `msg_${n}`;
			const ev = (event: unknown) => ({ type: "stream_event", event, parent_tool_use_id: null, uuid: id, session_id: sid }) as unknown as SDKMessage;
			yield ev({ type: "message_start", message: { id, model: "claude-sonnet-5-5", usage: { input_tokens: 50 } } });
			if (n === 0) {
				yield ev({ type: "content_block_start", index: 0, content_block: { type: "tool_use", id: "toolu_q1", name: "mcp__lh__probe", input: {} } });
				yield ev({ type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: JSON.stringify(QUIZ_INPUT) } });
				yield ev({ type: "content_block_stop", index: 0 });
				yield ev({ type: "message_delta", delta: { stop_reason: "tool_use" }, usage: { output_tokens: 20 } });
				yield ev({ type: "message_stop" });
				for (const m of options.hooks?.PreToolUse ?? []) for (const h of m.hooks) await h({ hook_event_name: "PreToolUse", tool_name: "mcp__lh__probe", tool_input: QUIZ_INPUT, tool_use_id: "toolu_q1" } as never, "toolu_q1", { signal: new AbortController().signal });
				const server = (options.mcpServers!.lh as unknown as { instance: McpServer }).instance;
				const [c, s] = InMemoryTransport.createLinkedPair();
				const client = new Client({ name: "fake", version: "1" });
				await server.connect(s);
				await client.connect(c);
				const response = await client.callTool({ name: "probe", arguments: QUIZ_INPUT });
				await client.close();
				for (const m of options.hooks?.PostToolBatch ?? []) for (const h of m.hooks) await h({ hook_event_name: "PostToolBatch", tool_calls: [{ tool_name: "mcp__lh__probe", tool_input: QUIZ_INPUT, tool_use_id: "toolu_q1", tool_response: response }] } as never, undefined, { signal: new AbortController().signal });
			} else {
				yield ev({ type: "content_block_start", index: 0, content_block: { type: "text", text: "" } });
				yield ev({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Right — Mercury." } });
				yield ev({ type: "content_block_stop", index: 0 });
				yield ev({ type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 5 } });
				yield ev({ type: "message_stop" });
			}
			yield { type: "result", subtype: "success", is_error: false, result: "", session_id: sid } as unknown as SDKMessage;
			await it.next(); // the agent closes input after the result
		})();
}

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

describe("a Claude Code chat through the real turn pipeline", () => {
	it("persists the quiz, then resumes the same session with the learner's answer", async () => {
		claudeCodeRuntime.query = scripted();
		const chat = chatStore.createChat("Test: Claude Code");
		chatStore.saveSettings(chat.id, { model: { provider: "claude-code", id: "claude-sonnet-5-5" }, thinkingLevel: "medium" });

		await runTurn(post(chat.id, { type: "text", text: "teach me the solar system" }));
		const saved1 = chatStore.getChat(chat.id)!;
		assert.deepEqual(saved1.messages.map((m) => m.role), ["user", "assistant"], "the question placeholder never persists");
		assert.equal(seen[0]!.options.resume, undefined);
		assert.equal(seen[0]!.options.model, "claude-sonnet-5-5");
		assert.equal(seen[0]!.options.effort, "medium");
		assert.ok(String(seen[0]!.options.systemPrompt).length > 1000, "the prober's composed prompt is the system prompt");
		const entry = fileLedger.get(chat.id);
		assert.equal(entry?.covered, 2);

		const call = (saved1.messages[1]!.content as { type: string }[]).find((b) => b.type === "toolCall") as unknown as { id: string; name: string };
		assert.equal(call.name, "probe", "the record keeps the prober's bare tool name");
		const options = normalizeOptions(QUIZ_INPUT.options);
		const answer = buildAnswer(
			{ id: call.id, kind: "quiz", question: QUIZ_INPUT.question, mode: "single-select", options, correctIndices: resolveCorrect(QUIZ_INPUT.correctAnswer, options).indices, explanation: QUIZ_INPUT.explanation, createdAt: new Date().toISOString() },
			{ values: ["Mercury"] },
		);
		await runTurn(post(chat.id, { type: "answer", toolCallId: call.id, answer }));

		const saved2 = chatStore.getChat(chat.id)!;
		assert.deepEqual(saved2.messages.map((m) => m.role), ["user", "assistant", "toolResult", "assistant"]);
		assert.equal(seen[1]!.options.resume, entry!.sessionId, "the answer resumes the same Claude Code session");
		const sent = (seen[1]!.input.message.content as { type: string; text?: string }[]).map((b) => b.text ?? "").join("\n");
		assert.match(sent, /\[Result for your probe call\]/);
		assert.equal(fileLedger.get(chat.id)?.covered, 4);
	});
});
