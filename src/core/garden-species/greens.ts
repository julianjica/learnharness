/**
 * Garden species: leafy greens and brassicas (25). Drawn in the kit's flat
 * style; see kit.ts for the cell, the ground line and the shared shapes.
 *
 * Every plant is drawn relative to its root (0, 0) = (40, 87) with y up as
 * negative, and same-colour shapes are merged into one path per layer.
 */
import { f, type GrowingStage, type Species } from "./kit";

type St = GrowingStage;
const D = Math.PI / 180;
const by = <T>(st: St, a: T, b: T, c: T): T => (st === "sprout" ? a : st === "leafy" ? b : c);
const pol = (x: number, y: number, deg: number, r: number): [number, number] => [x + Math.cos(deg * D) * r, y + Math.sin(deg * D) * r];
const P = (x: number, y: number): string => `${f(x)} ${f(y)}`;
type N3 = [number, number, number];
type N4 = [number, number, number, number];

/** Collects path data per (layer, style) and emits one <path> per group, layers in order. */
class Ink {
	private m = new Map<string, { z: number; a: string; d: string }>();
	private add(z: number, a: string, d: string): this {
		const k = `${z}|${a}`;
		const e = this.m.get(k);
		if (e) e.d += d;
		else this.m.set(k, { z, a, d });
		return this;
	}
	fill(z: number, c: string, d: string): this {
		return this.add(z, `fill="${c}"`, d);
	}
	line(z: number, c: string, w: number, d: string): this {
		return this.add(z, `fill="none" stroke="${c}" stroke-width="${f(w)}" stroke-linecap="round" stroke-linejoin="round"`, d);
	}
	/** Round dots as zero-length strokes. */
	dots(z: number, c: string, r: number, pts: readonly (readonly [number, number])[]): this {
		return this.line(z, c, r * 2, pts.map(([x, y]) => `M${P(x, y)}h0`).join(""));
	}
	/** A straight segment from (x, y) along deg for len. */
	seg(z: number, c: string, w: number, x: number, y: number, deg: number, len: number): this {
		const [a, b] = pol(x, y, deg, len);
		return this.line(z, c, w, `M${P(x, y)}L${P(a, b)}`);
	}
	toString(): string {
		return [...this.m.values()]
			.map((e, i) => ({ ...e, i }))
			.sort((a, b) => a.z - b.z || a.i - b.i)
			.map((e) => `<path d="${e.d}" ${e.a}/>`)
			.join("");
	}
}

/** Width profiles along a leaf, t in 0..1. */
type Prof = (t: number) => number;
const OVAL: Prof = (t) => Math.sin(Math.PI * t);
const SPOON: Prof = (t) => Math.sin(Math.PI * t ** 1.8);
const LANCE: Prof = (t) => Math.sin(Math.PI * t ** 0.65);
const ROUND: Prof = (t) => Math.sin(Math.PI * t) ** 0.55;

interface WL {
	p?: Prof;
	/** Edge vertices per side. */
	n?: number;
	/** Scallop bulge between vertices (crinkled / ruffled edges). */
	amp?: number;
	/** Lobe depth 0..1: every odd vertex is pulled in (lobed / serrated edges). */
	depth?: number;
}

/** A leaf outline from (x, y) pointing at ang for len, half-width w: path data. */
function wleaf(x: number, y: number, ang: number, len: number, w: number, o: WL = {}): string {
	const { p = OVAL, n = 8, amp = 0, depth = 0 } = o;
	const c = Math.cos(ang * D);
	const s = Math.sin(ang * D);
	const pt = (u: number, v: number) => P(x + u * c - v * s, y + u * s + v * c);
	const half = (i: number) => w * p(i / n) * (i % 2 === 1 && i < n ? 1 - depth : 1);
	let d = `M${pt(0, 0)}`;
	for (const sg of [-1, 1]) {
		const idx = sg < 0 ? [...Array(n).keys()].map((i) => i + 1) : [...Array(n).keys()].map((i) => n - 1 - i);
		let prev = sg < 0 ? 0 : n;
		for (const i of idx) {
			const v = sg * half(i);
			if (amp) {
				const tm = (prev + i) / 2;
				d += `Q${pt((tm / n) * len, sg * (w * p(tm / n) + amp))} ${pt((i / n) * len, v)}`;
			} else d += `L${pt((i / n) * len, v)}`;
			prev = i;
		}
	}
	return d + "Z";
}

/** Kit leaf outlines 0 oval, 1 pointed, 2 round, 4 heart, as path data at (x, y). */
const SHAPES = {
	0: [[0.3, -1], [0.8, -1], [1, 0], [0.8, 1], [0.3, 1]],
	1: [[0.45, -1.15], [0.8, -0.5], [1, 0], [0.8, 0.5], [0.45, 1.15]],
	2: [[0.05, -1.4], [1.02, -1.3], [1, 0], [1.02, 1.3], [0.05, 1.4]],
	4: [[0.1, -1.6], [0.75, -1.2], [1, 0], [0.75, 1.2], [0.1, 1.6]],
} as const;
function kleaf(x: number, y: number, ang: number, len: number, w: number, shape: 0 | 1 | 2 | 4 = 0): string {
	const c = Math.cos(ang * D);
	const s = Math.sin(ang * D);
	const pt = (u: number, v: number) => P(x + u * c - v * s, y + u * s + v * c);
	const k = SHAPES[shape].map(([u, v]) => pt(u * len, v * w));
	return `M${pt(0, 0)}C${k[0]} ${k[1]} ${k[2]}C${k[3]} ${k[4]} ${pt(0, 0)}Z`;
}

/** Rib from (x, y) along ang, from r0 to r1. */
function rib(x: number, y: number, ang: number, r0: number, r1: number): string {
	const [a, b] = pol(x, y, ang, r0);
	const [c, d] = pol(x, y, ang, r1);
	return `M${P(a, b)}L${P(c, d)}`;
}

/** Ellipse as path data (axis-aligned). */
function ellD(cx: number, cy: number, rx: number, ry: number): string {
	return `M${P(cx - rx, cy)}a${f(rx)} ${f(ry)} 0 1 0 ${f(2 * rx)} 0a${f(rx)} ${f(ry)} 0 1 0 ${f(-2 * rx)} 0Z`;
}

/** Cubic as path data. */
function cub(a: readonly [number, number], b: readonly [number, number], c: readonly [number, number], d: readonly [number, number]): string {
	return `M${P(a[0], a[1])}C${P(b[0], b[1])} ${P(c[0], c[1])} ${P(d[0], d[1])}`;
}

/** Four-petalled crucifer flower: petals as dots around (x, y). */
function cross(ink: Ink, z: number, x: number, y: number, r: number, petal: string, eye?: string): void {
	ink.dots(z, petal, r * 0.62, [
		[x - r * 0.62, y],
		[x + r * 0.62, y],
		[x, y - r * 0.62],
		[x, y + r * 0.62],
	]);
	if (eye) ink.dots(z + 0.5, eye, r * 0.3, [[x, y]]);
}

/** The plant, placed at the root, optionally squashed vertically. */
const at = (ink: Ink | string): string => `<g transform="translate(40 87)">${ink}</g>`;
/** The plant scaled uniformly (for sprouts drawn as a small version). */
const atK = (ink: Ink | string, k: number): string => `<g transform="translate(40 87) scale(${(Math.round(k * 100) / 100).toString()})">${ink}</g>`;

/** Two seed leaves on a short stem, for a seedling. */
function cotyledons(ink: Ink, h: number, len: number, fill: string, stemC: string, shape: 0 | 2 = 2): void {
	ink.line(0, stemC, 1.4, `M0 0L0 ${f(-h)}`);
	ink.fill(1, fill, kleaf(0, -h, -160, len, len * 0.42, shape) + kleaf(0, -h, -20, len, len * 0.42, shape));
}

