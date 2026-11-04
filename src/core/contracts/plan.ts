/**
 * Plan-tree contracts — the session-scoped dependency tree
 *
 * Part of the domain-split contracts (src/core/contracts/): each domain file
 * is owned outright by its stream — cross-domain schema changes go through
 * master. Pure types + protocol docs + tiny pure helpers; type-only imports
 * of "ai" (safe everywhere: server, client, tests). See docs/vision.md.
 */
// ─── Plan tree (vision §2 "formal plan tree") ────────────────────────────────
// A session-scoped dependency tree authored by the teacher via plan tools.
// One substrate with the global graph: tree nodes fold into graph nodes.

export interface PlanNode {
	/** Opaque, agent-chosen slug, stable across edits: "chain-rule-intuition". */
	id: string;
	/** Short label for the tree panel. */
	title: string;
	/** 1-2 sentences: what this node covers. */
	summary?: string;
}

export interface PlanEdge {
	/** Prerequisite node id. */
	from: string;
	/** Node that depends on `from`. */
	to: string;
}

export interface PlanTree {
	nodes: PlanNode[];
	edges: PlanEdge[];
	/** Increments on every mutation — lets the UI animate/react to changes. */
	version: number;
}

// NOTE (2026-09-11 pivot, docs/probe-teach-split.md): the tree once carried
// `currentNodeId` / `doneNodeIds` — progress fields. They are GONE by
// design: the tree carries structure ONLY; position and visited-ness derive
// from the transcript at render time (derivePlanStatuses below). There is no
// done ledger of any kind. No backwards compatibility for old records.

/** Derived, never stored: status of a node for the panel (vision §2). */
export type PlanNodeStatus = "current" | "visited" | "upcoming" | "done";

/** How a guiding session's problem node ended (2026-11-03): "solved"
 *  when every concluded part was solved (with or without hints),
 *  "viewed" when any part's solution was shown, "ended" otherwise
 *  (moved on, surrendered, dismissed). "worked" (2026-11-04): marked
 *  done in partner style via `mark_done`, after the learner said yes. */
export type PlanProblemOutcome = "solved" | "viewed" | "ended" | "worked";

// ─── derived statuses: position from CALLS, never from results ─────────────
//
// (2026-09-11 pivot — docs/probe-teach-split.md §3.) The teacher AUTHORS the
// map (plan_init, mermaid — re-callable rewrite) and never tracks progress.
// The quiz `nodeId` means "this question is ABOUT this node" — a position
// signal, never a completion signal. Derivation reads CALLS only:
//   current — the node of the most RECENT tagged quiz call (any state)
//   visited — every node referenced by an EARLIER tagged call
// Consequences: a node spans multiple turns/checks naturally (several
// questions may tag the same node — the map holds still); moving to a new
// node is the teacher's judgment the previous one is finished, regardless of
// check outcomes (a failed check then a move-on is still visited); results
// feed nothing; there is NO fallback current (before the first tagged check
// nothing is current). Untagged checks no longer exist (nodeId is required
// on the teach quiz, owner ruling 2026-09-26). NodeIds missing from the
// current tree are ignored (a rewrite may have dropped the node).

/** Minimal structural message slice — anything with typed parts (mirrors
 * phases.ts: pure, no runtime deps, safe on server, client, and in tests). */
interface PartsCarrier {
	parts: Array<{ type: string; state?: string; input?: unknown; output?: unknown }>;
}

export interface DerivedPlanStatuses {
	/** The node the most recent tagged quiz call is about; null before any. */
	current: string | null;
	/** Nodes referenced by earlier tagged calls — been there, monotonic. */
	visited: ReadonlySet<string>;
	/** Guiding sessions (2026-11-03): problem nodes whose final part
	 *  (`lastPart`) has concluded with nothing open, with how they ended. The ONE completion signal
	 *  on the map, and it reads conclusions, never checks. Empty
	 *  elsewhere (practice problems carry no nodeId). */
	done: ReadonlyMap<string, PlanProblemOutcome>;
}

