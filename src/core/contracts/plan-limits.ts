/** Client-safe plan usage-limit snapshots for the local-CLI engines
 *  (docs/claude-code-engine.md, docs/codex-engine.md, "Plan limits").
 *  Read from the signed-in CLI; never credentials, never estimates. */

export type PlanEngineId = "claude-code" | "codex";

export interface PlanLimitWindow {
	/** Stable key, e.g. "five_hour", "seven_day_opus", "primary". */
	id: string;
	/** Display label, e.g. "5-hour", "Weekly · Opus". */
	label: string;
	/** 0–100, as the provider reports it. */
	usedPercent: number;
	/** ms epoch; null when the provider gave no reset time. */
	resetsAt: number | null;
}

export interface PlanLimitsSnapshot {
	engine: PlanEngineId;
	/** "Claude plan" / "ChatGPT plan" (prices.ts PLAN_ENGINES). */
	label: string;
	/** False when the CLI is missing, signed out, or reports no plan limits. */
	available: boolean;
	/** The provider's plan name ("max", "edu_plus", …), when reported. */
	planType: string | null;
	windows: PlanLimitWindow[];
	/** One extra line (extra usage / credits), when reported. */
	note?: string;
	/** Why the snapshot is unavailable (the CLI's own text). */
	error?: string;
	/** ms epoch of the reading. */
	fetchedAt: number;
}
