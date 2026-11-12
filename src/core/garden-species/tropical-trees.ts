/**
 * Tropical trees: 25 species in the garden's flat style (see kit.ts). Each
 * grows from a sapling (sprout) to a young tree (leafy) to its signature
 * fullest form (bloom): flowers, pods, prop roots or its typical silhouette.
 */
import { f, leaf, line, stem, type GrowingStage, type Pt, type Species } from "./kit";

type St = GrowingStage;
type XY = readonly [number, number];

/* ---------------- private helpers ---------------- */

const path = (d: string, fill: string): string => `<path d="${d}" fill="${fill}"/>`;
const strokeD = (d: string, stroke: string, w: number): string => `<path d="${d}" stroke="${stroke}" stroke-width="${f(w)}" stroke-linecap="round" fill="none"/>`;

function ell(x: number, y: number, rx: number, ry: number, fill: string, rot = 0): string {
	const t = rot ? ` transform="rotate(${f(rot)} ${f(x)} ${f(y)})"` : "";
	return `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(rx)}" ry="${f(ry)}" fill="${fill}"${t}/>`;
}

/** An axis-aligned ellipse as subpath data (two arcs), for merging. */
const ellD = (x: number, y: number, rx: number, ry: number = rx): string =>
	`M${f(x - rx)} ${f(y)}a${f(rx)} ${f(ry)} 0 1 0 ${f(2 * rx)} 0a${f(rx)} ${f(ry)} 0 1 0 ${f(-2 * rx)} 0Z`;

/** Round dots in one stroked path (zero-length segments with round caps). */
const dots = (pts: readonly XY[], r: number, fill: string): string =>
	pts.length ? strokeD(pts.map(([x, y]) => `M${f(x)} ${f(y)}h0`).join(""), fill, 2 * r) : "";

/** Merges path data per fill into one <path> each, in first-seen order. */
class Ink {
	private parts = new Map<string, string>();
	add(fill: string, d: string): this {
		this.parts.set(fill, (this.parts.get(fill) ?? "") + d);
		return this;
	}
	toString(): string {
		return [...this.parts].map(([fill, d]) => path(d, fill)).join("");
	}
}

/** Merges stroked path data per (colour, width). */
class Pen {
	private parts = new Map<string, string>();
	add(stroke: string, w: number, d: string): this {
		const k = `${stroke}|${f(w)}`;
		this.parts.set(k, (this.parts.get(k) ?? "") + d);
		return this;
	}
	line(stroke: string, w: number, x1: number, y1: number, x2: number, y2: number): this {
		return this.add(stroke, w, `M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}`);
	}
	curve(stroke: string, w: number, p: readonly [Pt, Pt, Pt, Pt]): this {
		const [a, b, c, d] = p;
		return this.add(stroke, w, `M${f(a[0])} ${f(a[1])}C${f(b[0])} ${f(b[1])} ${f(c[0])} ${f(c[1])} ${f(d[0])} ${f(d[1])}`);
	}
	toString(): string {
		return [...this.parts].map(([k, d]) => {
			const [s, w] = k.split("|");
			return strokeD(d, s ?? "#000", Number(w));
		}).join("");
	}
}

/** Maps local coordinates (u along, v across) at (x, y) rotated by deg to "x y". */
function mapper(x: number, y: number, deg: number): (u: number, v: number) => string {
	const c = Math.cos((deg * Math.PI) / 180);
	const s = Math.sin((deg * Math.PI) / 180);
	return (u, v) => `${f(x + c * u - s * v)} ${f(y + s * u + c * v)}`;
}

/** A leaf outline in absolute coordinates: 1 pointed lens, 0 oval. */
function lensD(x: number, y: number, deg: number, len: number, w: number, shape: 0 | 1 = 1): string {
	const P = mapper(x, y, deg);
	const [a, b, c] = shape === 1 ? [0.45, 1.15, 0.5] : [0.3, 1, 1];
	return `M${P(0, 0)}C${P(len * a, -w * b)} ${P(len * 0.8, -w * c)} ${P(len, 0)}C${P(len * 0.8, w * c)} ${P(len * a, w * b)} ${P(0, 0)}Z`;
}

/** A cheaper pointed leaflet (two quadratics), for dense foliage. */
function qLensD(x: number, y: number, deg: number, len: number, w: number): string {
	const P = mapper(x, y, deg);
	return `M${P(0, 0)}Q${P(len * 0.45, -w * 1.5)} ${P(len, 0)}Q${P(len * 0.45, w * 1.5)} ${P(0, 0)}Z`;
}

/** A tapered trunk from the ground at x0 (width w0, flared foot) to (x1, y1) (width w1). */
function trunk(x0: number, x1: number, y1: number, w0: number, w1: number, fill: string): string {
	const y0 = 87.5;
	const fl = w0 * 0.35;
	return path(
		`M${f(x0 - w0 / 2 - fl)} ${y0}Q${f(x0 - w0 / 2)} ${f(y0 - 1)} ${f(x0 - w0 / 2)} ${f(y0 - 4)}L${f(x1 - w1 / 2)} ${f(y1)}L${f(x1 + w1 / 2)} ${f(y1)}L${f(x0 + w0 / 2)} ${f(y0 - 4)}Q${f(x0 + w0 / 2)} ${f(y0 - 1)} ${f(x0 + w0 / 2 + fl)} ${y0}Z`,
		fill,
	);
}

/** Points spread evenly over an ellipse (sunflower spiral), deterministic. */
function scatter(cx: number, cy: number, rx: number, ry: number, n: number): [number, number, number][] {
	const out: [number, number, number][] = [];
	for (let i = 0; i < n; i++) {
		const a = i * 2.39996;
		const r = Math.sqrt((i + 0.5) / n);
		out.push([cx + Math.cos(a) * r * rx, cy + Math.sin(a) * r * ry, a]);
	}
	return out;
}

type Blob = readonly [number, number, number];
/** Circles of one colour merged into one path. */
const blobs = (cs: readonly Blob[], fill: string): string => path(cs.map(([x, y, r]) => ellD(x, y, r)).join(""), fill);

/** A sapling: a thin stem with leaves drawn at its top by `top(x, y)`. */
function sapling(h: number, top: (x: number, y: number) => string, color: string, w = 1.8): string {
	return line(40, 87, 40, 87 - h, color, w) + top(40, 87 - h);
}

/** A pinnate leaf: a curving rachis with paired leaflets, two tones. */
function pinnate(x: number, y: number, deg: number, len: number, bend: number, leaflet: number, rib: string, a: string, b: string, n = 8, ratio = 0.3): string {
	const step = len / n;
	let ang = (deg * Math.PI) / 180;
	let px = x;
	let py = y;
	let d = `M${f(x)} ${f(y)}`;
	const ink = new Ink();
	for (let j = 1; j <= n; j++) {
		ang += (bend * Math.PI) / 180 / n;
		px += Math.cos(ang) * step;
		py += Math.sin(ang) * step;
		d += `L${f(px)} ${f(py)}`;
		if (j >= 2 && j < n) {
			const l = (1 - j / n) * leaflet + 1.6;
			const ad = (ang * 180) / Math.PI;
			ink.add(a, qLensD(px, py, ad - 62, l, l * ratio)).add(b, qLensD(px, py, ad + 62, l, l * ratio));
		}
	}
	return strokeD(d, rib, 1.1) + ink;
}

/** A palmately compound leaf: n leaflets fanned around `deg` (default up). */
function palmateD(x: number, y: number, n: number, len: number, w: number, deg = -90, spread = 150): string {
	let d = "";
	for (let i = 0; i < n; i++) d += qLensD(x, y, deg - spread / 2 + (spread * i) / (n - 1), len * (1 - Math.abs(i - (n - 1) / 2) * 0.12), w * 0.85);
	return d;
}

/** Scattered leaves over an ellipse, each pointing via `dir` (default outward). */
function leafCrown(ink: Ink, cx: number, cy: number, rx: number, ry: number, n: number, len: number, w: number, cols: readonly string[], dir?: (x: number, y: number, a: number) => number, shape: 0 | 1 = 1): void {
	scatter(cx, cy, rx, ry, n).forEach(([x, y, a], i) => {
		const deg = dir ? dir(x, y, a) : (Math.atan2(y - cy, x - cx) * 180) / Math.PI;
		ink.add(cols[i % cols.length] ?? "#6fb35a", shape === 1 ? qLensD(x, y, deg, len, w) : lensD(x, y, deg, len, w, 0));
	});
}

/* ---------------- 1. Rainbow eucalyptus ---------------- */

const RB = ["#6f9a4a", "#d98a3a", "#5e7fa6", "#8a5a8a", "#a24a3a", "#c9b25a"] as const;

/** A patchwork of bark colours over a tapered trunk. */
function stripes(x0: number, y0: number, x1: number, y1: number, w0: number, w1: number, cols: number, rows: number): string {
	const ink = new Ink();
	const pt = (t: number, u: number) => `${f(x0 + (x1 - x0) * t + (u - 0.5) * (w0 + (w1 - w0) * t))} ${f(y0 + (y1 - y0) * t)}`;
	const b = (r: number, c: number) => (r <= 0 ? 0 : r >= rows ? 1 : (r + (((c * 7 + r * 3) % 5) - 2) * 0.22) / rows);
	for (let r = 0; r < rows; r++)
		for (let c = 0; c < cols; c++) {
			const u0 = c / cols;
			const u1 = (c + 1) / cols;
			ink.add(RB[(c * 2 + r * 3 + c * r) % RB.length] ?? RB[0], `M${pt(b(r, c), u0)}L${pt(b(r, c), u1)}L${pt(b(r + 1, c), u1)}L${pt(b(r + 1, c), u0)}Z`);
		}
	return ink.toString();
}

function rainbowEucalyptus(stage: St): string {
	const cl = (ink: Ink, x: number, y: number, s: number) => {
		for (let i = 0; i < 6; i++) ink.add(i % 2 ? "#5f8a4a" : "#80a85c", qLensD(x - 6 * s + 2.4 * s * i, y + 2 * s, 90 + (i - 2.5) * 16, (6 + (i % 3)) * s, 1.2 * s));
		ink.add("#4d7540", ellD(x - 3 * s, y, 5.5 * s) + ellD(x + 3 * s, y - s, 5.5 * s));
		ink.add("#6f9a52", ellD(x - 2.5 * s, y - 2.5 * s, 3 * s));
		ink.add("#80a85c", qLensD(x - 8 * s, y, 160, 6 * s, 1.2 * s) + qLensD(x + 8 * s, y - s, 20, 6 * s, 1.2 * s));
	};
	if (stage === "sprout") {
		const ink = new Ink();
		[30, 150, 60, 120].forEach((a, i) => ink.add(i % 2 ? "#5f8a4a" : "#80a85c", lensD(40, 72 + (i > 1 ? 4 : 0), a - (a < 90 ? 70 : -70), 8, 1.5)));
		ink.add("#80a85c", lensD(40, 70, -90, 6, 1.4));
		return stripes(40, 87, 40, 70, 2.6, 1.6, 2, 3) + ink;
	}
	if (stage === "leafy") {
		const ink = new Ink();
		cl(ink, 30, 44, 0.85);
		cl(ink, 50, 42, 0.85);
		cl(ink, 40, 36, 0.9);
		return trunk(40, 40, 48, 6.5, 3.5, "#7f8f5a") + stripes(40, 86, 40, 48, 6.5, 3.5, 3, 4) + line(40, 52, 31, 45, "#a26a44", 1.4) + line(40, 50, 49, 43, "#a26a44", 1.4) + ink;
	}
	const ink = new Ink();
	for (const [x, y, s] of [[18, 32, 1], [62, 30, 1], [26, 20, 1.05], [54, 19, 1.05], [40, 11, 1.05]] as const) cl(ink, x, y, s);
	const pen = new Pen()
		.curve("#a26a44", 2.2, [[40, 46], [34, 40], [24, 36], [18, 32]])
		.curve("#a26a44", 2.2, [[40, 44], [46, 38], [56, 34], [62, 30]])
		.curve("#a26a44", 1.8, [[40, 38], [36, 32], [30, 26], [26, 21]])
		.curve("#a26a44", 1.8, [[40, 36], [44, 30], [50, 24], [54, 20]])
		.line("#a26a44", 1.8, 40, 34, 40, 13);
	return trunk(40, 40, 32, 11, 5, "#7f8f5a") + stripes(40, 86, 40, 32, 11, 5, 4, 6) + pen + ink;
}

