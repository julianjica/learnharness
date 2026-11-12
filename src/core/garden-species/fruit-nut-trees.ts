/**
 * Fruit and nut trees: 25 species in the garden's flat style (see kit.ts).
 * Each grows from a sapling (sprout) to a young tree (leafy) to its
 * signature fullest form (bloom): ripe fruit, nuts in their husks or burrs,
 * or the blossom it is known for.
 */
import { BARK, f, leaf, line, type GrowingStage, type Species } from "./kit";

/* ---------------- private helpers ---------------- */

type Pal = readonly string[];
type XY = readonly [number, number];

const at = (a: Pal, i: number): string => a[i % a.length] ?? a[0] ?? "";
const F = (c: string, o?: number): string => `fill="${c}"${o === undefined ? "" : ` opacity="${o}"`}`;
const K = (c: string, w: number, extra = ""): string => `stroke="${c}" stroke-width="${w}" fill="none" stroke-linecap="round"${extra}`;
const SHINE = F("#fff", 0.45);
/** A round dot of radius r as a zero-length round-capped stroke (far smaller than a circle). */
const R = (c: string, r: number, o?: number): string => `stroke="${c}" stroke-width="${f(r * 2)}" stroke-linecap="round"${o === undefined ? "" : ` opacity="${o}"`}`;
const D = (x: number, y: number): string => `M${f(x)} ${f(y)}h0`;

/** Drops redundant characters from path data: leading zeros and spaces before minus signs. */
const tight = (d: string): string => d.replace(/(^|[^\d.])0\./g, "$1.").replace(/ -/g, "-");

/** Merges path data per attribute set into one <path> each, in first-seen order. */
class Ink {
	private parts = new Map<string, string>();
	add(attrs: string, d: string): this {
		this.parts.set(attrs, (this.parts.get(attrs) ?? "") + d);
		return this;
	}
	toString(): string {
		return [...this.parts].map(([a, d]) => `<path d="${tight(d)}" ${a}/>`).join("");
	}
}

/** Ellipse subpath (two arcs), optionally rotated. */
function E(x: number, y: number, rx: number, ry: number, rot = 0): string {
	const r = (rot * Math.PI) / 180;
	const dx = Math.cos(r) * rx;
	const dy = Math.sin(r) * rx;
	const a = `a${f(rx)} ${f(ry)} ${f(rot)} 1 0`;
	return `M${f(x - dx)} ${f(y - dy)}${a} ${f(2 * dx)} ${f(2 * dy)}${a} ${f(-2 * dx)} ${f(-2 * dy)}Z`;
}
const C = (x: number, y: number, r: number): string => E(x, y, r, r);

/** Maps local (u along, v across) at (x, y) rotated by deg to "x y". */
function mapper(x: number, y: number, deg: number): (u: number, v: number) => string {
	const c = Math.cos((deg * Math.PI) / 180);
	const s = Math.sin((deg * Math.PI) / 180);
	return (u, v) => `${f(x + c * u - s * v)} ${f(y + s * u + c * v)}`;
}

const SHAPES = { 0: [0.3, 1, 0.8, 1], 2: [0.05, 1.4, 1.02, 1.3], 4: [0.1, 1.6, 0.75, 1.2] } as const;

/** Leaf outline subpath (kit shapes 0 oval, 1 pointed, 2 round, 4 heart), in relative commands. */
function leafD(x: number, y: number, deg: number, len: number, w: number, shape: 0 | 1 | 2 | 4 = 1): string {
	const c = Math.cos((deg * Math.PI) / 180);
	const s = Math.sin((deg * Math.PI) / 180);
	const rel = (u: number, v: number) => `${f(c * u - s * v)} ${f(s * u + c * v)}`;
	if (shape === 1) return `M${f(x)} ${f(y)}q${rel(len * 0.45, -w * 1.25)} ${rel(len, 0)}q${rel(-len * 0.55, w * 1.25)} ${rel(-len, 0)}Z`;
	const [a, b, cc, d] = SHAPES[shape];
	return `M${f(x)} ${f(y)}c${rel(len * a, -w * b)} ${rel(len * cc, -w * d)} ${rel(len, 0)}c${rel(len * (cc - 1), w * d)} ${rel(len * (a - 1), w * b)} ${rel(-len, 0)}Z`;
}

/** A deeply lobed leaf (breadfruit): fingers along both sides of the midrib. */
function lobedD(x: number, y: number, deg: number, len: number, w: number): string {
	const P = mapper(x, y, deg);
	const up: [number, number][] = [[0.12, 0.2], [0.26, 0.95], [0.36, 0.28], [0.5, 1], [0.6, 0.3], [0.74, 0.8], [0.83, 0.22], [1, 0]];
	let d = `M${P(0, 0)}`;
	for (const [u, v] of up) d += `L${P(len * u, -w * v)}`;
	for (const [u, v] of [...up].reverse().slice(1)) d += `L${P(len * u, w * v)}`;
	return d + "Z";
}

/** A palmate leaf (papaya) with n pointed lobes, opening toward `deg`. */
function palmD(x: number, y: number, r: number, n: number, deg: number, inner = 0.36): string {
	const spread = 230;
	const start = deg - spread / 2;
	const step = spread / (n - 1);
	const pt = (a: number, rad: number) => `${f(x + Math.cos((a * Math.PI) / 180) * rad)} ${f(y + Math.sin((a * Math.PI) / 180) * rad)}`;
	let d = `M${pt(deg + 180, r * 0.12)}`;
	for (let i = 0; i < n; i++) {
		if (i > 0) d += `L${pt(start + step * (i - 0.5), r * inner)}`;
		d += `L${pt(start + step * i, r)}`;
	}
	return d + "Z";
}

const seg = (x1: number, y1: number, x2: number, y2: number): string => `M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}`;
const cub = (a: XY, b: XY, c: XY, d: XY): string => `M${f(a[0])} ${f(a[1])}C${f(b[0])} ${f(b[1])} ${f(c[0])} ${f(c[1])} ${f(d[0])} ${f(d[1])}`;
const poly = (pts: readonly XY[]): string => "M" + pts.map(([x, y]) => `${f(x)} ${f(y)}`).join("L") + "Z";

/** A tapered trunk from the ground at x0 (width w0, flared foot) to (x1, y1) (width w1). */
function trunkD(x0: number, x1: number, y1: number, w0: number, w1: number): string {
	const y0 = 87.5;
	const fl = w0 * 0.35;
	return `M${f(x0 - w0 / 2 - fl)} ${y0}Q${f(x0 - w0 / 2)} ${f(y0 - 1)} ${f(x0 - w0 / 2)} ${f(y0 - 4)}L${f(x1 - w1 / 2)} ${f(y1)}L${f(x1 + w1 / 2)} ${f(y1)}L${f(x0 + w0 / 2)} ${f(y0 - 4)}Q${f(x0 + w0 / 2)} ${f(y0 - 1)} ${f(x0 + w0 / 2 + fl)} ${y0}Z`;
}

/** Points spread evenly over an ellipse (sunflower spiral), deterministic. */
function scatter(cx: number, cy: number, rx: number, ry: number, n: number): [number, number][] {
	const out: [number, number][] = [];
	for (let i = 0; i < n; i++) {
		const a = i * 2.39996;
		const r = Math.sqrt((i + 0.5) / n);
		out.push([cx + Math.cos(a) * r * rx, cy + Math.sin(a) * r * ry]);
	}
	return out;
}

/** A leafy crown: an optional base ellipse and n leaves pointing outward over it; `droop` (0..1) bends them downward. */
function crown(k: Ink, cx: number, cy: number, rx: number, ry: number, n: number, len: number, w: number, base: string | null, cols: Pal, shape: 0 | 1 | 2 | 4 = 1, droop = 0): void {
	if (base) k.add(F(base), E(cx, cy, rx, ry));
	scatter(cx, cy, rx, ry, n).forEach(([x, y], i) => {
		let a = Math.atan2((y - cy) / ry, (x - cx) / rx) + ((((i * 53) % 50) - 25) * Math.PI) / 180;
		a = (Math.atan2(Math.sin(a) + droop, Math.cos(a)) * 180) / Math.PI;
		k.add(F(at(cols, i)), leafD(x, y, a, len, w, shape));
	});
}

/** Five round petals around a centre, as round-capped strokes. */
function blossom(k: Ink, x: number, y: number, r: number, petal: string, centre: string, off = 0): void {
	let d = "";
	for (let i = 0; i < 5; i++) {
		const t = ((off + i * 72 - 90) * Math.PI) / 180;
		d += `M${f(x)} ${f(y)}l${f(Math.cos(t) * r * 0.55)} ${f(Math.sin(t) * r * 0.55)}`;
	}
	k.add(R(petal, r * 0.45), d).add(R(centre, r * 0.28), D(x, y));
}

/** A sapling: a thin stem with leaves at its top. */
const sap = (h: number, top: (x: number, y: number) => string, color: string = BARK, w = 1.8): string => line(40, 87, 40, 87 - h, color, w) + top(40, 87 - h);

/** Three sprout leaves (two side, one up). */
const trio = (x: number, y: number, len: number, w: number, a: string, b: string, shape: 0 | 1 | 2 | 4 = 1, dark = "#2f5a2a"): string =>
	leaf(x, y + 3, -150, len, w, { fill: a, shape, dark }) + leaf(x, y + 3, -30, len, w, { fill: a, shape, dark }) + leaf(x, y, -90, len * 0.75, w * 0.8, { fill: b, shape, dark });

/** A hanging pear outline: stalk end at (x, y), s scales it. */
function pearD(x: number, y: number, s: number, lean = 0): string {
	const P = mapper(x, y, 90 + lean);
	return `M${P(0, 0)}C${P(0, -1.4 * s)} ${P(2.6 * s, -1.2 * s)} ${P(4.4 * s, -2.8 * s)}C${P(6.4 * s, -4.4 * s)} ${P(8 * s, -2.6 * s)} ${P(8 * s, 0)}C${P(8 * s, 2.6 * s)} ${P(6.4 * s, 4.4 * s)} ${P(4.4 * s, 2.8 * s)}C${P(2.6 * s, 1.2 * s)} ${P(0, 1.4 * s)} ${P(0, 0)}Z`;
}

