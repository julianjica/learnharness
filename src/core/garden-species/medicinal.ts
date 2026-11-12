/**
 * Garden species, family: medicinal plants. Each draws sprout, leafy and
 * bloom in the kit's flat style (see kit.ts); the kit draws soil and seed.
 * Shapes of one colour are merged into one <path> (see Ink) and dots are
 * zero-length round-capped strokes, to keep the markup small.
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

/** The tangent angle (degrees) of a cubic at t. */
function tan(p: P4, t: number): number {
	const [x1, y1] = bez(p, Math.max(0, t - 0.02));
	const [x2, y2] = bez(p, Math.min(1, t + 0.02));
	return Math.atan2(y2 - y1, x2 - x1) / RAD;
}

/** Opposite (or alternate) leaves along a stem, shrinking towards the tip. */
function pairs(k: Ink, P: P4, ts: readonly number[], len: number, w: number, fill: string, spread = 60, shape: 0 | 1 | 2 | 4 = 0, alt = false, shrink = 0.4, tag = ""): void {
	let d = "";
	for (const [i, t] of ts.entries()) {
		const [x, y] = bez(P, t);
		const a = tan(P, t);
		const l = len * (1 - shrink * t);
		if (!alt || i % 2 === 0) d += leafD(x, y, a - spread, l, w * (1 - shrink * t * 0.6), shape);
		if (!alt || i % 2 === 1) d += leafD(x, y, a + spread, l, w * (1 - shrink * t * 0.6), shape);
	}
	k.f(fill, d, tag);
}

/** A palmate fan of toothed leaflets from (x, y). */
function palm(k: Ink, x: number, y: number, deg: number, len: number, fill: string, n = 5, spread = 140, w = 0.3, tag = ""): void {
	let d = "";
	for (let i = 0; i < n; i++) {
		const a = deg - spread / 2 + (spread * i) / (n - 1);
		const l = len * (1 - 0.45 * Math.abs(i - (n - 1) / 2) / ((n - 1) / 2));
		d += toothD(x, y, a, l, l * w, 4, 0.15, 0.4);
	}
	k.f(fill, d, tag);
}

/** A ternate compound leaf: rib with a pair of toothed leaflets and a three-leaflet end. */
function ternate(k: Ink, x: number, y: number, deg: number, len: number, ll: number, fill: string, rib: string, tag = ""): void {
	const q = at(x, y, deg, len);
	const m = at(x, y, deg, len * 0.5);
	k.s(rib, 0.8, seg(x, y, q[0], q[1]), "rib");
	let d = toothD(m[0], m[1], deg - 55, ll * 0.8, ll * 0.3, 3, 0.3) + toothD(m[0], m[1], deg + 55, ll * 0.8, ll * 0.3, 3, 0.3);
	for (const a of [-40, 0, 40]) d += toothD(q[0], q[1], deg + a, a ? ll * 0.85 : ll, ll * 0.32, 3, 0.3);
	k.f(fill, d, tag);
}

/** A strap-petal daisy head: shade ring, petal ring, eye. */
function daisy(k: Ink, x: number, y: number, n: number, r0: number, r1: number, w: number, petal: string, shade: string, eye: string, eyeR: number, tag = ""): void {
	k.s(shade, w, rays(x, y, n, r0, r1 * 0.94, 180 / n), "sh" + tag).s(petal, w, rays(x, y, n, r0, r1), "pe" + tag).f(eye, dotD(x, y, eyeR), "ey" + tag);
}

/** A scalloped kidney leaf of radius r whose notch faces deg. */
function kidneyD(x: number, y: number, r: number, deg: number): string {
	const n = 9;
	let d = `M${f(x)} ${f(y)}`;
	for (let i = 0; i <= n; i++) {
		const a = deg + 28 + (304 * i) / n;
		const [px, py] = at(x, y, a, r);
		if (i === 0) d += `L${f(px)} ${f(py)}`;
		else {
			const [cx, cy] = at(x, y, a - 152 / n, r * 1.22);
			d += `Q${f(cx)} ${f(cy)} ${f(px)} ${f(py)}`;
		}
	}
	return d + "Z";
}

const DK = GREEN.dark;

/* ---------- 1. St John's wort ---------- */
const SJ = { leaf: "#5e9a46", petal: "#f4c51c", stam: "#c98a0c", eye: "#e0861a", bud: "#e9a91a" };
function sjFlower(k: Ink, x: number, y: number, r: number): void {
	k.s(SJ.petal, r * 0.78, rays(x, y, 5, r * 0.3, r * 0.68, x * 7), "p").s(SJ.stam, 0.4, rays(x, y, 8, 0.5, r * 0.95, x * 5), "st");
}
function stJohnsWort(stage: GrowingStage): string {
	const k = new Ink();
	if (stage === "sprout") {
		const P: P4 = [[40, 87], [40, 80], [40, 74], [40, 67]];
		k.s(DK, 1.3, cub(P));
		pairs(k, P, [0.3, 0.6, 0.92], 5.5, 1.6, SJ.leaf, 75);
		return k.toString();
	}
	const leafy = stage === "leafy";
	const tips: XY[] = leafy ? [[31, 48], [40, 42], [49, 50]] : [[26, 34], [40, 24], [54, 32]];
	for (const [x, y] of tips) {
		const P: P4 = [[40, 87], [40, 70], [x, y + 18], [x, y]];
		k.s(DK, 1.2, cub(P), "stem");
		pairs(k, P, [0.3, 0.5, 0.7, 0.9], 6.4, 1.8, SJ.leaf, 68, 0, false, 0.35, "lf");
	}
	if (leafy) {
		k.dots(SJ.bud, 1.1, tips.map(([x, y]) => [x, y - 1.5] as const));
		return k.toString();
	}
	const fl: XY[] = [];
	for (const [x, y] of tips) {
		for (const [dx, dy] of [[0, -7], [-6.5, -1.5], [6.5, -2]] as const) {
			k.s(DK, 0.8, seg(x, y, x + dx, y + dy), "stem");
			fl.push([x + dx, y + dy]);
		}
	}
	for (const [x, y] of fl) sjFlower(k, x, y, 3.3);
	k.dots(SJ.eye, 0.8, fl, "eye");
	return k.toString();
}

/* ---------- 2. Valerian ---------- */
const VA = { leaf: "#5a9446", a: "#f4dbe3", b: "#dc9fb6", c: "#c27d98" };
function valerian(stage: GrowingStage): string {
	const k = new Ink();
	if (stage === "sprout") {
		for (const [a, l] of [[-130, 11], [-90, 13], [-50, 11]] as const) pinnate(k, 40, 86, a, l, 3, 4, 1, VA.leaf, DK);
		return k.toString();
	}
	const leafy = stage === "leafy";
	for (const [a, l] of [[-160, 16], [-125, 18], [-55, 18], [-20, 16]] as const) pinnate(k, 40, 86, a, l * (leafy ? 1 : 1.05), 4, 5, 1.2, VA.leaf, DK);
	const top = leafy ? 40 : 18;
	const P: P4 = [[40, 86], [40, 70], [41, 50], [40, top]];
	k.s(DK, 1.5, cub(P), "stem");
	for (const t of leafy ? [0.4, 0.75] : [0.3, 0.55]) {
		const [x, y] = bez(P, t);
		pinnate(k, x, y, -150, 11 - t * 4, 3, 4, 1, VA.leaf, DK);
		pinnate(k, x, y, -30, 11 - t * 4, 3, 4, 1, VA.leaf, DK);
	}
	if (leafy) return k.f(VA.leaf, dotD(40, top - 1, 2.2)).toString();
	const heads: (readonly [number, number, number])[] = [[29, 22, 6.5], [40, 13, 7.5], [51, 21, 6.5]];
	let sd = "";
	for (const [x, y] of heads) sd += cub([[40, 40], [40, 32], [x, y + 8], [x, y + 3]]);
	k.s(DK, 1, sd, "stem");
	for (const [hi, [x, y, r]] of heads.entries()) {
		k.f(VA.c, `M${f(x - r)} ${f(y + 2)}A${f(r)} ${f(r * 0.8)} 0 0 1 ${f(x + r)} ${f(y + 2)}Z`, "dome");
		const a: XY[] = [];
		const b: XY[] = [];
		for (let i = 0; i < 18; i++) {
			const ang = -180 + rnd(i + hi * 30) * 180;
			const rr = r * Math.sqrt(rnd(i * 3 + hi)) * 0.9;
			const pt = at(x, y + 2, ang, rr);
			(i % 3 ? a : b).push([pt[0], pt[1] * 0.85 + (y + 2) * 0.15]);
		}
		k.dots(VA.b, 1.2, b, "b").dots(VA.a, 1.15, a, "a");
	}
	return k.toString();
}

