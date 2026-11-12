/**
 * Garden species: ferns and fern allies II (25).
 * Drawn with the shared kit; see kit.ts for the style contract.
 */
import { f, line, type GrowingStage, type Species } from "./kit";

type Shape = 0 | 1 | 2;
type P = { x: number; y: number; a: number };
const RAD = Math.PI / 180;

/** Points along a curling path: n steps from (x, y) heading deg, turning by bend degrees in all. */
function walk(x: number, y: number, deg: number, len: number, bend: number, n = 12): P[] {
	const pts: P[] = [{ x, y, a: deg }];
	let a = deg;
	for (let j = 1; j <= n; j++) {
		a += bend / n;
		x += Math.cos(a * RAD) * (len / n);
		y += Math.sin(a * RAD) * (len / n);
		pts.push({ x, y, a });
	}
	return pts;
}

/** Numbers joined compactly: no space before a minus sign. */
const nums = (...xs: number[]): string => xs.map((x, i) => (i && x >= -0.05 ? " " : "") + f(x)).join("");
/** A polyline as path data (implicit linetos after the move). */
const polyD = (pts: { x: number; y: number }[]): string => `M${nums(...pts.flatMap((p) => [p.x, p.y]))}`;
const stroke = (d: string, c: string, w: number): string => `<path d="${d}" stroke="${c}" stroke-width="${w}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
const fill = (d: string, c: string): string => `<path d="${d}" fill="${c}"/>`;
/** Offset from (x, y) by r along deg. */
const off = (x: number, y: number, deg: number, r: number): [number, number] => [x + Math.cos(deg * RAD) * r, y + Math.sin(deg * RAD) * r];
const S = (stage: GrowingStage, sprout: number, leafy: number, bloom: number): number => (stage === "sprout" ? sprout : stage === "leafy" ? leafy : bloom);

/** A leaf outline as absolute path data, for batching many leaflets into one path. */
function leafD(x: number, y: number, deg: number, len: number, w: number, shape: Shape = 0): string {
	const c = Math.cos(deg * RAD);
	const sn = Math.sin(deg * RAD);
	const R = (u: number, v: number): number[] => [u * c - v * sn, u * sn + v * c];
	const M = `M${nums(x, y)}`;
	if (shape === 2) return `${M}c${nums(...R(len * 0.05, -w * 1.4), ...R(len * 1.02, -w * 1.3), ...R(len, 0))}c${nums(...R(0.02 * len, w * 1.3), ...R(-len * 0.95, w * 1.4), ...R(-len, 0))}`;
	const k = shape === 1 ? 0.4 : 0.5;
	return `${M}q${nums(...R(len * k, -w * 1.35), ...R(len, 0))}q${nums(...R(len * (k - 1), w * 1.35), ...R(-len, 0))}`;
}

/** A fan (wedge with a round outer edge) from (x, y) along deg; squash flattens it onto water. */
function fanD(x: number, y: number, deg: number, r: number, spread = 40, squash = 1): string {
	const p = (a: number, rr: number) => `${f(x + Math.cos(a * RAD) * rr)} ${f(y + Math.sin(a * RAD) * rr * squash)}`;
	return `M${f(x)} ${f(y)}L${p(deg - spread, r)}Q${p(deg, r * 1.35)} ${p(deg + spread, r)}Z`;
}

/** A band of half-width w(t) around a path. */
function ribbonD(pts: P[], w: (t: number) => number): string {
	const n = pts.length - 1;
	const L: number[] = [];
	const Rt: number[] = [];
	pts.forEach((p, i) => {
		const ww = w(i / n);
		const nx = Math.cos((p.a + 90) * RAD) * ww;
		const ny = Math.sin((p.a + 90) * RAD) * ww;
		L.push(p.x + nx, p.y + ny);
		Rt.unshift(p.x - nx, p.y - ny);
	});
	return `M${nums(...L, ...Rt)}Z`;
}

/** Path data batched by colour, painted in first-use order. */
class Ink {
	private m = new Map<string, string>();
	add(key: string, d: string): this {
		this.m.set(key, (this.m.get(key) ?? "") + d);
		return this;
	}
	leaf(fill: string, x: number, y: number, deg: number, len: number, w: number, shape: Shape = 0): this {
		return this.add(fill, leafD(x, y, deg, len, w, shape));
	}
	dot(fill: string, x: number, y: number, r: number): this {
		return this.add(fill, `M${nums(x - r, y)}a${nums(r, r)} 0 1 0 ${f(2 * r)} 0a${nums(r, r)} 0 1 0-${f(2 * r)} 0`);
	}
	/** A round dot as a zero-length round-capped stroke (compact); diameter bucketed to .4. */
	spot(fill: string, x: number, y: number, r: number): this {
		return this.add(`${fill}|${f(Math.max(0.4, Math.round(r * 5) / 2.5))}`, `M${nums(x, y)}h0`);
	}
	/** A stroke: key is "colour|width". */
	seg(color: string, width: number, x1: number, y1: number, x2: number, y2: number): this {
		return this.add(`${color}|${width}`, `M${nums(x1, y1, x2, y2)}`);
	}
	svg(): string {
		let s = "";
		for (const [k, d] of this.m) {
			const [c, w] = k.split("|");
			s += w ? `<path d="${d}" stroke="${c}" stroke-width="${w}" stroke-linecap="round" fill="none"/>` : `<path d="${d}" fill="${c}"/>`;
		}
		return s;
	}
}

/** A frond: a rachis walked in n steps, with `each` drawing the pinnae at steps from..n-1. */
function frondWith(x: number, y: number, deg: number, len: number, bend: number, n: number, rib: string, ribW: number, each: (ink: Ink, p: P, t: number, j: number) => void, from = 2): string {
	const pts = walk(x, y, deg, len, bend, n);
	const ink = new Ink();
	for (let j = from; j < n; j++) each(ink, pts[j]!, j / n, j);
	return stroke(polyD(pts), rib, ribW) + ink.svg();
}

interface Pinnate {
	n?: number;
	size: (t: number) => number;
	ang?: number;
	ratio?: number;
	shape?: Shape;
	a: string;
	b: string;
	rib: string;
	ribW?: number;
	from?: number;
	/** Pinna midrib colour. */
	vein?: string;
	/** Draw pinnae as round-capped strokes (compact) instead of leaf outlines. */
	pill?: boolean;
}

/** A pinna as a round-capped stroke of width W (one width per frond keeps it to one path per colour). */
function pill(ink: Ink, c: string, x: number, y: number, deg: number, len: number, W: number): void {
	const [ax, ay] = off(x, y, deg, Math.min(W * 0.5, len * 0.4));
	const [bx, by] = off(x, y, deg, Math.max(len - W * 0.5, len * 0.6));
	ink.seg(c, W, ax, ay, bx, by);
}

function pinnate(x: number, y: number, deg: number, len: number, bend: number, o: Pinnate): string {
	const { n = 12, ang = 62, ratio = 0.33, shape = 0, ribW = 1.4, from = 2, pill: usePill = true } = o;
	const W = Math.max(0.75, Math.round(o.size(0.45) * ratio * 1.1 * 4) / 4);
	return frondWith(
		x,
		y,
		deg,
		len,
		bend,
		n,
		o.rib,
		ribW,
		(ink, p, t) => {
			const l = o.size(t);
			if (l < 0.6) return;
			if (usePill) {
				pill(ink, o.a, p.x, p.y, p.a - ang, l, W);
				pill(ink, o.b, p.x, p.y, p.a + ang, l, W);
			} else ink.leaf(o.a, p.x, p.y, p.a - ang, l, l * ratio, shape).leaf(o.b, p.x, p.y, p.a + ang, l, l * ratio, shape);
			if (o.vein && l > 2.5) {
				const [x1, y1] = off(p.x, p.y, p.a - ang, l * 0.6);
				const [x2, y2] = off(p.x, p.y, p.a + ang, l * 0.6);
				ink.add(`${o.vein}|.7`, `M${f(x1)} ${f(y1)}L${f(p.x)} ${f(p.y)}L${f(x2)} ${f(y2)}`);
			}
		},
		from,
	);
}

/** A fiddlehead rising from (x, base). */
function fiddle(x: number, h: number, r: number, color: string, w = 2, base = 87): string {
	return `<path d="M${f(x)} ${f(base)}C${f(x)} ${f(base - h * 0.5)} ${f(x + r * 1.4)} ${f(base - h * 0.7)} ${f(x + r)} ${f(base - h)}A${f(r)} ${f(r)} 0 1 0 ${f(x - r * 0.2)} ${f(base - h - r * 0.3)}A${f(r * 0.55)} ${f(r * 0.55)} 0 1 0 ${f(x + r * 0.6)} ${f(base - h - r * 0.6)}" stroke="${color}" stroke-width="${w}" fill="none" stroke-linecap="round"/>`;
}

/** A shallow pond over the soil. */
function pond(rx = 19, cy = 86.4, ry = 3.2): string {
	return `<ellipse cx="40" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}" fill="#4c86a8"/><path d="M${f(40 - rx * 0.7)} ${f(cy + 0.2)}h${f(rx * 0.35)}M${f(40 + rx * 0.2)} ${f(cy + 1.2)}h${f(rx * 0.4)}" stroke="#7fb3d0" stroke-width=".8" stroke-linecap="round"/>`;
}