/* ---------------- 2. Kapok ---------------- */

const KB = "#9e998d";
const KD = "#7d786e";

function buttress(h: number, spread: number, w: number): string {
	return (
		path(`M${f(40 - spread)} 87.5Q${f(40 - w / 2)} 86 ${f(40 - w / 2)} ${f(87.5 - h)}L${f(40 + w / 2)} ${f(87.5 - h)}Q${f(40 + w / 2)} 86 ${f(40 + spread)} 87.5Z`, KB) +
		new Pen().line(KD, 0.9, 40 - spread * 0.55, 87.4, 40 - w / 2, 87.5 - h * 0.6).line(KD, 0.9, 40 + spread * 0.55, 87.4, 40 + w / 2, 87.5 - h * 0.6).line(KD, 0.9, 40, 87.4, 40, 87.5 - h * 0.5)
	);
}

function kapok(stage: St): string {
	const pad = (ink: Ink, x: number, y: number, rx: number, ry: number) => ink.add("#4b7a3c", ellD(x, y, rx, ry)).add("#6a9a4f", ellD(x - rx * 0.1, y - ry * 0.35, rx * 0.72, ry * 0.5));
	const fluff = (x: number, y: number): XY[] => [[x, y], [x + 1.8, y - 0.8], [x - 1.4, y - 1.2]];
	if (stage === "sprout")
		return sapling(16, (x, y) => path(palmateD(x, y, 5, 7.5, 2.2, -90, 170), "#5f9a48") + dots([[40, 82], [40, 77]], 0.6, KD), KB, 2);
	if (stage === "leafy") {
		const ink = new Ink();
		pad(ink, 28, 52, 9, 3.4);
		pad(ink, 52, 51, 9, 3.4);
		pad(ink, 40, 41, 11, 4.4);
		return trunk(40, 40, 40, 4, 2.5, KB) + buttress(9, 8, 4) + new Pen().line(KB, 1.6, 40, 55, 28, 52).line(KB, 1.6, 40, 54, 52, 51) + ink;
	}
	const ink = new Ink();
	pad(ink, 15, 42, 11, 4);
	pad(ink, 65, 42, 11, 4);
	pad(ink, 23, 31, 11, 4.5);
	pad(ink, 57, 31, 11, 4.5);
	pad(ink, 40, 21, 15, 6);
	const pen = new Pen().line(KB, 2.2, 40, 48, 15, 43).line(KB, 2.2, 40, 48, 65, 43).line(KB, 2, 40, 37, 23, 32).line(KB, 2, 40, 37, 57, 32);
	const fl: XY[] = [];
	for (const [x, y] of [[10, 38], [20, 38], [62, 38], [70, 39], [27, 27], [52, 27], [34, 16], [46, 16], [42, 23]] as const) fl.push(...fluff(x, y));
	return (
		trunk(40, 40, 22, 6.5, 4, KB) +
		buttress(20, 16, 6.5) +
		dots([[39, 70], [41.5, 62], [38.5, 55], [41, 46], [39, 40], [41, 30]], 0.6, KD) +
		pen +
		ink +
		dots(fl, 1.7, "#f3f0e8") +
		dots([[8, 24], [70, 18], [22, 12], [62, 54]], 1.2, "#e2ddd2") +
		dots([[11, 39.5], [21, 39.5], [63, 39.5], [71, 40.5], [35, 17.5], [47, 17.5]], 0.6, "#6b5a3e")
	);
}

/* ---------------- 3. Royal poinciana ---------------- */

const RP = ["#c33a26", "#e0522c", "#f08a3a"] as const;

function royalPoinciana(stage: St): string {
	const bk = "#8c7560";
	const fringe = (x0: number, x1: number, yf: (x: number) => number, len: number) => {
		const ink = new Ink();
		for (let x = x0, i = 0; x <= x1; x += 2.6, i++) ink.add(i % 2 ? "#6aa04a" : "#4f8a3a", lensD(x, yf(x) - 1, 90 + (x - 40) * 0.8, len, len * 0.28));
		return ink.toString();
	};
	if (stage === "sprout") {
		const fr = (deg: number, bend: number) => pinnate(40, 72, deg, 11, bend, 3.6, "#3f7a35", "#8cc46a", "#6fb35a");
		return line(40, 87, 40, 72, bk, 1.8) + fr(-160, 12) + fr(-20, -12) + fr(-90, 0) + dots([[40, 61], [38.6, 62.4], [41.4, 62.4]], 1.2, RP[1]);
	}
	if (stage === "leafy") {
		const pen = new Pen().curve(bk, 2, [[40, 66], [36, 60], [28, 58], [20, 56]]).curve(bk, 2, [[40, 66], [44, 60], [52, 58], [60, 55]]);
		const fl = scatter(40, 47, 18, 3, 9).map(([x, y]) => [x, y] as XY);
		return trunk(40, 40, 62, 5, 3.5, bk) + pen + fringe(16, 64, (x) => 56 - Math.abs(x - 40) * 0.05, 5) + path("M14 56Q16 44 40 42Q64 44 66 56Q40 61 14 56Z", "#4f8a3a") + path("M20 51Q24 45 40 44Q56 45 60 51Q40 49 20 51Z", "#6aa04a") + dots(fl, 1.8, RP[1]);
	}
	const pen = new Pen()
		.curve(bk, 3.4, [[40, 64], [32, 56], [20, 50], [12, 44]])
		.curve(bk, 3.4, [[40, 64], [48, 56], [60, 50], [68, 44]])
		.curve(bk, 2.6, [[40, 62], [36, 52], [30, 46], [26, 40]])
		.curve(bk, 2.6, [[40, 62], [44, 52], [50, 46], [54, 40]]);
	const pods = new Pen().curve("#5a3a24", 1.8, [[20, 46], [17, 52], [18, 58], [21, 63]]).curve("#5a3a24", 1.8, [[58, 46], [61, 52], [61, 57], [58, 62]]).curve("#5a3a24", 1.8, [[33, 47], [32, 53], [34, 57], [36, 60]]);
	const ink = new Ink();
	scatter(40, 33, 31, 8, 64).forEach(([x, y], i) => ink.add(RP[i % 3] ?? RP[0], ellD(x, y, 2.7)));
	return (
		trunk(40, 40, 60, 7, 5, bk) +
		pen +
		pods +
		fringe(8, 72, (x) => 46 - Math.abs(x - 40) * 0.06, 5.5) +
		path("M6 44Q8 30 40 28Q72 30 74 44Q40 50 6 44Z", "#4f8a3a") +
		ell(40, 35, 32, 8, RP[0]) +
		ink +
		dots([[22, 30], [44, 27], [58, 33], [30, 37]], 0.8, "#f6d36a")
	);
}

/* ---------------- 4. Banyan ---------------- */

const BY = ["#3f6e3a", "#55893f", "#74a552"] as const;
const BYR = "#9b8574";

function banyan(stage: St): string {
	const bt = "#8a7462";
	if (stage === "sprout")
		return sapling(16, (x, y) => leaf(x, y + 3, -155, 9, 4.4, { fill: BY[1], shape: 2, dark: "#2c5229" }) + leaf(x, y + 3, -25, 9, 4.4, { fill: BY[0], shape: 2, dark: "#2c5229" }) + leaf(x, y, -90, 7, 3.4, { fill: BY[2], shape: 2, dark: "#2c5229" }) + line(35, 80, 35, 85, BYR, 0.6), bt) + line(40, 80, 35, 80, bt, 1.2);
	if (stage === "leafy") {
		const pen = new Pen().line(BYR, 0.8, 24, 58, 24, 74).line(BYR, 0.8, 56, 58, 56, 78).line(BYR, 0.8, 30, 60, 30, 70);
		return (
			path("M35 87.5Q37 78 38 70Q38 64 36 58L44 58Q42 64 42 70Q43 78 45 87.5Z", bt) +
			pen +
			blobs([[22, 54, 7], [58, 54, 7], [32, 48, 9], [48, 48, 9], [40, 44, 9]], BY[0]) +
			blobs([[27, 51, 6], [53, 50, 6], [40, 48, 8]], BY[1]) +
			blobs([[36, 44, 4], [48, 45, 3]], BY[2])
		);
	}
	const pen = new Pen();
	for (const x of [9, 19, 61, 71]) pen.line(BYR, 2.6, x, 40, x, 87.4);
	for (const [x, y] of [[14, 72], [25, 64], [30, 76], [52, 70], [55, 60], [66, 78], [47, 66]] as const) pen.line(BYR, 0.8, x, 42, x, y);
	return (
		path("M28 87.5Q33 76 35 62Q36 52 33 44L47 44Q44 52 45 62Q47 76 52 87.5Z", bt) +
		new Pen().line("#75604f", 0.9, 38, 84, 38.5, 54).line("#75604f", 0.9, 43, 84, 42, 56) +
		pen +
		blobs([[10, 38, 8], [70, 38, 8], [20, 30, 11], [60, 30, 11], [40, 24, 13], [30, 38, 9], [50, 38, 9]], BY[0]) +
		blobs([[15, 33, 7], [65, 33, 7], [40, 32, 14], [29, 24, 8], [51, 24, 8]], BY[1]) +
		blobs([[27, 28, 4.5], [51, 28, 4.5], [40, 19, 5.5], [15, 30, 3.5], [64, 30, 3.5]], BY[2]) +
		dots([[22, 36], [33, 30], [46, 36], [58, 28], [40, 26], [68, 38], [12, 40]], 1, "#c9413a")
	);
}

/* ---------------- 5. Mahogany ---------------- */

const MH = ["#2f5e34", "#3f7440", "#57904f"] as const;
const MHB = "#7a4634";