/* ---------- 3. Feverfew ---------- */
const FF = { leaf: "#8db548", dark: "#5f8a32", petal: "#fbfaf3", shade: "#b9b4a0", eye: "#f1c31f" };
function feverfew(stage: GrowingStage): string {
	const k = new Ink();
	if (stage === "sprout") {
		for (const a of [-140, -95, -45]) k.f(FF.leaf, toothD(40, 86, a, 10, 3.2, 3, 0.55, 0.2));
		return k.toString();
	}
	const leafy = stage === "leafy";
	const tips: XY[] = leafy ? [[28, 50], [36, 44], [45, 45], [53, 51]] : [[20, 40], [29, 30], [40, 26], [51, 29], [60, 38]];
	for (const [x, y] of tips) {
		const P: P4 = [[40, 86], [40, 72], [x, y + 18], [x, y]];
		k.s(FF.dark, 1.1, cub(P), "stem");
		for (const [i, t] of [0.4, 0.72].entries()) {
			const [px, py] = bez(P, t);
			k.f(FF.leaf, toothD(px, py, tan(P, t) + (i % 2 ? 60 : -60), 9 - i * 1.5, 2.6, 3, 0.55, 0.2), "lf");
		}
	}
	for (const a of [-170, -140, -40, -10]) k.f(FF.leaf, toothD(40, 86, a, 12, 3.4, 3, 0.55, 0.2), "lf");
	if (leafy) return k.dots(FF.dark, 1.3, tips).dots(FF.petal, 0.6, tips).toString();
	const heads: XY[] = [];
	for (const [x, y] of tips) heads.push([x, y - 2], [x - 5, y + 3], [x + 5, y + 2.5]);
	const use = heads.filter((_, i) => i % 3 !== 2 && i !== 7);
	for (const [x, y] of use) k.s(FF.dark, 0.7, seg(x, y, x, y + 4), "stem");
	for (const [x, y] of use) daisy(k, x, y, 9, 2, 4.4, 1.8, FF.petal, FF.shade, FF.eye, 2.2);
	return k.toString();
}

/* ---------- 4. Pot marigold ---------- */
const PM = { leaf: "#7cae56", rib: "#56853a", a: "#f28a16", b: "#f8a930", c: "#d86e0e", eye: "#8e4a12" };
function potMarigold(stage: GrowingStage): string {
	const k = new Ink();
	const lv = (x: number, y: number, a: number, l: number, w: number) => k.f(PM.leaf, leafD(x, y, a, l, w, 0), "lf").s(PM.rib, 0.6, ribD(x, y, a, l), "rib");
	if (stage === "sprout") {
		lv(40, 86, -135, 11, 3);
		lv(40, 86, -45, 11, 3);
		lv(40, 86, -92, 9, 2.6);
		return k.toString();
	}
	const leafy = stage === "leafy";
	const heads: XY[] = leafy ? [[34, 50], [47, 47]] : [[26, 40], [43, 27], [57, 41]];
	for (const [x, y] of heads) {
		const P: P4 = [[40, 86], [40, 70], [x, y + 16], [x, y]];
		k.s(PM.rib, 1.5, cub(P), "stem");
		for (const [i, t] of [0.4, 0.65].entries()) {
			const [px, py] = bez(P, t);
			lv(px, py, tan(P, t) + (i % 2 ? 55 : -55), 10 - i * 2, 2.6);
		}
	}
	for (const a of [-165, -130, -50, -15]) lv(40, 86, a, 14, 3.4);
	if (leafy) {
		for (const [x, y] of heads) k.f(PM.leaf, dotD(x, y, 3), "bud").f(PM.a, `M${f(x - 2)} ${f(y - 1)}Q${f(x)} ${f(y - 5)} ${f(x + 2)} ${f(y - 1)}Z`, "budc");
		return k.toString();
	}
	for (const [x, y] of heads) {
		k.s(PM.c, 2.4, rays(x, y, 16, 3, 9.6, 11), "c").s(PM.a, 2.4, rays(x, y, 16, 3, 9.8), "a").s(PM.b, 1.9, rays(x, y, 13, 2.6, 6.4, 7), "b");
		k.f(PM.eye, dotD(x, y, 3.2), "eye");
	}
	return k.toString();
}

/* ---------- 5. Comfrey ---------- */
const CF = { leaf: "#4f8b3e", vein: "#36672b", a: "#7e3f8c", b: "#a868b4", cal: "#5f8a46" };
function comfreyLeaf(k: Ink, x: number, y: number, a: number, l: number, w: number): void {
	const q = tf(x, y, a);
	k.f(CF.leaf, leafD(x, y, a, l, w, 1), "lf");
	let d = `M${q(l * 0.05, 0)}L${q(l * 0.9, 0)}`;
	for (const t of [0.3, 0.55]) d += `M${q(l * t, 0)}L${q(l * (t + 0.12), -w * 0.45)}M${q(l * t, 0)}L${q(l * (t + 0.12), w * 0.45)}`;
	k.s(CF.vein, 0.6, d, "vein");
}
function comfrey(stage: GrowingStage): string {
	const k = new Ink();
	if (stage === "sprout") {
		comfreyLeaf(k, 40, 86, -125, 14, 4);
		comfreyLeaf(k, 40, 86, -60, 15, 4.2);
		return k.toString();
	}
	const leafy = stage === "leafy";
	const top = leafy ? 46 : 26;
	const P: P4 = [[40, 86], [40, 70], [41, 46], [40, top]];
	k.s(CF.vein, 2.2, cub(P), "stem");
	for (const [a, l] of [[-170, 22], [-140, 25], [-40, 25], [-10, 22]] as const) comfreyLeaf(k, 40, 86, a, l * (leafy ? 0.9 : 1), 6.4);
	for (const [i, t] of [0.35, 0.6, 0.82].entries()) {
		const [x, y] = bez(P, t);
		comfreyLeaf(k, x, y, i % 2 ? -25 : -155, 15 - i * 3, 4);
	}
	if (leafy) return k.f(CF.cal, dotD(40, top - 1, 2.6)).toString();
	for (const s of [-1, 1]) {
		const x0 = 40;
		const y0 = top;
		const ex = x0 + s * 13;
		k.s(CF.vein, 1.2, `M${x0} ${y0}Q${f(x0 + s * 8)} ${f(y0 - 10)} ${f(ex)} ${f(y0 - 2)}Q${f(ex + s * 3)} ${f(y0 + 2)} ${f(ex + s * 1)} ${f(y0 + 5)}`, "stem");
		const bells: (readonly [number, number, number])[] = [[x0 + s * 4, y0 - 4, 0], [x0 + s * 8, y0 - 5.5, 1], [x0 + s * 12, y0 - 2.5, 0], [x0 + s * 14.5, y0 + 2.5, 1], [x0 + s * 13, y0 + 6, 0]];
		for (const [x, y, c] of bells) k.f(CF.cal, lensD(x, y, 90, 3, 1.2), "cal").f(c ? CF.b : CF.a, `M${f(x - 1.7)} ${f(y + 1.5)}L${f(x - 2)} ${f(y + 7)}Q${f(x)} ${f(y + 8.4)} ${f(x + 2)} ${f(y + 7)}L${f(x + 1.7)} ${f(y + 1.5)}Z`, c ? "b" : "a");
	}
	k.f(CF.a, ovalD(40, top - 1.5, 1.8, 2.6), "a");
	return k.toString();
}

