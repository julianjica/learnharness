"use client";

/**
 * The garden page (owner design, 2026-11-11 — src/core/contracts/garden.ts):
 * one bed per birth session, one L-system plant per concept, grown only by
 * the learner's own evidence. Plants that moved up a stage since the last
 * visit grow in (≈1.5 s; none under reduced motion) under a one-line
 * "since your last visit" summary. Hover → name, stage, what grew it;
 * click → the concept selected in the graph view (/?node=<id>). Never shown
 * inside a session.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/top-bar";
import { useServerEvent, useServerResync } from "@/components/server-events";
import { PLANT_BOX, plantGeometry } from "@/components/garden-plant";
import { stageRank, type GardenBed, type GardenPayload, type GardenPlant, type GardenStage } from "@/src/core";

const STAGE_LABEL: Record<GardenStage, string> = { seed: "Seed", sprout: "Sprout", leafy: "Leafy", bloom: "Bloom" };
const STAGE_PLURAL: Record<GardenStage, [string, string]> = {
	seed: ["new seed", "new seeds"],
	sprout: ["sprout", "sprouts"],
	leafy: ["leafy plant", "leafy plants"],
	bloom: ["bloom", "blooms"],
};

/** The plants that grew since the previous visit, by their new stage. */
export function growthSince(beds: readonly GardenBed[], previous: Record<string, GardenStage> | undefined): Map<string, GardenStage> {
	const out = new Map<string, GardenStage>();
	if (!previous) return out;
	for (const bed of beds) {
		for (const plant of bed.plants) {
			const before = previous[plant.nodeId];
			if (before === undefined || stageRank(plant.stage) > stageRank(before)) out.set(plant.nodeId, plant.stage);
		}
	}
	return out;
}

/** "Since your last visit: 3 sprouts · 1 bloom" (null when nothing grew). */
export function growthLine(grown: ReadonlyMap<string, GardenStage>): string | null {
	if (grown.size === 0) return null;
	const counts = new Map<GardenStage, number>();
	for (const stage of grown.values()) counts.set(stage, (counts.get(stage) ?? 0) + 1);
	const parts = (["seed", "sprout", "leafy", "bloom"] as const)
		.filter((s) => counts.has(s))
		.map((s) => `${counts.get(s)} ${STAGE_PLURAL[s][counts.get(s) === 1 ? 0 : 1]}`);
	return `Since your last visit: ${parts.join(" · ")}`;
}

function evidenceLines(plant: GardenPlant): string[] {
	const e = plant.evidence;
	const lines: string[] = [];
	if (e.rightChecks) lines.push(`${e.rightChecks} right check${e.rightChecks === 1 ? "" : "s"}`);
	if (e.solvedAlone) lines.push(`${e.solvedAlone} solved on your own`);
	if (e.solvedWithHelp) lines.push(`${e.solvedWithHelp} solved with hints`);
	if (e.worked) lines.push(`${e.worked} worked through`);
	if (lines.length === 0) lines.push("Taught — not practised yet");
	return lines;
}