function mahogany(stage: St): string {
	const capsule = (x: number, y: number) => ell(x, y, 2.4, 3.6, "#8a5a36") + ell(x, y - 3.4, 1, 0.8, "#6e4426") + new Pen().line("#5e3a22", 0.6, x, y - 3, x, y + 3).toString();
	const split = (x: number, y: number) => {
		let d = "";
		for (let i = 0; i < 5; i++) d += lensD(x, y, -90 + i * 72, 4.4, 1.3, 0);
		return path(d, "#a8784a") + dots([[x, y]], 1, "#5e3a22");
	};
	if (stage === "sprout")
		return sapling(16, (x, y) => {
			let s = line(x, y + 1, x, y - 6, MHB, 1.1);
			[0, 3, 6].forEach((k, i) => (s += leaf(x, y - k, -160 + i * 8, 7 - i, 3 - i * 0.4, { fill: MH[2], dark: MH[0], shape: 1 }) + leaf(x, y - k, -20 - i * 8, 7 - i, 3 - i * 0.4, { fill: MH[1], dark: MH[0], shape: 1 })));
			return s;
		}, MHB);
	if (stage === "leafy") {
		const ink = new Ink();
		ink.add(MH[0], ellD(40, 48, 13, 11));
		leafCrown(ink, 40, 48, 12, 10, 18, 6, 2.2, [MH[1], MH[2]]);
		return trunk(40, 40, 56, 5, 3, MHB) + ink + capsule(46, 40);
	}
	const ink = new Ink();
	ink.add(MH[0], ellD(27, 38, 14, 12) + ellD(53, 38, 14, 12) + ellD(40, 25, 17, 14));
	leafCrown(ink, 27, 38, 13, 11, 20, 6, 2.2, [MH[1], MH[2]]);
	leafCrown(ink, 53, 38, 13, 11, 20, 6, 2.2, [MH[2], MH[1]]);
	leafCrown(ink, 40, 25, 15, 12, 24, 6, 2.2, [MH[1], MH[2]]);
	return (
		trunk(40, 40, 46, 8, 4.5, MHB) +
		new Pen().line("#5e3326", 0.8, 38.5, 84, 39, 52).line("#5e3326", 0.8, 41.5, 82, 41, 56) +
		ink +
		capsule(24, 30) +
		capsule(51, 15) +
		capsule(60, 32) +
		capsule(34, 16) +
		capsule(42, 38) +
		split(46, 27) +
		split(20, 41)
	);
}

/* ---------------- 6. Teak ---------------- */

const TK = ["#6c9a45", "#86b05a"] as const;
const TKB = "#8c7a66";

function bigLeaves(list: readonly (readonly [number, number, number, number])[]): string {
	const ink = new Ink();
	const pen = new Pen();
	list.forEach(([x, y, a, s], i) => {
		ink.add(TK[i % 2] ?? TK[0], lensD(x, y, a, 13 * s, 6 * s, 0));
		const P = mapper(x, y, a);
		pen.add("#4a7034", 0.7, `M${P(1, 0)}L${P(11 * s, 0)}M${P(5 * s, 0)}L${P(8 * s, -3.5 * s)}M${P(5 * s, 0)}L${P(8 * s, 3.5 * s)}`);
	});
	return ink.toString() + pen;
}

function teak(stage: St): string {
	const panicle = (x: number, y: number, h: number): [string, XY[]] => {
		const pts: XY[] = [];
		let d = `M${f(x)} ${f(y)}L${f(x)} ${f(y - h)}`;
		for (let k = 1; k <= 4; k++) {
			const yy = y - (h * k) / 5;
			const hw = (h * (5 - k)) / 10;
			d += `M${f(x - hw)} ${f(yy - 1.5)}L${f(x)} ${f(yy)}L${f(x + hw)} ${f(yy - 1.5)}`;
			pts.push([x - hw, yy - 1.5], [x + hw, yy - 1.5], [x - hw / 2, yy - 1.2], [x + hw / 2, yy - 1.2]);
		}
		pts.push([x, y - h]);
		return [d, pts];
	};
	if (stage === "sprout") return sapling(13, (x, y) => bigLeaves([[x, y + 3, -160, 0.8], [x, y + 3, -20, 0.8]]) + dots([[x, y - 1]], 1.4, TK[1]), TKB);
	if (stage === "leafy")
		return trunk(40, 40, 50, 4.5, 2.5, TKB) + new Pen().line(TKB, 1.6, 40, 60, 30, 52).line(TKB, 1.6, 40, 56, 50, 48) + bigLeaves([[30, 52, -160, 1], [30, 52, -110, 0.9], [50, 48, -20, 1], [50, 48, -70, 0.9], [40, 50, -90, 0.9], [40, 60, 160, 0.8], [40, 58, 20, 0.8]]);
	const pen = new Pen();
	const pts: XY[] = [];
	for (const [x, y, h] of [[24, 27, 13], [56, 25, 13], [40, 17, 12]] as const) {
		const [d, p] = panicle(x, y, h);
		pen.add("#b6ac8a", 0.7, d);
		pts.push(...p);
	}
	return (
		trunk(40, 40, 42, 6.5, 3.5, TKB) +
		new Pen().curve(TKB, 2.4, [[40, 56], [34, 48], [28, 42], [24, 34]]).curve(TKB, 2.4, [[40, 54], [46, 46], [52, 40], [56, 32]]).line(TKB, 2, 40, 44, 40, 24) +
		bigLeaves([
			[24, 40, 170, 1], [24, 36, -150, 1], [24, 34, -110, 0.9], [26, 44, 140, 0.9],
			[56, 38, 10, 1], [56, 34, -30, 1], [56, 32, -70, 0.9], [54, 42, 40, 0.9],
			[40, 30, -120, 1], [40, 30, -60, 1], [40, 40, 150, 0.9], [40, 40, 30, 0.9], [40, 50, 160, 0.8], [40, 50, 20, 0.8],
		]) +
		pen +
		dots(pts, 1.15, "#f1ead2")
	);
}

/* ---------------- 7. Frangipani ---------------- */

const FB = "#9a9184";
const FG = ["#4e8a3e", "#66a04c"] as const;

function frangipani(stage: St): string {
	const rosette = (ink: Ink, x: number, y: number, s = 1) => [-165, -135, -110, -70, -45, -15].forEach((a, i) => ink.add(FG[i % 2] ?? FG[0], lensD(x, y, a, 11 * s, 3.1 * s)));
	const flower = (fl: Ink, ctr: XY[], x: number, y: number, r: number) => {
		for (let i = 0; i < 5; i++) {
			const a = -90 + i * 72;
			const P = mapper(x, y, a);
			fl.add("#fbf7ee", `M${P(0, 0)}Q${P(r * 0.5, -r * 1.1)} ${P(r, -r * 0.1)}Q${P(r * 0.5, r * 0.4)} ${P(0, 0)}Z`);
		}
		ctr.push([x, y]);
	};
	const cluster = (fl: Ink, ctr: XY[], x: number, y: number, three = true) => {
		flower(fl, ctr, x - 3.2, y - 4, 3.2);
		flower(fl, ctr, x + 3.2, y - 4.6, 3.2);
		if (three) flower(fl, ctr, x, y - 8, 3.2);
	};
	if (stage === "sprout") {
		const ink = new Ink();
		rosette(ink, 40, 75, 0.75);
		return line(40, 87, 40, 75, FB, 3.4) + ink;
	}
	const ink = new Ink();
	const fl = new Ink();
	const ctr: XY[] = [];
	if (stage === "leafy") {
		rosette(ink, 30, 56, 0.9);
		rosette(ink, 51, 54, 0.9);
		cluster(fl, ctr, 51, 54);
		return stem([[40, 87], [40, 78], [40, 72], [40, 68]], FB, 4.4) + new Pen().curve(FB, 3.2, [[40, 70], [35, 66], [31, 61], [30, 56]]).curve(FB, 3.2, [[40, 70], [45, 65], [50, 60], [51, 54]]) + ink + fl + dots(ctr, 1, "#f2c84b");
	}
	const tips: XY[] = [[14, 48], [27, 38], [40, 28], [53, 38], [66, 48]];
	tips.forEach(([x, y]) => rosette(ink, x, y));
	tips.forEach(([x, y], i) => cluster(fl, ctr, x, y, i % 2 === 0));
	const pen = new Pen()
		.curve(FB, 3.8, [[40, 72], [34, 66], [24, 62], [20, 56]])
		.curve(FB, 3.2, [[20, 58], [18, 54], [15, 51], [14, 48]])
		.curve(FB, 3.2, [[22, 60], [24, 52], [26, 44], [27, 38]])
		.curve(FB, 3.8, [[40, 72], [46, 66], [56, 62], [60, 56]])
		.curve(FB, 3.2, [[60, 58], [62, 54], [65, 51], [66, 48]])
		.curve(FB, 3.2, [[58, 60], [56, 52], [54, 44], [53, 38]])
		.curve(FB, 3.4, [[40, 72], [41, 56], [39, 40], [40, 28]]);
	return stem([[40, 87], [39, 80], [41, 76], [40, 70]], FB, 5.4) + pen + ink + fl + dots(ctr, 1.1, "#f2c84b");
}

/* ---------------- 8. Cannonball tree ---------------- */

function cannonballTree(stage: St): string {
	const bk = "#7d6a5a";
	const cg = ["#3d6e38", "#55893f", "#6fa152"] as const;
	const ball = (x: number, y: number, r: number) => ell(x, y, r, r, "#8a5a32") + ell(x - r * 0.35, y - r * 0.35, r * 0.35, r * 0.35, "#b07a4a");
	const flower = (x: number, y: number, r: number) => {
		let d = "";
		for (let i = 0; i < 6; i++) d += lensD(x, y, i * 60 + 15, r, r * 0.5, 0);
		return path(d, "#e06a7f") + dots([[x, y]], r * 0.35, "#f3c45a");
	};
	if (stage === "sprout") return sapling(17, (x, y) => leaf(x, y + 3, -150, 10, 3, { fill: cg[1], shape: 1 }) + leaf(x, y + 3, -30, 10, 3, { fill: cg[2], shape: 1 }) + leaf(x, y, -95, 8, 2.6, { fill: cg[2], shape: 1 }), bk);
	if (stage === "leafy") {
		const ink = new Ink();
		ink.add(cg[0], ellD(40, 37, 12, 9));
		leafCrown(ink, 40, 37, 11, 8, 14, 6, 1.8, [cg[1], cg[2]]);
		return trunk(40, 40, 40, 4.5, 2.5, bk) + ink + new Pen().curve("#6b5a48", 0.8, [[41, 66], [44, 66], [45, 68], [44, 70]]) + ball(45, 72, 2.6) + flower(37, 58, 3);
	}
	const ink = new Ink();
	ink.add(cg[0], ellD(40, 20, 21, 13) + ellD(26, 26, 9, 6) + ellD(54, 26, 9, 6));
	leafCrown(ink, 40, 20, 20, 12, 34, 7, 2, [cg[1], cg[2]]);
	const tangles = new Pen();
	for (const [x0, y0, x1, y1] of [[38, 46, 32, 50], [42, 54, 48, 58], [38, 64, 31, 68], [42, 44, 49, 44], [38, 74, 33, 78], [42, 70, 47, 72], [38, 54, 34, 59], [42, 62, 46, 48]] as const)
		tangles.curve("#6b5a48", 0.8, [[x0, y0], [(x0 + x1) / 2, y0 - 2], [x1, (y0 + y1) / 2], [x1, y1]]);
	return (
		trunk(40, 40, 24, 6.5, 3.5, bk) +
		new Pen().line(bk, 2, 40, 32, 28, 26).line(bk, 2, 40, 30, 52, 25) +
		ink +
		tangles +
		ball(32, 53, 4) +
		ball(48, 61, 4) +
		ball(31, 71, 3.8) +
		ball(49, 47, 3.6) +
		ball(33, 81, 3.4) +
		flower(47, 73, 3.4) +
		flower(34, 60, 3.2) +
		flower(46, 52, 2.8)
	);
}

