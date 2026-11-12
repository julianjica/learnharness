/**
 * Garden species: herbs and vegetables (25). Drawn in the kit's flat style;
 * see kit.ts for the cell, the ground line and the shared shapes.
 */
import { BARK, bez, blade, circle, f, leaf, leafPath, line, petals, stem, type GrowingStage, type LeafOptions, type Pt, type Species } from "./kit";

type St = GrowingStage;
type Cubic = readonly [Pt, Pt, Pt, Pt];
const D = Math.PI / 180;
type P3 = [number, number, number?];
type T3 = [number, number, number];
type T4 = [number, number, number, number];

const by = <T>(st: St, a: T, b: T, c: T): T => (st === "sprout" ? a : st === "leafy" ? b : c);

function ell(cx: number, cy: number, rx: number, ry: number, fill: string, rot = 0): string {
	return `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}" fill="${fill}"${rot ? ` transform="rotate(${f(rot)} ${f(cx)} ${f(cy)})"` : ""}/>`;
}

/** Many circles, drawn as zero-length round-capped strokes (one path per radius): [x, y, r?]. */
function dots(pts: readonly (readonly [number, number, number?])[], fill: string, r = 1): string {
	const byR = new Map<string, string>();
	for (const p of pts) {
		const w = f(2 * (p[2] ?? r));
		byR.set(w, (byR.get(w) ?? "") + `M${f(p[0])} ${f(p[1])}h0`);
	}
	let s = "";
	for (const [w, d] of byR) s += `<path d="${d}" stroke="${fill}" stroke-width="${w}" stroke-linecap="round"/>`;
	return s;
}

/** n stadium-shaped petals (round-capped strokes) radiating from (x, y), from r0 to r1, width w. */
function rays(x: number, y: number, n: number, r0: number, r1: number, w: number, stroke: string, offsetDeg = 0): string {
	let d = "";
	for (let i = 0; i < n; i++) {
		const a = offsetDeg + (i * 360) / n;
		const [ax, ay] = polar(x, y, a, r0);
		const [bx, by2] = polar(x, y, a, r1);
		d += `M${f(ax)} ${f(ay)}L${f(bx)} ${f(by2)}`;
	}
	return `<path d="${d}" stroke="${stroke}" stroke-width="${f(w)}" stroke-linecap="round"/>`;
}

/** Many straight strokes as one path: [x1, y1, x2, y2]. */
function segs(list: readonly (readonly [number, number, number, number])[], stroke: string, w: number): string {
	let d = "";
	for (const [a, b, c, e] of list) d += `M${f(a)} ${f(b)}L${f(c)} ${f(e)}`;
	return `<path d="${d}" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round" fill="none"/>`;
}

function g(x: number, y: number, rot: number, inner: string, scale = 1): string {
	return `<g transform="translate(${f(x)} ${f(y)})${rot ? ` rotate(${f(rot)})` : ""}${scale !== 1 ? ` scale(${f(scale)})` : ""}">${inner}</g>`;
}

/** Control points of kit leaf shapes 0, 1, 2, 4 as [c1, c2, tip, c3, c4] in (len, w) units. */
const SHAPES: Record<0 | 1 | 2 | 4, readonly (readonly [number, number])[]> = {
	0: [[0.3, -1], [0.8, -1], [1, 0], [0.8, 1], [0.3, 1]],
	1: [[0.45, -1.15], [0.8, -0.5], [1, 0], [0.8, 0.5], [0.45, 1.15]],
	2: [[0.05, -1.4], [1.02, -1.3], [1, 0], [1.02, 1.3], [0.05, 1.4]],
	4: [[0.1, -1.6], [0.75, -1.2], [1, 0], [0.75, 1.2], [0.1, 1.6]],
};

/**
 * Collects many leaves (same outlines as the kit's leaf()) into one path per
 * fill plus one rib path per colour, which keeps busy plants' markup small.
 */
class Leaves {
	private fills = new Map<string, string>();
	private ribs = new Map<string, string>();
	add(x: number, y: number, angle: number, len: number, w: number, o: LeafOptions = {}): this {
		const { fill = "#6fb35a", dark = "#3f7a35", shape = 0, rib = true } = o;
		const c = Math.cos(angle * D);
		const sn = Math.sin(angle * D);
		const pt = (u: number, v: number) => `${f(x + u * c - v * sn)} ${f(y + u * sn + v * c)}`;
		const k = SHAPES[shape === 3 ? 1 : shape].map(([u, v]) => pt(u * len, v * w));
		this.fills.set(fill, (this.fills.get(fill) ?? "") + `M${pt(0, 0)}C${k[0]} ${k[1]} ${k[2]}C${k[3]} ${k[4]} ${pt(0, 0)}Z`);
		if (rib) this.ribs.set(dark, (this.ribs.get(dark) ?? "") + `M${pt(1, 0)}L${pt(len * 0.8, 0)}`);
		return this;
	}
	/** Opposite pairs along a stem. */
	pairs(P: Cubic, ts: number[], len: number[], w: number[], spread: number[], o: LeafOptions): this {
		ts.forEach((t, i) => {
			const [x, y] = bez(P, t);
			const a = dirAt(P, t);
			this.add(x, y, a - spread[i]!, len[i]!, w[i]!, o).add(x, y, a + spread[i]!, len[i]!, w[i]!, o);
		});
		return this;
	}
	toString(): string {
		let s = "";
		for (const [fill, d] of this.fills) s += `<path d="${d}" fill="${fill}"/>`;
		for (const [dark, d] of this.ribs) s += `<path d="${d}" stroke="${dark}" stroke-width=".9" stroke-linecap="round" opacity=".55" fill="none"/>`;
		return s;
	}
}

/** Direction of a cubic at t, in degrees. */
function dirAt(P: Cubic, t: number): number {
	const [x0, y0] = bez(P, Math.max(0, t - 0.02));
	const [x1, y1] = bez(P, Math.min(1, t + 0.02));
	return Math.atan2(y1 - y0, x1 - x0) / D;
}

/** Opposite leaf pairs along a stem. */
function pairs(P: Cubic, ts: number[], len: number[], w: number[], spread: number[], o: LeafOptions): string {
	let s = "";
	ts.forEach((t, i) => {
		const [x, y] = bez(P, t);
		const a = dirAt(P, t);
		s += leaf(x, y, a - spread[i]!, len[i]!, w[i]!, o) + leaf(x, y, a + spread[i]!, len[i]!, w[i]!, o);
	});
	return s;
}

