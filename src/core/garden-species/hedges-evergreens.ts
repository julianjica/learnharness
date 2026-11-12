/**
 * Hedges and evergreen shrubs (owner design, 2026-11-11): 25 species in the
 * shared kit style. Small repeated marks (leaves, berries, florets) are
 * merged into one path per paint to keep each drawing's markup small.
 */
import { bez, f, type GrowingStage, type Pt, type Species } from "./kit";

type St = GrowingStage;
type Br = readonly [Pt, Pt, Pt, Pt];
type Shape = 0 | 1 | 2 | 4;
const RAD = Math.PI / 180;

/** Collects path data per paint, emitting one <path> per paint in first-use order. */
class Ink {
	private parts = new Map<string, string>();
	private add(key: string, d: string): this {
		this.parts.set(key, (this.parts.get(key) ?? "") + d);
		return this;
	}
	fill(color: string, d: string): this {
		return this.add(`f|${color}`, d);
	}
	stroke(color: string, width: number, d: string, opacity = 1): this {
		return this.add(`s|${color}|${width}|${opacity}`, d);
	}
	/** A dot: a zero-length round-capped stroke. */
	dot(color: string, x: number, y: number, r: number): this {
		return this.stroke(color, Math.round(r * 20) / 10, `M${f(x)} ${f(y)}h0`);
	}
	toString(): string {
		let s = "";
		for (const [key, d] of this.parts) {
			if (!d) continue;
			const [kind, color, width, op] = key.split("|");
			s +=
				kind === "f"
					? `<path d="${d}" fill="${color}"/>`
					: `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"${op === "1" ? "" : ` opacity="${op}"`}/>`;
		}
		return s;
	}
}

const out = (...inks: Ink[]) => inks.join("");

/** Deterministic hash noise in [0, 1). */
const rnd = (i: number): number => {
	const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
	return x - Math.floor(x);
};

const CTRL: Record<Shape, readonly [number, number, number, number]> = {
	0: [0.3, 1, 0.8, 1],
	1: [0.45, 1.15, 0.8, 0.5],
	2: [0.05, 1.4, 1.02, 1.3],
	4: [0.1, 1.6, 0.75, 1.2],
};

function rot(x: number, y: number, a: number) {
	const c = Math.cos(a * RAD);
	const s = Math.sin(a * RAD);
	return (u: number, v: number) => `${f(x + u * c - v * s)} ${f(y + u * s + v * c)}`;
}

/** A kit-shaped leaf as absolute path data. */
function leafD(x: number, y: number, a: number, len: number, w: number, shape: Shape = 0): string {
	const R = rot(0, 0, a);
	const [a1, b1, a2, b2] = CTRL[shape];
	return `M${f(x)} ${f(y)}c${R(len * a1, -w * b1)} ${R(len * a2, -w * b2)} ${R(len, 0)}c${R(len * (a2 - 1), w * b2)} ${R(len * (a1 - 1), w * b1)} ${R(-len, 0)}Z`;
}

function ribD(x: number, y: number, a: number, len: number): string {
	const P = rot(x, y, a);
	return `M${P(1, 0)}L${P(len * 0.78, 0)}`;
}

/** A toothed (holly-like) leaf. */
function toothD(x: number, y: number, a: number, len: number, w: number): string {
	const P = rot(x, y, a);
	const up: Pt[] = [[0.2, 0.75], [0.36, 1.05], [0.52, 0.8], [0.68, 1], [0.84, 0.55]];
	let d = `M${P(0, 0)}`;
	for (const [u, v] of up) d += `L${P(len * u, -w * v)}`;
	d += `L${P(len, 0)}`;
	for (const [u, v] of [...up].reverse()) d += `L${P(len * u, w * v)}`;
	return `${d}Z`;
}

function ellD(x: number, y: number, rx: number, ry: number, deg = 0): string {
	const c = Math.cos(deg * RAD) * rx;
	const s = Math.sin(deg * RAD) * rx;
	const a = `A${f(rx)} ${f(ry)} ${f(deg)} 1 0`;
	return `M${f(x - c)} ${f(y - s)}${a} ${f(x + c)} ${f(y + s)}${a} ${f(x - c)} ${f(y - s)}Z`;
}

function bD(p: Br): string {
	return `M${f(p[0][0])} ${f(p[0][1])}C${f(p[1][0])} ${f(p[1][1])} ${f(p[2][0])} ${f(p[2][1])} ${f(p[3][0])} ${f(p[3][1])}`;
}

function lineD(x1: number, y1: number, x2: number, y2: number): string {
	return `M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}`;
}

/** A short dash from (x, y) heading `a` (for tiny leaves, needles, petals). */
function dashD(x: number, y: number, a: number, len: number): string {
	return `M${f(x)} ${f(y)}l${f(Math.cos(a * RAD) * len)} ${f(Math.sin(a * RAD) * len)}`;
}

/** Points of a golden-angle spiral filling an ellipse. */
function golden(n: number, cx: number, cy: number, rx: number, ry: number): Pt[] {
	const pts: Pt[] = [];
	for (let i = 0; i < n; i++) {
		const r = Math.sqrt((i + 0.5) / n);
		const a = i * 137.508 * RAD;
		pts.push([cx + rx * r * Math.cos(a), cy + ry * r * Math.sin(a)]);
	}
	return pts;
}

function angAt(p: Br, t: number): number {
	const a = bez(p, Math.max(0, t - 0.02));
	const b = bez(p, Math.min(1, t + 0.02));
	return Math.atan2(b[1] - a[1], b[0] - a[0]) / RAD;
}

interface LeafSet {
	fill: string;
	alt?: string;
	shape?: Shape;
	rib?: string;
}

/** Alternate leaves along a branch (plus one at the tip). */
function leavesOn(k: Ink, top: Ink | null, p: Br, ts: readonly number[], len: number, w: number, o: LeafSet, spread = 55, tip = true): void {
	ts.forEach((t, i) => {
		const [x, y] = bez(p, t);
		const a = angAt(p, t) + (i % 2 === 0 ? spread : -spread);
		const l = len * (0.85 + 0.15 * t);
		k.fill(o.alt && i % 2 ? o.alt : o.fill, leafD(x, y, a, l, w, o.shape ?? 0));
		if (top && o.rib) top.stroke(o.rib, 0.7, ribD(x, y, a, l), 0.6);
	});
	if (tip) {
		const [x, y] = p[3];
		const a = angAt(p, 1);
		k.fill(o.fill, leafD(x, y, a, len * 0.85, w * 0.9, o.shape ?? 0));
		if (top && o.rib) top.stroke(o.rib, 0.7, ribD(x, y, a, len * 0.85), 0.6);
	}
}

/** Opposite leaf pairs along a branch. */
function pairsOn(k: Ink, top: Ink | null, p: Br, ts: readonly number[], len: number, w: number, o: LeafSet, spread = 60): void {
	ts.forEach((t, i) => {
		const [x, y] = bez(p, t);
		const base = angAt(p, t);
		for (const side of [1, -1]) {
			const a = base + side * spread;
			k.fill(o.alt && (i + (side > 0 ? 0 : 1)) % 2 ? o.alt : o.fill, leafD(x, y, a, len, w, o.shape ?? 0));
			if (top && o.rib) top.stroke(o.rib, 0.7, ribD(x, y, a, len), 0.6);
		}
	});
}

/**
 * Leaves scattered over an ellipse, each pointing away from the focus (fx, fy).
 * Paints are pre-registered in order so later colours sit on top.
 */
function mass(k: Ink, top: Ink | null, n: number, cx: number, cy: number, rx: number, ry: number, len: number, w: number, fills: readonly string[], shape: Shape, seed: number, focus: Pt = [cx, cy + ry], rib?: string): void {
	for (const c of fills) k.fill(c, "");
	golden(n, cx, cy, rx, ry).forEach(([x, y], i) => {
		const a = Math.atan2(y - focus[1], x - focus[0]) / RAD + (rnd(seed + i) - 0.5) * 50;
		const c = fills[Math.floor(rnd(seed + i * 3.7) * fills.length)]!;
		const l = len * (0.85 + 0.3 * rnd(seed + i * 1.3));
		k.fill(c, leafD(x, y, a, l, w, shape));
		if (top && rib) top.stroke(rib, 0.6, ribD(x, y, a, l), 0.55);
	});
}

/** A sprout: a short stem with leaf pairs and a tip leaf. */
function sprout(stemC: string, h: number, len: number, w: number, o: LeafSet, pairs = 2, lean = 1): string {
	const k = new Ink();
	const top = new Ink();
	const p: Br = [[40, 87], [40, 87 - h * 0.4], [40 + lean * 0.5, 87 - h * 0.75], [40 + lean, 87 - h]];
	k.stroke(stemC, 1.6, bD(p));
	pairsOn(k, top, p, pairs === 1 ? [0.6] : pairs === 2 ? [0.45, 0.75] : [0.35, 0.58, 0.8], len, w, o, 58);
	k.fill(o.alt ?? o.fill, leafD(40 + lean, 87 - h, -90 + lean * 3, len * 0.8, w * 0.85, o.shape ?? 0));
	return out(k, top);
}