/* ---------------------------------------------------------------- 1 spinach */
const SPIN = { a: "#2f6e3b", b: "#3b8146", rib: "#8fc08a", stalk: "#5c9a52" };
function spinach(st: St): string {
	const ink = new Ink();
	const ring = (angs: number[], len: number, pl: number, z: number, fill: string) => {
		for (const a of angs) {
			ink.seg(z, SPIN.stalk, 1.6, 0, -1, a, pl);
			const [x, y] = pol(0, -1, a, pl - 1);
			ink.fill(z + 0.1, fill, wleaf(x, y, a, len, len * 0.36, { p: (t) => Math.sin(Math.PI * t ** 0.85), n: 6, amp: 0.7 }));
			ink.line(z + 0.2, SPIN.rib, 0.8, rib(x, y, a, 1, len * 0.82));
		}
	};
	if (st === "sprout") {
		ring([-150, -30], 8, 3, 0, SPIN.b);
		ring([-100, -80], 9, 4, 1, SPIN.a);
		return at(ink);
	}
	if (st === "leafy") {
		ring([-160, -20], 15, 6, 0, SPIN.b);
		ring([-130, -50], 18, 7, 1, SPIN.a);
		ring([-102, -78], 19, 8, 2, SPIN.b);
		return at(ink);
	}
	ring([-165, -15], 21, 8, 0, SPIN.a);
	ring([-140, -40], 25, 9, 1, SPIN.b);
	ring([-118, -62], 27, 11, 2, SPIN.a);
	ring([-98, -82], 25, 12, 3, SPIN.b);
	ring([-90], 18, 10, 4, SPIN.a);
	return at(ink);
}

/* ----------------------------------------------------------- 2 swiss chard */
const CHARD = { leaf: ["#3a7536", "#477f3c"], stalks: ["#c8323c", "#e8b830", "#e5d9c9", "#e07a3a", "#d0487a"] };
function chard(st: St): string {
	const ink = new Ink();
	const L = by<N4[]>(
		st,
		[[-118, 6, 9, 4], [-62, 6, 9, 4], [-90, 8, 10, 4.2]],
		[[-130, 12, 18, 7], [-50, 12, 18, 7], [-108, 16, 22, 8], [-72, 16, 22, 8], [-90, 20, 20, 7.5]],
		[[-138, 16, 24, 9], [-42, 16, 24, 9], [-118, 22, 30, 10], [-62, 22, 30, 10], [-102, 28, 30, 10], [-80, 28, 30, 10], [-91, 32, 24, 8.5]],
	);
	L.forEach(([a, pl, len, w], i) => {
		const c = CHARD.stalks[i % CHARD.stalks.length]!;
		const sw = st === "sprout" ? 1.4 : st === "leafy" ? 2.2 : 2.8;
		const bend = a < -90 ? -4 : a > -90 ? 4 : 0;
		ink.line(i * 2, c, sw, `M${P(i % 2 ? 1 : -1, 0)}L${P(...pol(0, 0, a, pl))}`);
		const [x, y] = pol(0, 0, a, pl - 1);
		ink.fill(i * 2 + 1, CHARD.leaf[i % 2]!, wleaf(x, y, a + bend, len, w, { n: 8, amp: 1 }));
		ink.line(i * 2 + 1.5, c, sw * 0.55, rib(x, y, a + bend, 0, len * 0.85));
	});
	return at(ink);
}

/* --------------------------------------------------------------- 3 arugula */
const ARU = { a: "#5c9a45", b: "#4c8a3a", stem: "#5f8f45", petal: "#f2ecd6", eye: "#7a3f6a", pod: "#7ea458" };
function arugula(st: St): string {
	const ink = new Ink();
	const lyre: WL = { p: (t) => Math.sin(Math.PI * t ** 1.5), n: 9, depth: 0.55 };
	const L = by<N3[]>(
		st,
		[[-140, 9, 3], [-40, 9, 3], [-95, 11, 3.6]],
		[[-165, 20, 5.5], [-15, 20, 5.5], [-135, 24, 6], [-45, 24, 6], [-105, 26, 6.5], [-75, 26, 6.5]],
		[[-168, 22, 6], [-12, 22, 6], [-140, 26, 6.5], [-40, 26, 6.5], [-112, 27, 7], [-68, 27, 7], [-92, 24, 6.5]],
	);
	L.forEach(([a, len, w], i) => {
		ink.fill(1 + (i % 2), i % 2 ? ARU.b : ARU.a, wleaf(0, -1, a, len, w, lyre));
		ink.line(3, "#3f6f30", 0.7, rib(0, -1, a, 1, len * 0.8));
	});
	if (st === "bloom") {
		const stems: [number, number][][] = [
			[[-2, -8], [-6, -30], [-14, -50], [-16, -68]],
			[[0, -8], [1, -35], [2, -55], [3, -78]],
			[[2, -8], [8, -28], [16, -46], [19, -62]],
		];
		for (const s of stems) {
			ink.line(4, ARU.stem, 1.2, cub(s[0]!, s[1]!, s[2]!, s[3]!));
			const [x, y] = s[3]!;
			cross(ink, 6, x, y, 3.4, ARU.petal, ARU.eye);
			cross(ink, 6, x - 4, y + 6, 2.8, ARU.petal, ARU.eye);
			cross(ink, 6, x + 3.5, y + 11, 2.6, ARU.petal, ARU.eye);
			const [mx, my] = s[2]!;
			ink.line(5, ARU.pod, 0.9, `M${P(mx, my)}l-5 -3M${P(mx, my + 6)}l5 -3M${P(mx, my - 6)}l4 -4`);
		}
	}
	return at(ink);
}

/* --------------------------------------------------------------- 4 bok choy */
const BOK = { stalk: "#eef2dc", stalk2: "#dbe6c2", a: "#3c7a3c", b: "#2f6a33" };
function bokChoy(st: St): string {
	const ink = new Ink();
	const k = by(st, 0.42, 0.75, 1);
	// [base x, angle, stalk len, blade len, blade half-width]
	const L: [number, number, number, number, number][] =
		st === "sprout"
			? [[-1, -112, 20, 22, 9], [1, -68, 20, 22, 9], [0, -90, 24, 22, 8]]
			: [[-5, -118, 22, 24, 10], [5, -62, 22, 24, 10], [-3, -104, 26, 28, 10.5], [3, -76, 26, 28, 10.5], [0, -90, 28, 28, 10]];
	L.forEach(([x0, a, sl, bl, bw], i) => {
		const z = i * 3;
		ink.fill(z, i % 2 ? BOK.stalk2 : BOK.stalk, wleaf(x0, 0, a, sl + 4, 5.2, { p: (t) => Math.sin(Math.PI * (0.18 + 0.4 * t)), n: 6 }));
		const [x, y] = pol(x0, 0, a, sl);
		const ba = a + (a + 90) * 0.3;
		const [bx, by2] = pol(x0, 0, a, sl - 8);
		ink.fill(z + 1, i % 2 ? BOK.b : BOK.a, wleaf(bx, by2, ba, bl + 4, bw * 0.8, { p: (t) => Math.sin(Math.PI * t ** 1.25) ** 0.7, n: 8, amp: 0.4 }));
		ink.line(z + 2, BOK.stalk, 1.4, rib(bx, by2, ba, -2, bl * 0.8));
	});
	return atK(ink, k);
}

/* ----------------------------------------------------------- 5 napa cabbage */
const NAPA = { outer: "#7fb35f", mid: "#a9d07c", in: "#c9e09a", core: "#e3edb6", rib: "#f4f6e6" };
function napa(st: St): string {
	const ink = new Ink();
	const k = by(st, 0.36, 0.72, 1);
	const crinkle: WL = { p: SPOON, n: 10, amp: 1.1 };
	if (st !== "sprout") {
		ink.fill(0, NAPA.outer, wleaf(-2, 0, -150, 26, 9, crinkle) + wleaf(2, 0, -30, 26, 9, crinkle));
		ink.line(0.5, NAPA.rib, 1.2, rib(-2, 0, -150, 0, 21) + rib(2, 0, -30, 0, 21));
	}
	const head: [number, number, number, number, string][] = [
		[0, -90, 54, 10, NAPA.core],
		[-3, -97, 52, 11, NAPA.in],
		[3, -83, 52, 11, NAPA.in],
		[-5, -104, 46, 10, NAPA.mid],
		[5, -76, 46, 10, NAPA.mid],
	];
	head.forEach(([x, a, len, w, c], i) => {
		ink.fill(1 + i, c, wleaf(x, 0, a, len, w, crinkle));
		ink.line(1.5 + i, NAPA.rib, i < 3 ? 1.4 : 2, rib(x, 0, a, 0, len * 0.8));
	});
	return atK(ink, k);
}

