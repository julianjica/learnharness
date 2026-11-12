/**
 * Trees: 25 species in the garden's flat style (see kit.ts). Each grows from
 * a sapling (sprout) to a young tree (leafy) to its signature fullest form
 * (bloom): fruit, blossom, cones, autumn colour or its typical silhouette.
 */
import { BARK, GREEN, circle, f, leaf, line, petals, stem, type GrowingStage, type Species } from "./kit";

type Blob = readonly [number, number, number, string];

const blobs = (cs: readonly Blob[]): string => cs.map(([x, y, r, c]) => circle(x, y, r, c)).join("");

const path = (d: string, fill: string): string => `<path d="${d}" fill="${fill}"/>`;

function ell(x: number, y: number, rx: number, ry: number, fill: string, rot = 0): string {
	const t = rot ? ` transform="rotate(${f(rot)} ${f(x)} ${f(y)})"` : "";
	return `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(rx)}" ry="${f(ry)}" fill="${fill}"${t}/>`;
}

/** A tapered trunk from the ground at x0 (width w0, flared foot) to (x1, y1) (width w1). */
function trunk(x0: number, x1: number, y1: number, w0: number, w1: number, fill: string = BARK): string {
	const y0 = 87.5;
	const fl = w0 * 0.35;
	return path(
		`M${f(x0 - w0 / 2 - fl)} ${y0}Q${f(x0 - w0 / 2)} ${f(y0 - 1)} ${f(x0 - w0 / 2)} ${f(y0 - 4)}L${f(x1 - w1 / 2)} ${f(y1)}L${f(x1 + w1 / 2)} ${f(y1)}L${f(x0 + w0 / 2)} ${f(y0 - 4)}Q${f(x0 + w0 / 2)} ${f(y0 - 1)} ${f(x0 + w0 / 2 + fl)} ${y0}Z`,
		fill,
	);
}

/** Maps local leaf coordinates (u along, v across) at (x, y) rotated by deg to "x y". */
function mapper(x: number, y: number, deg: number): (u: number, v: number) => string {
	const c = Math.cos((deg * Math.PI) / 180);
	const s = Math.sin((deg * Math.PI) / 180);
	return (u, v) => `${f(x + c * u - s * v)} ${f(y + s * u + c * v)}`;
}

/** Merges path data per fill into one <path> each, in first-seen order (keeps markup small). */
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

/** A leaf outline in absolute coordinates: 1 pointed lens, 0 oval (as the kit's shapes). */
function lensD(x: number, y: number, deg: number, len: number, w: number, shape: 0 | 1 = 1): string {
	const P = mapper(x, y, deg);
	const [a, b, c] = shape === 1 ? [0.45, 1.15, 0.5] : [0.3, 1, 1];
	return `M${P(0, 0)}C${P(len * a, -w * b)} ${P(len * 0.8, -w * c)} ${P(len, 0)}C${P(len * 0.8, w * c)} ${P(len * a, w * b)} ${P(0, 0)}Z`;
}

/** A palmate leaf outline at (x, y) with n pointed lobes, opening upward at rot 0. */
function palmD(x: number, y: number, r: number, n: number, rot = 0, inner = 0.42): string {
	const spread = 250;
	const start = -90 - spread / 2;
	const step = spread / (n - 1);
	const P = mapper(x, y, rot);
	const at = (deg: number, rad: number) => P(Math.cos((deg * Math.PI) / 180) * rad, Math.sin((deg * Math.PI) / 180) * rad);
	let d = `M${P(0, r * 0.12)}`;
	for (let i = 0; i < n; i++) {
		if (i > 0) d += `L${at(start + step * (i - 0.5), r * inner)}`;
		d += `L${at(start + step * i, r)}`;
	}
	return d + "Z";
}

function palm(x: number, y: number, r: number, n: number, fill: string, rot = 0): string {
	return path(palmD(x, y, r, n, rot), fill);
}

/** A ginkgo fan leaf outline with its notch, opening at `rot` (0 = up). */
function fanD(x: number, y: number, r: number, rot: number): string {
	const P = mapper(x, y, rot - 90);
	// local u is "up" (along the stalk), v across
	return `M${P(0, 0)}L${P(r * 0.68, -r * 0.8)}Q${P(r * 1.15, -r * 0.5)} ${P(r, -r * 0.08)}L${P(r * 0.78, 0)}L${P(r, r * 0.08)}Q${P(r * 1.15, r * 0.5)} ${P(r * 0.68, r * 0.8)}Z`;
}

function fan(x: number, y: number, r: number, rot: number, fill: string): string {
	return path(fanD(x, y, r, rot), fill);
}

/** A pinnate leaf (acacia, jacaranda): a curving rachis with paired leaflets, two tones. */
function pinnate(x: number, y: number, deg: number, len: number, bend: number, leaflet: number, rib: string, a: string, b: string): string {
	const n = 8;
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
			ink.add(a, lensD(px, py, ad - 62, l, l * 0.3)).add(b, lensD(px, py, ad + 62, l, l * 0.3));
		}
	}
	return `<path d="${d}" stroke="${rib}" stroke-width="1.2" fill="none" stroke-linecap="round"/>` + ink;
}

/** An oak leaf: rounded lobes along a midrib, pointing at `angle`. */
function oakLeaf(x: number, y: number, angle: number, len: number, w: number, fill: string = GREEN.leaf): string {
	let s = ell(len * 0.5, 0, len * 0.5, w * 0.42, fill);
	[0.3, 0.55, 0.8].forEach((t, i) => {
		const r = w * (0.46 - i * 0.07);
		s += circle(len * t, -w * 0.42, r, fill) + circle(len * t, w * 0.42, r, fill);
	});
	s += circle(len * 0.94, 0, w * 0.32, fill);
	s += `<path d="M1 0L${f(len * 0.85)} 0" stroke="${GREEN.dark}" stroke-width=".8" opacity=".55"/>`;
	return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(angle)})">${s}</g>`;
}

/** Needles radiating from (x, y) between angles `from` and `to`. */
function burst(x: number, y: number, r: number, n: number, color: string, from = -170, to = -10, w = 1): string {
	let d = "";
	for (let i = 0; i < n; i++) {
		const a = ((from + ((to - from) * i) / (n - 1)) * Math.PI) / 180;
		d += `M${f(x)} ${f(y)}L${f(x + Math.cos(a) * r)} ${f(y + Math.sin(a) * r)}`;
	}
	return `<path d="${d}" stroke="${color}" stroke-width="${w}" stroke-linecap="round" fill="none"/>`;
}

/** A round fruit with a small shine. */
function fruit(x: number, y: number, r: number, fill: string): string {
	return circle(x, y, r, fill) + circle(x - r * 0.35, y - r * 0.35, r * 0.3, "#fff", 0.55);
}

