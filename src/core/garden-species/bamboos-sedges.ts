/**
 * Garden species: bamboos, reeds and sedges (second batch). Culms, rushes and
 * tufts in the shared flat style (see kit.ts); each bloom is the plant's
 * signature: coloured or swollen culms, plumes, burrs, cotton, catkins,
 * umbrella bracts, corkscrew stems, corms.
 */
import { f, type GrowingStage, type Species } from "./kit";

type P = [number, number];

const rad = (d: number): number => (d * Math.PI) / 180;
const at = <T>(a: readonly T[], i: number): T => a[i % a.length] as T;

/** Merges path data per fill / stroke style into one <path> each, in first-seen order. */
class Ink {
	private parts = new Map<string, string>();
	fill(c: string, d: string): this {
		return this.put(`f|${c}`, d);
	}
	line(c: string, w: number, d: string): this {
		return this.put(`s|${c}|${w}`, d);
	}
	private put(k: string, d: string): this {
		this.parts.set(k, (this.parts.get(k) ?? "") + d);
		return this;
	}
	toString(): string {
		return [...this.parts]
			.map(([k, d]) => {
				const [t, c, w] = k.split("|");
				return t === "f" ? `<path d="${d}" fill="${c}"/>` : `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
			})
			.join("");
	}
}

const seg = (x1: number, y1: number, x2: number, y2: number): string => `M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}`;
const qd = (a: P, c: P, b: P): string => `M${f(a[0])} ${f(a[1])}Q${f(c[0])} ${f(c[1])} ${f(b[0])} ${f(b[1])}`;

/** A circle as path data. */
const dot = (x: number, y: number, r: number): string => `M${f(x - r)} ${f(y)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;

/** An ellipse as path data: centre (x, y), long radius a along deg, short radius b. */
function ell(x: number, y: number, a: number, b: number, deg: number): string {
	const ux = Math.cos(rad(deg)) * a;
	const uy = Math.sin(rad(deg)) * a;
	return `M${f(x + ux)} ${f(y + uy)}A${f(a)} ${f(b)} ${f(deg)} 0 1 ${f(x - ux)} ${f(y - uy)}A${f(a)} ${f(b)} ${f(deg)} 0 1 ${f(x + ux)} ${f(y + uy)}Z`;
}

/** A pointed leaf from (x, y) heading deg, half width w, its tip dropped by `droop`. */
function lf(x: number, y: number, deg: number, len: number, w: number, droop = 0): string {
	const ux = Math.cos(rad(deg));
	const uy = Math.sin(rad(deg));
	const tx = x + ux * len;
	const ty = y + uy * len + droop;
	const mx = x + ux * len * 0.45;
	const my = y + uy * len * 0.45 + droop * 0.3;
	const nx = -uy * w * 2;
	const ny = ux * w * 2;
	return `M${f(x)} ${f(y)}Q${f(mx + nx)} ${f(my + ny)} ${f(tx)} ${f(ty)}Q${f(mx - nx)} ${f(my - ny)} ${f(x)} ${f(y)}Z`;
}

/** Point and tangent (degrees) on a quadratic at t. */
function qpt(a: P, c: P, b: P, t: number): { x: number; y: number; deg: number } {
	const u = 1 - t;
	const x = u * u * a[0] + 2 * u * t * c[0] + t * t * b[0];
	const y = u * u * a[1] + 2 * u * t * c[1] + t * t * b[1];
	const dx = 2 * u * (c[0] - a[0]) + 2 * t * (b[0] - c[0]);
	const dy = 2 * u * (c[1] - a[1]) + 2 * t * (b[1] - c[1]);
	return { x, y, deg: (Math.atan2(dy, dx) * 180) / Math.PI };
}

/** A tapering blade along a quadratic: half width w at the base a, point at b. */
function sliver(a: P, c: P, b: P, w: number): string {
	const flat = a[1] >= 86;
	const l1 = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1;
	const bx = flat ? w : (-(c[1] - a[1]) / l1) * w;
	const by = flat ? 0 : ((c[0] - a[0]) / l1) * w;
	const l2 = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
	const cx = (-(b[1] - a[1]) / l2) * w * 1.15;
	const cy = ((b[0] - a[0]) / l2) * w * 1.15;
	return `M${f(a[0] + bx)} ${f(a[1] + by)}Q${f(c[0] + cx)} ${f(c[1] + cy)} ${f(b[0])} ${f(b[1])}Q${f(c[0] - cx)} ${f(c[1] - cy)} ${f(a[0] - bx)} ${f(a[1] - by)}Z`;
}

/** The control and tip of an arching blade from (x, y) heading deg, `droop` units down at the tip. */
function archPts(x: number, y: number, deg: number, len: number, droop: number): [P, P, P] {
	const ux = Math.cos(rad(deg));
	const uy = Math.sin(rad(deg));
	return [[x, y], [x + ux * len * 0.6, y + uy * len * 0.6 - droop * 0.2], [x + ux * len, Math.min(y + uy * len + droop, y - 3)]];
}

/** n arching blades fanned between two angles, each blade's [a, c, b] handed to `each`. */
function fanPts(x: number, n: number, from: number, to: number, len: number, droop: number, spread = 0, each: (p: [P, P, P], i: number) => void): void {
	for (let i = 0; i < n; i++) {
		const t = n === 1 ? 0.5 : i / (n - 1);
		const deg = from + (to - from) * t;
		const lean = Math.abs(Math.cos(rad(deg)));
		const l = len * (1 - lean * 0.25) * (i % 3 === 1 ? 0.88 : 1);
		each(archPts(x + (t - 0.5) * spread, 87, deg, l, droop * lean), i);
	}
}

/** A straight culm with node rings every `gap` (rings cut across, ringW wide). */
function culm(ink: Ink, x0: number, tx: number, ty: number, w: number, col: string, node: string, gap: number, nodeW = 0.9, y0 = 87): void {
	ink.line(col, w, seg(x0, y0, tx, ty));
	const L = Math.hypot(tx - x0, ty - y0);
	const ux = (tx - x0) / L;
	const uy = (ty - y0) / L;
	let d = "";
	for (let s = gap; s < L - 2; s += gap) {
		const x = x0 + ux * s;
		const y = y0 + uy * s;
		d += seg(x + uy * w * 0.55, y - ux * w * 0.55, x - uy * w * 0.55, y + ux * w * 0.55);
	}
	if (d) ink.line(node, nodeW, d);
}

/** A point at fraction t along a straight culm. */
const along = (x0: number, tx: number, ty: number, t: number, y0 = 87): P => [x0 + (tx - x0) * t, y0 + (ty - y0) * t];

/** A bamboo leaf spray: a twig then n drooping lance leaves fanned outward on side s. */
function spray(ink: Ink, x: number, y: number, s: number, n: number, len: number, w: number, cols: readonly string[], twig: string, from = -25, span = 70): void {
	const tx = x + s * 4;
	const ty = y - 2;
	ink.line(twig, 0.7, seg(x, y, tx, ty));
	for (let i = 0; i < n; i++) {
		const a = from + (n === 1 ? span / 2 : (i * span) / (n - 1));
		ink.fill(at(cols, i), lf(tx, ty, s > 0 ? a : 180 - a, len, w, len * 0.15));
	}
}

/* ---------- bamboos ---------- */

function clumpBamboo(stage: GrowingStage, c: { culm: string; node: string; hi?: string; leaves: readonly string[]; twig: string; zig?: boolean }): string {
	const ink = new Ink();
	const culms: [number, number, number][] =
		stage === "sprout"
			? [[40, 40, 67]]
			: stage === "leafy"
				? [
						[37, 34, 42],
						[43, 46, 38],
					]
				: [
						[34, 27, 12],
						[40, 41, 9],
						[46, 54, 15],
					];
	const w = stage === "sprout" ? 2.4 : stage === "leafy" ? 2.8 : 3.2;
	const gap = stage === "sprout" ? 5 : 7.5;
	for (const [x0, tx, ty] of culms) {
		if (c.zig && stage !== "sprout") {
			// golden bamboo: short crooked internodes at the foot
			let px = x0;
			let py = 87;
			let d = "";
			const knots: P[] = [];
			for (let k = 1; k <= 4; k++) {
				const nx = x0 + (tx - x0) * (k * 0.06) + (k % 2 ? 0.7 : -0.7);
				const ny = 87 - k * 4.5;
				d += seg(px, py, nx, ny);
				knots.push([nx, ny]);
				px = nx;
				py = ny;
			}
			ink.line(c.culm, w, d);
			culm(ink, px, tx, ty, w, c.culm, c.node, gap, 0.9, py);
			ink.line(c.node, 1.1, knots.map(([x, y]) => seg(x - w * 0.6, y, x + w * 0.6, y)).join(""));
		} else culm(ink, x0, tx, ty, w, c.culm, c.node, gap);
		if (c.hi) ink.line(c.hi, 0.6, seg(x0 - w * 0.25, 85, tx - w * 0.25, ty + 2));
	}
	if (stage === "sprout") {
		spray(ink, 40, 74, 1, 2, 8, 1.6, c.leaves, c.twig);
		ink.fill(c.leaves[0]!, lf(40, 67, -70, 8, 1.6)).fill(at(c.leaves, 1), lf(40, 67, -118, 7.5, 1.5));
		return ink.toString();
	}
	const ts = stage === "leafy" ? [0.35, 0.55, 0.75, 0.95] : [0.4, 0.52, 0.64, 0.76, 0.88, 1];
	const len = stage === "leafy" ? 9.5 : 10.5;
	culms.forEach(([x0, tx, ty], ci) => {
		ts.forEach((t, k) => {
			const [x, y] = along(x0, tx, ty, t);
			const s = (k + ci) % 2 ? 1 : -1;
			const side = ci === 0 ? (k % 3 === 2 ? 1 : -1) : ci === culms.length - 1 ? (k % 3 === 2 ? -1 : 1) : s;
			spray(ink, x, y, side, 3, len, 1.6, c.leaves, c.twig, 0, 60);
		});
	});
	return ink.toString();
}

function blackBamboo(stage: GrowingStage): string {
	return clumpBamboo(stage, { culm: "#4e3646", node: "#9c8794", hi: "#7d6474", leaves: ["#4f8a40", "#679f50"], twig: "#5a4452" });
}

function goldenBamboo(stage: GrowingStage): string {
	return clumpBamboo(stage, { culm: "#dcb94a", node: "#8a9a3a", leaves: ["#93c464", "#aed47c"], twig: "#b89a3a", zig: true });
}

function mosoBamboo(stage: GrowingStage): string {
	const ink = new Ink();
	const cul = "#94aa76";
	const node = "#5f7a48";
	const band = "#dfe6d2";
	const lv = ["#79ab58", "#93bf6c", "#6a9a4c"] as const;
	const shoot = (x: number, h: number, w: number) => {
		ink.fill("#8b6a43", `M${f(x - w)} 87Q${f(x - w * 0.8)} ${f(87 - h * 0.55)} ${f(x)} ${f(87 - h)}Q${f(x + w * 0.8)} ${f(87 - h * 0.55)} ${f(x + w)} 87Z`);
		let d = "";
		for (let k = 1; k < 5; k++) {
			const y = 87 - (h * k) / 5;
			const hw = w * (1 - (k / 5) ** 1.4) * 0.95;
			d += `M${f(x - hw)} ${f(y + 1.2)}Q${f(x)} ${f(y - 1.4)} ${f(x + hw)} ${f(y + 1.2)}`;
		}
		ink.line("#5e4428", 0.8, d);
		ink.fill("#4a3420", dot(x - w * 0.3, 87 - h * 0.25, 0.5) + dot(x + w * 0.3, 87 - h * 0.45, 0.5) + dot(x - w * 0.15, 87 - h * 0.6, 0.4));
	};
	if (stage === "sprout") {
		shoot(40, 22, 6);
		ink.fill(lv[0], lf(40, 66, -70, 5, 1)).fill(lv[1], lf(40, 66, -110, 5, 1));
		return ink.toString();
	}
	const big = (x0: number, tx: number, ty: number, w: number, bend: number, crown: number) => {
		culm(ink, x0, tx, ty, w, cul, node, 8, 1);
		const L = 87 - ty;
		let d = "";
		for (let s = 8; s < L - 2; s += 8) {
			const [x, y] = along(x0, tx, ty, s / L);
			d += seg(x - w * 0.5, y + 1.3, x + w * 0.5, y + 1.3);
		}
		ink.line(band, 1, d);
		// feathery crown: fine twigs with many small leaves, leaning `bend`
		for (let k = 0; k < crown; k++) {
			const t = 0.45 + (0.55 * k) / crown;
			const [x, y] = along(x0, tx, ty, t);
			const s = k % 2 ? 1 : -1;
			const l = 6 + (1 - Math.abs(t - 0.75) * 2.5) * 8 + (s === Math.sign(bend) ? 3 : 0);
			const ex = x + s * l;
			const ey = y - 3 + l * 0.25;
			ink.line("#6f8a52", 0.6, `M${f(x)} ${f(y)}Q${f(x + s * l * 0.5)} ${f(y - 4)} ${f(ex)} ${f(ey)}`);
			for (let j = 0; j < 4; j++) {
				const px = x + s * l * (0.35 + j * 0.2);
				const py = y - 3.2 + j * 0.9;
				ink.fill(at(lv, j + k), lf(px, py, s > 0 ? 55 - j * 10 : 125 + j * 10, 5.5, 1, 0.6));
			}
		}
	};
	if (stage === "leafy") {
		big(40, 40, 38, 4.2, 1, 6);
		shoot(31, 12, 3.6);
		return ink.toString();
	}
	big(30, 26, 40, 3.2, -1, 5);
	big(42, 46, 10, 5, 1, 9);
	shoot(55, 11, 3.4);
	return ink.toString();
}

function buddhasBelly(stage: GrowingStage): string {
	const ink = new Ink();
	const body = "#88b04e";
	const hi = "#a9cc72";
	const node = "#4f7a2c";
	const lv = ["#6aa64e", "#86bb62"] as const;
	const belly = (x0: number, n: number, h: number, rx: number, lean: number, thinTo: number) => {
		let y = 87;
		let x = x0;
		let rings = "";
		for (let k = 0; k < n; k++) {
			const cy = y - h / 2;
			const r = rx * (1 - k * 0.06);
			ink.fill(body, ell(x + lean * 0.5, cy, h / 2 + 0.3, r, 90));
			ink.fill(hi, ell(x + lean * 0.5 - r * 0.45, cy - 0.4, h * 0.3, r * 0.22, 90));
			x += lean;
			y -= h;
			rings += seg(x - 1.4, y, x + 1.4, y);
		}
		// slender upper culm
		culm(ink, x, x + lean * 2, thinTo, 1.8, body, node, 7, 0.9, y);
		ink.line(node, 1.2, rings);
		return [x, y, x + lean * 2, thinTo] as const;
	};
	if (stage === "sprout") {
		const [, y] = belly(40, 2, 5.5, 2.4, 0, 70);
		spray(ink, 40, y - 1, 1, 2, 7, 1.5, lv, node);
		ink.fill(lv[0], lf(40, 70, -70, 7, 1.5)).fill(lv[1], lf(40, 70, -115, 7, 1.4));
		return ink.toString();
	}
	const tops =
		stage === "leafy"
			? [belly(36, 3, 6.5, 3.4, -0.5, 44), belly(45, 4, 6.5, 3.5, 0.4, 38)]
			: [belly(31, 4, 7, 3.6, -1, 22), belly(41, 5, 7.2, 3.9, 0.2, 10), belly(51, 4, 7, 3.6, 1, 24)];
	const len = stage === "leafy" ? 9 : 10;
	tops.forEach(([x, y, tx, ty], ci) => {
		for (let k = 0; k < 4; k++) {
			const t = 0.15 + k * 0.28;
			const [px, py] = along(x, tx, ty, t, y);
			const s = ci === 0 ? -1 : ci === tops.length - 1 ? 1 : k % 2 ? 1 : -1;
			spray(ink, px, py, k === 3 ? -s : s, 3, len, 1.6, lv, node, 0, 60);
		}
	});
	return ink.toString();
}

/** Arching culms from the base, each [tipX, tipY, ctrlLift]. */
function arching(ink: Ink, tips: readonly [number, number, number][], col: string, w: number): [P, P, P][] {
	const out: [P, P, P][] = [];
	for (const [tx, ty, lift] of tips) {
		const a: P = [40 + (tx - 40) * 0.06, 87];
		const c: P = [40 + (tx - 40) * 0.38, ty - lift];
		out.push([a, c, [tx, ty]]);
		ink.line(col, w, qd(a, c, [tx, ty]));
	}
	return out;
}

function umbrellaBamboo(stage: GrowingStage): string {
	const ink = new Ink();
	const col = "#c2b35c";
	const lv = ["#8cc063", "#a5cf7c", "#78ad55"] as const;
	const tips: [number, number, number][] =
		stage === "sprout"
			? [
					[34, 70, 6],
					[44, 66, 6],
				]
			: stage === "leafy"
				? [
						[18, 54, 20],
						[28, 40, 16],
						[42, 36, 14],
						[54, 42, 16],
						[63, 54, 20],
					]
				: [
						[6, 50, 36],
						[13, 32, 32],
						[24, 18, 26],
						[38, 12, 20],
						[52, 16, 22],
						[64, 28, 30],
						[73, 46, 36],
					];
	const curves = arching(ink, tips, col, stage === "bloom" ? 1.3 : 1.1);
	const n = stage === "sprout" ? 4 : stage === "leafy" ? 9 : 13;
	const len = stage === "sprout" ? 5 : 6.5;
	curves.forEach((q, ci) => {
		for (let k = 0; k < n; k++) {
			const p = qpt(q[0], q[1], q[2], 0.32 + (0.68 * k) / (n - 1));
			const s = k % 2 ? 1 : -1;
			ink.fill(at(lv, k + ci), lf(p.x, p.y, p.deg + s * 55 + (p.deg > -90 ? 20 : -20), len, 1.4, 1.2));
		}
	});
	return ink.toString();
}

function dwarfBamboo(stage: GrowingStage): string {
	const ink = new Ink();
	const st = "#7a8a4a";
	const cream = "#ece2bc";
	const green = "#3f7d36";
	const big = (x: number, y: number, deg: number, len: number, w: number) => {
		ink.fill(cream, lf(x, y, deg, len, w, len * 0.1));
		const ux = Math.cos(rad(deg));
		const uy = Math.sin(rad(deg));
		ink.fill(green, lf(x + ux * 0.6, y + uy * 0.6, deg, len - 2.6, w - 0.85, len * 0.08));
	};
	const tuft = (x0: number, tx: number, ty: number, n: number, len: number, w: number) => {
		culm(ink, x0, tx, ty, 1.2, st, "#5a6a32", 5, 0.7);
		for (let i = 0; i < n; i++) {
			const a = -170 + (160 * i) / (n - 1);
			big(tx, ty, a + (a > -90 ? 18 : -18), len * 1.15, w * 0.85);
		}
	};
	if (stage === "sprout") {
		tuft(40, 40, 72, 3, 9, 2.6);
		return ink.toString();
	}
	if (stage === "leafy") {
		tuft(33, 30, 64, 4, 11, 3);
		tuft(47, 50, 62, 4, 11, 3);
		tuft(40, 40, 52, 4, 12, 3.2);
		return ink.toString();
	}
	tuft(27, 22, 66, 4, 12, 3.3);
	tuft(53, 58, 64, 4, 12, 3.3);
	tuft(35, 31, 54, 5, 13, 3.5);
	tuft(46, 49, 50, 5, 13, 3.5);
	tuft(40, 40, 42, 4, 13, 3.6);
	return ink.toString();
}

function weepingBamboo(stage: GrowingStage): string {
	const ink = new Ink();
	const col = "#8d9f8c";
	const lv = ["#86b48a", "#a3c8a2", "#709f76"] as const;
	const tips: [number, number, number][] =
		stage === "sprout"
			? [
					[33, 72, 6],
					[47, 70, 7],
				]
			: stage === "leafy"
				? [
						[14, 52, 30],
						[30, 36, 22],
						[52, 40, 24],
						[66, 56, 30],
					]
				: [
						[6, 46, 44],
						[18, 26, 36],
						[44, 12, 28],
						[62, 26, 36],
						[74, 48, 44],
					];
	const curves = arching(ink, tips, col, stage === "bloom" ? 1.4 : 1.2);
	const n = stage === "sprout" ? 3 : stage === "leafy" ? 4 : 5;
	const len = stage === "sprout" ? 6 : stage === "leafy" ? 8.5 : 10;
	curves.forEach((q, ci) => {
		for (let k = 0; k < n; k++) {
			const p = qpt(q[0], q[1], q[2], 0.4 + (0.6 * k) / (n - 1));
			// tassels of very narrow leaves hanging almost straight down
			for (let j = 0; j < 4; j++) ink.fill(at(lv, j + k + ci), lf(p.x, p.y, 70 + j * 13, len * (j === 1 || j === 2 ? 1 : 0.8), 0.65, 0));
		}
	});
	return ink.toString();
}

/* ---------- reeds ---------- */

/** A tall stem with two-ranked leaves sticking out and drooping. */
function leafyStem(ink: Ink, x0: number, tx: number, ty: number, w: number, col: string, n: number, len: number, lw: number, cols: readonly string[], t0 = 0.12, t1 = 0.8): void {
	ink.line(col, w, seg(x0, 87, tx, ty));
	for (let k = 0; k < n; k++) {
		const t = t0 + ((t1 - t0) * k) / Math.max(n - 1, 1);
		const [x, y] = along(x0, tx, ty, t);
		const s = k % 2 ? 1 : -1;
		const l = len * (1 - t * 0.35);
		ink.fill(at(cols, k), lf(x, y, s > 0 ? -22 : -158, l, lw, l * 0.35));
	}
}

function commonReed(stage: GrowingStage): string {
	const ink = new Ink();
	const col = "#a3a866";
	const lv = ["#7d9f6c", "#94b282"] as const;
	if (stage === "sprout") {
		leafyStem(ink, 40, 40, 66, 1.2, col, 3, 10, 1.1, lv, 0.3, 0.85);
		return ink.toString();
	}
	if (stage === "leafy") {
		leafyStem(ink, 36, 33, 40, 1.4, col, 5, 15, 1.3, lv);
		leafyStem(ink, 44, 47, 46, 1.4, col, 4, 14, 1.3, lv);
		return ink.toString();
	}
	const stems: [number, number, number][] = [
		[33, 26, 20],
		[40, 42, 12],
		[47, 55, 22],
	];
	for (const [x0, tx, ty] of stems) leafyStem(ink, x0, tx, ty, 1.5, col, 6, 17, 1.35, lv, 0.1, 0.78);
	// nodding, silky purple-brown plumes, swept to one side
	for (const [, tx, ty] of stems) {
		const a: P = [tx, ty];
		const c: P = [tx + 3, ty - 6];
		const b: P = [tx + 10, ty + 4];
		ink.fill("#7e5464", lf(tx + 1, ty - 3, 15, 14, 3, 5));
		let h = "";
		for (let k = 0; k < 6; k++) {
			const p = qpt(a, c, b, 0.3 + k * 0.13);
			h += `M${f(p.x)} ${f(p.y)}l${f(-0.6 + k * 0.3)} ${f(4 + k * 0.6)}`;
		}
		ink.line("#b8949c", 0.55, h);
		ink.line(col, 0.9, qd(a, c, b));
	}
	return ink.toString();
}

function giantReed(stage: GrowingStage): string {
	const ink = new Ink();
	const col = "#a2b08a";
	const node = "#7c8a66";
	const lv = ["#7aa69a", "#93baae"] as const;
	const stemL = (x0: number, tx: number, ty: number, n: number, len: number, w: number) => {
		culm(ink, x0, tx, ty, w, col, node, 7, 0.8);
		for (let k = 0; k < n; k++) {
			const t = 0.12 + (0.8 * k) / (n - 1);
			const [x, y] = along(x0, tx, ty, t);
			const s = k % 2 ? 1 : -1;
			ink.fill(at(lv, k), lf(x, y, s > 0 ? -12 : -168, len * (1 - t * 0.3), 2.6, len * 0.35));
		}
	};
	if (stage === "sprout") {
		stemL(40, 40, 66, 3, 11, 2.2);
		return ink.toString();
	}
	if (stage === "leafy") {
		stemL(36, 34, 38, 5, 16, 2.6);
		stemL(45, 47, 46, 4, 15, 2.6);
		return ink.toString();
	}
	stemL(34, 30, 24, 6, 17, 2.8);
	stemL(45, 48, 18, 6, 17, 2.8);
	// upright silvery-cream plumes
	for (const [x, y] of [
		[30, 24],
		[48, 18],
	] as P[]) {
		ink.fill("#d7c9a2", lf(x, y + 1, -92, 17, 3.4));
		ink.fill("#efe7d0", lf(x, y - 1, -92, 14, 1.9));
	}
	return ink.toString();
}

function reedCanary(stage: GrowingStage): string {
	const ink = new Ink();
	const col = "#8aa868";
	const g = "#62a052";
	const stripe = "#f1f3e4";
	const stemS = (x0: number, tx: number, ty: number, n: number, len: number) => {
		ink.line(col, 1.3, seg(x0, 87, tx, ty));
		let d = "";
		for (let k = 0; k < n; k++) {
			const t = 0.1 + (0.75 * k) / Math.max(n - 1, 1);
			const [x, y] = along(x0, tx, ty, t);
			const s = k % 2 ? 1 : -1;
			const deg = s > 0 ? -35 : -145;
			const l = len * (1 - t * 0.3);
			ink.fill(g, lf(x, y, deg, l, 1.9, l * 0.2));
			const ux = Math.cos(rad(deg));
			const uy = Math.sin(rad(deg));
			d += `M${f(x + ux * 1.5)} ${f(y + uy * 1.5)}Q${f(x + ux * l * 0.45)} ${f(y + uy * l * 0.45 + l * 0.06)} ${f(x + ux * l * 0.85)} ${f(y + uy * l * 0.85 + l * 0.16)}`;
		}
		ink.line(stripe, 0.7, d);
	};
	if (stage === "sprout") {
		stemS(40, 40, 68, 3, 10);
		return ink.toString();
	}
	if (stage === "leafy") {
		stemS(35, 31, 44, 5, 14);
		stemS(45, 49, 40, 5, 14);
		return ink.toString();
	}
	const tops: P[] = [
		[27, 26],
		[40, 14],
		[53, 24],
	];
	for (const [tx, ty] of tops) stemS(40 + (tx - 40) * 0.25, tx, ty, 6, 15);
	// tight upright panicles, purple-tinged straw
	for (const [tx, ty] of tops) {
		ink.line(col, 1, seg(tx, ty, tx, ty - 3));
		ink.fill("#cdb6c4", lf(tx, ty - 2, -90, 12, 2.4));
		ink.fill("#e6dccb", lf(tx + 0.4, ty - 4, -90, 9.5, 1.2));
	}
	return ink.toString();
}

function sawgrass(stage: GrowingStage): string {
	const ink = new Ink();
	const lv = ["#8aa078", "#a0b48e", "#7a9168"] as const;
	/** A stiff toothed blade from (x, 87) to (tx, ty). */
	const saw = (x: number, tx: number, ty: number, w: number, fill: string) => {
		const L = Math.hypot(tx - x, ty - 87);
		const ux = (tx - x) / L;
		const uy = (ty - 87) / L;
		const nx = -uy;
		const ny = ux;
		const n = Math.max(4, Math.round(L / 3.2));
		const left: string[] = [];
		const right: string[] = [];
		for (let k = 0; k <= n; k++) {
			const t = k / n;
			const hw = w * (1 - t) + (k % 2 && k < n ? 0.75 : 0);
			const px = x + ux * L * t;
			const py = 87 + uy * L * t;
			left.push(`${f(px + nx * hw)} ${f(py + ny * hw)}`);
			right.unshift(`${f(px - nx * hw)} ${f(py - ny * hw)}`);
		}
		ink.fill(fill, `M${left.join("L")}L${right.join("L")}Z`);
	};
	const clump = (n: number, h: number, spread: number) => {
		for (let i = 0; i < n; i++) {
			const t = i / (n - 1);
			const tx = 40 + (t - 0.5) * spread;
			const ty = 87 - h * (0.7 + 0.3 * Math.sin(Math.PI * t)) * (i % 2 ? 0.86 : 1);
			saw(38 + t * 4, tx, ty, 1.7, at(lv, i));
		}
	};
	if (stage === "sprout") {
		clump(4, 20, 14);
		return ink.toString();
	}
	if (stage === "leafy") {
		clump(8, 46, 46);
		return ink.toString();
	}
	// tall flowering stalk with branched rusty-brown clusters
	const sx = 42;
	ink.line("#8a9a6a", 1.5, seg(40, 87, sx, 8));
	for (let k = 0; k < 5; k++) {
		const y = 16 + k * 9;
		const s = k % 2 ? 1 : -1;
		const l = 5 + k * 1.4;
		const ex = sx + s * l;
		const ey = y + l * 0.5;
		ink.line("#7a6a48", 0.7, seg(sx, y, ex, ey) + seg(sx + s * l * 0.5, y + l * 0.25, sx + s * l * 0.6, y + l * 0.25 + 3));
		ink.fill(k % 2 ? "#7a4f2c" : "#94653a", dot(ex, ey, 1.5) + dot(ex - s * 1.4, ey - 1.6, 1.2) + dot(sx + s * l * 0.6, y + l * 0.25 + 3.6, 1.2));
	}
	ink.fill("#94653a", dot(sx, 8.5, 1.4));
	clump(9, 56, 56);
	return ink.toString();
}

function capeReed(stage: GrowingStage): string {
	const ink = new Ink();
	const col = "#4e7c42";
	const bract = "#d8c088";
	const whorl = "#86b465";
	const stemC = (x0: number, tx: number, ty: number, gap: number, wl: number, head: boolean) => {
		ink.line(col, 1.5, seg(x0, 87, tx, ty));
		const L = 87 - ty;
		for (let s = gap; s < L - 3; s += gap) {
			const t = s / L;
			const [x, y] = along(x0, tx, ty, t);
			ink.fill(bract, lf(x, y + 0.6, -80, 4.2, 1.1) + lf(x, y + 0.6, -100, 3.6, 0.9));
			if (t > 0.3) {
				const l = wl * (1 - (t - 0.3) * 0.7);
				let d = "";
				for (const sd of [-1, 1]) for (const k of [0.7, 1]) d += `M${f(x)} ${f(y)}q${f(sd * l * k * 0.7)} ${f(-l * 0.5)} ${f(sd * l * k)} ${f(l * 0.6 * k)}`;
				ink.line(whorl, 0.6, d);
			}
		}
		if (head) {
			ink.fill("#7a4e2a", ell(tx, ty - 1.5, 3.2, 1.6, -90) + ell(tx - 1.6, ty + 0.8, 2.4, 1.2, -120) + ell(tx + 1.6, ty + 0.8, 2.4, 1.2, -60));
			ink.fill(bract, lf(tx, ty + 2.5, -150, 4, 1) + lf(tx, ty + 2.5, -30, 4, 1));
		}
	};
	if (stage === "sprout") {
		stemC(39, 38, 66, 6, 4, false);
		stemC(42, 44, 70, 6, 3, false);
		return ink.toString();
	}
	if (stage === "leafy") {
		stemC(35, 30, 42, 7, 7, false);
		stemC(41, 42, 36, 7, 7, false);
		stemC(46, 51, 48, 7, 6, false);
		return ink.toString();
	}
	stemC(33, 24, 18, 9, 10, true);
	stemC(40, 40, 8, 9, 10, true);
	stemC(47, 56, 20, 9, 10, true);
	return ink.toString();
}


/* ---------- rushes and bulrushes ---------- */

/** Straight leafless stems from a tight base, tips spread across `spread`. */
function rushStems(ink: Ink, n: number, h: number, spread: number, cols: readonly string[], w: number, base = 4): [number, number, number][] {
	const out: [number, number, number][] = [];
	for (let i = 0; i < n; i++) {
		const t = i / (n - 1);
		const x0 = 40 + (t - 0.5) * base;
		const tx = 40 + (t - 0.5) * spread;
		const ty = 87 - h * (0.72 + 0.28 * Math.sin(Math.PI * t)) * ([1, 0.88, 0.95, 0.82][i % 4] as number);
		ink.line(at(cols, i), w, seg(x0, 87, tx, ty));
		out.push([x0, tx, ty]);
	}
	return out;
}

function softstemBulrush(stage: GrowingStage): string {
	const ink = new Ink();
	const cols = ["#5f9a80", "#7aae95"] as const;
	if (stage === "sprout") {
		rushStems(ink, 4, 21, 10, cols, 1.5);
		return ink.toString();
	}
	if (stage === "leafy") {
		rushStems(ink, 7, 50, 30, cols, 1.6);
		return ink.toString();
	}
	const stems = rushStems(ink, 9, 80, 44, cols, 1.7, 6);
	stems.forEach(([x0, tx, ty], i) => {
		if (i % 2) return;
		const [x, y] = along(x0, tx, ty, 0.88);
		const s = tx >= 40 ? 1 : -1;
		let d = "";
		for (const [dx, dy] of [
			[3.5, 0],
			[3, 3.2],
			[1.2, 4.5],
		] as P[]) {
			const ex = x + s * dx;
			const ey = y + dy;
			d += seg(x, y, ex, ey);
			ink.fill(dy > 3 ? "#7a4a28" : "#94603a", ell(ex + s * 0.8, ey + 1.2, 1.9, 1, 60 * s + (s > 0 ? 0 : 0)));
		}
		ink.line("#8a7a52", 0.5, d);
	});
	return ink.toString();
}

function softRush(stage: GrowingStage): string {
	const ink = new Ink();
	const cols = ["#3e7e3d", "#4f9047", "#356f35"] as const;
	if (stage === "sprout") {
		rushStems(ink, 7, 18, 14, cols, 1);
		return ink.toString();
	}
	if (stage === "leafy") {
		rushStems(ink, 15, 42, 44, cols, 1);
		return ink.toString();
	}
	const stems = rushStems(ink, 21, 58, 62, cols, 1.05, 6);
	stems.forEach(([x0, tx, ty], i) => {
		if (i % 3 !== 1) return;
		const [x, y] = along(x0, tx, ty, 0.72);
		const s = tx >= 40 ? 1 : -1;
		let d = "";
		let a = "";
		let b = "";
		for (let j = 0; j < 5; j++) {
			const deg = (s > 0 ? -50 : -130) + s * j * 18;
			const l = 2.5 + (j % 2) * 1.6;
			const ex = x + Math.cos(rad(deg)) * l;
			const ey = y + Math.sin(rad(deg)) * l;
			d += seg(x, y, ex, ey);
			if (j % 2) a += dot(ex, ey, 0.85);
			else b += dot(ex, ey, 0.85);
		}
		ink.line("#a08a50", 0.45, d);
		ink.fill("#c8a764", a).fill("#a6834a", b);
	});
	return ink.toString();
}

function corkscrewRush(stage: GrowingStage): string {
	const ink = new Ink();
	const cols = ["#4f9a46", "#69ae58", "#43863d"] as const;
	const curl = (x0: number, dx: number, h: number, r: number, turns: number, phase: number) => {
		const N = Math.round(turns * 11);
		let d = `M${f(x0)} 87`;
		for (let k = 1; k <= N; k++) {
			const t = k / N;
			const a = t * turns * Math.PI * 2 + phase;
			const rr = r * (0.4 + 0.6 * t);
			const x = x0 + dx * t + rr * (Math.sin(a) - Math.sin(phase));
			const y = 87 - h * t + rr * 0.9 * (Math.cos(a) - Math.cos(phase));
			d += `L${f(x)} ${f(Math.min(y, 87))}`;
		}
		return d;
	};
	const clump = (specs: readonly [number, number, number, number, number][], w: number) =>
		specs.forEach(([x0, dx, h, r, turns], i) => ink.line(at(cols, i), w, curl(x0, dx, h, r, turns, i * 1.3)));
	if (stage === "sprout") {
		clump(
			[
				[38, -5, 15, 2, 2.6],
				[40, 1, 19, 2, 3],
				[42, 6, 14, 1.9, 2.4],
			],
			1,
		);
		return ink.toString();
	}
	if (stage === "leafy") {
		clump(
			[
				[37, -16, 30, 2.6, 4],
				[39, -6, 42, 2.8, 5],
				[40, 4, 46, 2.8, 5.4],
				[41, 14, 36, 2.6, 4.4],
				[42, 20, 24, 2.4, 3.4],
				[38, -20, 20, 2.3, 3],
			],
			1.1,
		);
		return ink.toString();
	}
	clump(
		[
			[36, -24, 36, 3, 4.6],
			[37, -14, 52, 3.2, 6],
			[39, -5, 64, 3.4, 7],
			[40, 6, 60, 3.4, 6.6],
			[41, 15, 50, 3.2, 5.8],
			[42, 25, 38, 3, 4.6],
			[38, -29, 22, 2.6, 3.2],
			[43, 29, 24, 2.6, 3.2],
		],
		1.25,
	);
	ink.fill("#b08a52", dot(29, 44, 1.2) + dot(30.5, 42.5, 1) + dot(28, 42.2, 0.9) + dot(51, 40, 1.2) + dot(52.4, 41.6, 1) + dot(50, 38.5, 0.9));
	return ink.toString();
}

function waterChestnut(stage: GrowingStage): string {
	const ink = new Ink();
	const cols = ["#6f9e6a", "#88b27c"] as const;
	const corm = (x: number, y: number, r: number) => {
		ink.fill("#4b2d22", ell(x, y, r, r * 0.68, 0));
		ink.line("#7d5644", 0.6, `M${f(x - r * 0.8)} ${f(y - r * 0.1)}Q${f(x)} ${f(y + r * 0.35)} ${f(x + r * 0.8)} ${f(y - r * 0.1)}`);
		ink.fill("#c9a87a", lf(x, y - r * 0.6, -95, 2.2, 0.6));
	};
	const tips = (stems: [number, number, number][]) => {
		let d = "";
		for (const [, tx, ty] of stems) d += ell(tx, ty + 1.5, 3, 1.25, -90);
		ink.fill("#d6cf9c", d);
	};
	if (stage === "sprout") {
		rushStems(ink, 4, 16, 8, cols, 1.3);
		corm(31, 85.3, 3.6);
		return ink.toString();
	}
	if (stage === "leafy") {
		rushStems(ink, 10, 46, 30, cols, 1.4);
		corm(27, 85.2, 4.2);
		corm(54, 85.5, 3.6);
		return ink.toString();
	}
	const stems = rushStems(ink, 13, 70, 40, cols, 1.5, 5);
	tips(stems.filter((_, i) => i % 3 === 0));
	corm(24, 85, 4.8);
	corm(56, 85, 4.4);
	return ink.toString();
}

/* ---------- sedges and woodrush ---------- */

function umbrellaSedge(stage: GrowingStage): string {
	const ink = new Ink();
	const st = "#5f9442";
	const front = "#86bd5c";
	const back = "#64a046";
	const umbrella = (x: number, y: number, len: number, n: number) => {
		for (let i = 0; i < n; i++) {
			const a = (i * 360) / n + 10;
			const ux = Math.cos(rad(a));
			const uy = Math.sin(rad(a)) * 0.32;
			const deg = (Math.atan2(uy, ux) * 180) / Math.PI;
			const l = len * Math.hypot(ux, uy);
			ink.fill(uy > 0 ? front : back, lf(x, y, deg, l, 1.25, len * 0.28));
		}
		ink.fill("#a07a46", dot(x, y - 0.6, 1.5) + dot(x - 1.4, y - 1.4, 0.9) + dot(x + 1.4, y - 1.4, 0.9));
	};
	const heads = (hs: readonly [number, number, number][]) => {
		for (const [x, y] of hs) ink.line(st, 1.3, `M40 87Q${f(40 + (x - 40) * 0.2)} ${f((87 + y) / 2)} ${f(x)} ${f(y)}`);
		// back halves before front halves read best when merged by colour
		for (const [x, y, l] of hs) umbrella(x, y, l, 12);
	};
	if (stage === "sprout") {
		heads([[40, 70, 8]]);
		return ink.toString();
	}
	if (stage === "leafy") {
		heads([
			[30, 52, 10],
			[48, 44, 11],
		]);
		return ink.toString();
	}
	heads([
		[22, 42, 12],
		[56, 34, 13],
		[37, 22, 13],
		[44, 54, 9],
	]);
	return ink.toString();
}

function japaneseSedge(stage: GrowingStage): string {
	const ink = new Ink();
	const edge = "#ece5c0";
	const g = ["#356f32", "#2f6530"] as const;
	const mound = (n: number, len: number, droop: number, spread: number) =>
		fanPts(40, n, -172, -8, len, droop, spread, ([a, c, b], i) => {
			ink.fill(edge, sliver(a, c, b, 1.8));
			ink.fill(at(g, i), sliver(a, c, b, 1));
		});
	if (stage === "sprout") {
		mound(6, 16, 7, 3);
		return ink.toString();
	}
	if (stage === "leafy") {
		mound(13, 32, 20, 6);
		return ink.toString();
	}
	for (const [tx, ty] of [
		[30, 36],
		[38, 30],
		[46, 33],
		[53, 40],
	] as P[]) {
		ink.line("#8a9a62", 0.8, seg(40, 82, tx, ty + 6));
		ink.fill("#e3d9a4", ell(tx, ty, 3.4, 1.15, -90 + (tx - 40) * 1.2));
		ink.fill("#8f6e3e", ell(tx + (40 - tx) * 0.02, ty + 5, 1.8, 0.8, -90));
	}
	mound(17, 36, 24, 8);
	return ink.toString();
}

function greatWoodrush(stage: GrowingStage): string {
	const ink = new Ink();
	const g = ["#4e8c3c", "#62a24a"] as const;
	const rosette = (n: number, len: number, droop: number, w: number) =>
		fanPts(40, n, -175, -5, len, droop, 6, ([a, c, b], i) => {
			ink.fill(at(g, i), sliver(a, c, b, w));
			ink.line("#e8eedc", 0.35, `M${f((a[0] + c[0]) / 2)} ${f((a[1] + c[1]) / 2)}L${f(c[0])} ${f(c[1])}`);
		});
	if (stage === "sprout") {
		rosette(5, 16, 6, 1.8);
		return ink.toString();
	}
	if (stage === "leafy") {
		rosette(9, 30, 14, 2.6);
		return ink.toString();
	}
	const heads: P[] = [
		[29, 26],
		[42, 16],
		[54, 28],
	];
	for (const [x, y] of heads) {
		ink.line("#7a8a4a", 1, `M40 82Q${f(40 + (x - 40) * 0.3)} 50 ${f(x)} ${f(y)}`);
		let d = "";
		for (let j = 0; j < 5; j++) {
			const deg = -160 + j * 35;
			const l = 6 + (j % 2) * 3;
			const ex = x + Math.cos(rad(deg)) * l;
			const ey = y + Math.sin(rad(deg)) * l;
			d += seg(x, y, ex, ey);
			ink.fill("#7a4a28", dot(ex, ey, 1.25) + dot(ex + 1.5, ey + 0.8, 1)).fill("#b07a46", dot(ex - 1.2, ey + 1, 1));
		}
		ink.line("#8a7a50", 0.55, d);
	}
	rosette(11, 32, 16, 2.8);
	return ink.toString();
}

function pendulousSedge(stage: GrowingStage): string {
	const ink = new Ink();
	const g = ["#5a8e44", "#71a556"] as const;
	const tuft = (n: number, len: number, droop: number) => fanPts(40, n, -172, -8, len, droop, 6, ([a, c, b], i) => ink.fill(at(g, i), sliver(a, c, b, 2.2)));
	if (stage === "sprout") {
		tuft(5, 18, 8);
		return ink.toString();
	}
	if (stage === "leafy") {
		tuft(9, 34, 22);
		return ink.toString();
	}
	tuft(11, 34, 24);
	for (const [s, c, b] of [
		[1, [44, 4], [70, 28]],
		[-1, [34, 8], [12, 30]],
	] as [number, P, P][]) {
		const a: P = [40, 84];
		ink.line("#8aa060", 1, qd(a, c, b));
		for (let k = 0; k < 4; k++) {
			const p = qpt(a, c, b, 0.5 + k * 0.15);
			const len = k === 3 ? 7 : 11 - k;
			ink.line("#8aa060", 0.6, seg(p.x, p.y, p.x + s * 0.6, p.y + 3));
			ink.fill(k === 3 ? "#c4b06a" : "#7e7247", `M${f(p.x + s * 0.6 - 1.1)} ${f(p.y + 3)}h2.2v${f(len - 1.1)}a1.1 1.1 0 0 1 -2.2 0Z`);
		}
	}
	return ink.toString();
}

function leatherleafSedge(stage: GrowingStage): string {
	const ink = new Ink();
	const cols = ["#a2643a", "#c07c4a", "#8a5230", "#b98a5c"] as const;
	const tuft = (n: number, len: number, w: number) =>
		fanPts(40, n, -130, -50, len, len * 0.12, 4, ([a, c, b], i) => {
			ink.fill(at(cols, i), sliver(a, c, b, w));
			const s = b[0] >= 40 ? 1 : -1;
			ink.line(at(cols, i + 1), 0.55, `M${f(b[0])} ${f(b[1])}q${f(s * 2.4)} -1 ${f(s * 2.2)} 1.8`);
		});
	if (stage === "sprout") {
		tuft(9, 20, 0.8);
		return ink.toString();
	}
	if (stage === "leafy") {
		tuft(17, 44, 0.9);
		return ink.toString();
	}
	tuft(23, 62, 1);
	return ink.toString();
}

function bowlesSedge(stage: GrowingStage): string {
	const ink = new Ink();
	const gold = ["#e6c53c", "#d6b02a", "#efd463"] as const;
	const margin = "#7da040";
	const tuft = (n: number, len: number, droop: number) =>
		fanPts(40, n, -168, -12, len, droop, 6, ([a, c, b], i) => {
			ink.fill(margin, sliver(a, c, b, 1.6));
			ink.fill(at(gold, i), sliver(a, c, b, 1.15));
		});
	if (stage === "sprout") {
		tuft(6, 17, 6);
		return ink.toString();
	}
	if (stage === "leafy") {
		tuft(13, 38, 18);
		return ink.toString();
	}
	tuft(17, 44, 22);
	for (const [tx, ty] of [
		[31, 22],
		[39, 16],
		[47, 20],
	] as P[]) {
		ink.line("#5e6a3a", 0.9, seg(40, 82, tx, ty + 8));
		ink.fill("#5a3f2c", ell(tx, ty + 3, 4.5, 1.2, -90 + (tx - 40) * 0.5));
		ink.fill("#5a3f2c", ell(tx + (tx - 40) * 0.05, ty + 10.5, 2.4, 0.9, -90));
	}
	return ink.toString();
}

/* ---------- marsh flowers ---------- */

function sweetFlag(stage: GrowingStage): string {
	const ink = new Ink();
	const g = ["#86b74a", "#9cc65e", "#74a840"] as const;
	const pink = "#c98088";
	const swords = (specs: readonly [number, number, number][], w: number) => {
		specs.forEach(([x, tx, ty], i) => {
			const a: P = [x, 87];
			const c: P = [x + (tx - x) * 0.4, (87 + ty) / 2];
			ink.fill(at(g, i), sliver(a, c, [tx, ty], w));
			ink.line("#5d8a34", 0.5, `M${f(x)} 85Q${f(c[0])} ${f(c[1])} ${f(tx + (x - tx) * 0.12)} ${f(ty + (87 - ty) * 0.12)}`);
			ink.fill(pink, `M${f(x - w)} 87L${f(x + (tx - x) * 0.08 - w * 0.6)} ${f(87 - (87 - ty) * 0.1)}L${f(x + (tx - x) * 0.08 + w * 0.6)} ${f(87 - (87 - ty) * 0.1)}L${f(x + w)} 87Z`);
		});
	};
	if (stage === "sprout") {
		swords(
			[
				[38.5, 35, 68],
				[40.5, 42, 64],
				[42, 46, 70],
			],
			1.7,
		);
		return ink.toString();
	}
	if (stage === "leafy") {
		swords(
			[
				[35, 24, 50],
				[37.5, 32, 38],
				[40, 41, 34],
				[42.5, 50, 40],
				[45, 58, 52],
			],
			2.2,
		);
		return ink.toString();
	}
	swords(
		[
			[33, 16, 40],
			[35.5, 25, 22],
			[38, 34, 12],
			[40.5, 44, 10],
			[43, 52, 20],
			[45.5, 62, 34],
		],
		2.5,
	);
	// the spadix: a finger jutting sideways from a leaf-like stalk
	const [sx, sy] = [50.5, 56];
	const sp = (deg: number, k: number) => [sx + Math.cos(rad(deg)) * k, sy + Math.sin(rad(deg)) * k] as const;
	ink.fill("#d6b448", lf(sx, sy, -32, 17, 2.4));
	let dd = "";
	for (const k of [3.5, 6.5, 9.5, 12.5]) {
		const [x, y] = sp(-32, k);
		dd += `M${f(x - 0.5)} ${f(y - 1.2)}l1 2.2`;
	}
	ink.line("#9a7a2c", 0.6, dd);
	return ink.toString();
}

function burReed(stage: GrowingStage): string {
	const ink = new Ink();
	const g = ["#5e9a48", "#78ae58"] as const;
	const straps = (specs: readonly [number, number, number][], w: number) =>
		specs.forEach(([x, tx, ty], i) => ink.fill(at(g, i), sliver([x, 87], [x + (tx - x) * 0.25, (87 + ty) / 2], [tx, ty], w)));
	const burr = (x: number, y: number, r: number, fill: string, spike: string) => {
		let d = "";
		for (let k = 0; k < 12; k++) {
			const a = rad(k * 30 + 8);
			d += seg(x + Math.cos(a) * r * 0.7, y + Math.sin(a) * r * 0.7, x + Math.cos(a) * (r + 1.3), y + Math.sin(a) * (r + 1.3));
		}
		ink.line(spike, 0.6, d);
		ink.fill(fill, dot(x, y, r));
	};
	if (stage === "sprout") {
		straps(
			[
				[39, 36, 66],
				[40.5, 41, 63],
				[42, 46, 68],
			],
			1.4,
		);
		return ink.toString();
	}
	if (stage === "leafy") {
		straps(
			[
				[36, 24, 44],
				[38, 33, 34],
				[40, 42, 30],
				[42, 50, 38],
				[44, 58, 48],
			],
			1.7,
		);
		return ink.toString();
	}
	straps(
		[
			[34, 14, 38],
			[36, 24, 22],
			[38, 31, 14],
			[42, 52, 16],
			[44, 62, 30],
			[46, 68, 46],
		],
		1.9,
	);
	// the zigzag flowering stem: green female burrs below, small pale male heads above
	const pts: P[] = [
		[40, 87],
		[42, 60],
		[37, 49],
		[43, 39],
		[39, 31],
		[42, 23],
		[40, 16],
	];
	ink.line("#6a9446", 1.4, "M" + pts.map(([x, y]) => `${f(x)} ${f(y)}`).join("L"));
	ink.line("#6a9446", 1.1, seg(42, 60, 52, 52));
	burr(42, 60, 4.4, "#8db84e", "#a8cc6a");
	burr(37, 49, 4.1, "#8db84e", "#a8cc6a");
	burr(53, 52, 3.8, "#8db84e", "#a8cc6a");
	burr(43, 39, 3.4, "#8db84e", "#a8cc6a");
	for (const [x, y] of pts.slice(4)) ink.fill("#ece4b8", dot(x, y, 2.3));
	return ink.toString();
}

function cottonGrass(stage: GrowingStage): string {
	const ink = new Ink();
	const g = ["#7fa25a", "#96b672"] as const;
	const tuft = (n: number, len: number, droop: number) => fanPts(40, n, -160, -20, len, droop, 4, ([a, c, b], i) => ink.fill(at(g, i), sliver(a, c, b, 1)));
	const cotton = (x: number, y: number, s: number) => {
		ink.line("#8a8a5a", 0.55, seg(x, y, x + s * 2, y + 3));
		const cx = x + s * 2.2;
		const cy = y + 6.5;
		ink.line("#e9e6da", 0.6, seg(cx - 1.5, cy + 1, cx - 3, cy + 5.5) + seg(cx + 1.5, cy + 1, cx + 3.2, cy + 5) + seg(cx, cy + 2, cx + 0.3, cy + 6.5));
		ink.fill("#cdc8b4", dot(cx, cy - 0.3, 3.1) + dot(cx - 1.8, cy + 1.5, 2.6) + dot(cx + 1.8, cy + 1.5, 2.6) + dot(cx, cy + 2.7, 2.5));
		ink.fill("#fbfaf4", dot(cx, cy - 0.5, 2.6) + dot(cx - 1.8, cy + 1.2, 2.1) + dot(cx + 1.8, cy + 1.2, 2.1) + dot(cx, cy + 2.3, 2));
		ink.fill("#6a5236", dot(x + s * 2, y + 3.4, 0.6));
	};
	if (stage === "sprout") {
		tuft(4, 18, 5);
		return ink.toString();
	}
	if (stage === "leafy") {
		tuft(8, 30, 12);
		ink.line("#8a9a5a", 0.9, seg(40, 86, 42, 50));
		ink.fill("#a1885a", ell(42, 47, 3, 1.3, -90));
		return ink.toString();
	}
	tuft(9, 30, 14);
	for (const [tx, ty] of [
		[28, 26],
		[40, 16],
		[52, 22],
	] as P[]) {
		ink.line("#8a9a5a", 0.9, `M40 86Q${f(40 + (tx - 40) * 0.3)} 50 ${f(tx)} ${f(ty)}`);
		cotton(tx, ty, -1);
		cotton(tx, ty, 1);
		if (tx === 40) cotton(tx, ty, 0);
	}
	return ink.toString();
}

const ENTRIES: [string, (stage: GrowingStage) => string][] = [
	["Black bamboo", blackBamboo],
	["Golden bamboo", goldenBamboo],
	["Moso bamboo", mosoBamboo],
	["Buddha's belly bamboo", buddhasBelly],
	["Umbrella bamboo", umbrellaBamboo],
	["Dwarf bamboo", dwarfBamboo],
	["Common reed", commonReed],
	["Giant reed", giantReed],
	["Softstem bulrush", softstemBulrush],
	["Umbrella sedge", umbrellaSedge],
	["Japanese sedge", japaneseSedge],
	["Great woodrush", greatWoodrush],
	["Soft rush", softRush],
	["Corkscrew rush", corkscrewRush],
	["Sweet flag", sweetFlag],
	["Reed canary grass", reedCanary],
	["Bur-reed", burReed],
	["Cotton grass", cottonGrass],
	["Pendulous sedge", pendulousSedge],
	["Leatherleaf sedge", leatherleafSedge],
	["Sawgrass", sawgrass],
	["Chinese water chestnut", waterChestnut],
	["Cape reed", capeReed],
	["Mexican weeping bamboo", weepingBamboo],
	["Bowles' golden sedge", bowlesSedge],
];

export const SPECIES: Species[] = ENTRIES.map(([name, draw]) => ({
	id: name
		.toLowerCase()
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.replace(/'/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, ""),
	name,
	draw,
}));
