/**
 * Garden species, family: prairie wildflowers and grasses. Each draws
 * sprout, leafy and bloom in the kit's flat style (see kit.ts); the kit
 * draws soil and seed.
 */
import { blade, circle, f, GREEN, type GrowingStage, type Species } from "./kit";

/* ---------- private helpers ---------- */

type XY = [number, number];
const D = Math.PI / 180;

/** A filled path. */
function p(d: string, fill: string): string {
	return `<path d="${d}" fill="${fill}"/>`;
}

/** A stroked path with round caps and joins. */
function sk(d: string, stroke: string, w: number): string {
	return `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${f(w)}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

/** A rotated ellipse. */
function el(cx: number, cy: number, rx: number, ry: number, fill: string, rot = 0): string {
	const t = rot ? ` transform="rotate(${f(rot)} ${f(cx)} ${f(cy)})"` : "";
	return `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}" fill="${fill}"${t}/>`;
}

/** (lx, ly) in a frame at (x, y) rotated by deg. */
function pt(x: number, y: number, deg: number, lx: number, ly: number): XY {
	const c = Math.cos(deg * D);
	const s = Math.sin(deg * D);
	return [x + lx * c - ly * s, y + lx * s + ly * c];
}

const P = (a: XY): string => `${f(a[0])} ${f(a[1])}`;

/** Subpath of a straight segment. */
function seg(x1: number, y1: number, x2: number, y2: number): string {
	return `M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}`;
}

/** Subpath of a segment from (x, y) heading deg, len long. */
function ray(x: number, y: number, deg: number, len: number, from = 0): string {
	return `M${P(pt(x, y, deg, from, 0))}L${P(pt(x, y, deg, len, 0))}`;
}

/** Subpath of a quadratic curve. */
function qs(x0: number, y0: number, cx: number, cy: number, x1: number, y1: number): string {
	return `M${f(x0)} ${f(y0)}Q${f(cx)} ${f(cy)} ${f(x1)} ${f(y1)}`;
}

/** Point and heading (degrees) on a quadratic curve at t. */
function qAt(q: readonly number[], t: number): [number, number, number] {
	const [x0 = 0, y0 = 0, cx = 0, cy = 0, x1 = 0, y1 = 0] = q;
	const u = 1 - t;
	const x = u * u * x0 + 2 * u * t * cx + t * t * x1;
	const y = u * u * y0 + 2 * u * t * cy + t * t * y1;
	const dx = 2 * u * (cx - x0) + 2 * t * (x1 - cx);
	const dy = 2 * u * (cy - y0) + 2 * t * (y1 - cy);
	return [x, y, Math.atan2(dy, dx) / D];
}

const LEAF_K: Record<0 | 1 | 2 | 4, readonly number[]> = {
	0: [0.3, 1, 0.8, 1],
	1: [0.45, 1.15, 0.8, 0.5],
	2: [0.05, 1.4, 1.02, 1.3],
	4: [0.1, 1.6, 0.75, 1.2],
};

/** Subpath of a kit leaf outline at (x, y) heading deg, for merging many leaves into one path. */
function leafSub(x: number, y: number, deg: number, len: number, w: number, shape: 0 | 1 | 2 | 4 = 0): string {
	const [a = 0, b = 0, c = 0, d = 0] = LEAF_K[shape];
	const Q = (lx: number, ly: number) => P(pt(x, y, deg, lx, ly));
	return `M${Q(0, 0)}C${Q(a * len, -b * w)} ${Q(c * len, -d * w)} ${Q(len, 0)}C${Q(c * len, d * w)} ${Q(a * len, b * w)} ${Q(0, 0)}Z`;
}

/** Subpath of a pointed lens from (x, y) heading deg, len long and about 2w wide. */
function lensSub(x: number, y: number, deg: number, len: number, w: number): string {
	const r = deg * D;
	const c = Math.cos(r);
	const sn = Math.sin(r);
	const mx = x + c * len * 0.45;
	const my = y + sn * len * 0.45;
	const k = w * 1.25;
	return `M${f(x)} ${f(y)}Q${f(mx - sn * k)} ${f(my + c * k)} ${f(x + c * len)} ${f(y + sn * len)}Q${f(mx + sn * k)} ${f(my - c * k)} ${f(x)} ${f(y)}Z`;
}

/** Subpath of a polygon given in local coords, placed at (x, y), rotated by deg and scaled by k. */
function polySub(x: number, y: number, deg: number, k: number, pts: readonly number[]): string {
	let d = "";
	for (let i = 0; i < pts.length; i += 2) d += `${i ? "L" : "M"}${P(pt(x, y, deg, (pts[i] ?? 0) * k, (pts[i + 1] ?? 0) * k))}`;
	return d + "Z";
}

/** Round dots of one size and colour, as zero-length round-capped strokes in one path. */
function dots(list: readonly XY[], fill: string, size: number): string {
	return sk(list.map(([x, y]) => `M${f(x)} ${f(y)}h0`).join(""), fill, size);
}

/** n points on a circle of radius r around (x, y). */
function around(x: number, y: number, n: number, r: number, off = 0): XY[] {
	const out: XY[] = [];
	for (let i = 0; i < n; i++) out.push(pt(x, y, off + (i * 360) / n, r, 0));
	return out;
}

/** n capsule rays (petals) around (x, y) from radius r0 to r1, as one stroked path. */
function rays(x: number, y: number, n: number, r0: number, r1: number, off = 0): string {
	let d = "";
	for (let i = 0; i < n; i++) d += ray(x, y, off + (i * 360) / n, r1, r0);
	return d;
}

/** Deterministic jitter in -1..1. */
function jit(i: number): number {
	const v = Math.sin(i * 12.9898 + 4.1) * 43758.5453;
	return (v - Math.floor(v) - 0.5) * 2;
}

/** A dome (upper half ellipse) sitting on y. */
function dome(x: number, y: number, rx: number, ry: number, fill: string): string {
	return p(`M${f(x - rx)} ${f(y)}A${f(rx)} ${f(ry)} 0 0 1 ${f(x + rx)} ${f(y)}Z`, fill);
}

/** Arching linear leaves from (x, y) between two angles, as strokes. */
function tuft(x: number, y: number, n: number, from: number, to: number, len: number, droop = 0.25, j = 0): string {
	let d = "";
	for (let i = 0; i < n; i++) {
		const a = (n === 1 ? from : from + ((to - from) * i) / (n - 1)) * D;
		const L = len * (1 + jit(i + j) * 0.12) * (0.75 + 0.25 * Math.abs(Math.sin(a)));
		const tx = x + Math.cos(a) * L;
		const ty = y + Math.sin(a) * L + droop * L * Math.abs(Math.cos(a));
		d += qs(x, y, x + Math.cos(a) * L * 0.4, y + Math.sin(a) * L * 0.85, tx, ty);
	}
	return d;
}

/** A pinnate leaf drawn as strokes: returns [rachis, leaflets] subpaths. */
function pinS(x: number, y: number, deg: number, len: number, n: number, ll: number, spread = 55): [string, string] {
	let lf = "";
	for (let i = 0; i < n; i++) {
		const t = (i + 1) / (n + 1);
		const [px, py] = pt(x, y, deg, len * t, 0);
		const l = ll * (1 - 0.3 * t);
		lf += ray(px, py, deg - spread, l) + ray(px, py, deg + spread, l);
	}
	const [ex, ey] = pt(x, y, deg, len, 0);
	lf += ray(ex, ey, deg, ll * 0.8);
	return [seg(x, y, ex, ey), lf];
}

/** Scale a list of bloom-stage points toward the root for a younger stage. */
function grow(pts: readonly XY[], k: number): XY[] {
	return pts.map(([x, y]) => [40 + (x - 40) * (0.6 + 0.4 * k), 87 - (87 - y) * k]);
}

/** Stems from the root to each tip, as quadratic curves; returns the curves. */
function stems(tips: readonly XY[], bend = 0.15, rise = 0.5, x0 = 40, y0 = 87): number[][] {
	return tips.map(([x, y]) => [x0, y0, x0 + (x - x0) * bend, y0 - (y0 - y) * rise, x, y]);
}

