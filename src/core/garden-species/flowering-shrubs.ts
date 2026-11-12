/**
 * Flowering shrubs (owner design, 2026-11-11): 25 species in the shared kit
 * style. Small repeated marks (leaves, florets, berries) are merged into one
 * path per colour to keep each drawing's markup small.
 */
import { bez, f, type GrowingStage, type Pt, type Species } from "./kit";

type Br = readonly [Pt, Pt, Pt, Pt];
type Shape = 0 | 1 | 2 | 4;
const RAD = Math.PI / 180;

/* ---------------------------------------------------------------- helpers */

/** Collects path data per paint, emitting one <path> per paint in first-use order. */
class Ink {
	private parts = new Map<string, string>();
	private add(key: string, d: string): this {
		this.parts.set(key, (this.parts.get(key) ?? "") + d);
		return this;
	}
	fill(color: string, d: string, opacity = 1): this {
		return this.add(`f|${color}|0|${opacity}`, d);
	}
	stroke(color: string, width: number, d: string, opacity = 1): this {
		return this.add(`s|${color}|${width}|${opacity}`, d);
	}
	/** A dot: a zero-length round-capped stroke. */
	dot(color: string, x: number, y: number, r: number, opacity = 1): this {
		return this.stroke(color, Math.round(r * 20) / 10, `M${f(x)} ${f(y)}h0`, opacity);
	}
	/** n round-capped strokes radiating from r0 to r1 around (x, y): cheap petals. */
	spokes(color: string, width: number, x: number, y: number, n: number, r0: number, r1: number, off = 0): this {
		let d = "";
		for (let i = 0; i < n; i++) {
			const a = off + (i * 360) / n;
			const [ax, ay] = go(x, y, a, r0);
			d += `M${f(ax)} ${f(ay)}l${f(Math.cos(a * RAD) * (r1 - r0))} ${f(Math.sin(a * RAD) * (r1 - r0))}`;
		}
		return this.stroke(color, width, d);
	}
	/** A short round-capped stroke from (x, y) heading a: a cheap small leaf. */
	tick(color: string, width: number, x: number, y: number, a: number, len: number): this {
		return this.stroke(color, width, `M${f(x)} ${f(y)}l${f(Math.cos(a * RAD) * len)} ${f(Math.sin(a * RAD) * len)}`);
	}
	toString(): string {
		let s = "";
		for (const [key, d] of this.parts) {
			if (!d) continue;
			const [kind, color, width, op] = key.split("|");
			const o = op === "1" ? "" : ` opacity="${op}"`;
			s +=
				kind === "f"
					? `<path d="${d}" fill="${color}"${o}/>`
					: `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"${o}/>`;
		}
		return s;
	}
}

const out = (...inks: Ink[]) => inks.join("");

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

function bD(p: Br): string {
	return `M${f(p[0][0])} ${f(p[0][1])}C${f(p[1][0])} ${f(p[1][1])} ${f(p[2][0])} ${f(p[2][1])} ${f(p[3][0])} ${f(p[3][1])}`;
}

function lineD(x1: number, y1: number, x2: number, y2: number): string {
	return `M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}`;
}

/** A straight polygon. */
function polyD(pts: readonly Pt[]): string {
	return pts.map(([x, y], i) => `${i ? "L" : "M"}${f(x)} ${f(y)}`).join("") + "Z";
}