/** Shrinks a species' bloom about its root by s, to keep leaf tips inside the cell. */
const fit =
	(draw: (stage: GrowingStage) => string, s: number) =>
	(stage: GrowingStage): string =>
		stage === "bloom" ? `<g transform="matrix(${s} 0 0 ${s} ${f(40 * (1 - s))} ${f(88 * (1 - s))})">${draw(stage)}</g>` : draw(stage);

/* ---------------- species ---------------- */

function pearTree(stage: GrowingStage): string {
	const g = ["#2f6a34", "#3f8040", "#5c9a4f"] as const;
	if (stage === "sprout") return sap(18, (x, y) => trio(x, y, 9, 3.6, g[1], g[2]));
	const k = new Ink();
	const fr = new Ink();
	if (stage === "leafy") {
		k.add(F(BARK), trunkD(40, 40, 56, 4.5, 2.6)).add(K(BARK, 1.6), seg(40, 66, 34, 56) + seg(40, 63, 46, 54));
		crown(k, 40, 45, 10, 16, 20, 6.5, 2.6, g[0], [g[1], g[2]]);
		for (const [x, y] of [[35, 40], [45, 46], [38, 54], [44, 35]] as const) blossom(fr, x, y, 3.4, "#f8f6f0", "#8a2a3a");
		return `${k}${fr}`;
	}
	k.add(F(BARK), trunkD(40, 40, 50, 7, 4)).add(K(BARK, 2.6), cub([40, 66], [36, 58], [32, 50], [30, 40]) + cub([40, 64], [44, 56], [48, 48], [50, 38]));
	crown(k, 40, 33, 17, 27, 48, 8, 3, g[0], [g[1], g[2], g[1]]);
	const stalk = new Ink();
	for (const [x, y, l] of [[30, 44, -10], [48, 40, 8], [38, 52, 0], [52, 54, 12], [26, 56, -8], [42, 26, 4], [32, 30, -6], [50, 24, 10]] as const) {
		stalk.add(K("#5b3a22", 0.8), seg(x, y - 2, x, y));
		fr.add(F("#d9cb4b"), pearD(x, y, 0.95, l)).add(F("#c9973a", 0.75), E(x + 1.3, y + 5.6, 1.4, 1.6)).add(SHINE, E(x - 1.4, y + 5.2, 0.7, 1.3));
	}
	return `${k}${stalk}${fr}`;
}

function quince(stage: GrowingStage): string {
	const g = ["#6a8a52", "#86a468", "#a7bf88"] as const;
	const qb = "#6a5040";
	const q = (k: Ink, x: number, y: number, r: number) => {
		k.add(F("#e6bd2e"), E(x, y + r * 0.15, r, r * 0.95) + E(x - r * 0.3, y - r * 0.6, r * 0.62, r * 0.55, -20) + E(x + r * 0.45, y - r * 0.4, r * 0.5, r * 0.5));
		k.add(F("#f3d97a"), E(x - r * 0.35, y - r * 0.2, r * 0.32, r * 0.42)).add(R("#7a5a32", r * 0.18), D(x + r * 0.1, y + r * 0.95));
	};
	if (stage === "sprout") return sap(15, (x, y) => trio(x, y, 7, 3.6, g[1], g[2], 2, "#4a6038"), qb, 1.6);
	const k = new Ink();
	const fr = new Ink();
	if (stage === "leafy") {
		k.add(K(qb, 2), cub([40, 87], [38, 76], [32, 68], [28, 60]) + cub([40, 87], [42, 74], [48, 66], [52, 58]) + seg(40, 87, 40, 50));
		crown(k, 28, 58, 9, 7, 9, 5.5, 2.6, g[0], [g[1], g[2]], 2);
		crown(k, 52, 56, 9, 7, 9, 5.5, 2.6, g[0], [g[1], g[2]], 2);
		crown(k, 40, 48, 8, 6, 8, 5.5, 2.6, g[0], [g[2], g[1]], 2);
		blossom(fr, 33, 50, 4, "#f6d3d8", "#e3b24a");
		blossom(fr, 50, 52, 3.6, "#f6d3d8", "#e3b24a", 20);
		return `${k}${fr}`;
	}
	k.add(K(qb, 3), cub([38, 87], [34, 74], [22, 66], [16, 54]) + cub([40, 87], [42, 70], [36, 54], [40, 38]) + cub([42, 87], [48, 72], [58, 64], [64, 50]));
	k.add(K(qb, 1.8), cub([38, 72], [30, 66], [26, 56], [28, 46]) + cub([42, 66], [50, 58], [54, 48], [52, 40]));
	crown(k, 18, 52, 13, 10, 16, 6, 2.8, g[0], [g[1], g[2]], 2);
	crown(k, 62, 50, 13, 10, 16, 6, 2.8, g[0], [g[1], g[2]], 2);
	crown(k, 40, 38, 16, 12, 20, 6, 2.8, g[0], [g[2], g[1]], 2);
	q(fr, 22, 60, 4.6);
	q(fr, 54, 58, 4.8);
	q(fr, 40, 50, 5);
	q(fr, 64, 44, 4.2);
	q(fr, 30, 40, 4.2);
	blossom(fr, 16, 44, 3.6, "#f6d3d8", "#e3b24a");
	blossom(fr, 48, 30, 3.4, "#f6d3d8", "#e3b24a", 30);
	return `${k}${fr}`;
}

function apricotTree(stage: GrowingStage): string {
	const g = ["#4f8f3c", "#6fae50", "#92c56a"] as const;
	const tw = "#7a4a3a";
	const apri = (k: Ink, x: number, y: number) => k.add(R("#f5ad45", 2.8), D(x, y)).add(F("#e2683a", 0.8), E(x + 0.9, y + 0.5, 1.7, 2.1, 20)).add(R("#fff", 0.8, 0.45), D(x - 1, y - 1));
	if (stage === "sprout") return sap(16, (x, y) => trio(x, y, 7, 3.4, g[1], g[2], 4), tw, 1.6);
	const k = new Ink();
	const fr = new Ink();
	if (stage === "leafy") {
		k.add(F(BARK), trunkD(40, 40, 64, 4.5, 3)).add(K(tw, 1.8), seg(40, 66, 30, 56) + seg(40, 66, 50, 55) + seg(40, 64, 40, 50));
		crown(k, 30, 53, 9, 6, 9, 5, 2.4, g[0], [g[1], g[2]], 4);
		crown(k, 50, 52, 9, 6, 9, 5, 2.4, g[0], [g[2], g[1]], 4);
		crown(k, 40, 46, 8, 6, 8, 5, 2.4, g[0], [g[1], g[2]], 4);
		for (const [x, y] of [[32, 58], [48, 57]] as const) fr.add(R("#b7c95a", 2.2), D(x, y));
		return `${k}${fr}`;
	}
	k.add(F(BARK), trunkD(40, 40, 64, 8, 5));
	k.add(K(BARK, 3), cub([40, 66], [32, 58], [22, 52], [16, 44]) + cub([40, 66], [48, 58], [58, 52], [64, 42]) + cub([40, 64], [36, 54], [32, 42], [30, 32]) + cub([40, 64], [44, 54], [48, 42], [50, 32]));
	crown(k, 18, 42, 13, 10, 18, 5.5, 2.6, g[0], [g[1], g[2]], 4);
	crown(k, 62, 40, 13, 10, 18, 5.5, 2.6, g[0], [g[2], g[1]], 4);
	crown(k, 40, 28, 20, 13, 30, 5.5, 2.6, g[0], [g[1], g[2]], 4);
	for (const [x, y] of [[14, 50], [19, 52], [24, 47], [58, 48], [63, 50], [68, 46], [32, 36], [36, 39], [46, 38], [50, 35], [40, 22], [28, 26], [54, 24], [40, 30]] as const) apri(fr, x, y);
	return `${k}${fr}`;
}

function sweetCherryTree(stage: GrowingStage): string {
	const g = ["#2f6a34", "#478a42", "#66a656"] as const;
	const cb = "#6b4640";
	const pair = (st: Ink, fr: Ink, x: number, y: number) => {
		st.add(K("#5d7a2e", 0.6), `M${f(x)} ${f(y)}L${f(x - 2.2)} ${f(y + 6)}M${f(x)} ${f(y)}L${f(x + 2)} ${f(y + 6.6)}`);
		fr.add(R("#a8172c", 2), D(x - 2.2, y + 7.4) + D(x + 2, y + 8)).add(R("#fff", 0.6, 0.45), D(x - 2.9, y + 6.8) + D(x + 1.3, y + 7.4));
	};
	if (stage === "sprout") return sap(19, (x, y) => trio(x, y, 9, 3, g[1], g[2]), cb, 1.6);
	const k = new Ink();
	const st = new Ink();
	const fr = new Ink();
	if (stage === "leafy") {
		k.add(F(cb), trunkD(40, 40, 46, 4, 2.4)).add(K(cb, 1.6), seg(40, 68, 32, 58) + seg(40, 62, 48, 52));
		crown(k, 32, 56, 7, 5, 8, 6, 2, g[0], [g[1], g[2]], 1, 0.6);
		crown(k, 48, 50, 7, 5, 8, 6, 2, g[0], [g[2], g[1]], 1, 0.6);
		crown(k, 40, 42, 7, 6, 8, 6, 2, g[0], [g[1], g[2]], 1, 0.6);
		pair(st, fr, 45, 53);
		return `${k}${st}${fr}`;
	}
	k.add(F(cb), trunkD(40, 40, 36, 7, 3.6)).add(K("#87655c", 0.7), seg(38.4, 78, 40.6, 78) + seg(39.4, 70, 41.4, 70) + seg(38.8, 62, 40.8, 62));
	k.add(K(cb, 2.2), cub([40, 66], [34, 60], [28, 56], [22, 50]) + cub([40, 60], [46, 54], [52, 48], [58, 42]) + cub([40, 50], [36, 44], [30, 38], [26, 30]) + cub([40, 44], [44, 38], [50, 32], [54, 24]));
	for (const [x, y, rx, ry] of [[22, 48, 10, 7], [58, 40, 10, 7], [26, 29, 10, 7], [54, 23, 10, 7], [40, 14, 9, 7], [40, 36, 8, 6]] as const) crown(k, x, y, rx, ry, 12, 6.5, 2.1, g[0], [g[1], g[2]], 1, 0.6);
	for (const [x, y] of [[18, 52], [27, 54], [56, 46], [64, 44], [22, 34], [31, 34], [50, 28], [59, 27], [36, 18], [45, 18], [40, 40]] as const) pair(st, fr, x, y);
	return `${k}${st}${fr}`;
}

