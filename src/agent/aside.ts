import fs from "node:fs";
import path from "node:path";
import { normalizeContext, type AssistantMessage, type Message, type Usage } from "@earendil-works/pi-ai";
import { PATHS } from "../../config.ts";
import type { Aside } from "../core/contracts/asides.ts";
import type { PiEngine } from "./models.ts";

/**
 * The side thread's one model call (asides, owner 2026-10-26 —
 * src/core/contracts/asides.ts). No agent loop and no tools: the lesson
 * arrives as ONE user message (the redacted markdown context, the
 * anchor's earlier asides, then the new question), which every engine
 * accepts as-is — API providers, the subscription bridges, and the
 * Claude Code / Codex single-call streams alike. Text deltas stream to
 * `onDelta` where the engine produces them; engines that answer whole
 * (the local CLIs) deliver the text once, at the end.
 */

const PROMPTS_DIR = path.join(PATHS.root, "src", "agent", "prompts");
/** The side thread's own base plus the shared voice/accuracy/formatting
 *  law — the same curated appendix the practice agent composes. */
const SEGMENTS = ["aside/00-base.md", "shared/10-voice.md", "shared/15-accuracy.md", "shared/40-formatting.md"];

export function composeAsidePrompt(): string {
	return SEGMENTS.map((segment) => fs.readFileSync(path.join(PROMPTS_DIR, segment), "utf-8").trim()).join("\n\n---\n\n");
}

/** The single user message: lesson, earlier asides on this anchor, question. */
export function asideUserText(context: string, previous: readonly Aside[], question: string): string {
	const earlier = previous.length > 0
		? `\n\n<side_thread_so_far>\n${previous.map((a) => `Learner: ${a.question.trim()}\nYou: ${a.answer.trim()}`).join("\n\n")}\n</side_thread_so_far>`
		: "";
	return `<lesson>\n${context}\n</lesson>${earlier}\n\nThe learner's side question:\n${question.trim()}`;
}

export interface AsideRun {
	text: string;
	usage: Usage;
}

export async function runAside(opts: {
	engine: PiEngine;
	context: string;
	previous: readonly Aside[];
	question: string;
	onDelta?: (delta: string) => void;
	signal?: AbortSignal;
}): Promise<AsideRun> {
	const { engine } = opts;
	const messages: Message[] = [
		{ role: "user", content: [{ type: "text", text: asideUserText(opts.context, opts.previous, opts.question) }], timestamp: Date.now() },
	];
	const stream = engine.streamFn(engine.model, normalizeContext({ systemPrompt: composeAsidePrompt(), messages, tools: [] }), {
		reasoning: engine.level && engine.level !== "off" ? engine.level : undefined,
		signal: opts.signal,
	} as never);
	let streamed = "";
	for await (const event of stream) {
		if (event.type === "text_delta") {
			streamed += event.delta;
			opts.onDelta?.(event.delta);
		} else if (event.type === "done") {
			const text = textOf(event.message);
			// Whole-answer engines (no deltas): hand the text over once.
			if (!streamed && text) opts.onDelta?.(text);
			return { text: text || streamed, usage: event.message.usage };
		} else if (event.type === "error") {
			if (event.reason === "aborted") {
				const err = new Error("aborted");
				err.name = "AbortError";
				throw err;
			}
			throw new Error(event.error.errorMessage ?? "the side question could not be answered");
		}
	}
	throw new Error("the model stream ended without an answer");
}

function textOf(message: AssistantMessage): string {
	return message.content
		.filter((b): b is { type: "text"; text: string } => b.type === "text")
		.map((b) => b.text)
		.join("")
		.trim();
}
