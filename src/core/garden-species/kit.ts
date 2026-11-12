/**
 * The garden's drawing kit (owner design, 2026-11-11): every species is a
 * small flat illustration in one shared style. All drawings live in one
 * 80×96 cell with the ground line at y = 88 and the root at x = 40; the kit
 * draws the soil mound and the seed, species draw sprout, leafy and bloom.
 *
 * Style: flat fills, no gradients, no outlines; thin darker strokes only
 * for midribs, veins and stems. Markup only, no ids, <defs> or masks (many
 * plants share one page). A cut-out (split leaf, hole) is painted in CUT,
 * the bed's background colour.
 */
import type { GardenStage } from "../contracts/garden.ts";

export type GrowingStage = Exclude<GardenStage, "seed">;

export interface Species {
	/** Stable kebab-case id, e.g. "japanese-maple". */
	id: string;
	/** Display name, e.g. "Japanese maple". */
	name: string;
	/** SVG markup for the plant at this stage (soil and seed are the kit's). */
	draw(stage: GrowingStage): string;
}

export const CELL = { width: 80, height: 96, ground: 88, root: 40 } as const;

/** The bed's background, for cut-outs. */
export const CUT = "var(--lh-garden-cut)";

/** Shared greens: leaf, darker (stems, ribs), lighter (highlights, young). */
export const GREEN = { leaf: "#6fb35a", dark: "#3f7a35", light: "#8cc46a" } as const;
export const BARK = "#8a6242";

/** Round to one decimal for compact markup. */
export const f = (n: number): string => (Math.round(n * 10) / 10).toString();

export function soil(): string {
	return `<ellipse cx="40" cy="89" rx="20" ry="5" fill="#7a5a3e"/><ellipse cx="40" cy="87.6" rx="17" ry="3" fill="#94704f"/>`;
}

export function seed(): string {
	return `<ellipse cx="40" cy="84.5" rx="3.6" ry="5" fill="#c08a52" transform="rotate(18 40 84.5)"/><ellipse cx="39" cy="83" rx="1.1" ry="2" fill="#e6b98a" transform="rotate(18 40 84.5)"/>`;
}

/** Leaf outlines pointing along +x from the origin: 0 oval, 1 pointed, 2 round, 3 needle, 4 heart. */
export function leafPath(len: number, w: number, shape: 0 | 1 | 2 | 3 | 4 = 0): string {
	switch (shape) {
		case 1:
			return `M0 0C${f(len * 0.45)} ${f(-w * 1.15)} ${f(len * 0.8)} ${f(-w * 0.5)} ${f(len)} 0C${f(len * 0.8)} ${f(w * 0.5)} ${f(len * 0.45)} ${f(w * 1.15)} 0 0Z`;
		case 2:
			return `M0 0C${f(len * 0.05)} ${f(-w * 1.4)} ${f(len * 1.02)} ${f(-w * 1.3)} ${f(len)} 0C${f(len * 1.02)} ${f(w * 1.3)} ${f(len * 0.05)} ${f(w * 1.4)} 0 0Z`;
		case 3:
			return `M0 ${f(-w * 0.5)}L${f(len)} 0L0 ${f(w * 0.5)}Z`;
		case 4:
			return `M0 0C${f(len * 0.1)} ${f(-w * 1.6)} ${f(len * 0.75)} ${f(-w * 1.2)} ${f(len)} 0C${f(len * 0.75)} ${f(w * 1.2)} ${f(len * 0.1)} ${f(w * 1.6)} 0 0Z`;
		default:
			return `M0 0C${f(len * 0.3)} ${f(-w)} ${f(len * 0.8)} ${f(-w)} ${f(len)} 0C${f(len * 0.8)} ${f(w)} ${f(len * 0.3)} ${f(w)} 0 0Z`;
	}
}

export interface LeafOptions {
	fill?: string;
	/** Midrib colour. */
	dark?: string;
	shape?: 0 | 1 | 2 | 3 | 4;
	/** Draw the midrib (default true). */
	rib?: boolean;
}

