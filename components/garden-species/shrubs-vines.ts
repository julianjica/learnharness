/**
 * Shrubs, berries and vines (owner design, 2026-11-11): 25 species in the
 * shared kit style. Small repeated marks (leaves, berries, florets) are
 * merged into one path per colour to keep each drawing's markup small.
 */
import { bez, f, GREEN, type GrowingStage, type Pt, type Species } from "./kit";

type Br = readonly [Pt, Pt, Pt, Pt];
type Shape = 0 | 1 | 2 | 4;
const RAD = Math.PI / 180;
const TAU = Math.PI * 2;

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
	/** A dot: a zero-length round-capped stroke (cheaper than a circle path). */
	dot(color: string, x: number, y: number, r: number): this {
		return this.stroke(color, Math.round(r * 20) / 10, `M${f(x)} ${f(y)}h0`);
	}
	/** n stadium-shaped petals (round-capped strokes) whose centres sit r from (x, y). */
	petals(color: string, x: number, y: number, n: number, r: number, rx: number, ry: number, off = 0): this {
		return this.stroke(color, Math.round(ry * 20) / 10, capsD(x, y, n, r, rx, ry, off));
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

/** A kit-shaped leaf (or pointed petal) as absolute path data. */
function leafD(x: number, y: number, a: number, len: number, w: number, shape: Shape = 0): string {
	const R = rot(0, 0, a);
	const [a1, b1, a2, b2] = CTRL[shape];
	return `M${f(x)} ${f(y)}c${R(len * a1, -w * b1)} ${R(len * a2, -w * b2)} ${R(len, 0)}c${R(len * (a2 - 1), w * b2)} ${R(len * (a1 - 1), w * b1)} ${R(-len, 0)}Z`;
}

function ribD(x: number, y: number, a: number, len: number): string {
	const P = rot(x, y, a);
	return `M${P(1, 0)}L${P(len * 0.78, 0)}`;
}

function circD(x: number, y: number, r: number): string {
	return `M${f(x - r)} ${f(y)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;
}

function ellD(x: number, y: number, rx: number, ry: number, deg: number): string {
	const c = Math.cos(deg * RAD) * rx;
	const s = Math.sin(deg * RAD) * rx;
	const a = `A${f(rx)} ${f(ry)} ${f(deg)} 1 0`;
	return `M${f(x - c)} ${f(y - s)}${a} ${f(x + c)} ${f(y + s)}${a} ${f(x - c)} ${f(y - s)}Z`;
}

/** n elliptical petals whose centres sit r from (x, y). */
function petalsD(x: number, y: number, n: number, r: number, rx: number, ry: number, off = 0): string {
	let d = "";
	for (let i = 0; i < n; i++) {
		const a = off + (i * 360) / n;
		d += ellD(x + r * Math.cos(a * RAD), y + r * Math.sin(a * RAD), rx, ry, a);
	}
	return d;
}

/** n pointed petals radiating from (x, y). */
function starD(x: number, y: number, n: number, len: number, w: number, off = 0): string {
	let d = "";
	for (let i = 0; i < n; i++) d += leafD(x, y, off + (i * 360) / n, len, w, 1);
	return d;
}

function capsD(x: number, y: number, n: number, r: number, rx: number, ry: number, off = 0): string {
	const h = Math.max(0, rx - ry);
	let d = "";
	for (let i = 0; i < n; i++) {
		const a = (off + (i * 360) / n) * RAD;
		const c = Math.cos(a);
		const s = Math.sin(a);
		d += h < 0.05 ? `M${f(x + c * r)} ${f(y + s * r)}h0` : `M${f(x + c * (r - h))} ${f(y + s * (r - h))}L${f(x + c * (r + h))} ${f(y + s * (r + h))}`;
	}
	return d;
}

function bD(p: Br): string {
	return `M${f(p[0][0])} ${f(p[0][1])}C${f(p[1][0])} ${f(p[1][1])} ${f(p[2][0])} ${f(p[2][1])} ${f(p[3][0])} ${f(p[3][1])}`;
}

function lineD(x1: number, y1: number, x2: number, y2: number): string {
	return `M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}`;
}

/** A smooth path through points (quadratic through midpoints). */
function polyD(pts: readonly Pt[]): string {
	const first = pts[0];
	const last = pts[pts.length - 1];
	if (!first || !last) return "";
	let d = `M${f(first[0])} ${f(first[1])}`;
	for (let i = 1; i < pts.length - 1; i++) {
		const p = pts[i]!;
		const q = pts[i + 1]!;
		d += `Q${f(p[0])} ${f(p[1])} ${f((p[0] + q[0]) / 2)} ${f((p[1] + q[1]) / 2)}`;
	}
	return `${d}L${f(last[0])} ${f(last[1])}`;
}

function angAt(p: Br, t: number): number {
	const a = bez(p, Math.max(0, t - 0.02));
	const b = bez(p, Math.min(1, t + 0.02));
	return Math.atan2(b[1] - a[1], b[0] - a[0]) / RAD;
}

/** Points of a golden-angle spiral filling an ellipse. */
function golden(n: number, cx: number, cy: number, rx: number, ry: number): Pt[] {
	const out: Pt[] = [];
	for (let i = 0; i < n; i++) {
		const r = Math.sqrt((i + 0.5) / n);
		const a = i * 137.508 * RAD;
		out.push([cx + rx * r * Math.cos(a), cy + ry * r * Math.sin(a)]);
	}
	return out;
}

/** Points twining along a polyline: offset sideways by amp·sin. */
function twine(path: readonly Pt[], amp: number, period: number, phase = 0, step = 2.2): Pt[] {
	const out: Pt[] = [];
	let dist = 0;
	for (let i = 0; i < path.length - 1; i++) {
		const a = path[i]!;
		const b = path[i + 1]!;
		const dx = b[0] - a[0];
		const dy = b[1] - a[1];
		const L = Math.hypot(dx, dy);
		if (L === 0) continue;
		const n = Math.max(1, Math.round(L / step));
		for (let j = i === 0 ? 0 : 1; j <= n; j++) {
			const u = j / n;
			const o = amp * Math.sin((TAU * (dist + u * L)) / period + phase);
			out.push([a[0] + dx * u - (dy / L) * o, a[1] + dy * u + (dx / L) * o]);
		}
		dist += L;
	}
	return out;
}

function dirAt(pts: readonly Pt[], i: number): number {
	const a = pts[Math.max(0, i - 1)]!;
	const b = pts[Math.min(pts.length - 1, i + 1)]!;
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

/** A palmately lobed leaf; its base sits at (x, y), its middle lobe points at `a`. */
function lobedD(x: number, y: number, a: number, R: number, n: number, depth: number, spread: number, round: boolean, fall = 0.3): string {
	const cx = x + Math.cos(a * RAD) * R * 0.75;
	const cy = y + Math.sin(a * RAD) * R * 0.75;
	const P = (th: number, r: number) => `${f(cx + r * Math.cos((a + th) * RAD))} ${f(cy + r * Math.sin((a + th) * RAD))}`;
	const tipR = (th: number) => R * (1 - (fall * Math.abs(th)) / 180);
	const step = n > 1 ? (2 * spread) / (n - 1) : 0;
	const sin = R * (1 - depth);
	const first = Math.max(-176, -spread - step / 2);
	let d = `M${P(180, R * 0.1)}L${P(first, sin * 0.8)}`;
	for (let i = 0; i < n; i++) {
		const th = -spread + i * step;
		const last = i === n - 1;
		const ths = last ? Math.min(176, th + step / 2) : th + step / 2;
		const rs = last ? sin * 0.8 : sin;
		d += round ? `Q${P(th, 2 * tipR(th) - sin * 0.9)} ${P(ths, rs)}` : `L${P(th, tipR(th))}L${P(ths, rs)}`;
	}
	return `${d}Z`;
}

function veinsD(x: number, y: number, a: number, R: number, n: number, spread: number): string {
	const cx = x + Math.cos(a * RAD) * R * 0.75;
	const cy = y + Math.sin(a * RAD) * R * 0.75;
	const step = n > 1 ? (2 * spread) / (n - 1) : 0;
	let d = lineD(x, y, cx, cy);
	for (let i = 0; i < n; i++) {
		const th = (a - spread + i * step) * RAD;
		d += lineD(cx, cy, cx + Math.cos(th) * R * 0.6, cy + Math.sin(th) * R * 0.6);
	}
	return d;
}

/** A coiled tendril starting at (x, y) heading `a`. */
function tendrilD(x: number, y: number, a: number, len: number, dir: 1 | -1 = 1): string {
	const pts: Pt[] = [[x, y]];
	let px = x;
	let py = y;
	let ang = a;
	for (let i = 0; i < 11; i++) {
		const s = (len / 11) * (1 - i / 16);
		ang += dir * (i < 3 ? 9 : 52);
		px += Math.cos(ang * RAD) * s;
		py += Math.sin(ang * RAD) * s;
		pts.push([px, py]);
	}
	return polyD(pts);
}

/** Pinnate leaf: rachis from (x, y) heading `a`, `pairs` leaflet pairs and a terminal leaflet. */
function pinnate(k: Ink, rib: Ink, x: number, y: number, a: number, len: number, pairs: number, ll: number, lw: number, fill: string, alt: string, ribColor: string): void {
	const c = Math.cos(a * RAD);
	const s = Math.sin(a * RAD);
	rib.stroke(ribColor, 0.8, lineD(x, y, x + c * len, y + s * len));
	for (let i = 0; i < pairs; i++) {
		const u = (len * (i + 1)) / (pairs + 1);
		const px = x + c * u;
		const py = y + s * u;
		k.fill(fill, leafD(px, py, a - 55, ll, lw, 1));
		k.fill(alt, leafD(px, py, a + 55, ll, lw, 1));
	}
	k.fill(fill, leafD(x + c * len, y + s * len, a, ll * 1.05, lw, 1));
}

const out = (...inks: Ink[]) => inks.join("");

/* ---------------------------------------------------------------- berries */

function blueberry(st: GrowingStage): string {
	const k = new Ink();
	const top = new Ink();
	const tw = "#8b4c3c";
	const L: LeafSet = { fill: "#5e9c63", alt: "#80b67c", rib: "#2f5a37" };
	if (st === "sprout") {
		k.stroke(tw, 1.7, bD([[40, 87], [40, 80], [41, 74], [41, 68]]));
		k.fill(L.fill, leafD(41, 77, -155, 8, 3.3) + leafD(41, 68, -95, 7, 3)).fill(L.alt!, leafD(41, 72, -25, 8, 3.3));
		return out(k);
	}
	const B: Br[] =
		st === "leafy"
			? [
					[[40, 87], [38, 72], [32, 62], [27, 52]],
					[[40, 87], [40, 70], [41, 58], [42, 44]],
					[[40, 87], [43, 74], [50, 64], [55, 54]],
				]
			: [
					[[40, 87], [36, 72], [27, 60], [19, 48]],
					[[40, 87], [38, 68], [32, 50], [30, 32]],
					[[40, 87], [41, 66], [42, 42], [43, 22]],
					[[40, 87], [43, 68], [50, 50], [53, 32]],
					[[40, 87], [45, 73], [54, 60], [62, 49]],
				];
	for (const p of B) k.stroke(tw, st === "leafy" ? 1.8 : 2.2, bD(p));
	for (const p of B) leavesOn(k, top, p, [0.42, 0.56, 0.7, 0.84], st === "leafy" ? 9 : 10, 3.6, L);
	if (st === "leafy") return out(k, top);
	const ripe = new Ink();
	const marks = new Ink();
	B.forEach((p, i) => {
		const [bx, by] = bez(p, i === 2 ? 0.55 : 0.7);
		const cx = bx + (i < 2 ? 2 : -2);
		const cy = by + 3.5;
		const offs: Pt[] = [[0, 0], [3.8, 1], [-3.6, 1.4], [0.4, 3.9], [-1.2, -3.3]];
		offs.forEach(([dx, dy], j) => {
			const x = cx + dx;
			const y = cy + dy;
			ripe.dot(j === 4 ? "#8d9fd6" : "#4a5ea6", x, y, 2.3);
			marks.dot("#c9d4f4", x - 0.9, y - 0.9, 0.55).dot("#27315f", x + 0.6, y + 0.6, 0.6);
		});
	});
	return out(k, top, ripe, marks);
}

function trifoliate(k: Ink, x: number, y: number, a: number, len: number, fill: string, alt: string): void {
	k.fill(alt, leafD(x, y, a - 50, len * 0.75, len * 0.34, 1) + leafD(x, y, a + 50, len * 0.75, len * 0.34, 1));
	k.fill(fill, leafD(x, y, a, len, len * 0.38, 1));
}

/** A hanging drupelet fruit whose stalk end is (x, y). */
function drupe(k: Ink, hi: Ink, x: number, y: number, fill: string, shine: string, s = 1): void {
	const rows: Pt[] = [[-2.3, 1.8], [0, 1.6], [2.3, 1.8], [-1.2, 3.9], [1.2, 3.9], [-2.2, 3.6], [2.2, 3.6], [-1.1, 5.9], [1.1, 5.9], [0, 7.6]];
	for (const [dx, dy] of rows) k.dot(fill, x + dx * s, y + dy * s, 1.4 * s);
	for (const [dx, dy] of [rows[0]!, rows[4]!, rows[7]!]) hi.dot(shine, x + dx * s - 0.4, y + dy * s - 0.4, 0.42 * s);
	hi.fill(GREEN.dark, leafD(x, y + 0.6, -150, 3, 1, 1) + leafD(x, y + 0.6, -30, 3, 1, 1) + leafD(x, y + 0.6, -90, 2.4, 1, 1));
}

function caneLeaves(k: Ink, p: Br, ts: readonly number[], len: number, fill: string, alt: string, tip = true): void {
	ts.forEach((t, i) => {
		const [x, y] = bez(p, t);
		trifoliate(k, x, y, angAt(p, t) + (i % 2 ? -62 : 62), len, fill, alt);
	});
	if (tip) trifoliate(k, p[3][0], p[3][1], angAt(p, 1), len * 0.9, fill, alt);
}

function raspberry(st: GrowingStage): string {
	const k = new Ink();
	const cane = "#9a5248";
	const lf = "#5fa356";
	const la = "#8cc276";
	if (st === "sprout") {
		k.stroke("#8a6048", 1.7, bD([[40, 87], [40, 80], [40, 75], [40, 70]]));
		trifoliate(k, 40, 78, -150, 8, lf, la);
		trifoliate(k, 40, 70, -85, 10, lf, la);
		return out(k);
	}
	const B: Br[] =
		st === "leafy"
			? [
					[[40, 87], [37, 68], [31, 56], [26, 46]],
					[[40, 87], [42, 66], [47, 54], [53, 44]],
				]
			: [
					[[40, 87], [35, 60], [24, 42], [13, 44]],
					[[40, 87], [40, 58], [39, 36], [33, 20]],
					[[40, 87], [47, 60], [58, 42], [68, 45]],
				];
	for (const p of B) k.stroke(cane, st === "leafy" ? 1.9 : 2.2, bD(p));
	const fr = new Ink();
	const hi = new Ink();
	B.forEach((p, i) => {
		caneLeaves(k, p, st === "leafy" ? [0.45, 0.75] : [0.38, 0.6, 0.82], st === "leafy" ? 11 : 12, lf, la);
		if (st === "bloom") {
			const ts = i === 1 ? [0.55, 0.78] : [0.7, 0.9];
			ts.forEach((t, j) => {
				const [x, y] = bez(p, t);
				k.stroke(cane, 0.9, lineD(x, y, x, y + 2.5));
				drupe(fr, hi, x, y + 2.5, j === 1 && i === 1 ? "#e88a8f" : "#d63a4f", "#f9a8b0");
			});
		}
	});
	return out(k, fr, hi);
}

function thornsD(p: Br, n: number): string {
	let d = "";
	for (let i = 1; i < n; i++) {
		const t = i / n;
		const [x, y] = bez(p, t);
		const a = angAt(p, t) + (i % 2 ? -90 : 90);
		const P = rot(x, y, a);
		d += `M${P(0, -1)}L${P(2, 0.6)}L${P(0, 0.8)}Z`;
	}
	return d;
}

function blackberry(st: GrowingStage): string {
	const k = new Ink();
	const cane = "#7a3d52";
	const lf = "#4e8e4a";
	const la = "#68a65c";
	if (st === "sprout") {
		const p: Br = [[40, 87], [39, 80], [37, 74], [33, 70]];
		k.stroke(cane, 1.7, bD(p)).fill("#b07a88", thornsD(p, 4));
		trifoliate(k, 39, 80, -20, 9, lf, la);
		trifoliate(k, 33, 70, -130, 9, lf, la);
		return out(k);
	}
	const B: Br[] =
		st === "leafy"
			? [
					[[40, 87], [34, 64], [22, 52], [16, 58]],
					[[40, 87], [44, 64], [52, 50], [58, 46]],
				]
			: [
					[[40, 87], [30, 52], [12, 42], [7, 62]],
					[[40, 87], [50, 50], [68, 42], [73, 62]],
					[[40, 87], [38, 62], [32, 44], [24, 32]],
					[[40, 87], [42, 60], [46, 40], [52, 26]],
				];
	for (const p of B) k.stroke(cane, st === "leafy" ? 2 : 2.4, bD(p)).fill("#b07a88", thornsD(p, 9));
	B.forEach((p) => caneLeaves(k, p, st === "leafy" ? [0.4, 0.7] : [0.3, 0.52, 0.74], st === "leafy" ? 11 : 12, lf, la, st === "leafy" || p[3][1] < 40));
	if (st === "leafy") return out(k);
	const fr = new Ink();
	const hi = new Ink();
	const fl = new Ink();
	const fruit: [number, number, number, string][] = [
		[0, 0.86, 0, "#2f2238"],
		[0, 0.96, 0, "#c73a48"],
		[1, 0.86, 0, "#2f2238"],
		[1, 0.96, 0, "#2f2238"],
		[2, 0.88, 0, "#2f2238"],
		[3, 0.86, 0, "#c73a48"],
		[0, 0.66, 0, "#2f2238"],
	];
	for (const [bi, t, , c] of fruit) {
		const [x, y] = bez(B[bi]!, t);
		drupe(fr, hi, x, y + 1, c === "#2f2238" ? "#3a2547" : c, c === "#2f2238" ? "#9a78b6" : "#f4a0a8", 1.05);
	}
	for (const [bi, t] of [[3, 1], [2, 1], [1, 0.68]] as const) {
		const [x, y] = bez(B[bi]!, t);
		fl.petals("#f2ecf0", x, y - 1, 5, 2.4, 2.2, 1.9, -90).dot("#e6cf6e", x, y - 1, 1.2);
	}
	return out(k, fr, hi, fl);
}

function gooseberry(st: GrowingStage): string {
	const k = new Ink();
	const top = new Ink();
	const tw = "#8a7058";
	const lf = "#62a356";
	const la = "#7fb86a";
	const lobed = (p: Br, ts: readonly number[], R: number) =>
		ts.forEach((t, i) => {
			const [x, y] = bez(p, t);
			const a = angAt(p, t) + (i % 2 ? -65 : 65);
			k.fill(i % 2 ? la : lf, lobedD(x, y, a, R, 5, 0.32, 140, true));
			top.stroke(GREEN.dark, 0.6, veinsD(x, y, a, R, 3, 50), 0.5);
		});
	if (st === "sprout") {
		const p: Br = [[40, 87], [40, 80], [41, 75], [42, 70]];
		k.stroke(tw, 1.6, bD(p));
		lobed(p, [0.6, 1], 4.5);
		return out(k, top);
	}
	const B: Br[] =
		st === "leafy"
			? [
					[[40, 87], [36, 70], [28, 60], [22, 60]],
					[[40, 87], [40, 66], [40, 54], [41, 44]],
					[[40, 87], [44, 70], [52, 60], [58, 60]],
				]
			: [
					[[40, 87], [34, 66], [22, 52], [12, 56]],
					[[40, 87], [38, 60], [30, 40], [23, 30]],
					[[40, 87], [42, 58], [48, 38], [56, 28]],
					[[40, 87], [47, 66], [60, 54], [68, 58]],
				];
	for (const p of B) k.stroke(tw, st === "leafy" ? 1.8 : 2.1, bD(p)).fill("#b09a80", thornsD(p, 6));
	for (const p of B) lobed(p, st === "leafy" ? [0.5, 0.75, 1] : [0.35, 0.55, 0.75, 1], st === "leafy" ? 5 : 5.6);
	if (st === "leafy") return out(k, top);
	const fr = new Ink();
	B.forEach((p) => {
		for (const t of [0.5, 0.78]) {
			const [x, y] = bez(p, t);
			const cy = y + 6;
			fr.stroke("#7a8a4a", 0.7, lineD(x, y, x, cy - 3.2));
			fr.fill("#b9d77a", ellD(x, cy, 3.3, 2.8, 90));
			fr.stroke("#86ab4e", 0.5, `M${f(x)} ${f(cy - 3)}V${f(cy + 3)}M${f(x - 1.6)} ${f(cy - 2.4)}Q${f(x - 2.4)} ${f(cy)} ${f(x - 1.6)} ${f(cy + 2.4)}M${f(x + 1.6)} ${f(cy - 2.4)}Q${f(x + 2.4)} ${f(cy)} ${f(x + 1.6)} ${f(cy + 2.4)}`);
			fr.dot("#f2f8dc", x - 1.2, cy - 1.2, 0.6).dot("#7a5a3e", x, cy + 3.3, 0.6);
		}
	});
	return out(k, top, fr);
}

function elderberry(st: GrowingStage): string {
	const k = new Ink();
	const rib = new Ink();
	const tw = "#9a8060";
	const lf = "#5c9a50";
	const la = "#76b064";
	if (st === "sprout") {
		k.stroke(tw, 1.6, bD([[40, 87], [40, 80], [40, 75], [40, 70]]));
		pinnate(k, rib, 40, 76, -150, 9, 1, 5, 1.9, lf, la, GREEN.dark);
		pinnate(k, rib, 40, 70, -70, 10, 1, 5.5, 2, lf, la, GREEN.dark);
		return out(k, rib);
	}
	const B: Br[] =
		st === "leafy"
			? [
					[[40, 87], [36, 70], [30, 60], [26, 52]],
					[[40, 87], [40, 66], [40, 54], [40, 44]],
					[[40, 87], [44, 70], [50, 60], [54, 52]],
				]
			: [
					[[40, 87], [34, 58], [24, 36], [15, 38]],
					[[40, 87], [40, 56], [39, 34], [40, 22]],
					[[40, 87], [46, 58], [56, 36], [65, 38]],
				];
	for (const p of B) k.stroke(tw, st === "leafy" ? 1.9 : 2.3, bD(p));
	B.forEach((p) => {
		for (const [t, side] of [[0.4, 1], [0.66, -1]] as const) {
			const [x, y] = bez(p, t);
			pinnate(k, rib, x, y, angAt(p, t) + side * 58, st === "leafy" ? 12 : 14, 2, st === "leafy" ? 5 : 6, 2, lf, la, GREEN.dark);
		}
	});
	const um = new Ink();
	const hi = new Ink();
	if (st === "leafy") {
		const [x, y] = B[1]![3];
		um.stroke("#9a9a62", 0.6, `M${x} ${y}L${x - 5} ${y - 3}M${x} ${y}L${x} ${y - 4}M${x} ${y}L${x + 5} ${y - 3}`);
		for (const [px, py] of golden(14, x, y - 4, 6.5, 2.4)) um.dot("#efe5bf", px, py, 1.1);
		return out(k, rib, um);
	}
	for (const p of B) {
		const [x, y] = p[3];
		let rays = "";
		for (let i = 0; i < 7; i++) {
			const a = (20 + i * 23.3) * RAD;
			const ex = x + Math.cos(a) * 9;
			const ey = y + 1.5 + Math.sin(a) * 6;
			rays += lineD(x, y, ex, ey);
			for (const [dx, dy] of [[0, 0], [1.5, 1.2], [-1.5, 1.2], [0, 2.4], [1.6, -1], [-1.6, -1]] as const) {
				um.dot("#4c2c66", ex + dx, ey + dy, 1.2);
				if (dy === 0) hi.dot("#a789c8", ex + dx - 0.4, ey + dy - 0.4, 0.42);
			}
		}
		k.stroke("#a83a48", 0.55, rays);
	}
	return out(k, rib, um, hi);
}

/* ---------------------------------------------------------------- shrubs */

function hollyD(x: number, y: number, a: number, len: number, w: number): string {
	const P = rot(x, y, a);
	const up: Pt[] = [[0.18, 0.5], [0.32, 1], [0.48, 0.55], [0.64, 1], [0.8, 0.5]];
	let d = `M${P(0, 0)}`;
	for (const [u, v] of up) d += `L${P(len * u, -w * v)}`;
	d += `L${P(len, 0)}`;
	for (const [u, v] of [...up].reverse()) d += `L${P(len * u, w * v)}`;
	return `${d}Z`;
}

function holly(st: GrowingStage): string {
	const k = new Ink();
	const lv = new Ink();
	const top = new Ink();
	const shades = ["#2d6a3e", "#418553", "#357a48"];
	let n = 0;
	const hl = (x: number, y: number, a: number, len: number) => {
		lv.fill(shades[n++ % 3]!, hollyD(x, y, a, len, len * 0.36));
		top.stroke("#1c4528", 0.6, ribD(x, y, a, len), 0.7);
	};
	if (st === "sprout") {
		k.stroke("#6b5040", 1.6, lineD(40, 87, 40, 74));
		hl(40, 81, -160, 7.5);
		hl(40, 77, -20, 7.5);
		hl(40, 74, -90, 7);
		return out(k, lv, top);
	}
	const leafy = st === "leafy";
	const yT = leafy ? 40 : 14;
	const yB = 84;
	const hwAt = (y: number) => (leafy ? 3 : 4) + (y - yT) * (leafy ? 0.33 : 0.3);
	k.stroke("#6b5040", 2.6, lineD(40, 87, 40, 80));
	k.fill("#22502f", `M40 ${yT}Q${40 + hwAt(yT + 30) * 0.9} ${yT + 18} ${40 + hwAt(yB - 6)} ${yB - 6}Q${40 + hwAt(yB)} ${yB} 40 ${yB}Q${40 - hwAt(yB)} ${yB} ${40 - hwAt(yB - 6)} ${yB - 6}Q${40 - hwAt(yT + 30) * 0.9} ${yT + 18} 40 ${yT}Z`);
	const len = leafy ? 8 : 9.5;
	// leaves around the outline, pointing outward
	for (let y = yT + 6; y < yB - 1; y += leafy ? 7 : 7.5) {
		const hw = hwAt(y);
		hl(40 - hw * 0.62, y, -165 + ((y * 7) % 30), len);
		hl(40 + hw * 0.62, y + 2, -15 - ((y * 5) % 30), len);
	}
	// leaves scattered inside
	golden(leafy ? 10 : 22, 0, 0, 1, 1).forEach(([u, v], i) => {
		const y = yT + 8 + ((v + 1) / 2) * (yB - yT - 12);
		const x = 40 + u * hwAt(y) * 0.7;
		hl(x, y, (u > 0 ? -40 : -140) + ((i * 47) % 70) - 35, len * 0.9);
	});
	hl(40, yT + 6, -90, len);
	if (leafy) return out(k, lv, top);
	const b = new Ink();
	const hi = new Ink();
	for (const [x, y] of [[36, 30], [47, 41], [30, 50], [43, 57], [53, 66], [27, 71], [40, 76]] as const) {
		for (const [dx, dy] of [[0, 0], [2.6, 0.9], [0.9, 2.7]] as const) {
			b.dot("#d6293a", x + dx, y + dy, 1.6);
			hi.dot("#ff9e9e", x + dx - 0.5, y + dy - 0.5, 0.45);
		}
	}
	return out(k, lv, top, b, hi);
}

function topiary(k: Ink, cx: number, cy: number, r: number, n: number): void {
	k.dot("#336a3a", cx, cy, r);
	golden(n, cx, cy, r * 0.86, r * 0.86).forEach(([x, y], i) => {
		const lean = (x - cx + (y - cy)) / r;
		const c = lean < -0.35 ? "#86c06e" : lean > 0.55 ? "#2a5a32" : i % 2 ? "#4f8f4a" : "#5f9e55";
		k.fill(c, ellD(x, y, 1.7, 1, (i * 67) % 180));
	});
}

function boxwood(st: GrowingStage): string {
	const k = new Ink();
	if (st === "sprout") {
		k.stroke("#7a6048", 1.4, lineD(40, 87, 40, 71));
		for (const [y, l] of [[82, 4.5], [77, 4.5], [73, 4]] as const) k.fill("#4f8f4a", leafD(40, y, -160, l, 2, 2) + leafD(40, y, -20, l, 2, 2));
		k.fill("#6faa5e", leafD(40, 71, -90, 4, 2, 2));
		return out(k);
	}
	k.stroke("#6b5040", 2.4, lineD(40, 87, 40, st === "leafy" ? 70 : 18));
	if (st === "leafy") {
		topiary(k, 40, 70, 15, 34);
		return out(k);
	}
	const l1 = new Ink();
	const l2 = new Ink();
	const l3 = new Ink();
	topiary(l1, 40, 71, 16, 34);
	topiary(l2, 40, 42, 11, 20);
	topiary(l3, 40, 21, 7, 10);
	return out(k, l1, l2, l3);
}

/** A mophead / panicle floret field: "+" marks. */
function floretsD(pts: readonly Pt[], arm: number): string {
	return pts.map(([x, y]) => `M${f(x - arm)} ${f(y)}h${f(2 * arm)}M${f(x)} ${f(y - arm)}v${f(2 * arm)}`).join("");
}

function hydrangea(st: GrowingStage): string {
	const k = new Ink();
	const top = new Ink();
	const L: LeafSet = { fill: "#5c9c50", alt: "#76b263", rib: "#2f5a30", shape: 1 };
	const sc = "#6b7a45";
	if (st === "sprout") {
		k.stroke(sc, 1.8, lineD(40, 87, 40, 70));
		pairsOn(k, top, [[40, 87], [40, 80], [40, 76], [40, 70]], [0.55, 1], 9, 4.2, L, 62);
		return out(k, top);
	}
	const B: Br[] =
		st === "leafy"
			? [
					[[40, 87], [37, 74], [32, 64], [30, 56]],
					[[40, 87], [40, 70], [40, 58], [40, 47]],
					[[40, 87], [43, 74], [48, 64], [50, 56]],
				]
			: [
					[[40, 87], [36, 70], [29, 56], [25, 44]],
					[[40, 87], [40, 66], [40, 46], [40, 30]],
					[[40, 87], [44, 70], [51, 56], [55, 44]],
				];
	for (const p of B) k.stroke(sc, 2, bD(p));
	pairsOn(k, top, [[40, 87], [40, 85], [40, 84], [40, 83]], [1], 14, 5.5, L, 80);
	for (const p of B) pairsOn(k, top, p, st === "leafy" ? [0.5, 0.85] : [0.4, 0.68], st === "leafy" ? 11 : 13, 5, L, 62);
	const h = new Ink();
	if (st === "leafy") {
		for (const p of B) {
			const [x, y] = p[3];
			h.dot("#a7cf7c", x, y - 2, 3.6).stroke("#cde6a4", 1.4, floretsD(golden(5, x, y - 2, 2.4, 2.4), 0.7));
		}
		return out(k, top, h);
	}
	const heads: [number, number, number, string, string, string][] = [
		[24, 40, 11, "#6f8bd8", "#a8bdf2", "#8aa4ea"],
		[56, 40, 11, "#8f78d0", "#c4a6ea", "#a98fe0"],
		[40, 24, 12, "#6f8bd8", "#b4c6f4", "#8aa4ea"],
	];
	for (const [x, y, r, base, c1, c2] of heads) {
		h.dot(base, x, y, r);
		const pts = golden(18, x, y, r * 0.8, r * 0.8);
		h.stroke(c1, 2.3, floretsD(pts.filter((_, i) => i % 2 === 0), 1.5));
		h.stroke(c2, 2.3, floretsD(pts.filter((_, i) => i % 2 === 1), 1.5));
	}
	return out(k, top, h);
}

/** Five round petals around a dark eye. */
function bloom5(fl: Ink, eye: Ink, x: number, y: number, r: number, color: string, eyeColor: string): void {
	fl.petals(color, x, y, 5, r * 0.95, r * 0.95, r * 0.8, -90);
	eye.dot(eyeColor, x, y, r * 0.42);
}

function azalea(st: GrowingStage): string {
	const k = new Ink();
	if (st === "sprout") {
		k.stroke("#7a5a48", 1.5, lineD(40, 87, 40, 72));
		for (const a of [-160, -110, -70, -20]) k.fill(a % 20 === 0 ? "#5a9752" : "#6fab60", leafD(40, 72, a, 6.5, 2.4));
		k.fill("#5a9752", leafD(40, 80, -165, 6, 2.2) + leafD(40, 79, -15, 6, 2.2));
		return out(k);
	}
	const leafy = st === "leafy";
	const cy = leafy ? 74 : 66;
	const rx = leafy ? 18 : 25;
	const ry = leafy ? 12 : 18;
	k.fill("#3d7644", leafy ? "M22 86C12 76 22 56 40 56C58 56 68 76 58 86Q40 89 22 86Z" : "M17 86C3 72 12 32 40 32C68 32 77 72 63 86Q40 90 17 86Z");
	const rim = leafy ? 9 : 14;
	for (let i = 0; i <= rim; i++) {
		const a = (-180 + (180 * i) / rim) * RAD;
		const x = 40 + Math.cos(a) * (leafy ? 18 : 25.5);
		const y = (leafy ? 76 : 64) + Math.sin(a) * (leafy ? 18 : 30) * (i === 0 || i === rim ? 0.4 : 1);
		k.fill(i % 2 ? "#5a9752" : "#4a8a4c", leafD(x - Math.cos(a) * 3, y - Math.sin(a) * 3, a / RAD + ((i * 23) % 30) - 15, 7, 2.5));
	}
	golden(leafy ? 18 : 30, 40, cy, rx, ry).forEach(([x, y], i) => {
		const a = Math.atan2(y - 80, x - 40) / RAD;
		k.fill(i % 2 ? "#5a9752" : "#6fab60", leafD(x, y, a, 5.5, 2.2));
	});
	const fl = new Ink();
	const eye = new Ink();
	if (leafy) {
		for (const [x, y] of [[33, 64], [47, 66]] as const) fl.fill("#f08aa0", ellD(x, y, 1.6, 2.4, 0));
		return out(k, fl);
	}
	const spots: Pt[] = [[25, 60], [35, 50], [47, 49], [57, 58], [30, 71], [42, 62], [53, 71], [63, 75], [18, 76], [41, 77]];
	spots.forEach(([x, y], i) => bloom5(fl, eye, x, y, 3, i % 3 ? "#ef6f8c" : "#f59ab0", "#b8385a"));
	return out(k, fl, eye);
}

function whorl(k: Ink, top: Ink, x: number, y: number, len: number, angles: readonly number[]): void {
	angles.forEach((a, i) => {
		k.fill(i % 2 ? "#4c8a52" : "#3a7444", leafD(x, y, a, len, len * 0.26));
		top.stroke("#24502c", 0.7, ribD(x, y, a, len), 0.6);
	});
}

function rhododendron(st: GrowingStage): string {
	const k = new Ink();
	const lv = new Ink();
	const top = new Ink();
	const WH = [160, 125, 55, 20, -170, -10] as const;
	if (st === "sprout") {
		k.stroke("#6b5040", 1.7, lineD(40, 87, 40, 72));
		whorl(lv, top, 40, 72, 10, [150, 30, -150, -30, -90]);
		return out(k, lv, top);
	}
	const B: Br[] =
		st === "leafy"
			? [
					[[40, 87], [37, 74], [31, 66], [27, 60]],
					[[40, 87], [40, 70], [40, 58], [40, 48]],
					[[40, 87], [43, 74], [49, 66], [53, 60]],
				]
			: [
					[[40, 87], [36, 68], [28, 54], [23, 44]],
					[[40, 87], [40, 62], [40, 44], [40, 30]],
					[[40, 87], [44, 68], [52, 54], [57, 44]],
				];
	for (const p of B) k.stroke("#6b5040", st === "leafy" ? 2.2 : 2.6, bD(p));
	whorl(lv, top, 40, 78, 11, [165, 15, -165, -15]);
	for (const p of B) whorl(lv, top, p[3][0], p[3][1], st === "leafy" ? 11 : 14, WH);
	if (st === "leafy") {
		for (const p of B) lv.fill("#7fae6a", leafD(p[3][0], p[3][1], -90, 6, 2.4, 1));
		return out(k, lv, top);
	}
	const fl = new Ink();
	const eye = new Ink();
	const truss: Pt[] = [[-6, 0], [6, 0], [0, -1], [-3.4, -5], [3.4, -5], [0, -9], [-7, -5.5], [7, -5.5]];
	for (const p of B) {
		const [x, y] = p[3];
		truss.forEach(([dx, dy], i) => bloom5(fl, eye, x + dx, y - 3 + dy, 2.5, i % 2 ? "#c0509f" : "#d77cc0", "#7c2a68"));
	}
	return out(k, lv, top, fl, eye);
}

function camellia(st: GrowingStage): string {
	const k = new Ink();
	const top = new Ink();
	const L: LeafSet = { fill: "#2f6b40", alt: "#448553", rib: "#1d4628", shape: 1 };
	const tw = "#6a5040";
	if (st === "sprout") {
		const p: Br = [[40, 87], [40, 80], [40, 75], [40, 69]];
		k.stroke(tw, 1.6, bD(p));
		leavesOn(k, top, p, [0.45, 0.75], 8, 3.4, L, 60);
		return out(k, top);
	}
	const B: Br[] =
		st === "leafy"
			? [
					[[40, 87], [38, 72], [33, 62], [31, 52]],
					[[40, 87], [40, 68], [41, 56], [41, 44]],
					[[40, 87], [42, 72], [48, 62], [51, 54]],
				]
			: [
					[[40, 87], [38, 70], [30, 56], [25, 42]],
					[[40, 87], [40, 64], [41, 40], [40, 20]],
					[[40, 87], [43, 70], [50, 56], [55, 42]],
					[[40, 87], [39, 78], [26, 70], [19, 60]],
					[[40, 87], [42, 78], [55, 70], [62, 61]],
				];
	for (const p of B) k.stroke(tw, st === "leafy" ? 1.8 : 2.1, bD(p));
	for (const p of B) leavesOn(k, top, p, [0.35, 0.5, 0.65, 0.8], st === "leafy" ? 9 : 10, 3.8, L, 50);
	const fl = new Ink();
	if (st === "leafy") {
		fl.fill("#d63c55", ellD(41, 42, 2, 2.8, 90));
		return out(k, top, fl);
	}
	const spots: Pt[] = [[25, 40], [40, 19], [55, 40], [41, 52], [19, 59]];
	spots.forEach(([x, y], i) => {
		const r = i < 3 ? 1 : 0.8;
		fl.petals("#d63c55", x, y, 7, 3.4 * r, 3 * r, 2.6 * r, -90);
		fl.petals("#ea6a80", x, y, 6, 1.8 * r, 2.1 * r, 1.8 * r, -60);
		fl.dot("#f2c94c", x, y, 1.3 * r);
	});
	return out(k, top, fl);
}

function gardenia(st: GrowingStage): string {
	const k = new Ink();
	const top = new Ink();
	const L: LeafSet = { fill: "#2c6440", alt: "#3c7d4e", rib: "#173a22", shape: 0 };
	const tw = "#5a4a3a";
	if (st === "sprout") {
		const p: Br = [[40, 87], [40, 81], [40, 76], [40, 71]];
		k.stroke(tw, 1.5, bD(p));
		pairsOn(k, top, p, [0.5, 1], 8, 3.3, L, 60);
		return out(k, top);
	}
	const B: Br[] =
		st === "leafy"
			? [
					[[40, 87], [36, 78], [28, 72], [22, 68]],
					[[40, 87], [39, 74], [36, 62], [34, 54]],
					[[40, 87], [42, 72], [45, 60], [46, 50]],
					[[40, 87], [44, 78], [52, 72], [58, 68]],
				]
			: [
					[[40, 87], [34, 76], [24, 68], [15, 62]],
					[[40, 87], [37, 70], [31, 56], [28, 44]],
					[[40, 87], [41, 68], [42, 52], [43, 38]],
					[[40, 87], [44, 70], [51, 56], [55, 44]],
					[[40, 87], [46, 76], [56, 68], [65, 62]],
				];
	for (const p of B) k.stroke(tw, 1.8, bD(p));
	for (const p of B) pairsOn(k, top, p, st === "leafy" ? [0.45, 0.75, 1] : [0.35, 0.58, 0.8, 1], st === "leafy" ? 9 : 10, 3.6, L, 58);
	const fl = new Ink();
	const bud = (x: number, y: number) => fl.fill("#e8e1bf", ellD(x, y - 2, 1.6, 2.6, 90)).fill("#3c7d4e", leafD(x, y + 0.6, -60, 2.6, 1, 1) + leafD(x, y + 0.6, -120, 2.6, 1, 1));
	if (st === "leafy") {
		bud(34, 52);
		bud(46, 48);
		return out(k, top, fl);
	}
	for (const [x, y, r] of [[28, 41, 1], [43, 34, 1.05], [55, 41, 0.95], [40, 55, 0.8]] as const) {
		let d = "";
		for (let i = 0; i < 6; i++) {
			const a = i * 60 - 90;
			d += ellD(x + Math.cos(a * RAD) * 3.1 * r, y + Math.sin(a * RAD) * 3.1 * r, 3.5 * r, 2.1 * r, a + 28);
		}
		fl.fill("#e9dfbd", d).petals("#fbf7ea", x, y, 5, 1.5 * r, 2.4 * r, 1.4 * r, -54).dot("#d9c26a", x, y, 0.8 * r);
	}
	bud(15, 60);
	bud(65, 60);
	return out(k, top, fl);
}

function lilac(st: GrowingStage): string {
	const k = new Ink();
	const top = new Ink();
	const L: LeafSet = { fill: "#5c9a50", alt: "#74ae62", rib: "#2f5a30", shape: 4 };
	const tw = "#7a6050";
	if (st === "sprout") {
		const p: Br = [[40, 87], [40, 81], [40, 76], [40, 70]];
		k.stroke(tw, 1.6, bD(p));
		pairsOn(k, top, p, [0.5, 1], 7.5, 3.4, L, 58);
		return out(k, top);
	}
	const B: Br[] =
		st === "leafy"
			? [
					[[40, 87], [37, 72], [31, 62], [28, 54]],
					[[40, 87], [40, 68], [41, 56], [41, 46]],
					[[40, 87], [43, 72], [49, 62], [52, 54]],
				]
			: [
					[[40, 87], [36, 68], [28, 54], [24, 42]],
					[[40, 87], [40, 64], [41, 48], [41, 34]],
					[[40, 87], [44, 68], [52, 54], [57, 42]],
				];
	for (const p of B) k.stroke(tw, st === "leafy" ? 2 : 2.4, bD(p));
	for (const p of B) pairsOn(k, top, p, st === "leafy" ? [0.5, 0.8, 1] : [0.4, 0.62, 0.84], st === "leafy" ? 8.5 : 9.5, 4, L, 60);
	if (st === "leafy") return out(k, top);
	const cols = ["#c2a6ea", "#a98ade", "#dccbf5"];
	const buckets: Pt[][] = [[], [], []];
	const fl = new Ink();
	B.forEach((p, bi) => {
		const [x, y] = p[3];
		const tilt = (bi - 1) * 0.3;
		const tx = x + 19 * tilt;
		const ty = y - 20;
		fl.fill("#8a6ac2", `M${f(x - 5.8)} ${f(y)}Q${f(x - 6.5 + 8 * tilt)} ${f(y - 11)} ${f(tx)} ${f(ty)}Q${f(x + 6.5 + 8 * tilt)} ${f(y - 11)} ${f(x + 5.8)} ${f(y)}Q${f(x)} ${f(y + 2.5)} ${f(x - 5.8)} ${f(y)}Z`);
		for (let j = 0; j < 9; j++) {
			const yy = y - 0.5 - j * 2.1;
			const hw = 4.6 * Math.pow(1 - j / 9.5, 0.75);
			const m = Math.max(1, Math.round(hw / 1.15));
			for (let i = 0; i < m; i++) {
				const xx = x + (y - yy) * tilt + (m === 1 ? 0 : -hw + (2 * hw * i) / (m - 1)) + (j % 2 ? 0.6 : -0.6);
				buckets[(i * 2 + j + bi) % 3]!.push([xx, yy]);
			}
		}
	});
	buckets.forEach((pts, i) => fl.stroke(cols[i]!, 1.3, floretsD(pts, 0.8)));
	return out(k, top, fl);
}

function forsythia(st: GrowingStage): string {
	const k = new Ink();
	const W: Br[] =
		st === "sprout"
			? [
					[[40, 87], [38, 80], [35, 74], [31, 71]],
					[[40, 87], [41, 79], [44, 72], [48, 68]],
				]
			: st === "leafy"
				? [
						[[40, 87], [32, 68], [22, 58], [15, 62]],
						[[40, 87], [36, 64], [32, 52], [28, 44]],
						[[40, 87], [42, 64], [46, 50], [51, 42]],
						[[40, 87], [48, 68], [58, 58], [65, 62]],
					]
				: [
						[[40, 87], [30, 60], [18, 44], [7, 52]],
						[[40, 87], [34, 56], [26, 34], [17, 28]],
						[[40, 87], [38, 52], [36, 28], [30, 13]],
						[[40, 87], [42, 52], [46, 26], [52, 13]],
						[[40, 87], [46, 56], [54, 34], [63, 28]],
						[[40, 87], [50, 60], [62, 44], [73, 52]],
						[[40, 87], [36, 72], [24, 64], [15, 70]],
						[[40, 87], [44, 72], [56, 64], [65, 70]],
					];
	for (const p of W) k.stroke("#8a6a4a", st === "bloom" ? 1.3 : 1.2, bD(p));
	if (st !== "bloom") {
		for (const p of W) leavesOn(k, null, p, st === "sprout" ? [0.5, 0.8] : [0.35, 0.5, 0.65, 0.8], st === "sprout" ? 6 : 7, 2.4, { fill: "#6fb35a", alt: "#8cc46a", shape: 1 }, 50);
		return out(k);
	}
	const a: Pt[] = [];
	const b: Pt[] = [];
	W.forEach((p, wi) => {
		for (let i = 0; i < 10; i++) {
			const t = 0.3 + i * 0.078;
			if (t > 1.01) break;
			const [x, y] = bez(p, t);
			const n = angAt(p, t) + (i % 2 ? 90 : -90);
			const pt: Pt = [x + Math.cos(n * RAD) * 1.6, y + Math.sin(n * RAD) * 1.6];
			((i + wi) % 3 ? a : b).push(pt);
		}
	});
	a.forEach(([x, y], i) => k.petals("#f2c12e", x, y, 4, 1.2, 1.4, 0.75, 20 + i * 37));
	b.forEach(([x, y], i) => k.petals("#f8dc6a", x, y, 4, 1.2, 1.4, 0.75, 20 + i * 37));
	for (const p of W.slice(6)) leavesOn(k, null, p, [0.5], 5, 1.8, { fill: "#8cc46a", shape: 1 }, 50, false);
	return out(k);
}

/* ---------------------------------------------------------------- vines */

function bougainvillea(st: GrowingStage): string {
	const k = new Ink();
	const lv = new Ink();
	const wood = "#7a5a40";
	const L: LeafSet = { fill: "#5a9a4e", alt: "#72af60", shape: 4 };
	if (st === "sprout") {
		const p: Br = [[40, 87], [39, 80], [42, 75], [40, 69]];
		k.stroke(wood, 1.5, bD(p));
		leavesOn(lv, null, p, [0.45, 0.7], 7, 3.4, L, 60);
		return out(k, lv);
	}
	const main: Br = st === "leafy" ? [[40, 87], [36, 72], [44, 58], [40, 46]] : [[40, 87], [35, 66], [45, 46], [40, 28]];
	const B: Br[] =
		st === "leafy"
			? [
					[[40, 50], [32, 44], [24, 48], [21, 56]],
					[[40, 50], [48, 44], [56, 48], [59, 56]],
				]
			: [
					[[40, 30], [30, 18], [16, 20], [10, 34]],
					[[40, 30], [52, 16], [64, 20], [70, 34]],
					[[42, 46], [32, 40], [22, 46], [18, 58]],
					[[40, 46], [52, 40], [60, 46], [62, 58]],
					[[40, 30], [40, 22], [42, 16], [44, 10]],
				];
	k.stroke(wood, st === "leafy" ? 2 : 2.6, bD(main));
	for (const p of B) k.stroke(wood, 1.4, bD(p));
	leavesOn(lv, null, main, [0.4, 0.6, 0.8], 7, 3.4, L, 60, st === "leafy");
	for (const p of B) leavesOn(lv, null, p, [0.25, 0.5, 0.75], 6.5, 3.2, L, 60, st === "leafy");
	if (st === "leafy") {
		const br = new Ink();
		for (const [x, y] of [[21, 56], [59, 56], [40, 46]] as const) br.petals("#e86aa8", x, y, 3, 1.6, 2, 1.4, -90);
		return out(k, lv, br);
	}
	const br = new Ink();
	let n = 0;
	for (const p of B) {
		for (const t of [0.45, 0.72, 1]) {
			const [x, y] = bez(p, t);
			br.petals(n++ % 3 === 1 ? "#ec6db0" : "#d6378c", x, y, 3, 2.1, 2.7, 2, n * 40);
			br.dot("#f6eec8", x, y, 0.6);
		}
	}
	return out(k, lv, br);
}

function wisteria(st: GrowingStage): string {
	const k = new Ink();
	const lv = new Ink();
	const rib = new Ink();
	const wood = "#7d6a5a";
	const lf = "#86b86c";
	const la = "#6ea65a";
	if (st === "sprout") {
		k.stroke(wood, 1.4, bD([[40, 87], [42, 80], [38, 76], [40, 70]]));
		pinnate(lv, rib, 40, 76, -150, 10, 2, 4, 1.6, lf, la, GREEN.dark);
		pinnate(lv, rib, 40, 70, -50, 11, 2, 4.2, 1.7, lf, la, GREEN.dark);
		return out(k, lv, rib);
	}
	if (st === "leafy") {
		k.stroke(wood, 2.2, bD([[40, 87], [34, 72], [46, 58], [40, 46]]));
		k.stroke(wood, 1.5, bD([[40, 47], [34, 42], [26, 42], [20, 46]]) + bD([[40, 47], [46, 42], [54, 42], [60, 46]]));
		for (const [x, y, a] of [[24, 44, -120], [30, 42, -70], [50, 42, -110], [56, 44, -60], [40, 46, -90], [37, 66, -160], [44, 58, -20]] as const) pinnate(lv, rib, x, y, a, 11, 2, 4.4, 1.7, lf, la, GREEN.dark);
		return out(k, lv, rib);
	}
	k.stroke(wood, 2.4, bD([[40, 87], [33, 70], [47, 52], [40, 30]])).stroke(wood, 2, bD([[40, 87], [47, 70], [33, 52], [40, 30]]));
	k.stroke(wood, 1.7, bD([[40, 30], [32, 22], [20, 20], [9, 26]]) + bD([[40, 30], [48, 22], [60, 20], [71, 26]]) + bD([[40, 30], [40, 24], [38, 18], [34, 12]]));
	for (const [x, y, a] of [[14, 22, -110], [26, 19, -80], [54, 19, -100], [66, 22, -70], [35, 14, -110], [40, 26, -50]] as const) pinnate(lv, rib, x, y, a, 11, 2, 4.4, 1.7, lf, la, GREEN.dark);
	const cols = ["#8b73d4", "#a690e3", "#c7b8f3"];
	const dots = new Ink();
	let body = "";
	for (const [x, y, len] of [[11, 26, 20], [20, 22, 26], [30, 24, 22], [48, 23, 24], [58, 21, 27], [68, 25, 21], [39, 30, 16]] as const) {
		body += `M${f(x - 2.4)} ${f(y)}Q${f(x - 2.2)} ${f(y + len * 0.6)} ${f(x + 0.6)} ${f(y + len - 1)}Q${f(x + 2.6)} ${f(y + len * 0.55)} ${f(x + 2.4)} ${f(y)}Z`;
		const N = Math.round(len / 1.8);
		for (let j = 0; j < N; j++) {
			const t = j / (N - 1);
			const yy = y + j * 1.8;
			const hw = 3.1 * (1 - t * 0.8);
			const xs = j % 2 ? [x - hw * 0.5, x + hw * 0.5] : hw > 1.6 ? [x - hw, x + hw] : [x];
			const c = t < 0.4 ? 0 : t < 0.75 ? 1 : 2;
			for (const xx of xs) dots.dot(cols[c]!, xx + t * 0.6, yy, [1.5, 1.25, 0.95][c]!);
		}
	}
	const fl = new Ink().fill("#7a62c4", body);
	return out(k, fl, dots, lv, rib);
}

function grape(st: GrowingStage): string {
	const k = new Ink();
	const lv = new Ink();
	const top = new Ink();
	const wood = "#7a5a40";
	const leafAt = (x: number, y: number, a: number, R: number, i: number) => {
		lv.fill(i % 2 ? "#78b05a" : "#5f9a48", lobedD(x, y, a, R, 5, 0.36, 145, true, 0.35));
		top.stroke("#3a6a2c", 0.6, veinsD(x, y, a, R, 5, 145 * 0.55), 0.55);
	};
	if (st === "sprout") {
		k.stroke(GREEN.dark, 1.5, bD([[40, 87], [40, 80], [42, 75], [41, 70]]));
		leafAt(40, 79, -160, 5, 0);
		leafAt(41, 70, -70, 6, 1);
		top.stroke(GREEN.light, 0.6, tendrilD(41, 72, -10, 7));
		return out(k, lv, top);
	}
	const leafy = st === "leafy";
	const ty = leafy ? 56 : 42;
	k.stroke(wood, leafy ? 2.6 : 3.4, bD([[40, 87], [37, 74], [43, 60], [40, ty]]));
	const arms: Br[] = leafy
		? [
				[[40, ty], [34, ty - 3], [28, ty - 2], [22, ty - 4]],
				[[40, ty], [46, ty - 3], [52, ty - 2], [58, ty - 4]],
			]
		: [
				[[40, ty], [32, ty - 4], [22, ty - 2], [11, ty - 4]],
				[[40, ty], [48, ty - 4], [58, ty - 2], [69, ty - 4]],
			];
	for (const p of arms) k.stroke(wood, 2.2, bD(p));
	const spots: [number, number, number, number][] = leafy
		? [
				[23, ty - 4, -120, 7],
				[32, ty - 3, -80, 7.5],
				[48, ty - 3, -100, 7.5],
				[57, ty - 4, -60, 7],
				[40, ty, -90, 6.5],
			]
		: [
				[12, ty - 4, -135, 8],
				[22, ty - 3, -95, 8.5],
				[33, ty - 4, -75, 9],
				[47, ty - 4, -105, 9],
				[58, ty - 3, -85, 8.5],
				[68, ty - 4, -45, 8],
				[40, ty - 2, -90, 8],
			];
	spots.forEach(([x, y, a, R], i) => {
		k.stroke(GREEN.dark, 1.1, lineD(x, y, x + Math.cos(a * RAD) * 2, y + Math.sin(a * RAD) * 2));
		leafAt(x, y, a, R, i);
	});
	top.stroke(GREEN.light, 0.6, tendrilD(leafy ? 22 : 11, ty - 4, 160, 8, -1) + tendrilD(leafy ? 58 : 69, ty - 4, 20, 8));
	if (leafy) return out(k, lv, top);
	const g = new Ink();
	const hi = new Ink();
	const rows: [number, number][] = [[4, 0], [3, 2.9], [3, 5.6], [2, 8.3], [1, 10.8]];
	for (const [x, y, s] of [[24, ty + 1, 1], [55, ty + 1, 1], [40, ty + 4, 0.75]] as const) {
		g.stroke(wood, 0.9, lineD(x, y - 2, x, y + 1));
		for (const [n, dy] of rows) {
			for (let i = 0; i < n; i++) {
				const gx = x + (i - (n - 1) / 2) * 2.7 * s;
				const gy = y + 2 + dy * s;
				g.dot("#7b4a9e", gx, gy, 1.75 * s);
				hi.dot("#b394d0", gx - 0.5 * s, gy - 0.5 * s, 0.5 * s);
			}
		}
	}
	return out(k, lv, top, g, hi);
}

function ivy(st: GrowingStage): string {
	const k = new Ink();
	const lv = new Ink();
	const top = new Ink();
	const leafAt = (x: number, y: number, a: number, R: number, i: number) => {
		lv.fill(i % 3 === 2 ? "#4a8a50" : i % 2 ? "#3e8049" : "#2e6a3c", lobedD(x, y, a, R, 5, 0.3, 105, false, 0.45));
		top.stroke("#bcd9a0", 0.45, veinsD(x, y, a, R, 5, 105 * 0.8), 0.6);
	};
	if (st === "sprout") {
		k.stroke("#5a7a3a", 1.4, bD([[40, 87], [38, 81], [42, 76], [40, 71]]));
		leafAt(39, 80, -160, 5, 0);
		leafAt(41, 75, -20, 5, 1);
		leafAt(40, 71, -90, 5.5, 2);
		return out(k, lv, top);
	}
	const H = st === "leafy" ? 46 : 12;
	k.fill("#8b6f50", `M37.5 87V${H + 2}Q40 ${H - 1} 42.5 ${H + 2}V87Z`).fill("#a3866a", `M38.4 87V${H + 3}h1.2V87Z`);
	const vine = twine([[40, 87], [40, H + 6]], 4, 18);
	k.stroke("#5a7a3a", 1.2, polyD(vine));
	const vine2 = st === "bloom" ? twine([[40, 87], [40, 30]], 4.5, 22, Math.PI) : [];
	if (vine2.length) k.stroke("#5a7a3a", 1.1, polyD(vine2));
	const R = st === "leafy" ? 6.2 : 7;
	let li = 0;
	for (const pts of [vine, vine2]) {
		for (let i = 3; i < pts.length; i += 3) {
			const [x, y] = pts[i]!;
			const side = x < 40 ? 180 : 0;
			leafAt(x, y, side + (x < 40 ? 25 : -25) + (li % 2 ? 15 : -10), R * (0.85 + 0.15 * ((li * 7) % 3)), li);
			li++;
		}
	}
	if (st === "bloom") {
		const run: Br = [[40, 86], [50, 86], [60, 85], [72, 80]];
		k.stroke("#5a7a3a", 1.1, bD(run));
		for (const t of [0.45, 0.75, 1]) {
			const [x, y] = bez(run, t);
			leafAt(x, y, -80 - t * 20, 4.6, li++);
		}
		const [x, y] = vine[vine.length - 1]!;
		leafAt(x, y, -90, 5.2, li++);
	}
	return out(k, lv, top);
}

/** A heart-shaped leaf (notched base at (x, y), tip along `a`). */
function heartD(x: number, y: number, a: number, len: number, w: number): string {
	const P = rot(x, y, a);
	return `M${P(len * 0.14, 0)}C${P(-len * 0.12, -w * 1.15)} ${P(len * 0.55, -w * 1.25)} ${P(len, 0)}C${P(len * 0.55, w * 1.25)} ${P(-len * 0.12, w * 1.15)} ${P(len * 0.14, 0)}Z`;
}

/** A trumpet flower seen from the side, mouth along `a`. */
function trumpetD(x: number, y: number, a: number, len: number, w: number): string {
	const P = rot(x, y, a);
	return `M${P(0, -0.6)}L${P(len * 0.62, -w * 0.25)}Q${P(len * 0.9, -w)} ${P(len, -w)}L${P(len, w)}Q${P(len * 0.9, w)} ${P(len * 0.62, w * 0.25)}L${P(0, 0.6)}Z`;
}

function morningGlory(st: GrowingStage): string {
	const k = new Ink();
	const lv = new Ink();
	const fl = new Ink();
	const L = { a: "#5fa54e", b: "#7dba62" };
	if (st === "sprout") {
		k.stroke(GREEN.dark, 1.4, bD([[40, 87], [40, 80], [41, 76], [40, 71]]));
		lv.fill(L.a, heartD(40, 77, -160, 7.5, 3.4)).fill(L.b, heartD(40, 77, -20, 7.5, 3.4));
		lv.stroke(GREEN.dark, 1, tendrilD(40, 72, -95, 6));
		return out(k, lv);
	}
	const leafy = st === "leafy";
	const H = leafy ? 38 : 12;
	k.stroke("#c8ad78", 1.6, lineD(40, 87, 40, H));
	const vines = [twine([[40, 87], [40, H + 3]], 3.4, 14), ...(leafy ? [] : [twine([[40, 87], [40, 34]], 3.4, 14, Math.PI)])];
	let j = 0;
	for (const v of vines) {
		k.stroke(GREEN.dark, 1.1, polyD(v));
		for (let i = 4; i < v.length - 2; i += 4, j++) {
			const [x, y] = v[i]!;
			const right = j % 2 === 0;
			const ex = x + (right ? 2.5 : -2.5);
			const ey = y + 1;
			k.stroke(GREEN.dark, 0.8, lineD(x, y, ex, ey));
			lv.fill(j % 3 ? L.a : L.b, heartD(ex, ey, (right ? 35 : 145) + ((j * 17) % 20) - 10, leafy ? 8.5 : 9.5, 3.6));
		}
	}
	if (leafy) {
		fl.fill("#7fa6ea", ellD(47, 46, 1.3, 3, -60));
		return out(k, lv, fl);
	}
	const flowers: [number, number, number][] = [[27, 25, 6.6], [54, 18, 6.6], [55, 46, 6], [25, 53, 6], [41, 33, 5.2]];
	for (const [x, y, r] of flowers) fl.dot("#4d84de", x, y, r);
	let rays = "";
	for (const [x, y, r] of flowers) for (let i = 0; i < 5; i++) rays += lineD(x, y, x + Math.cos((i * 72 - 90) * RAD) * r * 0.95, y + Math.sin((i * 72 - 90) * RAD) * r * 0.95);
	fl.stroke("#86adf0", 0.8, rays);
	for (const [x, y, r] of flowers) fl.dot("#f5f7fd", x, y, r * 0.42).dot("#f0d264", x, y, r * 0.16);
	fl.fill("#5f92e2", trumpetD(44, 64, -20, 9, 3.4) + trumpetD(36, 76, -160, 8, 3)).fill("#9fbcf0", ellD(48, 30, 1.2, 3, -50));
	return out(k, lv, fl);
}

function clematis(st: GrowingStage): string {
	const k = new Ink();
	const lv = new Ink();
	const fl = new Ink();
	const top = new Ink();
	const leaflets = (x: number, y: number, a: number, s: number) => lv.fill("#5f9e58", leafD(x, y, a - 40, 4.6 * s, 1.8 * s, 1) + leafD(x, y, a + 40, 4.6 * s, 1.8 * s, 1)).fill("#7ab66a", leafD(x, y, a, 5.6 * s, 2 * s, 1));
	if (st === "sprout") {
		k.stroke("#4f8a3f", 1.3, bD([[40, 87], [39, 80], [42, 76], [41, 70]]));
		leaflets(39, 80, -160, 1.1);
		leaflets(41, 71, -60, 1.2);
		return out(k, lv);
	}
	const leafy = st === "leafy";
	const ty = leafy ? 38 : 10;
	const tops: Pt[] = [[leafy ? 24 : 15, ty + 3], [40, ty], [leafy ? 56 : 65, ty + 3]];
	let tr = "";
	for (const [x, y] of tops) tr += lineD(40, 86, x, y);
	for (const y of leafy ? [70, 52] : [68, 48, 28]) {
		const u = (86 - y) / (86 - ty);
		tr += lineD(40 + (tops[0]![0] - 40) * u * 1.02, y, 40 + (tops[2]![0] - 40) * u * 1.02, y);
	}
	k.stroke("#b0926a", 1.2, tr);
	const paths: Pt[][] = leafy
		? [twine([[40, 87], [33, 70], [36, 54], [44, 44]], 2.2, 12)]
		: [twine([[40, 87], [31, 68], [34, 48], [24, 30]], 2.4, 12), twine([[40, 87], [48, 68], [52, 46], [54, 22]], 2.4, 12, 2), twine([[40, 70], [44, 54], [40, 38], [42, 18]], 2, 10, 1)];
	paths.forEach((pts, pi) => {
		k.stroke("#4f8a3f", 1.2, polyD(pts));
		for (let i = 3, j = 0; i < pts.length - 1; i += 4, j++) {
			const [x, y] = pts[i]!;
			leaflets(x, y, dirAt(pts, i) + ((j + pi) % 2 ? 70 : -70), leafy ? 0.9 : 1);
		}
	});
	if (leafy) {
		fl.fill("#9a82dc", ellD(44, 42, 1.6, 3, -70));
		return out(k, lv, fl);
	}
	for (const [x, y] of [[24, 30], [54, 22], [57, 50], [27, 56], [42, 40]] as const) {
		fl.fill("#7656cc", starD(x, y, 6, 7, 2.7, -90));
		let bars = "";
		for (let i = 0; i < 6; i++) {
			const a = (i * 60 - 90) * RAD;
			bars += lineD(x + Math.cos(a) * 1.5, y + Math.sin(a) * 1.5, x + Math.cos(a) * 5.4, y + Math.sin(a) * 5.4);
		}
		top.stroke("#a68cec", 1, bars);
		top.dot("#f1e4a6", x, y, 1.8);
	}
	return out(k, lv, fl, top);
}

function passionFlower(fl: Ink, x: number, y: number, s: number): void {
	fl.petals("#d8d0ec", x, y, 5, 7 * s, 5.4 * s, 2.4 * s, -54);
	fl.petals("#ece8f6", x, y, 5, 7 * s, 5.4 * s, 2.2 * s, -90);
	let rays = "";
	for (let i = 0; i < 30; i++) {
		const a = i * 12 * RAD;
		rays += lineD(x + Math.cos(a) * 3.2 * s, y + Math.sin(a) * 3.2 * s, x + Math.cos(a) * 10 * s, y + Math.sin(a) * 10 * s);
	}
	fl.stroke("#5e3d9e", 0.75 * s, rays);
	fl.stroke("#f2eefb", 1.2 * s, circD(x, y, 6.6 * s));
	fl.stroke("#3e2470", 2 * s, circD(x, y, 4.4 * s));
	fl.dot("#a6c96a", x, y, 2.4 * s);
	fl.petals("#e2d35e", x, y, 5, 2.8 * s, 1.5 * s, 0.7 * s, -90);
	fl.petals("#6a2f72", x, y - 0.4 * s, 3, 1.3 * s, 0.9 * s, 0.6 * s, -90);
}

function passionflower(st: GrowingStage): string {
	const k = new Ink();
	const lv = new Ink();
	const top = new Ink();
	const vine = "#4f8a3f";
	const leafAt = (x: number, y: number, a: number, R: number, i: number) => {
		lv.fill(i % 2 ? "#62a256" : "#4c8c46", lobedD(x, y, a, R, 3, 0.62, 55, true, 0));
		top.stroke("#2f5a30", 0.6, veinsD(x, y, a, R, 3, 50), 0.55);
	};
	if (st === "sprout") {
		k.stroke(vine, 1.4, bD([[40, 87], [40, 81], [38, 76], [40, 71]]));
		leafAt(40, 80, -20, 5, 0);
		leafAt(39, 74, -155, 5, 1);
		top.stroke(GREEN.light, 0.6, tendrilD(40, 71, -80, 7));
		return out(k, lv, top);
	}
	if (st === "leafy") {
		k.stroke(vine, 1.5, bD([[40, 87], [30, 74], [32, 58], [40, 48]]) + bD([[36, 70], [48, 66], [54, 56], [50, 46]]));
		for (const [x, y, a, i] of [[33, 77, -160, 0], [31, 62, 175, 1], [40, 48, -80, 0], [47, 66, -10, 1], [52, 52, -40, 0]] as const) leafAt(x, y, a, 6.2, i);
		top.stroke(GREEN.light, 0.6, tendrilD(40, 49, -30, 8) + tendrilD(52, 48, -150, 7, -1));
		top.fill("#9cc46a", ellD(26, 54, 1.6, 2.6, -70));
		return out(k, lv, top);
	}
	k.stroke(vine, 1.6, bD([[40, 87], [27, 74], [29, 56], [38, 46]]) + bD([[38, 46], [47, 40], [45, 34], [38, 30]]) + bD([[40, 87], [55, 77], [61, 62], [59, 54]]) + bD([[29, 60], [19, 55], [15, 45], [20, 38]]));
	for (const [x, y, a, i] of [[29, 74, -160, 0], [29, 60, 170, 1], [52, 77, -20, 0], [61, 66, 10, 1], [16, 48, -140, 0], [46, 40, -10, 1], [36, 48, -150, 0]] as const) leafAt(x, y, a, 6.6, i);
	top.stroke(GREEN.light, 0.6, tendrilD(20, 38, -60, 8) + tendrilD(59, 66, 40, 7, -1));
	const fl = new Ink();
	fl.stroke(vine, 0.9, lineD(23, 60, 23, 66)).fill("#e6a43a", ellD(23, 70.5, 4.8, 3.8, 90)).dot("#f6cf7a", 21.6, 68.6, 1);
	fl.fill("#9cc46a", ellD(19, 35, 1.8, 3, -60));
	passionFlower(fl, 38, 27, 1.15);
	passionFlower(fl, 59, 47, 0.7);
	return out(k, lv, top, fl);
}

/** Points along a hoop: left leg, semicircular top, right leg. */
function hoop(topY: number, half: number): Pt[] {
	const cy = topY + half;
	const pts: Pt[] = [[40 - half, 87], [40 - half, cy]];
	for (let i = 1; i < 12; i++) {
		const a = Math.PI + (i * Math.PI) / 12;
		pts.push([40 + half * Math.cos(a), cy + half * Math.sin(a)]);
	}
	pts.push([40 + half, cy], [40 + half, 87]);
	return pts;
}

function jasmine(st: GrowingStage): string {
	const k = new Ink();
	const lv = new Ink();
	const fl = new Ink();
	const lf = { a: "#3e7d46", b: "#56954f" };
	if (st === "sprout") {
		const p: Br = [[40, 87], [41, 80], [38, 76], [40, 70]];
		k.stroke("#4f7a3a", 1.2, bD(p));
		leavesOn(lv, null, p, [0.35, 0.6, 0.8], 6, 2.2, { fill: lf.a, alt: lf.b, shape: 1 }, 60);
		return out(k, lv);
	}
	const leafy = st === "leafy";
	const H = hoop(leafy ? 44 : 18, leafy ? 13 : 16);
	k.stroke("#b39466", 1.3, polyD(H));
	const half = leafy ? 13 : 16;
	const left = twine([[40, 87], [40 - half, 83], ...H.slice(1, leafy ? 6 : 14)], 1.8, 8);
	const right = twine([[40, 87], [40 + half, 83], ...H.slice(leafy ? 9 : 7).reverse().slice(1)], 1.8, 8, 2);
	const strands = leafy ? [left, twine([[40, 87], [40 + half, 83], [40 + half, 58]], 1.8, 8, 2)] : [left, right];
	strands.forEach((pts) => {
		k.stroke("#4f7a3a", 1, polyD(pts));
		for (let i = 3, j = 0; i < pts.length; i += 2, j++) {
			const [x, y] = pts[i]!;
			lv.fill(j % 2 ? lf.a : lf.b, leafD(x, y, dirAt(pts, i) + (j % 2 ? 55 : -55), 6, 2.1, 1));
		}
	});
	if (leafy) {
		fl.fill("#e89ab2", ellD(30, 52, 0.9, 1.8, -60) + ellD(53, 62, 0.9, 1.8, -120));
		return out(k, lv, fl);
	}
	const spots: Pt[] = [];
	for (const pts of strands) for (let i = 10; i < pts.length; i += 11) spots.push(pts[i]!);
	spots.forEach(([x, y], i) => {
		const cl: Pt[] = [[0, -3.2], [-3.4, 1.2], [3.2, 1.8]];
		cl.forEach(([dx, dy], j) => {
			if ((i + j) % 4 === 3) {
				fl.fill("#e89ab2", ellD(x + dx, y + dy, 0.9, 1.9, -60 + j * 50));
				return;
			}
			fl.petals("#efc6d2", x + dx, y + dy, 5, 1.3, 1.4, 0.75, -54);
			fl.petals("#fbf7ec", x + dx, y + dy, 5, 1.4, 1.5, 0.8, -90);
			fl.dot("#e2bd58", x + dx, y + dy, 0.5);
		});
	});
	return out(k, lv, fl);
}

function honeysuckle(st: GrowingStage): string {
	const k = new Ink();
	const lv = new Ink();
	const fl = new Ink();
	const wood = "#8a5a4a";
	const L: LeafSet = { fill: "#5a9a58", alt: "#73ad66", shape: 0 };
	const whorlAt = (x: number, y: number, s: number) => {
		let ty = "";
		let tp = "";
		let ly = "";
		let lp = "";
		for (let i = 0; i < 7; i++) {
			const a = (-165 + i * 25) * RAD;
			const len = (7 + ((i * 5) % 4) * 0.8) * s;
			const ex = x + Math.cos(a) * len;
			const ey = y + Math.sin(a) * len;
			const mx = x + Math.cos(a + 0.25) * len * 0.55;
			const my = y + Math.sin(a + 0.25) * len * 0.55;
			const d = `M${f(x)} ${f(y)}Q${f(mx)} ${f(my)} ${f(ex)} ${f(ey)}`;
			const lip = ellD(ex + Math.cos(a) * 0.6, ey + Math.sin(a) * 0.6, 1.6 * s, 0.8 * s, (a / RAD) + 90);
			if (i % 2) {
				tp += d;
				lp += lip;
			} else {
				ty += d;
				ly += lip;
			}
		}
		fl.stroke("#e7809c", 1.5 * s, tp).stroke("#f2cf5e", 1.5 * s, ty).fill("#f0a2b8", lp).fill("#f8e08a", ly).dot("#7aa860", x, y, 1.3 * s);
	};
	if (st === "sprout") {
		const p: Br = [[40, 87], [42, 80], [38, 75], [40, 70]];
		k.stroke(wood, 1.3, bD(p));
		pairsOn(lv, null, p, [0.5, 1], 6, 2.6, L, 62);
		return out(k, lv);
	}
	if (st === "leafy") {
		const S: Br[] = [
			[[40, 87], [32, 74], [48, 62], [38, 48]],
			[[40, 87], [48, 74], [32, 62], [43, 50]],
		];
		for (const p of S) k.stroke(wood, 1.4, bD(p));
		for (const p of S) pairsOn(lv, null, p, [0.3, 0.55, 0.8, 1], 6.5, 2.7, L, 62);
		fl.fill("#f2cf5e", ellD(38, 45, 0.9, 2.4, 80) + ellD(42, 45, 0.9, 2.4, 100));
		return out(k, lv, fl);
	}
	const S: Br[] = [
		[[40, 87], [30, 70], [50, 54], [39, 36]],
		[[40, 87], [50, 70], [30, 54], [41, 36]],
		[[40, 37], [30, 28], [20, 30], [15, 40]],
		[[40, 37], [50, 27], [60, 30], [65, 40]],
		[[40, 37], [38, 30], [40, 22], [41, 18]],
		[[38, 60], [28, 60], [22, 66], [20, 72]],
	];
	for (const p of S) k.stroke(wood, 1.4, bD(p));
	for (const p of S) pairsOn(lv, null, p, [0.35, 0.65, 0.95], 6.5, 2.7, L, 62);
	whorlAt(15, 39, 1);
	whorlAt(65, 39, 1);
	whorlAt(41, 18, 1.1);
	whorlAt(20, 71, 0.8);
	return out(k, lv, fl);
}

function sweetpeaFlower(fl: Ink, x: number, y: number, c: readonly [string, string], s = 1): void {
	fl.fill(c[0], ellD(x, y - 1.2 * s, 3.4 * s, 2.7 * s, 0));
	fl.fill(c[1], ellD(x - 1 * s, y + 1.6 * s, 2.2 * s, 1.5 * s, -20) + ellD(x + 1.2 * s, y + 1.7 * s, 1.6 * s, 1.2 * s, 20));
}

function sweetPea(st: GrowingStage): string {
	const k = new Ink();
	const lv = new Ink();
	const fl = new Ink();
	const tn = new Ink();
	const leafPair = (x: number, y: number, a: number, s: number) => lv.fill("#86b383", leafD(x, y, a - 30, 6 * s, 2.3 * s)).fill("#a0c69c", leafD(x, y, a + 30, 6 * s, 2.3 * s));
	if (st === "sprout") {
		k.stroke("#6a9a62", 1.3, bD([[40, 87], [40, 80], [41, 76], [40, 71]]));
		leafPair(40, 79, -150, 1);
		leafPair(40, 74, -30, 1);
		tn.stroke("#7aa874", 0.6, tendrilD(40, 71, -90, 7));
		return out(k, lv, tn);
	}
	const leafy = st === "leafy";
	const ty = leafy ? 40 : 10;
	const feet: Pt[] = [[26, 87], [40, 87], [54, 87]];
	let canes = "";
	for (const [x, y] of feet) canes += lineD(x, y, 40 + (x - 40) * 0.08, ty);
	k.stroke("#c4a574", 1.3, canes).stroke("#8a6a4a", 1.6, `M38.6 ${ty + 4}h2.8`);
	const climb = (x0: number, ph: number, stop: number) => {
		const pts = twine([[40, 87], [x0, 82], [40 + (x0 - 40) * 0.2, stop]], 2, 9, ph);
		k.stroke("#6a9a62", 1.1, polyD(pts));
		for (let i = 2, j = 0; i < pts.length - 2; i += 4, j++) {
			const [x, y] = pts[i]!;
			const sideA = x < 40 ? 180 : 0;
			leafPair(x, y, sideA + (x < 40 ? 30 : -30), leafy ? 0.85 : 1);
			if (j % 2) tn.stroke("#7aa874", 0.55, tendrilD(x, y, sideA - (x < 40 ? -40 : 40), 6, x < 40 ? 1 : -1));
		}
		return pts;
	};
	const l = climb(27, 0, leafy ? 52 : 22);
	const r = climb(53, 2, leafy ? 56 : 18);
	if (leafy) return out(k, lv, tn);
	const cols: (readonly [string, string])[] = [
		["#f08bb7", "#d9649a"],
		["#b48be6", "#9168cf"],
		["#f59a8a", "#e0705f"],
		["#f3e8f6", "#d6c2e2"],
	];
	let n = 0;
	for (const pts of [l, r]) {
		for (let i = 10; i < pts.length; i += 5) {
			const [x, y] = pts[i]!;
			const side = x < 40 ? -1 : 1;
			const fx = x + side * 6;
			const fy = y - 2;
			tn.stroke("#6a9a62", 0.8, lineD(x, y, fx, fy + 2));
			sweetpeaFlower(fl, fx, fy, cols[n++ % 4]!, 1);
		}
	}
	return out(k, lv, tn, fl);
}

function cranberry(st: GrowingStage): string {
	const k = new Ink();
	const lv = new Ink();
	const run = "#8a3f3a";
	const tiny = (pts: readonly Pt[], ang: (i: number) => number) =>
		pts.forEach(([x, y], i) => lv.fill(i % 2 ? "#3e7a42" : "#5a9452", leafD(x, y, ang(i), 3.6, 1.4, 0)));
	const upright = (x0: number, x1: number, y1: number) => {
		const p: Br = [[x0, 86], [x0 + (x1 - x0) * 0.1, 76], [x1 - (x1 - x0) * 0.2, y1 + 8], [x1, y1]];
		k.stroke(run, 1, bD(p));
		const pts: Pt[] = [];
		for (let t = 0.25; t <= 1.001; t += 0.105) pts.push(bez(p, t));
		tiny(pts, (i) => (i % 2 ? -150 : -30));
		return p;
	};
	if (st === "sprout") {
		k.stroke(run, 1, "M40 86.5Q34 86 30 85");
		upright(40, 41, 71);
		tiny([[33, 85.5], [36, 86]], () => -140);
		return out(k, lv);
	}
	const leafy = st === "leafy";
	const left: Br = leafy ? [[40, 86], [32, 86], [24, 85], [17, 84]] : [[40, 86], [28, 86], [16, 85], [6, 83]];
	const right: Br = leafy ? [[40, 86], [48, 86], [56, 85], [63, 84]] : [[40, 86], [52, 86], [64, 85], [74, 83]];
	k.stroke(run, 1.1, bD(left) + bD(right));
	for (const p of [left, right]) {
		const pts: Pt[] = [];
		for (let t = 0.15; t <= 1.001; t += 0.1) pts.push(bez(p, t));
		tiny(pts, (i) => (i % 2 ? -150 : -30));
	}
	const ups: [number, number, number][] = leafy
		? [
				[24, 19, 66],
				[34, 31, 58],
				[44, 46, 56],
				[54, 60, 65],
			]
		: [
				[14, 8, 66],
				[22, 17, 56],
				[31, 27, 49],
				[38, 37, 52],
				[44, 47, 47],
				[52, 58, 54],
				[62, 70, 64],
			];
	const mat = golden(leafy ? 12 : 18, 40, 82.5, leafy ? 20 : 30, 3.5);
	tiny(mat, (i) => -90 + ((i * 53) % 120) - 60);
	const U = ups.map(([a, b, c]) => upright(a, b, c));
	if (leafy) return out(k, lv);
	const b = new Ink();
	const hi = new Ink();
	U.forEach((p, i) => {
		for (const t of i % 2 ? [0.55] : [0.5, 0.8]) {
			const [x, y] = bez(p, t);
			const side = (i + Math.round(t * 10)) % 2 ? 1 : -1;
			const bx = x + side * 3;
			const by = y + 2.5;
			k.stroke(run, 0.6, lineD(x, y, bx, by - 2));
			b.dot(i % 3 === 2 && t > 0.6 ? "#e05a6c" : "#c8233c", bx, by, 3);
			hi.dot("#ff9fac", bx - 0.9, by - 0.9, 0.7);
		}
	});
	return out(k, lv, b, hi);
}

const ALL: [string, (st: GrowingStage) => string][] = [
	["Blueberry", blueberry],
	["Raspberry", raspberry],
	["Blackberry", blackberry],
	["Gooseberry", gooseberry],
	["Elderberry", elderberry],
	["Holly", holly],
	["Boxwood", boxwood],
	["Hydrangea", hydrangea],
	["Azalea", azalea],
	["Rhododendron", rhododendron],
	["Camellia", camellia],
	["Gardenia", gardenia],
	["Lilac", lilac],
	["Forsythia", forsythia],
	["Bougainvillea", bougainvillea],
	["Wisteria", wisteria],
	["Grapevine", grape],
	["Ivy", ivy],
	["Morning glory", morningGlory],
	["Clematis", clematis],
	["Passionflower", passionflower],
	["Jasmine", jasmine],
	["Honeysuckle", honeysuckle],
	["Sweet pea", sweetPea],
	["Cranberry", cranberry],
];

export const SPECIES: Species[] = ALL.map(([name, draw]) => ({
	id: name.toLowerCase().replace(/\s+/g, "-"),
	name,
	draw,
}));