function mangoTree(stage: GrowingStage): string {
	const g = ["#2a5328", "#3c6e35", "#4f8743"] as const;
	const bronze = ["#9a4a34", "#b8673f"] as const;
	const mb = "#6e5444";
	const mango = (st: Ink, fr: Ink, x: number, y: number, l: number, rot: number) => {
		st.add(K("#6a6a32", 0.7), seg(x, y, x, y + l));
		const cy = y + l + 3.4;
		fr.add(F("#e9b53a"), E(x, cy, 2.6, 3.9, rot)).add(F("#d6533a", 0.85), E(x - 0.6, cy - 1.2, 1.9, 2.4, rot)).add(SHINE, E(x - 1, cy + 0.8, 0.6, 1.2, rot));
	};
	if (stage === "sprout")
		return sap(16, (x, y) => [-160, -125, -95, -60, -25].map((a, i) => leaf(x, y + 1, a + 40 * Math.sign(a + 90), 11, 2, { fill: at(bronze, i), dark: "#5a2a20", shape: 1 })).join(""), mb, 1.6);
	const k = new Ink();
	const st = new Ink();
	const fr = new Ink();
	if (stage === "leafy") {
		k.add(F(mb), trunkD(40, 40, 58, 4.5, 3));
		k.add(F(g[0]), E(40, 50, 16, 10) + E(30, 56, 9, 6) + E(50, 56, 9, 6));
		crown(k, 40, 51, 17, 10, 24, 8, 1.7, null, [g[1], g[2]], 1, 0.7);
		crown(k, 40, 42, 9, 3, 6, 7, 1.7, null, bronze, 1, 0.4);
		mango(st, fr, 46, 60, 3, 10);
		return `${k}${st}${fr}`;
	}
	k.add(F(mb), trunkD(40, 40, 50, 9, 6)).add(K(mb, 3), seg(40, 62, 28, 52) + seg(40, 60, 52, 51));
	k.add(F(g[0]), E(40, 30, 24, 16) + E(18, 42, 13, 11) + E(62, 42, 13, 11) + E(40, 44, 22, 11) + E(28, 22, 11, 8) + E(52, 22, 11, 8));
	crown(k, 40, 36, 31, 21, 64, 9, 1.8, null, [g[1], g[2]], 1, 0.7);
	crown(k, 40, 17, 16, 4, 10, 8, 1.8, null, bronze, 1, 0.3);
	for (const [x, y, l, r] of [[13, 50, 4, -10], [24, 53, 6, 5], [34, 54, 3, -5], [47, 54, 7, 10], [57, 52, 4, -8], [67, 49, 3, 12]] as const) mango(st, fr, x, y, l, r);
	return `${k}${st}${fr}`;
}

function avocadoTree(stage: GrowingStage): string {
	const g = ["#2f5e33", "#467d40", "#5d9450"] as const;
	const ab = "#7a6a58";
	const avo = (st: Ink, fr: Ink, x: number, y: number) => {
		st.add(K("#6a7a3a", 0.8), seg(x, y - 2.5, x, y));
		fr.add(F("#3a2f2c"), E(x, y + 4.2, 2.6, 3.4) + E(x, y + 1.6, 1.5, 1.9)).add(F("#6a5a52"), E(x - 1.1, y + 4, 0.6, 1.4));
	};
	if (stage === "sprout") return sap(18, (x, y) => trio(x, y, 10, 3.6, g[1], g[2], 1), ab, 1.8);
	const k = new Ink();
	const st = new Ink();
	const fr = new Ink();
	if (stage === "leafy") {
		k.add(F(ab), trunkD(40, 41, 50, 4.2, 2.6));
		crown(k, 36, 54, 9, 7, 10, 8, 3, g[0], [g[1], g[2]], 1, 0.3);
		crown(k, 46, 44, 9, 8, 11, 8, 3, g[0], [g[2], g[1]], 1, 0.3);
		return `${k}`;
	}
	k.add(F(ab), trunkD(40, 44, 40, 7.5, 4)).add(K(ab, 2.6), cub([42, 62], [36, 54], [30, 48], [24, 42]) + cub([44, 50], [50, 46], [56, 44], [60, 42]));
	for (const [x, y, rx, ry] of [[22, 38, 11, 10], [60, 44, 10, 9], [36, 20, 13, 11], [53, 28, 13, 11], [42, 44, 14, 9]] as const) crown(k, x, y, rx, ry, 15, 9, 3.2, g[0], [g[1], g[2]], 1, 0.3);
	for (const [x, y] of [[20, 46], [30, 44], [48, 48], [58, 50], [40, 28], [56, 34], [30, 26]] as const) avo(st, fr, x, y);
	const cut = new Ink();
	cut.add(F("#3a2f2c"), E(62, 84, 4.6, 3.4, -15)).add(F("#dfe39a"), E(62, 84, 3.8, 2.7, -15)).add(F("#8a5a34"), C(62.6, 84.4, 1.5));
	return `${k}${st}${fr}${cut}`;
}

function papaya(stage: GrowingStage): string {
	const pt = "#9c9b7c";
	const g = ["#4f9a45", "#6ab055", "#3f8a3a"] as const;
	const crownAt = (k: Ink, x: number, y: number, leaves: readonly (readonly [number, number, number])[]) => {
		leaves.forEach(([a, len, r], i) => {
			const t = (a * Math.PI) / 180;
			const ex = x + Math.cos(t) * len;
			const ey = y + Math.sin(t) * len;
			k.add(K("#8fae62", 1), `M${f(x)} ${f(y)}Q${f(x + Math.cos(t) * len * 0.5)} ${f(y + Math.sin(t) * len * 0.5 - len * 0.3)} ${f(ex)} ${f(ey)}`);
			k.add(F(at(g, i)), palmD(ex, ey, r, 7, a, 0.3));
		});
	};
	const fruits = (fr: Ink, list: readonly (readonly [number, number, string])[], rx: number, ry: number) => {
		for (const [x, y, c] of list) fr.add(F(c), E(x, y, rx, ry));
		fr.add(SHINE, list.map(([x, y]) => E(x - rx * 0.4, y - ry * 0.1, rx * 0.22, ry * 0.32)).join(""));
	};
	if (stage === "sprout") {
		const k = new Ink();
		k.add(K(pt, 2), seg(40, 87, 40, 72));
		crownAt(k, 40, 72, [[-150, 5, 5], [-30, 5, 5], [-90, 3, 4.4]]);
		return `${k}`;
	}
	const k = new Ink();
	const fr = new Ink();
	if (stage === "leafy") {
		k.add(F(pt), trunkD(40, 40, 46, 3.6, 2.4)).add(K("#7d7c60", 0.7), seg(38.6, 78, 41.4, 78) + seg(38.8, 70, 41.2, 70) + seg(39, 62, 41, 62) + seg(39, 54, 41, 54));
		crownAt(k, 40, 46, [[-160, 11, 6.5], [-20, 11, 6.5], [-120, 10, 6.5], [-60, 10, 6.5], [-90, 8, 6], [160, 9, 5.5], [20, 9, 5.5]]);
		fruits(fr, [[38.2, 50, "#8db246"], [41.8, 50.4, "#9cba4a"]], 1.8, 3);
		return `${k}${fr}`;
	}
	k.add(F(pt), trunkD(40, 40, 24, 5, 2.8));
	let sc = "";
	for (let y = 82; y > 40; y -= 6) {
		const w = 2.4 - ((82 - y) / 60) * 1;
		sc += seg(40 - w, y, 40 + w, y - 0.6);
	}
	k.add(K("#7d7c60", 0.8), sc);
	crownAt(k, 40, 24, [[-165, 21, 9], [-15, 21, 9], [-130, 17, 9.5], [-50, 17, 9.5], [-90, 13, 9], [160, 18, 8], [20, 18, 8], [-110, 14, 7], [-70, 14, 7]]);
	fruits(fr, [[36.2, 31, "#8db246"], [43.8, 31, "#9cba4a"], [40, 30, "#a3c04e"], [36.6, 39.5, "#f0a03a"], [43.4, 39.5, "#8db246"], [40, 40.5, "#e88a2e"]], 2.8, 4.6);
	return `${k}${fr}`;
}

function persimmon(stage: GrowingStage): string {
	const pb = "#4e3a30";
	const g = ["#3f7a3a", "#5a9a48"] as const;
	const pers = (fr: Ink, x: number, y: number, r = 3.3) => {
		fr.add(F("#f07a1c"), E(x, y, r, r * 0.84)).add(F("#4f6b2a"), poly([[x, y - r * 1.1], [x + 0.8, y - r * 0.75], [x + 2.6, y - r * 0.9], [x + 1.2, y - r * 0.45], [x, y - r * 0.4], [x - 1.2, y - r * 0.45], [x - 2.6, y - r * 0.9], [x - 0.8, y - r * 0.75]]));
		fr.add(SHINE, E(x - r * 0.4, y + r * 0.05, r * 0.25, r * 0.35));
	};
	if (stage === "sprout") return sap(16, (x, y) => trio(x, y, 8, 4, g[0], g[1], 0), pb, 1.6);
	const k = new Ink();
	const fr = new Ink();
	if (stage === "leafy") {
		k.add(F(pb), trunkD(40, 40, 58, 4.5, 3)).add(K(pb, 1.6), seg(40, 66, 30, 56) + seg(40, 64, 50, 54));
		crown(k, 40, 50, 14, 11, 20, 6.5, 3, null, [g[0], g[1]], 0);
		for (const [x, y] of [[33, 52], [47, 49]] as const) fr.add(F("#c7b44a"), E(x, y, 2.4, 2));
		return `${k}${fr}`;
	}
	k.add(F(pb), trunkD(40, 40, 56, 7, 4));
	k.add(K(pb, 2.8), cub([40, 60], [32, 54], [22, 48], [12, 40]) + cub([40, 58], [36, 46], [30, 34], [26, 22]) + cub([40, 56], [44, 44], [50, 32], [54, 20]) + cub([40, 60], [48, 54], [58, 46], [68, 38]));
	k.add(K(pb, 1.3), seg(20, 46, 18, 36) + seg(29, 32, 20, 28) + seg(28, 28, 34, 16) + seg(50, 30, 44, 18) + seg(52, 26, 62, 18) + seg(60, 44, 62, 32) + seg(64, 41, 72, 44) + seg(14, 42, 7, 44) + seg(33, 50, 26, 44));
	const lv = new Ink();
	for (const [x, y, a, c] of [[18, 36, -60, "#c8502e"], [62, 32, -120, "#e08a3a"], [7, 44, 160, "#d06a30"], [44, 18, -110, "#c8502e"], [72, 44, 20, "#e08a3a"], [34, 16, -70, "#d06a30"]] as const) lv.add(F(c), leafD(x, y, a, 5, 2.2, 0));
	for (const [x, y] of [[13, 46], [22, 50], [18, 40], [28, 36], [22, 30], [34, 22], [47, 24], [56, 26], [62, 22], [62, 36], [70, 42], [58, 48], [30, 46], [50, 38]] as const) pers(fr, x, y);
	return `${k}${lv}${fr}`;
}

