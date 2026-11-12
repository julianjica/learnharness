/**
 * Garden species, family: cacti and succulents (owner design, 2026-11-11).
 * Drawn in the shared kit style; see kit.ts for the cell and the rules.
 */
import { bez, circle, f, type GrowingStage, leaf, type LeafOptions, leafPath, line, petals, type Pt, type Species } from "./kit";

type XY = readonly [number, number];

// ── private helpers ──────────────────────────────────────────────────────

/** Round dots, drawn compactly as one path of zero-length round-capped strokes. */
const dots = (pts: readonly XY[], r: number, color: string): string =>
	pts.length ? `<path d="${pts.map(([x, y]) => `M${f(x)} ${f(y)}h0`).join("")}" stroke="${color}" stroke-width="${f(r * 2)}" stroke-linecap="round"/>` : "";

const g = (x: number, y: number, a: number, inner: string): string =>
	`<g transform="translate(${f(x)} ${f(y)})${a ? ` rotate(${f(a)})` : ""}">${inner}</g>`;

const ell = (x: number, y: number, rx: number, ry: number, fill: string, a = 0): string =>
	`<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(rx)}" ry="${f(ry)}" fill="${fill}"${a ? ` transform="rotate(${f(a)} ${f(x)} ${f(y)})"` : ""}/>`;

const fill = (d: string, c: string): string => `<path d="${d}" fill="${c}"/>`;

const strk = (d: string, c: string, w: number, opacity?: number): string =>
	`<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${opacity === undefined ? "" : ` opacity="${opacity}"`}/>`;

/** n leaves fanned from (x, y) between two angles. */
function fan(x: number, y: number, n: number, from: number, to: number, len: number, w: number, o: LeafOptions): string {
	let s = "";
	for (let i = 0; i < n; i++) s += leaf(x, y, n === 1 ? from : from + ((to - from) * i) / (n - 1), len, w, o);
	return s;
}

/** Hex-packed points inside an ellipse. */
function grid(cx: number, cy: number, rx: number, ry: number, step: number, inset = 0.82): XY[] {
	const out: XY[] = [];
	let row = 0;
	for (let y = cy - ry; y <= cy + ry; y += step * 0.87, row++) {
		for (let x = cx - rx + ((row % 2) * step) / 2; x <= cx + rx; x += step) {
			if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < inset * inset) out.push([x, y]);
		}
	}
	return out;
}

/** Rib lines on a globe, as one path; spine dots along them. */
function meridians(cx: number, cy: number, rx: number, ry: number, n: number, stroke: string, w: number, opacity: number, spine?: string): string {
	let d = "";
	const sp: XY[] = [];
	for (let k = 1; k < n; k++) {
		const off = (-1 + (2 * k) / n) * rx * 1.8;
		d += `M${f(cx)} ${f(cy - ry)}Q${f(cx + off)} ${f(cy)} ${f(cx)} ${f(cy + ry)}`;
		for (const t of [0.22, 0.42, 0.62, 0.82]) sp.push([cx + 2 * t * (1 - t) * off, cy - ry + 2 * ry * t]);
	}
	return strk(d, stroke, w, opacity) + (spine ? dots(sp, 0.65, spine) : "");
}

/** A daisy as one stroked path of spokes. */
function daisy(x: number, y: number, n: number, r: number, color: string, center: string, width = 1.1): string {
	let d = "";
	for (let i = 0; i < n; i++) {
		const a = (i * 2 * Math.PI) / n;
		d += `M${f(x + Math.cos(a) * 1.2)} ${f(y + Math.sin(a) * 1.2)}L${f(x + Math.cos(a) * r)} ${f(y + Math.sin(a) * r)}`;
	}
	return strk(d, color, width) + circle(x, y, r * 0.36, center);
}

/** Points and directions (degrees) along a cubic. */
function along(p: readonly [Pt, Pt, Pt, Pt], n: number): [number, number, number][] {
	const out: [number, number, number][] = [];
	for (let i = 0; i < n; i++) {
		const t = (i + 0.5) / n;
		const [x, y] = bez(p, t);
		const [x2, y2] = bez(p, Math.min(1, t + 0.01));
		const [x0, y0] = bez(p, Math.max(0, t - 0.01));
		out.push([x, y, (Math.atan2(y2 - y0, x2 - x0) * 180) / Math.PI]);
	}
	return out;
}

const cubic = (p: readonly [Pt, Pt, Pt, Pt]): string =>
	`M${f(p[0][0])} ${f(p[0][1])}C${f(p[1][0])} ${f(p[1][1])} ${f(p[2][0])} ${f(p[2][1])} ${f(p[3][0])} ${f(p[3][1])}`;

const mirror = (p: readonly [Pt, Pt, Pt, Pt]): [Pt, Pt, Pt, Pt] => [
	[80 - p[0][0], p[0][1]],
	[80 - p[1][0], p[1][1]],
	[80 - p[2][0], p[2][1]],
	[80 - p[3][0], p[3][1]],
];

const SPINE = "#f2efd8";

// ── 1. Saguaro ───────────────────────────────────────────────────────────

const SAG = "#5a9a58";
const SAGD = "#3d7440";

function sagRibs(x: number, top: number, bottom: number, dxs: number[]): string {
	return strk(dxs.map((dx) => `M${f(x + dx)} ${f(top)}V${f(bottom)}`).join(""), SAGD, 0.8, 0.45);
}

function saguaro(stage: GrowingStage): string {
	if (stage === "sprout") return line(40, 85, 40, 73, SAG, 10) + sagRibs(40, 71, 85, [-2.5, 0, 2.5]) + dots([[36.5, 76], [43.5, 79], [36.5, 82], [43.5, 73]], 0.7, SPINE);
	if (stage === "leafy")
		return (
			strk("M40 70H51V57", SAG, 8) +
			line(40, 85, 40, 49, SAG, 12) +
			sagRibs(40, 45, 86, [-3, 0, 3]) +
			sagRibs(51, 55, 68, [0]) +
			dots([[35, 56], [45, 62], [35, 70], [45, 78], [35, 80], [45, 50]], 0.7, SPINE)
		);
	const flower = (x: number, y: number) => petals(x, y, 6, 2.3, 2.3, 1.4, "#f1ead2") + circle(x, y, 1.3, "#f2c94c");
	return (
		strk("M40 63H27V40", SAG, 9) +
		strk("M40 55H54V31", SAG, 9) +
		line(40, 85, 40, 19, SAG, 13) +
		sagRibs(40, 15, 86, [-3.5, 0, 3.5]) +
		sagRibs(27, 38, 61, [-1.5, 1.5]) +
		sagRibs(54, 29, 53, [-1.5, 1.5]) +
		dots([[34.5, 28], [45.5, 36], [34.5, 46], [45.5, 58], [34.5, 66], [45.5, 76], [34.5, 80], [23.5, 48], [57.5, 40]], 0.7, SPINE) +
		flower(36, 14) +
		flower(44, 14) +
		flower(40, 11.5) +
		flower(27, 36) +
		flower(54, 27)
	);
}