/** A tapered column of dots from (x, y) heading `a` (racemes, spikes, candles). */
function spike(k: Ink, c: string, c2: string | null, x: number, y: number, a: number, len: number, r0: number, r1: number, step = 1.6): void {
	const n = Math.max(2, Math.round(len / step));
	const ca = Math.cos(a * RAD);
	const sa = Math.sin(a * RAD);
	for (let i = 0; i <= n; i++) {
		const u = i / n;
		const side = i % 2 ? 0.7 : -0.7;
		const px = x + ca * len * u - sa * side * (1 - u) * r0;
		const py = y + sa * len * u + ca * side * (1 - u) * r0;
		k.dot(c2 && i % 3 === 1 ? c2 : c, px, py, r0 + (r1 - r0) * (Math.round(u * 2) / 2));
	}
}

/** A clipped, rounded hedge block. */
function blockD(x0: number, y0: number, x1: number, y1: number, r: number): string {
	return `M${f(x0 + 1)} ${f(y1)}L${f(x0)} ${f(y0 + r)}Q${f(x0)} ${f(y0)} ${f(x0 + r)} ${f(y0)}L${f(x1 - r)} ${f(y0)}Q${f(x1)} ${f(y0)} ${f(x1)} ${f(y0 + r)}L${f(x1 - 1)} ${f(y1)}Z`;
}

/* ---------------------------------------------------------------- 1 privet */

function privet(st: St): string {
	const L: LeafSet = { fill: "#4b8c42", alt: "#67a552" };
	if (st === "sprout") return sprout("#6b5a3a", 17, 5.5, 2.2, L, 3);
	const k = new Ink();
	const tx = new Ink();
	const leafy = st === "leafy";
	const [x0, y0, x1, y1] = leafy ? [25, 52, 55, 83] : [9, 32, 71, 83];
	for (let x = x0 + 5; x < x1 - 2; x += 8) k.stroke("#6b5a3a", 1.6, lineD(40 + (x - 40) * 0.4, 87, x, y1 - 3));
	k.fill("#356e33", blockD(x0, y0, x1, y1, 4));
	// soft clipped edge: tiny leaves along the top and sides
	for (let x = x0 + 2; x <= x1 - 2; x += 3.2) tx.fill("#4b8c42", leafD(x, y0 + 1.5, -90 + (rnd(x) - 0.5) * 70, 3.4, 1.5));
	for (let y = y0 + 5; y < y1 - 2; y += 4.5) {
		tx.fill("#4b8c42", leafD(x0 + 1, y, 180 + (rnd(y) - 0.5) * 60, 3.2, 1.4) + leafD(x1 - 1, y + 2, (rnd(y + 9) - 0.5) * 60, 3.2, 1.4));
	}
	// leaf texture
	let i = 0;
	for (let y = y0 + 4; y < y1 - 2; y += 4) {
		for (let x = x0 + 3 + ((y / 4) % 2) * 2; x < x1 - 2; x += 4.4) {
			i++;
			const r = rnd(i);
			if (r < 0.25) continue;
			tx.dot(r > 0.7 ? "#78b25c" : "#4b8c42", x + (rnd(i * 2) - 0.5) * 1.6, y + (rnd(i * 3) - 0.5) * 1.6, r > 0.7 ? 0.9 : 1.2);
		}
	}
	if (leafy) return out(k, tx);
	const fl = new Ink();
	for (const [x, h] of [[15, 9], [27, 11], [40, 10], [53, 12], [64, 9]] as const) {
		fl.stroke("#5f8a45", 0.8, lineD(x, y0 + 2, x, y0 - h + 2));
		for (let j = 0; j < 5; j++) {
			const yy = y0 - j * (h / 5);
			const hw = (1 - j / 5) * 3 + 0.6;
			fl.dot("#ece4c2", x - hw, yy, 1.2).dot("#ece4c2", x + hw, yy - 0.8, 1.2).dot("#d6ca98", x, yy - 1, 1);
		}
	}
	for (const [x, y] of [[20, 50], [33, 62], [48, 46], [60, 66], [26, 74]] as const) fl.dot("#26253a", x, y, 1.1).dot("#26253a", x + 1.8, y + 0.8, 1.1);
	return out(k, tx, fl);
}

/* ---------------------------------------------------------- 2 cherry laurel */

function cherryLaurel(st: St): string {
	const fills = ["#245a32", "#2f7040", "#3e8650"];
	const L: LeafSet = { fill: fills[1]!, alt: fills[2]!, rib: "#a6d0a0", shape: 0 };
	if (st === "sprout") {
		const k = new Ink();
		const t = new Ink();
		const p: Br = [[40, 87], [40, 80], [40, 74], [41, 68]];
		k.stroke("#5f6b3a", 1.8, bD(p));
		leavesOn(k, t, p, [0.45, 0.7], 10, 3.4, L, 60);
		return out(k, t);
	}
	const k = new Ink();
	const t = new Ink();
	const leafy = st === "leafy";
	k.stroke("#6a5a3a", 2.2, lineD(40, 87, 34, 78) + lineD(40, 87, 46, 78));
	if (leafy) {
		k.fill("#1c4628", ellD(40, 67, 12, 10));
		mass(k, t, 16, 40, 66, 15, 13, 11, 3.6, fills, 0, 21, [40, 88], "#a6d0a0");
		return out(k, t);
	}
	k.fill("#1c4628", ellD(40, 59, 25, 20));
	mass(k, t, 34, 40, 57, 29, 24, 13, 4.2, fills, 0, 22, [40, 90], "#a6d0a0");
	const c = new Ink();
	for (const [x, y, a] of [[15, 50, -120], [24, 40, -105], [36, 35, -92], [48, 35, -86], [59, 41, -72], [66, 52, -60]] as const) {
		c.stroke("#7a8a4a", 1, dashD(x, y, a, 3));
		spike(c, "#efe9cc", "#d3cba0", x + Math.cos(a * RAD) * 2.5, y + Math.sin(a * RAD) * 2.5, a, 13, 1.7, 0.8, 1.5);
	}
	return out(k, t, c);
}

/* ------------------------------------------------------ 3 portuguese laurel */

function portugueseLaurel(st: St): string {
	const fills = ["#1d4a2e", "#285c38", "#356d44"];
	const red = "#c43a3e";
	if (st === "sprout") return sprout(red, 16, 7.5, 2.8, { fill: fills[1]!, alt: fills[2]!, rib: red }, 2);
	const k = new Ink();
	const t = new Ink();
	const leafy = st === "leafy";
	const [ty, cy, r, n] = leafy ? [58, 46, 13, 18] : [44, 31, 22, 42];
	k.stroke("#6a4a38", leafy ? 2.4 : 3.4, `M40 87C40 78 39.5 ${ty + 8} 40 ${ty}`);
	k.fill("#173d26", ellD(40, cy, r * 0.82, r * 0.78));
	mass(k, t, n, 40, cy, r, r * 0.92, leafy ? 8 : 9.5, 3.2, fills, 0, 31, [40, cy], red);
	if (leafy) return out(k, t);
	const b = new Ink();
	const hi = new Ink();
	for (const [x, y, l] of [[24, 40, 10], [33, 45, 12], [44, 46, 11], [54, 41, 10], [61, 33, 8], [19, 31, 8]] as const) {
		b.stroke(red, 0.9, `M${x} ${y}q1 ${f(l / 2)} 0 ${l}`);
		for (let j = 1; j <= 5; j++) {
			const yy = y + (l * j) / 5.4;
			const dx = j % 2 ? -1.3 : 1.3;
			b.dot(j % 2 ? "#3a1f48" : "#4e2a5e", x + dx, yy, 1.55 - j * 0.08);
			hi.dot("#a088b0", x + dx - 0.5, yy - 0.5, 0.4);
		}
	}
	return out(k, t, b, hi);
}

/* ------------------------------------------------------ 4 red robin photinia */