/** A five-petal blossom. */
function blossom(x: number, y: number, r: number, fill: string, centre: string, offset = 0): string {
	return petals(x, y, 5, r * 0.55, r * 0.5, r * 0.4, fill, offset) + circle(x, y, r * 0.28, centre);
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

/** A sapling: a thin stem with leaves drawn at its top by `top(x, y)`. */
function sapling(h: number, top: (x: number, y: number) => string, color: string = BARK, w = 1.8): string {
	return line(40, 87, 40, 87 - h, color, w) + top(40, 87 - h);
}

/* ---------------- species ---------------- */

const OAK_DARK = "#3d6e33";
const OAK = "#5a9a45";
const OAK_LIGHT = "#79b257";

function oak(stage: GrowingStage): string {
	if (stage === "sprout") return sapling(17, (x, y) => oakLeaf(x, y + 2, -150, 11, 5, OAK) + oakLeaf(x, y + 2, -30, 11, 5, OAK) + oakLeaf(x, y, -90, 8, 3.6, OAK_LIGHT));
	if (stage === "leafy")
		return (
			trunk(40, 40, 54, 6, 3.5) +
			line(40, 68, 29, 57, BARK, 2.4) +
			line(40, 64, 52, 55, BARK, 2.4) +
			blobs([
				[26, 54, 8, OAK_DARK],
				[54, 52, 8, OAK_DARK],
				[40, 47, 11, OAK],
				[30, 46, 7, OAK],
				[50, 44, 7, OAK],
				[36, 40, 5, OAK_LIGHT],
				[46, 39, 4, OAK_LIGHT],
			])
		);
	const acorn = (x: number, y: number) => ell(x, y + 1.6, 2.1, 2.7, "#b9853f") + ell(x, y - 0.4, 2.6, 1.5, "#6e4e2e") + line(x, y - 1.6, x + 0.6, y - 2.8, "#6e4e2e", 0.8);
	return (
		trunk(40, 40, 50, 11, 5.5) +
		line(40, 66, 22, 50, BARK, 4) +
		line(40, 62, 58, 48, BARK, 4) +
		line(40, 56, 36, 40, BARK, 3) +
		blobs([
			[14, 48, 10, OAK_DARK],
			[66, 46, 10, OAK_DARK],
			[24, 34, 12, OAK_DARK],
			[56, 32, 12, OAK_DARK],
			[40, 24, 13, OAK_DARK],
			[22, 44, 9, OAK],
			[58, 42, 9, OAK],
			[40, 38, 15, OAK],
			[30, 26, 9, OAK],
			[50, 24, 9, OAK],
			[30, 32, 6, OAK_LIGHT],
			[50, 30, 5, OAK_LIGHT],
			[40, 18, 6, OAK_LIGHT],
			[18, 42, 4, OAK_LIGHT],
		]) +
		acorn(22, 50) +
		acorn(58, 47) +
		acorn(36, 42) +
		acorn(47, 34) +
		acorn(28, 33)
	);
}

const MAPLE = ["#9e3530", "#c4453b", "#dc6449", "#ec8a5e"] as const;

function japaneseMaple(stage: GrowingStage): string {
	const mb = "#6e4434";
	const dome = (cx: number, top: number, bot: number, hw: number, n: number, r: number) => {
		let s = path(`M${f(cx - hw)} ${f(bot)}Q${f(cx - hw + 1)} ${f(top + 2)} ${f(cx)} ${f(top)}Q${f(cx + hw - 1)} ${f(top + 2)} ${f(cx + hw)} ${f(bot)}Q${f(cx)} ${f(bot + 4)} ${f(cx - hw)} ${f(bot)}Z`, MAPLE[0]);
		const ink = new Ink();
		scatter(cx, (top + bot) / 2 + 1, hw * 0.92, (bot - top) * 0.5, n).forEach(([x, y], i) => ink.add(MAPLE[(i % 3) + 1] ?? MAPLE[1], palmD(x, y, r, 5, (i * 47) % 360, 0.38)));
		return s + ink;
	};
	if (stage === "sprout") return sapling(16, (x, y) => palm(x - 5, y + 2, 6.5, 7, MAPLE[1], -35) + palm(x + 5, y + 1, 6.5, 7, MAPLE[2], 35) + palm(x, y - 2, 4, 5, MAPLE[3]), mb, 1.6);
	if (stage === "leafy") return stem([[40, 87], [38, 74], [44, 66], [41, 56]], mb, 3) + stem([[40, 76], [36, 70], [30, 66], [27, 60]], mb, 2) + dome(40, 40, 60, 18, 14, 4.4);
	return (
		stem([[38, 87], [34, 74], [46, 66], [40, 50]], mb, 5) +
		stem([[42, 80], [50, 72], [58, 66], [64, 58]], mb, 2.6) +
		stem([[38, 74], [30, 68], [22, 64], [16, 58]], mb, 2.6) +
		dome(40, 20, 58, 32, 34, 5.4)
	);
}

const BIRCH_BARK = "#ddd6c6";
const BIRCH_MARK = "#3b3631";
const birchMarks = (x: number, ys: number[], w: number) => ys.map((y, i) => line(x - w * (i % 2 ? 0.1 : 0.45), y, x + w * (i % 2 ? 0.45 : 0.05), y + 0.3, BIRCH_MARK, 1.1)).join("");

function birch(stage: GrowingStage): string {
	const g1 = "#8fbf55";
	const g2 = "#a9cf6a";
	const g3 = "#74a645";
	if (stage === "sprout")
		return sapling(19, (x, y) => leaf(x, y + 3, -145, 8, 3.6, { fill: g1, shape: 1 }) + leaf(x, y + 3, -35, 8, 3.6, { fill: g1, shape: 1 }) + leaf(x, y, -90, 6, 2.8, { fill: g2, shape: 1 }), BIRCH_BARK, 2) + line(39.5, 80, 40.5, 80, BIRCH_MARK, 1);
	if (stage === "leafy")
		return (
			trunk(40, 40, 38, 4, 2, BIRCH_BARK) +
			birchMarks(40, [80, 72, 65, 58, 51, 44], 3) +
			blobs([
				[40, 50, 9, g3],
				[34, 42, 7, g1],
				[46, 42, 7, g1],
				[40, 36, 6, g2],
				[38, 46, 4, g2],
			]) +
			([[31, 49], [49, 49]] as const).map(([x, y]) => line(x, y, x - (x < 40 ? 2 : -2), y + 8, g3, 1.2)).join("")
		);
	const catkin = (x: number, y: number) => line(x, y, x, y + 2, "#7a6a4a", 0.7) + ell(x, y + 4.5, 1.1, 3, "#c4a24c");
	let s = trunk(40, 41, 14, 6, 2.5, BIRCH_BARK) + birchMarks(40, [82, 75, 68, 61, 54, 47, 40, 33], 4.4);
	s += line(40, 56, 30, 46, BIRCH_BARK, 1.6) + line(41, 50, 51, 42, BIRCH_BARK, 1.6);
	s += blobs([
		[40, 46, 12, g3],
		[30, 40, 9, g3],
		[51, 38, 9, g3],
		[40, 30, 11, g1],
		[30, 28, 7, g1],
		[50, 26, 7, g1],
		[41, 18, 7, g2],
		[34, 36, 5, g2],
		[46, 33, 5, g2],
	]);
	s += ([[22, 44], [24, 34], [58, 42], [57, 31]] as const).map(([x, y]) => stem([[x, y], [x + (x < 40 ? -3 : 3), y + 4], [x + (x < 40 ? -4 : 4), y + 10], [x + (x < 40 ? -4 : 4), y + 14]], g3, 1.1)).join("");
	return s + catkin(30, 50) + catkin(36, 54) + catkin(48, 52) + catkin(55, 46) + catkin(26, 46);
}

const CH_BARK = "#5e4038";
const CH = ["#e98fae", "#f2b3c6", "#f8d3df"] as const;

function cherryBlossom(stage: GrowingStage): string {
	if (stage === "sprout")
		return sapling(17, (x, y) => leaf(x, y + 4, -150, 9, 3.6, { shape: 1 }) + leaf(x, y + 4, -30, 9, 3.6, { shape: 1 }) + blossom(x, y - 1, 6, CH[1], "#d35a85"), CH_BARK, 1.6);
	if (stage === "leafy")
		return (
			trunk(40, 40, 60, 5, 3, CH_BARK) +
			line(40, 66, 26, 54, CH_BARK, 2.2) +
			line(40, 62, 55, 52, CH_BARK, 2.2) +
			line(40, 62, 40, 46, CH_BARK, 1.8) +
			blobs([
				[25, 51, 7, GREEN.leaf],
				[56, 49, 7, GREEN.leaf],
				[40, 44, 8, GREEN.light],
			]) +
			blossom(22, 48, 4.5, CH[1], "#d35a85") +
			blossom(58, 46, 4.5, CH[1], "#d35a85") +
			blossom(42, 40, 4.5, CH[2], "#d35a85") +
			blossom(30, 54, 4, CH[0], "#c2466f")
		);
	let s = trunk(40, 40, 62, 9, 5, CH_BARK);
	s += stem([[40, 66], [32, 58], [20, 56], [11, 50]], CH_BARK, 3.2) + stem([[40, 64], [48, 56], [60, 54], [69, 48]], CH_BARK, 3.2);
	s += stem([[40, 64], [36, 52], [28, 42], [22, 34]], CH_BARK, 2.6) + stem([[40, 62], [44, 50], [52, 40], [57, 32]], CH_BARK, 2.6) + line(40, 62, 40, 30, CH_BARK, 2.2);
	s += blobs([
		[11, 46, 8, CH[0]],
		[69, 44, 8, CH[0]],
		[21, 31, 9, CH[0]],
		[58, 29, 9, CH[0]],
		[40, 26, 10, CH[0]],
		[17, 42, 6, CH[1]],
		[64, 40, 6, CH[1]],
		[26, 27, 6, CH[1]],
		[53, 25, 6, CH[1]],
		[40, 21, 6, CH[1]],
		[31, 34, 5, CH[1]],
		[49, 33, 5, CH[1]],
	]);
	s += ([[9, 44], [20, 28], [40, 18], [60, 26], [70, 41], [33, 31], [48, 30]] as const).map(([x, y], i) => blossom(x, y, 4, CH[2], "#d35a85", i * 20)).join("");
	return s + ([[14, 76, 30], [24, 82, -20], [62, 79, 40], [55, 84, 10], [70, 70, -30]] as const).map(([x, y, r]) => ell(x, y, 1.6, 1, CH[1], r)).join("");
}

function appleTree(stage: GrowingStage): string {
	if (stage === "sprout") return sapling(19, (x, y) => leaf(x, y + 1, -150, 11, 5) + leaf(x, y + 1, -30, 11, 5) + leaf(x, y, -92, 8, 3.6, { fill: GREEN.light }));
	if (stage === "leafy")
		return (
			trunk(40, 40, 56, 5, 3) +
			line(40, 68, 30, 56, BARK, 2) +
			line(40, 64, 50, 54, BARK, 2) +
			blobs([
				[29, 52, 8, GREEN.dark],
				[51, 50, 8, GREEN.dark],
				[40, 44, 11, GREEN.leaf],
				[34, 40, 6, GREEN.light],
			]) +
			blossom(29, 48, 3.6, "#f7e1e6", "#f4c95d") +
			blossom(48, 45, 3.6, "#f7e1e6", "#f4c95d") +
			blossom(40, 37, 3.6, "#f7e1e6", "#f4c95d")
		);
	const apple = (x: number, y: number) => fruit(x, y, 3.3, "#d9443a") + line(x, y - 3, x + 0.4, y - 4.6, "#5b3a22", 0.8) + leaf(x + 0.4, y - 4, -30, 3.2, 1.4, { rib: false });
	let s = trunk(40, 40, 52, 8, 4.5) + line(40, 66, 29, 54, BARK, 2.8) + line(40, 62, 51, 52, BARK, 2.8);
	s += blobs([
		[25, 46, 12, GREEN.dark],
		[55, 46, 12, GREEN.dark],
		[40, 38, 17, GREEN.leaf],
		[40, 24, 11, GREEN.leaf],
		[34, 32, 8, GREEN.light],
		[48, 28, 6, GREEN.light],
	]);
	return s + ([[30, 42], [48, 37], [38, 25], [56, 49], [23, 50], [42, 49], [27, 32]] as const).map(([x, y]) => apple(x, y)).join("");
}

const CITRUS = ["#2f6a31", "#3f7f39", "#55974a"] as const;

function orangeTree(stage: GrowingStage): string {
	const orange = (x: number, y: number) => fruit(x, y, 3.2, "#f28c28");
	if (stage === "sprout") return sapling(16, (x, y) => leaf(x, y + 2, -155, 10, 4.6, { fill: CITRUS[1], dark: "#1f4a22" }) + leaf(x, y + 2, -25, 10, 4.6, { fill: CITRUS[1], dark: "#1f4a22" }) + leaf(x, y, -90, 7, 3.4, { fill: CITRUS[2], dark: "#1f4a22" }));
	if (stage === "leafy")
		return (
			trunk(40, 40, 62, 4, 3) +
			circle(40, 50, 14, CITRUS[0]) +
			circle(38, 47, 10.5, CITRUS[1]) +
			circle(35, 44, 5, CITRUS[2]) +
			blossom(46, 44, 3.4, "#fbf6ea", "#f4c95d") +
			blossom(32, 54, 3.4, "#fbf6ea", "#f4c95d") +
			fruit(48, 55, 2.2, "#9fbf4a")
		);
	let s = trunk(40, 40, 54, 7, 4.5);
	for (let i = 0; i < 12; i++) {
		const a = (i * 30 * Math.PI) / 180;
		s += circle(40 + Math.cos(a) * 20, 32 + Math.sin(a) * 20, 6.5, CITRUS[0]);
	}
	s += circle(40, 32, 21, CITRUS[0]) + circle(37, 29, 17, CITRUS[1]) + circle(31, 23, 8, CITRUS[2]);
	return s + ([[30, 38], [46, 26], [52, 40], [38, 46], [24, 28], [57, 27], [40, 15], [44, 34]] as const).map(([x, y]) => orange(x, y)).join("") + blossom(29, 18, 3, "#fbf6ea", "#f4c95d");
}

function lemonTree(stage: GrowingStage): string {
	const lg = ["#4f8a3a", "#6aa548", "#86bd5c"] as const;
	const lemon = (x: number, y: number, rot = 0) => `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(rot)})">${ell(0, 0, 2.4, 3.3, "#f2d23a")}${circle(0, -3.2, 0.8, "#f2d23a")}${circle(0, 3.2, 0.8, "#e8c42c")}${ell(-0.8, -0.8, 0.6, 1.2, "#fff", 0)}</g>`;
	const crown = (cx: number, cy: number, rx: number, ry: number, n: number, len: number) => {
		const ink = new Ink();
		for (const [x, y, a] of scatter(cx, cy, rx * 0.88, ry * 0.88, n)) ink.add(Math.round(a * 7) % 2 ? lg[2] : lg[1], lensD(x, y, (a * 180) / Math.PI, len, len * 0.36));
		return ell(cx, cy, rx * 0.86, ry * 0.86, lg[0]) + ink;
	};
	if (stage === "sprout") return sapling(17, (x, y) => leaf(x, y + 3, -150, 9, 3.4, { fill: lg[1], shape: 1 }) + leaf(x, y + 3, -30, 9, 3.4, { fill: lg[1], shape: 1 }) + leaf(x, y, -90, 7, 2.8, { fill: lg[2], shape: 1 }));
	if (stage === "leafy") return trunk(40, 40, 58, 4, 2.5) + crown(40, 47, 11, 15, 16, 7) + lemon(46, 54, 15);
	let s = trunk(40, 40, 62, 6, 3.5) + line(40, 70, 34, 60, BARK, 2.2) + line(40, 68, 47, 58, BARK, 2.2);
	s += crown(40, 36, 19, 26, 40, 9);
	return s + ([[30, 44, -15], [47, 50, 10], [52, 34, 20], [36, 28, -5], [42, 16, 10], [27, 30, -20], [40, 42, 0]] as const).map(([x, y, r]) => lemon(x, y, r)).join("");
}

const OLIVE = ["#6f7f5c", "#8a9a74", "#aab894"] as const;

function oliveTree(stage: GrowingStage): string {
	const ob = "#7d6a55";
	const crown = (cx: number, cy: number, rx: number, ry: number, n: number) => {
		const ink = new Ink();
		scatter(cx, cy, rx, ry, n).forEach(([x, y, a], i) => ink.add(i % 3 ? OLIVE[2] : OLIVE[1], lensD(x, y, ((a * 180) / Math.PI) % 360, 8, 1.8)));
		return ell(cx, cy, rx * 0.85, ry * 0.8, OLIVE[0]) + ink;
	};
	const olive = (x: number, y: number, i: number) => ell(x, y, 1.7, 2.3, i % 2 ? "#3b4426" : "#4b2f4e", 15) + circle(x - 0.6, y - 0.8, 0.5, "#fff", 0.4);
	if (stage === "sprout")
		return sapling(17, (x, y) => [-160, -125, -90, -55, -20].map((a, i) => leaf(x, y + 1, a, 9, 1.8, { fill: i % 2 ? OLIVE[1] : OLIVE[2], shape: 1, rib: false })).join(""), ob, 1.6);
	if (stage === "leafy") return stem([[38, 87], [35, 76], [45, 70], [40, 58]], ob, 4) + stem([[42, 72], [46, 66], [50, 60], [52, 56]], ob, 2) + crown(34, 54, 10, 6, 9) + crown(50, 52, 9, 6, 8) + crown(41, 46, 9, 6, 8);
	let s = stem([[34, 87], [30, 74], [48, 70], [40, 50]], "#6c5a47", 6) + stem([[46, 87], [50, 74], [32, 66], [40, 50]], ob, 5);
	s += stem([[40, 56], [30, 52], [24, 46], [18, 42]], ob, 2.6) + stem([[41, 54], [50, 50], [56, 44], [62, 40]], ob, 2.6);
	s += crown(20, 40, 14, 8, 15) + crown(60, 38, 14, 8, 15) + crown(40, 30, 18, 10, 22) + crown(30, 44, 9, 5, 7) + crown(50, 43, 9, 5, 7);
	return s + [[18, 44], [26, 41], [56, 42], [64, 40], [36, 34], [46, 30], [32, 26], [50, 36], [42, 22]].map(([x, y], i) => olive(x ?? 0, y ?? 0, i)).join("");
}

const PINE = ["#3c6e55", "#4f8466", "#6a9e7a"] as const;
const PINE_BARK = "#b06a3e";

/** Needles fringing a pad: strokes from its centre out to a slightly larger ellipse. */
function fringe(x: number, y: number, rx: number, ry: number, n: number): string {
	let d = "";
	for (let i = 0; i < n; i++) {
		const a = (i / n) * Math.PI * 2 + 0.13;
		d += `M${f(x)} ${f(y)}L${f(x + Math.cos(a) * rx)} ${f(y + Math.sin(a) * ry)}`;
	}
	return `<path d="${d}" stroke="${PINE[1]}" stroke-width="1.1" stroke-linecap="round" fill="none"/>`;
}

function pine(stage: GrowingStage): string {
	const tuft = (x: number, y: number, r: number) => burst(x, y, r, 9, PINE[1], -165, -15, 1.2) + burst(x, y, r * 0.7, 5, PINE[2], -140, -40, 1.2);
	if (stage === "sprout") return line(40, 87, 40, 70, PINE_BARK, 1.8) + tuft(40, 72, 8) + tuft(40, 79, 5.5);
	if (stage === "leafy")
		return line(40, 87, 40, 42, PINE_BARK, 3) + line(40, 70, 30, 66, PINE_BARK, 1.6) + line(40, 60, 50, 56, PINE_BARK, 1.6) + line(40, 52, 32, 49, PINE_BARK, 1.4) + tuft(30, 67, 9) + tuft(50, 57, 9) + tuft(32, 50, 7.5) + tuft(40, 44, 8);
	const pad = (x: number, y: number, rx: number, ry: number) => fringe(x, y, rx + 2.2, ry + 2.6, 22) + ell(x, y, rx, ry, PINE[0]) + ell(x - rx * 0.12, y - ry * 0.35, rx * 0.78, ry * 0.58, PINE[1]) + ell(x - rx * 0.3, y - ry * 0.55, rx * 0.35, ry * 0.3, PINE[2]);
	const cone = (x: number, y: number) => ell(x, y, 1.8, 3, "#8a5a34", 15) + line(x - 1.2, y - 0.6, x + 1.2, y + 0.2, "#6a4224", 0.6);
	let s = stem([[40, 88], [41, 68], [37, 48], [40, 22]], PINE_BARK, 4);
	s += line(39, 50, 26, 45, PINE_BARK, 2.2) + line(39, 42, 55, 35, PINE_BARK, 2.2) + line(39, 32, 28, 27, PINE_BARK, 1.8);
	s += pad(24, 45, 13, 5.5) + pad(56, 36, 14, 6) + pad(28, 27, 11, 5) + pad(46, 22, 13, 5.5) + pad(38, 15, 8, 4);
	return s + cone(20, 50) + cone(30, 50) + cone(58, 42) + cone(50, 41) + cone(32, 32);
}

function spruce(stage: GrowingStage): string {
	const a = "#2b5e4b";
	const b = "#3a7a5f";
	const tier = (yt: number, yb: number, hw: number) => {
		const n = 4;
		let left = `M40 ${f(yt)}L${f(40 - hw)} ${f(yb)}`;
		for (let i = 1; i <= n; i++) left += `L${f(40 - hw + (hw * (i - 0.5)) / n)} ${f(yb - 2)}L${f(40 - hw + (hw * i) / n)} ${f(yb)}`;
		let right = `M40 ${f(yt)}L${f(40 + hw)} ${f(yb)}`;
		for (let i = 1; i <= n; i++) right += `L${f(40 + hw - (hw * (i - 0.5)) / n)} ${f(yb - 2)}L${f(40 + hw - (hw * i) / n)} ${f(yb)}`;
		return path(left + "Z", a) + path(right + "Z", b);
	};
	const cone = (x: number, y: number) => line(x, y - 2, x, y, "#5a3a22", 0.7) + ell(x, y + 3, 1.5, 3.4, "#8a5a34");
	if (stage === "sprout") return line(40, 87, 40, 82, BARK, 2) + tier(64, 76, 6) + tier(70, 84, 8);
	if (stage === "leafy") return trunk(40, 40, 80, 4, 3) + tier(54, 70, 11) + tier(44, 60, 8.5) + tier(36, 50, 6) + tier(32, 41, 3.5);
	let s = trunk(40, 40, 78, 6, 4) + tier(56, 82, 22) + tier(42, 68, 18) + tier(30, 55, 14) + tier(19, 42, 10) + tier(10, 30, 6.5) + tier(5, 18, 3.5);
	return s + cone(26, 70) + cone(53, 66) + cone(33, 54) + cone(48, 42) + cone(36, 30);
}

function cypress(stage: GrowingStage): string {
	const a = "#2f5f3b";
	const b = "#447a4b";
	const c = "#5a9158";
	const flame = (top: number, bot: number, hw: number) => {
		const h = bot - top;
		const shape = (k: number, fill: string, dx = 0) =>
			path(
				`M${f(40 + dx)} ${f(top + h * (1 - k))}C${f(40 + dx + hw * k * 0.45)} ${f(top + h * (1 - k) + h * k * 0.18)} ${f(40 + dx + hw * k)} ${f(top + h * (1 - k) + h * k * 0.5)} ${f(40 + dx + hw * k * 0.85)} ${f(bot - h * k * 0.12)}C${f(40 + dx + hw * k * 0.6)} ${f(bot)} ${f(40 + dx - hw * k * 0.6)} ${f(bot)} ${f(40 + dx - hw * k * 0.85)} ${f(bot - h * k * 0.12)}C${f(40 + dx - hw * k)} ${f(top + h * (1 - k) + h * k * 0.5)} ${f(40 + dx - hw * k * 0.45)} ${f(top + h * (1 - k) + h * k * 0.18)} ${f(40 + dx)} ${f(top + h * (1 - k))}Z`,
				fill,
			);
		return shape(1, a) + shape(0.82, b, 1.5) + shape(0.45, c, 2.2);
	};
	if (stage === "sprout") return line(40, 87, 40, 82, BARK, 2) + flame(64, 84, 5);
	if (stage === "leafy") return line(40, 87, 40, 80, BARK, 3) + flame(36, 82, 8);
	const cone = (x: number, y: number) => circle(x, y, 1.6, "#8b7b5b") + circle(x - 0.5, y - 0.5, 0.5, "#b5a582");
	return line(40, 87, 40, 80, BARK, 4) + flame(5, 82, 11) + cone(36, 48) + cone(45, 58) + cone(42, 36) + cone(34, 66) + cone(46, 72);
}

const WILLOW = ["#7ea845", "#9fc155", "#bcd572"] as const;

function weepingWillow(stage: GrowingStage): string {
	const strands = (x0: number, x1: number, step: number, yTop: (x: number) => number, yEnd: (x: number) => number) => {
		let s = "";
		let i = 0;
		for (let x = x0; x <= x1; x += step, i++) {
			const y0 = yTop(x);
			const y1 = yEnd(x) - (i % 3) * 2.5;
			const dx = x < 40 ? -1.5 : 1.5;
			s += `<path d="M${f(x)} ${f(y0)}Q${f(x + dx)} ${f((y0 + y1) / 2)} ${f(x + dx * 0.4)} ${f(y1)}" stroke="${WILLOW[i % 3]}" stroke-width="1.8" stroke-linecap="round" fill="none"/>`;
		}
		return s;
	};
	if (stage === "sprout")
		return line(40, 87, 40, 68, BARK, 1.8) + [-150, -120, -60, -30].map((a, i) => stem([[40, 69], [40 + Math.cos((a * Math.PI) / 180) * 6, 69 + Math.sin((a * Math.PI) / 180) * 6], [40 + (i < 2 ? -8 : 8), 70], [40 + (i < 2 ? -9 - i : 9 + (3 - i)), 80]], WILLOW[i % 3], 1.5)).join("");
	if (stage === "leafy")
		return (
			trunk(40, 41, 52, 5, 3) +
			ell(40, 50, 15, 9, WILLOW[0]) +
			ell(40, 47, 10, 6, WILLOW[1]) +
			strands(26, 54, 3.5, (x) => 50 - Math.sqrt(Math.max(0, 1 - ((x - 40) / 16) ** 2)) * 7, (x) => 76 - Math.abs(x - 40) * 0.2)
		);
	let s = trunk(40, 41, 38, 9, 4) + stem([[41, 50], [34, 40], [26, 32], [18, 34]], BARK, 2.4) + stem([[41, 46], [48, 36], [56, 30], [62, 32]], BARK, 2.4);
	s += ell(40, 32, 30, 16, WILLOW[0]) + ell(38, 27, 22, 12, WILLOW[1]) + ell(36, 22, 12, 6, WILLOW[2]);
	return s + strands(12, 68, 3.2, (x) => 32 - Math.sqrt(Math.max(0, 1 - ((x - 40) / 31) ** 2)) * 12, (x) => 80 - Math.abs(x - 40) * 0.15);
}

function baobab(stage: GrowingStage): string {
	const bk = "#a68a72";
	const bd = "#8a6f5a";
	const leaves = (x: number, y: number, r: number) => petals(x, y, 5, r * 0.6, r * 0.55, r * 0.25, GREEN.leaf, -90) + circle(x, y, r * 0.25, GREEN.dark);
	if (stage === "sprout") return path("M37 87.5Q36 80 39 75L41 75Q44 80 43 87.5Z", bk) + line(40, 76, 40, 70, bd, 1.4) + leaves(40, 68, 9);
	if (stage === "leafy")
		return (
			path("M31 87.5Q29 74 35 64Q37 58 37 52L43 52Q43 58 45 64Q51 74 49 87.5Z", bk) +
			line(38, 54, 30, 44, bk, 2.6) +
			line(40, 53, 40, 42, bk, 2.6) +
			line(42, 54, 50, 45, bk, 2.6) +
			leaves(29, 41, 10) +
			leaves(40, 39, 10) +
			leaves(51, 42, 10)
		);
	let s = path("M24 87.5Q21 66 31 54Q35 48 35 40L45 40Q45 48 49 54Q59 66 56 87.5Z", bk);
	s += [32, 38, 44, 50].map((x) => line(x, 84, x + (x - 40) * 0.12, 60, bd, 1)).join("");
	s += stem([[36, 42], [30, 36], [22, 34], [14, 30]], bk, 3.6) + stem([[39, 41], [36, 32], [32, 26], [30, 20]], bk, 3.2) + stem([[42, 41], [46, 32], [50, 26], [52, 20]], bk, 3.2) + stem([[44, 42], [52, 36], [60, 34], [66, 30]], bk, 3.6);
	s += leaves(15, 29, 9.5) + leaves(29, 19, 10) + leaves(51, 19, 10) + leaves(65, 29, 9.5) + leaves(40, 30, 8);
	const pod = (x: number, y: number) => line(x, y, x, y + 4, bd, 0.7) + ell(x, y + 8, 2.2, 4.4, "#b8a26a");
	const flower = (x: number, y: number) => line(x, y, x, y + 3, bd, 0.7) + petals(x, y + 5, 5, 2, 2, 1.4, "#f4efe2") + circle(x, y + 5, 1, "#d8b04a");
	return s + pod(20, 34) + pod(60, 34) + pod(34, 26) + flower(46, 26) + flower(26, 36);
}

const GINKGO_G = ["#5e9e44", "#7fb850"] as const;
const GINKGO_Y = ["#d49a1e", "#e6b72e", "#f2d35a"] as const;

function ginkgo(stage: GrowingStage): string {
	const outward = (x: number, y: number, cx: number, cy: number) => (Math.atan2(y - cy, x - cx) * 180) / Math.PI + 90;
	if (stage === "sprout") return sapling(16, (x, y) => fan(x, y + 2, 7, -45, GINKGO_G[1]) + fan(x, y + 2, 7, 45, GINKGO_G[0]) + fan(x, y, 6, 0, GINKGO_G[1]));
	if (stage === "leafy") {
		let s = trunk(40, 40, 40, 4.5, 2) + line(40, 70, 30, 60, BARK, 1.6) + line(40, 62, 50, 52, BARK, 1.6) + line(40, 54, 32, 46, BARK, 1.6);
		for (const [x, y, r] of [[30, 60, -40], [27, 57, -70], [50, 52, 40], [53, 50, 70], [32, 46, -30], [29, 44, -60], [40, 40, 0], [44, 44, 30], [36, 42, -15]] as const) s += fan(x, y, 6.5, r, (x + y) % 2 ? GINKGO_G[1] : GINKGO_G[0]);
		return s;
	}
	let s = trunk(40, 40, 30, 7, 3) + line(40, 66, 28, 56, BARK, 2.2) + line(40, 60, 52, 50, BARK, 2.2);
	s += ell(40, 38, 19, 25, GINKGO_Y[0]) + ell(29, 54, 9, 7, GINKGO_Y[0]) + ell(51, 50, 9, 7, GINKGO_Y[0]);
	const ink = new Ink();
	scatter(40, 38, 19, 25, 40).forEach(([x, y], i) => ink.add(i % 3 ? GINKGO_Y[1] : GINKGO_Y[2], fanD(x, y, 5.4, outward(x, y, 40, 46))));
	for (const [x, y] of [[24, 54], [30, 58], [56, 50], [50, 54]] as const) ink.add(GINKGO_Y[2], fanD(x, y, 5, outward(x, y, 40, 56)));
	s += ink;
	return s + fan(18, 86, 3.6, -100, GINKGO_Y[2]) + fan(62, 85, 3.6, 110, GINKGO_Y[1]) + fan(68, 87, 3.2, 80, GINKGO_Y[2]);
}

function magnolia(stage: GrowingStage): string {
	const mb = "#6e5a50";
	const pink = "#d9779c";
	const pale = "#f6d7e3";
	const flowers = (list: readonly (readonly [number, number, number])[]) => {
		const ink = new Ink();
		for (const [x, y, s] of list) ink.add(pink, lensD(x, y, -128, s, s * 0.38) + lensD(x, y, -52, s, s * 0.38));
		for (const [x, y, s] of list) ink.add(pale, lensD(x, y, -90, s * 1.1, s * 0.4)).add("#e9a3bf", lensD(x, y, -104, s * 0.85, s * 0.28));
		return ink.toString();
	};
	const flower = (x: number, y: number, s: number) => flowers([[x, y, s]]);
	if (stage === "sprout") return sapling(17, (x, y) => leaf(x, y + 3, -155, 10, 4.4) + leaf(x, y + 3, -25, 10, 4.4) + flower(x, y + 1, 6));
	if (stage === "leafy")
		return (
			trunk(40, 40, 58, 4, 2.5, mb) +
			stem([[40, 72], [34, 66], [30, 60], [28, 54]], mb, 2) +
			stem([[40, 68], [46, 62], [50, 56], [52, 50]], mb, 2) +
			leaf(28, 56, -150, 11, 4.6) +
			leaf(28, 56, -100, 10, 4.2, { fill: GREEN.light }) +
			leaf(52, 52, -30, 11, 4.6) +
			leaf(52, 52, -80, 10, 4.2, { fill: GREEN.light }) +
			leaf(40, 60, -110, 10, 4.2) +
			leaf(40, 60, -70, 10, 4.2, { fill: GREEN.light }) +
			flower(40, 50, 8)
		);
	let s = trunk(40, 40, 62, 7, 4, mb);
	const br: [number, number, number, number, number, number, number, number][] = [
		[40, 68, 30, 60, 20, 54, 14, 46],
		[40, 66, 34, 54, 28, 42, 26, 32],
		[40, 64, 40, 50, 38, 36, 40, 24],
		[40, 66, 48, 56, 54, 44, 56, 34],
		[40, 68, 52, 62, 62, 56, 67, 48],
	];
	for (const b of br) s += stem([[b[0], b[1]], [b[2], b[3]], [b[4], b[5]], [b[6], b[7]]], mb, 2.4);
	s += leaf(24, 56, -170, 8, 3.2) + leaf(56, 54, -10, 8, 3.2) + leaf(34, 46, 170, 7, 3) + leaf(46, 44, 10, 7, 3) + leaf(30, 37, -150, 7, 3, { fill: GREEN.light });
	return s + flowers([[14, 47, 9], [26, 33, 10], [40, 25, 11], [56, 35, 10], [67, 49, 9], [30, 56, 7], [50, 52, 7], [42, 43, 7]]);
}

function dogwood(stage: GrowingStage): string {
	const db = "#6a4e3c";
	const g = ["#4e8a40", "#66a24e", "#82b85e"] as const;
	const bracts = (list: readonly (readonly [number, number])[], r: number) => {
		const ink = new Ink();
		for (const [x, y] of list) for (let k = 0; k < 4; k++) ink.add("#f6efe7", lensD(x, y, 45 + 90 * k, r * 1.2, r * 0.5, 0));
		for (const [x, y] of list) ink.add("#9bb54a", `M${f(x - r * 0.3)} ${f(y)}a${f(r * 0.3)} ${f(r * 0.3)} 0 1 0 ${f(r * 0.6)} 0a${f(r * 0.3)} ${f(r * 0.3)} 0 1 0 ${f(-r * 0.6)} 0Z`);
		return ink.toString();
	};
	const bract = (x: number, y: number, r: number) => bracts([[x, y]], r);
	const pad = (x: number, y: number, rx: number, ry: number) => ell(x, y, rx, ry, g[0]) + ell(x, y - ry * 0.35, rx * 0.85, ry * 0.6, g[1]);
	if (stage === "sprout") return sapling(16, (x, y) => leaf(x, y + 2, -160, 10, 4.2, { fill: g[1] }) + leaf(x, y + 2, -20, 10, 4.2, { fill: g[1] }) + bract(x, y - 1, 5.5));
	if (stage === "leafy") return trunk(40, 40, 50, 4, 2.5, db) + line(40, 70, 26, 66, db, 1.8) + line(40, 64, 54, 59, db, 1.8) + pad(28, 63, 12, 5) + pad(52, 56, 12, 5) + pad(40, 47, 10, 5) + bracts([[30, 60], [50, 53], [40, 44]], 4.6);
	let s = trunk(40, 40, 30, 7, 3, db) + line(40, 74, 16, 68, db, 2.6) + line(40, 72, 64, 66, db, 2.6) + line(40, 58, 22, 52, db, 2.2) + line(40, 56, 58, 50, db, 2.2) + line(40, 42, 30, 36, db, 1.8);
	s += pad(18, 64, 14, 6) + pad(62, 62, 14, 6) + pad(40, 64, 10, 5) + pad(24, 48, 13, 6) + pad(56, 46, 13, 6) + pad(40, 34, 14, 6.5) + pad(40, 22, 8, 4.5);
	return s + bracts([[12, 61], [22, 62], [58, 59], [68, 60], [40, 61], [20, 45], [30, 46], [52, 43], [60, 44], [34, 31], [46, 31], [40, 19]], 5.4);
}

const JAC = ["#7563c4", "#9584dc", "#b3a5ec"] as const;

function jacaranda(stage: GrowingStage): string {
	const frond = (x: number, y: number, deg: number, len: number, bend: number, leaflet: number) => pinnate(x, y, deg, len, bend, leaflet, GREEN.dark, GREEN.light, GREEN.leaf);
	if (stage === "sprout") return sapling(14, (x, y) => frond(x, y, -135, 11, -10, 4) + frond(x, y, -45, 11, 10, 4) + frond(x, y, -90, 12, 0, 4));
	if (stage === "leafy")
		return trunk(40, 40, 58, 4, 2.5) + line(40, 64, 30, 54, BARK, 1.8) + line(40, 62, 50, 52, BARK, 1.8) + frond(30, 55, -160, 16, -20, 5) + frond(30, 55, -110, 16, -10, 5) + frond(50, 53, -20, 16, 20, 5) + frond(40, 58, -90, 18, 0, 5);
	let s = trunk(40, 40, 64, 7, 4) + stem([[40, 66], [34, 56], [24, 48], [16, 38]], BARK, 2.8) + stem([[40, 64], [38, 52], [36, 42], [32, 30]], BARK, 2.4) + stem([[40, 64], [46, 52], [52, 42], [54, 30]], BARK, 2.4) + stem([[40, 66], [48, 58], [58, 48], [66, 38]], BARK, 2.8);
	s += blobs([
		[14, 34, 9, JAC[0]],
		[66, 33, 9, JAC[0]],
		[27, 28, 11, JAC[0]],
		[53, 27, 11, JAC[0]],
		[40, 24, 11, JAC[0]],
		[20, 30, 7, JAC[1]],
		[60, 28, 7, JAC[1]],
		[33, 22, 8, JAC[1]],
		[48, 21, 8, JAC[1]],
		[40, 31, 7, JAC[1]],
		[28, 21, 4, JAC[2]],
		[44, 16, 5, JAC[2]],
		[58, 22, 4, JAC[2]],
		[16, 28, 3.5, JAC[2]],
	]);
	s += leaf(10, 40, 160, 6, 2, { rib: false }) + leaf(70, 39, 20, 6, 2, { rib: false }) + leaf(24, 38, 150, 5, 1.8, { rib: false, fill: GREEN.light }) + leaf(56, 37, 30, 5, 1.8, { rib: false, fill: GREEN.light });
	return s + ([[16, 80, 20], [24, 86, -30], [58, 84, 40], [66, 79, -10], [12, 84, 70], [52, 87, 0]] as const).map(([x, y, r]) => ell(x, y, 1.6, 1, JAC[1], r)).join("");
}

function bonsaiJuniper(stage: GrowingStage): string {
	const bb = "#7a5a44";
	const jin = "#d6cdbf";
	const pad = (x: number, y: number, rx: number, ry: number) => ell(x, y, rx, ry, "#356149") + ell(x - rx * 0.1, y - ry * 0.35, rx * 0.82, ry * 0.62, "#4b7f5a") + ell(x - rx * 0.25, y - ry * 0.55, rx * 0.45, ry * 0.35, "#679a6c");
	if (stage === "sprout") return stem([[40, 87], [44, 82], [36, 78], [39, 72]], bb, 2.4) + pad(40, 71, 8, 3.4);
	if (stage === "leafy") return stem([[40, 87], [50, 78], [28, 70], [38, 56]], bb, 4) + stem([[36, 70], [30, 68], [26, 66], [24, 64]], bb, 2) + pad(24, 63, 10, 4) + pad(48, 64, 9, 3.6) + line(43, 66, 47, 64, bb, 1.8) + pad(39, 54, 11, 4.4);
	let s = stem([[40, 88], [58, 76], [18, 66], [40, 44]], bb, 7) + stem([[41, 75], [45, 71], [47, 66], [45, 60]], jin, 1.6);
	s += stem([[30, 64], [24, 62], [18, 60], [14, 58]], bb, 3) + stem([[38, 50], [46, 48], [54, 46], [60, 44]], bb, 3) + stem([[40, 44], [36, 38], [34, 34], [32, 30]], bb, 2.4);
	s += pad(16, 57, 13, 5) + pad(60, 43, 14, 5.5) + pad(34, 30, 15, 6) + pad(38, 50, 9, 3.6);
	return s + ([[12, 58], [20, 56], [56, 44], [64, 42], [30, 31], [38, 28], [42, 31]] as const).map(([x, y]) => circle(x, y, 1.3, "#7a95c4")).join("");
}

function figTree(stage: GrowingStage): string {
	const fb = "#9a9088";
	const fg = ["#4f8f45", "#6aa553", "#86bc66"] as const;
	const figLeaf = (x: number, y: number, r: number, rot: number, fill: string) => {
		let s = "";
		for (const [a, k] of [[-90, 1], [-145, 0.85], [-35, 0.85], [160, 0.55], [20, 0.55]] as const) {
			const rad = (a * Math.PI) / 180;
			s += ell(Math.cos(rad) * r * 0.5 * k, Math.sin(rad) * r * 0.5 * k, r * 0.5 * k, r * 0.3 * k, fill, a);
		}
		s += circle(0, 0, r * 0.32, fill) + `<path d="M0 ${f(r * 0.2)}L0 ${f(-r * 0.8)}" stroke="${GREEN.dark}" stroke-width=".7" opacity=".5"/>`;
		return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(rot)})">${s}</g>`;
	};
	const fig = (x: number, y: number, fill = "#7b4675") => path(`M${f(x)} ${f(y - 3.6)}Q${f(x + 0.6)} ${f(y - 1.6)} ${f(x + 2.8)} ${f(y + 0.6)}Q${f(x + 3.4)} ${f(y + 3.8)} ${f(x)} ${f(y + 3.8)}Q${f(x - 3.4)} ${f(y + 3.8)} ${f(x - 2.8)} ${f(y + 0.6)}Q${f(x - 0.6)} ${f(y - 1.6)} ${f(x)} ${f(y - 3.6)}Z`, fill) + circle(x - 1, y + 1.2, 0.7, "#fff", 0.4);
	if (stage === "sprout") return sapling(15, (x, y) => figLeaf(x - 3, y + 3, 9, -40, fg[1]) + figLeaf(x + 4, y + 2, 9, 35, fg[0]), fb, 1.8);
	if (stage === "leafy")
		return (
			stem([[40, 87], [38, 76], [32, 68], [28, 60]], fb, 2.6) +
			stem([[40, 87], [42, 76], [48, 66], [52, 58]], fb, 2.6) +
			figLeaf(28, 61, 14, -30, fg[0]) +
			figLeaf(52, 59, 14, 30, fg[1]) +
			figLeaf(40, 62, 12, 0, fg[2]) +
			fig(46, 66, "#8fae54")
		);
	let s = stem([[40, 88], [36, 72], [24, 62], [16, 50]], fb, 4) + stem([[40, 88], [42, 70], [38, 52], [40, 36]], fb, 4) + stem([[40, 88], [46, 72], [56, 62], [64, 48]], fb, 4);
	s += figLeaf(24, 62, 13, -70, fg[1]) + figLeaf(56, 60, 13, 70, fg[1]);
	s += figLeaf(15, 50, 16, -45, fg[0]) + figLeaf(65, 48, 16, 45, fg[0]) + figLeaf(27, 42, 15, -20, fg[2]) + figLeaf(53, 40, 15, 20, fg[2]) + figLeaf(40, 36, 17, 0, fg[1]);
	return s + fig(20, 56) + fig(31, 50) + fig(49, 50) + fig(60, 56) + fig(40, 44) + fig(26, 66, "#8fae54");
}