// ── 2. Golden barrel cactus ──────────────────────────────────────────────

const BAR = "#4f8d4c";
const GOLD = "#e8c447";

function barrel(cy: number, rx: number, ry: number, n: number): string {
	return ell(40, cy, rx, ry, BAR) + meridians(40, cy, rx, ry, n, GOLD, 0.8, 0.8, GOLD) + ell(40, cy - ry + 1.4, rx * 0.34, 1.6, "#eedb9a");
}

function goldenBarrel(stage: GrowingStage): string {
	if (stage === "sprout") return barrel(81, 7, 6.5, 4);
	if (stage === "leafy") return barrel(73.5, 14, 13.5, 6);
	const fl = (x: number, y: number) => petals(x, y, 7, 2.1, 2, 1.1, "#f3c531") + circle(x, y, 1, "#d9822b");
	return barrel(65.5, 20, 21.5, 8) + fl(31, 47.5) + fl(49, 47.5) + fl(35.5, 45) + fl(44.5, 45) + fl(40, 44);
}

// ── 3. Prickly pear ──────────────────────────────────────────────────────

const PAD = "#6aa35c";

function pad(x: number, y: number, a: number, rx: number, ry: number): string {
	const AR: XY[] = [[-0.45, -0.4], [0.45, -0.4], [0, 0], [-0.45, 0.4], [0.45, 0.4], [0, -0.75], [0, 0.75]];
	const ar = AR.map(([u, v]) => [u * rx, v * ry] as const);
	return g(x, y, a, ell(0, 0, rx, ry, PAD) + dots(ar, 0.6, "#efe6bf"));
}

const tuna = (x: number, y: number, a: number) => g(x, y, a, ell(0, 0, 2.3, 3.2, "#b8345e") + ell(0, -2.6, 1.2, 0.6, "#8a2446"));

function pricklyPear(stage: GrowingStage): string {
	if (stage === "sprout") return pad(40, 78, 0, 6, 9);
	if (stage === "leafy") return pad(40, 72, 0, 9, 14) + pad(31, 60, -28, 6.5, 10) + pad(50, 58, 26, 6.5, 10);
	const fl = (x: number, y: number) => petals(x, y, 8, 2.6, 2.6, 1.5, "#f2c230") + circle(x, y, 1.3, "#e08a3a");
	return (
		pad(40, 73, 0, 10, 14) +
		pad(29, 56, -30, 8, 12) +
		pad(52, 54, 28, 8, 12) +
		pad(22, 37, -12, 6, 9) +
		pad(58, 34, 14, 6, 9) +
		tuna(17.5, 30, -40) +
		tuna(22.5, 27.5, -5) +
		tuna(57, 25.5, -8) +
		tuna(63, 27.5, 32) +
		fl(65.5, 35) +
		fl(14.5, 38)
	);
}

// ── 4. Bunny ear cactus ──────────────────────────────────────────────────

function bpad(x: number, y: number, a: number, rx: number, ry: number): string {
	return g(x, y, a, ell(0, 0, rx, ry, "#86bb6a") + dots(grid(0, 0, rx, ry, 2.5), 0.55, "#f6e7a2"));
}

function bunnyEar(stage: GrowingStage): string {
	if (stage === "sprout") return bpad(40, 79, 0, 6, 7.5);
	if (stage === "leafy") return bpad(40, 74, 0, 9, 11) + bpad(34, 56, -20, 5.5, 7.5) + bpad(46, 56, 20, 5.5, 7.5);
	const fl = (x: number, y: number) => petals(x, y, 6, 2, 2, 1.3, "#f0dc78") + circle(x, y, 1, "#b9c45a");
	return (
		bpad(40, 75, 0, 10, 12) +
		bpad(31, 55, -24, 7, 9.5) +
		bpad(49, 55, 24, 7, 9.5) +
		bpad(23, 40, -30, 4.8, 6.5) +
		bpad(31, 39.5, -2, 4.8, 6.5) +
		bpad(57, 40, 30, 4.8, 6.5) +
		bpad(49, 39.5, 2, 4.8, 6.5) +
		fl(19.7, 33.5) +
		fl(60.3, 33.5) +
		fl(31.2, 32.5)
	);
}

// ── 5. Christmas cactus ──────────────────────────────────────────────────

const XM = "#5f9f4f";
const XMD = "#3e7a3a";

function chain(x: number, y: number, angles: number[], len: number): { s: string; x: number; y: number } {
	let s = "";
	let px = x;
	let py = y;
	for (const a of angles) {
		const r = (a * Math.PI) / 180;
		const nx = px + Math.cos(r) * len;
		const ny = py + Math.sin(r) * len;
		s += g((px + nx) / 2, (py + ny) / 2, a, fill(`M${f(-len / 2 - 0.6)} 0C${f(-len / 2)} -2.6 ${f(len / 2 - 1)} -3.2 ${f(len / 2 + 0.6)} -1.6L${f(len / 2 - 0.4)} 0L${f(len / 2 + 0.6)} 1.6C${f(len / 2 - 1)} 3.2 ${f(-len / 2)} 2.6 ${f(-len / 2 - 0.6)} 0Z`, XM));
		s += circle(nx, ny, 0.8, XMD);
		px = nx;
		py = ny;
	}
	return { s, x: px, y: py };
}

function xmasFlower(x: number, y: number, a: number): string {
	return g(
		x,
		y,
		a,
		ell(3, 0, 3.2, 1.5, "#cf3a72") +
			fill(`M5 0L11 -4.5L9.5 0L11 4.5Z`, "#e8679a") +
			strk("M7 0L12.5 0", "#f6cfdc", 0.5),
	);
}

function christmasCactus(stage: GrowingStage): string {
	if (stage === "sprout") return chain(40, 86, [-92, -82], 6).s + chain(40, 86, [-125], 6).s;
	if (stage === "leafy") return chain(40, 86, [-100, -118, -140, -160], 7).s + chain(40, 86, [-80, -62, -40], 7).s + chain(40, 86, [-92, -86, -72, -55], 7).s;
	const base = chain(40, 86, [-90, -93], 7.5);
	let s = base.s;
	const arms: [number, number, number[], number][] = [
		[40, 86, [-150, -168, 172], 115],
		[40, 86, [-30, -12, 8], 65],
		[base.x, base.y, [-122, -140, -160, -180], 128],
		[base.x, base.y, [-58, -40, -20, 0], 52],
		[base.x, base.y, [-100, -104, -116, -134], 150],
		[base.x, base.y, [-80, -76, -64, -46], 32],
	];
	for (const [x, y, angles, fa] of arms) {
		const c = chain(x, y, angles, 7.5);
		s += c.s + xmasFlower(c.x, c.y, fa);
	}
	return s;
}