function loquat(stage: GrowingStage): string {
	const g = ["#2f5e34", "#3f7440"] as const;
	const lb = "#7a6a5a";
	const rosette = (k: Ink, rib: Ink, x: number, y: number, n: number, len: number, from: number, to: number) => {
		for (let i = 0; i < n; i++) {
			const a = from + ((to - from) * i) / (n - 1);
			k.add(F(at(g, i)), leafD(x, y, a, len, len * 0.3, 1));
			const t = (a * Math.PI) / 180;
			rib.add(K("#7da874", 0.6), seg(x + Math.cos(t) * 1.5, y + Math.sin(t) * 1.5, x + Math.cos(t) * len * 0.8, y + Math.sin(t) * len * 0.8));
		}
	};
	const bunch = (fr: Ink, x: number, y: number) => {
		const pts: XY[] = [[-2, 0], [2, 0.3], [0, 2.6], [-3.2, 3], [3, 3.2], [-1, 5.4], [1.8, 5.6]];
		fr.add(F("#f2b33a"), pts.map(([dx, dy]) => E(x + dx, y + dy, 1.6, 1.9)).join("")).add(R("#c98a2a", 0.4), pts.map(([dx, dy]) => D(x + dx, y + dy + 1.5)).join(""));
	};
	if (stage === "sprout") {
		const k = new Ink();
		const r = new Ink();
		k.add(K(lb, 1.8), seg(40, 87, 40, 73));
		rosette(k, r, 40, 73, 4, 10, -165, -15);
		return `${k}${r}`;
	}
	const k = new Ink();
	const r = new Ink();
	const fr = new Ink();
	if (stage === "leafy") {
		k.add(F(lb), trunkD(40, 40, 56, 4, 2.6)).add(K(lb, 1.8), seg(40, 66, 30, 58) + seg(40, 62, 50, 54));
		k.add(F("#24492a"), E(40, 54, 12, 8));
		rosette(k, r, 30, 58, 5, 12, -200, -20);
		rosette(k, r, 50, 54, 5, 12, -160, 20);
		rosette(k, r, 40, 50, 6, 12, -170, -10);
		return `${k}${r}`;
	}
	k.add(F(lb), trunkD(40, 40, 58, 7, 4)).add(K(lb, 2.4), seg(40, 66, 26, 54) + seg(40, 64, 54, 52) + seg(40, 60, 40, 40));
	k.add(F("#24492a"), E(40, 38, 25, 18) + E(20, 50, 10, 8) + E(60, 48, 10, 8));
	rosette(k, r, 18, 52, 6, 13, -220, 20);
	rosette(k, r, 62, 50, 6, 13, -200, 40);
	rosette(k, r, 26, 30, 6, 13, -220, 0);
	rosette(k, r, 54, 28, 6, 13, -180, 40);
	rosette(k, r, 40, 18, 6, 13, -190, 10);
	rosette(k, r, 40, 42, 6, 12, -180, 0);
	bunch(fr, 18, 50);
	bunch(fr, 62, 48);
	bunch(fr, 26, 28);
	bunch(fr, 54, 26);
	bunch(fr, 40, 16);
	bunch(fr, 40, 40);
	return `${k}${r}${fr}`;
}

function lychee(stage: GrowingStage): string {
	const g = ["#24502c", "#346b37", "#4a8545"] as const;
	const lt = "#6e5848";
	const bunch = (st: Ink, fr: Ink, x: number, y: number, n = 6) => {
		const pts: XY[] = [[0, 4], [-2.4, 6.4], [2.4, 6.6], [0, 8.8], [-2.8, 9.6], [2.6, 10.4], [0, 12.6]];
		st.add(K("#7a5a3a", 0.6), `M${f(x)} ${f(y)}L${f(x)} ${f(y + 10)}`);
		pts.slice(0, n).forEach(([dx, dy]) => {
			fr.add(R("#c42c35", 1.8), D(x + dx, y + dy)).add(R("#8c1a26", 0.35), D(x + dx + 0.6, y + dy + 0.5) + D(x + dx - 0.6, y + dy - 0.2)).add(R("#fff", 0.45, 0.45), D(x + dx - 0.7, y + dy - 0.8));
		});
	};
	if (stage === "sprout") return sap(15, (x, y) => [-165, -130, -50, -15].map((a, i) => leaf(x, y + 1 + (i % 2) * 3, a, 8, 2.4, { fill: i % 2 ? "#a54a3c" : g[2], shape: 1 })).join("") + leaf(x, y, -90, 6, 2, { fill: "#b8603f", shape: 1 }), lt, 1.6);
	const k = new Ink();
	const st = new Ink();
	const fr = new Ink();
	if (stage === "leafy") {
		k.add(F(lt), trunkD(40, 40, 58, 4.4, 3));
		crown(k, 40, 48, 15, 13, 26, 6, 1.8, g[0], [g[1], g[2]]);
		return `${k}`;
	}
	k.add(F(lt), trunkD(40, 40, 54, 8, 5));
	crown(k, 40, 32, 28, 25, 62, 6.5, 1.9, g[0], [g[1], g[2]]);
	for (const [x, y, n] of [[16, 40, 7], [28, 48, 6], [44, 50, 7], [60, 44, 6], [24, 24, 5], [40, 16, 5], [56, 26, 6], [38, 34, 4]] as const) bunch(st, fr, x, y, n);
	return `${k}${st}${fr}`;
}

function guava(stage: GrowingStage): string {
	const bark = "#c39a6c";
	const g = ["#467d3a", "#5f9a44", "#7bb25a"] as const;
	const patches = (k: Ink, pts: readonly XY[]) => pts.forEach(([x, y], i) => k.add(F(i % 2 ? "#8f9a68" : "#e0c69a"), E(x, y, 0.9, 1.8)));
	if (stage === "sprout") return sap(16, (x, y) => trio(x, y, 8, 3.8, g[1], g[2], 0), bark, 1.8);
	const k = new Ink();
	const fr = new Ink();
	if (stage === "leafy") {
		k.add(K(bark, 2.4), cub([40, 87], [38, 76], [32, 70], [30, 60]) + cub([40, 87], [42, 76], [48, 68], [50, 56]));
		crown(k, 30, 56, 9, 7, 10, 7, 3.2, g[0], [g[1], g[2]], 0);
		crown(k, 50, 52, 9, 7, 10, 7, 3.2, g[0], [g[2], g[1]], 0);
		fr.add(R("#f6f3e6", 2), D(36, 50));
		return `${k}${fr}`;
	}
	k.add(K(bark, 4), cub([38, 87], [36, 74], [26, 64], [22, 50]) + cub([40, 87], [40, 72], [44, 58], [42, 40]) + cub([42, 87], [48, 76], [56, 66], [60, 52]));
	patches(k, [[36, 80], [33.5, 70], [28, 62], [40.5, 74], [42.5, 62], [47, 76], [53, 68], [24, 54]]);
	crown(k, 20, 46, 13, 10, 16, 7.5, 3.4, g[0], [g[1], g[2]], 0);
	crown(k, 60, 48, 13, 10, 16, 7.5, 3.4, g[0], [g[2], g[1]], 0);
	crown(k, 41, 32, 16, 13, 22, 7.5, 3.4, g[0], [g[1], g[2]], 0);
	for (const [x, y] of [[16, 54], [26, 50], [56, 56], [64, 52], [36, 40], [48, 38], [40, 24]] as const) fr.add(R("#d6dc72", 3), D(x, y)).add(R("#9aa53a", 0.6), D(x, y + 2.8)).add(R("#fff", 0.8, 0.45), D(x - 1, y - 1));
	for (const [x, y] of [[30, 36], [56, 42], [18, 40]] as const) {
		let d = "";
		for (let i = 0; i < 12; i++) d += seg(x, y, x + Math.cos(i * 0.52) * 2.4, y + Math.sin(i * 0.52) * 2.4);
		fr.add(K("#f6f3e6", 0.6), d);
	}
	fr.add(R("#cfd56c", 4), D(62, 84)).add(R("#f07a86", 3.1), D(62, 84)).add(R("#f9cfa4", 0.4), D(61, 83) + D(63, 83.4) + D(62, 85.3) + D(60.7, 85) + D(63.4, 85.2));
	return `${k}${fr}`;
}

function jackfruit(stage: GrowingStage): string {
	const jb = "#6e5a48";
	const g = ["#24502b", "#33683a", "#4a8448"] as const;
	const jack = (st: Ink, fr: Ink, tx: Ink, x: number, y: number, rx: number, ry: number, rot = 0) => {
		st.add(K("#5a6a2a", 1.1), seg(x, y - ry - 2, x, y - ry + 1));
		fr.add(F("#9fae3c"), E(x, y, rx, ry, rot));
		let d = "";
		for (let j = -2; j <= 2; j++) for (let i = -1; i <= 1; i++) if (Math.abs(i * 0.5) + Math.abs(j * 0.25) < 0.95) d += D(x + i * rx * 0.5 + (j % 2 ? rx * 0.25 : 0), y + j * ry * 0.33);
		tx.add(R("#7d8a2a", 0.45), d);
	};
	if (stage === "sprout") return sap(18, (x, y) => trio(x, y, 8, 3.6, g[1], g[2], 0), jb, 1.8);
	const k = new Ink();
	const st = new Ink();
	const fr = new Ink();
	const tx = new Ink();
	if (stage === "leafy") {
		k.add(F(jb), trunkD(40, 40, 46, 5, 3.2));
		crown(k, 40, 40, 13, 13, 22, 6, 2.8, g[0], [g[1], g[2]], 0);
		jack(st, fr, tx, 37, 64, 2.6, 4.4);
		return `${k}${st}${fr}${tx}`;
	}
	k.add(F(jb), trunkD(40, 40, 30, 9, 5.5)).add(K(jb, 3), seg(40, 50, 26, 40) + seg(40, 46, 55, 36));
	crown(k, 40, 25, 24, 20, 56, 7, 3, g[0], [g[1], g[2]], 0);
	jack(st, fr, tx, 34, 62, 4.4, 7.4, 6);
	jack(st, fr, tx, 46.5, 73, 4.6, 7.6, -6);
	jack(st, fr, tx, 26, 48, 3.8, 6.4);
	jack(st, fr, tx, 55, 46, 3.6, 6);
	return `${k}${st}${fr}${tx}`;
}