const qd = (qq: number[][]): string => qq.map((q) => qs(q[0] ?? 0, q[1] ?? 0, q[2] ?? 0, q[3] ?? 0, q[4] ?? 0, q[5] ?? 0)).join("");

/** Alternating leaves along curves at the given t values. */
function alongLeaves(qq: number[][], ts: readonly number[], len: number, w: number, spread: number, shape: 0 | 1 | 2 | 4 = 1, both = false): string {
	let d = "";
	qq.forEach((q, j) =>
		ts.forEach((t, i) => {
			const [x, y, a] = qAt(q, t);
			const side = (i + j) % 2 ? 1 : -1;
			const k = 1 - t * 0.35;
			d += leafSub(x, y, a + side * spread, len * k, w * k, shape);
			if (both) d += leafSub(x, y, a - side * spread, len * k, w * k, shape);
		}),
	);
	return d;
}

/* ---------- 1. Purple coneflower ---------- */
const ECH = { petal: "#c8659f", shade: "#9f4a80", cone: "#c8702a", tip: "#7f3812", leaf: "#5e9a48" };
function droopRing(x: number, y: number, n: number, len: number, w: number, from: number, to: number): string {
	let d = "";
	for (let i = 0; i < n; i++) d += lensSub(x, y, from + ((to - from) * i) / (n - 1), len, w);
	return d;
}
function echHead(x: number, y: number, k: number): string {
	return (
		p(droopRing(x, y - 0.6 * k, 6, 8.5 * k, 1.5 * k, -4, 184), ECH.shade) +
		p(droopRing(x, y, 5, 9.5 * k, 1.6 * k, 28, 152), ECH.petal) +
		dome(x, y + 0.6 * k, 4.2 * k, 5.2 * k, ECH.cone) +
		dots([[x - 2.2 * k, y - 1.6 * k], [x, y - 3.4 * k], [x + 2.2 * k, y - 1.6 * k], [x - 0.9 * k, y - 0.2 * k], [x + 1.1 * k, y - 0.3 * k], [x, y - 1.6 * k]], ECH.tip, 1.1 * k)
	);
}
function purpleConeflower(stage: GrowingStage): string {
	const base = leafSub(40, 86, -170, 14, 3.2, 1) + leafSub(40, 86, -10, 14, 3.2, 1);
	if (stage === "sprout") return p(leafSub(40, 86, -155, 13, 3, 1) + leafSub(40, 86, -25, 13, 3, 1) + leafSub(40, 86, -118, 15, 3, 1) + leafSub(40, 86, -62, 15, 3, 1) + leafSub(40, 86, -90, 13, 2.6, 1), ECH.leaf);
	const lower = base + leafSub(40, 79, -150, 14, 3.4, 1) + leafSub(40, 75, -30, 14, 3.4, 1) + leafSub(40, 67, -148, 12, 3, 1) + leafSub(40, 63, -32, 12, 3, 1);
	if (stage === "leafy") {
		return sk(qs(40, 87, 41, 62, 40, 42), GREEN.dark, 1.6) + p(lower + leafSub(40, 54, -140, 9, 2.4, 1) + leafSub(40, 51, -38, 9, 2.4, 1), ECH.leaf) + p(droopRing(40, 42, 5, 4, 1, 20, 160), GREEN.light) + dome(40, 42.4, 3, 3.6, "#9b8a3a");
	}
	const heads: [number, number, number][] = [[26, 40, 0.85], [55, 33, 0.9], [40, 21, 1.05]];
	return (
		sk(heads.map(([x, y]) => qs(40, 87, 40, (87 + y) / 2, x, y + 1)).join(""), GREEN.dark, 1.5) +
		p(lower + leafSub(33, 56, -155, 9, 2.2, 1) + leafSub(47, 52, -25, 9, 2.2, 1) + leafSub(40, 46, -140, 8, 2, 1), ECH.leaf) +
		heads.map(([x, y, k]) => echHead(x, y, k)).join("")
	);
}

/* ---------- 2. Prairie blazing star ---------- */
const LIA = { a: "#9a3f98", b: "#c869c4", leaf: "#6fa055", bud: "#8fae6a" };
function fuzzySpike(x: number, top: number, bot: number, w: number, a: string, b: string, s: number): string {
	let ticks = "";
	const hi: XY[] = [];
	let i = 0;
	for (let y = bot - 1; y >= top + 1.5; y -= 2.2, i++) {
		const t = (y - top) / (bot - top);
		const ww = w * (0.55 + 0.45 * Math.min(1, t * 2.5));
		ticks += seg(x - ww, y, x - ww - 1.3, y - 1.1 + jit(s + i) * 0.4) + seg(x + ww, y, x + ww + 1.3, y - 1.1 + jit(s + i + 9) * 0.4);
		hi.push([x + jit(s + i * 3) * ww * 0.7, y - 0.8]);
	}
	return sk(seg(x, top + w * 0.6, x, bot), a, w * 2.1) + sk(ticks, a, 1.2) + dots(hi, b, 1.3);
}
function blazingStar(stage: GrowingStage): string {
	const base = sk(tuft(40, 86, 9, -165, -15, stage === "sprout" ? 15 : 19, 0.3), LIA.leaf, 1.5);
	if (stage === "sprout") return base;
	if (stage === "leafy") {
		return sk(seg(40, 86, 40, 50) + tuft(40, 72, 2, -125, -55, 8, 0.1) + tuft(40, 62, 2, -118, -62, 6, 0.1), LIA.leaf, 1.3) + base + fuzzySpike(40, 38, 52, 1.5, LIA.bud, "#a9c486", 3);
	}
	const st = sk(seg(40, 86, 40, 38) + qs(39, 86, 34, 66, 32, 46) + qs(41, 86, 46, 66, 48, 50), GREEN.dark, 1.3);
	const lv = sk(tuft(40, 74, 2, -125, -55, 8, 0.1) + tuft(40, 62, 2, -118, -62, 6.5, 0.1) + tuft(40, 51, 2, -112, -68, 5, 0.1) + tuft(34, 62, 2, -130, -65, 6, 0.1) + tuft(46.5, 64, 2, -115, -50, 6, 0.1), LIA.leaf, 1.2);
	return st + base + lv + fuzzySpike(32, 22, 47, 2.1, LIA.a, LIA.b, 11) + fuzzySpike(48, 27, 51, 2.1, LIA.a, LIA.b, 23) + fuzzySpike(40, 9, 39, 2.5, LIA.a, LIA.b, 5);
}

/* ---------- 3. Butterfly weed ---------- */
const ASC = { a: "#e8701e", b: "#f9a640", leaf: "#5c9646", stem: "#4f8236" };
function umbel(x: number, y: number, k: number): [XY[], XY[]] {
	const a: XY[] = [];
	const b: XY[] = [];
	[[5, 0], [4, -1.9], [3, -3.6]].forEach(([n = 0, dy = 0], r) => {
		for (let i = 0; i < n; i++) (r === 2 || i % 2 ? b : a).push([x + (i - (n - 1) / 2) * 2.1 * k, y + dy * k + Math.abs(i - (n - 1) / 2) * 0.5 * k]);
	});
	return [a, b];
}
function butterflyWeed(stage: GrowingStage): string {
	const tips: XY[] = [[24, 45], [31, 36], [41, 31], [50, 36], [57, 46]];
	if (stage === "sprout") {
		const q = [[40, 87, 40, 78, 40, 68]];
		return sk(qd(q), ASC.stem, 1.4) + p(alongLeaves(q, [0.3, 0.55, 0.8, 1], 7, 1.7, 55, 1, true), ASC.leaf);
	}
	const k = stage === "leafy" ? 0.72 : 1;
	const qq = stems(grow(tips, k), 0.15, 0.55);
	let s = sk(qd(qq), ASC.stem, 1.3) + p(alongLeaves(qq, [0.35, 0.5, 0.65, 0.8, 0.95], 7.5, 1.7, 52), ASC.leaf);
	if (stage === "leafy") return s + dots(grow(tips, k).map(([x, y]) => [x, y - 1] as XY), "#9cbf6e", 3);
	const A: XY[] = [];
	const B: XY[] = [];
	for (const [x, y] of tips) {
		const [a, b] = umbel(x, y - 1, 1);
		A.push(...a);
		B.push(...b);
	}
	return s + dots(A, ASC.a, 2.5) + dots(B, ASC.b, 2.4);
}

