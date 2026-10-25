import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { ImageContent, Message, TextContent } from "@earendil-works/pi-ai";
import { toLlmMessages } from "../../core/native-messages.ts";
import { activeCompactionOf } from "../../core/compaction.ts";
import type { LhMessage } from "../../core/native-messages.ts";

/**
 * Record → Claude Code input (docs/claude-code-engine.md, "History").
 *
 * Claude Code accepts only USER turns as input; its own session holds the
 * assistant side. So the record is rendered two ways:
 *
 *   renderDelta      — the new tail of the record since the session last
 *                      saw it (learner input, answers, steer markers) as
 *                      one user turn. Returns null when the tail cannot be
 *                      sent as input (it holds assistant output or a
 *                      compaction cut) — the caller then starts fresh.
 *   renderTranscript — the whole model-facing projection as one seed turn
 *                      for a NEW session.
 *
 * Both go through toLlmMessages, the app's one model-facing seam, so the
 * model sees exactly the text pi would have sent.
 */

/** Anthropic-style content blocks (the SDK's MessageParam content). */
export type InputBlock =
	| { type: "text"; text: string }
	| { type: "image"; source: { type: "base64"; media_type: string; data: string } };

function partsToBlocks(content: string | (TextContent | ImageContent)[], prefix?: string): InputBlock[] {
	const blocks: InputBlock[] = [];
	if (typeof content === "string") {
		if (content.trim()) blocks.push({ type: "text", text: content });
	} else {
		for (const part of content) {
			if (part.type === "text") {
				if (part.text.trim()) blocks.push({ type: "text", text: part.text });
			} else if (part.type === "image") {
				blocks.push({ type: "image", source: { type: "base64", media_type: part.mimeType, data: part.data } });
			}
		}
	}
	if (prefix && blocks.length > 0 && blocks[0]!.type === "text") blocks[0] = { type: "text", text: `${prefix}${(blocks[0] as { text: string }).text}` };
	else if (prefix) blocks.unshift({ type: "text", text: prefix.trimEnd() });
	return blocks;
}

function textOf(content: string | (TextContent | ImageContent)[]): string {
	if (typeof content === "string") return content;
	return content.map((p) => (p.type === "text" ? p.text : "[image]")).join("\n");
}

/** One LLM message as input blocks (the delta path). */
function messageBlocks(message: Message): InputBlock[] | null {
	switch (message.role) {
		case "user":
			return partsToBlocks(message.content);
		case "toolResult":
			return partsToBlocks(message.content, `[Result for your ${message.toolName} call${message.isError ? " (error)" : ""}]\n`);
		case "system":
			return [];
		default:
			return null; // assistant output is never input
	}
}

/**
 * The record's new tail as one user turn. `slice` is the raw record
 * messages after the covered watermark.
 */
export function renderDelta(slice: readonly AgentMessage[]): InputBlock[] | null {
	if (activeCompactionOf(slice as readonly LhMessage[])) return null;
	const blocks: InputBlock[] = [];
	for (const raw of slice) {
		const role = (raw as { role?: string }).role;
		if (role === "assistant") return null;
		// A lone toolResult (the learner's answer to the session's last
		// question) renders directly: toLlmMessages would treat it as an
		// orphan without its call, which lives in the session, not the slice.
		const projected: Message[] = role === "toolResult" ? [raw as Message] : toLlmMessages([raw]).filter((m) => m.role !== "system");
		for (const message of projected) {
			const rendered = messageBlocks(message);
			if (rendered === null) return null;
			blocks.push(...rendered);
		}
	}
	return blocks;
}

/** The whole model-facing transcript as a seed for a fresh session. */
export function renderTranscript(messages: readonly AgentMessage[]): InputBlock[] {
	const projected = toLlmMessages(messages).filter((m) => m.role !== "system");
	if (projected.length === 0) return [];
	// A transcript that is ONLY learner input needs no framing.
	if (projected.every((m) => m.role === "user")) return projected.flatMap((m) => partsToBlocks((m as { content: string | (TextContent | ImageContent)[] }).content));
	const lines: string[] = [
		"The session so far is reproduced below (it was run before this conversation started; continue it — do not restart). Each entry is labeled with who produced it.",
		"",
	];
	const images: InputBlock[] = [];
	for (const m of projected) {
		if (m.role === "user") {
			lines.push(`<learner>\n${textOf(m.content)}\n</learner>`);
			if (typeof m.content !== "string") images.push(...partsToBlocks(m.content.filter((p) => p.type === "image")));
		} else if (m.role === "assistant") {
			for (const part of m.content) {
				if (part.type === "text" && part.text.trim()) lines.push(`<you>\n${part.text}\n</you>`);
				else if (part.type === "toolCall") lines.push(`<you_called tool="${part.name}">\n${JSON.stringify(part.arguments)}\n</you_called>`);
			}
		} else if (m.role === "toolResult") {
			lines.push(`<tool_result tool="${m.toolName}"${m.isError ? ' error="true"' : ""}>\n${textOf(m.content)}\n</tool_result>`);
		}
	}
	lines.push("", "Continue the session from the last entry.");
	return [{ type: "text", text: lines.join("\n") }, ...images];
}