function redRobin(st: St): string {
	const greens = ["#2a5a32", "#36703c"];
	const reds = ["#a82a2a", "#cc3a30", "#e2584a"];
	if (st === "sprout") {
		const k = new Ink();
		const p: Br = [[40, 87], [40, 80], [40, 75], [40, 68]];
		k.stroke("#6a3a30", 1.6, bD(p));
		pairsOn(k, null, p, [0.45], 7, 2.6, { fill: greens[1]!, shape: 1 });
		pairsOn(k, null, p, [0.82], 5.5, 2.2, { fill: reds[1]!, shape: 1 });
		k.fill(reds[2]!, leafD(40, 68, -90, 5, 2, 1));
		return out(k);
	}
	const k = new Ink();
	const r = new Ink();
	const leafy = st === "leafy";
	k.stroke("#6a3a30", 2, lineD(40, 87, 36, 78) + lineD(40, 87, 44, 78));
	if (leafy) {
		k.fill("#1f4626", ellD(40, 68, 9, 12));
		mass(k, null, 16, 40, 66, 13, 16, 9, 3.2, greens, 1, 41, [40, 88]);
		mass(r, null, 9, 40, 50, 11, 6, 7.5, 2.8, reds, 1, 42, [40, 66]);
		return out(k, r);
	}
	k.fill("#1f4626", ellD(40, 56, 17, 24));
	mass(k, null, 36, 40, 54, 22, 29, 10, 3.5, greens, 1, 43, [40, 90]);
	mass(r, null, 26, 40, 35, 21, 14, 9, 3.2, reds, 1, 44, [40, 62]);
	const fl = new Ink();
	for (const [x, y] of [[27, 28], [47, 21], [57, 34]] as const) {
		for (const [dx, dy] of [[0, 0], [-2.4, 0.8], [2.4, 0.8], [-1.2, -1.6], [1.2, -1.6], [0, 1.8], [-3.6, 2.2], [3.6, 2.2]] as const) fl.dot("#f5efe0", x + dx, y + dy, 1.05);
	}
	return out(k, r, fl);
}

/* ---------------------------------------------------------------- 5 spindle */

function spindle(st: St): string {
	const bark = "#7c8a5e";
	const L: LeafSet = { fill: "#6a9a48", alt: "#86b058", shape: 1, rib: "#3f6a2c" };
	if (st === "sprout") return sprout(bark, 17, 6.5, 2.4, L, 2);
	const k = new Ink();
	const t = new Ink();
	const leafy = st === "leafy";
	const B: Br[] = leafy
		? [
				[[40, 87], [38, 74], [31, 64], [26, 54]],
				[[40, 87], [40, 72], [41, 60], [42, 46]],
				[[40, 87], [43, 75], [50, 65], [55, 56]],
			]
		: [
				[[40, 87], [35, 74], [24, 64], [14, 54]],
				[[40, 87], [38, 70], [30, 50], [26, 30]],
				[[40, 87], [41, 66], [42, 40], [42, 16]],
				[[40, 87], [44, 68], [52, 48], [56, 30]],
				[[40, 87], [46, 74], [57, 64], [66, 54]],
			];
	for (const p of B) k.stroke(bark, leafy ? 1.8 : 2.2, bD(p));
	const AL: LeafSet = leafy ? L : { ...L, alt: "#c2643e" };
	for (const p of B) pairsOn(k, t, p, [0.42, 0.62, 0.82], leafy ? 7 : 8, 2.8, AL, 55);
	if (leafy) return out(k, t);
	const c = new Ink();
	const s = new Ink();
	let i = 0;
	for (const p of B) {
		for (const tt of [0.52, 0.74, 0.94]) {
			if (rnd(i++ * 5) < 0.2) continue;
			const [bx, by] = bez(p, tt);
			const x = bx + (rnd(i) - 0.5) * 3;
			const y = by + 4;
			c.stroke("#7a5a3a", 0.6, lineD(bx, by, x, y - 1.5));
			c.dot("#dc4f8a", x - 1.7, y, 1.9).dot("#dc4f8a", x + 1.7, y, 1.9).dot("#ec7aa8", x, y - 1.5, 1.8).dot("#c23c76", x, y + 1.5, 1.8);
			s.dot("#f39220", x - 1.2, y + 3.4, 1.15).dot("#f39220", x + 1.3, y + 3.2, 1.15);
		}
	}
	return out(k, t, c, s);
}

/* ------------------------------------------------------------- 6 escallonia */

function escallonia(st: St): string {
	const L: LeafSet = { fill: "#2c6636", alt: "#3e7e44" };
	if (st === "sprout") return sprout("#6b4a3a", 15, 4.5, 1.8, L, 3);
	const k = new Ink();
	const leafy = st === "leafy";
	const B: Br[] = leafy
		? [
				[[40, 87], [36, 66], [26, 56], [20, 60]],
				[[40, 87], [38, 62], [36, 50], [32, 46]],
				[[40, 87], [42, 64], [46, 50], [50, 47]],
				[[40, 87], [44, 66], [55, 56], [61, 61]],
			]
		: [
				[[40, 87], [33, 62], [14, 46], [8, 56]],
				[[40, 87], [35, 52], [22, 30], [14, 34]],
				[[40, 87], [38, 46], [32, 18], [24, 18]],
				[[40, 87], [41, 46], [44, 14], [52, 16]],
				[[40, 87], [45, 52], [58, 30], [66, 36]],
				[[40, 87], [47, 62], [66, 46], [72, 56]],
			];
	for (const p of B) k.stroke("#6b4a3a", leafy ? 1.3 : 1.5, bD(p));
	const ts = leafy ? [0.35, 0.47, 0.59, 0.71, 0.83] : [0.3, 0.38, 0.46, 0.54, 0.62, 0.7, 0.78, 0.86];
	for (const p of B) leavesOn(k, null, p, ts, leafy ? 5 : 5.5, 2, L, 50);
	if (leafy) return out(k);
	const fl = new Ink();
	const ce = new Ink();
	B.forEach((p, bi) => {
		for (const tt of [0.6, 0.76, 0.9, 1]) {
			const [x, y] = bez(p, tt);
			for (const [dx, dy] of [[0, 2.4], [2.2, 0.6], [-2.2, 0.8]] as const) {
				const fx = x + dx;
				const fy = y + dy;
				fl.dot((bi + tt * 10) % 2 > 1 ? "#e56f98" : "#d4507c", fx, fy, 1.6);
				ce.dot("#f8cadb", fx, fy, 0.5);
			}
		}
	});
	return out(k, fl, ce);
}

/* ------------------------------------------------------------- 7 griselinia */

function griselinia(st: St): string {
	const fills = ["#7aa846", "#96c25a", "#b3d676"];
	const L: LeafSet = { fill: fills[1]!, alt: fills[2]!, shape: 2, rib: "#5a8a32" };
	if (st === "sprout") return sprout("#7a6a48", 16, 6.5, 3, L, 2);
	const k = new Ink();
	const t = new Ink();
	const leafy = st === "leafy";
	k.stroke("#7a6a48", 2.2, lineD(40, 87, 36, 76) + lineD(40, 87, 44, 76) + lineD(40, 87, 40, 74));
	if (leafy) {
		k.fill("#5f8f36", ellD(40, 64, 10, 15));
		mass(k, t, 18, 40, 63, 13, 18, 8, 3.6, fills, 2, 71, [40, 90], "#5a8a32");
		return out(k, t);
	}
	k.fill("#5f8f36", ellD(40, 50, 18, 28));
	mass(k, t, 42, 40, 49, 22, 32, 9.5, 4.3, fills, 2, 72, [40, 94], "#5a8a32");
	return out(k, t);
}

/* -------------------------------------------------------- 8 box honeysuckle */

function boxHoneysuckle(st: St): string {
	const stemC = "#7d5a3c";
	const cols = ["#3f6e2e", "#5a8c38", "#7aa848"];
	const spray = (k: Ink, p: Br, gap: number, ll: number, seed: number) => {
		k.stroke(stemC, 1, bD(p));
		let i = 0;
		for (let tt = 0.25; tt <= 1.001; tt += gap) {
			const [x, y] = bez(p, tt);
			const a = angAt(p, tt);
			const l = ll * (1.1 - 0.4 * tt);
			k.stroke(cols[Math.floor(rnd(seed + i++) * 3)]!, 1.5, dashD(x, y, a - 70, l) + dashD(x, y, a + 70, l));
		}
	};
	const k = new Ink();
	for (const c of cols) k.stroke(c, 1.5, "");
	if (st === "sprout") {
		spray(k, [[40, 87], [40, 80], [40, 74], [41, 68]], 0.12, 2.8, 1);
		return out(k);
	}
	const leafy = st === "leafy";
	const tips: Pt[] = leafy
		? [[18, 60], [26, 46], [40, 40], [54, 46], [62, 60]]
		: [[6, 54], [12, 36], [24, 22], [40, 14], [56, 22], [68, 36], [74, 54]];
	tips.forEach(([x, y], i) => {
		const mx = 40 + (x - 40) * 0.35;
		spray(k, [[40, 87], [mx, 70], [x - (x - 40) * 0.15, y + 6], [x, y]], leafy ? 0.075 : 0.055, leafy ? 3 : 3.4, i * 17);
	});
	if (leafy) return out(k);
	const b = new Ink();
	tips.forEach(([x, y], i) => {
		const mx = 40 + (x - 40) * 0.35;
		const p: Br = [[40, 87], [mx, 70], [x - (x - 40) * 0.15, y + 6], [x, y]];
		for (const tt of [0.5, 0.7]) {
			const [bx, by] = bez(p, tt + (i % 2) * 0.05);
			b.dot("#6f4fa6", bx + 1.4, by + 2.2, 1.3).dot("#8a6ac0", bx - 1.4, by + 2.6, 1.2);
		}
		const [fx, fy] = bez(p, 0.85);
		b.dot("#efe6c2", fx + 1.8, fy, 0.8).dot("#efe6c2", fx - 1.8, fy + 0.4, 0.8);
	});
	return out(k, b);
}

