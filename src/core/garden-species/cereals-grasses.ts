/**
 * Garden species: cereals and ornamental grasses (second batch). Ancient
 * wheats, small grains and garden grasses; each bloom is the plant's own
 * head (spike, finger, plume, haze, locket, flag, puff) so the 25 stay apart
 * from each other and from the first-batch grasses at bed size.
 */
import { blade, f, leaf, line, type GrowingStage, type Species } from "./kit";

type P = [number, number];

const at = <T>(a: readonly T[], i: number): T => a[i % a.length] as T;
const rad = (d: number): number => (d * Math.PI) / 180;
/** A fixed pseudo-random number in [0, 1) for index i. */
const rnd = (i: number): number => {
	const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
	return x - Math.floor(x);
};

/** Point and tangent (degrees) on a quadratic at t. */
function qpt(a: P, c: P, b: P, t: number): { x: number; y: number; deg: number } {
	const u = 1 - t;
	const x = u * u * a[0] + 2 * u * t * c[0] + t * t * b[0];
	const y = u * u * a[1] + 2 * u * t * c[1] + t * t * b[1];
	const dx = 2 * u * (c[0] - a[0]) + 2 * t * (b[0] - c[0]);
	const dy = 2 * u * (c[1] - a[1]) + 2 * t * (b[1] - c[1]);
	return { x, y, deg: (Math.atan2(dy, dx) * 180) / Math.PI };
}

/** The part of a quadratic after t, as a new quadratic. */
function qtail(a: P, c: P, b: P, t: number): [P, P, P] {
	const p = qpt(a, c, b, t);
	return [[p.x, p.y], [c[0] + (b[0] - c[0]) * t, c[1] + (b[1] - c[1]) * t], b];
}

/** A quadratic as a path segment. */
const qd = (a: P, c: P, b: P): string => `M${f(a[0])} ${f(a[1])}Q${f(c[0])} ${f(c[1])} ${f(b[0])} ${f(b[1])}`;

/** Stroked path data. */
const ink = (d: string, stroke: string, w: number, extra = ""): string =>
	d ? `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round"${extra}/>` : "";

/** Filled path data. */
const paint = (d: string, fill: string, extra = ""): string => (d ? `<path d="${d}" fill="${fill}"${extra}/>` : "");

function qline(a: P, c: P, b: P, stroke: string, w: number): string {
	return ink(qd(a, c, b), stroke, w);
}

/** A circle as a path segment. */
const circ = (x: number, y: number, r: number): string => `M${f(x - r)} ${f(y)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0`;

/** A dot as a zero-length segment (stroke it with round caps, width 2r). */
const pt = (x: number, y: number): string => `M${f(x)} ${f(y)}h0`;

/** An ellipse as a path segment: centre (x, y), long radius a along deg, short radius b. */
function ell(x: number, y: number, a: number, b: number, deg: number): string {
	const ux = Math.cos(rad(deg)) * a;
	const uy = Math.sin(rad(deg)) * a;
	const r = `a${f(a)} ${f(b)} ${f(deg)} 0 1 `;
	return `M${f(x + ux)} ${f(y + uy)}${r}${f(-2 * ux)} ${f(-2 * uy)}${r}${f(2 * ux)} ${f(2 * uy)}Z`;
}

/** A tapering blade along a quadratic: half width w at the base a, point at b. */
function sliver(a: P, c: P, b: P, w: number): string {
	const l1 = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1;
	const flat = a[1] >= 86;
	const bx = flat ? w : (-(c[1] - a[1]) / l1) * w;
	const by = flat ? 0 : ((c[0] - a[0]) / l1) * w;
	const l2 = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
	const cx = (-(b[1] - a[1]) / l2) * w * 1.15;
	const cy = ((b[0] - a[0]) / l2) * w * 1.15;
	return `M${f(a[0] + bx)} ${f(a[1] + by)}Q${f(c[0] + cx)} ${f(c[1] + cy)} ${f(b[0])} ${f(b[1])}Q${f(c[0] - cx)} ${f(c[1] - cy)} ${f(a[0] - bx)} ${f(a[1] - by)}Z`;
}

/** Control and tip of an arching blade from (x, y) heading deg, `droop` units down at the tip. */
function archPts(x: number, y: number, deg: number, len: number, droop: number): [P, P, P] {
	const ux = Math.cos(rad(deg));
	const uy = Math.sin(rad(deg));
	return [[x, y], [x + ux * len * 0.6, y + uy * len * 0.6 - droop * 0.2], [x + ux * len, Math.min(y + uy * len + droop, y - 3)]];
}

/** n arching blades fanned from `from` to `to` degrees, merged per colour. */
function fan(x: number, y: number, n: number, from: number, to: number, len: number, droop: number, w: number, fills: readonly string[], spreadX = 0): string {
	const d: string[] = fills.map(() => "");
	for (let i = 0; i < n; i++) {
		const t = n === 1 ? 0.5 : i / (n - 1);
		const deg = from + (to - from) * t;
		const lean = Math.abs(Math.cos(rad(deg)));
		const [a, c, b] = archPts(x + (t - 0.5) * spreadX, y, deg, len * (1 - lean * 0.25), droop * lean);
		d[i % fills.length] += sliver(a, c, b, w);
	}
	return d.map((p, i) => paint(p, at(fills, i))).join("");
}

