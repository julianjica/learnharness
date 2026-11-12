/**
 * Tropical and houseplants: 25 species in the garden's flat style (see kit.ts).
 */
import { BARK, CUT, GREEN, type GrowingStage, type Pt, type Species, bez, blade, circle, f, leaf, leafPath, line, petals } from "./kit";

type St = GrowingStage;

const pick = <T>(st: St, s: T, l: T, b: T): T => (st === "sprout" ? s : st === "leafy" ? l : b);
const g = (x: number, y: number, deg: number, inner: string): string => `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(deg)})">${inner}</g>`;
const fill = (d: string, c: string, op?: number): string => `<path d="${d}" fill="${c}"${op === undefined ? "" : ` opacity="${op}"`}/>`;
const strk = (d: string, c: string, w: number, op?: number): string =>
	`<path d="${d}" stroke="${c}" stroke-width="${f(w)}" fill="none" stroke-linecap="round"${op === undefined ? "" : ` opacity="${op}"`}/>`;
const ell = (cx: number, cy: number, rx: number, ry: number, c: string, rot = 0): string =>
	`<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}" fill="${c}"${rot ? ` transform="rotate(${f(rot)} ${f(cx)} ${f(cy)})"` : ""}/>`;
const curve = (p: readonly [Pt, Pt, Pt, Pt]): string =>
	`M${f(p[0][0])} ${f(p[0][1])}C${f(p[1][0])} ${f(p[1][1])} ${f(p[2][0])} ${f(p[2][1])} ${f(p[3][0])} ${f(p[3][1])}`;
const quad = (x0: number, y0: number, cx: number, cy: number, x1: number, y1: number): string => `M${f(x0)} ${f(y0)}Q${f(cx)} ${f(cy)} ${f(x1)} ${f(y1)}`;
const rad = Math.PI / 180;
/** Leaf outline (kit shapes) in absolute coordinates, so many leaves of one colour share a path. */
const absLeaf = (x: number, y: number, deg: number, L: number, w: number, shape: 0 | 1 | 2 | 3 | 4 = 0): string => {
	const c = Math.cos(deg * rad);
	const sn = Math.sin(deg * rad);
	return leafPath(L, w, shape).replace(/(-?[\d.]+) (-?[\d.]+)/g, (_m, a: string, b: string) => `${f(x + +a * c - +b * sn)} ${f(y + +a * sn + +b * c)}`);
};
/** Collects leaves by colour and emits one path per colour, in first-use order. */
class Bag {
	private m = new Map<string, string>();
	add(c: string, x: number, y: number, deg: number, L: number, w: number, shape: 0 | 1 | 2 | 3 | 4 = 0): this {
		this.m.set(c, (this.m.get(c) ?? "") + absLeaf(x, y, deg, L, w, shape));
		return this;
	}
	out(): string {
		let s = "";
		for (const [c, d] of this.m) s += fill(d, c);
		return s;
	}
}
/** Tangent angle (degrees) of a cubic at t. */
const tangent = (p: readonly [Pt, Pt, Pt, Pt], t: number): number => {
	const a = bez(p, Math.max(0, t - 0.01));
	const b = bez(p, Math.min(1, t + 0.01));
	return Math.atan2(b[1] - a[1], b[0] - a[0]) / rad;
};

/** Heart / arrowhead outline pointing along +x, petiole at the sinus (origin); w is the half-width. */
const heartD = (L: number, w: number): string =>
	`M0 0C${f(-L * 0.22)} ${f(-w * 0.55)} ${f(-L * 0.12)} ${f(-w * 1.1)} ${f(L * 0.25)} ${f(-w)}C${f(L * 0.6)} ${f(-w * 0.9)} ${f(L * 0.85)} ${f(-w * 0.4)} ${f(L)} 0C${f(L * 0.85)} ${f(w * 0.4)} ${f(L * 0.6)} ${f(w * 0.9)} ${f(L * 0.25)} ${f(w)}C${f(-L * 0.12)} ${f(w * 1.1)} ${f(-L * 0.22)} ${f(w * 0.55)} 0 0Z`;
function heart(x: number, y: number, deg: number, L: number, w: number, c: string, rib?: string, extra = ""): string {
	return g(x, y, deg, fill(heartD(L, w), c) + extra + (rib ? strk(`M0 0L${f(L * 0.85)} 0`, rib, 0.8, 0.7) : ""));
}

/** Palm frond: a curving rachis with narrow leaflets that droop by `droop` (0 stiff … 1 hanging). */
function palmFrond(x: number, y: number, deg: number, len: number, bend: number, leaflet: number, ca: string, cb: string, rib: string, droop = 0.4): string {
	const n = 10;
	const step = len / n;
	let a = deg * rad;
	let px = x;
	let py = y;
	let d = `M${f(x)} ${f(y)}`;
	const ls = ["", ""];
	for (let j = 1; j <= n; j++) {
		a += (bend * rad) / n;
		px += Math.cos(a) * step;
		py += Math.sin(a) * step;
		d += `L${f(px)} ${f(py)}`;
		if (j < n) {
			const l = leaflet * (1 - j / (n + 3)) + 1.5;
			for (const side of [0, 1]) {
				const b = a + (side ? 55 : -55) * rad;
				const vx = Math.cos(b) * (1 - droop);
				const vy = Math.sin(b) * (1 - droop) + droop;
				const m = Math.hypot(vx, vy);
				ls[side] += `M${f(px)} ${f(py)}l${f((vx / m) * l)} ${f((vy / m) * l)}`;
			}
		}
	}
	return strk(ls[0] ?? "", ca, 1.3) + strk(ls[1] ?? "", cb, 1.3) + strk(d, rib, 1.2);
}

/* 1. Monstera */
function mleaf(x: number, y: number, deg: number, L: number, split: boolean, c: string): string {
	const d = `M0 0C${f(-L * 0.72)} ${f(-L * 0.05)} ${f(-L * 0.7)} ${f(-L * 0.85)} 0 ${f(-L)}C${f(L * 0.7)} ${f(-L * 0.85)} ${f(L * 0.72)} ${f(-L * 0.05)} 0 0Z`;
	let cut = "";
	if (split) {
		for (const k of [0.25, 0.47, 0.69]) {
			cut += strk(`M${f(-L * 0.2)} ${f(-L * k)}L${f(-L * 0.66)} ${f(-L * k + L * 0.08)}M${f(L * 0.2)} ${f(-L * k)}L${f(L * 0.66)} ${f(-L * k + L * 0.08)}`, CUT, L * 0.06);
		}
		for (const k of [0.36, 0.58]) cut += ell(-L * 0.13, -L * k, L * 0.035, L * 0.05, CUT) + ell(L * 0.13, -L * k, L * 0.035, L * 0.05, CUT);
	}
	return g(x, y, deg, fill(d, c) + strk(`M0 0L0 ${f(-L * 0.92)}`, "#2c6a40", 1, 0.7) + cut);
}
function monstera(st: St): string {
	if (st === "sprout") return line(40, 87, 40, 77, GREEN.dark, 1.6) + mleaf(40, 78, 4, 13, false, GREEN.leaf);
	if (st === "leafy")
		return line(40, 87, 30, 64, GREEN.dark, 1.6) + line(40, 87, 51, 60, GREEN.dark, 1.6) + line(40, 87, 40, 54, GREEN.dark, 1.6) + mleaf(30, 65, -38, 19, false, GREEN.leaf) + mleaf(51, 61, 34, 19, false, GREEN.leaf) + mleaf(40, 55, 0, 20, true, "#4f9a5e");
	const c = "#3f8f5a";
	return (
		line(40, 87, 27, 62, GREEN.dark, 1.8) + line(40, 87, 54, 60, GREEN.dark, 1.8) + line(40, 87, 38, 46, GREEN.dark, 1.8) + line(40, 87, 50, 76, GREEN.dark, 1.4) +
		mleaf(27, 63, -48, 22, true, c) + mleaf(54, 61, 44, 22, true, c) + mleaf(38, 47, -6, 27, true, c) + mleaf(50, 77, 66, 12, false, GREEN.light)
	);
}