function peachTree(stage: GrowingStage): string {
	const pg = ["#4a8742", "#62a050", "#7fb862"] as const;
	const peach = (x: number, y: number) => circle(x, y, 3.8, "#f6ad73") + circle(x + 1, y + 0.8, 2.4, "#e8684f", 0.85) + `<path d="M${f(x - 0.6)} ${f(y - 3.6)}Q${f(x - 1.4)} ${f(y)} ${f(x - 0.4)} ${f(y + 3.6)}" stroke="#c9563f" stroke-width=".6" fill="none" opacity=".7"/>` + leaf(x, y - 3.4, -50, 5, 1.3, { fill: pg[1], shape: 1, rib: false });
	const droop = (x: number, y: number, n: number, len: number, left: boolean) => {
		let s = "";
		for (let i = 0; i < n; i++) s += leaf(x + (left ? -i * 2.4 : i * 2.4), y - i * 1.2, left ? 120 + i * 10 : 60 - i * 10, len, len * 0.2, { fill: pg[(i % 2) + 1], shape: 1, rib: false });
		return s;
	};
	if (stage === "sprout") return sapling(16, (x, y) => leaf(x, y + 2, -165, 12, 2.6, { fill: pg[1], shape: 1 }) + leaf(x, y + 2, -15, 12, 2.6, { fill: pg[1], shape: 1 }) + leaf(x, y, -100, 9, 2.2, { fill: pg[2], shape: 1 }) + leaf(x, y, -75, 9, 2.2, { fill: pg[1], shape: 1 }));
	if (stage === "leafy")
		return (
			trunk(40, 40, 70, 5, 3.5) +
			line(40, 72, 29, 56, BARK, 2.2) +
			line(40, 72, 51, 56, BARK, 2.2) +
			ell(29, 53, 9, 6, pg[0]) +
			ell(51, 53, 9, 6, pg[0]) +
			ell(28, 51, 6, 4, pg[1]) +
			ell(50, 51, 6, 4, pg[1]) +
			droop(22, 56, 3, 9, true) +
			droop(58, 56, 3, 9, false) +
			blossom(30, 48, 3.6, "#f4a3b8", "#c2466f") +
			blossom(51, 47, 3.6, "#f4a3b8", "#c2466f")
		);
	let s = trunk(40, 40, 68, 8, 5) + stem([[40, 70], [34, 60], [24, 50], [18, 42]], BARK, 3.2) + stem([[40, 70], [40, 56], [40, 42], [40, 32]], BARK, 2.8) + stem([[40, 70], [46, 60], [56, 50], [62, 42]], BARK, 3.2);
	s += ell(18, 40, 14, 9, pg[0]) + ell(62, 40, 14, 9, pg[0]) + ell(40, 29, 15, 10, pg[0]);
	s += ell(16, 37, 10, 6, pg[1]) + ell(60, 37, 10, 6, pg[1]) + ell(38, 26, 11, 6.5, pg[1]) + ell(14, 35, 4, 2.5, pg[2]) + ell(35, 23, 5, 2.6, pg[2]) + ell(57, 34, 4, 2.5, pg[2]);
	s += droop(10, 45, 3, 9, true) + droop(70, 45, 3, 9, false) + droop(27, 35, 3, 10, true) + droop(53, 35, 3, 10, false);
	return s + peach(14, 45) + peach(24, 43) + peach(56, 43) + peach(66, 45) + peach(34, 33) + peach(46, 32) + peach(40, 22);
}