// ── 6. Moon cactus ───────────────────────────────────────────────────────

function moonBall(x: number, y: number, r: number): string {
	return circle(x, y, r, "#e2574c") + meridians(x, y, r, r, 6, "#b53b37", 0.8, 0.7, "#f6d7c8");
}

function stock(top: number, w: number): string {
	return line(40, 86, 40, top, "#4c8a4a", w) + strk(`M${f(40 - w * 0.22)} ${top}V86M${f(40 + w * 0.22)} ${top}V86`, "#35663a", 0.8, 0.6);
}

function moonCactus(stage: GrowingStage): string {
	if (stage === "sprout") return stock(78, 6) + moonBall(40, 72.5, 5);
	if (stage === "leafy") return stock(60, 8) + moonBall(40, 53, 9.5);
	return (
		stock(56, 9) +
		circle(30.5, 50.5, 3.8, "#d84c44") +
		circle(50, 50, 3.4, "#d84c44") +
		moonBall(40, 42, 12.5) +
		petals(40, 28.5, 8, 3.4, 3.3, 1.5, "#f2a0bf") +
		circle(40, 28.5, 1.8, "#fff1c4")
	);
}

// ── 7. Old man cactus ────────────────────────────────────────────────────

const HAIR = "#efede4";

function hairy(x: number, top: number, bottom: number, w: number): string {
	let d = "";
	let row = 0;
	for (let y = top - w / 2 + 3; y < bottom - 2; y += 2.7, row++) {
		for (let dx = -w * 0.36 + (row % 2) * 1.3; dx <= w * 0.36; dx += 2.6) d += `M${f(x + dx)} ${f(y)}q1.6 1.8 .3 4`;
	}
	return line(x, bottom, x, top, "#6e9f68", w) + strk(d, HAIR, 0.8) + ell(x, top - w / 2 + 2, w * 0.4, 2.2, HAIR);
}

function oldMan(stage: GrowingStage): string {
	if (stage === "sprout") return hairy(40, 77, 85, 10);
	if (stage === "leafy") return hairy(40, 51, 85, 13);
	const fl = (x: number, y: number) => petals(x, y, 6, 2.3, 2.4, 1.4, "#de5f78") + circle(x, y, 1.1, "#f6d36a");
	return hairy(29, 53, 85, 9) + hairy(40, 21, 85, 14) + fl(33, 21) + fl(47, 25) + fl(25, 51);
}

// ── 8. Echeveria ─────────────────────────────────────────────────────────

function eRosette(n: number, from: number, to: number, len: number, w: number, c: string, blush = "#d98f9c"): string {
	let s = "";
	for (let i = 0; i < n; i++) {
		const a = from + ((to - from) * i) / (n - 1);
		s += g(40, 85, a, fill(leafPath(len, w, 1), c) + circle(len - 1.8, 0, 1, blush));
	}
	return s;
}

function echeveria(stage: GrowingStage): string {
	if (stage === "sprout") return eRosette(3, -140, -40, 10, 4, "#a9cfc1");
	if (stage === "leafy") return eRosette(7, -170, -10, 16, 5.5, "#8fbcae") + eRosette(5, -145, -35, 12, 5, "#a9cfc1") + eRosette(3, -120, -60, 8, 4, "#c4e0d4");
	let s = strk("M41 78C42 58 51 42 60 31", "#7ea488", 1.8);
	for (const [x, y] of [[51, 48], [54, 42], [57, 37], [61.5, 37.5], [60, 31], [56.5, 29]] as const) s += fill(`M${f(x - 2.4)} ${f(y)}Q${f(x)} ${f(y + 5.5)} ${f(x + 2.4)} ${f(y)}Z`, "#ee8a5c") + circle(x, y + 3.4, 0.7, "#f6d36a");
	return s + eRosette(9, -174, -6, 20, 6.5, "#8fbcae") + eRosette(7, -155, -25, 15, 5.8, "#a9cfc1") + eRosette(4, -128, -52, 10, 4.8, "#c4e0d4");
}

// ── 9. Aloe vera ─────────────────────────────────────────────────────────

function aleaf(a: number, len: number, w: number, c: string): string {
	return g(
		40,
		86,
		a,
		fill(`M0 ${f(-w)}Q${f(len * 0.55)} ${f(-w * 0.95)} ${f(len)} 0Q${f(len * 0.55)} ${f(w * 0.95)} 0 ${f(w)}Z`, c) +
			dots([[len * 0.25, -w * 0.35], [len * 0.42, w * 0.3], [len * 0.58, -w * 0.15], [len * 0.72, w * 0.1]], 0.5, "#e6efe6"),
	);
}

function aloeFan(scale: number, w: number): string {
	const AL: XY[] = [[-150, 20], [-30, 20], [-128, 28], [-52, 28], [-108, 33], [-72, 33], [-90, 35]];
	return AL.map(([a, l], i) => aleaf(a, l * scale, w, i < 4 ? "#7aa68c" : "#8fba9f")).join("");
}

function aloeVera(stage: GrowingStage): string {
	if (stage === "sprout") return aleaf(-122, 12, 2.4, "#7aa68c") + aleaf(-58, 12, 2.4, "#7aa68c") + aleaf(-90, 15, 2.6, "#8fba9f");
	if (stage === "leafy") return aloeFan(1, 3.8);
	let s = line(40, 66, 40, 9, "#86a06a", 1.6);
	for (let i = 0; i < 9; i++) {
		const y = 10 + i * 2.3;
		const side = i % 2 ? 1 : -1;
		const c = i < 3 ? "#e3d36a" : i < 6 ? "#f2b843" : "#ee913a";
		s += ell(40 + side * 1.8, y + 1.5, 1, 2.6, c, side * -30);
	}
	return s + aloeFan(1.1, 4.4);
}

// ── 10. Agave ────────────────────────────────────────────────────────────

function agleaf(a: number, len: number, w: number, c: string): string {
	return g(40, 86, a, fill(leafPath(len, w, 1), c) + fill(`M${f(len - 1.5)} -.9L${f(len + 2)} 0L${f(len - 1.5)} .9Z`, "#5b3a2a"));
}

function agRosette(scale: number, w: number): string {
	const AL: XY[] = [[-172, 18], [-8, 18], [-150, 22], [-30, 22], [-128, 24], [-52, 24], [-108, 25], [-72, 25], [-90, 26]];
	return AL.map(([a, l], i) => agleaf(a, l * scale, w * (i > 5 ? 0.9 : 1), i < 6 ? "#78a0a4" : "#97bcbd")).join("");
}

