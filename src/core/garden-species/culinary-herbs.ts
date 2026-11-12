/**
 * Garden species, family: culinary herbs and spices (second batch). Each
 * draws sprout, leafy and bloom in the kit's flat style (see kit.ts); the
 * kit draws soil and seed.
 */
import { bez, f, type GrowingStage, type Pt, type Species } from "./kit";

/* ---------- private helpers ---------- */

type St = GrowingStage;
type Cubic = readonly [Pt, Pt, Pt, Pt];
const D = Math.PI / 180;

const by = <T>(st: St, a: T, b: T, c: T): T => (st === "sprout" ? a : st === "leafy" ? b : c);
const pol = (x: number, y: number, deg: number, r: number): [number, number] => [x + Math.cos(deg * D) * r, y + Math.sin(deg * D) * r];

/** Heading of a cubic at t, in degrees. */
function dirAt(P: Cubic, t: number): number {
	const [x0, y0] = bez(P, Math.max(0, t - 0.02));
	const [x1, y1] = bez(P, Math.min(1, t + 0.02));
	return Math.atan2(y1 - y0, x1 - x0) / D;
}

/** Local → world mapper for a frame at (x, y) heading `deg`, as markup. */
function xf(x: number, y: number, deg: number): (u: number, v: number) => string {
	const m = xt(x, y, deg);
	return (u, v) => m(u, v).map(f).join(" ");
}

/** Local → world mapper for a frame at (x, y) heading `deg`, as a point. */
function xt(x: number, y: number, deg: number): (u: number, v: number) => [number, number] {
	const c = Math.cos(deg * D);
	const s = Math.sin(deg * D);
	return (u, v) => [x + u * c - v * s, y + u * s + v * c];
}

/* Compact path data: tenths, relative commands, no redundant separators. */
const tq = (n: number): number => Math.round(n * 10);
function num(t: number): string {
	const s = (t / 10).toString();
	return s.startsWith("0.") ? s.slice(1) : s.startsWith("-0.") ? "-" + s.slice(2) : s;
}
function join(ns: readonly number[]): string {
	let o = "";
	for (const n of ns) {
		const s = num(n);
		o += (o && s[0] !== "-" && !(s[0] === "." && /\.\d*$/.test(o)) ? " " : "") + s;
	}
	return o;
}
/** A relative path builder in world coordinates. */
class RP {
	d = "";
	private x = 0;
	private y = 0;
	private last = "";
	M(x: number, y: number): this {
		this.x = tq(x);
		this.y = tq(y);
		this.d += "M" + join([this.x, this.y]);
		this.last = "";
		return this;
	}
	private rel(cmd: string, pts: readonly number[]): this {
		const r: number[] = [];
		const seq = cmd === "l";
		for (let i = 0; i < pts.length; i += 2) {
			const X = tq(pts[i]!);
			const Y = tq(pts[i + 1]!);
			r.push(X - this.x, Y - this.y);
			if (seq) {
				this.x = X;
				this.y = Y;
			}
		}
		const body = join(r);
		this.d += cmd === this.last ? (body[0] === "-" ? "" : " ") + body : cmd + body;
		this.last = cmd;
		this.x = tq(pts[pts.length - 2]!);
		this.y = tq(pts[pts.length - 1]!);
		return this;
	}
	L(...p: number[]): this {
		return this.rel("l", p);
	}
	Q(...p: number[]): this {
		return this.rel("q", p);
	}
	C(...p: number[]): this {
		return this.rel("c", p);
	}
	Z(): string {
		return this.d + "z";
	}
}

/** Subpath of a kit-shaped leaf (0 oval, 1 pointed, 2 round, 4 heart). */
function leafSub(x: number, y: number, deg: number, len: number, w: number, shape: 0 | 1 | 2 | 4 = 0): string {
	const m = xt(x, y, deg);
	const [a, b, c, d] = shape === 1 ? [0.45, 1.15, 0.8, 0.5] : shape === 2 ? [0.05, 1.4, 1.02, 1.3] : shape === 4 ? [0.1, 1.6, 0.75, 1.2] : [0.3, 1, 0.8, 1];
	return new RP()
		.M(...m(0, 0))
		.C(...m(a * len, -b * w), ...m(c * len, -d * w), ...m(len, 0))
		.C(...m(c * len, d * w), ...m(a * len, b * w), ...m(0, 0))
		.Z();
}

/** Subpath of a midrib. */
function ribSub(x: number, y: number, deg: number, len: number): string {
	const m = xt(x, y, deg);
	return lnSub(...m(0.5, 0), ...m(len * 0.8, 0));
}

/** Subpath of a toothed leaf: n teeth a side, widest at `peak` of its length. */
function toothSub(x: number, y: number, deg: number, len: number, w: number, n: number, peak = 0.4, dep = 0.7): string {
	const m = xt(x, y, deg);
	const top: number[] = [];
	const bot: number[][] = [];
	const k = 2 * n;
	for (let i = 1; i < k; i++) {
		const u = i / k;
		const pr = u < peak ? Math.sin(((u / peak) * Math.PI) / 2) : Math.cos((((u - peak) / (1 - peak)) * Math.PI) / 2);
		const r = w * (0.25 + 0.75 * pr) * (i % 2 ? 1 : dep);
		top.push(...m(u * len, -r));
		bot.unshift(m(u * len, r));
	}
	return new RP()
		.M(...m(0, 0))
		.L(...top, ...m(len, 0), ...bot.flat(), ...m(0, 0))
		.Z();
}

/** Subpath of a pointed lens from (x, y) heading `deg`. */
function lensSub(x: number, y: number, deg: number, len: number, w: number): string {
	const m = xt(x, y, deg);
	return new RP()
		.M(...m(0, 0))
		.Q(...m(len * 0.45, -w * 1.25), ...m(len, 0))
		.Q(...m(len * 0.45, w * 1.25), ...m(0, 0))
		.Z();
}

/** Subpath of a rotated ellipse. */
function ovalSub(cx: number, cy: number, rx: number, ry: number, rot: number): string {
	const [x1, y1] = pol(cx, cy, rot, rx);
	const [x2, y2] = pol(cx, cy, rot + 180, rx);
	const dx = tq(x2) - tq(x1);
	const dy = tq(y2) - tq(y1);
	const a = `a${join([tq(rx), tq(ry), Math.round(rot) * 10])} 1 0`;
	const sp = (t: string) => (t[0] === "-" ? t : " " + t);
	return `M${join([tq(x1), tq(y1)])}${a}${sp(join([dx, dy]))}${a}${sp(join([-dx, -dy]))}z`;
}

const cubSub = (P: Cubic): string => new RP().M(...P[0]).C(...P[1], ...P[2], ...P[3]).d;
const lnSub = (x1: number, y1: number, x2: number, y2: number): string => new RP().M(x1, y1).L(x2, y2).d;
const qSub = (x1: number, y1: number, cx: number, cy: number, x2: number, y2: number): string => new RP().M(x1, y1).Q(cx, cy, x2, y2).d;

/**
 * Batches shapes into one <path> per fill (or stroke colour and width).
 * Layers draw in the order their key first appears; `f(c, "")` reserves one.
 * Dots are zero-length round-capped strokes, batched per colour and size.
 */