/* ---------- 6. Elecampane ---------- */
const EL = { leaf: "#6a9e4c", rib: "#466f33", ray: "#f3c21b", shade: "#d79c10", eye: "#b9781a", eyeD: "#8d5714" };
function elecampane(stage: GrowingStage): string {
	const k = new Ink();
	const big = (x: number, y: number, a: number, l: number, w: number) => k.f(EL.leaf, toothD(x, y, a, l, w, 6, 0.08, 0.3), "lf").s(EL.rib, 0.7, ribD(x, y, a, l), "rib");
	if (stage === "sprout") {
		big(40, 86, -120, 15, 3.8);
		big(40, 86, -65, 17, 4);
		return k.toString();
	}
	const leafy = stage === "leafy";
	if (leafy) {
		for (const [a, l] of [[-165, 25], [-135, 30], [-100, 34], [-70, 32], [-40, 28], [-12, 24]] as const) big(40, 86, a, l, 6.2);
		return k.toString();
	}
	const heads: XY[] = [[27, 17], [42, 11], [55, 21]];
	for (const [x, y] of heads) k.s(EL.rib, 1.6, cub([[40, 86], [40, 50], [x, y + 20], [x, y]]), "stem");
	for (const [a, l] of [[-170, 24], [-140, 28], [-40, 28], [-10, 24]] as const) big(40, 86, a, l, 6);
	for (const [i, y] of [66, 52, 40].entries()) big(40, y, i % 2 ? -30 : -150, 14 - i * 2.5, 4);
	for (const [x, y] of heads) {
		k.s(EL.shade, 0.8, rays(x, y, 30, 3.5, 9.2, 6), "sh").s(EL.ray, 0.8, rays(x, y, 30, 3.5, 10), "ray");
		k.f(EL.eye, dotD(x, y, 4), "eye").f(EL.eyeD, `M${f(x - 3.4)} ${f(y + 1.6)}Q${f(x)} ${f(y + 5.4)} ${f(x + 3.4)} ${f(y + 1.6)}Q${f(x)} ${f(y + 3)} ${f(x - 3.4)} ${f(y + 1.6)}Z`, "eyeD");
	}
	return k.toString();
}

/* ---------- 7. Marshmallow ---------- */
const MM = { leaf: "#94ad88", rib: "#6d8562", a: "#f4d5dc", b: "#d998aa", eye: "#b4607c" };
function mmLeaf(k: Ink, x: number, y: number, a: number, l: number): void {
	k.f(MM.leaf, toothD(x, y, a, l, l * 0.45, 4, 0.1, 0.2) + leafD(x, y, a - 30, l * 0.6, l * 0.22), "lf").s(MM.rib, 0.6, ribD(x, y, a, l), "rib");
}
function marshmallow(stage: GrowingStage): string {
	const k = new Ink();
	if (stage === "sprout") {
		k.s(MM.rib, 1.3, seg(40, 87, 40, 72));
		mmLeaf(k, 40, 78, -150, 8);
		mmLeaf(k, 40, 73, -40, 9);
		return k.toString();
	}
	const leafy = stage === "leafy";
	const stems: P4[] = leafy ? [[[40, 87], [40, 70], [39, 55], [38, 40]]] : [[[40, 87], [39, 62], [33, 36], [32, 10]], [[40, 87], [42, 62], [48, 40], [49, 17]]];
	for (const P of stems) k.s(MM.rib, 1.5, cub(P), "stem");
	for (const P of stems) {
		for (const [i, t] of [0.15, 0.35, 0.55, 0.75].entries()) {
			const [x, y] = bez(P, t);
			mmLeaf(k, x, y, tan(P, t) + (i % 2 ? 60 : -60), 13 - t * 7);
		}
	}
	if (leafy) return k.toString();
	const fl: XY[] = [];
	for (const P of stems) for (const [i, t] of [0.6, 0.73, 0.86, 1].entries()) {
		const [x, y] = bez(P, t);
		fl.push([x + (i % 2 ? 3.5 : -3.5), y]);
	}
	let pa = "";
	for (const [x, y] of fl) pa += rays(x, y, 5, 1.3, 2.9, x * 3);
	k.s(MM.a, 3.2, pa, "pa").dots(MM.b, 1.4, fl, "b").dots(MM.eye, 0.7, fl, "eye");
	return k.toString();
}

/* ---------- 8. Ginseng ---------- */
const GS = { leaf: "#5d9b47", rib: "#3f7232", berry: "#d42a2e", hi: "#f07a6e", stalk: "#6d8a3e" };
function ginseng(stage: GrowingStage): string {
	const k = new Ink();
	if (stage === "sprout") {
		k.s(GS.rib, 1.2, cub([[40, 87], [40, 81], [40, 77], [40, 73]]));
		palm(k, 40, 73, -90, 8, GS.leaf, 3, 100, 0.34);
		return k.toString();
	}
	const leafy = stage === "leafy";
	const top = leafy ? 60 : 52;
	k.s(GS.rib, 1.5, seg(40, 87, 40, top), "stem");
	const s = leafy ? 1 : 1.15;
	for (const a of leafy ? [-160, -90, -20] : [-165, -118, -62, -15]) {
		const [ex, ey] = at(40, top, a, 8 * s);
		k.s(GS.rib, 1, seg(40, top, ex, ey), "stem");
		palm(k, ex, ey, a + (a === -90 ? 0 : a < -90 ? 12 : -12), (leafy ? 12 : 11) * s, GS.leaf, 5, 150, 0.3, "lf");
	}
	if (leafy) return k.toString();
	k.s(GS.stalk, 0.9, seg(40, top, 40, 27), "stalk");
	const bs: XY[] = [];
	for (let i = 0; i < 9; i++) bs.push(at(40, 27, -170 + i * 20, i % 2 ? 6 : 5));
	let sp = "";
	for (const [x, y] of bs) sp += seg(40, 27, x, y);
	k.s(GS.stalk, 0.5, sp, "stalk");
	k.dots(GS.berry, 1.7, bs).dots(GS.hi, 0.6, bs.map(([x, y]) => [x - 0.6, y - 0.7] as const));
	return k.toString();
}

/* ---------- 9. Goldenseal ---------- */
const GD = { leaf: "#5c9645", vein: "#3d6f30", fruit: "#b8203a", hi: "#e0566a", stem: "#7c6a3e" };
function gdLeaf(k: Ink, x: number, y: number, deg: number, r: number): void {
	let d = "";
	let v = "";
	for (const a of [-72, -36, 0, 36, 72]) {
		const l = r * (1 - Math.abs(a) / 220);
		d += leafD(x, y, deg + a, l, l * 0.36, 0);
		v += ribD(x, y, deg + a, l);
	}
	k.f(GD.leaf, d, "lf").s(GD.vein, 0.6, v, "vein");
}
function goldenseal(stage: GrowingStage): string {
	const k = new Ink();
	if (stage === "sprout") {
		k.s(GD.stem, 1.2, seg(40, 87, 40, 76));
		gdLeaf(k, 40, 76, -90, 8);
		return k.toString();
	}
	const leafy = stage === "leafy";
	const fy = leafy ? 62 : 58;
	k.s(GD.stem, 1.6, `M40 87L40 ${fy}M40 ${fy}Q32 ${fy - 2} 28 ${fy - 8}M40 ${fy}Q49 ${fy - 1} 53 ${fy - 7}`, "stem");
	gdLeaf(k, 28, fy - 8, -115, leafy ? 13 : 16);
	gdLeaf(k, 53, fy - 7, -65, leafy ? 11 : 13);
	if (leafy) return k.f("#e8ecd6", dotD(40, fy - 4, 1.8)).toString();
	k.s(GD.stem, 1, seg(40, fy, 40, 37), "stem");
	const dr: XY[] = [];
	const y0 = 32;
	for (let j = 0; j < 4; j++) for (let i = -2; i <= 2; i++) {
		const xx = 40 + i * 2.2 + (j % 2) * 1.1;
		const yy = y0 + 4 - j * 2.4;
		if (Math.hypot((xx - 40) / 5.2, (yy - y0) / 5.5) <= 1) dr.push([xx, yy]);
	}
	k.f(GD.fruit, ovalD(40, y0, 5, 5.6, 90), "fr").dots(GD.hi, 0.7, dr, "hi");
	k.f(GD.leaf, lensD(40, y0 + 5.5, 150, 3.5, 1.2) + lensD(40, y0 + 5.5, 30, 3.5, 1.2), "lf");
	return k.toString();
}