function agave(stage: GrowingStage): string {
	if (stage === "sprout") return agleaf(-135, 10, 3.6, "#78a0a4") + agleaf(-45, 10, 3.6, "#78a0a4") + agleaf(-90, 13, 4, "#97bcbd");
	if (stage === "leafy") return agRosette(1, 6);
	let s = line(40, 72, 40, 9, "#8f8a52", 2.4);
	const cl = (x: number, y: number, r: number) => circle(x, y, r, "#e5bd45") + circle(x - r * 0.35, y - r * 0.4, r * 0.55, "#f3d76a");
	for (const [y, L] of [[16, 5], [24, 8], [32, 10], [40, 11]] as const) s += strk(`M${f(40 - L)} ${f(y - 3)}L40 ${y}L${f(40 + L)} ${f(y - 3)}`, "#8f8a52", 1.3) + cl(40 - L, y - 4, 2.6) + cl(40 + L, y - 4, 2.6);
	return s + cl(40, 8, 2.4) + agRosette(1.15, 6.5);
}

// ── 11. Jade plant ───────────────────────────────────────────────────────

const JT = "#7f7448";

function jleaf(x: number, y: number, a: number, len: number, c: string): string {
	return g(x, y, a, fill(leafPath(len, len * 0.36, 2), "#b8584a") + fill(leafPath(len * 0.9, len * 0.35, 2), c));
}

/** A branch tip: opposite leaf pairs in a V around `dir`. */
function jcluster(x: number, y: number, dir: number, len: number): string {
	const r = (dir * Math.PI) / 180;
	const bx = x - Math.cos(r) * 2.6;
	const by = y - Math.sin(r) * 2.6;
	return (
		jleaf(bx, by, dir - 62, len, "#5f9f55") +
		jleaf(bx, by, dir + 62, len, "#5f9f55") +
		jleaf(x, y, dir - 30, len * 0.9, "#76b764") +
		jleaf(x, y, dir + 30, len * 0.9, "#76b764") +
		jleaf(x, y, dir, len * 0.55, "#8cc46a")
	);
}

function jade(stage: GrowingStage): string {
	if (stage === "sprout") return line(40, 87, 40, 76, JT, 2.4) + jcluster(40, 76, -90, 7);
	if (stage === "leafy")
		return (
			line(40, 87, 40, 56, JT, 3.6) +
			line(40, 72, 29, 60, JT, 2.4) +
			line(40, 68, 52, 58, JT, 2.4) +
			jleaf(40, 78, -150, 7, "#5f9f55") +
			jleaf(40, 78, -30, 7, "#5f9f55") +
			jcluster(29, 60, -125, 8.5) +
			jcluster(52, 58, -50, 8.5) +
			jcluster(40, 56, -90, 9)
		);
	const heads: XY[] = [[25, 44], [62, 40], [31, 27], [51, 25]];
	const at: XY[] = heads.flatMap(([x, y]) => [[x - 2, y], [x + 2, y + 0.5], [x, y - 2.2], [x + 0.3, y + 0.3]] as XY[]);
	return (
		line(40, 87, 40, 58, JT, 5.5) +
		line(40, 74, 25, 58, JT, 3.2) +
		line(40, 67, 56, 53, JT, 3.2) +
		line(40, 60, 33, 41, JT, 2.8) +
		line(40, 60, 48, 39, JT, 2.8) +
		line(25, 58, 17, 53, JT, 2) +
		jcluster(25, 58, -105, 9.5) +
		jcluster(17, 53, -150, 8) +
		jcluster(56, 53, -45, 9.5) +
		jcluster(33, 41, -110, 9.5) +
		jcluster(48, 39, -70, 9.5) +
		dots(at, 1.4, "#f7e3ea") +
		dots(at, 0.5, "#d9708f")
	);
}

// ── 12. Haworthia ────────────────────────────────────────────────────────

function hleaf(a: number, len: number, w: number, c: string): string {
	let d = "";
	for (const [p, h] of [[0.26, 0.4], [0.43, 0.5], [0.6, 0.48], [0.74, 0.38], [0.86, 0.22]] as const) d += `M${f(len * p)} ${f(-w * h)}V${f(w * h)}`;
	return g(40, 86, a, fill(leafPath(len, w, 1), c) + strk(d, "#e8efe2", 0.8));
}

function hRosette(L: number[], w: number): string {
	const A = [-148, -32, -128, -52, -108, -72, -90];
	return A.map((a, i) => hleaf(a, L[i] ?? 20, w, i < 4 ? "#3f6e4a" : "#4f8458")).join("");
}

function haworthia(stage: GrowingStage): string {
	if (stage === "sprout") return hleaf(-122, 9, 2.8, "#3f6e4a") + hleaf(-58, 9, 2.8, "#3f6e4a") + hleaf(-90, 11, 3, "#4f8458");
	if (stage === "leafy") return hRosette([13, 13, 17, 17, 20, 20, 22], 3.8);
	let s = strk("M40 72Q37 40 47 12", "#8a9a6a", 1.1);
	for (const [x, y, a] of along([[40, 72], [38, 50], [40, 30], [47, 12]], 12).slice(5)) {
		s += g(x, y, a + 75, ell(2.2, 0, 2, 0.9, "#e9e2d4") + ell(3.3, 0, 0.8, 0.5, "#b89aa8"));
	}
	return s + hRosette([15, 15, 20, 20, 24, 24, 26], 4.3);
}

// ── 13. Hens and chicks ──────────────────────────────────────────────────

function hcLeaf(x: number, y: number, a: number, len: number, w: number, c: string, tip = true): string {
	return g(x, y, a, (tip ? fill(leafPath(len, w, 1), "#94485a") : "") + fill(leafPath(len * 0.86, w * 0.98, 1), c));
}

function hen(x: number, y: number, s: number): string {
	let o = "";
	for (const [n, from, to, len, w, c] of [
		[7, -172, -8, 12, 4.4, "#759d62"],
		[5, -145, -35, 9.5, 4, "#8ab174"],
		[3, -118, -62, 6.5, 3.2, "#a2c389"],
	] as const) {
		for (let i = 0; i < n; i++) o += hcLeaf(x, y, from + ((to - from) * i) / (n - 1), len * s, w * s, c, n > 5);
	}
	return o;
}

function chick(x: number, y: number, s: number): string {
	let o = "";
	for (const a of [-158, -22, -112, -68]) o += hcLeaf(x, y, a, 9 * s, 4.4 * s, "#8ab174");
	return o;
}