/* ---------------- 9. Sausage tree ---------------- */

function sausageTree(stage: St): string {
	const bk = "#8a7d6c";
	const sg = ["#4a7f3c", "#5f9447", "#7aac58"] as const;
	const sausage = (x: number, y0: number, y: number, k = 1) => line(x, y0, x, y, "#6b5a44", 0.8) + ell(x, y + 7 * k, 2.4 * k, 7 * k, "#9b8460") + ell(x - 0.8 * k, y + 5.5 * k, 0.6 * k, 4 * k, "#b8a27c");
	const bells = (x: number, y0: number, y: number) => line(x, y0, x, y, "#6b5a44", 0.7) + path(`M${f(x - 2)} ${f(y)}Q${f(x)} ${f(y - 3)} ${f(x + 2)} ${f(y)}L${f(x + 2.4)} ${f(y + 3)}L${f(x - 2.4)} ${f(y + 3)}Z`, "#7a1f2e") + path(`M${f(x + 1)} ${f(y + 4)}Q${f(x + 3)} ${f(y + 3)} ${f(x + 4)} ${f(y + 6)}L${f(x + 2)} ${f(y + 8)}L${f(x)} ${f(y + 6)}Z`, "#8e2a38");
	if (stage === "sprout") return sapling(16, (x, y) => leaf(x, y + 4, -160, 8, 3, { fill: sg[1], shape: 0 }) + leaf(x, y + 4, -20, 8, 3, { fill: sg[2], shape: 0 }) + leaf(x, y, -90, 8, 3, { fill: sg[1], shape: 0 }), bk);
	if (stage === "leafy")
		return (
			trunk(40, 40, 54, 5, 3, bk) +
			new Pen().line(bk, 1.8, 40, 60, 28, 50).line(bk, 1.8, 40, 58, 52, 50) +
			blobs([[26, 48, 7], [54, 48, 7], [40, 42, 9]], sg[0]) +
			blobs([[30, 45, 5], [50, 44, 5], [40, 40, 6]], sg[1]) +
			bells(48, 52, 60)
		);
	return (
		trunk(40, 40, 52, 7, 4, bk) +
		new Pen().curve(bk, 3, [[40, 60], [32, 50], [22, 44], [14, 38]]).curve(bk, 3, [[40, 60], [48, 50], [58, 44], [66, 38]]).line(bk, 2.4, 40, 56, 32, 32).line(bk, 2.4, 40, 56, 48, 32) +
		blobs([[13, 33, 8], [67, 33, 8], [25, 28, 10], [55, 28, 10], [40, 23, 11], [32, 36, 7], [48, 36, 7]], sg[0]) +
		blobs([[18, 30, 6], [62, 30, 6], [40, 30, 9], [31, 22, 6], [50, 22, 6]], sg[1]) +
		blobs([[28, 26, 3.5], [48, 22, 4], [40, 17, 4], [60, 28, 3]], sg[2]) +
		sausage(17, 38, 50) +
		sausage(27, 38, 56) +
		sausage(54, 40, 52) +
		sausage(63, 38, 47, 0.9) +
		sausage(36, 40, 60, 0.9) +
		bells(46, 40, 48)
	);
}

/* ---------------- 10. Dragon blood tree ---------------- */

function dragonBloodTree(stage: St): string {
	const bk = "#a49a8a";
	const dg = ["#3d6a3a", "#4f7f45", "#6f9c55"] as const;
	const spikes = (cx: number, cy: number, rx: number, ry: number, n: number, len: number) => {
		const pen = new Pen();
		for (let i = 0; i <= n; i++) {
			const a = Math.PI + (Math.PI * i) / n;
			const x = cx + Math.cos(a) * rx;
			const y = cy + Math.sin(a) * ry;
			pen.line(dg[2], 1.2, x, y + 1, x + Math.cos(a) * len, y + Math.sin(a) * len);
		}
		return pen.toString();
	};
	const resin: XY[] = [[38, 66], [42, 74], [38.5, 80], [41.5, 60]];
	if (stage === "sprout") {
		let d = "";
		for (let i = 0; i < 9; i++) d += lensD(40, 76, -165 + i * 18.75, 10 - Math.abs(i - 4) * 0.8, 1.4);
		return line(40, 87, 40, 76, bk, 2.6) + path(d, dg[1]) + path(lensD(40, 76, -90, 9, 1.2) + lensD(40, 76, -60, 8, 1.2) + lensD(40, 76, -120, 8, 1.2), dg[2]);
	}
	if (stage === "leafy")
		return (
			path("M37 87.5Q37.5 76 38.5 66L41.5 66Q42.5 76 43 87.5Z", bk) +
			new Pen().line(bk, 2.6, 40, 67, 31, 56).line(bk, 2.6, 40, 67, 49, 56).line(bk, 2, 31, 57, 27, 52).line(bk, 2, 31, 57, 35, 52).line(bk, 2, 49, 57, 45, 52).line(bk, 2, 49, 57, 53, 52) +
			spikes(40, 54, 22, 16, 14, 2.4) +
			path("M18 56Q18 38 40 37Q62 38 62 56Q50 53 40 54Q30 53 18 56Z", dg[1]) +
			path("M24 46Q30 40 40 40Q50 40 56 46Q40 43 24 46Z", dg[2]) +
			path("M18 56Q30 52 40 53Q50 52 62 56Q50 54.5 40 55Q30 54.5 18 56Z", dg[0])
		);
	const pen = new Pen()
		.line(bk, 4.4, 40, 62, 29, 50)
		.line(bk, 4.4, 40, 62, 51, 50)
		.line(bk, 3.2, 29, 51, 20, 42)
		.line(bk, 3.2, 29, 51, 34, 40)
		.line(bk, 3.2, 51, 51, 46, 40)
		.line(bk, 3.2, 51, 51, 60, 42)
		.line(bk, 2.2, 20, 43, 14, 36)
		.line(bk, 2.2, 20, 43, 24, 35)
		.line(bk, 2.2, 34, 41, 31, 34)
		.line(bk, 2.2, 34, 41, 38, 34)
		.line(bk, 2.2, 46, 41, 42, 34)
		.line(bk, 2.2, 46, 41, 49, 34)
		.line(bk, 2.2, 60, 43, 56, 35)
		.line(bk, 2.2, 60, 43, 66, 36);
	return (
		path("M34.5 87.5Q35.5 74 36.5 61L43.5 61Q44.5 74 45.5 87.5Z", bk) +
		pen +
		spikes(40, 37, 34, 29, 24, 3) +
		path("M6 38Q6 9 40 8Q74 9 74 38Q58 33 40 34Q22 33 6 38Z", dg[1]) +
		path("M14 26Q22 13 40 12Q58 13 66 26Q40 20 14 26Z", dg[2]) +
		path("M6 38Q22 32 40 33Q58 32 74 38Q58 35.5 40 36Q22 35.5 6 38Z", dg[0]) +
		resin.map(([x, y]) => path(`M${f(x)} ${f(y - 2)}Q${f(x + 1.3)} ${f(y + 0.6)} ${f(x)} ${f(y + 1.2)}Q${f(x - 1.3)} ${f(y + 0.6)} ${f(x)} ${f(y - 2)}Z`, "#a3242a")).join("")
	);
}

/* ---------------- 11. Golden shower tree ---------------- */

function goldenShower(stage: St): string {
	const bk = "#8a6a50";
	const gg = ["#5a8d40", "#72a54e", "#8ebd62"] as const;
	const racemes = (list: readonly (readonly [number, number, number])[]) => {
		const pen = new Pen();
		const a: XY[] = [];
		const b: XY[] = [];
		const c: XY[] = [];
		for (const [x, y, len] of list) {
			pen.line("#9b8a3a", 0.6, x, y, x + 0.8, y + len);
			const n = Math.round(len / 2.1);
			for (let i = 0; i <= n; i++) {
				const t = i / n;
				const px = x + 0.8 * t + (i % 2 ? 0.6 : -0.6);
				const py = y + len * t;
				(t < 0.7 ? (i % 2 ? a : b) : c).push([px, py]);
			}
		}
		return pen + dots(a, 1.7, "#f2c72e") + dots(b, 1.6, "#f7dc5a") + dots(c, 1.1, "#e8c040");
	};
	if (stage === "sprout") return sapling(16, (x, y) => leaf(x, y + 4, -160, 8, 3.4, { fill: gg[1] }) + leaf(x, y + 4, -20, 8, 3.4, { fill: gg[2] }) + leaf(x, y + 1, -125, 7, 3, { fill: gg[2] }) + leaf(x, y + 1, -55, 7, 3, { fill: gg[1] }) + racemes([[x + 1, y + 1, 6]]), bk);
	if (stage === "leafy")
		return trunk(40, 40, 54, 4.5, 2.5, bk) + new Pen().line(bk, 1.8, 40, 62, 30, 52).line(bk, 1.8, 40, 60, 50, 50) + blobs([[28, 50, 7], [52, 48, 7], [40, 43, 9]], gg[0]) + blobs([[34, 44, 5], [48, 43, 4]], gg[2]) + racemes([[30, 52, 10], [44, 48, 12], [52, 50, 9]]);
	return (
		trunk(40, 40, 52, 6, 3.5, bk) +
		new Pen().curve(bk, 2.6, [[40, 62], [32, 54], [24, 48], [18, 40]]).curve(bk, 2.6, [[40, 60], [48, 52], [56, 46], [62, 38]]).line(bk, 2, 40, 54, 40, 28) +
		blobs([[16, 34, 8], [64, 32, 8], [27, 26, 10], [53, 25, 10], [40, 20, 10], [40, 34, 10]], gg[0]) +
		blobs([[22, 30, 6], [58, 28, 6], [34, 22, 6], [47, 21, 6]], gg[1]) +
		blobs([[30, 20, 3.5], [46, 16, 3.5], [60, 24, 3]], gg[2]) +
		new Pen().line("#3e2b1e", 1.8, 22, 40, 21, 60).line("#3e2b1e", 1.8, 60, 38, 61.5, 56) +
		racemes([[12, 36, 14], [18, 38, 20], [26, 33, 22], [33, 38, 20], [40, 40, 22], [47, 37, 21], [54, 34, 22], [60, 36, 18], [67, 34, 13], [30, 22, 12], [44, 21, 14], [56, 24, 10]])
	);
}

/* ---------------- 12. African tulip tree ---------------- */

const AT = ["#2f5a2e", "#3f6e38", "#55843f"] as const;