/** Lanceolate profile: tapering at both ends, peak sz. */
const lance = (sz: number, min = 0.8) => (t: number) => min + sz * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.04)), 1.1);
/** Triangular profile: widest at the base. */
const tri = (sz: number, k = 0.75, min = 0.8) => (t: number) => min + sz * (1 - t * k);

/* ───────────── Temperate ferns ───────────── */

function hartsTongue(stage: GrowingStage): string {
	const rib = "#2f6a2a";
	const strap = (deg: number, len: number, bend: number, W: number, c: string, sori = false) => {
		const n = 16;
		const pts = walk(40, 86, deg, len, bend, n);
		const w = (t: number) => (t < 0.13 ? 0.7 : W * Math.min(1, (t - 0.1) * 5) * Math.sqrt(Math.max(0, 1 - t)) * (1 + 0.08 * Math.sin(t * 46)));
		let s = fill(ribbonD(pts, w), c) + stroke(polyD(pts.slice(0, n)), rib, 0.8);
		if (sori) {
			let d = "";
			for (let j = 5; j < 14; j++) {
				const p = pts[j]!;
				const ww = w(j / n);
				for (const sd of [-1, 1]) {
					const [x1, y1] = off(p.x, p.y, p.a + sd * 60, ww * 0.25);
					const [x2, y2] = off(p.x, p.y, p.a + sd * 60, ww * 0.8);
					d += `M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}`;
				}
			}
			s += stroke(d, "#a8562a", 1);
		}
		return s;
	};
	const A = "#5aa846";
	const B = "#4a963c";
	const C = "#69b552";
	if (stage === "sprout") return strap(-125, 15, -20, 2.6, A) + strap(-60, 13, 22, 2.4, B);
	if (stage === "leafy") return strap(-155, 26, -40, 4, B) + strap(-25, 26, 40, 4, A) + strap(-115, 34, -30, 4.6, A) + strap(-68, 32, 30, 4.4, C);
	return (
		strap(-168, 32, -50, 4.6, B, true) +
		strap(-12, 32, 50, 4.6, B, true) +
		strap(-140, 44, -50, 5.2, A) +
		strap(-40, 44, 50, 5.2, A, true) +
		strap(-112, 54, -32, 5.6, C) +
		strap(-72, 52, 32, 5.4, A) +
		strap(-93, 46, -8, 5, C)
	);
}

function paintedFern(stage: GrowingStage): string {
	const silver = { a: "#c7cfca", b: "#aab6b1", rib: "#7a2a4c", vein: "#8e3b5e" };
	const sage = { a: "#b3c2b0", b: "#97a998", rib: "#7a2a4c", vein: "#8e3b5e" };
	const fr = (deg: number, len: number, bend: number, sz: number, c = silver) =>
		pinnate(40, 86, deg, len, bend, { ...c, n: 9, size: tri(sz, 0.7, 1), ang: 56, ratio: 0.36, shape: 1, ribW: 1.5, pill: false });
	if (stage === "sprout") return fr(-115, 16, -10, 3.4) + fiddle(42, 13, 2.4, "#8e3b5e", 1.6);
	if (stage === "leafy") return fr(-155, 28, -40, 5.4, sage) + fr(-25, 28, 40, 5.4, sage) + fr(-118, 34, -25, 6) + fr(-64, 34, 25, 6);
	return fr(-166, 36, -45, 7, sage) + fr(-14, 36, 45, 7, sage) + fr(-128, 44, -36, 7.6) + fr(-52, 44, 36, 7.6) + fr(-92, 46, -10, 7.6);
}

function ladyFern(stage: GrowingStage): string {
	const c = { a: "#b4dc78", b: "#96c85e", rib: "#a2463a" };
	const fr = (deg: number, len: number, bend: number, sz: number) => pinnate(40, 87, deg, len, bend, { ...c, n: 14, size: lance(sz), ang: 64, ratio: 0.3, shape: 1, ribW: 1.3 });
	if (stage === "sprout") return fr(-98, 20, -8, 2.6) + fiddle(43, 12, 2.2, c.b, 1.5);
	if (stage === "leafy") return fr(-114, 42, -20, 4.6) + fr(-66, 42, 20, 4.6) + fr(-92, 48, -6, 5);
	return fr(-122, 54, -26, 5.6) + fr(-58, 54, 26, 5.6) + fr(-104, 68, -18, 6.2) + fr(-78, 66, 18, 6.2) + fr(-91, 60, -4, 5.8);
}