/** One plant in its cell. `grow` animates it in from nothing. */
export function Plant({ plant, grow }: { plant: Pick<GardenPlant, "nodeId" | "stage">; grow: boolean }) {
	const g = plantGeometry(plant.nodeId, plant.stage);
	const leafy = plant.stage === "leafy" || plant.stage === "bloom";
	// Airy, not a hedge: at most ~22 leaves, sampled evenly over the tips.
	const leafStep = Math.max(1, Math.ceil(g.tips.length / 22));
	const flowers = plant.stage === "bloom" ? g.tips.filter((_, i) => i % Math.max(1, Math.round(g.tips.length / 7)) === 0) : [];
	const anim = grow ? " lh-garden-grow" : "";
	return (
		<svg
			viewBox={`0 0 ${PLANT_BOX.width} ${PLANT_BOX.height}`}
			width={PLANT_BOX.width}
			height={PLANT_BOX.height}
			aria-hidden
			className="block overflow-visible"
		>
			<ellipse cx={PLANT_BOX.width / 2} cy={PLANT_BOX.ground + 1.5} rx={plant.stage === "seed" ? 9 : 14} ry={3} className="fill-[var(--lh-garden-soil)]" />
			{plant.stage === "seed" ? (
				<ellipse
					cx={PLANT_BOX.width / 2}
					cy={PLANT_BOX.ground - 2}
					rx={2.6}
					ry={1.8}
					className={`fill-[var(--lh-garden-seed)]${anim}`}
					style={{ transformOrigin: `${PLANT_BOX.width / 2}px ${PLANT_BOX.ground}px` }}
				/>
			) : null}
			{g.stems.map((d, level) => (
				<path
					key={level}
					d={d}
					pathLength={1}
					fill="none"
					strokeLinecap="round"
					strokeWidth={Math.max(0.6, 1.8 - level * 0.35)}
					className={`stroke-[var(--lh-garden-stem)]${grow ? " lh-garden-draw" : ""}`}
					style={grow ? { animationDelay: `${level * 0.25}s` } : undefined}
				/>
			))}
			{leafy
				? g.tips.map((t, i) => i % leafStep !== 0 ? null : (
						<g
							key={`l${i}`}
							className={grow ? "lh-garden-grow" : undefined}
							style={grow ? { transformOrigin: `${t.x}px ${t.y}px`, animationDelay: "0.9s" } : undefined}
						>
							{/* The tilt stays an attribute on the leaf; the grow-in scales the
							    wrapper (a CSS origin on the rotated leaf would shift it). */}
							<ellipse
								cx={t.x}
								cy={t.y}
								rx={2.4}
								ry={1.1}
								transform={`rotate(${g.tilt[i] ?? 0} ${t.x} ${t.y})`}
								className="fill-[var(--lh-garden-leaf)]"
							/>
						</g>
					))
				: null}
			{flowers.map((t, i) => (
				<g
					key={`f${i}`}
					className={grow ? "lh-garden-grow" : undefined}
					style={{ transformOrigin: `${t.x}px ${t.y}px`, ...(grow ? { animationDelay: "1.2s" } : {}) }}
				>
					{[0, 72, 144, 216, 288].map((a) => (
						<circle
							key={a}
							cx={t.x + 1.9 * Math.cos((a * Math.PI) / 180)}
							cy={t.y + 1.9 * Math.sin((a * Math.PI) / 180)}
							r={1.5}
							style={{ fill: `var(--lh-garden-flower-${g.flowerHue + 1})` }}
						/>
					))}
					<circle cx={t.x} cy={t.y} r={1} className="fill-[var(--lh-garden-flower-heart)]" />
				</g>
			))}
		</svg>
	);
}