/* ---------- 10. Milk thistle ---------- */
const MT = { leaf: "#4c8b49", marb: "#e4efe0", spine: "#d8d39a", bract: "#5d8c48", bD: "#3f6a33", a: "#9d3b8b", b: "#c262ad" };
function mtLeaf(k: Ink, x: number, y: number, a: number, l: number, w: number): void {
	const q = tf(x, y, a);
	k.f(MT.leaf, toothD(x, y, a, l, w, 5, 0.42, 0.45), "lf");
	let d = `M${q(l * 0.05, 0)}L${q(l * 0.85, 0)}`;
	for (const t of [0.35, 0.6]) d += `M${q(l * t, 0)}L${q(l * (t + 0.08), -w * 0.4)}M${q(l * t, 0)}L${q(l * (t + 0.08), w * 0.4)}`;
	k.s(MT.marb, 0.7, d, "marb");
}
function milkThistle(stage: GrowingStage): string {
	const k = new Ink();
	if (stage === "sprout") {
		mtLeaf(k, 40, 86, -140, 12, 3.6);
		mtLeaf(k, 40, 86, -40, 12, 3.6);
		return k.toString();
	}
	const leafy = stage === "leafy";
	const heads: XY[] = leafy ? [] : [[30, 26], [49, 18]];
	for (const [x, y] of heads) k.s(MT.bD, 1.8, cub([[40, 86], [40, 60], [x, y + 20], [x, y]]), "stem");
	for (const [a, l] of [[-172, 22], [-140, 26], [-110, 22], [-70, 24], [-38, 26], [-8, 22]] as const) mtLeaf(k, 40, 86, a, l * (leafy ? 1 : 0.95), 6);
	if (leafy) return k.toString();
	mtLeaf(k, 38, 56, -150, 12, 3.4);
	mtLeaf(k, 43, 48, -30, 11, 3.2);
	for (const [x, y] of heads) {
		k.s(MT.b, 1.2, rays(x, y - 3, 13, 1, 9.5, -180 + 0), "b");
		let br = "";
		for (let i = 0; i < 9; i++) br += lensD(x, y + 2, -170 + i * 20, 6.8, 0.6);
		k.s(MT.a, 1.4, (() => {
			let d = "";
			for (let i = 0; i < 9; i++) {
				const [ex, ey] = at(x, y - 2, -150 + i * 15, 8);
				d += seg(x, y - 1, ex, ey);
			}
			return d;
		})(), "a");
		k.f(MT.spine, br, "spine").f(MT.bract, ovalD(x, y + 2, 5, 4.6), "bract");
		const sc: XY[] = [];
		for (const [i, j] of [[-2.5, 0.5], [0, 0], [2.5, 0.5], [-1.2, 2.6], [1.2, 2.6], [0, 4.6], [-3, 3], [3, 3]] as const) sc.push([x + i, y + 1 + j]);
		k.dots(MT.bD, 0.7, sc, "sc");
	}
	return k.toString();
}

/* ---------- 11. Great mullein ---------- */
const GM = { leaf: "#a3b78a", hi: "#c3d2a9", rib: "#7d8f68", spike: "#8fa27a", fl: "#f3d230", eye: "#d79a12" };
function mullein(stage: GrowingStage): string {
	const k = new Ink();
	const big = (x: number, y: number, a: number, l: number, w: number) => k.f(GM.leaf, leafD(x, y, a, l, w, 0), "lf").s(GM.hi, 0.9, ribD(x, y, a, l), "rib");
	if (stage === "sprout") {
		for (const a of [-160, -110, -70, -20]) big(40, 86, a, 10, 3.6);
		return k.toString();
	}
	const leafy = stage === "leafy";
	if (leafy) {
		for (const a of [-178, -150, -122, -58, -30, -2]) big(40, 86, a, 22, 6.4);
		for (const a of [-110, -90, -70]) big(40, 86, a, 15, 5);
		return k.toString();
	}
	for (const a of [-178, -152, -28, -2]) big(40, 86, a, 22, 6.4);
	k.f(GM.spike, `M37 84L37.2 30Q38.4 6 40 5Q41.6 6 42.8 30L43 84Z`, "sp");
	for (const [i, y] of [76, 68, 60, 52].entries()) big(40, y, i % 2 ? -40 : -140, 14 - i * 2.5, 4.2 - i * 0.6);
	const fl: XY[] = [];
	for (let i = 0; i < 22; i++) {
		const y = 50 - i * 1.95;
		const half = 2.8 - i * 0.07;
		fl.push([40 + Math.sin(i * 2.4) * half, y]);
	}
	k.dots(GM.fl, 2.1, fl, "fl").dots(GM.eye, 0.55, fl, "eye");
	return k.toString();
}

/* ---------- 12. Broadleaf plantain ---------- */
const BP = { leaf: "#5c9a45", vein: "#8cc46a", spike: "#7c8a4a", st: "#e4dcb2", stalk: "#6b8a40" };
function bpLeaf(k: Ink, a: number, l: number, w: number): void {
	const pet = l * 0.3;
	const [bx, by] = at(40, 86, a, pet);
	const q = tf(bx, by, a);
	const L = l - pet;
	k.s(BP.stalk, 1.2, seg(40, 86, bx, by), "pet").f(BP.leaf, leafD(bx, by, a, L, w, 2), "lf");
	k.s(BP.vein, 0.5, `M${q(0, 0)}L${q(L * 0.9, 0)}M${q(0, 0)}Q${q(L * 0.45, -w * 0.9)} ${q(L * 0.9, -w * 0.15)}M${q(0, 0)}Q${q(L * 0.45, w * 0.9)} ${q(L * 0.9, w * 0.15)}`, "vein");
}
function plantain(stage: GrowingStage): string {
	const k = new Ink();
	if (stage === "sprout") {
		bpLeaf(k, -125, 12, 3.4);
		bpLeaf(k, -60, 13, 3.6);
		return k.toString();
	}
	const leafy = stage === "leafy";
	const spikes: (readonly [number, number])[] = leafy ? [] : [[30, 30], [37, 24], [45, 27], [52, 34]];
	for (const [x, y] of spikes) {
		k.s(BP.stalk, 1, cub([[40, 85], [40, 70], [x, y + 20], [x, y]]), "stalk");
	}
	for (const [a, l] of [[-175, 20], [-150, 22], [-120, 21], [-60, 22], [-30, 22], [-5, 20], [-92, 17]] as const) bpLeaf(k, a, l * (leafy ? 0.95 : 1), 6.2);
	if (leafy) return k.toString();
	for (const [x, y] of spikes) {
		k.s(BP.spike, 2.6, seg(x, y, x - (x - 40) * 0.08, y - 18), "spike");
		const st: XY[] = [];
		for (let i = 0; i < 7; i++) st.push([x - (x - 40) * 0.08 * (i / 7) + (i % 2 ? 1.6 : -1.6), y - 2 - i * 2.4]);
		k.dots(BP.st, 0.55, st, "st");
	}
	return k.toString();
}