function breadfruit(stage: GrowingStage): string {
	const bb = "#7a6a5a";
	const g = ["#2f6a34", "#45853f", "#5e9d4f"] as const;
	const bread = (fr: Ink, x: number, y: number, r: number) => {
		fr.add(R("#a8c54e", r), D(x, y));
		let d = "";
		for (const [dx, dy] of [[-0.45, -0.3], [0.2, -0.5], [0.5, 0.15], [-0.1, 0.2], [-0.5, 0.45], [0.2, 0.6]] as const) d += D(x + dx * r, y + dy * r);
		fr.add(R("#c9dd7c", r * 0.16), d);
	};
	if (stage === "sprout") {
		const k = new Ink();
		k.add(K(bb, 1.8), seg(40, 87, 40, 70)).add(F(g[1]), lobedD(40, 72, -140, 12, 4.4) + lobedD(40, 72, -40, 12, 4.4)).add(F(g[2]), lobedD(40, 70, -90, 9, 3.4));
		return `${k}`;
	}
	const k = new Ink();
	const fr = new Ink();
	const big = (x: number, y: number, n: number, len: number, from: number, to: number) => {
		for (let i = 0; i < n; i++) k.add(F(at(g, i + 1)), lobedD(x, y, from + ((to - from) * i) / Math.max(1, n - 1), len, len * 0.36));
	};
	if (stage === "leafy") {
		k.add(F(bb), trunkD(40, 40, 52, 4.4, 2.8));
		big(40, 54, 6, 16, -175, -5);
		bread(fr, 46, 56, 3.2);
		return `${k}${fr}`;
	}
	k.add(F(bb), trunkD(40, 40, 46, 8, 5)).add(K(bb, 2.8), cub([40, 60], [32, 54], [24, 50], [18, 46]) + cub([40, 58], [48, 52], [56, 48], [62, 44]) + seg(40, 50, 40, 32));
	k.add(F(g[0]), E(40, 30, 21, 14) + E(21, 43, 12, 9) + E(59, 41, 12, 9) + E(40, 42, 15, 9));
	big(19, 46, 4, 16, -210, -110);
	big(61, 44, 4, 16, -70, 30);
	big(40, 30, 6, 19, -165, -15);
	big(30, 40, 2, 14, -150, -110);
	big(50, 39, 2, 14, -70, -30);
	bread(fr, 17, 50, 4);
	bread(fr, 61, 49, 4);
	bread(fr, 33, 40, 4.4);
	bread(fr, 48, 36, 4);
	bread(fr, 40, 46, 3.6);
	return `${k}${fr}`;
}

function mulberry(stage: GrowingStage): string {
	const mb = "#7a5a40";
	const g = ["#3e7a37", "#5c9a45", "#79b25a"] as const;
	const BERRY = ["#3a1a3a", "#b02a3a", "#5a1f45"] as const;
	const berry = (fr: Ink, x: number, y: number, i: number) => fr.add(R(at(BERRY, i), 1.3), `M${f(x)} ${f(y - 1)}v2.2`);
	if (stage === "sprout") return sap(15, (x, y) => trio(x, y, 7, 3.2, g[1], g[2], 4), mb, 1.6);
	const k = new Ink();
	const fr = new Ink();
	const strand = (x: number, y: number, len: number, side: number, n: number) => {
		k.add(K(mb, 0.9), `M${f(x)} ${f(y)}Q${f(x + side * 4)} ${f(y + 2)} ${f(x + side * 4)} ${f(y + len)}`);
		for (let i = 1; i <= n; i++) {
			const yy = y + (len * i) / (n + 0.4);
			const xx = x + side * 4 * Math.min(1, (i / n) * 1.6);
			k.add(F(at(g, i + 1)), leafD(xx, yy, 90 + side * (i % 2 ? 45 : -45), 6, 2.6, 4));
			if (i % 2 === 0) berry(fr, xx - side * 1.6, yy + 3, i + x);
		}
	};
	if (stage === "leafy") {
		k.add(F(mb), trunkD(40, 40, 54, 4.4, 3));
		k.add(F(g[0]), E(40, 52, 15, 7));
		crown(k, 40, 51, 14, 6, 12, 5.5, 2.4, null, [g[1], g[2]], 4);
		strand(26, 54, 12, -1, 3);
		strand(54, 54, 12, 1, 3);
		return `${k}${fr}`;
	}
	k.add(F(mb), trunkD(40, 40, 30, 8, 5)).add(K(mb, 2.6), cub([40, 36], [32, 30], [22, 30], [12, 34]) + cub([40, 36], [48, 30], [58, 30], [68, 34]));
	k.add(F(g[0]), E(40, 27, 30, 12) + E(14, 36, 8, 6) + E(66, 36, 8, 6));
	crown(k, 40, 25, 28, 10, 26, 6, 2.6, null, [g[1], g[2]], 4);
	for (const [x, len, side] of [[12, 42, -1], [20, 36, -1], [29, 26, -1], [51, 26, 1], [60, 36, 1], [68, 42, 1]] as const) strand(x, 34, len, side, Math.round(len / 6.5));
	for (const [x, y, i] of [[30, 38, 0], [50, 38, 1], [22, 34, 2], [58, 34, 0], [36, 22, 0], [46, 20, 2], [24, 22, 1], [56, 24, 0]] as const) berry(fr, x, y, i);
	return `${k}${fr}`;
}

function walnut(stage: GrowingStage): string {
	const wb = "#a39b8e";
	const g = ["#4a7a34", "#6a9a45", "#8ab45a"] as const;
	const husk = (fr: Ink, x: number, y: number) => fr.add(R("#b3c95e", 2.8), D(x, y)).add(R("#8aa140", 0.35), D(x + 0.8, y + 0.7) + D(x - 0.6, y + 1.2) + D(x + 1.2, y - 0.8)).add(R("#fff", 0.7, 0.45), D(x - 1, y - 1));
	const nut = (fr: Ink, x: number, y: number) => {
		fr.add(F("#6f8f34"), E(x - 2.4, y + 0.4, 1.6, 3, -25) + E(x + 2.4, y + 0.4, 1.6, 3, 25)).add(F("#c4955a"), E(x, y, 2.4, 2.8));
		fr.add(K("#7a5430", 0.6), `M${f(x)} ${f(y - 2.6)}L${f(x)} ${f(y + 2.6)}M${f(x - 1.6)} ${f(y - 0.6)}l1 .5M${f(x + 1.6)} ${f(y + 0.4)}l-1 .5M${f(x - 1.4)} ${f(y + 1.4)}l.9 .3`);
	};
	const pinn = (k: Ink, x: number, y: number, deg: number, len: number) => {
		const t = (deg * Math.PI) / 180;
		k.add(K("#5d7a34", 0.8), seg(x, y, x + Math.cos(t) * len, y + Math.sin(t) * len));
		for (let i = 1; i <= 3; i++) {
			const px = x + Math.cos(t) * len * (i / 3.4);
			const py = y + Math.sin(t) * len * (i / 3.4);
			k.add(F(at(g, i)), leafD(px, py, deg - 55, 4.6, 1.6) + leafD(px, py, deg + 55, 4.6, 1.6));
		}
		k.add(F(g[2]), leafD(x + Math.cos(t) * len * 0.9, y + Math.sin(t) * len * 0.9, deg, 5, 1.8));
	};
	if (stage === "sprout") {
		const k = new Ink();
		k.add(K(wb, 1.8), seg(40, 87, 40, 71));
		pinn(k, 40, 72, -130, 9);
		pinn(k, 40, 72, -50, 9);
		pinn(k, 40, 71, -90, 6);
		return `${k}`;
	}
	const k = new Ink();
	const fr = new Ink();
	if (stage === "leafy") {
		k.add(F(wb), trunkD(40, 40, 56, 5, 3)).add(K(wb, 1.8), seg(40, 66, 30, 56) + seg(40, 64, 50, 54));
		k.add(F(g[0]), E(30, 53, 9, 6) + E(50, 51, 9, 6) + E(40, 46, 9, 7)).add(F(g[1]), E(29, 51, 6, 4) + E(49, 49, 6, 4) + E(39, 44, 6, 4.6));
		for (const [x, y, a] of [[24, 53, -160], [56, 51, -20], [40, 41, -90], [33, 44, -125], [47, 43, -55]] as const) pinn(k, x, y, a, 9);
		husk(fr, 34, 55);
		husk(fr, 48, 54);
		return `${k}${fr}`;
	}
	k.add(F(wb), trunkD(40, 40, 54, 11, 6)).add(K(wb, 3.6), cub([40, 62], [32, 54], [24, 50], [16, 46]) + cub([40, 60], [36, 50], [30, 40], [28, 32]) + cub([40, 60], [44, 50], [50, 40], [52, 30]) + cub([40, 62], [48, 54], [56, 50], [64, 46]));
	k.add(F(g[0]), E(17, 42, 11, 8) + E(63, 40, 11, 8) + E(28, 29, 13, 10) + E(52, 27, 13, 10) + E(40, 21, 12, 9) + E(40, 38, 15, 8));
	k.add(F(g[1]), E(16, 40, 8, 5.5) + E(62, 38, 8, 5.5) + E(27, 27, 10, 7) + E(51, 25, 10, 7) + E(39, 19, 9, 6.5) + E(40, 36, 11, 5));
	k.add(F(g[2]), E(24, 24, 4, 2.6) + E(48, 22, 4, 2.6) + E(36, 16, 4, 2.4) + E(13, 38, 3, 2));
	for (const [x, y, a] of [[14, 42, -175], [66, 40, -5], [17, 30, -145], [63, 28, -35], [33, 15, -110], [47, 14, -70], [15, 48, 150], [65, 46, 30], [26, 47, 120], [54, 45, 60]] as const) pinn(k, x, y, a, 5.5);
	for (const [x, y] of [[18, 46], [62, 44], [30, 36], [50, 32], [40, 24], [24, 32]] as const) husk(fr, x, y);
	nut(fr, 40, 42);
	nut(fr, 57, 34);
	return `${k}${fr}`;
}