function angAt(p: Br, t: number): number {
	const a = bez(p, Math.max(0, t - 0.02));
	const b = bez(p, Math.min(1, t + 0.02));
	return Math.atan2(b[1] - a[1], b[0] - a[0]) / RAD;
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
function lobedD(x: number, y: number, a: number, R: number, n: number, depth: number, spread: number): string {
	const cx = x + Math.cos(a * RAD) * R * 0.75;
	const cy = y + Math.sin(a * RAD) * R * 0.75;
	const P = (th: number, r: number) => `${f(cx + r * Math.cos((a + th) * RAD))} ${f(cy + r * Math.sin((a + th) * RAD))}`;
	const tipR = (th: number) => R * (1 - (0.3 * Math.abs(th)) / 180);
	const step = n > 1 ? (2 * spread) / (n - 1) : 0;
	const sin = R * (1 - depth);
	const first = Math.max(-176, -spread - step / 2);
	let d = `M${P(180, R * 0.1)}L${P(first, sin * 0.8)}`;
	for (let i = 0; i < n; i++) {
		const th = -spread + i * step;
		const last = i === n - 1;
		const ths = last ? Math.min(176, th + step / 2) : th + step / 2;
		d += `L${P(th, tipR(th))}L${P(ths, last ? sin * 0.8 : sin)}`;
	}
	return `${d}Z`;
}

/** A single sprout: a short stem with leaf pairs (or alternate leaves). */
function sprout(stemColor: string, L: LeafSet, h = 16, len = 7, w = 3, pair = true): string {
	const k = new Ink();
	const top = new Ink();
	const p: Br = [[40, 87], [40, 82], [40.5, 87 - h * 0.7], [40.5, 87 - h]];
	k.stroke(stemColor, 1.6, bD(p));
	if (pair) pairsOn(k, top, p, [0.5, 1], len, w, L, 58);
	else leavesOn(k, top, p, [0.45, 0.75], len, w, L, 55);
	return out(k, top);
}

/** A point at distance d along heading a from (x, y). */
function go(x: number, y: number, a: number, d: number): Pt {
	return [x + Math.cos(a * RAD) * d, y + Math.sin(a * RAD) * d];
}

/* ---------------------------------------------------------------- 1. Butterfly bush */

/** A tapering, nodding flower spike of dots from (x, y) heading a, turning by bend. */
function panicle(fl: Ink, x: number, y: number, a: number, len: number, w: number, bend: number, c1: string, c2: string, eye: string | null): void {
	const n = 8;
	let px = x;
	let py = y;
	let ang = a;
	const left: Pt[] = [];
	const right: Pt[] = [];
	const mids: [number, number, number, number][] = [];
	for (let i = 0; i <= n; i++) {
		const u = i / n;
		const r = i === n ? 0 : w * (1 - 0.75 * u) * (i === 0 ? 0.8 : 1);
		left.push(go(px, py, ang - 90, r));
		right.unshift(go(px, py, ang + 90, r));
		mids.push([px, py, ang, r]);
		ang += bend / n;
		[px, py] = go(px, py, ang, len / n);
	}
	fl.fill(c1, polyD([...left, ...right]));
	mids.forEach(([mx, my, ma, r], i) => {
		if (i === 0 || i === n) return;
		const [dx, dy] = go(mx, my, ma + (i % 2 ? 90 : -90), r * 0.45);
		fl.dot(c2, dx, dy, w * 0.32);
		if (eye && i % 2 === 0) fl.dot(eye, ...go(mx, my, ma - (i % 4 ? 90 : -90), r * 0.4), 0.45);
	});
}

function butterflyBush(st: GrowingStage): string {
	const L: LeafSet = { fill: "#7f9c78", alt: "#9ab394", rib: "#4d6648", shape: 1 };
	const tw = "#8a7a5e";
	if (st === "sprout") return sprout(tw, L, 17, 8.5, 2.2);
	const k = new Ink();
	const top = new Ink();
	const fl = new Ink();
	const B: Br[] =
		st === "leafy"
			? [
					[[40, 87], [37, 72], [28, 62], [22, 56]],
					[[40, 87], [40, 68], [41, 54], [42, 42]],
					[[40, 87], [44, 72], [52, 62], [58, 56]],
				]
			: [
					[[40, 87], [36, 70], [26, 60], [19, 54]],
					[[40, 87], [38, 66], [32, 50], [27, 38]],
					[[40, 87], [41, 64], [42, 44], [42, 30]],
					[[40, 87], [43, 66], [49, 50], [54, 38]],
					[[40, 87], [44, 70], [54, 60], [61, 54]],
				];
	for (const p of B) k.stroke(tw, st === "leafy" ? 1.8 : 2.1, bD(p));
	for (const p of B) pairsOn(k, top, p, st === "leafy" ? [0.4, 0.62, 0.84] : [0.3, 0.5, 0.7], st === "leafy" ? 10 : 11, 2.4, L, 52);
	B.forEach((p) => {
		const [x, y] = p[3];
		const a = angAt(p, 1);
		const side = x < 38 ? -1 : x > 44 ? 1 : 0.5;
		if (st === "leafy") panicle(fl, x, y, a, 6, 1.8, side * 20, "#9fb882", "#b9cf9c", null);
		else panicle(fl, x, y, a, side === 0.5 ? 18 : 15, 3.4, side * 55, "#8a5cc4", "#b08ee0", "#f0a040");
	});
	return out(k, top, fl);
}

/* ---------------------------------------------------------------- 2. Rose of Sharon */

function roseOfSharon(st: GrowingStage): string {
	const lf = "#5f9a4e";
	const tw = "#8a8070";
	const k = new Ink();
	const lv = new Ink();
	if (st === "sprout") {
		k.stroke(tw, 1.6, lineD(40, 87, 40, 69));
		lv.fill(lf, lobedD(40, 78, -150, 5.5, 3, 0.35, 45) + lobedD(40, 74, -30, 5.5, 3, 0.35, 45) + lobedD(40, 69, -90, 6, 3, 0.35, 45));
		return out(k, lv);
	}
	const leafy = st === "leafy";
	const tops: Pt[] = leafy
		? [[32, 46], [38, 38], [44, 40], [50, 48]]
		: [[26, 24], [34, 14], [42, 12], [49, 16], [56, 26]];
	const B: Br[] = tops.map(([x, y]) => [[40, 87], [40 + (x - 40) * 0.1, 70], [40 + (x - 40) * 0.6, y + 22], [x, y]] as Br);
	for (const p of B) k.stroke(tw, leafy ? 1.6 : 1.9, bD(p));
	B.forEach((p, bi) => {
		for (let i = 0; i < 4; i++) {
			const t = 0.38 + i * 0.17;
			const [x, y] = bez(p, t);
			const a = angAt(p, t) + ((i + bi) % 2 ? 50 : -50);
			lv.fill(i % 2 ? lf : "#78ae64", lobedD(x, y, a, 5.2, 3, 0.35, 45));
		}
	});
	if (leafy) {
		for (const p of B) lv.fill("#8fb06a", ellD(p[3][0], p[3][1] - 1.5, 1.6, 2.6, 0));
		return out(k, lv);
	}
	const fl = new Ink();
	const sh = new Ink();
	const eye = new Ink();
	B.forEach((p, bi) => {
		const ts = bi % 2 ? [0.5, 0.78, 1] : [0.62, 0.9];
		ts.forEach((t, i) => {
			let [x, y] = bez(p, t);
			const a = angAt(p, t) + ((i + bi) % 2 ? 90 : -90);
			if (t < 1) [x, y] = go(x, y, a, 3);
			fl.spokes((i + bi) % 3 ? "#c58ad8" : "#d9a8e6", 3.4, x, y, 5, 1.2, 2.5, -90 + bi * 13);
			sh.spokes("#a466bc", 0.4, x, y, 5, 1, 3.4, -90 + bi * 13);
			eye.dot("#8c1c48", x, y, 1.15);
			fl.dot("#f6eef6", x, y, 0.45);
		});
	});
	return out(k, lv, fl, sh, eye);
}

/* ---------------------------------------------------------------- 3. Weigela */

function funnelD(x: number, y: number, a: number, len: number, w: number): string {
	const P = rot(x, y, a);
	return `M${P(0, -w * 0.22)}Q${P(len * 0.7, -w * 0.3)} ${P(len, -w)}Q${P(len * 1.15, 0)} ${P(len, w)}Q${P(len * 0.7, w * 0.3)} ${P(0, w * 0.22)}Z`;
}

function weigela(st: GrowingStage): string {
	const L: LeafSet = { fill: "#5f9a52", alt: "#7aae66", rib: "#2f5a30", shape: 1 };
	const tw = "#7d6248";
	if (st === "sprout") return sprout(tw, L, 16, 8, 3.2);
	const k = new Ink();
	const top = new Ink();
	const B: Br[] =
		st === "leafy"
			? [
					[[40, 87], [34, 70], [24, 62], [17, 62]],
					[[40, 87], [38, 66], [36, 54], [33, 46]],
					[[40, 87], [42, 66], [46, 54], [50, 46]],
					[[40, 87], [46, 70], [56, 62], [63, 62]],
				]
			: [
					[[40, 87], [30, 66], [18, 54], [12, 58]],
					[[40, 87], [35, 60], [28, 42], [20, 34]],
					[[40, 87], [40, 60], [40, 40], [42, 26]],
					[[40, 87], [45, 60], [52, 42], [60, 34]],
					[[40, 87], [50, 66], [62, 54], [68, 58]],
				];
	for (const p of B) k.stroke(tw, 1.8, bD(p));
	for (const p of B) leavesOn(k, st === "leafy" ? top : null, p, [0.3, 0.46, 0.62, 0.78, 0.92], st === "leafy" ? 8 : 9, 3.2, L, 58, true);
	if (st === "leafy") return out(k, top);
	const fl = new Ink();
	const th = new Ink();
	B.forEach((p, bi) => {
		for (const t of [0.5, 0.74, 0.96]) {
			const [x, y] = bez(p, t);
			const base = angAt(p, t);
			const up = base + (base > -90 ? -70 : 70);
			[up - 18, up + 18].forEach((a, j) => {
				fl.fill((j + bi) % 2 ? "#e0708f" : "#ec93ab", funnelD(x, y, a, 6.5, 2.6));
				const [mx, my] = go(x, y, a, 6.2);
				th.dot("#b03e62", mx, my, 0.9);
			});
		}
	});
	return out(k, top, fl, th);
}

/* ---------------------------------------------------------------- 4. Bridal wreath spirea */

function spirea(st: GrowingStage): string {
	const tw = "#8a6a52";
	const L: LeafSet = { fill: "#86b86a", alt: "#9cc77f", shape: 0 };
	if (st === "sprout") return sprout(tw, L, 14, 5, 2.2, false);
	const k = new Ink();
	const lv = new Ink();
	const leafy = st === "leafy";
	const spread = leafy ? [-21, -12, -4, 4, 12, 21] : [-33, -25, -16, -7, 2, 10, 19, 27, 34];
	const B: Br[] = spread.map((dx) => {
		const ax = Math.abs(dx);
		const peak = leafy ? 52 + ax * 0.45 : 20 + ax * 0.72;
		const end = Math.min(peak + 8 + ax * 0.45, 78);
		return [[40, 87], [40 + dx * 0.15, peak + 4], [40 + dx * 0.8, peak - 6], [40 + dx, end]] as Br;
	});
	for (const p of B) k.stroke(tw, 1, bD(p));
	B.forEach((p, bi) => {
		for (let i = 0; i < 8; i++) {
			const t = 0.32 + i * 0.095;
			const [x, y] = bez(p, t);
			lv.tick((i + bi) % 2 ? L.fill : L.alt!, 1.7, x, y, angAt(p, t) + (i % 2 ? 50 : -50), 2.4);
		}
	});
	if (leafy) return out(k, lv);
	const w1 = new Ink();
	const w2 = new Ink();
	B.forEach((p, bi) => {
		const up = p[3][0] < 40 ? 90 : -90;
		for (let i = 0; i < 12; i++) {
			const t = 0.36 + i * 0.058;
			const [x, y] = bez(p, t);
			const [cx, cy] = go(x, y, angAt(p, t) + up, 1.1);
			w1.dot("#cfd3c2", cx + 0.4, cy + 0.6, 1.8);
			w2.dot((i + bi) % 3 ? "#fbfbf4" : "#eef0e2", cx, cy, 1.45);
		}
	});
	return out(k, lv, w1, w2);
}

/* ---------------------------------------------------------------- 5. Mock orange */

function mockOrange(st: GrowingStage): string {
	const L: LeafSet = { fill: "#5c9650", alt: "#72aa62", rib: "#2f5a30", shape: 0 };
	const tw = "#9a7a5c";
	if (st === "sprout") return sprout(tw, L, 17, 7.5, 3.4);
	const k = new Ink();
	const top = new Ink();
	const leafy = st === "leafy";
	const B: Br[] = leafy
		? [
				[[40, 87], [37, 72], [31, 60], [27, 50]],
				[[40, 87], [40, 68], [40, 52], [40, 42]],
				[[40, 87], [43, 72], [49, 60], [53, 50]],
			]
		: [
				[[40, 87], [34, 70], [22, 56], [14, 46]],
				[[40, 87], [37, 66], [30, 46], [27, 28]],
				[[40, 87], [40, 64], [41, 40], [42, 18]],
				[[40, 87], [43, 66], [50, 46], [54, 28]],
				[[40, 87], [46, 70], [58, 56], [66, 46]],
			];
	for (const p of B) k.stroke(tw, 1.9, bD(p));
	for (const p of B) pairsOn(k, leafy ? top : null, p, leafy ? [0.4, 0.65, 0.9] : [0.35, 0.55, 0.75], 8.5, 3.6, L, 58);
	if (leafy) return out(k, top);
	const sh = new Ink();
	const fl = new Ink();
	const eye = new Ink();
	B.forEach((p, bi) => {
		const [x0, y0] = p[3];
		const a = angAt(p, 1);
		const spots: Pt[] = [go(x0, y0, a, 2.5), go(x0, y0, a - 70, 5), go(x0, y0, a + 70, 5)];
		if (bi % 2 === 0) spots.push(bez(p, 0.82));
		spots.forEach(([x, y], i) => {
			const off = 45 + bi * 20 + i * 30;
			sh.spokes("#d4d2c0", 4, x + 0.4, y + 0.5, 4, 1.4, 2.4, off);
			fl.spokes("#fbfaf2", 3.8, x, y, 4, 1.3, 2.3, off);
			eye.dot("#e8c43a", x, y, 1.3);
		});
	});
	return out(k, sh, fl, eye);
}

/* ---------------------------------------------------------------- 6. Deutzia */

function deutzia(st: GrowingStage): string {
	const L: LeafSet = { fill: "#7aa063", alt: "#8eb174", rib: "#46653a", shape: 1 };
	const tw = "#8a6a50";
	if (st === "sprout") return sprout(tw, L, 15, 7.5, 2.4);
	const k = new Ink();
	const top = new Ink();
	const leafy = st === "leafy";
	const B: Br[] = leafy
		? [
				[[40, 87], [35, 72], [27, 64], [20, 62]],
				[[40, 87], [39, 70], [37, 58], [36, 50]],
				[[40, 87], [42, 70], [45, 58], [47, 50]],
				[[40, 87], [45, 72], [53, 64], [60, 62]],
			]
		: [
				[[40, 87], [32, 68], [18, 58], [9, 60]],
				[[40, 87], [36, 64], [28, 46], [20, 38]],
				[[40, 87], [40, 62], [39, 44], [37, 32]],
				[[40, 87], [43, 62], [48, 44], [55, 34]],
				[[40, 87], [48, 68], [62, 58], [71, 60]],
			];
	for (const p of B) k.stroke(tw, 1.6, bD(p));
	for (const p of B) pairsOn(k, leafy ? top : null, p, [0.35, 0.55, 0.75], 8, 2.5, L, 55);
	if (leafy) return out(k, top);
	const back = new Ink();
	const fl = new Ink();
	const bud = new Ink();
	B.forEach((p, bi) => {
		for (const t of [0.55, 0.95]) {
			const [x, y] = bez(p, t);
			const [cx, cy] = [x + (bi - 2) * 0.6, y - 5];
			k.stroke(tw, 0.7, lineD(x, y, cx, cy + 2));
			golden(7, cx, cy, 4.2, 4.4).forEach(([fx, fy], i) => {
				if (i === 6) {
					bud.dot("#d6799c", fx, fy - 1.5, 1.1);
					return;
				}
				back.dot("#dc98b2", fx + 0.3, fy + 0.4, 1.8);
				fl.dot("#fbf1f4", fx, fy, 1.4);
			});
		}
	});
	return out(k, top, back, fl, bud);
}

/* ---------------------------------------------------------------- 7. Snowball viburnum */

function snowball(st: GrowingStage): string {
	const lf = "#5c944c";
	const la = "#76aa60";
	const tw = "#7a6656";
	const k = new Ink();
	const lv = new Ink();
	if (st === "sprout") {
		k.stroke(tw, 1.6, lineD(40, 87, 40, 70));
		lv.fill(lf, lobedD(40, 78, -150, 7, 3, 0.4, 50) + lobedD(40, 78, -30, 7, 3, 0.4, 50)).fill(la, lobedD(40, 70, -90, 6, 3, 0.4, 50));
		return out(k, lv);
	}
	const leafy = st === "leafy";
	const B: Br[] = leafy
		? [
				[[40, 87], [36, 72], [28, 64], [22, 58]],
				[[40, 87], [40, 70], [40, 56], [40, 46]],
				[[40, 87], [44, 72], [52, 64], [58, 58]],
			]
		: [
				[[40, 87], [34, 70], [20, 62], [12, 54]],
				[[40, 87], [36, 64], [28, 46], [24, 34]],
				[[40, 87], [40, 62], [41, 38], [40, 22]],
				[[40, 87], [44, 64], [52, 46], [56, 34]],
				[[40, 87], [46, 70], [60, 62], [68, 54]],
			];
	for (const p of B) k.stroke(tw, 2, bD(p));
	B.forEach((p) => {
		for (const t of [0.4, 0.68]) {
			const [x, y] = bez(p, t);
			const b = angAt(p, t);
			lv.fill(lf, lobedD(x, y, b - 60, 7, 3, 0.4, 50)).fill(la, lobedD(x, y, b + 60, 7, 3, 0.4, 50));
		}
	});
	const balls = new Ink();
	const fl = new Ink();
	B.forEach((p) => {
		const [x, y] = p[3];
		const r = leafy ? 3.4 : 6.6;
		balls.dot(leafy ? "#a9c97c" : "#dfe6cc", x, y - r * 0.5, r);
		golden(leafy ? 5 : 12, x, y - r * 0.5, r * 0.75, r * 0.75).forEach(([fx, fy]) => fl.dot(leafy ? "#c6de9e" : "#fdfdf6", fx, fy, leafy ? 0.9 : 1.6));
	});
	return out(k, lv, balls, fl);
}

/* ---------------------------------------------------------------- 8. Smoke bush */

function smokeBush(st: GrowingStage): string {
	const c1 = "#6b2e4a";
	const c2 = "#8a4262";
	const tw = "#6a4a40";
	const L: LeafSet = { fill: c1, alt: c2, shape: 2, rib: "#3e1a2a" };
	if (st === "sprout") return sprout(tw, L, 15, 6.5, 3, false);
	const k = new Ink();
	const top = new Ink();
	const leafy = st === "leafy";
	const B: Br[] = leafy
		? [
				[[40, 87], [37, 74], [30, 64], [26, 56]],
				[[40, 87], [40, 70], [40, 58], [40, 46]],
				[[40, 87], [43, 74], [50, 64], [54, 56]],
			]
		: [
				[[40, 87], [38, 74], [28, 66], [18, 60]],
				[[40, 87], [38, 70], [32, 58], [28, 48]],
				[[40, 87], [40, 68], [41, 56], [42, 44]],
				[[40, 87], [42, 70], [49, 58], [54, 48]],
				[[40, 87], [42, 74], [52, 66], [62, 60]],
			];
	for (const p of B) k.stroke(tw, 2, bD(p));
	for (const p of B) leavesOn(k, leafy ? top : null, p, [0.35, 0.5, 0.65, 0.8, 0.92], leafy ? 6.5 : 7, 3.2, L, 60);
	if (leafy) return out(k, top);
	const smoke = new Ink();
	const core = new Ink();
	const hair = new Ink();
	const puffs: Pt[] = [[16, 50], [22, 40], [30, 32], [40, 28], [50, 31], [58, 39], [64, 50], [27, 46], [53, 45], [40, 38]];
	puffs.forEach(([x, y], i) => {
		let d = "";
		golden(5, x, y, 5, 4).forEach(([px, py], j) => (d += circD(px, py, 3 + ((i + j) % 3) * 0.5)));
		smoke.fill("#cf9db1", d, 0.55);
		if (i % 2 === 0) core.fill("#efd2dc", circD(x - 1, y - 1, 3.4), 0.4);
		for (let j = 0; j < 2; j++) {
			const a = Math.atan2(y - 60, x - 40) / RAD + (j - 0.5) * 40;
			const [sx, sy] = go(x, y, a, 4.5);
			hair.tick("#dcb0c0", 0.4, sx, sy, a + 15, 3.5);
		}
	});
	return out(k, top, smoke, core, hair);
}

/* ---------------------------------------------------------------- 9. Beautyberry */

function beautyberry(st: GrowingStage): string {
	const L: LeafSet = { fill: "#8fb35a", alt: "#a2c26e", rib: "#5a7a34", shape: 1 };
	const tw = "#8a7058";
	if (st === "sprout") return sprout(tw, L, 16, 8.5, 3.4);
	const k = new Ink();
	const top = new Ink();
	const leafy = st === "leafy";
	const B: Br[] = leafy
		? [
				[[40, 87], [36, 70], [28, 60], [21, 58]],
				[[40, 87], [40, 66], [41, 54], [42, 44]],
				[[40, 87], [44, 70], [52, 60], [59, 58]],
			]
		: [
				[[40, 87], [32, 64], [18, 50], [9, 54]],
				[[40, 87], [36, 58], [30, 40], [26, 28]],
				[[40, 87], [44, 58], [50, 40], [55, 28]],
				[[40, 87], [48, 64], [62, 50], [71, 54]],
			];
	for (const p of B) k.stroke(tw, 1.8, bD(p));
	const ts = leafy ? [0.45, 0.72] : [0.38, 0.6, 0.82];
	for (const p of B) pairsOn(k, top, p, ts, leafy ? 10 : 11, 3.8, L, 62);
	const fl = new Ink();
	const hi = new Ink();
	B.forEach((p) => {
		ts.forEach((t) => {
			const [x, y] = bez(p, t);
			if (leafy) {
				golden(4, x, y, 2, 2).forEach(([bx, by]) => fl.dot("#ebb7d8", bx, by, 1));
				return;
			}
			golden(9, x, y + 0.5, 3.6, 3.6).forEach(([bx, by], i) => {
				fl.dot(i % 4 === 3 ? "#8a2aa8" : "#a83ec6", bx, by, 1.45);
				hi.dot("#e2b4ef", bx - 0.5, by - 0.5, 0.4);
			});
		});
		k.fill(L.fill, leafD(p[3][0], p[3][1], angAt(p, 1), 6, 2.2, 1));
	});
	return out(k, top, fl, hi);
}

/* ---------------------------------------------------------------- 10. Bottlebrush */

function bottlebrush(st: GrowingStage): string {
	const L: LeafSet = { fill: "#6f8f5a", alt: "#86a46e", shape: 1 };
	const tw = "#7a5a44";
	if (st === "sprout") return sprout(tw, L, 16, 8, 1.6, false);
	const k = new Ink();
	const lv = new Ink();
	const leafy = st === "leafy";
	const B: Br[] = leafy
		? [
				[[40, 87], [40, 74], [34, 64], [28, 54]],
				[[40, 87], [40, 70], [41, 58], [41, 44]],
				[[40, 87], [40, 74], [47, 64], [53, 54]],
			]
		: [
				[[40, 87], [40, 70], [28, 60], [16, 50]],
				[[40, 87], [40, 64], [32, 44], [27, 26]],
				[[40, 87], [40, 62], [44, 40], [45, 16]],
				[[40, 87], [40, 66], [54, 50], [64, 38]],
			];
	B.forEach((p, i) => k.stroke(tw, i === 0 || leafy ? 1.8 : 2, bD(p)));
	const core = new Ink();
	const brush = new Ink();
	const tips = new Ink();
	B.forEach((p, bi) => {
		const leafTs = leafy ? [0.4, 0.55, 0.7, 0.85] : [0.3, 0.42, 0.88, 0.95];
		leafTs.forEach((t, i) => {
			const [x, y] = bez(p, t);
			const a = angAt(p, t) + (i % 2 ? 35 : -35);
			lv.fill((i + bi) % 2 ? L.fill : L.alt!, leafD(x, y, a, 8, 1.4, 1));
		});
		const [tx, ty] = p[3];
		lv.fill(L.fill, leafD(tx, ty, angAt(p, 1), 7, 1.3, 1));
		if (leafy) return;
		const [ax, ay] = bez(p, 0.52);
		const [bx, by] = bez(p, 0.84);
		core.stroke("#a81c2c", 5.5, lineD(ax, ay, bx, by));
		for (let i = 0; i < 22; i++) {
			const t = 0.5 + i * 0.016;
			const [x, y] = bez(p, t);
			const n = angAt(p, t) + 90 + (i % 2 ? 8 : -8);
			const [ux, uy] = go(x, y, n, 4.3);
			const [vx, vy] = go(x, y, n, -4.3);
			brush.stroke("#e0303e", 0.55, lineD(ux, uy, vx, vy));
			if (i % 2 === 0) tips.dot("#f2c84b", ux, uy, 0.45).dot("#f2c84b", vx, vy, 0.45);
		}
	});
	return out(k, lv, core, brush, tips);
}

/* ---------------------------------------------------------------- 11. Pieris */

function pieris(st: GrowingStage): string {
	const tw = "#6a5444";
	const k = new Ink();
	const lv = new Ink();
	const yl = new Ink();
	const greenTuft = (x: number, y: number, len: number, angs = [-170, -130, -90, -50, -10]) => {
		angs.forEach((a, i) => lv.fill(i % 2 ? "#3f7a46" : "#529054", leafD(x, y, a, len, len * 0.2, 1)));
	};
	const redTuft = (x: number, y: number, len: number) => {
		[-145, -118, -90, -62, -35].forEach((a, i) => yl.fill(i % 2 ? "#c2383a" : "#de6048", leafD(x, y, a, len * (i === 2 ? 1.1 : 0.95), len * 0.24, 0)));
	};
	if (st === "sprout") {
		k.stroke(tw, 1.6, lineD(40, 87, 40, 72));
		greenTuft(40, 79, 6);
		redTuft(40, 72, 6);
		return out(k, lv, yl);
	}
	const leafy = st === "leafy";
	const B: Br[] = leafy
		? [
				[[40, 87], [36, 76], [30, 68], [26, 62]],
				[[40, 87], [40, 72], [40, 62], [40, 52]],
				[[40, 87], [44, 76], [50, 68], [54, 62]],
			]
		: [
				[[40, 87], [36, 78], [24, 70], [16, 62]],
				[[40, 87], [38, 72], [32, 58], [27, 46]],
				[[40, 87], [40, 68], [41, 52], [41, 38]],
				[[40, 87], [42, 72], [48, 58], [54, 46]],
				[[40, 87], [44, 78], [56, 70], [64, 62]],
			];
	for (const p of B) k.stroke(tw, 1.8, bD(p));
	B.forEach((p, bi) => {
		const [mx, my] = bez(p, 0.55);
		greenTuft(mx, my, 8.5, [-160, -90, -20]);
		greenTuft(p[3][0], p[3][1] + 1.5, 9, [-175, -135, -45, -5]);
		if (!leafy || bi === 1) redTuft(p[3][0], p[3][1], 7.5);
	});
	if (leafy) return out(k, lv, yl);
	const stalk = new Ink();
	const bell = new Ink();
	B.forEach((p, bi) => {
		const [x, y] = p[3];
		const dir = x < 40 ? -1 : 1;
		[-3, 0, 3].forEach((dx, j) => {
			const n = 3 + ((j + bi) % 3);
			const pts: Pt[] = [];
			for (let m = 0; m <= n; m++) pts.push([x + dx + dir * Math.sin(m * 0.5) * 1.6, y + 2 + m * 2.6]);
			stalk.stroke("#9a6a52", 0.5, pts.map(([px, py], i) => `${i ? "L" : "M"}${f(px)} ${f(py)}`).join(""));
			pts.slice(1).forEach(([px, py]) => bell.dot("#f7f3ea", px, py + 0.6, 1.2));
		});
	});
	return out(k, lv, stalk, bell, yl);
}

/* ---------------------------------------------------------------- 12. Daphne */

function daphne(st: GrowingStage): string {
	const tw = "#6e5a4c";
	const k = new Ink();
	const rim = new Ink();
	const lv = new Ink();
	const vleaf = (x: number, y: number, a: number, len: number) => {
		rim.fill("#e8e2a4", leafD(x, y, a, len, len * 0.3));
		lv.fill("#4e8a4e", leafD(x, y, a, len * 0.88, len * 0.2));
	};
	if (st === "sprout") {
		k.stroke(tw, 1.5, lineD(40, 87, 40, 72));
		for (const a of [-150, -115, -65, -30]) vleaf(40, 72, a, 7);
		vleaf(40, 80, -160, 6);
		vleaf(40, 79, -20, 6);
		return out(k, rim, lv);
	}
	const leafy = st === "leafy";
	const B: Br[] = leafy
		? [
				[[40, 87], [37, 78], [31, 72], [27, 66]],
				[[40, 87], [40, 76], [40, 68], [40, 60]],
				[[40, 87], [43, 78], [49, 72], [53, 66]],
			]
		: [
				[[40, 87], [36, 80], [24, 72], [16, 66]],
				[[40, 87], [38, 76], [31, 62], [27, 52]],
				[[40, 87], [40, 74], [40, 58], [40, 46]],
				[[40, 87], [42, 76], [49, 62], [53, 52]],
				[[40, 87], [44, 80], [56, 72], [64, 66]],
			];
	for (const p of B) k.stroke(tw, 1.6, bD(p));
	B.forEach((p, bi) => {
		if (bi % 2 || leafy) {
			const [x, y] = bez(p, 0.55);
			const b = angAt(p, 0.55);
			vleaf(x, y, b - 55, 7.5);
			vleaf(x, y, b + 55, 7.5);
		}
		const [tx, ty] = p[3];
		for (const a of [-160, -90, -20]) vleaf(tx, ty + 1, a, 7.5);
	});
	if (leafy) {
		const bud = new Ink();
		for (const p of B) golden(4, p[3][0], p[3][1] - 2, 2, 1.6).forEach(([x, y]) => bud.dot("#b8457e", x, y, 1));
		return out(k, rim, lv, bud);
	}
	const back = new Ink();
	const fl = new Ink();
	const eye = new Ink();
	B.forEach((p, bi) => {
		const [x, y] = p[3];
		back.dot("#b8457e", x, y - 2.5, 5.4);
		golden(6, x, y - 3, 4, 3.4).forEach(([fx, fy], i) => {
			fl.spokes((i + bi) % 3 ? "#efb8d2" : "#f8dbe8", 1.5, fx, fy, 4, 0.4, 1.7, 45 + i * 10);
			eye.dot("#c25a8c", fx, fy, 0.45);
		});
	});
	return out(k, rim, lv, back, fl, eye);
}

/* ---------------------------------------------------------------- 13. Mountain laurel */

function pentD(x: number, y: number, r: number, off: number): string {
	const pts: Pt[] = [];
	for (let i = 0; i < 5; i++) pts.push(go(x, y, off + i * 72, r));
	return polyD(pts);
}

function mountainLaurel(st: GrowingStage): string {
	const tw = "#6e5646";
	const L: LeafSet = { fill: "#2f6b40", alt: "#3f7f4e", rib: "#1c4428", shape: 0 };
	if (st === "sprout") return sprout(tw, L, 15, 8, 2.6, false);
	const k = new Ink();
	const top = new Ink();
	const leafy = st === "leafy";
	const B: Br[] = leafy
		? [
				[[40, 87], [36, 76], [28, 68], [22, 62]],
				[[40, 87], [40, 72], [40, 62], [40, 52]],
				[[40, 87], [44, 76], [52, 68], [58, 62]],
			]
		: [
				[[40, 87], [36, 76], [22, 66], [13, 56]],
				[[40, 87], [38, 72], [30, 56], [26, 42]],
				[[40, 87], [40, 68], [41, 50], [42, 34]],
				[[40, 87], [42, 72], [50, 56], [55, 42]],
				[[40, 87], [44, 76], [58, 66], [67, 56]],
			];
	for (const p of B) k.stroke(tw, 1.9, bD(p));
	B.forEach((p) => {
		leavesOn(k, leafy ? top : null, p, [0.45, 0.62], 9, 2.8, L, 60, false);
		const [x, y] = p[3];
		const b = angAt(p, 1);
		for (const d of [-75, -40, 40, 75]) {
			k.fill(d % 3 ? L.fill : L.alt!, leafD(x, y + 1, b + d, 9.5, 2.8));
			if (leafy) top.stroke(L.rib!, 0.7, ribD(x, y + 1, b + d, 9.5), 0.6);
		}
	});
	const cup = new Ink();
	const dots = new Ink();
	const bud = new Ink();
	B.forEach((p, bi) => {
		const [x, y] = p[3];
		if (leafy) {
			golden(5, x, y - 2.5, 3, 2.4).forEach(([bx, by]) => bud.dot("#e07a9c", bx, by, 1.2));
			return;
		}
		golden(7, x, y - 3.5, 5.5, 4.6).forEach(([fx, fy], i) => {
			if (i === 6) {
				bud.dot("#e07a9c", fx, fy, 1.3);
				return;
			}
			cup.fill((i + bi) % 3 ? "#f6d6e2" : "#fbe8ef", pentD(fx, fy, 2.6, -90 + i * 17));
			for (let j = 0; j < 5; j++) {
				const [dx, dy] = go(fx, fy, -90 + i * 17 + j * 72 + 36, 1.4);
				dots.dot("#c23a5a", dx, dy, 0.32);
			}
		});
	});
	return out(k, top, cup, dots, bud);
}

/* ---------------------------------------------------------------- 14. Fuchsia */

function fuchsiaFlower(fl: Ink, x: number, y: number, s: number): void {
	fl.fill("#c8203c", ellD(x, y + 2 * s, 0.9 * s, 2.2 * s, 90));
	fl.fill("#d42a44", leafD(x, y + 4 * s, -158, 6 * s, 1.3 * s, 1) + leafD(x, y + 4 * s, -22, 6 * s, 1.3 * s, 1) + leafD(x, y + 4 * s, -120, 3.5 * s, 1 * s, 1) + leafD(x, y + 4 * s, -60, 3.5 * s, 1 * s, 1));
	fl.fill("#6a2a8a", `M${f(x - 2.4 * s)} ${f(y + 4 * s)}L${f(x + 2.4 * s)} ${f(y + 4 * s)}L${f(x + 3.2 * s)} ${f(y + 9.5 * s)}Q${f(x + 1.6 * s)} ${f(y + 8.5 * s)} ${f(x)} ${f(y + 10 * s)}Q${f(x - 1.6 * s)} ${f(y + 8.5 * s)} ${f(x - 3.2 * s)} ${f(y + 9.5 * s)}Z`);
	fl.stroke("#e0507a", 0.45, lineD(x - 0.8 * s, y + 9.5 * s, x - 1.2 * s, y + 13 * s) + lineD(x + 0.8 * s, y + 9.5 * s, x + 1.2 * s, y + 13 * s) + lineD(x, y + 10 * s, x, y + 14 * s));
}

function fuchsia(st: GrowingStage): string {
	const tw = "#8a3a3a";
	const L: LeafSet = { fill: "#4f8a46", alt: "#64a056", rib: "#7a2e2e", shape: 1 };
	if (st === "sprout") return sprout(tw, L, 15, 7, 2.8);
	const k = new Ink();
	const top = new Ink();
	const leafy = st === "leafy";
	const B: Br[] = leafy
		? [
				[[40, 87], [36, 70], [28, 60], [21, 60]],
				[[40, 87], [40, 66], [41, 54], [43, 46]],
				[[40, 87], [44, 70], [52, 60], [59, 60]],
			]
		: [
				[[40, 87], [34, 62], [22, 44], [11, 46]],
				[[40, 87], [38, 56], [34, 36], [28, 26]],
				[[40, 87], [42, 56], [48, 36], [55, 28]],
				[[40, 87], [46, 62], [58, 44], [69, 46]],
			];
	for (const p of B) k.stroke(tw, 1.6, bD(p));
	for (const p of B) pairsOn(k, top, p, leafy ? [0.4, 0.62, 0.84] : [0.3, 0.48, 0.66], 7.5, 3, L, 60);
	for (const p of B) k.fill(L.alt!, leafD(p[3][0], p[3][1], angAt(p, 1), 5, 2, 1));
	const fl = new Ink();
	const ped = new Ink();
	B.forEach((p, bi) => {
		const ts = leafy ? [0.84] : bi === 1 || bi === 2 ? [0.82] : [0.8, 0.98];
		for (const t of ts) {
			const [x, y] = bez(p, t);
			const hx = x + (x < 40 ? -1 : 1) * 1.2;
			const hy = y + 5;
			ped.stroke("#8a3a3a", 0.6, `M${f(x)} ${f(y)}Q${f(hx)} ${f(y + 1)} ${f(hx)} ${f(hy)}`);
			if (leafy) fl.fill("#c8203c", ellD(hx, hy + 2.2, 1.3, 2.4, 90));
			else fuchsiaFlower(fl, hx, hy, 1);
		}
	});
	return out(k, top, ped, fl);
}

/* ---------------------------------------------------------------- 15. Abelia */

function abelia(st: GrowingStage): string {
	const tw = "#8a5e48";
	const L: LeafSet = { fill: "#4f8a4a", alt: "#64a05a", shape: 1 };
	const bronze = "#a8643c";
	if (st === "sprout") return sprout(tw, { ...L, alt: bronze }, 14, 5.5, 2.2);
	const k = new Ink();
	const lv = new Ink();
	const leafy = st === "leafy";
	const tips: [number, number, number][] = leafy
		? [[-18, 62, 64], [-10, 52, 54], [-2, 46, 48], [6, 48, 50], [14, 54, 56], [20, 62, 64]]
		: [[-30, 56, 60], [-23, 40, 44], [-13, 28, 32], [-3, 22, 26], [8, 22, 26], [18, 28, 32], [26, 40, 44], [31, 56, 60]];
	const B: Br[] = tips.map(([dx, peak, end]) => [[40, 87], [40 + dx * 0.15, peak + 18], [40 + dx * 0.7, peak - 2], [40 + dx, end]] as Br);
	for (const p of B) k.stroke(tw, 1, bD(p));
	B.forEach((p, bi) => {
		for (let i = 0; i < 6; i++) {
			const t = 0.32 + i * 0.13;
			const [x, y] = bez(p, t);
			const b = angAt(p, t);
			const c = t > 0.9 ? bronze : (i + bi) % 2 ? L.fill : L.alt!;
			lv.tick(c, 2.2, x, y, b - 50, 3).tick(c, 2.2, x, y, b + 50, 3);
		}
	});
	if (leafy) return out(k, lv);
	const cal = new Ink();
	const fl = new Ink();
	B.forEach((p, bi) => {
		for (const t of [0.7, 0.98]) {
			const [x, y] = bez(p, t);
			for (const d of [-1, 1]) {
				const a = angAt(p, t) + d * 70 + (p[3][0] < 40 ? 25 : -25);
				const [bx, by] = go(x, y, a, 1.2);
				cal.dot("#c0605a", bx, by, 1.1);
				fl.fill((bi + d) % 2 ? "#fbeef2" : "#f3d3df", funnelD(bx, by, a, 4.6, 1.7));
			}
		}
	});
	return out(k, lv, fl, cal);
}

/* ---------------------------------------------------------------- 16. Shrubby cinquefoil */

function cinquefoil(st: GrowingStage): string {
	const tw = "#8a6a52";
	const g1 = "#6f9460";
	const g2 = "#8fb07a";
	const k = new Ink();
	const lv = new Ink();
	const tuft = (x: number, y: number, a: number, s = 1) => {
		lv.tick(g1, 1.3 * s, x, y, a - 30, 3.2 * s).tick(g2, 1.3 * s, x, y, a, 3.6 * s).tick(g1, 1.3 * s, x, y, a + 30, 3.2 * s);
	};
	if (st === "sprout") {
		k.stroke(tw, 1.3, lineD(40, 87, 40, 73));
		tuft(40, 73, -90, 1.2);
		tuft(40, 80, -150);
		tuft(40, 79, -30);
		return out(k, lv);
	}
	const leafy = st === "leafy";
	const cy = leafy ? 78 : 70;
	const rx = leafy ? 15 : 26;
	const ry = leafy ? 9 : 16;
	const dome = new Ink();
	const L0 = f(40 - rx * 0.7);
	const R0 = f(40 + rx * 0.7);
	dome.fill("#4e7446", `M${L0} 87C${f(40 - rx * 1.25)} ${f(cy + 4)} ${f(40 - rx * 0.85)} ${f(cy - ry - 2)} 40 ${f(cy - ry - 2)}C${f(40 + rx * 0.85)} ${f(cy - ry - 2)} ${f(40 + rx * 1.25)} ${f(cy + 4)} ${R0} 87Z`);
	golden(leafy ? 26 : 48, 40, cy, rx, ry).forEach(([x, y], i) => {
		const a = Math.atan2(y - 90, x - 40) / RAD;
		tuft(x, Math.min(y, 84), a + ((i * 37) % 40) - 20, 0.9);
	});
	if (leafy) {
		const bud = new Ink();
		golden(4, 40, cy - 2, rx * 0.7, ry * 0.6).forEach(([x, y]) => bud.dot("#e8d27a", x, y, 1.1));
		return out(dome, lv, bud);
	}
	const fl = new Ink();
	const fl2 = new Ink();
	const eye = new Ink();
	golden(15, 40, cy - 1, rx * 0.9, ry * 0.85).forEach(([x, y], i) => {
		(i % 3 ? fl : fl2).spokes(i % 3 ? "#f5c731" : "#f8d75a", 2.8, x, y, 5, 1, 1.9, -90 + i * 23);
		eye.dot("#d4921a", x, y, 0.8);
	});
	return out(k, dome, lv, fl, fl2, eye);
}

/* ---------------------------------------------------------------- 17. Summersweet */

function summersweet(st: GrowingStage): string {
	const tw = "#7a6450";
	const L: LeafSet = { fill: "#5a9650", alt: "#70aa62", rib: "#2f5a30", shape: 0 };
	if (st === "sprout") return sprout(tw, L, 16, 7.5, 3.2, false);
	const k = new Ink();
	const top = new Ink();
	const leafy = st === "leafy";
	const B: Br[] = leafy
		? [
				[[40, 87], [38, 74], [33, 62], [31, 52]],
				[[40, 87], [40, 72], [40, 58], [40, 46]],
				[[40, 87], [42, 74], [47, 62], [49, 52]],
			]
		: [
				[[40, 87], [36, 74], [24, 62], [18, 50]],
				[[40, 87], [38, 70], [31, 56], [29, 40]],
				[[40, 87], [40, 68], [40, 52], [40, 36]],
				[[40, 87], [42, 70], [49, 56], [51, 40]],
				[[40, 87], [44, 74], [56, 62], [62, 50]],
			];
	for (const p of B) k.stroke(tw, 1.7, bD(p));
	for (const p of B) leavesOn(k, top, p, [0.35, 0.5, 0.65, 0.8, 0.92], 8, 3.4, L, 58, false);
	const fl = new Ink();
	B.forEach((p, bi) => {
		const [x, y] = p[3];
		const a = -90 + (x - 40) * 0.35;
		const len = leafy ? 6 : bi === 2 ? 20 : 15;
		const n = leafy ? 4 : 11;
		k.stroke(tw, 0.8, lineD(x, y, ...go(x, y, a, len)));
		if (!leafy) k.fill("#d6cabd", polyD([go(x, y, a + 90, 2.6), go(x, y, a, len + 1.5), go(x, y, a - 90, 2.6)]));
		for (let i = 0; i < n; i++) {
			const u = i / (n - 1);
			const [px, py] = go(x, y, a, 1 + u * (len - 1));
			const r = Math.round((leafy ? 1.2 : 2.3) * (1 - 0.55 * u) * 4) / 4;
			fl.dot(leafy ? "#b8d49a" : i % 3 === 2 ? "#f2d4df" : "#f9f6ef", px + (i % 2 ? 0.7 : -0.7), py, r);
		}
	});
	return out(k, top, fl);
}

/* ---------------------------------------------------------------- 18. California lilac */

function ceanothus(st: GrowingStage): string {
	const tw = "#6a5a4a";
	const L: LeafSet = { fill: "#2f6a40", alt: "#3e7c4c", shape: 0 };
	if (st === "sprout") return sprout(tw, L, 14, 5, 2.4, false);
	const k = new Ink();
	const lv = new Ink();
	const leafy = st === "leafy";
	const B: Br[] = leafy
		? [
				[[40, 87], [34, 76], [24, 70], [18, 66]],
				[[40, 87], [38, 72], [34, 62], [32, 54]],
				[[40, 87], [42, 72], [46, 62], [48, 54]],
				[[40, 87], [46, 76], [56, 70], [62, 66]],
			]
		: [
				[[40, 87], [32, 78], [16, 72], [7, 66]],
				[[40, 87], [34, 70], [24, 56], [17, 46]],
				[[40, 87], [38, 66], [34, 50], [32, 36]],
				[[40, 87], [42, 66], [46, 50], [48, 36]],
				[[40, 87], [46, 70], [56, 56], [63, 46]],
				[[40, 87], [48, 78], [64, 72], [73, 66]],
			];
	for (const p of B) k.stroke(tw, 1.5, bD(p));
	B.forEach((p, bi) => {
		for (let i = 0; i < 11; i++) {
			const t = 0.25 + i * 0.072;
			const [x, y] = bez(p, t);
			lv.tick((i + bi) % 3 ? L.fill : L.alt!, 2.6, x, y, angAt(p, t) + (i % 2 ? 60 : -60), 2.4);
		}
	});
	if (leafy) return out(k, lv);
	const base = new Ink();
	const fl = new Ink();
	B.forEach((p, bi) => {
		for (const t of bi === 0 || bi === 5 ? [0.6, 0.95] : [0.5, 0.75, 1]) {
			const [x, y] = bez(p, t);
			const [cx, cy] = go(x, y, angAt(p, t) - 90 * (p[3][0] < 40 ? -1 : 1), 1.5);
			base.fill("#3e55b8", ellD(cx, cy, 3.4, 4.2, angAt(p, t)));
			golden(7, cx, cy, 2.8, 2.8).forEach(([fx, fy], i) => fl.dot(i % 2 ? "#6d86e0" : "#8aa0ec", fx, fy, 0.95));
		}
	});
	return out(k, lv, base, fl);
}

/* ---------------------------------------------------------------- 19. Japanese quince */

function japaneseQuince(st: GrowingStage): string {
	const wood = "#4e3428";
	const k = new Ink();
	const lv = new Ink();
	const L = "#6aa258";
	const zig = (pts: Pt[], w: number) => k.stroke(wood, w, pts.map(([x, y], i) => `${i ? "L" : "M"}${f(x)} ${f(y)}`).join(""));
	if (st === "sprout") {
		zig([[40, 87], [40, 80], [42, 74], [41, 69]], 1.6);
		lv.fill(L, leafD(40, 80, -150, 6.5, 2.2, 1) + leafD(42, 74, -30, 6.5, 2.2, 1) + leafD(41, 69, -100, 6, 2, 1));
		return out(k, lv);
	}
	const leafy = st === "leafy";
	const s = leafy ? 0.62 : 1;
	const T = (pts: Pt[]): Pt[] => pts.map(([x, y]) => [40 + (x - 40) * s, 87 - (87 - y) * s]);
	const branches: Pt[][] = [
		T([[40, 87], [34, 74], [26, 70], [20, 58], [12, 54]]),
		T([[36, 78], [34, 62], [28, 52], [30, 40], [24, 30]]),
		T([[40, 87], [42, 70], [38, 58], [44, 44], [42, 30], [46, 20]]),
		T([[42, 72], [50, 64], [52, 52], [60, 46], [62, 36]]),
		T([[40, 87], [48, 80], [58, 76], [64, 66], [72, 62]]),
	];
	branches.forEach((b, i) => zig(b, i % 2 ? 1.8 : 2.4));
	const thorn = new Ink();
	branches.forEach((b) => {
		for (let i = 1; i < b.length - 1; i++) {
			const [x, y] = b[i]!;
			thorn.stroke(wood, 0.8, lineD(x, y, x + (i % 2 ? 2.4 : -2.4), y - 1.6));
		}
	});
	if (leafy) {
		branches.forEach((b) => {
			for (let i = 1; i < b.length; i++) {
				const [x, y] = b[i]!;
				lv.fill(i % 2 ? L : "#82b46a", leafD(x, y, i % 2 ? -150 : -30, 6.5, 2, 1) + leafD(x, y, -90, 5.5, 1.8, 1));
			}
		});
		return out(k, thorn, lv);
	}
	const fl = new Ink();
	const fl2 = new Ink();
	const eye = new Ink();
	const young = new Ink();
	branches.forEach((b, bi) => {
		for (let i = 1; i < b.length; i++) {
			const [x0, y0] = b[i]!;
			const [x1, y1] = b[i - 1]!;
			if ((i + bi) % 2 === 0 || i === b.length - 1) {
				const x = x0 + (x1 - x0) * 0.4 + (i % 2 ? 1.6 : -1.6);
				const y = y0 + (y1 - y0) * 0.4 - 0.8;
				(i % 3 ? fl : fl2).spokes(i % 3 ? "#e0452f" : "#f06c4e", 2.6, x, y, 5, 0.9, 1.7, -90 + bi * 15);
				eye.dot("#f2c53a", x, y, 0.8);
			}
			if (i % 2 === 0) young.fill("#8a9a4a", leafD(x0, y0, i % 4 ? -60 : -120, 4, 1.4, 1));
		}
	});
	return out(k, thorn, young, fl, fl2, eye);
}

/* ---------------------------------------------------------------- 20. Kerria */

function kerria(st: GrowingStage): string {
	const cane = "#4f9a3a";
	const L: LeafSet = { fill: "#79b25e", alt: "#90c272", rib: "#3e6e2e", shape: 1 };
	if (st === "sprout") return sprout(cane, L, 16, 7.5, 2.6, false);
	const k = new Ink();
	const top = new Ink();
	const leafy = st === "leafy";
	const B: Br[] = leafy
		? [
				[[40, 87], [34, 66], [26, 56], [18, 58]],
				[[40, 87], [38, 64], [37, 52], [36, 44]],
				[[40, 87], [42, 64], [44, 52], [46, 44]],
				[[40, 87], [46, 66], [54, 56], [62, 58]],
			]
		: [
				[[40, 87], [30, 60], [16, 44], [7, 52]],
				[[40, 87], [35, 56], [28, 34], [18, 26]],
				[[40, 87], [40, 54], [40, 30], [37, 16]],
				[[40, 87], [45, 56], [52, 34], [62, 26]],
				[[40, 87], [50, 60], [64, 44], [73, 52]],
			];
	for (const p of B) k.stroke(cane, 1.5, bD(p));
	for (const p of B) leavesOn(k, leafy ? top : null, p, [0.3, 0.44, 0.58, 0.72, 0.86], 7, 2.6, L, 55, false);
	const fl = new Ink();
	const inner = new Ink();
	const eye = new Ink();
	B.forEach((p, bi) => {
		const ts = leafy ? [0.98] : [0.48, 0.72, 0.98];
		ts.forEach((t, i) => {
			const [x0, y0] = bez(p, t);
			const [x, y] = t > 0.9 ? [x0, y0] : go(x0, y0, angAt(p, t) - 90 * (p[3][0] < 40 ? -1 : 1), 2.5);
			if (leafy) {
				fl.dot("#e8c84a", x, y, 1.6);
				return;
			}
			fl.spokes("#eeaa16", 2.4, x, y, 7, 1.3, 2.5, bi * 10 + i * 20);
			inner.dot("#f8cf4a", x, y, 1.8);
			eye.dot("#e09a14", x, y, 0.7);
		});
	});
	return out(k, top, fl, inner, eye);
}

/* ---------------------------------------------------------------- 21. King protea */

function kingProtea(st: GrowingStage): string {
	const stemC = "#7a5040";
	const lf = "#6f9a72";
	const la = "#86ad86";
	const edge = "#b8505a";
	const k = new Ink();
	const lv = new Ink();
	const rim = new Ink();
	let flip = 0;
	const thick = (x: number, y: number, a: number, len: number) => {
		rim.fill(edge, leafD(x, y, a, len, len * 0.3));
		lv.fill(flip++ % 2 ? lf : la, leafD(x, y, a, len * 0.94, len * 0.24));
	};
	if (st === "sprout") {
		k.stroke(stemC, 2, lineD(40, 87, 40, 72));
		thick(40, 80, -140, 9);
		thick(40, 76, -40, 9);
		thick(40, 72, -90, 8);
		return out(k, rim, lv);
	}
	const leafy = st === "leafy";
	const topY = leafy ? 46 : 46;
	const stems: Br[] = [
		[[40, 87], [40, 74], [40, 60], [40, topY]],
		[[40, 87], [36, 78], [28, 72], [24, 64]],
		[[40, 87], [44, 78], [52, 72], [56, 64]],
	];
	stems.forEach((p, i) => k.stroke(stemC, i ? 2 : 2.8, bD(p)));
	[0.2, 0.36, 0.52, 0.68, 0.84].forEach((t, i) => {
		const [x, y] = bez(stems[0]!, t);
		thick(x, y, i % 2 ? -50 : -130, 11);
	});
	for (const p of stems.slice(1)) {
		const [x, y] = p[3];
		const a = angAt(p, 1);
		thick(x, y, a - 20, 10);
		thick(x, y, a + 20, 10);
		const [mx, my] = bez(p, 0.55);
		thick(mx, my, a + (x < 40 ? 50 : -50), 9);
	}
	const head = new Ink();
	if (leafy) {
		head.fill("#c4506e", leafD(40, topY + 1, -90, 13, 4.6, 1));
		head.fill("#e8a0ad", leafD(40, topY + 1, -104, 10, 2.4, 1) + leafD(40, topY + 1, -76, 10, 2.4, 1));
		return out(k, rim, lv, head);
	}
	const bx = 40;
	const by = 46;
	const outer = new Ink();
	const inner = new Ink();
	for (let i = 0; i < 9; i++) outer.fill("#c4506e", leafD(bx, by, -170 + i * 20, 24, 3.6, 1));
	const dome = new Ink();
	dome.fill("#f1e0d6", `M27 36Q26 18 40 17Q54 18 53 36Q40 41 27 36Z`);
	for (let i = 0; i < 8; i++) inner.fill(i % 2 ? "#e47a95" : "#ea8fa6", leafD(bx, by, -160 + i * 20 + 1.5, 19, 3.2, 1));
	const fuzz = new Ink();
	golden(12, 40, 26, 9, 6.5).forEach(([x, y]) => fuzz.dot("#d6bcb2", x, y, 0.75));
	return out(k, rim, lv, outer, dome, fuzz, inner);
}

/* ---------------------------------------------------------------- 22. Grevillea */

function grevillea(st: GrowingStage): string {
	const tw = "#7a5e4a";
	const needle = "#7f9e6e";
	const needle2 = "#98b486";
	const k = new Ink();
	const lv = new Ink();
	const sprig = (p: Br, n: number, len: number) => {
		for (let i = 0; i < n; i++) {
			const t = 0.3 + (0.7 * i) / n;
			const [x, y] = bez(p, t);
			const b = angAt(p, t);
			const [ax, ay] = go(x, y, b - 45, len);
			const [bx, by] = go(x, y, b + 45, len);
			lv.stroke(i % 2 ? needle : needle2, 0.9, lineD(x, y, ax, ay) + lineD(x, y, bx, by));
		}
		const [x, y] = p[3];
		lv.stroke(needle, 0.9, lineD(x, y, ...go(x, y, angAt(p, 1), len)));
	};
	if (st === "sprout") {
		const p: Br = [[40, 87], [40, 80], [41, 74], [41, 68]];
		k.stroke(tw, 1.4, bD(p));
		sprig(p, 5, 5);
		return out(k, lv);
	}
	const leafy = st === "leafy";
	const B: Br[] = leafy
		? [
				[[40, 87], [36, 72], [28, 64], [21, 62]],
				[[40, 87], [40, 70], [40, 58], [40, 46]],
				[[40, 87], [44, 72], [52, 64], [59, 62]],
			]
		: [
				[[40, 87], [34, 70], [22, 60], [14, 60]],
				[[40, 87], [36, 64], [28, 48], [22, 38]],
				[[40, 87], [40, 62], [40, 44], [40, 30]],
				[[40, 87], [44, 64], [52, 48], [58, 38]],
				[[40, 87], [46, 70], [58, 60], [66, 60]],
			];
	for (const p of B) k.stroke(tw, 1.5, bD(p));
	for (const p of B) sprig(p, 9, leafy ? 6 : 6.5);
	if (leafy) return out(k, lv);
	const flC = new Ink();
	const flD = new Ink();
	const tip = new Ink();
	B.forEach((p, bi) => {
		const ts = bi === 2 ? [0.95] : [0.62, 0.95];
		for (const t of ts) {
			const [x, y] = bez(p, t);
			const b = angAt(p, t);
			const side = p[3][0] < 40 ? -1 : 1;
			const axis = t > 0.9 ? b : b + side * -60;
			for (let j = 0; j < 6; j++) {
				const [sx, sy] = go(x, y, axis, 1 + j * 1.3);
				const up = axis - 90 * (side || 1);
				const [mx, my] = go(sx, sy, up, 4);
				const [ex, ey] = go(mx, my, up + side * 90, 2.6);
				(j % 2 ? flC : flD).stroke(j % 2 ? "#e0443e" : "#c4282e", 0.8, `M${f(sx)} ${f(sy)}Q${f(mx)} ${f(my)} ${f(ex)} ${f(ey)}`);
				tip.dot("#f4d36a", ex, ey, 0.55);
			}
			flD.fill("#c4282e", ellD(...go(x, y, axis, 4), 3.6, 1.4, axis));
		}
	});
	return out(k, lv, flD, flC, tip);
}

/* ---------------------------------------------------------------- 23. Leucadendron */

function leucadendron(st: GrowingStage): string {
	const stemC = "#7a4a3a";
	const k = new Ink();
	const lv = new Ink();
	const greens = ["#6f9a52", "#86ad66"];
	const reds = ["#b8323a", "#cf4a3e"];
	const clad = (p: Br, n: number, len: number, redFrom: number) => {
		for (let i = 0; i < n; i++) {
			const t = 0.15 + (0.85 * i) / n;
			const [x, y] = bez(p, t);
			const b = angAt(p, t);
			const cols = t > redFrom ? reds : t > redFrom - 0.15 ? ["#a8803e", "#b8903e"] : greens;
			lv.fill(cols[i % 2]!, leafD(x, y, b + (i % 2 ? 28 : -28), len, len * 0.24));
		}
	};
	if (st === "sprout") {
		const p: Br = [[40, 87], [40, 80], [40, 74], [40, 68]];
		k.stroke(stemC, 1.5, bD(p));
		clad(p, 6, 6.5, 2);
		return out(k, lv);
	}
	const leafy = st === "leafy";
	const B: Br[] = leafy
		? [
				[[40, 87], [38, 74], [33, 62], [31, 52]],
				[[40, 87], [40, 72], [40, 58], [40, 46]],
				[[40, 87], [42, 74], [47, 62], [49, 52]],
			]
		: [
				[[40, 87], [36, 74], [24, 60], [18, 46]],
				[[40, 87], [38, 70], [32, 48], [30, 30]],
				[[40, 87], [40, 66], [41, 42], [42, 22]],
				[[40, 87], [42, 70], [49, 48], [52, 32]],
				[[40, 87], [44, 74], [56, 60], [62, 46]],
			];
	for (const p of B) k.stroke(stemC, 1.6, bD(p));
	for (const p of B) clad(p, leafy ? 9 : 11, leafy ? 7 : 8, leafy ? 0.9 : 0.72);
	const cup = new Ink();
	const cupIn = new Ink();
	const cone = new Ink();
	B.forEach((p) => {
		const [x, y] = p[3];
		const a = angAt(p, 1);
		if (leafy) {
			cup.fill(reds[1]!, leafD(x, y + 1, a, 5, 2.2));
			return;
		}
		cup.fill("#a82a32", leafD(x, y + 2, a - 32, 9.5, 3.8, 2) + leafD(x, y + 2, a + 32, 9.5, 3.8, 2));
		cupIn.fill("#d4483c", leafD(x, y + 2, a - 14, 9, 3.3, 2) + leafD(x, y + 2, a + 14, 9, 3.3, 2));
		const [cx, cy] = go(x, y, a, 4);
		cone.fill("#6a3a24", ellD(cx, cy, 2.6, 1.9, a));
		cone.fill("#8a5634", ellD(cx - 0.4, cy - 0.4, 1.2, 0.9, a));
	});
	return out(k, lv, cup, cupIn, cone);
}

/* ---------------------------------------------------------------- 24. Banksia */

function sawD(x: number, y: number, a: number, len: number, w: number): string {
	const P = rot(x, y, a);
	const n = 5;
	let d = `M${P(0, 0)}`;
	for (let i = 1; i <= n; i++) {
		const u = (len * i) / n;
		const hw = w * Math.pow(Math.sin((Math.PI * Math.min(u, len * 0.98)) / len), 0.5);
		d += `L${P(u - len / n / 2, -hw * 0.55)}L${P(u, i === n ? 0 : -hw)}`;
	}
	for (let i = n - 1; i >= 0; i--) {
		const u = (len * i) / n;
		const hw = w * Math.pow(Math.sin((Math.PI * Math.max(u, len * 0.02)) / len), 0.5);
		d += `L${P(u + len / n / 2, hw * 0.55)}L${P(u, i === 0 ? 0 : hw)}`;
	}
	return d + "Z";
}

function banksia(st: GrowingStage): string {
	const tw = "#6a5446";
	const dk = "#4f7a4a";
	const lt = "#6a9262";
	const k = new Ink();
	const lv = new Ink();
	if (st === "sprout") {
		k.stroke(tw, 1.6, lineD(40, 87, 40, 72));
		lv.fill(dk, sawD(40, 78, -150, 10, 1.8) + sawD(40, 72, -95, 9, 1.8)).fill(lt, sawD(40, 75, -30, 10, 1.8));
		return out(k, lv);
	}
	const leafy = st === "leafy";
	const B: Br[] = leafy
		? [
				[[40, 87], [38, 74], [32, 64], [28, 56]],
				[[40, 87], [40, 72], [40, 60], [40, 48]],
				[[40, 87], [42, 74], [48, 64], [52, 56]],
			]
		: [
				[[40, 87], [38, 74], [26, 64], [18, 56]],
				[[40, 87], [38, 70], [31, 56], [28, 44]],
				[[40, 87], [40, 68], [43, 54], [45, 40]],
				[[40, 87], [42, 72], [54, 62], [62, 54]],
			];
	for (const p of B) k.stroke(tw, 2.2, bD(p));
	B.forEach((p, bi) => {
		const [x, y] = p[3];
		[-95, -50, 50, 95].forEach((d, i) => lv.fill((i + bi) % 2 ? dk : lt, sawD(x, y + 1, angAt(p, 1) + d, 11, 1.9)));
		const [mx, my] = bez(p, 0.55);
		lv.fill(dk, sawD(mx, my, angAt(p, 0.55) + (bi % 2 ? 60 : -60), 10, 1.8));
	});
	if (leafy) {
		const bud = new Ink();
		for (const p of B) bud.fill("#b8a46a", ellD(p[3][0], p[3][1] - 4, 1.8, 3.8, 0));
		return out(k, lv, bud);
	}
	const spike = new Ink();
	const rows = new Ink();
	const styles = new Ink();
	B.forEach((p, bi) => {
		const [x, y0] = p[3];
		const old = bi === 0;
		const h = 15;
		const yb = y0 + 1;
		const yt = yb - h;
		spike.fill(old ? "#7a6a58" : "#e89a2c", `M${f(x - 3.6)} ${f(yb)}L${f(x - 3.8)} ${f(yt + 3)}Q${f(x)} ${f(yt - 2)} ${f(x + 3.8)} ${f(yt + 3)}L${f(x + 3.6)} ${f(yb)}Q${f(x)} ${f(yb + 1.5)} ${f(x - 3.6)} ${f(yb)}Z`);
		for (let j = 0; j < 6; j++) {
			const yy = yb - 1.5 - j * 2.3;
			for (const dx of j % 2 ? [-2.2, 0, 2.2] : [-1.1, 1.1, 3]) {
				if (Math.abs(dx) > 3.2) continue;
				rows.dot(old ? "#4a3e34" : "#b8641a", x + dx, yy, 0.6);
			}
			if (!old && j > 2) styles.dot("#f6d26a", x + (j % 2 ? 1.1 : -1.1), yy - 1, 0.55);
		}
	});
	return out(k, lv, spike, rows, styles);
}

/* ---------------------------------------------------------------- 25. Angel's trumpet */

function trumpetHangD(x: number, y: number, len: number, w: number, lean: number): string {
	const P = rot(x, y, 90 + lean);
	return `M${P(0, -0.8)}Q${P(len * 0.6, -1.2)} ${P(len * 0.82, -w * 0.55)}Q${P(len * 0.95, -w)} ${P(len * 1.05, -w * 1.15)}Q${P(len * 0.98, -w * 0.4)} ${P(len * 1.08, 0)}Q${P(len * 0.98, w * 0.4)} ${P(len * 1.05, w * 1.15)}Q${P(len * 0.95, w)} ${P(len * 0.82, w * 0.55)}Q${P(len * 0.6, 1.2)} ${P(0, 0.8)}Z`;
}

function angelsTrumpet(st: GrowingStage): string {
	const trunk = "#8a7a62";
	const L: LeafSet = { fill: "#5f9a50", alt: "#76ad62", rib: "#335c2c", shape: 0 };
	if (st === "sprout") return sprout(trunk, L, 15, 9, 4, false);
	const k = new Ink();
	const top = new Ink();
	const leafy = st === "leafy";
	k.stroke(trunk, leafy ? 2.4 : 3, lineD(40, 87, 40, leafy ? 62 : 52));
	const B: Br[] = leafy
		? [
				[[40, 62], [38, 56], [32, 52], [26, 50]],
				[[40, 62], [40, 54], [41, 48], [41, 42]],
				[[40, 62], [42, 56], [48, 52], [54, 50]],
			]
		: [
				[[40, 52], [36, 44], [26, 38], [16, 38]],
				[[40, 52], [38, 40], [32, 30], [26, 22]],
				[[40, 52], [41, 40], [44, 28], [48, 18]],
				[[40, 52], [44, 44], [54, 38], [64, 38]],
			];
	for (const p of B) k.stroke(trunk, 1.8, bD(p));
	for (const p of B) leavesOn(k, top, p, [0.35, 0.6, 0.85], leafy ? 11 : 12, 4.4, L, 70);
	if (leafy) {
		const bud = new Ink();
		bud.fill("#cfd8a8", trumpetHangD(26, 51, 7, 1.2, 8) + trumpetHangD(54, 51, 7, 1.2, -8));
		return out(k, top, bud);
	}
	const fl = new Ink();
	const sh = new Ink();
	const cal = new Ink();
	const spots: [number, number, number, number][] = [
		[18, 39, 6, 22],
		[28, 33, 2, 24],
		[38, 34, -2, 22],
		[50, 31, -4, 24],
		[62, 39, -6, 22],
	];
	spots.forEach(([x, y, lean, len], i) => {
		sh.fill("#e8a878", trumpetHangD(x + 0.6, y, len, 4.6, lean));
		fl.fill(i % 2 ? "#f7e2c4" : "#f4c79a", trumpetHangD(x, y, len, 4.2, lean));
		cal.fill("#9fb878", trumpetHangD(x, y - 1, 7, 1.4, lean));
	});
	return out(k, top, sh, fl, cal);
}

/* ---------------------------------------------------------------- registry */

const ALL: [string, (st: GrowingStage) => string][] = [
	["Butterfly bush", butterflyBush],
	["Rose of Sharon", roseOfSharon],
	["Weigela", weigela],
	["Bridal wreath spirea", spirea],
	["Mock orange", mockOrange],
	["Deutzia", deutzia],
	["Snowball viburnum", snowball],
	["Smoke bush", smokeBush],
	["Beautyberry", beautyberry],
	["Bottlebrush", bottlebrush],
	["Pieris", pieris],
	["Daphne", daphne],
	["Mountain laurel", mountainLaurel],
	["Fuchsia", fuchsia],
	["Abelia", abelia],
	["Shrubby cinquefoil", cinquefoil],
	["Summersweet", summersweet],
	["California lilac", ceanothus],
	["Japanese quince", japaneseQuince],
	["Kerria", kerria],
	["King protea", kingProtea],
	["Grevillea", grevillea],
	["Leucadendron", leucadendron],
	["Banksia", banksia],
	["Angel's trumpet", angelsTrumpet],
];

export const SPECIES: Species[] = ALL.map(([name, draw]) => ({
	id: name
		.toLowerCase()
		.normalize("NFD")
		.replace(/[̀-ͯ']/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, ""),
	name,
	draw,
}));