/** Paired kernels along a quadratic from t0 to the tip, optionally awned. */
function spike(a: P, c: P, b: P, t0: number, n: number, rx: number, ry: number, c1: string, c2: string, spread = 26, awn = 0, awnColor = "#c9b46a"): string {
	let k1 = "";
	let k2 = "";
	let aw = "";
	for (let k = 0; k < n; k++) {
		const p = qpt(a, c, b, t0 + ((1 - t0) * k) / n);
		const nx = Math.cos(rad(p.deg - 90)) * rx * 0.95;
		const ny = Math.sin(rad(p.deg - 90)) * rx * 0.95;
		for (const side of [1, -1]) {
			const x = p.x + nx * side;
			const y = p.y + ny * side;
			const dir = p.deg - spread * side;
			if (side > 0) k1 += ell(x, y, ry, rx, dir);
			else k2 += ell(x, y, ry, rx, dir);
			if (awn) {
				const tx = x + Math.cos(rad(dir)) * ry;
				const ty = y + Math.sin(rad(dir)) * ry;
				const ad = p.deg - spread * 0.7 * side;
				aw += `M${f(tx)} ${f(ty)}l${f(Math.cos(rad(ad)) * awn)} ${f(Math.sin(rad(ad)) * awn)}`;
			}
		}
	}
	const tip = qpt(a, c, b, 1);
	k1 += ell(tip.x, tip.y, ry, rx * 0.95, tip.deg);
	if (awn) aw += `M${f(tip.x + Math.cos(rad(tip.deg)) * ry)} ${f(tip.y + Math.sin(rad(tip.deg)) * ry)}l${f(Math.cos(rad(tip.deg)) * awn)} ${f(Math.sin(rad(tip.deg)) * awn)}`;
	return ink(aw, awnColor, 0.6) + paint(k1, c1) + paint(k2, c2);
}

/** A bristly head along a quadratic: hairs at ±splay degrees from the axis. */
function brushD(a: P, c: P, b: P, n: number, hair: number, splay: number): string {
	let d = "";
	for (let k = 0; k <= n; k++) {
		const p = qpt(a, c, b, k / n);
		const l = hair * (k === n ? 0.6 : 1 - (k / n) * 0.35);
		for (const sd of [-1, 1]) {
			const g = rad(p.deg + sd * splay);
			d += `M${f(p.x)} ${f(p.y)}l${f(Math.cos(g) * l)} ${f(Math.sin(g) * l)}`;
		}
	}
	return d;
}

/** Soft round tufts along a quadratic, radius r(t), jittered sideways; one path per colour. */
function fluff(a: P, c: P, b: P, n: number, r: (t: number) => number, colors: readonly string[], seed: number): string {
	const d: string[] = colors.map(() => "");
	for (let k = 0; k < n; k++) {
		const t = n === 1 ? 0 : k / (n - 1);
		const p = qpt(a, c, b, t);
		const rr = r(t);
		const j = (rnd(seed + k) - 0.5) * rr * 0.9;
		const x = p.x + Math.cos(rad(p.deg + 90)) * j;
		const y = p.y + Math.sin(rad(p.deg + 90)) * j;
		d[k % colors.length] += circ(x, y, rr);
	}
	return d.map((p, i) => paint(p, at(colors, i))).join("");
}

/** A tuft of needle blades fanned from -170 to -10 degrees. */
function needles(n: number, len: number, w: number, fills: readonly string[], spreadX = 8): string {
	let s = "";
	for (let i = 0; i < n; i++) {
		const t = i / (n - 1);
		const l = len * (0.55 + 0.45 * Math.sin(Math.PI * t)) * (i % 3 === 1 ? 0.86 : 1);
		s += leaf(40 + (t - 0.5) * spreadX, 86, -170 + 160 * t, l, w, { fill: at(fills, i), shape: 3, rib: false });
	}
	return s;
}

/* ---------- cereals ---------- */

function spelt(stage: GrowingStage): string {
	const g = ["#7fa874", "#98bb86"] as const;
	if (stage === "sprout") return fan(40, 87, 3, -122, -60, 20, 4, 1.6, g);
	if (stage === "leafy") return fan(40, 87, 6, -145, -40, 44, 12, 1.7, g) + qline([40, 87], [40, 62], [41, 42], "#a3ad6c", 1.1);
	let s = fan(40, 87, 5, -150, -32, 32, 12, 1.7, g);
	const heads: [P, P, P, P][] = [
		[[34, 50], [29, 31], [25, 21], [20, 9]],
		[[40, 46], [40, 28], [41, 17], [44, 6]],
		[[47, 52], [52, 34], [57, 25], [63, 15]],
	];
	for (const [c, h, hc, tip] of heads) s += qline([40, 87], c, h, "#b59a62", 1.2) + spike(h, hc, tip, 0, 7, 1.25, 2.4, "#d2a46a", "#b5844e", 38);
	return s + fan(40, 87, 2, -118, -64, 26, 5, 1.6, g);
}

function emmer(stage: GrowingStage): string {
	const g = ["#6f9f68", "#88b47c"] as const;
	if (stage === "sprout") return fan(40, 87, 3, -125, -58, 19, 5, 1.8, g);
	if (stage === "leafy") return fan(40, 87, 6, -150, -35, 42, 14, 1.9, g);
	let s = fan(40, 87, 5, -155, -28, 32, 14, 1.9, g);
	const heads: [P, P, P, P][] = [
		[[35, 52], [31, 32], [25, 21], [19, 24]],
		[[41, 48], [42, 25], [47, 15], [55, 16]],
		[[46, 58], [55, 42], [61, 36], [66, 41]],
	];
	for (const [c, h, hc, tip] of heads) s += qline([40, 87], c, h, "#b3995a", 1.3) + spike(h, hc, tip, 0, 6, 1.8, 2.7, "#d6ad5c", "#a97f3c", 22, 11, "#5a4632");
	return s;
}

function teff(stage: GrowingStage): string {
	const g = ["#86b06a", "#9cc27e", "#73a058"] as const;
	if (stage === "sprout") return fan(40, 87, 5, -140, -40, 16, 5, 0.9, g, 3);
	if (stage === "leafy") return fan(40, 87, 11, -165, -15, 34, 16, 0.9, g, 6);
	let st = "";
	let br = "";
	let g1 = "";
	let g2 = "";
	for (let i = 0; i < 7; i++) {
		const deg = -138 + i * 16;
		const lean = Math.abs(Math.cos(rad(deg)));
		const [a, c, b] = archPts(40, 86, deg, 54 - lean * 8, 8 * lean);
		st += qd(a, c, b);
		for (let k = 0; k < 6; k++) {
			const t = 0.42 + (0.58 * k) / 5;
			const p = qpt(a, c, b, t);
			for (const sd of [-1, 1]) {
				const bd = rad(p.deg + sd * (38 + rnd(i * 13 + k * 2 + sd) * 18));
				const bl = 2.5 + (1 - t) * 6;
				const qx = p.x + Math.cos(bd) * bl;
				const qy = p.y + Math.sin(bd) * bl;
				br += `M${f(p.x)} ${f(p.y)}L${f(qx)} ${f(qy)}`;
				g1 += pt(qx, qy);
				g2 += pt((p.x + qx) / 2, (p.y + qy) / 2);
			}
		}
		g1 += pt(b[0], b[1]);
	}
	return fan(40, 87, 11, -168, -12, 26, 14, 0.9, g, 6) + ink(st, "#a98a72", 0.6) + ink(br, "#b48c7e", 0.45) + ink(g2, "#c77a6a", 1.2) + ink(g1, "#93404c", 1.6);
}

