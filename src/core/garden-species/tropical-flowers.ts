/**
 * Garden species, family: tropical flowers. Each draws sprout, leafy and
 * bloom in the kit's flat style (see kit.ts); the kit draws soil and seed.
 * Same-colour shapes are merged into one <path> per colour to keep markup
 * small; dots are zero-length round-capped strokes.
 */
import { BARK, f, type GrowingStage, type Pt, type Species } from "./kit";

/* ---------- private helpers ---------- */

const RAD = Math.PI / 180;

/** A filled path. */
function p(d: string, fill: string): string {
	return d ? `<path d="${d}" fill="${fill}"/>` : "";
}

/** A stroked path with round caps. */
function sk(d: string, stroke: string, w: number, extra = ""): string {
	return d ? `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${f(w)}" stroke-linecap="round" stroke-linejoin="round"${extra}/>` : "";
}

const FAINT = ` opacity=".5"`;

/** Round dots of radius r at the given points, as one stroke. */
function dots(pts: readonly Pt[], r: number, fill: string): string {
	return sk(pts.map(([x, y]) => `M${ns(x, y)}h0`).join(""), fill, r * 2);
}

/** Compact number: one decimal, no leading zero. */
const n = (v: number): string => f(v).replace(/^(-?)0\./, "$1.");

/** Numbers joined compactly (a minus sign separates on its own). */
function ns(...vs: number[]): string {
	let s = "";
	for (const v of vs) {
		const t = n(v);
		s += s && t[0] !== "-" ? ` ${t}` : t;
	}
	return s;
}

/** Point at distance len from (x, y) heading deg. */
function at(x: number, y: number, deg: number, len: number): [number, number] {
	return [x + Math.cos(deg * RAD) * len, y + Math.sin(deg * RAD) * len];
}

/** Subpath of a straight segment. */
function segD(x: number, y: number, x2: number, y2: number): string {
	return `M${ns(x, y)}l${ns(x2 - x, y2 - y)}`;
}

/** Subpath of a rotated ellipse. */
function ovalD(cx: number, cy: number, rx: number, ry: number, rot = 0): string {
	const r = rot * RAD;
	const dx = Math.cos(r) * rx;
	const dy = Math.sin(r) * rx;
	const a = `a${ns(rx, ry, rot)} 1 0`;
	return `M${ns(cx + dx, cy + dy)}${a} ${ns(-2 * dx, -2 * dy)}${a} ${ns(2 * dx, 2 * dy)}Z`;
}

/** Subpath of a pointed lens from (x, y) heading deg. */
function lensD(x: number, y: number, deg: number, len: number, w: number): string {
	const c = Math.cos(deg * RAD);
	const s = Math.sin(deg * RAD);
	const mx = c * len * 0.45;
	const my = s * len * 0.45;
	const k = w * 1.25;
	const ex = c * len;
	const ey = s * len;
	return `M${ns(x, y)}q${ns(mx - s * k, my + c * k, ex, ey)}q${ns(mx + s * k - ex, my - c * k - ey, -ex, -ey)}Z`;
}

/** Maps local (u along, v across) rotated by deg to a relative vector. */
function rot(deg: number): (u: number, v: number) => [number, number] {
	const c = Math.cos(deg * RAD);
	const s = Math.sin(deg * RAD);
	return (u, v) => [c * u - s * v, s * u + c * v];
}

/** Signed droop so a leaf always bends towards the ground. */
const droopSign = (deg: number, d: number): number => (Math.cos(deg * RAD) < 0 ? -d : d);

const SHAPES = { 0: [0.3, 1, 0.8, 1], 1: [0.45, 1.15, 0.8, 0.5], 2: [0.05, 1.4, 1.02, 1.3] } as const;

/** Subpath of a leaf (0 oval, 1 pointed, 2 round) whose tip bends `droop` towards the ground. */
function leafD(x: number, y: number, deg: number, len: number, w: number, shape: 0 | 1 | 2 = 0, droop = 0): string {
	const V = rot(deg);
	const d = droopSign(deg, droop);
	const [a, b, c, e] = SHAPES[shape];
	const T = V(len, d);
	const r = (u: number, v: number): [number, number] => {
		const [px, py] = V(u, v);
		return [px - T[0], py - T[1]];
	};
	return `M${ns(x, y)}c${ns(...V(len * a, -w * b + d * 0.35), ...V(len * c, -w * e + d * 0.75), ...T)}c${ns(...r(len * c, w * e + d * 0.75), ...r(len * a, w * b + d * 0.35), -T[0], -T[1])}Z`;
}

/** Subpath of a leaf's midrib (matches leafD). */
function ribD(x: number, y: number, deg: number, len: number, droop = 0): string {
	const V = rot(deg);
	const d = droopSign(deg, droop);
	const [sx, sy] = V(len * 0.08, 0);
	const [cx, cy] = V(len * 0.55, d * 0.4);
	const [ex, ey] = V(len * 0.85, d * 0.75);
	return `M${ns(x + sx, y + sy)}q${ns(cx - sx, cy - sy, ex - sx, ey - sy)}`;
}

/** Point on a quadratic. */
function q(a: Pt, c: Pt, b: Pt, t: number): [number, number] {
	const u = 1 - t;
	return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]];
}

/** Tangent angle (degrees) of a quadratic. */
function qa(a: Pt, c: Pt, b: Pt, t: number): number {
	const dx = 2 * (1 - t) * (c[0] - a[0]) + 2 * t * (b[0] - c[0]);
	const dy = 2 * (1 - t) * (c[1] - a[1]) + 2 * t * (b[1] - c[1]);
	return Math.atan2(dy, dx) / RAD;
}

/** Subpath of a quadratic. */
function qD(a: Pt, c: Pt, b: Pt): string {
	return `M${f(a[0])} ${f(a[1])}Q${f(c[0])} ${f(c[1])} ${f(b[0])} ${f(b[1])}`;
}

/** A small star of n round spokes (a 4- or 5-petalled floret), as stroke subpaths. */
function starD(x: number, y: number, k: number, r: number, off = -90): string {
	let d = `M${ns(x, y)}`;
	for (let i = 0; i < k; i++) {
		const [ex, ey] = at(0, 0, off + (i * 360) / k, r);
		d += `l${ns(ex, ey)}` + (i < k - 1 ? `m${ns(-ex, -ey)}` : "");
	}
	return d;
}

/** Subpath chain of k petal dots (zero-length strokes) at distance r around (x, y). */
function petalD(x: number, y: number, k: number, r: number, off = -90): string {
	let d = `M${ns(x, y)}`;
	let px = 0;
	let py = 0;
	for (let i = 0; i < k; i++) {
		const [ex, ey] = at(0, 0, off + (i * 360) / k, r);
		d += `m${ns(ex - px, ey - py)}h0`;
		px = ex;
		py = ey;
	}
	return d;
}

/** A group translated to (x, y) and rotated. */
function g(x: number, y: number, body: string, rot = 0, k = 1): string {
	return `<g transform="translate(${f(x)} ${f(y)})${rot ? ` rotate(${f(rot)})` : ""}${k !== 1 ? ` scale(${f(k)})` : ""}">${body}</g>`;
}

interface Palette {
	leaf: string;
	light: string;
	dark: string;
	stem?: string;
}

/** Foliage parts: stems (stroke), two leaf fills and midribs. */
interface Foliage {
	stems: string;
	a: string;
	b: string;
	rib: string;
}

const join = (fs: readonly Foliage[]): Foliage => ({
	stems: fs.map((x) => x.stems).join(""),
	a: fs.map((x) => x.a).join(""),
	b: fs.map((x) => x.b).join(""),
	rib: fs.map((x) => x.rib).join(""),
});

function paint(fo: Foliage, c: Palette, sw = 1.8): string {
	return sk(fo.stems, c.stem ?? c.dark, sw) + p(fo.b, c.leaf) + p(fo.a, c.light) + sk(fo.rib, c.dark, 0.6, FAINT);
}

/**
 * A ginger-like cane from a (control c) to tip with n alternate leaves from
 * t = from; leaves lean ang0° from vertical at the bottom, ang1° at the top.
 */
function cane(a: Pt, c: Pt, tip: Pt, n: number, len: number, w: number, from = 0.3, side0: 1 | -1 = 1, droop = 0.3, ang0 = 72, ang1 = 22): Foliage {
	let A = "";
	let B = "";
	let rib = "";
	for (let i = 0; i < n; i++) {
		const t = from + ((1 - from) * i) / Math.max(1, n - 1);
		const [x, y] = q(a, c, tip, t);
		const s = i % 2 ? -side0 : side0;
		const lean = ang0 - (ang0 - ang1) * t;
		const deg = -90 + s * lean;
		const L = len * (1 - 0.35 * Math.abs(t - 0.5));
		const d = L * droop * (1 - 0.5 * t);
		if (s > 0) A += leafD(x, y, deg, L, w, 1, d);
		else B += leafD(x, y, deg, L, w, 1, d);
		rib += ribD(x, y, deg, L, d);
	}
	return { stems: qD(a, c, tip), a: A, b: B, rib };
}

type Br = readonly [Pt, Pt, Pt];