/* ---------- 13. Licorice ---------- */
const LI = { leaf: "#6aa04f", rib: "#467a35", a: "#9a8fd0", b: "#c3b9ea", pod: "#8a5a3a" };
function licorice(stage: GrowingStage): string {
	const k = new Ink();
	if (stage === "sprout") {
		k.s(LI.rib, 1.2, seg(40, 87, 40, 76));
		pinnate(k, 40, 76, -90, 10, 3, 3.4, 1.4, LI.leaf, LI.rib, true, 1);
		return k.toString();
	}
	const leafy = stage === "leafy";
	const stems: P4[] = leafy ? [[[40, 87], [39, 72], [36, 56], [34, 46]], [[40, 87], [42, 72], [46, 58], [48, 50]]] : [[[40, 87], [38, 66], [30, 46], [26, 28]], [[40, 87], [40, 64], [41, 40], [40, 22]], [[40, 87], [43, 66], [50, 46], [55, 30]]];
	for (const P of stems) k.s(LI.rib, 1.4, cub(P), "stem");
	for (const P of stems) {
		for (const [i, t] of (leafy ? [0.3, 0.55, 0.8] : [0.3, 0.5, 0.75]).entries()) {
			const [x, y] = bez(P, t);
			pinnate(k, x, y, tan(P, t) + (i % 2 ? 55 : -55), 11 - i * 1.5, 3, 3.2, 1.3, LI.leaf, LI.rib, true, 1);
		}
	}
	if (leafy) return k.toString();
	for (const P of stems) {
		const [x, y] = bez(P, 1);
		const a: XY[] = [];
		const b: XY[] = [];
		for (let i = 0; i < 7; i++) {
			const yy = y - i * 1.9;
			const w = 2 - i * 0.22;
			a.push([x - w, yy], [x + w, yy]);
			b.push([x, yy - 0.8]);
		}
		k.s(LI.rib, 0.8, seg(x, y + 2, x, y - 13), "stem").dots(LI.a, 1.2, a, "a").dots(LI.b, 0.9, b, "b");
		const [px, py] = bez(P, 0.62);
		const s = x < 40 ? -1 : 1;
		k.f(LI.pod, lensD(px, py, 90 - s * 40, 7, 1.1) + lensD(px, py, 90 - s * 15, 6, 1), "pod");
	}
	return k.toString();
}

/* ---------- 14. Ashwagandha ---------- */
const AW = { leaf: "#7f9c62", rib: "#5a7445", husk: "#d6b97a", huskD: "#b09058", berry: "#de4a26", hi: "#f3876a", stem: "#6f7a52" };
function ashwagandha(stage: GrowingStage): string {
	const k = new Ink();
	const lv = (x: number, y: number, a: number, l: number) => k.f(AW.leaf, leafD(x, y, a, l, l * 0.38, 0), "lf").s(AW.rib, 0.6, ribD(x, y, a, l), "rib");
	if (stage === "sprout") {
		k.s(AW.stem, 1.3, seg(40, 87, 40, 72));
		lv(40, 76, -150, 9);
		lv(40, 72, -40, 9);
		return k.toString();
	}
	const leafy = stage === "leafy";
	const stems: P4[] = leafy ? [[[40, 87], [40, 72], [34, 58], [30, 46]], [[40, 87], [41, 70], [46, 56], [50, 44]]] : [[[40, 87], [39, 70], [28, 54], [20, 38]], [[40, 87], [40, 64], [38, 44], [38, 24]], [[40, 87], [42, 68], [52, 52], [60, 36]]];
	for (const P of stems) k.s(AW.stem, 1.8, cub(P), "stem");
	const hs: XY[] = [];
	for (const P of stems) {
		for (const [i, t] of [0.3, 0.48, 0.66, 0.84, 1].entries()) {
			const [x, y] = bez(P, t);
			const side = i % 2 ? 1 : -1;
			lv(x, y, tan(P, t) + side * 55, 11 - t * 3);
			if (!leafy && t > 0.4) hs.push([x - side * 3.5, y + 4]);
		}
	}
	if (leafy) return k.toString();
	for (const [i, [x, y]] of hs.entries()) {
		k.s(AW.stem, 0.6, seg(x, y - 3.2, x, y - 1.5), "ped");
		if (i % 3 === 1) {
			k.f(AW.husk, `M${f(x - 3)} ${f(y)}Q${f(x - 4)} ${f(y + 4)} ${f(x - 1)} ${f(y + 5)}L${f(x)} ${f(y - 1.5)}Z M${f(x + 3)} ${f(y)}Q${f(x + 4)} ${f(y + 4)} ${f(x + 1)} ${f(y + 5)}L${f(x)} ${f(y - 1.5)}Z`, "husk").dots(AW.berry, 2.2, [[x, y + 2.8]], "berry").dots(AW.hi, 0.6, [[x - 0.8, y + 2]], "hi");
		} else {
			k.f(AW.husk, `M${f(x)} ${f(y - 1.5)}Q${f(x - 4)} ${f(y + 1)} ${f(x - 2.4)} ${f(y + 4.6)}Q${f(x)} ${f(y + 6.6)} ${f(x + 2.4)} ${f(y + 4.6)}Q${f(x + 4)} ${f(y + 1)} ${f(x)} ${f(y - 1.5)}Z`, "husk").s(AW.huskD, 0.5, `M${f(x)} ${f(y - 1)}L${f(x)} ${f(y + 5.6)}`, "hd");
		}
	}
	return k.toString();
}

/* ---------- 15. Holy basil ---------- */
const HB = { leaf: "#6e9a4e", purple: "#7a4e72", stem: "#7a3f6a", fl: "#b06aa8", cal: "#5e3558" };
function holyBasil(stage: GrowingStage): string {
	const k = new Ink();
	const lv = (x: number, y: number, a: number, l: number, purple: boolean) => k.f(purple ? HB.purple : HB.leaf, toothD(x, y, a, l, l * 0.36, 4, 0.12, 0.3), purple ? "pl" : "lf");
	if (stage === "sprout") {
		k.s(HB.stem, 1.2, seg(40, 87, 40, 72));
		lv(40, 76, -160, 8, false);
		lv(40, 76, -20, 8, false);
		lv(40, 72, -120, 5, true);
		lv(40, 72, -60, 5, true);
		return k.toString();
	}
	const leafy = stage === "leafy";
	const stems: P4[] = leafy ? [[[40, 87], [38, 72], [32, 60], [29, 48]], [[40, 87], [40, 70], [40, 56], [40, 42]], [[40, 87], [42, 72], [48, 60], [51, 48]]] : [[[40, 87], [36, 70], [26, 60], [20, 42]], [[40, 87], [38, 66], [33, 52], [32, 36]], [[40, 87], [41, 64], [44, 50], [46, 34]], [[40, 87], [44, 70], [54, 60], [60, 42]]];
	for (const P of stems) k.s(HB.stem, 1.3, cub(P), "stem");
	for (const P of stems) {
		for (const t of [0.35, 0.6, 0.85]) {
			const [x, y] = bez(P, t);
			const a = tan(P, t);
			lv(x, y, a - 65, 9 - t * 3, t > 0.7);
			lv(x, y, a + 65, 9 - t * 3, t > 0.7);
		}
	}
	if (leafy) return k.toString();
	for (const P of stems) {
		const [x, y] = bez(P, 1);
		const a = tan(P, 1);
		const [ex, ey] = at(x, y, a, 16);
		k.s(HB.stem, 0.9, seg(x, y, ex, ey), "stem");
		const fl: XY[] = [];
		const ca: XY[] = [];
		for (let i = 1; i <= 6; i++) {
			const [px, py] = at(x, y, a, i * 2.6);
			fl.push([px - 1.6, py], [px + 1.6, py]);
			ca.push([px - 0.9, py + 0.7], [px + 0.9, py + 0.7]);
		}
		k.dots(HB.cal, 1, ca, "cal").dots(HB.fl, 0.9, fl, "fl");
	}
	return k.toString();
}