function cinnamonFern(stage: GrowingStage): string {
	const c = { a: "#8cc35c", b: "#72ae4a", rib: "#4f7a35" };
	const fr = (deg: number, len: number, bend: number, sz: number) => pinnate(40, 87, deg, len, bend, { ...c, n: 10, size: lance(sz), ang: 64, ratio: 0.32 });
	const spire = (x: number, h: number, lean: number) => {
		const pts = walk(x, 87, -90 + lean, h, lean * 0.4, 12);
		const ink = new Ink();
		for (let j = 5; j <= 12; j++) {
			const p = pts[j]!;
			const r = j === 12 ? 1.5 : 1.7;
			const [ax, ay] = off(p.x, p.y, p.a - 70, 1.6);
			const [bx, by] = off(p.x, p.y, p.a + 70, 1.6);
			ink.spot("#c4762f", ax, ay, r).spot("#a65c24", bx, by, r);
		}
		const t = pts[12]!;
		ink.spot("#c4762f", t.x, t.y, 1.6);
		return stroke(polyD(pts), "#7a4a24", 1.6) + ink.svg();
	};
	if (stage === "sprout") return fiddle(37, 13, 2.6, "#c49060", 2.2) + fiddle(43, 16, 2.6, "#b8834f", 2.2);
	if (stage === "leafy") return fr(-120, 40, -18, 4.6) + fr(-60, 40, 18, 4.6) + spire(40, 36, 0) + fr(-96, 44, -6, 5);
	return fr(-132, 50, -22, 5.6) + fr(-48, 50, 22, 5.6) + fr(-112, 58, -12, 6) + fr(-68, 58, 12, 6) + spire(36, 66, -5) + spire(44, 62, 6) + spire(40, 74, 0);
}

function christmasFern(stage: GrowingStage): string {
	const rib = "#25503a";
	const fr = (deg: number, len: number, bend: number, sz: number, fertile = false) =>
		frondWith(40, 86, deg, len, bend, 12, rib, 1.4, (ink, p, t) => {
			const fert = fertile && t > 0.6;
			const l = (fert ? 0.65 : 1) * sz * (1 - t * 0.45);
			ink.leaf(fert ? "#a26c38" : "#3c7f52", p.x, p.y, p.a - 80, l, l * 0.3, 1).leaf(fert ? "#8e5c30" : "#2f7048", p.x, p.y, p.a + 80, l, l * 0.3, 1);
		});
	if (stage === "sprout") return fr(-115, 16, -14, 4) + fr(-66, 14, 14, 3.8);
	if (stage === "leafy") return fr(-145, 34, -35, 6.4) + fr(-35, 34, 35, 6.4) + fr(-100, 40, -12, 7);
	return fr(-155, 42, -40, 7.4) + fr(-25, 42, 40, 7.4) + fr(-122, 52, -26, 8, true) + fr(-58, 52, 26, 8, true) + fr(-92, 54, -6, 8, true);
}

function autumnFern(stage: GrowingStage): string {
	const green = { a: "#5e9a4c", b: "#4a8640", rib: "#335f2c" };
	const copper = { a: "#dd8a48", b: "#c46a36", rib: "#8a3a22" };
	const fr = (deg: number, len: number, bend: number, sz: number, c: typeof green) => pinnate(40, 86, deg, len, bend, { ...c, n: 11, size: tri(sz, 0.8), ang: 56, ratio: 0.3, shape: 1 });
	if (stage === "sprout") return fr(-112, 16, -10, 3.4, copper) + fiddle(43, 12, 2.2, copper.b, 1.6);
	if (stage === "leafy") return fr(-150, 32, -30, 5.4, green) + fr(-30, 32, 30, 5.4, green) + fr(-104, 38, -14, 5.8, copper) + fr(-74, 36, 14, 5.6, copper);
	return fr(-162, 38, -35, 6.2, green) + fr(-18, 38, 35, 6.2, green) + fr(-128, 48, -28, 7, green) + fr(-52, 48, 28, 7, green) + fr(-102, 54, -14, 7, copper) + fr(-78, 50, 14, 6.6, copper);
}

function hayScented(stage: GrowingStage): string {
	const c = { a: "#d0e294", b: "#b2d070", rib: "#86a050" };
	const fr = (x: number, deg: number, len: number, bend: number, sz: number) => pinnate(x, 87, deg, len, bend, { ...c, n: 12, size: lance(sz, 0.6), ang: 66, ratio: 0.36, ribW: 1.1 });
	if (stage === "sprout") return fr(36, -105, 16, -20, 2.6) + fr(44, -75, 14, 20, 2.4);
	if (stage === "leafy") return fr(28, -118, 32, -50, 4) + fr(40, -88, 36, 30, 4.2) + fr(52, -62, 30, 50, 4);
	return fr(18, -100, 32, -55, 4) + fr(28, -96, 42, -50, 4.6) + fr(38, -86, 46, -44, 4.8) + fr(44, -94, 44, 44, 4.8) + fr(54, -84, 40, 50, 4.4) + fr(62, -80, 30, 55, 3.8);
}

function bracken(stage: GrowingStage): string {
	const c = { a: "#9cba52", b: "#7ea23e", rib: "#5c6a2c" };
	const gold = { a: "#d2b25a", b: "#b8943e", rib: "#7a6a36" };
	const stalk = "#7a6a36";
	const pin = (x: number, y: number, deg: number, len: number, bend: number, sz: number, cc = c) => pinnate(x, y, deg, len, bend, { ...cc, n: 10, size: tri(sz, 0.75), ang: 74, ratio: 0.36, from: 1, ribW: 1.2 });
	if (stage === "sprout") {
		// the eagle-claw crozier
		return `<path d="M40 87C40 80 41 76 42 71C43 67 39 65 37.5 68M42 71C44 68 46 69 45.6 71.6" stroke="${stalk}" stroke-width="1.8" fill="none" stroke-linecap="round"/>` + `<path d="M37.6 68.2a1.6 1.6 0 1 0 0 .1M45.5 71.7a1.4 1.4 0 1 0 0 .1" stroke="#8ab24c" stroke-width="2.2" fill="none"/>`;
	}
	/** A blade held nearly flat: pinna pairs crowded on a short, tilted rachis. */
	const blade = (x: number, y: number, sc: number, goldLow: boolean) =>
		pin(x, y, -178, 30 * sc, -40, 4.4 * sc, goldLow ? gold : c) +
		pin(x, y, -2, 30 * sc, 40, 4.4 * sc, goldLow ? gold : c) +
		pin(x + 1.5 * sc, y - 5 * sc, -172, 23 * sc, -34, 3.8 * sc) +
		pin(x + 1.5 * sc, y - 5 * sc, -8, 23 * sc, 34, 3.8 * sc) +
		pin(x + 3 * sc, y - 9.5 * sc, -165, 15 * sc, -24, 3 * sc) +
		pin(x + 3 * sc, y - 9.5 * sc, -15, 15 * sc, 24, 3 * sc) +
		pin(x + 4 * sc, y - 12.5 * sc, -80, 8 * sc, 30, 2.4 * sc);
	const rach = (x: number, y: number, sc: number) => `<path d="M40 87Q${f(x - 2)} ${f((87 + y) / 2)} ${f(x)} ${f(y)}L${f(x + 4 * sc)} ${f(y - 12.5 * sc)}" stroke="${stalk}" stroke-width="${f(2.2 * sc)}" fill="none" stroke-linecap="round"/>`;
	if (stage === "leafy") return rach(40, 62, 0.75) + blade(40, 62, 0.75, false);
	return rach(39, 48, 1.1) + blade(39, 48, 1.1, true);
}

/* ───────────── House and tropical ferns ───────────── */