/* ------------------------------------------------------- 6 brussels sprouts */
const BRU = { stem: "#a3c48a", sprout: "#79b25c", sproutL: "#9ccc72", leaf: "#5e9a78", leaf2: "#6eab88", vein: "#cfe3d2" };
function brussels(st: St): string {
	const ink = new Ink();
	if (st === "sprout") {
		cotyledons(ink, 8, 7, BRU.leaf2, BRU.stem);
		ink.fill(2, BRU.leaf, kleaf(0, -8, -90, 8, 3.6, 2));
		return at(ink);
	}
	const h = st === "leafy" ? 30 : 56;
	ink.line(0, BRU.stem, st === "leafy" ? 3 : 4.4, `M0 0L0 ${-h}`);
	const top = st === "leafy" ? [-160, -125, -95, -65, -25] : [-170, -140, -112, -88, -62, -35, -8];
	const len = st === "leafy" ? 15 : 19;
	top.forEach((a, i) => {
		const pl = st === "leafy" ? 4 : 6;
		ink.seg(1, BRU.stem, 1.4, 0, -h, a, pl);
		const [x, y] = pol(0, -h, a, pl - 0.5);
		ink.fill(2 + (i % 2), i % 2 ? BRU.leaf2 : BRU.leaf, wleaf(x, y, a, len, len * 0.42, { p: ROUND, n: 7, amp: 0.4 }));
		ink.line(4, BRU.vein, 0.8, rib(x, y, a, 0, len * 0.8));
	});
	if (st === "leafy") {
		for (const [y, a] of [[-12, -150], [-20, -30]] as const) {
			ink.seg(1, BRU.stem, 1.3, 0, y, a, 5);
			const [x2, y2] = pol(0, y, a, 4.5);
			ink.fill(2, BRU.leaf, wleaf(x2, y2, a, 13, 5.5, { p: ROUND, n: 7 }));
		}
		return at(ink);
	}
	const back: [number, number][] = [];
	const front: [number, number][] = [];
	const scars: string[] = [];
	for (let i = 0, y = -7; y > -50; i++, y -= 4.4) {
		const side = i % 3;
		if (side === 2) front.push([0, y]);
		else back.push([side ? 3.6 : -3.6, y - 1]);
		scars.push(`M${P(side ? -2.4 : 2.4, y - 2)}l${side ? -2 : 2} -1.4`);
	}
	ink.line(0.5, "#86a86e", 0.9, scars.join(""));
	ink.dots(5, BRU.sprout, 3.1, back);
	ink.dots(6, BRU.sproutL, 3.3, front);
	ink.dots(7, "#bfe09a", 1, [...back, ...front].map(([x, y]) => [x - 1.1, y - 1.1] as const));
	return at(ink);
}

/* ------------------------------------------------------------ 7 cauliflower */
const CAU = { leaf: "#5f9e80", leaf2: "#4f8a6e", vein: "#d6e6da", curd: "#f2ead2", bump: "#e3d6b2" };
function cauliflower(st: St): string {
	const ink = new Ink();
	const k = by(st, 0.36, 0.74, 1);
	const shape: WL = { p: (t) => Math.sin(Math.PI * t ** 1.2), n: 8, amp: 0.35 };
	const back: [number, number, number][] = st === "sprout" ? [[-120, 34, 10], [-60, 34, 10], [-90, 30, 9]] : [[-158, 32, 10], [-22, 32, 10], [-132, 38, 11], [-48, 38, 11], [-108, 42, 11], [-72, 42, 11]];
	back.forEach(([a, len, w], i) => {
		ink.fill(i % 2 ? 1 : 0, i % 2 ? CAU.leaf : CAU.leaf2, wleaf(0, 0, a, len, w, shape));
		ink.line(2, CAU.vein, 1.1, rib(0, 0, a, 0, len * 0.85));
	});
	if (st === "bloom") {
		ink.fill(3, CAU.curd, `M-16 -22C-17 -38 -8 -44 0 -44C8 -44 17 -38 16 -22Z`);
		const bumps: [number, number][] = [];
		for (const [y, xs] of [[-40, [-5, 1, 7]], [-35, [-11, -5, 1, 7, 12]], [-29, [-14, -8, -2, 4, 10, 15]]] as const) for (const x of xs) bumps.push([x, y]);
		ink.line(4, CAU.bump, 0.9, bumps.map(([x, y]) => `M${P(x - 2.4, y + 1)}a2.6 2.6 0 0 1 5 0`).join(""));
		ink.fill(5, CAU.leaf, wleaf(-2, 0, -118, 30, 9, shape) + wleaf(2, 0, -62, 30, 9, shape));
		ink.line(6, CAU.vein, 1.1, rib(-2, 0, -118, 0, 25) + rib(2, 0, -62, 0, 25));
	}
	return atK(ink, k);
}

/* --------------------------------------------------------------- 8 kohlrabi */
const KOH = { bulb: "#8b5aa0", hi: "#a97cc0", stalk: "#7a4a8e", leaf: "#6ca383", leaf2: "#5d9474", vein: "#cfe2d6" };
function kohlrabi(st: St): string {
	const ink = new Ink();
	const r = by(st, 2.5, 6.5, 12);
	const cy = -r;
	const stalkLen = by(st, 5, 12, 16);
	const len = by(st, 7, 14, 19);
	const angs = by(st, [-130, -50], [-150, -115, -65, -30, -90], [-160, -132, -108, -72, -48, -20, -90]);
	angs.forEach((a, i) => {
		const [sx, sy] = pol(0, cy, a, r * 0.85);
		const up = a + (-90 - a) * 0.35;
		const [ex, ey] = pol(sx, sy, up, stalkLen);
		ink.line(0, KOH.stalk, by(st, 1, 1.3, 1.6), `M${P(sx, sy)}Q${P(...pol(sx, sy, a, stalkLen * 0.5))} ${P(ex, ey)}`);
		ink.fill(3 + (i % 2), i % 2 ? KOH.leaf2 : KOH.leaf, wleaf(ex, ey, up, len, len * 0.36, { p: (t) => Math.sin(Math.PI * t ** 1.1), n: 8, amp: 0.45 }));
		ink.line(5, KOH.vein, 0.8, rib(ex, ey, up, 0, len * 0.8));
	});
	ink.fill(1, KOH.bulb, ellD(0, cy, r * 1.05, r));
	ink.fill(2, KOH.hi, ellD(-r * 0.38, cy - r * 0.32, r * 0.32, r * 0.24));
	return at(ink);
}

/* --------------------------------------------------------- 9 collard greens */
const COL = { a: "#3f7a62", b: "#4f8c72", vein: "#cfe2d4", stem: "#7f9e72", scar: "#5f7e55" };
function collard(st: St): string {
	const ink = new Ink();
	const sw = by(st, 1.3, 2.4, 3.4);
	const h = by(st, 4, 12, 26);
	ink.line(0, COL.stem, sw, `M0 0L0 ${-h}`);
	if (st === "bloom") ink.line(0.5, COL.scar, 1, `M-1.6 -4l3.2 1M-1.6 -10l3.2 -1`);
	// [y on the stem, angle, length, half-width]
	const L = by<N4[]>(
		st,
		[[-4, -140, 9, 4.2], [-4, -40, 9, 4.2], [-4, -90, 10, 4.4]],
		[[-4, -150, 16, 7], [-8, -32, 17, 7.5], [-12, -122, 19, 8], [-12, -62, 19, 8], [-12, -92, 18, 7.5]],
		[[-12, -160, 22, 9.5], [-16, -22, 23, 10], [-20, -138, 27, 11], [-23, -45, 27, 11], [-26, -114, 28, 11], [-26, -70, 28, 11], [-26, -92, 24, 9.5]],
	);
	const paddle: WL = { p: (t) => Math.sin(Math.PI * t ** 1.15) ** 0.7, n: 8, amp: 0.3 };
	L.forEach(([y0, a, len, w], i) => {
		ink.seg(1 + i, COL.stem, sw * 0.6, 0, y0, a, 3.5);
		const [x, y] = pol(0, y0, a, 3);
		ink.fill(1.2 + i, i % 2 ? COL.b : COL.a, wleaf(x, y, a, len, w, paddle));
		let v = rib(x, y, a, 0, len * 0.9);
		if (st !== "sprout")
			for (const t of [0.35, 0.62]) {
				const [mx, my] = pol(x, y, a, len * t);
				v += rib(mx, my, a - 45, 0, w * 0.6) + rib(mx, my, a + 45, 0, w * 0.6);
			}
		ink.line(1.4 + i, COL.vein, 0.75, v);
	});
	return at(ink);
}