/* ------------------------------------------------------------------- 9 hebe */

function hebe(st: St): string {
	const L: LeafSet = { fill: "#4a8a4e", alt: "#68a462", shape: 1 };
	if (st === "sprout") return sprout("#5a6a3a", 15, 5, 1.6, L, 3);
	const k = new Ink();
	const leafy = st === "leafy";
	const R = leafy ? 17 : 27;
	const cy = 86;
	k.fill("#336a3c", `M${40 - R * 0.95} 86Q${40 - R} ${cy - R * 1.05} 40 ${cy - R * 1.08}Q${40 + R} ${cy - R * 1.05} ${40 + R * 0.95} 86Z`);
	const n = leafy ? 7 : 11;
	const tips: [number, number, number][] = [];
	for (let i = 0; i < n; i++) {
		const a = -168 + (156 * i) / (n - 1);
		const len = R * (0.95 + 0.08 * rnd(i + 3));
		const tx = 40 + Math.cos(a * RAD) * len;
		const ty = cy + Math.sin(a * RAD) * len * 0.98;
		tips.push([tx, ty, a]);
		const ca = Math.cos(a * RAD);
		const sa = Math.sin(a * RAD);
		for (const u of [0.82]) {
			const x = 40 + ca * len * u;
			const y = cy + sa * len * 0.98 * u;
			k.fill(u > 0.7 ? L.alt! : L.fill, leafD(x, y, a - 38, 5.5, 1.6, 1) + leafD(x, y, a + 38, 5.5, 1.6, 1));
		}
		k.fill(L.alt!, leafD(tx, ty, a, 4.5, 1.5, 1));
	}
	const inner = new Ink();
	golden(leafy ? 9 : 18, 40, cy - R * 0.45, R * 0.62, R * 0.4).forEach(([x, y], i) => {
		const a = Math.atan2(y - cy, x - 40) / RAD;
		inner.stroke(i % 2 ? "#5d9a58" : "#4a8a4e", 1.5, dashD(x, y, a - 32, 3.4) + dashD(x, y, a + 32, 3.4) + dashD(x, y, a, 3.8));
	});
	if (leafy) return out(k, inner);
	const sp = new Ink();
	tips.forEach(([x, y, a], i) => {
		if (i % 2 === 1 && i !== 5) return;
		spike(sp, "#8a62c8", "#a684dc", x, y, a * 0.6 - 36, 11, 1.7, 0.8, 1.7);
	});
	tips.forEach(([x, y, a], i) => {
		if (i % 2 === 0 || i === 5) return;
		spike(sp, "#a684dc", null, x, y, a * 0.6 - 36, 9, 1.5, 0.7, 1.7);
	});
	return out(k, inner, sp);
}

/* ---------------------------------------------------------------- 10 skimmia */

function skimmia(st: St): string {
	const fills = ["#346e3e", "#4a8a4c"];
	const whorl = (k: Ink, t: Ink, x: number, y: number, len: number, seed: number) => {
		for (let j = 0; j < 7; j++) {
			const a = -200 + j * 36.6 + (rnd(seed + j) - 0.5) * 14;
			const l = len * (a < -170 || a > -10 ? 0.85 : 1);
			k.fill(fills[j % 2]!, leafD(x, y, a, l, l * 0.33));
			t.stroke("#1f4a28", 0.6, ribD(x, y, a, l), 0.55);
		}
	};
	const k = new Ink();
	const t = new Ink();
	for (const c of fills) k.fill(c, "");
	if (st === "sprout") {
		k.stroke("#5a6a3a", 1.6, lineD(40, 87, 40, 74));
		whorl(k, t, 40, 74, 7, 1);
		return out(k, t);
	}
	const leafy = st === "leafy";
	const W: [number, number][] = leafy
		? [[29, 75], [51, 75], [40, 66]]
		: [[13, 78], [27, 78], [53, 78], [67, 78], [40, 77], [20, 68], [34, 67], [47, 67], [60, 68], [40, 57]];
	const bg = new Ink();
	for (const [x, y] of W) bg.stroke("#5a6a3a", 1.4, lineD(40 + (x - 40) * 0.3, 87, x, y));
	bg.fill("#25502c", leafy ? "M24 87Q24 66 40 64Q56 66 56 87Z" : "M12 87Q12 62 40 58Q68 62 68 87Z");
	W.forEach(([x, y], i) => whorl(k, leafy ? t : new Ink(), x, y, leafy ? 9 : 9.5, i * 13));
	const b = new Ink();
	const hi = new Ink();
	W.forEach(([x, y], i) => {
		if (!leafy && i < 5 && i % 2 === 0) return;
		const offs: Pt[] = leafy ? [[0, -1.4], [-1.3, 0], [1.3, 0]] : [[0, -3], [-1.8, -1.6], [1.8, -1.6], [0, -0.4], [-2.6, 0.6], [2.6, 0.6], [-0.9, -4.6], [1, -4.6]];
		for (const [dx, dy] of offs) {
			b.dot(leafy ? "#9ab05a" : "#c8263a", x + dx, y + dy, leafy ? 0.9 : 1.4);
			if (!leafy) hi.dot("#ff9aa4", x + dx - 0.45, y + dy - 0.45, 0.35);
		}
	});
	return out(bg, k, t, b, hi);
}

/* ---------------------------------------------------------------- 11 mahonia */

function mahonia(st: St): string {
	const fills = ["#2c5a48", "#3d7258"];
	const comp = (k: Ink, x: number, y: number, a: number, len: number, pairs: number, toothed = true) => {
		const ca = Math.cos(a * RAD);
		const sa = Math.sin(a * RAD);
		const lf = toothed ? (px: number, py: number, aa: number, l: number) => toothD(px, py, aa, l, l * 0.36) : (px: number, py: number, aa: number, l: number) => leafD(px, py, aa, l * 1.2, l * 0.42, 1);
		k.stroke("#5a4a30", 0.8, lineD(x, y, x + ca * len, y + sa * len));
		for (let i = 1; i <= pairs; i++) {
			const u = (len * (i + 0.2)) / (pairs + 1);
			const px = x + ca * u;
			const py = y + sa * u;
			const l = 5.4 - i * 0.2;
			k.fill(fills[0]!, lf(px, py, a - 62, l)).fill(fills[1]!, lf(px, py, a + 62, l));
		}
		k.fill(fills[1]!, lf(x + ca * len, y + sa * len, a, 5.2));
	};
	const k = new Ink();
	for (const c of fills) k.fill(c, "");
	if (st === "sprout") {
		k.stroke("#7a5a3a", 1.6, lineD(40, 87, 40, 74));
		comp(k, 40, 74, -130, 9, 2);
		comp(k, 40, 74, -50, 9, 2);
		return out(k);
	}
	const leafy = st === "leafy";
	const crowns: [number, number][] = leafy ? [[40, 62]] : [[30, 58], [50, 54], [40, 46]];
	for (const [x, y] of crowns) k.stroke("#7a5a3a", 2.4, `M${40 + (x - 40) * 0.2} 87L${x} ${y}`);
	const angs: number[][] = leafy ? [[-170, -130, -90, -50, -10]] : [[-200, -160, -122], [-58, -20, 18], [-150]];
	crowns.forEach(([x, y], ci) => {
		for (const a of angs[ci]!) comp(k, x, y, a, leafy ? 15 : 19, 3, leafy);
	});
	if (leafy) return out(k);
	const y = new Ink();
	for (const [x0, y0, a, l] of [[37, 47, -140, 19], [38, 46, -119, 23], [40, 45, -98, 27], [41, 45, -80, 26], [42, 46, -61, 23], [43, 47, -42, 19]] as const) {
		spike(y, "#f2c230", "#e5a91e", x0, y0, a, l, 1.6, 1, 2);
	}
	return out(k, y);
}

/* -------------------------------------------------------- 12 spotted laurel */