/* ---------- 16. Witch hazel ---------- */
const WH = { bark: "#7a5a40", leaf: "#6f9e4f", rib: "#4a7136", fl: "#f2c230", cal: "#a8442a", old: "#e0a63a" };
function whFlower(k: Ink, x: number, y: number): void {
	let d = "";
	for (const a of [20, 110, 200, 290]) {
		const [ex, ey] = at(x, y, a + x * 3, 4.4);
		const [mx, my] = at(x, y, a + x * 3 + 18, 2.4);
		d += `M${f(x)} ${f(y)}Q${f(mx)} ${f(my)} ${f(ex)} ${f(ey)}`;
	}
	k.s(WH.fl, 0.9, d, "fl");
}
function witchHazel(stage: GrowingStage): string {
	const k = new Ink();
	const lv = (x: number, y: number, a: number, l: number, c = WH.leaf) => k.f(c, toothD(x, y, a, l, l * 0.42, 4, 0.08, 0.3), c).s(WH.rib, 0.5, ribD(x, y, a, l), "rib");
	if (stage === "sprout") {
		k.s(WH.bark, 1.5, seg(40, 87, 40, 70));
		lv(40, 74, -150, 9);
		lv(40, 70, -40, 9);
		return k.toString();
	}
	const leafy = stage === "leafy";
	const sc = leafy ? 0.62 : 1;
	const br: [number, number, number, number][] = [[40, 87, -118, 30], [40, 87, -95, 34], [40, 87, -68, 32], [40, 87, -140, 22], [40, 87, -42, 22]];
	let d = "";
	const tips: XY[] = [];
	const nodes: XY[] = [];
	for (const [x, y, a, l] of br) {
		let px = x;
		let py = y;
		const L = l * sc;
		for (let j = 0; j < 4; j++) {
			const ang = a + (j % 2 ? 12 : -12);
			const [nx, ny] = at(px, py, ang, L / 4 + (j === 0 ? 4 : 0) * sc);
			d += seg(px, py, nx, ny);
			px = nx;
			py = ny;
			if (j > 0) nodes.push([px, py]);
			if (j > 0 && !leafy) {
				const [tx, ty] = at(px, py, ang + (j % 2 ? -50 : 50), 7);
				d += seg(px, py, tx, ty);
				tips.push([tx, ty]);
			}
		}
		tips.push([px, py]);
	}
	k.s(WH.bark, 1.4, d, "bark");
	if (leafy) {
		for (const [i, [x, y]] of [...nodes, ...tips].entries()) lv(x, y, -90 + (i % 2 ? 50 : -50) + (x - 40) * 1.5, 9);
		return k.toString();
	}
	for (const [x, y] of [...nodes, ...tips]) whFlower(k, x, y);
	k.dots(WH.cal, 0.9, [...nodes, ...tips], "cal");
	return k.toString();
}

/* ---------- 17. Evening primrose ---------- */
const EP = { leaf: "#5f9a48", rib: "#b04a4a", a: "#f6e058", b: "#e6c63a", bud: "#7aa84e", budT: "#c8963a", eye: "#d8c040" };
function eveningPrimrose(stage: GrowingStage): string {
	const k = new Ink();
	const lv = (x: number, y: number, a: number, l: number, w: number) => k.f(EP.leaf, leafD(x, y, a, l, w, 1), "lf").s(EP.rib, 0.6, ribD(x, y, a, l), "rib");
	if (stage === "sprout") {
		for (const a of [-160, -115, -65, -20]) lv(40, 86, a, 11, 2.4);
		return k.toString();
	}
	const leafy = stage === "leafy";
	const top = leafy ? 44 : 20;
	const P: P4 = [[40, 86], [40, 66], [41, 40], [40, top]];
	k.s("#8a5a3e", 1.8, cub(P), "stem");
	for (const a of [-172, -145, -35, -8]) lv(40, 86, a, 16, 3);
	for (const [i, t] of [0.18, 0.32, 0.46, 0.6, 0.74, 0.88].entries()) {
		const [x, y] = bez(P, t);
		lv(x, y, tan(P, t) + (i % 2 ? 50 : -50), 12 - t * 6, 2.2);
	}
	if (leafy) return k.f(EP.bud, lensD(40, top + 1, -90, 7, 1.4)).toString();
	k.f(EP.bud, lensD(40, top, -90, 10, 1.5) + lensD(41, top + 2, -60, 8, 1.3) + lensD(39, top + 2, -125, 7, 1.2), "bud").f(EP.budT, dotD(40, top - 9, 0.8), "bt");
	const fl: XY[] = [[29, 30], [52, 27], [33, 46]];
	for (const [x, y] of fl) k.s("#8a5a3e", 1, seg(x, y + 4, 40, y + 8), "stem");
	for (const [x, y] of fl) {
		let pd = "";
		for (const a of [-45, 45, 135, 225]) {
			const q = tf(x, y, a);
			pd += `M${q(0, 0)}C${q(2, -4.4)} ${q(7.4, -5.2)} ${q(6.6, -1)}Q${q(6, 0)} ${q(6.6, 1)}C${q(7.4, 5.2)} ${q(2, 4.4)} ${q(0, 0)}Z`;
		}
		k.f(EP.a, pd, "pa").s(EP.b, 0.5, rays(x, y, 4, 0.5, 4.5, 0), "vn").dots(EP.eye, 1, [[x, y]], "eye");
	}
	return k.toString();
}

/* ---------- 18. Angelica ---------- */
const AN = { leaf: "#6db24f", rib: "#46803a", stem: "#7a5a6a", a: "#d9e6ad", b: "#b4ca7c" };
function umbelBall(k: Ink, x: number, y: number, r: number): void {
	const n = Math.round(r * 1.7);
	const pts: XY[] = [];
	for (let i = 0; i < n; i++) pts.push(at(x, y, i * 137.5, r * 0.82 * Math.sqrt((i + 0.5) / n)));
	k.f(AN.b, dotD(x, y, r), "b").dots(AN.a, r * 0.2, pts, "a");
}
function angelica(stage: GrowingStage): string {
	const k = new Ink();
	if (stage === "sprout") {
		ternate(k, 40, 86, -120, 9, 5, AN.leaf, AN.rib);
		ternate(k, 40, 86, -60, 10, 5, AN.leaf, AN.rib);
		return k.toString();
	}
	const leafy = stage === "leafy";
	if (leafy) {
		for (const [a, l] of [[-160, 16], [-125, 20], [-90, 22], [-55, 20], [-20, 16]] as const) ternate(k, 40, 86, a, l, 9, AN.leaf, AN.rib);
		return k.toString();
	}
	k.s(AN.stem, 2.6, "M40 87L40 22M40 46Q30 40 25 33M40 52Q52 46 56 38", "stem");
	for (const [a, l] of [[-165, 18], [-135, 21], [-45, 21], [-15, 18]] as const) ternate(k, 40, 86, a, l, 9, AN.leaf, AN.rib);
	ternate(k, 40, 64, -150, 12, 6, AN.leaf, AN.rib);
	ternate(k, 40, 60, -30, 12, 6, AN.leaf, AN.rib);
	k.f(AN.stem, `M37.6 49Q40 43 42.4 49Z`, "sh");
	umbelBall(k, 40, 16, 10);
	umbelBall(k, 25, 30, 5.5);
	umbelBall(k, 56, 35, 5.5);
	return k.toString();
}

/* ---------- 19. Skullcap ---------- */
const SC = { leaf: "#5f9a48", rib: "#3f7a35", a: "#5f63c0", b: "#a5a8e8", cal: "#5a7a3e" };
function skullcap(stage: GrowingStage): string {
	const k = new Ink();
	const pr = (P: P4, ts: readonly number[], len: number) => {
		for (const t of ts) {
			const [x, y] = bez(P, t);
			const a = tan(P, t);
			for (const s of [-1, 1]) k.f(SC.leaf, toothD(x, y, a + s * 70, len * (1 - t * 0.4), len * 0.4 * (1 - t * 0.4), 4, 0.25, 0.4), "lf");
		}
	};
	if (stage === "sprout") {
		const P: P4 = [[40, 87], [40, 82], [40, 76], [40, 70]];
		k.s(SC.rib, 1.1, cub(P));
		pr(P, [0.4, 0.95], 6);
		return k.toString();
	}
	const leafy = stage === "leafy";
	const stems: P4[] = leafy ? [[[40, 87], [38, 74], [34, 60], [33, 50]], [[40, 87], [42, 74], [46, 60], [48, 48]]] : [[[40, 87], [36, 74], [28, 60], [24, 44]], [[40, 87], [39, 70], [37, 52], [38, 34]], [[40, 87], [43, 72], [50, 58], [55, 40]]];
	for (const P of stems) k.s(SC.rib, 1.1, cub(P), "stem");
	for (const P of stems) pr(P, [0.25, 0.45, 0.65, 0.85], 8);
	if (leafy) return k.toString();
	for (const P of stems) {
		for (const t of [0.55, 0.7, 0.85, 1]) {
			const [x, y] = bez(P, t);
			const a = tan(P, t) + 70;
			const q = tf(x, y, a);
			k.f(SC.cal, dotD(x + Math.cos(a * RAD) * 1.2, y + Math.sin(a * RAD) * 1.2, 1), "cal");
			k.f(SC.a, `M${q(1, -0.9)}L${q(6.5, -1.8)}Q${q(8.2, -1.6)} ${q(7.6, 0)}L${q(1, 0.9)}Z`, "a").f(SC.b, `M${q(4.5, 0)}Q${q(7.5, 0.6)} ${q(7.4, 2.4)}Q${q(5.4, 2)} ${q(4.5, 0)}Z`, "b");
		}
	}
	return k.toString();
}