function fonio(stage: GrowingStage): string {
	const g = ["#8fbd6f", "#a6cc88"] as const;
	if (stage === "sprout") return fan(40, 87, 4, -135, -45, 15, 4, 1, g, 2);
	if (stage === "leafy") return fan(40, 87, 9, -160, -20, 32, 12, 1, g, 5);
	let st = "";
	let fg = "";
	let gr = "";
	for (let i = 0; i < 6; i++) {
		const deg = -130 + i * 16;
		const lean = Math.abs(Math.cos(rad(deg)));
		const [a, c, b] = archPts(40, 86, deg, 42, 5 * lean);
		st += qd(a, c, b);
		const tip = qpt(a, c, b, 1).deg;
		for (const o of [-34, -6, 24]) {
			const d = rad(tip + o + (i % 2 ? 6 : -6));
			const l = 8;
			fg += `M${f(b[0])} ${f(b[1])}l${f(Math.cos(d) * l)} ${f(Math.sin(d) * l)}`;
			for (let k = 1; k <= 4; k++) gr += pt(b[0] + Math.cos(d) * l * (k / 4.2) + 0.6, b[1] + Math.sin(d) * l * (k / 4.2));
		}
	}
	return fan(40, 87, 9, -165, -15, 26, 12, 1, g, 5) + ink(st, "#a6a066", 0.6) + ink(fg, "#b39a5a", 0.8) + ink(gr, "#e4d39a", 1.5);
}

function triticale(stage: GrowingStage): string {
	const g = ["#6f9c96", "#86b2a8"] as const;
	if (stage === "sprout") return fan(40, 87, 3, -122, -58, 21, 4, 2.4, g);
	if (stage === "leafy") return fan(40, 87, 6, -150, -30, 46, 14, 2.7, g) + line(40, 87, 40, 44, "#7d9a76", 2);
	let s = fan(40, 87, 6, -158, -22, 36, 14, 2.7, g);
	const heads: [P, P, P, P][] = [
		[[35, 52], [32, 34], [30, 25], [29, 13]],
		[[45, 52], [48, 32], [50, 23], [52, 11]],
	];
	for (const [c, h, hc, tip] of heads) s += qline([40, 87], c, h, "#9fae74", 2) + spike(h, hc, tip, 0, 7, 2.1, 3.1, "#cdbf7a", "#a9a05a", 20, 9, "#d9cf9c");
	return s + fan(40, 87, 2, -120, -60, 28, 6, 2.4, g);
}

function amaranth(stage: GrowingStage): string {
	const stc = "#9a3346";
	const lf = ["#5d9446", "#6ea552"] as const;
	const leaves = (ys: number[], l0: number, l1: number) =>
		ys.map((y, i) => leaf(40, y, i % 2 ? -32 : -148, l0 + ((l1 - l0) * i) / Math.max(1, ys.length - 1), (l0 + ((l1 - l0) * i) / Math.max(1, ys.length - 1)) * 0.38, { fill: at(lf, i), dark: stc, shape: 1 })).join("");
	const crimson = ["#9e1f45", "#c0335c", "#82183a"] as const;
	if (stage === "sprout") return line(40, 87, 40, 72, stc, 1.6) + leaves([76, 73], 9, 8);
	if (stage === "leafy") return line(40, 87, 40, 38, stc, 2.4) + leaves([80, 72, 64, 56, 48], 16, 10) + fluff([40, 42], [40, 37], [40, 33], 4, (t) => 2.4 - t, crimson, 7);
	let s = line(40, 87, 40, 36, stc, 2.8) + leaves([82, 75, 68, 61, 54, 47], 18, 11);
	s += fluff([40, 44], [27, 36], [23, 56], 14, (t) => 2.4 - t * 1.4, crimson, 21);
	s += fluff([40, 42], [55, 35], [59, 54], 14, (t) => 2.4 - t * 1.4, crimson, 41);
	s += fluff([40, 40], [39, 10], [54, 10], 26, (t) => 3.8 - t * 2.6, crimson, 3);
	return s;
}

function einkorn(stage: GrowingStage): string {
	const g = ["#93b06e", "#a9c186"] as const;
	if (stage === "sprout") return blade(39, 35, 68, g[0], 1.2) + blade(41, 45, 67, g[1], 1.2) + blade(40, 40, 71, g[0], 1);
	if (stage === "leafy") return fan(40, 87, 8, -140, -40, 38, 10, 1.1, g, 4);
	let s = fan(40, 87, 8, -150, -30, 28, 10, 1.1, g, 4);
	const heads: [P, P, P, P][] = [
		[[34, 58], [27, 40], [22, 35], [16, 37]],
		[[38, 54], [34, 32], [31, 24], [26, 21]],
		[[40, 56], [41, 36], [42, 28], [45, 21]],
		[[43, 54], [48, 32], [53, 26], [58, 26]],
		[[46, 60], [55, 44], [59, 40], [64, 43]],
	];
	for (const [c, h, hc, tip] of heads) s += qline([40, 87], c, h, "#b9a272", 0.9) + spike(h, hc, tip, 0, 5, 1.05, 2, "#c4824e", "#a0623a", 16, 7, "#e3cc9c");
	return s;
}