/* ---------- 4. Wild bergamot ---------- */
const MON = { a: "#c7a8e4", b: "#9d79cb", eye: "#7c5aa6", bract: "#d9cbe4", leaf: "#6a9c58" };
function pom(x: number, y: number, k: number): string {
	let back = "";
	let front = "";
	for (let a = -172; a <= -8; a += 20.5) back += ray(x, y, a, 7.2 * k, 1);
	for (let a = -160; a <= -20; a += 20) front += ray(x, y + 0.6 * k, a, 5.6 * k, 1);
	return (
		p(leafSub(x, y + 1.6 * k, 168, 6.5 * k, 1.8 * k, 1) + leafSub(x, y + 1.6 * k, 12, 6.5 * k, 1.8 * k, 1), MON.bract) +
		sk(back, MON.b, 1.5 * k) +
		sk(front, MON.a, 1.6 * k) +
		dome(x, y + 1.6 * k, 3 * k, 3 * k, MON.eye)
	);
}
function bergamot(stage: GrowingStage): string {
	const pair = (x: number, y: number, len: number, w: number, tilt = 0) => leafSub(x, y, -160 + tilt, len, w, 1) + leafSub(x, y, -20 - tilt, len, w, 1);
	if (stage === "sprout") return sk(seg(40, 87, 40, 69), GREEN.dark, 1.4) + p(pair(40, 82, 8, 2.4) + pair(40, 73, 7, 2.2, 25), MON.leaf);
	if (stage === "leafy") return sk(seg(40, 87, 40, 42), GREEN.dark, 1.6) + p(pair(40, 80, 11, 3) + pair(40, 70, 10, 2.8) + pair(40, 60, 9, 2.5, 8) + pair(40, 51, 7, 2.2, 15) + pair(40, 44, 5, 1.6, 30), MON.leaf);
	return (
		sk(seg(40, 87, 40, 30) + qs(40, 64, 31, 58, 28, 42) + qs(40, 58, 50, 50, 52, 36), GREEN.dark, 1.5) +
		p(pair(40, 80, 11, 3) + pair(40, 71, 10, 2.8) + pair(40, 50, 8, 2.3, 8) + leafSub(31, 54, -165, 7, 2, 1) + leafSub(49, 49, -15, 7, 2, 1), MON.leaf) +
		pom(28, 40, 0.85) + pom(52, 34, 0.9) + pom(40, 27, 1)
	);
}

/* ---------- 5. Compass plant ---------- */
const SIL = { leaf: "#7a9e5e", rib: "#4f7a3a", stalk: "#567d3c", y: "#f2c430", ys: "#d39e1c", eye: "#c58c1c" };
function lobed(x: number, y: number, deg: number, len: number): string {
	const k = len / 28;
	let d = ray(x, y, deg, len);
	for (let i = 1; i <= 4; i++) {
		const t = i / 5.2;
		const [px, py] = pt(x, y, deg, len * t, 0);
		const L = 7.5 * k * (1 - t * 0.5);
		d += ray(px, py, deg - 52, L) + ray(px, py, deg + 52, L);
	}
	return d;
}
function sunHead(x: number, y: number, k: number, n: number, c: { y: string; ys: string; eye: string }): string {
	return sk(rays(x, y, n, 2.6 * k, 5.6 * k, 180 / n), c.ys, 2 * k) + sk(rays(x, y, n, 2.6 * k, 6 * k), c.y, 2.1 * k) + circle(x, y, 2.6 * k, c.eye);
}
function compassPlant(stage: GrowingStage): string {
	if (stage === "sprout") return sk(lobed(40, 86, -112, 14) + lobed(40, 86, -66, 12), SIL.leaf, 2.2) + sk(ray(40, 86, -112, 14) + ray(40, 86, -66, 12), SIL.rib, 0.6);
	const k = stage === "leafy" ? 0.85 : 1;
	const L: [number, number][] = [[-98, 34], [-74, 30], [-124, 29], [-52, 20], [-150, 20]];
	const basal = sk(L.map(([a, l]) => lobed(40, 86, a, l * k)).join(""), SIL.leaf, 2.3) + sk(L.map(([a, l]) => ray(40, 86, a, l * k)).join(""), SIL.rib, 0.7);
	if (stage === "leafy") return basal;
	return (
		sk(qs(41, 87, 43, 50, 41, 12) + seg(41.6, 28, 48, 23) + seg(41.8, 36, 34, 31) + seg(41.9, 46, 48, 41), SIL.stalk, 1.6) +
		sk(lobed(42, 60, -35, 11) + lobed(42, 54, -148, 10), SIL.leaf, 1.8) +
		basal +
		sunHead(41, 12, 1, 12, SIL) + sunHead(48, 23, 0.82, 12, SIL) + sunHead(34, 31, 0.8, 12, SIL) + sunHead(48, 41, 0.66, 12, SIL)
	);
}

/* ---------- 6. Rattlesnake master ---------- */
const ERY = { a: "#88aa9c", b: "#a3c1b3", stalk: "#6f8f82", ball: "#dbe3cd", tick: "#b0c0a6", dot: "#a3b79d" };
function eryBall(x: number, y: number, r: number): [string, string, XY[]] {
	return [rays(x, y, 12, r * 0.8, r * 1.35, 8), `M${f(x - r)} ${f(y)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0`, [[x - r * 0.4, y - r * 0.3], [x + r * 0.35, y - r * 0.35], [x, y + r * 0.35], [x + r * 0.5, y + r * 0.4], [x - r * 0.5, y + r * 0.4]]];
}
function rattlesnakeMaster(stage: GrowingStage): string {
	const k = stage === "sprout" ? 0.55 : stage === "leafy" ? 0.85 : 1;
	const A = [-152, -110, -68, -30].map((a) => leafSub(40, 86, a, 27 * k * (1 - Math.abs(a + 90) / 250), 2.2 * k, 1)).join("");
	const B = [-132, -90, -48].map((a) => leafSub(40, 86, a, 28 * k * (1 - Math.abs(a + 90) / 250), 2.2 * k, 1)).join("");
	const straps = p(A, ERY.a) + p(B, ERY.b);
	if (stage === "sprout") return straps;
	const balls: XY[] = stage === "leafy" ? [[40, 44], [36, 47], [44, 47]] : [[40, 20], [31, 26], [49, 25], [24, 35], [56, 34]];
	const r = stage === "leafy" ? 1.8 : 3.6;
	const fork = stage === "leafy" ? 52 : 46;
	let br = seg(40, 86, 40, fork);
	let ticks = "";
	let body = "";
	const ds: XY[] = [];
	for (const [x, y] of balls) {
		br += qs(40, fork, x, fork - 2, x, y);
		const [t, b, d] = eryBall(x, y, r);
		ticks += t;
		body += b;
		ds.push(...d);
	}
	const sl = p(leafSub(40, 70, -58, 9 * k, 1.3, 1) + leafSub(40, 62, -122, 8 * k, 1.2, 1), ERY.a);
	return straps + sk(br, ERY.stalk, 1.5) + sl + sk(ticks, ERY.tick, 0.8) + p(body, ERY.ball) + (stage === "bloom" ? dots(ds, ERY.dot, 1.1) : "");
}