/* ------------------------------------------------------------- 10 romanesco */
const ROM = { leaf: "#5f9a7a", leaf2: "#4f8a6b", vein: "#d3e5d8", head: "#97b744", cone: "#c3dc66", shade: "#9cbb48" };
function romanesco(st: St): string {
	const ink = new Ink();
	const k = by(st, 0.36, 0.76, 1);
	const shape: WL = { p: LANCE, n: 9, amp: 0.5 };
	const back: [number, number, number][] = st === "sprout" ? [[-118, 30, 7], [-62, 30, 7], [-90, 26, 6]] : [[-165, 30, 8], [-15, 30, 8], [-138, 36, 9], [-42, 36, 9], [-112, 40, 9], [-68, 40, 9]];
	back.forEach(([a, len, w], i) => {
		ink.fill(i % 2, i % 2 ? ROM.leaf : ROM.leaf2, wleaf(0, 0, a, len, w, shape));
		ink.line(2, ROM.vein, 1, rib(0, 0, a, 0, len * 0.85));
	});
	if (st === "bloom") {
		ink.fill(3, ROM.head, `M-17 -16Q-14 -38 0 -58Q14 -38 17 -16Z`);
		let c = "";
		let sh = "";
		const rows: [number, number, number][] = [[-24, 5, 3.6], [-32, 4, 3.2], [-40, 3, 2.8], [-47, 2, 2.4], [-53, 1, 2.1]];
		for (const [y, n, w] of rows) {
			const span = (17 * (y + 58)) / 42 - w;
			for (let i = 0; i < n; i++) {
				const x = n === 1 ? 0 : -span + (2 * span * i) / (n - 1);
				const hh = w * 2.1;
				c += `M${P(x - w, y)}L${P(x, y - hh)}L${P(x + w, y)}Z`;
				sh += `M${P(x, y - hh)}L${P(x + w, y)}L${P(x + 0.4, y)}Z`;
			}
		}
		ink.fill(4, ROM.cone, c);
		ink.fill(5, ROM.shade, sh);
		ink.fill(6, ROM.leaf, wleaf(-2, 0, -120, 28, 8, shape) + wleaf(2, 0, -60, 28, 8, shape));
		ink.line(7, ROM.vein, 1, rib(-2, 0, -120, 0, 24) + rib(2, 0, -60, 0, 24));
	}
	return atK(ink, k);
}

/* -------------------------------------------------------- 11 mustard greens */
const MUS = { red: "#7d3a55", red2: "#6a2f48", green: "#5f8a3a", rib: "#c9d9a8", stem: "#6f8a48", flower: "#ecc93a" };
function mustard(st: St): string {
	const ink = new Ink();
	const frill: WL = { p: (t) => Math.sin(Math.PI * t ** 1.3), n: 12, amp: 1.1 };
	// [angle, length, half-width, back?]
	const L = by<N4[]>(
		st,
		[[-130, 10, 3.6, 0], [-50, 10, 3.6, 0], [-90, 12, 4, 1]],
		[[-116, 28, 6.5, 1], [-64, 28, 6.5, 1], [-158, 19, 5.5, 0], [-22, 19, 5.5, 0], [-102, 22, 6, 0], [-78, 22, 6, 0]],
		[[-128, 36, 7.5, 1], [-92, 38, 7.5, 1], [-54, 36, 7.5, 1], [-164, 25, 6.5, 0], [-16, 25, 6.5, 0], [-138, 28, 7, 0], [-42, 28, 7, 0], [-106, 28, 7, 0], [-74, 28, 7, 0]],
	);
	L.forEach(([a, len, w, back], i) => {
		const c = back && st !== "sprout" ? MUS.green : i % 2 ? MUS.red : MUS.red2;
		ink.fill(back ? 1 : 3, c, wleaf(0, -1, a, len, w, frill));
		ink.line(back ? 2 : 4, MUS.rib, 1, rib(0, -1, a, 0, len * 0.85));
	});
	if (st === "bloom") {
		ink.line(0, MUS.stem, 1.6, `M0 -4L1 -66M1 -40Q10 -46 14 -62M0 -34Q-9 -42 -13 -58`);
		const fl: [number, number][] = [[1, -68], [-2, -72], [4, -72], [1, -76], [14, -64], [12, -68], [16, -68], [-13, -60], [-15, -64], [-11, -64]];
		ink.dots(10, MUS.flower, 1.6, fl);
		ink.dots(10, "#a8c060", 1, [[1, -79], [14, -71], [-13, -67]]);
		ink.line(9, "#8aa458", 0.8, `M1 -58l-4 -3M1 -52l4 -3M14 -56l4 -2M-13 -52l-4 -2`);
	}
	return at(ink);
}

/* ------------------------------------------------------------ 12 watercress */
const WAT = { leaf: "#3f8a3e", leaf2: "#4f9c48", stem: "#5c9a4a", flower: "#f6f4ec" };
function watercress(st: St): string {
	const ink = new Ink();
	const spec = by(
		st,
		[[-130, 10, 3], [-55, 11, 3]] as [number, number, number][],
		[[-160, 22, 5], [-125, 24, 5], [-90, 22, 5], [-55, 24, 5], [-20, 22, 5]] as [number, number, number][],
		[[-168, 30, 6], [-136, 31, 6], [-108, 32, 6], [-75, 32, 6], [-44, 31, 6], [-12, 30, 6]] as [number, number, number][],
	);
	const ls = by(st, 2.6, 3.4, 3.8);
	spec.forEach(([a, len, n], i) => {
		const lift = a < -90 ? 30 : a > -90 ? -30 : 0;
		const p0: [number, number] = [0, -1];
		const p1 = pol(0, -1, a + lift, len * 0.45);
		const p2 = pol(0, -1, a + lift * 0.4, len * 0.85);
		const p3 = pol(0, -1, a - lift * 0.15, len);
		ink.line(0, WAT.stem, 1.1, cub(p0, p1, p2, p3));
		let d = "";
		for (let j = 2; j < n; j++) {
			const t = j / n;
			const u = 1 - t;
			const x = u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0];
			const y = u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1];
			const dir = a + lift * (1 - t);
			d += kleaf(x, y, dir - 70, ls, ls * 0.5, 2) + kleaf(x, y, dir + 70, ls, ls * 0.5, 2);
		}
		d += kleaf(p3[0], p3[1], a, ls * 1.5, ls * 0.75, 2);
		ink.fill(1 + (i % 2), i % 2 ? WAT.leaf2 : WAT.leaf, d);
		if (st === "bloom" && i % 2 === 0) {
			const [tx, ty] = pol(p2[0], p2[1], -90, 6);
			ink.line(3, WAT.stem, 0.9, `M${P(p2[0], p2[1])}L${P(tx, ty)}`);
			ink.dots(4, WAT.flower, 1.2, [[tx, ty - 1], [tx - 1.8, ty + 0.8], [tx + 1.8, ty + 0.8], [tx, ty + 2]]);
		}
	});
	return at(ink);
}

/* ---------------------------------------------------------------- 13 endive */
const END = { outer: "#7fb548", mid: "#a4c95a", heart: "#e2e383", stem: "#7c9f5a", flower: "#8aa6e6", flower2: "#6f8fd6" };
/** Frisée: many fine, curling, jagged strands with a blanched yellow heart. */
function endive(st: St): string {
	const ink = new Ink();
	const R = by(st, 11, 22, 28);
	const n = by(st, 8, 13, 16);
	const strands = (z: number, c: string, len: number, a0: number, a1: number, cnt: number, w: number) => {
		let d = "";
		for (let i = 0; i < cnt; i++) {
			const a = a0 + ((a1 - a0) * i) / (cnt - 1) + 5 * Math.sin(i * 2.9);
			const L = len * (0.8 + 0.2 * Math.sin(i * 2.3));
			const curl = (a < -90 ? -1 : 1) * (10 + 8 * Math.abs(Math.sin(i * 1.3)));
			let x = 0;
			let y = -1;
			let ang = a;
			d += `M0 -1`;
			for (let j = 1; j <= 5; j++) {
				ang += curl * (j / 5);
				[x, y] = pol(x, y, ang + (j % 2 ? 22 : -22), L / 5);
				d += `L${P(x, y)}`;
				if (j === 2 || j === 4) {
					const [bx, by2] = pol(x, y, ang + (j === 2 ? 55 : -55), L * 0.16);
					d += `M${P(bx, by2)}L${P(x, y)}`;
				}
			}
		}
		ink.line(z, c, w, d);
	};
	const w = by(st, 1, 1.2, 1.3);
	strands(1, END.outer, R, -172, -8, n, w);
	strands(2, END.mid, R * 0.8, -158, -22, n - 3, w);
	if (st !== "sprout") strands(3, END.heart, R * 0.52, -140, -40, n - 6, w * 1.2);
	if (st === "bloom") {
		ink.line(0, END.stem, 1.3, `M0 -6L0 -62M0 -30L-12 -50M0 -40L11 -58`);
		const fl: [number, number, number][] = [[0, -64, 0], [-12, -52, 20], [11, -60, 10], [-4, -44, 35], [5, -36, 5]];
		let d = "";
		for (const [x, y, o] of fl)
			for (let i = 0; i < 9; i++) {
				const a = o + i * 40;
				const [ax, ay] = pol(x, y, a, 1.3);
				const [bx, by2] = pol(x, y, a, 4.4);
				d += `M${P(ax, ay)}L${P(bx, by2)}`;
			}
		ink.line(4, END.flower, 1.5, d);
		ink.dots(5, END.flower2, 1.1, fl.map(([x, y]) => [x, y] as const));
	}
	return at(ink);
}

