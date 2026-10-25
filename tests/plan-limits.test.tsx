/**
 * Plan usage limits + API-equivalent estimates for the local-CLI engines
 * (docs/claude-code-engine.md, docs/codex-engine.md, "Plan limits").
 * Pure folds and parsers against the payload shapes the real CLIs
 * returned live; the reader seam replaces the CLIs. No network.
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { Api, Model } from "@earendil-works/pi-ai";
import { planCatalogModel, subscriptionLabel, isSubscriptionModel } from "../src/core/prices.ts";
import { graphCostSummary } from "../src/core/cost-summary.ts";
import { callCost, jobEstimate, sessionCost } from "../src/server/pricing.ts";
import { planCostLabel, turnCostLabel } from "../components/usage-format.ts";
import { StatsBar } from "../components/stats-bar.tsx";
import { PlanLimitsList } from "../components/plan-limits.tsx";
import { claudeLimitsFrom, codexLimitsFrom, planLimits, planLimitsRuntime, recordCodexRateLimits, resetPlanLimits } from "../src/agent/plan-limits.ts";
import { CodexAgent } from "../src/agent/codex/agent.ts";
import type { PlanLimitsSnapshot, TurnUsage } from "../src/core/index.ts";
import { fakeCodex, newCodexLog } from "./fixtures/fake-codex.ts";

const step = (inputTokens: number, outputTokens: number) => ({ inputTokens, outputTokens, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: undefined });
const turn = (id: string, model: string): TurnUsage => ({ id, messageId: `m-${id}`, at: "2026-10-25T12:00:00Z", model, steps: [step(10_000, 1_000)] });

// What the real CLIs answered live (2026-10-25), trimmed.
const CODEX_LIVE = { limitId: "codex", limitName: null, primary: { usedPercent: 12, windowDurationMins: 10080, resetsAt: 1793567974 }, secondary: { usedPercent: 40, windowDurationMins: 300, resetsAt: 1793000000 }, credits: { hasCredits: true, unlimited: false, balance: null }, planType: "edu_plus" };
const CLAUDE_LIVE = { subscription_type: "max", rate_limits_available: true, rate_limits: { five_hour: { utilization: 20, resets_at: "2026-10-25T22:09:59.882917+00:00" }, seven_day: null, seven_day_opus: { utilization: 55, resets_at: "2026-10-30T10:00:00Z" }, model_scoped: [{ display_name: "Fable", utilization: 5, resets_at: null }], extra_usage: { is_enabled: false, monthly_limit: null, used_credits: null } } };

afterEach(() => {
	planLimitsRuntime.fetchers = {};
	planLimitsRuntime.available = undefined;
	resetPlanLimits();
});

describe("plan engines in the money channel", () => {
	it("labels plan models and maps them to their catalog twins", () => {
		assert.equal(subscriptionLabel("claude-code:claude-opus-5-5"), "Claude plan");
		assert.equal(subscriptionLabel("codex:gpt-5.6-sol"), "ChatGPT plan");
		assert.equal(isSubscriptionModel("codex:gpt-5.6-sol"), true);
		assert.equal(planCatalogModel("claude-code:claude-opus-5-5"), "anthropic:claude-opus-5-5");
		assert.equal(planCatalogModel("codex:gpt-5.6-sol"), "openai-codex:gpt-5.6-sol");
		assert.equal(planCatalogModel("anthropic:claude-opus-5-5"), undefined);
	});

	it("estimates plan turns at API rates, never adding them to real dollars", () => {
		const api = turn("a", "anthropic:claude-opus-5-5");
		const plan = turn("p", "claude-code:claude-opus-5-5");
		const codex = turn("c", "codex:gpt-5.6-sol");
		const pricing = sessionCost({ turns: [api, plan, codex] });
		const apiDollars = callCost(api.steps[0]!, "anthropic:claude-opus-5-5")!;
		const codexDollars = callCost(codex.steps[0]!, "openai-codex:gpt-5.6-sol")!;
		assert.ok(apiDollars > 0 && codexDollars > 0);
		assert.equal(pricing.cost, apiDollars, "real dollars hold only the API turn");
		assert.equal(pricing.unpriced, 0, "plan turns are not 'unpriced'");
		assert.equal(pricing.subscription, 2);
		assert.deepEqual(pricing.subscriptionProviders, ["Claude plan", "ChatGPT plan"]);
		assert.equal(pricing.turnCosts.p, null);
		assert.equal(pricing.turnEstimates!.p, apiDollars, "same model, same tokens → same API price");
		assert.equal(pricing.turnEstimates!.c, codexDollars);
		assert.ok(Math.abs(pricing.planEstimate! - (apiDollars + codexDollars)) < 1e-12);
	});

	it("omits the estimate when the catalog twin has no price (never a fake $0)", () => {
		const pricing = sessionCost({ turns: [turn("x", "claude-code:not-a-real-model")] });
		assert.equal(pricing.planEstimate, undefined);
		assert.equal(pricing.subscription, 1);
	});

	it("estimates plan jobs and graph pipeline stages the same way", () => {
		const usage = { model: "codex:gpt-5.6-luna", steps: 1, ...step(5_000, 500) };
		assert.equal(jobEstimate({ usage } as never), callCost(usage, "openai-codex:gpt-5.6-luna"));
		assert.equal(jobEstimate({ usage: { ...usage, model: "anthropic:claude-opus-5-5" } } as never), null);
		const summary = graphCostSummary({ chats: [{ title: "c", extractions: [{ startedAt: 1, at: "x", durationMs: 1, stages: { extractor: { model: "claude-code:claude-haiku-5-5", steps: [step(1000, 100)] }, auditor: { model: "claude-code:claude-haiku-5-5", steps: [step(1000, 100)] } } } as never] }], sources: [] }, callCost);
		assert.equal(summary.totalDollars, 0);
		assert.ok((summary.estimate ?? 0) > 0);
		assert.equal(summary.runs[0]!.estimate, summary.estimate);
		assert.equal(summary.unpricedRuns, 0);
	});

	it("formats estimates apart from real spend, marked ≈", () => {
		assert.equal(planCostLabel(0.12, ["Claude plan"], (v) => `$${v.toFixed(2)}`, 0.4), "$0.12 + Claude plan ≈$0.40");
		assert.equal(planCostLabel(null, ["Claude plan"], (v) => `$${v.toFixed(2)}`, 0.4), "Claude plan ≈$0.40");
		assert.equal(planCostLabel(null, ["Claude plan"], undefined, null), "Claude plan");
		assert.equal(turnCostLabel("Claude plan", null, 0.03), "Claude plan · ≈$0.0300");
		assert.equal(turnCostLabel(undefined, 0.5, null), "$0.5000");
		assert.equal(turnCostLabel(undefined, null), "—");
	});

	it("the stats bar shows the plan label with its estimate", () => {
		const turns = [turn("p", "claude-code:claude-opus-5-5")];
		const html = renderToStaticMarkup(<StatsBar chatId="c" turns={turns} contextTokens={11_000} pricing={sessionCost({ turns })} />);
		assert.match(html, /data-testid="stats-cost">Claude plan ≈\$\d/);
	});
});

describe("plan limit parsing", () => {
	it("reads Codex's rate-limit snapshot (windows labelled from their duration)", () => {
		const s = codexLimitsFrom(CODEX_LIVE);
		assert.equal(s.available, true);
		assert.equal(s.label, "ChatGPT plan");
		assert.equal(s.planType, "edu_plus");
		assert.deepEqual(s.windows, [
			{ id: "primary", label: "Weekly", usedPercent: 12, resetsAt: 1793567974000 },
			{ id: "secondary", label: "5-hour", usedPercent: 40, resetsAt: 1793000000000 },
		]);
		assert.equal(codexLimitsFrom(null).available, false);
	});

	it("reads Claude Code's usage response, skipping windows it did not report", () => {
		const s = claudeLimitsFrom(CLAUDE_LIVE);
		assert.equal(s.available, true);
		assert.equal(s.label, "Claude plan");
		assert.equal(s.planType, "max");
		assert.deepEqual(s.windows.map((w) => [w.id, w.label, w.usedPercent]), [["five_hour", "5-hour", 20], ["seven_day_opus", "Weekly · Opus", 55], ["model:Fable", "Weekly · Fable", 5]]);
		assert.equal(s.windows[0]!.resetsAt, Date.parse("2026-10-25T22:09:59.882917+00:00"));
		assert.equal(claudeLimitsFrom({ rate_limits_available: false, rate_limits: null, subscription_type: null }).available, false, "API-key sign-in → unavailable");
		assert.equal(claudeLimitsFrom("garbage").available, false, "an unknown shape degrades, never throws");
	});

	it("renders windows, and the CLI's reason when unavailable", () => {
		const plans: PlanLimitsSnapshot[] = [claudeLimitsFrom(CLAUDE_LIVE), { ...codexLimitsFrom(null), error: "Not logged in" }];
		const html = renderToStaticMarkup(<PlanLimitsList plans={plans} />);
		assert.match(html, /data-testid="plan-window-five_hour"/);
		assert.match(html, /20%/);
		assert.match(html, /Unavailable: Not logged in/);
		const onlyClaude = renderToStaticMarkup(<PlanLimitsList plans={plans} engines={["claude-code"]} />);
		assert.ok(!onlyClaude.includes("plan-limits-codex"));
	});
});

describe("plan limit reads", () => {
	it("caches a minute, re-reads when stale or forced, and degrades on errors", async () => {
		let claudeReads = 0;
		planLimitsRuntime.available = () => true;
		planLimitsRuntime.fetchers = {
			"claude-code": async () => { claudeReads++; return claudeLimitsFrom(CLAUDE_LIVE); },
			codex: async () => { throw new Error("Codex CLI not found"); },
		};
		const first = await planLimits();
		assert.equal(claudeReads, 1);
		assert.deepEqual(first.map((p) => [p.engine, p.available]), [["claude-code", true], ["codex", false]]);
		assert.equal(first[1]!.error, "Codex CLI not found");
		await planLimits();
		assert.equal(claudeReads, 1, "a fresh snapshot comes from the cache");
		await planLimits(0);
		assert.equal(claudeReads, 2, "maxAge 0 forces a reading");
		await Promise.all([planLimits(0), planLimits(0)]);
		assert.equal(claudeReads, 3, "concurrent reads share one CLI call");
	});

	it("omits engines whose CLI is not installed", async () => {
		planLimitsRuntime.available = (engine) => engine === "codex";
		planLimitsRuntime.fetchers = { codex: async () => codexLimitsFrom(CODEX_LIVE) };
		assert.deepEqual((await planLimits()).map((p) => p.engine), ["codex"]);
	});

	it("a Codex run's account/rateLimits/updated keeps the snapshot live (no extra read)", async () => {
		let reads = 0;
		planLimitsRuntime.available = (engine) => engine === "codex";
		planLimitsRuntime.fetchers = { codex: async () => { reads++; return codexLimitsFrom(null); } };
		const model = { id: "gpt-5.6-sol", api: "openai-codex-responses", provider: "codex", cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } } as unknown as Model<Api>;
		const agent = new CodexAgent({ systemPrompt: "s", model, tools: [], messages: [{ role: "user", content: "hi", timestamp: 1 } as AgentMessage], connect: fakeCodex([{ text: "Hello." }], newCodexLog(), { rateLimits: CODEX_LIVE }) });
		await agent.continue();
		const [codex] = await planLimits();
		assert.equal(reads, 0);
		assert.equal(codex!.windows[0]!.usedPercent, 12);
		recordCodexRateLimits({ ...CODEX_LIVE, primary: { ...CODEX_LIVE.primary, usedPercent: 13 } });
		assert.equal((await planLimits())[0]!.windows[0]!.usedPercent, 13);
	});
});