/* ---------- 7. Prairie smoke ---------- */
const GEU = { leaf: "#6f9a55", rib: "#4a7a3a", stem: "#9c4a60", plume: "#e2a6bb", light: "#f2d0dc", bell: "#b2445f", calyx: "#8a3048" };
function smokeRosette(k: number): string {
	let rib = "";
	let lf = "";
	for (const a of [-168, -140, -112, -68, -40, -12]) {
		const [r, l] = pinS(40, 86, a, 15 * k * (0.75 + 0.25 * Math.abs(Math.sin(a * D))), 5, 3.4 * k, 62);
		rib += r;
		lf += l;
	}
	return sk(lf, GEU.leaf, 2 * k) + sk(rib, GEU.rib, 0.8);
}
function nodder(x: number, y: number): [string, string] {
	return [qs(40, 84, x - 2, y - 12, x, y), `M${f(x - 2)} ${f(y)}Q${f(x)} ${f(y - 1.5)} ${f(x + 2)} ${f(y)}L${f(x + 1.4)} ${f(y + 5)}Q${f(x)} ${f(y + 5.8)} ${f(x - 1.4)} ${f(y + 5)}Z`];
}
function prairieSmoke(stage: GrowingStage): string {
	if (stage === "sprout") return smokeRosette(0.8);
	if (stage === "leafy") {
		const n = [nodder(30, 56), nodder(42, 50), nodder(51, 58)];
		return smokeRosette(1.05) + sk(n.map((v) => v[0]).join(""), GEU.stem, 1) + p(n.map((v) => v[1]).join(""), GEU.bell);
	}
	const tips: XY[] = [[25, 50], [33, 42], [44, 39], [54, 46]];
	let st = "";
	let body = "";
	let pl = "";
	let li = "";
	tips.forEach(([x, y]) => {
		const lean = -90 + (x - 40) * 1.6;
		st += qs(40, 84, x + (40 - x) * 0.5, y + 16, x, y);
		body += lensSub(x, y, lean, 14, 3);
		for (let j = 0; j < 5; j++) {
			const a = lean - 24 + j * 12;
			const e = pt(x, y, a, 13 + (j % 2) * 3, 0);
			const c = pt(x, y, a + (j < 2 ? -14 : 14), 8, 0);
			const w = qs(x, y, c[0], c[1], e[0], e[1]);
			if (j % 2) li += w;
			else pl += w;
		}
	});
	const n = nodder(37, 60);
	return smokeRosette(1.15) + sk(st + n[0], GEU.stem, 1) + p(n[1], GEU.bell) + p(body, GEU.plume) + sk(pl, "#cf7f9c", 0.8) + sk(li, GEU.light, 0.9) + dots(tips, GEU.calyx, 2.6);
}

/* ---------- 8. Pale purple coneflower ---------- */
const PAL = { petal: "#eec3da", shade: "#d49dbd", cone: "#6a3424", tip: "#c0712a", leaf: "#7a9d62" };
function paleHead(x: number, y: number, k: number): string {
	return p(droopRing(x, y - 0.4, 6, 13 * k, 0.95 * k, 54, 126), PAL.shade) + p(droopRing(x, y, 7, 14 * k, 1 * k, 62, 118), PAL.petal) + dome(x, y + 0.5, 3.6 * k, 4.2 * k, PAL.cone) + dots([[x - 1.6 * k, y - 1.4 * k], [x + 1.6 * k, y - 1.4 * k], [x, y - 2.8 * k]], PAL.tip, 0.9 * k);
}
function paleConeflower(stage: GrowingStage): string {
	const k = stage === "sprout" ? 0.7 : 1;
	const base = p([-162, -136, -112, -68, -44, -18].map((a) => leafSub(40, 86, a, 22 * k * (0.7 + 0.3 * Math.abs(Math.sin(a * D))), 1.9 * k, 1)).join(""), PAL.leaf);
	if (stage === "sprout") return base;
	if (stage === "leafy") return sk(qs(40, 86, 39, 64, 41, 44), "#557a3e", 1.3) + base + dome(41, 44.5, 2.4, 2.8, "#8e7a4a") + p(droopRing(41, 44, 4, 3.5, 0.8, 40, 140), "#b2c48e");
	return sk(qs(40, 86, 38, 52, 33, 26) + qs(40, 86, 43, 46, 48, 17), "#557a3e", 1.3) + base + p(leafSub(39, 70, -140, 8, 1.4, 1) + leafSub(41.5, 64, -40, 7, 1.3, 1), PAL.leaf) + paleHead(33, 26, 0.95) + paleHead(48, 17, 1);
}

/* ---------- 9. Leadplant ---------- */
const AMO = { stem: "#7a6655", leaf: "#a9bba5", rib: "#7f937b", spike: "#5b3f97", hi: "#7a5cb4", anther: "#f0a23a" };
function leadplant(stage: GrowingStage): string {
	const tips: XY[] = [[23, 44], [31, 32], [41, 25], [51, 31], [58, 44]];
	const k = stage === "sprout" ? 0.32 : stage === "leafy" ? 0.7 : 1;
	const tt = stage === "sprout" ? [[40, 70] as XY] : grow(tips, k);
	const qq = stems(tt, 0.2, 0.55);
	let rib = "";
	let lf = "";
	const ts = stage === "sprout" ? [0.45, 0.85] : [0.45, 0.72, 0.95];
	qq.forEach((q, j) =>
		ts.forEach((t, i) => {
			const [x, y, a] = qAt(q, t);
			const [r, l] = pinS(x, y, a + ((i + j) % 2 ? 48 : -48), stage === "sprout" ? 8 : 10, stage === "sprout" ? 4 : 5, 2.4, 62);
			rib += r;
			lf += l;
		}),
	);
	let s = sk(qd(qq), AMO.stem, stage === "sprout" ? 1.2 : 1.5) + sk(rib, AMO.rib, 0.6) + sk(lf, AMO.leaf, 1.7);
	if (stage !== "bloom") return s;
	let sp = "";
	let hi = "";
	const an: XY[] = [];
	tips.forEach(([x, y], i) => {
		const [, , a] = qAt(qq[i] ?? [], 1);
		const L = i === 2 ? 15 : 12;
		sp += ray(x, y, a, L, -1);
		hi += ray(x + 0.5, y, a, L - 3, 2);
		for (let j = 0; j < 3; j++) an.push(pt(x, y, a, 3 + j * 3.5, (j % 2 ? 1 : -1) * 1.9));
	});
	return s + sk(sp, AMO.spike, 3.6) + sk(hi, AMO.hi, 1.2) + dots(an, AMO.anther, 1.3);
}

/* ---------- 10. Prairie dropseed ---------- */
const SPO = { a: "#6c9b4a", b: "#93b866", stem: "#b9a27c", seedA: "#cfb386", seedB: "#c0917c" };
function mound(R: number, H: number, n: number, j: number): string {
	let d = "";
	for (let i = 0; i < n; i++) {
		const a = (-174 + (168 * i) / (n - 1)) * D;
		const sn = -Math.sin(a);
		const x0 = 40 + (i - n / 2) * 0.12;
		const r = R * (0.88 + 0.12 * jit(i + j));
		d += qs(x0, 87, 40 + Math.cos(a) * r * 0.5, 87 - H * (0.55 + 0.6 * sn), 40 + Math.cos(a) * r, 87 - H * sn * 0.9 - 1);
	}
	return d;
}
function dropseed(stage: GrowingStage): string {
	const [R, H] = stage === "sprout" ? [9, 14] : stage === "leafy" ? [24, 32] : [27, 36];
	const g = sk(mound(R, H, 15, 0), SPO.a, 0.9) + sk(mound(R * 0.82, H * 0.92, 12, 7), SPO.b, 0.8);
	if (stage !== "bloom") return g;
	const tips: XY[] = [[22, 46], [28, 38], [35, 33], [42, 31], [49, 34], [55, 39], [60, 47]];
	let st = "";
	const A: XY[] = [];
	const B: XY[] = [];
	tips.forEach(([x, y], i) => {
		st += qs(40, 80, x + (40 - x) * 0.3, y + 16, x, y);
		for (let j = 0; j < 7; j++) {
			const t = j / 7;
			(j % 2 ? A : B).push([x + (x - 40) * 0.06 * j + jit(i * 9 + j) * 2.6, y + t * 9 + jit(i * 7 + j + 3) * 1.4]);
		}
	});
	return sk(st, SPO.stem, 0.5) + g + dots(A, SPO.seedA, 1.4) + dots(B, SPO.seedB, 1.3);
}