function fingerMillet(stage: GrowingStage): string {
	const g = ["#5f9e4f", "#78b465"] as const;
	if (stage === "sprout") return fan(40, 87, 3, -130, -50, 18, 6, 2.2, g);
	if (stage === "leafy") return fan(40, 87, 7, -160, -20, 40, 18, 2.4, g);
	let st = "";
	let fd = "";
	for (const [x, y] of [
		[28, 28],
		[41, 18],
		[54, 30],
	] as P[]) {
		st += qd([40, 87], [40 + (x - 40) * 0.2, 50], [x, y]);
		for (const d of [-146, -118, -90, -62, -34]) {
			const curl = d < -95 ? 48 : d > -85 ? -48 : 0;
			const sx = x + Math.cos(rad(d)) * 1.2;
			const sy = y + Math.sin(rad(d)) * 1.2;
			const cx = sx + Math.cos(rad(d)) * 8;
			const cy = sy + Math.sin(rad(d)) * 8;
			const l = d === -90 ? 1 : 5;
			fd += qd([sx, sy], [cx, cy], [cx + Math.cos(rad(d + curl)) * l, cy + Math.sin(rad(d + curl)) * l]);
		}
	}
	return fan(40, 87, 7, -165, -15, 34, 18, 2.4, g) + ink(st, "#8a9a52", 1.3) + ink(fd, "#8a4e2c", 2.4) + ink(fd, "#c08048", 1.1, ` stroke-dasharray="1 1.2"`);
}

function jobsTears(stage: GrowingStage): string {
	const stc = "#7a9a50";
	const g = ["#5c9a48", "#76b05e"] as const;
	const lv = (x: number, ys: number[], len: number, droop: number) => {
		const d = ["", ""];
		ys.forEach((y, i) => {
			const [a, c, b] = archPts(x, y, i % 2 ? -28 : -152, len, droop);
			d[i % 2] += sliver(a, c, b, 2.4);
		});
		return paint(d[0] as string, g[0]) + paint(d[1] as string, g[1]);
	};
	if (stage === "sprout") return line(40, 87, 40, 72, stc, 2) + lv(40, [80, 75], 13, 3);
	if (stage === "leafy") return line(40, 87, 40, 42, stc, 2.6) + lv(40, [82, 74, 66, 58, 50], 22, 10);
	let s = line(40, 87, 40, 18, stc, 2.8) + qline([40, 66], [50, 54], [54, 34], stc, 2) + lv(40, [82, 74, 66, 56, 46, 36, 27], 22, 10) + lv(54, [44, 38], 14, 5);
	const beads: [number, number, number][] = [
		[34, 40, 0],
		[30, 45, 1],
		[46, 32, 2],
		[50, 37, 0],
		[36, 22, 1],
		[44, 18, 2],
		[60, 40, 1],
		[57, 46, 0],
		[26, 58, 2],
		[31, 62, 0],
	];
	const fills = ["#cfcac0", "#8d8578", "#6b5a4a"] as const;
	const d = ["", "", ""];
	let stalk = "";
	let hi = "";
	for (const [x, y, k] of beads) {
		stalk += `M${f(x)} ${f(y - 2.5)}l${x < 40 ? 1.5 : -1.5} -2.4`;
		d[k] += ell(x, y, 2.6, 1.95, 90);
		hi += circ(x - 0.7, y - 0.8, 0.55);
	}
	return s + ink(stalk, "#a4b878", 0.7) + d.map((p, i) => paint(p, at(fills, i))).join("") + paint(hi, "#f4f1ea", ` opacity=".8"`);
}

/* ---------- ornamental grasses ---------- */

function bloodGrass(stage: GrowingStage): string {
	const n = stage === "sprout" ? 4 : stage === "leafy" ? 8 : 12;
	const len = stage === "sprout" ? 20 : stage === "leafy" ? 44 : 60;
	const r0 = stage === "sprout" ? 0.6 : stage === "leafy" ? 0.45 : 0.28;
	let gd = "";
	const rd = ["", ""];
	for (let i = 0; i < n; i++) {
		const t = i / (n - 1);
		const deg = -124 + 68 * t + (rnd(i) - 0.5) * 6;
		const l = len * (0.78 + 0.22 * Math.sin(Math.PI * t)) * (i % 2 ? 0.9 : 1);
		const x = 40 + (t - 0.5) * 7;
		const w = stage === "sprout" ? 1.8 : 2.5;
		const ux = Math.cos(rad(deg));
		const uy = Math.sin(rad(deg));
		gd += `<g transform="translate(${f(x)} 86) rotate(${f(deg)})"><path d="M0 0C${f(l * 0.45)} ${f(-w * 1.15)} ${f(l * 0.8)} ${f(-w * 0.5)} ${f(l)} 0C${f(l * 0.8)} ${f(w * 0.5)} ${f(l * 0.45)} ${f(w * 1.15)} 0 0Z" fill="#6aa354"/></g>`;
		const sx = x + ux * l * r0;
		const sy = 86 + uy * l * r0;
		const rl = l * (1 - r0);
		const rw = w * (0.95 - r0 * 0.3);
		rd[i % 2] += `M${f(sx + uy * rw)} ${f(sy - ux * rw)}Q${f(sx + ux * rl * 0.4 + uy * rw)} ${f(sy + uy * rl * 0.4 - ux * rw)} ${f(sx + ux * rl)} ${f(sy + uy * rl)}Q${f(sx + ux * rl * 0.4 - uy * rw)} ${f(sy + uy * rl * 0.4 + ux * rw)} ${f(sx - uy * rw)} ${f(sy + ux * rw)}Z`;
	}
	return gd + paint(rd[0] as string, "#b3263a") + paint(rd[1] as string, "#cf3a4c");
}