function spottedLaurel(st: St): string {
	const fills = ["#3a7838", "#4c8c42"];
	const k = new Ink();
	const sp = new Ink();
	for (const c of fills) k.fill(c, "");
	let n = 0;
	const lf = (x: number, y: number, a: number, len: number) => {
		k.fill(fills[n++ % 2]!, leafD(x, y, a, len, len * 0.34, 1));
		const P = rot(x, y, a);
		for (let j = 0; j < 5; j++) {
			const u = 0.2 + 0.13 * j + rnd(n * 7 + j) * 0.05;
			const v = (rnd(n * 11 + j) - 0.5) * len * 0.36 * (1 - Math.abs(u - 0.45));
			const [px, py] = P(len * u, v).split(" ").map(Number) as [number, number];
			sp.dot(j % 2 ? "#e6cf5a" : "#f2e28a", px, py, j % 3 ? 0.55 : 0.75);
		}
	};
	if (st === "sprout") {
		k.stroke("#5a8a3a", 1.8, lineD(40, 87, 40, 72));
		lf(40, 80, -150, 9);
		lf(40, 76, -30, 9);
		lf(40, 72, -90, 8);
		return out(k, sp);
	}
	const leafy = st === "leafy";
	const B: Br[] = leafy
		? [
				[[40, 87], [37, 76], [31, 66], [26, 58]],
				[[40, 87], [40, 74], [40, 62], [41, 50]],
				[[40, 87], [44, 76], [50, 66], [55, 59]],
			]
		: [
				[[40, 87], [34, 76], [22, 66], [13, 58]],
				[[40, 87], [37, 70], [30, 50], [25, 36]],
				[[40, 87], [40, 66], [40, 44], [41, 24]],
				[[40, 87], [44, 70], [50, 52], [56, 36]],
				[[40, 87], [47, 76], [58, 66], [67, 58]],
			];
	const st2 = new Ink();
	for (const p of B) st2.stroke("#5a8a3a", leafy ? 1.8 : 2.2, bD(p));
	for (const p of B) {
		for (const [tt, s] of [[0.5, 1], [0.66, -1], [0.82, 1], [0.95, -1]] as const) {
			const [x, y] = bez(p, tt);
			lf(x, y, angAt(p, tt) + s * 52, leafy ? 10 : 12.5);
		}
		lf(p[3][0], p[3][1], angAt(p, 1), leafy ? 9 : 11);
	}
	if (leafy) return out(st2, k, sp);
	const b = new Ink();
	const hi = new Ink();
	for (const [x, y] of [[30, 56], [46, 50], [36, 70], [54, 68]] as const) {
		for (const [dx, dy] of [[0, 0], [2.4, 1], [0.6, 2.6], [-2, 1.4]] as const) {
			b.dot("#d42a2a", x + dx, y + dy, 1.5);
			hi.dot("#ff9a90", x + dx - 0.5, y + dy - 0.5, 0.4);
		}
	}
	return out(st2, k, sp, b, hi);
}

/* --------------------------------------------------------------- 13 firethorn */

function firethorn(st: St): string {
	const L: LeafSet = { fill: "#365f34", alt: "#4c7a3e", shape: 1 };
	if (st === "sprout") return sprout("#6a4a3a", 15, 5, 1.9, L, 2);
	const k = new Ink();
	const th = new Ink();
	const leafy = st === "leafy";
	const B: Br[] = leafy
		? [
				[[40, 87], [36, 74], [30, 62], [27, 50]],
				[[40, 87], [40, 72], [40, 58], [41, 44]],
				[[40, 87], [44, 74], [50, 62], [54, 51]],
			]
		: [
				[[40, 87], [34, 76], [22, 64], [10, 56]],
				[[40, 87], [36, 70], [26, 48], [20, 28]],
				[[40, 87], [39, 64], [36, 38], [35, 12]],
				[[40, 87], [42, 64], [46, 38], [50, 14]],
				[[40, 87], [45, 70], [55, 48], [62, 30]],
				[[40, 87], [47, 76], [60, 66], [71, 58]],
			];
	for (const p of B) {
		k.stroke("#6a4a3a", leafy ? 1.5 : 1.8, bD(p));
		for (let tt = 0.3; tt < 0.95; tt += 0.13) {
			const [x, y] = bez(p, tt);
			th.stroke("#6a4a3a", 0.7, dashD(x, y, angAt(p, tt) + (tt * 100 > 50 ? 70 : -70), 2.4));
		}
	}
	for (const p of B) leavesOn(k, null, p, [0.36, 0.48, 0.6, 0.72, 0.84], leafy ? 5 : 5.5, 1.9, L, 55);
	if (leafy) return out(th, k);
	const b = new Ink();
	const hi = new Ink();
	B.forEach((p, bi) => {
		for (const tt of [0.42, 0.62, 0.82]) {
			const [x0, y0] = bez(p, tt);
			const cx = x0 + (bi < 3 ? 1.6 : -1.6);
			const cy = y0 + 2.4;
			for (const [dx, dy] of [[0, 0], [2.2, 0.6], [-2.1, 0.8], [1, 2.4], [-1.1, 2.6], [0.3, -1.9], [2.4, -1.4], [-2, -1.3]] as const) {
				b.dot(dx > 1 || dy > 2 ? "#e06a1c" : "#f28c2a", cx + dx, cy + dy, 1.25);
				if (dy < -1.5) hi.dot("#ffc888", cx + dx - 0.4, cy + dy - 0.4, 0.3);
			}
		}
	});
	return out(th, k, b, hi);
}

/* ------------------------------------------------------------- 14 cotoneaster */

function cotoneaster(st: St): string {
	const k = new Ink();
	const lv = new Ink();
	const b = new Ink();
	const bark = "#5e4434";
	const lc = ["#3a7238", "#4f8a42", "#c25a32"];
	for (const c of lc) lv.dot(c, -9, -9, 0);
	const fish = (p: Br, gap: number, tw: number, seed: number, ripe: boolean) => {
		k.stroke(bark, 1.5, bD(p));
		let i = 0;
		for (let tt = 0.18; tt <= 1.001; tt += gap) {
			const [x, y] = bez(p, tt);
			const a = angAt(p, tt) + (i % 2 ? 48 : -48);
			const l = tw * (1.05 - 0.4 * tt);
			const ex = x + Math.cos(a * RAD) * l;
			const ey = y + Math.sin(a * RAD) * l;
			k.stroke(bark, 0.7, lineD(x, y, ex, ey));
			for (const u of [0.45, 1]) {
				const r = rnd(seed + i * 3 + u);
				lv.dot(lc[r < 0.12 && ripe ? 2 : r < 0.55 ? 0 : 1]!, x + (ex - x) * u, y + (ey - y) * u, 1.3);
			}
			if (ripe && i % 2 === 0) b.dot("#e0302a", x + (ex - x) * 0.7 + 0.8, y + (ey - y) * 0.7 + 1.3, 1.2);
			i++;
		}
		lv.dot(lc[1]!, p[3][0], p[3][1], 1.2);
	};
	if (st === "sprout") {
		fish([[40, 87], [38, 82], [34, 77], [30, 74]], 0.22, 4, 1, false);
		fish([[40, 87], [42, 82], [46, 77], [50, 74]], 0.22, 4, 9, false);
		return out(k, lv);
	}
	const leafy = st === "leafy";
	const B: Br[] = leafy
		? [
				[[40, 86], [32, 80], [24, 76], [16, 74]],
				[[40, 86], [38, 76], [34, 68], [30, 62]],
				[[40, 86], [48, 80], [56, 76], [64, 73]],
				[[40, 86], [43, 76], [48, 68], [52, 63]],
			]
		: [
				[[40, 86], [28, 82], [16, 80], [6, 78]],
				[[40, 86], [32, 76], [20, 68], [9, 62]],
				[[40, 86], [37, 72], [30, 62], [24, 54]],
				[[40, 86], [52, 82], [64, 80], [74, 77]],
				[[40, 86], [48, 75], [60, 67], [71, 60]],
				[[40, 86], [44, 72], [50, 61], [56, 53]],
			];
	B.forEach((p, i) => fish(p, leafy ? 0.11 : 0.075, leafy ? 4.6 : 5.4, i * 31, !leafy));
	return out(k, lv, b);
}

/* -------------------------------------------------------------- 15 osmanthus */

