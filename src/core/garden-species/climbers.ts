/**
 * Climbers and vines (owner design, 2026-11-11): 25 species in the shared
 * kit style, each on its own support (wall, post, trellis, strings…) so the
 * silhouettes differ as much as the leaves and flowers. Small repeated marks
 * are merged into one path per paint to keep each drawing's markup small.
 */
import { bez, f, GREEN, type GrowingStage, type Pt, type Species } from "./kit";

type Br = readonly [Pt, Pt, Pt, Pt];
type Shape = 0 | 1 | 2 | 4;
const RAD = Math.PI / 180;
const TAU = Math.PI * 2;

/* ---------------------------------------------------------------- helpers */

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
	/** n stadium-shaped petals (round-capped strokes) whose centres sit r from (x, y). */
	petals(color: string, x: number, y: number, n: number, r: number, rx: number, ry: number, off = 0): this {
		return this.stroke(color, Math.round(ry * 20) / 10, capsD(x, y, n, r, rx, ry, off));
	}
	toString(): string {
		let s = "";
		for (const [key, raw] of this.parts) {
			if (!raw) continue;
			const d = tight(raw);
			const [kind, color, width, op] = key.split("|");
			s +=
				kind === "f"
					? `<path d="${d}" fill="${color}"/>`
					: `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round"${op === "1" ? "" : ` opacity="${op}"`}/>`;
		}
		return s;
	}
}

const out = (...inks: Ink[]) => inks.join("");

/** Drops redundant separators and leading zeros from path data. */
function tight(d: string): string {
	return d.replace(/ -/g, "-").replace(/([ MLCQAHVZmlcqahvz-])0\./g, "$1.");
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

/** A kit-shaped leaf (or pointed petal) as absolute path data; ovals and pointed leaves are cheap quadratic lenses. */
function leafD(x: number, y: number, a: number, len: number, w: number, shape: Shape = 0): string {
	const R = rot(0, 0, a);
	if (shape === 0 || shape === 1) {
		const u = shape ? 0.42 : 0.5;
		const v = shape ? 2.1 : 2.05;
		return `M${f(x)} ${f(y)}q${R(len * u, -w * v)} ${R(len, 0)}q${R(len * (u - 1), w * v)} ${R(-len, 0)}`;
	}
	const [a1, b1, a2, b2] = CTRL[shape];
	return `M${f(x)} ${f(y)}c${R(len * a1, -w * b1)} ${R(len * a2, -w * b2)} ${R(len, 0)}c${R(len * (a2 - 1), w * b2)} ${R(len * (a1 - 1), w * b1)} ${R(-len, 0)}`;
}

function ribD(x: number, y: number, a: number, len: number): string {
	const P = rot(x, y, a);
	return `M${P(1, 0)}L${P(len * 0.78, 0)}`;
}

function circD(x: number, y: number, r: number): string {
	return `M${f(x - r)} ${f(y)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0`;
}

function ellD(x: number, y: number, rx: number, ry: number, deg: number): string {
	const c = Math.cos(deg * RAD) * rx;
	const s = Math.sin(deg * RAD) * rx;
	const a = `a${f(rx)} ${f(ry)} ${f(deg)} 1 0`;
	return `M${f(x - c)} ${f(y - s)}${a} ${f(2 * c)} ${f(2 * s)}${a} ${f(-2 * c)} ${f(-2 * s)}`;
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
function starD(x: number, y: number, n: number, len: number, w: number, off = 0, shape: Shape = 1): string {
	let d = "";
	for (let i = 0; i < n; i++) d += leafD(x, y, off + (i * 360) / n, len, w, shape);
	return d;
}

function capsD(x: number, y: number, n: number, r: number, rx: number, ry: number, off = 0): string {
	const h = Math.max(0, rx - ry);
	let d = "";
	for (let i = 0; i < n; i++) {
		const a = (off + (i * 360) / n) * RAD;
		const c = Math.cos(a);
		const s = Math.sin(a);
		d += h < 0.05 ? `M${f(x + c * r)} ${f(y + s * r)}h0` : `M${f(x + c * (r - h))} ${f(y + s * (r - h))}l${f(c * 2 * h)} ${f(s * 2 * h)}`;
	}
	return d;
}

/** A straight segment from (x, y) heading `a`, `len` long (stroke it round-capped for a cheap leaf). */
function segD(x: number, y: number, a: number, len: number): string {
	return `M${f(x)} ${f(y)}l${f(Math.cos(a * RAD) * len)} ${f(Math.sin(a * RAD) * len)}`;
}

function bD(p: Br): string {
	return `M${f(p[0][0])} ${f(p[0][1])}C${f(p[1][0])} ${f(p[1][1])} ${f(p[2][0])} ${f(p[2][1])} ${f(p[3][0])} ${f(p[3][1])}`;
}

function lineD(x1: number, y1: number, x2: number, y2: number): string {
	return `M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}`;
}

/** A smooth path through points (quadratic through midpoints). */
function polyD(pts: readonly Pt[]): string {
	const coarse = COARSE.get(pts);
	if (coarse) return coarse;
	const first = pts[0];
	const last = pts[pts.length - 1];
	if (!first || !last) return "";
	// Relative commands, rounded against the rounded pen position so errors do not accumulate.
	const r = (n: number) => Math.round(n * 10) / 10;
	let cx = r(first[0]);
	let cy = r(first[1]);
	let d = `M${f(cx)} ${f(cy)}`;
	for (let i = 1; i < pts.length - 1; i++) {
		const p = pts[i]!;
		const q = pts[i + 1]!;
		const ex = r((p[0] + q[0]) / 2);
		const ey = r((p[1] + q[1]) / 2);
		d += `q${f(r(p[0]) - cx)} ${f(r(p[1]) - cy)} ${f(ex - cx)} ${f(ey - cy)}`;
		cx = ex;
		cy = ey;
	}
	return `${d}l${f(r(last[0]) - cx)} ${f(r(last[1]) - cy)}`;
}

function rectD(x0: number, y0: number, x1: number, y1: number): string {
	return `M${f(x0)} ${f(y0)}H${f(x1)}V${f(y1)}H${f(x0)}Z`;
}

function angAt(p: Br, t: number): number {
	const a = bez(p, Math.max(0, t - 0.02));
	const b = bez(p, Math.min(1, t + 0.02));
	return Math.atan2(b[1] - a[1], b[0] - a[0]) / RAD;
}

/** For twined vines: a cheaper drawing of the same wave (see `twine`). */
const COARSE = new WeakMap<readonly Pt[], string>();

/**
 * Points twining along a polyline: offset sideways by amp·sin. The points
 * place leaves; drawing them (polyD) uses only the wave's peaks, pushed out
 * to 2·amp, as quadratic controls: that curve meets the sine at every peak
 * and zero crossing, in a fraction of the markup.
 */
function twine(path: readonly Pt[], amp: number, period: number, phase = 0, step = 2.2): Pt[] {
	const res: Pt[] = [];
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
			res.push([a[0] + dx * u - (dy / L) * o, a[1] + dy * u + (dx / L) * o]);
		}
		dist += L;
	}
	const ctrl: Pt[] = [res[0]!];
	let k = Math.ceil(((phase - Math.PI / 2) / Math.PI) + 1e-9);
	for (let i = 0, d0 = 0; i < path.length - 1; i++) {
		const a = path[i]!;
		const b = path[i + 1]!;
		const dx = b[0] - a[0];
		const dy = b[1] - a[1];
		const L = Math.hypot(dx, dy);
		if (L === 0) continue;
		for (;;) {
			const sd = (period / TAU) * (Math.PI / 2 - phase + k * Math.PI);
			if (sd > d0 + L) break;
			const u = (sd - d0) / L;
			const o = 2 * amp * (k % 2 === 0 ? 1 : -1);
			ctrl.push([a[0] + dx * u - (dy / L) * o, a[1] + dy * u + (dx / L) * o]);
			k++;
		}
		d0 += L;
	}
	ctrl.push(res[res.length - 1]!);
	COARSE.set(res, polyD(ctrl));
	return res;
}

function dirAt(pts: readonly Pt[], i: number): number {
	const a = pts[Math.max(0, i - 1)]!;
	const b = pts[Math.min(pts.length - 1, i + 1)]!;
	return Math.atan2(b[1] - a[1], b[0] - a[0]) / RAD;
}

/** Calls fn at every `step`-th point of a vine from `start` (skipping the ground), with the vine's heading. */
function every(v: readonly Pt[], start: number, step: number, fn: (x: number, y: number, a: number, j: number) => void): void {
	for (let i = start, j = 0; i < v.length; i += step) {
		const [x, y] = v[i]!;
		if (y > 79) continue;
		fn(x, y, dirAt(v, i), j++);
	}
}