function moorGrass(stage: GrowingStage): string {
	const g = ["#5f9a52", "#78ad66"] as const;
	if (stage === "sprout") return fan(40, 87, 5, -145, -35, 17, 6, 1.3, g, 3);
	if (stage === "leafy") return fan(40, 87, 11, -165, -15, 32, 16, 1.3, g, 6) + ink("M40 84L40 46M42 84L45 50", "#9f9a6a", 0.7);
	let st = "";
	const pd = ["", ""];
	for (let i = 0; i < 9; i++) {
		const o = i - 4;
		const bx = 40 + o * 0.6;
		const tx = 40 + o * 3.6;
		const ty = 9 + Math.abs(o) * 2.6;
		st += `M${f(bx)} 84L${f(tx)} ${f(ty)}`;
		const deg = (Math.atan2(ty - 84, tx - bx) * 180) / Math.PI;
		pd[i % 2] += `M${f(tx)} ${f(ty)}` + ell(tx - Math.cos(rad(deg)) * 7.5, ty - Math.sin(rad(deg)) * 7.5, 7.5, 1.3, deg);
	}
	return fan(40, 87, 11, -168, -12, 26, 14, 1.3, g, 6) + ink(st, "#a8956a", 0.7) + paint(pd[0] as string, "#6b4f7d") + paint(pd[1] as string, "#86679a");
}

function featherGrass(stage: GrowingStage): string {
	const n = stage === "sprout" ? 8 : stage === "leafy" ? 16 : 24;
	const h = stage === "sprout" ? 20 : stage === "leafy" ? 46 : 66;
	let gd = "";
	let yd = "";
	for (let i = 0; i < n; i++) {
		const t = i / (n - 1);
		const bx = 38 + t * 4;
		const tx = 40 + (t - 0.5) * h * 0.62 + h * 0.1 + (rnd(i) - 0.5) * 4;
		const ty = 87 - h * (0.7 + 0.3 * Math.sin(Math.PI * t)) + rnd(i + 50) * 5;
		const a: P = [bx, 86];
		const c: P = [bx + (tx - bx) * 0.25, ty - h * 0.08];
		const b: P = [tx, ty];
		gd += qd(a, c, b);
		if (stage === "bloom") yd += qd(...qtail(a, c, b, 0.5));
	}
	return ink(gd, "#8fbd6c", 0.65) + ink(yd, "#e2d297", 1.1);
}

function blueOat(stage: GrowingStage): string {
	const b = ["#7f9fb3", "#9bb6c6", "#6a8aa0"] as const;
	if (stage === "sprout") return needles(9, 18, 2.2, b, 5);
	if (stage === "leafy") return needles(19, 36, 2.5, b);
	let st = "";
	const sp = ["", ""];
	for (const deg of [-136, -114, -92, -68, -46]) {
		const lean = Math.abs(Math.cos(rad(deg)));
		const [a, c, e] = archPts(40, 85, deg, 58 - lean * 10, 14 * lean);
		st += qd(a, c, e);
		for (let k = 0; k < 4; k++) {
			const p = qpt(a, c, e, 0.66 + k * 0.11);
			const hx = p.x + (deg < -92 ? -1 : 1) * 1.6;
			st += `M${f(p.x)} ${f(p.y)}L${f(hx)} ${f(p.y + 1.8)}`;
			sp[k % 2] += ell(hx, p.y + 4.2, 2.8, 1.15, 90 + (deg < -92 ? 12 : -12));
		}
	}
	return needles(23, 38, 2.6, b) + ink(st, "#b8a47a", 0.8) + paint(sp[0] as string, "#d8c493") + paint(sp[1] as string, "#bea66e");
}

function pinkMuhly(stage: GrowingStage): string {
	const g = ["#6f9f5c", "#88b474"] as const;
	if (stage === "sprout") return fan(40, 87, 6, -150, -30, 17, 7, 0.9, g, 3);
	if (stage === "leafy") return fan(40, 87, 15, -170, -10, 36, 22, 0.9, g, 6);
	let big = "";
	let mid = "";
	let st = "";
	let sp = "";
	let i = 0;
	for (let y = 30; y <= 66; y += 6) {
		const v = (y - 52) / 23;
		const hw = 30 * Math.sqrt(Math.max(0, 1 - v * v));
		for (let x = 40 - hw + 4; x <= 40 + hw - 4; x += 5) {
			const jx = x + (rnd(i) - 0.5) * 3;
			const jy = y + (rnd(i + 99) - 0.5) * 3;
			big += pt(jx, jy);
			if (i % 3 === 0) mid += pt(jx + 1, jy + 1.5);
			if (i % 2 === 0) st += `M40 85L${f(jx)} ${f(jy)}`;
			sp += pt(jx - 2, jy - 2);
			i++;
		}
	}
	return fan(40, 87, 15, -172, -8, 30, 18, 0.9, g, 6) + ink(big, "#e08fbd", 10, ` opacity=".62"`) + ink(st, "#c56f9c", 0.45) + ink(mid, "#f2b3d3", 1.1);
}

function hairGrass(stage: GrowingStage): string {
	const g = ["#3f6d3a", "#4f8447", "#356032"] as const;
	if (stage === "sprout") return fan(40, 87, 6, -150, -30, 16, 6, 1, g, 3);
	if (stage === "leafy") return fan(40, 87, 15, -170, -10, 32, 16, 1, g, 6) + ink("M40 84L37 44M41 84L46 48", "#b9a874", 0.5);
	let st = "";
	let br = "";
	let d1 = "";
	let d2 = "";
	let veil = "";
	for (let i = 0; i < 12; i++) {
		const t = i / 11;
		const tx = 21 + t * 38;
		const ty = 10 + Math.abs(t - 0.5) * 26 + rnd(i) * 4;
		const bx = 40 + (t - 0.5) * 4;
		st += `M${f(bx)} 84L${f(tx)} ${f(ty)}`;
		const dx = (tx - bx) / (84 - ty);
		for (let k = 0; k < 9; k++) {
			const y = ty + 1 + k * 2.2;
			const x = tx - dx * (y - ty);
			const sd = k % 2 ? 1 : -1;
			const ex = x + sd * (1.2 + rnd(i * 9 + k) * (1.5 + k * 0.45));
			const ey = y - 1 - rnd(i * 7 + k) * 1.5;
			br += `M${f(x)} ${f(y)}L${f(ex)} ${f(ey)}`;
			if ((k + i) % 3) d1 += pt(ex, ey);
			else d2 += pt(ex, ey);
		}
		veil += pt(tx - dx * 6, ty + 6) + pt(tx - dx * 13, ty + 13);
	}
	return ink(veil, "#e3d39c", 9, ` opacity=".26"`) + fan(40, 87, 15, -172, -8, 26, 14, 1, g, 6) + ink(st, "#c4b07a", 0.45) + ink(br, "#cdb985", 0.4) + ink(d1, "#e6d48e", 1.3) + ink(d2, "#c4a862", 1.3);
}