function pomegranateTree(stage: GrowingStage): string {
	const pb = "#7e5c44";
	const pg = ["#4f8a3e", "#6aa04c"] as const;
	const red = "#c8383a";
	const flower = (x: number, y: number) => path(`M${f(x - 1.4)} ${f(y + 2.6)}L${f(x - 2.8)} ${f(y - 2)}L${f(x - 1)} ${f(y - 0.6)}L${f(x)} ${f(y - 2.8)}L${f(x + 1)} ${f(y - 0.6)}L${f(x + 2.8)} ${f(y - 2)}L${f(x + 1.4)} ${f(y + 2.6)}Z`, "#ef5a32") + ell(x, y + 2.6, 1.4, 1, "#b8452e");
	const pom = (x: number, y: number) => circle(x, y, 4.2, red) + path(`M${f(x - 1.6)} ${f(y - 3.4)}L${f(x - 1.8)} ${f(y - 6)}L${f(x - 0.6)} ${f(y - 4.4)}L${f(x)} ${f(y - 6.2)}L${f(x + 0.6)} ${f(y - 4.4)}L${f(x + 1.8)} ${f(y - 6)}L${f(x + 1.6)} ${f(y - 3.4)}Z`, "#9e2a2e") + circle(x - 1.4, y - 1.2, 1.1, "#fff", 0.45);
	const sprig = (x: number, y: number, ang: number, n: number) => {
		const ink = new Ink();
		for (let i = 0; i < n; i++) ink.add(pg[i % 2] ?? pg[0], lensD(x, y, ang - 50 + (100 * i) / (n - 1), 6, 1.6));
		return ink.toString();
	};
	if (stage === "sprout") return sapling(15, (x, y) => sprig(x, y + 2, -90, 5) + sprig(x, y + 7, -90, 4), pb, 1.4);
	if (stage === "leafy")
		return (
			stem([[40, 87], [37, 76], [32, 66], [30, 54]], pb, 1.8) +
			stem([[40, 87], [43, 76], [48, 66], [50, 54]], pb, 1.8) +
			stem([[40, 87], [40, 76], [40, 60], [40, 48]], pb, 1.8) +
			sprig(30, 56, -110, 6) +
			sprig(50, 56, -70, 6) +
			sprig(40, 50, -90, 6) +
			sprig(34, 68, -150, 4) +
			sprig(46, 66, -30, 4) +
			flower(32, 52) +
			flower(48, 51)
		);
	let s = stem([[40, 88], [34, 70], [24, 56], [18, 40]], pb, 2.6) + stem([[40, 88], [42, 66], [38, 44], [40, 22]], pb, 2.6) + stem([[40, 88], [46, 70], [56, 56], [62, 40]], pb, 2.6);
	s += blobs([
		[20, 46, 9, pg[0]],
		[60, 46, 9, pg[0]],
		[40, 30, 11, pg[0]],
		[30, 40, 8, pg[1]],
		[50, 38, 8, pg[1]],
	]);
	s += sprig(18, 40, -120, 7) + sprig(62, 40, -60, 7) + sprig(40, 22, -90, 7) + sprig(12, 50, -170, 5) + sprig(68, 50, -10, 5) + sprig(30, 32, -130, 5) + sprig(50, 30, -50, 5);
	return s + pom(22, 52) + pom(56, 53) + pom(38, 41) + pom(48, 30) + flower(28, 30) + flower(62, 36) + flower(17, 40);
}