/* 2. Fiddle-leaf fig */
function figLeaf(x: number, y: number, deg: number, L: number, w: number, c = "#4a8a3e"): string {
	const d = `M0 0C${f(L * 0.3)} ${f(-w * 0.45)} ${f(L * 0.5)} ${f(-w * 1.1)} ${f(L * 0.82)} ${f(-w)}C${f(L * 1.04)} ${f(-w * 0.85)} ${f(L * 1.04)} ${f(w * 0.75)} ${f(L * 0.82)} ${f(w)}C${f(L * 0.5)} ${f(w * 1.1)} ${f(L * 0.3)} ${f(w * 0.45)} 0 0Z`;
	const v = "#b9d68f";
	let veins = strk(`M1 0L${f(L * 0.9)} 0`, v, 0.8, 0.75);
	for (const t of [0.4, 0.62]) veins += strk(`M${f(L * t)} 0L${f(L * (t + 0.14))} ${f(-w * 0.7)}M${f(L * t)} 0L${f(L * (t + 0.14))} ${f(w * 0.7)}`, v, 0.5, 0.6);
	return g(x, y, deg, fill(d, c) + veins);
}
function fiddleFig(st: St): string {
	if (st === "sprout") return line(40, 87, 40, 72, "#6d6a3e", 1.8) + figLeaf(40, 74, -140, 10, 4) + figLeaf(40, 72, -65, 12, 4.8);
	if (st === "leafy") {
		return (
			line(40, 87, 40, 45, BARK, 2.4) + figLeaf(40, 74, -165, 14, 5.5) + figLeaf(40, 67, -18, 15, 6) + figLeaf(40, 60, -150, 15, 6, "#56964a") +
			figLeaf(40, 53, -32, 15, 6) + figLeaf(40, 47, -118, 14, 5.5, "#56964a") + figLeaf(40, 46, -70, 14, 5.5)
		);
	}
	const A = "#4a8a3e";
	const B = "#5a9c4c";
	return (
		line(40, 87, 41, 40, BARK, 3.6) + line(41, 54, 33, 45, BARK, 2) + line(41, 50, 49, 42, BARK, 2) +
		figLeaf(33, 46, -165, 16, 6.5, A) + figLeaf(49, 43, -15, 16, 6.5, A) + figLeaf(33, 44, -128, 17, 6.8, B) + figLeaf(49, 41, -52, 17, 6.8, B) +
		figLeaf(41, 40, -150, 16, 6.5, A) + figLeaf(41, 39, -30, 16, 6.5, A) + figLeaf(41, 38, -108, 18, 7, B) + figLeaf(41, 38, -76, 17, 6.5, A) +
		figLeaf(41, 60, -175, 12, 5, B) + figLeaf(41, 64, -8, 11, 4.6, B)
	);
}

/* 3. Banana plant */
function bananaLeaf(x: number, y: number, deg: number, L: number, w: number, c = "#7cbf5a"): string {
	let tears = "";
	for (const t of [0.42, 0.66]) tears += strk(`M${f(L * t)} ${f(-w * 1.1)}L${f(L * (t + 0.04))} ${f(-w * 0.25)}`, CUT, 0.8);
	tears += strk(`M${f(L * 0.55)} ${f(w * 1.1)}L${f(L * 0.59)} ${f(w * 0.3)}`, CUT, 0.8);
	return g(x, y, deg, fill(leafPath(L, w, 0), c) + strk(`M0 0L${f(L * 0.95)} 0`, "#d6e69a", 1, 0.85) + tears);
}
function banana(st: St): string {
	const trunk = (top: number, w: number) => line(40, 87, 40, top, "#98b35a", w) + line(40 - w * 0.2, 86, 40 - w * 0.2, top + 4, "#8aa64e", 0.7);
	if (st === "sprout") return trunk(77, 4) + bananaLeaf(40, 78, -140, 11, 3.4) + leaf(40, 77, -84, 11, 2, { fill: "#93cc6c", shape: 1, rib: false });
	if (st === "leafy") return trunk(58, 5.5) + bananaLeaf(40, 62, -165, 20, 5.5) + bananaLeaf(40, 59, -20, 22, 5.8) + bananaLeaf(40, 58, -130, 20, 5.5, "#8cca68") + leaf(40, 58, -88, 16, 2.6, { fill: "#93cc6c", shape: 1, rib: false });
	let s = trunk(44, 7) + bananaLeaf(40, 48, 172, 27, 6.8) + bananaLeaf(40, 47, 6, 27, 6.8) + bananaLeaf(40, 44, -140, 28, 6.8, "#8cca68") + bananaLeaf(40, 44, -48, 28, 6.8, "#8cca68") + leaf(40, 44, -95, 20, 3, { fill: "#93cc6c", shape: 1, rib: false });
	s += strk("M41 48Q52 50 55 70", "#6d7a3e", 1.4);
	for (const [hx, hy] of [[47, 52.5], [50.5, 57], [53, 61.5], [54.5, 66]] as const) {
		for (const dx of [-2.6, 0, 2.6]) s += strk(`M${f(hx + dx)} ${f(hy + 2.5)}Q${f(hx + dx - 1.5)} ${f(hy - 1)} ${f(hx + dx + 0.6)} ${f(hy - 4)}`, "#f0cd45", 2.1);
	}
	return s + fill("M55 68C52 70 52.5 75.5 55.5 77C58.5 75.5 58.5 70 55 68Z", "#7a2e4c");
}

/* 4. Coconut palm */
const COCO = { a: "#5fa64e", b: "#7aba5f", rib: "#3f7a35" };
function coconut(st: St): string {
	if (st === "sprout") return ell(40, 83, 6, 4.6, "#8a6440") + ell(38, 81.6, 2, 1.2, "#a88160") + leaf(41, 80, -100, 16, 2.6, { fill: COCO.a, shape: 1 }) + leaf(42, 80, -66, 13, 2.3, { fill: COCO.b, shape: 1 });
	if (st === "leafy") {
		let s = strk("M39 87C39 78 40 70 42 58", "#a5825a", 3.6);
		for (const [d, b, L] of [[-170, -40, 18], [-135, -45, 20], [-100, -25, 17], [-75, 30, 17], [-42, 45, 20], [-8, 40, 18]] as const) s += palmFrond(42, 58, d, L, b, 7, COCO.a, COCO.b, COCO.rib);
		return s;
	}
	const P: [Pt, Pt, Pt, Pt] = [[35, 87], [36, 64], [40, 42], [47, 28]];
	let s = strk(curve(P), "#a5825a", 3.6);
	for (let i = 1; i < 10; i++) {
		const [x, y] = bez(P, i / 10);
		s += line(x - 1.6, y, x + 1.6, y + 0.4, "#7d5f3e", 0.7);
	}
	for (const [d, b, L] of [[-178, -45, 24], [-140, -55, 26], [-104, -40, 22], [-72, 40, 22], [-38, 55, 26], [-2, 45, 23]] as const) s += palmFrond(47, 28, d, L, b, 8, COCO.a, COCO.b, COCO.rib);
	for (const [x, y] of [[44, 32], [49.5, 32.5], [46.5, 35.5]] as const) s += circle(x, y, 2.6, "#7a5532") + circle(x - 0.8, y - 0.8, 0.8, "#a07a52");
	return s;
}

