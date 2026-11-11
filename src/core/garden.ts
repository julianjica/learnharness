/**
 * The garden's pure folds (contracts/garden.ts has the design). Three jobs:
 *
 *   1. gardenItemsOf — the POSITIVE evidence items in a teach or guide
 *      record that need a check→concept link: right graded checks, answered
 *      free-text checks (the linker judges them), guide parts solved with or
 *      without hints, and partner-style "worked through" marks. Items that
 *      can never grow anything (wrong, "I don't know", dismissed, moved on,
 *      surrendered, revealed) are never items at all.
 *   2. linkableItems — the items the linking step may link now: settled,
 *      sitting at or before an extracted message, and not linked yet.
 *   3. deriveGarden — the beds and every concept's stage, from the graph's
 *      propositions, the chat records, and the links.
 *
 * Practice sessions need no links: their problems already carry concept
 * targets, so deriveGarden reads them straight off the record.
 */
import type { AssistantMessage, ToolResultMessage } from "@earendil-works/pi-ai";
import type { ChatRecord } from "./contracts/chat.ts";
import type { GraphNode } from "./contracts/graph.ts";
import type {
	GardenBed,
	GardenEvidence,
	GardenLink,
	GardenPlant,
	GardenStage,
} from "./contracts/garden.ts";
import { LEAFY_RIGHT_CHECKS } from "./contracts/garden.ts";
import type { LhMessage } from "./native-messages.ts";
import { PRACTICE_CONCLUDE_TOOL, PRACTICE_PROBLEM_TOOL } from "./native-messages.ts";
import { birthSessionOf } from "./session-clusters.ts";

/** Graded checks: right/wrong is on the answer record. */
const GRADED_CHECK_TOOLS = new Set(["quiz", "probe"]);
/** Free-text checks: the linker judges the answer against the commitment. */
const FREE_CHECK_TOOLS = new Set(["explain", "recall"]);

/** One positive evidence item awaiting (or holding) a link. */
export type GardenItem =
	| {
			kind: "check";
			id: string;
			/** Index of the message holding the call. */
			messageIndex: number;
			tool: string;
			question: string;
			/** Graded checks: the right option label(s). */
			rightAnswer?: string;
			/** Free-text checks: the committed answer and the learner's words —
			 *  the linker's verdict decides whether it counts. */
			committed?: string;
			learnerAnswer?: string;
			graded: boolean;
	  }
	| {
			kind: "problem";
			id: string;
			messageIndex: number;
			label: string;
			statement: string;
			alone: boolean;
	  }
	| {
			kind: "worked";
			id: string;
			messageIndex: number;
			/** The plan node's title and summary, plus the ideas it rests on. */
			problem: string;
			ideas: string[];
	  };

interface CallSite {
	name: string;
	args: Record<string, unknown>;
	messageIndex: number;
}

function callSites(messages: readonly LhMessage[]): Map<string, CallSite> {
	const out = new Map<string, CallSite>();
	messages.forEach((m, messageIndex) => {
		if ((m as { role?: string }).role !== "assistant") return;
		for (const block of (m as AssistantMessage).content) {
			if (block.type !== "toolCall") continue;
			out.set(block.id, {
				name: block.name,
				args: (block.arguments ?? {}) as Record<string, unknown>,
				messageIndex,
			});
		}
	});
	return out;
}