/** A feathery stroked spray: a rachis with short leaflet strokes on both sides. */
function pinnate(x: number, y: number, deg: number, len: number, bend: number, leaflet: number, stroke: string, width: number, n = 10, fan = 55): string {
	let a = deg * D;
	let px = x;
	let py = y;
	const step = len / n;
	let d = `M${f(x)} ${f(y)}`;
	let side = "";
	for (let j = 1; j <= n; j++) {
		a += (bend * D) / n;
		px += Math.cos(a) * step;
		py += Math.sin(a) * step;
		d += `L${f(px)} ${f(py)}`;
		if (j >= 2) {
			const l = (1 - j / (n + 2)) * leaflet + 1;
			for (const sg of [-1, 1]) {
				const b = a + sg * fan * D;
				side += `M${f(px)} ${f(py)}l${f(Math.cos(b) * l)} ${f(Math.sin(b) * l)}`;
			}
		}
	}
	return `<path d="${d}${side}" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
}

/** A point at distance r from (x, y) along deg. */
const polar = (x: number, y: number, deg: number, r: number): [number, number] => [x + Math.cos(deg * D) * r, y + Math.sin(deg * D) * r];

// ── 1. Basil ────────────────────────────────────────────────────────────
const BAS = { leaf: "#58ab45", light: "#7cc25c", dark: "#2f7430", stem: "#3e8536", flower: "#f1ece0" };
function basilSpike(x: number, y: number, len: number): string {
	const pts: P3[] = [];
	const cal: P3[] = [];
	for (let k = 0; k < 5; k++) {
		const yy = y - 1.5 - (k * len) / 5;
		const r = 1.9 - k * 0.22;
		pts.push([x - r, yy, r * 0.9], [x + r, yy, r * 0.9]);
		cal.push([x - r * 0.7, yy + 1, r * 0.6], [x + r * 0.7, yy + 1, r * 0.6]);
	}
	pts.push([x, y - len, 0.9]);
	return line(x, y, x, y - len, BAS.stem, 1.2) + dots(cal, BAS.dark) + dots(pts, BAS.flower);
}
function basil(st: St): string {
	const o: LeafOptions = { fill: BAS.leaf, dark: BAS.dark, shape: 1 };
	const ol: LeafOptions = { fill: BAS.light, dark: BAS.dark, shape: 1 };
	if (st === "sprout")
		return stem([[40, 87], [40, 82], [40, 77], [40, 71]], BAS.stem, 2) + leaf(40, 72, -162, 8.5, 5, { ...o, rib: false }) + leaf(40, 72, -18, 8.5, 5, { ...o, rib: false }) + leaf(40, 71, -114, 5.5, 3, { ...ol, rib: false }) + leaf(40, 71, -66, 5.5, 3, { ...ol, rib: false });
	if (st === "leafy") {
		const P: Cubic = [[40, 87], [40, 72], [41, 56], [40, 42]];
		return stem(P, BAS.stem, 2.4) + pairs(P, [0.3, 0.56], [16, 14], [7, 6.2], [76, 64], o) + pairs(P, [0.8], [11], [5], [52], ol) + leaf(40, 43, -118, 8, 4, ol) + leaf(40, 43, -62, 8, 4, ol);
	}
	const P: Cubic = [[40, 87], [40, 68], [41, 48], [40, 32]];
	const L: Cubic = [[40, 70], [34, 63], [28, 57], [26, 46]];
	const R: Cubic = [[40, 66], [46, 59], [53, 53], [55, 42]];
	return (
		stem(L, BAS.stem, 1.8) +
		stem(R, BAS.stem, 1.8) +
		stem(P, BAS.stem, 2.6) +
		pairs(P, [0.18, 0.38], [17, 15], [7.4, 6.6], [80, 72], o) +
		pairs(L, [0.6], [11], [5], [62], ol) +
		pairs(R, [0.6], [11], [5], [62], ol) +
		pairs(P, [0.72], [10], [4.6], [58], ol) +
		basilSpike(40, 32, 14) +
		basilSpike(26, 46, 10) +
		basilSpike(55, 42, 10)
	);
}

// ── 2. Mint ─────────────────────────────────────────────────────────────
const MINT = { leaf: "#4e9f72", light: "#72bd8f", dark: "#2b6847", stem: "#6a4f6c", fl: "#c9a7e6", fl2: "#ab88d8" };
/** One mint stem: its stroke into `out[0]`, leaves into `L`, the flower spike into `out[1]`. */
function mintStem(P: Cubic, n: number, len0: number, flower: boolean, L: Leaves, out: [string, string]): void {
	out[0] += stem(P, MINT.stem, 1.7);
	for (let i = 0; i < n; i++) {
		const t = n === 1 ? 0.6 : 0.28 + (0.55 * i) / (n - 1);
		const len = len0 * (1 - 0.35 * (i / Math.max(1, n - 1)));
		L.pairs(P, [t], [len], [len * 0.42], [62], { fill: i % 2 ? MINT.light : MINT.leaf, dark: MINT.dark, shape: 1 });
	}
	const [x, y] = P[3];
	if (!flower) {
		L.add(x, y, -120, 5, 2.2, { fill: MINT.light, shape: 1, rib: false }).add(x, y, -60, 5, 2.2, { fill: MINT.light, shape: 1, rib: false });
		return;
	}
	const a: P3[] = [];
	const b: P3[] = [];
	for (let k = 0; k < 5; k++) (k % 2 ? b : a).push([x, y - k * 2.4, 2.7 - k * 0.38]);
	out[1] += dots(a, MINT.fl2) + dots(b, MINT.fl);
}
function mint(st: St): string {
	const L = new Leaves();
	const out: [string, string] = ["", ""];
	const stems = by<[Cubic, number, number, boolean][]>(
		st,
		[[[[40, 87], [40, 81], [40, 76], [40, 69]], 1, 9, false]],
		[
			[[[40, 87], [38, 72], [33, 62], [30, 50]], 2, 10, false],
			[[[40, 87], [43, 72], [48, 64], [51, 54]], 2, 9, false],
			[[[40, 87], [40, 72], [40, 58], [40, 43]], 3, 10, false],
		],
		[
			[[[40, 87], [36, 72], [27, 62], [23, 44]], 3, 9.5, true],
			[[[40, 87], [44, 72], [53, 62], [57, 42]], 3, 9.5, true],
			[[[40, 87], [39, 70], [34, 50], [33, 30]], 4, 10, true],
			[[[40, 87], [41, 70], [46, 50], [47, 28]], 4, 10, true],
		],
	);
	for (const [P, n, l, fl] of stems) mintStem(P, n, l, fl, L, out);
	return out[0] + L + out[1];
}

// ── 3. Rosemary ─────────────────────────────────────────────────────────
const ROS = { stem: "#7a6650", n1: "#4b7859", n2: "#6c9877", fl: "#9fbaf0" };
function rosemary(st: St): string {
	const stems: Cubic[] = by<Cubic[]>(
		st,
		[[[40, 87], [40, 80], [40, 74], [40, 68]]],
		[
			[[40, 87], [38, 74], [33, 60], [31, 48]],
			[[40, 87], [40, 72], [41, 56], [41, 40]],
			[[40, 87], [42, 74], [48, 62], [51, 50]],
		],
		[
			[[40, 87], [36, 76], [26, 58], [22, 40]],
			[[40, 87], [38, 70], [33, 46], [32, 24]],
			[[40, 87], [40, 68], [42, 40], [42, 16]],
			[[40, 87], [42, 70], [50, 48], [52, 26]],
			[[40, 87], [44, 76], [55, 60], [59, 42]],
		],
	);
	const a: T4[] = [];
	const b: T4[] = [];
	const fl: P3[] = [];
	let s = "";
	for (const P of stems) {
		s += stem(P, ROS.stem, 1.6);
		const n = st === "sprout" ? 6 : 13;
		const nl = st === "sprout" ? 5 : 6;
		for (let i = 0; i < n; i++) {
			const t = 0.12 + (0.88 * i) / (n - 1);
			const [x, y] = bez(P, t);
			const dir = dirAt(P, t);
			const l = nl * (1 - 0.45 * t);
			for (const sg of [-1, 1]) {
				const [ex, ey] = polar(x, y, dir + sg * 52, l);
				(i % 2 ? a : b).push([x, y, ex, ey]);
				if (st === "bloom" && t > 0.35 && (i + (sg > 0 ? 1 : 0)) % 3 === 0) fl.push([ex, ey, 1.4]);
			}
		}
	}
	return s + segs(a, ROS.n1, 1.4) + segs(b, ROS.n2, 1.4) + (fl.length ? dots(fl, ROS.fl) : "");
}

// ── 4. Thyme ────────────────────────────────────────────────────────────
const THY = { stem: "#86705f", leaf: "#7c9d69", light: "#a2bc8c", fl: "#dc9fc9", fl2: "#c07fb1" };
const THY_J = [0.92, 0.78, 1, 0.84, 0.96, 0.74, 0.9, 1, 0.8, 0.88, 0.95];
function thyme(st: St): string {
	const n = by(st, 4, 8, 11);
	const L = by(st, 13, 30, 40);
	let s = "";
	const la: P3[] = [];
	const lb: P3[] = [];
	const fa: P3[] = [];
	const fb: P3[] = [];
	for (let i = 0; i < n; i++) {
		const u = i / (n - 1);
		const j = THY_J[i % THY_J.length]!;
		const len = L * j * (0.7 + 0.3 * Math.sin(u * Math.PI));
		const ex = 40 + (u - 0.5) * L * 1.25 + (j - 0.87) * 8;
		const ey = 86 - len;
		const bx = 40 + (u - 0.5) * 4;
		const P: Cubic = [[bx, 86], [bx + (ex - bx) * 0.75, 85], [ex - (ex - bx) * 0.05, ey + len * 0.45], [ex, ey]];
		s += stem(P, THY.stem, 0.9);
		for (let k = 0; k < 6; k++) {
			const t = 0.3 + k * 0.12;
			const [x, y] = bez(P, t);
			const dir = dirAt(P, t);
			for (const sg of [-1, 1]) {
				const [lx, ly] = polar(x, y, dir + sg * 70, 1.5);
				(k % 2 ? la : lb).push([lx, ly, 1.15]);
			}
		}
		if (st === "bloom") {
			for (let k = 0; k < 4; k++) {
				const [fx, fy] = polar(ex, ey + 1.5, -90 + (k - 1.5) * 55, 2);
				(k % 2 ? fa : fb).push([fx, fy, 1.5]);
			}
			fa.push([ex, ey - 1.6, 1.4]);
		}
	}
	return s + dots(la, THY.leaf) + dots(lb, THY.light) + (st === "bloom" ? dots(fa, THY.fl) + dots(fb, THY.fl2) : "");
}

// ── 5. Sage ─────────────────────────────────────────────────────────────
const SAGE = { leaf: "#98b494", light: "#b3c9ad", rib: "#5f7f5c", stem: "#7b8f76", fl: "#7f62cf", fl2: "#a58ae6" };
/** A sage flower stalk: tiers of hooded flowers into `L` and `d`. */
function sageSpike(P: Cubic, tiers: number, L: Leaves, d: P3[]): string {
	for (let k = 0; k < tiers; k++) {
		const [x, y] = bez(P, 1 - k * (0.5 / tiers));
		const sz = 1 - k * 0.08;
		L.add(x, y, -158, 5.2 * sz, 2.2 * sz, { fill: SAGE.fl, shape: 1, rib: false }).add(x, y, -22, 5.2 * sz, 2.2 * sz, { fill: SAGE.fl, shape: 1, rib: false });
		d.push([x, y - 0.8, 1.5 * sz]);
	}
	return stem(P, SAGE.stem, 1.4);
}
function sage(st: St): string {
	const o: LeafOptions = { fill: SAGE.leaf, dark: SAGE.rib };
	const ol: LeafOptions = { fill: SAGE.light, dark: SAGE.rib };
	if (st === "sprout") return stem([[40, 87], [40, 82], [40, 78], [40, 74]], SAGE.stem, 1.8) + leaf(40, 76, -155, 12, 4.6, o) + leaf(40, 76, -25, 12, 4.6, ol) + leaf(40, 74, -98, 7, 2.8, ol);
	const base =
		stem([[40, 87], [38, 76], [33, 70], [30, 62]], SAGE.stem, 1.8) +
		stem([[40, 87], [42, 76], [47, 68], [50, 60]], SAGE.stem, 1.8) +
		leaf(36, 80, -172, 17, 6.4, o) +
		leaf(44, 79, -8, 17, 6.4, o) +
		leaf(30, 63, -140, 15, 5.8, ol) +
		leaf(50, 61, -40, 15, 5.8, ol) +
		leaf(33, 70, -112, 14, 5.4, o) +
		leaf(47, 68, -70, 14, 5.4, o);
	if (st === "leafy") return stem([[40, 87], [40, 72], [40, 60], [40, 50]], SAGE.stem, 1.8) + base + leaf(40, 52, -104, 13, 5, ol) + leaf(40, 52, -76, 13, 5, ol);
	const L = new Leaves();
	const d: P3[] = [];
	return (
		sageSpike([[40, 82], [40, 60], [41, 40], [40, 16]], 5, L, d) +
		sageSpike([[38, 82], [34, 66], [28, 50], [24, 32]], 4, L, d) +
		sageSpike([[42, 82], [46, 66], [52, 50], [56, 30]], 4, L, d) +
		L +
		dots(d, SAGE.fl2) +
		base +
		leaf(40, 60, -120, 11, 4.4, ol) +
		leaf(40, 58, -62, 11, 4.4, ol)
	);
}

// ── 6. Lavender (adapted from the mock) ─────────────────────────────────
const LAV = { fl: "#9a7fd6", fl2: "#b49be6", leaf: "#8fae8a", leaf2: "#a5c09f" };
function lavTuft(n: number, len: number): string {
	let s = "";
	for (let i = 0; i < n; i++) {
		const a = -165 + (150 * i) / (n - 1);
		s += leaf(40, 86, a, len * (1 - Math.abs(a + 90) / 250), 2.4, { fill: i % 2 ? LAV.leaf : LAV.leaf2, shape: 1, rib: false });
	}
	return s;
}
function lavender(st: St): string {
	if (st === "sprout") return lavTuft(3, 14);
	if (st === "leafy") return lavTuft(9, 40);
	let s = "";
	const a: P3[] = [];
	const b: P3[] = [];
	for (const [tx, ty] of <[number, number][]>[
		[24, 28],
		[32, 18],
		[40, 12],
		[48, 18],
		[56, 28],
	]) {
		s += `<path d="M40 85Q${f((40 + tx) / 2)} 60 ${tx} ${ty}" stroke="${LAV.leaf}" stroke-width="1.2" fill="none"/>`;
		for (let k = 0; k < 6; k++) {
			const t = k / 6;
			(k % 2 ? b : a).push([tx + (40 - tx) * t * 0.22, ty + t * 17, 2.5 - k * 0.12]);
		}
	}
	return s + dots(a, LAV.fl) + dots(b, LAV.fl2) + lavTuft(9, 26);
}

// ── 7. Parsley ──────────────────────────────────────────────────────────
const PAR = { stem: "#3c8a3a", a: "#3a9640", b: "#55b04e", c: "#7ac764" };
function parsley(st: St): string {
	const tips = by<T3[]>(
		st,
		[
			[35, 72, 0.6],
			[45, 70, 0.6],
		],
		[
			[24, 62, 0.85],
			[31, 52, 0.9],
			[40, 47, 0.95],
			[49, 51, 0.9],
			[56, 61, 0.85],
			[40, 64, 0.7],
		],
		[
			[19, 60, 0.95],
			[24, 47, 1],
			[31, 37, 1.05],
			[40, 31, 1.1],
			[49, 37, 1.05],
			[56, 47, 1],
			[61, 60, 0.95],
			[33, 54, 0.9],
			[47, 54, 0.9],
			[40, 44, 0.9],
		],
	);
	const sts: T4[] = [];
	const A: P3[] = [];
	const B: P3[] = [];
	const C: P3[] = [];
	for (const [x, y, k] of tips) {
		sts.push([40, 87, x, y]);
		for (const [dx, dy, r] of <T3[]>[
			[0, 0, 2.7],
			[-2.8, 1.2, 2.2],
			[2.8, 1.2, 2.2],
			[-1.6, -2.4, 2.1],
			[1.7, -2.3, 2.1],
			[0, 2.6, 1.9],
		])
			A.push([x + dx * k, y + dy * k, r * k]);
		B.push([x - 1.2 * k, y - 1.4 * k, 1.5 * k], [x + 1.6 * k, y + 0.4 * k, 1.4 * k], [x - 1.8 * k, y + 1.6 * k, 1.2 * k]);
		C.push([x - 1.4 * k, y - 2 * k, 0.8 * k], [x + 1.2 * k, y - 0.4 * k, 0.7 * k]);
	}
	return segs(sts, PAR.stem, 1.2) + dots(A, PAR.a) + dots(B, PAR.b) + dots(C, PAR.c);
}

// ── 8. Cilantro ─────────────────────────────────────────────────────────
const CIL = { stem: "#4f9844", leaf: "#76bb57", light: "#93cc6e", thread: "#6aaa58", umb: "#f3eee4", umb2: "#e7b3c9" };
function trilobe(x: number, y: number, a: number, s: number, fill: string): string {
	const o: LeafOptions = { fill, shape: 2, rib: false };
	return leaf(x, y, a - 42, 6 * s, 3.4 * s, o) + leaf(x, y, a + 42, 6 * s, 3.4 * s, o) + leaf(x, y, a, 7.4 * s, 4 * s, o);
}
function cilUmbel(x: number, y: number, r: number): string {
	const sp: T4[] = [];
	const A: P3[] = [];
	const B: P3[] = [];
	for (let i = 0; i < 5; i++) {
		const a = -155 + i * 32.5;
		const tx = x + Math.cos(a * D) * r;
		const ty = y + 4 + Math.sin(a * D) * r * 0.75;
		sp.push([x, y + 4, tx, ty]);
		A.push([tx - 0.9, ty - 0.5, 1.1], [tx + 0.9, ty - 0.5, 1.1]);
		B.push([tx, ty - 1.5, 0.9]);
	}
	return segs(sp, CIL.stem, 0.6) + dots(A, CIL.umb) + dots(B, CIL.umb2);
}
function cilantro(st: St): string {
	if (st === "sprout") return line(40, 87, 40, 76, CIL.stem, 1.3) + leaf(40, 77, -150, 11, 2, { fill: CIL.light, shape: 1, rib: false }) + leaf(40, 77, -30, 11, 2, { fill: CIL.light, shape: 1, rib: false }) + line(40, 77, 41, 71, CIL.stem, 1) + trilobe(41, 71, -90, 0.6, CIL.leaf);
	const low = by<T3[]>(
		st,
		[],
		[
			[24, 64, -150],
			[30, 54, -120],
			[40, 48, -90],
			[50, 54, -60],
			[56, 64, -30],
			[34, 64, -110],
			[46, 63, -70],
		],
		[
			[20, 70, -160],
			[26, 60, -135],
			[34, 58, -105],
			[46, 58, -75],
			[54, 60, -45],
			[60, 70, -20],
		],
	);
	let s = segs(
		low.map(([x, y]) => [40, 87, x, y]),
		CIL.stem,
		1.1,
	);
	low.forEach(([x, y, a], i) => (s += trilobe(x, y, a, 1, i % 2 ? CIL.light : CIL.leaf)));
	if (st === "leafy") return s;
	const thr: T4[] = [];
	const heads: [number, number, number][] = [
		[28, 26, 5.5],
		[41, 16, 6.5],
		[54, 26, 5.5],
	];
	let up = "";
	for (const [hx, hy] of heads) {
		const P: Cubic = [[40, 86], [40, 62], [hx, hy + 30], [hx, hy + 4]];
		up += stem(P, CIL.stem, 1.1);
		for (const t of [0.55, 0.75]) {
			const [x, y] = bez(P, t);
			const dir = dirAt(P, t);
			for (const sg of [-1, 1]) for (const dd of [35, 60]) thr.push([x, y, ...polar(x, y, dir + sg * dd, 4.5)]);
		}
	}
	return up + segs(thr, CIL.thread, 0.7) + s + heads.map(([x, y, r]) => cilUmbel(x, y, r)).join("");
}

// ── 9. Dill ─────────────────────────────────────────────────────────────
const DIL = { stem: "#5a8d66", fern: "#7fae86", fern2: "#9cc4a0", umb: "#e6c845", umb2: "#cba62c", spoke: "#8aa86a" };
function dillUmbel(x: number, y: number, r: number): string {
	const sp: T4[] = [];
	const A: P3[] = [];
	const B: P3[] = [];
	const n = 7;
	for (let i = 0; i < n; i++) {
		const a = -165 + (150 * i) / (n - 1);
		const tx = x + Math.cos(a * D) * r;
		const ty = y + Math.sin(a * D) * r * 0.45;
		sp.push([x, y + r * 0.55, tx, ty]);
		A.push([tx - 1, ty, 1.3], [tx + 1, ty, 1.3]);
		B.push([tx, ty - 1.2, 1.2]);
	}
	return segs(sp, DIL.spoke, 0.7) + dots(A, DIL.umb2) + dots(B, DIL.umb);
}
function dill(st: St): string {
	if (st === "sprout") return segs([[40, 87, 40, 74], [40, 76, 33, 70], [40, 76, 47, 70]], DIL.stem, 1) + pinnate(40, 74, -90, 9, 0, 3, DIL.fern, 0.8, 5, 40);
	const top = by(st, 0, 40, 22);
	let s = stem([[40, 87], [40, 70], [41, 55], [40, top]], DIL.stem, 1.8);
	const nodes: [number, number, number, number][] = by<[number, number, number, number][]>(
		st,
		[],
		[
			[40, 78, -150, 16],
			[40, 72, -30, 16],
			[40, 62, -135, 15],
			[40, 56, -45, 15],
			[40, 48, -110, 11],
			[40, 46, -70, 11],
		],
		[
			[40, 80, -155, 18],
			[40, 75, -25, 18],
			[40, 66, -140, 17],
			[40, 60, -40, 17],
			[40, 50, -125, 13],
			[40, 46, -55, 13],
		],
	);
	nodes.forEach(([x, y, a, l], i) => (s += pinnate(x, y, a, l, a < -90 ? 20 : -20, 4, i % 2 ? DIL.fern2 : DIL.fern, 0.8, 7, 38)));
	if (st === "leafy") return s;
	s += stem([[40, 58], [34, 52], [28, 46], [25, 38]], DIL.stem, 1.2) + stem([[40, 54], [46, 48], [52, 42], [56, 34]], DIL.stem, 1.2);
	return s + dillUmbel(40, 18, 13) + dillUmbel(24, 35, 8) + dillUmbel(57, 31, 8);
}

// ── 10. Chamomile ───────────────────────────────────────────────────────
const CHA = { stem: "#5e9a4e", fern: "#74ab60", fern2: "#93c47c", pet: "#fbfaf2", back: "#d8d0b8", ctr: "#f0bd28", ctr2: "#f7d863", bud: "#9cc985" };
function daisy(x: number, y: number, r: number): string {
	return rays(x, y, 12, r * 0.55, r * 1.25, r * 0.5, CHA.back, 15) + rays(x, y, 12, r * 0.55, r * 1.35, r * 0.5, CHA.pet) + circle(x, y, r * 0.5, CHA.ctr) + circle(x - r * 0.15, y - r * 0.18, r * 0.24, CHA.ctr2);
}
function chamomile(st: St): string {
	const fan = (n: number, len: number): string => {
		let s = "";
		for (let i = 0; i < n; i++) {
			const a = -160 + (140 * i) / (n - 1);
			s += pinnate(40, 86, a, len * (0.7 + 0.3 * Math.abs(Math.sin(a * D))), a < -90 ? 15 : -15, 3, i % 2 ? CHA.fern2 : CHA.fern, 0.9, 7, 45);
		}
		return s;
	};
	if (st === "sprout") return fan(3, 14);
	if (st === "leafy") return segs([[40, 86, 32, 46], [40, 86, 47, 42]], CHA.stem, 1.1) + fan(6, 26) + circle(32, 46, 2.4, CHA.bud) + circle(47, 42, 2.4, CHA.bud);
	const heads: T3[] = [
		[24, 40, 5.4],
		[34, 26, 5.8],
		[47, 20, 5.8],
		[57, 34, 5.4],
		[42, 42, 5],
	];
	let s = "";
	for (const [x, y] of heads) s += stem([[40, 86], [40, 70], [x, y + 18], [x, y]], CHA.stem, 1.1);
	s += fan(7, 30);
	return s + heads.map(([x, y, r]) => daisy(x, y, r)).join("");
}

// ── 11. Tomato ──────────────────────────────────────────────────────────
const TOM = { leaf: "#5a9944", light: "#76b35a", dark: "#376a2b", stem: "#4f8a3a", red: "#e1473a", orange: "#f08d3b", green: "#a3cf5c", hi: "#ffffff" };
/** A compound tomato leaf: rachis into `r`, leaflets into `L`. */
function compound(x: number, y: number, a: number, len: number, fill: string, L: Leaves, r: T4[]): void {
	const o: LeafOptions = { fill, rib: false };
	r.push([x, y, ...polar(x, y, a, len * 0.72)]);
	for (const t of [0.3, 0.6]) {
		const [px, py] = polar(x, y, a, len * t);
		L.add(px, py, a - 62, len * 0.34, len * 0.15, o).add(px, py, a + 62, len * 0.34, len * 0.15, o);
	}
	const [ex, ey] = polar(x, y, a, len * 0.62);
	L.add(ex, ey, a, len * 0.42, len * 0.17, o);
}
function tomatoFruit(x: number, y: number, r: number, col: string): string {
	return circle(x, y, r, col) + circle(x - r * 0.38, y - r * 0.3, r * 0.22, TOM.hi, 0.55) + rays(x, y - r * 0.82, 5, 0, r * 0.55, r * 0.22, TOM.dark, -90);
}
function tomato(st: St): string {
	const L = new Leaves();
	const r: T4[] = [];
	if (st === "sprout") {
		compound(40, 71, -100, 11, TOM.leaf, L, r);
		return stem([[40, 87], [40, 80], [41, 76], [40, 70]], TOM.stem, 1.8) + leaf(40, 76, -160, 10, 2.6, { fill: TOM.light, shape: 1, rib: false }) + leaf(40, 76, -20, 10, 2.6, { fill: TOM.light, shape: 1, rib: false }) + segs(r, TOM.stem, 1.1) + L;
	}
	const P: Cubic = st === "leafy" ? [[40, 87], [37, 70], [44, 56], [40, 40]] : [[40, 87], [36, 66], [45, 46], [40, 22]];
	const spec: readonly (readonly [number, number, number, string])[] =
		st === "leafy"
			? [
					[0.25, -155, 20, TOM.leaf],
					[0.42, -25, 19, TOM.light],
					[0.62, -145, 16, TOM.light],
					[0.78, -35, 14, TOM.leaf],
					[1, -90, 10, TOM.light],
				]
			: [
					[0.18, -160, 22, TOM.leaf],
					[0.32, -20, 21, TOM.light],
					[0.5, -150, 19, TOM.light],
					[0.62, -30, 18, TOM.leaf],
					[0.8, -145, 15, TOM.leaf],
					[0.9, -40, 13, TOM.light],
				];
	for (const [t, a, l, c] of spec) {
		const [x, y] = bez(P, t);
		compound(x, y, a, l, c, L, r);
	}
	const base = stem(P, TOM.stem, st === "leafy" ? 2.3 : 2.6) + segs(r, TOM.stem, 1.1) + L;
	if (st === "leafy") return base;
	return (
		line(53, 87, 53, 20, BARK, 1.8) +
		base +
		segs([[39, 58, 30, 62], [42, 42, 52, 46]], TOM.stem, 1) +
		tomatoFruit(28, 64, 5.6, TOM.red) +
		tomatoFruit(35, 70, 5, TOM.red) +
		tomatoFruit(24, 73, 4.6, TOM.orange) +
		tomatoFruit(51, 48, 5.2, TOM.red) +
		tomatoFruit(57, 55, 4.4, TOM.orange) +
		tomatoFruit(44, 30, 3.2, TOM.green)
	);
}

// ── 12. Pepper ──────────────────────────────────────────────────────────
const PEP = { leaf: "#3f8f3c", light: "#5aa84f", dark: "#2a6428", stem: "#4a7f3a", red: "#d8392e", red2: "#ef7360", or: "#ee8a2a", or2: "#f7b467", fl: "#f7f5ec" };
function bell(x: number, y: number, s: number, col: string, hi: string): string {
	return g(
		x,
		y,
		0,
		`<path d="M0 0L.6 -3.4" stroke="${PEP.stem}" stroke-width="1.3" stroke-linecap="round"/><path d="M-5 1C-6.2 7 -4.6 12 -2.2 12Q-1 10.4 0 12Q1 10.4 2.2 12C4.6 12 6.2 7 5 1Q0 -1.6 -5 1Z" fill="${col}"/><path d="M-2.8 3.4C-3.6 6 -3.2 8.4 -2.2 10" stroke="${hi}" stroke-width="1.2" stroke-linecap="round" fill="none"/><path d="M-2.6 .7Q0 -1.6 2.6 .7Q0 1.8 -2.6 .7Z" fill="${PEP.dark}"/>`,
		s,
	);
}
function pepper(st: St): string {
	const o: LeafOptions = { fill: PEP.leaf, dark: PEP.dark, shape: 1 };
	const ol: LeafOptions = { fill: PEP.light, dark: PEP.dark, shape: 1 };
	if (st === "sprout") return stem([[40, 87], [40, 81], [40, 77], [40, 72]], PEP.stem, 1.8) + leaf(40, 73, -155, 10, 3.6, o) + leaf(40, 73, -25, 10, 3.6, o) + leaf(40, 72, -95, 6, 2.4, ol);
	if (st === "leafy")
		return (
			stem([[40, 87], [40, 76], [40, 68], [40, 62]], PEP.stem, 2.4) +
			stem([[40, 63], [36, 56], [32, 50], [30, 42]], PEP.stem, 1.8) +
			stem([[40, 63], [44, 56], [48, 50], [51, 40]], PEP.stem, 1.8) +
			leaf(40, 76, -165, 14, 5, o) +
			leaf(40, 72, -15, 14, 5, o) +
			leaf(33, 53, -170, 12, 4.4, ol) +
			leaf(47, 52, -10, 12, 4.4, ol) +
			leaf(30, 43, -120, 10, 3.8, o) +
			leaf(51, 41, -60, 10, 3.8, o)
		);
	return (
		stem([[40, 87], [40, 76], [40, 68], [40, 60]], PEP.stem, 2.6) +
		stem([[40, 61], [34, 52], [28, 42], [25, 28]], PEP.stem, 2) +
		stem([[40, 61], [46, 52], [52, 42], [55, 26]], PEP.stem, 2) +
		stem([[40, 61], [40, 50], [41, 40], [40, 32]], PEP.stem, 1.6) +
		leaf(40, 78, -168, 15, 5.2, o) +
		leaf(40, 74, -12, 15, 5.2, o) +
		leaf(30, 46, -170, 13, 4.6, ol) +
		leaf(51, 44, -10, 13, 4.6, ol) +
		leaf(25, 30, -125, 12, 4.2, o) +
		leaf(55, 28, -55, 12, 4.2, o) +
		leaf(40, 33, -110, 10, 3.6, ol) +
		leaf(40, 33, -70, 10, 3.6, ol) +
		petals(47, 36, 5, 1.8, 1.7, 1.1, PEP.fl) +
		circle(47, 36, 0.9, "#f2c230") +
		bell(28, 50, 1.15, PEP.red, PEP.red2) +
		bell(52, 48, 1.1, PEP.or, PEP.or2) +
		bell(40, 58, 1.2, PEP.red, PEP.red2)
	);
}

// ── 13. Eggplant ────────────────────────────────────────────────────────
const EGG = { leaf: "#6c9a62", light: "#86b07a", rib: "#5b3d6e", stem: "#5d4a69", fruit: "#5b3380", hi: "#9067bd", cap: "#5c8f48", fl: "#b9a0dd" };
function aubergine(x: number, y: number, len: number, rot: number): string {
	const L = f(len);
	return g(
		x,
		y,
		rot,
		`<path d="M0 0C-3 .5 -4.6 4 -5.4 9C-6.8 ${f(len * 0.75)} -5 ${L} 0 ${L}C5 ${L} 6.8 ${f(len * 0.75)} 5.4 9C4.6 4 3 .5 0 0Z" fill="${EGG.fruit}"/><path d="M-3 8C-4 ${f(len * 0.55)} -4 ${f(len * 0.72)} -2.4 ${f(len * 0.85)}" stroke="${EGG.hi}" stroke-width="1.4" stroke-linecap="round" fill="none"/><path d="M-4.6 3.2L-3 .2L-3.6 -1.2L0 -.8L3.6 -1.2L3 .2L4.6 3.2L1.8 1.6L0 4L-1.8 1.6Z" fill="${EGG.cap}"/><path d="M0 -.8V-4" stroke="${EGG.stem}" stroke-width="1.4" stroke-linecap="round"/>`,
	);
}
function eggplant(st: St): string {
	const o: LeafOptions = { fill: EGG.leaf, dark: EGG.rib };
	const ol: LeafOptions = { fill: EGG.light, dark: EGG.rib };
	if (st === "sprout") return stem([[40, 87], [40, 82], [40, 77], [40, 72]], EGG.stem, 1.8) + leaf(40, 76, -160, 9, 4, ol) + leaf(40, 76, -20, 9, 4, ol) + leaf(40, 72, -95, 9, 4.2, o);
	if (st === "leafy")
		return stem([[40, 87], [40, 72], [40, 58], [40, 46]], EGG.stem, 2.4) + leaf(40, 78, -168, 17, 7.6, o) + leaf(40, 70, -12, 17, 7.6, o) + leaf(40, 60, -150, 15, 6.6, ol) + leaf(40, 54, -30, 15, 6.6, ol) + leaf(40, 47, -95, 12, 5.4, o);
	return (
		stem([[40, 87], [40, 70], [40, 52], [40, 30]], EGG.stem, 2.6) +
		stem([[40, 62], [34, 56], [29, 50], [27, 46]], EGG.stem, 1.6) +
		stem([[40, 58], [46, 52], [51, 47], [53, 43]], EGG.stem, 1.6) +
		leaf(40, 80, -170, 19, 8.4, o) +
		leaf(40, 74, -10, 19, 8.4, o) +
		leaf(40, 50, -150, 16, 7, ol) +
		leaf(40, 44, -30, 16, 7, ol) +
		leaf(40, 32, -110, 13, 5.6, o) +
		leaf(40, 32, -70, 13, 5.6, o) +
		petals(47, 30, 5, 2, 2, 1.3, EGG.fl) +
		circle(47, 30, 1, "#f2c230") +
		aubergine(27, 49, 24, 10) +
		aubergine(53, 46, 21, -8)
	);
}

// ── 14. Carrot ──────────────────────────────────────────────────────────
const CAR = { fern: "#4b9a3e", fern2: "#6fb556", stem: "#4a8a3c", root: "#ee8a2c", rootD: "#c9671c", rootL: "#f7ab5f" };
function carrotTop(w: number, h: number): string {
	const t = 88 - h;
	return `<path d="M${f(40 - w)} 88C${f(40 - w)} ${f(t + h * 0.4)} ${f(40 - w * 0.6)} ${f(t)} 40 ${f(t)}C${f(40 + w * 0.6)} ${f(t)} ${f(40 + w)} ${f(t + h * 0.4)} ${f(40 + w)} 88Z" fill="${CAR.root}"/>${segs(
		[
			[40 - w * 0.55, t + h * 0.45, 40 - w * 0.15, t + h * 0.5],
			[40 + w * 0.2, t + h * 0.7, 40 + w * 0.6, t + h * 0.65],
		],
		CAR.rootD,
		0.8,
	)}<path d="M${f(40 - w * 0.5)} ${f(t + h * 0.3)}Q${f(40 - w * 0.2)} ${f(t + h * 0.08)} ${f(40 + w * 0.1)} ${f(t + h * 0.1)}" stroke="${CAR.rootL}" stroke-width="1.1" stroke-linecap="round" fill="none"/>`;
}
function carrot(st: St): string {
	if (st === "sprout") return blade(39, 34, 72, CAR.fern2, 1) + blade(41, 46, 72, CAR.fern2, 1) + pinnate(40, 86, -88, 14, 0, 3.5, CAR.fern, 1.3, 6, 50);
	const fr = by<T3[]>(
		st,
		[],
		[
			[-130, 30, 22],
			[-105, 38, 8],
			[-78, 38, -8],
			[-52, 30, -22],
		],
		[
			[-145, 34, 25],
			[-122, 48, 18],
			[-100, 56, 6],
			[-80, 56, -6],
			[-58, 48, -18],
			[-35, 34, -25],
		],
	);
	const y0 = st === "bloom" ? 80 : 83;
	let s = "";
	fr.forEach(([a, l, b], i) => (s += pinnate(40, y0, a, l, b, st === "bloom" ? 6 : 5, i % 2 ? CAR.fern2 : CAR.fern, 1.6, 9, 48)));
	return s + (st === "bloom" ? carrotTop(7.5, 9) : carrotTop(4.5, 5));
}

// ── 15. Radish ──────────────────────────────────────────────────────────
const RAD = { leaf: "#6aae4d", light: "#87c466", dark: "#3c7a32", stem: "#6a9a4a", root: "#e2416a", rootL: "#f490ab", tip: "#f6eef0" };
function radishLeaves(x: number, y: number, list: T4[]): string {
	let s = "";
	list.forEach(([a, sl, l, w], i) => {
		const [bx, by2] = polar(x, y, a, sl);
		s += line(x, y, bx, by2, RAD.stem, 1.3) + leaf(bx, by2, a, l, w, { fill: i % 2 ? RAD.light : RAD.leaf, dark: RAD.dark, shape: 2 });
	});
	return s;
}
function radish(st: St): string {
	if (st === "sprout") return stem([[40, 87], [40, 82], [40, 78], [40, 75]], RAD.stem, 1.6) + leaf(40, 76, -150, 8.5, 4.6, { fill: RAD.leaf, shape: 4, rib: false }) + leaf(40, 76, -30, 8.5, 4.6, { fill: RAD.light, shape: 4, rib: false });
	if (st === "leafy")
		return (
			radishLeaves(40, 82, [
				[-155, 5, 15, 5.2],
				[-122, 6, 18, 6],
				[-90, 6, 20, 6.4],
				[-58, 6, 18, 6],
				[-25, 5, 15, 5.2],
			]) +
			circle(40, 84, 4.2, RAD.root) +
			circle(38.6, 82.8, 1.2, RAD.rootL)
		);
	return (
		radishLeaves(40, 74, [
			[-160, 6, 18, 6],
			[-132, 8, 22, 7],
			[-105, 9, 25, 7.4],
			[-76, 9, 25, 7.4],
			[-48, 8, 22, 7],
			[-20, 6, 18, 6],
		]) +
		circle(40, 80, 8.2, RAD.root) +
		`<path d="M35 84.5Q40 89.5 45 84.5Q40 86.5 35 84.5Z" fill="${RAD.tip}"/>` +
		ell(36.8, 77.2, 2.2, 3, RAD.rootL, 30)
	);
}

// ── 16. Lettuce ─────────────────────────────────────────────────────────
const LET = { a: "#7fbf52", b: "#9ed062", c: "#c1e38a", rib: "#e7f4cf" };
function ruffle(x: number, y: number, a: number, len: number, w: number, fill: string): string {
	const r = w * 0.36;
	const pts: P3[] = [];
	for (const [t, k] of <[number, number][]>[
		[0.38, 0.98],
		[0.58, 0.98],
		[0.76, 0.82],
		[0.9, 0.5],
	])
		pts.push([len * t, -w * k, r], [len * t, w * k, r]);
	pts.push([len * 0.98, 0, r]);
	return g(x, y, a, `<path d="${leafPath(len, w, 2)}" fill="${fill}"/>${dots(pts, fill)}<path d="M1 0L${f(len * 0.75)} 0" stroke="${LET.rib}" stroke-width=".9" stroke-linecap="round" opacity=".7"/>`);
}
function lettuce(st: St): string {
	if (st === "sprout") return ruffle(40, 86, -145, 9, 3.6, LET.a) + ruffle(40, 86, -35, 9, 3.6, LET.a) + ruffle(40, 86, -90, 11, 4, LET.b);
	if (st === "leafy")
		return ruffle(40, 85, -168, 17, 6, LET.a) + ruffle(40, 85, -12, 17, 6, LET.a) + ruffle(40, 85, -135, 21, 7, LET.b) + ruffle(40, 85, -45, 21, 7, LET.b) + ruffle(40, 85, -108, 26, 8, LET.a) + ruffle(40, 85, -72, 26, 8, LET.b) + ruffle(40, 85, -90, 18, 6.4, LET.c);
	return (
		ruffle(40, 85, -172, 25, 8, LET.a) +
		ruffle(40, 85, -8, 25, 8, LET.a) +
		ruffle(40, 85, -145, 30, 9.5, LET.b) +
		ruffle(40, 85, -35, 30, 9.5, LET.b) +
		ruffle(40, 85, -116, 40, 11, LET.a) +
		ruffle(40, 85, -64, 40, 11, LET.a) +
		ruffle(40, 85, -100, 34, 10, LET.b) +
		ruffle(40, 85, -80, 34, 10, LET.b) +
		ruffle(40, 85, -90, 24, 8, LET.c)
	);
}

// ── 17. Cabbage ─────────────────────────────────────────────────────────
const CAB = { outer: "#6a9a88", outer2: "#5a8a78", vein: "#d6e8dc", head: "#b8d9a7", head2: "#9cc890", headL: "#d4eac0" };
function cabbageHead(cx: number, cy: number, r: number): string {
	return (
		circle(cx, cy, r, CAB.head2) +
		`<path d="M${f(cx)} ${f(cy - r)}C${f(cx + r * 1.25)} ${f(cy - r * 0.7)} ${f(cx + r * 1.2)} ${f(cy + r * 0.85)} ${f(cx - r * 0.1)} ${f(cy + r)}C${f(cx + r * 0.55)} ${f(cy + r * 0.3)} ${f(cx + r * 0.5)} ${f(cy - r * 0.6)} ${f(cx)} ${f(cy - r)}Z" fill="${CAB.head}"/>` +
		`<path d="M${f(cx + r * 0.1)} ${f(cy - r)}C${f(cx - r * 0.9)} ${f(cy - r * 0.8)} ${f(cx - r * 0.95)} ${f(cy + r * 0.4)} ${f(cx - r * 0.3)} ${f(cy + r * 0.75)}C${f(cx - r * 0.55)} ${f(cy + r * 0.1)} ${f(cx - r * 0.4)} ${f(cy - r * 0.55)} ${f(cx + r * 0.1)} ${f(cy - r)}Z" fill="${CAB.headL}"/>` +
		`<path d="M${f(cx + r * 0.15)} ${f(cy - r * 0.9)}Q${f(cx + r * 0.7)} ${f(cy)} ${f(cx + r * 0.2)} ${f(cy + r * 0.85)}" stroke="${CAB.vein}" stroke-width=".8" fill="none"/>`
	);
}
function cabbage(st: St): string {
	const o: LeafOptions = { fill: CAB.outer, dark: CAB.vein, shape: 2 };
	const o2: LeafOptions = { fill: CAB.outer2, dark: CAB.vein, shape: 2 };
	if (st === "sprout") return stem([[40, 87], [40, 83], [40, 79], [40, 76]], CAB.outer2, 1.6) + leaf(40, 77, -160, 8, 4.6, { ...o, rib: false }) + leaf(40, 77, -20, 8, 4.6, { ...o, rib: false }) + leaf(40, 76, -90, 8, 4, o2);
	if (st === "leafy") return leaf(40, 84, -112, 22, 9, o2) + leaf(40, 84, -68, 22, 9, o2) + leaf(40, 85, -160, 18, 8, o) + leaf(40, 85, -20, 18, 8, o) + cabbageHead(40, 74, 7.5);
	return leaf(40, 82, -118, 32, 13, o2) + leaf(40, 82, -62, 32, 13, o2) + leaf(40, 85, -172, 26, 10, o) + leaf(40, 85, -8, 26, 10, o) + leaf(40, 85, -142, 24, 10, o2) + leaf(40, 85, -38, 24, 10, o2) + cabbageHead(40, 66, 15);
}

// ── 18. Kale ────────────────────────────────────────────────────────────
const KAL = { leaf: "#3d6b58", leaf2: "#4f8270", rib: "#a9c8b8", stalk: "#5a7f68" };
function kaleLeaf(x: number, y: number, a: number, len: number, w: number, fill: string): string {
	const pts: P3[] = [];
	const hw = [0.8, 0.85, 0.72, 0.5, 0.24];
	[0.3, 0.45, 0.6, 0.75, 0.9].forEach((t, i) => pts.push([len * t, -w * hw[i]!, w * 0.42], [len * t, w * hw[i]!, w * 0.42]));
	return g(x, y, a, `<path d="${leafPath(len, w, 1)}" fill="${fill}"/>${dots(pts, fill)}<path d="M0 0L${f(len * 0.85)} 0" stroke="${KAL.rib}" stroke-width="1" stroke-linecap="round" opacity=".8"/>`);
}
function kale(st: St): string {
	if (st === "sprout") return line(40, 87, 40, 76, KAL.stalk, 1.8) + kaleLeaf(40, 77, -140, 11, 3.6, KAL.leaf2) + kaleLeaf(40, 77, -40, 11, 3.6, KAL.leaf) + kaleLeaf(40, 76, -92, 8, 2.8, KAL.leaf2);
	if (st === "leafy")
		return line(40, 87, 40, 58, KAL.stalk, 2.6) + kaleLeaf(40, 80, -158, 18, 5, KAL.leaf) + kaleLeaf(40, 74, -22, 18, 5, KAL.leaf) + kaleLeaf(40, 68, -135, 20, 5.4, KAL.leaf2) + kaleLeaf(40, 63, -48, 20, 5.4, KAL.leaf2) + kaleLeaf(40, 60, -102, 20, 5.2, KAL.leaf) + kaleLeaf(40, 59, -75, 18, 5, KAL.leaf2);
	return (
		line(40, 87, 40, 44, KAL.stalk, 3.4) +
		kaleLeaf(40, 82, -165, 22, 6, KAL.leaf) +
		kaleLeaf(40, 76, -15, 22, 6, KAL.leaf) +
		kaleLeaf(40, 68, -145, 25, 6.4, KAL.leaf2) +
		kaleLeaf(40, 62, -38, 25, 6.4, KAL.leaf2) +
		kaleLeaf(40, 54, -128, 27, 6.6, KAL.leaf) +
		kaleLeaf(40, 50, -54, 27, 6.6, KAL.leaf) +
		kaleLeaf(40, 46, -106, 30, 7, KAL.leaf2) +
		kaleLeaf(40, 45, -78, 30, 7, KAL.leaf2) +
		kaleLeaf(40, 46, -92, 22, 5.6, KAL.leaf)
	);
}

// ── 19. Pea ─────────────────────────────────────────────────────────────
const PEA = { stem: "#6faa52", leaf: "#8cc46a", leaf2: "#72b054", pod: "#7cbf4a", podL: "#a6d872", fl: "#f7f1f7", fl2: "#e2a1c4" };
function tendril(x: number, y: number, dir: 1 | -1): string {
	const k = dir;
	return `<path d="M${f(x)} ${f(y)}q${f(3 * k)} -4 ${f(8 * k)} -6c${f(2.6 * k)} -.6 ${f(3.4 * k)} 2 ${f(1.6 * k)} 2.8c${f(-1.2 * k)} .5 ${f(-1.8 * k)} -.6 ${f(-1 * k)} -1.2" stroke="${PEA.stem}" stroke-width=".8" stroke-linecap="round" fill="none"/>`;
}
function peaPod(x: number, y: number, len: number, rot: number): string {
	const L = len;
	return g(
		x,
		y,
		rot,
		`<path d="M0 0C2.8 1 3.2 5 3 ${f(L * 0.6)}C2.8 ${f(L * 0.88)} 1.4 ${f(L)} 0 ${f(L + 1.2)}C-1.4 ${f(L)} -2.8 ${f(L * 0.88)} -3 ${f(L * 0.6)}C-3.2 5 -2.8 1 0 0Z" fill="${PEA.pod}"/>${dots(
			[
				[0.3, L * 0.3, 1.3],
				[0.3, L * 0.55, 1.4],
				[0.2, L * 0.8, 1.2],
			],
			PEA.podL,
		)}<path d="M-2 .6L0 -1.4L2 .6L0 2Z" fill="${PEA.leaf2}"/>`,
	);
}
function peaFlower(x: number, y: number): string {
	return ell(x, y, 3.2, 2.6, PEA.fl) + ell(x - 1.6, y + 2, 1.6, 1.4, PEA.fl2) + ell(x + 1.6, y + 2, 1.6, 1.4, PEA.fl2);
}
function pea(st: St): string {
	const o: LeafOptions = { fill: PEA.leaf, dark: PEA.leaf2, shape: 2, rib: false };
	const o2: LeafOptions = { fill: PEA.leaf2, shape: 2, rib: false };
	if (st === "sprout") return stem([[40, 87], [40, 81], [41, 77], [40, 71]], PEA.stem, 1.6) + leaf(40, 75, -160, 7, 3.6, o) + leaf(40, 75, -20, 7, 3.6, o) + tendril(40, 71, 1);
	const top = by(st, 0, 42, 18);
	const P1: Cubic = [[40, 87], [34, 74], [52, 68], [46, 58]];
	const P2: Cubic = [[46, 58], [40, 50], [56, 44], [48, top]];
	let s = line(53, 87, 53, top - 2, BARK, 1.6) + stem(P1, PEA.stem, 1.6) + stem(P2, PEA.stem, 1.6);
	const nodes: [Cubic, number, number][] = [
		[P1, 0.3, 8],
		[P1, 0.75, 8.5],
		[P2, 0.4, 8],
		[P2, 0.85, 7],
	];
	nodes.forEach(([P, t, l], i) => {
		const [x, y] = bez(P, t);
		s += leaf(x, y, -165 + i * 4, l, l * 0.5, i % 2 ? o2 : o) + leaf(x, y, -15 - i * 4, l, l * 0.5, i % 2 ? o : o2) + tendril(x, y - 1, i % 2 ? 1 : -1);
	});
	if (st === "leafy") return s;
	const P3: Cubic = [[48, top], [42, 12], [38, 18], [36, 22]];
	return s + stem(P3, PEA.stem, 1.2) + leaf(36, 22, -150, 6, 3, o) + tendril(48, top, 1) + peaPod(36, 58, 17, 16) + peaPod(57, 50, 16, -10) + peaPod(30, 40, 14, 24) + peaFlower(58, 36) + peaFlower(34, 30);
}

// ── 20. Strawberry ──────────────────────────────────────────────────────
const STR = { leaf: "#4b9843", light: "#64b056", dark: "#2f6a2c", stem: "#5d9a4a", berry: "#e2383b", seed: "#f6d46a", hi: "#f57a74", fl: "#fbfaf2", ctr: "#f2c230" };
/** A three-leaflet strawberry leaf on its stalk: leaflets into `L`. */
function trifoliate(x: number, y: number, s: number, fill: string, L: Leaves): string {
	const a = Math.atan2(y - 86, x - 40) / D;
	const o: LeafOptions = { fill, dark: STR.dark };
	L.add(x, y, a - 50, 8 * s, 4 * s, o).add(x, y, a + 50, 8 * s, 4 * s, o).add(x, y, a, 9 * s, 4.4 * s, o);
	return stem([[40, 86], [40 + (x - 40) * 0.2, 86 - (86 - y) * 0.6], [x, y + 6], [x, y]], STR.stem, 1.2);
}
function berry(x: number, y: number, s: number): string {
	return g(
		x,
		y,
		0,
		`<path d="M0 0C-4.4 -.4 -5.8 3 -4.8 6.2C-3.8 9.2 -1.2 11.4 0 12.2C1.2 11.4 3.8 9.2 4.8 6.2C5.8 3 4.4 -.4 0 0Z" fill="${STR.berry}"/>${dots(
			[
				[-2.4, 3.2],
				[0.6, 3],
				[2.8, 4.6],
				[-1.2, 6.4],
				[1.6, 7.6],
				[-0.2, 9.8],
				[-3, 6.6],
			],
			STR.seed,
			0.45,
		)}<path d="M-3.4 .4L-1.2 -1.2L0 -.2L1.2 -1.2L3.4 .4L1 .8L0 1.8L-1 .8Z" fill="${STR.dark}"/>`,
		s,
	);
}
function strawberry(st: St): string {
	const L = new Leaves();
	if (st === "sprout") return stem([[40, 87], [40, 82], [40, 79], [40, 76]], STR.stem, 1.3) + leaf(40, 78, -155, 6, 3.6, { fill: STR.light, shape: 2, rib: false }) + leaf(40, 78, -25, 6, 3.6, { fill: STR.light, shape: 2, rib: false }) + trifoliate(41, 74, 0.55, STR.leaf, L) + L;
	if (st === "leafy") return trifoliate(26, 66, 1, STR.leaf, L) + trifoliate(54, 64, 1, STR.leaf, L) + trifoliate(34, 54, 1.1, STR.light, L) + trifoliate(47, 52, 1.1, STR.leaf, L) + trifoliate(40, 66, 0.8, STR.light, L) + L;
	return (
		trifoliate(22, 64, 1.1, STR.leaf, L) +
		trifoliate(58, 62, 1.1, STR.leaf, L) +
		trifoliate(31, 48, 1.2, STR.light, L) +
		trifoliate(49, 46, 1.2, STR.leaf, L) +
		trifoliate(40, 58, 1, STR.light, L) +
		L +
		stem([[40, 86], [30, 80], [22, 74], [16, 72]], STR.stem, 1) +
		stem([[40, 86], [50, 82], [58, 76], [62, 74]], STR.stem, 1) +
		stem([[40, 86], [36, 64], [32, 44], [26, 34]], STR.stem, 1) +
		berry(16, 72, 1.05) +
		berry(62, 74, 0.95) +
		petals(26, 34, 5, 2.8, 2.5, 2.2, "#d8d0b8", 36) +
		petals(26, 34, 5, 2.6, 2.4, 2.1, STR.fl) +
		circle(26, 34, 1.4, STR.ctr) +
		berry(30, 70, 0.9)
	);
}

// ── 21. Pumpkin ─────────────────────────────────────────────────────────
const PUM = { leaf: "#5b9a47", light: "#76b35d", dark: "#376b2c", vine: "#5f8f3e", fruit: "#f08f30", fruit2: "#da731d", fruitL: "#f8b25f", stalk: "#6d5a34", fl: "#f4c234", fl2: "#e0a21e" };
function pumLeaf(x0: number, y0: number, x: number, y: number, len: number, fill: string): string {
	const o: LeafOptions = { fill, dark: PUM.dark, shape: 4 };
	return line(x0, y0, x, y, PUM.vine, 1.4) + leaf(x, y, -90 + (x - 40) * 0.8, len, len * 0.55, o) + leaf(x, y, -140 + (x - 40) * 0.8, len * 0.62, len * 0.38, { ...o, rib: false }) + leaf(x, y, -40 + (x - 40) * 0.8, len * 0.62, len * 0.38, { ...o, rib: false });
}
function pumpkinFruit(cx: number, cy: number, rx: number, ry: number): string {
	return (
		`<path d="M${f(cx)} ${f(cy - ry + 1)}Q${f(cx - 1)} ${f(cy - ry - 3)} ${f(cx + 2.4)} ${f(cy - ry - 5)}" stroke="${PUM.stalk}" stroke-width="2.4" stroke-linecap="round" fill="none"/>` +
		ell(cx - rx * 0.45, cy, rx * 0.55, ry * 0.94, PUM.fruit2) +
		ell(cx + rx * 0.45, cy, rx * 0.55, ry * 0.94, PUM.fruit2) +
		ell(cx, cy, rx * 0.45, ry, PUM.fruit) +
		`<path d="M${f(cx - rx * 0.62)} ${f(cy - ry * 0.4)}Q${f(cx - rx * 0.72)} ${f(cy)} ${f(cx - rx * 0.6)} ${f(cy + ry * 0.4)}" stroke="${PUM.fruitL}" stroke-width="1.2" stroke-linecap="round" fill="none"/>`
	);
}
function pumpkin(st: St): string {
	if (st === "sprout") return stem([[40, 87], [40, 82], [40, 79], [40, 75]], PUM.vine, 2.2) + leaf(40, 76, -160, 10, 5, { fill: PUM.light, shape: 2, rib: false }) + leaf(40, 76, -20, 10, 5, { fill: PUM.light, shape: 2, rib: false }) + leaf(40, 75, -90, 7, 4, { fill: PUM.leaf, dark: PUM.dark, shape: 4 });
	if (st === "leafy")
		return (
			stem([[40, 86], [30, 85], [20, 84], [12, 80]], PUM.vine, 2) +
			stem([[40, 86], [50, 86], [60, 84], [68, 80]], PUM.vine, 2) +
			tendril2(66, 80) +
			pumLeaf(28, 85, 26, 62, 18, PUM.leaf) +
			pumLeaf(52, 86, 54, 58, 20, PUM.light) +
			pumLeaf(40, 86, 40, 54, 20, PUM.leaf) +
			ell(16, 78, 2.4, 3.6, PUM.fl, -20)
		);
	return (
		stem([[40, 86], [30, 86], [16, 85], [8, 80]], PUM.vine, 2.2) +
		stem([[40, 86], [52, 86], [64, 85], [72, 78]], PUM.vine, 2.2) +
		tendril2(70, 79) +
		pumLeaf(24, 85, 22, 50, 22, PUM.leaf) +
		pumLeaf(56, 86, 58, 44, 24, PUM.light) +
		pumLeaf(40, 86, 40, 36, 24, PUM.leaf) +
		petals(64, 66, 5, 3, 3.2, 2.4, PUM.fl) +
		circle(64, 66, 1.6, PUM.fl2) +
		line(64, 70, 64, 85, PUM.vine, 1.2) +
		pumpkinFruit(34, 76, 17, 11)
	);
}
function tendril2(x: number, y: number): string {
	return `<path d="M${f(x)} ${f(y)}c2 -3 5 -3 5 0c0 2 -2.6 2.2 -2.8 .4" stroke="${PUM.vine}" stroke-width=".9" stroke-linecap="round" fill="none"/>`;
}

// ── 22. Garlic ──────────────────────────────────────────────────────────
const GAR = { a: "#86a782", b: "#a3bd9a", bulb: "#ece4d3", bulbD: "#bfb196", stripe: "#b896c4", scape: "#8fab88", bud: "#c6d6ae" };
function garlic(st: St): string {
	if (st === "sprout") return blade(39, 35, 66, GAR.a, 1.8) + blade(41, 45, 68, GAR.b, 1.8);
	const blades = by<T3[]>(
		st,
		[],
		[
			[38, 22, 50],
			[39, 32, 40],
			[40, 42, 36],
			[41, 52, 44],
			[42, 60, 54],
		],
		[
			[38, 16, 50],
			[39, 28, 34],
			[40, 40, 30],
			[41, 54, 36],
			[42, 64, 50],
		],
	);
	let s = "";
	blades.forEach(([x, tx, ty], i) => (s += blade(x, tx, ty, i % 2 ? GAR.b : GAR.a, 2.2)));
	if (st === "leafy") return s;
	return (
		`<path d="M40 72C40 50 40 36 46 28C52 20 60 26 56 32C52 37 46 31 49 22C50 18 53 14 56 12" stroke="${GAR.scape}" stroke-width="1.5" stroke-linecap="round" fill="none"/>` +
		g(56, 12, 35, `<path d="M0 0C-2.4 -1 -2.6 -4 0 -6.4C2.6 -4 2.4 -1 0 0Z" fill="${GAR.bud}"/><path d="M0 -6L0 -10" stroke="${GAR.bud}" stroke-width="1" stroke-linecap="round"/>`) +
		s +
		`<path d="M40 70C41 74 48 76 49.5 81C50.5 86 45.5 88 40 88C34.5 88 29.5 86 30.5 81C32 76 39 74 40 70Z" fill="${GAR.bulb}"/>` +
		`<path d="M35.6 78.5Q34.4 83.5 36.8 87.4M44.4 78.5Q45.6 83.5 43.2 87.4M40 75V87.8" stroke="${GAR.bulbD}" stroke-width=".9" fill="none"/>` +
		`<path d="M33 80.5Q32.6 84 34.6 86.6M47 80.5Q47.4 84 45.4 86.6" stroke="${GAR.stripe}" stroke-width=".9" fill="none" opacity=".8"/>`
	);
}

// ── 23. Onion ───────────────────────────────────────────────────────────
const ONI = { a: "#5f9a82", b: "#7fb39b", bulb: "#cf8a36", bulbD: "#a3622a", bulbL: "#ebb366", neck: "#9a8a4c" };
function tube(x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, col: string, w = 3.2): string {
	return `<path d="M${f(x0)} ${f(y0)}Q${f(cx)} ${f(cy)} ${f(x1)} ${f(y1)}" stroke="${col}" stroke-width="${w}" stroke-linecap="round" fill="none"/>`;
}
function onion(st: St): string {
	if (st === "sprout") return tube(40, 87, 40, 76, 38, 66, ONI.a, 2.4) + tube(41, 87, 42, 78, 46, 70, ONI.b, 2.2);
	if (st === "leafy") return tube(39, 86, 36, 64, 26, 46, ONI.a) + tube(40, 86, 40, 62, 36, 38, ONI.b) + tube(40, 86, 42, 60, 46, 36, ONI.a) + tube(41, 86, 45, 64, 54, 46, ONI.b) + tube(40, 86, 38, 72, 30, 62, ONI.b, 2.8);
	return (
		tube(39, 72, 36, 50, 30, 24, ONI.a) +
		tube(40, 72, 40, 46, 42, 16, ONI.b) +
		tube(41, 72, 46, 50, 52, 26, ONI.a) +
		tube(39, 72, 28, 52, 14, 52, ONI.b, 3) +
		tube(41, 72, 54, 48, 66, 56, ONI.b, 3) +
		`<path d="M40 64C42.5 70 51 73 51 80.5C51 86.5 45.5 88 40 88C34.5 88 29 86.5 29 80.5C29 73 37.5 70 40 64Z" fill="${ONI.bulb}"/>` +
		`<path d="M37.2 70Q33 76 34.6 87.4M42.8 70Q47 76 45.4 87.4" stroke="${ONI.bulbD}" stroke-width=".9" fill="none"/>` +
		`<path d="M33.2 77Q32.2 81 33.6 84.6" stroke="${ONI.bulbL}" stroke-width="1.4" stroke-linecap="round" fill="none"/>` +
		`<path d="M38.6 64.5L40 61L41.4 64.5Z" fill="${ONI.neck}"/>`
	);
}

// ── 24. Broccoli ────────────────────────────────────────────────────────
const BRO = { leaf: "#5c8e78", light: "#77a690", rib: "#c3d9cc", stalk: "#a5c391", head: "#3d6c46", head2: "#4e8455", head3: "#6aa266" };
function broccoliHead(cx: number, cy: number, s: number): string {
	const rows: [number, number, number][] = [
		[10, 7, 4.2],
		[4, 6, 4.6],
		[-2, 5, 4.8],
		[-7.5, 3, 4.6],
		[-11.5, 2, 3.8],
	];
	const A: P3[] = [];
	const B: P3[] = [];
	const C: P3[] = [];
	rows.forEach(([dy, n, r], ri) => {
		const span = (n - 1) * r * 1.35;
		for (let i = 0; i < n; i++) {
			const x = cx + (-span / 2 + (n === 1 ? 0 : (i * span) / (n - 1))) * s;
			const y = cy + dy * s;
			((i + ri) % 2 ? A : B).push([x, y, r * s]);
			C.push([x - r * 0.3 * s, y - r * 0.35 * s, r * 0.32 * s]);
		}
	});
	return dots(A, BRO.head) + dots(B, BRO.head2) + dots(C, BRO.head3);
}
function broccoli(st: St): string {
	const o: LeafOptions = { fill: BRO.leaf, dark: BRO.rib };
	const ol: LeafOptions = { fill: BRO.light, dark: BRO.rib };
	if (st === "sprout") return stem([[40, 87], [40, 82], [40, 79], [40, 75]], BRO.stalk, 2) + leaf(40, 76, -150, 8, 5, { fill: BRO.light, shape: 4, rib: false }) + leaf(40, 76, -30, 8, 5, { fill: BRO.leaf, shape: 4, rib: false });
	if (st === "leafy") return line(40, 87, 40, 56, BRO.stalk, 4.2) + leaf(40, 80, -165, 20, 7, o) + leaf(40, 76, -15, 20, 7, o) + leaf(40, 68, -130, 20, 7, ol) + leaf(40, 66, -50, 20, 7, ol) + leaf(40, 58, -100, 14, 5, o) + leaf(40, 58, -80, 14, 5, ol);
	return (
		line(40, 87, 40, 46, BRO.stalk, 5.4) +
		leaf(40, 82, -168, 24, 8, o) +
		leaf(40, 78, -12, 24, 8, o) +
		leaf(40, 70, -140, 24, 8, ol) +
		leaf(40, 66, -40, 24, 8, ol) +
		segs([[40, 52, 32, 44], [40, 52, 48, 44], [40, 50, 40, 40]], BRO.stalk, 2.2) +
		broccoliHead(40, 36, 1)
	);
}

// ── 25. Beet ────────────────────────────────────────────────────────────
const BEET = { leaf: "#3f7b42", light: "#559452", rib: "#b0284f", root: "#8b1e45", rootL: "#b9446e", tail: "#6c1434" };
function beetLeaves(x: number, y: number, list: T4[]): string {
	let s = "";
	list.forEach(([a, sl, l, w], i) => {
		const [bx, by2] = polar(x, y, a, sl);
		const [rx, ry] = polar(bx, by2, a, l * 0.8);
		s += leaf(bx, by2, a, l, w, { fill: i % 2 ? BEET.light : BEET.leaf, rib: false }) + line(x, y, bx, by2, BEET.rib, 1.6) + line(bx, by2, rx, ry, BEET.rib, 0.9);
	});
	return s;
}
function beet(st: St): string {
	if (st === "sprout") return line(40, 87, 40, 77, BEET.rib, 1.5) + leaf(40, 78, -150, 10, 2.8, { fill: BEET.light, shape: 1, rib: false }) + leaf(40, 78, -30, 10, 2.8, { fill: BEET.light, shape: 1, rib: false }) + leaf(40, 77, -92, 6, 2.6, { fill: BEET.leaf, rib: false });
	if (st === "leafy")
		return (
			beetLeaves(40, 83, [
				[-140, 8, 16, 5.4],
				[-112, 10, 19, 6],
				[-88, 11, 20, 6.2],
				[-64, 10, 19, 6],
				[-38, 8, 16, 5.4],
			]) + ell(40, 84.5, 5, 3.5, BEET.root)
		);
	return (
		beetLeaves(40, 72, [
			[-150, 9, 19, 6.4],
			[-124, 12, 22, 7],
			[-100, 14, 24, 7.4],
			[-78, 14, 24, 7.4],
			[-55, 12, 22, 7],
			[-30, 9, 19, 6.4],
		]) +
		`<path d="M40 70.5C47 70.5 50.5 75 50 80C49.5 84 44 86.5 40.6 88.4C40.2 88.6 39.8 88.6 39.4 88.4C36 86.5 30.5 84 30 80C29.5 75 33 70.5 40 70.5Z" fill="${BEET.root}"/>` +
		ell(35.6, 76.6, 2, 3.4, BEET.rootL, 25) +
		segs([[42, 80, 46, 79.6], [37, 83.4, 41, 84]], BEET.tail, 0.7)
	);
}

export const SPECIES: Species[] = [
	{ id: "basil", name: "Basil", draw: basil },
	{ id: "mint", name: "Mint", draw: mint },
	{ id: "rosemary", name: "Rosemary", draw: rosemary },
	{ id: "thyme", name: "Thyme", draw: thyme },
	{ id: "sage", name: "Sage", draw: sage },
	{ id: "lavender", name: "Lavender", draw: lavender },
	{ id: "parsley", name: "Parsley", draw: parsley },
	{ id: "cilantro", name: "Cilantro", draw: cilantro },
	{ id: "dill", name: "Dill", draw: dill },
	{ id: "chamomile", name: "Chamomile", draw: chamomile },
	{ id: "tomato", name: "Tomato", draw: tomato },
	{ id: "pepper", name: "Pepper", draw: pepper },
	{ id: "eggplant", name: "Eggplant", draw: eggplant },
	{ id: "carrot", name: "Carrot", draw: carrot },
	{ id: "radish", name: "Radish", draw: radish },
	{ id: "lettuce", name: "Lettuce", draw: lettuce },
	{ id: "cabbage", name: "Cabbage", draw: cabbage },
	{ id: "kale", name: "Kale", draw: kale },
	{ id: "pea", name: "Pea", draw: pea },
	{ id: "strawberry", name: "Strawberry", draw: strawberry },
	{ id: "pumpkin", name: "Pumpkin", draw: pumpkin },
	{ id: "garlic", name: "Garlic", draw: garlic },
	{ id: "onion", name: "Onion", draw: onion },
	{ id: "broccoli", name: "Broccoli", draw: broccoli },
	{ id: "beet", name: "Beet", draw: beet },
];