/* 5. Date palm */
const DATE = { a: "#6f9a63", b: "#86ad74", rib: "#557a4a" };
function dateTrunk(top: number, w: number): string {
	let d = "";
	for (let y = 85, i = 0; y > top + 2; y -= 3.4, i++) {
		const o = i % 2 ? 0.8 : -0.8;
		d += `M${f(40 - w / 2 + 0.6 + o)} ${f(y)}L${f(40 + o)} ${f(y - 1.8)}L${f(40 + w / 2 - 0.6 + o)} ${f(y)}`;
	}
	return line(40, 87, 40, top, "#a3804f", w) + strk(d, "#7a5b38", 0.6);
}
function datePalm(st: St): string {
	if (st === "sprout") return blade(39, 35, 66, DATE.a, 1.3) + blade(41, 45, 69, DATE.b, 1.2);
	if (st === "leafy") {
		let s = dateTrunk(68, 6);
		for (const [d, b, L] of [[-165, -35, 18], [-125, -30, 19], [-92, -8, 17], [-55, 30, 19], [-15, 35, 18]] as const) s += palmFrond(40, 67, d, L, b, 5, DATE.a, DATE.b, DATE.rib, 0.1);
		return s;
	}
	let s = dateTrunk(34, 5.5);
	for (const [d, b, L] of [[-168, -40, 25], [-132, -38, 25], [-100, -16, 22], [-80, 16, 22], [-48, 38, 25], [-12, 40, 25]] as const) s += palmFrond(40, 33, d, L, b, 6, DATE.a, DATE.b, DATE.rib, 0.1);
	for (const side of [-1, 1]) {
		s += strk(quad(40 + side * 2, 36, 40 + side * 6, 38, 40 + side * 9, 50), "#c79a4a", 0.8);
		for (let k = 0; k < 8; k++) {
			const t = 0.3 + (k / 8) * 0.7;
			const x = 40 + side * (2 + 7 * t) + (k % 2 ? 1.3 : -1.3) * side;
			const y = 37 + t * 13;
			s += ell(x, y, 1.2, 1.7, k % 3 ? "#d0782a" : "#b85f22");
		}
	}
	return s;
}

/* 6. Bird of paradise */
const BOP = { a: "#5f9a82", b: "#74ac93", rib: "#3e6e5a", stalk: "#56876e" };
function bopLeaf(tx: number, ty: number, deg: number, L: number, w: number, c: string): string {
	return strk(quad(40, 86, 40 + (tx - 40) * 0.3, ty + (86 - ty) * 0.4, tx, ty), BOP.stalk, 1.3) + leaf(tx, ty, deg, L, w, { fill: c, dark: BOP.rib });
}
function crane(x: number, y: number): string {
	return g(
		x,
		y,
		0,
		fill("M-3 1C4 4.5 16 3 22 -2C14 -1.5 5 -2.5 -3 1Z", "#5a7f8c") +
			fill("M-3 1C4 4.5 16 3 22 -2C14 1 5 2.5 -3 1Z", "#9b4a63") +
			leaf(6, -1.5, -128, 12, 1.9, { fill: "#f08a2a", shape: 1, rib: false }) +
			leaf(7, -1.5, -108, 13, 2, { fill: "#f6a53a", shape: 1, rib: false }) +
			leaf(8, -1.5, -88, 11, 1.8, { fill: "#f08a2a", shape: 1, rib: false }) +
			leaf(8, -1.5, -38, 10, 1.5, { fill: "#4166c9", shape: 1, rib: false }),
	);
}
function birdOfParadise(st: St): string {
	if (st === "sprout") return line(40, 87, 40, 78, BOP.stalk, 1.4) + leaf(40, 79, -96, 12, 3.6, { fill: BOP.a, dark: BOP.rib }) + leaf(40, 84, -145, 9, 3, { fill: BOP.b, dark: BOP.rib });
	if (st === "leafy") return bopLeaf(28, 62, -128, 17, 4.8, BOP.a) + bopLeaf(52, 60, -52, 17, 4.8, BOP.a) + bopLeaf(37, 52, -100, 18, 5, BOP.b) + bopLeaf(47, 66, -30, 13, 4, BOP.b);
	return (
		bopLeaf(22, 54, -132, 20, 5.5, BOP.a) + bopLeaf(58, 50, -50, 20, 5.5, BOP.a) + bopLeaf(33, 42, -104, 21, 5.6, BOP.b) + bopLeaf(52, 64, -24, 16, 4.6, BOP.b) + bopLeaf(26, 70, -160, 14, 4.2, BOP.b) +
		strk("M41 86Q40 52 31 38", BOP.stalk, 1.6) + crane(31, 38)
	);
}

/* 7. Pothos */
function pothosLeaf(x: number, y: number, deg: number, L: number, w: number, c = "#5aa64a"): string {
	const streak = strk(`M${f(L * 0.15)} ${f(-w * 0.2)}Q${f(L * 0.45)} ${f(-w * 0.75)} ${f(L * 0.72)} ${f(-w * 0.2)}M${f(L * 0.3)} ${f(w * 0.35)}L${f(L * 0.6)} ${f(w * 0.25)}`, "#e6d877", w * 0.2);
	return heart(x, y, deg, L, w, c, undefined, streak);
}
function pothosVine(P: [Pt, Pt, Pt, Pt], ts: number[], L: number): string {
	let s = strk(curve(P), "#5a8f3e", 1.1);
	ts.forEach((t, i) => {
		const [x, y] = bez(P, t);
		s += pothosLeaf(x, y, tangent(P, t) + (i % 2 ? 60 : -60), L, L * 0.5, i % 2 ? "#5aa64a" : "#6db556");
	});
	return s;
}
function pothos(st: St): string {
	if (st === "sprout") return strk("M40 87Q39 80 37 75", "#5a8f3e", 1.2) + strk("M40 87Q42 82 44 78", "#5a8f3e", 1.2) + pothosLeaf(37, 75, -112, 11, 5.5) + pothosLeaf(44, 78, -50, 9, 4.5, "#6db556");
	const center = (s: number) =>
		([[30, 66, -130], [50, 64, -50], [36, 56, -105], [45, 54, -75], [40, 48, -90]] as [number, number, number][])
			.map(([x, y, d], i) => strk(quad(40, 86, 40, y + 8, 40 + (x - 40) * s, 86 - (86 - y) * s), "#5a8f3e", 1.1) + pothosLeaf(40 + (x - 40) * s, 86 - (86 - y) * s, d, 11 * s, 5.5 * s, i % 2 ? "#5aa64a" : "#6db556"))
			.join("");
	if (st === "leafy") return pothosVine([[38, 82], [28, 64], [18, 62], [14, 78]], [0.35, 0.55, 0.75, 0.95], 8) + pothosVine([[42, 82], [52, 66], [62, 64], [66, 76]], [0.4, 0.6, 0.8, 1], 8) + center(1);
	return (
		pothosVine([[38, 80], [26, 50], [11, 52], [10, 84]], [0.25, 0.38, 0.5, 0.62, 0.74, 0.86, 0.98], 9) +
		pothosVine([[42, 80], [56, 52], [69, 56], [70, 84]], [0.3, 0.42, 0.54, 0.66, 0.78, 0.9, 1], 9) +
		center(1.3)
	);
}