/** Points of a golden-angle spiral filling an ellipse. */
function golden(n: number, cx: number, cy: number, rx: number, ry: number): Pt[] {
	const res: Pt[] = [];
	for (let i = 0; i < n; i++) {
		const r = Math.sqrt((i + 0.5) / n);
		const a = i * 137.508 * RAD;
		res.push([cx + rx * r * Math.cos(a), cy + ry * r * Math.sin(a)]);
	}
	return res;
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

/** A coiled tendril starting at (x, y) heading `a`: a short reach, then two shrinking turns. */
function tendrilD(x: number, y: number, a: number, len: number, dir: 1 | -1 = 1): string {
	const c = Math.cos(a * RAD);
	const sn = Math.sin(a * RAD);
	const r = len * 0.2;
	const px = x + c * len * 0.6;
	const py = y + sn * len * 0.6;
	const nx = -sn * dir;
	const ny = c * dir;
	const sw = dir > 0 ? 1 : 0;
	return `M${f(x)} ${f(y)}L${f(px)} ${f(py)}a${f(r)} ${f(r)} 0 1 ${sw} ${f(nx * 2 * r)} ${f(ny * 2 * r)}a${f(r * 0.6)} ${f(r * 0.6)} 0 1 ${sw} ${f(-nx * r)} ${f(-ny * r)}`;
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

/** Pinnate leaf: rachis from (x, y) heading `a`, `pairs` leaflet pairs and a terminal leaflet. */
function pinnate(k: Ink, rib: Ink, x: number, y: number, a: number, len: number, pairs: number, ll: number, lw: number, fill: string, alt: string, ribColor: string, shape: Shape = 1, spread = 55): void {
	const c = Math.cos(a * RAD);
	const s = Math.sin(a * RAD);
	rib.stroke(ribColor, 0.7, lineD(x, y, x + c * len, y + s * len));
	for (let i = 0; i < pairs; i++) {
		const u = (len * (i + 1)) / (pairs + 1);
		const px = x + c * u;
		const py = y + s * u;
		k.fill(fill, leafD(px, py, a - spread, ll, lw, shape));
		k.fill(alt, leafD(px, py, a + spread, ll, lw, shape));
	}
	k.fill(fill, leafD(x + c * len, y + s * len, a, ll * 1.05, lw, shape));
}

/** Three leaflets from (x, y) around heading `a`. */
function trifolD(x: number, y: number, a: number, len: number, w: number, shape: Shape = 1): [string, string] {
	return [leafD(x, y, a, len, w, shape), leafD(x, y, a - 62, len * 0.8, w * 0.9, shape) + leafD(x, y, a + 62, len * 0.8, w * 0.9, shape)];
}

/** A short petiole from (x, y) heading `a`; returns its end. */
function stalk(k: Ink, color: string, x: number, y: number, a: number, len: number, w = 0.8): Pt {
	const ex = x + Math.cos(a * RAD) * len;
	const ey = y + Math.sin(a * RAD) * len;
	k.stroke(color, w, lineD(x, y, ex, ey));
	return [ex, ey];
}

/** The segment of a line clipped to a rectangle (Liang–Barsky), or "". */
function clipD(x1: number, y1: number, x2: number, y2: number, r: readonly [number, number, number, number]): string {
	const dx = x2 - x1;
	const dy = y2 - y1;
	let t0 = 0;
	let t1 = 1;
	const P = [-dx, dx, -dy, dy];
	const Q = [x1 - r[0], r[2] - x1, y1 - r[1], r[3] - y1];
	for (let i = 0; i < 4; i++) {
		const p = P[i]!;
		const q = Q[i]!;
		if (p === 0) {
			if (q < 0) return "";
		} else {
			const t = q / p;
			if (p < 0) t0 = Math.max(t0, t);
			else t1 = Math.min(t1, t);
		}
	}
	if (t0 >= t1) return "";
	return lineD(x1 + dx * t0, y1 + dy * t0, x1 + dx * t1, y1 + dy * t1);
}

/** Diagonal (±slope) lattice lines inside a rectangle. */
function diamondsD(x0: number, y0: number, x1: number, y1: number, step: number, slope = 1): string {
	const r = [x0, y0, x1, y1] as const;
	const h = y1 - y0;
	let d = "";
	for (let x = x0 - h / slope; x <= x1 + h / slope; x += step) {
		d += clipD(x, y1, x + h / slope, y0, r) + clipD(x, y0, x + h / slope, y1, r);
	}
	return d;
}

/** A square grid inside a rectangle. */
function gridD(x0: number, y0: number, x1: number, y1: number, sx: number, sy: number): string {
	let d = "";
	for (let x = x0; x <= x1 + 0.01; x += sx) d += `M${f(x)} ${f(y0)}V${f(y1)}`;
	for (let y = y1; y >= y0 - 0.01; y -= sy) d += `M${f(x0)} ${f(y)}H${f(x1)}`;
	return d;
}

/** A simple seedling: a short stem with leaves given as [y, angle] pairs. */
function seedling(k: Ink, color: string, top: number, bend = 1.5): void {
	k.stroke(color, 1.4, bD([[40, 87], [40 - bend, 80], [40 + bend, 76], [40, top]]));
}

/* ---------------------------------------------------------------- 1. climbing hydrangea */

function stoneWall(k: Ink, x0: number, y0: number, x1: number): void {
	k.fill("#9a958b", rectD(x0, y0, x1, 87.5));
	let d = "";
	let row = 0;
	for (let y = y0 + 7; y < 87; y += 7, row++) d += `M${f(x0)} ${f(y)}H${f(x1)}`;
	row = 0;
	for (let y = y0; y < 87; y += 7, row++) {
		for (let x = x0 + (row % 2 ? 5 : 10); x < x1 - 2; x += 10) d += `M${f(x)} ${f(y)}V${f(Math.min(87, y + 7))}`;
	}
	k.stroke("#7c776e", 0.6, d);
}

function lacecap(fl: Ink, x: number, y: number, s: number): void {
	for (const [px, py] of golden(12, x, y, 3.4 * s, 2 * s)) fl.dot("#e4dbb2", px, py, 0.85 * s);
	for (let i = 0; i < 7; i++) {
		const a = (i * 360) / 7 + 10;
		const px = x + Math.cos(a * RAD) * 5.2 * s;
		const py = y + Math.sin(a * RAD) * 3.4 * s;
		fl.dot("#fbf9ef", px, py, 1.55 * s);
	}
}

function climbingHydrangea(st: GrowingStage): string {
	const k = new Ink();
	const lv = new Ink();
	const fl = new Ink();
	const wood = "#7a5a3c";
	const L = ["#3e7d45", "#57944f"];
	const pair = (x: number, y: number, a: number, len: number, i: number) => lv.fill(L[i % 2]!, leafD(x, y, a - 62, len, len * 0.55, 4) + leafD(x, y, a + 62, len, len * 0.55, 4));
	if (st === "sprout") {
		seedling(k, wood, 70);
		pair(40, 80, -90, 6.5, 0);
		pair(40, 73, -90, 5.5, 1);
		lv.fill(L[0]!, leafD(40, 70, -90, 4, 2.2, 4));
		return out(k, lv);
	}
	const leafy = st === "leafy";
	if (leafy) stoneWall(k, 22, 46, 58);
	else stoneWall(k, 10, 12, 70);
	const B: Br[] = leafy
		? [
				[[40, 87], [38, 74], [42, 62], [40, 50]],
				[[40, 80], [34, 72], [28, 66], [26, 56]],
				[[40, 76], [46, 70], [52, 64], [54, 54]],
			]
		: [
				[[40, 87], [37, 66], [43, 40], [40, 16]],
				[[39, 76], [28, 70], [18, 62], [15, 48]],
				[[41, 70], [52, 64], [62, 56], [65, 40]],
				[[40, 52], [30, 44], [20, 34], [16, 18]],
				[[41, 44], [52, 36], [60, 28], [64, 15]],
			];
	for (const p of B) k.stroke(wood, leafy ? 1.4 : 1.7, bD(p));
	let i = 0;
	for (const p of B) {
		for (let t = 0.2; t <= 1.001; t += leafy ? 0.27 : 0.26) {
			const [x, y] = bez(p, t);
			pair(x, y, angAt(p, t), leafy ? 5.4 : 6.4, i++);
		}
	}
	if (leafy) {
		fl.fill("#c9cf9a", ellD(40, 49, 3, 1.8, 0));
		return out(k, lv, fl);
	}
	for (const [x, y] of [[17, 46], [63, 38], [40, 16], [24, 27], [57, 25], [28, 60], [53, 58]] as const) lacecap(fl, x, y, 0.95);
	return out(k, lv, fl);
}

/* ---------------------------------------------------------------- 2. trumpet vine */

function trumpetCluster(fl: Ink, x: number, y: number, base: number): void {
	for (let i = 0; i < 3; i++) {
		const a = base - 36 + i * 36;
		fl.fill(i % 2 ? "#e0582a" : "#ea6c30", trumpetD(x, y, a, 9, 2.6));
		fl.stroke("#b83c1c", 1.6, segD(x + Math.cos(a * RAD) * 8.9 - Math.sin(a * RAD) * 1.6, y + Math.sin(a * RAD) * 8.9 + Math.cos(a * RAD) * 1.6, a - 90, 3.2));
	}
	fl.fill("#9a5a2a", circD(x, y, 1));
}

function trumpetVine(st: GrowingStage): string {
	const k = new Ink();
	const lv = new Ink();
	const rib = new Ink();
	const fl = new Ink();
	const post = "#a88a64";
	const lf = "#5c9a48";
	const la = "#78b05c";
	const leaf = (x: number, y: number, a: number, s: number) => pinnate(lv, rib, x, y, a, 8 * s, 2, 3.4 * s, 1.3 * s, lf, la, GREEN.dark);
	if (st === "sprout") {
		seedling(k, GREEN.dark, 70);
		leaf(40, 79, -155, 0.9);
		leaf(40, 72, -30, 1);
		return out(k, lv, rib);
	}
	const leafy = st === "leafy";
	const T = leafy ? 44 : 22;
	k.fill(post, rectD(38.4, T, 41.6, 87.5)).fill("#8e7050", rectD(38, T - 1.4, 42, T));
	const v = twine([[40, 87], [40, T + 2]], 2.8, 13);
	k.stroke("#7a5a3c", 1.5, polyD(v));
	every(v, 4, leafy ? 4 : 5, (x, y, _a, j) => leaf(x, y, j % 2 ? -150 : -30, leafy ? 0.95 : 1));
	if (leafy) {
		for (let i = 0; i < 3; i++) fl.fill("#a9b85a", ellD(36 + i * 4, T - 2 - (i % 2) * 2, 1, 2.6, -90 + (i - 1) * 25));
		fl.fill("#e0582a", ellD(44, T - 3, 1, 2.6, -65));
		return out(k, lv, rib, fl);
	}
	const arms: Br[] = [
		[[40, T], [32, 12], [20, 12], [12, 22]],
		[[40, T], [48, 12], [60, 12], [68, 22]],
		[[40, 50], [32, 44], [22, 44], [15, 52]],
		[[40, 50], [48, 44], [58, 44], [65, 52]],
	];
	for (const p of arms) k.stroke("#7a5a3c", 1.6, bD(p));
	arms.forEach((p, i) => {
		for (const t of [0.35, 0.7]) {
			const [x, y] = bez(p, t);
			leaf(x, y, angAt(p, t) + (t < 0.5 ? -60 : 60) * (i % 2 ? -1 : 1), 0.9);
		}
	});
	trumpetCluster(fl, 12, 22, 110);
	trumpetCluster(fl, 68, 22, 70);
	trumpetCluster(fl, 15, 52, 110);
	trumpetCluster(fl, 65, 52, 70);
	trumpetCluster(fl, 40, T - 1, -90);
	return out(k, lv, rib, fl);
}

/* ---------------------------------------------------------------- 3. Virginia creeper */

function palmate5(k: Ink, colors: readonly string[], x: number, y: number, a: number, len: number, i: number): void {
	const c = colors[i % colors.length]!;
	k.fill(c, leafD(x, y, a, len, len * 0.3, 1) + leafD(x, y, a - 34, len * 0.88, len * 0.28, 1) + leafD(x, y, a + 34, len * 0.88, len * 0.28, 1) + leafD(x, y, a - 68, len * 0.68, len * 0.25, 1) + leafD(x, y, a + 68, len * 0.68, len * 0.25, 1));
}

function virginiaCreeper(st: GrowingStage): string {
	const k = new Ink();
	const lv = new Ink();
	const fr = new Ink();
	const greens = ["#4f8f45", "#67a453", "#3f7a3a"];
	const autumn = ["#c0303a", "#d8502e", "#9e2338", "#e07a2e", "#b8283e"];
	if (st === "sprout") {
		seedling(k, "#8a4a3a", 72);
		palmate5(lv, greens, 40, 78, -150, 5.5, 0);
		palmate5(lv, greens, 40, 72, -50, 6, 1);
		return out(k, lv);
	}
	const leafy = st === "leafy";
	const T = leafy ? 50 : 18;
	const rails = leafy ? [58, 74] : [28, 50, 72];
	const wood = "#9a7a56";
	k.fill("#856546", rectD(14, T, 18, 87.5) + rectD(62, T, 66, 87.5));
	for (const y of rails) k.fill(wood, rectD(12, y, 68, y + 2.6));
	const stemC = leafy ? "#5a7a3a" : "#8a3a34";
	const paths: Pt[][] = leafy
		? [
				twine([[40, 87], [34, 72], [24, 64], [18, 54]], 1.6, 10),
				twine([[40, 87], [48, 74], [58, 66], [62, 54]], 1.6, 10, 2),
				twine([[40, 87], [40, 66], [42, 52]], 1.4, 9, 1),
			]
		: [
				twine([[40, 87], [30, 74], [18, 66], [16, 48], [22, 34], [14, 22]], 1.8, 11),
				twine([[40, 87], [50, 76], [62, 68], [64, 50], [56, 36], [66, 20]], 1.8, 11, 2),
				twine([[40, 87], [38, 66], [44, 48], [36, 32], [40, 14]], 1.6, 10, 1),
			];
	const cols = leafy ? greens : autumn;
	let i = 0;
	for (const v of paths) {
		k.stroke(stemC, 1.1, polyD(v));
		every(v, 3, leafy ? 4 : 6, (x, y, a, j) => {
			const la = a + (j % 2 ? 70 : -70);
			const [ex, ey] = stalk(k, stemC, x, y, la, 2.2, 0.7);
			palmate5(lv, cols, ex, ey, la, leafy ? 5.4 : 6.8, i++);
		});
	}
	if (leafy) return out(k, lv);
	for (const [x, y] of [[24, 42], [56, 40], [44, 26], [30, 62]] as const) {
		let s = "";
		for (const [dx, dy] of [[-2.6, 2], [0, 3.6], [2.6, 2], [-1.3, 6], [1.3, 6]] as const) s += lineD(x, y, x + dx, y + dy);
		fr.stroke("#b03040", 0.6, s);
		for (const [dx, dy] of [[-2.6, 2], [0, 3.6], [2.6, 2], [-1.3, 6], [1.3, 6]] as const) fr.dot("#2e3566", x + dx, y + dy, 1.35);
		fr.dot("#8c95c8", x - 0.4, y + 3.2, 0.4);
	}
	return out(k, lv, fr);
}

/* ---------------------------------------------------------------- 4. Boston ivy */

function bostonIvy(st: GrowingStage): string {
	const k = new Ink();
	const lv = new Ink();
	const vn = new Ink();
	const cols = ["#3d8040", "#57984a", "#2f6a38", "#4a8c44"];
	const ivyLeaf = (x: number, y: number, a: number, R: number, i: number, c?: string) => {
		lv.fill(c ?? cols[i % cols.length]!, lobedD(x, y, a, R, 3, 0.34, 62, false, 0.25));
		if (st !== "bloom") vn.stroke("#22502c", 0.45, veinsD(x, y, a, R, 3, 50), 0.6);
	};
	if (st === "sprout") {
		seedling(k, "#6a5a3a", 72, 1);
		ivyLeaf(40, 79, -150, 5, 0);
		ivyLeaf(40, 74, -30, 5.5, 1);
		ivyLeaf(40, 72, -95, 4.5, 2);
		return out(k, lv, vn);
	}
	const leafy = st === "leafy";
	const [x0, y0, x1] = leafy ? [22, 44, 58] : [8, 8, 72];
	k.fill("#a65a44", rectD(x0, y0, x1, 87.5));
	let d = "";
	let row = 0;
	for (let y = y0 + 5; y < 87; y += 5, row++) d += `M${f(x0)} ${f(y)}H${f(x1)}`;
	row = 0;
	for (let y = y0; y < 87; y += 5, row++) {
		for (let x = x0 + (row % 2 ? 5 : 10); x < x1 - 1; x += 10) d += `M${f(x)} ${f(y)}v${f(Math.min(5, 87 - y))}`;
	}
	k.stroke("#c99682", 0.5, d);
	const win: readonly [number, number, number, number] = [44, 22, 62, 42];
	if (!leafy) {
		k.fill("#e6dfcf", rectD(win[0], win[1], win[2], win[3])).fill("#3a4b5e", rectD(win[0] + 1.6, win[1] + 1.6, win[2] - 1.6, win[3] - 1.6));
		k.stroke("#e6dfcf", 1, `M${f((win[0] + win[2]) / 2)} ${win[1]}V${win[3]}M${win[0]} ${f((win[1] + win[3]) / 2)}H${win[2]}`);
		k.fill("#5a6f86", rectD(win[0] + 2.4, win[1] + 2.4, 51.6, 30.6));
	}
	k.stroke("#6a5a3a", 1.2, bD([[40, 87], [36, 80], [32, 76], [28, 72]]) + bD([[40, 87], [44, 80], [50, 76], [54, 72]]));
	const pts = leafy ? golden(26, 40, 66, 15, 18) : golden(60, 37, 50, 30, 38);
	pts.forEach(([x, y], i) => {
		if (y > 85 || x < x0 + 2 || x > x1 - 2 || y < y0 + 3) return;
		if (!leafy && x > win[0] + 3 && x < win[2] - 3 && y > win[1] + 3 && y < win[3] - 2) return;
		const a = -90 + ((i * 47) % 70) - 35;
		const autumn = !leafy && y < 28 && i % 3 === 0;
		ivyLeaf(x, y + 3, a, leafy ? 5 : 5.4, i, autumn ? (i % 2 ? "#c8452e" : "#e07a30") : undefined);
	});
	return out(k, lv, vn);
}

/* ---------------------------------------------------------------- 5. Black-eyed Susan vine */

function susanFlower(fl: Ink, x: number, y: number, r: number): void {
	fl.petals("#e07812", x, y, 5, r * 0.55, r * 0.52, r * 0.52, -54);
	fl.petals("#f5961e", x, y, 5, r * 0.5, r * 0.44, r * 0.44, -54);
	fl.dot("#6a2a0e", x, y, r * 0.42).dot("#1e120c", x, y, r * 0.3);
}

function blackEyedSusanVine(st: GrowingStage): string {
	const k = new Ink();
	const lv = new Ink();
	const fl = new Ink();
	const cane = "#c4aa6a";
	const L = ["#5c9d48", "#77b05e"];
	if (st === "sprout") {
		k.fill(cane, rectD(43, 66, 44.4, 87.5));
		seedling(k, GREEN.dark, 70);
		lv.fill(L[0]!, heartD(40, 79, -155, 6, 2.8)).fill(L[1]!, heartD(40, 73, -25, 6.5, 3));
		lv.stroke(GREEN.dark, 0.7, tendrilD(40, 70, -60, 5));
		return out(k, lv);
	}
	const leafy = st === "leafy";
	const T = leafy ? 42 : 8;
	k.fill(cane, rectD(39, T, 41, 87.5));
	let nodes = "";
	for (let y = 82; y > T + 4; y -= 11) nodes += `M39 ${y}h2`;
	k.stroke("#9a8248", 0.9, nodes);
	const paths: Pt[][] = leafy
		? [twine([[40, 87], [40, T + 2]], 3, 12)]
		: [twine([[40, 87], [40, T + 2]], 3.2, 13), twine([[40, 66], [30, 58], [20, 52], [14, 40]], 2, 10, 1), twine([[40, 46], [50, 40], [60, 36], [66, 24]], 2, 10, 2), twine([[40, 30], [32, 24], [24, 20]], 1.6, 9)];
	paths.forEach((v, pi) => {
		k.stroke(GREEN.dark, 1.1, polyD(v));
		every(v, 3, 3, (x, y, a, j) => {
			const la = a + ((j + pi) % 2 ? 75 : -75);
			lv.fill(L[j % 2]!, heartD(x, y, la, leafy ? 6 : 6.5, 2.8));
		});
	});
	if (leafy) {
		fl.fill("#9cbf5a", ellD(42, 52, 1.2, 2.4, -60));
		susanFlower(fl, 35, 60, 4.4);
		return out(k, lv, fl);
	}
	for (const [x, y] of [[40, 10], [24, 22], [16, 42], [64, 26], [56, 46], [28, 54], [48, 66], [33, 37], [50, 23]] as const) susanFlower(fl, x, y, 4.6);
	return out(k, lv, fl);
}

/* ---------------------------------------------------------------- 6. Mandevilla */

function pinwheel(fl: Ink, x: number, y: number, r: number, col: string, deep: string, throat: string, off = 0): void {
	let d = "";
	for (let i = 0; i < 5; i++) {
		const a = off + i * 72;
		const P = rot(x, y, a);
		d += `M${f(x)} ${f(y)}C${P(r * 0.3, -r * 0.55)} ${P(r * 0.95, -r * 0.7)} ${P(r, -r * 0.1)}C${P(r * 1.02, r * 0.3)} ${P(r * 0.6, r * 0.35)} ${P(0, 0)}Z`;
	}
	fl.fill(col, d);
	fl.fill(deep, starD(x, y, 5, r * 0.45, r * 0.2, off + 20));
	fl.dot(throat, x, y, r * 0.17);
}

function mandevilla(st: GrowingStage): string {
	const k = new Ink();
	const lv = new Ink();
	const rib = new Ink();
	const fl = new Ink();
	const L = { fill: "#2e6a3a", alt: "#3e8048" };
	const leaf = (x: number, y: number, a: number, len: number, i: number) => {
		lv.fill(i % 2 ? L.alt : L.fill, leafD(x, y, a, len, len * 0.4, 1));
		if (st !== "bloom") rib.stroke("#7ab06a", 0.5, ribD(x, y, a, len), 0.8);
	};
	if (st === "sprout") {
		seedling(k, GREEN.dark, 70);
		leaf(40, 78, -160, 7, 0);
		leaf(40, 78, -20, 7, 1);
		leaf(40, 71, -100, 5.5, 0);
		return out(k, lv, rib);
	}
	const leafy = st === "leafy";
	const R = leafy ? 40 : 74;
	const W = leafy ? 22 : 44;
	const end = (i: number, u: number): Pt => {
		const t = ((i - 2) * 25) * RAD;
		return [40 + Math.sin(t) * W * u, 86 - Math.cos(t) * R * u];
	};
	let tr = "";
	for (let i = 0; i < 5; i++) {
		const [x, y] = end(i, 1);
		tr += lineD(40, 86, x, y);
	}
	for (const u of leafy ? [0.5, 0.92] : [0.35, 0.64, 0.92]) {
		const [x0, y0] = end(0, u);
		const [x1, y1] = end(4, u);
		tr += `M${f(x0)} ${f(y0)}Q40 ${f(86 - R * u * 1.18)} ${f(x1)} ${f(y1)}`;
	}
	k.stroke("#c2aa80", 1.2, tr);
	const paths: Pt[][] = leafy
		? [twine([[40, 87], [36, 70], [32, 54]], 2.2, 11), twine([[40, 87], [44, 72], [48, 58]], 2.2, 11, 2)]
		: [twine([[40, 87], [34, 66], [26, 46], [18, 26]], 2.4, 12), twine([[40, 87], [46, 66], [54, 46], [62, 26]], 2.4, 12, 2), twine([[40, 80], [40, 50], [40, 18]], 2, 11, 1)];
	let n = 0;
	paths.forEach((v) => {
		k.stroke(GREEN.dark, 1.1, polyD(v));
		every(v, 3, leafy ? 4 : 5, (x, y, a, j) => {
			leaf(x, y, a + 60, leafy ? 7 : 7.5, n++);
			if (j % 2) leaf(x, y, a - 60, leafy ? 7 : 7.5, n++);
		});
	});
	if (leafy) {
		fl.fill("#e86a94", leafD(48, 58, -70, 7, 1.8, 1));
		return out(k, lv, rib, fl);
	}
	for (const [x, y, r, o] of [[18, 26, 7.5, 0], [62, 24, 7.5, 30], [40, 16, 7, 12], [28, 50, 7, 45], [54, 48, 7, 20], [40, 66, 6, 50]] as const) pinwheel(fl, x, y, r, "#ec5a8c", "#c93a6e", "#f6d77a", o);
	return out(k, lv, rib, fl);
}

/* ---------------------------------------------------------------- 7. Chilean glory flower */

function gloryRaceme(fl: Ink, x: number, y: number, dir: 1 | -1): void {
	let tubes = "";
	const tips: Pt[] = [];
	for (let i = 0; i < 6; i++) {
		const sx = x + dir * i * 1.6;
		const sy = y + i * 1.2;
		const ex = sx + dir * 1.2;
		const ey = sy + 5.6;
		tubes += `M${f(sx)} ${f(sy)}Q${f(sx + dir * 2)} ${f(sy + 3)} ${f(ex)} ${f(ey)}`;
		tips.push([ex, ey]);
	}
	fl.stroke("#7a8a3a", 0.6, lineD(x, y, x + dir * 8, y + 6));
	fl.stroke("#e0482a", 2, tubes);
	for (const [tx, ty] of tips) fl.dot("#f5c63a", tx, ty + 0.4, 1.05);
}

function chileanGlory(st: GrowingStage): string {
	const k = new Ink();
	const lv = new Ink();
	const fl = new Ink();
	const fine = (x: number, y: number, a: number, s: number) => {
		const c = Math.cos(a * RAD);
		const sn = Math.sin(a * RAD);
		let d = "";
		for (let i = 1; i <= 3; i++) {
			const px = x + c * i * 2.6 * s;
			const py = y + sn * i * 2.6 * s;
			d += segD(px, py, a - 55, 2.6 * s) + segD(px, py, a + 55, 2.6 * s);
		}
		k.stroke(GREEN.dark, 0.6, lineD(x, y, x + c * 10 * s, y + sn * 10 * s));
		lv.stroke("#5a9a44", 1.5, d);
		if (st !== "bloom") lv.stroke("#8cc46a", 0.5, tendrilD(x + c * 10 * s, y + sn * 10 * s, a, 4 * s));
	};
	if (st === "sprout") {
		seedling(k, GREEN.dark, 70);
		fine(40, 78, -155, 0.8);
		fine(40, 72, -30, 0.85);
		return out(k, lv);
	}
	const leafy = st === "leafy";
	const T = leafy ? 42 : 10;
	const sx = leafy ? [32, 48] : [22, 40, 58];
	let s = `M${leafy ? 26 : 12} ${T}H${leafy ? 54 : 68}`;
	for (const x of sx) s += `M${x} ${T}L${x} 87`;
	k.stroke("#b8a27a", 0.6, s);
	k.fill("#8a6a4a", rectD(leafy ? 25 : 11, T - 1, leafy ? 27 : 13, 87.5) + rectD(leafy ? 53 : 67, T - 1, leafy ? 55 : 69, 87.5));
	const paths = sx.map((x, i) => twine([[40, 87], [x, 78], [x, T + 4 + (i % 2) * 6]], 1.6, 8, i));
	paths.forEach((v, pi) => {
		k.stroke(GREEN.dark, 1, polyD(v));
		every(v, 4, leafy ? 4 : 6, (x, y, a, j) => fine(x, y, a + ((j + pi) % 2 ? 65 : -65), leafy ? 0.85 : 1));
	});
	if (leafy) {
		fl.stroke("#c8603a", 1.6, lineD(46, 52, 47, 56) + lineD(48, 53, 49.5, 57));
		return out(k, lv, fl);
	}
	for (const [x, y, d] of [[22, 16, 1], [58, 18, -1], [40, 28, 1], [22, 44, -1], [58, 46, 1], [40, 58, -1]] as const) gloryRaceme(fl, x, y, d);
	return out(k, lv, fl);
}

/* ---------------------------------------------------------------- 8. Kiwi vine */

function kiwi(st: GrowingStage): string {
	const k = new Ink();
	const lv = new Ink();
	const top = new Ink();
	const fr = new Ink();
	const trunk = "#6e5038";
	const L = ["#5c9a44", "#79b25a", "#4c8a3c"];
	const kLeaf = (x: number, y: number, a: number, len: number, i: number) => {
		const [ex, ey] = stalk(k, "#a0503a", x, y, a, 2.6, 0.8);
		lv.fill(L[i % 3]!, heartD(ex, ey, a, len, len * 0.62));
		top.stroke("#2f5a2a", 0.5, ribD(ex, ey, a, len), 0.5);
	};
	if (st === "sprout") {
		seedling(k, "#8a5a3a", 72);
		kLeaf(40, 77, -150, 6.5, 0);
		kLeaf(40, 72, -35, 7, 1);
		return out(k, lv, top);
	}
	if (st === "leafy") {
		k.fill("#9a7a56", rectD(43, 42, 44.6, 87.5));
		k.stroke(trunk, 1.8, bD([[40, 87], [39, 74], [43, 62], [42, 46]]));
		k.stroke(trunk, 1.1, bD([[42, 60], [36, 56], [30, 54], [26, 50]]) + bD([[42, 52], [48, 50], [54, 48], [58, 44]]));
		for (const [x, y, a, l] of [[40, 76, -160, 7], [41, 66, -20, 7.5], [30, 54, -130, 7.5], [36, 56, -90, 7], [52, 48, -40, 7.5], [58, 44, -60, 7], [42, 46, -95, 7.5]] as const) kLeaf(x, y, a, l, x);
		return out(k, lv, top);
	}
	k.fill("#8a6a4a", rectD(11, 22, 14, 87.5) + rectD(66, 22, 69, 87.5));
	k.fill("#9a7a56", rectD(7, 20, 73, 24));
	k.stroke(trunk, 3, bD([[40, 87], [36, 66], [44, 44], [40, 24]]));
	k.stroke(trunk, 1.8, bD([[40, 24], [30, 20], [20, 22], [8, 20]]) + bD([[40, 24], [50, 20], [60, 22], [72, 20]]));
	let i = 0;
	for (let x = 12; x <= 68; x += 5.1) {
		kLeaf(x, 21, -90 + ((i * 37) % 70) - 35, 8, i++);
		if (i % 3) kLeaf(x + 2.6, 23, 90 + ((i * 29) % 80) - 40, 8.5, i++);
		else i++;
	}
	kLeaf(38, 54, -160, 7, i++);
	kLeaf(42, 40, -20, 7, i++);
	for (const [x, y] of [[22, 34], [52, 33], [33, 37], [62, 38], [16, 38]] as const) {
		for (const [dx, dy] of [[-2.4, 0], [2.4, 1.2], [0, 4]] as const) {
			fr.stroke(trunk, 0.6, lineD(x, 27, x + dx, y + dy - 3));
			fr.fill("#8a6a3e", ellD(x + dx, y + dy, 2.1, 2.9, 90));
			top.dot("#a8875a", x + dx - 0.6, y + dy - 0.8, 0.6);
		}
	}
	return out(k, lv, fr, top);
}

/* ---------------------------------------------------------------- 9. Hops */

function hopCone(fr: Ink, sc: Ink, x: number, y: number, s: number): void {
	fr.fill("#bcd772", ellD(x, y, 3.8 * s, 2.5 * s, 90));
	let d = "";
	for (let j = -1; j <= 1; j++) d += `M${f(x - 2 * s)} ${f(y + j * 1.8 * s - 0.6 * s)}L${f(x)} ${f(y + j * 1.8 * s + 0.6 * s)}L${f(x + 2 * s)} ${f(y + j * 1.8 * s - 0.6 * s)}`;
	sc.stroke("#88a848", 0.55, d);
}

function hops(st: GrowingStage): string {
	const k = new Ink();
	const lv = new Ink();
	const vn = new Ink();
	const fr = new Ink();
	const sc = new Ink();
	const L = ["#4f9a3e", "#6db04f"];
	const hLeaf = (x: number, y: number, a: number, R: number, i: number) => {
		lv.fill(L[i % 2]!, lobedD(x, y, a, R, 3, 0.42, 58, false, 0.2));
		vn.stroke("#2e6a2a", 0.45, veinsD(x, y, a, R, 3, 45), 0.6);
	};
	if (st === "sprout") {
		seedling(k, "#5a8a3a", 70);
		hLeaf(40, 77, -155, 6, 0);
		hLeaf(40, 77, -25, 6, 1);
		hLeaf(40, 70, -90, 4.5, 0);
		return out(k, lv, vn);
	}
	const leafy = st === "leafy";
	const T = leafy ? 36 : 9;
	k.stroke("#c9b48a", 0.7, lineD(40, 87, 46, T));
	k.fill("#9a7a56", rectD(39, 85, 41, 88));
	const v = twine([[40, 87], [46 - (leafy ? 2.5 : 0), T + 4]], 2.2, 9);
	k.stroke("#5a8a3a", 1.2, polyD(v));
	every(v, 5, 6, (x, y, a, j) => {
		hLeaf(x, y, a - 75, leafy ? 6.5 : 7.4, j);
		hLeaf(x, y, a + 75, leafy ? 6.5 : 7.4, j + 1);
	});
	if (leafy) return out(k, lv, vn);
	const arms: Br[] = [
		[[45, 10], [36, 8], [26, 12], [20, 24]],
		[[45, 14], [54, 12], [62, 16], [66, 28]],
		[[43, 48], [34, 46], [26, 50], [22, 60]],
		[[44, 40], [54, 40], [60, 46], [62, 56]],
	];
	arms.forEach((p, i) => {
		k.stroke("#5a8a3a", 1, bD(p));
		const [x, y] = bez(p, 0.45);
		hLeaf(x, y, angAt(p, 0.45) + (i % 2 ? 70 : -70), 6, i);
	});
	for (const [x, y, s] of [[20, 28, 1], [17, 34, 0.9], [23, 35, 0.85], [66, 32, 1], [62, 38, 0.9], [22, 64, 0.95], [27, 59, 0.8], [62, 60, 0.95], [57, 56, 0.8], [36, 22, 0.85], [50, 28, 0.85]] as const) {
		sc.stroke("#5a8a3a", 0.5, lineD(x, y - 4 * s, x, y - 3.4 * s));
		hopCone(fr, sc, x, y, s);
	}
	return out(k, lv, vn, fr, sc);
}

/* ---------------------------------------------------------------- 10. Star jasmine */

function starJasmine(st: GrowingStage): string {
	const k = new Ink();
	const lv = new Ink();
	const fl = new Ink();
	const L = ["#2f6038", "#3f7a45", "#4f8c4f"];
	const wood = "#a88a62";
	const star = (x: number, y: number, r: number, o: number) => {
		fl.petals("#fffdf0", x, y, 5, r * 0.55, r * 0.5, r * 0.27, o);
		fl.dot("#e8d98a", x, y, 0.5);
	};
	if (st === "sprout") {
		seedling(k, "#6a5a3a", 72);
		lv.fill(L[1]!, leafD(40, 80, -160, 5, 2, 1) + leafD(40, 80, -20, 5, 2, 1)).fill(L[0]!, leafD(40, 75, -150, 5, 2, 1) + leafD(40, 75, -30, 5, 2, 1) + leafD(40, 72, -95, 4, 1.7, 1));
		return out(k, lv);
	}
	const leafy = st === "leafy";
	const [x0, y0, x1] = leafy ? [24, 46, 56] : [12, 16, 68];
	k.stroke(wood, 1.2, diamondsD(x0, y0, x1, 86, leafy ? 8 : 9, 1.3) + rectD(x0, y0, x1, 86));
	k.stroke("#6a5a3a", 1.4, bD([[40, 87], [36, 80], [30, 76], [26, 70]]) + bD([[40, 87], [44, 80], [50, 76], [54, 70]]) + lineD(40, 87, 40, 76));
	const pts = leafy ? golden(60, 40, 68, 13, 16) : golden(132, 40, 50, 26, 32);
	pts.forEach(([x, y], i) => {
		if (y > 85) return;
		lv.stroke(L[i % 3]!, 2.4, segD(x, y, (i * 137.5) % 360, 2.6));
	});
	if (leafy) {
		star(36, 60, 2.6, 10);
		star(45, 70, 2.4, 40);
		return out(k, lv, fl);
	}
	golden(26, 40, 48, 24, 30).forEach(([x, y], i) => star(x, y, 2.9, i * 23));
	return out(k, lv, fl);
}

/* ---------------------------------------------------------------- 11. Cup-and-saucer vine */

function cupBell(fl: Ink, x: number, y: number, c: string, mouth: string): void {
	fl.fill(c, `M${f(x - 2)} ${f(y)}Q${f(x - 3.2)} ${f(y + 4.5)} ${f(x - 4)} ${f(y + 7.6)}Q${f(x)} ${f(y + 8.8)} ${f(x + 4)} ${f(y + 7.6)}Q${f(x + 3.2)} ${f(y + 4.5)} ${f(x + 2)} ${f(y)}Z`);
	fl.fill(mouth, ellD(x, y + 7.8, 3.6, 0.9, 0));
	fl.fill("#8fbf5a", ellD(x, y + 0.6, 4.6, 1.5, 0));
}

function cupAndSaucer(st: GrowingStage): string {
	const k = new Ink();
	const lv = new Ink();
	const rib = new Ink();
	const fl = new Ink();
	let tc = 0;
	const leaf = (x: number, y: number, a: number, s: number) => {
		pinnate(lv, rib, x, y, a, 7 * s, 2, 4.4 * s, 1.7 * s, "#5c9a4c", "#72ac5c", GREEN.dark, 1);
		if (++tc % 2) rib.stroke("#8cc46a", 0.5, tendrilD(x + Math.cos(a * RAD) * 7 * s, y + Math.sin(a * RAD) * 7 * s, a, 5 * s));
	};
	if (st === "sprout") {
		seedling(k, GREEN.dark, 70);
		leaf(40, 78, -150, 0.85);
		leaf(40, 72, -35, 0.9);
		return out(k, lv, rib);
	}
	const leafy = st === "leafy";
	const [x0, y0, x1] = leafy ? [26, 42, 54] : [14, 10, 66];
	k.stroke("#8a9096", 0.5, gridD(x0, y0, x1, 86, leafy ? 7 : 6.5, 7));
	k.fill("#6e747a", rectD(x0 - 1, y0 - 1, x0 + 1, 87.5) + rectD(x1 - 1, y0 - 1, x1 + 1, 87.5));
	const paths: Pt[][] = leafy
		? [twine([[40, 87], [36, 70], [42, 54], [38, 46]], 2.4, 10)]
		: [twine([[40, 87], [30, 70], [22, 50], [24, 24], [18, 14]], 2.4, 11), twine([[40, 87], [50, 68], [58, 46], [54, 22], [62, 14]], 2.4, 11, 2), twine([[40, 80], [42, 56], [38, 34], [42, 16]], 2, 10, 1)];
	paths.forEach((v, pi) => {
		k.stroke(GREEN.dark, 1.1, polyD(v));
		every(v, 3, leafy ? 5 : 8, (x, y, a, j) => leaf(x, y, a + ((j + pi) % 2 ? 70 : -70), leafy ? 0.85 : 1));
	});
	if (leafy) {
		cupBell(fl, 46, 52, "#c8dca0", "#aac47c");
		return out(k, lv, rib, fl);
	}
	for (const [x, y, c] of [[22, 20, 0], [56, 18, 0], [30, 42, 0], [52, 40, 1], [38, 60, 0], [62, 58, 2]] as const) {
		k.stroke(GREEN.dark, 0.8, lineD(x, y - 4, x, y));
		cupBell(fl, x, y, ["#7d3f9e", "#a070c0", "#c8dca0"][c]!, ["#5a2a76", "#7d4a9e", "#aac47c"][c]!);
	}
	return out(k, lv, rib, fl);
}

/* ---------------------------------------------------------------- 12. Moonflower */

function moon(fl: Ink, cr: Ink, x: number, y: number, r: number): void {
	fl.fill("#f6f4e6", circD(x, y, r));
	let d = "";
	for (let i = 0; i < 5; i++) {
		const a = (-90 + i * 72) * RAD;
		d += lineD(x + Math.cos(a) * r * 0.25, y + Math.sin(a) * r * 0.25, x + Math.cos(a) * r * 0.95, y + Math.sin(a) * r * 0.95);
	}
	cr.stroke("#c9d9a8", 0.7, d);
	cr.dot("#e8e2a8", x, y, r * 0.22);
}

function moonflower(st: GrowingStage): string {
	const k = new Ink();
	const lv = new Ink();
	const fl = new Ink();
	const cr = new Ink();
	const L = ["#4c8c42", "#62a052"];
	if (st === "sprout") {
		seedling(k, GREEN.dark, 70);
		lv.fill(L[0]!, heartD(40, 78, -155, 8, 3.8)).fill(L[1]!, heartD(40, 72, -30, 8.5, 4));
		return out(k, lv);
	}
	const leafy = st === "leafy";
	const T = leafy ? 42 : 8;
	let lad = `M31 87V${T}M49 87V${T}`;
	for (let y = 80; y > T + 2; y -= 9) lad += `M31 ${y}H49`;
	k.stroke("#a68660", 1.5, lad);
	const paths: Pt[][] = leafy
		? [twine([[40, 87], [40, T + 4]], 7, 18)]
		: [twine([[40, 87], [40, T + 4]], 8, 20), twine([[40, 70], [28, 60], [18, 46], [16, 30]], 2.2, 12, 1), twine([[40, 50], [52, 42], [62, 30], [62, 16]], 2.2, 12, 2)];
	paths.forEach((v, pi) => {
		k.stroke(GREEN.dark, 1.1, polyD(v));
		every(v, 3, 4, (x, y, a, j) => {
			const la = a + ((j + pi) % 2 ? 80 : -80);
			lv.fill(L[j % 2]!, heartD(x, y, la, leafy ? 9 : 10, 4.4));
		});
	});
	const bud = (x: number, y: number, a: number) => fl.fill("#ecebd6", leafD(x, y, a, 8, 1.6, 1)).fill("#c9d9a8", leafD(x, y, a, 3, 1.2, 0));
	if (leafy) {
		bud(40, T + 4, -75);
		return out(k, lv, fl, cr);
	}
	for (const [x, y, r] of [[40, 14, 8], [18, 30, 7.5], [62, 20, 7.5], [24, 56, 7.5], [56, 46, 7.5]] as const) moon(fl, cr, x, y, r);
	bud(44, 64, -50);
	bud(14, 44, -110);
	return out(k, lv, fl, cr);
}

/* ---------------------------------------------------------------- 13. Cypress vine */

function feather(k: Ink, x: number, y: number, a: number, len: number): void {
	const c = Math.cos(a * RAD);
	const s = Math.sin(a * RAD);
	let d = lineD(x, y, x + c * len, y + s * len);
	const n = Math.round(len / 1.8);
	for (let i = 1; i < n; i++) {
		const u = (i / n) * len;
		const px = x + c * u;
		const py = y + s * u;
		const l = 3.2 * (1 - (i / n) * 0.6);
		for (const sd of [-1, 1]) {
			const b = (a + sd * 55) * RAD;
			d += lineD(px, py, px + Math.cos(b) * l, py + Math.sin(b) * l);
		}
	}
	k.stroke("#5aa83e", 0.55, d);
}

function cypressStar(fl: Ink, x: number, y: number, r: number): void {
	fl.petals("#e0283c", x, y, 5, r * 0.55, r * 0.5, r * 0.26, -90);
	fl.dot("#f2c2a0", x, y, 0.5);
}

function cypressVine(st: GrowingStage): string {
	const k = new Ink();
	const lv = new Ink();
	const fl = new Ink();
	if (st === "sprout") {
		seedling(k, "#4f8a3a", 72);
		feather(lv, 40, 78, -150, 7);
		feather(lv, 40, 74, -30, 7);
		feather(lv, 40, 72, -90, 5);
		return out(k, lv);
	}
	const leafy = st === "leafy";
	const T = leafy ? 40 : 8;
	const tops: Pt[] = leafy ? [[28, T], [52, T]] : [[12, T], [40, T + 2], [68, T]];
	let s = "";
	for (const [x, y] of tops) s += lineD(40, 87, x, y);
	k.stroke("#c2ac82", 0.6, s);
	k.fill("#9a7a56", rectD(38.5, 84.5, 41.5, 88));
	const paths = tops.map(([x, y], i) => twine([[40, 87], [x, y + 4]], 1.4, 7, i));
	paths.forEach((v, pi) => {
		k.stroke("#4f8a3a", 0.9, polyD(v));
		every(v, 3, leafy ? 4 : 6, (x, y, a, j) => feather(lv, x, y, a + ((j + pi) % 2 ? 60 : -60), leafy ? 6 : 7));
	});
	if (leafy) {
		cypressStar(fl, 36, 56, 2.6);
		return out(k, lv, fl);
	}
	paths.forEach((v) => {
		every(v, 6, 6, (x, y, a, j) => {
			const b = a + (j % 2 ? 50 : -50);
			const ex = x + Math.cos(b * RAD) * 4.5;
			const ey = y + Math.sin(b * RAD) * 4.5;
			fl.stroke("#c81f34", 1.2, lineD(x, y, ex, ey));
			cypressStar(fl, ex, ey, 2.9);
		});
	});
	return out(k, lv, fl);
}

/* ---------------------------------------------------------------- 14. Scarlet runner bean */

function scarletRunner(st: GrowingStage): string {
	const k = new Ink();
	const lv = new Ink();
	const fl = new Ink();
	const pd = new Ink();
	const L = ["#4f9440", "#6aaa52"];
	const tri = (x: number, y: number, a: number, len: number, i: number) => {
		const [ex, ey] = stalk(k, GREEN.dark, x, y, a, 2.5, 0.7);
		const [mid, sides] = trifolD(ex, ey, a, len, len * 0.5, 1);
		lv.fill(L[i % 2]!, mid).fill(L[(i + 1) % 2]!, sides);
	};
	if (st === "sprout") {
		seedling(k, GREEN.dark, 70);
		lv.fill("#e0c87a", ellD(37.5, 80, 2.4, 1.6, 20) + ellD(42.5, 80, 2.4, 1.6, -20));
		tri(40, 72, -90, 6, 0);
		return out(k, lv);
	}
	const leafy = st === "leafy";
	const T = leafy ? 38 : 8;
	k.fill("#6e5236", rectD(38.8, T, 41.2, 87.5));
	const v = twine([[40, 87], [40, T + 3]], 3.2, 11);
	k.stroke("#3f7a35", 1.1, polyD(v));
	every(v, 3, 4, (x, y, _a, j) => tri(x, y, j % 2 ? -155 : -25, leafy ? 6.5 : 7.2, j));
	if (leafy) {
		fl.fill("#d9322a", ellD(46, 48, 1.4, 1.1, 0) + ellD(48, 50, 1.4, 1.1, 0));
		return out(k, lv, fl);
	}
	for (const [x, y, d] of [[43, 16, 1], [37, 28, -1], [43, 42, 1], [37, 56, -1]] as const) {
		const ex = x + d * 10;
		const ey = y - 7;
		fl.stroke("#3f7a35", 0.7, lineD(x, y, ex, ey));
		for (let i = 0; i < 3; i++) {
			const u = 0.45 + i * 0.27;
			const px = x + (ex - x) * u;
			const py = y + (ey - y) * u;
			fl.dot("#e0352c", px, py - 1, 1.6).dot("#a81c18", px + d * 0.9, py + 0.8, 0.9);
		}
	}
	for (const [x, y, d] of [[38, 36, -1], [42, 50, 1], [38, 64, -1], [42, 24, 1]] as const) {
		pd.stroke("#9ccc6a", 2.2, `M${x} ${y}q${d * 6} 3 ${d * 7} 17`);
	}
	return out(k, lv, pd, fl);
}

/* ---------------------------------------------------------------- 15. American bittersweet */

function bittersweet(st: GrowingStage): string {
	const k = new Ink();
	const lv = new Ink();
	const fr = new Ink();
	const vine = "#6b5640";
	if (st === "sprout") {
		seedling(k, vine, 71);
		lv.fill("#5f9a48", leafD(40, 79, -155, 6.5, 2.8, 0) + leafD(40, 73, -30, 6.5, 2.8, 0) + leafD(40, 71, -95, 5, 2.2, 0));
		return out(k, lv);
	}
	const leafy = st === "leafy";
	const snag = "#8f8a80";
	if (leafy) {
		k.fill(snag, `M37.5 87.5L38.5 44L40.5 40L41.5 44L42.5 87.5Z`);
		k.stroke(snag, 1.4, lineD(40, 56, 32, 48) + lineD(41, 50, 48, 44));
	} else {
		k.fill(snag, `M36.5 87.5L37.5 30L39 16L41 12L41.5 30L43.5 87.5Z`);
		k.stroke(snag, 2, lineD(39, 30, 22, 18) + lineD(41.5, 40, 60, 24) + lineD(38, 58, 20, 46) + lineD(42.5, 64, 62, 54));
		k.stroke(snag, 1.2, lineD(28, 22, 26, 13) + lineD(54, 29, 58, 19));
	}
	const paths: Pt[][] = leafy
		? [twine([[40, 87], [40, 44]], 3.4, 12), twine([[40, 56], [32, 48]], 1, 6)]
		: [twine([[40, 87], [40, 16]], 3.6, 13), twine([[39, 30], [22, 18]], 1.4, 7), twine([[41.5, 40], [60, 24]], 1.4, 7, 1), twine([[38, 58], [20, 46]], 1.4, 7), twine([[42.5, 64], [62, 54]], 1.4, 7, 2)];
	const cols = leafy ? ["#5f9a48", "#78ae5a"] : ["#cdb94a", "#a9a83e", "#d9c25a"];
	for (const v of paths) {
		k.stroke(vine, 1.1, polyD(v));
		every(v, 2, 4, (x, y, a, j) => lv.fill(cols[j % cols.length]!, leafD(x, y, a + (j % 2 ? 65 : -65), leafy ? 5.5 : 4.6, 2.3, 0)));
	}
	if (leafy) {
		for (const [x, y] of [[34, 52], [44, 47], [38, 62]] as const) fr.dot("#9cbf5a", x, y, 1.1).dot("#9cbf5a", x + 1.8, y + 1.2, 1.1);
		return out(k, lv, fr);
	}
	const berry = (x: number, y: number) => {
		fr.petals("#f0a02a", x, y, 3, 1.5, 1.3, 0.85, -90);
		fr.dot("#d0342a", x, y, 1.2);
	};
	for (const [x, y] of [[24, 20], [30, 26], [21, 48], [28, 52], [58, 26], [52, 32], [60, 56], [54, 60], [45, 46], [35, 36], [36, 70], [46, 74], [26, 14], [56, 20]] as const) {
		berry(x, y);
		berry(x + 2.6, y + 2.2);
		berry(x - 1.6, y + 3);
	}
	return out(k, lv, fr);
}

/* ---------------------------------------------------------------- 16. Climbing rose */

function roseHead(fl: Ink, x: number, y: number, r: number, i: number): void {
	fl.fill(i % 3 === 2 ? "#f08aa4" : "#e2577a", circD(x, y, r));
	fl.petals("#c23a62", x, y, 3, r * 0.35, r * 0.45, r * 0.3, i * 40);
	fl.dot("#f6b4c4", x - r * 0.35, y - r * 0.4, r * 0.25);
}

function climbingRose(st: GrowingStage): string {
	const k = new Ink();
	const lv = new Ink();
	const fl = new Ink();
	const cane = "#5a7a3a";
	const L = ["#4f8a44", "#64a054"];
	const rLeaf = (x: number, y: number, a: number, s: number, i: number) => {
		const [mid, sides] = trifolD(x, y, a, 4.2 * s, 2 * s, 0);
		lv.fill(L[i % 2]!, mid + sides);
	};
	if (st === "sprout") {
		seedling(k, cane, 70);
		rLeaf(40, 78, -155, 1, 0);
		rLeaf(40, 72, -30, 1, 1);
		return out(k, lv);
	}
	const leafy = st === "leafy";
	const fy = leafy ? 66 : 64;
	let pk = "";
	for (let x = 10; x <= 66; x += 7) pk += `M${x} 87.5V${fy + 2}L${x + 2} ${fy}L${x + 4} ${fy + 2}V87.5Z`;
	k.fill("#d8ccb2", pk).fill("#b8aa8c", rectD(9, fy + 6, 71, fy + 8.4) + rectD(9, 80, 71, 82.4));
	const canes: Br[] = leafy
		? [
				[[40, 87], [34, 70], [26, 58], [20, 50]],
				[[40, 87], [42, 68], [40, 54], [42, 44]],
				[[40, 87], [48, 70], [56, 60], [62, 54]],
			]
		: [
				[[40, 87], [28, 64], [14, 50], [10, 30]],
				[[40, 87], [34, 56], [20, 30], [26, 12]],
				[[40, 87], [42, 56], [38, 30], [42, 11]],
				[[40, 87], [48, 56], [62, 34], [56, 12]],
				[[40, 87], [54, 64], [66, 50], [70, 30]],
			];
	for (const p of canes) k.stroke(cane, leafy ? 1.5 : 1.6, bD(p));
	let i = 0;
	for (const p of canes) {
		for (let t = 0.32; t <= 1; t += leafy ? 0.17 : 0.22) {
			const [x, y] = bez(p, t);
			rLeaf(x, y, angAt(p, t) + (i % 2 ? 60 : -60), leafy ? 1 : 1.05, i);
			i++;
		}
	}
	if (leafy) {
		for (const p of canes) {
			const [x, y] = p[3];
			fl.fill("#e2577a", ellD(x, y - 1.4, 1.6, 2.4, 0)).fill(L[0]!, leafD(x, y + 1, -125, 3, 1, 1) + leafD(x, y + 1, -55, 3, 1, 1));
		}
		return out(k, lv, fl);
	}
	let n = 0;
	for (const p of canes) {
		rLeaf(p[3][0], p[3][1], angAt(p, 1), 1, n);
		for (const t of [0.42, 0.62, 0.82]) {
			const [x, y] = bez(p, t);
			roseHead(fl, x + (n % 2 ? 2.6 : -2.6), y + 1, 3.4, n++);
		}
	}
	return out(k, lv, fl);
}

/* ---------------------------------------------------------------- 17. Chocolate vine */

function chocolateVine(st: GrowingStage): string {
	const k = new Ink();
	const lv = new Ink();
	const fl = new Ink();
	const vine = "#6a4a3a";
	const L = ["#5f9a6a", "#7ab07e"];
	const akebia = (x: number, y: number, a: number, s: number, i: number) => {
		const [ex, ey] = stalk(k, vine, x, y, a, 3 * s, 0.6);
		let d = "";
		for (let j = 0; j < 5; j++) {
			const b = (a - 72 + j * 36) * RAD;
			d += segD(ex + Math.cos(b) * 1.6 * s, ey + Math.sin(b) * 1.6 * s, a - 72 + j * 36, 1.9 * s);
		}
		lv.stroke(L[i % 2]!, Math.round(29 * s) / 10, d);
	};
	if (st === "sprout") {
		seedling(k, vine, 72);
		akebia(40, 78, -150, 0.85, 0);
		akebia(40, 72, -40, 0.9, 1);
		return out(k, lv);
	}
	const leafy = st === "leafy";
	const T = leafy ? 46 : 12;
	k.fill("#7b8188", rectD(13, T, 15, 87.5) + rectD(65, T, 67, 87.5));
	let w = "";
	for (let y = T + 4; y < 84; y += 13) w += `M14 ${y}H66`;
	k.stroke("#9aa0a6", 0.5, w);
	const paths: Pt[][] = leafy
		? [twine([[40, 87], [40, 64], [28, 56], [20, 50]], 2, 9), twine([[40, 70], [52, 60], [60, 52]], 1.6, 9, 1)]
		: [twine([[40, 87], [38, 68], [26, 56], [16, 42], [20, 18]], 2.2, 10), twine([[40, 87], [44, 66], [56, 52], [64, 38], [58, 16]], 2.2, 10, 2), twine([[16, T + 4], [30, T + 6], [44, T + 4], [64, T + 5]], 1.4, 8), twine([[38, 68], [40, 46], [38, 28]], 1.6, 9, 1)];
	let n = 0;
	paths.forEach((v) => {
		k.stroke(vine, 1.1, polyD(v));
		every(v, 3, leafy ? 4 : 6, (x, y, a, j) => akebia(x, y, a + (j % 2 ? 70 : -70), leafy ? 0.95 : 1.05, n++));
	});
	if (leafy) {
		fl.fill("#7b2f55", petalsD(30, 60, 3, 1.4, 1.4, 1, -90));
		return out(k, lv, fl);
	}
	for (const [x, y] of [[26, 30], [50, 28], [34, 50], [58, 48], [22, 62], [46, 66]] as const) {
		fl.stroke(vine, 0.6, lineD(x, y, x - 2, y + 4) + lineD(x, y, x + 2.4, y + 3.4) + lineD(x, y, x, y + 6.4));
		for (const [dx, dy] of [[-2, 5], [2.4, 4.4], [0, 7.6]] as const) {
			fl.petals("#7b2f55", x + dx, y + dy, 3, 1.3, 1.4, 1, 90);
			fl.dot("#c0849c", x + dx, y + dy, 0.5);
		}
	}
	fl.fill("#9a7ac0", ellD(17, 52, 2.3, 4.6, 80) + ellD(63, 66, 2.3, 4.6, 100)).fill("#c8b4e0", ellD(16.6, 51, 0.6, 2.8, 80) + ellD(62.6, 65, 0.6, 2.8, 100));
	return out(k, lv, fl);
}

/* ---------------------------------------------------------------- 18. Dutchman's pipe */

function pipe(fl: Ink, x: number, y: number, d: 1 | -1): void {
	fl.stroke("#bdb478", 2.6, `M${x} ${y}q0 6 ${d * 4} 7q${d * 4} 1 ${d * 4} -4`);
	fl.fill("#7a2438", ellD(x + d * 8.2, y + 1.6, 2.8, 2.4, 0));
	fl.dot("#e2cc6a", x + d * 8.2, y + 1.8, 0.9);
}

function dutchmansPipe(st: GrowingStage): string {
	const k = new Ink();
	const lv = new Ink();
	const vn = new Ink();
	const fl = new Ink();
	const L = ["#5a9648", "#4a8440", "#6ea852"];
	const big = (x: number, y: number, a: number, len: number, i: number) => {
		lv.fill(L[i % 3]!, heartD(x, y, a, len, len * 0.55));
		vn.stroke("#2f5a2a", 0.5, ribD(x, y, a, len), 0.5);
	};
	if (st === "sprout") {
		seedling(k, GREEN.dark, 72);
		big(40, 78, -150, 7.5, 0);
		big(40, 73, -35, 8, 1);
		return out(k, lv, vn);
	}
	const leafy = st === "leafy";
	const T = leafy ? 44 : 12;
	k.fill("#8a6a4a", rectD(38, T, 42, 87.5)).fill("#76583c", rectD(leafy ? 30 : 16, T, leafy ? 50 : 64, T + 3));
	const v = twine([[40, 87], [40, T + 3]], 2.8, 12);
	k.stroke("#4a7a35", 1.2, polyD(v));
	let n = 0;
	every(v, 4, 4, (x, y, _a, j) => big(x + (j % 2 ? 1 : -1), y, j % 2 ? 40 + (j % 3) * 10 : 140 - (j % 3) * 10, leafy ? 11 : 12.5, n++));
	if (!leafy) {
		const beam = twine([[17, T + 2], [63, T + 2]], 1.2, 8);
		k.stroke("#4a7a35", 1.1, polyD(beam));
		every(beam, 2, 4, (x, y, _a, j) => big(x, y + 1, 90 + (j % 2 ? 25 : -25), 12, n++));
		pipe(fl, 22, 46, 1);
		pipe(fl, 58, 48, -1);
		pipe(fl, 30, 66, -1);
		pipe(fl, 50, 70, 1);
	} else pipe(fl, 47, 70, 1);
	return out(k, lv, vn, fl);
}

/* ---------------------------------------------------------------- 19. Canary creeper */

function canary(fl: Ink, x: number, y: number, s: number): void {
	fl.dot("#f6d22a", x - 1.8 * s, y - 1.7 * s, 2 * s).dot("#f6d22a", x + 1.8 * s, y - 1.7 * s, 2 * s).petals("#f6d22a", x, y + 0.6 * s, 3, 1.4 * s, 1 * s, 0.6 * s, 50);
	fl.dot("#c9402a", x - 1.2 * s, y - 1 * s, 0.4 * s).dot("#c9402a", x + 1.2 * s, y - 1 * s, 0.4 * s);
	fl.stroke("#8cb04a", 0.7, lineD(x, y, x + 1.4 * s, y + 3 * s));
}

function canaryCreeper(st: GrowingStage): string {
	const k = new Ink();
	const lv = new Ink();
	const fl = new Ink();
	const L = ["#6c9e72", "#84b486"];
	const pl = (x: number, y: number, a: number, R: number, i: number) => {
		const [ex, ey] = stalk(k, "#5a8a4a", x, y, a, 2.4, 0.6);
		lv.fill(L[i % 2]!, lobedD(ex, ey, a, R, 5, 0.55, 120, true, 0.25));
	};
	if (st === "sprout") {
		seedling(k, "#5a8a4a", 72);
		pl(40, 78, -150, 4.6, 0);
		pl(40, 73, -35, 5, 1);
		return out(k, lv);
	}
	const leafy = st === "leafy";
	const T = leafy ? 42 : 8;
	const tw: Br[] = leafy
		? [
				[[38, 87], [36, 70], [30, 56], [28, 44]],
				[[42, 87], [44, 70], [50, 56], [52, 42]],
			]
		: [
				[[37, 87], [32, 60], [20, 36], [14, 14]],
				[[39, 87], [38, 56], [32, 30], [32, 8]],
				[[41, 87], [44, 56], [50, 30], [50, 10]],
				[[43, 87], [50, 60], [62, 38], [66, 16]],
			];
	let twigs = "";
	for (const p of tw) {
		twigs += bD(p);
		for (const t of [0.4, 0.6, 0.8]) {
			const [x, y] = bez(p, t);
			const a = angAt(p, t) + (t === 0.6 ? 30 : -30);
			twigs += lineD(x, y, x + Math.cos(a * RAD) * 7, y + Math.sin(a * RAD) * 7);
		}
	}
	k.stroke("#9a7a58", 0.9, twigs);
	const paths: Pt[][] = leafy
		? [twine([[40, 87], [36, 66], [32, 50]], 2, 9), twine([[40, 84], [46, 66], [50, 50]], 2, 9, 2)]
		: [twine([[40, 87], [30, 62], [20, 40], [16, 18]], 2.4, 10), twine([[40, 87], [38, 60], [42, 34], [38, 10]], 2.2, 10, 1), twine([[40, 87], [52, 64], [62, 42], [64, 20]], 2.4, 10, 3)];
	let n = 0;
	paths.forEach((v) => {
		k.stroke("#5a8a4a", 0.9, polyD(v));
		every(v, 3, leafy ? 4 : 6, (x, y, a, j) => pl(x, y, a + (j % 2 ? 70 : -70), leafy ? 4.6 : 4.8, n++));
	});
	if (leafy) {
		canary(fl, 32, 50, 0.8);
		return out(k, lv, fl);
	}
	paths.forEach((v, pi) => every(v, 5 + pi, 7, (x, y, a, j) => {
		const b = a + (j % 2 ? -80 : 80);
		canary(fl, x + Math.cos(b * RAD) * 4, y + Math.sin(b * RAD) * 4, 1.1);
	}));
	return out(k, lv, fl);
}

/* ---------------------------------------------------------------- 20. Hyacinth bean */

function hyacinthBean(st: GrowingStage): string {
	const k = new Ink();
	const lv = new Ink();
	const vn = new Ink();
	const fl = new Ink();
	const stemC = "#6e3a70";
	const L = ["#5a8c4a", "#6c9e58"];
	const tri = (x: number, y: number, a: number, len: number, i: number) => {
		const [ex, ey] = stalk(k, stemC, x, y, a, 2.4, 0.7);
		const [mid, sides] = trifolD(ex, ey, a, len, len * 0.62, 4);
		lv.fill(L[i % 2]!, mid + sides);
		vn.stroke("#7a3a7a", 0.5, ribD(ex, ey, a, len), 0.8);
	};
	if (st === "sprout") {
		seedling(k, stemC, 70);
		tri(40, 74, -90, 5.5, 0);
		lv.fill("#7a9a5a", heartD(40, 80, -160, 5, 3) + heartD(40, 80, -20, 5, 3));
		return out(k, lv, vn);
	}
	const leafy = st === "leafy";
	const T = leafy ? 40 : 6;
	k.stroke("#b8a06a", 1.6, `M31 87.5L40 ${T}L49 87.5`);
	k.stroke("#8a7650", 1, `M38 ${T + 3}l4 0`);
	const paths: Pt[][] = leafy
		? [twine([[40, 87], [35, 66], [38, T + 6]], 2.4, 10)]
		: [twine([[40, 87], [33, 62], [36, 30], [40, T + 6]], 3, 11), twine([[40, 87], [47, 62], [44, 30]], 3, 11, 2), twine([[36, 46], [24, 40], [16, 30]], 1.6, 9), twine([[45, 40], [56, 34], [64, 24]], 1.6, 9, 1)];
	let n = 0;
	paths.forEach((v) => {
		k.stroke(stemC, 1.1, polyD(v));
		every(v, 3, 5, (x, y, a, j) => tri(x, y, a + (j % 2 ? 70 : -70), leafy ? 6.2 : 6.6, n++));
	});
	const spike = (x: number, y: number, h: number) => {
		fl.stroke(stemC, 0.8, lineD(x, y, x, y - h));
		for (let i = 0; i < 4; i++) {
			const yy = y - 2 - i * (h / 4.2);
			const s = 1 - i * 0.12;
			fl.dot(i % 2 ? "#c88ad6" : "#a65cba", x - 1.3, yy, 1.4).dot(i % 2 ? "#c88ad6" : "#a65cba", x + 1.3, yy - 0.6, 1.4);
		}
	};
	if (leafy) {
		spike(46, 56, 9);
		return out(k, lv, vn, fl);
	}
	spike(18, 30, 12);
	spike(62, 24, 12);
	spike(40, 14, 10);
	spike(26, 58, 11);
	for (const [x, y, a] of [[52, 46, 75], [56, 48, 95], [30, 66, 110], [34, 68, 85], [48, 66, 80], [22, 42, 100]] as const) {
		fl.fill("#7a2d7e", leafD(x, y, a, 10, 1.8, 0));
		fl.stroke("#b070b0", 0.5, ribD(x, y, a, 9));
	}
	return out(k, lv, vn, fl);
}

/* ---------------------------------------------------------------- 21. Snail vine */

function snail(fl: Ink, x: number, y: number, r: number, c: string): void {
	fl.fill(c, circD(x, y, r + 0.9));
	const r1 = r * 0.75;
	const r2 = r * 0.5;
	const r3 = r * 0.28;
	fl.stroke("#7a5ab0", 0.8, `M${f(x + r)} ${f(y)}A${f((r + r1) / 2)} ${f((r + r1) / 2)} 0 0 1 ${f(x - r1)} ${f(y)}A${f((r1 + r2) / 2)} ${f((r1 + r2) / 2)} 0 0 1 ${f(x + r2)} ${f(y)}A${f((r2 + r3) / 2)} ${f((r2 + r3) / 2)} 0 0 1 ${f(x - r3)} ${f(y)}`);
	fl.dot("#f3eefa", x, y, 0.6);
}

function snailVine(st: GrowingStage): string {
	const k = new Ink();
	const lv = new Ink();
	const fl = new Ink();
	const L = ["#5d9a4c", "#78ae60"];
	const tri = (x: number, y: number, a: number, len: number, i: number) => {
		const [ex, ey] = stalk(k, GREEN.dark, x, y, a, 2.4, 0.7);
		const [mid, sides] = trifolD(ex, ey, a, len, len * 0.5, 0);
		lv.fill(L[i % 2]!, mid + sides);
	};
	if (st === "sprout") {
		seedling(k, GREEN.dark, 71);
		tri(40, 76, -150, 5, 0);
		tri(40, 71, -40, 5.5, 1);
		return out(k, lv);
	}
	const leafy = st === "leafy";
	const T = leafy ? 42 : 8;
	const w = leafy ? 12 : 22;
	let ob = `M${40 - w} 87.5L40 ${T + 4}L${40 + w} 87.5`;
	for (let u = 0.25; u < 0.9; u += leafy ? 0.33 : 0.22) {
		const y = 87.5 - (87.5 - T - 4) * u;
		const hw = w * (1 - u);
		ob += `M${f(40 - hw)} ${f(y)}H${f(40 + hw)}`;
	}
	k.stroke("#9c7a54", 1.4, ob);
	k.dot("#9c7a54", 40, T + 2, 2);
	const paths: Pt[][] = leafy
		? [twine([[40, 87], [34, 70], [40, 56], [38, 48]], 2.2, 10)]
		: [twine([[40, 87], [24, 70], [30, 44], [38, 18]], 2.4, 11), twine([[40, 87], [56, 70], [50, 44], [42, 20]], 2.4, 11, 2)];
	let n = 0;
	paths.forEach((v) => {
		k.stroke(GREEN.dark, 1.1, polyD(v));
		every(v, 3, 4, (x, y, a, j) => tri(x, y, a + (j % 2 ? 70 : -70), leafy ? 5.4 : 6, n++));
	});
	if (leafy) {
		snail(fl, 46, 52, 2.4, "#c9b4e6");
		return out(k, lv, fl);
	}
	for (const [x, y, d] of [[22, 54, -1], [58, 54, 1], [24, 26, -1], [56, 30, 1], [40, 12, 1]] as const) {
		const pts: Pt[] = [[x, y], [x + d * 4, y + 4], [x + d * 2, y + 8.5]];
		fl.stroke(GREEN.dark, 0.7, lineD(x - d * 3, y - 2, x + d * 4, y + 9));
		pts.forEach(([px, py], i) => snail(fl, px, py, 2.6 - i * 0.3, i === 1 ? "#f3eefa" : "#b79ad9"));
	}
	return out(k, lv, fl);
}

/* ---------------------------------------------------------------- 22. Blue sky vine */

function skyFlower(fl: Ink, x: number, y: number, r: number): void {
	fl.petals("#8fb2ec", x, y, 5, r * 0.5, r * 0.5, r * 0.5, -90);
	fl.petals("#b8cff4", x, y, 2, r * 0.5, r * 0.4, r * 0.4, -54);
	fl.dot("#f2e6a0", x, y + r * 0.1, r * 0.3);
}

function blueSkyVine(st: GrowingStage): string {
	const k = new Ink();
	const lv = new Ink();
	const fl = new Ink();
	const L = ["#4c8a42", "#5f9c50"];
	if (st === "sprout") {
		seedling(k, GREEN.dark, 70);
		lv.fill(L[0]!, heartD(40, 78, -150, 7.5, 3.8)).fill(L[1]!, heartD(40, 72, -35, 8, 4));
		return out(k, lv);
	}
	const leafy = st === "leafy";
	const wood = "#8a6a4a";
	if (leafy) {
		k.fill(wood, rectD(18, 40, 21, 87.5) + rectD(18, 38, 46, 41));
		const v = twine([[38, 87], [24, 72], [20, 50], [24, 42], [44, 42]], 2.2, 10);
		k.stroke(GREEN.dark, 1.1, polyD(v));
		every(v, 3, 4, (x, y, a, j) => lv.fill(L[j % 2]!, heartD(x, y, a + (j % 2 ? 80 : -80), 8, 4)));
		k.stroke(GREEN.dark, 0.7, lineD(36, 42, 36, 52));
		fl.fill("#8fb2ec", ellD(36, 53, 1.4, 2, 0));
		return out(k, lv, fl);
	}
	k.fill(wood, rectD(13, 10, 16.5, 87.5) + rectD(10, 8, 73, 11.5));
	k.stroke(wood, 1.8, lineD(15, 26, 30, 11));
	const v = twine([[40, 87], [24, 76], [16, 56], [16, 20], [18, 12], [70, 11]], 2, 10);
	k.stroke(GREEN.dark, 1.2, polyD(v));
	every(v, 3, 4, (x, y, a, j) => lv.fill(L[j % 2]!, heartD(x, y, y < 16 ? (j % 2 ? 60 : 120) : a + (j % 2 ? 80 : -80), 9, 4.4)));
	for (const [x, len] of [[26, 34], [39, 52], [52, 30], [64, 46]] as const) {
		k.stroke(GREEN.dark, 0.8, `M${x} 12Q${x + 3} ${12 + len / 2} ${x} ${12 + len}`);
		for (let i = 1; i <= Math.floor(len / 11); i++) skyFlower(fl, x + (i % 2 ? -2.4 : 2.6), 12 + i * 11, 5);
	}
	return out(k, lv, fl);
}

/* ---------------------------------------------------------------- 23. Coral vine */

function coralVine(st: GrowingStage): string {
	const k = new Ink();
	const lv = new Ink();
	const fl = new Ink();
	const L = ["#7cb45a", "#94c46c"];
	if (st === "sprout") {
		seedling(k, "#5a8a3a", 72);
		lv.fill(L[0]!, heartD(40, 78, -150, 7, 3.6)).fill(L[1]!, heartD(40, 73, -30, 7, 3.6));
		return out(k, lv);
	}
	const leafy = st === "leafy";
	const [x0, y0, x1] = leafy ? [24, 48, 56] : [9, 16, 71];
	k.stroke("#a4a8ad", 0.45, diamondsD(x0, y0, x1, 87, 5.5, 1.6));
	k.fill("#7d8287", rectD(x0 - 1, y0 - 1, x0 + 1, 87.5) + rectD(x1 - 1, y0 - 1, x1 + 1, 87.5) + rectD(x0, y0 - 1, x1, y0 + 0.6));
	const paths: Pt[][] = leafy
		? [twine([[40, 87], [34, 70], [36, 54], [30, 48]], 2, 9), twine([[40, 87], [48, 70], [50, 56]], 2, 9, 2)]
		: [twine([[40, 87], [30, 70], [22, 50], [14, 30], [16, 16]], 2.2, 10), twine([[40, 87], [50, 70], [58, 48], [64, 30], [62, 16]], 2.2, 10, 2), twine([[40, 84], [40, 60], [36, 40], [40, 16]], 2, 10, 1), twine([[14, 16], [30, 15], [46, 16], [64, 15]], 1.2, 8)];
	let n = 0;
	paths.forEach((v) => {
		k.stroke("#5a8a3a", 1, polyD(v));
		every(v, 3, leafy ? 4 : 5, (x, y, a, j) => lv.fill(L[n++ % 2]!, heartD(x, y, a + (j % 2 ? 75 : -75), leafy ? 6.5 : 6.8, 3.5)));
	});
	const spray = (x: number, y: number, d: 1 | -1, len: number) => {
		const p: Br = [[x, y], [x + d * len * 0.5, y - 3], [x + d * len * 0.9, y + 2], [x + d * len, y + len * 0.5]];
		fl.stroke("#a8586a", 0.5, bD(p));
		for (let t = 0.12; t <= 1; t += 0.12) {
			const [px, py] = bez(p, t);
			const j = Math.round(t * 10);
			fl.dot(j % 2 ? "#f0789e" : "#e14f86", px + (j % 3) - 1, py + 1.2, 1.15);
			fl.dot("#f6a8c0", px + 0.8 - (j % 2) * 1.6, py - 0.8, 0.85);
		}
		fl.stroke("#8cc46a", 0.5, tendrilD(p[3][0], p[3][1], 90, 4));
	};
	if (leafy) {
		spray(36, 56, 1, 9);
		return out(k, lv, fl);
	}
	spray(16, 18, 1, 14);
	spray(62, 18, -1, 14);
	spray(40, 26, 1, 14);
	spray(22, 44, 1, 13);
	spray(58, 42, -1, 13);
	spray(36, 58, -1, 12);
	spray(48, 64, 1, 12);
	return out(k, lv, fl);
}

/* ---------------------------------------------------------------- 24. Crimson glory vine */

function crimsonGlory(st: GrowingStage): string {
	const k = new Ink();
	const lv = new Ink();
	const vn = new Ink();
	const fr = new Ink();
	const greens = ["#5f9a48", "#78b05a"];
	const reds = ["#b0283a", "#d24a3a", "#8a1e36", "#c2342c", "#e0703a"];
	const big = (x: number, y: number, a: number, R: number, i: number, cols: readonly string[]) => {
		lv.fill(cols[i % cols.length]!, lobedD(x, y, a, R, 3, 0.12, 70, true, 0.15));
		vn.stroke("#5a1424", 0.5, veinsD(x, y, a, R, 3, 60), 0.45);
	};
	if (st === "sprout") {
		seedling(k, "#7a5a40", 72);
		big(40, 78, -150, 5.5, 0, greens);
		big(40, 72, -35, 6, 1, greens);
		return out(k, lv);
	}
	const leafy = st === "leafy";
	const [x0, y0, x1] = leafy ? [22, 54, 58] : [8, 34, 72];
	let pl = "";
	for (let x = x0; x < x1; x += 6) pl += `M${x + 0.5} ${y0 + (((x - x0) / 6) % 2) * 1.5}h5V87.5h-5Z`;
	k.fill("#8c7052", pl);
	const wood = "#6e4a34";
	k.stroke(wood, leafy ? 2 : 2.8, bD(leafy ? [[40, 87], [36, 74], [44, 64], [40, 52]] : [[40, 87], [36, 64], [44, 44], [40, 30]]));
	const arms: Br[] = leafy
		? [
				[[40, 54], [32, 50], [26, 52], [22, 56]],
				[[40, 54], [48, 50], [54, 52], [58, 56]],
			]
		: [
				[[40, 31], [30, 25], [21, 25], [16, 32]],
				[[40, 31], [50, 25], [59, 25], [64, 32]],
				[[40, 31], [38, 26], [42, 22], [40, 19]],
			];
	for (const p of arms) k.stroke(wood, 1.6, bD(p));
	let n = 0;
	const cols = leafy ? greens : reds;
	for (const p of arms) {
		for (const t of [0.2, 0.5, 0.8, 1]) {
			const [x, y] = bez(p, t);
			big(x, y, -90 + (n % 2 ? 40 : -40) + angAt(p, t) * 0, leafy ? 6.5 : 8.5, n++, cols);
			if (!leafy) big(x, y + 2, 90 + (n % 2 ? 30 : -30), 8, n++, cols);
		}
	}
	if (!leafy) for (const [x, y, a] of [[38, 60, -150], [42, 50, -30], [38, 72, -160], [43, 76, -20]] as const) big(x, y, a, 8, n++, cols);
	if (leafy) return out(k, lv, vn);
	for (const [x, y] of [[26, 44], [54, 46], [40, 40]] as const) {
		for (const [dx, dy] of [[-1.4, 0], [1.4, 0], [0, 2.2], [-1.4, 4.2], [1.4, 4.2], [0, 6.2]] as const) fr.dot("#2e1f3a", x + dx, y + dy, 1.35);
		fr.dot("#7a6a98", x - 1.8, y - 0.4, 0.4);
	}
	return out(k, lv, vn, fr);
}

/* ---------------------------------------------------------------- 25. Golden trumpet */

function allamanda(fl: Ink, x: number, y: number, r: number, o: number): void {
	fl.petals("#e2a612", x, y, 5, r * 0.5, r * 0.5, r * 0.5, o + 36);
	fl.petals("#f7c51e", x, y, 5, r * 0.5, r * 0.46, r * 0.46, o);
	let d = "";
	for (let i = 0; i < 5; i++) {
		const a = (o + i * 72) * RAD;
		d += lineD(x + Math.cos(a) * r * 0.2, y + Math.sin(a) * r * 0.2, x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5);
	}
	fl.dot("#d08a10", x, y, r * 0.26);
	fl.stroke("#b86a0c", 0.5, d);
}

function goldenTrumpet(st: GrowingStage): string {
	const k = new Ink();
	const lv = new Ink();
	const rib = new Ink();
	const fl = new Ink();
	const L = ["#3d7a3a", "#4f8c44"];
	const whorl = (x: number, y: number, len: number, o: number) => {
		for (let i = 0; i < 4; i++) {
			const a = o + i * 90;
			lv.fill(L[i % 2]!, leafD(x, y, a, len, len * 0.3, 1));
			if (st !== "bloom") rib.stroke("#8cc46a", 0.45, ribD(x, y, a, len), 0.6);
		}
	};
	if (st === "sprout") {
		seedling(k, GREEN.dark, 70);
		whorl(40, 76, 6.5, -10);
		whorl(40, 70, 4.5, -55);
		return out(k, lv, rib);
	}
	const leafy = st === "leafy";
	const T = leafy ? 42 : 8;
	const xs = leafy ? [30, 50] : [16, 40, 64];
	let g = "";
	for (const x of xs) g += `M${x} 87.5V${T}`;
	for (let y = 80; y > T + 2; y -= 15) g += `M${xs[0]! - 3} ${y}H${xs[xs.length - 1]! + 3}`;
	k.stroke("#c6ad6a", 1.5, g);
	const paths: Pt[][] = leafy
		? [twine([[40, 87], [34, 70], [44, 56], [40, 46]], 2, 12)]
		: [twine([[40, 87], [28, 70], [18, 50], [24, 28], [18, 12]], 2, 12), twine([[40, 87], [52, 70], [62, 50], [56, 28], [62, 12]], 2, 12, 2), twine([[40, 80], [40, 50], [40, 14]], 1.6, 12, 1)];
	paths.forEach((v) => {
		k.stroke(GREEN.dark, 1.2, polyD(v));
		every(v, 4, 6, (x, y, _a, j) => whorl(x, y, leafy ? 6.6 : 7, j * 25 - 20));
	});
	if (leafy) {
		fl.fill("#f0c030", trumpetD(40, 46, -70, 8, 2));
		return out(k, lv, rib, fl);
	}
	for (const [x, y, o] of [[18, 14, -90], [62, 14, -60], [40, 20, -80], [22, 42, -70], [58, 40, -100], [40, 56, -90]] as const) allamanda(fl, x, y, 8, o);
	fl.fill("#e8b420", trumpetD(30, 66, -150, 8, 2) + trumpetD(52, 26, -30, 8, 2));
	return out(k, lv, rib, fl);
}

/* ---------------------------------------------------------------- export */

const ALL: [string, (st: GrowingStage) => string][] = [
	["Climbing hydrangea", climbingHydrangea],
	["Trumpet vine", trumpetVine],
	["Virginia creeper", virginiaCreeper],
	["Boston ivy", bostonIvy],
	["Black-eyed Susan vine", blackEyedSusanVine],
	["Mandevilla", mandevilla],
	["Chilean glory flower", chileanGlory],
	["Kiwi vine", kiwi],
	["Hops", hops],
	["Star jasmine", starJasmine],
	["Cup-and-saucer vine", cupAndSaucer],
	["Moonflower", moonflower],
	["Cypress vine", cypressVine],
	["Scarlet runner bean", scarletRunner],
	["American bittersweet", bittersweet],
	["Climbing rose", climbingRose],
	["Chocolate vine", chocolateVine],
	["Dutchman's pipe", dutchmansPipe],
	["Canary creeper", canaryCreeper],
	["Hyacinth bean", hyacinthBean],
	["Snail vine", snailVine],
	["Blue sky vine", blueSkyVine],
	["Coral vine", coralVine],
	["Crimson glory vine", crimsonGlory],
	["Golden trumpet", goldenTrumpet],
];

export const SPECIES: Species[] = ALL.map(([name, draw]) => ({
	id: name
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.replace(/'/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, ""),
	name,
	draw,
}));