function rabbitsFoot(stage: GrowingStage): string {
	const c = { a: "#8ccb5c", b: "#6cb04a", rib: "#5a4430" };
	const fr = (x: number, deg: number, len: number, bend: number, sz: number) => pinnate(x, 85, deg, len, bend, { ...c, n: 12, size: (t) => (t < 0.25 ? 0 : 0.8 + sz * (1 - t) * 1.5), ang: 58, ratio: 0.26, ribW: 1, from: 3 });
	const foot = (pts: [number, number][]) => {
		const ink = new Ink();
		const d = polyD(pts.map(([x, y]) => ({ x, y })));
		for (let i = 0; i < pts.length - 1; i++) {
			const [x1, y1] = pts[i]!;
			const [x2, y2] = pts[i + 1]!;
			for (let k = 0; k < 3; k++) {
				const x = x1 + ((x2 - x1) * k) / 3;
				const y = y1 + ((y2 - y1) * k) / 3;
				ink.seg("#ead6b6", 0.7, x, y - 1.6, x + (k - 1) * 0.6, y - 2.9);
			}
		}
		const [tx, ty] = pts[pts.length - 1]!;
		ink.dot("#c9a074", tx, ty, 2.1);
		return stroke(d, "#b88c5c", 3.6) + ink.svg();
	};
	if (stage === "sprout") return fr(40, -95, 16, 0, 2.6) + foot([[36, 85], [30, 85.5], [26, 86.5]]);
	if (stage === "leafy")
		return fr(34, -118, 30, -20, 4.2) + fr(46, -66, 30, 20, 4.2) + fr(40, -92, 36, 0, 4.6) + foot([[38, 85], [30, 85], [23, 86.6]]) + foot([[42, 85], [50, 85], [57, 87]]);
	return (
		fr(30, -128, 38, -24, 5.2) +
		fr(50, -52, 38, 24, 5.2) +
		fr(36, -104, 46, -10, 5.6) +
		fr(44, -78, 44, 12, 5.6) +
		foot([[38, 85], [29, 84.6], [21, 85.6], [15, 88]]) +
		foot([[42, 85], [51, 84.8], [59, 85.8], [65, 88]]) +
		foot([[40, 85.6], [33, 86.8], [28, 88.4]]) +
		foot([[40, 85.6], [47, 87], [52, 88.4]])
	);
}

function kangarooPaw(stage: GrowingStage): string {
	const rib = "#2c6428";
	let sori = "";
	const paw = (deg: number, stipe: number, fingers: number, fl: number, W: number, c: string, spore = false) => {
		const sp = walk(40, 86, deg, stipe, 0, 2);
		const o = sp[2]!;
		let body = "";
		let ribs = polyD(sp);
		const spread = fingers === 1 ? 0 : 50;
		for (let k = 0; k < fingers; k++) {
			const a = fingers === 1 ? deg : deg - spread / 2 + (spread * k) / (fingers - 1);
			const len = fl * (k === Math.floor(fingers / 2) ? 1.15 : 0.85);
			const pts = walk(o.x, o.y, a, len, (a - deg) * 0.4 + (deg < -90 ? -14 : 14), 6);
			body += ribbonD(pts, (t) => W * Math.min(1, t * 6 + 0.35) * Math.sqrt(1 - t));
			ribs += polyD(pts.slice(0, 5));
			if (spore)
				for (let j = 2; j < 6; j += 2) {
					const p = pts[j]!;
					const [x, y] = off(p.x, p.y, p.a + 90, W * 0.5);
					sori += `M${nums(x - 0.7, y)}a.7 .7 0 1 0 1.4 0a.7 .7 0 1 0-1.4 0`;
				}
		}
		return fill(body, c) + stroke(ribs, rib, 0.8);
	};
	const A = "#4f9e3c";
	const B = "#5fb04a";
	if (stage === "sprout") return paw(-118, 6, 1, 11, 2.2, A) + paw(-62, 6, 2, 9, 1.9, B);
	if (stage === "leafy") return paw(-160, 8, 2, 14, 2.6, A) + paw(-20, 8, 3, 13, 2.4, A) + paw(-120, 12, 3, 15, 2.6, B) + paw(-64, 12, 1, 18, 2.8, B);
	const s =
		paw(-168, 10, 3, 15, 2.8, A, true) +
		paw(-12, 10, 2, 16, 2.8, A, true) +
		paw(-136, 16, 4, 17, 2.8, B) +
		paw(-46, 16, 3, 18, 3, B, true) +
		paw(-106, 20, 1, 24, 3.2, A) +
		paw(-80, 20, 3, 17, 2.8, B);
	return s + fill(sori, "#d8963a");
}

function blueStar(stage: GrowingStage): string {
	const c = { a: "#93bdbb", b: "#7aa8aa", rib: "#56786e" };
	let sori = "";
	const fr = (deg: number, len: number, bend: number, lobe: number, pairs: number, spore = false) => {
		const n = 10;
		const pts = walk(40, 87, deg, len, bend, n);
		const ink = new Ink();
		const start = n - pairs;
		ink.add(c.b, ribbonD(pts.slice(start - 1), (t) => 2.6 * (1 - t) + 1));
		for (let j = start; j < n; j++) {
			const p = pts[j]!;
			const l = lobe * (1 - ((j - start) / pairs) * 0.35);
			for (const sd of [-1, 1]) {
				const a = p.a + sd * 54;
				ink.leaf(sd < 0 ? c.a : c.b, p.x, p.y, a, l, l * 0.3, 1);
				if (spore)
					for (const r of [0.45, 0.72]) {
						const [x, y] = off(p.x, p.y, a, l * r);
						sori += `M${nums(x - 0.9, y)}a.9 .9 0 1 0 1.8 0a.9 .9 0 1 0-1.8 0`;
					}
			}
		}
		const t = pts[n]!;
		ink.leaf(c.a, t.x, t.y, t.a, lobe * 0.85, lobe * 0.24, 1);
		return stroke(polyD(pts.slice(0, start + 1)), c.rib, 1.3) + ink.svg();
	};
	if (stage === "sprout") return fr(-100, 14, 6, 6, 2) + fr(-70, 10, -6, 4.4, 1);
	if (stage === "leafy") return fr(-126, 32, 14, 10, 3) + fr(-58, 30, -14, 10, 3) + fr(-92, 40, 4, 11, 3);
	return fr(-138, 40, 18, 12, 4, true) + fr(-42, 40, -18, 12, 4) + fr(-106, 56, 6, 13, 4) + fr(-74, 54, -6, 13, 4, true) + fill(sori, "#dcaa3a");
}

function silverLace(stage: GrowingStage): string {
	const green = "#3f8a4a";
	const green2 = "#347a40";
	const stripe = "#e9f1e3";
	const rib = "#2c5a32";
	const fr = (deg: number, len: number, bend: number, pl: number, pr: number) => {
		const n = 8;
		const pts = walk(40, 87, deg, len, bend, n);
		const ink = new Ink();
		const pinna = (x: number, y: number, a: number, l: number, cc: string) => ink.leaf(cc, x, y, a, l, l * pr, 1).leaf(stripe, x + Math.cos(a * RAD) * l * 0.08, y + Math.sin(a * RAD) * l * 0.08, a, l * 0.78, l * pr * 0.3, 1);
		for (const j of [3, 5, 7]) {
			const p = pts[j]!;
			const l = pl * (1 - (j - 3) * 0.08);
			pinna(p.x, p.y, p.a - 52, l, green);
			pinna(p.x, p.y, p.a + 52, l, green2);
		}
		const t = pts[n]!;
		pinna(t.x, t.y, t.a, pl * 1.05, green);
		return stroke(polyD(pts), rib, 1.1) + ink.svg();
	};
	if (stage === "sprout") return fr(-110, 12, -10, 6, 0.24) + fr(-72, 10, 10, 5, 0.24);
	if (stage === "leafy") return fr(-150, 22, -30, 10, 0.22) + fr(-30, 22, 30, 10, 0.22) + fr(-110, 28, -10, 11, 0.22) + fr(-72, 28, 10, 11, 0.22);
	return fr(-160, 24, -34, 11, 0.22) + fr(-20, 24, 34, 11, 0.22) + fr(-128, 30, -20, 12, 0.22) + fr(-52, 30, 20, 12, 0.22) + fr(-102, 50, -6, 14, 0.15) + fr(-80, 48, 6, 14, 0.15);
}

