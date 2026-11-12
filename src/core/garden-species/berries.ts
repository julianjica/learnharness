/**
 * Berries and fruit shrubs: 25 species in the garden's flat style (see
 * kit.ts). Each grows from a seedling (sprout) to a young bush in leaf or
 * flower (leafy) to its signature fullest form (bloom): the ripe fruit on
 * the plant's own habit, from creeping mats to trained canes and small trees.
 */
import { bez, f, type GrowingStage, type Pt, type Species } from "./kit";

/* ---------------- private helpers ---------------- */

type Pal = readonly string[];
type XY = readonly [number, number];
type Bz = readonly [Pt, Pt, Pt, Pt];
type Shape = 0 | 1 | 2 | 3 | 4;
type Phase = "leafy" | "bloom";

const at = (a: Pal, i: number): string => a[((i % a.length) + a.length) % a.length] ?? a[0] ?? "";
const F = (c: string, o?: number): string => `fill="${c}"${o === undefined ? "" : ` opacity="${o}"`}`;
const K = (c: string, w: number): string => `stroke="${c}" stroke-width="${w}" fill="none" stroke-linecap="round"`;
/** A round dot of radius r as a zero-length round-capped stroke. */
const R = (c: string, r: number, o?: number): string => `stroke="${c}" stroke-width="${f(r * 2)}" stroke-linecap="round"${o === undefined ? "" : ` opacity="${o}"`}`;
const D = (x: number, y: number): string => `M${f(x)} ${f(y)}h0`;
const rad = (deg: number): number => (deg * Math.PI) / 180;

/** Drops redundant characters from path data. */
const tight = (d: string): string => d.replace(/(^|[^\d.])0\./g, "$1.").replace(/ -/g, "-");

/** Rewrites absolute moves as relative ones where the current point is known (after Z, a dot or a line). */
function chain(d: string): string {
	let cur: [number, number] | null = null;
	let out = "";
	for (const sub of d.split(/(?=M)/)) {
		const m = /^M(-?[\d.]+) (-?[\d.]+)/.exec(sub);
		if (!m) {
			out += sub;
			cur = null;
			continue;
		}
		const x = Number(m[1]);
		const y = Number(m[2]);
		const rest = sub.slice(m[0].length);
		const relm = cur ? `m${f(x - cur[0])} ${f(y - cur[1])}` : "";
		out += cur && relm.length < m[0].length ? relm + rest : sub;
		const L = /^L(-?[\d.]+) (-?[\d.]+)$/.exec(rest);
		cur = rest.endsWith("Z") || rest === "h0" ? [x, y] : L ? [Number(L[1]), Number(L[2])] : null;
	}
	return out;
}

/** Merges path data per attribute set into one <path> each, in first-seen order. */
class Ink {
	private parts = new Map<string, string>();
	add(attrs: string, d: string): this {
		this.parts.set(attrs, (this.parts.get(attrs) ?? "") + d);
		return this;
	}
	toString(): string {
		return [...this.parts].map(([a, d]) => `<path d="${tight(chain(d))}" ${a}/>`).join("");
	}
}

/** Ellipse subpath (two arcs), optionally rotated. */
function E(x: number, y: number, rx: number, ry: number, rot = 0): string {
	const r = rad(rot);
	const dx = Math.cos(r) * rx;
	const dy = Math.sin(r) * rx;
	const a = `a${f(rx)} ${f(ry)} ${f(rot)} 1 0`;
	return `M${f(x - dx)} ${f(y - dy)}${a} ${f(2 * dx)} ${f(2 * dy)}${a} ${f(-2 * dx)} ${f(-2 * dy)}Z`;
}

/** Coarser rounding for long relative offsets (a unit is under a pixel in a bed). */
const q = (n: number): string => (Math.abs(n) >= 5 ? String(Math.round(n)) : f(n));

const SHAPES = { 0: [0.3, 1, 0.8, 1], 2: [0.05, 1.4, 1.02, 1.3], 4: [0.1, 1.6, 0.75, 1.2] } as const;

/** Leaf outline subpath (kit shapes 0 oval, 1 pointed, 2 round, 3 needle, 4 heart) from (x, y) heading deg. */
function leafD(x: number, y: number, deg: number, len: number, w: number, shape: Shape = 1): string {
	const c = Math.cos(rad(deg));
	const s = Math.sin(rad(deg));
	const rel = (u: number, v: number) => `${q(c * u - s * v)} ${q(s * u + c * v)}`;
	if (shape === 3) return `M${f(x - s * w * 0.5)} ${f(y + c * w * 0.5)}l${rel(len, -w * 0.5)}l${rel(-len, -w * 0.5)}Z`;
	if (shape === 1) return `M${f(x)} ${f(y)}q${rel(len * 0.45, -w * 1.25)} ${rel(len, 0)}q${rel(-len * 0.55, w * 1.25)} ${rel(-len, 0)}Z`;
	const [a, b, cc, d] = SHAPES[shape];
	return `M${f(x)} ${f(y)}c${rel(len * a, -w * b)} ${rel(len * cc, -w * d)} ${rel(len, 0)}c${rel(len * (cc - 1), w * d)} ${rel(len * (a - 1), w * b)} ${rel(-len, 0)}Z`;
}

/** A palmate leaf with n lobes around (x, y), opening toward deg. */
function palmD(x: number, y: number, r: number, n: number, deg: number, inner = 0.5, spread = 230): string {
	const start = deg - spread / 2;
	const step = spread / (n - 1);
	const pts: [number, number][] = [];
	const pt = (a: number, rr: number) => pts.push([x + Math.cos(rad(a)) * rr, y + Math.sin(rad(a)) * rr]);
	pt(deg + 180, r * 0.15);
	for (let i = 0; i < n; i++) {
		if (i > 0) pt(start + step * (i - 0.5), r * inner);
		pt(start + step * i, r);
	}
	return rel(pts);
}

/** A leaf with n rounded (scalloped) lobes around (x, y), opening toward deg. */
function scallopD(x: number, y: number, r: number, n: number, deg: number, inner = 0.6, spread = 260): string {
	const start = deg - spread / 2;
	const step = spread / (n - 1);
	const pt = (a: number, rr: number) => `${f(x + Math.cos(rad(a)) * rr)} ${f(y + Math.sin(rad(a)) * rr)}`;
	let d = `M${pt(deg + 180, r * 0.15)}L${pt(start - step * 0.5, r * inner * 0.6)}`;
	for (let i = 0; i < n; i++) d += `Q${pt(start + step * i, r * 1.28)} ${pt(start + step * (i + 0.5), i === n - 1 ? r * inner * 0.6 : r * inner)}`;
	return d + "Z";
}

/** A scalloped leaf whose stalk end sits at (x, y), heading deg. */
const scallopOn = (x: number, y: number, deg: number, r: number, n = 5, inner = 0.6): string =>
	scallopD(x + Math.cos(rad(deg)) * r * 0.85, y + Math.sin(rad(deg)) * r * 0.85, r, n, deg, inner, n === 3 ? 200 : 250);

/** A closed polygon in relative lineto commands (compact). */
function rel(pts: readonly XY[]): string {
	const r = pts.map(([x, y]) => [Math.round(x * 10), Math.round(y * 10)] as const);
	const [x0, y0] = r[0] ?? [0, 0];
	let d = `M${f(x0 / 10)} ${f(y0 / 10)}l`;
	for (let i = 1; i < r.length; i++) {
		const [px, py] = r[i - 1] ?? [0, 0];
		const [qx, qy] = r[i] ?? [0, 0];
		d += `${q((qx - px) / 10)} ${q((qy - py) / 10)} `;
	}
	return d.trimEnd() + "Z";
}

/** A lobed leaf whose stalk end sits at (x, y), heading deg. */
const lobeD = (x: number, y: number, deg: number, r: number, n = 5, inner = 0.5): string =>
	palmD(x + Math.cos(rad(deg)) * r * 0.8, y + Math.sin(rad(deg)) * r * 0.8, r, n, deg, inner);

const seg = (x1: number, y1: number, x2: number, y2: number): string => `M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}`;
const bzD = (b: Bz): string => `M${f(b[0][0])} ${f(b[0][1])}C${f(b[1][0])} ${f(b[1][1])} ${f(b[2][0])} ${f(b[2][1])} ${f(b[3][0])} ${f(b[3][1])}`;