function osmanthus(st: St): string {
	const fills = ["#2a5a36", "#376a40", "#4a7f4c"];
	const bg = new Ink();
	const k = new Ink();
	for (const c of fills) k.fill(c, "");
	if (st === "sprout") {
		k.stroke("#6a5a40", 1.6, lineD(40, 87, 40, 70));
		for (const [y, a] of [[81, -150], [77, -30], [73, -140], [70, -90]] as const) k.fill(fills[1]!, toothD(40, y, a, 7, 2.6));
		return out(k);
	}
	const leafy = st === "leafy";
	const [cy, rx, ry, n, len] = leafy ? [64, 13, 16, 20, 7.5] : [52, 23, 30, 33, 9.5];
	bg.stroke("#6a5a40", 2.2, lineD(40, 87, 34, 74) + lineD(40, 87, 46, 74));
	bg.fill("#1a3f28", ellD(40, cy, rx * 0.85, ry * 0.88));
	golden(n, 40, cy, rx, ry).forEach(([x, y], i) => {
		const a = Math.atan2(y - (cy + ry * 0.6), x - 40) / RAD + (rnd(i + 5) - 0.5) * 60;
		const l = len * (0.85 + 0.3 * rnd(i));
		k.fill(fills[Math.floor(rnd(i * 3.1) * 3)]!, toothD(x, y, a, l, l * 0.3));
	});
	if (leafy) return out(bg, k);
	const fl = new Ink();
	golden(14, 40, cy, rx * 0.85, ry * 0.85).forEach(([x, y], i) => {
		const ox = x + (rnd(i + 40) - 0.5) * 4;
		const oy = y + (rnd(i + 50) - 0.5) * 4;
		for (const [dx, dy] of [[0, 0], [2, 0.8], [-1.8, 1], [0.4, -1.8]] as const) {
			fl.stroke("#fbf7ec", 0.9, `M${f(ox + dx - 0.7)} ${f(oy + dy)}h1.4M${f(ox + dx)} ${f(oy + dy - 0.7)}v1.4`);
		}
	});
	return out(bg, k, fl);
}

/* -------------------------------------------------- 16 mexican orange blossom */

function mexicanOrange(st: St): string {
	const fills = ["#3a8a3c", "#52a248", "#6db85a"];
	const k = new Ink();
	for (const c of fills) k.fill(c, "");
	const tri = (x: number, y: number, a: number, len: number, i: number) => {
		k.fill(fills[i % 3]!, leafD(x, y, a - 32, len * 0.85, len * 0.24, 1) + leafD(x, y, a + 32, len * 0.85, len * 0.24, 1));
		k.fill(fills[(i + 1) % 3]!, leafD(x, y, a, len, len * 0.26, 1));
	};
	if (st === "sprout") {
		k.stroke("#5a7a3a", 1.5, lineD(40, 87, 40, 72));
		tri(40, 79, -150, 8, 0);
		tri(40, 75, -30, 8, 1);
		tri(40, 72, -90, 8, 2);
		return out(k);
	}
	const leafy = st === "leafy";
	const [cy, rx, ry, n, len] = leafy ? [70, 17, 15, 14, 9] : [62, 31, 26, 24, 11];
	const bg = new Ink();
	bg.fill("#2a6a30", ellD(40, cy + 2, rx * 0.8, ry * 0.75));
	golden(n, 40, cy, rx * 0.85, ry * 0.8).forEach(([x, y], i) => {
		const a = Math.atan2(y - 88, x - 40) / RAD + (rnd(i + 2) - 0.5) * 40;
		tri(x, y, a, len * (0.85 + 0.25 * rnd(i)), i);
	});
	if (leafy) return out(bg, k);
	const fl = new Ink();
	const ce = new Ink();
	for (const [x, y] of [[20, 52], [31, 42], [46, 40], [58, 50], [34, 58], [49, 60]] as const) {
		for (const [dx, dy] of [[0, 0], [3.2, 1.6], [-2.6, 2.2]] as const) {
			if (dx && (x + y) % 3 === 0) continue;
			const fx = x + dx;
			const fy = y + dy;
			for (let j = 0; j < 5; j++) {
				const a = (j * 72 - 90) * RAD;
				fl.dot("#fbfaf4", fx + Math.cos(a) * 1.3, fy + Math.sin(a) * 1.3, 0.95);
			}
			ce.dot("#d9d36a", fx, fy, 0.6);
		}
	}
	return out(bg, k, fl, ce);
}

/* -------------------------------------------------------------- 17 sweet box */

function sweetBox(st: St): string {
	const L: LeafSet = { fill: "#2a5c36", alt: "#3b7446", shape: 1, rib: "#9cc69a" };
	if (st === "sprout") return sprout("#3f6a3a", 14, 6, 1.9, L, 2);
	const k = new Ink();
	const t = new Ink();
	const leafy = st === "leafy";
	const B: Br[] = leafy
		? [
				[[40, 87], [36, 72], [28, 64], [22, 66]],
				[[40, 87], [39, 70], [37, 58], [34, 54]],
				[[40, 87], [42, 70], [45, 58], [49, 55]],
				[[40, 87], [44, 72], [52, 64], [58, 67]],
			]
		: [
				[[40, 87], [34, 70], [20, 60], [10, 66]],
				[[40, 87], [36, 64], [28, 48], [19, 46]],
				[[40, 87], [39, 62], [37, 42], [33, 36]],
				[[40, 87], [41, 62], [44, 42], [49, 36]],
				[[40, 87], [44, 64], [53, 48], [62, 47]],
				[[40, 87], [46, 70], [60, 60], [70, 66]],
			];
	for (const p of B) k.stroke("#3f6a3a", 1.3, bD(p));
	for (const p of B) leavesOn(k, t, p, [0.38, 0.52, 0.66, 0.8, 0.92], leafy ? 6.5 : 7.5, 2, L, 48);
	if (leafy) return out(k, t);
	const fl = new Ink();
	const b = new Ink();
	const hi = new Ink();
	B.forEach((p, i) => {
		for (const tt of [0.45, 0.73]) {
			const [x, y] = bez(p, tt);
			for (const a of [60, 90, 120]) fl.stroke("#f7f2e2", 0.7, dashD(x, y + 0.5, a, 2.6));
		}
		const [x, y] = bez(p, i % 2 ? 0.6 : 0.86);
		b.dot("#2a2340", x + 1.4, y + 2.8, 1.9).dot("#2a2340", x - 1.6, y + 3.4, 1.7);
		hi.dot("#a8a4c4", x + 0.8, y + 2.2, 0.5).dot("#a8a4c4", x - 2.1, y + 2.9, 0.45);
	});
	return out(k, t, fl, b, hi);
}

/* --------------------------------------------------------- 18 japanese holly */

function japaneseHolly(st: St): string {
	const k = new Ink();
	const pad = new Ink();
	const tx = new Ink();
	const trunk = "#7d6e5c";
	const pads = (x: number, y: number, rx: number, ry: number, seed: number, berries: boolean) => {
		pad.fill("#24502e", ellD(x, y, rx, ry) + ellD(x - rx * 0.45, y - ry * 0.35, rx * 0.5, ry * 0.75) + ellD(x + rx * 0.4, y - ry * 0.4, rx * 0.55, ry * 0.8));
		golden(Math.round(rx * ry * 0.5), x, y - ry * 0.25, rx * 0.9, ry * 0.85).forEach(([px, py], i) => {
			const r = rnd(seed + i);
			tx.dot(r > 0.6 ? "#6aa25a" : "#3d7a42", px, py, r > 0.6 ? 0.8 : 1.05);
		});
		if (berries) for (let j = 0; j < 4; j++) tx.dot("#1b1d2a", x - rx * 0.6 + j * rx * 0.4, y + ry * 0.55 - (j % 2), 0.9);
	};
	if (st === "sprout") {
		k.stroke(trunk, 1.5, lineD(40, 87, 40, 72));
		for (const [y, s] of [[82, 1], [79, -1], [76, 1], [73, -1]] as const) pad.fill("#3d7a42", leafD(40, y, -90 + s * 60, 3.6, 1.6, 2));
		pad.fill("#6aa25a", leafD(40, 72, -90, 3.4, 1.5, 2));
		return out(k, pad);
	}
	const leafy = st === "leafy";
	if (leafy) {
		k.stroke(trunk, 2.4, "M40 87C38 78 44 70 41 60S38 50 40 46");
		k.stroke(trunk, 1.4, "M41 68Q34 66 29 66M40 58Q47 56 52 56");
		pads(28, 66, 8, 4, 1, false);
		pads(52, 56, 8, 4, 2, false);
		pads(40, 46, 7, 4.5, 3, false);
		return out(k, pad, tx);
	}
	k.stroke(trunk, 3.2, "M40 87C35 76 47 66 42 54S36 36 41 24");
	k.stroke(trunk, 1.6, "M40 72Q28 70 21 70M43 60Q54 58 60 57M39 44Q28 42 23 42M40 34Q50 32 56 31");
	pads(20, 70, 11, 5, 1, true);
	pads(60, 57, 11, 5, 2, true);
	pads(23, 42, 10, 4.6, 3, true);
	pads(56, 31, 9, 4.4, 4, true);
	pads(41, 21, 10, 6, 5, true);
	return out(k, pad, tx);
}

/* ------------------------------------------------------------ 19 laurustinus */