function hensAndChicks(stage: GrowingStage): string {
	if (stage === "sprout") return chick(40, 86, 1.2);
	if (stage === "leafy") return chick(22, 86, 0.75) + chick(58, 86.5, 0.6) + hen(40, 86, 1.3);
	let s = line(40, 78, 40, 42, "#b3b780", 3.2);
	for (const [y, a] of [[70, -150], [64, -30], [58, -150], [52, -30]] as const) s += leaf(40, y, a, 5, 1.8, { fill: "#9cb878", rib: false });
	const star = (x: number, y: number) => petals(x, y, 6, 1.9, 1.9, 0.7, "#e07a9e") + circle(x, y, 0.8, "#f3d36a");
	s += star(34, 40) + star(46, 40) + star(40, 37) + star(37, 44) + star(43.5, 44.5);
	return s + chick(18, 86.5, 0.75) + chick(62, 86.5, 0.7) + chick(28, 87.5, 0.5) + hen(40, 86, 1.55);
}

// ── 14. String of pearls ─────────────────────────────────────────────────

function strand(p: readonly [Pt, Pt, Pt, Pt], n: number, r = 1.75): string {
	return strk(cubic(p), "#4f8a45", 0.7) + dots(along(p, n).map(([x, y]) => [x, y] as const), r, "#7cc06a");
}

function stringOfPearls(stage: GrowingStage): string {
	if (stage === "sprout") return strand([[40, 86], [39, 80], [36, 76], [34, 72]], 4) + strand([[40, 86], [41, 79], [44, 76], [46, 72]], 4) + strand([[40, 86], [40, 81], [40, 77], [40.5, 70]], 5);
	if (stage === "leafy") {
		const arc: [Pt, Pt, Pt, Pt] = [[40, 84], [33, 56], [20, 56], [15, 82]];
		return strand(arc, 11) + strand(mirror(arc), 11) + strand([[40, 86], [38, 76], [35, 70], [33, 64]], 6) + strand([[40, 86], [42, 76], [45, 70], [47, 64]], 6) + strand([[40, 86], [40, 76], [40, 68], [40.5, 58]], 7);
	}
	const hi: [Pt, Pt, Pt, Pt] = [[40, 84], [33, 34], [14, 34], [9, 82]];
	const lo: [Pt, Pt, Pt, Pt] = [[40, 84], [36, 52], [24, 50], [20, 82]];
	const fl = (x: number, y: number) => strk(`M${f(x)} ${f(y + 5)}L${f(x)} ${f(y)}`, "#4f8a45", 0.6) + petals(x, y, 6, 1.5, 1.5, 0.7, "#f2ecdc") + circle(x, y, 0.9, "#c8504a");
	return (
		strand(hi, 16) +
		strand(mirror(hi), 16) +
		strand(lo, 11) +
		strand(mirror(lo), 11) +
		strand([[40, 86], [39, 72], [36, 62], [33, 55]], 9) +
		strand([[40, 86], [41, 72], [44, 62], [47, 55]], 9) +
		fl(33, 49) +
		fl(47, 49) +
		fl(40, 45)
	);
}

// ── 15. Burro's tail ─────────────────────────────────────────────────────

function tail(p: readonly [Pt, Pt, Pt, Pt], n: number): string {
	return along(p, n)
		.map(([x, y, a], i) => ell(x, y, 3.2, 2, i % 2 ? "#8cc0a7" : "#a8d3bf", a + (i % 2 ? 42 : -42)))
		.join("");
}

function burrosTail(stage: GrowingStage): string {
	if (stage === "sprout") return tail([[40, 86], [38, 80], [37, 76], [36, 71]], 6) + tail([[40, 86], [42, 81], [43, 78], [45, 74]], 5);
	if (stage === "leafy") {
		const side: [Pt, Pt, Pt, Pt] = [[38, 86], [34, 62], [22, 56], [19, 70]];
		return tail(side, 11) + tail(mirror(side), 11) + tail([[40, 86], [39, 72], [40, 62], [41, 50]], 12);
	}
	const fl = (x: number, y: number) => dots([[x - 1.2, y], [x + 1.2, y], [x, y - 1.2], [x, y + 1.1]], 1.3, "#d9506a") + circle(x, y, 0.6, "#f6d36a");
	const hi: [Pt, Pt, Pt, Pt] = [[38, 86], [32, 44], [14, 38], [12, 66]];
	const mid: [Pt, Pt, Pt, Pt] = [[39, 86], [36, 60], [26, 56], [25, 72]];
	return (
		tail(hi, 16) +
		tail(mirror(hi), 16) +
		tail(mid, 9) +
		tail(mirror(mid), 9) +
		tail([[40, 86], [39, 64], [41, 48], [42, 30]], 15) +
		fl(12, 70) +
		fl(68, 70) +
		fl(25, 75.5) +
		fl(55, 75.5) +
		fl(42.5, 26)
	);
}

// ── 16. Kalanchoe ────────────────────────────────────────────────────────

function kLeaves(pts: readonly (readonly [number, number, number])[], len: number): string {
	return pts.map(([x, y, a], i) => leaf(x, y, a, len, len * 0.36, { fill: i % 2 ? "#3f8a48" : "#4f9a52", dark: "#2b6634", shape: 0 })).join("");
}

function kCluster(x: number, y: number): string {
	let s = "";
	for (const [dx, dy, c] of [[-4, 1, "#d8452e"], [4, 1, "#d8452e"], [-2, -2.5, "#ec6a38"], [2.2, -2.3, "#ec6a38"], [0, 1.4, "#e8553a"], [-5.5, -1.5, "#f08a3a"], [5.5, -1.2, "#f08a3a"], [0, -4.6, "#f08a3a"]] as const) {
		s += circle(x + dx, y + dy, 1.9, c) + circle(x + dx, y + dy, 0.55, "#f6d36a");
	}
	return s;
}

function kalanchoe(stage: GrowingStage): string {
	if (stage === "sprout") return line(40, 87, 40, 76, "#3d7440", 1.8) + kLeaves([[40, 80, -160], [40, 80, -20], [40, 76, -125], [40, 76, -55]], 7);
	const stems = (h: number) => line(40, 87, 40, 87 - h, "#3d7440", 2) + line(40, 80, 30, 87 - h * 0.8, "#3d7440", 1.6) + line(40, 80, 51, 87 - h * 0.85, "#3d7440", 1.6);
	if (stage === "leafy")
		return stems(34) + kLeaves([[40, 82, -170], [40, 82, -10], [30, 61, -150], [51, 59, -30], [40, 70, -140], [40, 68, -40], [30, 61, -95], [51, 59, -85], [40, 54, -120], [40, 54, -60]], 10);
	return (
		stems(44) +
		line(40, 43, 40, 34, "#3d7440", 1.2) +
		line(30, 52, 28, 42, "#3d7440", 1.2) +
		line(51, 50, 54, 40, "#3d7440", 1.2) +
		kLeaves([[40, 82, -172], [40, 82, -8], [40, 72, -145], [40, 70, -35], [30, 52, -160], [51, 50, -20], [30, 52, -110], [51, 50, -70], [40, 58, -130], [40, 56, -50]], 11) +
		kCluster(40, 32) +
		kCluster(27, 41) +
		kCluster(55, 39)
	);
}