/** Branches with opposite leaf pairs at each t, plus an optional tip leaf. */
function shrub(brs: readonly Br[], ts: readonly number[], len: number, w: number, shape: 0 | 1 | 2, spread: number, droop = 0, tip = true): Foliage {
	let stems = "";
	let A = "";
	let B = "";
	let rib = "";
	for (const [a, c, b] of brs) {
		stems += qD(a, c, b);
		for (const t of ts) {
			const [x, y] = q(a, c, b, t);
			const ang = qa(a, c, b, t);
			const L = len * (1 - 0.2 * t);
			for (const s of [1, -1]) {
				const deg = ang + s * spread;
				if (s > 0) A += leafD(x, y, deg, L, w, shape, L * droop);
				else B += leafD(x, y, deg, L, w, shape, L * droop);
				if (len >= 11) rib += ribD(x, y, deg, L, L * droop);
			}
		}
		if (tip) {
			const ang = qa(a, c, b, 1);
			B += leafD(b[0], b[1], ang, len * 0.7, w * 0.85, shape);
			if (len >= 11) rib += ribD(b[0], b[1], ang, len * 0.7);
		}
	}
	return { stems, a: A, b: B, rib };
}

/** Scales branches about the root (40, 86). */
function sc(brs: readonly Br[], k: number, kx = k): Br[] {
	const m = (pt: Pt): Pt => [40 + (pt[0] - 40) * kx, 86 - (86 - pt[1]) * k];
	return brs.map(([a, c, b]) => [m(a), m(c), m(b)] as const);
}

const tips = (brs: readonly Br[]): Pt[] => brs.map((b) => b[2]);

/* ---------- 1. Torch ginger ---------- */
const TG = { leaf: "#5c9c4c", light: "#78b25e", dark: "#3b7232", red: "#d42a3e", pink: "#ef6a86", deep: "#9e1a30", hi: "#e8506a" };
function torchHead(x: number, y: number): string {
	let o = "";
	let m = "";
	for (let i = 0; i < 10; i++) o += lensD(x, y + 3, -180 + i * 20, 14, 3.9);
	o += lensD(x, y + 3, 155, 11, 3) + lensD(x, y + 3, 25, 11, 3);
	for (let i = 0; i < 7; i++) m += lensD(x, y + 2, -165 + i * 25, 10, 3);
	const scales = `M${x - 3.6} ${y - 3}Q${x} ${y - 0.6} ${x + 3.6} ${y - 3}M${x - 4.3} ${y + 1.5}Q${x} ${y + 3.8} ${x + 4.3} ${y + 1.5}M${x - 2.4} ${y - 7.6}Q${x} ${y - 6} ${x + 2.4} ${y - 7.6}`;
	return p(o, TG.pink) + p(m, TG.red) + p(ovalD(x, y - 1.5, 5.2, 7.8), TG.deep) + sk(scales, TG.hi, 0.9);
}
function torchGinger(st: GrowingStage): string {
	if (st === "sprout") return paint(cane([40, 87], [40, 79], [41, 70], 3, 11, 3, 0.4), TG);
	if (st === "leafy") return paint(join([cane([35, 87], [34, 62], [31, 38], 5, 18, 4, 0.3, -1), cane([45, 87], [46, 66], [49, 46], 4, 17, 4, 0.32)]), TG);
	return (
		paint(join([cane([27, 87], [26, 55], [18, 24], 6, 19, 4.2, 0.28, -1), cane([55, 87], [56, 60], [62, 32], 5, 18, 4.2, 0.3)]), TG) +
		sk(qD([40, 87], [38, 60], [40, 34]), "#4f6a30", 2.2) +
		torchHead(40, 27)
	);
}

/* ---------- 2. Shell ginger ---------- */
const SG = { leaf: "#68a858", light: "#88c06e", dark: "#3d7534", white: "#f3eee2", shade: "#cfc4ad", pink: "#e47f9a", yellow: "#f0c13a", red: "#d8443a" };
function shellRaceme(x: number, y: number, len: number): string {
	const a: Pt = [x, y];
	const c: Pt = [x + 7, y + len * 0.35];
	const b: Pt = [x + 3, y + len];
	let W = "";
	let S = "";
	let P = "";
	let Y = "";
	let R = "";
	const n = 11;
	for (let i = 0; i < n; i++) {
		const t = 0.08 + (0.92 * i) / (n - 1);
		const [px, py] = q(a, c, b, t);
		const side = i % 2 ? -1 : 1;
		const r = 3.3 - 1.5 * t;
		const bx = px + side * r * 0.8;
		const by = py + r * 0.3;
		S += ovalD(bx + 0.5, by + 0.5, r * 0.82, r * 1.15, side * -22);
		W += ovalD(bx, by, r * 0.82, r * 1.15, side * -22);
		P += ovalD(bx - side * r * 0.35, by + r * 0.85, r * 0.42, r * 0.38);
		if (i === 1 || i === 2) {
			Y += lensD(bx - side * r * 0.4, by + r * 0.9, 90 + side * 35, 4.2, 1.5);
			R += segD(bx - side * r * 0.4, by + r * 0.9, ...at(bx - side * r * 0.4, by + r * 0.9, 90 + side * 35, 3));
		}
	}
	return sk(qD(a, c, b), "#a8607a", 1.1) + p(S, SG.shade) + p(W, SG.white) + p(P, SG.pink) + p(Y, SG.yellow) + sk(R, SG.red, 0.6);
}
function shellGinger(st: GrowingStage): string {
	if (st === "sprout") return paint(cane([40, 87], [40, 78], [42, 70], 3, 11, 3.4, 0.4, -1), SG);
	if (st === "leafy") return paint(join([cane([38, 87], [35, 46], [54, 38], 5, 18, 4.6, 0.3), cane([43, 87], [45, 64], [30, 48], 4, 15, 4.2, 0.35, -1)]), SG);
	return paint(join([cane([37, 87], [32, 28], [54, 22], 6, 19, 4.8, 0.28), cane([43, 87], [47, 52], [22, 40], 5, 17, 4.4, 0.3, -1)]), SG) + shellRaceme(54, 23, 36);
}

/* ---------- 3. Butterfly ginger ---------- */
const BG = { leaf: "#5f9e4e", light: "#7cb663", dark: "#3d7534", white: "#f8f6ee", shade: "#cfc9b4", bract: "#8aa858", eye: "#d8d27a" };
const BUTTERFLY_W = lensD(0, 0, 115, 5.5, 0.9) + lensD(0, 0, 65, 5.5, 0.9) + ovalD(-2.6, -1.8, 3, 2.4, -35) + ovalD(2.6, -1.8, 3, 2.4, 35);
const BUTTERFLY = p(BUTTERFLY_W, BG.shade).replace("<path", `<path transform="translate(.6 .6)"`) + p(BUTTERFLY_W, BG.white) + p(ovalD(0, -0.6, 1, 1.3), BG.eye);
function butterflyHead(x: number, y: number, open: boolean): string {
	let s = p(ovalD(x, y + 3, 2.6, 4.6), BG.bract) + sk(`M${f(x - 2)} ${f(y + 2)}Q${f(x)} ${f(y + 3.4)} ${f(x + 2)} ${f(y + 2)}M${f(x - 2.2)} ${f(y + 4.6)}Q${f(x)} ${f(y + 6)} ${f(x + 2.2)} ${f(y + 4.6)}`, BG.dark, 0.6);
	if (!open) return s;
	for (const [dx, dy, r] of [[-5, 0, -30], [5, -1.5, 28], [0, -5, 0]] as const) s += g(x + dx, y + dy, BUTTERFLY, r);
	return s;
}
function butterflyGinger(st: GrowingStage): string {
	if (st === "sprout") return paint(cane([40, 87], [40, 78], [40, 70], 3, 10, 2.2, 0.4, 1, 0.35, 80, 50), BG);
	if (st === "leafy") return paint(join([cane([36, 87], [35, 60], [34, 40], 6, 15, 2.8, 0.25, -1, 0.35, 82, 50), cane([45, 87], [46, 66], [47, 50], 4, 14, 2.8, 0.3, 1, 0.35, 82, 50)]), BG) + butterflyHead(34, 36, false);
	return paint(join([cane([33, 87], [32, 56], [32, 26], 7, 16, 3, 0.22, -1, 0.35, 82, 50), cane([48, 87], [49, 64], [51, 40], 5, 15, 3, 0.28, 1, 0.35, 82, 50)]), BG) + butterflyHead(32, 21, true) + butterflyHead(51, 35, true);
}