function laurustinus(st: St): string {
	const fills = ["#264f32", "#32623c", "#3f7447"];
	const L: LeafSet = { fill: fills[1]!, alt: fills[2]!, rib: "#7fa880" };
	if (st === "sprout") return sprout("#6a4a3a", 15, 7, 3, L, 2);
	const k = new Ink();
	const t = new Ink();
	const leafy = st === "leafy";
	k.stroke("#6a4a3a", 2.2, lineD(40, 87, 34, 77) + lineD(40, 87, 46, 77));
	if (leafy) {
		k.fill("#1e4228", ellD(40, 66, 13, 12));
		mass(k, t, 18, 40, 65, 15, 14, 8.5, 3.4, fills, 0, 91, [40, 66], "#7fa880");
		const bu = new Ink();
		for (const [x, y] of [[33, 54], [46, 53]] as const) for (const [dx, dy] of [[0, 0], [1.6, 0.6], [-1.6, 0.6], [0.8, -1.2], [-0.8, -1.2]] as const) bu.dot("#c6748e", x + dx, y + dy, 0.8);
		return out(k, t, bu);
	}
	k.fill("#1e4228", ellD(40, 56, 25, 24));
	mass(k, t, 38, 40, 55, 28, 27, 10, 3.8, fills, 0, 92, [40, 56], "#7fa880");
	const pk = new Ink();
	const wh = new Ink();
	const bb = new Ink();
	const heads: Pt[] = [[22, 40], [36, 31], [51, 32], [62, 43], [17, 57], [30, 50], [46, 47], [60, 60], [28, 67], [44, 64]];
	heads.forEach(([x, y], i) => {
		golden(9, x, y, 3.6, 2.4).forEach(([px, py], j) => {
			if ((j + i) % 3 === 0) pk.dot("#d07a98", px, py, 0.9);
			else wh.dot("#f8f1f2", px, py, 1);
		});
	});
	for (const [x, y] of [[14, 68], [66, 70], [52, 74]] as const) bb.dot("#3b4a86", x, y, 1.2).dot("#3b4a86", x + 2, y + 0.8, 1.2).dot("#3b4a86", x + 0.8, y + 2.2, 1.2);
	return out(k, t, pk, wh, bb);
}

/* ------------------------------------------------------- 20 creeping juniper */

function creepingJuniper(st: St): string {
	const cols = ["#3f7a72", "#55958a", "#78b3a6"];
	const k = new Ink();
	const fo = new Ink();
	for (const c of cols) fo.fill(c, "");
	const bough = (x: number, y: number, a: number, len: number, side: number, seed: number) => {
		const ca = Math.cos(a * RAD);
		const sa = Math.sin(a * RAD);
		k.stroke("#6a5040", 1.3, lineD(x, y, x + ca * len * 0.9, y + sa * len * 0.9));
		fo.fill(cols[1]!, leafD(x + ca * len * 0.1, y + sa * len * 0.1, a, len, 3.2, 1));
		let i = 0;
		for (let u = 0.2; u < 0.92; u += 0.12) {
			const px = x + ca * len * u;
			const py = y + sa * len * u;
			const s = i % 2 ? 1 : -1;
			const l = (1 - u) * 9 + 4;
			fo.fill(cols[i % 2 ? 0 : 2]!, leafD(px, py, a + s * 38 * side, l, l * 0.26, 1));
			i++;
		}
		fo.fill(cols[2]!, leafD(x + ca * len * 0.75, y + sa * len * 0.75, a - 10 * side, len * 0.3, 1.5, 1));
		void seed;
	};
	if (st === "sprout") {
		bough(40, 86, -120, 13, 1, 1);
		bough(40, 86, -60, 13, -1, 2);
		return out(k, fo);
	}
	const leafy = st === "leafy";
	const B: [number, number, number, number][] = leafy
		? [[40, 85, -168, 22], [40, 85, -138, 18], [40, 85, -12, 22], [40, 85, -42, 18], [40, 84, -92, 14]]
		: [[38, 85, -176, 33], [38, 84, -160, 30], [39, 83, -135, 24], [42, 85, -4, 33], [42, 84, -20, 30], [41, 83, -45, 24], [40, 83, -96, 18], [40, 84, -112, 22], [40, 84, -72, 22]];
	B.forEach(([x, y, a, l], i) => bough(x, y, a, l, a < -90 ? 1 : -1, i));
	if (leafy) return out(k, fo);
	const b = new Ink();
	for (const [x, y] of [[18, 76], [24, 72], [58, 73], [64, 77], [44, 68], [31, 79], [50, 79]] as const) b.dot("#5a6aa6", x, y, 1.3).dot("#a6b4da", x - 0.4, y - 0.4, 0.45);
	return out(k, fo, b);
}

/* ---------------------------------------------------------------- 21 heather */

function heather(st: St): string {
	const k = new Ink();
	const nd = new Ink();
	const fl = new Ink();
	const fc = ["#a64c8c", "#c766a8", "#e08cc2"];
	for (const c of fc) fl.dot(c, -9, -9, 0);
	const stem = (a: number, len: number, seed: number, bloom: boolean) => {
		const x0 = 40 + Math.cos(a * RAD) * 3;
		const ex = 40 + Math.cos(a * RAD) * len;
		const ey = 86 + Math.sin(a * RAD) * len;
		const p: Br = [[x0, 86], [x0 + (ex - x0) * 0.2, 86 - len * 0.4], [ex - (ex - x0) * 0.1, ey + len * 0.25], [ex, ey]];
		k.stroke("#6a4a3a", 1, bD(p));
		for (let tt = 0.15; tt < 1; tt += 0.07) {
			const [x, y] = bez(p, tt);
			const ang = angAt(p, tt);
			if (bloom && tt > 0.5) {
				const r = rnd(seed + tt * 10);
				fl.dot(fc[r < 0.35 ? 0 : r < 0.75 ? 1 : 2]!, x + (tt * 100 % 2 > 1 ? 1 : -1), y, 1.25);
			} else nd.stroke("#3f7240", 1.2, dashD(x, y, ang - 35, 2.2) + dashD(x, y, ang + 35, 2.2));
		}
		if (bloom) fl.dot(fc[2]!, ex, ey, 0.9);
		else nd.stroke("#5c9450", 1.2, dashD(ex, ey, angAt(p, 1), 1.5));
	};
	if (st === "sprout") {
		for (const [a, l] of [[-108, 15], [-90, 18], [-72, 14]] as const) stem(a, l, a, false);
		return out(k, nd);
	}
	const leafy = st === "leafy";
	const n = leafy ? 9 : 13;
	for (let i = 0; i < n; i++) {
		const a = -150 + (120 * i) / (n - 1) + (rnd(i) - 0.5) * 6;
		const mid = 1 - Math.abs(a + 90) / 75;
		stem(a, (leafy ? 26 : 34) * (0.75 + 0.35 * mid) + rnd(i + 9) * 4, i * 7, !leafy);
	}
	return out(k, nd, fl);
}

/* ------------------------------------------------------------ 22 wintergreen */

function wintergreen(st: St): string {
	const fills = ["#235a32", "#2f6e3c", "#7a3a30"];
	const sk = new Ink();
	const k = new Ink();
	const t = new Ink();
	for (const c of fills) k.fill(c, "");
	const shoot = (x: number, h: number, len: number, seed: number) => {
		sk.stroke("#7a3a2a", 1.3, `M${x} 86Q${x + 1} ${86 - h * 0.6} ${x} ${86 - h}`);
		const angs = [-148, -32, -112, -68, -172, -8];
		for (let j = 0; j < angs.length; j++) {
			const y = 86 - h + (j < 4 ? (j < 2 ? 2.5 : 0) : 5);
			const c = fills[rnd(seed + j) < 0.2 ? 2 : j % 2]!;
			const l = len * (j < 4 ? 1 : 0.85);
			k.fill(c, leafD(x, y, angs[j]!, l, l * 0.38, 0));
			t.stroke("#9cc49a", 0.5, ribD(x, y, angs[j]!, l), 0.6);
		}
	};
	if (st === "sprout") {
		shoot(40, 11, 6.5, 1);
		return out(sk, k, t);
	}
	const leafy = st === "leafy";
	const S: [number, number, number][] = leafy
		? [[29, 15, 8], [42, 21, 9], [54, 14, 8]]
		: [[15, 15, 8.5], [28, 23, 10], [41, 28, 10.5], [54, 22, 10], [66, 16, 8.5]];
	S.forEach(([x, h, l], i) => shoot(x, h, l, i * 11));
	if (leafy) return out(sk, k, t);
	const b = new Ink();
	const hi = new Ink();
	const bell = new Ink();
	S.forEach(([x, h], i) => {
		const y = 86 - h + 8;
		b.dot("#e0262e", x - 2.3, y + 1, 2.2).dot("#e0262e", x + 2.4, y + 2.6, 2);
		hi.dot("#ffb2b2", x - 3, y + 0.3, 0.55).dot("#ffb2b2", x + 1.7, y + 1.9, 0.5);
		if (i % 2) bell.fill("#f6eee4", `M${f(x + 4.6)} ${f(y + 3)}q-1.5 0-1.5 2.3v1.2h3v-1.2q0-2.3-1.5-2.3Z`);
	});
	return out(sk, k, t, b, hi, bell);
}