function buttonFern(stage: GrowingStage): string {
	const rib = "#4a2c26";
	const fr = (deg: number, len: number, bend: number, r: number) => {
		const pts = walk(40, 86, deg, len, bend, 12);
		const ink = new Ink();
		for (let j = 3; j <= 12; j++) {
			const p = pts[j]!;
			const sd = j % 2 ? 1 : -1;
			const rr = r * (1 - (j / 12) * 0.25);
			const [x, y] = j === 12 ? [p.x, p.y] : off(p.x, p.y, p.a + sd * 70, rr * 1.2);
			ink.spot(sd < 0 ? "#3e7c48" : "#2f6b3c", x, Math.min(y, 86.5 - rr), rr);
		}
		return stroke(polyD(pts), rib, 1) + ink.svg();
	};
	if (stage === "sprout") return fr(-125, 14, -30, 1.3) + fr(-58, 13, 30, 1.3);
	if (stage === "leafy") return fr(-165, 26, -16, 1.6) + fr(-15, 26, 16, 1.6) + fr(-122, 30, -40, 1.7) + fr(-58, 30, 40, 1.7);
	return fr(-170, 30, -14, 1.8) + fr(-10, 30, 14, 1.8) + fr(-142, 38, -45, 1.9) + fr(-38, 38, 45, 1.9) + fr(-112, 40, -40, 1.9) + fr(-68, 40, 40, 1.9) + fr(-92, 30, -20, 1.7);
}

function lemonButton(stage: GrowingStage): string {
	const rib = "#6e8c2c";
	const fr = (x: number, deg: number, len: number, bend: number, r = 1.15) =>
		frondWith(x, 87, deg, len, bend, Math.round(len / 3.4), rib, 1, (ink, p, t) => {
			const rr = r * (t > 0.8 ? (1 - t) * 3.5 + 0.3 : 1);
			const [ax, ay] = off(p.x, p.y, p.a - 90, rr * 1.1);
			const [bx, by] = off(p.x, p.y, p.a + 90, rr * 1.1);
			ink.spot("#c4de58", ax, ay, rr).spot("#a6ca3e", bx, by, rr);
		}, 2);
	if (stage === "sprout") return fr(37, -104, 16, 6, 1) + fr(43, -76, 14, -6, 1);
	if (stage === "leafy") return fr(37, -112, 36, 8) + fr(43, -68, 36, -8) + fr(39, -96, 44, 4) + fr(42, -84, 42, -4);
	return fr(35, -124, 44, 10) + fr(45, -56, 44, -10) + fr(37, -106, 56, 6) + fr(43, -74, 56, -6) + fr(40, -90, 62, 0);
}

function crocodileFern(stage: GrowingStage): string {
	const blade = (deg: number, len: number, bend: number, W: number, c: string) => {
		const n = 12;
		const pts = walk(40, 87, deg, len, bend, n);
		const w = (t: number) => (t < 0.12 ? 0.9 : W * Math.min(1, (t - 0.08) * 4) * Math.pow(Math.max(0, 1 - t), 0.6));
		let d = "";
		const L1: P[] = [];
		const L2: P[] = [];
		for (let j = 3; j < n; j++) {
			const p = pts[j]!;
			const ww = w(j / n) * 0.9;
			const [x1, y1] = off(p.x, p.y, p.a + 90, ww);
			const [x2, y2] = off(p.x, p.y, p.a - 90, ww);
			d += `M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}`;
			const [ax, ay] = off(p.x, p.y, p.a + 90, ww * 0.5);
			const [bx, by] = off(p.x, p.y, p.a - 90, ww * 0.5);
			L1.push({ x: ax, y: ay, a: 0 });
			L2.push({ x: bx, y: by, a: 0 });
		}
		return fill(ribbonD(pts, w), c) + stroke(d + polyD(L1) + polyD(L2), "#4f7f38", 0.6) + stroke(polyD(pts.slice(0, n)), "#3e6a2c", 1);
	};
	const A = "#a8ce68";
	const B = "#98c25a";
	if (stage === "sprout") return blade(-104, 16, 6, 2.8, A) + blade(-72, 13, -6, 2.4, B);
	if (stage === "leafy") return blade(-135, 34, 20, 5, B) + blade(-45, 34, -20, 5, B) + blade(-100, 42, 6, 5.6, A);
	return blade(-152, 40, 30, 5.6, B) + blade(-28, 40, -30, 5.6, B) + blade(-120, 54, 18, 6.4, A) + blade(-62, 54, -18, 6.4, A) + blade(-92, 62, 4, 6.6, B);
}

/* ───────────── Epiphytes and climbers ───────────── */

/** A pinnatifid frond: lobes joined by a green wing along the rachis. */
function lobed(x: number, y: number, deg: number, len: number, bend: number, lobe: number, a: string, b: string, rib: string, spore: string | null, n = 10): string {
	const pts = walk(x, y, deg, len, bend, n);
	const ink = new Ink();
	ink.add(b, ribbonD(pts.slice(2), (t) => 1.1 * (1 - t) + 0.3));
	let dots = "";
	for (let j = 2; j < n; j++) {
		const p = pts[j]!;
		const l = lobe * (1 - (j / n) * 0.6);
		ink.leaf(a, p.x, p.y, p.a - 58, l, l * 0.32, 1).leaf(b, p.x, p.y, p.a + 58, l, l * 0.32, 1);
		if (spore && j > 2 && j < n - 2) {
			const [cx, cy] = off(p.x, p.y, p.a + (j % 2 ? 58 : -58), l * 0.5);
			dots += `M${nums(cx - 0.7, cy)}a.7 .7 0 1 0 1.4 0a.7 .7 0 1 0-1.4 0`;
		}
	}
	return stroke(polyD(pts), rib, 1.1) + ink.svg() + (dots ? fill(dots, spore!) : "");
}