function acacia(stage: GrowingStage): string {
	const ab = "#6e5440";
	const frond = (x: number, y: number, deg: number, len: number, bend: number, leaflet: number) => pinnate(x, y, deg, len, bend, leaflet, "#5d6b2e", "#a3b55a", "#87993f");
	const puff = (x: number, y: number) => circle(x, y, 1.6, "#f0c53a");
	if (stage === "sprout") return sapling(14, (x, y) => frond(x, y, -140, 10, -15, 3.5) + frond(x, y, -40, 10, 15, 3.5) + line(x, y + 6, x - 2.5, y + 4.5, "#d8cfb8", 0.8), ab, 1.4);
	if (stage === "leafy") return stem([[40, 87], [41, 72], [38, 60], [40, 50]], ab, 2.6) + line(40, 56, 30, 50, ab, 1.6) + line(40, 54, 51, 49, ab, 1.6) + ell(40, 48, 19, 4.6, "#73893a") + ell(39, 46, 15, 3.6, "#93a84d") + puff(30, 45) + puff(46, 44);
	let s = stem([[38, 88], [40, 70], [44, 58], [40, 46]], ab, 4.5) + stem([[41, 50], [34, 40], [24, 32], [14, 26]], ab, 2.6) + stem([[41, 50], [42, 40], [36, 32], [32, 24]], ab, 2.2) + stem([[42, 48], [50, 38], [56, 32], [62, 26]], ab, 2.6) + stem([[44, 56], [52, 50], [60, 44], [68, 38]], ab, 2);
	s += ell(40, 25, 36, 7, "#647a32") + ell(36, 22, 31, 5.5, "#7f9640") + ell(32, 19, 18, 3.8, "#9cb058") + ell(68, 36, 8, 3, "#647a32") + ell(67, 34.5, 6, 2, "#7f9640");
	return s + ([[12, 21], [22, 18], [32, 15], [44, 16], [56, 17], [64, 20], [26, 22], [50, 21], [68, 33], [40, 19]] as const).map(([x, y]) => puff(x, y)).join("");
}

