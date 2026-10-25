/** Client-safe accounting folds. Rates and calculation live on the server,
 * using Pi's catalog and calculateCost; no copied pricing table lives here. */
import type { CallUsage, ChatRecord, JobRecord, TurnUsage } from "./contracts.ts";
import { NATIVE_SUBSCRIPTIONS } from "./contracts/subscriptions.ts";

export type CallPricer = (usage: Partial<CallUsage>, model: string) => number | null;
export interface SessionPricing {
	cost: number;
	unpriced: number;
	subscription?: number;
	subscriptionProviders?: string[];
	/** Derived at read time, keyed by the persisted turn's id. Never stored. */
	turnCosts: Record<string, number | null>;
	/** Local-CLI plan turns priced as if billed to the API (≈, never real
	 *  spend, never added to `cost`). Absent when no plan turn could be priced. */
	planEstimate?: number;
	turnEstimates?: Record<string, number | null>;
}

/** The local-CLI plan engines (docs/claude-code-engine.md,
 *  docs/codex-engine.md): the logical provider, its label, and the catalog
 *  provider that sells the same model on the API — the basis of the ≈
 *  API-equivalent estimate. */
export const PLAN_ENGINES = [
	{ provider: "claude-code", label: "Claude plan", catalogProvider: "anthropic" },
	{ provider: "codex", label: "ChatGPT plan", catalogProvider: "openai-codex" },
] as const;

function planEngine(model: string | undefined) {
	return PLAN_ENGINES.find((engine) => model?.startsWith(`${engine.provider}:`));
}

/** "claude-code:claude-opus-5-5" → "anthropic:claude-opus-5-5"; undefined
 *  for anything that is not a plan engine's model. */
export function planCatalogModel(model: string | undefined): string | undefined {
	const engine = planEngine(model);
	return engine ? `${engine.catalogProvider}:${model!.slice(engine.provider.length + 1)}` : undefined;
}

export function isChatGPTPlan(model: string | undefined): boolean {
	return model?.startsWith("chatgpt:") === true;
}
export function subscriptionLabel(model: string | undefined): string | undefined {
	if (isChatGPTPlan(model)) return "ChatGPT";
	const plan = planEngine(model);
	if (plan) return plan.label;
	return NATIVE_SUBSCRIPTIONS.find((p) => model?.startsWith(`${p.logicalId}:`))?.label;
}
export function isSubscriptionModel(model: string | undefined): boolean { return subscriptionLabel(model) !== undefined; }
export function subscriptionLabels(models: readonly (string | undefined)[]): string[] {
	return [...new Set(models.flatMap((model) => { const label = subscriptionLabel(model); return label ? [label] : []; }))];
}

/** Absent stays absent. Long-cache precision is unknown if any write-bearing
 * step lacks the split; never silently turn that missing detail into zero. */
export function sumSteps(steps: readonly CallUsage[]): CallUsage {
	const sumIfAny = (vals: (number | undefined)[]): number | undefined =>
		vals.every((v) => v === undefined) ? undefined : vals.reduce<number>((a, v) => a + (v ?? 0), 0);
	return {
		inputTokens: sumIfAny(steps.map((s) => s.inputTokens)),
		outputTokens: sumIfAny(steps.map((s) => s.outputTokens)),
		cacheReadTokens: sumIfAny(steps.map((s) => s.cacheReadTokens)),
		cacheWriteTokens: sumIfAny(steps.map((s) => s.cacheWriteTokens)),
		cacheWrite1hTokens: steps.some((s) => (s.cacheWriteTokens ?? 0) > 0 && s.cacheWrite1hTokens === undefined)
			? undefined : sumIfAny(steps.map((s) => s.cacheWrite1hTokens)),
		reasoningTokens: sumIfAny(steps.map((s) => s.reasoningTokens)),
	};
}

export function turnCost(turn: Pick<TurnUsage, "model" | "steps">, price: CallPricer): number | null {
	if (isSubscriptionModel(turn.model) || turn.steps.length === 0) return null;
	let total = 0;
	for (const step of turn.steps) {
		const cost = price(step, turn.model);
		if (cost === null) return null;
		total += cost;
	}
	return total;
}

/** A plan turn priced at its catalog twin's API rates (≈); null when the
 *  turn is not a plan turn or any step cannot be priced. */
export function turnEstimate(turn: Pick<TurnUsage, "model" | "steps">, price: CallPricer): number | null {
	const catalog = planCatalogModel(turn.model);
	if (!catalog || turn.steps.length === 0) return null;
	let total = 0;
	for (const step of turn.steps) {
		const cost = price(step, catalog);
		if (cost === null) return null;
		total += cost;
	}
	return total;
}

export function sessionCost(record: Pick<ChatRecord, "turns">, price: CallPricer): SessionPricing {
	let cost = 0;
	let unpriced = 0;
	let subscription = 0;
	let planEstimate: number | undefined;
	const turnCosts: Record<string, number | null> = {};
	const turnEstimates: Record<string, number | null> = {};
	for (const turn of record.turns ?? []) {
		const dollars = turnCost(turn, price);
		turnCosts[turn.id] = dollars;
		if (planCatalogModel(turn.model)) {
			const estimate = turnEstimate(turn, price);
			turnEstimates[turn.id] = estimate;
			if (estimate !== null) planEstimate = (planEstimate ?? 0) + estimate;
		}
		if (isSubscriptionModel(turn.model)) subscription++;
		else if (dollars === null) unpriced++;
		else cost += dollars;
	}
	return {
		cost, unpriced,
		...(subscription ? { subscription, subscriptionProviders: subscriptionLabels((record.turns ?? []).map((turn) => turn.model)) } : {}),
		turnCosts,
		...(planEstimate === undefined ? {} : { planEstimate, turnEstimates }),
	};
}

export function jobCost(job: Pick<JobRecord, "usage">, price: CallPricer): number | null {
	const usage = job.usage;
	if (!usage || isSubscriptionModel(usage.model)) return null;
	if (usage.calls && usage.calls.length === usage.steps) {
		return turnCost({ model: usage.model, steps: usage.calls }, price);
	}
	// An old one-call job is fully reconstructible from its total. For a
	// multi-call job, the server resolver decides whether aggregate pricing
	// is safe for this model (tiered models need the lost per-call sizes).
	return price(usage, usage.model);
}