// ── 17. Living stones ────────────────────────────────────────────────────

/** One plant: two fat lobes parted by a V-shaped split, flat windowed tops. */
function stone(x: number, top: number, r: number, body: string, win: string): string {
	const h = 87 - top;
	const lobe = (sx: number) => {
		const ix = x + sx * 1.1;
		const ox = x + sx * r;
		return (
			fill(
				`M${f(x + sx * 0.3)} 87L${f(ix)} ${f(top + 1.2)}Q${f(ix + sx * 0.4)} ${f(top)} ${f(x + sx * r * 0.55)} ${f(top)}Q${f(ox + sx * 0.4)} ${f(top)} ${f(ox)} ${f(top + h * 0.35)}Q${f(ox - sx * 0.3)} ${f(top + h * 0.8)} ${f(x + sx * r * 0.7)} 87Z`,
				body,
			) +
			ell(x + sx * r * 0.55, top + 1.4, r * 0.36, 1.1, win) +
			circle(x + sx * r * 0.45, top + 1.4, 0.45, "#6f5a4a") +
			circle(x + sx * r * 0.68, top + 1.6, 0.4, "#6f5a4a")
		);
	};
	return lobe(-1) + lobe(1);
}

function livingStones(stage: GrowingStage): string {
	if (stage === "sprout") return stone(40, 79, 5.5, "#cdb48f", "#a8916f");
	if (stage === "leafy") return stone(30, 75, 8.5, "#cdb48f", "#a8916f") + stone(50, 77, 7.5, "#bfa2a6", "#9a7f86");
	return (
		stone(21, 77, 7.5, "#bfa2a6", "#9a7f86") +
		stone(59, 76, 8, "#c5ad8a", "#a08a6a") +
		stone(40, 72, 11.5, "#cdb48f", "#a8916f") +
		strk("M40 72V56M59 76V64", "#c9b07a", 1.2) +
		daisy(40, 52, 20, 8, "#f2c230", "#e09a2a") +
		daisy(59, 61, 16, 5.5, "#f2c230", "#e09a2a", 1)
	);
}

// ── 18. Panda plant ──────────────────────────────────────────────────────

const PD = "#b9c8a8";
const PDD = "#9fb08e";
const PBR = "#7a4630";
const PSTEM = "#a2ad88";

function pleaf(x: number, y: number, a: number, len: number, w: number, c: string): string {
	return g(x, y, a, fill(leafPath(len, w, 0), c) + dots([[len - 1, 0], [len - 2.8, -w * 0.62], [len - 2.8, w * 0.62]], 0.65, PBR));
}

function pandaShoot(x0: number, y0: number, x1: number, y1: number, n: number, len: number): string {
	let s = line(x0, y0, x1, y1, PSTEM, 2.2);
	for (let i = 0; i < n; i++) {
		const t = 0.25 + (0.75 * i) / n;
		const x = x0 + (x1 - x0) * t;
		const y = y0 + (y1 - y0) * t;
		const side = i % 2 ? 1 : -1;
		s += pleaf(x, y, -90 + side * (62 - i * 4), len, len * 0.36, i % 2 ? PDD : PD);
	}
	return s + pleaf(x1, y1, -112, len * 0.9, len * 0.34, PD) + pleaf(x1, y1, -68, len * 0.9, len * 0.34, PDD) + pleaf(x1, y1, -90, len, len * 0.36, PD);
}

function pandaPlant(stage: GrowingStage): string {
	if (stage === "sprout") return pleaf(40, 85, -150, 9, 3.3, PDD) + pleaf(40, 85, -30, 9, 3.3, PDD) + pleaf(40, 85, -112, 10, 3.6, PD) + pleaf(40, 85, -68, 10, 3.6, PD);
	if (stage === "leafy") return pandaShoot(40, 87, 40, 58, 4, 12);
	return pandaShoot(39, 84, 26, 52, 4, 11) + pandaShoot(41, 84, 55, 50, 4, 11) + pandaShoot(40, 87, 40, 34, 6, 12.5);
}

// ── 19. Pincushion cactus ────────────────────────────────────────────────

function pin(x: number, cy: number, rx: number, ry: number): string {
	return ell(x, cy, rx, ry, "#64a364") + dots(grid(x, cy, rx, ry, 2.4, 0.86), 0.6, "#f4f2e8");
}

function pincushion(stage: GrowingStage): string {
	if (stage === "sprout") return pin(40, 80.5, 6, 6.5);
	if (stage === "leafy") return pin(52, 81, 6, 6) + pin(40, 72.5, 11, 14);
	let s = pin(25, 80, 7, 7.5) + pin(56, 77, 9, 10) + pin(40, 67, 14, 20);
	const crown: XY[] = [[29, 54], [51, 54], [33, 50.5], [47, 50.5], [37, 48.5], [43, 48.5], [40, 47.5], [56, 67]];
	return s + dots(crown, 2.5, "#d9408a") + dots(crown, 0.8, "#f6d36a");
}

// ── 20. Star cactus ──────────────────────────────────────────────────────

function starDome(r: number, h: number): string {
	const top = 87 - h;
	let d = "";
	const ar: XY[] = [];
	for (const s of [-0.88, -0.48, 0, 0.48, 0.88]) {
		d += `M40 ${f(top)}Q${f(40 + r * s * 1.05)} ${f(top + h * 0.12)} ${f(40 + r * s)} 87`;
		for (const t of [0.35, 0.7]) ar.push([(1 - t) * (1 - t) * 40 + 2 * (1 - t) * t * (40 + r * s * 1.05) + t * t * (40 + r * s), (1 - t) * (1 - t) * top + 2 * (1 - t) * t * (top + h * 0.12) + t * t * 87]);
	}
	return (
		fill(`M${f(40 - r)} 87A${f(r)} ${f(h)} 0 0 1 ${f(40 + r)} 87Z`, "#6f8f6c") +
		dots(grid(40, 87, r * 0.95, h * 0.95, 2.1, 0.92).filter(([, y]) => y < 86.5), 0.35, "#e4e8dc") +
		strk(d, "#4e6b4c", 0.8, 0.8) +
		dots(ar, 0.9, "#efe6c4")
	);
}