function africanTulip(stage: St): string {
	const bk = "#8a8072";
	const cups = (list: readonly (readonly [number, number, number])[], fl: Ink) => {
		for (const [cx, cy, n] of list)
			for (let i = 0; i < n; i++) {
				const a = -90 + (i - (n - 1) / 2) * (n > 3 ? 34 : 40);
				const P = mapper(cx, cy, a);
				// cup opening outward along +u, base at 1.5
				fl.add("#e4481e", `M${P(7, -3)}C${P(3.5, -3.3)} ${P(1.2, -1.8)} ${P(1.2, 0)}C${P(1.2, 1.8)} ${P(3.5, 3.3)} ${P(7, 3)}L${P(5.8, 1.5)}L${P(7.2, 0)}L${P(5.8, -1.5)}Z`);
				fl.add("#f2b13a", `M${P(7, -3)}L${P(5.8, -1.5)}L${P(7.2, 0)}L${P(5.8, 1.5)}L${P(7, 3)}L${P(6.2, 1.4)}L${P(6.6, 0)}L${P(6.2, -1.4)}Z`);
			}
	};
	if (stage === "sprout") return sapling(16, (x, y) => pinnate(x, y + 2, -150, 10, 15, 4, AT[0], AT[2], AT[1], 6, 0.38) + pinnate(x, y + 2, -30, 10, -15, 4, AT[0], AT[1], AT[2], 6, 0.38) + pinnate(x, y + 2, -90, 9, 0, 3.6, AT[0], AT[2], AT[1], 6, 0.38), bk);
	if (stage === "leafy") {
		const fl = new Ink();
		cups([[44, 38, 1]], fl);
		const buds = new Ink();
		for (let i = 0; i < 5; i++) buds.add("#7c7a3a", lensD(34, 40, -150 + i * 22, 4.5, 1.2));
		return trunk(40, 40, 54, 4.5, 2.5, bk) + blobs([[32, 50, 8], [48, 50, 8], [40, 44, 10]], AT[0]) + blobs([[36, 46, 6], [46, 44, 5]], AT[1]) + blobs([[38, 41, 3]], AT[2]) + buds + fl;
	}
	const fl = new Ink();
	cups([[22, 28, 4], [40, 15, 4], [58, 26, 4], [31, 40, 3], [50, 40, 3], [14, 42, 2], [66, 42, 2]], fl);
	return (
		trunk(40, 40, 50, 6.5, 3.5, bk) +
		new Pen().line(bk, 2.4, 40, 60, 30, 52).line(bk, 2.4, 40, 58, 52, 50) +
		blobs([[14, 44, 8], [66, 44, 8], [22, 32, 11], [58, 32, 11], [40, 22, 13], [30, 46, 8], [50, 46, 8], [40, 38, 11]], AT[0]) +
		blobs([[20, 38, 6], [60, 38, 6], [32, 28, 7], [48, 27, 7], [40, 33, 8]], AT[1]) +
		blobs([[28, 22, 3.5], [50, 20, 3.5], [40, 26, 4]], AT[2]) +
		fl
	);
}

/* ---------------- 13. Moringa ---------------- */

const MO = ["#7fae4f", "#9cc46a"] as const;

function lacy(dot: [XY[], XY[]], pen: Pen, x: number, y: number, deg: number, len: number, bend: number): void {
	const n = 7;
	let a = (deg * Math.PI) / 180;
	let px = x;
	let py = y;
	let d = `M${f(x)} ${f(y)}`;
	for (let j = 1; j <= n; j++) {
		a += (bend * Math.PI) / 180 / n;
		px += (Math.cos(a) * len) / n;
		py += (Math.sin(a) * len) / n;
		d += `L${f(px)} ${f(py)}`;
		const nx = -Math.sin(a) * 1.4;
		const ny = Math.cos(a) * 1.4;
		(j % 2 ? dot[1] : dot[0]).push([px + nx, py + ny], [px - nx, py - ny]);
	}
	dot[0].push([px + Math.cos(a) * 1.2, py + Math.sin(a) * 1.2]);
	pen.add("#6f9a42", 0.6, d);
}

function moringa(stage: St): string {
	const bk = "#b8a88a";
	const draw = (list: readonly (readonly [number, number, number, number, number])[]) => {
		const pts: [XY[], XY[]] = [[], []];
		const pen = new Pen();
		for (const [x, y, d, l, b] of list) lacy(pts, pen, x, y, d, l, b);
		return pen + dots(pts[0], 0.85, MO[0]) + dots(pts[1], 0.85, MO[1]);
	};
	if (stage === "sprout") return sapling(18, (x, y) => draw([[x, y + 2, -140, 9, -70], [x, y + 2, -40, 9, 70], [x, y, -90, 6, 0]]), bk, 1.4);
	if (stage === "leafy")
		return (
			stem([[40, 87], [39, 76], [42, 66], [40, 52]], bk, 2.4) +
			new Pen().line(bk, 1.2, 40, 60, 32, 52).line(bk, 1.2, 40, 56, 48, 50) +
			draw([[32, 52, -140, 12, -80], [32, 52, -100, 10, -50], [48, 50, -40, 12, 80], [48, 50, -80, 10, 50], [40, 52, -90, 9, 20]]) +
			dots([[36, 46], [37.5, 45], [44, 44]], 1, "#f2ecd0")
		);
	const pods = new Pen();
	for (const [x, y, l, c] of [[22, 38, 24, -1], [29, 34, 26, 1], [52, 36, 27, 1], [58, 34, 22, -1], [44, 34, 22, 0.5], [35, 36, 18, -0.5]] as const)
		pods.curve("#6f8a3a", 1.7, [[x, y], [x + c, y + l * 0.4], [x + c, y + l * 0.7], [x + c * 0.5, y + l]]);
	return (
		stem([[40, 87], [37, 72], [44, 60], [40, 42]], bk, 3.6) +
		new Pen().curve(bk, 2, [[40, 46], [32, 40], [24, 36], [18, 30]]).curve(bk, 2, [[40, 46], [48, 40], [56, 36], [62, 30]]).curve(bk, 1.6, [[40, 42], [38, 34], [36, 28], [34, 22]]).curve(bk, 1.6, [[40, 42], [44, 34], [48, 28], [50, 21]]) +
		pods +
		draw([
			[18, 30, -150, 16, -90], [18, 30, -110, 15, -70], [18, 30, -60, 13, 60], [62, 30, -30, 16, 90], [62, 30, -70, 15, 70], [62, 30, -120, 13, -60],
			[34, 22, -130, 15, -80], [34, 22, -95, 13, -40], [50, 21, -50, 15, 80], [50, 21, -85, 13, 40], [40, 40, -150, 12, -70], [40, 40, -30, 12, 70],
		]) +
		dots([[26, 26], [27.5, 24.6], [46, 16], [47.4, 17.4], [58, 24], [36, 30]], 1.1, "#f2ecd0")
	);
}

/* ---------------- 14. Neem ---------------- */

const NM = ["#33662f", "#4f8a3f", "#66a24c"] as const;

function neem(stage: St): string {
	const bk = "#5e4a3a";
	const leaves = (cx: number, cy: number, rx: number, ry: number, n: number, len: number) => {
		let s = "";
		for (let i = 0; i < n; i++) {
			const a = Math.PI * (0.95 + (1.1 * i) / (n - 1));
			const x = cx + Math.cos(a) * rx * 0.85;
			const y = cy + Math.sin(a) * ry * 0.85;
			const deg = (a * 180) / Math.PI;
			s += pinnate(x, y, deg + (Math.cos(a) < 0 ? -15 : 15), len, Math.cos(a) < 0 ? -50 : 50, 4.4, NM[0], NM[1], NM[2], 5, 0.3);
		}
		return s;
	};
	const drupes = (pts: readonly XY[]) => dots(pts, 1.3, "#cdbf48");
	if (stage === "sprout") return sapling(16, (x, y) => pinnate(x, y + 2, -150, 10, -40, 3.4, NM[0], NM[1], NM[2], 7, 0.32) + pinnate(x, y + 2, -30, 10, 40, 3.4, NM[0], NM[2], NM[1], 7, 0.32) + pinnate(x, y, -90, 8, 0, 3, NM[0], NM[2], NM[1], 6, 0.32), bk);
	if (stage === "leafy") return trunk(40, 40, 56, 5, 3, bk) + leaves(40, 48, 14, 11, 7, 10) + blobs([[34, 50, 8], [46, 50, 8], [40, 44, 9]], NM[0]) + blobs([[36, 45, 5], [45, 47, 3.5]], NM[1]);
	return (
		trunk(40, 40, 50, 8, 4.5, bk) +
		new Pen().line("#47372a", 0.8, 38, 84, 38.5, 56).line("#47372a", 0.8, 42, 82, 41.5, 58) +
		leaves(40, 34, 25, 19, 9, 13) +
		blobs([[21, 37, 10], [59, 37, 10], [29, 25, 11], [51, 25, 11], [40, 37, 13], [40, 19, 9]], NM[0]) +
		blobs([[25, 33, 7], [46, 26, 8], [35, 21, 6], [55, 34, 6]], NM[1]) +
		blobs([[30, 22, 3.5], [45, 21, 3]], NM[2]) +
		drupes([[22, 44], [24, 46.5], [20, 46.8], [56, 45], [58.4, 47.4], [54, 47.8], [38, 48], [40.5, 50], [36, 50.4]]) +
		dots([[30, 18], [31.4, 16.8], [52, 15], [53.4, 16.2], [62, 26], [18, 28]], 0.9, "#f5f2e4")
	);
}

/* ---------------- 15. Tamarind ---------------- */

const TM = ["#3f6a2e", "#5d8c3e", "#7ea852"] as const;