function almond(stage: GrowingStage): string {
	const ab = "#4d3b36";
	const g = ["#6fa850", "#8cc46a"] as const;
	if (stage === "sprout") return sap(17, (x, y) => trio(x, y, 10, 2.4, g[0], g[1]), ab, 1.6);
	const k = new Ink();
	const fr = new Ink();
	if (stage === "leafy") {
		k.add(F(ab), trunkD(40, 40, 60, 4.4, 2.8)).add(K(ab, 1.6), seg(40, 66, 28, 54) + seg(40, 64, 52, 52) + seg(40, 62, 40, 46));
		for (const [x, y] of [[28, 54], [52, 52], [40, 46], [34, 59], [46, 57]] as const) for (let i = 0; i < 5; i++) k.add(F(at(g, i)), leafD(x, y, -160 + i * 35, 9, 1.8, 1));
		for (const [x, y] of [[30, 58], [48, 56], [41, 50]] as const) fr.add(F("#a7b58a"), E(x, y, 2, 2.8, 15)).add(K("#7d8c62", 0.5), seg(x - 0.4, y - 2.4, x + 0.4, y + 2.4));
		return `${k}${fr}`;
	}
	k.add(F(ab), trunkD(40, 40, 60, 7.5, 4.2));
	k.add(K(ab, 2.6), cub([40, 62], [32, 56], [24, 50], [14, 40]) + cub([40, 62], [36, 50], [32, 38], [28, 22]) + cub([40, 60], [44, 48], [50, 36], [54, 20]) + cub([40, 62], [48, 56], [58, 48], [67, 36]));
	k.add(K(ab, 1.3), seg(20, 46, 16, 32) + seg(31, 34, 20, 24) + seg(30, 28, 36, 14) + seg(51, 30, 44, 14) + seg(52, 24, 62, 14) + seg(60, 44, 64, 28) + seg(36, 52, 42, 40) + seg(14, 40, 6, 36) + seg(67, 36, 74, 32));
	const pts: XY[] = [[14, 40], [8, 37], [18, 44], [16, 32], [22, 38], [20, 25], [27, 30], [28, 22], [33, 26], [36, 15], [31, 18], [44, 15], [50, 24], [54, 20], [47, 28], [62, 15], [58, 22], [64, 28], [62, 38], [67, 35], [73, 32], [57, 46], [42, 40], [38, 46], [26, 46], [50, 40]];
	pts.forEach(([x, y], i) => blossom(fr, x, y, 4, i % 3 ? "#fbf1f2" : "#f6d4dc", "#c9405e", i * 23));
	for (const [x, y, a] of [[24, 40, -40], [46, 34, -140], [60, 32, -60], [34, 36, -120]] as const) fr.add(F(g[1]), leafD(x, y, a, 5, 1.4, 1));
	return `${k}${fr}`;
}

function hazelnut(stage: GrowingStage): string {
	const hb = "#8a6a50";
	const g = ["#4f8a3c", "#6aa34e", "#86b964"] as const;
	const cluster = (fr: Ink, x: number, y: number) => {
		for (const dx of [-1.8, 1.8]) {
			fr.add(F("#b07a40"), E(x + dx, y + 2.4, 1.8, 2)).add(F("#a6c860"), leafD(x + dx, y + 1.4, -90 - dx * 12, 3.6, 1.6) + leafD(x + dx, y + 1.4, -60 - dx * 8, 3, 1.2) + leafD(x + dx, y + 1.4, -120 - dx * 8, 3, 1.2));
			fr.add(R("#fff", 0.45, 0.45), D(x + dx - 0.6, y + 2));
		}
	};
	const cat = (ct: Ink, x: number, y: number, l = 6) => ct.add(K("#dcc048", 1.6), `M${f(x)} ${f(y)}Q${f(x + 1)} ${f(y + l * 0.5)} ${f(x + 0.4)} ${f(y + l)}`);
	type P4 = readonly [XY, XY, XY, XY];
	const pt = (p: P4, t: number): [number, number] => {
		const u = 1 - t;
		const c = (i: 0 | 1) => u * u * u * p[0][i] + 3 * u * u * t * p[1][i] + 3 * u * t * t * p[2][i] + t * t * t * p[3][i];
		return [c(0), c(1)];
	};
	const shrub = (k: Ink, lv: Ink, stems: readonly P4[], w: number, ts: readonly number[], len: number) => {
		stems.forEach((p, si) => {
			k.add(K(hb, w), cub(...p));
			ts.forEach((t, j) => {
				const [x, y] = pt(p, t);
				const [x2, y2] = pt(p, Math.min(1, t + 0.03));
				const dir = (Math.atan2(y2 - y, x2 - x) * 180) / Math.PI;
				lv.add(F(at(g, si + j)), leafD(x, y, dir + (j % 2 ? 55 : -55), len, len * 0.42, 4));
			});
			const [ex, ey] = p[3];
			lv.add(F(at(g, si + 1)), leafD(ex, ey, (Math.atan2(ey - p[2][1], ex - p[2][0]) * 180) / Math.PI, len, len * 0.42, 4));
		});
	};
	if (stage === "sprout") return sap(15, (x, y) => trio(x, y, 7, 3, g[1], g[2], 4), hb, 1.4);
	const k = new Ink();
	const lv = new Ink();
	const ct = new Ink();
	const fr = new Ink();
	if (stage === "leafy") {
		shrub(k, lv, [[[38, 87], [36, 76], [32, 66], [28, 52]], [[40, 87], [40, 74], [40, 60], [40, 44]], [[42, 87], [44, 76], [48, 66], [52, 52]]], 1.6, [0.45, 0.62, 0.78, 0.92], 6.5);
		cat(ct, 34, 62);
		cat(ct, 46, 58);
		return `${k}${lv}${ct}`;
	}
	const tips: XY[] = [[10, 42], [20, 24], [34, 12], [48, 13], [60, 23], [70, 40]];
	const stems = tips.map(([tx, ty], i): P4 => [[36 + i * 1.6, 87], [36 + i * 1.6, 70], [tx + (40 - tx) * 0.3, ty + 20], [tx, ty]]);
	shrub(k, lv, stems, 2, [0.4, 0.52, 0.64, 0.76, 0.88], 7.5);
	for (const [x, y] of [[16, 42], [27, 30], [51, 26], [63, 36], [38, 22], [44, 38]] as const) cluster(fr, x, y);
	for (const [x, y] of [[22, 46], [31, 40], [46, 22], [57, 42], [34, 30], [62, 28], [15, 52]] as const) cat(ct, x, y, 7);
	return `${k}${lv}${ct}${fr}`;
}

function sweetChestnut(stage: GrowingStage): string {
	const cb = "#6e5038";
	const g = ["#3f7232", "#5a9040", "#78ab55"] as const;
	const burr = (fr: Ink, x: number, y: number, open: boolean) => {
		let d = "";
		for (let i = 0; i < 16; i++) {
			const a = (i * 22.5 * Math.PI) / 180;
			d += seg(x + Math.cos(a) * 2.6, y + Math.sin(a) * 2.6, x + Math.cos(a) * 4.4, y + Math.sin(a) * 4.4);
		}
		fr.add(K("#c4d25a", 0.7), d).add(R("#b0c24a", 3), D(x, y));
		if (open) fr.add(F("#e8dfa8"), E(x, y, 2.6, 2)).add(F("#7a3c1e"), E(x - 1.1, y + 0.2, 1.3, 1.6) + E(x + 1.1, y + 0.2, 1.3, 1.6)).add(R("#fff", 0.4, 0.45), D(x - 1.4, y - 0.6) + D(x + 0.8, y - 0.6));
	};
	if (stage === "sprout") return sap(17, (x, y) => trio(x, y, 10, 2.6, g[1], g[2]), cb, 1.8);
	const k = new Ink();
	const fr = new Ink();
	if (stage === "leafy") {
		k.add(F(cb), trunkD(40, 40, 54, 5, 3));
		crown(k, 40, 46, 15, 13, 22, 8.5, 2, g[0], [g[1], g[2]]);
		burr(fr, 46, 52, false);
		return `${k}${fr}`;
	}
	k.add(F(cb), trunkD(40, 40, 50, 12, 7)).add(K("#4f3626", 0.8), cub([36, 86], [38, 76], [42, 66], [44, 54]) + cub([40, 86], [42, 76], [44, 68], [46, 60]) + cub([43, 86], [44, 80], [46, 74], [44, 66]));
	crown(k, 40, 32, 31, 25, 54, 10, 2.2, g[0], [g[1], g[2]]);
	for (const [x, y, o] of [[18, 40, false], [30, 48, true], [50, 48, false], [62, 38, true], [26, 24, false], [44, 30, true], [56, 20, false], [38, 14, false]] as const) burr(fr, x, y, o);
	return `${k}${fr}`;
}