/* ---------- 11. Big bluestem ---------- */
const AND = { a: "#6f9a90", b: "#8db0a5", red: "#9a6670", stem: "#7a4a5e", foot: "#86426c", anther: "#e0b84a" };
function bigBluestem(stage: GrowingStage): string {
	if (stage === "sprout") return blade(39, 33, 70, AND.a, 1.4) + blade(41, 47, 68, AND.b, 1.4) + blade(40, 40, 66, AND.a, 1.3);
	const k = stage === "leafy" ? 0.75 : 1;
	const bl = (x0: number, tx: number, ty: number, c: string, w = 1.5) => blade(x0, 40 + (tx - 40) * k, 87 - (87 - ty) * k, c, w);
	let s = bl(37, 22, 50, AND.a) + bl(43, 59, 48, AND.a) + bl(38, 28, 32, AND.b) + bl(42, 52, 30, AND.b) + bl(40, 36, 26, AND.a, 1.6) + bl(41, 46, 38, AND.red, 1.4) + bl(39, 31, 56, AND.red, 1.3) + bl(40, 45, 22, AND.b, 1.4);
	if (stage === "leafy") return s;
	const tops: XY[] = [[33, 18], [43, 14], [51, 21]];
	let ft = "";
	const an: XY[] = [];
	for (const [x, y] of tops) {
		for (const a of [-122, -90, -58]) {
			ft += lensSub(x, y, a, 12, 1.15);
			an.push(pt(x, y, a, 5, 1.2), pt(x, y, a, 8, -1));
		}
	}
	s += sk(tops.map(([x, y]) => qs(40, 86, 40, 50, x, y)).join(""), AND.stem, 1.1);
	return s + p(ft, AND.foot) + dots(an, AND.anther, 0.9);
}

/* ---------- 12. Little bluestem ---------- */
const SCH = { blue: "#7c9f98", blue2: "#98b8ae", cu: "#c0703a", cu2: "#d68f50", stem: "#a4582e", tuft: "#f1ece2", edge: "#b8a68a" };
function littleBluestem(stage: GrowingStage): string {
	const k = stage === "sprout" ? 0.42 : stage === "leafy" ? 0.85 : 1;
	const [a, b] = stage === "bloom" ? [SCH.cu, SCH.cu2] : [SCH.blue, SCH.blue2];
	const bl = (x0: number, dx: number, h: number, c: string) => blade(x0, x0 + dx * k, 87 - h * k, c, 1.3);
	let s = bl(37, -12, 30, a) + bl(43, 12, 32, a) + bl(38, -7, 40, b) + bl(42, 7, 42, b) + bl(39, -3, 46, a) + bl(41, 3, 45, a) + bl(40, 1, 48, b);
	if (stage === "bloom") s = bl(36, -14, 24, SCH.blue) + s + bl(44, 13, 26, SCH.blue);
	if (stage !== "bloom") return s;
	const tops: XY[] = [[31, 30], [37, 25], [44, 26], [50, 31]];
	const T: XY[] = [];
	tops.forEach(([x, y]) => {
		for (let j = 0; j < 5; j++) T.push([x + (j % 2 ? 1.3 : -1.3) + (x - 40) * 0.03 * j, y + j * 3.6]);
	});
	return sk(tops.map(([x, y]) => qs(40, 86, 40 + (x - 40) * 0.3, 60, x, y)).join(""), SCH.stem, 0.9) + s + dots(T, SCH.edge, 2.7) + dots(T, SCH.tuft, 1.9);
}

/* ---------- 13. Indian blanket ---------- */
const GAI = { y: "#f2c230", r: "#c8352a", eye: "#7a2a1f", dot: "#4f1810", leaf: "#7d9c68" };
const TOOTH = [0, -0.9, 5.8, -2.7, 7, -1.8, 6.3, -0.9, 7.2, 0, 6.3, 0.9, 7, 1.8, 5.8, 2.7, 0, 0.9];
function gaiHead(x: number, y: number, k: number): string {
	let d = "";
	for (let i = 0; i < 9; i++) d += polySub(x, y, i * 40 + 10, k, TOOTH);
	return p(d, GAI.y) + sk(rays(x, y, 9, 2.4 * k, 4.4 * k, 10), GAI.r, 3.6 * k) + circle(x, y, 2.6 * k, GAI.eye) + dots(around(x, y, 5, 1.3 * k, 20), GAI.dot, 0.9 * k);
}
function indianBlanket(stage: GrowingStage): string {
	const k = stage === "sprout" ? 0.8 : 1;
	const mnd = p([-170, -148, -126, -104, -76, -54, -32, -10].map((a, i) => leafSub(40, 86, a, (12 + (i % 2) * 3) * k, 2.4 * k, 1)).join(""), GAI.leaf);
	if (stage === "sprout") return mnd;
	const heads: [number, number, number][] = stage === "leafy" ? [[33, 52, 0], [47, 47, 0]] : [[26, 48, 0.95], [52, 40, 1], [38, 33, 1.05]];
	const st = sk(heads.map(([x, y]) => qs(40, 84, 40 + (x - 40) * 0.2, (84 + y) / 2, x, y)).join(""), "#5f8a46", 1.2);
	const up = p(leafSub(36, 72, -150, 8, 1.8, 1) + leafSub(44, 70, -30, 8, 1.8, 1) + leafSub(41, 62, -60, 6, 1.5, 1), GAI.leaf);
	if (stage === "leafy") return st + mnd + up + heads.map(([x, y]) => circle(x, y, 2.6, "#8fae6a") + dots(around(x, y - 0.5, 4, 2.2, -135), "#d6a83a", 1.4)).join("");
	return st + mnd + up + heads.map(([x, y, s]) => gaiHead(x, y, s)).join("");
}

/* ---------- 14. Prairie phlox ---------- */
const PHL = { a: "#ec9fc7", b: "#d57caf", eye: "#a8407c", leaf: "#6b9e52" };
function phlox(stage: GrowingStage): string {
	const tips: XY[] = [[29, 36], [37, 28], [45, 30], [53, 38]];
	const tt = stage === "sprout" ? [[40, 69] as XY] : grow(tips, stage === "leafy" ? 0.7 : 1);
	const qq = stems(tt, 0.25, 0.5);
	let s = sk(qd(qq), GREEN.dark, 1.1) + p(alongLeaves(qq, stage === "sprout" ? [0.35, 0.65, 0.92] : [0.3, 0.5, 0.7, 0.88], 7, 1.3, 40, 1, true), PHL.leaf);
	if (stage === "sprout") return s;
	if (stage === "leafy") return s + dots(tt.flatMap(([x, y]) => [[x - 1.3, y - 1], [x + 1.3, y - 1], [x, y - 2.6]] as XY[]), "#c7d79b", 2);
	const A: XY[] = [];
	const B: XY[] = [];
	const E: XY[] = [];
	tips.forEach(([x, y], i) => {
		const fl: XY[] = [[x, y - 3.4], [x - 3.6, y - 0.6], [x + 3.6, y - 0.6], [x, y + 1.6]];
		fl.forEach(([fx, fy], j) => {
			((i + j) % 2 ? B : A).push(...around(fx, fy, 5, 1.6, -90 + j * 17));
			E.push([fx, fy]);
		});
	});
	return s + dots(A, PHL.a, 2.5) + dots(B, PHL.b, 2.5) + dots(E, PHL.eye, 1);
}