function tamarind(stage: St): string {
	const bk = "#5a4636";
	const feather = (cx: number, cy: number, rx: number, ry: number, n: number) => {
		const ink = new Ink();
		scatter(cx, cy, rx, ry, n).forEach(([x, y, a], i) => ink.add(TM[1 + (i % 2)] ?? TM[1], qLensD(x, y, ((a * 180) / Math.PI) % 360, 4.4, 0.9)));
		return ink.toString();
	};
	const pod = (x: number, y: number, len: number, dir: number) => {
		const pts: XY[] = [];
		for (let i = 0; i < 4; i++) {
			const t = i / 3;
			pts.push([x + dir * Math.sin(t * 1.4) * len * 0.35, y + t * len]);
		}
		return line(x, y - 2, x, y, "#6b5238", 0.7) + new Pen().curve("#8b6a44", 2.6, [[x, y], [x + dir * len * 0.1, y + len * 0.4], [x + dir * len * 0.3, y + len * 0.7], [pts[3]?.[0] ?? x, y + len]]) + dots(pts, 1.6, "#9a744a");
	};
	if (stage === "sprout") return sapling(16, (x, y) => pinnate(x, y + 2, -150, 10, 10, 2.6, TM[0], TM[2], TM[1], 9, 0.36) + pinnate(x, y + 2, -30, 10, -10, 2.6, TM[0], TM[1], TM[2], 9, 0.36) + pinnate(x, y, -90, 9, 0, 2.4, TM[0], TM[2], TM[1], 9, 0.36), bk);
	if (stage === "leafy")
		return (
			path("M36 87.5Q37 76 38.5 62L41.5 62Q43 76 44 87.5Z", bk) +
			new Pen().line(bk, 2, 40, 64, 30, 54).line(bk, 2, 40, 62, 51, 52) +
			blobs([[28, 52, 7], [52, 50, 7], [40, 46, 10], [34, 50, 6]], TM[0]) +
			feather(40, 49, 17, 9, 34) +
			pod(48, 58, 7, 1)
		);
	return (
		path("M33 87.5Q35 76 36 64Q37 58 34 54L46 54Q43 58 44 64Q45 76 47 87.5Z", bk) +
		new Pen().curve(bk, 4, [[37, 58], [30, 50], [20, 46], [12, 40]]).curve(bk, 4, [[43, 58], [50, 50], [60, 46], [68, 40]]).curve(bk, 3, [[40, 56], [36, 46], [32, 38], [30, 30]]).curve(bk, 3, [[40, 56], [44, 46], [48, 38], [52, 28]]) +
		blobs([[10, 38, 7], [70, 38, 7], [20, 30, 10], [60, 28, 10], [32, 22, 10], [48, 20, 11], [40, 32, 13], [26, 40, 8], [54, 40, 8], [66, 32, 7]], TM[0]) +
		feather(40, 30, 31, 15, 56) +
		pod(16, 44, 9, -1) +
		pod(26, 46, 11, 1) +
		pod(36, 45, 8, -1) +
		pod(50, 46, 10, 1) +
		pod(62, 44, 11, 1) +
		pod(69, 42, 8, -1)
	);
}

/* ---------------- 16. Cacao tree ---------------- */

const CC = ["#3f6e35", "#55883f", "#b0564a"] as const;

function cacaoTree(stage: St): string {
	const bk = "#7a5a44";
	const pod = (x: number, y: number, k: number, fill: string) =>
		line(x, y - 5.6 * k, x + 0.5, y - 7 * k, "#5a3e2a", 0.9) +
		ell(x, y, 3 * k, 5.6 * k, fill) +
		`<path d="M${f(x)} ${f(y - 5 * k)}L${f(x)} ${f(y + 5 * k)}M${f(x - 1.6 * k)} ${f(y - 4.4 * k)}Q${f(x - 2.2 * k)} ${f(y)} ${f(x - 1.6 * k)} ${f(y + 4.4 * k)}M${f(x + 1.6 * k)} ${f(y - 4.4 * k)}Q${f(x + 2.2 * k)} ${f(y)} ${f(x + 1.6 * k)} ${f(y + 4.4 * k)}" stroke="#3a2418" stroke-width=".5" opacity=".35" fill="none"/>`;
	const cluster = (ink: Ink, x: number, y: number, s: number, red = false) =>
		[200, 160, 130, 100, 75, 45, 15, -30, -150].forEach((a, i) => ink.add(red && i % 4 === 1 ? CC[2] : CC[i % 2] ?? CC[0], lensD(x, y, a, 12 * s, 3.4 * s)));
	if (stage === "sprout") {
		const ink = new Ink();
		[-160, -20, 150, 30].forEach((a, i) => ink.add(i === 3 ? CC[2] : CC[i % 2] ?? CC[0], lensD(40, 73 + (i > 1 ? 3 : 0), a, 9, 2.6)));
		ink.add(CC[2], lensD(40, 72, -95, 6, 1.8));
		return line(40, 87, 40, 72, bk, 1.8) + ink;
	}
	if (stage === "leafy") {
		const ink = new Ink();
		cluster(ink, 32, 56, 0.85, true);
		cluster(ink, 50, 54, 0.85, true);
		return trunk(40, 40, 58, 4, 2.5, bk) + new Pen().line(bk, 1.6, 40, 64, 32, 56).line(bk, 1.6, 40, 62, 50, 54) + ink + dots([[39, 72], [41, 76], [39.5, 68]], 0.9, "#f3c6cf");
	}
	const ink = new Ink();
	cluster(ink, 20, 42, 1);
	cluster(ink, 60, 40, 1, true);
	cluster(ink, 40, 30, 1.05, true);
	cluster(ink, 30, 36, 0.9);
	cluster(ink, 50, 34, 0.9);
	return (
		trunk(40, 40, 50, 5.5, 3.5, bk) +
		new Pen().curve(bk, 2.4, [[40, 60], [34, 54], [26, 48], [20, 42]]).curve(bk, 2.4, [[40, 58], [46, 52], [54, 46], [60, 40]]).line(bk, 2, 40, 52, 40, 30) +
		ink +
		pod(36.5, 66, 1, "#e2b236") +
		pod(44, 76, 0.95, "#8e3a2e") +
		pod(36, 79, 0.85, "#d9782e") +
		pod(27, 53, 0.8, "#d9782e") +
		pod(54, 52, 0.85, "#e2b236") +
		dots([[41.5, 64], [38.6, 72], [42, 58], [38.8, 56]], 0.9, "#f3c6cf")
	);
}

/* ---------------- 17. Bodhi tree ---------------- */

const BD = ["#3e7a36", "#5ea248", "#7fbd58"] as const;

/** A heart-shaped leaf with a long drip tip pointing along `deg`. */
function bodhiD(x: number, y: number, deg: number, len: number, w: number): string {
	const P = mapper(x, y, deg);
	return `M${P(0, 0)}C${P(-len * 0.1, -w * 1.3)} ${P(len * 0.6, -w * 1.1)} ${P(len * 0.85, -w * 0.18)}L${P(len * 1.45, 0)}L${P(len * 0.85, w * 0.18)}C${P(len * 0.6, w * 1.1)} ${P(-len * 0.1, w * 1.3)} ${P(0, 0)}Z`;
}

function bodhiTree(stage: St): string {
	const bk = "#8f857a";
	const crown = (cx: number, cy: number, rx: number, ry: number, n: number, len: number) => {
		const ink = new Ink();
		scatter(cx, cy, rx, ry, n).forEach(([x, y, a], i) => ink.add(BD[1 + (i % 2)] ?? BD[1], bodhiD(x, y - len * 0.5, 90 + Math.sin(a * 3) * 35 + (x - cx) * 0.6, len, len * 0.55)));
		return ink.toString();
	};
	if (stage === "sprout") return sapling(14, (x, y) => path(bodhiD(x, y + 2, -150, 6, 3.4) + bodhiD(x, y + 2, -30, 6, 3.4), BD[1]) + path(bodhiD(x, y, -90, 5.4, 3), BD[2]), bk);
	if (stage === "leafy")
		return trunk(40, 40, 56, 5, 3, bk) + new Pen().line(bk, 1.8, 40, 62, 30, 54).line(bk, 1.8, 40, 60, 50, 52) + blobs([[30, 50, 8], [50, 49, 8], [40, 44, 9]], BD[0]) + crown(40, 47, 17, 10, 16, 5.6);
	return (
		path("M27 87.5Q33 82 35 70Q36 60 35 50L45 50Q44 60 45 70Q47 82 53 87.5Z", bk) +
		new Pen().line("#776d62", 1, 37.5, 85, 38, 58).line("#776d62", 1, 42.5, 85, 42, 60).line("#776d62", 1, 31, 87, 35.5, 78).line("#776d62", 1, 49, 87, 44.5, 78) +
		new Pen().curve(bk, 3.2, [[37, 54], [30, 48], [22, 44], [16, 38]]).curve(bk, 3.2, [[43, 54], [50, 48], [58, 44], [64, 38]]) +
		blobs([[10, 38, 7], [70, 38, 7], [18, 28, 10], [62, 28, 10], [40, 22, 13], [30, 36, 10], [50, 36, 10], [28, 20, 8], [52, 20, 8]], BD[0]) +
		crown(40, 30, 32, 18, 48, 5.4) +
		dots([[22, 40], [36, 30], [54, 38], [46, 22], [60, 30]], 1, "#6b3e6e")
	);
}

/* ---------------- 18. Silk floss tree ---------------- */

const SF = "#7f9a6a";

function silkFloss(stage: St): string {
	const thorns = (pts: readonly XY[], s = 1) => path(pts.map(([x, y], i) => `M${f(x - 1.1 * s)} ${f(y)}L${f(x + (i % 2 ? 1 : -1) * 0.6 * s)} ${f(y - 2.6 * s)}L${f(x + 1.1 * s)} ${f(y)}Z`).join(""), "#56664a");
	const bloom = (pts: readonly XY[], r = 3.2) => {
		const ink = new Ink();
		pts.forEach(([x, y], i) => {
			for (let k = 0; k < 5; k++) ink.add("#e66fa3", qLensD(x, y, k * 72 + i * 17, r * 1.05, r * 0.36));
		});
		return ink + dots(pts, r * 0.36, "#f6e6c8");
	};
	if (stage === "sprout") return line(40, 87, 40, 72, SF, 2.4) + thorns([[39.5, 84], [40.5, 79], [39.5, 75]], 0.6) + path(palmateD(40, 72, 5, 7, 2, -90, 160), "#5f9a48");
	if (stage === "leafy")
		return (
			path("M35 87.5Q33 78 36 70Q38.5 64 38.5 56L41.5 56Q41.5 64 44 70Q47 78 45 87.5Z", SF) +
			thorns([[37, 80], [43, 76], [38.5, 70], [41.5, 64]], 0.8) +
			new Pen().line(SF, 1.8, 40, 58, 30, 50).line(SF, 1.8, 40, 58, 50, 48) +
			path(palmateD(30, 50, 5, 8, 2.2, -120) + palmateD(50, 48, 5, 8, 2.2, -60) + palmateD(40, 56, 5, 8, 2.2), "#5f9a48") +
			bloom([[46, 44]], 3)
		);
	return (
		path("M32 87.5Q28 74 33 64Q38 56 38 46L42 46Q42 56 47 64Q52 74 48 87.5Z", SF) +
		thorns([[34, 80], [41, 82], [46, 76], [36, 72], [43, 69], [39, 62], [45, 60], [38.5, 54], [41, 49]]) +
		new Pen().curve(SF, 2.6, [[40, 48], [32, 42], [24, 38], [16, 32]]).curve(SF, 2.6, [[40, 48], [48, 42], [56, 38], [64, 32]]).curve(SF, 2.2, [[40, 46], [36, 36], [32, 28], [30, 20]]).curve(SF, 2.2, [[40, 46], [44, 36], [48, 28], [50, 18]]) +
		path(palmateD(16, 32, 5, 7, 2, -150) + palmateD(64, 32, 5, 7, 2, -30) + palmateD(30, 21, 5, 7, 2, -110) + palmateD(50, 19, 5, 7, 2, -70) + palmateD(24, 40, 5, 6, 1.8, 160) + palmateD(56, 40, 5, 6, 1.8, 20), "#5f9a48") +
		bloom([[12, 28], [20, 34], [24, 24], [32, 16], [38, 24], [46, 14], [52, 24], [58, 30], [66, 26], [28, 32], [44, 32], [60, 38], [17, 40], [38, 10]])
	);
}

/* ---------------- 19. Red mangrove ---------------- */