export function GardenView({ initial }: { initial?: GardenPayload }) {
	const router = useRouter();
	const [payload, setPayload] = useState<GardenPayload | null>(initial ?? null);
	const [grown, setGrown] = useState<Map<string, GardenStage>>(() => new Map());
	const [hover, setHover] = useState<{ plant: GardenPlant; x: number; y: number } | null>(null);
	const [linkError, setLinkError] = useState<string | null>(null);
	const containerRef = useRef<HTMLDivElement | null>(null);

	const load = useCallback(async () => {
		try {
			const res = await fetch("/api/garden", { cache: "no-store" });
			if (!res.ok) return;
			const next = (await res.json()) as GardenPayload;
			setPayload(next);
			const growth = growthSince(next.beds, next.previous);
			// Animate what grew (merged: a live refetch never cancels a grow-in).
			if (growth.size > 0) setGrown((prev) => new Map([...prev, ...growth]));
			// The learner has now seen this state: it is the next baseline.
			if (growth.size > 0 || !next.previous) void fetch("/api/garden/visit", { method: "POST" }).catch(() => {});
		} catch {
			// offline / server restarting: keep what is on screen
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	// Growth lands after extraction and linking runs: refetch when they move.
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const scheduleLoad = useCallback(() => {
		if (timer.current) clearTimeout(timer.current);
		timer.current = setTimeout(() => void load(), 250);
	}, [load]);
	useEffect(() => () => {
		if (timer.current) clearTimeout(timer.current);
	}, []);
	useServerEvent("activity-changed", scheduleLoad);
	useServerEvent("turn-settled", scheduleLoad);
	useServerResync(scheduleLoad);

	const line = useMemo(() => growthLine(grown), [grown]);
	const total = payload?.beds.reduce((n, b) => n + b.plants.length, 0) ?? 0;

	const linkPast = async () => {
		setLinkError(null);
		const res = await fetch("/api/garden/link", { method: "POST" }).catch(() => null);
		if (!res || (!res.ok && res.status !== 409)) setLinkError("Couldn't start linking. Check the server log.");
		scheduleLoad();
	};

	return (
		<div className="flex h-full min-h-0 flex-col">
			<TopBar>
				<h1 className="font-title text-3xl tracking-tight">Garden</h1>
				{payload ? (
					<span className="text-xs text-muted-foreground">
						{total} concept{total === 1 ? "" : "s"}
					</span>
				) : null}
			</TopBar>
			<div ref={containerRef} className="relative min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-8">
				{line ? <p className="mb-4 text-sm text-muted-foreground" data-testid="garden-growth">{line}</p> : null}
				{payload && payload.linking ? (
					<p className="mb-4 text-sm text-muted-foreground">Linking past checks to concepts…</p>
				) : payload && payload.unlinked > 0 ? (
					<div className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-border px-3 py-2 text-sm">
						<span className="text-muted-foreground">
							{payload.unlinked} past check{payload.unlinked === 1 ? "" : "s"} and problem{payload.unlinked === 1 ? "" : "s"} haven't been linked to concepts yet.
						</span>
						<button
							type="button"
							onClick={() => void linkPast()}
							className="rounded-md bg-accent px-2.5 py-1 text-xs text-accent-foreground transition-colors hover:bg-accent/70"
						>
							Link past checks
						</button>
						{linkError ? <span className="text-xs text-destructive">{linkError}</span> : null}
					</div>
				) : null}
				{payload && payload.beds.length === 0 ? (
					<p className="mt-16 text-center text-sm text-muted-foreground">
						Your garden is empty. Concepts appear here as seeds once a session&apos;s explanations have been extracted.
					</p>
				) : null}
				<div className="flex flex-col gap-5">
					{payload?.beds.map((bed) => (
						<section key={bed.id} className="rounded-lg border border-border bg-card/40 px-3 pb-1 pt-2" data-testid="garden-bed">
							<h2 className="mb-1 truncate text-xs uppercase tracking-wider text-muted-foreground">{bed.label}</h2>
							<div className="flex flex-wrap">
								{bed.plants.map((plant) => (
									<button
										key={plant.nodeId}
										type="button"
										aria-label={`${plant.name} — ${STAGE_LABEL[plant.stage]}`}
										data-stage={plant.stage}
										className="rounded-md transition-colors hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:outline-none"
										onMouseEnter={(e) => {
											const box = containerRef.current?.getBoundingClientRect();
											const r = e.currentTarget.getBoundingClientRect();
											if (!box) return;
											setHover({
												plant,
												x: r.left - box.left + r.width / 2,
												y: r.top - box.top + (containerRef.current?.scrollTop ?? 0),
											});
										}}
										onMouseLeave={() => setHover(null)}
										onClick={() => router.push(`/?node=${encodeURIComponent(plant.nodeId)}`)}
									>
										<Plant plant={plant} grow={grown.has(plant.nodeId)} />
									</button>
								))}
							</div>
						</section>
					))}
				</div>
				{hover ? (
					<div
						role="tooltip"
						className="pointer-events-none absolute z-10 w-56 -translate-x-1/2 -translate-y-full rounded-md border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md"
						style={{ left: hover.x, top: hover.y - 6 }}
					>
						<div className="mb-1 text-sm font-medium leading-snug">{hover.plant.name}</div>
						<div className="mb-1 text-muted-foreground">{STAGE_LABEL[hover.plant.stage]}</div>
						{evidenceLines(hover.plant).map((l) => (
							<div key={l}>{l}</div>
						))}
					</div>
				) : null}
			</div>
		</div>
	);
}
