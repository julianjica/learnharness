/**
 * THE GARDEN (owner design 2026-11-11 — src/core/contracts/garden.ts): one
 * plant per concept, grown only by the learner's own evidence. Pins:
 *
 *   - the evidence items a teach/guide record yields (positive only);
 *   - the coverage gate and link-once rule (linkableItems);
 *   - the stage ladder and the evidence fold (links + practice targets,
 *     free-text verdicts, dead concepts dropped);
 *   - beds by birth session;
 *   - the linker's submission validation, and the linking step inside a
 *     real pipeline run (faux model) — links written, spend billed as a
 *     "link" run that the cost fold keeps out of the audit stage;
 *   - the store round trip, the page's growth line and the plant render.
 */

import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createFauxCore, fauxAssistantMessage, fauxToolCall, type ToolCall } from "@earendil-works/pi-ai";

import type { PiEngine } from "../src/agent/models.ts";
import type { LhMessage } from "../src/core/native-messages.ts";
import type { ChatRecord, CoverageEntry, ExtractionRunUsage, GardenLink, GraphNode } from "../src/core/contracts.ts";
import type { GardenStore, GraphStore } from "../src/core/ports.ts";
import { deriveGarden, gardenEvidence, gardenItemsOf, linkableItems, stageOf } from "../src/core/garden.ts";
import { coverageSlots } from "../src/core/coverage.ts";
import { graphCostSummary } from "../src/core/cost-summary.ts";
import { linkerSubmissionProblem } from "../src/agent/subagents/garden-linker.ts";
import { createExtractionPipeline } from "../src/agent/subagents/extraction.ts";
import { chatStore } from "../src/store/chats.ts";
import { gardenStore } from "../src/store/garden.ts";
import { Plant, growthLine, growthSince } from "../components/garden.tsx";

// ─── record builders ─────────────────────────────────────────────────────────

let seq = 0;
const mid = () => `m${++seq}`;

function prose(text: string): LhMessage {
	return { id: mid(), role: "assistant", content: [{ type: "text", text }], api: "faux", provider: "faux", model: "faux", usage: {} as never, stopReason: "stop", timestamp: 0 } as unknown as LhMessage;
}

/** Teacher prose + one tool call in the same assistant message. */
function call(name: string, id: string, args: Record<string, unknown>, text = "Some teaching prose."): LhMessage {
	return {
		id: mid(),
		role: "assistant",
		content: [{ type: "text", text }, { type: "toolCall", id, name, arguments: args }],
		api: "faux",
		provider: "faux",
		model: "faux",
		usage: {} as never,
		stopReason: "toolUse",
		timestamp: 0,
	} as unknown as LhMessage;
}

function result(toolCallId: string, toolName: string, details: unknown = null, isError = false): LhMessage {
	return { id: mid(), role: "toolResult", toolCallId, toolName, content: [{ type: "text", text: "ok" }], details, isError, timestamp: 0 } as unknown as LhMessage;
}

const quizArgs = (q: string) => ({ question: q, options: [{ label: "Yes", value: "y" }, { label: "No", value: "n" }], correctAnswer: "y" });

function teachRecord(): Pick<ChatRecord, "kind" | "messages" | "tree"> {
	return {
		kind: "teach",
		messages: [
			call("probe", "p-right", quizArgs("Probe right?")),
			result("p-right", "probe", { correct: true }),
			call("quiz", "q-right", quizArgs("Quiz right?")),
			result("q-right", "quiz", { correct: true }),
			call("quiz", "q-wrong", quizArgs("Quiz wrong?")),
			result("q-wrong", "quiz", { correct: false }),
			call("quiz", "q-dk", quizArgs("Don't know?")),
			result("q-dk", "quiz", { dontKnow: true, correct: false }),
			call("explain", "e-text", { question: "Explain it", correctAnswer: "Because X." }),
			result("e-text", "explain", { text: "Because X, I think." }),
			call("recall", "r-dismissed", { question: "Recall it", correctAnswer: "Y." }),
			result("r-dismissed", "recall", { dismissed: true }),
			call("quiz", "q-dangling", quizArgs("Still waiting?")),
		],
	};
}