function licoriceFern(stage: GrowingStage): string {
	const x0 = S(stage, 28, 18, 10);
	const x1 = S(stage, 52, 62, 70);
	const log =
		`<path d="M${x0} 87.6Q${x0 - 2} 77 ${x0 + 6} 76.5L${x1 - 4} 76.5Q${x1 + 1} 78 ${x1} 87.6Z" fill="#7a5638"/>` +
		`<ellipse cx="${x1 - 1.5}" cy="82" rx="3.6" ry="5.4" fill="#b08a5e"/><ellipse cx="${x1 - 1.5}" cy="82" rx="1.6" ry="2.6" fill="none" stroke="#8a6644" stroke-width=".7"/>` +
		`<path d="M${x0 + 2} 79Q${x0 + 3} 74.5 ${x0 + 7} 75.5Q${(x0 + x1) / 2 - 4} 73.4 ${(x0 + x1) / 2} 75Q${(x0 + x1) / 2 + 5} 73 ${x1 - 7} 75.5Q${x1 - 4} 75 ${x1 - 3.5} 77.6L${x0 + 2} 79Z" fill="#7fa84a"/>`;
	const c = ["#6aac4a", "#559a3e", "#3f6e2c"] as const;
	const fr = (x: number, deg: number, len: number, bend: number, lobe: number, sp = false) => lobed(x, 75.5, deg, len, bend, lobe, c[0], c[1], c[2], sp ? "#e08a3a" : null);
	if (stage === "sprout") return log + fr(38, -110, 12, -10, 2.6) + fiddle(44, 8, 2, c[1], 1.5, 76);
	if (stage === "leafy") return log + fr(30, -125, 26, -60, 4.2) + fr(50, -55, 26, 60, 4.2) + fr(40, -95, 26, -40, 4.4);
	return log + fr(24, -135, 34, -70, 4.8, true) + fr(56, -45, 34, 70, 4.8, true) + fr(36, -108, 40, -50, 5.2) + fr(46, -74, 38, 55, 5, true);
}

function resurrectionFern(stage: GrowingStage): string {
	const H = S(stage, 14, 20, 26);
	const top = 87 - H;
	const bark = "#8e8272";
	let stump =
		`<path d="M29 88Q31 ${f(top + 6)} 31 ${f(top + 1)}L49 ${f(top + 1)}Q49 ${f(top + 6)} 51 88Z" fill="${bark}"/>` +
		`<path d="M34 87V${f(top + 5)}M39.5 86V${f(top + 7)}M45 87V${f(top + 4)}" stroke="#6e6354" stroke-width=".9" stroke-linecap="round"/>` +
		`<ellipse cx="40" cy="${f(top + 1)}" rx="9" ry="2.4" fill="#c8b08a"/><ellipse cx="40" cy="${f(top + 1)}" rx="4.5" ry="1.1" fill="none" stroke="#a88e68" stroke-width=".6"/>`;
	if (stage === "bloom") stump += `<path d="M32.5 ${f(top + 12)}a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0-2.6 0M46 ${f(top + 18)}a1.1 1.1 0 1 0 2.2 0a1.1 1.1 0 1 0-2.2 0" fill="#c3cfa4"/>`;
	const curl = (x: number, y: number, h: number, sd: number) =>
		`<path d="M${f(x)} ${f(y)}Q${f(x + sd * 1)} ${f(y - h * 0.7)} ${f(x + sd * 3)} ${f(y - h)}a${f(2.2)} 2.2 0 1 1 ${f(sd * 1.6)} 2.8a1 1 0 1 1-.6-1.5" stroke="#8c6a3c" stroke-width="2" fill="none" stroke-linecap="round"/>`;
	const fr = (x: number, y: number, deg: number, len: number, bend: number, lobe: number) => lobed(x, y, deg, len, bend, lobe, "#7da24c", "#6a8f42", "#4b5f2e", null, 8);
	if (stage === "sprout") return stump + curl(35, top + 1, 7, -1) + curl(41, top + 0.6, 9, 1) + curl(46, top + 1, 6, 1);
	if (stage === "leafy") return stump + curl(33, top + 1, 7, -1) + curl(47, top + 1, 7, 1) + fr(37, top, -110, 20, -10, 3.6) + fr(43, top, -70, 20, 10, 3.6);
	return (
		stump +
		fr(32, top + 1, -150, 18, -20, 3.4) +
		fr(48, top + 1, -30, 18, 20, 3.4) +

		fr(38, top, -98, 28, -4, 4) +
		fr(42, top, -82, 26, 6, 4) +
		fr(30, top + 8, -165, 14, -10, 3) +
		fr(50, top + 10, -15, 14, 10, 3)
	);
}

function climbingFern(stage: GrowingStage): string {
	const top = S(stage, 66, 36, 8);
	const sx = 44;
	const c = { a: "#7cbc52", b: "#64a442", rib: "#4f8a3a" };
	let s = "";
	let fringe = "";
	const pts: { x: number; y: number }[] = [];
	for (let y = 87; y >= top + 2; y -= 1.5) pts.push({ x: sx + Math.sin((87 - y) / 3.2) * 2.6, y });
	let k = 0;
	for (let y = 80; y > top + 5; y -= 8, k++) {
		const sd = k % 2 ? 1 : -1;
		const x = sx + Math.sin((87 - y) / 3.2) * 2.6;
		const fert = stage === "bloom" && y < 42;
		const dir = sd < 0 ? -168 : -12;
		const L = fert ? 10 : 11;
		// a lacy triangular pinnule: a small pinnate leaflet
		s += pinnate(x, y, dir, L, sd * 10, { ...c, n: 5, size: tri(3.2, 0.7, 0.6), ang: 60, ratio: 0.36, ribW: 0.8, from: 1 });
		if (fert) {
			const tp = walk(x, y, dir, L, sd * 10, 5);
			for (let j = 1; j < 5; j += 2) {
				const p = tp[j]!;
				for (const q of [-60, 60]) {
					const [ex, ey] = off(p.x, p.y, p.a + q, 3.4 * (1 - j * 0.14) + 0.5);
					fringe += `M${nums(ex - 0.5, ey)}a.5 .5 0 1 0 1 0a.5 .5 0 1 0-1 0`;
				}
			}
		}
	}
	return line(sx, 87.5, sx, top, "#c6a66a", 1.6) + stroke(polyD(pts), c.rib, 1.1) + s + (fringe ? fill(fringe, "#8a5a2a") : "");
}

function silverFern(stage: GrowingStage): string {
	const green = { a: "#4f8a48", b: "#3f7a3e", rib: "#2f5a2e" };
	const silver = { a: "#d9e2db", b: "#bccbc0", rib: "#8a9b90" };
	const fr = (x: number, y: number, deg: number, len: number, bend: number, sz: number, c: typeof green) =>
		pinnate(x, y, deg, len, bend, { ...c, n: 11, size: (t) => 0.8 + sz * Math.sin(Math.PI * Math.min(1, t * 0.9 + 0.12)), ang: 66, ratio: 0.28, ribW: 1.2 });
	const trunk = (t: number) => {
		let s = line(40, 87, 40, t, "#3e322a", 4.2);
		let d = "";
		for (let y = 84; y > t + 3; y -= 5) d += `M38.6 ${f(y)}l2.8-1.6`;
		return s + stroke(d, "#5e4c3e", 0.8);
	};
	if (stage === "sprout") return fr(40, 87, -100, 20, 20, 3, silver) + fiddle(36, 14, 2.2, "#c6d2c9", 1.6);
	if (stage === "leafy") {
		const t = 62;
		return trunk(t) + fr(40, t, -120, 22, -10, 4.6, green) + fr(40, t, -60, 22, 10, 4.6, green) + fr(40, t, -165, 26, -55, 5, silver) + fr(40, t, -15, 26, 55, 5, silver);
	}
	const t = 34;
	return (
		trunk(t) +
		fr(40, t, -118, 26, -16, 5, green) +
		fr(40, t, -62, 26, 16, 5, green) +
		fr(40, t, -90, 22, 6, 4.4, green) +
		fr(40, t, -170, 36, -70, 6, silver) +
		fr(40, t, -10, 36, 70, 6, silver) +
		fr(40, t, -145, 32, -80, 5.4, green) +
		fr(40, t, -35, 32, 80, 5.4, green) +
		fiddle(41, 9, 2, "#d9e2db", 1.6, t)
	);
}