const MG = ["#2f5f35", "#3f7440", "#5a8e45"] as const;

function redMangrove(stage: St): string {
	const bk = "#6b4a3a";
	const rt = "#7d5a44";
	const roots = (y0: number, ends: readonly number[], w: number) => {
		const pen = new Pen();
		ends.forEach((x1, i) => pen.add(rt, w, `M40 ${f(y0 + (i % 3))}Q${f(40 + (x1 - 40) * 0.8)} ${f(y0 - 6 + (i % 3) * 2)} ${f(x1)} 87.4`));
		return pen.toString();
	};
	const propagules = (pts: readonly (readonly [number, number, number])[]) => {
		const g = new Pen();
		const b = new Pen();
		for (const [x, y, l] of pts) {
			g.line("#7a9a3a", 1.6, x, y, x, y + l * 0.75);
			b.line("#7a5a3a", 1.6, x, y + l * 0.75, x, y + l);
		}
		return g.toString() + b;
	};
	if (stage === "sprout")
		return line(40, 87.4, 40, 66, "#7a9a3a", 2.2) + line(40, 87.4, 40, 82, "#7a5a3a", 2.2) + leaf(40, 66, -150, 7, 3, { fill: MG[2], shape: 0, dark: MG[0] }) + leaf(40, 66, -30, 7, 3, { fill: MG[1], shape: 0, dark: MG[0] }) + dots([[40, 64.5]], 1, MG[2]);
	if (stage === "leafy") {
		const ink = new Ink();
		ink.add(MG[0], ellD(40, 46, 14, 10));
		leafCrown(ink, 40, 46, 13, 9, 16, 6, 2.6, [MG[1], MG[2]], undefined, 0);
		return roots(70, [27, 33, 47, 53], 1.6) + path("M38 72L38.5 50L41.5 50L42 72Z", bk) + ink + propagules([[34, 54, 12], [46, 55, 10]]);
	}
	const ink = new Ink();
	ink.add(MG[0], ellD(26, 34, 14, 10) + ellD(54, 34, 14, 10) + ellD(40, 24, 17, 12));
	leafCrown(ink, 26, 34, 13, 9, 16, 6.4, 2.8, [MG[1], MG[2]], undefined, 0);
	leafCrown(ink, 54, 34, 13, 9, 16, 6.4, 2.8, [MG[2], MG[1]], undefined, 0);
	leafCrown(ink, 40, 24, 15, 11, 22, 6.4, 2.8, [MG[1], MG[2]], undefined, 0);
	return (
		roots(64, [10, 17, 24, 31, 49, 56, 63, 70], 2.2) +
		roots(70, [21, 30, 50, 59], 1.4) +
		path("M37 68L37.5 36L42.5 36L43 68Z", bk) +
		ink +
		propagules([[18, 42, 16], [27, 43, 20], [35, 40, 14], [47, 41, 18], [56, 43, 20], [63, 41, 14]]) +
		dots([[22, 30], [44, 18], [58, 28], [34, 26]], 1, "#e4d97a")
	);
}

/* ---------------- 20. Strangler fig ---------------- */

const SG = ["#3a7034", "#4f8a3f", "#6aa552"] as const;
const HOST = "#5f5850";
const ROOT = "#c2b09a";

function stranglerFig(stage: St): string {
	if (stage === "sprout")
		return (
			path("M36.5 87.5L36.5 74L38 72.5L39.5 74L41 72L43.5 74L43.5 87.5Z", HOST) +
			new Pen().curve(ROOT, 0.9, [[39, 73], [37, 76], [38, 80], [37, 85]]).curve(ROOT, 0.9, [[41, 73], [43, 77], [41, 80], [42.5, 86]]) +
			line(40, 73, 40, 68, SG[0], 1.2) +
			leaf(40, 69, -150, 6, 2.8, { fill: SG[1], shape: 2 }) +
			leaf(40, 69, -30, 6, 2.8, { fill: SG[2], shape: 2 }) +
			leaf(40, 68, -90, 5, 2.4, { fill: SG[1], shape: 2 })
		);
	if (stage === "leafy")
		return (
			path("M36 87.5L37 46L43 46L44 87.5Z", HOST) +
			new Pen().line(HOST, 1.6, 38, 58, 30, 50).line(HOST, 1.4, 42, 52, 50, 42).line(HOST, 1.2, 40, 47, 40, 38) +
			new Pen().curve(ROOT, 1.4, [[38, 50], [34, 60], [42, 68], [37, 78]]).curve(ROOT, 1.4, [[42, 50], [45, 58], [38, 64], [43, 74]]).line(ROOT, 1.4, 37, 78, 36.5, 87.4).curve(ROOT, 1.4, [[43, 74], [44, 79], [43, 83], [44, 87.4]]) +
			blobs([[34, 48, 6], [46, 47, 6], [40, 44, 7]], SG[0]) +
			blobs([[37, 45, 4], [45, 44, 3.5]], SG[1]) +
			dots([[33, 50], [44, 50]], 1, "#e08a3a")
		);
	const lattice = new Pen();
	for (const [a, b, c, d] of [
		[[36, 44], [30, 56], [48, 62], [38, 74]],
		[[44, 44], [50, 56], [32, 64], [42, 76]],
		[[38, 74], [34, 80], [32, 84], [29, 87.4]],
		[[42, 76], [46, 80], [48, 84], [51, 87.4]],
		[[40, 44], [44, 52], [36, 58], [40, 66]],
		[[40, 66], [44, 72], [38, 80], [40, 87.4]],
		[[35, 52], [38, 51], [42, 53], [45, 52]],
		[[35, 70], [38, 69], [42, 71], [45, 70]],
	] as const)
		lattice.curve(ROOT, 2.2, [a, b, c, d]);
	return (
		path("M35 87.5L36 40L44 40L45 87.5Z", HOST) +
		new Pen().line(HOST, 2, 36, 46, 12, 50).line(HOST, 1.4, 16, 49, 12, 44) +
		lattice +
		new Pen().line(ROOT, 0.8, 20, 40, 20, 62).line(ROOT, 0.8, 58, 40, 58, 66).line(ROOT, 0.8, 64, 38, 64, 56) +
		blobs([[12, 34, 8], [68, 34, 8], [22, 26, 11], [58, 26, 11], [40, 22, 13], [30, 36, 9], [50, 36, 9]], SG[0]) +
		blobs([[18, 30, 6], [62, 30, 6], [40, 30, 11], [30, 22, 7], [50, 21, 7]], SG[1]) +
		blobs([[28, 26, 4], [52, 25, 4], [40, 16, 5]], SG[2]) +
		dots([[16, 36], [26, 30], [36, 26], [46, 34], [56, 30], [64, 36], [44, 20], [32, 38], [22, 22], [58, 20]], 1.1, "#e08a3a")
	);
}

/* ---------------- 21. Brazil nut tree ---------------- */

function brazilNut(stage: St): string {
	const bk = "#a39d91";
	const bn = ["#3f6e36", "#57893f", "#76a654"] as const;
	const nut = (pts: readonly XY[]) => dots(pts, 2.9, "#7a5232") + dots(pts.map(([x, y]) => [x - 0.6, y - 0.7] as XY), 1.2, "#a07850");
	if (stage === "sprout") return sapling(18, (x, y) => leaf(x, y + 4, -165, 9, 2.8, { fill: bn[1], shape: 1 }) + leaf(x, y + 4, -15, 9, 2.8, { fill: bn[2], shape: 1 }) + leaf(x, y, -100, 7, 2.4, { fill: bn[2], shape: 1 }), bk);
	if (stage === "leafy") return trunk(40, 40, 44, 4, 2.5, bk) + blobs([[33, 42, 6], [47, 42, 6], [40, 37, 8]], bn[0]) + blobs([[37, 37, 4.5], [45, 39, 3.5]], bn[1]) + dots([[36, 35]], 2, bn[2]);
	return (
		trunk(40, 40, 28, 7, 4, bk) +
		new Pen().line("#8b8579", 0.8, 38.6, 84, 39.2, 34).line("#8b8579", 0.8, 41.6, 82, 40.8, 38) +
		new Pen().line(bk, 2.6, 40, 31, 22, 24).line(bk, 2.6, 40, 31, 58, 24).line(bk, 2, 40, 30, 40, 16) +
		blobs([[13, 26, 7], [67, 26, 7], [24, 20, 10], [56, 20, 10], [40, 15, 11], [32, 26, 8], [48, 26, 8]], bn[0]) +
		blobs([[18, 22, 5.5], [62, 22, 5.5], [40, 21, 9], [30, 14, 6], [50, 13, 6]], bn[1]) +
		blobs([[26, 16, 3.5], [44, 10, 3.5], [56, 17, 3]], bn[2]) +
		nut([[20, 31], [33, 32], [47, 32], [60, 30], [27, 28.5]])
	);
}

/* ---------------- 22. Kauri ---------------- */

const KR = ["#4e6e3e", "#66854c", "#809e5e"] as const;
const KRB = "#b5aca0";

function kauri(stage: St): string {
	const fl = "#9a9084";
	if (stage === "sprout") {
		const ink = new Ink();
		[0, 4, 8].forEach((k, i) => ink.add(KR[1 + (i % 2)] ?? KR[1], lensD(40, 84 - k - 4, -150 + i * 5, 6, 1.8) + lensD(40, 84 - k - 4, -30 - i * 5, 6, 1.8)));
		ink.add(KR[2], lensD(40, 69, -90, 4.4, 1.4));
		return line(40, 87, 40, 69, KRB, 1.8) + ink;
	}
	if (stage === "leafy") {
		const ink = new Ink();
		for (let i = 0; i < 6; i++) {
			const y = 74 - i * 6.4;
			const hw = 13 - i * 2;
			ink.add(KR[0], ellD(40 - hw / 2, y, hw / 2 + 1, 2.6) + ellD(40 + hw / 2, y - 1, hw / 2 + 1, 2.6));
			ink.add(KR[1], ellD(40 - hw / 2 - 0.5, y - 1, hw / 2 - 0.5, 1.4) + ellD(40 + hw / 2 + 0.5, y - 2, hw / 2 - 0.5, 1.4));
		}
		return trunk(40, 40, 36, 3.4, 1.6, KRB) + ink + ell(40, 37, 2, 3, KR[1]);
	}
	const ink = new Ink();
	const clumps: readonly (readonly [number, number, number, number])[] = [[15, 22, 9, 5], [65, 22, 9, 5], [32, 13, 9, 5], [50, 12, 9, 5], [25, 27, 7, 4], [55, 27, 7, 4], [41, 20, 8, 4.5]];
	for (const [x, y, rx, ry] of clumps) ink.add(KR[0], ellD(x, y, rx, ry)).add(KR[1], ellD(x - 1, y - ry * 0.35, rx * 0.72, ry * 0.5)).add(KR[2], ellD(x - 2, y - ry * 0.55, rx * 0.3, ry * 0.25));
	return (
		path("M32.5 87.5Q31.5 84 33.5 80L35 33L45 33L46.5 80Q48.5 84 47.5 87.5Z", KRB) +
		dots([[37, 76], [43, 68], [37.5, 58], [42.5, 48], [38, 40], [43.5, 82]], 1.3, fl) +
		new Pen()
			.curve(KRB, 3.8, [[37, 35], [32, 30], [24, 28], [17, 23]])
			.curve(KRB, 3.8, [[43, 35], [48, 30], [56, 28], [63, 23]])
			.curve(KRB, 3.2, [[39, 35], [38, 26], [34, 20], [32, 14]])
			.curve(KRB, 3.2, [[41, 35], [44, 26], [48, 18], [50, 13]]) +
		ink +
		dots([[20, 26], [46, 16], [60, 26], [28, 16]], 1.5, "#8a8a4a")
	);
}