function pecan(stage: GrowingStage): string {
	const pb = "#8a7a6a";
	const gold = ["#b5872a", "#d6a53a", "#eac45c"] as const;
	const g = ["#3f7a36", "#5a9446", "#78ad5a"] as const;
	const nuts = (st: Ink, fr: Ink, x: number, y: number) => {
		st.add(K("#5a4a2a", 0.7), `M${f(x)} ${f(y)}l-2.4 2.6M${f(x)} ${f(y)}l2.4 2.6M${f(x)} ${f(y)}v4`);
		fr.add(F("#5f6e30"), leafD(x - 2.4, y + 2.4, 100, 6.4, 1.9) + leafD(x + 2.4, y + 2.4, 80, 6.4, 1.9));
		const oy = y + 6.4;
		fr.add(F("#3c4122"), leafD(x, oy, -140, 3.6, 1.2) + leafD(x, oy, -40, 3.6, 1.2) + leafD(x, oy, 140, 3.6, 1.2) + leafD(x, oy, 40, 3.6, 1.2));
		fr.add(F("#ad6a32"), E(x, oy, 1.5, 2.6)).add(K("#4a2a16", 0.45), `M${f(x - 0.5)} ${f(oy - 1.6)}v3.2M${f(x + 0.5)} ${f(oy - 1.6)}v3.2`);
	};
	const pinnate = (k: Ink, x: number, y: number, deg: number, len: number, cols: Pal) => {
		const t = (deg * Math.PI) / 180;
		for (let i = 1; i <= 3; i++) {
			const px = x + Math.cos(t) * len * (i / 3.4);
			const py = y + Math.sin(t) * len * (i / 3.4);
			k.add(F(at(cols, i)), leafD(px, py, deg - 50, 4.6, 1.3) + leafD(px, py, deg + 50, 4.6, 1.3));
		}
	};
	const tall = (k: Ink, pal: Pal, cx: number, top: number, sc: number, n: number) => {
		const b: [number, number, number, number][] = [[0, 12, 11, 10], [-8, 24, 11, 10], [8, 23, 11, 10], [0, 34, 14, 10], [-6, 44, 10, 6], [6, 44, 10, 6]];
		k.add(F(at(pal, 0)), b.map(([dx, dy, rx, ry]) => E(cx + dx * sc, top + dy * sc, rx * sc, ry * sc)).join(""));
		crown(k, cx, top + 27 * sc, 16 * sc, 24 * sc, n, 6.5 * sc + 1, 1.5, null, pal.slice(1), 1, 0.55);
	};
	if (stage === "sprout") {
		const k = new Ink();
		k.add(K(pb, 1.6), seg(40, 87, 40, 68));
		pinnate(k, 40, 72, -125, 10, [g[1], g[2]]);
		pinnate(k, 40, 72, -55, 10, [g[1], g[2]]);
		pinnate(k, 40, 69, -90, 8, [g[2], g[1]]);
		return `${k}`;
	}
	const k = new Ink();
	const st = new Ink();
	const fr = new Ink();
	if (stage === "leafy") {
		k.add(F(pb), trunkD(40, 40, 50, 4, 2.4));
		tall(k, g, 40, 32, 0.62, 26);
		return `${k}`;
	}
	k.add(F(pb), trunkD(40, 40, 40, 9, 4)).add(K(pb, 2.2), seg(40, 58, 30, 48) + seg(40, 54, 50, 44));
	tall(k, gold, 40, 8.5, 1, 64);
	for (const [x, y] of [[29, 46], [50, 44], [27, 26], [54, 28], [40, 34], [40, 15]] as const) nuts(st, fr, x, y);
	return `${k}${st}${fr}`;
}

function pistachio(stage: GrowingStage): string {
	const pb = "#857565";
	const g = ["#64805a", "#86a06a", "#a3b886"] as const;
	const bunch = (st: Ink, fr: Ink, x: number, y: number) => {
		st.add(K("#8a6a4a", 0.6), seg(x, y, x, y + 8));
		const rows = [3, 4, 3, 2, 1];
		rows.forEach((n, r) => {
			for (let i = 0; i < n; i++) fr.add(R(at(["#d98a8a", "#ecc0a6", "#c46a74"], i + r), 1.25), D(x + (i - (n - 1) / 2) * 2.2, y + 2 + r * 1.9));
		});
	};
	if (stage === "sprout") return sap(14, (x, y) => trio(x, y, 7, 3.6, g[1], g[2], 2, "#4a5a3e"), pb, 1.6);
	const k = new Ink();
	const st = new Ink();
	const fr = new Ink();
	if (stage === "leafy") {
		k.add(K(pb, 3), cub([40, 87], [42, 78], [36, 70], [40, 62])).add(K(pb, 1.6), seg(40, 64, 30, 58) + seg(40, 63, 52, 57));
		crown(k, 30, 56, 9, 5, 9, 5.5, 2.4, g[0], [g[1], g[2]], 2);
		crown(k, 52, 55, 9, 5, 9, 5.5, 2.4, g[0], [g[2], g[1]], 2);
		crown(k, 41, 52, 8, 5, 8, 5.5, 2.4, g[0], [g[1], g[2]], 2);
		return `${k}`;
	}
	k.add(K(pb, 6), cub([40, 88], [46, 76], [32, 68], [40, 56]));
	k.add(K(pb, 3), cub([40, 58], [32, 52], [24, 50], [16, 46]) + cub([40, 58], [48, 52], [56, 50], [64, 44]) + cub([40, 58], [38, 50], [34, 42], [30, 36]) + cub([40, 58], [44, 50], [50, 42], [52, 34]));
	crown(k, 17, 42, 9, 7, 11, 5, 2.4, g[0], [g[1], g[2]], 2);
	crown(k, 63, 40, 9, 7, 11, 5, 2.4, g[0], [g[2], g[1]], 2);
	crown(k, 31, 32, 13, 8, 15, 6, 2.6, g[0], [g[1], g[2]], 2);
	crown(k, 52, 30, 13, 8, 15, 6, 2.6, g[0], [g[2], g[1]], 2);
	for (const [x, y] of [[14, 46], [23, 48], [58, 45], [67, 44], [30, 38], [42, 36], [52, 36]] as const) bunch(st, fr, x, y);
	return `${k}${st}${fr}`;
}

function macadamia(stage: GrowingStage): string {
	const mb = "#6a5a4a";
	const g = ["#244b2e", "#36633a", "#4b7d46"] as const;
	const rac = (r: Ink, x: number, y: number, l: number) => r.add(K("#efe5c8", 1.8, ` stroke-dasharray=".1 1.5"`), `M${f(x)} ${f(y)}Q${f(x + 1.2)} ${f(y + l * 0.5)} ${f(x + 0.4)} ${f(y + l)}`);
	const nuts = (st: Ink, fr: Ink, x: number, y: number, n: number) => {
		st.add(K("#6a6a3a", 0.6), seg(x, y, x, y + n * 3.6));
		for (let i = 0; i < n; i++) {
			const nx = x + (i % 2 ? 1.6 : -1.6);
			const ny = y + 2.4 + i * 3.6;
			fr.add(R("#9bbf55", 2), D(nx, ny)).add(R("#fff", 0.55, 0.45), D(nx - 0.7, ny - 0.7));
		}
	};
	if (stage === "sprout") return sap(15, (x, y) => [-160, -120, -60, -20, -90].map((a, i) => leaf(x, y + 2, a, 8, 1.8, { fill: at(g, i + 1), shape: 1 })).join(""), mb, 1.6);
	const k = new Ink();
	const r = new Ink();
	const st = new Ink();
	const fr = new Ink();
	if (stage === "leafy") {
		k.add(F(mb), trunkD(40, 40, 54, 4.2, 2.8));
		k.add(F(g[0]), "M40 30Q54 40 54 52Q52 62 40 62Q28 62 26 52Q26 40 40 30Z");
		crown(k, 40, 48, 12, 12, 22, 7, 1.7, null, [g[1], g[2]]);
		rac(r, 32, 54, 8);
		rac(r, 47, 52, 9);
		return `${k}${r}`;
	}
	k.add(F(mb), trunkD(40, 40, 50, 8, 4.5));
	k.add(F(g[0]), "M40 6Q66 22 68 44Q66 60 40 62Q14 60 12 44Q14 22 40 6Z");
	crown(k, 40, 36, 25, 24, 70, 7.5, 1.8, null, [g[1], g[2]]);
	for (const [x, y, l] of [[20, 40, 12], [30, 50, 13], [56, 46, 12], [46, 26, 11], [26, 26, 10]] as const) rac(r, x, y, l);
	for (const [x, y, n] of [[38, 44, 3], [62, 36, 2], [16, 50, 2], [50, 54, 2], [36, 18, 2]] as const) nuts(st, fr, x, y, n);
	fr.add(R("#7a4a28", 2.4), D(58, 85)).add(F("#efe0b5"), E(58.2, 85.2, 1.4, 1.5)).add(R("#7a4a28", 2.3), D(22, 85));
	return `${k}${r}${st}${fr}`;
}

function cashew(stage: GrowingStage): string {
	const cb = "#7a5e46";
	const g = ["#356b30", "#4b8a3c", "#64a24c"] as const;
	const fruit = (st: Ink, fr: Ink, x: number, y: number, red: boolean) => {
		st.add(K("#6a5a32", 0.7), seg(x, y - 2, x, y));
		const P = (u: number, v: number) => `${f(x + u)} ${f(y + v)}`;
		fr.add(F(red ? "#de3a2e" : "#f2b632"), `M${P(-1.5, 0)}C${P(-4.6, 1.8)} ${P(-4.2, 8.4)} ${P(0, 8.6)}C${P(4.2, 8.4)} ${P(4.6, 1.8)} ${P(1.5, 0)}Z`);
		fr.add(F("#b9b38a"), `M${P(-3.4, 8.6)}C${P(-4, 13.4)} ${P(4, 13.4)} ${P(3.4, 8.6)}C${P(2, 10.6)} ${P(-2, 10.6)} ${P(-3.4, 8.6)}Z`);
		fr.add(SHINE, E(x - 1.7, y + 3.2, 0.8, 1.6));
	};
	const tuft = (k: Ink, x: number, y: number, n: number, len: number) => {
		for (let i = 0; i < n; i++) k.add(F(at(g, i + 1)), leafD(x, y, -180 + (i * 360) / n + 20, len, len * 0.32, 2));
	};
	if (stage === "sprout") return sap(15, (x, y) => trio(x, y, 7.5, 3, g[1], g[2], 2), cb, 1.6);
	const k = new Ink();
	const st = new Ink();
	const fr = new Ink();
	if (stage === "leafy") {
		k.add(K(cb, 2.6), cub([40, 87], [38, 76], [44, 68], [40, 60])).add(K(cb, 1.6), seg(40, 66, 30, 58) + seg(40, 64, 52, 56));
		tuft(k, 30, 58, 6, 9);
		tuft(k, 52, 56, 6, 9);
		tuft(k, 40, 54, 6, 8);
		return `${k}`;
	}
	k.add(K(cb, 6), cub([40, 88], [36, 76], [46, 68], [40, 60]));
	k.add(K(cb, 2.8), cub([40, 62], [32, 56], [22, 54], [12, 48]) + cub([40, 62], [48, 56], [58, 54], [68, 46]) + cub([40, 60], [36, 50], [30, 40], [26, 32]) + cub([40, 60], [44, 50], [50, 40], [54, 30]));
	k.add(F(g[0]), E(14, 44, 10, 7) + E(66, 42, 10, 7) + E(28, 30, 12, 8) + E(54, 28, 12, 8) + E(40, 40, 12, 6));
	for (const [x, y] of [[12, 44], [22, 42], [66, 42], [58, 40], [28, 28], [20, 30], [54, 26], [62, 30], [40, 22], [40, 38]] as const) tuft(k, x, y, 6, 10);
	for (const [x, y, red] of [[16, 48, true], [29, 44, false], [52, 42, true], [64, 48, false], [40, 32, true], [24, 34, false]] as const) fruit(st, fr, x, y, red);
	return `${k}${st}${fr}`;
}