/** Tangent direction of a cubic at t, in degrees. */
function ang(b: Bz, t: number): number {
	const [x1, y1] = bez(b, Math.max(0, t - 0.02));
	const [x2, y2] = bez(b, Math.min(1, t + 0.02));
	return (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
}

/** Calls fn at n evenly spaced points of a cubic between t0 and t1. */
function each(b: Bz, n: number, t0: number, t1: number, fn: (x: number, y: number, a: number, i: number) => void): void {
	for (let i = 0; i < n; i++) {
		const t = n === 1 ? t1 : t0 + ((t1 - t0) * i) / (n - 1);
		const [x, y] = bez(b, t);
		fn(x, y, ang(b, t), i);
	}
}

/** Points spread evenly over an ellipse (sunflower spiral). */
function scatter(cx: number, cy: number, rx: number, ry: number, n: number): [number, number][] {
	const out: [number, number][] = [];
	for (let i = 0; i < n; i++) {
		const a = i * 2.39996;
		const r = Math.sqrt((i + 0.5) / n);
		out.push([cx + Math.cos(a) * r * rx, cy + Math.sin(a) * r * ry]);
	}
	return out;
}

/** Leaves pointing outward over an ellipse; `droop` bends them down. */
function crown(k: Ink, cx: number, cy: number, rx: number, ry: number, n: number, leafAt: (x: number, y: number, a: number, i: number) => void, droop = 0): void {
	scatter(cx, cy, rx, ry, n).forEach(([x, y], i) => {
		let a = Math.atan2((y - cy) / ry, (x - cx) / rx) + rad(((i * 53) % 50) - 25);
		a = (Math.atan2(Math.sin(a) + droop, Math.cos(a)) * 180) / Math.PI;
		leafAt(x, y, a, i);
	});
}

/** A shiny round berry. */
function berry(fr: Ink, sh: Ink, x: number, y: number, r: number, col: string, shine = 0.5): void {
	fr.add(R(col, r), D(x, y));
	if (shine > 0) sh.add(R("#fff", r * 0.3, shine), D(x - r * 0.38, y - r * 0.38));
}

/** An aggregate (bramble) fruit: a base ellipse covered in drupelet dots. */
function drupe(fr: Ink, x: number, y: number, rx: number, ry: number, base: string, dot: string, rot = 0): void {
	fr.add(F(base), E(x, y, rx, ry, rot));
	const n = Math.max(5, Math.round(rx * ry * 0.85));
	const c = Math.cos(rad(rot));
	const s = Math.sin(rad(rot));
	let d = "";
	for (const [u, v] of scatter(0, 0, rx * 0.7, ry * 0.72, n)) d += D(x + c * u - s * v, y + s * u + c * v);
	fr.add(R(dot, Math.min(rx, ry) * 0.27), d);
}

/** A hanging stalk from (x, y) with n berries along its lower part (a currant string). */
function strand(st: Ink, fr: Ink, sh: Ink, x: number, y: number, len: number, sway: number, n: number, r: number, cols: Pal, stalk = "#6e7a3a"): void {
	const b: Bz = [[x, y], [x + sway, y + len * 0.3], [x + sway, y + len * 0.7], [x + sway * 0.5, y + len]];
	st.add(K(stalk, 0.6), bzD(b));
	for (let i = 0; i < n; i++) {
		const [px, py] = bez(b, 0.3 + (0.7 * i) / Math.max(1, n - 1));
		berry(fr, sh, px + (i % 2 ? 0.7 : -0.7), py, r, at(cols, i));
	}
}

/** Five round petals around a centre, as round-capped strokes. */
function blossom(k: Ink, x: number, y: number, r: number, petal: string, centre: string, off = 0, n = 5): void {
	let d = "";
	for (let i = 0; i < n; i++) {
		const t = rad(off + (i * 360) / n - 90);
		d += `M${f(x)} ${f(y)}l${f(Math.cos(t) * r * 0.55)} ${f(Math.sin(t) * r * 0.55)}`;
	}
	k.add(R(petal, r * 0.45), d).add(R(centre, r * 0.28), D(x, y));
}

/** A hanging urn or bell flower with its mouth down. */
function bell(k: Ink, x: number, y: number, r: number, col: string, mouth: string): void {
	k.add(R(col, r * 0.85), `M${f(x)} ${f(y - r * 0.15)}v${f(r * 0.3)}`).add(R(mouth, r * 0.32), D(x, y + r * 0.85));
}

/** An oblong berry as a round-capped stroke: top at (x, y), length l, radius r, leaning by dx. */
const capsule = (k: Ink, x: number, y: number, l: number, r: number, col: string, dx = 0): Ink => k.add(R(col, r), `M${f(x)} ${f(y + r)}l${f(dx)} ${f(l - 2 * r)}`);

/** Scales markup about the root by s. */
const grow = (s: number, m: string): string => `<g transform="matrix(${s} 0 0 ${s} ${f(40 * (1 - s))} ${f(88 * (1 - s))})">${m}</g>`;

interface SeedOpts {
	h: number;
	a: string;
	b: string;
	stem?: string;
	shape?: Shape;
	len?: number;
	w?: number;
	/** Lobed true leaves with this many lobes. */
	lobed?: number;
	/** Extra pairs of leaves below the top. */
	pairs?: number;
}

/** A seedling: stem, two round seed leaves and a pair of true leaves on top. */
function seedling(o: SeedOpts): string {
	const { h, a, b, stem = "#4f7a3a", shape = 1, len = 6, w = 2.6, lobed = 0, pairs = 0 } = o;
	const k = new Ink();
	const top = 87 - h;
	k.add(K(stem, 1.4), seg(40, 87, 40, top));
	const cy = 87 - h * 0.35;
	k.add(F(b), leafD(40, cy, -165, len * 0.6, w * 0.75, 2) + leafD(40, cy, -15, len * 0.6, w * 0.75, 2));
	for (let i = 0; i < pairs; i++) {
		const y = top + (cy - top) * ((i + 1) / (pairs + 1));
		k.add(F(a), leafD(40, y, -150, len * 0.8, w * 0.85, shape) + leafD(40, y, -30, len * 0.8, w * 0.85, shape));
	}
	if (lobed) k.add(F(a), lobeD(40, top, -130, len * 0.6, lobed, 0.55) + lobeD(40, top, -50, len * 0.6, lobed, 0.55));
	else k.add(F(a), leafD(40, top, -125, len, w, shape) + leafD(40, top, -55, len, w, shape) + leafD(40, top, -90, len * 0.6, w * 0.7, shape));
	return `${k}`;
}

function make(id: string, name: string, sprout: SeedOpts, plant: (p: Phase) => string, leafyScale = 0.66): Species {
	return {
		id,
		name,
		draw(stage: GrowingStage): string {
			if (stage === "sprout") return seedling(sprout);
			if (stage === "leafy") return grow(leafyScale, plant("leafy"));
			return plant("bloom");
		},
	};
}

/** Draws canes with a stroke and returns them. */
function canes(k: Ink, list: readonly Bz[], col: string, w: number): readonly Bz[] {
	k.add(K(col, w), list.map(bzD).join(""));
	return list;
}

/* ---------------- species ---------------- */

function redCurrant(p: Phase): string {
	const k = new Ink();
	const st = new Ink();
	const fr = new Ink();
	const sh = new Ink();
	const g = ["#4f8f3f", "#67a64f", "#3f7a36"] as const;
	const cs = canes(k, [
		[[38, 87], [35, 70], [26, 50], [16, 28]],
		[[39, 87], [37, 66], [33, 44], [31, 18]],
		[[41, 87], [42, 64], [46, 42], [50, 16]],
		[[42, 87], [46, 68], [56, 48], [65, 28]],
	], "#8a6a4a", 1.9);
	cs.forEach((b, j) => each(b, 6, 0.22, 1, (x, y, a, i) => k.add(F(at(g, i + j)), lobeD(x, y, i === 5 ? a : a + (i % 2 ? 62 : -62), 4.8, 5, 0.64))));
	cs.forEach((b, j) =>
		each(b, 3, 0.36, 0.82, (x, y, _a, i) =>
			p === "bloom"
				? strand(st, fr, sh, x, y, 13, (i + j) % 2 ? 1.8 : -1.8, 6, 1.6, ["#d81d2e", "#e8384a"])
				: strand(st, fr, sh, x, y, 9, (i + j) % 2 ? 1.2 : -1.2, 6, 0.9, ["#c9c76a", "#b9bd5a"]),
		),
	);
	return `${k}${st}${fr}${sh}`;
}

function blackcurrant(p: Phase): string {
	const k = new Ink();
	const st = new Ink();
	const fr = new Ink();
	const sh = new Ink();
	const g = ["#2f5e30", "#3d7339", "#4c8642"] as const;
	canes(k, [
		[[38, 87], [32, 76], [24, 68], [18, 60]],
		[[39, 87], [37, 72], [32, 56], [30, 42]],
		[[41, 87], [43, 72], [48, 56], [50, 42]],
		[[42, 87], [48, 76], [56, 68], [62, 60]],
	], "#5e4636", 2.2);
	k.add(F("#24482a"), E(40, 57, 23, 19));
	crown(k, 40, 57, 23, 19, 34, (x, y, a, i) => k.add(F(at(g, i)), lobeD(x, y, a, 5, 5, 0.66)));
	for (const [x, y] of scatter(40, 58, 19, 15, 9)) {
		if (p === "bloom") strand(st, fr, sh, x, y - 2, 8, x < 40 ? -1 : 1, 5, 1.9, ["#2a1b3a", "#3b2650", "#1e1428"], "#4a5a2a");
		else strand(st, fr, sh, x, y - 2, 6, x < 40 ? -1 : 1, 4, 0.9, ["#c9a36a", "#b9905a"], "#4a5a2a");
	}
	return `${k}${st}${fr}${sh}`;
}

function huckleberry(p: Phase): string {
	const k = new Ink();
	const st = new Ink();
	const fr = new Ink();
	const sh = new Ink();
	const g = ["#5c9a48", "#79b05a", "#5c9a48", "#b8503a"] as const;
	const cs = canes(k, [
		[[39, 87], [37, 66], [34, 42], [30, 14]],
		[[41, 87], [44, 66], [48, 44], [52, 16]],
		[[39, 87], [32, 72], [22, 60], [12, 44]],
		[[41, 87], [50, 74], [60, 62], [68, 46]],
		[[36, 60], [30, 54], [24, 38], [20, 28]],
		[[45, 56], [52, 50], [56, 38], [62, 28]],
	], "#8a3f34", 1.3);
	cs.forEach((b, j) => each(b, 7, 0.18, 1, (x, y, a, i) => k.add(F(at(g, i + j * 2)), leafD(x, y, i === 6 ? a : a + (i % 2 ? 55 : -55), 5.2, 2.2, 1))));
	cs.forEach((b, j) =>
		each(b, 4, 0.3, 0.85, (x, y, _a, i) => {
			const dx = (i + j) % 2 ? 1.6 : -1.6;
			st.add(K("#6a3a2a", 0.5), seg(x, y, x + dx, y + 3));
			if (p === "bloom") {
				berry(fr, sh, x + dx, y + 5, 2.1, (i + j) % 3 ? "#3a1f4c" : "#4f2a5e");
			} else bell(fr, x + dx, y + 4.4, 1.4, "#eab0b4", "#c46a74");
		}),
	);
	return `${k}${st}${fr}${sh}`;
}

function lingonberry(p: Phase): string {
	const k = new Ink();
	const st = new Ink();
	const fr = new Ink();
	const sh = new Ink();
	const g = ["#2c5a30", "#3c7038", "#2c5a30", "#4a7f40"] as const;
	const list: Bz[] = [];
	for (let i = 0; i < 7; i++) {
		const o = i - 3;
		const tx = 40 + o * 8.2;
		const ty = 52 + Math.abs(o) * 3.4;
		list.push([[40 + o * 1.4, 87], [40 + o * 2.6, 76], [tx - o * 0.6, ty + 10], [tx, ty]]);
	}
	const cs = canes(k, list, "#4a4a2e", 1.1);
	cs.forEach((b, j) => each(b, 7, 0.08, 0.92, (x, y, a, i) => k.add(F(at(g, i + j)), leafD(x, y, a + (i % 2 ? 58 : -58), 4, 2, 2))));
	cs.forEach((b, j) => {
		const [x, y] = bez(b, 1);
		if (p === "bloom") {
			if (j !== 1 && j !== 5) {
				st.add(K("#7a3a2a", 0.5), seg(x, y, x - 2, y + 3) + seg(x, y, x + 2, y + 3) + seg(x, y, x, y + 4.4));
				for (const [dx, dy] of [[-2.2, 4], [2.2, 4], [0, 6]] as const) berry(fr, sh, x + dx, y + dy, 2, j % 4 ? "#d41c2e" : "#c2142a");
			} else k.add(F(at(g, j)), leafD(x, y, -90, 3.6, 1.9, 2));
		} else {
			st.add(K("#8a4a3a", 0.5), seg(x, y, x + 1.6, y + 3));
			bell(fr, x + 1.6, y + 4.2, 1.4, "#f4c4d0", "#d77a92");
		}
	});
	return `${k}${st}${fr}${sh}`;
}

function cloudberry(p: Phase): string {
	const k = new Ink();
	const fr = new Ink();
	const g = ["#5f9a48", "#72ad55", "#4f8a3e"] as const;
	const leaves: [number, number, number][] = [[23, 66, -100], [57, 64, -80], [40, 74, -90]];
	k.add(K("#5a7a3a", 1.4), seg(40, 87, 23, 70) + seg(40, 87, 57, 68) + seg(40, 87, 40, 78));
	leaves.forEach(([x, y, a], i) => {
		k.add(F(at(g, i)), scallopD(x, y, 10.5, 5, a, 0.78, 280));
		let v = "";
		for (let j = 0; j < 5; j++) {
			const t = rad(a - 130 + j * 65);
			v += seg(x, y, x + Math.cos(t) * 9, y + Math.sin(t) * 9);
		}
		k.add(K("#3a6a30", 0.6), v);
	});
	if (p === "bloom") {
		k.add(K("#5a7a3a", 1.3), seg(40, 87, 41, 50));
		for (let j = 0; j < 5; j++) k.add(F("#5f8a3a"), leafD(41, 50, 20 + j * 35, 5, 1.6, 1));
		drupe(fr, 41, 44, 5.4, 6, "#e8962a", "#f7c45e");
		fr.add(F("#fff", 0.35), E(38.6, 41.5, 1.2, 2, 20));
	} else {
		k.add(K("#5a7a3a", 1.3), seg(40, 87, 41, 52));
		blossom(fr, 41, 48, 9, "#fbf8ef", "#e3c25a");
	}
	return `${k}${fr}`;
}

/** Three pointed leaflets from (x, y) heading a. */
function trifol(k: Ink, cols: Pal, x: number, y: number, a: number, len: number, w: number, i: number, shape: Shape = 1, under?: string): void {
	k.add(F(at(cols, i)), leafD(x, y, a, len, w, shape));
	k.add(F(under ?? at(cols, i + 1)), leafD(x, y, a - 50, len * 0.82, w * 0.9, shape) + leafD(x, y, a + 50, len * 0.82, w * 0.9, shape));
}

function boysenberry(p: Phase): string {
	const k = new Ink();
	const fr = new Ink();
	const sh = new Ink();
	const g = ["#4a8a40", "#5f9e4c", "#3d7a36"] as const;
	k.add(F("#9a7a58"), "M8.8 87V36h2.6V87ZM68.6 87V36h2.6V87Z").add(K("#b4ad9c", 0.7), seg(10, 40, 70, 40) + seg(10, 60, 70, 60));
	const cs = canes(k, [
		[[39, 87], [37, 72], [28, 62], [12, 60]],
		[[41, 87], [43, 72], [52, 62], [68, 60]],
		[[39, 87], [36, 58], [26, 42], [11, 40]],
		[[41, 87], [44, 58], [54, 42], [69, 40]],
	], "#6a3a3a", 1.7);
	cs.forEach((b, j) => each(b, 5, 0.3, 1, (x, y, a, i) => trifol(k, g, x, y, a + (i % 2 ? 70 : -70) * (j % 2 ? 1 : -1), 5, 2.1, i + j)));
	cs.forEach((b, j) =>
		each(b, 4, 0.42, 0.95, (x, y, _a, i) => {
			if (p === "bloom") {
				if ((i + j) % 4 === 1) drupe(fr, x, y + 4.2, 2.3, 3, "#b8303a", "#d8585e");
				else drupe(fr, x, y + 4.8, 2.7, 3.6, "#4a1430", "#7a2a52");
				sh.add(R("#fff", 0.6, 0.4), D(x - 1, y + 3));
			} else blossom(fr, x, y + 2.6, 4, "#f6e8ec", "#c8b06a", i * 20);
		}),
	);
	return `${k}${fr}${sh}`;
}

function loganberry(p: Phase): string {
	const k = new Ink();
	const fr = new Ink();
	const sh = new Ink();
	const g = ["#6aa84f", "#82bc62", "#579a44"] as const;
	k.add(F("#a8865c"), "M38.9 87V12h2.2V87Z");
	const ends: XY[] = [[10, 44], [16, 28], [28, 16], [52, 16], [64, 28], [70, 44]];
	const cs = canes(k, ends.map(([x, y]) => [[40, 86], [40 + (x - 40) * 0.2, 86 - (86 - y) * 0.4], [40 + (x - 40) * 0.7, 86 - (86 - y) * 0.75], [x, y]] as Bz), "#6e5a3a", 1.5);
	k.add(K("#d8cba8", 0.8), seg(38.4, 40, 41.6, 40) + seg(38.4, 60, 41.6, 60));
	cs.forEach((b, j) => each(b, 3, 0.4, 1, (x, y, a, i) => trifol(k, g, x, y, i === 2 ? a : a + (i % 2 ? 60 : -60), 5.4, 2.1, i + j)));
	cs.forEach((b, j) =>
		each(b, 3, 0.48, 0.88, (x, y, _a, i) => {
			if (p === "bloom") {
				drupe(fr, x, y + 5, 1.9, 4, (i + j) % 3 === 2 ? "#e0605a" : "#c4283a", "#e8525e", (j < 3 ? 8 : -8));
				sh.add(R("#fff", 0.5, 0.45), D(x - 0.8, y + 3));
			} else blossom(fr, x, y + 2.4, 3.6, "#fbf6f0", "#cdb86a", j * 15);
		}),
	);
	return `${k}${fr}${sh}`;
}

function goji(p: Phase): string {
	const k = new Ink();
	const st = new Ink();
	const fr = new Ink();
	const sh = new Ink();
	const g = ["#6f9a5a", "#88ad6c", "#5c8a4a"] as const;
	const cs = canes(k, [
		[[39, 87], [34, 48], [20, 26], [8, 54]],
		[[41, 87], [46, 48], [60, 26], [72, 54]],
		[[39, 87], [37, 46], [28, 18], [18, 34]],
		[[41, 87], [43, 46], [52, 18], [62, 34]],
		[[40, 87], [40, 50], [40, 24], [42, 12]],
	], "#a08a6a", 1.3);
	cs.forEach((b, j) => each(b, 10, 0.25, 1, (x, y, a, i) => k.add(F(at(g, i + j)), leafD(x, y, a + (i % 2 ? 50 : -50), 5.4, 1.3, 1))));
	cs.forEach((b, j) =>
		each(b, 4, 0.45, 0.92, (x, y, _a, i) => {
			if (p === "bloom" && (i + j) % 5 !== 3) {
				st.add(K("#6a7a3a", 0.5), seg(x, y, x, y + 2.6));
				capsule(fr, x, y + 2.4, 5.4, 1.4, (i + j) % 3 ? "#e2441c" : "#f0602a", (i + j) % 2 ? 0.8 : -0.8);
				sh.add(R("#fff", 0.4, 0.45), D(x - 0.5, y + 4));
			} else blossom(fr, x, y + 2.6, 3.4, "#8a5aa8", "#e8d8a0", i * 18);
		}),
	);
	return `${k}${st}${fr}${sh}`;
}

function seaBuckthorn(p: Phase): string {
	const k = new Ink();
	const fr = new Ink();
	const sh = new Ink();
	const g = ["#9fb3a0", "#c3cfc0", "#879d8a"] as const;
	const cs = canes(k, [
		[[38, 87], [36, 64], [26, 46], [17, 26]],
		[[40, 87], [40, 60], [38, 40], [40, 17]],
		[[42, 87], [44, 64], [54, 46], [63, 26]],
		[[37, 64], [32, 60], [24, 62], [12, 58]],
		[[43, 62], [48, 58], [58, 60], [68, 56]],
	], "#6e5a48", 1.8);
	cs.forEach((b, j) => each(b, 8, 0.6, 1, (x, y, a, i) => k.add(F(at(g, i + j)), leafD(x, y, i === 7 ? a : a + (i % 2 ? 40 : -40), 8, 1, 1))));
	if (p === "bloom")
		cs.forEach((b, j) =>
			each(b, 11, 0.12, 0.62, (x, y, a, i) => {
				const n = rad(a + 90);
				for (const sgn of [-1, 1]) berry(fr, sh, x + Math.cos(n) * 1.7 * sgn, y + Math.sin(n) * 1.7 * sgn, 1.6, (i + j + sgn) % 3 ? "#f0861a" : "#f6a63a", 0.35);
			}),
		);
	else cs.forEach((b, j) => each(b, 5, 0.3, 0.55, (x, y, a, i) => k.add(F(at(g, i + j)), leafD(x, y, a + (i % 2 ? 40 : -40), 7, 1, 1))));
	return `${k}${fr}${sh}`;
}

function honeyberry(p: Phase): string {
	const k = new Ink();
	const st = new Ink();
	const fr = new Ink();
	const sh = new Ink();
	const g = ["#5f9452", "#78aa62", "#4f8446"] as const;
	const cs = canes(k, [
		[[38, 87], [32, 74], [22, 64], [14, 52]],
		[[39, 87], [36, 70], [30, 50], [28, 34]],
		[[40, 87], [40, 66], [40, 44], [40, 24]],
		[[41, 87], [44, 70], [50, 50], [52, 34]],
		[[42, 87], [48, 74], [58, 64], [66, 52]],
	], "#8a6448", 1.6);
	cs.forEach((b, j) =>
		each(b, 5, 0.3, 1, (x, y, a, i) => {
			k.add(F(at(g, i + j)), leafD(x, y, a - 58, 6, 2.5, 0) + leafD(x, y, a + 58, 6, 2.5, 0));
			if (i === 4) k.add(F(at(g, i + j + 1)), leafD(x, y, a, 5, 2.2, 0));
		}),
	);
	cs.forEach((b, j) =>
		each(b, 3, 0.4, 0.85, (x, y, _a, i) => {
			if (p === "bloom") {
				st.add(K("#6a7a3a", 0.5), seg(x, y, x - 1.5, y + 2.4) + seg(x, y, x + 1.5, y + 2.4));
				for (const s of [-1, 1]) {
					capsule(fr, x + s * 1.6, y + 2, 7, 1.6, (i + j) % 3 ? "#3a4a8a" : "#33407a", s * 1);
					sh.add(R("#a8b4dc", 0.45, 0.6), `M${f(x + s * 1.6 - 0.5)} ${f(y + 3.8)}l${f(s * 0.3)} 2.4`);
				}
			} else {
				st.add(K("#efe4a0", 1.4), seg(x, y + 1, x - 1.6, y + 4.6) + seg(x, y + 1, x + 1.6, y + 4.6));
			}
		}),
	);
	return `${k}${st}${fr}${sh}`;
}

function blackChokeberry(p: Phase): string {
	const k = new Ink();
	const st = new Ink();
	const fr = new Ink();
	const sh = new Ink();
	const g = p === "bloom" ? (["#c23a2a", "#d9622c", "#a42a2e", "#e08a34", "#b84a2a"] as const) : (["#4f8a3e", "#64a04c", "#3f7a36"] as const);
	const cs = canes(k, [
		[[38, 87], [34, 70], [24, 52], [16, 38]],
		[[39, 87], [38, 66], [34, 44], [32, 22]],
		[[41, 87], [43, 66], [47, 44], [50, 20]],
		[[42, 87], [47, 70], [56, 52], [64, 38]],
	], "#5a4038", 1.8);
	cs.forEach((b, j) => each(b, 7, 0.25, 1, (x, y, a, i) => k.add(F(at(g, i + j)), leafD(x, y, i === 6 ? a : a + (i % 2 ? 55 : -55), 6.4, 2.6, 0))));
	cs.forEach((b, j) =>
		each(b, 2, 0.5, 0.8, (x, y) => {
			const cx = x + (j < 2 ? 3 : -3);
			const cy = y + 3;
			st.add(K(p === "bloom" ? "#9a2a2a" : "#7a8a4a", 0.5), seg(x, y, cx, cy - 1));
			const pts: XY[] = [[-3.4, 0.8], [-1.2, -0.4], [1.2, -0.4], [3.4, 0.8], [-2.2, 2.6], [0, 2], [2.2, 2.6]];
			for (const [dx, dy] of pts) {
				st.add(K(p === "bloom" ? "#9a2a2a" : "#7a8a4a", 0.4), seg(cx, cy - 1, cx + dx, cy + dy));
				if (p === "bloom") berry(fr, sh, cx + dx, cy + dy, 1.9, "#2e2638", 0.5);
				else fr.add(R("#f6f2ea", 1.2), D(cx + dx, cy + dy));
			}
			if (p === "leafy") fr.add(R("#c86a8a", 0.4), D(cx, cy + 1));
		}),
	);
	return `${k}${st}${fr}${sh}`;
}

function salmonberry(p: Phase): string {
	const k = new Ink();
	const fr = new Ink();
	const sh = new Ink();
	const g = ["#4f9040", "#66a650", "#3f7e36"] as const;
	const cs = canes(k, [
		[[38, 87], [35, 66], [26, 46], [18, 28]],
		[[40, 87], [40, 62], [38, 40], [40, 14]],
		[[42, 87], [45, 66], [54, 46], [62, 28]],
	], "#a07a4a", 1.8);
	cs.forEach((b, j) => each(b, 6, 0.25, 1, (x, y, a, i) => trifol(k, g, x, y, i === 5 ? a : a + (i % 2 ? 62 : -62), 6, 2.3, i + j)));
	const spots: XY[] = [[22, 46], [46, 34], [56, 52], [30, 64], [50, 66]];
	spots.forEach(([x, y], i) => {
		if (p === "bloom" && i !== 1) {
			drupe(fr, x, y + 1, 3.6, 3.9, i === 3 ? "#e0603a" : "#f08a50", "#f8b478");
			sh.add(R("#fff", 0.8, 0.4), D(x - 1.4, y - 0.8));
		} else blossom(fr, x, y, 7, "#d2457e", "#f2c25a", i * 13);
	});
	return `${k}${fr}${sh}`;
}

function thimbleberry(p: Phase): string {
	const k = new Ink();
	const fr = new Ink();
	const g = ["#76b45a", "#8cc46a", "#5f9c48"] as const;
	const cs = canes(k, [
		[[38, 87], [34, 70], [26, 56], [20, 46]],
		[[40, 87], [40, 64], [40, 44], [40, 26]],
		[[42, 87], [46, 70], [54, 56], [60, 44]],
	], "#8a6a4a", 1.8);
	cs.forEach((b, j) =>
		each(b, 3, 0.4, 1, (x, y, a, i) => {
			const dir = i === 2 ? a : a + ((i + j) % 2 ? 70 : -70);
			k.add(F(at(g, i + j)), scallopD(x + Math.cos(rad(dir)) * 8, y + Math.sin(rad(dir)) * 8, 9.6, 5, dir, 0.6, 250));
			const cx = x + Math.cos(rad(dir)) * 8;
			const cy = y + Math.sin(rad(dir)) * 8;
			let v = "";
			for (let n = 0; n < 5; n++) {
				const t = rad(dir - 115 + n * 57.5);
				v += seg(cx, cy, cx + Math.cos(t) * 8.5, cy + Math.sin(t) * 8.5);
			}
			k.add(K("#4a8a38", 0.5), v);
		}),
	);
	const spots: XY[] = [[28, 40], [52, 22], [64, 34], [32, 20]];
	spots.forEach(([x, y], i) => {
		k.add(K("#5a7a3a", 0.7), seg(x, y + 2, x + (x < 40 ? 4 : -4), y + 9));
		if (p === "bloom" && i !== 3) {
			drupe(fr, x, y, 4.6, 2.8, "#d43a3a", "#ee6c64");
			fr.add(F("#8a1a24"), E(x, y + 2.2, 3.6, 0.9));
		} else blossom(fr, x, y, 8, "#fbf8f0", "#e8cc6a", i * 20);
	});
	return `${k}${fr}`;
}

function wineberry(p: Phase): string {
	const k = new Ink();
	const fr = new Ink();
	const sh = new Ink();
	const g = ["#5a9a46", "#6eaa52"] as const;
	const cs = canes(k, [
		[[38, 87], [32, 56], [18, 40], [11, 56]],
		[[40, 87], [38, 50], [34, 24], [24, 20]],
		[[41, 87], [44, 50], [52, 22], [62, 26]],
		[[42, 87], [50, 58], [62, 42], [69, 58]],
	], "#b0303e", 1.9);
	let hair = "";
	cs.forEach((b) =>
		each(b, 11, 0.08, 0.95, (x, y, a, i) => {
			const n = rad(a + (i % 2 ? 80 : -80));
			hair += seg(x, y, x + Math.cos(n) * 1.8, y + Math.sin(n) * 1.8);
		}),
	);
	k.add(K("#d8505e", 0.45), hair);
	cs.forEach((b, j) => each(b, 4, 0.3, 0.9, (x, y, a, i) => trifol(k, g, x, y, a + (i % 2 ? 65 : -65), 6, 2.6, i, 1, (i + j) % 3 === 1 ? "#dcd8cc" : undefined)));
	cs.forEach((b, j) => {
		const [x, y] = bez(b, 1);
		for (const [dx, dy] of [[0, 4], [-3.2, 1.6], [3.2, 1.6]] as const) {
			if (p === "bloom") {
				drupe(fr, x + dx, y + dy, 2.3, 2.3, j % 2 ? "#e4283a" : "#d81e34", "#f8606a");
				sh.add(R("#fff", 0.7, 0.55), D(x + dx - 0.8, y + dy - 0.9));
			} else {
				fr.add(F("#b8404a"), leafD(x + dx, y + dy + 2, -90, 3.4, 1, 1) + leafD(x + dx, y + dy + 2, -30, 3, 1, 1) + leafD(x + dx, y + dy + 2, -150, 3, 1, 1));
			}
		}
	});
	return `${k}${fr}${sh}`;
}

function barberry(p: Phase): string {
	const k = new Ink();
	const st = new Ink();
	const fr = new Ink();
	const sh = new Ink();
	const g = ["#8a2a44", "#a8405a", "#6e1e34"] as const;
	const list: Bz[] = [];
	for (let i = 0; i < 7; i++) {
		const t = rad(-165 + i * 25);
		const ex = 40 + Math.cos(t) * 32;
		const ey = 60 + Math.sin(t) * 38 + (Math.abs(i - 3) > 1 ? 8 : 0);
		const bx = 40 + (i - 3) * 1.6;
		list.push([[bx, 87], [bx + (ex - 40) * 0.15, 66], [40 + (ex - 40) * 0.75, ey - 10], [ex, ey]]);
	}
	const cs = canes(k, list, "#7a3a2a", 1.3);
	let spines = "";
	cs.forEach((b, j) =>
		each(b, 6, 0.18, 1, (x, y, a, i) => {
			k.add(F(at(g, i + j)), leafD(x, y, a - 45, 5, 2.2, 1) + leafD(x, y, a + 45, 4.6, 2, 1));
			const sp = rad(a + (i % 2 ? -100 : 100));
			spines += seg(x, y, x + Math.cos(sp) * 2.4, y + Math.sin(sp) * 2.4);
		}),
	);
	k.add(K("#c8a888", 0.4), spines);
	cs.forEach((b, j) =>
		each(b, 4, 0.4, 0.9, (x, y, _a, i) => {
			if ((i + j) % 2) return;
			st.add(K("#9a5a3a", 0.4), seg(x, y, x, y + 3));
			if (p === "bloom") {
				capsule(fr, x - 1.1, y + 2.8, 4.6, 1.1, "#e2232f", -0.5);
				capsule(fr, x + 1.1, y + 3.2, 4.6, 1.1, "#d01c2a", 0.5);
				sh.add(R("#fff", 0.3, 0.5), D(x - 1.5, y + 4.2) + D(x + 0.7, y + 4.6));
			} else fr.add(R("#f0c030", 1), D(x - 1, y + 4) + D(x + 1.2, y + 4.6));
		}),
	);
	return `${k}${st}${fr}${sh}`;
}

function jostaberry(p: Phase): string {
	const k = new Ink();
	const st = new Ink();
	const fr = new Ink();
	const sh = new Ink();
	const g = ["#2f6a35", "#428040", "#2a5c30"] as const;
	const cs = canes(k, [
		[[37, 87], [32, 68], [22, 46], [14, 28]],
		[[39, 87], [37, 62], [32, 38], [30, 18]],
		[[41, 87], [43, 62], [48, 38], [50, 18]],
		[[43, 87], [48, 68], [58, 46], [66, 28]],
	], "#7a5a42", 1.9);
	cs.forEach((b, j) => each(b, 7, 0.16, 1, (x, y, a, i) => k.add(F(at(g, i + j)), scallopOn(x, y, i === 6 ? a : a + (i % 2 ? 58 : -58), 7, 3, 0.62))));
	if (p === "bloom")
		cs.forEach((b, j) =>
			each(b, 3, 0.32, 0.78, (x, y, _a, i) => {
				const s = (i + j) % 2 ? 1 : -1;
				const cx = x + s * 2.4;
				st.add(K("#4a5a2a", 0.6), seg(x, y, cx, y + 3));
				const n = (i + j) % 3 === 0 ? 3 : 2;
				for (let m = 0; m < n; m++) berry(fr, sh, cx + (m - (n - 1) / 2) * 4.2, y + 6 + (m === 1 && n === 3 ? 1.6 : 0), 2.6, (i + j + m) % 4 === 3 ? "#7a2440" : "#3a1a40", 0.55);
			}),
		);
	return `${k}${st}${fr}${sh}`;
}

function bilberry(p: Phase): string {
	const k = new Ink();
	const st = new Ink();
	const fr = new Ink();
	const sh = new Ink();
	const g = ["#78b450", "#8cc45c", "#62a043"] as const;
	let d = "";
	const tips: [number, number, number][] = [];
	for (let i = 0; i < 6; i++) {
		const o = i - 2.5;
		let x = 40 + o * 1.2;
		let y = 87;
		d += `M${f(x)} ${f(y)}`;
		let a = -90 + o * 12;
		for (let s = 0; s < 4; s++) {
			const l = 9 - s;
			x += Math.cos(rad(a)) * l;
			y += Math.sin(rad(a)) * l;
			d += `L${f(x)} ${f(y)}`;
			const side = a + (s % 2 ? 38 : -38);
			const bx = x + Math.cos(rad(side)) * 6;
			const by = y + Math.sin(rad(side)) * 6;
			d += `L${f(bx)} ${f(by)}M${f(x)} ${f(y)}`;
			tips.push([bx, by, side], [x, y, a]);
			a += s % 2 ? -14 : 14;
		}
	}
	k.add(K("#4e8a3a", 1), d);
	tips.forEach(([x, y, a], i) => k.add(F(at(g, i)), leafD(x, y, a + (i % 2 ? 50 : -50), 4, 1.6, 1)));
	tips.forEach(([x, y], i) => {
		if (i % 3 !== 1) return;
		st.add(K("#4e6a3a", 0.4), seg(x, y, x + 0.6, y + 2.2));
		if (p === "bloom") {
			fr.add(R("#2e3a70", 2), D(x + 0.6, y + 4.4));
			sh.add(F("#8090c4", 0.6), E(x - 0.2, y + 3.6, 0.7, 1.1, 30)).add(R("#1c2448", 0.5), D(x + 0.6, y + 6.1));
		} else bell(fr, x + 0.6, y + 3.8, 1.3, "#e07a8a", "#a84a5a");
	});
	return `${k}${st}${fr}${sh}`;
}

function crowberry(p: Phase): string {
	const k = new Ink();
	const fr = new Ink();
	const sh = new Ink();
	const g = ["#2f5a32", "#456f3c", "#3a6436", "#557e44"] as const;
	k.add(F("#244a2a"), "M8 86Q12 66 40 62Q68 66 72 86Z");
	const ends: XY[] = [[8, 82], [12, 72], [22, 65], [33, 61], [47, 61], [58, 65], [68, 72], [72, 82]];
	const cs = canes(k, ends.map(([x, y]) => [[40, 86], [40 + (x - 40) * 0.3, 86 - (86 - y) * 0.9], [40 + (x - 40) * 0.7, y - 2], [x, y]] as Bz), "#2c4a2c", 1.1);
	cs.forEach((b, j) => each(b, 12, 0.3, 1, (x, y, a, i) => k.add(F(at(g, i + j)), leafD(x, y, a + (i % 2 ? 62 : -62), 3.8, 1.8, 3) + (i === 11 ? leafD(x, y, a, 3.6, 1.8, 3) : ""))));
	cs.forEach((b, j) =>
		each(b, 3, 0.45, 0.85, (x, y, _a, i) => {
			if (p === "bloom") {
				if ((i + j) % 4 !== 3) berry(fr, sh, x, y + 1, 2.1, "#1a1420", 0.75);
			} else fr.add(R("#a8457a", 0.8), D(x, y - 0.4));
		}),
	);
	return `${k}${fr}${sh}`;
}

function bearberry(p: Phase): string {
	const k = new Ink();
	const fr = new Ink();
	const sh = new Ink();
	const g = ["#3a6a36", "#4f8042", "#2f5a30"] as const;
	const ends: XY[] = [[9, 83], [12, 76], [24, 71], [40, 67], [56, 71], [68, 76], [71, 83]];
	const cs = canes(k, ends.map(([x, y]) => [[40, 86], [40 + (x - 40) * 0.3, 82], [40 + (x - 40) * 0.7, y - 4], [x, y]] as Bz), "#8a3a2a", 1.3);
	cs.forEach((b, j) => each(b, 8, 0.2, 1, (x, y, a, i) => k.add(F(at(g, i + j)), leafD(x, y, -90 + (a + 90) * 0.4 + (i % 2 ? 32 : -32), 4.4, 2, 2))));
	cs.forEach((b, j) =>
		each(b, 2, 0.45, 0.8, (x, y, _a, i) => {
			if (p === "bloom") {
				berry(fr, sh, x - 1.4, y + 1.2, 2.3, "#d0202a", 0.55);
				if ((i + j) % 2) berry(fr, sh, x + 2.2, y + 1.8, 2.1, "#e03030", 0.55);
			} else {
				bell(fr, x - 1, y + 1.6, 1.5, "#f6dae0", "#d67a8e");
				bell(fr, x + 1.6, y + 2, 1.4, "#f6dae0", "#d67a8e");
			}
		}),
	);
	return `${k}${fr}${sh}`;
}

/** A tapered trunk from the ground at x0 (width w0) to (x1, y1) (width w1). */
function trunkD(x0: number, x1: number, y1: number, w0: number, w1: number): string {
	const y0 = 87.5;
	const fl = w0 * 0.35;
	return `M${f(x0 - w0 / 2 - fl)} ${y0}Q${f(x0 - w0 / 2)} ${f(y0 - 1)} ${f(x0 - w0 / 2)} ${f(y0 - 4)}L${f(x1 - w1 / 2)} ${f(y1)}L${f(x1 + w1 / 2)} ${f(y1)}L${f(x0 + w0 / 2)} ${f(y0 - 4)}Q${f(x0 + w0 / 2)} ${f(y0 - 1)} ${f(x0 + w0 / 2 + fl)} ${y0}Z`;
}

function feijoa(p: Phase): string {
	const k = new Ink();
	const fr = new Ink();
	const sh = new Ink();
	const g = ["#7f9c7a", "#a9bca4", "#6a8866"] as const;
	k.add(F("#7a6a58"), trunkD(40, 40, 52, 6, 3.4)).add(K("#7a6a58", 2), seg(40, 60, 28, 46) + seg(40, 58, 52, 44));
	k.add(F("#566e54"), E(40, 36, 25, 22));
	crown(k, 40, 36, 25, 22, 36, (x, y, a, i) => k.add(F(at(g, i)), leafD(x, y, a, 6.2, 2.4, 0)), 0.2);
	const fl: XY[] = p === "bloom" ? [[28, 30], [50, 22], [56, 40]] : [[30, 32], [50, 24], [56, 42], [36, 46], [42, 18]];
	fl.forEach(([x, y]) => {
		fr.add(F("#f2d4d0"), leafD(x, y + 1, 160, 4, 2.2, 2) + leafD(x, y + 1, 20, 4, 2.2, 2) + leafD(x, y + 1, 60, 3.6, 2, 2) + leafD(x, y + 1, 120, 3.6, 2, 2));
		let s = "";
		for (let n = 0; n < 9; n++) {
			const t = rad(-160 + n * 17.5);
			s += seg(x, y, x + Math.cos(t) * 5, y + Math.sin(t) * 5);
		}
		fr.add(K("#c8243a", 0.6), s);
		let tips = "";
		for (let n = 0; n < 9; n++) {
			const t = rad(-160 + n * 17.5);
			tips += D(x + Math.cos(t) * 5.2, y + Math.sin(t) * 5.2);
		}
		fr.add(R("#f0d050", 0.55), tips);
	});
	if (p === "bloom")
		for (const [x, y] of [[22, 46], [36, 50], [48, 54], [62, 50], [40, 34]] as const) {
			fr.add(K("#5a4a2a", 0.6), seg(x, y - 3.5, x, y - 2)).add(F("#5e8a36"), E(x, y + 1.5, 2.8, 3.8)).add(F("#3f6a2a"), E(x, y + 5, 0.9, 0.5));
			sh.add(F("#fff", 0.3), E(x - 1, y, 0.7, 1.6));
		}
	return `${k}${fr}${sh}`;
}

function natalPlum(p: Phase): string {
	const k = new Ink();
	const fr = new Ink();
	const sh = new Ink();
	const g = ["#2f6a38", "#3f7f44", "#285e32"] as const;
	k.add(K("#5e4a38", 2.2), seg(38, 87, 30, 70) + seg(42, 87, 50, 70) + seg(40, 87, 40, 66));
	k.add(F("#1f4a28"), E(40, 52, 30, 23));
	let spines = "";
	crown(k, 40, 52, 30, 23, 40, (x, y, a, i) => {
		k.add(F(at(g, i)), leafD(x, y, a, 6.4, 3.4, 0));
		if (i % 6 === 2) {
			const t = rad(a);
			const ex = x + Math.cos(t) * 4;
			const ey = y + Math.sin(t) * 4;
			spines += seg(x, y, ex, ey) + seg(ex, ey, ex + Math.cos(t - 0.6) * 2.4, ey + Math.sin(t - 0.6) * 2.4) + seg(ex, ey, ex + Math.cos(t + 0.6) * 2.4, ey + Math.sin(t + 0.6) * 2.4);
		}
	});
	k.add(K("#a8b86a", 0.5), spines);
	const star = (x: number, y: number, r: number, o: number) => {
		let d = "";
		for (let n = 0; n < 5; n++) d += leafD(x, y, o + n * 72, r, r * 0.42, 0).replace(/^M[^c]+/, `M${f(x + Math.cos(rad(o + n * 72 + 90)) * 0.9)} ${f(y + Math.sin(rad(o + n * 72 + 90)) * 0.9)}`);
		fr.add(F("#fbfbf3"), d).add(R("#e8d8a0", 0.6), D(x, y));
	};
	const flowers: XY[] = p === "bloom" ? [[22, 44], [46, 32], [60, 54]] : [[22, 44], [46, 32], [60, 54], [34, 60], [52, 44], [30, 34]];
	flowers.forEach(([x, y], i) => star(x, y, 5, i * 25));
	if (p === "bloom")
		for (const [x, y] of [[32, 42], [56, 40], [38, 58], [22, 58], [50, 64], [62, 64], [40, 30]] as const) {
			fr.add(F("#c41e3a"), E(x, y, 3, 3.8, 15));
			sh.add(F("#fff", 0.4), E(x - 1, y - 1.4, 0.7, 1.4, 15));
		}
	return `${k}${fr}${sh}`;
}

function surinamCherry(p: Phase): string {
	const k = new Ink();
	const st = new Ink();
	const fr = new Ink();
	const sh = new Ink();
	const g = ["#2f7038", "#3f8644", "#a65538", "#2f7038", "#c0734a"] as const;
	const cs = canes(k, [
		[[38, 87], [36, 68], [24, 52], [14, 40]],
		[[39, 87], [38, 62], [34, 40], [30, 16]],
		[[41, 87], [42, 62], [46, 40], [50, 14]],
		[[42, 87], [44, 68], [56, 52], [66, 40]],
	], "#7a5a48", 2);
	cs.forEach((b, j) =>
		each(b, 7, 0.3, 1, (x, y, a, i) => {
			const c = i >= 5 ? at(g, 2 + (i % 2) * 2) : at(g, i + j);
			k.add(F(c), leafD(x, y, a - 55, 5.6, 2, 1) + leafD(x, y, a + 55, 5.6, 2, 1));
		}),
	);
	const fruitCol: [string, string][] = [["#d8302a", "#9a1a1e"], ["#ee8a2e", "#c25a1a"], ["#8a1424", "#5a0c18"]];
	cs.forEach((b, j) =>
		each(b, 3, 0.4, 0.8, (x, y, _a, i) => {
			const s = (i + j) % 2 ? 1 : -1;
			const fx = x + s * 2;
			st.add(K("#5a6a3a", 0.5), seg(x, y, fx, y + 4));
			if (p === "bloom") {
				const [c, rib] = at(fruitCol.map((t) => t.join("|")), i + j).split("|") as [string, string];
				const fy = y + 7;
				fr.add(F(c), E(fx, fy, 3.4, 2.7));
				fr.add(K(rib, 0.45), `M${f(fx)} ${f(fy - 2.6)}V${f(fy + 2.6)}M${f(fx - 1.7)} ${f(fy - 2.2)}Q${f(fx - 2.4)} ${f(fy)} ${f(fx - 1.7)} ${f(fy + 2.2)}M${f(fx + 1.7)} ${f(fy - 2.2)}Q${f(fx + 2.4)} ${f(fy)} ${f(fx + 1.7)} ${f(fy + 2.2)}`);
				sh.add(R("#fff", 0.5, 0.45), D(fx - 2.2, fy - 1));
			} else {
				let s2 = "";
				for (let n = 0; n < 8; n++) s2 += seg(fx, y + 5, fx + Math.cos(rad(n * 45)) * 2.4, y + 5 + Math.sin(rad(n * 45)) * 2.4);
				fr.add(K("#f8f4ea", 0.5), s2).add(R("#fbfaf4", 1), D(fx, y + 5));
			}
		}),
	);
	return `${k}${st}${fr}${sh}`;
}

function acerola(p: Phase): string {
	const k = new Ink();
	const st = new Ink();
	const fr = new Ink();
	const sh = new Ink();
	const g = ["#3f8a3e", "#56a04a", "#2f7434"] as const;
	k.add(F("#7a5a40"), trunkD(40, 40, 60, 5, 3)).add(K("#7a5a40", 1.8), seg(40, 64, 24, 54) + seg(40, 62, 56, 52) + seg(40, 62, 40, 46));
	k.add(F("#2a5e2e"), E(40, 46, 30, 18));
	crown(k, 40, 46, 30, 18, 52, (x, y, a, i) => k.add(F(at(g, i)), leafD(x, y, a, 5.4, 2.1, 1)), 0.15);
	const spots = scatter(40, 47, 25, 14, 11);
	spots.forEach(([x, y], i) => {
		if (p === "bloom" && i % 3 !== 2) {
			st.add(K("#4a6a2a", 0.5), seg(x, y, x - 1.6, y + 3) + seg(x, y, x + 1.8, y + 3.4));
			berry(fr, sh, x - 1.6, y + 4.6, 2.3, "#e3142c", 0.6);
			berry(fr, sh, x + 1.8, y + 5, 2.1, i % 2 ? "#e3142c" : "#f04a24", 0.6);
		} else {
			blossom(fr, x, y, 4.4, "#f29ac0", "#f2d050", i * 15);
		}
	});
	return `${k}${st}${fr}${sh}`;
}

function miracleBerry(p: Phase): string {
	const k = new Ink();
	const fr = new Ink();
	const sh = new Ink();
	const g = ["#2f6a3a", "#3f7e44", "#4f8e4c"] as const;
	k.add(K("#6a4a32", 2.2), seg(40, 87, 40, 14));
	const tiers: [number, number][] = [[74, 17], [60, 15], [46, 12], [32, 9], [18, 0]];
	let br = "";
	const heads: XY[] = [];
	for (const [y, w] of tiers) {
		if (w === 0) {
			heads.push([40, y]);
			continue;
		}
		br += `M40 ${f(y + 4)}Q${f(40 - w * 0.5)} ${f(y + 2)} ${f(40 - w)} ${f(y)}M40 ${f(y + 4)}Q${f(40 + w * 0.5)} ${f(y + 2)} ${f(40 + w)} ${f(y)}`;
		heads.push([40 - w, y], [40 + w, y]);
	}
	k.add(K("#6a4a32", 1.4), br);
	heads.forEach(([x, y], j) => {
		for (let n = 0; n < 8; n++) k.add(F(at(g, n + j)), leafD(x, y, n * 45 - 90 + (j % 2) * 20, 6.6, 1.9, 0));
		for (const dx of [-2, 0, 2]) {
			if (p === "bloom") {
				capsule(fr, x + dx, y + 2.2 + (dx === 0 ? 1 : 0), 4.6, 1.2, "#d4202a", dx * 0.2);
				sh.add(R("#fff", 0.3, 0.5), D(x + dx - 0.4, y + 3.8));
			} else fr.add(R("#efe6c8", 0.8), D(x + dx, y + 3.6));
		}
	});
	return `${k}${fr}${sh}`;
}

function goumi(p: Phase): string {
	const k = new Ink();
	const st = new Ink();
	const fr = new Ink();
	const sh = new Ink();
	const g = ["#6a8f5a", "#c4c8b4", "#7fa06a", "#b0b8a0"] as const;
	const cs = canes(k, [
		[[38, 87], [32, 70], [18, 56], [8, 50]],
		[[39, 87], [36, 64], [28, 42], [22, 28]],
		[[40, 87], [40, 64], [42, 42], [44, 20]],
		[[42, 87], [46, 64], [56, 44], [64, 32]],
		[[42, 87], [50, 72], [62, 62], [72, 58]],
	], "#7a6650", 1.6);
	cs.forEach((b, j) => each(b, 8, 0.25, 1, (x, y, a, i) => k.add(F(at(g, i + j)), leafD(x, y, i === 7 ? a : a + (i % 2 ? 50 : -50), 5.6, 2.2, 0))));
	cs.forEach((b, j) =>
		each(b, 3, 0.4, 0.85, (x, y, _a, i) => {
			const dx = (i + j) % 2 ? 1.4 : -1.4;
			st.add(K("#8a7a50", 0.45), `M${f(x)} ${f(y)}q${f(dx)} 3 ${f(dx * 0.6)} 6.4`);
			if (p === "bloom") {
				const fx = x + dx * 0.6;
				capsule(fr, fx, y + 6.1, 5.4, 1.9, (i + j) % 3 ? "#c8252e" : "#d83a30");
				sh.add(R("#f6e6d0", 0.3, 0.9), D(fx - 0.7, y + 8) + D(fx + 0.6, y + 9.6) + D(fx + 0.2, y + 7.4) + D(fx - 0.5, y + 10));
			} else st.add(K("#efe6c8", 1.3), seg(x + dx * 0.6, y + 6, x + dx * 0.6, y + 8.6));
		}),
	);
	return `${k}${st}${fr}${sh}`;
}

/* ---------------- the family ---------------- */

export const SPECIES: Species[] = [
	make("red-currant", "Red currant", { h: 18, a: "#67a64f", b: "#8cc46a", stem: "#8a6a4a", lobed: 5, len: 9 }, redCurrant),
	make("blackcurrant", "Blackcurrant", { h: 14, a: "#3d7339", b: "#6f9a5a", stem: "#5e4636", lobed: 5, len: 9, pairs: 1 }, blackcurrant),
	make("huckleberry", "Huckleberry", { h: 20, a: "#79b05a", b: "#a0c47a", stem: "#8a3f34", shape: 0, len: 5, w: 2.2, pairs: 1 }, huckleberry),
	make("lingonberry", "Lingonberry", { h: 12, a: "#2c5a30", b: "#5a8a48", stem: "#6a4a36", shape: 2, len: 4.4, w: 2.2, pairs: 1 }, lingonberry, 0.8),
	make("cloudberry", "Cloudberry", { h: 12, a: "#72ad55", b: "#9ac47a", stem: "#5a7a3a", shape: 2, len: 7, w: 3.6 }, cloudberry, 0.78),
	make("boysenberry", "Boysenberry", { h: 16, a: "#4a8a40", b: "#7ab05a", stem: "#6a3a3a", len: 6.4, w: 2.4 }, boysenberry, 0.72),
	make("loganberry", "Loganberry", { h: 18, a: "#6aa84f", b: "#9ccb7a", stem: "#6e5a3a", len: 6, w: 2.2 }, loganberry, 0.68),
	make("goji", "Goji", { h: 20, a: "#6f9a5a", b: "#9ab884", stem: "#a08a6a", len: 7, w: 1.4, pairs: 1 }, goji),
	make("sea-buckthorn", "Sea buckthorn", { h: 22, a: "#a8bba8", b: "#c3cfc0", stem: "#6e5a48", len: 8, w: 1.1, pairs: 2 }, seaBuckthorn),
	make("honeyberry", "Honeyberry", { h: 16, a: "#5f9452", b: "#8aba72", stem: "#8a6448", shape: 0, len: 6, w: 2.8, pairs: 1 }, honeyberry),
	make("black-chokeberry", "Black chokeberry", { h: 18, a: "#4f8a3e", b: "#7aa85c", stem: "#5a4038", shape: 0, len: 6.4, w: 2.8 }, blackChokeberry),
	make("salmonberry", "Salmonberry", { h: 17, a: "#4f9040", b: "#7ab05e", stem: "#a07a4a", len: 6.4, w: 2.6 }, salmonberry),
	make("thimbleberry", "Thimbleberry", { h: 16, a: "#8cc46a", b: "#a6d084", stem: "#8a6a4a", shape: 4, len: 8, w: 3.6 }, thimbleberry),
	make("wineberry", "Wineberry", { h: 17, a: "#5a9a46", b: "#8cba6e", stem: "#b0303e", shape: 4, len: 6, w: 2.8 }, wineberry),
	make("barberry", "Barberry", { h: 14, a: "#8a2a44", b: "#6e8a4a", stem: "#7a3a2a", shape: 2, len: 4.4, w: 2, pairs: 2 }, barberry),
	make("jostaberry", "Jostaberry", { h: 20, a: "#2f6a35", b: "#5f9a50", stem: "#7a5a42", shape: 4, len: 7, w: 3.2 }, jostaberry),
	make("bilberry", "Bilberry", { h: 14, a: "#8cc45c", b: "#a8d47a", stem: "#4e8a3a", len: 4.4, w: 1.8, pairs: 2 }, bilberry, 0.8),
	make("crowberry", "Crowberry", { h: 10, a: "#2f5a32", b: "#5a8048", stem: "#6a3a2e", shape: 3, len: 5, w: 1.4, pairs: 2 }, crowberry, 0.8),
	make("bearberry", "Bearberry", { h: 9, a: "#3a6a36", b: "#6a9a52", stem: "#8a3a2a", shape: 2, len: 5, w: 2.4 }, bearberry, 0.8),
	make("feijoa", "Feijoa", { h: 22, a: "#8aa684", b: "#b4c6ae", stem: "#7a6a58", shape: 0, len: 6.4, w: 2.4, pairs: 1 }, feijoa),
	make("natal-plum", "Natal plum", { h: 15, a: "#2f6a38", b: "#5a8a50", stem: "#5e4a38", shape: 0, len: 6.4, w: 3.2 }, natalPlum),
	make("surinam-cherry", "Surinam cherry", { h: 20, a: "#a65538", b: "#3f8644", stem: "#7a5a48", len: 6.4, w: 2.2, pairs: 1 }, surinamCherry),
	make("acerola", "Acerola", { h: 19, a: "#3f8a3e", b: "#6aa85a", stem: "#7a5a40", len: 6.4, w: 2.4 }, acerola),
	make("miracle-berry", "Miracle berry", { h: 22, a: "#2f6a3a", b: "#5f9a5a", stem: "#6a4a32", shape: 0, len: 6.6, w: 2, pairs: 1 }, miracleBerry),
	make("goumi", "Goumi", { h: 19, a: "#6a8f5a", b: "#c4c8b4", stem: "#7a6650", shape: 0, len: 6, w: 2.4, pairs: 1 }, goumi),
];