/* ---------- 4. Ixora ---------- */
const IX = { leaf: "#3d8443", light: "#58a056", dark: "#2a5c2c", stem: "#6a5038", red: "#e0402c", red2: "#f2683e", deep: "#a82a1c" };
const IX_BR: Br[] = [
	[[40, 86], [36, 60], [26, 40]],
	[[40, 86], [42, 58], [54, 36]],
	[[40, 86], [40, 56], [40, 30]],
	[[40, 86], [30, 72], [19, 58]],
	[[40, 86], [50, 72], [61, 56]],
];
const IX_DOME: Pt[] = [[-3, -3.6], [0, -4], [3, -3.6], [-5.2, -1], [-2.6, -1.4], [0, -1.5], [2.6, -1.4], [5.2, -1], [-4, 1.4], [-1.3, 1.2], [1.3, 1.2], [4, 1.4]];
function ixoraClusters(pts: readonly Pt[], k: number): string {
	let u = "";
	let a = "";
	let b = "";
	for (const [x, y] of pts) {
		u += ovalD(x, y - 1, 6.8 * k, 4.6 * k);
		IX_DOME.forEach(([dx, dy], i) => {
			const c = 1.3 * k;
			const d = i % 2 ? `M${ns(x + dx * k - c, y + dy * k - 1)}h${n(2 * c)}m${n(-c)} ${n(-c)}v${n(2 * c)}` : `M${ns(x + dx * k - c * 0.7, y + dy * k - 1.7 * k)}l${ns(1.4 * c, 1.4 * c)}m0 ${n(-1.4 * c)}l${ns(-1.4 * c, 1.4 * c)}`;
			if (i % 3) a += d;
			else b += d;
		});
	}
	return p(u, IX.deep) + sk(a, IX.red, 1.2 * k) + sk(b, IX.red2, 1.2 * k);
}
function ixora(st: GrowingStage): string {
	if (st === "sprout") return paint(shrub([[[40, 86], [40, 80], [40, 72]]], [0.5], 8, 2.2, 1, 62), IX, 1.4);
	if (st === "leafy") return paint(shrub(sc(IX_BR, 0.68), [0.5, 0.8], 9, 2.4, 1, 58), IX, 1.5);
	const top = tips(IX_BR);
	return paint(join([shrub(IX_BR, [0.45, 0.72], 9.5, 2.5, 1, 56), shrub(IX_BR, [0.97], 9, 2.4, 1, 80, 0.1, false)]), IX, 1.6) + ixoraClusters(top.slice(0, 3), 1) + ixoraClusters(top.slice(3), 0.8);
}

/* ---------- 5. Pentas ---------- */
const PE = { leaf: "#78b45e", light: "#96c87a", dark: "#4a8040", pink: "#e0609c", pale: "#f5a6cb", eye: "#a83a72" };
const PE_BR: Br[] = [
	[[40, 86], [36, 70], [29, 50]],
	[[40, 86], [44, 68], [52, 46]],
	[[40, 86], [40, 66], [40, 40]],
	[[40, 86], [32, 79], [21, 70]],
	[[40, 86], [48, 79], [59, 68]],
];
const PE_HEAD: Pt[] = [[-2.2, -5], [2.2, -5], [-4.4, -1.6], [0, -1.8], [4.4, -1.6], [-6, 1.6], [-2, 1.6], [2, 1.6], [6, 1.6]];
function pentasHeads(pts: readonly Pt[], k: number): string {
	let a = "";
	let b = "";
	const eyes: Pt[] = [];
	for (const [x, y] of pts)
		PE_HEAD.forEach(([dx, dy], i) => {
			const cx = x + dx * k;
			const cy = y + dy * k - 2;
			const d = petalD(cx, cy, 5, 1.05 * k, -90 + i * 11);
			if (i % 2) a += d;
			else b += d;
			eyes.push([cx, cy]);
		});
	return sk(a, PE.pink, 1.5 * k) + sk(b, PE.pale, 1.5 * k) + dots(eyes, 0.4 * k, PE.eye);
}
function pentas(st: GrowingStage): string {
	if (st === "sprout") return paint(shrub([[[40, 86], [40, 80], [40, 73]]], [0.45], 7, 3, 0, 65), PE, 1.3);
	if (st === "leafy") return paint(shrub(sc(PE_BR, 0.75), [0.35, 0.65, 0.9], 7.5, 3, 0, 62, 0.1), PE, 1.4);
	const t = tips(PE_BR);
	return paint(shrub(PE_BR, [0.35, 0.65, 0.88], 8, 3.1, 0, 62, 0.1, false), PE, 1.4) + pentasHeads(t.slice(0, 3), 1) + pentasHeads(t.slice(3), 0.7);
}

/* ---------- 6. Bat flower ---------- */
const BT = { leaf: "#4f8a46", light: "#66a056", dark: "#2c562a", wing: "#6a3a62", wingL: "#80507a", vein: "#3e1f38", whisk: "#a07a98", fl: "#3e2438" };
function batLeaves(k: number, angs: readonly number[]): Foliage {
	let A = "";
	let B = "";
	let rib = "";
	angs.forEach((deg, i) => {
		const L = (Math.abs(deg + 90) < 30 ? 22 : 26) * k;
		const d = L * 0.16;
		if (i % 2) A += leafD(40, 86, deg, L, 7 * k, 0, d);
		else B += leafD(40, 86, deg, L, 7 * k, 0, d);
		rib += ribD(40, 86, deg, L, d);
	});
	return { stems: "", a: A, b: B, rib };
}
function batFlower(st: GrowingStage): string {
	if (st === "sprout") return paint(batLeaves(0.5, [-125, -60]), BT);
	if (st === "leafy") return paint(batLeaves(0.9, [-138, -114, -66, -42, -95]), BT);
	const x = 40;
	const y = 30;
	let wv = "";
	for (const a of [-150, -136, -164, -30, -44, -16]) wv += segD(x, y, ...at(x, y, a, 11));
	let wh = "";
	const ends: Pt[] = [];
	for (let i = 0; i < 9; i++) {
		const ex = x + (i - 4) * 3.6;
		const ey = 56 + (i % 3) * 5 - Math.abs(i - 4) * 1.5;
		wh += `M${x} ${y + 2}Q${f(x + (i - 4) * 0.8)} ${f(y + 16)} ${f(ex)} ${f(ey)}`;
		ends.push([ex, ey]);
	}
	return (
		paint(batLeaves(1, [-140, -120, -60, -40, -102, -80]), BT) +
		sk(`M40 86Q41 60 ${x} ${y}`, BT.dark, 1.8) +
		sk(wh, BT.whisk, 0.5) +
		dots(ends, 0.7, BT.whisk) +
		p(leafD(x, y, -148, 16, 6.8, 2) + leafD(x, y, -32, 16, 6.8, 2), BT.wing) +
		p(leafD(x, y, -150, 11, 3.6, 2) + leafD(x, y, -30, 11, 3.6, 2), BT.wingL) +
		sk(wv, BT.vein, 0.6) +
		p(ovalD(x - 3, y + 3.5, 1.4, 2, 20) + ovalD(x + 3, y + 3.5, 1.4, 2, -20) + ovalD(x, y + 4.5, 1.5, 2.2), BT.fl)
	);
}

/* ---------- 7. Jade vine ---------- */
const JV = { vine: "#4f7a3e", leaf: "#5c9a50", light: "#78b266", claw: "#4ec8ae", claw2: "#8ae2cc", stalk: "#4f6f5a" };
function trifD(x: number, y: number, deg: number, k: number): [string, string, string] {
	const [cx, cy] = at(x, y, deg, 2.5 * k);
	return [leafD(cx, cy, deg - 40, 6 * k, 1.9 * k, 1) + leafD(cx, cy, deg + 40, 6 * k, 1.9 * k, 1), leafD(cx, cy, deg, 7 * k, 2.1 * k, 1), segD(x, y, cx, cy)];
}
function vineWave(x: number, y0: number, y1: number, amp: number): string {
	let d = `M${x} ${y0}Q${x + amp} ${y0 - 2.5} ${x} ${y0 - 5}`;
	for (let y = y0 - 10; y >= y1; y -= 5) d += `T${x} ${y}`;
	return d;
}
function jadeLeaves(spots: readonly (readonly [number, number, number, number])[]): string {
	let a = "";
	let b = "";
	let st = "";
	for (const [x, y, deg, k] of spots) {
		const [l, m, s] = trifD(x, y, deg, k);
		a += l;
		b += m;
		st += s;
	}
	return sk(st, JV.vine, 0.8) + p(a, JV.leaf) + p(b, JV.light);
}
function jadeRaceme(x: number, y: number, len: number): string {
	const n = Math.round(len / 2.1);
	let a = "";
	let b = "";
	for (let j = 0; j < n; j++) {
		const t = j / (n - 1);
		const k = 1.25 - 0.65 * t;
		const s = j % 2 ? -1 : 1;
		const px = x + Math.sin(t * 3) * 1.2;
		const py = y + 3 + t * len;
		const d = `M${ns(px, py)}c${ns(s * 2.5 * k, k, s * 4.6 * k, -0.5 * k, s * 4.2 * k, -4 * k)}c${ns(-s * 0.9 * k, 2.2 * k, -s * 2.4 * k, 3.3 * k, -s * 4.2 * k, 2.6 * k)}Z`;
		if (j % 3 === 1) b += d;
		else a += d;
	}
	return sk(`M${x} ${y}L${x} ${y + len + 3}`, JV.stalk, 0.9) + p(a, JV.claw) + p(b, JV.claw2);
}
function jadeVine(st: GrowingStage): string {
	if (st === "sprout") return sk("M44 87V68", BARK, 1.6) + sk(vineWave(42, 86, 72, 3), JV.vine, 1.1) + jadeLeaves([[42, 80, -150, 0.8], [42, 73, -40, 0.75]]);
	if (st === "leafy")
		return (
			sk("M40 87V30M26 30H54", BARK, 2.4) +
			sk(vineWave(40, 86, 32, 4) + "M40 31Q36 27.5 32 31", JV.vine, 1.2) +
			jadeLeaves([[38, 78, -160, 1], [42, 68, -20, 1], [38, 58, -160, 1], [42, 48, -20, 1], [38, 39, -150, 0.9], [33, 30, -120, 0.8]])
		);
	return (
		sk("M40 87V17M10 17H70", BARK, 2.6) +
		sk(vineWave(40, 86, 19, 4) + "M40 18Q34 14.5 28 18T16 18M40 18Q46 14.5 52 18T64 18", JV.vine, 1.2) +
		jadeLeaves([[38, 78, -160, 1], [42, 68, -20, 1], [38, 58, -160, 1], [42, 48, -20, 1], [38, 38, -160, 1], [42, 28, -25, 1], [30, 16, -125, 0.9], [50, 16, -55, 0.9], [18, 16, -110, 0.85], [62, 16, -70, 0.85]]) +
		jadeRaceme(22, 18, 26) +
		jadeRaceme(47, 18, 36) +
		jadeRaceme(61, 18, 22)
	);
}