function starCactus(stage: GrowingStage): string {
	if (stage === "sprout") return starDome(6, 5);
	if (stage === "leafy") return starDome(13, 10);
	return starDome(18, 14) + petals(40, 66, 12, 5.4, 5, 2, "#f4cf3a") + petals(40, 66, 12, 3, 2.6, 1.4, "#f8dd60", 15) + circle(40, 66, 2.6, "#d9573a");
}

// ── 21. Ponytail palm ────────────────────────────────────────────────────

function caudex(cx: number, r: number): string {
	return (
		fill(`M${f(cx - r)} 87C${f(cx - r * 1.1)} ${f(87 - r * 1.5)} ${f(cx - r * 0.3)} ${f(87 - r * 1.9)} ${f(cx)} ${f(87 - r * 2.1)}C${f(cx + r * 0.3)} ${f(87 - r * 1.9)} ${f(cx + r * 1.1)} ${f(87 - r * 1.5)} ${f(cx + r)} 87Z`, "#9a7656") +
		strk(`M${f(cx - r * 0.7)} ${f(87 - r * 0.5)}q${f(r * 0.7)} 1.6 ${f(r * 1.4)} 0M${f(cx - r * 0.55)} ${f(87 - r * 1.1)}q${f(r * 0.55)} 1.4 ${f(r * 1.1)} 0`, "#7c5c42", 0.8, 0.7)
	);
}

function ponyLeaves(x: number, y: number, spec: readonly (readonly [number, number])[]): string {
	// each [dx, dy]: tip offset; leaves arch up then down.
	let a = "";
	let b = "";
	spec.forEach(([dx, dy], i) => {
		const d = `M${f(x)} ${f(y)}Q${f(x + dx * 0.45)} ${f(y - 14)} ${f(x + dx)} ${f(y + dy)}`;
		if (i % 2) a += d;
		else b += d;
	});
	return strk(a, "#5f9f55", 1.5) + strk(b, "#7fb565", 1.5);
}

function ponytailPalm(stage: GrowingStage): string {
	if (stage === "sprout") return caudex(40, 4.5) + ponyLeaves(40, 77, [[-8, 1], [8, 2], [-4, -4], [5, -3]]);
	if (stage === "leafy")
		return caudex(40, 9) + line(40, 70, 40, 60, "#8a6a4c", 2.4) + ponyLeaves(40, 60, [[-18, 12], [18, 12], [-13, 4], [14, 3], [-7, -4], [8, -5], [-21, 18], [21, 17], [2, -7]]);
	return (
		caudex(40, 10.5) +
		line(40, 67, 40, 38, "#8a6a4c", 3) +
		dots(grid(40, 18, 3.5, 7, 1.9, 0.95), 0.75, "#e3cf94") +
		line(40, 38, 40, 25, "#a99a6a", 0.9) +
		ponyLeaves(40, 38, [
			[-30, 34],
			[30, 34],
			[-26, 24],
			[27, 22],
			[-20, 14],
			[21, 13],
			[-13, 4],
			[14, 3],
			[-6, -6],
			[7, -5],
			[-33, 44],
			[33, 44],
			[-36, 30],
			[36, 30],
			[-24, 38],
			[24, 38],
			[-15, 22],
			[16, 22],
		])
	);
}

// ── 22. Sedum ────────────────────────────────────────────────────────────

function sedumStem(x0: number, x1: number, top: number, n: number, len: number): string {
	let s = line(x0, 87, x1, top, "#7f9c74", 1.8);
	for (let i = 0; i < n; i++) {
		const t = 0.15 + (0.8 * i) / n;
		const x = x0 + (x1 - x0) * t;
		const y = 87 + (top - 87) * t;
		s += leaf(x, y, i % 2 ? -32 : -148, len, len * 0.42, { fill: i % 2 ? "#8fb8a0" : "#a4c7b1", dark: "#6a9480" });
	}
	return s;
}

function sedumHead(x: number, y: number, rx: number, ry: number, bud: boolean): string {
	const body = bud ? "#a9c693" : "#c4607e";
	const pip = bud ? "#c3d9a9" : "#e897ae";
	let s = "";
	const lumps: XY[] = [[-0.62, 0.15], [0.62, 0.15], [-0.3, -0.35], [0.3, -0.35], [0, 0.1]];
	for (const [u, v] of lumps) s += circle(x + u * rx, y + v * ry, ry * 0.85, body);
	return s + dots(grid(x, y - ry * 0.1, rx * 1.05, ry * 1.05, 2, 0.9), 0.65, pip);
}

function sedum(stage: GrowingStage): string {
	if (stage === "sprout") return sedumStem(40, 40, 70, 4, 7);
	if (stage === "leafy") return sedumStem(36, 30, 50, 5, 9) + sedumStem(44, 50, 52, 5, 9) + sedumStem(40, 40, 46, 5, 10) + sedumHead(40, 46, 5, 3, true);
	return (
		sedumStem(36, 25, 46, 5, 9) +
		sedumStem(44, 56, 44, 5, 9) +
		sedumStem(40, 40, 34, 6, 10) +
		sedumHead(25, 46, 10, 6, false) +
		sedumHead(56, 44, 10, 6, false) +
		sedumHead(40, 34, 12, 7, false)
	);
}

// ── 23. Crown of thorns ──────────────────────────────────────────────────

function thorny(x1: number, y1: number, x2: number, y2: number, w: number): string {
	const L = Math.hypot(x2 - x1, y2 - y1);
	const ux = (x2 - x1) / L;
	const uy = (y2 - y1) / L;
	let d = "";
	let side = 1;
	for (let k = 2; k < L - 1; k += 2.6, side = -side) {
		const px = x1 + ux * k;
		const py = y1 + uy * k;
		const nx = -uy * side;
		const ny = ux * side;
		d += `M${f(px + (nx * w) / 2)} ${f(py + (ny * w) / 2)}l${f(nx * 1.8 + ux * 0.6)} ${f(ny * 1.8 + uy * 0.6)}`;
	}
	return line(x1, y1, x2, y2, "#7d6c5e", w) + strk(d, "#5a4a40", 0.7);
}

const ctLeaves = (x: number, y: number) => fan(x, y, 4, -150, -30, 7, 2.6, { fill: "#6fb35a", rib: false });

function bracts(x: number, y: number): string {
	const at: XY[] = [[x - 3.4, y - 2.5], [x + 3.4, y - 2.2], [x, y - 4.8]];
	return (
		strk(at.map(([px, py]) => `M${f(x)} ${f(y)}L${f(px)} ${f(py)}`).join(""), "#6d7a4a", 0.6) +
		dots(at.map(([px, py]) => [px - 1.3, py] as const), 1.8, "#e0403a") +
		dots(at.map(([px, py]) => [px + 1.3, py] as const), 1.8, "#d23630") +
		dots(at, 0.7, "#cfd34a")
	);
}