/* 8. Philodendron */
const PHIL = { a: "#3d7d45", b: "#4d8f50", red: "#9b3a48", new: "#cf5048", pet: "#8a4a3a" };
function philLeaf(tx: number, ty: number, deg: number, L: number, c: string): string {
	return strk(quad(40, 86, 40 + (tx - 40) * 0.2, ty + (86 - ty) * 0.45, tx, ty), PHIL.pet, 1.2) + heart(tx, ty, deg, L, L * 0.48, c, "#24502c");
}
function philodendron(st: St): string {
	if (st === "sprout") return philLeaf(39, 73, -100, 11, PHIL.a) + leaf(42, 84, -70, 8, 1.6, { fill: PHIL.new, shape: 1, rib: false });
	if (st === "leafy") return philLeaf(28, 62, -132, 15, PHIL.a) + philLeaf(52, 60, -48, 15, PHIL.b) + philLeaf(38, 52, -95, 16, PHIL.red) + strk("M41 86L45 66", PHIL.pet, 1.2) + leaf(45, 67, -78, 11, 2, { fill: PHIL.new, shape: 1, rib: false });
	return (
		philLeaf(22, 60, -150, 17, PHIL.a) + philLeaf(58, 58, -32, 17, PHIL.b) + philLeaf(30, 44, -118, 19, PHIL.b) + philLeaf(50, 42, -62, 19, PHIL.a) + philLeaf(40, 32, -90, 17, PHIL.red) +
		strk("M41 86L47 56", PHIL.pet, 1.3) + leaf(47, 57, -75, 14, 2.6, { fill: PHIL.new, shape: 1, rib: false })
	);
}

/* 9. Snake plant */
function sword(x: number, h: number, w: number, lean: number, c = "#4f7f4a"): string {
	const d = (e: number) =>
		`M${f(x - w - e)} 87C${f(x - w - e)} ${f(87 - h * 0.6)} ${f(x + lean - w * 0.3)} ${f(87 - h * 0.85)} ${f(x + lean)} ${f(87 - h - e * 1.5)}C${f(x + lean + w * 0.3)} ${f(87 - h * 0.85)} ${f(x + w + e)} ${f(87 - h * 0.6)} ${f(x + w + e)} 87Z`;
	let bands = "";
	for (let t = 0.12; t < 0.78; t += 0.13) {
		const cx = x + lean * t * t;
		const hw = w * (1 - t * 0.75) * 0.75;
		const y = 87 - h * t;
		bands += `M${f(cx - hw)} ${f(y)}Q${f(cx)} ${f(y - 1.6)} ${f(cx + hw)} ${f(y)}`;
	}
	return fill(d(0.9), "#d6cd62") + fill(d(0), c) + strk(bands, "#8ab478", 0.8, 0.8);
}
function snakePlant(st: St): string {
	if (st === "sprout") return sword(38, 15, 2.6, -2) + sword(42, 20, 2.8, 1, "#45743f");
	if (st === "leafy") return sword(39, 46, 3.6, -1) + sword(33, 34, 3.4, -6, "#45743f") + sword(45, 40, 3.4, 3, "#45743f") + sword(50, 28, 3, 7);
	return sword(40, 72, 4.2, 0) + sword(34, 60, 4, -5, "#45743f") + sword(46, 56, 4, 5, "#45743f") + sword(28, 44, 3.6, -9) + sword(52, 46, 3.6, 9) + sword(38, 34, 3.2, -2, "#45743f") + sword(44, 30, 3, 3);
}

/* 10. ZZ plant */
function zzStem(P: [Pt, Pt, Pt, Pt], size: number, ts: number[]): string {
	const bag = new Bag();
	ts.forEach((t, i) => {
		const [x, y] = bez(P, t);
		const a = tangent(P, t);
		const sz = size * (0.8 + t * 0.25);
		bag.add(i % 2 ? "#3e8040" : "#4c9147", x, y, a - 48, sz, sz * 0.45).add(i % 2 ? "#4c9147" : "#3e8040", x, y, a + 48, sz, sz * 0.45);
	});
	const [ex, ey] = bez(P, 1);
	bag.add("#4c9147", ex, ey, tangent(P, 1), size, size * 0.45);
	return strk(curve(P), "#5b8f45", 1.8) + bag.out();
}
const zzP = (x0: number, tx: number, ty: number): [Pt, Pt, Pt, Pt] => [[x0, 87], [x0, 87 - (87 - ty) * 0.4], [tx - (tx - x0) * 0.4, ty + (87 - ty) * 0.25], [tx, ty]];
function zzPlant(st: St): string {
	if (st === "sprout") return zzStem(zzP(40, 42, 68), 6, [0.55, 0.8]);
	if (st === "leafy") return zzStem(zzP(39, 28, 50), 7.5, [0.4, 0.58, 0.76, 0.92]) + zzStem(zzP(41, 56, 60), 7, [0.45, 0.65, 0.85]) + zzStem(zzP(40, 45, 42), 7.5, [0.4, 0.57, 0.74, 0.9]);
	const ts = [0.35, 0.5, 0.65, 0.8, 0.93];
	return zzStem(zzP(38, 16, 52), 8, ts) + zzStem(zzP(42, 64, 50), 8, ts) + zzStem(zzP(39, 28, 30), 8.5, ts) + zzStem(zzP(41, 52, 26), 8.5, ts) + zzStem(zzP(40, 40, 18), 8, [0.45, 0.6, 0.75, 0.9]);
}

/* 11. Peace lily */
const PL = { a: "#3d7a40", b: "#4a8a48", pet: "#4f8a45" };
function plLeaf(tx: number, ty: number, deg: number, L: number, w: number, c: string): string {
	return strk(quad(40, 86, 40 + (tx - 40) * 0.25, ty + (86 - ty) * 0.4, tx, ty), PL.pet, 1.1) + leaf(tx, ty, deg, L, w, { fill: c, shape: 1, dark: "#24502c" });
}
function spathe(x: number, y: number, s: number, lean = 0): string {
	return (
		strk(quad(40, 86, 40 + (x - 40) * 0.3, y + 20, x, y), "#6aa25a", 1.1) +
		leaf(x, y + 1, -90 + lean, 14 * s, 4.8 * s, { fill: "#f4f2e6", dark: "#bdbba4", shape: 1 }) +
		ell(x + 0.4, y - 3.6 * s, 1.3 * s, 3.4 * s, "#e6d27a", lean)
	);
}
function peaceLily(st: St): string {
	if (st === "sprout") return plLeaf(36, 76, -125, 11, 3.2, PL.a) + plLeaf(44, 75, -60, 11, 3.2, PL.b) + plLeaf(40, 74, -92, 9, 2.8, PL.a);
	const leaves = (list: [number, number, number, number, string][]) => list.map(([x, y, d, L, c]) => plLeaf(x, y, d, L, L * 0.3, c)).join("");
	if (st === "leafy") return leaves([[24, 66, -150, 15, PL.a], [56, 64, -30, 15, PL.a], [30, 58, -122, 15, PL.b], [50, 56, -58, 15, PL.b], [40, 54, -90, 14, PL.a]]);
	return (
		leaves([[20, 64, -158, 18, PL.a], [60, 62, -24, 18, PL.a], [26, 54, -128, 18, PL.b], [54, 52, -52, 18, PL.b], [35, 56, -102, 16, PL.a], [46, 58, -78, 16, PL.a], [16, 78, -175, 13, PL.b], [64, 78, -5, 13, PL.b]]) +
		spathe(29, 36, 1.2, -8) + spathe(48, 28, 1.25, 6) + spathe(59, 44, 1, 16)
	);
}