/* ---------- 8. Medinilla ---------- */
const MD = { leaf: "#4e8c48", light: "#66a258", dark: "#c6dcaa", stem: "#3a6a34", stalk: "#c0508a", bract: "#f5bad2", bractD: "#e598b8", berry: "#de4f96", berry2: "#f27fb4" };
const MD_BR: Br[] = [
	[[40, 86], [37, 64], [28, 44]],
	[[40, 86], [43, 62], [52, 40]],
	[[40, 86], [40, 58], [40, 30]],
];
function medPanicle(x: number, y: number, len: number): string {
	const pts: Pt[] = [];
	const pts2: Pt[] = [];
	let row = 0;
	for (let yy = y + 6.5; yy <= y + len; yy += 2.4, row++) {
		const hw = 4.2 * (1 - (yy - y - 6) / (len + 2));
		const n = Math.max(1, Math.round(hw / 1.4));
		for (let i = 0; i < n; i++) {
			const px = x - hw + (n === 1 ? hw : (2 * hw * i) / (n - 1)) + (row % 2) * 0.6;
			((i + row) % 2 ? pts : pts2).push([px, yy]);
		}
	}
	return sk(`M${x} ${y}V${f(y + len)}`, MD.stalk, 1) + p(ovalD(x, y + 2.4, 6.4, 2.3), MD.bract) + p(ovalD(x, y + 4.6, 5, 1.9), MD.bractD) + dots(pts2, 1.45, MD.berry) + dots(pts, 1.45, MD.berry2);
}
function medinilla(st: GrowingStage): string {
	if (st === "sprout") return paint(shrub([[[40, 86], [40, 80], [40, 72]]], [0.5], 9, 3.6, 0, 70, 0.15), MD, 1.8);
	if (st === "leafy") return paint(shrub(sc(MD_BR, 0.75), [0.4, 0.75], 12, 4.6, 0, 70, 0.2), MD, 2);
	return (
		paint(shrub(MD_BR, [0.4, 0.75], 13, 5, 0, 70, 0.2), MD, 2.2) +
		sk("M28 44Q20 38 18 46M52 40Q61 34 62 44M40 30Q36 28 33 34", MD.stalk, 1.1) +
		medPanicle(18, 46, 22) +
		medPanicle(62, 44, 22) +
		medPanicle(33, 34, 14)
	);
}

/* ---------- 9. Pagoda flower ---------- */
const PG = { leaf: "#6aa85a", light: "#86bc6c", dark: "#3d7534", base: "#c2421e", o1: "#f05a28", o2: "#ff9a4a" };
function pagodaLeaves(top: number, pairs: readonly number[], len: number): string {
	let A = "";
	let B = "";
	let rib = "";
	pairs.forEach((y, i) => {
		const L = len * (1 - i * 0.12);
		for (const s of [1, -1]) {
			const deg = -90 + s * 70;
			const d = L * 0.28;
			if (s > 0) A += leafD(40, y, deg, L, L * 0.42, 2, d);
			else B += leafD(40, y, deg, L, L * 0.42, 2, d);
			rib += ribD(40, y, deg, L, d);
		}
	});
	return sk(`M40 87L40 ${top}`, PG.dark, 2.2) + p(B, PG.leaf) + p(A, PG.light) + sk(rib, PG.dark, 0.6, FAINT);
}
function pagoda(st: GrowingStage): string {
	if (st === "sprout") return pagodaLeaves(72, [74], 9);
	if (st === "leafy") return pagodaLeaves(40, [78, 66, 54, 43], 15) + p(ovalD(40, 38, 2.4, 3), PG.leaf);
	const a: Pt[] = [];
	const b: Pt[] = [];
	let br = "";
	for (let j = 0; j < 7; j++) {
		const y = 43 - j * 4.6;
		const hw = 12.5 * (1 - j / 7.4) + 1;
		br += `M${f(40 - hw)} ${f(y + 1)}Q40 ${f(y - 1.5)} ${f(40 + hw)} ${f(y + 1)}`;
		const n = Math.max(1, Math.round(hw / 1.7));
		for (let i = 0; i <= n; i++) {
			const x = 40 - hw + (2 * hw * i) / Math.max(1, n);
			const jy = y - 1 + Math.sin(i * 2.3 + j) * 1.2;
			((i + j) % 2 ? a : b).push([x, jy]);
		}
	}
	return pagodaLeaves(46, [78, 66, 55], 15) + p("M40 12L54.5 42Q40 47 25.5 42Z", PG.base) + sk(br, PG.o1, 0.7) + dots(b, 1.35, PG.o1) + dots(a, 1.25, PG.o2) + dots([[40, 12.5]], 1.4, PG.o2);
}

/* ---------- 10. Shrimp plant ---------- */
const SH = { leaf: "#79b462", light: "#94c67a", dark: "#4a8040", b1: "#d9654a", b2: "#f39c78", wh: "#f6f2e6" };
const SH_BR: Br[] = [
	[[40, 86], [34, 66], [25, 52]],
	[[40, 86], [46, 64], [55, 50]],
	[[40, 86], [39, 62], [41, 42]],
	[[40, 86], [30, 78], [19, 68]],
	[[40, 86], [50, 78], [61, 66]],
];
function shrimps(pts: readonly Pt[]): string {
	let a = "";
	let b = "";
	let w = "";
	pts.forEach(([x, y], k) => {
		const s = x < 40 || (x === 41 && k % 2) ? -1 : 1;
		const A: Pt = [x, y];
		const C: Pt = [x + s * 7, y - 2];
		const B: Pt = [x + s * 5, y + 16];
		for (let i = 0; i < 10; i++) {
			const t = 0.12 + (0.88 * i) / 9;
			const [px, py] = q(A, C, B, t);
			const r = 2.3 - 0.9 * t;
			const d = ovalD(px, py, r, r * 0.95, qa(A, C, B, t) + 90);
			if (i % 2) a += d;
			else b += d;
		}
		const [wx, wy] = q(A, C, B, 0.4);
		w += lensD(wx, wy, qa(A, C, B, 0.4) - s * 80, 4.4, 1);
	});
	return p(b, SH.b1) + p(a, SH.b2) + p(w, SH.wh);
}
function shrimpPlant(st: GrowingStage): string {
	if (st === "sprout") return paint(shrub([[[40, 86], [40, 80], [41, 72]]], [0.4, 0.8], 6, 2.6, 0, 60), SH, 1.3);
	if (st === "leafy") return paint(shrub(sc(SH_BR, 0.78), [0.35, 0.6, 0.85], 6.5, 2.6, 0, 60, 0.1), SH, 1.3);
	return paint(shrub(SH_BR, [0.3, 0.55, 0.8], 6.5, 2.6, 0, 60, 0.1, false), SH, 1.3) + shrimps(tips(SH_BR));
}

/* ---------- 11. Lollipop plant ---------- */
const LP = { leaf: "#4a8a42", light: "#62a052", dark: "#2f6230", y: "#f2c02c", yd: "#c99418", wh: "#f8f6ec", whs: "#d8cfa8" };
const LP_BR: Br[] = [
	[[40, 86], [36, 70], [29, 48]],
	[[40, 86], [44, 68], [52, 44]],
	[[40, 86], [40, 64], [40, 36]],
];
function lollipops(pts: readonly Pt[]): string {
	let body = "";
	let ch = "";
	let w = "";
	for (const [x, y] of pts) {
		const h = 14;
		body += `M${f(x - 3.2)} ${f(y)}L${f(x - 2.4)} ${f(y - h + 3)}Q${f(x)} ${f(y - h - 1.5)} ${f(x + 2.4)} ${f(y - h + 3)}L${f(x + 3.2)} ${f(y)}Q${f(x)} ${f(y + 1.2)} ${f(x - 3.2)} ${f(y)}Z`;
		for (let r = 0; r < 5; r++) {
			const yy = y - 1.4 - r * 2.4;
			const hw = 3 - r * 0.15;
			ch += `M${f(x - hw)} ${f(yy + 1)}L${f(x)} ${f(yy - 0.5)}L${f(x + hw)} ${f(yy + 1)}`;
		}
		w += lensD(x - 2.4, y - 6, -160, 5, 1) + lensD(x + 2.4, y - 8.5, -25, 5, 1) + lensD(x - 2.2, y - 11, -140, 4, 0.9);
	}
	return p(body, LP.y) + sk(ch, LP.yd, 0.7) + p(w, LP.whs).replace("<path", `<path transform="translate(.4 .5)"`) + p(w, LP.wh);
}
function lollipop(st: GrowingStage): string {
	if (st === "sprout") return paint(shrub([[[40, 86], [40, 80], [40, 72]]], [0.45, 0.85], 8, 2.2, 1, 65, 0.2, false), LP, 1.4);
	if (st === "leafy") return paint(shrub(sc(LP_BR, 0.72), [0.3, 0.6, 0.9], 11, 2.8, 1, 65, 0.25), LP, 1.6);
	return paint(shrub(LP_BR, [0.3, 0.58, 0.86], 12.5, 3, 1, 66, 0.28, false), LP, 1.7) + lollipops(tips(LP_BR));
}