function redwood(stage: GrowingStage): string {
	const rb = "#a4553c";
	const rg = ["#2f5a36", "#43733f", "#5a8a50"] as const;
	const tier = (y: number, w: number) => leaf(40, y, 162, w, w * 0.22 + 1.6, { fill: rg[0], rib: false }) + leaf(40, y, 18, w, w * 0.22 + 1.6, { fill: rg[1], rib: false }) + leaf(40, y - 1, 168, w * 0.6, w * 0.15 + 1, { fill: rg[2], rib: false });
	if (stage === "sprout") return line(40, 87, 40, 66, rb, 1.8) + tier(80, 7) + tier(75, 6) + tier(70, 4.5) + tier(66, 3);
	if (stage === "leafy") {
		let s = trunk(40, 40, 32, 4.5, 1.5, rb);
		for (let i = 0; i < 8; i++) s += tier(70 - i * 5, 13 - i * 1.3);
		return s;
	}
	let s = trunk(40, 40, 6, 11, 2.5, rb) + [36, 40, 44].map((x) => line(x, 85, x + (x - 40) * 0.1, 56, "#8a4430", 0.9)).join("");
	for (let i = 0; i < 11; i++) s += tier(56 - i * 4.6, 17 - i * 1.3);
	return s + path("M40 4L42 11L38 11Z", rg[1]);
}