/* 12. Calathea */
function calLeaf(tx: number, ty: number, deg: number, L: number, back = false): string {
	const w = L * 0.36;
	const pet = strk(quad(40, 86, 40 + (tx - 40) * 0.2, ty + (86 - ty) * 0.5, tx, ty), "#7a5470", 1.1);
	if (back) return pet + g(tx, ty, deg, fill(leafPath(L, w, 2), "#8a3f69") + strk(`M1 0L${f(L * 0.9)} 0`, "#5f2a49", 0.8));
	const marks = new Bag();
	for (const t of [0.18, 0.36, 0.54, 0.72]) {
		const l = L * (0.3 - t * 0.12);
		marks.add("#2f6a3a", L * t, 0, -58, l, l * 0.28, 1).add("#2f6a3a", L * t, 0, 58, l, l * 0.28, 1);
	}
	return pet + g(tx, ty, deg, fill(leafPath(L, w, 2), "#86bd6c") + fill(leafPath(L * 0.92, w * 0.55, 2), "#a6cf88") + marks.out() + strk(`M1 0L${f(L * 0.92)} 0`, "#2f6a3a", 0.8));
}
function calathea(st: St): string {
	if (st === "sprout") return calLeaf(37, 74, -112, 10) + calLeaf(43, 76, -62, 9);
	if (st === "leafy") return calLeaf(28, 64, -138, 14, true) + calLeaf(52, 62, -46, 15) + calLeaf(35, 54, -108, 16) + calLeaf(46, 56, -72, 15);
	return calLeaf(20, 64, -152, 16) + calLeaf(60, 60, -30, 16, true) + calLeaf(26, 46, -125, 18) + calLeaf(54, 44, -58, 18) + calLeaf(36, 36, -100, 18, true) + calLeaf(46, 38, -80, 18) + calLeaf(40, 58, -92, 14);
}

/* 13. Rubber plant */
function rubberLeaf(x: number, y: number, deg: number, L: number, w: number, c = "#3b6c46"): string {
	return g(x, y, deg, fill(leafPath(L, w, 0), c) + ell(L * 0.45, -w * 0.5, L * 0.2, w * 0.12, "#7fa882") + strk(`M1 0L${f(L * 0.88)} 0`, "#d9b2a0", 0.8, 0.8));
}
const sheath = (x: number, y: number, deg: number, L: number) => leaf(x, y, deg, L, 1.5, { fill: "#c8453c", shape: 1, rib: false });
function rubberPlant(st: St): string {
	const stemC = "#6f6a44";
	if (st === "sprout") return line(40, 87, 40, 71, stemC, 1.8) + rubberLeaf(40, 79, -170, 10, 4.2) + rubberLeaf(40, 74, -18, 10, 4.2, "#457a50") + sheath(40, 72, -90, 6);
	if (st === "leafy") {
		let s = line(40, 87, 40, 43, stemC, 2.2);
		([[80, 1], [72, -1], [64, 1], [56, -1], [49, 1]] as [number, number][]).forEach(([y, side], i) => {
			s += rubberLeaf(40, y, side > 0 ? -10 - i * 6 : -170 + i * 6, 15 - i * 0.6, 6, i % 2 ? "#457a50" : "#3b6c46");
		});
		return s + sheath(40, 44, -90, 8);
	}
	let s = line(40, 87, 40, 22, stemC, 2.8) + line(40, 56, 54, 36, stemC, 2);
	([[82, 1], [75, -1], [68, 1], [61, -1], [54, 1], [47, -1], [40, 1], [33, -1], [27, 1]] as [number, number][]).forEach(([y, side], i) => {
		s += rubberLeaf(40, y, side > 0 ? -2 - i * 5 : -178 + i * 5, 18 - i * 0.6, 7, i % 2 ? "#457a50" : "#3b6c46");
	});
	s += rubberLeaf(48, 45, -5, 13, 5.5, "#457a50") + rubberLeaf(53, 38, -60, 12, 5, "#3b6c46");
	return s + sheath(40, 23, -90, 9) + sheath(54, 37, -55, 6);
}

/* 14. Anthurium */
function anthSpathe(sx: number, sy: number, deg: number, L: number): string {
	const spadix = (L * 0.75).toFixed(1);
	return (
		strk(quad(40, 86, 40 + (sx - 40) * 0.2, sy + 20, sx, sy), "#5f8f45", 1.1) +
		heart(sx, sy, deg, L, L * 0.62, "#d8363e", undefined, ell(L * 0.45, -L * 0.25, L * 0.18, L * 0.08, "#ffffff") .replace("/>", ' opacity=".35"/>')) +
		g(sx, sy, deg - 150, strk(`M0 0Q${f(L * 0.4)} -1 ${spadix} 1`, "#f0c64a", 1.8))
	);
}
function anthLeaf(tx: number, ty: number, deg: number, L: number, c = "#3d7a43"): string {
	return strk(quad(40, 86, 40 + (tx - 40) * 0.2, ty + (86 - ty) * 0.4, tx, ty), "#4f8a45", 1.1) + heart(tx, ty, deg, L, L * 0.55, c, "#24502c");
}
function anthurium(st: St): string {
	if (st === "sprout") return anthLeaf(38, 74, -118, 10) + anthLeaf(43, 76, -55, 9, "#4a8a4a");
	if (st === "leafy") return anthLeaf(28, 62, -135, 14) + anthLeaf(52, 60, -45, 14, "#4a8a4a") + anthLeaf(40, 52, -92, 15) + anthSpathe(48, 64, 70, 6);
	return anthLeaf(24, 62, -145, 16) + anthLeaf(56, 60, -35, 16, "#4a8a4a") + anthLeaf(38, 54, -100, 16, "#4a8a4a") + anthLeaf(20, 76, 175, 12) + anthSpathe(30, 38, 105, 12) + anthSpathe(53, 32, 75, 12) + anthSpathe(44, 50, 85, 9);
}