/** Statuses of a node: the derived view the plan panel should render. */
export function derivedNodeStatus(statuses: DerivedPlanStatuses, nodeId: string): PlanNodeStatus {
	if (statuses.done.has(nodeId)) return "done";
	if (statuses.current === nodeId) return "current";
	if (statuses.visited.has(nodeId)) return "visited";
	return "upcoming";
}

export function derivePlanStatuses(tree: PlanTree, messages: readonly PartsCarrier[]): DerivedPlanStatuses {
	const ids = new Set(tree.nodes.map((n) => n.id));
	const runs: string[] = []; // distinct tagged nodes in call order, CONSECUTIVE
	// duplicates collapsed (several checks on one node = one stay on it)
	const problems = new ProblemFold();
	for (const m of messages) {
		for (const part of m.parts) {
			// A guide's problem part tags position like a check, and its
			// conclusion (or the "Show solution" face) closes the part.
			if (part.type === "tool-problem") {
				if (part.state === "output-error") continue; // a refused pose never happened
				const nodeId = problems.pose(part.input, ids);
				if (nodeId && runs.at(-1) !== nodeId) runs.push(nodeId);
				continue;
			}
			if (part.type === "tool-conclude") {
				if (part.state === "output-available") problems.conclude(part.input);
				continue;
			}
			// Partner style's confirmed done (2026-11-04).
			if (part.type === "tool-mark_done") {
				if (part.state === "output-available") problems.markDone(part.input, ids);
				continue;
			}
			// Either quizzing tool (quiz/explain) tags position — the mechanic
			// is a settings switch; the fold recognizes both (owner 2026-09-27).
			if (part.type !== "tool-quiz" && part.type !== "tool-explain") continue;
			const nodeId = (part.input as { nodeId?: unknown } | undefined)?.nodeId;
			if (typeof nodeId !== "string" || !ids.has(nodeId)) continue; // untagged/unknown — moves nothing
			if (runs.at(-1) !== nodeId) runs.push(nodeId);
		}
	}
	const current = runs.at(-1) ?? null;
	// Visited = been there in an EARLIER stay: everything before the current
	// run. A revisit (a→b→a) puts a in visited AND current — current wins at
	// render (derivedNodeStatus), visited records it has been left before.
	const visited = new Set(runs.slice(0, -1));
	return { current, visited, done: problems.done() };
}

/** The guide's problem-node fold: parts pose against a problem node
 *  (`nodeId`), one at a time; a conclusion closes the open one. A node is
 *  done once the part posed as its LAST (`lastPart: true`, owner
 *  2026-11-03) has concluded and nothing on it is open — so a problem
 *  never flips done between its parts. */
class ProblemFold {
	private open: { nodeId: string; last: boolean } | null = null;
	private outcomes = new Map<string, string[]>();
	private openNodes = new Set<string>();
	private finished = new Set<string>();
	/** Partner style's mark_done (2026-11-04): done at once, outcome
	 *  "worked" — unless a coach-posed part on it is still open. */
	private worked = new Set<string>();
	markDone(input: unknown, ids: ReadonlySet<string>): void {
		const nodeId = (input as { nodeId?: unknown } | undefined)?.nodeId;
		if (typeof nodeId === "string" && ids.has(nodeId)) this.worked.add(nodeId);
	}
	pose(input: unknown, ids: ReadonlySet<string>): string | null {
		const args = input as { nodeId?: unknown; lastPart?: unknown } | undefined;
		const nodeId = args?.nodeId;
		if (typeof nodeId !== "string" || !ids.has(nodeId)) {
			this.open = null;
			return null;
		}
		this.open = { nodeId, last: args?.lastPart === true };
		this.openNodes.add(nodeId);
		return nodeId;
	}
	conclude(input: unknown): void {
		if (!this.open) return;
		const { nodeId, last } = this.open;
		const outcome = (input as { outcome?: unknown } | undefined)?.outcome;
		this.outcomes.set(nodeId, [...(this.outcomes.get(nodeId) ?? []), typeof outcome === "string" ? outcome : ""]);
		this.openNodes.delete(nodeId);
		if (last) this.finished.add(nodeId);
		this.open = null;
	}
	done(): Map<string, PlanProblemOutcome> {
		const out = new Map<string, PlanProblemOutcome>();
		for (const nodeId of this.worked) if (!this.openNodes.has(nodeId)) out.set(nodeId, "worked");
		for (const [nodeId, list] of this.outcomes) {
			if (this.openNodes.has(nodeId) || !this.finished.has(nodeId)) continue;
			out.set(
				nodeId,
				list.includes("revealed") ? "viewed" : list.every((o) => o === "solved" || o === "solvedWithHints") ? "solved" : "ended",
			);
		}
		return out;
	}
}