class Pen {
	private m = new Map<string, string>();
	private add(k: string, d: string): this {
		this.m.set(k, (this.m.get(k) ?? "") + d);
		return this;
	}
	f(fill: string, d: string): this {
		return this.add("f" + fill, d);
	}
	s(c: string, w: number, d: string): this {
		return this.add(`s${c}|${num(tq(w))}`, d);
	}
	dot(x: number, y: number, r: number, fill: string): this {
		return this.add(`s${fill}|${num(Math.round(r * 5) * 4)}`, `M${join([tq(x), tq(y)])}h0`);
	}
	/** Reserves the layer of dots of radius r. */
	res(r: number, fill: string): this {
		return this.add(`s${fill}|${num(Math.round(r * 5) * 4)}`, "");
	}
	leaf(x: number, y: number, deg: number, len: number, w: number, fill: string, shape: 0 | 1 | 2 | 4 = 0, rib?: string, rw = 0.7): this {
		this.f(fill, leafSub(x, y, deg, len, w, shape));
		return rib ? this.s(rib, rw, ribSub(x, y, deg, len)) : this;
	}
	toString(): string {
		let o = "";
		for (const [k, d] of this.m) {
			if (!d) continue;
			if (k[0] === "f") o += `<path d="${d}" fill="${k.slice(1)}"/>`;
			else {
				const [c, w] = k.slice(1).split("|");
				o += `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
			}
		}
		return o;
	}
}

/** A fern-like divided leaf from (x, y) heading `deg`, curling by `bend`; leaflets are round-capped strokes `lw` wide. */
function fern(p: Pen, x: number, y: number, deg: number, len: number, bend: number, lf: number, rib: string, ca: string, cb: string, n = 9, rw = 1, lw = 1.4): void {
	const step = len / n;
	let a = deg * D;
	let px = x;
	let py = y;
	const d = new RP().M(x, y);
	for (let j = 1; j <= n; j++) {
		a += (bend * D) / n;
		px += Math.cos(a) * step;
		py += Math.sin(a) * step;
		d.L(px, py);
		if (j >= 2 && j < n) {
			const l = (1 - j / n) * lf + 1.2;
			const ad = a / D;
			p.s(ca, lw, lnSub(px, py, ...pol(px, py, ad - 55, l))).s(cb, lw, lnSub(px, py, ...pol(px, py, ad + 55, l)));
		}
	}
	p.s(rib, rw, d.d);
}

/** A thread-leaf: forked fine strokes. */
function thread(p: Pen, x: number, y: number, deg: number, len: number, c: string, w = 0.6, depth = 2): void {
	const [ex, ey] = pol(x, y, deg, len);
	p.s(c, w, lnSub(x, y, ex, ey));
	if (depth <= 0) return;
	for (const t of [0.45, 0.75]) {
		const [mx, my] = pol(x, y, deg, len * t);
		thread(p, mx, my, deg - 38, len * (1 - t) * 0.95, c, w, depth - 1);
		thread(p, mx, my, deg + 38, len * (1 - t) * 0.95, c, w, depth - 1);
	}
}

/** An umbel with its hub r * .9 below (x, y); `lets` > 0 draws umbellets of dots. */
function umbel(p: Pen, x: number, y: number, r: number, n: number, ray: string, fl: string, fl2: string, dr: number, dome = 0.3, lets = 0): void {
	const hy = y + r * 0.9;
	for (let i = 0; i < n; i++) {
		const u = n === 1 ? 0.5 : i / (n - 1);
		const ex = x + (u - 0.5) * 2 * r;
		const ey = y - Math.sin(u * Math.PI) * r * dome;
		p.s(ray, 0.5, lnSub(x, hy, ex, ey));
		const c = i % 2 ? fl2 : fl;
		if (!lets) p.dot(ex, ey, dr, c);
		else {
			p.dot(ex, ey - dr * 0.4, dr, c);
			for (let k = 0; k < lets; k++) {
				const [dx, dy] = pol(ex, ey - dr * 0.4, -90 + (k - (lets - 1) / 2) * (150 / lets) + 180 * (k % 2) * 0, dr * 1.5);
				p.dot(dx, dy, dr * 0.8, c);
			}
		}
	}
}

/* ---------- 1. Chives ---------- */
const CHV = { a: "#5a9a63", b: "#79b57b", fl: "#b48ad6", fd: "#8f63b9", fh: "#d6bbec", bud: "#cdbadb" };
const CHV_J = [0.92, 1, 0.85, 0.97, 0.8, 1, 0.9, 0.86, 0.95, 0.82, 1, 0.88, 0.93];
function chives(st: St): string {
	const p = new Pen();
	p.s(CHV.a, 1.2, "").res(4.8, CHV.fl).res(0.95, CHV.fd).res(1.1, CHV.fh).res(0.8, CHV.fh);
	const n = by(st, 4, 9, 13);
	const H = by(st, 18, 40, 46);
	const W = by(st, 10, 24, 32);
	const bw = by(st, 1.4, 1.7, 1.8);
	for (let i = 0; i < n; i++) {
		const u = i / (n - 1);
		const x0 = 40 + (u - 0.5) * by(st, 3, 6, 8);
		const tx = 40 + (u - 0.5) * W;
		const ty = 87 - H * CHV_J[i % 13]! * (0.78 + 0.22 * Math.sin(u * Math.PI));
		p.s(i % 2 ? CHV.a : CHV.b, bw, qSub(x0, 87, x0 + (tx - x0) * 0.15, (87 + ty) / 2, tx, ty));
	}
	if (st === "leafy") p.s(CHV.a, 1.2, qSub(41, 87, 42, 60, 44, 38)).f(CHV.bud, lensSub(44, 39, -86, 7, 2.2));
	if (st === "bloom") {
		for (const [x, y, r] of [[28, 27, 4.8], [42, 15, 4.8], [54, 23, 4.8]] as const) {
			p.s(CHV.a, 1.2, qSub(40, 87, 40 + (x - 40) * 0.2, 50, x, y + r - 1));
			p.dot(x, y, r, CHV.fl);
			for (let k = 0; k < 7; k++) {
				const [dx, dy] = pol(x, y, 20 + k * 51, r * 0.58);
				p.dot(dx, dy, 0.95, CHV.fd);
			}
			p.dot(x - r * 0.35, y - r * 0.4, 1.1, CHV.fh).dot(x + r * 0.15, y - r * 0.65, 0.8, CHV.fh);
		}
		p.s(CHV.a, 1.2, qSub(40, 87, 46, 60, 48, 36)).f(CHV.bud, lensSub(48, 37, -80, 7, 2.2));
	}
	return p.toString();
}

/* ---------- 2. Tarragon ---------- */
const TAR = { st: "#5b7d3d", a: "#4c8a46", b: "#6ba45b", fl: "#dcc65a", fl2: "#b7ae46" };
function tarragon(st: St): string {
	const p = new Pen();
	const S: Cubic[] = by<Cubic[]>(
		st,
		[
			[[40, 87], [40, 81], [40, 76], [39, 69]],
			[[40, 87], [41, 83], [43, 79], [46, 75]],
		],
		[
			[[40, 87], [38, 74], [32, 60], [27, 47]],
			[[40, 87], [40, 70], [41, 56], [41, 40]],
			[[40, 87], [42, 74], [48, 62], [54, 50]],
			[[40, 87], [39, 78], [35, 72], [31, 66]],
		],
		[
			[[40, 87], [36, 74], [24, 58], [16, 42]],
			[[40, 87], [38, 70], [31, 46], [29, 22]],
			[[40, 87], [40, 68], [42, 36], [44, 10]],
			[[40, 87], [42, 70], [50, 46], [56, 22]],
			[[40, 87], [44, 74], [56, 58], [65, 42]],
		],
	);
	const nL = by(st, 4, 8, 11);
	const L0 = by(st, 7, 10, 10.5);
	const sw = by(st, 1.1, 1.3, 1.4);
	p.s(TAR.st, sw, "");
	for (const P of S) {
		p.s(TAR.st, sw, cubSub(P));
		for (let i = 0; i < nL; i++) {
			const t = 0.14 + (0.86 * i) / (nL - 1);
			const [x, y] = bez(P, t);
			const dir = dirAt(P, t);
			const len = L0 * (1 - 0.35 * t);
			const a = i === nL - 1 ? dir : dir + (i % 2 ? 36 : -36);
			p.f(i % 3 ? TAR.a : TAR.b, leafSub(x, y, a, len, 1.15, 1));
		}
		if (st === "bloom") {
			for (let k = 0; k < 4; k++) {
				const t = 0.5 + k * 0.13;
				const [x, y] = bez(P, t);
				const dir = dirAt(P, t);
				const sd = k % 2 ? 1 : -1;
				const [ex, ey] = pol(x, y, dir + sd * 52, 6.5);
				const [mx, my] = pol(x, y, dir + sd * 52, 3.4);
				p.s(TAR.st, 0.6, lnSub(x, y, ex, ey));
				p.dot(ex, ey, 1.2, TAR.fl).dot(mx + sd * 0.3, my - 1.2, 1, TAR.fl2);
				const [fx, fy] = pol(ex, ey, dir, 2);
				p.dot(fx, fy, 0.9, TAR.fl);
			}
		}
	}
	return p.toString();
}

/* ---------- 3. Lemon balm ---------- */
const LB = { st: "#6a9a3a", a: "#86bd4f", b: "#a3cf63", rib: "#55822f", fl: "#f5f3e0" };
function lemonBalm(st: St): string {
	const p = new Pen();
	const S: Cubic[] = by<Cubic[]>(
		st,
		[[[40, 87], [40, 82], [40, 78], [40, 73]]],
		[
			[[40, 87], [36, 78], [28, 70], [22, 62]],
			[[40, 87], [39, 74], [36, 62], [34, 50]],
			[[40, 87], [41, 72], [44, 58], [47, 46]],
			[[40, 87], [44, 78], [52, 70], [58, 62]],
		],
		[
			[[40, 87], [34, 80], [24, 72], [16, 62]],
			[[40, 87], [38, 72], [33, 54], [29, 38]],
			[[40, 87], [41, 70], [44, 52], [47, 34]],
			[[40, 87], [44, 78], [54, 68], [63, 58]],
			[[40, 87], [40, 80], [40, 70], [39, 58]],
		],
	);
	p.s(LB.st, 1.5, "");
	p.f(LB.a, "").f(LB.b, "");
	const ts = by(st, [0.55, 1], [0.4, 0.7, 1], [0.3, 0.55, 0.78, 1]);
	for (const P of S) {
		p.s(LB.st, 1.5, cubSub(P));
		ts.forEach((t, i) => {
			const [x, y] = bez(P, t);
			const dir = dirAt(P, t);
			const len = by(st, 9, 10.5, 11) * (1 - 0.25 * t);
			const c = i % 2 ? LB.b : LB.a;
			const sp = t === 1 ? 40 : 78;
			const l = t === 1 ? len * 0.7 : len;
			p.f(c, toothSub(x, y, dir - sp, l, l * 0.44, 3, 0.35, 0.84) + toothSub(x, y, dir + sp, l, l * 0.44, 3, 0.35, 0.84));
			p.s(LB.rib, 0.7, ribSub(x, y, dir - sp, l) + ribSub(x, y, dir + sp, l));
			if (st === "bloom" && t < 1) {
				const [ax, ay] = pol(x, y, dir, 1.6);
				p.dot(ax - 1.3, ay, 1, LB.fl).dot(ax + 1.3, ay, 1, LB.fl).dot(ax, ay - 1, 0.9, LB.fl);
			}
		});
	}
	return p.toString();
}

/* ---------- 4. Lovage ---------- */
const LOV = { st: "#6c9440", a: "#3f8a40", b: "#57a350", fl: "#d8d05a", fl2: "#b5b03d" };
function lovLeaf(p: Pen, x: number, y: number, deg: number, k: number, pl: number): void {
	const [ex, ey] = pol(x, y, deg, pl);
	const [mx, my] = pol(x, y, deg, pl * 0.62);
	p.s(LOV.st, 1.1, lnSub(x, y, ex, ey));
	p.f(LOV.a, toothSub(mx, my, deg - 58, 6 * k, 2.4 * k, 2, 0.6) + toothSub(mx, my, deg + 58, 6 * k, 2.4 * k, 2, 0.6));
	p.f(LOV.b, toothSub(ex, ey, deg - 40, 7 * k, 3 * k, 2, 0.6) + toothSub(ex, ey, deg + 40, 7 * k, 3 * k, 2, 0.6) + toothSub(ex, ey, deg, 8 * k, 3.2 * k, 2, 0.6));
}
function lovage(st: St): string {
	const p = new Pen();
	p.s(LOV.st, 2.8, "").s(LOV.st, 1.1, "").f(LOV.a, "").f(LOV.b, "");
	if (st === "sprout") {
		lovLeaf(p, 40, 87, -128, 0.7, 11);
		lovLeaf(p, 40, 87, -58, 0.7, 13);
		return p.toString();
	}
	if (st === "leafy") {
		for (const [a, l] of [[-150, 18], [-122, 26], [-93, 30], [-64, 26], [-34, 18]] as const) lovLeaf(p, 40, 87, a, 1.05, l);
		return p.toString();
	}
	p.s(LOV.st, 2.8, "M40 87C40 66 41 40 40 16").s(LOV.st, 1.7, "M40 52Q32 40 27 27M40 44Q48 34 54 24");
	for (const [a, l] of [[-160, 16], [-130, 20], [-50, 20], [-20, 16]] as const) lovLeaf(p, 40, 86, a, 1.05, l);
	lovLeaf(p, 40, 64, -28, 0.8, 9);
	lovLeaf(p, 40, 58, -152, 0.75, 8);
	umbel(p, 40, 13, 8, 9, LOV.st, LOV.fl, LOV.fl2, 1.4, 0.3);
	umbel(p, 27, 24, 6.5, 7, LOV.st, LOV.fl2, LOV.fl, 1.3, 0.3);
	umbel(p, 54, 21, 6.5, 7, LOV.st, LOV.fl, LOV.fl2, 1.3, 0.3);
	return p.toString();
}

/* ---------- 5. Chervil ---------- */
const CHE = { rib: "#6aa555", a: "#a8dc8e", b: "#8ccb72", fl: "#f7f7f0", fl2: "#d9e0cf", st: "#7fb866" };
function chervil(st: St): string {
	const p = new Pen();
	p.s(CHE.st, 0.9, "").s(CHE.rib, 0.9, "");
	const fr: readonly (readonly [number, number, number])[] = by(
		st,
		[[-130, 13, 20], [-90, 15, 0], [-50, 13, -20]],
		[[-165, 22, 30], [-138, 28, 26], [-112, 34, 14], [-90, 36, 0], [-68, 34, -14], [-42, 28, -26], [-15, 22, -30]],
		[[-168, 22, 30], [-142, 26, 26], [-116, 30, 14], [-94, 30, 4], [-72, 30, -12], [-46, 26, -26], [-14, 22, -30]],
	);
	if (st === "bloom") {
		for (const [x, y] of [[26, 46], [36, 40], [47, 39], [57, 46]] as const) {
			p.s(CHE.st, 0.9, qSub(40, 86, (40 + x) / 2, 62, x, y + 3.6));
			umbel(p, x, y, 4.2, 5, CHE.st, CHE.fl, CHE.fl2, 0.9, 0.35, 3);
		}
	}
	for (const [a, l, b] of fr) fern(p, 40, 86, a, l, b, by(st, 4, 6, 6), CHE.rib, CHE.a, CHE.b, 9, 0.9, 1.1);
	return p.toString();
}

/* ---------- 6. Borage ---------- */
const BOR = { a: "#7f9e76", b: "#9bb58f", rib: "#5a7752", st: "#6f8c62", bl: "#4f86e3", bd: "#3c6cc8", eye: "#26222e", ring: "#eef2fb", bud: "#d892b8" };
function borStar(p: Pen, x: number, y: number, r: number, rot: number): void {
	for (let i = 0; i < 5; i++) p.f(BOR.bd, lensSub(x, y, rot + 36 + i * 72, r * 0.7, r * 0.22));
	for (let i = 0; i < 5; i++) p.f(BOR.bl, lensSub(x, y, rot + i * 72, r, r * 0.3));
	p.dot(x, y, r * 0.34, BOR.ring).f(BOR.eye, `M${f(x - r * 0.24)} ${f(y - r * 0.1)}L${f(x + r * 0.24)} ${f(y - r * 0.1)}L${f(x)} ${f(y + r * 0.45)}Z`);
}
function borage(st: St): string {
	const p = new Pen();
	p.s(BOR.st, 2.2, "").f(BOR.a, "").f(BOR.b, "");
	if (st === "sprout") {
		p.s(BOR.st, 2, "M40 87L40 76");
		return p.leaf(40, 76, -152, 8, 3.6, BOR.b, 2, BOR.rib).leaf(40, 76, -28, 8, 3.6, BOR.b, 2, BOR.rib).leaf(40, 76, -96, 9, 3.2, BOR.a, 0, BOR.rib).toString();
	}
	const ros: readonly (readonly [number, number])[] =
		st === "leafy"
			? [[-168, 21], [-145, 23], [-120, 26], [-98, 30], [-80, 29], [-58, 26], [-34, 23], [-12, 21]]
			: [[-170, 19], [-148, 21], [-124, 20], [-56, 20], [-32, 21], [-10, 19]];
	ros.forEach(([a, l], i) => p.leaf(40, 85, a, l, l * 0.3, i % 2 ? BOR.b : BOR.a, 0, BOR.rib, 0.9));
	if (st === "leafy") return p.toString();
	const S: Cubic[] = [
		[[40, 84], [38, 62], [30, 44], [23, 32]],
		[[40, 84], [41, 60], [44, 40], [45, 22]],
		[[40, 84], [44, 66], [54, 54], [61, 42]],
	];
	for (const P of S) {
		p.s(BOR.st, 2.2, cubSub(P));
		for (const t of [0.4, 0.68]) {
			const [x, y] = bez(P, t);
			const dir = dirAt(P, t);
			p.leaf(x, y, dir + (t < 0.5 ? -62 : 62), 10, 3.2, BOR.b, 0, BOR.rib);
		}
	}
	p.dot(22, 29, 1.3, BOR.bud).dot(24.5, 27.5, 1.1, BOR.bud).dot(46, 19.5, 1.3, BOR.bud).dot(62.5, 39.5, 1.2, BOR.bud).dot(44, 18, 1, BOR.bud);
	for (const [x, y, r, rot] of [[17, 35, 5.2, -10], [28, 38, 4.4, 20], [41, 26, 4.8, 5], [51, 27, 4.6, -18], [64, 46, 5, 12], [55, 45, 4, 30]] as const) borStar(p, x, y, r, rot);
	return p.toString();
}

/* ---------- 7. Fenugreek ---------- */
const FEN = { st: "#6d9a48", a: "#78b65a", b: "#96ca76", fl: "#f1ead0", pod: "#dcc47c", beak: "#a48e48" };
function trifol(p: Pen, x: number, y: number, deg: number, k: number): void {
	const [ex, ey] = pol(x, y, deg, 3.6 * k);
	p.s(FEN.st, 0.7, lnSub(x, y, ex, ey));
	p.f(FEN.a, leafSub(ex, ey, deg - 48, 5.4 * k, 1.6 * k) + leafSub(ex, ey, deg + 48, 5.4 * k, 1.6 * k)).f(FEN.b, leafSub(ex, ey, deg, 6 * k, 1.7 * k));
}
function fenugreek(st: St): string {
	const p = new Pen();
	p.s(FEN.st, 1.5, "").s(FEN.pod, 1.9, "").s(FEN.st, 0.7, "").f(FEN.a, "").f(FEN.b, "");
	const S: Cubic[] = by<Cubic[]>(
		st,
		[[[40, 87], [40, 80], [40, 74], [40, 69]]],
		[
			[[40, 87], [40, 72], [39, 58], [40, 44]],
			[[40, 72], [36, 66], [32, 60], [29, 54]],
		],
		[
			[[40, 87], [40, 68], [39, 46], [40, 24]],
			[[40, 72], [34, 64], [28, 54], [25, 42]],
			[[40, 66], [46, 58], [52, 50], [55, 38]],
		],
	);
	S.forEach((P, si) => {
		p.s(FEN.st, si ? 1.2 : 1.5, cubSub(P));
		const ts = st === "sprout" ? [1] : si ? [0.45, 1] : by(st, [1], [0.3, 0.6, 1], [0.25, 0.5, 0.75, 1]);
		ts.forEach((t, i) => {
			const [x, y] = bez(P, t);
			const dir = dirAt(P, t);
			const sd = (i + si) % 2 ? 1 : -1;
			trifol(p, x, y, t === 1 ? dir : dir + sd * 55, st === "sprout" ? 0.85 : 1);
			if (st === "bloom" && t > 0.2 && t < 1) {
				const a0 = sd > 0 ? -15 : -165;
				const [cx, cy] = pol(x, y, a0, 11);
				const [ex, ey] = pol(x, y, sd > 0 ? -48 : -132, 19);
				p.s(FEN.pod, 1.9, qSub(x, y, cx, cy, ex, ey));
				const [bx, by2] = pol(ex, ey, sd > 0 ? -75 : -105, 2.6);
				p.s(FEN.beak, 0.6, lnSub(ex, ey, bx, by2));
				p.f(FEN.fl, ovalSub(x + sd * 1.6, y - 1.6, 1.6, 1, sd * 30));
			}
		});
	});
	if (st === "sprout") p.leaf(40, 79, -155, 5, 2.4, FEN.b, 2).leaf(40, 79, -25, 5, 2.4, FEN.b, 2);
	if (st === "bloom") p.f(FEN.fl, ovalSub(40, 22.5, 1.8, 1.1, -90) + ovalSub(25, 40.5, 1.6, 1, -100) + ovalSub(55, 36.5, 1.6, 1, -80));
	return p.toString();
}

/* ---------- 8. Cumin ---------- */
const CUM = { st: "#7e9a5c", lf: "#86ad6f", fl: "#f2cad8", fl2: "#e2a0ba", seed: "#c09460" };
function cumin(st: St): string {
	const p = new Pen();
	p.s(CUM.st, 1, "").s(CUM.lf, 0.6, "");
	if (st === "sprout") {
		p.s(CUM.st, 1, "M40 87L40 73");
		thread(p, 40, 78, -140, 9, CUM.lf, 0.6, 1);
		thread(p, 40, 75, -45, 9, CUM.lf, 0.6, 1);
		thread(p, 40, 73, -95, 7, CUM.lf, 0.6, 1);
		return p.toString();
	}
	const tips: readonly (readonly [number, number])[] = by(st, [], [[24, 58], [33, 52], [43, 51], [53, 55], [58, 64]], [[17, 57], [27, 48], [38, 43], [49, 44], [59, 50], [65, 60]]);
	tips.forEach(([x, y], i) => {
		const P: Cubic = [[40, 87], [40, 76], [x + (40 - x) * 0.3, y + 14], [x, y]];
		p.s(CUM.st, 1, cubSub(P));
		for (const [j, t] of [0.3, 0.5, 0.7].entries()) {
			const [px, py] = bez(P, t);
			const dir = dirAt(P, t);
			const sd = (i + j) % 2 ? 1 : -1;
			thread(p, px, py, dir + sd * 42, 8, CUM.lf, 0.6, 1);
		}
		if (st === "bloom") {
			if (i % 2) {
				const hy = y + 3;
				for (let k = 0; k < 5; k++) {
					const a = -150 + k * 30;
					const [ex, ey] = pol(x, hy, a, 4.2);
					p.s(CUM.st, 0.5, lnSub(x, hy, ex, ey));
					p.f(CUM.seed, ovalSub(ex, ey, 1.6, 0.65, a));
				}
			} else umbel(p, x, y, 3.8, 5, CUM.st, CUM.fl, CUM.fl2, 1, 0.4, 2);
		} else thread(p, x, y, dirAt(P, 1), 6, CUM.lf, 0.6, 1);
	});
	return p.toString();
}

/* ---------- 9. Caraway ---------- */
const CAR = { st: "#5f8a45", a: "#4e8d45", b: "#66a457", rib: "#3a6e33", fl: "#f6f2ea", pk: "#e8c0cb", seed: "#9a6f3e" };
function caraway(st: St): string {
	const p = new Pen();
	p.s(CAR.st, 1.3, "").s(CAR.rib, 1, "");
	const fr: readonly (readonly [number, number, number])[] = by(
		st,
		[[-128, 13, 10], [-90, 15, 0], [-52, 13, -10]],
		[[-150, 28, 16], [-127, 32, 12], [-104, 36, 6], [-82, 36, -4], [-58, 32, -12], [-34, 28, -16]],
		[[-166, 22, 16], [-142, 24, 14], [-118, 24, 8], [-64, 24, -8], [-40, 24, -14], [-14, 22, -16]],
	);
	if (st === "bloom") {
		const S: Cubic[] = [
			[[40, 86], [38, 62], [32, 42], [27, 26]],
			[[40, 86], [40, 60], [42, 36], [43, 18]],
			[[40, 86], [43, 64], [51, 48], [58, 33]],
		];
		for (const P of S) {
			p.s(CAR.st, 1.3, cubSub(P));
			const [x, y] = bez(P, 0.5);
			fern(p, x, y, dirAt(P, 0.5) + (P[3][0] < 40 ? -50 : 50), 8, 0, 3, CAR.rib, CAR.a, CAR.b, 6, 0.7, 1);
		}
		umbel(p, 27, 23, 7, 7, CAR.st, CAR.fl, CAR.pk, 0.85, 0.35, 3);
		umbel(p, 43, 15, 7.5, 7, CAR.st, CAR.pk, CAR.fl, 0.85, 0.35, 3);
		const hy = 36;
		for (let k = 0; k < 7; k++) {
			const a = -160 + k * 23.3;
			const [ex, ey] = pol(58, hy, a, 6.5);
			p.s(CAR.st, 0.5, lnSub(58, hy, ex, ey));
			p.s(CAR.seed, 0.9, qSub(ex - 1, ey + 0.6, ex, ey - 1.6, ex + 1.1, ey + 0.4));
		}
	}
	for (const [a, l, b] of fr) fern(p, 40, 86, a, l, b, by(st, 4, 6.5, 6), CAR.rib, CAR.b, CAR.a, 10, 1, 1.2);
	return p.toString();
}

/* ---------- 10. Anise ---------- */
const ANI = { st: "#7e9e66", a: "#8fb27a", b: "#a9c595", ray: "#a2bf8c", fl: "#f4eed6", fl2: "#e2dcbc" };
function anise(st: St): string {
	const p = new Pen();
	p.s(ANI.st, 1, "").s(ANI.st, 1.3, "").f(ANI.a, "").f(ANI.b, "");
	const basal: readonly (readonly [number, number])[] = by(st, [[-140, 7], [-90, 9], [-40, 7]], [[-165, 14], [-140, 17], [-115, 19], [-65, 19], [-40, 17], [-15, 14]], [[-168, 13], [-146, 15], [-34, 15], [-12, 13]]);
	const k = by(st, 0.65, 1, 1);
	basal.forEach(([a, l], i) => {
		const [ex, ey] = pol(40, 86, a, l);
		p.s(ANI.st, 1, lnSub(40, 86, ex, ey));
		p.f(i % 2 ? ANI.a : ANI.b, toothSub(ex, ey, a - 20, 6 * k, 3.6 * k, 3, 0.5) + toothSub(ex, ey, a + 25, 5 * k, 3 * k, 3, 0.5));
	});
	if (st === "sprout") return p.toString();
	const S: Cubic[] = by<Cubic[]>(
		st,
		[],
		[
			[[40, 86], [39, 72], [37, 60], [35, 48]],
			[[40, 86], [41, 74], [44, 62], [47, 52]],
		],
		[
			[[40, 86], [38, 64], [34, 42], [31, 30]],
			[[40, 86], [42, 66], [48, 50], [53, 38]],
			[[40, 86], [39, 74], [34, 64], [22, 56]],
		],
	);
	S.forEach((P, i) => {
		p.s(ANI.st, 1.3, cubSub(P));
		for (const t of [0.45, 0.75]) {
			const [x, y] = bez(P, t);
			const dir = dirAt(P, t);
			thread(p, x, y, dir + ((i + (t > 0.5 ? 1 : 0)) % 2 ? 40 : -40), 7, ANI.a, 0.6, 1);
		}
		if (st === "leafy") thread(p, P[3][0], P[3][1], dirAt(P, 1), 6, ANI.a, 0.6, 1);
	});
	if (st === "bloom") {
		umbel(p, 31, 20, 10, 9, ANI.ray, ANI.fl, ANI.fl2, 0.9, 0.42, 4);
		umbel(p, 53, 29, 9, 8, ANI.ray, ANI.fl2, ANI.fl, 0.85, 0.42, 4);
		umbel(p, 20, 49, 6, 6, ANI.ray, ANI.fl, ANI.fl2, 0.8, 0.42, 3);
	}
	return p.toString();
}

/* ---------- 11. Nigella ---------- */
const NIG = { th: "#6aa865", st: "#5f9a55", pet: "#6f97e3", pet2: "#a2bdf2", eye: "#4d6b3a", stm: "#2f3d63", pod: "#b4c497", podS: "#8a6a9c" };
function nigFlower(p: Pen, x: number, y: number, r: number): void {
	for (let k = 0; k < 9; k++) {
		const [ex, ey] = pol(x, y, k * 40 + 10, r * 2);
		p.s(NIG.th, 0.6, qSub(x, y, (x + ex) / 2 + 1, (y + ey) / 2 - 1, ex, ey));
	}
	for (let k = 0; k < 5; k++) {
		const [cx, cy] = pol(x, y, k * 72 - 90, r * 0.95);
		p.f(NIG.pet, ovalSub(cx, cy, r, r * 0.7, k * 72 - 90));
	}
	for (let k = 0; k < 5; k++) {
		const [cx, cy] = pol(x, y, k * 72 - 54, r * 0.55);
		p.f(NIG.pet2, ovalSub(cx, cy, r * 0.4, r * 0.25, k * 72 - 54));
	}
	p.dot(x, y, r * 0.42, NIG.eye);
	for (let k = 0; k < 5; k++) {
		const [ex, ey] = pol(x, y, k * 72 - 90, r * 0.7);
		p.s(NIG.stm, 0.5, lnSub(x, y, ex, ey));
	}
}
function nigella(st: St): string {
	const p = new Pen();
	p.s(NIG.st, 1.2, "").s(NIG.th, 0.6, "");
	const S: Cubic[] = by<Cubic[]>(
		st,
		[[[40, 87], [40, 81], [40, 76], [40, 72]]],
		[
			[[40, 87], [39, 74], [35, 62], [31, 50]],
			[[40, 87], [40, 72], [41, 58], [42, 44]],
			[[40, 87], [42, 76], [47, 66], [52, 56]],
		],
		[
			[[40, 87], [39, 66], [34, 48], [29, 32]],
			[[40, 87], [41, 64], [46, 44], [50, 24]],
			[[40, 87], [43, 72], [52, 60], [60, 50]],
			[[40, 87], [37, 76], [28, 68], [20, 62]],
		],
	);
	S.forEach((P, i) => {
		p.s(NIG.st, 1.2, cubSub(P));
		const ts = st === "sprout" ? [0.5] : [0.25, 0.42, 0.6, 0.78];
		ts.forEach((t, j) => {
			const [x, y] = bez(P, t);
			const dir = dirAt(P, t);
			thread(p, x, y, dir + ((i + j) % 2 ? 42 : -42), by(st, 7, 8, 8), NIG.th, 0.6, 1);
		});
		if (st === "leafy") thread(p, P[3][0], P[3][1], dirAt(P, 1), 6, NIG.th, 0.6, 1);
	});
	if (st === "sprout") thread(p, 40, 72, -90, 6, NIG.th, 0.6, 1);
	if (st === "bloom") {
		nigFlower(p, 29, 30, 4.4);
		nigFlower(p, 50, 22, 4.8);
		nigFlower(p, 19, 60, 3.6);
		const [x, y] = [61, 44];
		p.f(NIG.pod, ovalSub(x, y, 4.8, 3.6, -90));
		p.s(NIG.podS, 0.6, `M${x} ${y - 4.6}Q${x - 3.3} ${y} ${x} ${y + 4.6}M${x} ${y - 4.6}Q${x + 3.3} ${y} ${x} ${y + 4.6}M${x} ${y - 4.6}L${x} ${y + 4.6}`);
		for (let k = 0; k < 5; k++) {
			const [ex, ey] = pol(x, y - 4.2, -90 + (k - 2) * 22, 4);
			p.s(NIG.st, 0.6, lnSub(x, y - 4.2, ex, ey));
		}
	}
	return p.toString();
}

/* ---------- 12. Saffron crocus ---------- */
const SAF = { a: "#4d8b4a", b: "#69a65f", tube: "#d6e2cc", pet: "#a77fdb", pet2: "#8058bb", vein: "#6a3fa3", sty: "#e0442a", anth: "#ecc53b" };
function saffronFlower(p: Pen, x: number, y: number, h: number): void {
	p.s(SAF.tube, 1.6, lnSub(x, 87, x, y));
	p.f(SAF.pet2, lensSub(x, y, -116, h, 3) + lensSub(x, y, -64, h, 3) + lensSub(x, y, -90, h * 1.05, 2.8));
	p.f(SAF.anth, lensSub(x - 1, y - 2, -98, h * 0.6, 0.6) + lensSub(x + 1, y - 2, -82, h * 0.6, 0.6));
	p.f(SAF.pet, lensSub(x, y, -101, h * 0.92, 3.3) + lensSub(x, y, -79, h * 0.92, 3.3));
	p.s(SAF.vein, 0.5, lnSub(x - 0.6, y - 1, x - 1.8, y - h * 0.65) + lnSub(x + 0.6, y - 1, x + 1.8, y - h * 0.65));
	p.s(SAF.sty, 1.1, qSub(x, y - 4, x - 3.5, y - h - 3, x - 6.5, y - h + 2) + qSub(x, y - 4, x + 0.5, y - h - 4, x + 2, y - h - 2.5) + qSub(x, y - 4, x + 3.5, y - h - 2.5, x + 6.5, y - h + 2.5));
}
function saffron(st: St): string {
	const p = new Pen();
	p.s(SAF.a, 1.3, "").s(SAF.b, 1.3, "").s(SAF.tube, 1.6, "").f(SAF.pet2, "").f(SAF.anth, "").f(SAF.pet, "").s(SAF.vein, 0.5, "").s(SAF.sty, 1.1, "");
	const n = by(st, 5, 10, 12);
	const H = by(st, 17, 36, 44);
	const W = by(st, 12, 30, 40);
	for (let i = 0; i < n; i++) {
		const u = i / (n - 1);
		const x0 = 40 + (u - 0.5) * 6;
		const tx = 40 + (u - 0.5) * W;
		const ty = 87 - H * CHV_J[(i + 3) % 13]! * (0.6 + 0.4 * Math.sin(u * Math.PI));
		p.s(i % 2 ? SAF.a : SAF.b, 1.3, qSub(x0, 87, x0 + (tx - x0) * 0.1, (87 + ty) / 2, tx, ty));
	}
	if (st === "leafy") {
		p.s(SAF.tube, 1.6, "M41 87L41 81");
		p.f(SAF.pet2, lensSub(41, 82, -90, 11, 2.4)).f(SAF.pet, lensSub(41, 82, -95, 10, 1.5));
	}
	if (st === "bloom") {
		saffronFlower(p, 28, 79, 14);
		saffronFlower(p, 52, 78, 15);
		saffronFlower(p, 40, 83, 14);
	}
	return p.toString();
}

/* ---------- 13. Black pepper ---------- */
const BP = { pole: "#8a6242", vine: "#5f7a3a", a: "#3f8d4a", b: "#5aa85a", rib: "#2b6234", red: "#cc3f2e", grn: "#8fb246", org: "#e07a35" };
function blackPepper(st: St): string {
	const p = new Pen();
	const top = by(st, 64, 30, 8);
	const vTop = by(st, 70, 36, 12);
	p.s(BP.pole, 3, `M40 87L40 ${top}`).s(BP.vine, 1.2, "").f(BP.a, "").f(BP.b, "").s(BP.rib, 0.7, "");
	let d = "M40 86";
	for (let y = 84; y >= vTop; y -= 2) d += `L${f(40 + 3 * Math.sin((86 - y) / 5))} ${y}`;
	p.s(BP.vine, 1.2, d);
	const step = by(st, 6, 7, 7.5);
	const L = by(st, 6.5, 8.5, 9);
	let i = 0;
	const spikes: [number, number, number][] = [];
	for (let y = 80; y >= vTop + 1; y -= step, i++) {
		const x = 40 + 3 * Math.sin((86 - y) / 5);
		const sd = i % 2 ? 1 : -1;
		const a = sd > 0 ? 12 : 168;
		p.leaf(x + sd * 0.5, y, a, L, L * 0.48, i % 3 ? BP.a : BP.b, 4, BP.rib);
		if (st === "bloom" && i % 2 === 0 && y < 78) spikes.push([x + sd * -4.5, y, -sd]);
	}
	if (st !== "sprout") p.leaf(40, vTop, -90, L * 0.6, L * 0.3, BP.b, 4, BP.rib);
	for (const [x, y] of spikes) {
		p.s(BP.vine, 1.2, lnSub(x, y, x, y + 2.5));
		for (let k = 0; k < 8; k++) {
			const c = k < 2 ? BP.grn : k < 4 ? (k % 2 ? BP.org : BP.red) : BP.red;
			const r = 1.1;
			p.dot(x - 0.95, y + 3.5 + k * 1.9, r, c).dot(x + 0.95, y + 4.3 + k * 1.9, r, k < 2 ? BP.grn : BP.red);
		}
	}
	return p.toString();
}

/* ---------- 14. Cardamom ---------- */
const CRD = { cane: "#5f8f45", a: "#4e9a4e", b: "#6fb562", rib: "#2f6a35", pod: "#b9d088", podD: "#8fa862", fl: "#f6f3ea", lip: "#9a5ab4", stalk: "#8a9a5a" };
function cardamom(st: St): string {
	const p = new Pen();
	p.s(CRD.cane, 1.8, "").f(CRD.a, "").f(CRD.b, "").s(CRD.rib, 0.6, "");
	const S: Cubic[] = by<Cubic[]>(
		st,
		[[[40, 87], [40, 80], [40, 74], [40, 68]]],
		[
			[[40, 87], [37, 72], [32, 58], [28, 46]],
			[[40, 87], [40, 70], [41, 56], [42, 42]],
			[[40, 87], [43, 74], [49, 62], [54, 52]],
		],
		[
			[[40, 87], [38, 66], [32, 40], [28, 16]],
			[[40, 87], [41, 62], [44, 36], [47, 10]],
			[[40, 87], [43, 70], [50, 52], [56, 34]],
		],
	);
	const n = by(st, 3, 6, 8);
	const L = by(st, 10, 16, 18);
	for (const P of S) {
		p.s(CRD.cane, 1.8, cubSub(P));
		for (let i = 0; i < n; i++) {
			const t = 0.3 + (0.7 * i) / (n - 1);
			const [x, y] = bez(P, t);
			const dir = dirAt(P, t);
			const sd = i % 2 ? 1 : -1;
			const a = i === n - 1 ? dir + sd * 14 : sd > 0 ? 18 - 48 * t : 162 + 48 * t;
			p.leaf(x, y, a, L * (1 - 0.2 * t), L * 0.2, i % 2 ? CRD.b : CRD.a, 1, CRD.rib);
		}
	}
	if (st === "bloom") {
		p.s(CRD.stalk, 0.9, "M37 86Q27 82.5 15 84.5M43 86Q53 82.5 65 84.5");
		for (const [x, y, a] of [[31, 84, 200], [24, 83.6, 175], [17, 84.2, 190], [49, 84, -20], [56, 83.6, 5], [63, 84.2, -10]] as const) p.f(CRD.pod, ovalSub(x, y - 1, 2.3, 1.5, a));
		p.s(CRD.podD, 0.4, "M29.2 83L32.8 83M22.2 82.6L25.8 82.6M47.2 83L50.8 83M54.2 82.6L57.8 82.6");
		for (const [x, y] of [[20, 80.5], [60, 80.5]] as const) p.f(CRD.fl, lensSub(x, y + 1, -125, 4, 1.4) + lensSub(x, y + 1, -55, 4, 1.4)).dot(x, y + 0.5, 1.2, CRD.lip);
	}
	return p.toString();
}

/* ---------- 15. Clove tree ---------- */
const CLV = { trunk: "#7a5a42", base: "#2c6339", a: "#3d8a4c", b: "#56a05c", young: "#c97f6e", bud: "#c8344a", tip: "#ec8f8a", stalk: "#b25a48" };
function canopy(p: Pen, cx: number, cy: number, rx: number, ry: number, n: number, len: number, a: string, b: string, taper = 0): void {
	for (let i = 0; i < n; i++) {
		const r = Math.sqrt((i + 0.5) / n);
		const ang = i * 137.5;
		const yy = Math.sin(ang * D) * r;
		const w = 1 - taper * (1 - yy) * 0.5;
		const x = cx + Math.cos(ang * D) * r * rx * w;
		const y = cy + yy * ry;
		const out = Math.atan2(y - cy, (x - cx) * (ry / rx)) / D;
		p.f(i % 2 ? a : b, lensSub(x - Math.cos(out * D) * len * 0.4, y - Math.sin(out * D) * len * 0.4, out, len, len * 0.3));
	}
}
function cloveTree(st: St): string {
	const p = new Pen();
	if (st === "sprout") {
		p.s(CLV.trunk, 1.6, "M40 87L40 69");
		return p.leaf(40, 80, -160, 7, 2.5, CLV.a, 1).leaf(40, 80, -20, 7, 2.5, CLV.a, 1).leaf(40, 72, -140, 6, 2.2, CLV.young, 1).leaf(40, 72, -40, 6, 2.2, CLV.young, 1).leaf(40, 69, -90, 4.5, 1.6, CLV.young, 1).toString();
	}
	const [top, bot, hw] = by(st, [0, 0, 0], [38, 74, 13], [10, 66, 21]);
	const mid = (top + bot) / 2;
	p.s(CLV.trunk, by(st, 2, 2.4, 3.2), `M40 87L40 ${bot - 6}`);
	p.f(CLV.base, `M40 ${top}C${40 + hw * 0.7} ${top + 6} ${40 + hw * 1.1} ${mid} ${40 + hw * 0.9} ${bot - 4}Q40 ${bot + 3} ${40 - hw * 0.9} ${bot - 4}C${40 - hw * 1.1} ${mid} ${40 - hw * 0.7} ${top + 6} 40 ${top}Z`);
	canopy(p, 40, mid + 1, hw * 0.85, (bot - top) / 2 - 1, by(st, 0, 22, 44), by(st, 0, 5, 6.5), CLV.a, CLV.b, 0.8);
	if (st === "leafy") return p.leaf(40, top + 1, -90, 4, 1.4, CLV.young, 1).leaf(32, 50, -130, 4, 1.4, CLV.young, 1).toString();
	for (const [x, y] of [[40, 11], [30, 20], [50, 19], [24, 34], [57, 32], [21, 50], [60, 48], [33, 30], [47, 40]] as const) {
		for (let k = 0; k < 4; k++) {
			const a = -90 + (k - 1.5) * 26;
			const [ex, ey] = pol(x, y, a, 3.2);
			p.s(CLV.stalk, 0.6, lnSub(x, y, ex, ey)).dot(ex, ey, 1.1, k % 2 ? CLV.bud : CLV.tip);
		}
	}
	return p.toString();
}

/* ---------- 16. Cinnamon tree ---------- */
const CIN = { trunk: "#9a5a36", a: "#3d7a3e", b: "#52934c", rib: "#24502a", red: "#c4573f", red2: "#dd7a5c", fl: "#efe5bf", quill: "#b0703f", qe: "#7a4426" };
function cinnamon(st: St): string {
	const p = new Pen();
	p.s(CIN.trunk, by(st, 1.6, 2.4, 3.2), "").s(CIN.trunk, 1.6, "").f(CIN.a, "").f(CIN.b, "").f(CIN.red, "").s(CIN.rib, 0.6, "");
	if (st === "sprout") {
		p.s(CIN.trunk, 1.6, "M40 87L40 68");
		return p.leaf(40, 80, -160, 8, 2.8, CIN.a, 1, CIN.rib).leaf(40, 76, -20, 8, 2.8, CIN.b, 1, CIN.rib).leaf(40, 69, -70, 7, 2.4, CIN.red, 1).leaf(40, 70, -120, 6, 2, CIN.red2, 1).toString();
	}
	const tw: [number, number, number, number][] =
		st === "leafy"
			? [[40, 66, 28, 52], [40, 62, 52, 50], [40, 66, 40, 42]]
			: [[40, 58, 18, 40], [40, 54, 30, 26], [40, 52, 50, 22], [40, 56, 63, 36], [40, 62, 26, 52], [40, 62, 56, 52]];
	p.s(CIN.trunk, by(st, 1.6, 2.4, 3.2), `M40 87L40 ${tw[0]![1]}`);
	tw.forEach(([x0, y0, x1, y1], i) => {
		p.s(CIN.trunk, 1.6, qSub(x0, y0, (x0 + x1) / 2, y0 - 2, x1, y1));
		const out = Math.atan2(y1 - y0, x1 - x0) / D;
		const L = by(st, 0, 10, 11);
		for (const [o, k] of [[-70, 0.9], [-20, 1], [30, 1], [80, 0.9], [130, 0.8]] as const) {
			p.leaf(x1, y1, out + o, L * k, L * k * 0.3, (i + o) % 2 ? CIN.a : CIN.b, 1, CIN.rib);
		}
		const [mx, my] = [(x0 + x1 * 2) / 3, (y0 + y1 * 2) / 3 - 1];
		p.leaf(mx, my, out - 80, L * 0.85, L * 0.26, CIN.b, 1, CIN.rib).leaf(mx, my, out + 75, L * 0.85, L * 0.26, CIN.a, 1, CIN.rib);
		p.f(CIN.red, leafSub(x1, y1, 100 + (x1 < 40 ? 20 : -20), L * 0.8, L * 0.22, 1));
	});
	if (st === "bloom") {
		for (const [x, y] of [[18, 34], [30, 20], [50, 16], [63, 30]] as const) {
			for (let k = 0; k < 5; k++) {
				const [ex, ey] = pol(x, y, -90 + (k - 2) * 30, 3.4);
				p.dot(ex, ey, 0.95, CIN.fl);
			}
		}
		p.s(CIN.quill, 2.4, "M50 85.6L63 84M51 83.2L62 81.8").dot(63.2, 84, 1.2, CIN.qe).dot(62.2, 81.8, 1.2, CIN.qe);
	}
	return p.toString();
}

/* ---------- 17. Nutmeg tree ---------- */
const NUT = { trunk: "#6f5a4a", base: "#28603f", a: "#3a8253", b: "#4d9a62", fr: "#ecc964", crease: "#c9a440", seed: "#5b3a2a", mace: "#d8322a" };
function nutmeg(st: St): string {
	const p = new Pen();
	if (st === "sprout") {
		p.s(NUT.trunk, 1.6, "M40 87L40 68");
		return p.leaf(40, 79, -165, 8, 3, NUT.a, 0).leaf(40, 75, -15, 8, 3, NUT.b, 0).leaf(40, 69, -110, 6, 2.4, NUT.b, 0).leaf(40, 68, -60, 6, 2.4, NUT.a, 0).toString();
	}
	const [top, bot, hw] = by(st, [0, 0, 0], [40, 70, 17], [14, 58, 27]);
	p.s(NUT.trunk, by(st, 2.4, 2.4, 3.4), `M40 87L40 ${bot - 6}M40 ${bot + 4}L${40 - hw * 0.3} ${bot - 4}M40 ${bot + 6}L${40 + hw * 0.3} ${bot - 4}`);
	p.f(NUT.base, `M${40 - hw} ${bot - 4}C${40 - hw - 1} ${top + 6} ${40 - hw * 0.4} ${top} 40 ${top}C${40 + hw * 0.4} ${top} ${41 + hw} ${top + 6} ${40 + hw} ${bot - 4}Q40 ${bot + 4} ${40 - hw} ${bot - 4}Z`);
	canopy(p, 40, (top + bot) / 2 + 1, hw - 3, (bot - top) / 2 - 2, by(st, 0, 26, 46), by(st, 0, 5.5, 6.5), NUT.a, NUT.b);
	if (st === "leafy") return p.toString();
	for (const [x, y] of [[22, 52], [40, 57], [61, 44], [31, 34]] as const) {
		p.s(NUT.trunk, 0.6, lnSub(x, y - 4, x, y - 2.5));
		p.dot(x, y, 3.4, NUT.fr).s(NUT.crease, 0.5, qSub(x, y - 3.2, x + 1.4, y, x, y + 3.2));
	}
	for (const [x, y] of [[52, 56], [48, 28]] as const) {
		p.s(NUT.trunk, 0.6, lnSub(x, y - 5, x, y - 3.5));
		p.f(NUT.fr, `M${x - 1} ${y - 3.6}A3.6 3.6 0 0 0 ${x - 1} ${y + 3.6}Q${x - 3} ${y} ${x - 1} ${y - 3.6}ZM${x + 1} ${y - 3.6}A3.6 3.6 0 0 1 ${x + 1} ${y + 3.6}Q${x + 3} ${y} ${x + 1} ${y - 3.6}Z`);
		p.f(NUT.seed, ovalSub(x, y, 2.6, 1.9, 90));
		p.s(NUT.mace, 0.65, `M${x} ${y - 2.6}Q${x - 2.2} ${y} ${x - 0.4} ${y + 2.6}M${x} ${y - 2.6}Q${x + 2.4} ${y - 0.4} ${x + 0.6} ${y + 2.6}M${x - 1.5} ${y - 1}L${x + 1.6} ${y + 0.8}`);
	}
	return p.toString();
}

/* ---------- 18. Stevia ---------- */
const STV = { st: "#5f8f3f", a: "#5aa84a", b: "#7cc062", fl: "#f8f8f4", fl2: "#ddd5e6" };
function stevia(st: St): string {
	const p = new Pen();
	p.s(STV.st, 1, "").f(STV.a, "").f(STV.b, "");
	const tips: readonly (readonly [number, number])[] = by(st, [[40, 70]], [[26, 52], [34, 46], [42, 44], [50, 47], [56, 54]], [[18, 46], [26, 38], [34, 33], [42, 31], [50, 33], [57, 38], [63, 46]]);
	const ts = by(st, [0.5, 1], [0.4, 0.7, 1], [0.35, 0.58, 0.8]);
	tips.forEach(([x, y], i) => {
		const P: Cubic = [[40, 87], [40, 78], [x + (40 - x) * 0.25, y + 18], [x, y]];
		p.s(STV.st, 1, cubSub(P));
		for (const t of ts) {
			const [px, py] = bez(P, t);
			const dir = dirAt(P, t);
			const l = by(st, 6, 7.5, 7.5) * (1 - 0.3 * t);
			if (t === 1) p.f(STV.b, leafSub(px, py, dir, l * 0.8, l * 0.2, 1));
			p.f((i + t * 10) % 2 > 1 ? STV.a : STV.b, leafSub(px, py, dir - 55, l, l * 0.24, 1) + leafSub(px, py, dir + 55, l, l * 0.24, 1));
		}
		if (st === "bloom") {
			for (let k = 0; k < 5; k++) {
				const [ex, ey] = pol(x, y, -90 + (k - 2) * 28, 3.4);
				p.s(STV.st, 0.5, lnSub(x, y, ex, ey));
				p.dot(ex, ey - 0.4, 1.15, STV.fl).dot(ex - 0.5, ey - 1.2, 0.5, STV.fl2);
			}
		}
	});
	return p.toString();
}

/* ---------- 19. Shiso ---------- */
const SHI = { st: "#5e2a4f", a: "#8a3a74", b: "#a85296", rib: "#4a1a40", fl: "#f0bad8", fl2: "#d98fbb" };
function shiso(st: St): string {
	const p = new Pen();
	p.s(SHI.st, 2, "").s(SHI.st, 1.4, "").f(SHI.a, "").f(SHI.b, "").s(SHI.rib, 0.6, "");
	const pair = (x: number, y: number, dir: number, l: number, c: string) => {
		p.f(c, toothSub(x, y, dir - 58, l, l * 0.5, 5, 0.32, 0.84) + toothSub(x, y, dir + 58, l, l * 0.5, 5, 0.32, 0.84));
		p.s(SHI.rib, 0.6, ribSub(x, y, dir - 58, l) + ribSub(x, y, dir + 58, l));
	};
	const top = by(st, 72, 44, 26);
	const M: Cubic = [[40, 87], [40, 76], [41, 56], [40, top]];
	p.s(SHI.st, 2, cubSub(M));
	if (st === "sprout") {
		pair(40, 76, -90, 7, SHI.b);
		p.f(SHI.a, toothSub(40, 72, -90, 5, 2.2, 3, 0.35));
		return p.toString();
	}
	if (st === "bloom") {
		for (const B of [
			[[40, 70], [34, 62], [29, 54], [26, 42]],
			[[40, 66], [46, 58], [51, 50], [54, 38]],
		] as Cubic[]) {
			p.s(SHI.st, 1.4, cubSub(B));
			pair(...bez(B, 0.55), dirAt(B, 0.55), 9, SHI.b);
		}
	}
	const pl = by(st, [], [[0.25, 14, SHI.a], [0.55, 12, SHI.b], [0.85, 9, SHI.a]], [[0.15, 15, SHI.a], [0.42, 13, SHI.a], [0.68, 10, SHI.b]]) as [number, number, string][];
	for (const [t, l, c] of pl) pair(...bez(M, t), dirAt(M, t), l, c);
	if (st === "leafy") p.f(SHI.b, toothSub(40, top, -90, 7, 3, 3, 0.35));
	else {
		for (const [x, y, h] of [[40, 26, 16], [26, 42, 12], [54, 38, 12]] as const) {
			p.s(SHI.st, 1.4, lnSub(x, y, x, y - h));
			for (let k = 0; k < 6; k++) {
				const yy = y - 1.5 - (k * (h - 2)) / 6;
				const r = 1.25 - k * 0.1;
				p.dot(x - 1.3, yy, r, k % 2 ? SHI.fl : SHI.fl2).dot(x + 1.3, yy - 0.9, r, k % 2 ? SHI.fl2 : SHI.fl);
			}
		}
	}
	return p.toString();
}

/* ---------- 20. Lemon verbena ---------- */
const LV = { wood: "#8a6a4c", a: "#8fc35c", b: "#a9d276", rib: "#5f8a3a", fl: "#efe8f8", fl2: "#c7b2e6" };
function lemonVerbena(st: St): string {
	const p = new Pen();
	p.s(LV.wood, 1.5, "").f(LV.a, "").f(LV.b, "");
	const S: Cubic[] = by<Cubic[]>(
		st,
		[[[40, 87], [40, 80], [40, 75], [40, 70]]],
		[
			[[40, 87], [38, 74], [32, 62], [27, 50]],
			[[40, 87], [40, 70], [41, 56], [41, 42]],
			[[40, 87], [42, 74], [48, 62], [54, 52]],
		],
		[
			[[40, 87], [36, 72], [26, 56], [18, 40]],
			[[40, 87], [38, 68], [33, 44], [31, 22]],
			[[40, 87], [41, 66], [44, 38], [47, 14]],
			[[40, 87], [43, 70], [52, 50], [60, 30]],
			[[40, 87], [42, 78], [55, 70], [64, 58]],
		],
	);
	const ts = by(st, [0.6, 1], [0.35, 0.6, 0.85, 1], [0.3, 0.5, 0.7, 0.88]);
	const L = by(st, 7, 10, 10.5);
	S.forEach((P, si) => {
		p.s(LV.wood, by(st, 1.2, 1.5, 1.5), cubSub(P));
		ts.forEach((t, i) => {
			const [x, y] = bez(P, t);
			const dir = dirAt(P, t);
			const l = L * (1 - 0.3 * t);
			const c = (i + si) % 2 ? LV.a : LV.b;
			if (t === 1) p.f(c, leafSub(x, y, dir, l * 0.8, l * 0.15, 1));
			p.f(c, leafSub(x, y, dir - 58, l, l * 0.15, 1) + leafSub(x, y, dir + 58, l, l * 0.15, 1) + leafSub(x, y, dir + (i % 2 ? 125 : -125), l * 0.85, l * 0.15, 1));
		});
		if (st === "bloom") {
			const [x, y] = P[3];
			const dir = dirAt(P, 1);
			for (let k = 0; k < 3; k++) {
				const a = dir + (k - 1) * 38;
				const [ex, ey] = pol(x, y, a, 7);
				p.s(LV.wood, 0.5, lnSub(x, y, ex, ey));
				for (let j = 0; j < 4; j++) {
					const [dx, dy] = pol(x, y, a + (j % 2 ? 12 : -12), 2.8 + j * 1.6);
					p.dot(dx, dy, 0.9, j % 2 ? LV.fl : LV.fl2);
				}
			}
		}
	});
	return p.toString();
}

/* ---------- 21. Vietnamese coriander ---------- */
const VC = { st: "#9a4f45", node: "#7a3a35", a: "#5c9e52", b: "#78b567", mark: "#5a2236", fl: "#ea93b2" };
function vietCoriander(st: St): string {
	const p = new Pen();
	p.s(VC.st, 1.3, "").f(VC.a, "").f(VC.b, "").s(VC.mark, 0.9, "");
	const S: Cubic[] = by<Cubic[]>(
		st,
		[[[40, 87], [40, 82], [40, 77], [41, 72]]],
		[
			[[40, 87], [34, 80], [24, 74], [16, 70]],
			[[40, 87], [38, 74], [34, 62], [32, 52]],
			[[40, 87], [42, 74], [46, 62], [49, 52]],
			[[40, 87], [46, 80], [56, 74], [64, 70]],
		],
		[
			[[40, 87], [32, 82], [20, 78], [9, 74]],
			[[40, 87], [36, 76], [26, 62], [20, 52]],
			[[40, 87], [39, 70], [36, 54], [35, 40]],
			[[40, 87], [42, 70], [46, 54], [49, 38]],
			[[40, 87], [45, 76], [55, 64], [61, 52]],
			[[40, 87], [48, 82], [60, 78], [71, 74]],
		],
	);
	const ts = by(st, [0.5, 1], [0.35, 0.65, 1], [0.3, 0.55, 0.8, 1]);
	const L = by(st, 8, 12, 13);
	S.forEach((P, si) => {
		p.s(VC.st, 1.3, cubSub(P));
		ts.forEach((t, i) => {
			const [x, y] = bez(P, t);
			const dir = dirAt(P, t);
			const a = t === 1 ? dir : dir + ((i + si) % 2 ? 42 : -42);
			const l = L * (t === 1 ? 0.75 : 1);
			const w = l * 0.19;
			p.f(i % 2 ? VC.a : VC.b, leafSub(x, y, a, l, w, 1));
			const m = xf(x, y, a);
			p.s(VC.mark, 0.9, `M${m(l * 0.3, -w * 0.6)}L${m(l * 0.47, 0)}L${m(l * 0.3, w * 0.6)}`);
			if (t < 1) p.dot(x, y, 1, VC.node);
		});
		if (st === "bloom" && si > 0 && si < 5 && si % 2) {
			const [x, y] = P[3];
			for (let k = 0; k < 4; k++) p.dot(x + (k % 2 ? 0.8 : -0.8), y - 3 - k * 1.8, 1.05, VC.fl);
		}
	});
	return p.toString();
}

/* ---------- 22. Curry leaf ---------- */
const CUR = { trunk: "#7a5a40", rach: "#4b7a3a", a: "#3f8d44", b: "#5aa65a", fl: "#f4f1e4", berry: "#3a2440", hl: "#8d6a95", red: "#b8433f" };
function pinnate(p: Pen, x: number, y: number, deg: number, len: number, n: number, bend: number): void {
	const P: Cubic = [[x, y], pol(x, y, deg, len * 0.35), pol(x, y, deg + bend * 0.6, len * 0.7), pol(x, y, deg + bend, len)];
	p.s(CUR.rach, 0.6, cubSub(P));
	for (let i = 0; i < n; i++) {
		const t = 0.25 + (0.75 * i) / n;
		const [px, py] = bez(P, t);
		const dir = dirAt(P, t);
		const l = len * 0.3 * (1 - 0.25 * t);
		p.f(i % 2 ? CUR.a : CUR.b, leafSub(px, py, dir - 55, l, l * 0.34, 1) + leafSub(px, py, dir + 55, l, l * 0.34, 1));
	}
	const [ex, ey] = P[3];
	p.f(CUR.b, leafSub(ex, ey, dirAt(P, 1), len * 0.28, len * 0.1, 1));
}
function curryLeaf(st: St): string {
	const p = new Pen();
	p.s(CUR.trunk, 2.4, "").s(CUR.trunk, 1.4, "").s(CUR.rach, 0.6, "").f(CUR.a, "").f(CUR.b, "");
	if (st === "sprout") {
		p.s(CUR.trunk, 1.4, "M40 87L40 72");
		pinnate(p, 40, 74, -150, 10, 3, 20);
		pinnate(p, 40, 72, -40, 10, 3, -20);
		return p.toString();
	}
	if (st === "leafy") {
		p.s(CUR.trunk, 2.4, "M40 87L40 52").s(CUR.trunk, 1.4, "M40 66Q34 60 30 54M40 60Q46 54 50 48");
		pinnate(p, 30, 54, -150, 16, 4, 40);
		pinnate(p, 30, 54, -80, 14, 4, -20);
		pinnate(p, 50, 48, -30, 16, 4, 40);
		pinnate(p, 50, 48, -100, 14, 4, 20);
		pinnate(p, 40, 52, -90, 14, 4, 10);
		pinnate(p, 40, 74, -160, 14, 4, 30);
		pinnate(p, 40, 70, -20, 14, 4, -30);
		return p.toString();
	}
	p.s(CUR.trunk, 2.4, "M40 87L40 46").s(CUR.trunk, 1.4, "M40 62Q30 52 24 40M40 54Q48 44 56 34M40 46Q40 34 41 22");
	pinnate(p, 24, 40, -165, 17, 4, 50);
	pinnate(p, 24, 40, -100, 16, 4, -25);
	pinnate(p, 56, 34, -15, 17, 4, 50);
	pinnate(p, 56, 34, -80, 16, 4, 25);
	pinnate(p, 41, 22, -125, 15, 4, -15);
	pinnate(p, 41, 22, -55, 15, 4, 15);
	pinnate(p, 40, 64, -165, 15, 4, 40);
	pinnate(p, 40, 58, -15, 15, 4, -40);
	for (const [x, y] of [[41, 13], [30, 26], [51, 24]] as const) for (let k = 0; k < 5; k++) p.dot(...pol(x, y, -90 + (k - 2) * 40, 2.4), 1, CUR.fl);
	for (const [x, y, red] of [[21, 46, 0], [60, 40, 1], [36, 30, 0]] as const) {
		for (let k = 0; k < 5; k++) {
			const [bx, by2] = pol(x, y, 60 + k * 72, k === 4 ? 0 : 2.3);
			p.dot(bx, by2, 1.5, red && k % 2 ? CUR.red : CUR.berry).dot(bx - 0.5, by2 - 0.5, 0.45, CUR.hl);
		}
	}
	return p.toString();
}

/* ---------- 23. Sweet cicely ---------- */
const SC = { st: "#5f9a4a", rib: "#4f8a43", a: "#95c97f", b: "#79b866", fl: "#f7f7ef", fl2: "#e6e8dc", seed: "#5a3826", seedG: "#7aa257" };
function sweetCicely(st: St): string {
	const p = new Pen();
	p.s(SC.st, 1.3, "").s(SC.rib, 1.2, "");
	const fr: readonly (readonly [number, number, number])[] = by(
		st,
		[[-140, 13, 20], [-95, 15, 4], [-45, 13, -20]],
		[[-170, 26, 34], [-146, 30, 28], [-120, 34, 18], [-96, 36, 6], [-72, 34, -12], [-46, 30, -26], [-14, 26, -34]],
		[[-172, 28, 34], [-150, 32, 28], [-124, 30, 18], [-58, 30, -18], [-34, 32, -28], [-10, 28, -34]],
	);
	if (st === "bloom") {
		const S: Cubic[] = [
			[[40, 86], [38, 64], [32, 46], [26, 30]],
			[[40, 86], [41, 62], [43, 40], [44, 22]],
			[[40, 86], [44, 66], [52, 50], [58, 36]],
		];
		for (const P of S) p.s(SC.st, 1.3, cubSub(P));
		umbel(p, 26, 27, 6.5, 6, SC.st, SC.fl, SC.fl2, 0.9, 0.35, 3);
		const seeds = (x: number, y: number, n: number) => {
			for (let k = 0; k < n; k++) {
				const a = -90 + (k - (n - 1) / 2) * 16;
				const [bx, by2] = pol(x, y, a + 180, 1);
				p.f(k % 3 === 1 ? SC.seedG : SC.seed, lensSub(bx, by2, a, 9, 1.05));
			}
		};
		seeds(44, 22, 7);
		seeds(58, 36, 6);
	}
	for (const [a, l, b] of fr) fern(p, 40, 86, a, l, b, by(st, 5, 9, 9.5), SC.rib, SC.a, SC.b, 8, 1.3, 2.1);
	return p.toString();
}

/* ---------- 24. Epazote ---------- */
const EPA = { st: "#7f9440", a: "#8fb24a", b: "#a8c35e", rib: "#5f7a2a", c1: "#c6d46c", c2: "#97b048" };
function epazote(st: St): string {
	const p = new Pen();
	p.s(EPA.st, 2, "").s(EPA.st, 1.2, "").f(EPA.a, "").f(EPA.b, "").s(EPA.rib, 0.5, "");
	const top = by(st, 70, 42, 12);
	const M: Cubic = [[40, 87], [40, 70], [41, 44], [40, top]];
	p.s(EPA.st, 2, cubSub(M));
	const n = by(st, 3, 6, 6);
	for (let i = 0; i < n; i++) {
		const t = 0.12 + (0.7 * i) / n;
		const [x, y] = bez(M, t);
		const dir = dirAt(M, t);
		const l = by(st, 9, 17, 18) * (1 - 0.45 * t);
		const a = dir + (i % 2 ? 58 : -58);
		p.f(i % 2 ? EPA.a : EPA.b, toothSub(x, y, a, l, l * 0.26, 4, 0.3)).s(EPA.rib, 0.5, ribSub(x, y, a, l));
	}
	if (st === "sprout") return p.f(EPA.b, toothSub(40, 70, -90, 5, 1.4, 3, 0.3)).toString();
	if (st === "leafy") return p.f(EPA.b, toothSub(40, top, -100, 7, 1.8, 3, 0.3) + toothSub(40, top, -70, 6, 1.5, 3, 0.3)).toString();
	const spikes: Cubic[] = [M, [[40, 52], [34, 44], [28, 36], [25, 26]], [[40, 46], [46, 38], [52, 30], [55, 20]], [[40, 62], [33, 56], [25, 52], [20, 44]], [[40, 58], [47, 52], [55, 48], [60, 40]]];
	spikes.forEach((P, si) => {
		if (si) p.s(EPA.st, 1.2, cubSub(P));
		const t0 = si ? 0.3 : 0.62;
		for (let k = 0; k < 6; k++) {
			const t = t0 + ((1 - t0) * k) / 5;
			const [x, y] = bez(P, t);
			const dir = dirAt(P, t);
			const r = 1.25 - k * 0.07;
			p.dot(...pol(x, y, dir - 80, 1.3), r, EPA.c1).dot(...pol(x, y, dir + 80, 1.3), r, EPA.c2);
			if (k % 2 === 0 && k < 4) p.f(EPA.a, leafSub(x, y, dir + (k % 4 ? 55 : -55), 4.5, 1.1, 1));
		}
		p.dot(P[3][0], P[3][1] - 0.6, 1, EPA.c1);
	});
	return p.toString();
}

/* ---------- 25. Sesame ---------- */
const SES = { st: "#5e8a3c", a: "#5ea24f", b: "#7ab86a", rib: "#3c6e2e", bell: "#f1d3df", lip: "#d993b0", cap: "#8db15a", capD: "#6a8a3e" };
function sesame(st: St): string {
	const p = new Pen();
	p.s(SES.st, 2.2, "").f(SES.a, "").f(SES.b, "").s(SES.rib, 0.6, "");
	const top = by(st, 70, 42, 10);
	const M: Cubic = [[40, 87], [40, 66], [40, 40], [40, top]];
	p.s(SES.st, by(st, 1.6, 2, 2.2), cubSub(M));
	if (st === "sprout") return p.leaf(40, 78, -158, 7, 3, SES.b, 2, SES.rib).leaf(40, 78, -22, 7, 3, SES.b, 2, SES.rib).leaf(40, 71, -110, 6, 2, SES.a, 1, SES.rib).leaf(40, 71, -70, 6, 2, SES.a, 1, SES.rib).toString();
	const lv: readonly (readonly [number, number, number])[] = by(
		st,
		[],
		[[0.12, 15, 4.4], [0.3, 13, 3.6], [0.5, 11, 2.6], [0.7, 9, 2], [0.88, 7, 1.6]],
		[[0.08, 15, 4.4], [0.2, 14, 3.8], [0.34, 12, 2.6], [0.48, 10, 2], [0.62, 9, 1.7], [0.76, 8, 1.5], [0.9, 6, 1.2]],
	);
	lv.forEach(([t, l, w], i) => {
		const [x, y] = bez(M, t);
		const dir = dirAt(M, t);
		if (i < 2) p.leaf(x, y, dir - 60, l, w, SES.a, 1, SES.rib).leaf(x, y, dir + 60, l, w, SES.a, 1, SES.rib);
		else p.leaf(x, y, dir + (i % 2 ? 55 : -55), l, w, i % 2 ? SES.b : SES.a, 1, SES.rib);
	});
	if (st === "leafy") return p.leaf(40, top, -90, 5, 1.4, SES.b, 1).toString();
	for (const [t, sd] of [[0.28, 1], [0.38, -1], [0.5, 1]] as const) {
		const [x, y] = bez(M, t);
		const cx = x - sd * 2.6;
		p.f(SES.cap, ovalSub(cx, y - 4.6, 4.8, 1.9, -90 - sd * 8)).s(SES.capD, 0.5, lnSub(cx, y - 8.6, cx, y - 0.8));
	}
	for (const [t, sd] of [[0.62, -1], [0.76, 1], [0.9, -1], [0.97, 1]] as const) {
		const [x, y] = bez(M, t);
		const a = sd > 0 ? -150 : -30;
		const m = xf(x - sd * 1, y, 180 + a);
		p.f(SES.bell, `M${m(0, -1)}L${m(7.2, -3)}Q${m(9.2, 0)} ${m(7.2, 3)}L${m(0, 1)}Z`);
		const [lx, ly] = pol(x - sd, y, 180 + a, 7.8);
		p.dot(lx, ly, 1.5, SES.lip);
	}
	return p.toString();
}

export const SPECIES: Species[] = [
	{ id: "chives", name: "Chives", draw: chives },
	{ id: "tarragon", name: "Tarragon", draw: tarragon },
	{ id: "lemon-balm", name: "Lemon balm", draw: lemonBalm },
	{ id: "lovage", name: "Lovage", draw: lovage },
	{ id: "chervil", name: "Chervil", draw: chervil },
	{ id: "borage", name: "Borage", draw: borage },
	{ id: "fenugreek", name: "Fenugreek", draw: fenugreek },
	{ id: "cumin", name: "Cumin", draw: cumin },
	{ id: "caraway", name: "Caraway", draw: caraway },
	{ id: "anise", name: "Anise", draw: anise },
	{ id: "nigella", name: "Nigella", draw: nigella },
	{ id: "saffron-crocus", name: "Saffron crocus", draw: saffron },
	{ id: "black-pepper", name: "Black pepper", draw: blackPepper },
	{ id: "cardamom", name: "Cardamom", draw: cardamom },
	{ id: "clove-tree", name: "Clove tree", draw: cloveTree },
	{ id: "cinnamon-tree", name: "Cinnamon tree", draw: cinnamon },
	{ id: "nutmeg-tree", name: "Nutmeg tree", draw: nutmeg },
	{ id: "stevia", name: "Stevia", draw: stevia },
	{ id: "shiso", name: "Shiso", draw: shiso },
	{ id: "lemon-verbena", name: "Lemon verbena", draw: lemonVerbena },
	{ id: "vietnamese-coriander", name: "Vietnamese coriander", draw: vietCoriander },
	{ id: "curry-leaf", name: "Curry leaf", draw: curryLeaf },
	{ id: "sweet-cicely", name: "Sweet cicely", draw: sweetCicely },
	{ id: "epazote", name: "Epazote", draw: epazote },
	{ id: "sesame", name: "Sesame", draw: sesame },
];
