/**
 * Asides — the pure core (contracts/asides.ts has the shapes and the
 * design summary). Three seams:
 *
 *   - asideAnchorOf: what the side thread may hang on — a pending question
 *     after the probe concluded (never a probe question: the probe
 *     measures unaided knowledge), or a practice session's active problem.
 *   - asideContext: the side thread's view of the lesson, REDACTED BY
 *     CONSTRUCTION (owner ruling 2026-10-26): the transcript renders through
 *     the session-markdown engine, which never shows an unanswered call or
 *     an unconcluded problem's solution, and the anchor block whitelists
 *     what the learner sees (question + option labels, problem statement)
 *     — the answer key and the model solution are never read.
 *   - deliveredAsideIds / undeliveredAsides: the delivery fold. Delivered
 *     asides live in the record's messages (an answer's `asides`, an aside
 *     marker's details); the store prunes pending entries by those ids.
 */

import type { Aside, PendingAside } from "./contracts/asides.ts";
import type { LhMarkerMessage, LhMessage } from "./native-messages.ts";
import { activeProblemOf, danglingQuestionOf, hasProbeDone } from "./native-messages.ts";
import { activeCompactionOf, keptIndexFor } from "./compaction.ts";
import { asideLines, messageMarkdown, sessionMarkdownContext } from "./session-markdown.ts";
import { normalizeOptions } from "./question-core.ts";

/** What a side question attaches to. Only learner-visible fields. */
export type AsideAnchor =
	| { kind: "check"; anchorId: string; question: string; options: string[] }
	| { kind: "problem"; anchorId: string; statement: string };

/** The tools whose pending call opens the side thread: the teach-phase
 *  question tools (probe/recall are the probe's own, never). */
const CHECK_TOOLS = new Set(["quiz", "ask_user_question", "explain"]);

export function asideAnchorOf(record: { messages: readonly LhMessage[]; kind?: string }): AsideAnchor | null {
	if (record.kind === "practice") {
		const active = activeProblemOf(record.messages);
		if (!active) return null;
		const statement = (active.input as { statement?: unknown } | null)?.statement;
		return { kind: "problem", anchorId: active.toolCallId, statement: typeof statement === "string" ? statement : "" };
	}
	if (!hasProbeDone(record.messages)) return null;
	const pending = danglingQuestionOf(record.messages);
	if (!pending || !CHECK_TOOLS.has(pending.tool)) return null;
	const input = (pending.input ?? {}) as { question?: unknown; options?: unknown };
	let options: string[] = [];
	try {
		options = normalizeOptions(input.options as Parameters<typeof normalizeOptions>[0]).map((o) => o.label);
	} catch {
		options = []; // malformed options — the question alone still anchors
	}
	return {
		kind: "check",
		anchorId: pending.toolCallId,
		question: typeof input.question === "string" ? input.question : "",
		options,
	};
}

/** The pending asides hung on one anchor, oldest first. */
export function asidesFor(pending: readonly PendingAside[] | undefined, anchorId: string): Aside[] {
	return (pending ?? []).filter((a) => a.anchorId === anchorId).map(({ anchorId: _anchor, ...aside }) => aside);
}

/** Every aside id already delivered into the messages. */
export function deliveredAsideIds(messages: readonly LhMessage[]): Set<string> {
	const ids = new Set<string>();
	const collect = (asides: unknown) => {
		if (!Array.isArray(asides)) return;
		for (const a of asides) if (typeof (a as { id?: unknown })?.id === "string") ids.add((a as Aside).id);
	};
	for (const m of messages) {
		const role = (m as { role?: string }).role;
		if (role === "toolResult") collect(((m as { details?: unknown }).details as { asides?: unknown } | null)?.asides);
		else if (role === "custom" && (m as LhMarkerMessage).customType === "aside") {
			collect(((m as LhMarkerMessage).details as { asides?: unknown } | null)?.asides);
		}
	}
	return ids;
}

/** The pending list minus what the messages already carry. */
export function undeliveredAsides(pending: readonly PendingAside[] | undefined, messages: readonly LhMessage[]): PendingAside[] {
	if (!pending || pending.length === 0) return [];
	const delivered = deliveredAsideIds(messages);
	return pending.filter((a) => !delivered.has(a.id));
}

/**
 * The lesson as the side thread sees it: honors the active compaction cut
 * (summary first, then the kept tail), renders through the session
 * markdown engine, adds what that engine leaves out on purpose (practice
 * submissions, delivered aside markers), and ends with the anchor block.
 */
export function asideContext(messages: readonly LhMessage[], anchor: AsideAnchor): string {
	const blocks: string[] = [];
	const active = activeCompactionOf(messages);
	const kept = active ? keptIndexFor(messages, active) : -1;
	const tail = kept >= 0 ? messages.slice(kept) : messages;
	if (active && kept >= 0) blocks.push(`### Earlier in the session (summary)\n\n${active.content.trim()}`);
	const ctx = sessionMarkdownContext(messages);
	for (const m of tail) {
		if ((m as { role?: string }).role === "custom") {
			const marker = m as LhMarkerMessage;
			if (marker.customType === "practice-thinking") {
				const text = (marker.details as { text?: unknown } | null)?.text;
				if (typeof text === "string" && text.trim()) blocks.push(`### Learner (working on the problem)\n\n${text.trim()}`);
			} else if (marker.customType === "aside") {
				const asides = (marker.details as { asides?: Aside[] } | null)?.asides ?? [];
				if (asides.length > 0) blocks.push(asideLines(asides).join("\n\n"));
			}
			continue;
		}
		const block = messageMarkdown(m, m.id, false, ctx);
		if (block !== null) blocks.push(block);
	}
	blocks.push(
		anchor.kind === "check"
			? [
					"### Waiting for the learner's answer",
					`**Q:** ${anchor.question.trim() || "(no question text)"}`,
					...(anchor.options.length > 0 ? [anchor.options.map((o, i) => `${i + 1}. ${o}`).join("\n")] : []),
				].join("\n\n")
			: `### The learner is working on this problem\n\n${anchor.statement.trim() || "(no statement)"}`,
	);
	return blocks.join("\n\n");
}
