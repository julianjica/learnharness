/**
 * The garden's plant geometry (owner design, 2026-11-11): every concept is
 * a small L-system plant drawn by lindsvg. The concept's id picks the
 * species (grammar, branching angle, flower hue); its stage picks how many
 * times the grammar is rewritten, so a plant visibly grows as it moves up
 * the ladder:
 *
 *   seed    a seed in a small mound (no grammar)
 *   sprout  2 rewrites — a young stem
 *   leafy   3 rewrites — branches with leaves at the tips
 *   bloom   4 rewrites — leaves plus flowers at the tips
 *
 * One fixed scale per species (fitted to its bloom height), so a sprout is
 * genuinely smaller than a bloom. Pure and memoized: same input, same
 * geometry, on server and client.
 */
import { getSVGData } from "lindsvg";
import type { GardenStage } from "@/src/core";

interface Species {
	axiom: string;
	rules: Record<string, string>;
	/** Branching angle, degrees (each plant jitters it by its id). */
	theta: number;
}

const SPECIES: readonly Species[] = [
	{ axiom: "X", rules: { X: "F[+X][-X]FX", F: "FF" }, theta: 25.7 },
	{ axiom: "X", rules: { X: "F-[[X]+X]+F[+FX]-X", F: "FF" }, theta: 22.5 },
	{ axiom: "X", rules: { X: "F[+X]F[-X]+X", F: "FF" }, theta: 20 },
	{ axiom: "F", rules: { F: "F[+F]F[-F][F]" }, theta: 22 },
];

/** Rewrites per stage (seed draws no grammar). */
const ITERATIONS: Record<Exclude<GardenStage, "seed">, number> = { sprout: 2, leafy: 3, bloom: 4 };

/** The cell every plant is drawn in (viewBox units); ground at the bottom. */
export const PLANT_BOX = { width: 80, height: 96, ground: 88 } as const;
/** A bloom fills this much of the cell's height above the ground. */
const BLOOM_HEIGHT = 78;

/** FNV-1a: a stable small hash of the concept id. */
function hash(id: string): number {
	let h = 0x811c9dc5;
	for (let i = 0; i < id.length; i++) {
		h ^= id.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	return h >>> 0;
}

export interface PlantGeometry {
	/** Stem path data per branching level, trunk first (in cell units). */
	stems: string[];
	/** Branch tips: where leaves (leafy, bloom) and flowers (bloom) sit. */
	tips: Array<{ x: number; y: number }>;
	/** Which of the four flower tokens this plant blooms in. */
	flowerHue: number;
	/** Leaf tilt, degrees, per tip (deterministic). */
	tilt: number[];
}

interface RawLs {
	paths: string[];
	minX: number;
	minY: number;
	width: number;
	height: number;
}

function runLs(species: Species, theta: number, iterations: number): RawLs {
	const data = getSVGData(
		{
			axiom: species.axiom,
			rules: species.rules as never,
			alpha: Math.PI / 2, // grow upward (lindsvg: negative y is up)
			theta: (theta * Math.PI) / 180,
			step: 1,
			iterations,
		},
		{ isMultiPath: true },
	);
	return { paths: data.pathData, minX: data.minX, minY: data.minY, width: data.width, height: data.height };
}

const NUM = /-?\d+(?:\.\d+)?(?:e-?\d+)?/g;

/** Rescale "Mx yLx y…" path data about the origin, then translate. */
function transformPath(d: string, k: number, dx: number, dy: number): string {
	let i = 0;
	return d.replace(NUM, (n) => {
		const v = Number(n) * k + (i++ % 2 === 0 ? dx : dy);
		return (Math.round(v * 100) / 100).toString();
	});
}

/** Branch tips: each subpath ("Mx yLx y x y…", a polyline) ends at its
 *  LAST point; a tip is an end that starts no other subpath. */
function tipsOf(paths: readonly string[]): Array<{ x: number; y: number }> {
	const starts = new Set<string>();
	const ends: Array<{ x: number; y: number }> = [];
	for (const d of paths) {
		for (const seg of d.split("M").filter(Boolean)) {
			const nums = (seg.match(NUM) ?? []).map(Number);
			if (nums.length < 4) continue;
			starts.add(`${nums[0]} ${nums[1]}`);
			ends.push({ x: nums[nums.length - 2]!, y: nums[nums.length - 1]! });
		}
	}
	const seen = new Set<string>();
	return ends.filter((p) => {
		const key = `${p.x} ${p.y}`;
		if (starts.has(key) || seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

const cache = new Map<string, PlantGeometry>();

export function plantGeometry(nodeId: string, stage: GardenStage): PlantGeometry {
	const key = `${nodeId}:${stage}`;
	const hit = cache.get(key);
	if (hit) return hit;
	const h = hash(nodeId);
	const species = SPECIES[h % SPECIES.length]!;
	const theta = species.theta + (((h >>> 8) % 7) - 3); // ±3°
	const flowerHue = (h >>> 16) % 4;
	let geometry: PlantGeometry;
	if (stage === "seed") {
		geometry = { stems: [], tips: [], flowerHue, tilt: [] };
	} else {
		// One scale per species: fitted to the bloom so younger stages are smaller.
		const bloom = runLs(species, theta, ITERATIONS.bloom);
		const k = BLOOM_HEIGHT / Math.max(bloom.height, 1);
		const raw = stage === "bloom" ? bloom : runLs(species, theta, ITERATIONS[stage]);
		const dx = PLANT_BOX.width / 2; // the root (0,0) sits mid-cell on the ground
		const dy = PLANT_BOX.ground;
		// Keep wide plants inside the cell: shrink only when they overflow.
		const spread = Math.max(Math.abs(bloom.minX), Math.abs(bloom.minX + bloom.width)) * k;
		const fit = spread > PLANT_BOX.width / 2 - 4 ? (PLANT_BOX.width / 2 - 4) / spread : 1;
		const scale = k * fit;
		const stems = raw.paths.map((d) => transformPath(d, scale, dx, dy));
		const tips = tipsOf(stems);
		const tilt = tips.map((_, i) => ((hash(`${nodeId}#${i}`) % 70) - 35));
		geometry = { stems, tips, flowerHue, tilt };
	}
	cache.set(key, geometry);
	return geometry;
}
