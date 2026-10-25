import type { AgentMessage } from "@earendil-works/pi-agent-core";
import { renderDelta as renderDeltaBlocks, renderTranscript as renderTranscriptBlocks, type InputBlock } from "../claude-code/render.ts";

/**
 * Record → Codex input (docs/codex-engine.md, "History").
 *
 * Same projection as the Claude Code engine (claude-code/render.ts: a
 * delta tail for a resumed thread, the whole transcript as one seed for a
 * new one), re-shaped as app-server UserInput items. Images travel as
 * data: URLs.
 */

export type UserInput =
	| { type: "text"; text: string; text_elements: [] }
	| { type: "image"; url: string };

function toInput(blocks: InputBlock[]): UserInput[] {
	return blocks.map((b) => (b.type === "text" ? { type: "text", text: b.text, text_elements: [] } : { type: "image", url: `data:${b.source.media_type};base64,${b.source.data}` }));
}

/** The record's new tail as one turn's input; null → start fresh. */
export function renderDelta(slice: readonly AgentMessage[]): UserInput[] | null {
	const blocks = renderDeltaBlocks(slice);
	return blocks === null ? null : toInput(blocks);
}

/** The whole model-facing transcript as a seed for a new thread. */
export function renderTranscript(messages: readonly AgentMessage[]): UserInput[] {
	return toInput(renderTranscriptBlocks(messages));
}

export function textInput(text: string): UserInput {
	return { type: "text", text, text_elements: [] };
}