/* ---------- 20. Motherwort ---------- */
const MW = { leaf: "#4f8a3e", stem: "#5b6e3a", a: "#d78bb0", b: "#f0bfd6", cal: "#6d8a4a" };
function mwLeaf(k: Ink, x: number, y: number, a: number, l: number): void {
	let d = "";
	for (const s of [-32, 0, 32]) d += toothD(x, y, a + s, s ? l * 0.75 : l, l * 0.17, 2, 0.4, 0.5);
	k.f(MW.leaf, d, "lf");
}
function motherwort(stage: GrowingStage): string {
	const k = new Ink();
	if (stage === "sprout") {
		k.s(MW.stem, 1.3, seg(40, 87, 40, 73));
		mwLeaf(k, 40, 78, -150, 8);
		mwLeaf(k, 40, 78, -30, 8);
		mwLeaf(k, 40, 73, -90, 5);
		return k.toString();
	}
	const leafy = stage === "leafy";
	const stems: P4[] = leafy ? [[[40, 87], [40, 70], [40, 55], [40, 40]]] : [[[40, 87], [40, 62], [40, 36], [40, 8]], [[40, 87], [36, 66], [30, 46], [28, 22]], [[40, 87], [44, 66], [50, 46], [52, 24]]];
	for (const P of stems) k.s(MW.stem, leafy ? 1.6 : 1.5, cub(P), "stem");
	const wh: XY[] = [];
	for (const [si, P] of stems.entries()) {
		const ts = si === 0 ? (leafy ? [0.12, 0.3, 0.48, 0.66, 0.84] : [0.14, 0.32, 0.5, 0.68, 0.86]) : [0.45, 0.75];
		for (const t of ts) {
			const [x, y] = bez(P, t);
			const a = tan(P, t);
			const l = (si === 0 ? 13 : 9) * (1 - t * 0.5);
			mwLeaf(k, x, y, a - 70, l);
			mwLeaf(k, x, y, a + 70, l);
			if (!leafy && t > 0.4) wh.push([x, y]);
		}
	}
	if (leafy) return k.toString();
	const a: XY[] = [];
	const b: XY[] = [];
	for (const [x, y] of wh) {
		for (const dx of [-2.6, 0, 2.6]) a.push([x + dx, y - 1.6 + Math.abs(dx) * 0.3]);
		b.push([x - 1.4, y - 2.6], [x + 1.4, y - 2.6]);
	}
	k.dots(MW.cal, 1.6, wh, "cal").dots(MW.a, 1.25, a, "a").dots(MW.b, 0.75, b, "b");
	return k.toString();
}

/* ---------- 21. Black cohosh ---------- */
const BC = { leaf: "#3f7a35", rib: "#2d5a27", stem: "#4a4038", a: "#f4f2e6", b: "#bdb79c", bud: "#c6cfae" };
function blackCohosh(stage: GrowingStage): string {
	const k = new Ink();
	if (stage === "sprout") {
		ternate(k, 40, 86, -110, 10, 5, BC.leaf, BC.rib);
		ternate(k, 40, 86, -60, 9, 5, BC.leaf, BC.rib);
		return k.toString();
	}
	const leafy = stage === "leafy";
	for (const [a, l] of [[-165, 18], [-130, 22], [-95, 20], [-55, 22], [-15, 18]] as const) ternate(k, 40, 86, a, l * (leafy ? 1.05 : 0.95), 9, BC.leaf, BC.rib);
	if (leafy) return k.toString();
	const racemes: P4[] = [[[40, 74], [39, 50], [36, 30], [33, 8]], [[40, 74], [44, 56], [52, 40], [58, 22]], [[40, 74], [36, 60], [26, 50], [22, 36]]];
	let sd = "";
	for (const P of racemes) sd += cub(P);
	k.s(BC.stem, 0.9, sd, "stem");
	const a: XY[] = [];
	const b: XY[] = [];
	for (const [ri, P] of racemes.entries()) {
		const from = ri === 0 ? 0.42 : 0.4;
		for (let i = 0; i <= 14; i++) {
			const t = from + ((1 - from) * i) / 14;
			const [x, y] = bez(P, t);
			const w = 1.6 * (1 - (t - from) / (1 - from) * 0.55);
			(i % 2 ? a : b).push([x - w, y], [x + w, y]);
		}
	}
	k.dots(BC.b, 1.45, [...a, ...b], "b").dots(BC.a, 1.05, [...a, ...b], "a");
	return k.toString();
}

/* ---------- 22. Gotu kola ---------- */
const GK = { leaf: "#6db24f", vein: "#3f7a35", runner: "#9a6a4a", fl: "#c94a6a", petiole: "#7a9a4a" };
function gotuKola(stage: GrowingStage): string {
	const k = new Ink();
	const lf = (x0: number, x: number, y: number, r: number) => {
		k.s(GK.petiole, 0.9, `M${f(x0)} 86Q${f(x0)} ${f((86 + y) / 2)} ${f(x)} ${f(y)}`, "pet").f(GK.leaf, kidneyD(x, y, r, 90), "lf");
		k.s(GK.vein, 0.5, rays(x, y, 5, 0.4, r * 0.8, -150 + 0), "vein");
	};
	if (stage === "sprout") {
		lf(40, 36, 74, 5);
		lf(40, 45, 71, 5.5);
		return k.toString();
	}
	const leafy = stage === "leafy";
	const L: (readonly [number, number, number, number])[] = leafy
		? [[34, 28, 70, 6.5], [38, 39, 62, 7], [44, 50, 66, 6.8], [30, 20, 76, 5.5], [52, 60, 74, 5.5]]
		: [[30, 24, 62, 7.5], [38, 37, 53, 8], [44, 52, 57, 8], [24, 13, 72, 6], [58, 65, 70, 6.5], [36, 30, 74, 6], [48, 46, 72, 6.5]];
	k.s(GK.runner, 1.1, leafy ? "M18 86.5Q40 84.5 62 86.5" : "M8 86.5Q40 84 72 86.5", "run");
	for (const [x0, x, y, r] of L) lf(x0, x, y, r);
	if (leafy) return k.toString();
	const fl: XY[] = [[33, 80], [35, 78.5], [46, 81], [47.8, 79.6], [57, 82]];
	k.dots(GK.fl, 1, fl, "fl").dots("#f0a0b4", 0.45, fl, "fh");
	return k.toString();
}