function crownOfThorns(stage: GrowingStage): string {
	if (stage === "sprout") return thorny(40, 87, 40, 72, 2.4) + ctLeaves(40, 72);
	if (stage === "leafy") return thorny(40, 87, 37, 56, 2.8) + thorny(40, 78, 52, 62, 2.4) + thorny(39, 72, 27, 62, 2.4) + ctLeaves(37, 56) + ctLeaves(52, 62) + ctLeaves(27, 62);
	const tips: XY[] = [[37, 40], [55, 47], [22, 52], [29, 36], [61, 34]];
	return (
		thorny(40, 87, 37, 40, 3.2) +
		thorny(40, 76, 55, 47, 2.6) +
		thorny(39, 70, 22, 52, 2.6) +
		thorny(38, 56, 29, 36, 2.2) +
		thorny(55, 47, 61, 34, 2.2) +
		tips.map(([x, y]) => ctLeaves(x, y + 2)).join("") +
		tips.map(([x, y]) => bracts(x, y)).join("")
	);
}

// ── 24. Ice plant ────────────────────────────────────────────────────────

function fingers(spec: readonly (readonly [number, number, number, number])[]): string {
	return spec.map(([x, y, a, l], i) => g(x, y, a, ell(l / 2, 0, l / 2, 1.4, i % 3 ? "#7fb27a" : "#99c78f"))).join("");
}

function icePlant(stage: GrowingStage): string {
	if (stage === "sprout") return fingers([[40, 86, -150, 8], [40, 86, -30, 8], [40, 86, -115, 10], [40, 86, -65, 10], [40, 86, -90, 9]]);
	const mat = (xs: number[], h: number): [number, number, number, number][] => {
		const out: [number, number, number, number][] = [];
		xs.forEach((x, i) => {
			const lean = (x - 40) * 1.2;
			for (const a of [-150, -120, -90, -60, -30]) out.push([x, 86, a + lean, h * (a === -90 ? 1 : 0.85) + (i % 2)]);
		});
		return out;
	};
	if (stage === "leafy") return fingers(mat([24, 32, 40, 48, 56], 13)) + fingers(mat([34, 46], 16).map(([x, , a, l]) => [x, 80, a, l * 0.8] as [number, number, number, number]));
	return (
		fingers(mat([16, 24, 32, 40, 48, 56, 64], 14)) +
		fingers(mat([28, 40, 52], 16).map(([x, , a, l]) => [x, 78, a, l * 0.85] as [number, number, number, number])) +
		daisy(20, 70, 18, 5.5, "#d6338a", "#f2c94c") +
		daisy(60, 70, 18, 5.5, "#d6338a", "#f2c94c") +
		daisy(31, 61, 18, 6, "#e04c98", "#f2c94c") +
		daisy(49, 61, 18, 6, "#e04c98", "#f2c94c") +
		daisy(40, 53, 20, 6.5, "#d6338a", "#f2c94c")
	);
}

// ── 25. Fairy castle cactus ──────────────────────────────────────────────

function turret(x: number, top: number, w: number, bottom = 86): string {
	return (
		line(x, bottom, x, top, "#7fb36e", w) +
		strk(`M${f(x - w * 0.22)} ${f(top)}V${f(bottom)}M${f(x + w * 0.22)} ${f(top)}V${f(bottom)}`, "#5a8c50", 0.6, 0.6) +
		dots(([[x - w * 0.22, top + 4], [x + w * 0.22, top + 9], [x - w * 0.22, top + 14]] as XY[]).filter(([, y]) => y < bottom - 2), 0.45, SPINE)
	);
}

function fairyCastle(stage: GrowingStage): string {
	if (stage === "sprout") return turret(38, 76, 4.5) + turret(42.5, 72, 4.5);
	if (stage === "leafy") return turret(30, 64, 4.8) + turret(50, 60, 4.8) + turret(35, 52, 5.2) + turret(45, 46, 5.5) + turret(40, 56, 5);
	const fl = (x: number, y: number) => petals(x, y, 6, 1.9, 1.9, 1.15, "#f0e2b0") + circle(x, y, 0.9, "#e2b84a");
	return (
		turret(22, 62, 4.5) +
		turret(58, 58, 4.5) +
		turret(28, 46, 5) +
		turret(53, 42, 5) +
		turret(34, 30, 5.5) +
		turret(47, 25, 5.5) +
		turret(40, 15, 6.5) +
		turret(51.5, 34, 3.6, 46) +
		turret(30.5, 40, 3.6, 52) +
		fl(40, 12) +
		fl(47, 22.5) +
		fl(28, 43.5)
	);
}

// ── the family ───────────────────────────────────────────────────────────

export const SPECIES: Species[] = [
	{ id: "saguaro", name: "Saguaro", draw: saguaro },
	{ id: "golden-barrel-cactus", name: "Golden barrel cactus", draw: goldenBarrel },
	{ id: "prickly-pear", name: "Prickly pear", draw: pricklyPear },
	{ id: "bunny-ear-cactus", name: "Bunny ear cactus", draw: bunnyEar },
	{ id: "christmas-cactus", name: "Christmas cactus", draw: christmasCactus },
	{ id: "moon-cactus", name: "Moon cactus", draw: moonCactus },
	{ id: "old-man-cactus", name: "Old man cactus", draw: oldMan },
	{ id: "echeveria", name: "Echeveria", draw: echeveria },
	{ id: "aloe-vera", name: "Aloe vera", draw: aloeVera },
	{ id: "agave", name: "Agave", draw: agave },
	{ id: "jade-plant", name: "Jade plant", draw: jade },
	{ id: "haworthia", name: "Haworthia", draw: haworthia },
	{ id: "hens-and-chicks", name: "Hens and chicks", draw: hensAndChicks },
	{ id: "string-of-pearls", name: "String of pearls", draw: stringOfPearls },
	{ id: "burros-tail", name: "Burro's tail", draw: burrosTail },
	{ id: "kalanchoe", name: "Kalanchoe", draw: kalanchoe },
	{ id: "living-stones", name: "Living stones", draw: livingStones },
	{ id: "panda-plant", name: "Panda plant", draw: pandaPlant },
	{ id: "pincushion-cactus", name: "Pincushion cactus", draw: pincushion },
	{ id: "star-cactus", name: "Star cactus", draw: starCactus },
	{ id: "ponytail-palm", name: "Ponytail palm", draw: ponytailPalm },
	{ id: "sedum", name: "Sedum", draw: sedum },
	{ id: "crown-of-thorns", name: "Crown of thorns", draw: crownOfThorns },
	{ id: "ice-plant", name: "Ice plant", draw: icePlant },
	{ id: "fairy-castle-cactus", name: "Fairy castle cactus", draw: fairyCastle },
];
