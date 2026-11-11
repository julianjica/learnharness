/**
 * The garden linker (owner design, 2026-11-11 — contracts/garden.ts): one
 * submit call that says which of a session's concepts each settled evidence
 * item exercised — a right check, an answered free-text check (judged here
 * against the committed answer), a guide part solved, a partner-style
 * problem worked through. It runs right after each extraction run (and in
 * the backfill), on the extractor's model slot, never inside the
 * extractor's own prompt: the extractor keeps its teacher-prose-only view.
 */
import type { Usage } from "@earendil-works/pi-ai";
import { Type } from "typebox";
import type { GardenItem } from "../../core/garden.ts";
import type { GraphNode } from "../../core/contracts/graph.ts";
import type { PiEngine } from "../models.ts";
import { runSubmitAgent } from "./submit-agent.ts";

export interface LinkerVerdict {
	itemId: string;
	nodeIds: string[];
	verdict?: "right" | "notRight";
}

export const GARDEN_LINKER_INSTRUCTIONS = `You link a learner's evidence to the concepts it exercised.

You get a list of CONCEPTS (propositions from the learner's knowledge graph, each with an id) and a list of ITEMS from one study session: checks the learner answered and problems they finished. For each item, name the concepts the learner had to actually hold to get it right — the ideas the item tests, not every concept it mentions in passing. Usually one to three. An item that exercised none of the listed concepts gets an empty list.

Free-text items (marked FREE TEXT) also need a verdict: compare the learner's answer with the committed answer. "right" when the learner's answer gets the substance right (wording, notation and minor omissions do not matter); "notRight" when it is wrong, missing the key point, or too vague to tell.

Submit every item exactly once with the submit tool, using the item keys and concept ids exactly as given.`;

function describeItem(key: string, item: GardenItem): string {
	if (item.kind === "check") {
		if (item.graded) return `[${key}] CHECK (answered right)\nQuestion: ${item.question}\nRight answer: ${item.rightAnswer ?? ""}`;
		return (
			`[${key}] CHECK — FREE TEXT (needs a verdict)\nQuestion: ${item.question}\n` +
			`Committed answer: ${item.committed ?? ""}\nLearner's answer: ${item.learnerAnswer ?? ""}`
		);
	}
	if (item.kind === "problem") {
		return `[${key}] PROBLEM ${item.alone ? "solved on their own" : "solved with hints"}: ${item.label}\n${item.statement}`;
	}
	return (
		`[${key}] PROBLEM worked through in discussion: ${item.problem}` +
		(item.ideas.length > 0 ? `\nIdeas it rests on: ${item.ideas.join("; ")}` : "")
	);
}

const submitSchema = Type.Object({
	links: Type.Array(
		Type.Object({
			item: Type.String({ description: "The item key exactly as given, e.g. i3." }),
			concepts: Type.Array(Type.String(), { description: "Concept ids the item exercised; empty when none." }),
			verdict: Type.Optional(
				Type.Union([Type.Literal("right"), Type.Literal("notRight")], {
					description: "FREE TEXT items only: right or notRight (bare words).",
				}),
			),
		}),
		{ description: "One entry per item, every item exactly once." },
	),
});

interface Submitted {
	links: Array<{ item: string; concepts: string[]; verdict?: "right" | "notRight" }>;
}

/** Validate a submission against the batch (exported for tests). Null = good. */
export function linkerSubmissionProblem(
	submitted: Submitted,
	keys: ReadonlyMap<string, GardenItem>,
	conceptIds: ReadonlySet<string>,
): string | null {
	const seen = new Set<string>();
	for (const link of submitted.links) {
		const item = keys.get(link.item);
		if (!item) return `item "${link.item}" is not one of the given keys (${[...keys.keys()].join(", ")})`;
		if (seen.has(link.item)) return `item "${link.item}" appears twice — submit every item exactly once`;
		seen.add(link.item);
		const unknown = link.concepts.filter((c) => !conceptIds.has(c));
		if (unknown.length > 0) return `concept id(s) ${JSON.stringify(unknown)} are not in the concept list — copy ids exactly`;
		if (item.kind === "check" && !item.graded && link.verdict === undefined)
			return `item "${link.item}" is free text — it needs a verdict (right or notRight)`;
	}
	const missing = [...keys.keys()].filter((k) => !seen.has(k));
	if (missing.length > 0) return `missing item(s): ${missing.join(", ")} — submit every item exactly once`;
	return null;
}

export async function runGardenLinker(opts: {
	engine: PiEngine | undefined;
	chatId: string;
	items: readonly GardenItem[];
	concepts: ReadonlyArray<Pick<GraphNode, "id" | "name" | "statement">>;
	signal: AbortSignal | undefined;
	onStep: (usage: Usage, model: string, step: number, finishReason: string, tools: string) => void;
}): Promise<LinkerVerdict[]> {
	const keys = new Map<string, GardenItem>(opts.items.map((item, i) => [`i${i + 1}`, item]));
	const conceptIds = new Set(opts.concepts.map((c) => c.id));
	const prompt =
		`CONCEPTS:\n${opts.concepts.map((c) => `[${c.id}] ${c.name} — ${c.statement}`).join("\n")}\n\n` +
		`ITEMS:\n\n${[...keys.entries()].map(([key, item]) => describeItem(key, item)).join("\n\n")}`;
	const submitted = await runSubmitAgent<Submitted>({
		role: "extractor",
		toolName: "submit_links",
		toolDescription: "Submit the concept links (and free-text verdicts) for every item, exactly once each.",
		parameters: submitSchema,
		fill: (input: Submitted) => ({
			links: input.links.map((l) => ({ item: l.item, concepts: [...new Set(l.concepts ?? [])], verdict: l.verdict })),
		}),
		validate: (value) => linkerSubmissionProblem(value, keys, conceptIds),
		systemPrompt: GARDEN_LINKER_INSTRUCTIONS,
		prompt,
		engine: opts.engine,
		signal: opts.signal,
		onStep: opts.onStep,
		neverSubmitted: "The garden linker never submitted its links.",
		chatId: opts.chatId,
	});
	return submitted.links.map((link) => {
		const item = keys.get(link.item)!;
		const free = item.kind === "check" && !item.graded;
		return { itemId: item.id, nodeIds: link.concepts, ...(free && link.verdict ? { verdict: link.verdict } : {}) };
	});
}