/* 15. Orchid */
function orchidFlower(x: number, y: number, s: number): string {
	return (
		ell(x, y - 2.6 * s, 1.4 * s, 2.1 * s, "#e48ac0") +
		ell(x - 1.8 * s, y + 1.9 * s, 1.2 * s, 2 * s, "#e48ac0", 35) +
		ell(x + 1.8 * s, y + 1.9 * s, 1.2 * s, 2 * s, "#e48ac0", -35) +
		ell(x - 2.3 * s, y - 0.3 * s, 2.3 * s, 2 * s, "#f2acd4") +
		ell(x + 2.3 * s, y - 0.3 * s, 2.3 * s, 2 * s, "#f2acd4") +
		ell(x, y + 1.4 * s, 1.1 * s, 1.5 * s, "#b02d6e") +
		circle(x, y - 0.2 * s, 0.6 * s, "#f5d04a")
	);
}
const OL = { a: "#4f8a45", b: "#5f9a52" };
function orchid(st: St): string {
	const leaves = (k: number) => leaf(40, 84, -166, 17 * k, 5.2 * k, { fill: OL.a }) + leaf(40, 84, -14, 17 * k, 5.2 * k, { fill: OL.a }) + leaf(40, 83, -142, 13 * k, 4.6 * k, { fill: OL.b }) + leaf(40, 83, -38, 14 * k, 4.6 * k, { fill: OL.b });
	if (st === "sprout") return leaf(40, 84, -150, 11, 3.8, { fill: OL.a }) + leaf(40, 84, -30, 11, 3.8, { fill: OL.b }) + strk("M40 85Q46 86 50 84", "#b9c3b0", 1);
	if (st === "leafy") {
		const P: [Pt, Pt, Pt, Pt] = [[41, 82], [42, 58], [44, 50], [52, 46]];
		let s = strk(curve(P), "#6b7a45", 1.1);
		for (const t of [0.75, 0.88, 1]) {
			const [x, y] = bez(P, t);
			s += circle(x, y + 1.4, 1.6, "#9cbf6a");
		}
		return s + leaves(1);
	}
	const P: [Pt, Pt, Pt, Pt] = [[41, 82], [40, 36], [50, 22], [68, 30]];
	let s = strk(curve(P), "#6b7a45", 1.2) + strk("M33 86Q24 88 20 84", "#b9c3b0", 1);
	for (const t of [0.48, 0.63, 0.78, 0.92]) {
		const [x, y] = bez(P, t);
		s += orchidFlower(x, y + 3.5, 1.5);
	}
	const [bx, by] = bez(P, 1);
	return s + circle(bx, by + 1.5, 1.8, "#e9a3c9") + leaves(1.15);
}

/* 16. Bromeliad */
function rosette(n: number, from: number, to: number, L: number, w: number, a: string, b: string, y = 85, shape: 0 | 1 | 3 = 1): string {
	let s = "";
	for (let i = 0; i < n; i++) {
		const t = n === 1 ? 0.5 : i / (n - 1);
		const d = from + (to - from) * t;
		s += leaf(40, y, d, L * (1 - Math.abs(d + 90) / 300), w, { fill: i % 2 ? a : b, shape, rib: false });
	}
	return s;
}
function bromeliad(st: St): string {
	const A = "#5d9e54";
	const B = "#78b463";
	if (st === "sprout") return rosette(5, -160, -20, 12, 2.6, A, B);
	const leaves = (k: number) => rosette(9, -176, -4, 24 * k, 3.4 * k, A, B) + rosette(6, -150, -30, 18 * k, 3 * k, B, A, 84);
	if (st === "leafy") return leaves(1);
	return leaves(1.08) + rosette(7, -158, -22, 20, 3, "#d8383a", "#e64a3e", 76) + rosette(5, -135, -45, 15, 2.6, "#f0703a", "#e85a3a", 74) + ell(40, 66, 2.4, 6, "#f2c94c");
}

/* 17. Pineapple */
function chords(cx: number, cy: number, a: number, b: number, slope: 1 | -1, step: number): string {
	let d = "";
	const A = 1 / (a * a) + 1 / (b * b);
	for (let c = -b - a; c <= b + a; c += step) {
		const B = (2 * c * slope) / (b * b);
		const C = (c * c) / (b * b) - 1;
		const disc = B * B - 4 * A * C;
		if (disc <= 0) continue;
		const x1 = (-B - Math.sqrt(disc)) / (2 * A);
		const x2 = (-B + Math.sqrt(disc)) / (2 * A);
		d += `M${f(cx + x1)} ${f(cy + slope * x1 + c)}L${f(cx + x2)} ${f(cy + slope * x2 + c)}`;
	}
	return d;
}
function pineapple(st: St): string {
	const A = "#7d9b70";
	const B = "#94ad85";
	if (st === "sprout") return rosette(5, -150, -30, 16, 1.8, A, B, 86, 3);
	if (st === "leafy") return rosette(11, -170, -10, 34, 2.2, A, B, 86, 3) + rosette(6, -130, -50, 26, 2, B, A, 86, 3);
	let s = rosette(11, -172, -8, 32, 2.3, A, B, 86, 3);
	s += ell(40, 52, 8.6, 11.5, "#e3a83c") + strk(chords(40, 52, 8.6, 11.5, 1, 4.2) + chords(40, 52, 8.6, 11.5, -1, 4.2), "#a8722a", 0.7, 0.85);
	s += rosette(7, -135, -45, 14, 1.8, "#6f9a5a", "#83ad6a", 41, 3);
	return s + rosette(6, -165, -15, 20, 2.1, B, A, 86, 3);
}

/* 18. Croton */
const CROTON = { g: ["#4f8a3e", "#f0d050"], y: ["#e3b83a", "#5f8a3e"], o: ["#e0742e", "#f4d35a"], r: ["#b8343c", "#f4b84a"] } as const;
type CK = keyof typeof CROTON;
function crotonLeaves(list: [number, number, number, number, CK][]): string {
	return list.map(([x, y, d, L, k]) => leaf(x, y, d, L, L * 0.3, { fill: CROTON[k][0], dark: CROTON[k][1], shape: 1 }).replace('opacity=".55"', 'opacity=".9"')).join("");
}
function croton(st: St): string {
	if (st === "sprout") return line(40, 87, 40, 73, BARK, 1.4) + crotonLeaves([[40, 77, -160, 10, "g"], [40, 75, -25, 10, "y"], [40, 73, -95, 9, "o"]]);
	if (st === "leafy") {
		return (
			line(40, 87, 40, 46, BARK, 2) +
			crotonLeaves([[40, 78, -170, 13, "g"], [40, 74, -12, 13, "y"], [40, 68, -150, 14, "o"], [40, 64, -30, 14, "g"], [40, 58, -135, 13, "y"], [40, 54, -45, 13, "r"], [40, 48, -110, 12, "g"], [40, 47, -70, 12, "o"]])
		);
	}
	return (
		line(40, 87, 40, 40, BARK, 2.6) + line(40, 70, 28, 56, BARK, 1.8) + line(40, 64, 53, 50, BARK, 1.8) +
		crotonLeaves([
			[40, 80, -172, 14, "g"], [40, 78, -8, 14, "o"], [28, 57, -170, 15, "y"], [28, 56, -130, 15, "r"], [28, 56, -88, 13, "g"], [53, 51, -10, 15, "r"], [53, 50, -52, 15, "g"], [53, 50, -95, 13, "y"],
			[40, 66, -160, 13, "o"], [40, 62, -20, 13, "y"], [40, 42, -150, 15, "g"], [40, 41, -30, 15, "o"], [40, 40, -112, 15, "y"], [40, 40, -70, 15, "r"], [34, 64, -115, 11, "g"],
		])
	);
}