/** One leaf at (x, y), pointing at `angle` degrees (0 = right, -90 = up). */
export function leaf(x: number, y: number, angle: number, len: number, w: number, o: LeafOptions = {}): string {
	const { fill = GREEN.leaf, dark = GREEN.dark, shape = 0, rib = true } = o;
	const ribPath = rib ? `<path d="M1 0L${f(len * 0.8)} 0" stroke="${dark}" stroke-width=".9" stroke-linecap="round" opacity=".55"/>` : "";
	return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(angle)})"><path d="${leafPath(len, w, shape)}" fill="${fill}"/>${ribPath}</g>`;
}

export type Pt = readonly [number, number];

/** A point on a cubic Bézier at t. */
export function bez(p: readonly [Pt, Pt, Pt, Pt], t: number): [number, number] {
	const u = 1 - t;
	const at = (i: 0 | 1) => u * u * u * p[0][i] + 3 * u * u * t * p[1][i] + 3 * u * t * t * p[2][i] + t * t * t * p[3][i];
	return [at(0), at(1)];
}

/** A cubic stem as a stroked path. */
export function stem(p: readonly [Pt, Pt, Pt, Pt], stroke: string = GREEN.dark, width = 2.4): string {
	const [a, b, c, d] = p;
	return `<path d="M${f(a[0])} ${f(a[1])}C${f(b[0])} ${f(b[1])} ${f(c[0])} ${f(c[1])} ${f(d[0])} ${f(d[1])}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round"/>`;
}

/** A straight stroked segment with round caps. */
export function line(x1: number, y1: number, x2: number, y2: number, stroke: string, width: number): string {
	return `<path d="M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" fill="none"/>`;
}

/** n ellipse petals of radii (rx, ry) whose centres sit r from (x, y). */
export function petals(x: number, y: number, n: number, r: number, rx: number, ry: number, fill: string, offsetDeg = 0): string {
	let s = "";
	for (let i = 0; i < n; i++) {
		s += `<ellipse cx="${f(r)}" cy="0" rx="${f(rx)}" ry="${f(ry)}" fill="${fill}" transform="translate(${f(x)} ${f(y)}) rotate(${f(offsetDeg + (i * 360) / n)})"/>`;
	}
	return s;
}

export function circle(x: number, y: number, r: number, fill: string, opacity?: number): string {
	return `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${fill}"${opacity === undefined ? "" : ` opacity="${opacity}"`}/>`;
}

/** A grass blade from the ground at x0 to the tip (tx, ty). */
export function blade(x0: number, tx: number, ty: number, fill: string = GREEN.leaf, width = 1.6): string {
	const my = (87 + ty) / 2;
	return `<path d="M${f(x0 - width)} 87Q${f(x0 - 1)} ${f(my)} ${f(tx)} ${f(ty)}Q${f(x0 + 2.5)} ${f(my)} ${f(x0 + width)} 87Z" fill="${fill}"/>`;
}

/** A fern frond from (x, y) heading `deg`, curling by `bend` degrees, with leaflets up to `leaflet` long. */
export function frond(x: number, y: number, deg: number, len: number, bend: number, leaflet: number, colors: { rib?: string; a?: string; b?: string } = {}): string {
	const { rib = GREEN.dark, a: ca = GREEN.light, b: cb = GREEN.leaf } = colors;
	const n = 12;
	const step = len / n;
	let a = (deg * Math.PI) / 180;
	let px = x;
	let py = y;
	let d = `M${f(x)} ${f(y)}`;
	let ls = "";
	for (let j = 1; j <= n; j++) {
		a += (bend * Math.PI) / 180 / n;
		px += Math.cos(a) * step;
		py += Math.sin(a) * step;
		d += `L${f(px)} ${f(py)}`;
		if (j >= 2 && j < n) {
			const l = (1 - j / n) * leaflet + 2;
			const ad = (a * 180) / Math.PI;
			ls += leaf(px, py, ad - 62, l, l * 0.33, { fill: ca, rib: false }) + leaf(px, py, ad + 62, l, l * 0.33, { fill: cb, rib: false });
		}
	}
	return `<path d="${d}" stroke="${rib}" stroke-width="1.4" fill="none" stroke-linecap="round"/>` + ls;
}

/** The full cell for a species at a stage: soil, then seed or plant. */
export function drawCell(species: Species, stage: GardenStage): string {
	return soil() + (stage === "seed" ? seed() : species.draw(stage));
}