function cleanResults(messages: readonly LhMessage[]): Map<string, ToolResultMessage> {
	const out = new Map<string, ToolResultMessage>();
	for (const m of messages) {
		if ((m as { role?: string }).role !== "toolResult") continue;
		const result = m as ToolResultMessage;
		if (!result.isError) out.set(result.toolCallId, result);
	}
	return out;
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");

/** Each problem pose's ending outcome: the first clean conclude after it.
 *  Exported for the practice read below and the tests. */
export function problemOutcomes(messages: readonly LhMessage[]): Map<string, string> {
	const results = cleanResults(messages);
	const out = new Map<string, string>();
	let open: string | null = null;
	for (const m of messages) {
		if ((m as { role?: string }).role !== "assistant") continue;
		for (const block of (m as AssistantMessage).content) {
			if (block.type !== "toolCall" || !results.has(block.id)) continue;
			if (block.name === PRACTICE_PROBLEM_TOOL) open = block.id;
			else if (block.name === PRACTICE_CONCLUDE_TOOL && open) {
				out.set(open, str((block.arguments as { outcome?: unknown } | undefined)?.outcome));
				open = null;
			}
		}
	}
	return out;
}

function rightOptionLabels(args: Record<string, unknown>): string {
	const options = Array.isArray(args.options) ? (args.options as Array<{ label?: unknown; value?: unknown }>) : [];
	const correct = args.correctAnswer;
	const wanted = new Set((Array.isArray(correct) ? correct : [correct]).map(str));
	const labels = options.filter((o) => wanted.has(str(o.value)) || wanted.has(str(o.label))).map((o) => str(o.label));
	return labels.join("; ");
}

/** The positive evidence items of a teach or guide record (practice: none —
 *  its problems carry targets). Order = record order. */
export function gardenItemsOf(record: Pick<ChatRecord, "kind" | "messages" | "tree">): GardenItem[] {
	if (record.kind === "practice") return [];
	const { messages } = record;
	const calls = callSites(messages);
	const results = cleanResults(messages);
	const outcomes = record.kind === "guide" ? problemOutcomes(messages) : new Map<string, string>();
	const items: GardenItem[] = [];
	for (const [id, call] of calls) {
		const result = results.get(id);
		if (!result) continue; // dangling or refused: it never happened
		if (GRADED_CHECK_TOOLS.has(call.name) || FREE_CHECK_TOOLS.has(call.name)) {
			const answer = (result.details ?? {}) as { correct?: unknown; dontKnow?: unknown; dismissed?: unknown; text?: unknown };
			if (answer.dismissed === true || answer.dontKnow === true) continue;
			const question = str(call.args.question);
			if (GRADED_CHECK_TOOLS.has(call.name)) {
				if (answer.correct !== true) continue;
				items.push({ kind: "check", id, messageIndex: call.messageIndex, tool: call.name, question, rightAnswer: rightOptionLabels(call.args), graded: true });
			} else {
				const text = str(answer.text).trim();
				if (!text) continue;
				items.push({
					kind: "check",
					id,
					messageIndex: call.messageIndex,
					tool: call.name,
					question,
					committed: str(call.args.correctAnswer),
					learnerAnswer: text,
					graded: false,
				});
			}
			continue;
		}
		if (record.kind !== "guide") continue;
		if (call.name === PRACTICE_PROBLEM_TOOL) {
			const outcome = outcomes.get(id);
			if (outcome !== "solved" && outcome !== "solvedWithHints") continue;
			items.push({
				kind: "problem",
				id,
				messageIndex: call.messageIndex,
				label: str(call.args.label),
				statement: str(call.args.statement),
				alone: outcome === "solved",
			});
			continue;
		}
		if (call.name === "mark_done") {
			const nodeId = str(call.args.nodeId);
			const tree = record.tree;
			const node = tree?.nodes.find((n) => n.id === nodeId);
			if (!node) continue;
			const ideas = (tree?.edges ?? [])
				.filter((e) => e.to === nodeId)
				.map((e) => tree!.nodes.find((n) => n.id === e.from)?.title)
				.filter((t): t is string => typeof t === "string");
			items.push({
				kind: "worked",
				id,
				messageIndex: call.messageIndex,
				problem: node.summary ? `${node.title}: ${node.summary}` : node.title,
				ideas,
			});
		}
	}
	return items.sort((a, b) => a.messageIndex - b.messageIndex);
}

/** The items the linking step may link now: at or before the newest
 *  extracted message (`lastCoveredIndex`, -1 = nothing extracted yet) and
 *  not already linked. */
export function linkableItems(
	items: readonly GardenItem[],
	lastCoveredIndex: number,
	linkedIds: ReadonlySet<string>,
): GardenItem[] {
	return items.filter((item) => item.messageIndex <= lastCoveredIndex && !linkedIds.has(item.id));
}

/** A concept's stage from its evidence (contracts/garden.ts ladder). */
export function stageOf(e: GardenEvidence): GardenStage {
	if (e.solvedAlone > 0) return "bloom";
	if (e.rightChecks >= LEAFY_RIGHT_CHECKS || e.solvedWithHelp > 0 || e.worked > 0) return "leafy";
	if (e.rightChecks > 0) return "sprout";
	return "seed";
}

const emptyEvidence = (): GardenEvidence => ({ rightChecks: 0, solvedAlone: 0, solvedWithHelp: 0, worked: 0 });

/** Every concept's evidence: linked items (teach/guide) plus practice
 *  problems' own targets. Only ids in `known` count (dead nodes drop). */
export function gardenEvidence(
	chats: ReadonlyArray<Pick<ChatRecord, "id" | "kind" | "messages" | "tree">>,
	links: readonly GardenLink[],
	known: ReadonlySet<string>,
): Map<string, GardenEvidence> {
	const out = new Map<string, GardenEvidence>();
	const bump = (nodeId: string, field: keyof GardenEvidence) => {
		if (!known.has(nodeId)) return;
		const e = out.get(nodeId) ?? emptyEvidence();
		e[field]++;
		out.set(nodeId, e);
	};
	const linksByChat = new Map<string, Map<string, GardenLink>>();
	for (const link of links) {
		const byItem = linksByChat.get(link.chatId) ?? new Map<string, GardenLink>();
		byItem.set(link.itemId, link); // a later line wins (a re-link)
		linksByChat.set(link.chatId, byItem);
	}
	for (const chat of chats) {
		if (chat.kind === "practice") {
			const results = cleanResults(chat.messages);
			const outcomes = problemOutcomes(chat.messages);
			const calls = callSites(chat.messages);
			for (const [id, outcome] of outcomes) {
				if (outcome !== "solved" && outcome !== "solvedWithHints") continue;
				if (!results.has(id)) continue;
				const target = calls.get(id)?.args.target;
				const ids = Array.isArray(target) ? [...new Set(target.map(str))] : [];
				for (const nodeId of ids) bump(nodeId, outcome === "solved" ? "solvedAlone" : "solvedWithHelp");
			}
			continue;
		}
		const byItem = linksByChat.get(chat.id);
		if (!byItem) continue;
		for (const item of gardenItemsOf(chat)) {
			const link = byItem.get(item.id);
			if (!link) continue;
			const nodeIds = [...new Set(link.nodeIds)];
			if (item.kind === "check") {
				if (!item.graded && link.verdict !== "right") continue;
				for (const nodeId of nodeIds) bump(nodeId, "rightChecks");
			} else if (item.kind === "problem") {
				for (const nodeId of nodeIds) bump(nodeId, item.alone ? "solvedAlone" : "solvedWithHelp");
			} else {
				for (const nodeId of nodeIds) bump(nodeId, "worked");
			}
		}
	}
	return out;
}

/** The beds: one per birth source (chat or notes file), plants in the
 *  graph's node order, beds ordered oldest birth first so the garden fills
 *  front to back. Labels: the session title, or the notes file's name. */
export function deriveGarden(
	propositions: readonly GraphNode[],
	evidence: ReadonlyMap<string, GardenEvidence>,
	labels: { sessions: Readonly<Record<string, string>>; fileSources: Readonly<Record<string, string>> },
): GardenBed[] {
	const beds = new Map<string, GardenBed & { bornAt: string }>();
	const seen = new Set<string>();
	for (const node of propositions) {
		if (seen.has(node.id)) continue;
		seen.add(node.id);
		const birth = birthSessionOf(node);
		if (birth === null) continue;
		let bed = beds.get(birth);
		if (!bed) {
			const file = labels.fileSources[birth];
			const label = labels.sessions[birth] ?? (file ? (file.split(/[\\/]/).pop() ?? file) : birth);
			bed = { id: birth, label, plants: [], bornAt: node.createdAt };
			beds.set(birth, bed);
		}
		const e = evidence.get(node.id) ?? emptyEvidence();
		const plant: GardenPlant = { nodeId: node.id, name: node.name, stage: stageOf(e), evidence: e };
		bed.plants.push(plant);
		if (node.createdAt < bed.bornAt) bed.bornAt = node.createdAt;
	}
	return [...beds.values()]
		.sort((a, b) => (a.bornAt < b.bornAt ? -1 : a.bornAt > b.bornAt ? 1 : a.id < b.id ? -1 : 1))
		.map(({ bornAt: _bornAt, ...bed }) => bed);
}

/** Every plant's stage, flat — the visit snapshot's shape. */
export function gardenStages(beds: readonly GardenBed[]): Record<string, GardenStage> {
	const out: Record<string, GardenStage> = {};
	for (const bed of beds) for (const plant of bed.plants) out[plant.nodeId] = plant.stage;
	return out;
}