function aspen(stage: GrowingStage): string {
	const ab = "#e3ddd0";
	const am = "#4a443d";
	const gold = ["#d99a22", "#ebb92e", "#f5d462"] as const;
	const grn = ["#5e9e44", "#7fb850", "#9fcc6e"] as const;
	const coins = (cx: number, cy: number, rx: number, ry: number, n: number, pal: readonly [string, string, string], r: number) => scatter(cx, cy, rx, ry, n).map(([x, y], i) => circle(x, y, r, i % 3 === 0 ? pal[0] : i % 3 === 1 ? pal[1] : pal[2])).join("");
	const eyes = (x: number, ys: number[]) => ys.map((y) => ell(x, y, 0.9, 0.6, am)).join("");
	if (stage === "sprout") return sapling(19, (x, y) => leaf(x, y + 3, -150, 7, 3.4, { fill: grn[1], shape: 2 }) + leaf(x, y + 3, -30, 7, 3.4, { fill: grn[1], shape: 2 }) + leaf(x, y, -90, 6, 3, { fill: grn[2], shape: 2 }), ab, 1.8);
	if (stage === "leafy") return trunk(36, 37, 44, 3.2, 1.8, ab) + trunk(45, 46, 50, 2.6, 1.5, ab) + eyes(36.5, [78, 68, 58]) + eyes(45.5, [80, 70, 60]) + ell(41, 46, 12, 12, grn[0]) + coins(41, 46, 12, 12, 26, grn, 2.4);
	let s = trunk(30, 29, 18, 4.4, 2, ab) + trunk(42, 42, 10, 5, 2, ab) + trunk(54, 56, 22, 4, 1.8, ab);
	s += eyes(29.7, [80, 70, 60, 50]) + eyes(42, [82, 72, 62, 52]) + eyes(54.6, [78, 68, 58, 48]);
	s += ell(29, 34, 12, 18, gold[0]) + ell(42, 28, 13, 20, gold[0]) + ell(56, 37, 11, 16, gold[0]);
	s += coins(29, 34, 12, 18, 20, gold, 3) + coins(42, 28, 13, 20, 24, gold, 3) + coins(56, 37, 11, 16, 18, gold, 3);
	return s + circle(18, 84, 1.8, gold[1]) + circle(62, 86, 1.8, gold[2]) + circle(66, 82, 1.6, gold[0]);
}