/* 19. Dieffenbachia */
function dieffLeaf(x: number, y: number, deg: number, L: number, w: number, c = "#4b8a43"): string {
	const blotch = `<g transform="translate(${f(L * 0.1)} 0)">${fill(leafPath(L * 0.74, w * 0.58, 0), "#dfe8b4")}</g>`;
	const dots = circle(L * 0.3, -w * 0.72, 0.6, "#dfe8b4") + circle(L * 0.62, w * 0.66, 0.6, "#dfe8b4") + circle(L * 0.85, -w * 0.3, 0.5, "#dfe8b4");
	return g(x, y, deg, fill(leafPath(L, w, 0), c) + blotch + dots + strk(`M1 0L${f(L * 0.88)} 0`, "#8fb56a", 0.9));
}
function cane(x: number, top: number, w: number): string {
	let s = line(x, 87, x, top, "#86a865", w);
	for (let y = 82; y > top + 3; y -= 5) s += line(x - w / 2, y, x + w / 2, y - 0.6, "#6c8d50", 0.6);
	return s;
}
function dieffenbachia(st: St): string {
	if (st === "sprout") return line(40, 87, 40, 77, "#86a865", 2) + dieffLeaf(40, 78, -128, 11, 4.4) + dieffLeaf(40, 77, -55, 12, 4.8, "#559548");
	if (st === "leafy") return cane(40, 50, 3) + dieffLeaf(40, 74, -165, 15, 6) + dieffLeaf(40, 67, -18, 16, 6.4, "#559548") + dieffLeaf(40, 60, -148, 16, 6.4) + dieffLeaf(40, 54, -38, 15, 6, "#559548") + dieffLeaf(40, 51, -96, 14, 5.6);
	return (
		cane(29, 60, 3) + dieffLeaf(29, 64, -158, 14, 5.6, "#559548") + dieffLeaf(29, 61, -112, 13, 5.4) +
		cane(41, 30, 4) + dieffLeaf(41, 66, -10, 17, 6.8) + dieffLeaf(41, 56, -160, 18, 7, "#559548") + dieffLeaf(41, 50, -20, 18, 7) + dieffLeaf(41, 42, -145, 18, 7) + dieffLeaf(41, 37, -35, 18, 7, "#559548") + dieffLeaf(41, 31, -115, 17, 6.6) + dieffLeaf(41, 30, -68, 17, 6.6, "#559548")
	);
}

/* 20. Elephant ear */
function earLeaf(tx: number, ty: number, deg: number, L: number, c = "#5aa84f"): string {
	const w = L * 0.6;
	let veins = "";
	for (const a of [-55, -25, 0, 25, 55]) veins += strk(`M0 0L${f(Math.cos(a * rad) * L * 0.7)} ${f(Math.sin(a * rad) * w * 0.9)}`, "#a8d68c", 0.7, 0.75);
	return strk(quad(40, 86, 40 + (tx - 40) * 0.1, ty + (86 - ty) * 0.2, tx, ty), "#6a9a52", 1.6) + g(tx, ty, deg, fill(heartD(L, w), c) + veins);
}
function elephantEar(st: St): string {
	if (st === "sprout") return earLeaf(40, 70, 95, 11);
	if (st === "leafy") return earLeaf(28, 52, 115, 17, "#4f9a47") + earLeaf(52, 48, 68, 18) + earLeaf(40, 62, 92, 13, "#66b45a");
	return earLeaf(22, 36, 118, 24, "#4f9a47") + earLeaf(57, 30, 64, 25, "#4f9a47") + earLeaf(39, 18, 88, 26) + earLeaf(30, 62, 125, 15, "#66b45a") + earLeaf(52, 64, 58, 14, "#66b45a");
}

/* 21. Money tree */
function hand(x: number, y: number, deg: number, size: number): string {
	const bag = new Bag();
	[-64, -32, 0, 32, 64].forEach((o, i) => {
		const k = i === 2 ? 1 : i === 1 || i === 3 ? 0.88 : 0.72;
		bag.add(i % 2 ? "#5fa84d" : "#76b95c", x, y, deg + o, size * k, size * k * 0.27, 1);
	});
	return bag.out() + circle(x, y, 0.9, "#4f8a3e");
}
function braid(top: number): string {
	let s = "";
	for (const [i, c] of ["#86653f", "#9c7a52", "#b08a5e"].entries()) {
		let d = "";
		for (let y = 87; y >= top; y -= 1.5) d += `${d ? "L" : "M"}${f(40 + 2.2 * Math.sin((87 - y) / 4.5 + (i * 2 * Math.PI) / 3))} ${f(y)}`;
		s += strk(d, c, 2);
	}
	return s;
}
function moneyTree(st: St): string {
	if (st === "sprout") return line(40, 87, 40, 73, "#5f8a3e", 1.5) + hand(40, 73, -90, 8);
	const hands = (top: number, list: [number, number, number, number][]) => list.map(([x, y, d, sz]) => strk(quad(40, top, 40 + (x - 40) * 0.3, y, x, y), "#6a8a45", 1) + hand(x, y, d, sz)).join("");
	if (st === "leafy") return braid(64) + hands(64, [[28, 52, -130, 9], [52, 52, -50, 9], [40, 46, -90, 9]]);
	return braid(50) + hands(50, [[20, 44, -150, 10], [60, 44, -30, 10], [28, 30, -118, 10.5], [52, 30, -62, 10.5], [40, 22, -90, 11], [40, 38, -90, 8]]);
}

/* 22. Dracaena */
function tuft(x: number, y: number, size: number): string {
	const bag = new Bag();
	const n = 11;
	for (let i = 0; i < n; i++) {
		const a = -190 + (200 * i) / (n - 1);
		const L = size * (1 - Math.abs(a + 90) / 260);
		bag.add("#b8475e", x, y, a, L, 1.9, 1);
	}
	for (let i = 0; i < n; i++) {
		const a = -190 + (200 * i) / (n - 1);
		const L = size * (1 - Math.abs(a + 90) / 260);
		bag.add(i % 2 ? "#4f9a45" : "#66ad55", x, y, a, L * 0.95, 1.45, 1);
	}
	return bag.out();
}
function dracaenaCane(P: [Pt, Pt, Pt, Pt]): string {
	let s = strk(curve(P), "#8f7f6c", 1.8);
	for (let i = 1; i < 8; i++) {
		const [x, y] = bez(P, i / 8);
		s += line(x - 1, y, x + 1, y, "#6e604f", 0.5);
	}
	return s;
}
function dracaena(st: St): string {
	if (st === "sprout") return tuft(40, 80, 12);
	if (st === "leafy") return dracaenaCane([[40, 87], [40, 72], [40, 60], [42, 50]]) + tuft(42, 50, 15) + tuft(37, 70, 10);
	return (
		dracaenaCane([[40, 87], [38, 70], [30, 50], [26, 38]]) + dracaenaCane([[41, 87], [42, 60], [42, 40], [45, 22]]) + dracaenaCane([[42, 87], [46, 72], [54, 60], [58, 50]]) +
		tuft(58, 50, 14) + tuft(26, 38, 15) + tuft(45, 22, 15)
	);
}