/* ------------------------------------------------------------- 14 radicchio */
const RAD = { head: "#8e1f3c", head2: "#a32a49", fold: "#6e1530", vein: "#f1e3e8", outer: "#6b8a45", outer2: "#7f3a3e" };
function radicchio(st: St): string {
	const ink = new Ink();
	const round: WL = { p: ROUND, n: 8, amp: 0.5 };
	if (st === "sprout") {
		ink.fill(1, RAD.outer, wleaf(0, -1, -130, 10, 3.6, round) + wleaf(0, -1, -50, 10, 3.6, round));
		ink.fill(2, RAD.outer2, wleaf(0, -1, -90, 11, 3.8, round));
		ink.line(3, RAD.vein, 0.7, rib(0, -1, -130, 0, 8) + rib(0, -1, -50, 0, 8) + rib(0, -1, -90, 0, 9));
		return at(ink);
	}
	const leafy = st === "leafy";
	const outer: [number, number, number, string][] = leafy
		? [[-160, 18, 7, RAD.outer], [-20, 18, 7, RAD.outer], [-125, 22, 8, RAD.outer2], [-55, 22, 8, RAD.outer2], [-92, 22, 8, RAD.outer]]
		: [[-172, 24, 9, RAD.outer], [-8, 24, 9, RAD.outer], [-148, 22, 9, RAD.outer2], [-32, 22, 9, RAD.outer2]];
	outer.forEach(([a, len, w, c], i) => {
		ink.fill(1 + i * 0.1, c, wleaf(0, -1, a, len, w, round));
		ink.line(2, RAD.vein, 0.8, rib(0, -1, a, 0, len * 0.8));
	});
	if (leafy) {
		ink.fill(3, RAD.head, ellD(0, -8, 6, 6));
		ink.line(4, RAD.vein, 0.8, `M-1 -2Q-4 -7 -2 -13M2 -2Q5 -7 3 -13`);
		return at(ink);
	}
	const r = 16;
	const cy = -r - 1;
	ink.fill(3, RAD.head, ellD(0, cy, r, r));
	ink.fill(4, RAD.head2, `M0 ${f(cy - r)}C${P(r * 1.2, cy - r * 0.6)} ${P(r * 1.1, cy + r * 0.8)} ${P(-1, cy + r)}C${P(r * 0.5, cy + 3)} ${P(r * 0.45, cy - r * 0.6)} 0 ${f(cy - r)}Z`);
	ink.line(5, RAD.fold, 1, `M${P(-r * 0.7, cy - r * 0.7)}Q${P(-2, cy - r * 0.2)} ${P(r * 0.2, cy + r * 0.95)}`);
	ink.line(6, RAD.vein, 1, `M-1 -2Q-12 -10 -10 -28M0 -2Q-5 -14 -3 -31M1 -2Q8 -10 9 -24M1 -2Q14 -12 12 -27M-4 -14l-5 -2M-11 -19l-3 -1M10 -16l3 -2`);
	return at(ink);
}

/* ---------------------------------------------------------------- 15 mizuna */
const MIZ = { a: "#5aa548", b: "#43873a", c: "#6db857", stalk: "#e6efd6" };
/** Feathery, deeply cut leaves: white stalks, then a rachis with narrow forward lobes. */
function mizuna(st: St): string {
	const ink = new Ink();
	const cnt = by(st, 4, 9, 12);
	const len = by(st, 12, 26, 34);
	const m = by(st, 3, 5, 6);
	const lw = by(st, 1.1, 1.5, 1.7);
	const cols = [MIZ.a, MIZ.b, MIZ.c];
	for (let i = 0; i < cnt; i++) {
		const a = -166 + (152 * i) / (cnt - 1) + 6 * Math.sin(i * 2.1);
		const l = len * (0.76 + 0.24 * Math.abs(Math.sin(i * 1.7 + 0.6)));
		const sl = l * 0.3;
		ink.seg(0, MIZ.stalk, lw * 0.8, 0, -1, a, sl + 1);
		const [x, y] = pol(0, -1, a, sl);
		const ta = a + (a < -90 ? 12 : -12) * (Math.abs(a + 90) / 76);
		const rl = l - sl;
		const [ex, ey] = pol(x, y, ta, rl);
		let d = `M${P(x, y)}L${P(ex, ey)}`;
		for (let j = 1; j <= m; j++) {
			const t = j / (m + 0.4);
			const [mx, my] = pol(x, y, ta, rl * t);
			const ll = rl * 0.24 * (1.15 - t * 0.6);
			for (const s of [-1, 1]) {
				const [lx, ly] = pol(mx, my, ta + s * 48, ll);
				d += `M${P(mx, my)}L${P(lx, ly)}`;
			}
		}
		ink.line(1 + (i % 3), cols[i % 3]!, lw, d);
	}
	return at(ink);
}

/* ---------------------------------------------------------------- 16 tatsoi */
const TAT = { a: "#24532c", b: "#3a7a3e", hi: "#5f9a58", stalk: "#b9d79a" };
/** A flat rosette seen from slightly above: three rings of spoon leaves, squashed vertically. */
function tatsoi(st: St): string {
	const ink = new Ink();
	const k = by(st, 0.4, 0.74, 1);
	const rings: [number, number, number, number][] = [
		// [count, offset deg, stalk length, blade length]
		[10, 0, 13, 18],
		[8, 22, 8, 15],
		[6, 5, 3, 11],
	];
	const spoon: WL = { p: (t) => Math.sin(Math.PI * t ** 1.4) ** 0.6, n: 6 };
	rings.forEach(([n, off, sl, bl], r) => {
		if (st === "sprout" && r === 0) return;
		for (let i = 0; i < n; i++) {
			const a = off + (i * 360) / n;
			ink.seg(r * 3, TAT.stalk, 2, 0, 0, a, sl + 1);
			const [x, y] = pol(0, 0, a, sl);
			ink.fill(r * 3 + 1, i % 2 ? TAT.a : TAT.b, wleaf(x, y, a, bl, bl * 0.5, spoon));
			ink.line(r * 3 + 2, TAT.hi, 1.2, rib(x, y, a, 1, bl * 0.7));
		}
	});
	ink.dots(9, TAT.stalk, 2, [[0, 0]]);
	return `<g transform="translate(40 ${f(87 - 12 * k)}) scale(${f(k)} ${f(k * 0.4)})">${ink}</g>`;
}

/* ----------------------------------------------------------------- 17 sorrel */
const SOR = { leaf: "#6aa64e", leaf2: "#5a9442", vein: "#a8323a", seed: "#a4442c", seed2: "#c4683e", stem: "#8a4a3a" };
/** Arrow-shaped (hastate) leaf with backward basal lobes. */
function arrow(x: number, y: number, ang: number, len: number, w: number): string {
	const c = Math.cos(ang * D);
	const s = Math.sin(ang * D);
	const pt = (u: number, v: number) => P(x + (u * c - v * s) * len, y + (u * s + v * c) * len);
	const k = w / len;
	return `M${pt(0.04, 0)}L${pt(-0.12, -k * 0.9)}Q${pt(0.25, -k * 1.15)} ${pt(0.5, -k * 0.8)}Q${pt(0.8, -k * 0.35)} ${pt(1, 0)}Q${pt(0.8, k * 0.35)} ${pt(0.5, k * 0.8)}Q${pt(0.25, k * 1.15)} ${pt(-0.12, k * 0.9)}Z`;
}
function sorrel(st: St): string {
	const ink = new Ink();
	const L = by<N4[]>(
		st,
		[[-125, 4, 9, 3], [-60, 4, 9, 3]],
		[[-150, 7, 18, 5], [-30, 7, 18, 5], [-118, 10, 22, 5.5], [-62, 10, 22, 5.5], [-92, 13, 22, 5.5]],
		[[-155, 8, 20, 5.5], [-25, 8, 20, 5.5], [-128, 12, 24, 6], [-52, 12, 24, 6], [-105, 15, 26, 6.5], [-78, 15, 26, 6.5]],
	);
	L.forEach(([a, pl, len, w], i) => {
		ink.seg(1, SOR.vein, 1, 0, -1, a, pl + 1);
		const [x, y] = pol(0, -1, a, pl);
		ink.fill(2 + (i % 2), i % 2 ? SOR.leaf2 : SOR.leaf, arrow(x, y, a, len, w));
		ink.line(4, SOR.vein, 0.8, rib(x, y, a, 0, len * 0.85));
	});
	if (st === "bloom") {
		const spikes: [number, number, number, number][] = [
			[-1, -8, -10, -76],
			[1, -8, 4, -80],
			[2, -8, 15, -70],
		];
		const seeds: [number, number][] = [];
		const seeds2: [number, number][] = [];
		let br = "";
		for (const [x0, y0, x1, y1] of spikes) {
			br += `M${P(x0, y0)}L${P(x1, y1)}`;
			for (let t = 0.45; t <= 1.001; t += 0.07) {
				const x = x0 + (x1 - x0) * t;
				const y = y0 + (y1 - y0) * t;
				const sp = 3.6 * (1.15 - t);
				br += `M${P(x, y)}l${f(-sp)} -2.4M${P(x, y)}l${f(sp)} -2.4`;
				seeds.push([x - sp, y - 2.4], [x + sp, y - 2.4]);
				seeds2.push([x, y - 1]);
			}
		}
		ink.line(0, SOR.stem, 0.9, br);
		ink.dots(5, SOR.seed, 1.1, seeds);
		ink.dots(5.5, SOR.seed2, 0.9, seeds2);
	}
	return at(ink);
}

