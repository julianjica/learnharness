/**
 * Garden species, family: European meadow wildflowers. Each draws sprout,
 * leafy and bloom in the kit's flat style (see kit.ts); the kit draws soil
 * and seed. Shapes of one colour are merged into one <path> (see Ink) and
 * dots are zero-length round-capped strokes, to keep the markup small.
 */
import { bez, f, GREEN, type GrowingStage, type Pt, type Species } from "./kit";

/* ---------- private helpers ---------- */

const RAD = Math.PI / 180;
type P4 = readonly [Pt, Pt, Pt, Pt];
type XY = readonly [number, number];

/** Maps local coordinates (u along, v across) at (x, y) rotated by deg to "x y". */
function tf(x: number, y: number, deg: number): (u: number, v: number) => string {
	const c = Math.cos(deg * RAD);
	const s = Math.sin(deg * RAD);
	return (u, v) => `${f(x + c * u - s * v)} ${f(y + s * u + c * v)}`;
}

/** The point r from (x, y) at deg. */
function at(x: number, y: number, deg: number, r: number): [number, number] {
	return [x + Math.cos(deg * RAD) * r, y + Math.sin(deg * RAD) * r];
}

/** Deterministic noise in [0, 1). */
function rnd(i: number): number {
	const v = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
	return v - Math.floor(v);
}

