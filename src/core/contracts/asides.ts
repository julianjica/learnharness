/**
 * Asides — side questions while a check or problem waits (owner design
 * 2026-10-26, docs/architecture.md "Asides").
 *
 * The learner asks; a single model call answers right away in a side
 * thread; the pending check (or active practice problem) never moves.
 * Undelivered asides sit on the record (`ChatRecord.pendingAsides`, keyed
 * by the anchor call id) until the learner's next input reaches the main
 * agent: a check's answer/dismissal carries them (`QuestionAnswerData.asides`),
 * a practice input is preceded by an `aside` marker. Every field is
 * OPTIONAL and additive — records written before asides load unchanged,
 * and the schema version does not move.
 */

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
}

/** An aside not yet delivered to the main agent. */
export interface PendingAside extends Aside {
	/** The pending question's (or active problem's) tool call id. */
	anchorId: string;
}