/* --------------------------------------------------------------- 18 purslane */
const PUR = { stem: "#b04a3a", leaf: "#7cb04e", leaf2: "#93c262", flower: "#f0c838", eye: "#d79a20" };
function purslane(st: St): string {
	const ink = new Ink();
	const arms = by<N3[]>(
		st,
		[[-150, 8, 0], [-30, 8, 0], [-90, 9, 0]],
		[[-168, 22, 6], [-12, 22, 6], [-130, 18, 4], [-50, 18, 4], [-95, 16, 0]],
		[[-172, 32, 8], [-8, 32, 8], [-150, 28, 12], [-30, 28, 12], [-118, 24, 6], [-62, 24, 6], [-92, 22, 0]],
	);
	const lw = by(st, 4, 5, 5.6);
	arms.forEach(([a, len, sag], i) => {
		const tip = pol(0, -2, a, len);
		const mid = pol(0, -2, a, len * 0.55);
		const c1: [number, number] = [mid[0], mid[1] - sag * 0.6];
		ink.line(0, PUR.stem, by(st, 1, 1.4, 1.6), `M0 -2Q${P(c1[0], c1[1])} ${P(tip[0], tip[1] + sag * 0.3)}`);
		const tx = tip[0];
		const ty = tip[1] + sag * 0.3;
		let d = "";
		for (const t of [0.4, 0.7]) {
			const x = (1 - t) * (1 - t) * 0 + 2 * (1 - t) * t * c1[0] + t * t * tx;
			const y = (1 - t) * (1 - t) * -2 + 2 * (1 - t) * t * c1[1] + t * t * ty;
			d += kleaf(x, y, a - 55, lw, lw * 0.3, 2) + kleaf(x, y, a + 55, lw, lw * 0.3, 2);
		}
		for (const o of [-60, -20, 20, 60]) d += kleaf(tx, ty, a + o, lw * 1.05, lw * 0.32, 2);
		ink.fill(1 + (i % 2), i % 2 ? PUR.leaf2 : PUR.leaf, d);
		if (st === "bloom" && i < 6 && i % 2 === (i < 2 ? 0 : 1)) {
			const [fx, fy] = pol(tx, ty, a, 2);
			ink.dots(3, PUR.flower, 1.25, [0, 72, 144, 216, 288].map((o) => pol(fx, fy, o, 1.6)));
			ink.dots(4, PUR.eye, 0.7, [[fx, fy]]);
		}
	});
	return at(ink);
}

/* ----------------------------------------------------------------- 19 celery */
const CEL = { stalk: "#b6d885", stalk2: "#cfe6a6", ribc: "#8db864", leaf: "#5ea34a", leaf2: "#4f9440" };
function celery(st: St): string {
	const ink = new Ink();
	const h = by(st, 9, 26, 42);
	const cnt = by(st, 3, 5, 7);
	const sw = by(st, 1.6, 3, 3.8);
	const lob: WL = { p: (t) => Math.sin(Math.PI * t ** 0.8), n: 4, depth: 0.5 };
	const ll = by(st, 4.5, 7, 9);
	for (let i = 0; i < cnt; i++) {
		const u = i / (cnt - 1) - 0.5;
		const x0 = u * by(st, 2, 5, 8);
		const a = -90 + u * by(st, 50, 34, 30);
		const hh = h * (1 - Math.abs(u) * 0.35);
		const [tx, ty] = pol(x0, 0, a, hh);
		const c = Math.abs(u) < 0.2 ? CEL.stalk2 : CEL.stalk;
		ink.line(i % 2 ? 1 : 0, c, sw, `M${P(x0, 0)}L${P(tx, ty)}`);
		if (st !== "sprout") ink.line(1.5, CEL.ribc, 0.6, `M${P(x0 + 0.6, -1)}L${P(tx + 0.6, ty + 2)}`);
		let d = "";
		let br = "";
		for (const o of [-38, 0, 38]) {
			const [bx, by2] = pol(tx, ty, a + o, ll * 0.7);
			br += `M${P(tx, ty)}L${P(bx, by2)}`;
			d += wleaf(bx, by2, a + o * 1.2, ll, ll * 0.45, lob);
			if (st === "bloom" && o === 0 && i % 2) d += wleaf(tx, ty, a - 70, ll * 0.8, ll * 0.36, lob) + wleaf(tx, ty, a + 70, ll * 0.8, ll * 0.36, lob);
		}
		ink.line(2, CEL.stalk, 1, br);
		ink.fill(3 + (i % 2), i % 2 ? CEL.leaf2 : CEL.leaf, d);
	}
	return at(ink);
}

/* -------------------------------------------------------- 20 florence fennel */
const FEN = { bulb: "#eef0d8", layer: "#cfd9a8", stalk: "#a9cf86", frond: "#6f9f86", umbel: "#e3c53a", ray: "#8fae6a" };
function fennel(st: St): string {
	const ink = new Ink();
	const br = by(st, 2.5, 7, 11);
	const sh = by(st, 10, 28, 42);
	const cnt = by(st, 2, 4, 5);
	let fronds = "";
	let stalks = "";
	for (let i = 0; i < cnt; i++) {
		const u = i / (cnt - 1) - 0.5;
		const a = -90 + u * 40;
		const x0 = u * br;
		const [tx, ty] = pol(x0, -br, a, sh * (1 - Math.abs(u) * 0.3));
		stalks += `M${P(x0, -br)}L${P(tx, ty)}`;
		const fl = by(st, 7, 14, 18);
		for (const o of [-66, -33, 0, 33, 66]) {
			const fa = a + o;
			const [ex, ey] = pol(tx, ty, fa, fl);
			fronds += `M${P(tx, ty)}L${P(ex, ey)}`;
			for (const t of [0.4, 0.75]) {
				const [mx, my] = pol(tx, ty, fa, fl * t);
				const sl = fl * 0.32 * (1.1 - t);
				fronds += `M${P(...pol(mx, my, fa - 40, sl))}L${P(mx, my)}L${P(...pol(mx, my, fa + 40, sl))}`;
			}
		}
	}
	ink.line(1, FEN.stalk, by(st, 1.2, 2, 2.6), stalks);
	ink.line(2, FEN.frond, 0.7, fronds);
	if (st === "bloom") {
		ink.line(0.5, FEN.stalk, 1.4, `M-2 -12Q-6 -50 -16 -70M2 -12Q6 -48 14 -64`);
		for (const [x, y] of [[-16, -71], [14, -65]] as const) {
			let r = "";
			const pts: [number, number][] = [];
			for (let i = 0; i < 7; i++) {
				const [px, py] = pol(x, y + 4, -160 + i * 23.3, 8);
				r += `M${P(x, y + 4)}L${P(px, py)}`;
				pts.push([px, py], [px + 1.4, py - 0.6], [px - 1.4, py - 0.6]);
			}
			ink.line(3, FEN.ray, 0.6, r);
			ink.dots(4, FEN.umbel, 1, pts);
		}
	}
	ink.fill(5, FEN.bulb, `M${f(-br * 0.5)} 0C${P(-br * 1.4, -br * 0.3)} ${P(-br * 0.9, -br * 1.3)} 0 ${f(-br * 1.6)}C${P(br * 0.9, -br * 1.3)} ${P(br * 1.4, -br * 0.3)} ${f(br * 0.5)} 0Z`);
	if (st !== "sprout") ink.line(6, FEN.layer, 0.8, `M${f(-br * 0.2)} -1Q${P(-br * 0.9, -br * 0.5)} ${P(-br * 0.2, -br * 1.5)}M${f(br * 0.2)} -1Q${P(br * 0.9, -br * 0.5)} ${P(br * 0.2, -br * 1.5)}`);
	return at(ink);
}