function guideRecord(): Pick<ChatRecord, "kind" | "messages" | "tree"> {
	const pose = (id: string, label: string) => call("problem", id, { label, nodeId: "p1", statement: `Statement of ${label}`, lastPart: false, modelSolution: "…" });
	const conclude = (id: string, outcome: string) => [call("conclude", id, { outcome, verdict: "v" }), result(id, "conclude")];
	return {
		kind: "guide",
		tree: {
			nodes: [
				{ id: "p1", title: "Problem 1" },
				{ id: "p2", title: "Problem 2", summary: "Bound the tail" },
				{ id: "idea", title: "Markov's inequality" },
			],
			edges: [{ from: "idea", to: "p2" }],
			version: 1,
		},
		messages: [
			pose("g-a", "Problem 1(a)"),
			result("g-a", "problem"),
			...conclude("c-a", "solved"),
			pose("g-b", "Problem 1(b)"),
			result("g-b", "problem"),
			...conclude("c-b", "solvedWithHints"),
			pose("g-c", "Problem 1(c)"),
			result("g-c", "problem"),
			...conclude("c-c", "revealed"),
			pose("g-d", "Problem 1(d)"),
			result("g-d", "problem"),
			...conclude("c-d", "movedOn"),
			call("mark_done", "md", { nodeId: "p2" }),
			result("md", "mark_done"),
			call("mark_done", "md-bad", { nodeId: "nope" }),
			result("md-bad", "mark_done", null, true),
		],
	};
}

// ─── the items ───────────────────────────────────────────────────────────────

describe("garden evidence items", () => {
	it("a teach record yields right graded checks and answered free-text checks only", () => {
		const items = gardenItemsOf(teachRecord());
		assert.deepEqual(items.map((i) => i.id), ["p-right", "q-right", "e-text"]);
		const free = items.find((i) => i.id === "e-text");
		assert.ok(free && free.kind === "check" && !free.graded);
		assert.equal(free.committed, "Because X.");
		assert.equal(free.learnerAnswer, "Because X, I think.");
		const graded = items.find((i) => i.id === "q-right");
		assert.ok(graded && graded.kind === "check" && graded.rightAnswer === "Yes");
	});

	it("a guide record yields solved parts (alone or with hints) and clean mark_done calls", () => {
		const items = gardenItemsOf(guideRecord());
		assert.deepEqual(items.map((i) => [i.id, i.kind]), [["g-a", "problem"], ["g-b", "problem"], ["md", "worked"]]);
		const [a, b, worked] = items;
		assert.ok(a?.kind === "problem" && a.alone === true);
		assert.ok(b?.kind === "problem" && b.alone === false);
		assert.ok(worked?.kind === "worked");
		assert.equal(worked.problem, "Problem 2: Bound the tail");
		assert.deepEqual(worked.ideas, ["Markov's inequality"]);
	});

	it("a practice record needs no links (its problems carry targets)", () => {
		assert.deepEqual(gardenItemsOf({ kind: "practice", messages: teachRecord().messages }), []);
	});

	it("only items at or before the newest extracted message, and not yet linked, are linkable", () => {
		const items = gardenItemsOf(teachRecord());
		const qRight = items.find((i) => i.id === "q-right")!;
		assert.deepEqual(linkableItems(items, -1, new Set()), []);
		assert.deepEqual(linkableItems(items, qRight.messageIndex, new Set()).map((i) => i.id), ["p-right", "q-right"]);
		assert.deepEqual(linkableItems(items, 999, new Set(["p-right"])).map((i) => i.id), ["q-right", "e-text"]);
	});
});

// ─── stages and the fold ─────────────────────────────────────────────────────