/* ---------- 15. Spiderwort ---------- */
const TRA = { leaf: "#6c9a80", leaf2: "#86b097", a: "#6a5fd0", b: "#8b80e0", stamen: "#f2d23a", bud: "#7d8a6a" };
function spiderwort(stage: GrowingStage): string {
	const k = stage === "sprout" ? 0.6 : stage === "leafy" ? 0.85 : 1;
	const base = p([-158, -126, -54, -22].map((a) => leafSub(40, 86, a, 24 * k, 1.9 * k, 1)).join(""), TRA.leaf) + p([-102, -78].map((a) => leafSub(40, 86, a, 22 * k, 1.8 * k, 1)).join(""), TRA.leaf2);
	if (stage === "sprout") return base;
	const tops: XY[] = stage === "leafy" ? [[35, 46], [46, 42]] : [[31, 32], [46, 26], [55, 40]];
	const st = sk(tops.map(([x, y]) => qs(40, 86, 40, (86 + y) / 2 + 6, x, y)).join(""), "#4f7a5a", 1.3);
	const nodeLv = p(leafSub(38, 62, -152, 18 * k, 1.6, 1) + leafSub(42, 58, -30, 18 * k, 1.6, 1) + leafSub(40, 52, -118, 14 * k, 1.4, 1), TRA.leaf2);
	const buds: XY[] = tops.flatMap(([x, y]) => [[x - 2.2, y + 2.6], [x + 2.4, y + 2.4], [x + 0.4, y + 3.4]] as XY[]);
	if (stage === "leafy") return base + st + nodeLv + dots(buds, TRA.bud, 2.4);
	const P1: XY[] = [];
	const P2: XY[] = [];
	const S: XY[] = [];
	tops.forEach(([x, y], i) => {
		P2.push(...around(x, y - 2, 3, 2.4, -90 + 60));
		P1.push(...around(x, y - 2, 3, 2.4, -90));
		S.push(...around(x, y - 2, 3, 0.9, -90 + 60 + i * 10));
	});
	return base + st + nodeLv + dots(buds, TRA.bud, 2.2) + dots(P2, TRA.b, 3) + dots(P1, TRA.a, 4.4) + dots(S, TRA.stamen, 1.1);
}

/* ---------- 16. Blue wild indigo ---------- */
const BAP = { a: "#6f9d93", b: "#89b3a8", stem: "#4b5c63", fl: "#3e4cae", fl2: "#5f6dcc" };
function trifol(x: number, y: number, deg: number, s: number): string {
	return ray(x, y, deg - 40, 4 * s, 1.4) + ray(x, y, deg, 4.6 * s, 1.4) + ray(x, y, deg + 40, 4 * s, 1.4);
}
function indigoBush(cx: number, cy: number, R: number, H: number): [string, string, string] {
	let a = "";
	let b = "";
	let st = "";
	let i = 0;
	for (const [rr, n] of [[1, 9], [0.62, 6], [0.25, 3]] as const) {
		for (let j = 0; j < n; j++, i++) {
			const ang = -175 + (170 * (j + 0.5)) / n + jit(i) * 6;
			const x = cx + Math.cos(ang * D) * R * rr;
			const y = cy + Math.sin(ang * D) * H * rr;
			const t = trifol(x, y, ang, 1);
			if (i % 2) a += t;
			else b += t;
			st += qs(40, 87, 40 + (x - 40) * 0.2, (87 + y) / 2, x, y);
		}
	}
	return [st, a, b];
}
function blueIndigo(stage: GrowingStage): string {
	if (stage === "sprout") return sk(seg(40, 87, 40, 72), BAP.stem, 1.2) + sk(trifol(40, 72, -90, 1.2) + trifol(40, 79, -150, 1) + trifol(40, 77, -30, 1), BAP.a, 2.8);
	const [R, H] = stage === "leafy" ? [16, 30] : [19, 34];
	const [st, a, b] = indigoBush(40, 84, R, H);
	const bush = sk(st, BAP.stem, 0.6) + sk(a, BAP.a, 2.5) + sk(b, BAP.b, 2.4);
	if (stage === "leafy") return bush;
	const tops: XY[] = [[30, 22], [40, 12], [50, 20]];
	let fa = "";
	let fb = "";
	tops.forEach(([x, y]) => {
		for (let j = 0; j < 7; j++) {
			const yy = y + j * 3.4;
			const side = j % 2 ? 1 : -1;
			const s = ray(x + side * 0.6, yy, side > 0 ? -25 : -155, 2.2);
			if (j % 2) fa += s;
			else fb += s;
		}
	});
	return sk(tops.map(([x, y]) => qs(40, 70, x, 55, x, y)).join(""), BAP.stem, 1.1) + bush + sk(fa, BAP.fl, 2.6) + sk(fb, BAP.fl2, 2.6);
}

/* ---------- 17. Goldenrod ---------- */
const SOL = { a: "#e5b220", b: "#f6d24c", leaf: "#6a9a4c" };
function goldenrod(stage: GrowingStage): string {
	const tips: XY[] = [[30, 32], [41, 22], [52, 30]];
	const tt = stage === "sprout" ? [[40, 68] as XY] : grow(tips, stage === "leafy" ? 0.7 : 1);
	const qq = stems(tt, 0.2, 0.5);
	let s = sk(qd(qq), GREEN.dark, 1.3) + p(alongLeaves(qq, stage === "sprout" ? [0.3, 0.55, 0.8, 1] : [0.25, 0.4, 0.55, 0.7, 0.85, 1], 9, 1.9, 42), SOL.leaf);
	if (stage !== "bloom") return s;
	let br = "";
	const A: XY[] = [];
	const B: XY[] = [];
	tips.forEach(([x, y], i) => {
		for (let j = -2; j <= 2; j++) {
			const q = [x, y + 6, x + j * 2.6, y - 6 + Math.abs(j), x + j * 5.4, y - 1 + Math.abs(j) * 3.4 - (j === 0 ? 3 : 0)];
			br += qs(q[0] ?? 0, q[1] ?? 0, q[2] ?? 0, q[3] ?? 0, q[4] ?? 0, q[5] ?? 0);
			for (let t = 0.3; t <= 1.01; t += 0.14) {
				const [px, py, a] = qAt(q, t);
				const ps = pt(px, py, a, 0, j < 0 ? 1 : j > 0 ? -1 : 0);
				((Math.round(t * 10) + i) % 2 ? A : B).push([ps[0], ps[1] - 0.6]);
			}
		}
	});
	return s + sk(br, "#8a9a3e", 0.8) + dots(A, SOL.a, 2.2) + dots(B, SOL.b, 2);
}

/* ---------- 18. New England aster ---------- */
const AST = { ray: "#8a56cc", shade: "#7442b4", eye: "#f2c230", leaf: "#5f9448" };
function newEnglandAster(stage: GrowingStage): string {
	const tips: XY[] = [[23, 44], [29, 34], [36, 26], [44, 25], [51, 30], [57, 40]];
	const tt = stage === "sprout" ? [[40, 68] as XY] : grow(tips, stage === "leafy" ? 0.72 : 1);
	const qq = stems(tt, 0.25, 0.5);
	let s = sk(qd(qq), "#4f7a3c", 1.1) + p(alongLeaves(qq, stage === "sprout" ? [0.3, 0.55, 0.8] : [0.35, 0.6, 0.85], 8, 1.6, 50, 1), AST.leaf);
	if (stage === "sprout") return s + p(leafSub(40, 86, -160, 8, 1.8, 1) + leafSub(40, 86, -20, 8, 1.8, 1), AST.leaf);
	if (stage === "leafy") return s + dots(tt, "#a7c27e", 2.6);
	const heads: XY[] = [...tips, [33, 42], [47, 38], [40, 33]];
	let sh = "";
	let ry = "";
	heads.forEach(([x, y], i) => {
		const r = i > 5 ? 4.6 : 5.2;
		if (i % 2) sh += rays(x, y, 13, 1.6, r, i * 5);
		else ry += rays(x, y, 13, 1.6, r, i * 5);
	});
	return s + sk(qd(stems(heads.slice(6), 0.3, 0.5, 40, 70)), "#4f7a3c", 1) + sk(sh, AST.shade, 1) + sk(ry, AST.ray, 1) + dots(heads, AST.eye, 3);
}