/* ---------- 23. Agrimony ---------- */
const AG = { leaf: "#5e9447", rib: "#3f6f32", fl: "#f2c623", eye: "#d49a14", bud: "#8fb052", burr: "#7c9a46" };
function agLeaf(k: Ink, x: number, y: number, deg: number, len: number, s: number): void {
	const q = tf(x, y, deg);
	k.s(AG.rib, 0.8, `M${q(0, 0)}L${q(len, 0)}`, "rib");
	let d = "";
	for (let i = 0; i < 3; i++) {
		const u = len * (0.2 + 0.3 * i);
		const [px, py] = at(x, y, deg, u);
		const l = s * (1 - 0.15 * i);
		d += lensD(px, py, deg - 60, l, l * 0.3) + lensD(px, py, deg + 60, l, l * 0.3);
		if (i < 2) {
			const [hx, hy] = at(x, y, deg, u + len * 0.15);
			d += lensD(hx, hy, deg - 70, l * 0.4, l * 0.14) + lensD(hx, hy, deg + 70, l * 0.4, l * 0.14);
		}
	}
	const [ex, ey] = at(x, y, deg, len);
	d += lensD(ex, ey, deg, s * 0.85, s * 0.28);
	k.f(AG.leaf, d, "lf");
}
function agrimony(stage: GrowingStage): string {
	const k = new Ink();
	if (stage === "sprout") {
		agLeaf(k, 40, 86, -125, 8, 4);
		agLeaf(k, 40, 86, -60, 8, 4);
		return k.toString();
	}
	const leafy = stage === "leafy";
	for (const [a, l] of [[-165, 14], [-130, 16], [-55, 16], [-18, 14]] as const) agLeaf(k, 40, 86, a, l, 6);
	if (leafy) {
		agLeaf(k, 40, 86, -92, 18, 6);
		return k.toString();
	}
	const spikes: P4[] = [[[40, 86], [39, 60], [36, 36], [34, 6]], [[40, 86], [42, 64], [48, 44], [51, 18]]];
	for (const P of spikes) k.s(AG.rib, 1.2, cub(P), "stem");
	agLeaf(k, 39, 62, -150, 9, 4);
	agLeaf(k, 42, 58, -30, 8, 3.5);
	for (const P of spikes) {
		let fl = "";
		const eyes: XY[] = [];
		const buds: XY[] = [];
		const burrs: XY[] = [];
		for (let i = 0; i < 11; i++) {
			const t = 0.45 + i * 0.05;
			const [x, y] = bez(P, t);
			const dx = i % 2 ? 2.4 : -2.4;
			if (i < 3) burrs.push([x + dx * 0.6, y]);
			else if (i < 9) {
				fl += rays(x + dx, y, 5, 0.7, 1.7, i * 20);
				eyes.push([x + dx, y]);
			} else buds.push([x + dx * 0.5, y]);
		}
		const [tx, ty] = bez(P, 1);
		buds.push([tx, ty]);
		k.dots(AG.burr, 1.2, burrs, "burr").s(AG.fl, 2, fl, "fl").dots(AG.eye, 0.6, eyes, "eye").dots(AG.bud, 0.9, buds, "bud");
	}
	return k.toString();
}

/* ---------- 24. Tansy ---------- */
const TA = { leaf: "#4c8a3c", rib: "#335f2a", a: "#f2bb17", b: "#c98b0a" };
function tansy(stage: GrowingStage): string {
	const k = new Ink();
	if (stage === "sprout") {
		feather(k, 40, 86, -120, 12, 3, TA.leaf);
		feather(k, 40, 86, -65, 13, 3, TA.leaf);
		return k.toString();
	}
	const leafy = stage === "leafy";
	const P: P4 = [[40, 86], [40, 70], [40, 56], [40, leafy ? 40 : 22]];
	k.s(TA.rib, 1.6, cub(P), "stem");
	for (const a of [-170, -140, -40, -10]) feather(k, 40, 86, a, 17, 4.5, TA.leaf);
	for (const [i, t] of [0.2, 0.36, 0.52, 0.68, 0.84].entries()) {
		const [x, y] = bez(P, t);
		feather(k, x, y, tan(P, t) + (i % 2 ? 55 : -55), 14 - t * 7, 4, TA.leaf);
	}
	if (leafy) return k.toString();
	const bt: XY[] = [];
	let rd = "";
	for (let i = 0; i < 15; i++) {
		const x = 23 + (i % 8) * 4.8 + (i >= 8 ? 2.4 : 0);
		const y = (i >= 8 ? 13 : 17.5) + Math.pow((x - 40) / 18, 2) * 3;
		if (i >= 8 && x > 57) continue;
		bt.push([x, y]);
		rd += seg(40, 25, x, y + 1.5);
	}
	k.s(TA.rib, 0.6, rd, "stem").dots(TA.b, 2.4, bt.map(([x, y]) => [x, y + 0.5] as const), "b").dots(TA.a, 2.1, bt, "a");
	return k.toString();
}

/* ---------- 25. White horehound ---------- */
const WHH = { leaf: "#b8c2aa", vein: "#879379", stem: "#9aa38a", fl: "#f6f5ee", cal: "#8f9a7e" };
function hhLeaf(k: Ink, x: number, y: number, a: number, l: number): void {
	k.f(WHH.leaf, toothD(x, y, a, l, l * 0.5, 4, 0.12, 0), "lf");
	const q = tf(x, y, a);
	k.s(WHH.vein, 0.5, `M${q(l * 0.1, 0)}L${q(l * 0.75, 0)}M${q(l * 0.3, -l * 0.28)}L${q(l * 0.45, 0)}L${q(l * 0.3, l * 0.28)}`, "vein");
}
function horehound(stage: GrowingStage): string {
	const k = new Ink();
	if (stage === "sprout") {
		k.s(WHH.stem, 1.4, seg(40, 87, 40, 74));
		hhLeaf(k, 40, 80, -160, 7);
		hhLeaf(k, 40, 80, -20, 7);
		hhLeaf(k, 40, 74, -125, 5);
		hhLeaf(k, 40, 74, -55, 5);
		return k.toString();
	}
	const leafy = stage === "leafy";
	const stems: P4[] = leafy ? [[[40, 87], [38, 74], [33, 62], [31, 50]], [[40, 87], [42, 74], [47, 62], [49, 48]]] : [[[40, 87], [36, 74], [26, 62], [21, 44]], [[40, 87], [39, 70], [36, 52], [35, 34]], [[40, 87], [42, 70], [46, 52], [47, 33]], [[40, 87], [45, 74], [55, 62], [60, 46]]];
	for (const P of stems) k.s(WHH.stem, 1.6, cub(P), "stem");
	const wh: XY[] = [];
	for (const P of stems) {
		for (const t of leafy ? [0.3, 0.52, 0.74, 0.96] : [0.35, 0.65, 0.95]) {
			const [x, y] = bez(P, t);
			const a = tan(P, t);
			hhLeaf(k, x, y, a - 75, 7.5 - t * 2.5);
			hhLeaf(k, x, y, a + 75, 7.5 - t * 2.5);
			if (t > 0.4) wh.push([x, y]);
		}
	}
	if (leafy) return k.toString();
	const fl: XY[] = [];
	for (const [x, y] of wh) fl.push([x - 2, y - 0.8], [x + 2, y - 0.8], [x, y - 2]);
	k.dots(WHH.cal, 2.2, wh, "cal").dots(WHH.fl, 1.15, fl, "fl");
	return k.toString();
}

export const SPECIES: Species[] = [
	{ id: "st-johns-wort", name: "St John's wort", draw: stJohnsWort },
	{ id: "valerian", name: "Valerian", draw: valerian },
	{ id: "feverfew", name: "Feverfew", draw: feverfew },
	{ id: "pot-marigold", name: "Pot marigold", draw: potMarigold },
	{ id: "comfrey", name: "Comfrey", draw: comfrey },
	{ id: "elecampane", name: "Elecampane", draw: elecampane },
	{ id: "marshmallow", name: "Marshmallow", draw: marshmallow },
	{ id: "ginseng", name: "Ginseng", draw: ginseng },
	{ id: "goldenseal", name: "Goldenseal", draw: goldenseal },
	{ id: "milk-thistle", name: "Milk thistle", draw: milkThistle },
	{ id: "great-mullein", name: "Great mullein", draw: mullein },
	{ id: "broadleaf-plantain", name: "Broadleaf plantain", draw: plantain },
	{ id: "licorice", name: "Licorice", draw: licorice },
	{ id: "ashwagandha", name: "Ashwagandha", draw: ashwagandha },
	{ id: "holy-basil", name: "Holy basil", draw: holyBasil },
	{ id: "witch-hazel", name: "Witch hazel", draw: witchHazel },
	{ id: "evening-primrose", name: "Evening primrose", draw: eveningPrimrose },
	{ id: "angelica", name: "Angelica", draw: angelica },
	{ id: "skullcap", name: "Skullcap", draw: skullcap },
	{ id: "motherwort", name: "Motherwort", draw: motherwort },
	{ id: "black-cohosh", name: "Black cohosh", draw: blackCohosh },
	{ id: "gotu-kola", name: "Gotu kola", draw: gotuKola },
	{ id: "agrimony", name: "Agrimony", draw: agrimony },
	{ id: "tansy", name: "Tansy", draw: tansy },
	{ id: "white-horehound", name: "White horehound", draw: horehound },
];