/* ---------- 12. Firecracker plant ---------- */
const FC = { stem: "#5a9448", stem2: "#7cb262", red: "#dc3326" };
const FC_ARCS = [[54, 6], [46, 15], [40, 24], [30, 31], [22, 34]] as const;
function firecracker(st: GrowingStage): string {
	if (st === "sprout") return sk("M40 86Q39 78 36 70M40 86Q40 76 41 68M40 86Q42 79 45 72", FC.stem, 1);
	const k = st === "leafy" ? 0.7 : 1;
	let a = "";
	let b = "";
	let r = "";
	FC_ARCS.forEach(([H0, D0], i) => {
		for (const s of [1, -1]) {
			const H = H0 * k * (s > 0 ? 1 : 0.94);
			const D = D0 * (st === "leafy" ? 0.75 : 1);
			const P: [Pt, Pt, Pt, Pt] = [[40, 86], [40 + s * 1.5, 86 - H * 1.15], [40 + s * D * 0.85, 86 - H * 1.2], [40 + s * D, 86 - H * 0.55]];
			const d = `M40 86C${f(P[1][0])} ${f(P[1][1])} ${f(P[2][0])} ${f(P[2][1])} ${f(P[3][0])} ${f(P[3][1])}`;
			if ((i + (s > 0 ? 0 : 1)) % 2) a += d;
			else b += d;
			if (st === "bloom")
				for (const t of [0.62, 0.74, 0.86, 0.97]) {
					const u = 1 - t;
					const px = u * u * u * P[0][0] + 3 * u * u * t * P[1][0] + 3 * u * t * t * P[2][0] + t * t * t * P[3][0];
					const py = u * u * u * P[0][1] + 3 * u * u * t * P[1][1] + 3 * u * t * t * P[2][1] + t * t * t * P[3][1];
					r += `M${f(px)} ${f(py + 0.6)}l${f(s * 1.1)} 3.4`;
				}
		}
	});
	return sk(a, FC.stem, 1) + sk(b, FC.stem2, 0.9) + sk(r, FC.red, 1.6);
}

/* ---------- 13. Bleeding glory-bower ---------- */
const GB = { leaf: "#3f7f3e", light: "#58995a", dark: "#2a5a2c", vine: "#4a6a34", wh: "#f2efe4", sh: "#c9c0a8", red: "#d42638" };
function gloryLeaves(ys: readonly number[], len: number): string {
	let A = "";
	let B = "";
	let rib = "";
	ys.forEach((y, i) => {
		const deg1 = -90 + 62 + (i % 2) * 8;
		const deg2 = -90 - 62 - (i % 2) * 8;
		A += leafD(41, y, deg1, len, len * 0.36, 1, len * 0.2);
		B += leafD(39, y, deg2, len, len * 0.36, 1, len * 0.2);
		rib += ribD(41, y, deg1, len, len * 0.2) + ribD(39, y, deg2, len, len * 0.2);
	});
	return p(B, GB.leaf) + p(A, GB.light) + sk(rib, GB.dark, 0.6, FAINT);
}
const GB_CAL: Pt[] = [[-3.4, -2.2], [3.4, -2.2], [-4.6, 2.4], [0, 3.2], [4.6, 2.4]];
function gloryClusters(pts: readonly Pt[]): string {
	let sh = "";
	let w = "";
	let st = "";
	let r = "";
	let am = "";
	for (const [x, y] of pts) {
		GB_CAL.forEach(([dx, dy], i) => {
			const cx = x + dx;
			const cy = y + dy;
			st += segD(x, y - 3, cx, cy - 2);
			sh += `M${ns(cx + 0.5, cy + 0.4)}v.4`;
			w += `M${ns(cx, cy)}v.4`;
			if (i > 1) {
				r += petalD(cx, cy + 4.4, 5, 1, 90);
				am += segD(cx, cy + 5, cx + (i - 3) * 1.2, cy + 9.5);
			}
		});
	}
	return sk(st, GB.vine, 0.7) + sk(sh, GB.sh, 5) + sk(w, GB.wh, 5) + sk(am, GB.red, 0.4) + sk(r, GB.red, 1.3);
}
function gloryBower(st: GrowingStage): string {
	if (st === "sprout") return sk("M43 87V66", BARK, 1.5) + sk(vineWave(41.5, 86, 71, 3), GB.vine, 1) + gloryLeaves([80, 73], 8);
	if (st === "leafy") return sk("M40 87V30", BARK, 1.8) + sk(vineWave(40, 86, 34, 3.6), GB.vine, 1.1) + gloryLeaves([78, 66, 54, 43, 35], 11);
	return sk("M40 87V12", BARK, 1.8) + sk(vineWave(40, 86, 16, 3.6), GB.vine, 1.1) + gloryLeaves([79, 67, 55, 43, 31, 20], 11.5) + gloryClusters([[27, 40], [54, 29], [29, 22], [53, 54]]);
}

/* ---------- 14. Cat's whiskers ---------- */
const CW = { leaf: "#5f9e4e", light: "#7ab662", dark: "#3d7534", wh: "#f3f1f8", sh: "#ab9ccc", wk: "#9078cc" };
const CW_BR: Br[] = [
	[[40, 86], [36, 68], [30, 50]],
	[[40, 86], [41, 64], [42, 42]],
	[[40, 86], [45, 70], [53, 54]],
];
function whiskerSpikes(spikes: readonly (readonly [number, number, number])[]): string {
	let ax = "";
	let w = "";
	let sh = "";
	let wk = "";
	const ends: Pt[] = [];
	const buds: Pt[] = [];
	for (const [x, y, len] of spikes) {
		ax += `M${x} ${y}L${x} ${y - len}`;
		const n = Math.floor(len / 4.4);
		for (let j = 0; j < n; j++) {
			const yy = y - 2 - j * 4.4;
			const k = 1 - j * 0.12;
			for (const s of [1, -1]) {
				sh += `M${ns(x + s * 1.3 + 0.3, yy + 0.7)}l${ns(s * 1.2 * k, -0.7 * k)}`;
				w += `M${ns(x + s * 1.3, yy + 0.4)}l${ns(s * 1.2 * k, -0.7 * k)}`;
				const ex = x + s * (8 - j) * k;
				const ey = yy - 7 * k;
				wk += `M${f(x + s * 2.6)} ${f(yy - 0.4)}Q${f(x + s * 3.4)} ${f(ey + 0.5)} ${f(ex)} ${f(ey)}`;
				ends.push([ex, ey]);
			}
		}
		buds.push([x, y - len], [x, y - len + 2]);
	}
	return sk(ax, CW.dark, 1) + sk(wk, CW.wk, 0.45) + dots(ends, 0.55, CW.wk) + sk(sh, CW.sh, 2.2) + sk(w, CW.wh, 2.2) + dots(buds, 0.9, CW.wh);
}
function catsWhiskers(st: GrowingStage): string {
	if (st === "sprout") return paint(shrub([[[40, 86], [40, 80], [40, 72]]], [0.45, 0.85], 6.5, 2.2, 1, 70, 0, false), CW, 1.3);
	if (st === "leafy") return paint(shrub(sc(CW_BR, 0.8), [0.25, 0.5, 0.75], 8, 2.6, 1, 70, 0.1), CW, 1.4);
	return paint(shrub(CW_BR, [0.25, 0.48, 0.72], 8, 2.6, 1, 70, 0.1, false), CW, 1.4) + whiskerSpikes([[30, 50, 20], [42, 42, 26], [53, 54, 18]]);
}

/* ---------- 15. Brazilian plume flower ---------- */
const PL = { leaf: "#4c8a44", light: "#64a254", dark: "#2a5e2a", stem: "#6e5040", pk: "#de5596", pk2: "#f590c0" };
const PL_BR: Br[] = [
	[[40, 86], [35, 68], [27, 48]],
	[[40, 86], [46, 66], [54, 42]],
	[[40, 86], [40, 64], [40, 34]],
];
function plumes(heads: readonly (readonly [number, number, number])[]): string {
	let a = "";
	let b = "";
	for (const [x, y, k] of heads) {
		for (let i = 0; i < 11; i++) {
			const deg = -138 + i * 9.6;
			const L = (12 - Math.abs(deg + 90) / 10) * k;
			const [ex, ey] = at(x, y, deg, L);
			a += `M${ns(x, y)}q${ns((ex - x) * 0.3 + (deg + 90) * 0.04, (ey - y) * 0.6, ex - x, ey - y)}`;
		}
		for (let i = 0; i < 7; i++) {
			const deg = -114 + i * 8;
			b += segD(x, y - 2, ...at(x, y - 2, deg, (7.6 - Math.abs(deg + 90) / 14) * k));
		}
	}
	return sk(a, PL.pk, 1.4) + sk(b, PL.pk2, 1.2) + p(heads.map(([x, y]) => ovalD(x, y + 0.5, 2.8, 1.8)).join(""), PL.light);
}
function plumeFlower(st: GrowingStage): string {
	if (st === "sprout") return paint(shrub([[[40, 86], [40, 80], [40, 72]]], [0.5], 9, 3.6, 0, 66, 0.15), PL, 1.5);
	if (st === "leafy") return paint(shrub(sc(PL_BR, 0.72), [0.3, 0.62, 0.92], 11, 4.4, 0, 66, 0.2), PL, 1.8);
	return paint(shrub(PL_BR, [0.3, 0.6, 0.88], 12.5, 4.8, 0, 66, 0.2, false), PL, 2) + plumes([[27, 47, 0.95], [54, 41, 0.95], [40, 33, 1.1]]);
}

