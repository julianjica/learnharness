/** Read-time API-dollar estimates. Pi owns both rates and arithmetic.
 * Catalog resolution is key-independent; no provider dispatch/auth is needed.
 * Never mutate saved native messages: calculateCost mutates its usage.cost.
 */
import { calculateCost, type Usage } from "@earendil-works/pi-ai";
import { piModels } from "../agent/models.ts";
import type { CallUsage, ChatRecord, JobRecord, TurnUsage } from "../core/contracts.ts";
import { isSubscriptionModel, planCatalogModel, sessionCost as foldSessionCost, turnCost as foldTurnCost, turnEstimate, jobCost as foldJobCost } from "../core/prices.ts";

function catalogModel(id: string) {
	const colon = id.indexOf(":");
	if (colon < 0 || isSubscriptionModel(id)) return undefined;
	return piModels().getModel(id.slice(0, colon), id.slice(colon + 1));
}

export function callCost(call: Partial<CallUsage>, modelId: string): number | null {
	const model = catalogModel(modelId);
	if (!model || call.inputTokens === undefined || call.outputTokens === undefined) return null;
	const input = call.inputTokens;
	const output = call.outputTokens;
	const cacheRead = call.cacheReadTokens ?? 0;
	const cacheWrite = call.cacheWriteTokens ?? 0;
	const cacheWrite1h = call.cacheWrite1hTokens ?? 0;
	if ([input, output, cacheRead, cacheWrite, cacheWrite1h].some((v) => !Number.isFinite(v) || v < 0) || cacheWrite1h > cacheWrite) return null;
	// Old records discarded this split. Only price them if it cannot affect
	// the result; do not invent short-retention precision from a missing field.
	if (cacheWrite > 0 && call.cacheWrite1hTokens === undefined &&
		[model.cost, ...(model.cost.tiers ?? [])].some((rate) => rate.cacheWrite !== 2 * rate.input)) return null;
	const usage: Usage = {
		input, output, cacheRead, cacheWrite, cacheWrite1h,
		totalTokens: input + output + cacheRead + cacheWrite,
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
	};
	const total = calculateCost(model, usage).total;
	return Number.isFinite(total) && total >= 0 ? total : null;
}

export function turnCost(turn: TurnUsage): number | null {
	return foldTurnCost(turn, callCost);
}
export function sessionCost(record: Pick<ChatRecord, "turns">) {
	return foldSessionCost(record, callCost);
}
export function jobCost(job: Pick<JobRecord, "usage">): number | null {
	const usage = job.usage;
	if (!usage || usage.steps < 1) return null;
	const hasCalls = usage.calls?.length === usage.steps;
	if (!hasCalls && usage.steps > 1 && catalogModel(usage.model)?.cost.tiers?.length) return null;
	return foldJobCost(job, callCost);
}

/** A plan-engine job priced at its catalog twin's API rates (≈, read-time,
 *  never stored or added to real spend). Same safety rule as jobCost. */
export function jobEstimate(job: Pick<JobRecord, "usage">): number | null {
	const usage = job.usage;
	const catalog = planCatalogModel(usage?.model);
	if (!usage || !catalog || usage.steps < 1) return null;
	if (usage.calls && usage.calls.length === usage.steps) return turnEstimate({ model: usage.model, steps: usage.calls }, callCost);
	if (usage.steps > 1 && catalogModel(catalog)?.cost.tiers?.length) return null;
	return callCost(usage, catalog);
}