/* ---------- 19. Purple prairie clover ---------- */
const DAL = { stem: "#5f7d48", leaf: "#7f9e5e", cone: "#b5b68c", band: "#9b3b9e", fringe: "#c06cc0", anther: "#f2a33a" };
function prairieClover(stage: GrowingStage): string {
	const tips: XY[] = [[26, 40], [33, 30], [41, 25], [49, 29], [56, 40]];
	const tt = stage === "sprout" ? [[40, 70] as XY] : grow(tips, stage === "leafy" ? 0.72 : 1);
	const qq = stems(tt, 0.2, 0.55);
	let rib = "";
	let lf = "";
	qq.forEach((q, j) =>
		(stage === "sprout" ? [0.45, 0.85] : [0.35, 0.62]).forEach((t, i) => {
			const [x, y, a] = qAt(q, t);
			const [r, l] = pinS(x, y, a + ((i + j) % 2 ? 40 : -40), 7, 3, 3, 40);
			rib += r;
			lf += l;
		}),
	);
	const s = sk(qd(qq), DAL.stem, 1) + sk(rib + lf, DAL.leaf, 1.1);
	if (stage === "sprout") return s;
	if (stage === "leafy") return s + tt.map(([x, y]) => el(x, y - 2.6, 1.6, 3, "#a9b787")).join("");
	let cones = "";
	let band = "";
	const fr: XY[] = [];
	const an: XY[] = [];
	for (const [x, y] of tips) {
		cones += el(x, y - 4.4, 2.1, 4.6, DAL.cone);
		band += `M${f(x - 2.6)} ${f(y - 2.6)}Q${f(x)} ${f(y - 4)} ${f(x + 2.6)} ${f(y - 2.6)}L${f(x + 2.4)} ${f(y + 0.6)}Q${f(x)} ${f(y + 1.8)} ${f(x - 2.4)} ${f(y + 0.6)}Z`;
		fr.push([x - 3, y - 1.4], [x + 3, y - 1.4], [x - 2.8, y + 0.8], [x + 2.8, y + 0.8]);
		an.push([x - 1.2, y - 3.6], [x + 1.4, y - 3.3]);
	}
	return s + cones + p(band, DAL.band) + dots(fr, DAL.fringe, 1.3) + dots(an, DAL.anther, 1);
}

/* ---------- 20. Shooting star ---------- */
const DOD = { leaf: "#78a65c", petal: "#d9649a", petal2: "#e98bb6", band: "#f2d23a", beak: "#4a2638", stalk: "#6a7a4a" };
function shootingStar(stage: GrowingStage): string {
	const k = stage === "sprout" ? 0.65 : 1;
	const ros = p([-176, -150, -30, -4].map((a) => leafSub(40, 86, a, 14 * k, 3.6 * k, 0)).join("") + leafSub(40, 86, -118, 11 * k, 3 * k, 0) + leafSub(40, 86, -62, 11 * k, 3 * k, 0), DOD.leaf);
	if (stage === "sprout") return ros;
	const top = stage === "leafy" ? 48 : 30;
	let ped = seg(40, 86, 40, top);
	const fl: [number, number, number][] = [];
	for (const [dx, dy] of stage === "leafy" ? [[-5, 4], [0, 5], [5, 4]] : [[-15, 10], [-8.5, 7], [-2.5, 6], [4, 6.5], [10, 8], [16, 11]]) {
		const x = 40 + (dx ?? 0);
		const y = top + (dy ?? 0);
		ped += qs(40, top, 40 + (dx ?? 0) * 0.7, top - 5, x, y);
		fl.push([x, y, (dx ?? 0) * 1.8]);
	}
	const st = sk(ped, DOD.stalk, 1.1);
	if (stage === "leafy") return ros + st + fl.map(([x, y, t]) => el(x, y + 2, 1.2, 2.6, "#a6865c", t)).join("");
	let a = "";
	let b = "";
	let bk = "";
	const bd: XY[] = [];
	for (const [x, y, t] of fl) {
		a += lensSub(x, y, -90 + t - 17, 9, 1.6) + lensSub(x, y, -90 + t + 17, 9, 1.6);
		b += lensSub(x, y, -90 + t, 10, 1.6);
		bk += polySub(x, y, 90 + t, 1, [0, -1.4, 5, 0, 0, 1.4]);
		bd.push([x, y]);
	}
	return ros + st + p(a, DOD.petal) + p(b, DOD.petal2) + p(bk, DOD.beak) + dots(bd, DOD.band, 2.8);
}

/* ---------- 21. Mexican hat ---------- */
const RAT = { y: "#f0c22e", r: "#b8322a", col: "#5c2c1e", dot: "#7e4430", leaf: "#7a9a66" };
function hat(x: number, y: number, k: number): string {
	let yd = "";
	let rd = "";
	for (const a of [35, 62, 90, 118, 145]) {
		yd += lensSub(x, y, a, 8 * k, 2 * k);
		rd += lensSub(x, y, a, 5.2 * k, 1.8 * k);
	}
	const w = 1.9 * k;
	const h = 9 * k;
	return p(yd, RAT.y) + p(rd, RAT.r) + p(`M${f(x - w)} ${f(y + 0.5)}L${f(x - w)} ${f(y - h + w)}A${f(w)} ${f(w)} 0 0 1 ${f(x + w)} ${f(y - h + w)}L${f(x + w)} ${f(y + 0.5)}Z`, RAT.col) + dots([[x - 0.7 * k, y - 2 * k], [x + 0.7 * k, y - 4.5 * k], [x - 0.6 * k, y - 7 * k]], RAT.dot, 0.9 * k);
}
function mexicanHat(stage: GrowingStage): string {
	const k = stage === "sprout" ? 0.6 : 1;
	let rib = "";
	let lf = "";
	for (const a of stage === "sprout" ? [-140, -95, -45] : [-160, -128, -96, -64, -28]) {
		const [r, l] = pinS(40, 86, a, 14 * k, 3, 5 * k, 50);
		rib += r;
		lf += l;
	}
	const base = sk(lf + rib, RAT.leaf, 1.4);
	if (stage === "sprout") return base;
	const heads: XY[] = stage === "leafy" ? [[34, 50], [46, 46]] : [[28, 40], [44, 25], [55, 41]];
	const st = sk(heads.map(([x, y]) => qs(40, 85, 40 + (x - 40) * 0.2, (85 + y) / 2, x, y)).join(""), "#5f8048", 1);
	if (stage === "leafy") return base + st + heads.map(([x, y]) => el(x, y - 2, 1.4, 2.6, "#8a9a5a")).join("");
	return base + st + heads.map(([x, y], i) => hat(x, y, i === 1 ? 1.05 : 0.9)).join("");
}

/* ---------- 22. Cup plant ---------- */
const SPF = { leaf: "#64a04e", rib: "#3f7a35", cup: "#3f7232", stem: "#4f8a3a", y: "#f4c63a", ys: "#dca526", eye: "#c49a2a" };
function cupPair(y: number, len: number, w: number): string {
	return leafSub(38.6, y, -172, len, w, 4) + leafSub(41.4, y, -8, len, w, 4);
}
function cupPlant(stage: GrowingStage): string {
	if (stage === "sprout") return sk(seg(40, 87, 40, 74), SPF.stem, 1.8) + p(cupPair(76, 9, 3.6), SPF.leaf) + dome(40, 76, 2.4, -1.6, SPF.cup);
	const nodes: [number, number, number][] = stage === "leafy" ? [[76, 17, 6], [60, 15, 5.4], [46, 11, 4.2]] : [[78, 18, 6.4], [62, 17, 6], [47, 14, 5], [34, 10, 3.6]];
	const top = stage === "leafy" ? 40 : 18;
	let s = sk(seg(40, 87, 40, top), SPF.stem, 2.2) + p(nodes.map(([y, l, w]) => cupPair(y, l, w)).join(""), SPF.leaf);
	s += sk(nodes.map(([y, l]) => ray(38.6, y, -172, l * 0.8) + ray(41.4, y, -8, l * 0.8)).join(""), SPF.rib, 0.7);
	s += p(nodes.map(([y]) => `M${f(36.8)} ${f(y - 0.6)}Q40 ${f(y + 3.2)} 43.2 ${f(y - 0.6)}Z`).join(""), SPF.cup);
	if (stage === "leafy") return s + circle(40, top - 1.5, 2.2, "#9dc27a");
	const c = { y: SPF.y, ys: SPF.ys, eye: SPF.eye };
	return s + sk(seg(40, 26, 30, 21) + seg(40, 26, 50, 20), SPF.stem, 1.2) + sunHead(30, 21, 0.85, 11, c) + sunHead(50, 20, 0.85, 11, c) + sunHead(40, 13, 1.05, 11, c);
}