function kumquat(stage: GrowingStage): string {
	const kb = "#6e5444";
	const g = ["#2c5b2e", "#3d7238", "#4f8a45"] as const;
	const kum = (fr: Ink, x: number, y: number) => fr.add(F("#f5891c"), E(x, y, 1.5, 2)).add(R("#fff", 0.45, 0.45), D(x - 0.5, y - 0.7));
	if (stage === "sprout") return sap(13, (x, y) => trio(x, y, 6, 2.6, g[1], g[2], 0), kb, 1.4);
	const k = new Ink();
	const fr = new Ink();
	const bush = (blobs: readonly (readonly [number, number, number])[], n: number) => {
		for (const [x, y, r] of blobs) k.add(R(g[0], r), D(x, y));
		for (const [x, y, r] of blobs) crown(k, x, y, r, r, n, 4.2, 1.6, null, [g[1], g[2]], 0);
	};
	if (stage === "leafy") {
		k.add(K(kb, 1.6), seg(38, 87, 36, 74) + seg(42, 87, 44, 74));
		bush([[34, 70, 7], [46, 70, 7], [40, 62, 8]], 10);
		for (const [x, y] of [[34, 68], [46, 66]] as const) kum(fr, x, y);
		return `${k}${fr}`;
	}
	k.add(K(kb, 2), seg(38, 87, 34, 74) + seg(42, 87, 46, 74) + seg(40, 87, 40, 70));
	bush([[22, 70, 10], [58, 70, 10], [30, 56, 12], [50, 56, 12], [40, 44, 13], [40, 66, 12]], 10);
	for (const [x, y] of [[18, 70], [24, 74], [27, 64], [34, 72], [46, 74], [55, 66], [62, 72], [24, 54], [32, 50], [36, 60], [44, 62], [50, 52], [56, 58], [40, 38], [34, 42], [46, 44], [40, 52], [30, 36], [50, 38], [41, 72], [18, 62]] as const) kum(fr, x, y);
	blossom(fr, 60, 62, 2.6, "#fbf8ee", "#f2c94a");
	blossom(fr, 28, 44, 2.6, "#fbf8ee", "#f2c94a", 30);
	return `${k}${fr}`;
}

function grapefruit(stage: GrowingStage): string {
	const g = ["#2a5f2e", "#3a7a3a", "#4f9146"] as const;
	const gf = (fr: Ink, x: number, y: number, r = 4.2) => fr.add(R("#f2d65e", r), D(x, y)).add(F("#f0a07c", 0.7), E(x + r * 0.35, y + r * 0.3, r * 0.55, r * 0.5)).add(R("#fff", r * 0.25, 0.45), D(x - r * 0.4, y - r * 0.4));
	const trio3 = (fr: Ink, x: number, y: number) => {
		gf(fr, x - 3.6, y);
		gf(fr, x + 3.6, y + 0.6);
		gf(fr, x, y + 5.4);
	};
	if (stage === "sprout") return sap(17, (x, y) => trio(x, y, 9, 4.2, g[1], g[2], 0), BARK, 1.8);
	const k = new Ink();
	const fr = new Ink();
	if (stage === "leafy") {
		k.add(F(BARK), trunkD(40, 40, 58, 4.4, 3));
		crown(k, 40, 47, 14, 14, 22, 6.5, 2.8, g[0], [g[1], g[2]], 0);
		gf(fr, 44, 58, 3.4);
		blossom(fr, 34, 42, 3, "#fbf8ee", "#f2c94a");
		return `${k}${fr}`;
	}
	k.add(F(BARK), trunkD(40, 40, 58, 8, 5));
	k.add(F(g[0]), "M8 50Q8 10 40 8Q72 10 72 50Q72 62 60 62Q40 66 20 62Q8 62 8 50Z");
	crown(k, 40, 36, 30, 25, 66, 7.5, 3, null, [g[1], g[2]], 0);
	trio3(fr, 18, 52);
	trio3(fr, 40, 54);
	trio3(fr, 62, 50);
	trio3(fr, 28, 30);
	trio3(fr, 52, 28);
	blossom(fr, 40, 16, 3, "#fbf8ee", "#f2c94a");
	return `${k}${fr}`;
}

function limeTree(stage: GrowingStage): string {
	const lb = "#6e5a44";
	const g = ["#2f6230", "#3f7a3a", "#559248"] as const;
	const lime = (fr: Ink, x: number, y: number) => fr.add(F("#a6d23e"), E(x, y, 2.4, 2.2)).add(R("#a6d23e", 0.6), D(x + 2.3, y)).add(R("#fff", 0.6, 0.45), D(x - 0.8, y - 0.8));
	if (stage === "sprout") return sap(15, (x, y) => trio(x, y, 7.5, 3, g[1], g[2], 1), lb, 1.4);
	const k = new Ink();
	const th = new Ink();
	const fr = new Ink();
	const thorns = (pts: readonly (readonly [number, number, number])[]) => pts.forEach(([x, y, a]) => th.add(K(lb, 0.7), seg(x, y, x + Math.cos((a * Math.PI) / 180) * 2.4, y + Math.sin((a * Math.PI) / 180) * 2.4)));
	if (stage === "leafy") {
		k.add(K(lb, 2.2), cub([40, 87], [40, 76], [36, 68], [34, 58])).add(K(lb, 1.4), seg(37, 70, 48, 58));
		crown(k, 34, 54, 8, 6, 10, 5, 2, g[0], [g[1], g[2]]);
		crown(k, 48, 56, 7, 5, 8, 5, 2, g[0], [g[2], g[1]]);
		thorns([[38, 74, -150], [42, 64, -60]]);
		lime(fr, 46, 61);
		return `${k}${th}${fr}`;
	}
	k.add(K(lb, 4), cub([40, 88], [40, 76], [34, 70], [36, 60]));
	k.add(K(lb, 2), cub([36, 62], [28, 56], [20, 52], [14, 44]) + cub([36, 62], [44, 54], [54, 50], [64, 40]) + cub([36, 60], [36, 48], [32, 36], [34, 22]) + cub([38, 58], [44, 48], [50, 36], [48, 24]));
	thorns([[22, 53, 100], [28, 57, -100], [48, 52, 80], [56, 48, -110], [34, 46, 180], [33, 34, 0], [46, 40, -10], [49, 30, 170]]);
	crown(k, 14, 42, 9, 7, 12, 5, 2, g[0], [g[1], g[2]]);
	crown(k, 63, 38, 10, 8, 13, 5, 2, g[0], [g[2], g[1]]);
	crown(k, 34, 20, 11, 9, 15, 5, 2, g[0], [g[1], g[2]]);
	crown(k, 50, 24, 10, 8, 13, 5, 2, g[0], [g[2], g[1]]);
	crown(k, 24, 34, 6, 5, 7, 5, 2, g[0], [g[1], g[2]]);
	for (const [x, y] of [[12, 48], [20, 44], [58, 44], [68, 42], [30, 26], [40, 26], [46, 30], [55, 28], [24, 38], [64, 32]] as const) lime(fr, x, y);
	for (const [x, y] of [[16, 36], [34, 13], [60, 32], [46, 18]] as const) blossom(fr, x, y, 3, "#fbfaf2", "#e8d54a");
	return `${k}${th}${fr}`;
}

export const SPECIES: Species[] = [
	{ id: "pear-tree", name: "Pear tree", draw: fit(pearTree, 0.97) },
	{ id: "quince", name: "Quince", draw: fit(quince, 0.93) },
	{ id: "apricot-tree", name: "Apricot tree", draw: fit(apricotTree, 0.93) },
	{ id: "sweet-cherry-tree", name: "Sweet cherry tree", draw: sweetCherryTree },
	{ id: "mango-tree", name: "Mango tree", draw: fit(mangoTree, 0.98) },
	{ id: "avocado-tree", name: "Avocado tree", draw: fit(avocadoTree, 0.97) },
	{ id: "papaya", name: "Papaya", draw: fit(papaya, 0.97) },
	{ id: "persimmon", name: "Persimmon", draw: fit(persimmon, 0.97) },
	{ id: "loquat", name: "Loquat", draw: loquat },
	{ id: "lychee", name: "Lychee", draw: fit(lychee, 0.97) },
	{ id: "guava", name: "Guava", draw: fit(guava, 0.94) },
	{ id: "jackfruit", name: "Jackfruit", draw: fit(jackfruit, 0.95) },
	{ id: "breadfruit", name: "Breadfruit", draw: breadfruit },
	{ id: "mulberry", name: "Mulberry", draw: mulberry },
	{ id: "walnut", name: "Walnut", draw: walnut },
	{ id: "almond", name: "Almond", draw: almond },
	{ id: "hazelnut", name: "Hazelnut", draw: hazelnut },
	{ id: "sweet-chestnut", name: "Sweet chestnut", draw: fit(sweetChestnut, 0.94) },
	{ id: "pecan", name: "Pecan", draw: pecan },
	{ id: "pistachio", name: "Pistachio", draw: pistachio },
	{ id: "macadamia", name: "Macadamia", draw: macadamia },
	{ id: "cashew", name: "Cashew", draw: fit(cashew, 0.98) },
	{ id: "kumquat", name: "Kumquat", draw: kumquat },
	{ id: "grapefruit", name: "Grapefruit", draw: grapefruit },
	{ id: "lime-tree", name: "Lime tree", draw: fit(limeTree, 0.97) },
];