/** Merges shapes per paint into one <path> each, in first-seen order. Tags split layers of one paint. */
class Ink {
	private ks: string[] = [];
	private ds: string[] = [];
	private put(key: string, d: string): this {
		const i = this.ks.indexOf(key);
		if (i < 0) {
			this.ks.push(key);
			this.ds.push(d);
		} else this.ds[i] += d;
		return this;
	}
	/** Filled shape. */
	f(fill: string, d: string, tag = ""): this {
		return this.put(`f|${fill}|${tag}`, d);
	}
	/** Stroked line(s), round caps. */
	s(stroke: string, w: number, d: string, tag = ""): this {
		return this.put(`s|${stroke}|${w}|${tag}`, d);
	}
	/** Dots of radius r at the points (zero-length round-capped strokes). */
	dots(fill: string, r: number, pts: readonly XY[], tag = ""): this {
		return this.s(fill, r * 2, pts.map(([x, y]) => `M${f(x)} ${f(y)}h0`).join(""), tag);
	}
	raw(svg: string): this {
		this.ks.push(`r|${this.ks.length}`);
		this.ds.push(svg);
		return this;
	}
	toString(): string {
		return this.ks
			.map((k, i) => {
				const d = this.ds[i] ?? "";
				const [t, paint, w] = k.split("|");
				if (t === "r") return d;
				if (t === "f") return `<path d="${d}" fill="${paint}"/>`;
				return `<path d="${d}" fill="none" stroke="${paint}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
			})
			.join("");
	}
}

/** Leaf outline (kit shapes 0 oval, 1 pointed, 2 round, 4 heart) from (x, y) heading deg. */
function leafD(x: number, y: number, deg: number, len: number, w: number, shape: 0 | 1 | 2 | 4 = 0): string {
	const q = tf(x, y, deg);
	const [a, b, c, d] = shape === 1 ? [0.45, 1.15, 0.8, 0.5] : shape === 2 ? [0.05, 1.4, 1.02, 1.3] : shape === 4 ? [0.1, 1.6, 0.75, 1.2] : [0.3, 1, 0.8, 1];
	return `M${q(0, 0)}C${q(len * a, -w * b)} ${q(len * c, -w * d)} ${q(len, 0)}C${q(len * c, w * d)} ${q(len * a, w * b)} ${q(0, 0)}Z`;
}

/** A midrib line for a leaf. */
function ribD(x: number, y: number, deg: number, len: number): string {
	const q = tf(x, y, deg);
	return `M${q(len * 0.08, 0)}L${q(len * 0.8, 0)}`;
}

/** Pointed lens from (x, y) heading deg, len long, about 2w wide. */
function lensD(x: number, y: number, deg: number, len: number, w: number): string {
	const q = tf(x, y, deg);
	const k = w * 1.25;
	return `M${q(0, 0)}Q${q(len * 0.45, -k)} ${q(len, 0)}Q${q(len * 0.45, k)} ${q(0, 0)}Z`;
}

/** A rotated ellipse as a subpath. */
function ovalD(cx: number, cy: number, rx: number, ry: number, rot = 0): string {
	const [x1, y1] = at(cx, cy, rot, rx);
	const [x2, y2] = at(cx, cy, rot, -rx);
	const a = `A${f(rx)} ${f(ry)} ${f(rot)} 1 0`;
	return `M${f(x1)} ${f(y1)}${a} ${f(x2)} ${f(y2)}${a} ${f(x1)} ${f(y1)}Z`;
}

/** A circle as a subpath. */
function dotD(x: number, y: number, r: number): string {
	return `M${f(x - r)} ${f(y)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0`;
}

/** A toothed or lobed leaf: n teeth per side, depth 0..1, lean > 0 points teeth forward, < 0 back. */
function toothD(x: number, y: number, deg: number, len: number, w: number, n: number, depth: number, lean = 0.3): string {
	const q = tf(x, y, deg);
	const m = 2 * n;
	const top: string[] = [];
	const bot: string[] = [];
	for (let i = 1; i < m; i++) {
		const t = i / m;
		const tip = i % 2 === 1;
		const hw = w * Math.pow(Math.sin(Math.PI * Math.min(t * 1.1, 0.98)), 0.8) * (tip ? 1 : 1 - depth);
		const u = (t + (tip ? lean / m : 0)) * len;
		top.push(q(u, -hw));
		bot.unshift(q(u, hw));
	}
	return `M${q(0, 0)}L${top.join("L")}L${q(len, 0)}L${bot.join("L")}Z`;
}

/** A cubic stem subpath. */
function cub(p: P4): string {
	const [a, b, c, d] = p;
	return `M${f(a[0])} ${f(a[1])}C${f(b[0])} ${f(b[1])} ${f(c[0])} ${f(c[1])} ${f(d[0])} ${f(d[1])}`;
}

/** A straight segment subpath. */
function seg(x1: number, y1: number, x2: number, y2: number): string {
	return `M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}`;
}

/** Radial segments from r0 to r1 around (x, y): stroked, they make a ring of strap petals. */
function rays(x: number, y: number, n: number, r0: number, r1: number, off = 0): string {
	let d = "";
	for (let i = 0; i < n; i++) {
		const a = off + (i * 360) / n;
		const [ax, ay] = at(x, y, a, r0);
		const [bx, by] = at(x, y, a, r1);
		d += seg(ax, ay, bx, by);
	}
	return d;
}

/** n oval petals centred r from (x, y). */
function ovals(x: number, y: number, n: number, r: number, rx: number, ry: number, off = -90): string {
	let d = "";
	for (let i = 0; i < n; i++) {
		const a = off + (i * 360) / n;
		const [cx, cy] = at(x, y, a, r);
		d += ovalD(cx, cy, rx, ry, a);
	}
	return d;
}

/** Points on a cubic at the given t values. */
function along(p: P4, ts: readonly number[]): [number, number][] {
	return ts.map((t) => bez(p, t));
}

/** A rosette of leaves from the root. */
function rosette(k: Ink, fill: string, angles: readonly number[], len: number, w: number, shape: 0 | 1 | 2 | 4 = 0, rib = "", y = 86): void {
	for (const a of angles) {
		const l = len * (1 - Math.abs(a + 90) / 260);
		k.f(fill, leafD(40, y, a, l, w, shape));
		if (rib) k.s(rib, 0.7, ribD(40, y, a, l));
	}
}

/** A wrinkled leaf (primula): oval with a midrib and side veins. */
function wrinkled(k: Ink, x: number, y: number, deg: number, len: number, w: number, fill: string, vein: string): void {
	const q = tf(x, y, deg);
	k.f(fill, leafD(x, y, deg, len, w, 0));
	let d = `M${q(len * 0.05, 0)}L${q(len * 0.88, 0)}`;
	for (const t of [0.28, 0.5, 0.72]) d += `M${q(len * (t + 0.08), -w * 0.62)}L${q(len * t, 0)}L${q(len * (t + 0.08), w * 0.62)}`;
	k.s(vein, 0.6, d);
}

/** A three-leaflet clover leaf with a pale chevron on each leaflet. */
function trefoil(k: Ink, x: number, y: number, deg: number, len: number, fill: string, mark: string, shape: 0 | 2 = 0): void {
	for (const a of [-60, 0, 60]) {
		const q = tf(x, y, deg + a);
		k.f(fill, leafD(x, y, deg + a, len, len * (shape === 2 ? 0.36 : 0.4), shape));
		k.s(mark, Math.round(len * 0.8) / 10, `M${q(len * 0.38, -len * 0.22)}L${q(len * 0.6, 0)}L${q(len * 0.38, len * 0.22)}`, "mark");
	}
}

/** A pinnate leaf: rib from (x, y) heading deg with n leaflet pairs (and an end leaflet). */
function pinnate(k: Ink, x: number, y: number, deg: number, len: number, n: number, ll: number, lw: number, fill: string, rib: string, end = true, shape: 0 | 1 = 1): void {
	const q = tf(x, y, deg);
	k.s(rib, 0.8, `M${q(0, 0)}L${q(len, 0)}`, "rib");
	for (let i = 0; i < n; i++) {
		const u = len * (0.25 + (0.7 * i) / Math.max(1, n - 1));
		const [px, py] = at(x, y, deg, u);
		const l = ll * (1 - (0.3 * i) / n);
		k.f(fill, shape === 1 ? lensD(px, py, deg - 55, l, lw) + lensD(px, py, deg + 55, l, lw) : leafD(px, py, deg - 55, l, lw, 0) + leafD(px, py, deg + 55, l, lw, 0));
	}
	if (end) {
		const [ex, ey] = at(x, y, deg, len);
		k.f(fill, leafD(ex, ey, deg, ll * 0.9, lw, shape));
	}
}

/** A feathery leaf (yarrow, carrot): rib plus a comb of short strokes. */
function feather(k: Ink, x: number, y: number, deg: number, len: number, comb: number, color: string): void {
	const q = tf(x, y, deg);
	let d = `M${q(0, 0)}L${q(len, 0)}`;
	const n = Math.round(len / 1.5);
	for (let i = 1; i < n; i++) {
		const u = (len * i) / n;
		const c = comb * (1 - (0.6 * i) / n);
		d += `M${q(u - c * 0.5, -c)}L${q(u, 0)}L${q(u - c * 0.5, c)}`;
	}
	k.s(color, 0.8, d, "feather");
}

/** A whorl of needle leaves (bedstraw). */
function whorl(k: Ink, x: number, y: number, n: number, len: number, fill: string, off = 0): void {
	let d = "";
	for (let i = 0; i < n; i++) {
		const [ex, ey] = at(x, y, off + (i * 360) / n, len);
		d += seg(x, y, ex, ey);
	}
	k.s(fill, 0.8, d, "whorl");
}

/* ---------- 1. Oxeye daisy ---------- */
const OX = { petal: "#f8f6ef", shade: "#c9c3b2", eye: "#efb21b", eyeD: "#c98d10", leaf: "#5c9a4a", bud: "#7fae5c" };
function oxeye(stage: GrowingStage): string {
	const k = new Ink();
	const ros = (s: number) => {
		for (const a of [-168, -132, -96, -60, -18]) k.f(OX.leaf, toothD(40, 86, a, (a === -96 ? 14 : 11) * s, 2.3 * s, 4, 0.35));
	};
	if (stage === "sprout") return ros(1), k.toString();
	const leafy = stage === "leafy";
	const heads: XY[] = leafy ? [[33, 44], [48, 50]] : [[30, 21], [52, 30]];
	for (const [x, y] of heads) {
		const P: P4 = [[40, 86], [40, 62], [x, y + 22], [x, y]];
		k.s(GREEN.dark, 1.4, cub(P));
		for (const [i, [px, py]] of along(P, [0.38, 0.62, 0.82]).entries()) k.f(OX.leaf, toothD(px, py, i % 2 ? -35 : -145, 8 - i, 1.5, 3, 0.4));
	}
	ros(leafy ? 1.2 : 1.3);
	if (leafy) {
		for (const [x, y] of heads) k.f(OX.bud, dotD(x, y, 2.6)).dots(OX.petal, 0.7, [[x - 1, y - 2.2], [x + 1, y - 2.2], [x, y - 2.6]]);
		return k.toString();
	}
	for (const [x, y] of heads) {
		k.s(OX.shade, 2.4, rays(x, y, 22, 3.4, 8.6, 360 / 44), "shade");
		k.s(OX.petal, 2.2, rays(x, y, 22, 3.4, 8.8), "petal");
		k.f(OX.eye, dotD(x, y, 3.3), "eye").f(OX.eyeD, `M${f(x - 2.6)} ${f(y + 1.2)}Q${f(x)} ${f(y + 4.4)} ${f(x + 2.6)} ${f(y + 1.2)}Q${f(x)} ${f(y + 2.6)} ${f(x - 2.6)} ${f(y + 1.2)}Z`, "eye");
	}
	return k.toString();
}

/* ---------- 2. Red clover ---------- */
const RC = { a: "#9e3466", b: "#cf5b93", c: "#e894bb", leaf: "#5e9a4a", mark: "#c4dca8", stalk: "#4f8a3e" };
function cloverHead(k: Ink, x: number, y: number, r: number, a: string, b: string, c: string): void {
	k.f(a, dotD(x, y, r), "head");
	let db = "";
	let dc = "";
	for (let j = 0; j < 4; j++) {
		const yy = y + r * 0.6 - j * r * 0.45;
		const half = Math.sqrt(Math.max(0, r * r - (yy - y) * (yy - y))) * 0.85;
		const n = 2 + Math.round(half / 1.5);
		for (let i = 0; i < n; i++) {
			const xx = x - half + (2 * half * i) / (n - 1);
			const d = lensD(xx, yy + 1.2, -90 + ((xx - x) / r) * 50, r * 0.62, 0.7);
			if (j < 2) db += d;
			else dc += d;
		}
	}
	k.f(b, db, "head").f(c, dc, "head");
}
function redClover(stage: GrowingStage): string {
	const k = new Ink();
	const leaves = (list: readonly (readonly [number, number, number, number])[]) => {
		for (const [x, y, deg, l] of list) {
			k.s(RC.stalk, 1.1, cub([[40, 87], [40, 80], [x, y + 6], [x, y]]));
			trefoil(k, x, y, deg, l, RC.leaf, RC.mark);
		}
	};
	if (stage === "sprout") return leaves([[35, 75, -110, 5.5], [45, 72, -70, 5.5]]), k.toString();
	const base: (readonly [number, number, number, number])[] = [[27, 66, -130, 7], [38, 58, -95, 7.5], [52, 62, -60, 7], [31, 74, -150, 6], [49, 74, -30, 6]];
	if (stage === "leafy") {
		k.s(RC.stalk, 1.3, cub([[40, 87], [41, 70], [45, 56], [46, 48]]));
		leaves(base);
		return k.f(RC.leaf, lensD(46, 50, -125, 5, 1.6) + lensD(46, 50, -55, 5, 1.6)).f(RC.a, dotD(46, 46, 2.6)).toString();
	}
	const heads: XY[] = [[31, 32], [51, 26]];
	for (const [x, y] of heads) k.s(RC.stalk, 1.4, cub([[40, 87], [40, 62], [x, y + 20], [x, y]]));
	leaves(base);
	for (const [x, y] of heads) {
		trefoil(k, x, y + 8, -90, 5, RC.leaf, RC.mark);
		cloverHead(k, x, y, 6.2, RC.a, RC.b, RC.c);
	}
	return k.toString();
}

/* ---------- 3. White clover ---------- */
const WC = { leaf: "#4c9040", mark: "#e6f0da", stalk: "#6f9c56", a: "#d8d2c0", b: "#f7f4ec", spent: "#c9a892" };
function whiteClover(stage: GrowingStage): string {
	const k = new Ink();
	const runner = (x0: number, x1: number) => k.s(WC.stalk, 1.2, `M${x0} 86.5Q40 84.5 ${x1} 86.5`);
	const leaves = (list: readonly (readonly [number, number, number])[]) => {
		for (const [x, y, l] of list) {
			const bx = x < 40 ? x + 4 : x - 4;
			k.s(WC.stalk, 0.9, cub([[bx, 86], [bx, 80], [x, y + 5], [x, y]]));
			trefoil(k, x, y, -90 + (x - 40) * 1.2, l, WC.leaf, WC.mark, 2);
		}
	};
	if (stage === "sprout") return runner(30, 50), leaves([[36, 74, 4.6], [45, 77, 4]]), k.toString();
	const L: (readonly [number, number, number])[] = [[24, 76, 4.6], [33, 68, 5.2], [44, 72, 5.2], [55, 70, 5], [62, 78, 4.4], [18, 81, 4]];
	runner(14, 66);
	if (stage === "leafy") return leaves(L), k.toString();
	const heads: XY[] = [[30, 52], [49, 47]];
	for (const [x, y] of heads) k.s(WC.stalk, 1, cub([[x + (x < 40 ? 6 : -6), 86], [x, 76], [x, y + 12], [x, y]]));
	leaves(L);
	for (const [x, y] of heads) {
		let sp = "";
		for (const a of [35, 62, 90, 118, 145]) sp += lensD(x, y + 1, a, 6.4, 0.85);
		const bumps: XY[] = [];
		for (let i = 0; i <= 10; i++) bumps.push(at(x, y - 0.6, -190 + i * 20, 4.6));
		k.f(WC.spent, sp, "spent").dots(WC.b, 1.5, bumps, "head").f(WC.b, dotD(x, y - 0.6, 4.6), "head").dots(WC.a, 0.8, [[x - 1.6, y + 0.4], [x + 1.4, y + 0.8], [x, y - 2], [x + 2.4, y - 2.2], [x - 2.6, y - 2.4]], "sh");
	}
	return k.toString();
}

/* ---------- 4. Meadow buttercup ---------- */
const BC = { leaf: "#5a9848", stem: "#4f8a3e", petal: "#f3c11a", hi: "#ffe57a", eye: "#c99a0c", eyeD: "#8f7a1c" };
function cutLeaf(k: Ink, x: number, y: number, deg: number, r: number, fill: string): void {
	let d = "";
	for (const a of [-58, 0, 58]) {
		const [mx, my] = at(x, y, deg + a, r * 0.42);
		d += lensD(x, y, deg + a, r, r * 0.13);
		for (const b of [-40, 40]) d += lensD(mx, my, deg + a + b, r * 0.42, r * 0.13);
	}
	k.f(fill, d);
}
function cup(k: Ink, x: number, y: number, s: number): void {
	k.f(BC.petal, ovals(x, y, 5, 3 * s, 3.1 * s, 2.9 * s), "petal");
	let hi = "";
	for (let i = 0; i < 5; i++) {
		const a = -90 + i * 72;
		const [hx, hy] = at(x, y, a, 4 * s);
		hi += ovalD(hx, hy, 1.2 * s, 0.7 * s, a + 90);
	}
	k.f(BC.hi, hi, "hi").f(BC.eye, dotD(x, y, 1.8 * s), "eye").dots(BC.eyeD, 0.4 * s, [0, 1, 2, 3, 4, 5].map((i) => at(x, y, i * 60, 1.2 * s)), "eye");
}
function buttercup(stage: GrowingStage): string {
	const k = new Ink();
	if (stage === "sprout") {
		k.s(BC.stem, 1, seg(40, 87, 34, 76) + seg(40, 87, 46, 74));
		cutLeaf(k, 34, 76, -120, 9, BC.leaf);
		cutLeaf(k, 46, 74, -65, 9, BC.leaf);
		return k.toString();
	}
	const leafy = stage === "leafy";
	const basal: XY[] = [[26, 72], [34, 66], [47, 65], [55, 72]];
	const tips: P4[] = leafy
		? [[[40, 87], [40, 70], [44, 56], [44, 46]]]
		: [
				[[40, 87], [40, 60], [30, 42], [26, 28]],
				[[40, 87], [41, 60], [44, 34], [45, 17]],
				[[40, 87], [41, 66], [54, 48], [58, 32]],
				[[40, 87], [40, 70], [34, 54], [33, 46]],
			];
	for (const P of tips) k.s(BC.stem, 1.1, cub(P));
	for (const [x, y] of basal) {
		k.s(BC.stem, 1, cub([[40, 87], [40, 80], [x, y + 6], [x, y]]));
		cutLeaf(k, x, y, -90 + (x - 40) * 3, leafy ? 11 : 12, BC.leaf);
	}
	for (const P of tips.slice(0, 2)) {
		const [lx, ly] = bez(P, 0.55);
		cutLeaf(k, lx, ly, lx < 40 ? -150 : -30, 6, BC.leaf);
	}
	if (leafy) return k.f(GREEN.light, dotD(44, 45, 2.4)).toString();
	for (const [i, P] of tips.entries()) {
		const [x, y] = P[3];
		if (i === 3) k.f(GREEN.light, dotD(x, y - 1, 2.2)).f(BC.petal, dotD(x, y - 2.6, 1.2));
		else cup(k, x, y, i === 1 ? 1.15 : 1);
	}
	return k.toString();
}

/* ---------- 5. Cowslip ---------- */
const CW = { leaf: "#7fb365", vein: "#4f8a3e", stalk: "#9dbf74", calyx: "#bcd38a", bell: "#f2c12e", dot: "#de7a18" };
function cowRosette(k: Ink, s: number): void {
	for (const a of [-160, -125, -95, -60, -22]) wrinkled(k, 40, 86, a, (a === -95 ? 15 : 13) * s, 3.4 * s, CW.leaf, CW.vein);
}
function cowslip(stage: GrowingStage): string {
	const k = new Ink();
	if (stage === "sprout") return cowRosette(k, 0.95), k.toString();
	const leafy = stage === "leafy";
	const top: XY = leafy ? [41, 50] : [42, 30];
	k.s(CW.stalk, 1.8, cub([[40, 86], [40, 70], [top[0] - 1, top[1] + 12], top]));
	cowRosette(k, leafy ? 1.3 : 1.45);
	const [tx, ty] = top;
	if (leafy) {
		for (const a of [40, 75, 110, 145]) {
			const [bx, by] = at(tx, ty, a, 3);
			k.s(CW.stalk, 0.8, seg(tx, ty, bx, by)).f(CW.calyx, ovalD(bx, by + 1, 1.2, 2.2, a - 90));
		}
		return k.toString();
	}
	for (const [a, r] of [[20, 2], [48, 4.5], [75, 2.5], [100, 5], [128, 2], [150, 4], [62, 8], [112, 8.5]] as const) {
		const [px, py] = at(tx, ty, a, r);
		const [bx, by] = at(px, py, a, 7.8);
		k.s(CW.stalk, 0.7, seg(tx, ty, px, py), "ped").f(CW.calyx, lensD(px, py, a, 7.4, 1.8), "calyx").f(CW.bell, ovalD(bx, by, 1.8, 3.1, a), "bell").dots(CW.dot, 0.7, [[bx, by]], "dot");
	}
	return k.toString();
}

/* ---------- 6. Primrose ---------- */
const PR = { leaf: "#78b55e", vein: "#4a8a3c", petal: "#f6e9a6", eye: "#e7a72a", stalk: "#a6c48a" };
function primFlower(k: Ink, x: number, y: number, s: number): void {
	const lobes: XY[] = [];
	const mids: XY[] = [];
	for (let i = 0; i < 5; i++) {
		const a = -90 + i * 72;
		for (const b of [-17, 17]) lobes.push(at(x, y, a + b, 3.6 * s));
		mids.push(at(x, y, a, 2.4 * s));
	}
	k.dots(PR.petal, 1.95 * s, lobes, "petal").dots(PR.petal, 1.6 * s, mids, "petal");
	let e = "";
	for (let i = 0; i < 5; i++) e += lensD(x, y, -90 + i * 72, 2.1 * s, 0.7 * s);
	k.f(PR.eye, e + dotD(x, y, 0.9 * s), "eye").dots(GREEN.dark, 0.35 * s, [[x, y]], "eye");
}
function primrose(stage: GrowingStage): string {
	const k = new Ink();
	const ros = (s: number) => {
		for (const a of [-168, -140, -112, -90, -68, -40, -12]) wrinkled(k, 40, 86, a, (16 - Math.abs(a + 90) / 14) * s, 4 * s, PR.leaf, PR.vein);
	};
	if (stage === "sprout") return ros(0.8), k.toString();
	if (stage === "leafy") {
		ros(1.3);
		return k.s(PR.stalk, 0.9, seg(40, 84, 33, 66) + seg(40, 84, 47, 64)).f(GREEN.light, ovalD(33, 64, 1.3, 2.4) + ovalD(47, 62, 1.3, 2.4)).f(PR.petal, dotD(33, 62, 1) + dotD(47, 60, 1)).toString();
	}
	const fl: [number, number, number][] = [[25, 66, 1], [40, 55, 1.1], [55, 63, 1], [32, 74, 0.95], [49, 72, 0.95]];
	k.s(PR.stalk, 0.9, fl.map(([x, y]) => seg(40, 84, x, y)).join(""));
	ros(1.45);
	for (const [x, y, s] of fl) primFlower(k, x, y, s);
	return k.toString();
}

/* ---------- 7. Field scabious ---------- */
const SC = { leaf: "#6d995a", stem: "#5a8048", outer: "#a68bd6", disc: "#bea9e6", floret: "#8a6cc4", anther: "#f4f0ff", bud: "#9c8bb8" };
function scabHead(k: Ink, x: number, y: number, s: number): void {
	k.f(SC.outer, ovals(x, y, 10, 4.4 * s, 2.6 * s, 2.3 * s), "outer").f(SC.disc, dotD(x, y, 3.8 * s), "disc");
	const pts: XY[] = [];
	for (let i = 0; i < 9; i++) pts.push(at(x, y, i * 40, 2.6 * s));
	k.dots(SC.floret, 0.75 * s, [...pts, [x, y]], "fl").dots(SC.anther, 0.4 * s, [0, 1, 2, 3, 4, 5].map((i) => at(x, y, 20 + i * 60, 1.6 * s)), "an");
}
function scabious(stage: GrowingStage): string {
	const k = new Ink();
	const basal = (s: number) => {
		for (const a of [-160, -120, -60, -20]) k.f(SC.leaf, toothD(40, 86, a, 13 * s, 2.6 * s, 5, 0.72, 0.4));
	};
	if (stage === "sprout") return basal(0.95), k.f(SC.leaf, toothD(40, 86, -92, 14, 2.4, 4, 0.5)).toString();
	const leafy = stage === "leafy";
	const P: P4[] = leafy
		? [[[40, 86], [40, 66], [43, 52], [44, 44]]]
		: [
				[[40, 86], [39, 60], [31, 40], [29, 22]],
				[[40, 86], [41, 56], [49, 34], [51, 15]],
				[[40, 86], [41, 68], [55, 52], [58, 40]],
			];
	for (const p of P) {
		k.s(SC.stem, 1.1, cub(p));
		const [lx, ly] = bez(p, 0.4);
		k.f(SC.leaf, toothD(lx, ly, -150, 8, 1.6, 3, 0.7) + toothD(lx, ly, -30, 8, 1.6, 3, 0.7));
	}
	basal(leafy ? 1.25 : 1.35);
	if (leafy) return k.f(SC.bud, dotD(44, 43, 2.4)).toString();
	scabHead(k, 29, 22, 1.05);
	scabHead(k, 51, 15, 1.15);
	return k.f(SC.bud, dotD(58, 39, 2.4)).dots(SC.outer, 0.7, [[57, 37.4], [59, 37.6]]).toString();
}

/* ---------- 8. Red campion ---------- */
const CA = { petal: "#d83f7c", deep: "#a52a5c", calyx: "#86364a", eye: "#f6c6d8", leaf: "#5e9a4a", stem: "#6d7c48" };
function campionFlower(k: Ink, x: number, y: number, s: number, n = 5): void {
	k.f(CA.calyx, lensD(x, y, 100, 7 * s, 1.8 * s), "calyx");
	let d = "";
	for (let i = 0; i < n; i++) {
		const a = -90 + i * (360 / n);
		d += lensD(x, y, a - 11, 6.6 * s, 1.75 * s) + lensD(x, y, a + 11, 6.6 * s, 1.75 * s);
	}
	k.f(CA.petal, d, "petal").f(CA.eye, dotD(x, y, 1.4 * s), "eye").dots(CA.deep, 0.4 * s, [[x, y]], "eye");
}
function pairLeaves(k: Ink, x: number, y: number, len: number, w: number, fill: string, droop = 20, shape: 0 | 1 = 1): void {
	k.f(fill, leafD(x, y, 180 - droop, len, w, shape) + leafD(x, y, droop, len, w, shape));
}
function campion(stage: GrowingStage): string {
	const k = new Ink();
	if (stage === "sprout") {
		k.s(CA.stem, 1.4, seg(40, 87, 40, 70));
		pairLeaves(k, 40, 80, 8, 2.8, CA.leaf, 30);
		pairLeaves(k, 40, 71, 6, 2.2, CA.leaf, 45);
		return k.toString();
	}
	const leafy = stage === "leafy";
	const fork: XY = leafy ? [40, 54] : [40, 50];
	const tips: XY[] = leafy ? [[33, 44], [47, 41]] : [[27, 27], [52, 21], [40, 37]];
	k.s(CA.stem, 1.6, seg(40, 87, fork[0], fork[1]));
	for (const [x, y] of tips) k.s(CA.stem, 1.2, cub([fork, [fork[0], fork[1] - 6], [x, y + 8], [x, y]]));
	for (const [y, l] of [[78, 13], [66, 12], [fork[1] + 1, 9]] as const) {
		pairLeaves(k, 40, y, l, l * 0.3, CA.leaf);
		k.s(GREEN.dark, 0.6, ribD(40, y, 160, l) + ribD(40, y, 20, l), "rib");
	}
	if (leafy) {
		for (const [x, y] of tips) k.f(CA.calyx, ovalD(x, y, 1.8, 3.2), "calyx").f(CA.petal, dotD(x, y - 3, 1.2), "petal");
		return k.toString();
	}
	campionFlower(k, 27, 27, 1);
	campionFlower(k, 52, 21, 1.1);
	return k.f(CA.calyx, ovalD(40, 36, 1.8, 3.4), "calyx2").f(CA.petal, dotD(40, 32.4, 1.2), "petal2").toString();
}

/* ---------- 9. Ragged robin ---------- */
const RR = { petal: "#e8789f", calyx: "#7a2f45", stem: "#8a4a58", leaf: "#6a9a52" };
function robin(k: Ink, x: number, y: number, s: number): void {
	let d = "";
	for (let i = 0; i < 5; i++) {
		const a = -90 + i * 72;
		for (const [b, r] of [[-15, 6], [-5, 7.6], [5, 7.6], [15, 6]] as const) {
			const [px, py] = at(x, y, a + b * 0.6, 1.6 * s);
			const [qx, qy] = at(x, y, a + b, r * s);
			d += seg(px, py, qx, qy);
		}
	}
	k.s(RR.petal, 1 * s, d, "petal").f(RR.calyx, dotD(x, y, 1.6 * s), "cal");
}
function raggedRobin(stage: GrowingStage): string {
	const k = new Ink();
	const o = (x: number, y: number, l: number) => pairLeaves(k, x, y, l, l * 0.12, RR.leaf, 35);
	if (stage === "sprout") return k.s(RR.stem, 1, seg(40, 87, 40, 70)), o(40, 82, 10), o(40, 74, 8), k.toString();
	const leafy = stage === "leafy";
	const P: P4[] = leafy
		? [[[40, 87], [40, 66], [36, 56], [34, 46]], [[40, 87], [41, 68], [46, 58], [48, 50]]]
		: [
				[[40, 87], [40, 60], [30, 44], [26, 28]],
				[[40, 87], [41, 55], [46, 36], [47, 17]],
				[[40, 87], [41, 66], [55, 52], [59, 36]],
				[[40, 87], [40, 70], [35, 58], [36, 48]],
			];
	k.s(RR.stem, 1, P.map(cub).join(""));
	o(40, 80, 13);
	o(40, 70, 11);
	for (const p of P.slice(0, 3)) {
		const [x, y] = bez(p, 0.62);
		o(x, y, 7);
	}
	if (leafy) {
		for (const p of P) k.f(RR.calyx, ovalD(p[3][0], p[3][1], 1.5, 2.6)).dots(RR.petal, 0.8, [[p[3][0], p[3][1] - 2.8]]);
		return k.toString();
	}
	for (const [i, p] of P.entries()) robin(k, p[3][0], p[3][1], i === 3 ? 0.75 : i === 1 ? 1.05 : 0.95);
	return k.toString();
}

/* ---------- 10. Meadow cranesbill ---------- */
const CB = { leaf: "#5b9748", rib: "#3f7a35", petal: "#7c84d8", vein: "#4f55a8", eye: "#eeeaff", stem: "#5d8846", beak: "#7aa356" };
function palm(k: Ink, x: number, y: number, deg: number, r: number): void {
	let d = "";
	let rib = "";
	for (let i = 0; i < 5; i++) {
		const a = deg - 76 + i * 38;
		d += lensD(x, y, a, r, r * 0.3);
		const [mx, my] = at(x, y, a, r * 0.55);
		d += lensD(mx, my, a - 30, r * 0.4, r * 0.13) + lensD(mx, my, a + 30, r * 0.4, r * 0.13);
		const [ex, ey] = at(x, y, a, r * 0.8);
		rib += seg(x, y, ex, ey);
	}
	k.f(CB.leaf, d).s(CB.rib, 0.5, rib, "rib");
}
function crane(k: Ink, x: number, y: number, s: number): void {
	k.f(CB.petal, ovals(x, y, 5, 3.6 * s, 3.5 * s, 3.1 * s), "petal");
	let v = "";
	for (let i = 0; i < 5; i++) {
		const a = -90 + i * 72;
		for (const b of [-9, 0, 9]) {
			const [px, py] = at(x, y, a + b, 1.6 * s);
			const [qx, qy] = at(x, y, a + b, (b ? 5 : 5.8) * s);
			v += seg(px, py, qx, qy);
		}
	}
	k.s(CB.vein, 0.45, v, "vein").f(CB.eye, dotD(x, y, 1.4 * s), "eye");
}
function cranesbill(stage: GrowingStage): string {
	const k = new Ink();
	if (stage === "sprout") {
		k.s(CB.stem, 1, seg(40, 87, 35, 76) + seg(40, 87, 46, 74));
		palm(k, 35, 76, -110, 7);
		palm(k, 46, 74, -70, 7);
		return k.toString();
	}
	const leafy = stage === "leafy";
	const basal: XY[] = [[26, 70], [38, 62], [52, 68]];
	const P: P4[] = leafy
		? [[[40, 87], [41, 66], [46, 54], [47, 44]]]
		: [
				[[40, 87], [40, 60], [32, 44], [28, 28]],
				[[40, 87], [41, 58], [48, 38], [50, 22]],
				[[40, 87], [41, 66], [55, 54], [59, 42]],
				[[40, 87], [40, 64], [52, 44], [60, 26]],
			];
	k.s(CB.stem, 1.1, P.map(cub).join("") + basal.map(([x, y]) => cub([[40, 87], [40, 80], [x, y + 6], [x, y]])).join(""));
	for (const [x, y] of basal) palm(k, x, y, -90 + (x - 40) * 3, leafy ? 11 : 12);
	const [mx, my] = bez(P[0] ?? P4Z, 0.55);
	palm(k, mx, my, -150, 6);
	if (leafy) return k.f(CB.beak, ovalD(47, 43, 1.6, 2.6)).toString();
	crane(k, 28, 28, 1);
	crane(k, 50, 22, 1.1);
	crane(k, 59, 42, 0.85);
	return k.f(CB.beak, lensD(60, 27, -95, 9, 0.9) + ovalD(60, 27.5, 1.4, 1.1)).toString();
}
const P4Z: P4 = [[40, 87], [40, 87], [40, 87], [40, 87]];

/* ---------- 11. Bird's-foot trefoil ---------- */
const BT = { leaf: "#6b9e55", stem: "#5f8a45", petal: "#f4c01a", keel: "#e39812", tinge: "#cf4f26", pod: "#6e5a36" };
function bftLeaf(k: Ink, x: number, y: number, deg: number, s: number): void {
	let d = "";
	for (const a of [-40, 0, 40, 150, -150]) d += lensD(x, y, deg + a, (a > 90 || a < -90 ? 2.8 : 3.8) * s, 1.1 * s);
	k.f(BT.leaf, d);
}
function crown(k: Ink, x: number, y: number, s: number): void {
	let banner = "";
	let keel = "";
	const tinge: XY[] = [];
	for (const a of [-170, -130, -90, -50, -10]) {
		const [bx, by] = at(x, y, a, 4.8 * s);
		keel += lensD(x, y, a, 6 * s, 1.1 * s);
		banner += dotD(bx, by, 2 * s);
		tinge.push(at(x, y, a, 1.6 * s));
	}
	k.f(BT.keel, keel, "keel").f(BT.petal, banner, "ban").dots(BT.tinge, 0.75 * s, tinge, "ting");
}
function trefoilPlant(stage: GrowingStage): string {
	const k = new Ink();
	if (stage === "sprout") {
		k.s(BT.stem, 1, cub([[40, 87], [38, 80], [34, 76], [32, 74]]) + cub([[40, 87], [42, 80], [46, 76], [48, 72]]));
		bftLeaf(k, 32, 74, -130, 1);
		bftLeaf(k, 48, 72, -60, 1);
		return bftLeaf(k, 40, 80, -90, 0.9), k.toString();
	}
	const leafy = stage === "leafy";
	const P: P4[] = [
		[[40, 87], [34, 82], [24, 80], [18, 70]],
		[[40, 87], [38, 76], [30, 66], [30, 56]],
		[[40, 87], [42, 74], [48, 62], [49, 52]],
		[[40, 87], [46, 82], [56, 78], [62, 66]],
	];
	k.s(BT.stem, 1, P.map(cub).join(""));
	for (const p of P) for (const [i, [x, y]] of along(p, leafy ? [0.35, 0.65, 0.9] : [0.4, 0.75]).entries()) bftLeaf(k, x, y, (x < 40 ? -130 : -50) + (i % 2 ? 40 : -20), leafy ? 1 : 1.1);
	if (leafy) return k.f(GREEN.light, dotD(30, 54, 1.8) + dotD(49, 50, 1.8)).toString();
	crown(k, 30, 53, 1);
	crown(k, 49, 48, 1.1);
	crown(k, 18, 67, 0.85);
	let pod = "";
	for (const a of [-60, -38, -16, 6]) {
		const [px, py] = at(63, 64, a, 8);
		pod += seg(63, 64, px, py);
	}
	return k.s(BT.pod, 1.2, pod).toString();
}

/* ---------- 12. Yarrow ---------- */
const YA = { leaf: "#6f9e58", stem: "#5d8848", head: "#f3f1e8", shade: "#b3ac98", pink: "#e3c2cc" };
function corymb(k: Ink, x: number, y: number, w: number, s: number): void {
	const hd: XY[] = [];
	const pink: XY[] = [];
	const sh: XY[] = [];
	let br = "";
	for (let row = 0; row < 4; row++) {
		const half = w * (0.6 + 0.13 * row);
		const n = Math.max(2, Math.round((2 * half) / (2.2 * s)) + 1);
		for (let j = 0; j < n; j++) {
			const px = x - half + (2 * half * j) / (n - 1) + (row % 2) * 0.5;
			const py = y + row * 1.9 * s;
			(row === 3 ? sh : rnd(row * 20 + j) < 0.15 ? pink : hd).push([px, py]);
		}
	}
	for (let j = 0; j < 7; j++) br += seg(x, y + 13 * s, x - w * 0.8 + (w * 1.6 * j) / 6, y + 5 * s);
	k.s(YA.stem, 0.6, br, "br").dots(YA.shade, 1.3 * s, [...sh, ...hd.map(([a, b]): XY => [a + 0.4, b + 0.7])], "hd").dots(YA.head, 1.3 * s, hd, "hd").dots(YA.pink, 1.3 * s, pink, "hd");
}
function yarrow(stage: GrowingStage): string {
	const k = new Ink();
	if (stage === "sprout") {
		for (const a of [-130, -95, -60]) feather(k, 40, 86, a, a === -95 ? 15 : 12, 1.8, YA.leaf);
		return k.toString();
	}
	const leafy = stage === "leafy";
	const top = leafy ? 48 : 26;
	k.s(YA.stem, 1.5, seg(40, 87, 40, top + 7));
	for (const a of [-165, -135, -45, -15]) feather(k, 40, 86, a, 15, 2.2, YA.leaf);
	for (const [i, y] of [76, 68, 60, 52, 44].entries()) if (y > top + 6) feather(k, 40, y, i % 2 ? -35 : -145, 11 - i, 1.9, YA.leaf);
	if (leafy) {
		k.s(YA.stem, 0.6, seg(40, 55, 35, 47) + seg(40, 55, 45, 47) + seg(40, 55, 40, 46));
		return k.dots(YA.shade, 1.2, [[35, 46], [37.5, 45], [40, 45], [42.5, 45], [45, 46]]).toString();
	}
	corymb(k, 40, 20, 12, 1);
	k.s(YA.stem, 0.9, cub([[40, 56], [48, 50], [55, 46], [56, 42]]));
	corymb(k, 56, 33, 6, 0.8);
	return k.toString();
}

/* ---------- 13. Common knapweed ---------- */
const KN = { leaf: "#6a9452", stem: "#5a7a42", knob: "#4e3527", scale: "#2f1f17", rim: "#8c6a4c", tuft: "#a8449a", tuftL: "#cc6dbd" };
function knapHead(k: Ink, x: number, y: number, s: number, open = true): void {
	if (open) {
		let a = "";
		let b = "";
		for (let i = 0; i < 11; i++) {
			const ang = -165 + i * 15;
			const [ox, oy] = at(x, y - 1.5 * s, ang, (i % 2 ? 6 : 7.4) * s);
			const [ix, iy] = at(x, y - 1.5 * s, ang, 1.5 * s);
			if (i % 2) b += seg(ix, iy, ox, oy);
			else a += seg(ix, iy, ox, oy);
		}
		k.s(KN.tuft, 1.2 * s, a, "tuft").s(KN.tuftL, 1.1 * s, b, "tuft");
	}
	k.f(KN.knob, ovalD(x, y + 1.5 * s, 3.8 * s, 4 * s), "knob");
	const sc: XY[] = [];
	const rim: XY[] = [];
	for (const [dx, dy] of [[-2, 0], [0, 0], [2, 0], [-1, 2], [1, 2], [-2.2, 3.6], [0, 4], [2.2, 3.6], [-1, -1.8], [1, -1.8]] as const) {
		sc.push([x + dx * s, y + (dy + 1) * s]);
		rim.push([x + dx * s, y + (dy + 0.4) * s]);
	}
	k.dots(KN.rim, 0.75 * s, rim, "sc").dots(KN.scale, 0.6 * s, sc, "sc");
}
function knapweed(stage: GrowingStage): string {
	const k = new Ink();
	const lv = (x: number, y: number, a: number, l: number) => k.f(KN.leaf, leafD(x, y, a, l, l * 0.18, 1));
	if (stage === "sprout") {
		for (const a of [-150, -115, -80, -50]) lv(40, 86, a, a === -80 ? 15 : 12);
		return k.toString();
	}
	const leafy = stage === "leafy";
	const P: P4[] = leafy
		? [[[40, 87], [40, 68], [36, 56], [35, 46]], [[40, 87], [41, 70], [46, 60], [48, 52]]]
		: [
				[[40, 87], [40, 58], [31, 42], [29, 26]],
				[[40, 87], [41, 56], [48, 36], [50, 18]],
				[[40, 87], [41, 66], [54, 52], [58, 40]],
			];
	k.s(KN.stem, 1.3, P.map(cub).join(""));
	for (const a of [-165, -140, -40, -15]) lv(40, 86, a, 15);
	for (const p of P) for (const [i, [x, y]] of along(p, [0.3, 0.55, 0.78]).entries()) lv(x, y, i % 2 ? -40 : -140, 10 - i * 2);
	if (leafy) {
		for (const p of P) knapHead(k, p[3][0], p[3][1], 0.7, false);
		return k.toString();
	}
	knapHead(k, 29, 26, 1);
	knapHead(k, 50, 18, 1.1);
	knapHead(k, 58, 40, 0.75, false);
	return k.toString();
}

/* ---------- 14. Lady's bedstraw ---------- */
const LB = { stem: "#4f7a3c", leaf: "#3f7a35", a: "#f2cf34", b: "#d9a91c" };
function bedstraw(stage: GrowingStage): string {
	const k = new Ink();
	if (stage === "sprout") {
		k.s(LB.stem, 1, seg(40, 87, 40, 68) + seg(40, 87, 46, 72));
		for (const [x, y] of [[40, 80], [40, 73], [43.5, 78], [46, 72]] as const) whorl(k, x, y, 7, 3.6, LB.leaf);
		whorl(k, 40, 68, 6, 2.6, GREEN.light);
		return k.toString();
	}
	const leafy = stage === "leafy";
	const P: P4[] = leafy
		? [[[40, 87], [39, 70], [36, 56], [35, 44]], [[40, 87], [41, 72], [45, 60], [48, 48]], [[40, 87], [38, 78], [30, 72], [26, 62]]]
		: [[[40, 87], [39, 66], [35, 48], [31, 28]], [[40, 87], [41, 64], [46, 42], [48, 20]], [[40, 87], [38, 76], [26, 68], [20, 48]], [[40, 87], [42, 76], [56, 66], [61, 42]]];
	k.s(LB.stem, 1, P.map(cub).join(""));
	for (const p of P) for (const [x, y] of along(p, leafy ? [0.3, 0.5, 0.7, 0.88] : [0.25, 0.4, 0.55])) whorl(k, x, y, 8, 4, LB.leaf);
	if (leafy) {
		for (const p of P) whorl(k, p[3][0], p[3][1], 6, 2.8, GREEN.light);
		return k.toString();
	}
	const a: XY[] = [];
	const b: XY[] = [];
	let br = "";
	for (const [pi, p] of P.entries()) {
		for (let i = 0; i < 6; i++) {
			const t = 0.58 + (0.42 * i) / 5;
			const [x, y] = bez(p, t);
			const side = i % 2 ? 1 : -1;
			const len = 7.5 - i;
			const [ex, ey] = at(x, y, side > 0 ? -35 : -145, len);
			br += seg(x, y, ex, ey);
			for (let j = 0; j < 7; j++) {
				const [cx, cy] = at(ex, ey, j * 51 + i * 20, 0.9 + rnd(pi * 60 + i * 7 + j) * 1.8);
				(j < 2 ? b : a).push([cx, cy + (j < 2 ? 1 : 0)]);
			}
			a.push([(x + ex) / 2, (y + ey) / 2 - 1]);
		}
		a.push([p[3][0], p[3][1] - 1], [p[3][0] - 1.4, p[3][1] + 0.6], [p[3][0] + 1.4, p[3][1] + 0.4]);
	}
	return k.s(LB.stem, 0.6, br, "br").dots(LB.b, 1, b).dots(LB.a, 1, a).toString();
}

/* ---------- 15. Meadowsweet ---------- */
const MS = { stem: "#9a3c3a", leaf: "#4b8a3e", under: "#8bb17a", a: "#f4ecd2", b: "#d8caa0", c: "#e9dfb6" };
function msLeaf(k: Ink, x: number, y: number, deg: number, len: number): void {
	pinnate(k, x, y, deg, len, 3, len * 0.36, len * 0.13, MS.leaf, MS.stem, false, 1);
	const [ex, ey] = at(x, y, deg, len);
	k.f(MS.leaf, toothD(ex, ey, deg - 35, len * 0.42, len * 0.12, 3, 0.25) + toothD(ex, ey, deg, len * 0.5, len * 0.14, 3, 0.25) + toothD(ex, ey, deg + 35, len * 0.42, len * 0.12, 3, 0.25));
}
function meadowsweet(stage: GrowingStage): string {
	const k = new Ink();
	if (stage === "sprout") {
		k.s(MS.stem, 1.2, seg(40, 87, 40, 76));
		msLeaf(k, 40, 80, -150, 10);
		msLeaf(k, 40, 77, -40, 10);
		return k.toString();
	}
	const leafy = stage === "leafy";
	const top = leafy ? 44 : 22;
	k.s(MS.stem, 1.8, seg(40, 87, 40, top));
	const nodes = leafy ? [80, 70, 60, 51] : [80, 70, 60, 50, 40];
	for (const [i, y] of nodes.entries()) msLeaf(k, 40, y, i % 2 ? -30 : -150, 18 - i * 2);
	if (leafy) return k.f(MS.c, dotD(40, top - 1, 2.2)).toString();
	let br = "";
	const tips: XY[] = [[26, 18], [33, 11], [41, 8], [49, 12], [55, 18], [36, 21], [47, 22]];
	for (const [x, y] of tips) br += cub([[40, top + 8], [40, top], [x, y + 6], [x, y]]);
	k.s(MS.stem, 0.8, br);
	const a: XY[] = [];
	const b: XY[] = [];
	const c: XY[] = [];
	for (const [ti, [x, y]] of tips.entries()) {
		for (let i = 0; i < 9; i++) {
			const ang = i * 40 + ti * 13;
			const r = 1.3 + rnd(ti * 10 + i) * 2.6;
			const [px, py] = at(x, y, ang, r);
			(i < 2 ? b : i % 3 ? a : c).push([px, py + (i < 2 ? 1.6 : 0)]);
		}
	}
	return k.dots(MS.b, 1.45, b).dots(MS.a, 1.45, a).dots(MS.c, 1.3, c).toString();
}

/* ---------- 16. Yellow rattle ---------- */
const YR = { stem: "#4e6b38", leaf: "#6a9a50", calyx: "#c4d48c", rattle: "#c9a86a", seed: "#7a5c34", petal: "#f2c831", tooth: "#7a5bb0" };
function rattle(stage: GrowingStage): string {
	const k = new Ink();
	const pair = (y: number, l: number) => k.f(YR.leaf, toothD(40, y, -158, l, l * 0.17, 4, 0.4) + toothD(40, y, -22, l, l * 0.17, 4, 0.4));
	if (stage === "sprout") return k.s(YR.stem, 1.2, seg(40, 87, 40, 68)), pair(80, 9), pair(73, 7.5), pair(68, 5), k.toString();
	const leafy = stage === "leafy";
	const top = leafy ? 42 : 16;
	k.s(YR.stem, 1.4, seg(40, 87, 40, top));
	for (const y of leafy ? [80, 72, 64, 56, 49] : [80, 72, 64, 56]) pair(y, 12 - (80 - y) / 10);
	if (leafy) return k.f(YR.calyx, ovalD(37.6, 44, 1.8, 2.6, -25) + ovalD(42.4, 44, 1.8, 2.6, 25)).f(YR.leaf, lensD(40, 44, -90, 5, 1)).toString();
	const levels: [number, boolean][] = [[50, false], [41, true], [32, true], [24, true]];
	for (const [y, fresh] of levels) {
		for (const side of [-1, 1]) {
			const cx = 40 + side * 4.4;
			k.f(fresh ? YR.calyx : YR.rattle, ovalD(cx, y, 3.4, 2.6, side * -30), fresh ? "cal" : "rat");
			if (!fresh) k.dots(YR.seed, 0.8, [[cx, y]]);
			else {
				const [tx, ty] = at(cx, y - 1, side > 0 ? -50 : -130, 7);
				k.f(YR.petal, lensD(cx, y - 1, side > 0 ? -50 : -130, 7, 1.4), "pet").dots(YR.tooth, 0.6, [[tx, ty]], "tooth");
			}
		}
		k.f(YR.leaf, lensD(40, y + 3, -150, 5, 1) + lensD(40, y + 3, -30, 5, 1), "bract");
	}
	return k.f(GREEN.light, lensD(40, 19, -90, 6, 1.4) + lensD(40, 19, -115, 5, 1.2) + lensD(40, 19, -65, 5, 1.2)).toString();
}

/* ---------- 17. Viper's bugloss ---------- */
const VB = { leaf: "#6f9658", stem: "#5d7d45", bristle: "#c9d6b8", a: "#4a66c8", b: "#6e8ce0", bud: "#d77aa6", stamen: "#c43a3a" };
function bugloss(stage: GrowingStage): string {
	const k = new Ink();
	const ros = (s: number) => {
		for (const a of [-165, -135, -105, -75, -45, -15]) k.f(VB.leaf, leafD(40, 86, a, 14 * s * (1 - Math.abs(a + 90) / 250), 2 * s, 1));
	};
	if (stage === "sprout") return ros(1), k.toString();
	const leafy = stage === "leafy";
	const top = leafy ? 46 : 11;
	k.s(VB.stem, 2, seg(40, 87, 40, top));
	ros(leafy ? 1.3 : 1.35);
	const lv = leafy ? [74, 64, 55] : [76, 68];
	for (const [i, y] of lv.entries()) k.f(VB.leaf, leafD(40, y, i % 2 ? -30 : -150, 9, 1.4, 1));
	if (leafy) {
		const buds: XY[] = [];
		for (let y = 48; y < 58; y += 2.6) buds.push([38.4, y], [41.6, y + 1.2]);
		return k.dots(VB.bud, 1, buds).dots(VB.b, 0.9, [[40, top]]).toString();
	}
	const a: string[] = ["", ""];
	const buds: XY[] = [];
	const bris: XY[] = [];
	let cyme = "";
	let st = "";
	for (let i = 0; i < 15; i++) {
		const y = 64 - i * 3.4;
		const side = i % 2 ? 1 : -1;
		const L = 10.5 - i * 0.55;
		const ex = 40 + side * L;
		const ey = y - 3;
		cyme += `M40 ${f(y)}Q${f(40 + side * L * 0.6)} ${f(y + 1.5)} ${f(ex)} ${f(ey)}`;
		buds.push([ex, ey - 1], [ex - side * 1.6, ey - 2.4]);
		for (const t of [0.3, 0.62, 0.92]) {
			const fx = 40 + side * L * t;
			const fy = y + 0.5 - t * 2;
			const deg = side > 0 ? -60 + t * 20 : -120 - t * 20;
			a[(i + (t > 0.5 ? 1 : 0)) % 2] += lensD(fx, fy, deg, 4.6, 1.6);
			const [sx, sy] = at(fx, fy, deg, 5.4);
			st += seg(fx, fy, sx, sy);
		}
		bris.push([40 + side * 0.4, y + 1.6]);
	}
	return k.s(VB.stem, 0.8, cyme, "cy").dots(VB.bud, 1.05, buds).f(VB.a, a[0] ?? "").f(VB.b, a[1] ?? "").s(VB.stamen, 0.4, st).dots(VB.bristle, 0.35, bris).dots(VB.bud, 1.1, [[40, 10]], "top").toString();
}

/* ---------- 18. Queen Anne's lace ---------- */
const QA = { leaf: "#6a9a52", stem: "#6a9450", head: "#f7f5ee", shade: "#b5af9a", eye: "#5a1f3a", nest: "#a99f72" };
function lacy(k: Ink, x: number, y: number, deg: number, len: number): void {
	const q = tf(x, y, deg);
	k.s(QA.leaf, 0.8, `M${q(0, 0)}L${q(len, 0)}`, "lr");
	for (let i = 0; i < 4; i++) {
		const u = len * (0.3 + i * 0.2);
		const l = len * (0.5 - i * 0.1);
		for (const side of [-1, 1]) {
			const [px, py] = at(x, y, deg, u);
			feather(k, px, py, deg + side * 55, l, 1.4, QA.leaf);
		}
	}
}
function umbel(k: Ink, x: number, y: number, w: number, s: number): void {
	let r = "";
	const tops: XY[] = [];
	for (let i = 0; i < 9; i++) {
		const t = i / 8 - 0.5;
		const px = x + t * 2 * w;
		const py = y - 11 * s + t * t * 9 * s;
		r += seg(x, y, px, py);
		tops.push([px, py]);
	}
	k.s(QA.stem, 0.6, r, "ray");
	const sh: XY[] = [];
	const hd: XY[] = [];
	for (const [px, py] of tops) {
		for (const [dx, dy] of [[-2.2, 0.4], [0, -0.2], [2.2, 0.4], [-1.1, -1.8], [1.1, -1.8], [0, -3.2]] as const) hd.push([px + dx * s, py + dy * s]);
		sh.push([px - 1.2 * s, py + 1.2 * s], [px + 1.2 * s, py + 1.2 * s]);
	}
	k.dots(QA.shade, 1.2 * s, [...sh, ...hd.map(([a, b]): XY => [a + 0.4, b + 0.7])], "hd").dots(QA.head, 1.2 * s, hd, "hd").dots(QA.eye, 1.2 * s, [[x, y - 12.4 * s]], "eye");
}
function queenAnne(stage: GrowingStage): string {
	const k = new Ink();
	if (stage === "sprout") {
		lacy(k, 40, 86, -120, 12);
		lacy(k, 40, 86, -65, 13);
		return k.toString();
	}
	const leafy = stage === "leafy";
	const top = leafy ? 46 : 32;
	k.s(QA.stem, 1.5, seg(40, 87, 40, top));
	lacy(k, 40, 86, -155, 16);
	lacy(k, 40, 86, -25, 16);
	lacy(k, 40, 74, -140, 13);
	lacy(k, 40, 64, -40, 12);
	if (leafy) {
		k.s(QA.stem, 0.6, rays(40, top, 5, 0, 4, -150));
		return k.f(QA.nest, dotD(40, top - 3, 2.6)).toString();
	}
	k.s(QA.stem, 1, cub([[40, 64], [46, 58], [55, 54], [59, 48]]));
	umbel(k, 40, top, 15, 1.25);
	let nest = "";
	for (const t of [-2, -1, 0, 1, 2]) nest += `M59 48Q${f(59 + t * 3.2)} 44 ${f(59 + t * 1.4)} 40`;
	return k.s(QA.nest, 0.8, nest, "nest").f(QA.nest, `M54.4 41Q59 38 63.6 41Q59 43 54.4 41Z`, "nestf").toString();
}

/* ---------- 19. Dandelion ---------- */
const DA = { leaf: "#5ea04a", rib: "#3f7a35", stalk: "#a3c27f", a: "#f4b616", b: "#f9d64a", eye: "#e19a0c", bract: "#6b9a4c", clock: "#a9a291", seed: "#f2efe6", hub: "#9b8a6a" };
function dandelion(stage: GrowingStage): string {
	const k = new Ink();
	const ros = (s: number, list: readonly number[]) => {
		for (const a of list) {
			const l = 15 * s * (1 - Math.abs(a + 90) / 300);
			k.f(DA.leaf, toothD(40, 86, a, l, 2.8 * s, 5, 0.7, -0.45)).s(DA.rib, 0.6, ribD(40, 86, a, l));
		}
	};
	if (stage === "sprout") return ros(0.85, [-150, -100, -60, -25]), k.toString();
	const leafy = stage === "leafy";
	if (leafy) {
		k.s(DA.stalk, 1.4, cub([[40, 86], [40, 70], [44, 60], [45, 52]]));
		ros(1.25, [-172, -145, -115, -85, -55, -25, -6]);
		return k.f(DA.bract, ovalD(45, 50, 2, 3)).f(DA.a, dotD(45, 47.4, 1.2)).toString();
	}
	k.s(DA.stalk, 1.5, cub([[40, 86], [40, 66], [32, 52], [31, 40]]) + cub([[40, 86], [41, 64], [50, 40], [52, 28]]) + cub([[40, 86], [41, 76], [55, 70], [57, 62]]));
	ros(1.45, [-172, -148, -122, -98, -74, -48, -22, -6]);
	k.f(DA.bract, lensD(31, 41, 125, 4.5, 0.8) + lensD(31, 41, 55, 4.5, 0.8) + lensD(31, 41, 90, 4, 0.8));
	k.s(DA.a, 1.3, rays(31, 39, 24, 2.4, 7.6)).s(DA.b, 1.2, rays(31, 39, 18, 1, 4.6, 10)).f(DA.eye, dotD(31, 39, 1.3));
	const tips: XY[] = [];
	for (let i = 0; i < 26; i++) tips.push(at(52, 22, i * (360 / 26), 9.2));
	k.s(DA.clock, 0.45, rays(52, 22, 26, 1.4, 8.6)).dots(DA.seed, 0.95, tips).f(DA.hub, dotD(52, 22, 1.7));
	return k.f(DA.bract, ovalD(57, 59.5, 1.9, 3.2)).f(DA.b, dotD(57, 56.7, 1)).toString();
}

/* ---------- 20. Tufted vetch ---------- */
const TV = { leaf: "#6a9e52", stem: "#5a8a46", tendril: "#7aa85c", a: "#6658c2", b: "#9284e2" };
function vetchLeaf(k: Ink, x: number, y: number, deg: number, len: number): void {
	pinnate(k, x, y, deg, len, 5, 3.6, 0.75, TV.leaf, TV.stem, false, 1);
	const [ex, ey] = at(x, y, deg, len);
	const q = tf(ex, ey, deg);
	k.s(TV.tendril, 0.6, `M${q(0, 0)}C${q(3, 0)} ${q(5, -2)} ${q(4, -3.4)}C${q(3, -4.4)} ${q(1.6, -3)} ${q(2.6, -2)}`, "td");
}
function raceme(k: Ink, p: P4, n: number, side: number): void {
	let fa = "";
	let fb = "";
	for (let i = 0; i < n; i++) {
		const t = 0.3 + (0.7 * i) / (n - 1);
		const [x, y] = bez(p, t);
		const s = 1.1 - t * 0.4;
		const a = 90 - side * 40;
		fa += lensD(x, y, a, 5.4 * s, 1.5 * s);
		const [bx, by] = at(x, y, a, 1.2 * s);
		fb += dotD(bx, by, 1.4 * s);
	}
	k.s(TV.stem, 0.8, cub(p), "ax").f(TV.a, fa, "fa").f(TV.b, fb, "fb");
}
function vetch(stage: GrowingStage): string {
	const k = new Ink();
	if (stage === "sprout") {
		k.s(TV.stem, 1, cub([[40, 87], [40, 80], [41, 74], [40, 70]]));
		vetchLeaf(k, 40, 78, -150, 9);
		vetchLeaf(k, 40, 72, -40, 8);
		return k.toString();
	}
	const leafy = stage === "leafy";
	const P: P4 = leafy ? [[40, 87], [38, 70], [44, 56], [42, 42]] : [[40, 87], [36, 66], [46, 44], [42, 16]];
	k.s(TV.stem, 1.2, cub(P));
	for (const [i, [x, y]] of along(P, leafy ? [0.2, 0.45, 0.7, 0.92] : [0.15, 0.32, 0.5, 0.68, 0.86]).entries()) vetchLeaf(k, x, y, i % 2 ? -25 : -155, leafy ? 13 : 14 - i);
	if (leafy) return k.f(GREEN.light, lensD(46, 50, -50, 6, 1.2)).toString();
	const [ax, ay] = bez(P, 0.42);
	const [bx, by] = bez(P, 0.62);
	raceme(k, [[ax, ay], [ax + 9, ay - 5], [ax + 15, ay - 14], [ax + 16, ay - 26]], 12, 1);
	raceme(k, [[bx, by], [bx - 8, by - 4], [bx - 14, by - 12], [bx - 15, by - 23]], 11, -1);
	return k.toString();
}

/* ---------- 21. Selfheal ---------- */
const SH = { leaf: "#5f9a4a", stem: "#6b5468", head: "#5e3e5e", bract: "#7f5a7c", a: "#8f66cc", b: "#c1a6ec" };
function healHead(k: Ink, x: number, y: number, s: number): void {
	const w = 3.6 * s;
	const h = 9 * s;
	k.f(SH.head, `M${f(x - w)} ${f(y)}L${f(x - w)} ${f(y - h + w)}Q${f(x - w)} ${f(y - h)} ${f(x)} ${f(y - h)}Q${f(x + w)} ${f(y - h)} ${f(x + w)} ${f(y - h + w)}L${f(x + w)} ${f(y)}Z`, "hd");
	let br = "";
	for (let i = 0; i < 4; i++) {
		const yy = y - 1.2 * s - i * 2.1 * s;
		br += `M${f(x - w + 0.6)} ${f(yy - 0.8)}L${f(x)} ${f(yy)}L${f(x + w - 0.6)} ${f(yy - 0.8)}`;
	}
	k.s(SH.bract, 0.7, br, "br");
	let a = "";
	let b = "";
	for (let i = 0; i < 3; i++) {
		const yy = y - 3 * s - i * 2.4 * s;
		for (const side of [-1, 1]) {
			if (i === 2 && side < 0) continue;
			const xx = x + side * w * 0.7;
			a += lensD(xx, yy, side > 0 ? -35 : -145, 4.4 * s, 1.3 * s);
			b += lensD(xx, yy + 0.6 * s, side > 0 ? 15 : 165, 2.6 * s, 0.9 * s);
		}
	}
	k.f(SH.b, b, "fb").f(SH.a, a, "fa");
}
function selfheal(stage: GrowingStage): string {
	const k = new Ink();
	const pr = (x: number, y: number, l: number) => {
		pairLeaves(k, x, y, l, l * 0.36, SH.leaf, 18, 0);
		k.s(GREEN.dark, 0.6, ribD(x, y, 162, l) + ribD(x, y, 18, l), "rib");
	};
	if (stage === "sprout") return k.s(SH.stem, 1.3, seg(40, 87, 40, 72)), pr(40, 82, 8), pr(40, 74, 6.5), k.toString();
	const leafy = stage === "leafy";
	const P: P4[] = leafy
		? [[[40, 87], [40, 76], [36, 66], [35, 56]], [[40, 87], [41, 78], [46, 70], [48, 62]]]
		: [[[40, 87], [40, 74], [32, 66], [30, 52]], [[40, 87], [41, 72], [44, 58], [45, 45]], [[40, 87], [42, 80], [54, 74], [57, 60]]];
	k.s(SH.stem, 1.4, P.map(cub).join(""));
	pr(40, 82, 11);
	for (const p of P) {
		const [x, y] = bez(p, 0.5);
		pr(x, y, 8.5);
		pr(p[3][0], p[3][1] + 1, 5.5);
	}
	if (leafy) {
		for (const p of P) k.f(SH.head, ovalD(p[3][0], p[3][1] - 2.4, 2.4, 3.2), "hd");
		return k.toString();
	}
	for (const [i, p] of P.entries()) healHead(k, p[3][0], p[3][1], i === 1 ? 1.15 : 1);
	return k.toString();
}

/* ---------- 22. Harebell ---------- */
const HB = { leaf: "#6a9a52", stem: "#5d8a4a", a: "#8fa9e8", b: "#6b85d0" };
function bellG(x: number, y: number, deg: number, s: number): string {
	const body = `M-1.4 0C-3.4 1.6-3.6 5-4.9 8.4L-3.4 8L-2.2 9.4L-.7 8.4L.8 9.6L2.2 8.4L3.5 9.2L4.9 8.2C3.6 5 3.4 1.6 1.4 0Z`;
	const shade = `M.3 .4C2.6 2 3 5 4.9 8.2L3.5 9.2L2.2 8.4C2.6 6 2 2.4.3 .4Z`;
	return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(deg)}) scale(${f(s)})"><path d="${body}" fill="${HB.a}"/><path d="${shade}" fill="${HB.b}"/></g>`;
}
function harebell(stage: GrowingStage): string {
	const k = new Ink();
	const basal = () => k.f(HB.leaf, leafD(40, 86, -150, 5, 2.4, 2) + leafD(40, 86, -30, 5, 2.4, 2) + leafD(40, 86, -110, 4.6, 2.2, 2));
	if (stage === "sprout") {
		k.s(HB.stem, 0.9, seg(40, 86, 41, 68));
		basal();
		return k.f(HB.leaf, lensD(40.6, 76, -60, 8, 0.7) + lensD(40.8, 72, -120, 7, 0.7)).toString();
	}
	const leafy = stage === "leafy";
	const P: P4[] = leafy
		? [[[40, 86], [40, 66], [42, 54], [42, 44]], [[40, 86], [39, 70], [34, 60], [32, 52]]]
		: [[[40, 86], [40, 56], [34, 38], [32, 24]], [[40, 86], [41, 52], [48, 30], [50, 16]], [[40, 86], [41, 66], [52, 52], [57, 40]]];
	k.s(HB.stem, 0.9, P.map(cub).join(""));
	basal();
	let lv = "";
	for (const p of P) for (const [i, [x, y]] of along(p, [0.3, 0.5, 0.7]).entries()) lv += lensD(x, y, i % 2 ? -55 : -125, 9 - i * 2, 0.7);
	k.f(HB.leaf, lv);
	if (leafy) {
		let hook = "";
		for (const p of P) hook += `M${f(p[3][0])} ${f(p[3][1])}q2 -2 3 1`;
		return k.s(HB.stem, 0.8, hook).f(GREEN.light, ovalD(45, 47, 1.2, 2) + ovalD(35, 55, 1.2, 2)).toString();
	}
	let hook = "";
	let s = "";
	for (const [i, p] of P.entries()) {
		const [x, y] = p[3];
		const dir = i === 0 ? -1 : 1;
		hook += `M${f(x)} ${f(y)}q${f(dir * 3)} -3 ${f(dir * 4)} 2`;
		s += bellG(x + dir * 4, y + 2, dir * 12, i === 2 ? 0.95 : 1.15);
	}
	return k.s(HB.stem, 0.8, hook).toString() + s;
}

/* ---------- 23. Corn marigold ---------- */
const CM = { leaf: "#7fa58e", stem: "#6a9478", ray: "#f3b71b", shade: "#d0920f", disc: "#e09a10", discD: "#b8780a" };
function cmHead(k: Ink, x: number, y: number, s: number): void {
	k.s(CM.shade, 2.5 * s, rays(x, y, 13, 3.4 * s, 7.4 * s, 360 / 26), "sh").s(CM.ray, 2.7 * s, rays(x, y, 13, 3.4 * s, 7.8 * s), "ray");
	k.f(CM.disc, dotD(x, y, 3.4 * s), "dc").dots(CM.discD, 0.45 * s, [0, 1, 2, 3, 4, 5, 6, 7].map((i) => at(x, y, i * 45, 2 * s)), "dc");
}
function cornMarigold(stage: GrowingStage): string {
	const k = new Ink();
	const lv = (x: number, y: number, a: number, l: number) => k.f(CM.leaf, toothD(x, y, a, l, l * 0.25, 3, 0.45, 0.5));
	if (stage === "sprout") return k.s(CM.stem, 1.4, seg(40, 87, 40, 70)), lv(40, 80, -150, 9), lv(40, 76, -30, 9), lv(40, 71, -100, 7), k.toString();
	const leafy = stage === "leafy";
	const P: P4[] = leafy
		? [[[40, 87], [40, 66], [37, 56], [36, 46]], [[40, 87], [41, 70], [46, 62], [48, 54]]]
		: [[[40, 87], [40, 60], [31, 44], [29, 26]], [[40, 87], [41, 58], [49, 38], [51, 18]], [[40, 87], [41, 68], [55, 56], [58, 44]]];
	k.s(CM.stem, 1.5, P.map(cub).join(""));
	lv(40, 80, -160, 12);
	lv(40, 78, -20, 12);
	for (const p of P) for (const [i, [x, y]] of along(p, [0.35, 0.6]).entries()) lv(x, y, i % 2 ? -35 : -145, 10 - i * 2);
	if (leafy) {
		for (const p of P) k.f(GREEN.light, dotD(p[3][0], p[3][1], 2.4)).f(CM.ray, dotD(p[3][0], p[3][1] - 1.4, 1.2));
		return k.toString();
	}
	cmHead(k, 29, 26, 1);
	cmHead(k, 51, 18, 1.1);
	cmHead(k, 58, 44, 0.75);
	return k.toString();
}

/* ---------- 24. Corncockle ---------- */
const CC = { leaf: "#89a37a", stem: "#7f9a70", sepal: "#6f9058", petal: "#b4479a", vein: "#76286a", eye: "#efd2ea" };
function cockle(k: Ink, x: number, y: number, s: number): void {
	let sep = "";
	for (let i = 0; i < 5; i++) sep += lensD(x, y, -54 + i * 72, 12.5 * s, 0.9 * s);
	k.f(CC.sepal, sep, "sep").f(CC.petal, ovals(x, y, 5, 3.8 * s, 3.9 * s, 3.3 * s), "pet");
	const v: XY[] = [];
	for (let i = 0; i < 5; i++) for (const b of [-14, 0, 14]) for (const r of [2.6, 4.2, 5.6]) v.push(at(x, y, -90 + i * 72 + b * (r > 4 ? 1 : 0.6), r * s));
	k.dots(CC.vein, 0.35 * s, v, "v").f(CC.eye, dotD(x, y, 1.6 * s), "eye");
}
function corncockle(stage: GrowingStage): string {
	const k = new Ink();
	const pr = (x: number, y: number, l: number) => k.f(CC.leaf, lensD(x, y, -150, l, 0.9) + lensD(x, y, -30, l, 0.9));
	if (stage === "sprout") return k.s(CC.stem, 1.2, seg(40, 87, 40, 68)), pr(40, 82, 11), pr(40, 74, 9), pr(40, 69, 6), k.toString();
	const leafy = stage === "leafy";
	const P: P4[] = leafy
		? [[[40, 87], [40, 66], [39, 54], [38, 42]]]
		: [[[40, 87], [40, 58], [32, 40], [29, 26]], [[40, 87], [41, 56], [49, 36], [52, 19]]];
	k.s(CC.stem, 1.3, P.map(cub).join(""));
	for (const y of [82, 74, 66]) pr(40, y, 14 - (82 - y) / 6);
	for (const p of P) for (const [x, y] of along(p, [0.55, 0.75])) pr(x, y, 9);
	if (leafy) return k.f(CC.sepal, lensD(38, 44, -95, 8, 1.4) + lensD(38, 44, -80, 7, 1.2)).f(CC.petal, lensD(38, 42, -90, 4, 1)).toString();
	cockle(k, 29, 26, 1);
	cockle(k, 52, 19, 1.1);
	return k.toString();
}

/* ---------- 25. Snake's head fritillary ---------- */
const FR = { leaf: "#7f9a78", stem: "#6f8a5e", a: "#b77aa6", d: "#5e2858", w: "#ebe5e0", wd: "#8f9f78" };
function lantern(x: number, y: number, deg: number, s: number, base: string, dark: string): string {
	const body = `M-2 0C-4.6 .8-6 2.8-6 6L-5.6 11.6C-4.4 13.8 4.4 13.8 5.6 11.6L6 6C6 2.8 4.6 .8 2 0Z`;
	let ch = "";
	for (let r = 0; r < 6; r++) {
		const yy = 1.4 + r * 2;
		const half = r === 0 ? 3.6 : 5.4;
		for (let c = -3; c < 3; c++) {
			if ((r + c + 10) % 2) continue;
			const xx = c * 2;
			if (xx < -half || xx + 2 > half) continue;
			ch += `M${xx} ${f(yy)}h2v2h-2z`;
		}
	}
	return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(deg)}) scale(${f(s)})"><path d="${body}" fill="${base}"/><path d="${ch}" fill="${dark}" opacity=".85"/></g>`;
}
function fritillary(stage: GrowingStage): string {
	const k = new Ink();
	const lv = (x: number, y: number, a: number, l: number) => k.f(FR.leaf, leafD(x, y, a, l, 1.1, 1));
	if (stage === "sprout") return lv(40, 86, -100, 15), lv(40, 86, -75, 12), lv(40, 86, -125, 10), k.toString();
	const leafy = stage === "leafy";
	const P: P4 = leafy ? [[40, 87], [40, 64], [42, 48], [47, 46]] : [[40, 87], [40, 52], [44, 24], [52, 26]];
	k.s(FR.stem, 1.3, cub(P));
	lv(40, 86, -115, 18);
	lv(40, 86, -70, 16);
	for (const [i, [x, y]] of along(P, [0.3, 0.5, 0.68]).entries()) lv(x, y, i % 2 ? -50 : -130, 13 - i * 2);
	if (leafy) return k.f(FR.a, ovalD(48, 50, 2, 3.4, -10)).toString();
	const Q: P4 = [[40, 87], [38, 66], [28, 52], [24, 48]];
	k.s(FR.stem, 1.1, cub(Q));
	lv(31, 60, -150, 9);
	return k.toString() + lantern(52.4, 26, -10, 1.05, FR.a, FR.d) + lantern(23.6, 48, 12, 0.75, FR.w, FR.wd);
}

export const SPECIES: Species[] = [
	{ id: "oxeye-daisy", name: "Oxeye daisy", draw: oxeye },
	{ id: "red-clover", name: "Red clover", draw: redClover },
	{ id: "white-clover", name: "White clover", draw: whiteClover },
	{ id: "meadow-buttercup", name: "Meadow buttercup", draw: buttercup },
	{ id: "cowslip", name: "Cowslip", draw: cowslip },
	{ id: "primrose", name: "Primrose", draw: primrose },
	{ id: "field-scabious", name: "Field scabious", draw: scabious },
	{ id: "red-campion", name: "Red campion", draw: campion },
	{ id: "ragged-robin", name: "Ragged robin", draw: raggedRobin },
	{ id: "meadow-cranesbill", name: "Meadow cranesbill", draw: cranesbill },
	{ id: "birds-foot-trefoil", name: "Bird's-foot trefoil", draw: trefoilPlant },
	{ id: "yarrow", name: "Yarrow", draw: yarrow },
	{ id: "common-knapweed", name: "Common knapweed", draw: knapweed },
	{ id: "ladys-bedstraw", name: "Lady's bedstraw", draw: bedstraw },
	{ id: "meadowsweet", name: "Meadowsweet", draw: meadowsweet },
	{ id: "yellow-rattle", name: "Yellow rattle", draw: rattle },
	{ id: "vipers-bugloss", name: "Viper's bugloss", draw: bugloss },
	{ id: "queen-annes-lace", name: "Queen Anne's lace", draw: queenAnne },
	{ id: "dandelion", name: "Dandelion", draw: dandelion },
	{ id: "tufted-vetch", name: "Tufted vetch", draw: vetch },
	{ id: "selfheal", name: "Selfheal", draw: selfheal },
	{ id: "harebell", name: "Harebell", draw: harebell },
	{ id: "corn-marigold", name: "Corn marigold", draw: cornMarigold },
	{ id: "corncockle", name: "Corncockle", draw: corncockle },
	{ id: "snakes-head-fritillary", name: "Snake's head fritillary", draw: fritillary },
];