function quakingGrass(stage: GrowingStage): string {
	const g = ["#8fbb6c", "#a7c988"] as const;
	if (stage === "sprout") return fan(40, 87, 4, -140, -40, 16, 5, 1.3, g, 2);
	if (stage === "leafy") return fan(40, 87, 8, -160, -20, 26, 10, 1.4, g, 4) + qline([40, 86], [40, 64], [43, 46], "#a8a06a", 0.7);
	let st = "";
	const lk = ["", "", ""];
	let chev = "";
	const tops: P[] = [
		[27, 22],
		[42, 11],
		[56, 22],
	];
	let i = 0;
	for (const [tx, ty] of tops) {
		st += qd([40, 86], [40 + (tx - 40) * 0.15, 50], [tx, ty]);
		for (let k = 0; k < 4; k++) {
			const y = ty + 2 + k * 7;
			const x = tx + (40 - tx) * ((y - ty) / (86 - ty)) * 0.6;
			const side = k % 2 ? 1 : -1;
			const lx = x + side * (5 + (k % 2));
			const ly = y + 5;
			st += `M${f(x)} ${f(y)}Q${f(x + side * 4)} ${f(y - 1)} ${f(lx)} ${f(ly - 3)}`;
			lk[i % 3] += ell(lx, ly, 3.2, 2.5, 90);
			chev += `M${f(lx - 1.8)} ${f(ly - 1)}L${f(lx)} ${f(ly + 0.4)}L${f(lx + 1.8)} ${f(ly - 1)}M${f(lx - 1.6)} ${f(ly + 1)}L${f(lx)} ${f(ly + 2.2)}L${f(lx + 1.6)} ${f(ly + 1)}`;
			i++;
		}
		lk[i % 3] += ell(tx, ty + 3, 3, 2.3, 90);
		i++;
	}
	return fan(40, 87, 8, -165, -15, 24, 10, 1.4, g, 4) + ink(st, "#a8a06a", 0.6) + paint(lk[0] as string, "#d6cf86") + paint(lk[1] as string, "#c4b866") + paint(lk[2] as string, "#c3a77a") + ink(chev, "#8f8448", 0.5);
}

function bunnyTail(stage: GrowingStage): string {
	const g = ["#a4b68e", "#b9c7a5"] as const;
	if (stage === "sprout") return fan(40, 87, 5, -150, -30, 15, 5, 1.6, g, 2);
	if (stage === "leafy") return fan(40, 87, 10, -165, -15, 28, 10, 1.8, g, 4) + qline([40, 86], [39, 66], [36, 48], "#bfc29c", 0.7) + ell(35.6, 46, 3, 1.8, -95);
	let st = "";
	let rim = "";
	let puff = "";
	let hi = "";
	for (const [tx, ty] of [
		[25, 32],
		[32, 21],
		[41, 14],
		[50, 20],
		[57, 31],
		[45, 34],
	] as P[]) {
		const a: P = [40, 86];
		const c: P = [40 + (tx - 40) * 0.3, 55];
		st += qd(a, c, [tx, ty + 4]);
		const deg = qpt(a, c, [tx, ty + 4], 1).deg;
		rim += ell(tx, ty, 5.3, 3.4, deg);
		puff += ell(tx - 0.3, ty - 0.3, 4.7, 2.9, deg);
		hi += ell(tx - 1, ty - 1.2, 2.2, 1.2, deg);
	}
	return fan(40, 87, 10, -168, -12, 24, 10, 1.8, g, 4) + ink(st, "#bfc29c", 0.7) + paint(rim, "#d3cbb4") + paint(puff, "#efe9d8") + paint(hi, "#fbf8f0");
}

function giantFeather(stage: GrowingStage): string {
	const g = ["#6f9662", "#86ab76"] as const;
	if (stage === "sprout") return fan(40, 87, 6, -150, -30, 15, 6, 1.2, g, 3);
	if (stage === "leafy") return fan(40, 87, 13, -168, -12, 28, 14, 1.2, g, 6) + qline([40, 84], [41, 66], [43, 42], "#c7a45e", 0.8);
	let st = "";
	let br = "";
	let awn = "";
	const sp = ["", ""];
	for (const [tx, ty] of [
		[23, 14],
		[35, 6],
		[47, 8],
		[59, 15],
	] as P[]) {
		st += qd([40, 84], [40 + (tx - 40) * 0.25, 40], [tx, ty]);
		for (let k = 0; k < 5; k++) {
			const y = ty + k * 4.2;
			const x = tx - (tx - 40) * 0.012 * k * 4.2;
			for (const sd of [-1, 1]) {
				if (k === 0 && sd > 0) continue;
				const ex = x + sd * (4 + k * 0.9);
				const ey = y + 3.5 + k * 0.6;
				br += `M${f(x)} ${f(y)}Q${f(x + sd * 3)} ${f(y)} ${f(ex)} ${f(ey)}`;
				sp[(k + (sd > 0 ? 1 : 0)) % 2] += ell(ex, ey + 2.4, 2.6, 1, 90 - sd * 10);
				awn += `M${f(ex - sd * 0.4)} ${f(ey + 5)}l${f(-sd * 0.8)} 4`;
			}
		}
	}
	return fan(40, 87, 13, -170, -10, 22, 12, 1.2, g, 6) + ink(st, "#c7a45e", 0.8) + ink(br, "#c7a45e", 0.5) + ink(awn, "#e2c98a", 0.4) + paint(sp[0] as string, "#dca83a") + paint(sp[1] as string, "#bf8d2a");
}

