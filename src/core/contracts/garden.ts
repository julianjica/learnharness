/**
 * The garden (owner design, 2026-11-11): one plant per knowledge-graph
 * concept, grown ONLY from evidence the learner produced — right checks
 * and problems — across every session kind. Nothing here is written into
 * the graph (the graph stays world-facing propositions); the garden is a
 * DERIVED view over the graph, the chat records, and one small ledger of
 * check→concept links (data/garden/links.jsonl).
 *
 *   seed    the concept exists (extraction created it)
 *   sprout  one right check
 *   leafy   three right checks, a problem solved with hints, or a
 *           partner-style problem worked through
 *   bloom   a problem that used it, solved on the learner's own
 *
 * Wrong answers, "I don't know", moving on, surrendering, dismissing and
 * viewing a solution never add (and never take away) anything.
 */

export type GardenStage = "seed" | "sprout" | "leafy" | "bloom";

/** The stage order — index = rank (and the drawing's rewrite rung). */
export const GARDEN_STAGES: readonly GardenStage[] = ["seed", "sprout", "leafy", "bloom"];

/** Right checks a concept needs to turn leafy on checks alone. */
export const LEAFY_RIGHT_CHECKS = 3;

/** One linked item (links.jsonl line): which concepts a check, a guide
 *  problem part, or a partner-style "worked through" exercised — written by
 *  the linking step that runs right after extraction. An item is linked
 *  ONCE: an empty `nodeIds` is a final "nothing in the graph matched".
 *  `verdict` is the linker's judgment of a free-text (explain/recall)
 *  answer against the committed answer; graded checks never carry one. */
export interface GardenLink {
	chatId: string;
	/** The item's tool call id (check, problem pose, or mark_done call). */
	itemId: string;
	nodeIds: string[];
	verdict?: "right" | "notRight";
	linkedAt: string;
}

/** What grew one concept — the hover card's counts. */
export interface GardenEvidence {
	rightChecks: number;
	solvedAlone: number;
	solvedWithHelp: number;
	worked: number;
}

/** What a plant looks like (owner design, 2026-11-11): its species — picked
 *  once per concept and remembered (data/garden/species.json) — and that
 *  species' drawing at the plant's stage. Drawn on the server
 *  (core/garden-species/), so the browser ships no species. */
export interface GardenArt {
	speciesId: string;
	speciesName: string;
	/** SVG markup for an 80×96 cell, ground at y=88; the soil is the page's. */
	svg: string;
}

export interface GardenPlant {
	nodeId: string;
	name: string;
	stage: GardenStage;
	evidence: GardenEvidence;
	/** Set by the server view (GET /api/garden); absent in pure derivations. */
	art?: GardenArt;
}

/** One bed: the concepts born in one session (or one imported notes file). */
export interface GardenBed {
	/** The birth source id (chat id or notes "src_…" id). */
	id: string;
	label: string;
	plants: GardenPlant[];
}

/** The visit snapshot (data/garden/visit.json): every plant's stage the
 *  last time the learner looked — the "since your last visit" baseline. */
export interface GardenVisit {
	visitedAt: string;
	stages: Record<string, GardenStage>;
}

/** GET /api/garden. */
export interface GardenPayload {
	beds: GardenBed[];
	/** The previous visit's stages (absent on the first visit — nothing
	 *  animates then). */
	previous?: Record<string, GardenStage>;
	/** Settled items in already-extracted messages that no link covers yet
	 *  — the backfill button shows while this is above zero. */
	unlinked: number;
	/** A linking run is in flight (the backfill, or the post-extraction step). */
	linking: boolean;
}

export function stageRank(stage: GardenStage): number {
	return GARDEN_STAGES.indexOf(stage);
}