/* ---------- 16. Blue ginger ---------- */
const BL = { leaf: "#3d7a3a", light: "#58985a", dark: "#25562a", base: "#34328a", b1: "#4f4cc0", b2: "#7472de", y: "#f0d050" };
function blueCone(cx: number, cy: number, rx: number, ry: number): string {
	const a: Pt[] = [];
	const b: Pt[] = [];
	const y: Pt[] = [];
	let row = 0;
	for (let yy = cy - ry + 1.4; yy <= cy + ry - 1; yy += 2.2, row++) {
		const hw = rx * Math.sqrt(Math.max(0, 1 - ((yy - cy) / ry) ** 2)) - 0.8;
		const n = Math.max(1, Math.round((2 * hw) / 2.3) + 1);
		for (let i = 0; i < n; i++) {
			const x = n === 1 ? cx : cx - hw + (2 * hw * i) / (n - 1);
			((i + row) % 2 ? a : b).push([x, yy]);
			if ((i + row * 2) % 4 === 0) y.push([x + 0.4, yy - 0.3]);
		}
	}
	return p(ovalD(cx, cy, rx, ry), BL.base) + dots(b, 1.25, BL.b1) + dots(a, 1.25, BL.b2) + dots(y, 0.4, BL.y);
}
function blueGinger(st: GrowingStage): string {
	if (st === "sprout") return paint(cane([40, 87], [40, 79], [40, 70], 4, 9, 2.2, 0.35, 1, 0.25, 70, 45), BL);
	if (st === "leafy") return paint(join([cane([38, 87], [37, 64], [37, 40], 5, 13, 3, 0.4, -1, 0.3, 70, 40), cane([45, 87], [47, 70], [50, 56], 4, 11, 2.8, 0.4, 1, 0.3, 70, 40)]), BL);
	return paint(join([cane([38, 87], [37, 60], [37, 30], 6, 14, 3.1, 0.45, -1, 0.3, 70, 40), cane([46, 87], [48, 68], [52, 46], 4, 12, 2.8, 0.45, 1, 0.3, 70, 40)]), BL) + blueCone(37, 18, 5.4, 11.5) + blueCone(52, 39, 3.6, 7);
}

/* ---------- 17. Rangoon creeper ---------- */
const RC = { leaf: "#5a9a4c", light: "#78b262", dark: "#3d7534", stem: "#7a5a3a", tube: "#d2e0aa", c: ["#f6f2ea", "#ef86a6", "#c8243f"] };
const RC_BR: Br[] = [
	[[40, 86], [36, 18], [66, 30]],
	[[40, 86], [44, 30], [15, 40]],
];
function rangoonClusters(pts: readonly Pt[]): string {
	let tube = "";
	const st = ["", "", ""];
	let n = 0;
	for (const [x, y] of pts)
		for (let i = 0; i < 6; i++, n++) {
			const deg = 52 + i * 15;
			const [ex, ey] = at(x, y, deg, 8 + (i % 2) * 2.5);
			tube += segD(x, y, ex, ey);
			st[n % 3] += starD(ex, ey + 0.6, 5, 1.5, 90 + i * 7);
		}
	return sk(tube, RC.tube, 0.9) + st.map((d, i) => sk(d, RC.c[i] ?? "", 1.25)).join("");
}
function rangoon(st: GrowingStage): string {
	if (st === "sprout") return sk("M40 86Q38 78 42 72T41 66", RC.stem, 1.2) + paint({ ...shrub([[[40, 86], [39, 78], [41, 69]]], [0.5, 0.9], 6.5, 2.6, 1, 62, 0.1), stems: "" }, RC);
	if (st === "leafy") return paint(shrub(sc(RC_BR, 0.66, 0.8), [0.3, 0.5, 0.7, 0.9], 7.5, 2.8, 1, 60, 0.15), RC, 1.6);
	const pts = RC_BR.flatMap(([a, c, b]) => [q(a, c, b, 0.62), b]);
	return paint(shrub(RC_BR, [0.28, 0.45, 0.6, 0.75, 0.9], 8, 3, 1, 60, 0.2), RC, 1.8) + rangoonClusters(pts);
}

/* ---------- 18. Night-blooming jasmine ---------- */
const NJ = { leaf: "#5c9a4c", light: "#78b060", dark: "#3b7232", stem: "#6a6040", tube: "#9fb35e", star: "#f3f2cf", shade: "#c9c58a" };
const NJ_BR: Br[] = [
	[[40, 86], [30, 58], [18, 42]],
	[[40, 86], [50, 56], [62, 40]],
	[[40, 86], [40, 54], [37, 26]],
	[[40, 86], [28, 76], [13, 70]],
	[[40, 86], [52, 76], [67, 70]],
];
function jasminePuffs(pts: readonly Pt[]): string {
	let tube = "";
	const ends: Pt[] = [];
	for (const [x, y] of pts)
		for (let i = 0; i < 9; i++) {
			const deg = -170 + i * 22 + (i > 6 ? 25 : 0);
			const e = at(x, y, deg, 3.6 + (i % 2) * 1.2);
			tube += segD(x, y, e[0], e[1]);
			ends.push(e);
		}
	return sk(tube, NJ.tube, 0.8) + dots(ends.map(([x, y]) => [x + 0.35, y + 0.35]), 1.1, NJ.shade) + dots(ends, 1.05, NJ.star);
}
function nightJasmine(st: GrowingStage): string {
	if (st === "sprout") return paint(shrub([[[40, 86], [40, 80], [40, 71]]], [0.45, 0.8], 7, 1.9, 1, 55, 0.15), NJ, 1.3);
	if (st === "leafy") return paint(shrub(sc(NJ_BR, 0.68), [0.4, 0.8], 9, 2.3, 1, 55, 0.25), NJ, 1.5);
	const pts = NJ_BR.slice(0, 3).flatMap(([a, c, b]) => [q(a, c, b, 0.62), b]);
	return paint(shrub(NJ_BR, [0.32, 0.58, 0.84], 10, 2.4, 1, 55, 0.28), NJ, 1.6) + jasminePuffs([...pts, NJ_BR[3]![2], NJ_BR[4]![2]]);
}

/* ---------- 19. Chenille plant ---------- */
const CH = { leaf: "#5a9a4a", light: "#74b05e", dark: "#3b7232", red: "#c42638", red2: "#e8566e" };
const CH_BR: Br[] = [
	[[40, 86], [33, 66], [24, 46]],
	[[40, 86], [47, 64], [56, 44]],
	[[40, 86], [40, 60], [40, 28]],
];
function catkins(cs: readonly (readonly [number, number, number, number])[]): string {
	let a = "";
	let b = "";
	for (const [x, y, s, L] of cs) {
		a += `M${f(x)} ${f(y)}Q${f(x + s * 4)} ${f(y + L * 0.45)} ${f(x + s * 2.5)} ${f(y + L)}`;
		b += `M${f(x + s * 0.7 - 0.6)} ${f(y + 2)}Q${f(x + s * 4 - 0.7)} ${f(y + L * 0.45)} ${f(x + s * 2.5 - 0.7)} ${f(y + L - 1.5)}`;
	}
	return sk(a, CH.red, 3.6) + sk(b, CH.red2, 1.1, ` stroke-dasharray="1.3 1.1"`);
}
function chenille(st: GrowingStage): string {
	if (st === "sprout") return paint(shrub([[[40, 86], [40, 80], [40, 72]]], [0.5], 8, 3.6, 0, 64, 0.15), CH, 1.4);
	if (st === "leafy") return paint(shrub(sc(CH_BR, 0.72), [0.32, 0.65, 0.92], 11, 4.4, 0, 62, 0.2), CH, 1.7);
	return (
		paint(shrub(CH_BR, [0.3, 0.6, 0.86], 12, 4.8, 0, 62, 0.2), CH, 1.9) +
		catkins([[24, 47, -1, 22], [56, 45, 1, 21], [33, 58, -1, 20], [47, 56, 1, 21], [38, 36, -1, 18]])
	);
}