function blueGrama(stage: GrowingStage): string {
	const b = ["#8aa5a6", "#a3bbb9", "#768f92"] as const;
	if (stage === "sprout") return fan(40, 87, 6, -150, -30, 15, 6, 0.9, b, 3);
	if (stage === "leafy") return fan(40, 87, 13, -168, -12, 30, 12, 0.9, b, 6) + qline([40, 85], [41, 70], [44, 54], "#b39a86", 0.6);
	let st = "";
	let bar = "";
	let teeth = "";
	let pollen = "";
	const flag = (x: number, y: number, side: number) => {
		const a: P = [x, y];
		const c: P = [x + side * 6, y - 3.5];
		const e: P = [x + side * 11.5, y + 1.5];
		bar += qd(a, c, e);
		for (let k = 1; k <= 9; k++) {
			const p = qpt(a, c, e, k / 9.5);
			const nd = rad(p.deg + side * 90);
			const ex = p.x + Math.cos(nd) * 2.8;
			const ey = p.y + Math.sin(nd) * 2.8;
			teeth += `M${f(p.x)} ${f(p.y)}L${f(ex)} ${f(ey)}`;
			if (k % 2) pollen += circ(ex, ey, 0.5);
		}
	};
	for (const [tx, ty, side, two] of [
		[23, 44, -1, 0],
		[31, 31, -1, 1],
		[39, 24, 1, 0],
		[46, 30, 1, 1],
		[54, 38, 1, 0],
	] as [number, number, number, number][]) {
		st += qd([40, 85], [40 + (tx - 40) * 0.3, 60], [tx, ty]);
		flag(tx, ty, side);
		if (two) flag(tx + side * 0.6, ty + 5, side);
	}
	return fan(40, 87, 13, -170, -10, 28, 12, 0.9, b, 6) + ink(st, "#b39a86", 0.6) + ink(teeth, "#b98aa0", 0.7) + ink(bar, "#7d5168", 1.3) + paint(pollen, "#e3c56a");
}

function squirreltail(stage: GrowingStage): string {
	const g = ["#86ae72", "#9dc088"] as const;
	if (stage === "sprout") return fan(40, 87, 3, -128, -52, 18, 5, 1.4, g);
	if (stage === "leafy") return fan(40, 87, 7, -152, -28, 38, 12, 1.4, g) + qline([40, 86], [40, 66], [44, 48], "#b79aa4", 0.8);
	let st = "";
	let pale = "";
	let pink = "";
	for (const deg of [-132, -111, -90, -69, -48]) {
		const lean = Math.abs(Math.cos(rad(deg)));
		const [a, c, b] = archPts(40, 86, deg, 54 - lean * 6, 24 * lean);
		const [ta, tc, tb] = qtail(a, c, b, 0.55);
		st += qd(a, c, b);
		pale += brushD(ta, tc, tb, 10, 6.5, 12);
		pink += brushD(ta, tc, tb, 10, 9.5, 20);
	}
	return fan(40, 87, 7, -155, -25, 30, 10, 1.4, g) + ink(st, "#b79aa4", 0.8) + ink(pink, "#e3b6c8", 0.5) + ink(pale, "#cfdcbc", 0.5);
}

function rubyGrass(stage: GrowingStage): string {
	const g = ["#7fa78f", "#97baa5", "#6d9580"] as const;
	if (stage === "sprout") return fan(40, 87, 4, -140, -40, 17, 6, 1.5, g, 2);
	if (stage === "leafy") return fan(40, 87, 11, -165, -15, 32, 14, 1.6, g, 5) + qline([40, 85], [40, 66], [42, 50], "#a8768a", 0.7) + fluff([42, 50], [42.5, 46], [43, 42], 4, () => 1.4, ["#c23a62", "#e07a9a"], 5);
	let s = fan(40, 87, 11, -168, -12, 28, 12, 1.6, g, 5);
	let st = "";
	let pl = "";
	let i = 0;
	for (const [tx, ty] of [
		[25, 34],
		[33, 22],
		[43, 15],
		[52, 22],
		[59, 34],
	] as P[]) {
		const a: P = [40, 85];
		const c: P = [40 + (tx - 40) * 0.3, 60];
		st += qd(a, c, [tx, ty + 11]);
		const d = qpt(a, c, [tx, ty + 11], 1).deg;
		const e: P = [tx + Math.cos(rad(d)) * 0, ty];
		pl += fluff([tx, ty + 12], [tx + Math.cos(rad(d)) * 6, ty + 6], e, 13, (t) => 0.9 + 1.5 * Math.sin(Math.PI * (0.15 + 0.8 * t)), ["#b8305a", "#d9587e", "#ea93ae"], i * 17);
		i++;
	}
	return s + ink(st, "#a8768a", 0.7) + pl;
}

function lymeGrass(stage: GrowingStage): string {
	const b = ["#8fb0c4", "#a8c3d3", "#7a9cb2"] as const;
	if (stage === "sprout") return fan(40, 87, 3, -130, -50, 20, 6, 2.4, b);
	if (stage === "leafy") return fan(40, 87, 7, -160, -20, 42, 18, 2.8, b);
	let s = fan(40, 87, 8, -166, -14, 38, 22, 2.8, b, 4);
	const heads: [P, P, P, P][] = [
		[[35, 54], [32, 36], [31, 27], [30, 15]],
		[[40, 50], [40, 30], [40, 20], [41, 8]],
		[[45, 54], [49, 37], [51, 28], [53, 17]],
	];
	for (const [c, h, hc, tip] of heads) s += qline([40, 87], c, h, "#93a9b6", 1.3) + spike(h, hc, tip, 0, 8, 1.6, 2.5, "#c3d0d8", "#9fb3c0", 14);
	return s;
}