/* ---------- 23. Prairie onion ---------- */
const ALL = { leaf: "#7aa35e", scape: "#6a9550", ped: "#9c8aa0", a: "#e19ac2", b: "#c86aa2" };
function prairieOnion(stage: GrowingStage): string {
	const k = stage === "sprout" ? 0.6 : 1;
	const lv = sk(tuft(40, 86, 6, -150, -30, 22 * k, 0.35, 4), ALL.leaf, 1.3);
	if (stage === "sprout") return lv;
	const tops: XY[] = stage === "leafy" ? [[36, 46], [45, 42]] : [[31, 33], [42, 24], [52, 35]];
	const st = sk(tops.map(([x, y]) => qs(40, 86, 40 + (x - 40) * 0.2, 60, x, y)).join(""), ALL.scape, 1.1);
	if (stage === "leafy") return lv + st + tops.map(([x, y]) => el(x, y - 3, 2, 3.4, "#c9d6b0")).join("");
	let ped = "";
	const A: XY[] = [];
	const B: XY[] = [];
	tops.forEach(([x, y]) => {
		for (let j = 0; j < 11; j++) {
			const a = -200 + j * 22;
			const e = pt(x, y - 0.5, a, 6.2, 0);
			ped += seg(x, y - 0.5, e[0], e[1]);
			(j % 2 ? A : B).push(e);
		}
	});
	return lv + st + sk(ped, ALL.ped, 0.5) + dots(A, ALL.a, 2.6) + dots(B, ALL.b, 2.4);
}

/* ---------- 24. Downy gentian ---------- */
const GEN = { a: "#3b4fb8", b: "#5b6fd4", leaf: "#5f9048", stem: "#4f7a3c" };
const VASE = [-1, 0, -2.9, -6.6, -2.2, -8.2, -1.1, -6.9, 0, -8.8, 1.1, -6.9, 2.2, -8.2, 2.9, -6.6, 1, 0];
function gentian(stage: GrowingStage): string {
	const tips: XY[] = [[31, 36], [40, 28], [49, 35]];
	const tt = stage === "sprout" ? [[40, 70] as XY] : grow(tips, stage === "leafy" ? 0.72 : 1);
	const qq = stems(tt, 0.3, 0.5);
	const s = sk(qd(qq), GEN.stem, 1.2) + p(alongLeaves(qq, stage === "sprout" ? [0.35, 0.7, 1] : [0.25, 0.45, 0.65, 0.85], 7, 2.4, 45, 1, true), GEN.leaf);
	if (stage === "sprout") return s;
	if (stage === "leafy") return s + dots(tt, "#7d8fb6", 2.4);
	let a = "";
	let b = "";
	qq.forEach((q, i) => {
		const [x, y, h] = qAt(q, 1);
		a += polySub(x, y + 1, h + 90, 1.05, VASE) + polySub(x - 2.6, y + 3, h + 68, 0.9, VASE);
		b += polySub(x + 2.6, y + 3, h + 112, 0.9, VASE);
		const [mx, my, mh] = qAt(q, 0.78);
		b += polySub(mx, my, mh + 90 + (i - 1) * 30, 0.75, VASE);
	});
	return s + p(a, GEN.a) + p(b, GEN.b);
}

/* ---------- 25. Partridge pea ---------- */
const CHA = { leaf: "#86b860", rib: "#4f8a3a", y: "#f5c518", eye: "#c0392b", pod: "#8a6242" };
function partridgePea(stage: GrowingStage): string {
	const tips: XY[] = [[25, 42], [34, 32], [45, 30], [55, 40]];
	const tt = stage === "sprout" ? [[40, 70] as XY] : grow(tips, stage === "leafy" ? 0.72 : 1);
	const qq = stems(tt, 0.2, 0.55);
	let rib = "";
	let lf = "";
	const ts = stage === "sprout" ? [0.5, 0.95] : [0.35, 0.6, 0.85];
	qq.forEach((q, j) =>
		ts.forEach((t, i) => {
			const [x, y, a] = qAt(q, t);
			const [r, l] = pinS(x, y, a + ((i + j) % 2 ? 50 : -50), 10, 6, 2.4, 75);
			rib += r;
			lf += l;
		}),
	);
	const s = sk(qd(qq), "#6a8a3e", 1.2) + sk(rib, CHA.rib, 0.6) + sk(lf, CHA.leaf, 1.4);
	if (stage === "sprout") return s;
	if (stage === "leafy") return s + dots(qq.map((q) => qAt(q, 0.75).slice(0, 2) as XY), "#c9c46a", 2.2);
	const Y: XY[] = [];
	const E: XY[] = [];
	let pods = "";
	qq.forEach((q, i) => {
		for (const t of [0.72, 1]) {
			const [x, y] = qAt(q, t);
			const fx = x + (t === 1 ? 0 : i < 2 ? -3 : 3);
			const fy = y - (t === 1 ? 2.5 : 1);
			Y.push(...around(fx, fy, 5, 2, -90));
			E.push([fx, fy]);
		}
		const [x, y, a] = qAt(q, 0.5);
		pods += lensSub(x, y, a + (i < 2 ? -35 : 35), 8, 1.1);
	});
	return s + p(pods, CHA.pod) + dots(Y, CHA.y, 3.2) + dots(E, CHA.eye, 1.4);
}

/* ---------- registry ---------- */

export const SPECIES: Species[] = [
	{ id: "purple-coneflower", name: "Purple coneflower", draw: purpleConeflower },
	{ id: "prairie-blazing-star", name: "Prairie blazing star", draw: blazingStar },
	{ id: "butterfly-weed", name: "Butterfly weed", draw: butterflyWeed },
	{ id: "wild-bergamot", name: "Wild bergamot", draw: bergamot },
	{ id: "compass-plant", name: "Compass plant", draw: compassPlant },
	{ id: "rattlesnake-master", name: "Rattlesnake master", draw: rattlesnakeMaster },
	{ id: "prairie-smoke", name: "Prairie smoke", draw: prairieSmoke },
	{ id: "pale-purple-coneflower", name: "Pale purple coneflower", draw: paleConeflower },
	{ id: "leadplant", name: "Leadplant", draw: leadplant },
	{ id: "prairie-dropseed", name: "Prairie dropseed", draw: dropseed },
	{ id: "big-bluestem", name: "Big bluestem", draw: bigBluestem },
	{ id: "little-bluestem", name: "Little bluestem", draw: littleBluestem },
	{ id: "indian-blanket", name: "Indian blanket", draw: indianBlanket },
	{ id: "prairie-phlox", name: "Prairie phlox", draw: phlox },
	{ id: "spiderwort", name: "Spiderwort", draw: spiderwort },
	{ id: "blue-wild-indigo", name: "Blue wild indigo", draw: blueIndigo },
	{ id: "goldenrod", name: "Goldenrod", draw: goldenrod },
	{ id: "new-england-aster", name: "New England aster", draw: newEnglandAster },
	{ id: "purple-prairie-clover", name: "Purple prairie clover", draw: prairieClover },
	{ id: "shooting-star", name: "Shooting star", draw: shootingStar },
	{ id: "mexican-hat", name: "Mexican hat", draw: mexicanHat },
	{ id: "cup-plant", name: "Cup plant", draw: cupPlant },
	{ id: "prairie-onion", name: "Prairie onion", draw: prairieOnion },
	{ id: "downy-gentian", name: "Downy gentian", draw: gentian },
	{ id: "partridge-pea", name: "Partridge pea", draw: partridgePea },
];