/**
 * The plan tool result (author-once protocol, 2026-09-03): ONE server-side
 * tool, plan_init (tools/plan.ts) — a mermaid `graph TD` block canonicalized
 * into the structured tree, called once at the probe→teach seam and
 * re-callable to rewrite. The former mutation/tracking tools are gone:
 * statuses derive from check outcomes (derivePlanStatuses above), so the
 * tree carries structure, never progress. The tree panel still derives its
 * display from the LATEST plan tool output in the transcript — plus the
 * derived statuses — with no separate state channel.
 */
export interface PlanToolResult {
	ok: boolean;
	error?: string;
	/** The saved tree — SUCCESS results only (owner, context diet
	 *  2026-10-09): this is the record/UI-facing `details` value. The
	 *  agent-facing content never carries it — content is the validated
	 *  nodeIds + reminder; failures carry just the error. The plan
	 *  popup's latestTree seam reads this field. */
	tree?: PlanTree;
}


// ─── the native fold (Wave D: derivePlanStatuses over LhMessage[]) ───────────

import type { LhMessage } from "../native-messages.ts";

/** The same derivation over the NATIVE record: quiz CALLS only (any state —
 *  a dangling call still moves position; results feed nothing). */
export function derivePlanStatusesLh(tree: PlanTree, messages: readonly LhMessage[]): DerivedPlanStatuses {
	const ids = new Set(tree.nodes.map((n) => n.id));
	const runs: string[] = [];
	const problems = new ProblemFold();
	const clean = new Set<string>();
	for (const m of messages) {
		const r = m as { role?: string; toolCallId?: string; isError?: boolean };
		if (r.role === "toolResult" && !r.isError && r.toolCallId) clean.add(r.toolCallId);
	}
	for (const m of messages) {
		const role = (m as { role?: string }).role;
		// The "Show solution" marker closes the open part at once (its
		// deferred conclude pair, outcome "revealed", then finds nothing open).
		if (role === "custom") {
			const marker = m as { customType?: string; details?: { outcome?: unknown } };
			if (marker.customType === "problem-dismissed" && marker.details?.outcome === "revealed") problems.conclude({ outcome: "revealed" });
			continue;
		}
		if (role !== "assistant") continue;
		const content = (m as { content?: unknown }).content;
		if (!Array.isArray(content)) continue;
		for (const block of content as Array<{ type?: string; id?: string; name?: string; arguments?: unknown }>) {
			if (block.type !== "toolCall") continue;
			// Problem and conclude count through their clean results only
			// (the honest-activation law of activeProblemOf).
			if ((block.name === "problem" || block.name === "conclude" || block.name === "mark_done") && !clean.has(block.id ?? "")) continue;
			if (block.name === "mark_done") {
				problems.markDone(block.arguments, ids);
				continue;
			}
			if (block.name === "problem") {
				const nodeId = problems.pose(block.arguments, ids);
				if (nodeId && runs.at(-1) !== nodeId) runs.push(nodeId);
				continue;
			}
			if (block.name === "conclude") {
				problems.conclude(block.arguments);
				continue;
			}
			if (block.name !== "quiz" && block.name !== "explain") continue;
			const nodeId = (block.arguments as { nodeId?: unknown } | undefined)?.nodeId;
			if (typeof nodeId !== "string" || !ids.has(nodeId)) continue;
			if (runs.at(-1) !== nodeId) runs.push(nodeId);
		}
	}
	const current = runs.at(-1) ?? null;
	const visited = new Set(runs.slice(0, -1));
	return { current, visited, done: problems.done() };
}