/* ───────────── Water ferns ───────────── */

function waterClover(stage: GrowingStage): string {
	const ink = new Ink();
	const clover = (x: number, y: number, r: number, squash = 1) => {
		for (let k = 0; k < 4; k++) ink.add(k % 2 ? "#5ea548" : "#7cc05a", fanD(x, y, 45 + k * 90, r, 42, squash));
	};
	const emergent = (bx: number, x: number, y: number, r: number) => {
		ink.add("#4a8a3a|.9", `M${f(bx)} 86Q${f(bx)} ${f((86 + y) / 2)} ${f(x)} ${f(y)}`);
		clover(x, y, r);
	};
	const items: [number, number, number, number][] =
		stage === "sprout"
			? [[40, 41, 74, 4]]
			: stage === "leafy"
				? [[37, 30, 64, 5.2], [42, 48, 58, 5.6], [40, 40, 72, 4.6]]
				: [[36, 24, 58, 6], [43, 56, 50, 6.4], [39, 38, 42, 6.4], [41, 46, 66, 5.4], [38, 30, 72, 5], [44, 60, 70, 5]];
	const floats: [number, number, number][] = stage === "sprout" ? [] : stage === "leafy" ? [[28, 85.6, 4]] : [[25, 85.6, 4.4], [56, 86.4, 4]];
	for (const [x, y, r] of floats) clover(x, y, r, 0.4);
	for (const [bx, x, y, r] of items) emergent(bx, x, y, r);
	let spore = "";
	if (stage === "bloom") for (const x of [37, 42, 45]) spore += `<ellipse cx="${x}" cy="83.6" rx="1.6" ry="1.1" fill="#6a4a2a"/>`;
	return pond(S(stage, 13, 18, 21)) + spore + ink.svg();
}

function mosquitoFern(stage: GrowingStage): string {
	const ink = new Ink();
	const cluster = (x: number, y: number, s: number, c1: string, c2: string) => {
		ink.dot(c1, x, y, 1.5 * s);
		for (let k = 0; k < 5; k++) {
			const [cx, cy] = off(x, y, -180 + k * 45, 2 * s);
			ink.dot(k % 2 ? c2 : c1, cx, cy + 0.7 * s, 1.2 * s);
		}
		ink.dot(c2, x, y - 1.3 * s, 0.9 * s);
	};
	const G = ["#6aa850", "#8cc35e"] as const;
	const R = ["#b8483a", "#d8684a"] as const;
	const Or = ["#c8743e", "#e0945a"] as const;
	if (stage === "sprout") {
		cluster(36, 85, 0.9, G[0], G[1]);
		cluster(44, 86, 0.8, G[1], G[0]);
		return pond(12) + ink.svg();
	}
	if (stage === "leafy") {
		const pts: [number, number, number, number][] = [[28, 85, 1, 0], [36, 84, 1.1, 1], [44, 85, 1.1, 0], [52, 85.5, 1, 2], [33, 87.5, 0.9, 0], [47, 87.6, 0.9, 1], [40, 82.4, 0.9, 2]];
		for (const [x, y, s, c] of pts) {
			const pal = c === 0 ? G : c === 1 ? Or : R;
			cluster(x, y, s, pal[0], pal[1]);
		}
		return pond(20, 85.4, 4.4) + ink.svg();
	}
	const surface = `<ellipse cx="40" cy="82.5" rx="31" ry="6.5" fill="#4c86a8"/>`;
	const pts: [number, number, number, number][] = [
		[17, 82, 1.1, 0], [25, 79, 1.3, 1], [34, 78, 1.4, 2], [44, 77.8, 1.4, 2], [53, 79, 1.3, 1], [62, 81.4, 1.1, 0],
		[21, 85, 1.2, 2], [30, 83, 1.5, 2], [40, 82, 1.6, 1], [50, 83, 1.5, 2], [59, 85, 1.2, 1],
		[28, 87.3, 1.2, 1], [38, 86.6, 1.4, 2], [48, 87, 1.3, 2], [40, 74.8, 1.2, 1], [30, 76, 1, 0],
	];
	for (const [x, y, s, c] of pts) {
			const pal = c === 0 ? G : c === 1 ? Or : R;
			cluster(x, y, s, pal[0], pal[1]);
		}
	return surface + `<path d="M12 84h4M64 85h3" stroke="#7fb3d0" stroke-width=".8" stroke-linecap="round"/>` + ink.svg();
}

function quillwort(stage: GrowingStage): string {
	const n = S(stage, 5, 10, 16);
	const L = S(stage, 14, 34, 50);
	let d = "";
	for (let i = 0; i < n; i++) {
		const u = n === 1 ? 0.5 : i / (n - 1);
		const a = -150 + 120 * u + (i % 2 ? 4 : -4);
		const len = L * (0.7 + 0.3 * Math.sin(Math.PI * u)) * (i % 3 ? 1 : 0.86);
		const [tx, ty] = off(40, 84, a, len);
		const [cx, cy] = off(40, 84, a + (u < 0.5 ? 10 : -10), len * 0.55);
		d += `M40 84Q${nums(cx, cy, tx, ty)}`;
	}
	const bulb = `<ellipse cx="40" cy="84.6" rx="${f(S(stage, 3, 4.6, 6))}" ry="${f(S(stage, 2.2, 3, 3.8))}" fill="#e6dcb8"/>`;
	return pond(S(stage, 12, 17, 21)) + stroke(d, "#3f7e3e", S(stage, 1.8, 2.2, 2.4)) + stroke(d, "#78b25c", 0.7) + bulb;
}

/* ───────────── Fern allies ───────────── */

function whiskFern(stage: GrowingStage): string {
	const ink = new Ink();
	const dots = stage === "bloom";
	const branch = (x: number, y: number, deg: number, len: number, depth: number, w: number) => {
		const [ex, ey] = off(x, y, deg, len);
		ink.seg("#5f9a38", w, x, y, ex, ey);
		if (dots && depth <= 1)
			for (const t of [0.4, 0.8]) {
				const [cx, cy] = off(x, y, deg, len * t);
				const [sx, sy] = off(cx, cy, deg + (t > 0.5 ? 90 : -90), 1.1);
				ink.dot("#e2c23a", sx, sy, 1.15);
			}
		if (depth > 0) {
			branch(ex, ey, deg - 20, len * 0.8, depth - 1, Math.max(0.9, w * 0.78));
			branch(ex, ey, deg + 20, len * 0.8, depth - 1, Math.max(0.9, w * 0.78));
		}
	};
	if (stage === "sprout") branch(40, 87, -90, 9, 1, 1.8);
	else if (stage === "leafy") {
		branch(38, 87, -98, 14, 2, 2.2);
		branch(42, 87, -80, 12, 2, 2);
	} else {
		branch(36, 87, -104, 20, 3, 2.4);
		branch(40, 87, -90, 22, 3, 2.6);
		branch(44, 87, -76, 18, 3, 2.4);
	}
	return ink.svg();
}