/* ------------------------------------------------------------------ 21 leek */
const LEEK = { white: "#eef0dc", pale: "#cfe0a8", a: "#5d8f7c", b: "#6fa08a", fold: "#4a7666", stalk: "#8fae86", flower: "#a98ad0", flower2: "#8e6fbf" };
function leek(st: St): string {
	const ink = new Ink();
	const k = by(st, 0.36, 0.7, 1);
	const shaftTop = -30;
	ink.fill(1, LEEK.white, `M-5 0L-4.4 ${shaftTop}L4.4 ${shaftTop}L5 0Z`);
	ink.fill(2, LEEK.pale, `M-4.5 -20L-4.3 ${shaftTop}L4.3 ${shaftTop}L4.5 -20Z`);
	ink.line(2.5, "#d9dfc2", 0.6, `M-1.5 -2L-1.5 -19M1.8 -2L1.8 -19`);
	const L: [number, number, number, number][] = [
		// [side, emerge y, reach x, tip y]
		[-1, -32, -26, -44],
		[1, -35, 28, -52],
		[-1, -38, -30, -66],
		[1, -41, 22, -74],
		[-1, -44, -12, -78],
	];
	L.forEach(([s, y0, x1, y1], i) => {
		const d = `M${P(s * 1.5, y0)}C${P(s * 2, y0 - 16)} ${P(x1 * 0.6, y1 - 6)} ${P(x1, y1 + 10)}`;
		ink.line(3 + i, i % 2 ? LEEK.b : LEEK.a, 5.6, d);
		ink.line(3.5 + i, LEEK.fold, 0.7, d);
	});
	ink.fill(8, LEEK.pale, `M-4.3 ${shaftTop}L-3 -48L3 -48L4.3 ${shaftTop}Z`);
	if (st === "bloom") {
		ink.line(9, LEEK.stalk, 1.8, `M0 -40L0 -72`);
		const pts: [number, number][] = [];
		const pts2: [number, number][] = [];
		for (let r = 1; r <= 3; r++)
			for (let i = 0; i < r * 6; i++) {
				const p = pol(0, -80, (i * 360) / (r * 6) + r * 13, r * 2.6);
				(i % 2 ? pts : pts2).push(p);
			}
		pts.push([0, -80]);
		ink.dots(10, LEEK.flower2, 1.6, pts2);
		ink.dots(11, LEEK.flower, 1.4, pts);
		return `<g transform="translate(40 87) scale(.93)">${ink}</g>`;
	}
	return atK(ink, k);
}

/* --------------------------------------------------------------- 22 rhubarb */
const RHU = { stalk: "#c23a4a", stalk2: "#a92f40", a: "#5d9a3e", b: "#4f8a35", vein: "#cbe0b2", plume: "#efe3c4", plume2: "#dccfa8" };
function rhubarb(st: St): string {
	const ink = new Ink();
	const L = by<N4[]>(
		st,
		[[-130, 5, 9, 4.5], [-50, 5, 9, 4.5]],
		[[-155, 10, 18, 9], [-25, 10, 18, 9], [-115, 14, 20, 10], [-65, 14, 20, 10]],
		[[-160, 14, 22, 11], [-20, 14, 22, 11], [-128, 18, 25, 12.5], [-52, 18, 25, 12.5], [-92, 20, 24, 12]],
	);
	const crinkle: WL = { p: (t) => Math.sin(Math.PI * t) ** 0.45, n: 8, amp: 1.1 };
	L.forEach(([a, pl, len, w], i) => {
		const up = a + (-90 - a) * 0.25;
		ink.line(i, i % 2 ? RHU.stalk2 : RHU.stalk, by(st, 1.4, 2.4, 3.2), `M0 0Q${P(...pol(0, 0, a, pl * 0.6))} ${P(...pol(0, 0, up, pl))}`);
		const [x, y] = pol(0, 0, up, pl - 1);
		ink.fill(i + 0.3, i % 2 ? RHU.b : RHU.a, wleaf(x, y, up, len, w, crinkle));
		let v = rib(x, y, up, 0, len * 0.85);
		if (st !== "sprout") for (const o of [-45, 45]) v += rib(x, y, up + o, 1, len * 0.55);
		ink.line(i + 0.6, RHU.vein, 0.7, v);
	});
	if (st === "bloom") {
		ink.line(4.8, RHU.stalk2, 2.2, `M0 -2L0 -60`);
		const pts: [number, number][] = [];
		let br = "";
		for (let y = -40; y >= -78; y -= 5) {
			const sp = 10 * ((y + 82) / 42);
			br += `M0 ${y}l${f(-sp)} -5M0 ${y}l${f(sp)} -5`;
			for (const s of [-1, 1]) for (const t of [0.4, 0.95]) pts.push([s * sp * t, y - 5 * t - 1]);
		}
		ink.line(5, "#c9b98e", 0.8, br + `M0 -60L0 -80`);
		ink.dots(6, RHU.plume2, 1.7, pts);
		ink.dots(7, RHU.plume, 1.2, pts.map(([x, y]) => [x - 0.4, y - 0.5] as const).concat([[0, -80], [0, -75]]));
	}
	return at(ink);
}

/* -------------------------------------------------------- 23 globe artichoke */
const ART = { leaf: "#9fb7a5", leaf2: "#88a392", stem: "#8aa594", bud: "#7d9c68", scale: "#93b27c", tip: "#7a4f78", tuft: "#8a5ac8", tuft2: "#a77ae0" };
function artichokeHead(ink: Ink, x: number, y: number, r: number, open: boolean): void {
	ink.fill(10, ART.bud, ellD(x, y, r, r * 1.05));
	let sc = "";
	let tips = "";
	const w = r * 0.36;
	for (let row = 0; row < 3; row++) {
		const yy = y + r * 0.5 - row * r * 0.55;
		const n = row === 2 ? 2 : 3;
		const span = n === 2 ? r * 0.3 : r * (0.5 - row * 0.08);
		for (let i = 0; i < n; i++) {
			const xx = x - span + (2 * span * i) / (n - 1);
			sc += `M${P(xx - w, yy + w * 0.5)}Q${P(xx, yy + w * 0.9)} ${P(xx + w, yy + w * 0.5)}L${P(xx, yy - w)}Z`;
			tips += `M${P(xx, yy - w - 0.4)}l-.9 1.5h1.8Z`;
		}
	}
	ink.fill(11, ART.scale, sc);
	ink.fill(12, ART.tip, tips);
	if (open) {
		let d = "";
		for (let i = 0; i < 9; i++) {
			const a = -170 + i * 20;
			d += `M${P(...pol(x, y - r * 0.8, a, 1))}L${P(...pol(x, y - r * 0.8, a, 8 - Math.abs(i - 4) * 0.6))}`;
		}
		ink.line(13, ART.tuft, 1.5, d);
		ink.dots(14, ART.tuft2, 0.9, [[x - 3, y - r - 4], [x + 3, y - r - 4], [x, y - r - 6]]);
	}
}
function artichoke(st: St): string {
	const ink = new Ink();
	const lob: WL = { p: LANCE, n: 12, depth: 0.55 };
	const L = by<N3[]>(
		st,
		[[-130, 11, 2.8], [-50, 11, 2.8], [-95, 12, 3]],
		[[-165, 24, 6], [-15, 24, 6], [-135, 30, 7], [-45, 30, 7], [-108, 32, 7], [-72, 32, 7]],
		[[-168, 28, 7], [-12, 28, 7], [-142, 32, 7.5], [-38, 32, 7.5], [-115, 30, 7], [-65, 30, 7]],
	);
	L.forEach(([a, len, w], i) => {
		const bend = a < -90 ? -1 : 1;
		const mid = pol(0, -1, a, len * 0.5);
		ink.fill(1 + (i % 2), i % 2 ? ART.leaf2 : ART.leaf, wleaf(0, -1, a + bend * 4, len, w, lob));
		ink.line(3, "#e1ebe3", 0.7, `M0 -1L${P(mid[0], mid[1])}`);
	});
	if (st === "bloom") {
		ink.line(4, ART.stem, 3, `M0 -2L0 -54M0 -34Q8 -38 13 -46`);
		ink.fill(4, ART.leaf2, wleaf(0, -24, -150, 12, 3.5, lob) + wleaf(0, -18, -30, 12, 3.5, lob));
		artichokeHead(ink, 13, -50, 4.5, false);
		artichokeHead(ink, 0, -62, 8.5, true);
	}
	return at(ink);
}