function plumTree(stage: GrowingStage): string {
	const pl = "#6a3d8f";
	const pg = ["#3f7a3d", "#559448", "#72ad5c"] as const;
	const plum = (x: number, y: number) => line(x, y - 4.6, x + 0.5, y - 2.6, "#4a3324", 0.7) + ell(x, y, 2.7, 3.3, pl) + ell(x - 0.9, y - 0.9, 0.7, 1.2, "#b79ad8");
	const cluster = (x: number, y: number) => plum(x - 2.6, y + 4.4) + plum(x + 2.6, y + 5);
	if (stage === "sprout") return sapling(17, (x, y) => leaf(x, y + 2, -150, 10, 4, { shape: 1 }) + leaf(x, y + 2, -30, 10, 4, { shape: 1 }) + blossom(x, y - 2, 5, "#f7f0f2", "#d6a33e"));
	if (stage === "leafy")
		return (
			trunk(40, 40, 58, 4.5, 3) +
			line(40, 66, 30, 58, BARK, 2) +
			line(40, 64, 50, 56, BARK, 2) +
			blobs([
				[29, 54, 7, pg[0]],
				[51, 53, 7, pg[0]],
				[40, 48, 9, pg[1]],
				[34, 46, 4.5, pg[2]],
			]) +
			blossom(28, 50, 3.6, "#f7f0f2", "#d6a33e") +
			blossom(50, 48, 3.6, "#f7f0f2", "#d6a33e") +
			plum(42, 60)
		);
	let s = trunk(40, 40, 54, 8, 4.5) + stem([[40, 66], [32, 58], [22, 52], [14, 48]], BARK, 2.8) + stem([[40, 62], [48, 56], [58, 50], [66, 46]], BARK, 2.8);
	s += blobs([
		[12, 44, 8, pg[0]],
		[68, 42, 8, pg[0]],
		[22, 36, 11, pg[0]],
		[58, 34, 11, pg[0]],
		[40, 30, 14, pg[0]],
		[40, 44, 10, pg[0]],
		[24, 32, 7, pg[1]],
		[54, 29, 7, pg[1]],
		[39, 25, 9, pg[1]],
		[34, 22, 4.5, pg[2]],
		[20, 30, 3.5, pg[2]],
	]);
	return s + cluster(12, 49) + cluster(26, 44) + cluster(54, 43) + cluster(68, 47) + cluster(40, 50) + plum(38, 34) + plum(56, 30) + plum(24, 28);
}

export const SPECIES: Species[] = [
	{ id: "oak", name: "Oak", draw: oak },
	{ id: "japanese-maple", name: "Japanese maple", draw: japaneseMaple },
	{ id: "birch", name: "Birch", draw: birch },
	{ id: "cherry-blossom", name: "Cherry blossom", draw: cherryBlossom },
	{ id: "apple-tree", name: "Apple tree", draw: appleTree },
	{ id: "orange-tree", name: "Orange tree", draw: orangeTree },
	{ id: "lemon-tree", name: "Lemon tree", draw: lemonTree },
	{ id: "olive-tree", name: "Olive tree", draw: oliveTree },
	{ id: "pine", name: "Pine", draw: pine },
	{ id: "spruce", name: "Spruce", draw: spruce },
	{ id: "cypress", name: "Cypress", draw: cypress },
	{ id: "weeping-willow", name: "Weeping willow", draw: weepingWillow },
	{ id: "baobab", name: "Baobab", draw: baobab },
	{ id: "ginkgo", name: "Ginkgo", draw: ginkgo },
	{ id: "magnolia", name: "Magnolia", draw: magnolia },
	{ id: "dogwood", name: "Dogwood", draw: dogwood },
	{ id: "jacaranda", name: "Jacaranda", draw: jacaranda },
	{ id: "bonsai-juniper", name: "Bonsai juniper", draw: bonsaiJuniper },
	{ id: "fig-tree", name: "Fig tree", draw: figTree },
	{ id: "peach-tree", name: "Peach tree", draw: peachTree },
	{ id: "pomegranate-tree", name: "Pomegranate tree", draw: pomegranateTree },
	{ id: "acacia", name: "Acacia", draw: acacia },
	{ id: "redwood", name: "Redwood", draw: redwood },
	{ id: "aspen", name: "Aspen", draw: aspen },
	{ id: "plum-tree", name: "Plum tree", draw: plumTree },
];
