/**
 * Asides — side questions while a check or problem waits (owner design
 * 2026-10-26, docs/architecture.md "Asides").
 *
 * The learner asks; the session's own agent (teacher or practitioner)
 * answers right away in a side turn run on an out-of-band copy of the
 * record (owner, 2026-11-03 — src/server/aside.ts); the pending check (or
 * active practice problem) never moves and the record gains no messages.
 * Undelivered asides sit on the record (`ChatRecord.pendingAsides`, keyed
 * by the anchor call id) until the learner's next input reaches the main
 * agent: a check's answer/dismissal carries them (`QuestionAnswerData.asides`),
 * a practice input is preceded by an `aside` marker. Every field is
 * OPTIONAL and additive — records written before asides load unchanged,
 * and the schema version does not move.
 */

import type { PlanTree } from "./plan.ts";

/** A plan rewrite the teacher made while answering (its side-turn
 *  `plan_init`): the tree was saved at once; this copy lets the plan
 *  window show it before delivery and tells the teacher after. */
export interface AsidePlanRevision {
	mermaid: string;
	tree: PlanTree;
}

/** A background job the side turn dispatched (research / pdf); its result
 *  steers into the lesson like any job's. */
export interface AsideJob {
	tool: string;
	jobId: string;
}

/** One side question and its answer. */
export interface Aside {
	/** Stable id ("aside_…") — the delivery fold keys on it. */
	id: string;
	question: string;
	answer: string;
	/** ISO time the answer completed. */
	at: string;
	/** The answering model, provider-qualified ("provider:id"). */
	model?: string;
	planRevision?: AsidePlanRevision;
	jobs?: AsideJob[];
}

/** An aside not yet delivered to the main agent. */
export interface PendingAside extends Aside {
	/** The pending question's (or active problem's) tool call id. */
	anchorId: string;
}