/* ------------------------------------------------------------- 24 asparagus */
const ASP = { spear: "#8db75a", tip: "#7a5a8a", stem: "#6f9a4a", fern: "#8cc06a", fern2: "#6faa52", berry: "#d0302f" };
function spear(ink: Ink, x: number, h: number, lean: number): void {
	const tx = x + lean;
	ink.line(1, ASP.spear, 3.2, `M${P(x, 0)}L${P(tx, -h)}`);
	ink.fill(2, ASP.tip, `M${P(tx - 1.8, -h + 1)}Q${P(tx - 1.6, -h - 3.6)} ${P(tx, -h - 4.4)}Q${P(tx + 1.6, -h - 3.6)} ${P(tx + 1.8, -h + 1)}Z`);
	let d = "";
	for (let y = 4; y < h - 2; y += 4.5) {
		const xx = x + (lean * y) / h;
		d += `M${P(xx - 0.6, -y)}l1.6 -1.6`;
	}
	ink.line(2, ASP.tip, 0.7, d);
}
function asparagus(st: St): string {
	const ink = new Ink();
	if (st === "sprout") {
		spear(ink, -2, 12, -0.5);
		spear(ink, 3, 17, 0.5);
		return at(ink);
	}
	if (st === "leafy") {
		spear(ink, -8, 18, -1);
		spear(ink, 7, 24, 1);
		spear(ink, -2, 30, 0);
	}
	const stems: [number, number, number][] = st === "leafy" ? [[3, 46, 4]] : [[-3, 80, -4], [3, 72, 8], [-1, 62, -16], [2, 56, 20]];
	let st1 = "";
	let fern = "";
	let fern2 = "";
	const berries: [number, number][] = [];
	stems.forEach(([x0, h, lean], si) => {
		st1 += `M${P(x0, 0)}Q${P(x0, -h * 0.5)} ${P(x0 + lean, -h)}`;
		for (let y = h * 0.35; y < h; y += 6) {
			const t = y / h;
			const x = x0 + lean * t * t;
			const side = Math.round(y / 6) % 2 ? 1 : -1;
			const bl = 9 * (1.1 - t) + 2;
			const ang = -90 + side * 55;
			const [ex, ey] = pol(x, -y, ang, bl);
			st1 += `M${P(x, -y)}L${P(ex, ey)}`;
			for (const j of [0.35, 0.7, 1]) {
				const [mx, my] = pol(x, -y, ang, bl * j);
				for (const o of [-40, 40]) {
					const [nx, ny] = pol(mx, my, ang + o, 3);
					const seg = `M${P(mx, my)}L${P(nx, ny)}`;
					if (o > 0) fern += seg;
					else fern2 += seg;
				}
			}
			if (st === "bloom" && si < 3 && Math.round(y / 6) % 3 === 1) berries.push(pol(x, -y, ang, bl * 0.6));
		}
	});
	ink.line(3, ASP.stem, 1.1, st1);
	ink.line(4, ASP.fern2, 0.8, fern2);
	ink.line(5, ASP.fern, 0.8, fern);
	if (berries.length) ink.dots(6, ASP.berry, 1.3, berries);
	if (st === "bloom") {
		spear(ink, -9, 13, -1);
		spear(ink, 9, 9, 1);
	}
	return at(ink);
}

/* ------------------------------------------------------- 25 malabar spinach */
const MAL = { stake: "#b0905a", vine: "#a4304a", a: "#2f7a3a", b: "#3b8a44", vein: "#7dbb7a", spike: "#d77a9a", berry: "#3e1f4e" };
function malabar(st: St): string {
	const ink = new Ink();
	if (st === "sprout") {
		ink.line(0, MAL.vine, 1.4, `M0 0Q-1 -8 0 -14`);
		ink.fill(1, MAL.b, kleaf(0, -14, -150, 8, 4, 4) + kleaf(0, -14, -30, 8, 4, 4));
		ink.fill(2, MAL.a, kleaf(0, -14, -90, 6, 3, 4));
		return at(ink);
	}
	const top = st === "leafy" ? 46 : 80;
	ink.line(0, MAL.stake, 1.8, `M3 1L3 ${-top - 1}`);
	let v = "M0 0";
	const nodes: [number, number, number][] = [];
	for (let y = 0, i = 0; y < top - 2; y += 2, i++) {
		const x = 3 + 4.5 * Math.sin(y * 0.22);
		v += `L${P(x, -y)}`;
		if (i % 5 === 3) nodes.push([x, -y, Math.cos(y * 0.22) > 0 ? 1 : -1]);
	}
	ink.line(1, MAL.vine, 1.5, v);
	let la = "";
	let lb = "";
	let veins = "";
	const L = st === "leafy" ? 12 : 13;
	nodes.forEach(([x, y, s], i) => {
		const side = x > 3 ? 1 : -1;
		const a = side > 0 ? -25 : -155;
		const sz = L * (1 - (Math.abs(y) / top) * 0.35);
		const [bx, by2] = pol(x, y, a, 2.5);
		ink.line(1.5, MAL.vine, 1, `M${P(x, y)}L${P(bx, by2)}`);
		const d = kleaf(bx, by2, a + side * 10, sz, sz * 0.45, 4);
		if (s > 0) la += d;
		else lb += d;
		veins += rib(bx, by2, a + side * 10, 1, sz * 0.75);
		if (st === "bloom" && i % 2 === 0 && i > 0 && i < nodes.length - 1) {
			const sa = side > 0 ? -150 : -30;
			const [ex, ey] = pol(x, y, sa, 8);
			ink.line(4, MAL.spike, 1.6, `M${P(x, y)}L${P(ex, ey)}`);
			ink.dots(5, MAL.berry, 1.6, [pol(x, y, sa, 3.4), pol(x, y, sa, 6), pol(x, y, sa, 8.4)].map(([px, py], j) => [px + (j % 2 ? 1 : -1), py] as const));
		}
	});
	ink.fill(2, MAL.a, la);
	ink.fill(2.5, MAL.b, lb);
	ink.line(3, MAL.vein, 0.6, veins);
	return at(ink);
}

export const SPECIES: Species[] = [
	{ id: "spinach", name: "Spinach", draw: spinach },
	{ id: "swiss-chard", name: "Swiss chard", draw: chard },
	{ id: "arugula", name: "Arugula", draw: arugula },
	{ id: "bok-choy", name: "Bok choy", draw: bokChoy },
	{ id: "napa-cabbage", name: "Napa cabbage", draw: napa },
	{ id: "brussels-sprouts", name: "Brussels sprouts", draw: brussels },
	{ id: "cauliflower", name: "Cauliflower", draw: cauliflower },
	{ id: "kohlrabi", name: "Kohlrabi", draw: kohlrabi },
	{ id: "collard-greens", name: "Collard greens", draw: collard },
	{ id: "romanesco", name: "Romanesco", draw: romanesco },
	{ id: "mustard-greens", name: "Mustard greens", draw: mustard },
	{ id: "watercress", name: "Watercress", draw: watercress },
	{ id: "endive", name: "Endive", draw: endive },
	{ id: "radicchio", name: "Radicchio", draw: radicchio },
	{ id: "mizuna", name: "Mizuna", draw: mizuna },
	{ id: "tatsoi", name: "Tatsoi", draw: tatsoi },
	{ id: "sorrel", name: "Sorrel", draw: sorrel },
	{ id: "purslane", name: "Purslane", draw: purslane },
	{ id: "celery", name: "Celery", draw: celery },
	{ id: "florence-fennel", name: "Florence fennel", draw: fennel },
	{ id: "leek", name: "Leek", draw: leek },
	{ id: "rhubarb", name: "Rhubarb", draw: rhubarb },
	{ id: "globe-artichoke", name: "Globe artichoke", draw: artichoke },
	{ id: "asparagus", name: "Asparagus", draw: asparagus },
	{ id: "malabar-spinach", name: "Malabar spinach", draw: malabar },
];