/* 23. Coffee plant */
const COF = { a: "#3f7d3f", b: "#4f9048", stem: "#7d6a48" };
const cofLeaf = (x: number, y: number, d: number, L: number, i: number) => leaf(x, y, d, L, L * 0.36, { fill: i % 2 ? COF.a : COF.b, shape: 1, dark: "#24502c" });
function cherries(x: number, y: number): string {
	return circle(x - 1.7, y, 1.7, "#c23a30") + circle(x + 1.7, y + 0.3, 1.7, "#9e2a2a") + circle(x, y + 1.9, 1.7, "#d9542f") + circle(x - 2.2, y - 0.6, 0.5, "#ffffff", 0.5);
}
function coffee(st: St): string {
	if (st === "sprout") return line(40, 87, 40, 72, COF.stem, 1.4) + leaf(40, 73, -155, 8, 4.4, { fill: COF.b, shape: 2 }) + leaf(40, 73, -25, 8, 4.4, { fill: COF.b, shape: 2 }) + cofLeaf(40, 72, -100, 5, 0) + cofLeaf(40, 72, -80, 5, 1);
	if (st === "leafy") {
		let s = line(40, 87, 40, 42, COF.stem, 1.8);
		[76, 66, 56, 47].forEach((y, i) => {
			s += cofLeaf(40, y, -172 + i * 12, 13 - i, i) + cofLeaf(40, y, -8 - i * 12, 13 - i, i + 1);
		});
		return s + cofLeaf(40, 43, -110, 8, 0) + cofLeaf(40, 43, -70, 8, 1);
	}
	let s = line(40, 87, 40, 22, COF.stem, 2.2);
	let fruit = "";
	const bag = new Bag();
	const add = (x: number, y: number, d: number, L: number, i: number) => bag.add(i % 2 ? COF.a : COF.b, x, y, d, L, L * 0.36, 1);
	([[72, 22], [56, 20], [40, 16]] as [number, number][]).forEach(([y, reach], tier) => {
		for (const side of [-1, 1]) {
			const ex = 40 + side * reach;
			const ey = y + 4;
			s += strk(quad(40, y, 40 + side * reach * 0.6, y - 1, ex, ey), COF.stem, 1.2);
			for (let k = 1; k <= 3; k++) {
				const t = k / 3.4;
				const x = 40 + side * reach * t;
				const yy = y + 4 * t * t;
				const base = side > 0 ? 0 : 180;
				add(x, yy, base - side * 45, 9, k + tier);
				add(x, yy, base + side * 35, 8.5, k + tier + 1);
				if (k < 3) fruit += cherries(x - side * 0.5, yy + 2.2);
			}
			add(ex, ey, side > 0 ? 10 : 170, 8, tier);
		}
	});
	add(40, 24, -115, 9, 0);
	add(40, 24, -65, 9, 1);
	return s + bag.out() + fruit;
}

/* 24. Spider plant */
function strapArc(tx: number, ty: number, cx: number, cy: number, w: number): string {
	const d = quad(40, 86, cx, cy, tx, ty);
	return strk(d, "#5aa04a", w) + strk(d, "#e8edc4", w * 0.24);
}
function spiderTips(list: [number, number][], lift: number, w: number): string {
	return list.map(([tx, ty]) => strapArc(tx, ty, 40 + (tx - 40) * 0.45, Math.min(ty, 86) - lift, w)).join("");
}
function plantlet(x: number, y: number): string {
	let s = "";
	for (const a of [-170, -135, -105, -75, -45, -10]) s += leaf(x, y, a, 8, 1.4, { fill: "#6fb35a", shape: 1, rib: false });
	return s;
}
function spiderPlant(st: St): string {
	if (st === "sprout") return spiderTips([[28, 74], [52, 72], [36, 66], [45, 66]], 12, 1.8);
	const tips: [number, number][] = [[12, 74], [18, 60], [28, 50], [36, 46], [45, 46], [53, 50], [62, 60], [68, 74]];
	if (st === "leafy") return spiderTips(tips, 16, 2.2);
	let s = strk("M40 70Q24 30 11 62", "#b3ad78", 1.1) + strk("M40 70Q58 28 70 66", "#b3ad78", 1.1);
	s += petals(22, 44, 6, 1.1, 1, 0.55, "#f6f4ea") + petals(57, 42, 6, 1.1, 1, 0.55, "#f6f4ea");
	s += spiderTips([[8, 76], [12, 62], [20, 50], [30, 40], [38, 36], [46, 37], [54, 42], [62, 52], [68, 64], [72, 78], [30, 64], [50, 62]], 20, 2.5);
	return s + plantlet(12, 60) + plantlet(70, 64);
}

/* 25. Heliconia */
const HEL = { a: "#4a8f45", b: "#5ea050", rib: "#2f6b35", pet: "#4f8a45" };
function helLeaf(tx: number, ty: number, deg: number, L: number, c: string): string {
	return strk(quad(40, 86, 40 + (tx - 40) * 0.4, ty + (86 - ty) * 0.5, tx, ty), HEL.pet, 1.3) + leaf(tx, ty, deg, L, L * 0.24, { fill: c, dark: HEL.rib });
}
function claw(x: number, y: number, side: number, L: number): string {
	const w = L * 0.33;
	return g(x, y, side < 0 ? -158 : -22, fill(leafPath(L, w, 1), "#d8383a") + strk(`M1 ${f(-w * 0.4)}Q${f(L * 0.5)} ${f(-w * 1.05)} ${f(L * 0.95)} 0`, "#f2c94c", 1.1));
}
function heliconia(st: St): string {
	if (st === "sprout") return line(40, 87, 40, 79, HEL.pet, 1.4) + leaf(40, 80, -92, 13, 2.6, { fill: HEL.a, dark: HEL.rib }) + leaf(40, 84, -140, 9, 2.2, { fill: HEL.b, dark: HEL.rib });
	if (st === "leafy") return helLeaf(30, 62, -112, 20, HEL.a) + helLeaf(50, 60, -68, 20, HEL.a) + helLeaf(22, 72, -145, 15, HEL.b) + helLeaf(58, 72, -35, 15, HEL.b);
	let s = helLeaf(28, 60, -112, 24, HEL.a) + helLeaf(54, 58, -68, 24, HEL.a) + helLeaf(18, 72, -145, 18, HEL.b) + helLeaf(62, 72, -35, 18, HEL.b);
	const P: [Pt, Pt, Pt, Pt] = [[41, 86], [41, 60], [44, 40], [43, 16]];
	s += strk(curve(P), "#5c8a45", 1.6);
	[0.42, 0.55, 0.67, 0.78, 0.88].forEach((t, i) => {
		const [x, y] = bez(P, t);
		s += claw(x, y, i % 2 ? 1 : -1, 15 - i * 1.7);
	});
	return s + leaf(43, 17, -90, 4, 1.5, { fill: "#9cbf4a", shape: 1, rib: false });
}

const kebab = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const S = (name: string, draw: (st: St) => string): Species => ({ id: kebab(name), name, draw });

export const SPECIES: Species[] = [
	S("Monstera", monstera),
	S("Fiddle-leaf fig", fiddleFig),
	S("Banana plant", banana),
	S("Coconut palm", coconut),
	S("Date palm", datePalm),
	S("Bird of paradise", birdOfParadise),
	S("Pothos", pothos),
	S("Philodendron", philodendron),
	S("Snake plant", snakePlant),
	S("ZZ plant", zzPlant),
	S("Peace lily", peaceLily),
	S("Calathea", calathea),
	S("Rubber plant", rubberPlant),
	S("Anthurium", anthurium),
	S("Orchid", orchid),
	S("Bromeliad", bromeliad),
	S("Pineapple", pineapple),
	S("Croton", croton),
	S("Dieffenbachia", dieffenbachia),
	S("Elephant ear", elephantEar),
	S("Money tree", moneyTree),
	S("Dracaena", dracaena),
	S("Coffee plant", coffee),
	S("Spider plant", spiderPlant),
	S("Heliconia", heliconia),
];