/* ---------- 20. Pride of Barbados ---------- */
const PB = { stem: "#7a5a3a", pinna: "#6aaa58", pinna2: "#86c06e", rach: "#4a7a3a", or: "#ec5a1e", y: "#f6c42a", st: "#c62a1e" };
const PB_BR: Br[] = [
	[[40, 86], [34, 64], [26, 44]],
	[[40, 86], [46, 62], [54, 40]],
	[[40, 86], [40, 58], [40, 32]],
];
function pinnate(brs: readonly Br[], ts: readonly number[], len: number): string {
	let rach = "";
	let a = "";
	let b = "";
	let n = 0;
	for (const [A, C, B] of brs)
		for (const t of ts) {
			const [x, y] = q(A, C, B, t);
			const ang = qa(A, C, B, t);
			for (const s of [1, -1]) {
				const deg = ang + s * 62;
				const tip = at(x, y, deg, len);
				rach += segD(x, y, tip[0], tip[1]);
				for (const u of [0.3, 0.62]) {
					const [px, py] = at(x, y, deg, len * u);
					for (const v of [1, -1]) {
						const pe = at(px, py, deg + v * 52, len * 0.38);
						const d = segD(px, py, pe[0], pe[1]);
						if (n++ % 2) a += d;
						else b += d;
					}
				}
				const d = segD(...at(x, y, deg, len * 0.8), ...at(x, y, deg, len * 1.2));
				a += d;
			}
		}
	const dash = ` stroke-dasharray=".9 .55"`;
	return sk(rach, PB.rach, 0.5) + sk(b, PB.pinna, 2.6, dash) + sk(a, PB.pinna2, 2.6, dash);
}
function prideRacemes(pts: readonly Pt[]): string {
	let ax = "";
	let st = "";
	const or: Pt[] = [];
	const y: Pt[] = [];
	const buds: Pt[] = [];
	for (const [x, y0] of pts) {
		ax += `M${f(x)} ${f(y0)}L${f(x)} ${f(y0 - 16)}`;
		for (let j = 0; j < 4; j++) {
			const s = j % 2 ? -1 : 1;
			const k = 1.2 - j * 0.15;
			const fx = x + s * 3 * k;
			const fy = y0 - 1 - j * 3.8;
			or.push([fx - 1.2 * k, fy], [fx + 1.2 * k, fy], [fx - 0.6 * k, fy + 1.2 * k], [fx + 0.6 * k, fy + 1.2 * k]);
			y.push([fx, fy - 1.2 * k]);
			st += `M${ns(fx, fy)}q${ns(s * 1.5, -4, s * 6 * k, -7)}M${ns(fx, fy)}q${ns(s * 0.6, -4, s * 3.6 * k, -8.5)}`;
		}
		buds.push([x, y0 - 16], [x - 1.3, y0 - 14], [x + 1.3, y0 - 14.6]);
	}
	return sk(ax, PB.rach, 0.8) + sk(st, PB.st, 0.45) + dots(or, 1.4, PB.or) + dots(y, 1.2, PB.y) + dots(buds, 0.9, PB.st);
}
function prideBarbados(st: GrowingStage): string {
	if (st === "sprout") return sk("M40 86L40 72", PB.stem, 1.4) + pinnate([[[40, 86], [40, 80], [40, 72]]], [0.75], 8);
	if (st === "leafy") {
		const br = sc(PB_BR, 0.72);
		return sk(br.map(([a, c, b]) => qD(a, c, b)).join(""), PB.stem, 1.6) + pinnate(br, [0.4, 0.75, 1], 10);
	}
	return sk(PB_BR.map(([a, c, b]) => qD(a, c, b)).join(""), PB.stem, 1.8) + pinnate(PB_BR, [0.32, 0.58, 0.84], 11) + prideRacemes(tips(PB_BR));
}

/* ---------- 21. Spiral ginger ---------- */
const SP = { leaf: "#5a9c4e", light: "#7ab664", front: "#4a8a42", dark: "#3b7232", cone: "#c62a3a", coneD: "#901a2a", wh: "#f8f4ea", sh: "#cfc6b0", y: "#f2c43a" };
function spiralCane(x0: number, n: number, step: number, len: number): { s: string; top: number } {
	let d = `M${x0} 86`;
	let A = "";
	let B = "";
	let C = "";
	let rib = "";
	for (let i = 1; i <= n; i++) {
		const y = 86 - i * step;
		const x = x0 + (i % 2 ? 1.6 : -1.6);
		d += `Q${f(x0 + (i % 2 ? 2.4 : -2.4) * 1.4)} ${f(y + step / 2)} ${f(x)} ${f(y)}`;
		const L = len * (1 - 0.25 * (i / n));
		const kind = i % 3;
		if (kind === 1) {
			A += leafD(x, y, -24, L, L * 0.27, 0, L * 0.3);
			rib += ribD(x, y, -24, L, L * 0.3);
		} else if (kind === 2) {
			B += leafD(x, y, -156, L, L * 0.27, 0, L * 0.3);
			rib += ribD(x, y, -156, L, L * 0.3);
		} else C += leafD(x, y, i % 2 ? 30 : 150, L * 0.6, L * 0.22, 1);
	}
	const top = 86 - n * step;
	return { s: sk(d, SP.dark, 1.6) + p(B, SP.leaf) + p(A, SP.light) + p(C, SP.front) + sk(rib, SP.dark, 0.6, FAINT), top };
}
function costusHead(x: number, y: number): string {
	return (
		p(ovalD(x, y - 4.5, 4, 6.2), SP.coneD) +
		sk(`M${f(x - 3.2)} ${f(y - 2.4)}L${x} ${f(y - 4.6)}L${f(x + 3.2)} ${f(y - 2.4)}M${f(x - 3)} ${f(y - 6)}L${x} ${f(y - 8.2)}L${f(x + 3)} ${f(y - 6)}M${f(x - 3.2)} ${f(y + 1)}L${x} ${f(y - 1.2)}L${f(x + 3.2)} ${f(y + 1)}`, SP.cone, 1.6) +
		p(ovalD(x + 5.4, y - 4.4, 3.9, 3.3, -15), SP.sh) +
		p(ovalD(x + 5, y - 5, 3.9, 3.3, -15), SP.wh) +
		p(lensD(x + 2.6, y - 4.4, -10, 4.5, 1.1), SP.y)
	);
}
function spiralGinger(st: GrowingStage): string {
	if (st === "sprout") return spiralCane(40, 3, 5, 9).s;
	if (st === "leafy") {
		const a = spiralCane(36, 7, 6, 14);
		return a.s + spiralCane(47, 4, 6, 12).s;
	}
	const a = spiralCane(34, 10, 6.4, 15);
	const b = spiralCane(50, 6, 6.6, 13);
	return b.s + a.s + costusHead(34, a.top) + costusHead(50, b.top);
}

/* ---------- 22. Lantana ---------- */
const LT = { leaf: "#5e9a48", light: "#7aae5e", dark: "#3b7232", o: "#ee6a34", y: "#f6c636", pk: "#e45c98", cream: "#fae49a" };
const LT_BR: Br[] = [
	[[40, 86], [28, 76], [18, 62]],
	[[40, 86], [32, 64], [27, 46]],
	[[40, 86], [40, 60], [41, 37]],
	[[40, 86], [48, 64], [54, 45]],
	[[40, 86], [52, 76], [62, 61]],
	[[40, 86], [36, 74], [32, 60]],
	[[40, 86], [45, 74], [49, 59]],
];
function lantanaHeads(pts: readonly Pt[]): string {
	const outer: [Pt[], Pt[]] = [[], []];
	const inner: [Pt[], Pt[]] = [[], []];
	pts.forEach(([x, y0], k) => {
		const y = y0 - 2.5;
		const s = k % 2;
		for (let i = 0; i < 8; i++) outer[s]!.push(at(x, y, i * 45 + 10, 3.1));
		for (let i = 0; i < 4; i++) inner[s]!.push(at(x, y, i * 90 + 45, 1.3));
	});
	return dots(outer[0], 1.4, LT.o) + dots(outer[1], 1.4, LT.pk) + dots(inner[0], 1.25, LT.y) + dots(inner[1], 1.25, LT.cream);
}
function lantana(st: GrowingStage): string {
	if (st === "sprout") return paint(shrub([[[40, 86], [40, 80], [40, 73]]], [0.45, 0.85], 6, 2.8, 0, 62, 0.1), LT, 1.3);
	if (st === "leafy") return paint(shrub(sc(LT_BR, 0.78, 0.9), [0.4, 0.75], 7, 3, 0, 64, 0.1), LT, 1.4);
	return paint(shrub(LT_BR, [0.4, 0.72], 7.5, 3.1, 0, 64, 0.1), LT, 1.5) + lantanaHeads(tips(LT_BR));
}