describe("garden stages", () => {
	const ev = (o: Partial<{ rightChecks: number; solvedAlone: number; solvedWithHelp: number; worked: number }>) => ({
		rightChecks: 0,
		solvedAlone: 0,
		solvedWithHelp: 0,
		worked: 0,
		...o,
	});

	it("climbs seed → sprout → leafy → bloom on the approved rules", () => {
		assert.equal(stageOf(ev({})), "seed");
		assert.equal(stageOf(ev({ rightChecks: 1 })), "sprout");
		assert.equal(stageOf(ev({ rightChecks: 2 })), "sprout");
		assert.equal(stageOf(ev({ rightChecks: 3 })), "leafy");
		assert.equal(stageOf(ev({ solvedWithHelp: 1 })), "leafy");
		assert.equal(stageOf(ev({ worked: 1 })), "leafy");
		assert.equal(stageOf(ev({ solvedAlone: 1 })), "bloom");
	});

	it("folds links (verdicts gate free text), practice targets, and drops dead concepts", () => {
		const teach = { id: "chat-t", ...teachRecord() };
		const guide = { id: "chat-g", ...guideRecord() };
		const practice = {
			id: "chat-p",
			kind: "practice" as const,
			messages: [
				call("problem", "pp1", { statement: "s", mode: "recall", target: ["n_a", "n_dead"], modelSolution: "…" }),
				result("pp1", "problem"),
				call("conclude", "pc1", { outcome: "solved", verdict: "v" }),
				result("pc1", "conclude"),
				call("problem", "pp2", { statement: "s", mode: "recall", target: ["n_b"], modelSolution: "…" }),
				result("pp2", "problem"),
				call("conclude", "pc2", { outcome: "surrendered", verdict: "v" }),
				result("pc2", "conclude"),
			],
		};
		const at = "2026-11-11T00:00:00.000Z";
		const links: GardenLink[] = [
			{ chatId: "chat-t", itemId: "p-right", nodeIds: ["n_b"], linkedAt: at },
			{ chatId: "chat-t", itemId: "q-right", nodeIds: ["n_b", "n_b"], linkedAt: at },
			{ chatId: "chat-t", itemId: "e-text", nodeIds: ["n_b"], verdict: "notRight", linkedAt: at },
			{ chatId: "chat-g", itemId: "g-b", nodeIds: ["n_c"], linkedAt: at },
			{ chatId: "chat-g", itemId: "md", nodeIds: ["n_d"], linkedAt: at },
		];
		const known = new Set(["n_a", "n_b", "n_c", "n_d"]);
		const evidence = gardenEvidence([teach, guide, practice], links, known);
		assert.deepEqual(evidence.get("n_a"), { rightChecks: 0, solvedAlone: 1, solvedWithHelp: 0, worked: 0 });
		assert.deepEqual(evidence.get("n_b"), { rightChecks: 2, solvedAlone: 0, solvedWithHelp: 0, worked: 0 });
		assert.deepEqual(evidence.get("n_c"), { rightChecks: 0, solvedAlone: 0, solvedWithHelp: 1, worked: 0 });
		assert.deepEqual(evidence.get("n_d"), { rightChecks: 0, solvedAlone: 0, solvedWithHelp: 0, worked: 1 });
		assert.equal(evidence.has("n_dead"), false);

		// A right verdict makes the free-text check count.
		const relinked = [...links, { chatId: "chat-t", itemId: "e-text", nodeIds: ["n_b"], verdict: "right" as const, linkedAt: at }];
		assert.equal(gardenEvidence([teach], relinked, known).get("n_b")?.rightChecks, 3);
	});

	it("plants concepts in beds by birth session, oldest bed first, labelled by title or file name", () => {
		const node = (id: string, chatId: string, createdAt: string): GraphNode => ({
			id,
			name: id.toUpperCase(),
			statement: id,
			aliases: [],
			createdAt,
			provenance: [{ chatId, messageId: "m" }],
		});
		const beds = deriveGarden(
			[node("n_1", "chat-new", "2026-11-02"), node("n_2", "src_x", "2026-10-01"), node("n_3", "chat-new", "2026-11-03")],
			new Map([["n_3", { rightChecks: 1, solvedAlone: 0, solvedWithHelp: 0, worked: 0 }]]),
			{ sessions: { "chat-new": "Martingales" }, fileSources: { src_x: "/notes/probability.md" } },
		);
		assert.deepEqual(beds.map((b) => [b.id, b.label, b.plants.map((p) => `${p.nodeId}:${p.stage}`)]), [
			["src_x", "probability.md", ["n_2:seed"]],
			["chat-new", "Martingales", ["n_1:seed", "n_3:sprout"]],
		]);
	});
});

// ─── the linker ──────────────────────────────────────────────────────────────

describe("garden linker", () => {
	const items = gardenItemsOf(teachRecord());
	const keys = new Map(items.map((item, i) => [`i${i + 1}`, item]));
	const concepts = new Set(["n_a", "n_b"]);

	it("accepts a complete submission and refuses gaps, repeats, unknown ids and missing verdicts", () => {
		const good = { links: [{ item: "i1", concepts: ["n_a"] }, { item: "i2", concepts: [] }, { item: "i3", concepts: ["n_b"], verdict: "right" as const }] };
		assert.equal(linkerSubmissionProblem(good, keys, concepts), null);
		assert.match(linkerSubmissionProblem({ links: good.links.slice(0, 2) }, keys, concepts) ?? "", /missing item/);
		assert.match(linkerSubmissionProblem({ links: [...good.links, good.links[0]!] }, keys, concepts) ?? "", /twice/);
		assert.match(
			linkerSubmissionProblem({ links: [{ item: "i1", concepts: ["n_zzz"] }, good.links[1]!, good.links[2]!] }, keys, concepts) ?? "",
			/not in the concept list/,
		);
		assert.match(
			linkerSubmissionProblem({ links: [good.links[0]!, good.links[1]!, { item: "i3", concepts: [] }] }, keys, concepts) ?? "",
			/needs a verdict/,
		);
	});
});