/* ------------------------------------------------------- 23 heavenly bamboo */

function heavenlyBamboo(st: St): string {
	const k = new Ink();
	const lv = new Ink();
	const cane = "#a8875a";
	const pal = ["#5a9a4a", "#7aa84e", "#c8583a", "#a8382e"];
	for (const c of pal) lv.fill(c, "");
	const spray = (x: number, y: number, a: number, len: number, warm: number) => {
		const ca = Math.cos(a * RAD);
		const sa = Math.sin(a * RAD);
		k.stroke("#7a6a3a", 0.7, lineD(x, y, x + ca * len, y + sa * len));
		for (const [u, da] of [[0.45, -42], [0.75, 42], [1, 0]] as const) {
			const bx = x + ca * len * u;
			const by = y + sa * len * u;
			for (const d of u < 1 ? [-30, 30] : [-40, 0, 40]) {
				const c = pal[(rnd(bx * 3 + d) < warm ? 2 : 0) + (rnd(by + d) < 0.4 ? 1 : 0)]!;
				lv.fill(c, leafD(bx, by, a + da + d, 4.6, 1.5, 1));
			}
		}
	};
	if (st === "sprout") {
		k.stroke(cane, 1.6, lineD(40, 87, 40, 72));
		spray(40, 76, -140, 7, 0.1);
		spray(40, 72, -60, 7, 0.3);
		return out(k, lv);
	}
	const leafy = st === "leafy";
	const C: [number, number][] = leafy ? [[36, 54], [44, 48]] : [[29, 32], [40, 17], [51, 30]];
	for (const [x, y] of C) {
		k.stroke(cane, 1.8, `M${40 + (x - 40) * 0.3} 87L${x} ${y}`);
		for (let yy = 82; yy > y + 3; yy -= 8) {
			const u = (87 - yy) / (87 - y);
			const nx = 40 + (x - 40) * 0.3 + (x - (40 + (x - 40) * 0.3)) * u;
			k.stroke("#7a5e3a", 0.8, lineD(nx - 1.2, yy, nx + 1.2, yy));
		}
	}
	C.forEach(([x, y], i) => {
		const warm = leafy ? 0.15 : 0.55;
		const L = leafy ? 9 : 11;
		spray(x, y, -135 + (i % 2) * 8, L, warm);
		spray(x, y, -45 - (i % 2) * 8, L, warm);
		if (leafy || i === 1) spray(x, y, -90, L * 0.8, warm + 0.1);
		if (!leafy && i === 1) return;
		const ly = y + (leafy ? 14 : 18);
		const lx = 40 + (x - 40) * (0.3 + 0.7 * (87 - ly) / (87 - y));
		spray(lx, ly, x < 40 ? -165 : -15, L, warm * 0.4);
	});
	if (leafy) return out(k, lv);
	const b = new Ink();
	const hi = new Ink();
	for (const [x, y] of [[33, 34], [44, 26], [48, 40]] as const) {
		k.stroke("#7a6a3a", 0.7, `M${x} ${y}q0 4 1 8`);
		for (const [dx, dy] of [[0, 4], [2, 5.5], [-1.6, 6], [1, 8], [-0.6, 9.6], [2.6, 8.4], [-2.4, 8.6], [0.8, 11.2]] as const) {
			b.dot("#d4282e", x + dx, y + dy, 1.35);
			hi.dot("#ff9a9a", x + dx - 0.4, y + dy - 0.4, 0.35);
		}
	}
	return out(k, lv, b, hi);
}

/* ------------------------------------------------- 24 chinese fringe flower */

function fringeFlower(st: St): string {
	const fills = ["#4e1f34", "#6a2c44", "#844056"];
	const L: LeafSet = { fill: fills[1]!, alt: fills[2]! };
	if (st === "sprout") return sprout("#5a3a34", 15, 5.5, 2.6, L, 2);
	const k = new Ink();
	const leafy = st === "leafy";
	k.stroke("#5a3a34", 2, lineD(40, 87, 33, 78) + lineD(40, 87, 47, 78));
	if (leafy) {
		k.fill("#3e1a2a", ellD(40, 72, 13, 12));
		mass(k, null, 22, 40, 70, 17, 14, 6.5, 3, fills, 0, 111, [40, 88]);
		return out(k);
	}
	k.fill("#3e1a2a", ellD(40, 63, 25, 20));
	mass(k, null, 44, 40, 62, 30, 24, 7.5, 3.4, fills, 0, 112, [40, 90]);
	const fl = new Ink();
	golden(14, 40, 58, 25, 19).forEach(([x, y], i) => {
		const cx = x + (rnd(i + 7) - 0.5) * 3;
		const cy = y - 1;
		for (let j = 0; j < 6; j++) {
			const a = -90 + j * 60 + rnd(i * 6 + j) * 30;
			fl.stroke(j % 2 ? "#ee6aaa" : "#d84a8e", 0.9, `M${f(cx)} ${f(cy)}q${f(Math.cos((a - 30) * RAD) * 2)} ${f(Math.sin((a - 30) * RAD) * 2)} ${f(Math.cos(a * RAD) * 4.4)} ${f(Math.sin(a * RAD) * 4.4)}`);
		}
	});
	return out(k, fl);
}

/* ------------------------------------------------------------ 25 yaupon holly */

function yaupon(st: St): string {
	const k = new Ink();
	const lv = new Ink();
	const b = new Ink();
	const bark = "#9a978c";
	const lc = ["#3a6a38", "#558a46"];
	for (const c of lc) lv.stroke(c, 1.5, "");
	const weep = (p: Br, berries: boolean, seed: number) => {
		k.stroke(bark, 1, bD(p));
		let i = 0;
		for (let tt = 0.12; tt <= 1.001; tt += 0.09) {
			const [x, y] = bez(p, tt);
			const a = angAt(p, tt);
			lv.stroke(lc[i % 2]!, 1.5, dashD(x, y, a + 65, 2.2) + dashD(x, y, a - 65, 2.2));
			if (berries && rnd(seed + i) < 0.55) b.dot("#e0262e", x + (i % 2 ? 1.4 : -1.4), y + 1.2, 1.1);
			i++;
		}
	};
	if (st === "sprout") {
		k.stroke(bark, 1.5, "M40 87L40 70");
		weep([[40, 72], [37, 70], [34, 71], [33, 75]], false, 1);
		weep([[40, 72], [43, 70], [46, 71], [47, 75]], false, 2);
		weep([[40, 82], [37, 80], [34, 81], [33, 84]], false, 3);
		return out(k, lv);
	}
	const leafy = st === "leafy";
	const top = leafy ? 46 : 14;
	k.stroke(bark, leafy ? 2.2 : 3, `M40 87C41 74 38 ${top + 24} 40 ${top}`);
	const arcs: Br[] = [];
	const lv2: [number, number, number][] = leafy ? [[46, 12, 22], [55, 9, 16], [64, 7, 10]] : [[14, 18, 50], [24, 15, 40], [36, 13, 30], [48, 10, 20]];
	lv2.forEach(([y, dx, drop], j) => {
		for (const s of [-1, 1]) {
			const v = rnd(j * 2 + s) * 5 - 2.5;
			const ex = 40 + s * (dx + 6 + v + (leafy ? 0 : 6) * (1 - (y - 14) / 48));
			arcs.push([[40, y], [40 + s * dx * 0.5, y - 6], [ex, y - 4], [ex + s * 2.5, y + drop + v]]);
		}
	});
	arcs.forEach((p, i) => weep(p, !leafy, i * 13));
	return out(k, lv, b);
}

/* ------------------------------------------------------------------ export */

const kebab = (name: string): string =>
	name
		.toLowerCase()
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.replace(/'/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");

const ALL: [string, (st: St) => string][] = [
	["Privet", privet],
	["Cherry laurel", cherryLaurel],
	["Portuguese laurel", portugueseLaurel],
	["Red robin photinia", redRobin],
	["Spindle", spindle],
	["Escallonia", escallonia],
	["Griselinia", griselinia],
	["Box honeysuckle", boxHoneysuckle],
	["Hebe", hebe],
	["Skimmia", skimmia],
	["Mahonia", mahonia],
	["Spotted laurel", spottedLaurel],
	["Firethorn", firethorn],
	["Cotoneaster", cotoneaster],
	["Osmanthus", osmanthus],
	["Mexican orange blossom", mexicanOrange],
	["Sweet box", sweetBox],
	["Japanese holly", japaneseHolly],
	["Laurustinus", laurustinus],
	["Creeping juniper", creepingJuniper],
	["Heather", heather],
	["Wintergreen", wintergreen],
	["Heavenly bamboo", heavenlyBamboo],
	["Chinese fringe flower", fringeFlower],
	["Yaupon holly", yaupon],
];

export const SPECIES: Species[] = ALL.map(([name, draw]) => ({ id: kebab(name), name, draw }));