function timothy(stage: GrowingStage): string {
	const g = ["#76a85c", "#8dbb70"] as const;
	if (stage === "sprout") return blade(39, 34, 68, g[0], 1.5) + blade(41, 46, 66, g[1], 1.5) + blade(40, 41, 72, g[0], 1.2);
	if (stage === "leafy") return fan(40, 87, 7, -130, -50, 42, 8, 1.5, g) + line(40, 86, 42, 38, "#8aa46a", 0.9) + `<rect x="40.6" y="32" width="2.8" height="9" rx="1.4" fill="#b2bd86"/>`;
	let st = "";
	let rect = "";
	let an = "";
	for (const [x, top, h, tilt] of [
		[29, 12, 18, -9],
		[38, 6, 20, -2],
		[47, 10, 18, 5],
		[55, 22, 15, 13],
	] as [number, number, number, number][]) {
		const by = top + h;
		const bx = x + Math.sin(rad(-tilt)) * 0;
		st += `M40 86L${f(bx)} ${f(by)}`;
		let dots = "";
		for (let y = top + 1.6; y < by - 0.8; y += 2.2) dots += circ(x - 1.9, y, 0.5) + circ(x + 1.9, y + 1.1, 0.5);
		rect += `<g transform="rotate(${tilt} ${x} ${by})"><rect x="${f(x - 1.7)}" y="${top}" width="3.4" height="${h}" rx="1.7" fill="#b2bd86"/>${paint(dots, "#8d6aa6")}</g>`;
	}
	return fan(40, 87, 7, -140, -40, 34, 10, 1.5, g) + ink(st, "#97a873", 0.9) + rect + an;
}

function bluegrass(stage: GrowingStage): string {
	const g = ["#3f8a4a", "#4f9c58", "#357a40"] as const;
	if (stage === "sprout") return fan(40, 87, 8, -155, -25, 13, 4, 0.9, g, 8);
	if (stage === "leafy") return fan(40, 87, 22, -170, -10, 30, 10, 0.9, g, 26);
	let st = "";
	let br = "";
	let d1 = "";
	let d2 = "";
	for (const [tx, ty] of [
		[22, 40],
		[31, 30],
		[40, 24],
		[49, 29],
		[58, 38],
	] as P[]) {
		st += `M${f(40 + (tx - 40) * 0.5)} 84L${f(tx)} ${f(ty)}`;
		for (let k = 0; k < 4; k++) {
			const y = ty + 3 + k * 4;
			const x = tx + ((40 + (tx - 40) * 0.5 - tx) * (y - ty)) / (84 - ty);
			const l = 2.6 + k * 2;
			for (const sd of [-1, 1]) {
				const ex = x + sd * l * 0.85;
				const ey = y - l * 0.5;
				br += `M${f(x)} ${f(y)}L${f(ex)} ${f(ey)}`;
				d1 += pt(ex, ey);
				if (k > 1) d2 += pt((x + ex) / 2, (y + ey) / 2 - 0.4);
			}
		}
		d1 += pt(tx, ty - 0.6);
	}
	return fan(40, 87, 24, -172, -8, 26, 10, 0.9, g, 28) + ink(st, "#93a582", 0.55) + ink(br, "#93a582", 0.45) + ink(d1, "#a097c8", 1.8) + ink(d2, "#a9b88c", 1.4);
}

function kangarooGrass(stage: GrowingStage): string {
	const g = ["#8f9a5a", "#b0844a", "#a3a35c", "#9c6e3e"] as const;
	if (stage === "sprout") return fan(40, 87, 4, -140, -40, 17, 6, 1.3, g, 2);
	if (stage === "leafy") return fan(40, 87, 11, -165, -15, 34, 18, 1.3, g, 5);
	let st = "";
	let aw = "";
	const sp = ["", ""];
	for (const deg of [-134, -113, -92, -68, -46]) {
		const lean = Math.abs(Math.cos(rad(deg)));
		const [a, c, b] = archPts(40, 86, deg, 56 - lean * 10, 14 * lean);
		st += qd(a, c, b);
		const side = deg < -92 ? -1 : 1;
		for (let k = 0; k < 3; k++) {
			const x = b[0] + side * (k - 1) * 3;
			const y = b[1] + 1 + (k === 1 ? 0 : 1.5);
			st += `M${f(b[0])} ${f(b[1])}L${f(x)} ${f(y + 1)}`;
			sp[k % 2] += ell(x, y + 4.4, 3.4, 1.7, 90 - side * 8);
			aw += `M${f(x)} ${f(y + 7.6)}l${f(side * 1.2)} 2l-1.6 1.8l1.4 2.2l-1 2`;
		}
	}
	return fan(40, 87, 11, -168, -12, 30, 18, 1.3, g, 5) + ink(st, "#a8784a", 0.8) + ink(aw, "#3a2a20", 0.6, ` stroke-linejoin="round"`) + paint(sp[0] as string, "#a5442a") + paint(sp[1] as string, "#c4632f");
}

const ENTRIES: [string, (stage: GrowingStage) => string][] = [
	["Spelt", spelt],
	["Emmer", emmer],
	["Teff", teff],
	["Fonio", fonio],
	["Triticale", triticale],
	["Grain amaranth", amaranth],
	["Einkorn", einkorn],
	["Finger millet", fingerMillet],
	["Job's tears", jobsTears],
	["Japanese blood grass", bloodGrass],
	["Purple moor grass", moorGrass],
	["Mexican feather grass", featherGrass],
	["Blue oat grass", blueOat],
	["Pink muhly grass", pinkMuhly],
	["Tufted hair grass", hairGrass],
	["Quaking grass", quakingGrass],
	["Bunny tail grass", bunnyTail],
	["Giant feather grass", giantFeather],
	["Blue grama", blueGrama],
	["Squirreltail barley", squirreltail],
	["Ruby grass", rubyGrass],
	["Blue lyme grass", lymeGrass],
	["Timothy", timothy],
	["Kentucky bluegrass", bluegrass],
	["Kangaroo grass", kangarooGrass],
];

export const SPECIES: Species[] = ENTRIES.map(([name, draw]) => ({
	id: name
		.toLowerCase()
		.replace(/'/g, "")
		.replace(/[^a-z0-9]+/g, "-"),
	name,
	draw,
}));