/* ---------- 23. Rose of Venezuela ---------- */
const RV = { deep: "#2c5e2c", leaf: "#3f7a3a", light: "#5a9850", red: "#c81e36", red2: "#ee4656", y: "#f4cc4a", young: "#e8a2b4" };
function brownCanopy(spots: readonly Pt[], len: number, blob = ""): string {
	let a = "";
	let b = "";
	spots.forEach(([x, y], i) => {
		const s = x < 40 ? -1 : x > 40 ? 1 : i % 2 ? 1 : -1;
		for (const [j, deg] of [-60, -20, 25, 70].entries()) {
			const dg = s > 0 ? deg : 180 - deg;
			const d = leafD(x, y, dg, len * (j === 3 ? 0.85 : 1), len * 0.28, 1, len * 0.25);
			if ((i + j) % 2) a += d;
			else b += d;
		}
	});
	return p(blob, RV.deep) + p(b, RV.leaf) + p(a, RV.light);
}
function pompoms(pts: readonly Pt[], r: number): string {
	let t = "";
	const tipsP: Pt[] = [];
	let st = "";
	for (const [x, y] of pts) {
		st += `M${f(x)} ${f(y - r - 4)}L${f(x)} ${f(y - r + 1)}`;
		for (let i = 0; i < 16; i++) {
			const deg = i * 22.5 + 11;
			const [sx, sy] = at(x, y, deg, r * 0.5);
			const e = at(x, y, deg, r + 1.6 + (i % 2) * 0.8);
			t += segD(sx, sy, e[0], e[1]);
			tipsP.push(e);
		}
	}
	return sk(st, BARK, 1) + p(pts.map(([x, y]) => ovalD(x, y, r, r)).join(""), RV.red) + sk(t, RV.red2, 1.1) + dots(tipsP, 0.55, RV.y);
}
function roseVenezuela(st: GrowingStage): string {
	if (st === "sprout") return sk("M40 87L40 70", BARK, 1.6) + brownCanopy([[40, 75], [40, 70]], 7);
	if (st === "leafy") return sk("M40 87Q39 70 40 52M40 60Q34 54 30 48M40 58Q47 52 51 46", BARK, 2.4) + brownCanopy([[30, 48], [51, 46], [36, 42], [45, 40]], 9, ovalD(40, 46, 12, 7));
	return (
		sk("M40 87Q39 66 40 50", BARK, 3.6) +
		sk("M40 52Q32 44 24 36M40 52Q48 42 56 34M40 50L40 28", BARK, 2) +
		brownCanopy([[22, 30], [31, 21], [40, 15], [49, 20], [58, 28], [28, 36], [52, 35], [40, 28], [16, 36], [64, 35]], 10.5, ovalD(40, 28, 22, 12) + ovalD(40, 18, 12, 8)) +
		p(leafD(19, 40, 84, 13, 2.3, 1) + leafD(19, 40, 100, 12, 2, 1) + leafD(19, 40, 68, 11, 2, 1), RV.young) +
		pompoms([[30, 48], [52, 47], [41, 44]], 5.2)
	);
}

/* ---------- 24. Princess flower ---------- */
const PF = { leaf: "#6e9c5c", light: "#88b072", dark: "#3e6a36", pu: "#7a44c8", puD: "#56289a", st: "#e0b4f2", bud: "#c4567e", old: "#c8523a" };
const PF_BR: Br[] = [
	[[40, 86], [34, 66], [25, 44]],
	[[40, 86], [46, 64], [56, 42]],
	[[40, 86], [40, 60], [40, 28]],
	[[40, 86], [30, 77], [18, 66]],
	[[40, 86], [50, 77], [62, 64]],
];
function princessFlowers(pts: readonly Pt[]): string {
	let d = "";
	let sh = "";
	let st = "";
	let veins = "";
	for (const [x, y] of pts) {
		for (let i = 0; i < 5; i++) {
			const deg = -90 + i * 72;
			const [cx, cy] = at(x, y, deg, 3.2);
			sh += `M${ns(cx, cy)}h0`;
			d += `M${ns(cx, cy)}h0`;
			veins += segD(x, y, ...at(x, y, deg, 4.8));
			st += `M${f(x)} ${f(y)}q${f(Math.cos((deg + 36) * RAD) * 3)} ${f(Math.sin((deg + 36) * RAD) * 3)} ${f(Math.cos((deg + 20) * RAD) * 4.6)} ${f(Math.sin((deg + 20) * RAD) * 4.6 - 1)}`;
		}
	}
	return sk(sh, PF.puD, 6.6) + sk(d, PF.pu, 5.8) + sk(veins, PF.puD, 0.5, FAINT) + sk(st, PF.st, 0.55) + dots(pts, 1, "#f2eaf8");
}
function princess(st: GrowingStage): string {
	if (st === "sprout") return paint(shrub([[[40, 86], [40, 80], [40, 72]]], [0.45, 0.9], 7, 2.8, 0, 62, 0.1, false), PF, 1.3);
	if (st === "leafy") return paint(shrub(sc(PF_BR, 0.74), [0.35, 0.62, 0.88], 8.5, 3.2, 0, 60, 0.12), PF, 1.5) + p(leafD(31, 66, 150, 7, 2.6, 0, 1.5), PF.old);
	const t = tips(PF_BR);
	const [bx, by] = q(...PF_BR[2]!, 0.72);
	return (
		paint(shrub(PF_BR, [0.35, 0.6, 0.85], 9, 3.4, 0, 60, 0.12, false), PF, 1.6) +
		p(leafD(25, 70, 160, 8, 2.8, 0, 1.6) + leafD(55, 58, 15, 8, 2.8, 0, 1.6), PF.old) +
		dots([[bx + 3.2, by - 2.4], [t[3]![0] - 2, t[3]![1] - 1]], 1.6, PF.bud) +
		princessFlowers(t)
	);
}

/* ---------- 25. Mussaenda ---------- */
const MU = { leaf: "#3f7f3e", light: "#58985a", dark: "#2a5a2c", s: "#f2aebe", s2: "#f9cad6", rib: "#d27896", star: "#f5a81e", bud: "#8aaa5a" };
const MU_BR: Br[] = [
	[[40, 86], [33, 66], [24, 46]],
	[[40, 86], [47, 64], [56, 44]],
	[[40, 86], [40, 60], [40, 32]],
	[[40, 86], [30, 77], [17, 68]],
	[[40, 86], [50, 77], [63, 66]],
];
function mussClusters(pts: readonly Pt[], k: number[]): string {
	let a = "";
	let b = "";
	let rib = "";
	let st = "";
	const buds: Pt[] = [];
	pts.forEach(([x, y], i) => {
		const kk = k[i] ?? 1;
		[-170, -128, -85, -45, -5, 120].forEach((deg, j) => {
			const L = (j % 2 ? 7.4 : 8.6) * kk;
			const dr = L * 0.15;
			const d = leafD(x, y, deg + i * 7, L, L * 0.4, 0, dr);
			if (j % 2) a += d;
			else b += d;
			rib += ribD(x, y, deg + i * 6, L, dr);
		});
		st += starD(x - 1.4, y - 1.2, 5, 1.2) + starD(x + 1.6, y - 0.6, 5, 1.2);
		buds.push([x + 0.2, y + 1.4]);
	});
	return p(b, MU.s) + p(a, MU.s2) + sk(rib, MU.rib, 0.5) + dots(buds, 0.9, MU.bud) + sk(st, MU.star, 1);
}
function mussaenda(st: GrowingStage): string {
	if (st === "sprout") return paint(shrub([[[40, 86], [40, 80], [40, 72]]], [0.45, 0.9], 7.5, 3, 0, 62, 0.1, false), MU, 1.3);
	if (st === "leafy") return paint(shrub(sc(MU_BR, 0.74), [0.35, 0.62, 0.9], 9, 3.4, 0, 60, 0.12), MU, 1.5);
	return paint(shrub(MU_BR, [0.35, 0.62, 0.86], 9.5, 3.5, 0, 60, 0.12, false), MU, 1.6) + mussClusters(tips(MU_BR), [1.1, 1.1, 1.15, 0.85, 0.85]);
}

export const SPECIES: Species[] = [
	{ id: "torch-ginger", name: "Torch ginger", draw: torchGinger },
	{ id: "shell-ginger", name: "Shell ginger", draw: shellGinger },
	{ id: "butterfly-ginger", name: "Butterfly ginger", draw: butterflyGinger },
	{ id: "ixora", name: "Ixora", draw: ixora },
	{ id: "pentas", name: "Pentas", draw: pentas },
	{ id: "bat-flower", name: "Bat flower", draw: batFlower },
	{ id: "jade-vine", name: "Jade vine", draw: jadeVine },
	{ id: "medinilla", name: "Medinilla", draw: medinilla },
	{ id: "pagoda-flower", name: "Pagoda flower", draw: pagoda },
	{ id: "shrimp-plant", name: "Shrimp plant", draw: shrimpPlant },
	{ id: "lollipop-plant", name: "Lollipop plant", draw: lollipop },
	{ id: "firecracker-plant", name: "Firecracker plant", draw: firecracker },
	{ id: "bleeding-glory-bower", name: "Bleeding glory-bower", draw: gloryBower },
	{ id: "cats-whiskers", name: "Cat's whiskers", draw: catsWhiskers },
	{ id: "brazilian-plume-flower", name: "Brazilian plume flower", draw: plumeFlower },
	{ id: "blue-ginger", name: "Blue ginger", draw: blueGinger },
	{ id: "rangoon-creeper", name: "Rangoon creeper", draw: rangoon },
	{ id: "night-blooming-jasmine", name: "Night-blooming jasmine", draw: nightJasmine },
	{ id: "chenille-plant", name: "Chenille plant", draw: chenille },
	{ id: "pride-of-barbados", name: "Pride of Barbados", draw: prideBarbados },
	{ id: "spiral-ginger", name: "Spiral ginger", draw: spiralGinger },
	{ id: "lantana", name: "Lantana", draw: lantana },
	{ id: "rose-of-venezuela", name: "Rose of Venezuela", draw: roseVenezuela },
	{ id: "princess-flower", name: "Princess flower", draw: princess },
	{ id: "mussaenda", name: "Mussaenda", draw: mussaenda },
];
