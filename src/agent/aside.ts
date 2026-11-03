import fs from "node:fs";
import path from "node:path";
import type { AgentEvent, AgentMessage, AgentTool } from "@earendil-works/pi-agent-core";
import type { AssistantMessage, ToolResultMessage } from "@earendil-works/pi-ai";
import { PATHS } from "../../config.ts";
import type { AsideAnchor } from "../core/asides.ts";
import type { Aside } from "../core/contracts/asides.ts";
import type { LhMessage } from "../core/native-messages.ts";
import type { TeachingAgent } from "./teacher-agent.ts";

/**
 * The side turn (asides, owner 2026-11-03 — "the main teacher answers
 * them"): the session's own agent — teacher or practitioner, same model,
 * system prompt and settings as a lesson turn — answers a side question
 * on an OUT-OF-BAND copy of the record. Nothing it produces is appended to
 * the record (the adjacency law: the waiting check's call must stay the
 * record's last word); the server stores the answer as a pending aside,
 * delivered with the learner's next input exactly as before.
 *
 * The copy differs from the record in two ways only:
 *   - a waiting teach check gets a placeholder result (a provider rejects
 *     an unanswered call, and the placeholder says why there is none);
 *   - the side question arrives as the user message, its preamble carrying
 *     the side-thread rules (prompts/aside/00-base.md). The rules ride the
 *     MESSAGE, not the system prompt, so the lesson's prompt prefix — and
 *     an API engine's cache of it — is reused untouched.
 */

const PREAMBLE_FILE = path.join(PATHS.root, "src", "agent", "prompts", "aside", "00-base.md");

/** The placeholder result for the waiting check — model-facing only. */
export const SIDE_PENDING_TEXT =
	"[SIDE THREAD] The learner has not answered this yet. Before answering, they asked a side question — it follows. The check stays open and theirs to answer.";

/** The side turn's input transcript: the record, plus the waiting check's
 *  placeholder result. Practice problems are already acknowledged (their
 *  call has a result), so practice needs none. */
export function sideTurnMessages(messages: readonly LhMessage[], anchor: AsideAnchor): AgentMessage[] {
	const out = [...messages] as AgentMessage[];
	if (anchor.kind === "check") {
		const call = findCall(messages, anchor.anchorId);
		if (call) {
			const result: ToolResultMessage & { id: string } = {
				id: `side_${anchor.anchorId}`,
				role: "toolResult",
				toolCallId: anchor.anchorId,
				toolName: call.name,
				content: [{ type: "text", text: SIDE_PENDING_TEXT }],
				isError: false,
				timestamp: Date.now(),
			};
			out.push(result as AgentMessage);
		}
	}
	return out;
}

/** The side question as the user message: rules, the earlier asides on
 *  this anchor (they are not in the record yet), then the question. */
export function sideTurnPrompt(previous: readonly Aside[], question: string): string {
	const rules = fs.readFileSync(PREAMBLE_FILE, "utf-8").trim();
	const earlier = previous.length > 0
		? `\n\n<side_thread_so_far>\n${previous.map((a) => `Learner: ${a.question.trim()}\nYou: ${a.answer.trim()}`).join("\n\n")}\n</side_thread_so_far>`
		: "";
	return `${rules}${earlier}\n\nThe learner's side question:\n${question.trim()}`;
}

/** Keep only the tools a side turn may use (an explicit registry is never
 *  toggle-filtered, so the caller filters the lesson's own registry). */
export function pickTools(registry: Record<string, AgentTool<any>>, allowed: readonly string[]): Record<string, AgentTool<any>> {
	return Object.fromEntries(Object.entries(registry).filter(([name]) => allowed.includes(name)));
}

/** Teacher side tools (owner, 2026-11-03): re-plan, look up, dispatch a
 *  pdf/research job. Never a question tool — a second waiting question
 *  would break the dock and the adjacency law. */
export const TEACHER_SIDE_TOOLS = ["plan_init", "read", "ls", "find", "grep", "research", "pdf"] as const;
/** Practice side tools: the same lookups and jobs plus the map readers;
 *  never problem/conclude. */
export const PRACTICE_SIDE_TOOLS = ["read", "ls", "find", "grep", "research", "pdf", "list_sessions", "list_propositions"] as const;

export interface SideTurnResult {
	/** The answer the learner sees: every assistant text of the turn. */
	text: string;
	/** What the side turn produced (never persisted) — the server reads
	 *  its plan_init / job results. */
	messages: AgentMessage[];
}

export async function runSideTurn(opts: {
	agent: TeachingAgent;
	prompt: string;
	onDelta?: (delta: string) => void;
	signal?: AbortSignal;
}): Promise<SideTurnResult> {
	const { agent } = opts;
	const before = agent.state.messages.filter((m) => (m as { role?: string }).role !== "system").length;
	let committed = ""; // text of finished assistant messages
	let sent = 0; // characters already streamed
	let aborted = false;
	let failure: string | undefined;
	const textOf = (m: AssistantMessage) =>
		m.content.filter((b): b is { type: "text"; text: string } => b.type === "text").map((b) => b.text).join("");
	const join = (a: string, b: string) => (a && b ? `${a}\n\n${b}` : a || b);
	const flush = (full: string) => {
		if (full.length > sent && full.startsWith(full.slice(0, sent))) {
			opts.onDelta?.(full.slice(sent));
			sent = full.length;
		}
	};
	const unsubscribe = agent.subscribe((event: AgentEvent) => {
		if (event.type === "message_update" && (event.message as { role?: string }).role === "assistant") {
			flush(join(committed, textOf(event.message as AssistantMessage)));
		} else if (event.type === "message_end" && (event.message as { role?: string }).role === "assistant") {
			const m = event.message as AssistantMessage;
			if (m.stopReason === "aborted") aborted = true;
			if (m.stopReason === "error") failure = m.errorMessage ?? "the side question could not be answered";
			committed = join(committed, textOf(m).trim());
			flush(committed);
		}
	});
	const onAbort = () => agent.abort();
	opts.signal?.addEventListener("abort", onAbort, { once: true });
	try {
		await agent.prompt({ role: "user", content: opts.prompt, timestamp: Date.now() });
	} finally {
		opts.signal?.removeEventListener("abort", onAbort);
		unsubscribe();
	}
	if (aborted || opts.signal?.aborted) {
		const err = new Error("aborted");
		err.name = "AbortError";
		throw err;
	}
	if (failure !== undefined) throw new Error(failure);
	const text = committed.trim();
	if (!text) throw new Error("the side turn ended without an answer");
	return {
		text,
		messages: agent.state.messages.filter((m) => (m as { role?: string }).role !== "system").slice(before),
	};
}

function findCall(messages: readonly LhMessage[], callId: string): { name: string } | null {
	for (let i = messages.length - 1; i >= 0; i--) {
		const m = messages[i] as { role?: string; content?: unknown };
		if (m.role !== "assistant" || !Array.isArray(m.content)) continue;
		for (const block of m.content as { type: string; id?: string; name?: string }[]) {
			if (block.type === "toolCall" && block.id === callId && block.name) return { name: block.name };
		}
	}
	return null;
}