// ─── the linking step inside a pipeline run ──────────────────────────────────

function memoryGraph(nodes: GraphNode[], coverage: CoverageEntry[]): GraphStore {
	return {
		appendNode: (n) => void nodes.push(n),
		readNodes: () => nodes.map((n) => ({ ...n })),
		appendChain: () => {},
		readChains: () => [],
		appendCheckpoint: () => {},
		readCheckpoints: () => [],
		appendCoverage: (e) => void coverage.push(e),
		readCoverage: () => coverage.map((e) => ({ ...e })),
		upsertSource: () => {},
		readSources: () => [],
		appendSourceUsage: () => {},
		readPositions: () => ({}),
		writePositions: () => {},
		rewriteLedgers: () => {},
	} satisfies GraphStore;
}

function memoryGarden(): GardenStore & { links: GardenLink[] } {
	const links: GardenLink[] = [];
	return {
		links,
		appendLinks: (next) => void links.push(...next),
		readLinks: () => links.map((l) => ({ ...l })),
		readVisit: () => null,
		writeVisit: () => {},
	};
}

function submitEngine(input: unknown, calls: { n: number }): PiEngine {
	const faux = createFauxCore({});
	faux.setResponses([
		() => {
			calls.n++;
			return fauxAssistantMessage([fauxToolCall("submit_links", input as ToolCall["arguments"], { id: "links-call" })], { stopReason: "toolUse" });
		},
	]);
	return { model: faux.getModel(), streamFn: faux.streamSimple };
}

const created: string[] = [];
after(() => {
	for (const id of created) chatStore.deleteChat(id);
});

describe("garden linking step", () => {
	it("links settled, extracted items once, judges free text, and bills a link run", async () => {
		const chat = chatStore.createChat("Garden linking fixture");
		created.push(chat.id);
		const record = teachRecord();
		chatStore.saveMessages(chat.id, record.messages);
		// Extracted through the explain check's message; the dangling quiz after it is not.
		const messages = chatStore.getChat(chat.id)!.messages;
		const lastExtracted = messages.findIndex((m) => (m as { content?: Array<{ id?: string }> }).content?.some?.((b) => b.id === "e-text"));
		const coverage = coverageSlots(messages)
			.slice(0, lastExtracted + 1)
			.filter((s) => s.tokens > 0)
			.map((s) => ({ chatId: chat.id, fp: s.fp, tokens: s.tokens, foldedAt: "t" }));
		const nodes: GraphNode[] = [
			{ id: "n_a", name: "A", statement: "A holds.", aliases: [], createdAt: "t", provenance: [{ chatId: chat.id, messageId: messages[0]!.id }] },
			{ id: "n_other", name: "Other", statement: "Elsewhere.", aliases: [], createdAt: "t", provenance: [{ chatId: "chat-elsewhere", messageId: "x" }] },
		];
		const garden = memoryGarden();
		const calls = { n: 0 };
		const engine = submitEngine(
			{ links: [{ item: "i1", concepts: ["n_a"] }, { item: "i2", concepts: ["n_a"] }, { item: "i3", concepts: ["n_a"], verdict: "right" }] },
			calls,
		);
		const pipeline = createExtractionPipeline({ chatStore, graphStore: memoryGraph(nodes, coverage), gardenStore: garden, extractor: engine, auditor: engine });

		assert.equal(await pipeline.linkChat(chat.id), 3);
		assert.equal(calls.n, 1);
		assert.deepEqual(
			garden.links.map((l) => [l.itemId, l.nodeIds, l.verdict]),
			[["p-right", ["n_a"], undefined], ["q-right", ["n_a"], undefined], ["e-text", ["n_a"], "right"]],
		);
		const usage = chatStore.getChat(chat.id)!.extractions ?? [];
		assert.equal(usage.length, 1);
		assert.equal(usage[0]!.kind, "link");
		assert.ok(usage[0]!.stages.extractor.steps.length > 0);

		// Linked once: a second pass has nothing to do and calls no model.
		assert.equal(await pipeline.linkChat(chat.id), 0);
		assert.equal(calls.n, 1);
	});

	it("records items as linked to nothing (no model call) when the session has no concepts", async () => {
		const chat = chatStore.createChat("Garden no-concepts fixture");
		created.push(chat.id);
		chatStore.saveMessages(chat.id, [call("quiz", "q1", quizArgs("Q?")), result("q1", "quiz", { correct: true }), prose("More.")]);
		const messages = chatStore.getChat(chat.id)!.messages;
		const coverage = coverageSlots(messages).filter((s) => s.tokens > 0).map((s) => ({ chatId: chat.id, fp: s.fp, tokens: s.tokens, foldedAt: "t" }));
		const garden = memoryGarden();
		const calls = { n: 0 };
		const engine = submitEngine({ links: [] }, calls);
		const pipeline = createExtractionPipeline({ chatStore, graphStore: memoryGraph([], coverage), gardenStore: garden, extractor: engine, auditor: engine });
		assert.equal(await pipeline.linkChat(chat.id), 1);
		assert.equal(calls.n, 0);
		assert.deepEqual(garden.links.map((l) => [l.itemId, l.nodeIds]), [["q1", []]]);
	});

	it("keeps link runs out of the audit stage in the cost fold", () => {
		const step = { inputTokens: 10, outputTokens: 5, cacheReadTokens: 0, cacheWriteTokens: 0, cacheWrite1hTokens: 0, reasoningTokens: 0 };
		const run: ExtractionRunUsage = {
			kind: "link",
			startedAt: 1,
			at: "t",
			durationMs: 1,
			stages: { extractor: { model: "p:m", steps: [step] }, auditor: { model: "p:m", steps: [] } },
		};
		const summary = graphCostSummary({ chats: [{ title: "S", extractions: [run] }], sources: [] }, () => 0.01);
		assert.equal(summary.stages.extraction.runs, 1);
		assert.equal(summary.stages.audit.runs, 0);
		assert.equal(summary.stages.audit.unpricedRuns, 0);
		assert.equal(summary.runs[0]!.title, "S · garden links");
	});
});