/* ---------------- 23. Ylang-ylang ---------------- */

const YL = ["#4f8a3e", "#6aa04c"] as const;

function ylangYlang(stage: St): string {
	const bk = "#8a7f72";
	const arch = (pen: Pen, ink: Ink, y: number, reach: number, side: 1 | -1) => {
		const p: [Pt, Pt, Pt, Pt] = [[40, y], [40 + side * reach * 0.4, y - 8], [40 + side * reach * 0.85, y - 6], [40 + side * reach, y + 6]];
		pen.curve(bk, 1.4, p);
		for (let t = 0.3; t <= 1.01; t += 0.18) {
			const u = 1 - t;
			const x = u * u * u * p[0][0] + 3 * u * u * t * p[1][0] + 3 * u * t * t * p[2][0] + t * t * t * p[3][0];
			const yy = u * u * u * p[0][1] + 3 * u * u * t * p[1][1] + 3 * u * t * t * p[2][1] + t * t * t * p[3][1];
			ink.add(YL[Math.round(t * 10) % 2] ?? YL[0], lensD(x, yy, 90 - side * 35, 7, 2.1));
		}
	};
	const flower = (fl: Ink, ctr: XY[], x: number, y: number, s = 1) => {
		for (let k = 0; k < 6; k++) {
			const a = 40 + k * 20;
			const P = mapper(x, y, a);
			fl.add("#d8cd45", `M${P(0, 0)}Q${P(4 * s, -1.4 * s)} ${P(8 * s, (k % 2 ? 1 : -1) * 0.8 * s)}Q${P(4 * s, 1 * s)} ${P(0, 0)}Z`);
		}
		ctr.push([x, y]);
	};
	if (stage === "sprout") {
		const ink = new Ink();
		ink.add(YL[0], lensD(40, 72, 160, 9, 2.6) + lensD(40, 72, 20, 9, 2.6)).add(YL[1], lensD(40, 70, -90, 6, 2));
		return line(40, 87, 40, 70, bk, 1.6) + ink;
	}
	const pen = new Pen();
	const ink = new Ink();
	const fl = new Ink();
	const ctr: XY[] = [];
	if (stage === "leafy") {
		arch(pen, ink, 56, 14, -1);
		arch(pen, ink, 52, 14, 1);
		arch(pen, ink, 46, 8, -1);
		arch(pen, ink, 44, 8, 1);
		flower(fl, ctr, 54, 59, 0.8);
		return trunk(40, 40, 44, 3.6, 2, bk) + pen + ink + fl.toString().replace("#d8cd45", "#bfc65a") + dots(ctr, 0.8, "#8a8a3a");
	}
	for (const [y, r, sd] of [[60, 28, -1], [56, 28, 1], [46, 22, -1], [42, 22, 1], [32, 16, -1], [30, 16, 1], [22, 9, -1], [20, 9, 1]] as const) arch(pen, ink, y, r, sd);
	for (const [x, y] of [[12, 66], [68, 62], [18, 52], [62, 48], [24, 38], [56, 36], [32, 28], [49, 26], [26, 60], [54, 56]] as const) flower(fl, ctr, x, y);
	return trunk(40, 40, 21, 5, 2.4, bk) + pen + ink + fl + dots(ctr, 0.9, "#8a8a3a");
}

/* ---------------- 24. Pink trumpet tree ---------------- */

const PT = ["#c84a82", "#d8558f", "#ec85b4"] as const;

function pinkTrumpet(stage: St): string {
	const bk = "#5e4a40";
	const ball = (ink: Ink, throats: XY[], cx: number, cy: number, r: number, n: number) => {
		ink.add(PT[0], ellD(cx, cy, r * 0.4));
		for (let i = 0; i < n; i++) {
			const a = -90 + (360 * i) / n + (cx % 7) * 5;
			const k = i % 2 ? 0.85 : 1;
			const P = mapper(cx, cy, a);
			ink.add(PT[1 + (i % 2)] ?? PT[1], `M${P(0, -0.7)}L${P(r * 0.55 * k, -0.9)}Q${P(r * 1.12 * k, -r * 0.62)} ${P(r * k, 0)}Q${P(r * 1.12 * k, r * 0.62)} ${P(r * 0.55 * k, 0.9)}L${P(0, 0.7)}Z`);
			const rad = (a * Math.PI) / 180;
			throats.push([cx + Math.cos(rad) * r * 0.78 * k, cy + Math.sin(rad) * r * 0.78 * k]);
		}
	};
	const palm = (x: number, y: number, deg: number) => palmateD(x, y, 5, 7, 2, deg, 150);
	if (stage === "sprout") return sapling(16, (x, y) => path(palm(x, y + 1, -90), "#5f9a48"), bk);
	if (stage === "leafy")
		return trunk(40, 40, 56, 4.5, 2.5, bk) + new Pen().line(bk, 1.8, 40, 64, 29, 54).line(bk, 1.8, 40, 62, 51, 52).line(bk, 1.6, 40, 58, 40, 46) + path(palm(29, 54, -130) + palm(51, 52, -50) + palm(40, 46, -90) + palm(34, 60, 170) + palm(46, 58, 10), "#5f9a48");
	const ink = new Ink();
	const th: XY[] = [];
	for (const [x, y, r, n] of [[15, 42, 7.5, 6], [65, 40, 7.5, 6], [24, 28, 8.5, 7], [56, 27, 8.5, 7], [40, 16, 9, 7], [40, 33, 7.5, 6], [30, 46, 6.5, 5], [51, 45, 6.5, 5]] as const) ball(ink, th, x, y, r, n);
	return (
		trunk(40, 40, 58, 6.5, 4, bk) +
		new Pen().curve(bk, 2.8, [[40, 64], [32, 56], [22, 50], [15, 42]]).curve(bk, 2.8, [[40, 62], [48, 54], [58, 48], [65, 40]]).curve(bk, 2.2, [[40, 60], [34, 48], [28, 36], [24, 28]]).curve(bk, 2.2, [[40, 60], [46, 48], [52, 36], [56, 27]]).line(bk, 2, 40, 60, 40, 17) +
		ink +
		dots(th, 0.7, "#f3d36a") +
		path(lensD(16, 84, 20, 3, 1.2) + lensD(26, 87, -10, 3, 1.2) + lensD(58, 85, 160, 3, 1.2) + lensD(66, 86, 200, 3, 1.2), PT[2])
	);
}

/* ---------------- 25. Monkeypod ---------------- */

function monkeypod(stage: St): string {
	const bk = "#6e5646";
	const mp = ["#3f7a36", "#559043", "#73aa55"] as const;
	const puffs = (pts: readonly XY[]) => dots(pts, 2, "#f6c9d8") + dots(pts, 1.1, "#de5f8f");
	if (stage === "sprout") return sapling(14, (x, y) => pinnate(x, y + 2, -160, 10, 15, 3, mp[0], mp[2], mp[1], 7, 0.4) + pinnate(x, y + 2, -20, 10, -15, 3, mp[0], mp[1], mp[2], 7, 0.4) + puffs([[x, y - 2]]), bk);
	if (stage === "leafy")
		return (
			path("M36 87.5Q37.5 76 38.5 64L41.5 64Q42.5 76 44 87.5Z", bk) +
			new Pen().curve(bk, 2.2, [[40, 66], [34, 60], [26, 58], [20, 55]]).curve(bk, 2.2, [[40, 66], [46, 60], [54, 58], [60, 55]]) +
			path("M14 57Q14 40 40 39Q66 40 66 57Q40 53 14 57Z", mp[0]) +
			path("M20 51Q24 43 40 42Q56 43 60 51Q40 47 20 51Z", mp[1]) +
			puffs([[26, 50], [40, 45], [52, 49]])
		);
	const ink = new Ink();
	scatter(40, 30, 32, 13, 80).forEach(([x, y, a], i) => {
		if (y < 22 + Math.abs(x - 40) * 0.25 - 4 || y > 41) return;
		ink.add(i % 2 ? mp[2] : mp[1], lensD(x, y, (a * 57.3) % 360, 3.4, 1));
	});
	return (
		path("M34 87.5Q36 76 37 68Q37 62 35 58L45 58Q43 62 43 68Q44 76 46 87.5Z", bk) +
		new Pen().curve(bk, 4.2, [[37, 62], [28, 54], [18, 50], [10, 45]]).curve(bk, 4.2, [[43, 62], [52, 54], [62, 50], [70, 45]]).curve(bk, 3.2, [[39, 60], [34, 52], [28, 46], [24, 42]]).curve(bk, 3.2, [[41, 60], [46, 52], [52, 46], [56, 42]]) +
		path("M4 47Q4 15 40 14Q76 15 76 47Q60 42 40 43Q20 42 4 47Z", mp[0]) +
		path("M10 40Q12 20 40 19Q68 20 70 40Q40 34 10 40Z", mp[1]) +
		path("M22 28Q28 21 40 21Q52 21 58 28Q40 24 22 28Z", mp[2]) +
		ink +
		puffs([[10, 40], [18, 32], [16, 42], [26, 24], [28, 36], [36, 20], [38, 30], [46, 24], [50, 36], [56, 22], [60, 32], [66, 38], [70, 43], [44, 40], [22, 44], [32, 42], [58, 42], [48, 16]])
	);
}

/* ---------------- registry ---------------- */

const kebab = (name: string) =>
	name
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		.replace(/'/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");

const ALL: readonly (readonly [string, (stage: St) => string])[] = [
	["Rainbow eucalyptus", rainbowEucalyptus],
	["Kapok", kapok],
	["Royal poinciana", royalPoinciana],
	["Banyan", banyan],
	["Mahogany", mahogany],
	["Teak", teak],
	["Frangipani", frangipani],
	["Cannonball tree", cannonballTree],
	["Sausage tree", sausageTree],
	["Dragon blood tree", dragonBloodTree],
	["Golden shower tree", goldenShower],
	["African tulip tree", africanTulip],
	["Moringa", moringa],
	["Neem", neem],
	["Tamarind", tamarind],
	["Cacao tree", cacaoTree],
	["Bodhi tree", bodhiTree],
	["Silk floss tree", silkFloss],
	["Red mangrove", redMangrove],
	["Strangler fig", stranglerFig],
	["Brazil nut tree", brazilNut],
	["Kauri", kauri],
	["Ylang-ylang", ylangYlang],
	["Pink trumpet tree", pinkTrumpet],
	["Monkeypod", monkeypod],
];

export const SPECIES: Species[] = ALL.map(([name, draw]) => ({ id: kebab(name), name, draw }));
