"use client";
/**
 * Plan usage limits of the local-CLI engines (docs/claude-code-engine.md,
 * docs/codex-engine.md, "Plan limits") — shared by the stats-bar popover
 * and Settings → Providers. The server reads the signed-in CLIs (no tokens
 * spent) and caches for a minute; this file only fetches and draws.
 */
import { useCallback, useEffect, useState } from "react";
import type { PlanEngineId, PlanLimitsSnapshot, PlanLimitWindow } from "@/src/core";
import { Button } from "@/components/ui/button";

/** "resets 6:10 PM" within a day, "resets Mon 9:00 AM" within a week, else a date. */
export function formatReset(resetsAt: number | null, now = Date.now()): string {
	if (resetsAt === null) return "";
	const date = new Date(resetsAt);
	const ms = resetsAt - now;
	if (ms <= 24 * 3600_000) return `resets ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
	if (ms <= 7 * 24 * 3600_000) return `resets ${date.toLocaleDateString([], { weekday: "short" })} ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
	return `resets ${date.toLocaleDateString([], { month: "short", day: "numeric" })}`;
}

export function usePlanLimits(enabled: boolean, reloadKey: unknown = 0) {
	const [plans, setPlans] = useState<PlanLimitsSnapshot[] | null>(null);
	const [loading, setLoading] = useState(false);
	const load = useCallback(async (refresh = false) => {
		setLoading(true);
		try {
			const res = await fetch(`/api/plan-limits${refresh ? "?refresh=1" : ""}`);
			const body = (await res.json()) as { plans?: PlanLimitsSnapshot[] };
			setPlans(Array.isArray(body.plans) ? body.plans : []);
		} catch {
			setPlans([]);
		} finally {
			setLoading(false);
		}
	}, []);
	useEffect(() => {
		if (enabled) void load();
	}, [enabled, load, reloadKey]);
	return { plans, loading, refresh: () => load(true) };
}

function WindowRow({ window: w }: { window: PlanLimitWindow }) {
	const pct = Math.max(0, Math.min(100, w.usedPercent));
	return (
		<div data-testid={`plan-window-${w.id}`} className="flex flex-col gap-0.5">
			<div className="flex justify-between gap-2">
				<span>{w.label}</span>
				<span className="tabular-nums text-card-foreground">
					{Math.round(w.usedPercent)}%{w.resetsAt !== null ? ` · ${formatReset(w.resetsAt)}` : ""}
				</span>
			</div>
			<div className="h-1 overflow-hidden rounded-full bg-muted">
				<div className={pct >= 90 ? "h-full bg-destructive" : "h-full bg-foreground/60"} style={{ width: `${pct}%` }} />
			</div>
		</div>
	);
}

/** The windows of each plan (filtered to `engines` when given). */
export function PlanLimitsList({ plans, engines }: { plans: PlanLimitsSnapshot[] | null; engines?: readonly PlanEngineId[] }) {
	if (plans === null) return <div className="text-muted-foreground">Reading plan limits…</div>;
	const shown = engines ? plans.filter((p) => engines.includes(p.engine)) : plans;
	if (shown.length === 0) return <div className="text-muted-foreground">No local plan CLI found.</div>;
	return (
		<div className="flex flex-col gap-2.5">
			{shown.map((plan) => (
				<div key={plan.engine} data-testid={`plan-limits-${plan.engine}`} className="flex flex-col gap-1.5">
					<div className="flex justify-between gap-2 text-card-foreground">
						<span>{plan.label}</span>
						{plan.planType && <span className="text-muted-foreground">{plan.planType}</span>}
					</div>
					{!plan.available ? (
						<div className="text-muted-foreground">Unavailable{plan.error ? `: ${plan.error}` : ""}</div>
					) : plan.windows.length === 0 ? (
						<div className="text-muted-foreground">No usage windows reported.</div>
					) : (
						plan.windows.map((w) => <WindowRow key={w.id} window={w} />)
					)}
					{plan.note && <div className="text-muted-foreground">{plan.note}</div>}
				</div>
			))}
		</div>
	);
}

/** Settings → Providers: both plans, with an explicit Refresh. */
export function PlanLimitsPanel() {
	const { plans, loading, refresh } = usePlanLimits(true);
	return (
		<div data-testid="plan-limits-panel" className="flex flex-col gap-2 text-xs text-muted-foreground">
			<p>Usage limits of the Claude Code and Codex CLIs signed in on this machine (read without spending tokens).</p>
			<PlanLimitsList plans={plans} />
			<div>
				<Button size="sm" variant="outline" disabled={loading} onClick={() => void refresh()} data-testid="plan-limits-refresh">
					{loading ? "Reading…" : "Refresh"}
				</Button>
			</div>
		</div>
	);
}