// ─── store, page helpers, render ─────────────────────────────────────────────

describe("garden store and page", () => {
	it("round-trips links and the visit snapshot", () => {
		const link: GardenLink = { chatId: "c", itemId: "i", nodeIds: ["n"], verdict: "right", linkedAt: "t" };
		gardenStore.appendLinks([link]);
		assert.deepEqual(gardenStore.readLinks().at(-1), link);
		gardenStore.writeVisit({ visitedAt: "t", stages: { n: "leafy", bad: "tree" as never } });
		assert.deepEqual(gardenStore.readVisit(), { visitedAt: "t", stages: { n: "leafy" } });
	});

	it("counts what grew since the last visit", () => {
		const beds = [
			{
				id: "b",
				label: "B",
				plants: [
					{ nodeId: "a", name: "A", stage: "sprout" as const, evidence: { rightChecks: 1, solvedAlone: 0, solvedWithHelp: 0, worked: 0 } },
					{ nodeId: "b", name: "B", stage: "bloom" as const, evidence: { rightChecks: 0, solvedAlone: 1, solvedWithHelp: 0, worked: 0 } },
					{ nodeId: "c", name: "C", stage: "seed" as const, evidence: { rightChecks: 0, solvedAlone: 0, solvedWithHelp: 0, worked: 0 } },
				],
			},
		];
		assert.equal(growthSince(beds, undefined).size, 0); // first visit: nothing animates
		const grown = growthSince(beds, { a: "seed", b: "bloom" });
		assert.deepEqual([...grown], [["a", "sprout"], ["c", "seed"]]);
		assert.equal(growthLine(grown), "Since your last visit: 1 new seed · 1 sprout");
		assert.equal(growthLine(new Map()), null);
	});

	it("draws bigger plants at later stages, leaves from leafy, flowers only in bloom", () => {
		const render = (stage: "seed" | "sprout" | "leafy" | "bloom") =>
			renderToStaticMarkup(createElement(Plant, { plant: { nodeId: "n_render", stage }, grow: false }));
		const seed = render("seed");
		const sprout = render("sprout");
		const leafy = render("leafy");
		const bloom = render("bloom");
		assert.ok(!seed.includes("<path"));
		assert.ok(sprout.includes("<path") && !sprout.includes("--lh-garden-leaf"));
		assert.ok(leafy.includes("--lh-garden-leaf") && !leafy.includes("--lh-garden-flower-heart"));
		assert.ok(bloom.includes("--lh-garden-flower-heart"));
		const pathChars = (svg: string) => [...svg.matchAll(/ d="([^"]*)"/g)].reduce((n, m) => n + m[1]!.length, 0);
		assert.ok(pathChars(sprout) < pathChars(leafy) && pathChars(leafy) < pathChars(bloom));
		assert.ok(render("leafy").includes("lh-garden") && renderToStaticMarkup(createElement(Plant, { plant: { nodeId: "n_render", stage: "sprout" }, grow: true })).includes("lh-garden-draw"));
	});
});