function moonwort(stage: GrowingStage): string {
	const stem = "#8aac6c";
	const plant = (x: number, h: number, sc: number, fertile: number) => {
		const split = 87 - h * 0.38;
		let s = line(x, 87, x, split, stem, 1.8 * sc);
		// the sterile frond: a ladder of half-moon pinnae, leaning right
		const pts = walk(x, split, -55, h * 0.44, -28, 4);
		const ink = new Ink();
		for (let j = 1; j <= 4; j++) {
			const p = pts[j]!;
			const r = 6.6 * sc * (1 - j * 0.13);
			ink.add("#86b878", fanD(p.x, p.y, p.a - 90, r, 50)).add("#6fa466", fanD(p.x, p.y, p.a + 90, r, 50));
		}
		ink.add("#86b878", fanD(pts[4]!.x, pts[4]!.y, pts[4]!.a, 3.4 * sc, 50));
		s += stroke(polyD(pts), stem, 1.1 * sc) + ink.svg();
		if (fertile > 0) {
			const ft = 87 - h;
			const fx = x - 7 * sc;
			s += `<path d="M${nums(x, split)}Q${nums(x - 1, (split + ft) / 2, fx, ft + 3)}" stroke="${stem}" stroke-width="${f(1.4 * sc)}" fill="none"/>`;
			const g = new Ink();
			for (let k = 0; k < 4; k++) {
				const y = ft + 2 + k * 3.4 * sc;
				const len = (1.8 + k * 1.1) * sc;
				for (const sd of [-1, 1]) {
					const ex = fx + sd * len;
					g.seg(stem, 0.8, fx, y + 1, ex, y);
					g.dot(k % 2 ? "#c9a446" : "#b08a30", ex, y, 1.4 * sc * fertile).dot(k % 2 ? "#b08a30" : "#c9a446", (fx + ex) / 2, y - 0.9, 1.2 * sc * fertile);
				}
			}
			g.dot("#c9a446", fx, ft + 1, 1.4 * sc * fertile);
			s += g.svg();
		}
		return s;
	};
	if (stage === "sprout") return plant(40, 18, 0.65, 0);
	if (stage === "leafy") return plant(38, 42, 0.95, 0.6);
	return plant(50, 36, 0.8, 0.9) + plant(32, 64, 1.1, 1);
}

function addersTongue(stage: GrowingStage): string {
	const stem = "#7aa84a";
	const plant = (x: number, h: number, sc: number, spike: boolean, lean: number) => {
		const ly = 87 - h * 0.35;
		let s = line(x, 87, x + lean * 0.3, ly, stem, 1.4 * sc);
		if (spike) {
			const top = 87 - h;
			const sx = x + lean;
			s += `<path d="M${f(x + lean * 0.3)} ${f(ly)}Q${f(x + lean * 0.4)} ${f((ly + top) / 2)} ${f(sx)} ${f(top + 12 * sc)}" stroke="${stem}" stroke-width="${f(1.1 * sc)}" fill="none"/>`;
			let d = "";
			for (let k = 0; k < 6; k++) {
				const yy = top + 11 * sc - k * 2 * sc;
				d += `M${f(sx - 1.6 * sc)} ${f(yy)}a${f(1.1 * sc)} ${f(1.1 * sc)} 0 1 0 ${f(2.2 * sc)} 0a${f(1.1 * sc)} ${f(1.1 * sc)} 0 1 0 ${f(-2.2 * sc)} 0M${f(sx - 0.6 * sc)} ${f(yy - sc)}a${f(1.1 * sc)} ${f(1.1 * sc)} 0 1 0 ${f(2.2 * sc)} 0a${f(1.1 * sc)} ${f(1.1 * sc)} 0 1 0 ${f(-2.2 * sc)} 0`;
			}
			s += fill(d, "#c9b45a") + `<path d="M${f(sx)} ${f(top + 12 * sc)}V${f(top - 0.4)}" stroke="#a8923a" stroke-width=".7" stroke-linecap="round"/>`;
		}
		// the single oval blade cupping the stalk
		const ang = lean < 0 ? -128 : -52;
		s += `<g transform="translate(${f(x + lean * 0.3)} ${f(ly)}) rotate(${ang})"><path d="M0 0C${f(4 * sc)} ${f(-8 * sc)} ${f(15 * sc)} ${f(-7 * sc)} ${f(18 * sc)} 0C${f(15 * sc)} ${f(7 * sc)} ${f(4 * sc)} ${f(8 * sc)} 0 0Z" fill="#8cc25a"/><path d="M1 0L${f(15 * sc)} 0" stroke="#5a8a36" stroke-width=".8"/></g>`;
		return s;
	};
	if (stage === "sprout") return plant(40, 18, 0.6, false, 2);
	if (stage === "leafy") return plant(34, 34, 0.85, false, -2) + plant(46, 40, 0.9, true, 2);
	return plant(26, 46, 0.85, true, -3) + plant(55, 52, 0.9, true, 3) + plant(40, 68, 1, true, 1);
}

export const SPECIES: Species[] = [
	{ id: "harts-tongue-fern", name: "Hart's tongue fern", draw: hartsTongue },
	{ id: "japanese-painted-fern", name: "Japanese painted fern", draw: paintedFern },
	{ id: "lady-fern", name: "Lady fern", draw: ladyFern },
	{ id: "cinnamon-fern", name: "Cinnamon fern", draw: cinnamonFern },
	{ id: "christmas-fern", name: "Christmas fern", draw: christmasFern },
	{ id: "autumn-fern", name: "Autumn fern", draw: autumnFern },
	{ id: "hay-scented-fern", name: "Hay-scented fern", draw: hayScented },
	{ id: "bracken", name: "Bracken", draw: bracken },
	{ id: "rabbits-foot-fern", name: "Rabbit's foot fern", draw: rabbitsFoot },
	{ id: "kangaroo-paw-fern", name: "Kangaroo paw fern", draw: kangarooPaw },
	{ id: "blue-star-fern", name: "Blue star fern", draw: blueStar },
	{ id: "silver-lace-fern", name: "Silver lace fern", draw: silverLace },
	{ id: "button-fern", name: "Button fern", draw: buttonFern },
	{ id: "lemon-button-fern", name: "Lemon button fern", draw: lemonButton },
	{ id: "crocodile-fern", name: "Crocodile fern", draw: crocodileFern },
	{ id: "licorice-fern", name: "Licorice fern", draw: licoriceFern },
	{ id: "water-clover", name: "Water clover", draw: waterClover },
	{ id: "mosquito-fern", name: "Mosquito fern", draw: mosquitoFern },
	{ id: "resurrection-fern", name: "Resurrection fern", draw: resurrectionFern },
	{ id: "climbing-fern", name: "Climbing fern", draw: climbingFern },
	{ id: "silver-fern", name: "Silver fern", draw: silverFern },
	{ id: "quillwort", name: "Quillwort", draw: quillwort },
	{ id: "whisk-fern", name: "Whisk fern", draw: whiskFern },
	{ id: "moonwort", name: "Moonwort", draw: moonwort },
	{ id: "adders-tongue", name: "Adder's tongue", draw: addersTongue },
];
