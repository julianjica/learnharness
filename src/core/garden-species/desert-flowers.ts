/**
 * Garden species, family: desert wildflowers. Each draws sprout, leafy and
 * bloom in the kit's flat style (see kit.ts); the kit draws soil and seed.
 */
import { BARK, bez, circle, f, leaf, line, stem, type GrowingStage, type Pt, type Species } from "./kit";

/* ---------- private helpers ---------- */

const RAD = Math.PI / 180;

/** The point `len` from (x, y) heading `deg`. */
function at(x: number, y: number, deg: number, len: number): [number, number] {
	return [x + Math.cos(deg * RAD) * len, y + Math.sin(deg * RAD) * len];
}

/** A small deterministic jitter in [0, 1) for index i. */
function rnd(i: number): number {
	const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
	return s - Math.floor(s);
}

/**
 * Merges path data per paint (fill or stroke) into one <path> each, in first-seen order.
 * Dots (from dotD) in a fill are drawn as zero-length round-capped strokes, which is far
 * more compact than arcs; they are grouped by radius.
 */
class Ink {
	private parts = new Map<string, string>();
	fill(color: string, d: string): this {
		const k = `f|${color}`;
		this.parts.set(k, (this.parts.get(k) ?? "") + d);
		return this;
	}
	stroke(color: string, width: number | string, d: string, cap: "round" | "butt" = "round"): this {
		const k = `s|${color}|${width}|${cap}`;
		this.parts.set(k, (this.parts.get(k) ?? "") + d);
		return this;
	}
	/** Raw markup, painted in call order. */
	raw(markup: string): this {
		this.parts.set(`r|${this.parts.size}`, markup);
		return this;
	}
	toString(): string {
		return [...this.parts]
			.map(([k, d]) => {
				const [kind, color, w, cap] = k.split("|");
				if (kind === "r") return d;
				if (kind !== "f") return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="${cap}"/>`;
				const byR = new Map<string, string>();
				const rest = d.replace(/D(\S+) (\S+) (\S+);/g, (_m, x: string, y: string, r: string) => {
					byR.set(r, (byR.get(r) ?? "") + `M${x} ${y}h0`);
					return "";
				});
				let out = rest ? `<path d="${rest}" fill="${color}"/>` : "";
				for (const [r, dd] of byR) out += `<path d="${dd}" stroke="${color}" stroke-width="${f(Number(r) * 2)}" stroke-linecap="round"/>`;
				return out;
			})
			.join("");
	}
}

function el(cx: number, cy: number, rx: number, ry: number, fill: string, rot = 0): string {
	const t = rot ? ` transform="rotate(${f(rot)} ${f(cx)} ${f(cy)})"` : "";
	return `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}" fill="${fill}"${t}/>`;
}

function p(d: string, fill: string): string {
	return `<path d="${d}" fill="${fill}"/>`;
}

/** A pointed (1) or oval (0) leaf outline from (x, y) heading deg. */
function lensD(x: number, y: number, deg: number, len: number, w: number, shape: 0 | 1 = 1): string {
	const co = Math.cos(deg * RAD);
	const si = Math.sin(deg * RAD);
	const P = (u: number, v: number): [number, number] => [x + co * u - si * v, y + si * u + co * v];
	const [a, b, c] = shape === 1 ? [0.45, 1.15, 0.5] : [0.3, 1, 1];
	const o: [number, number] = [x, y];
	const tip = P(len, 0);
	return `M${f(x)} ${f(y)}` + relD("c", [P(len * a, -w * b), P(len * 0.8, -w * c), tip], o) + relD("c", [P(len * 0.8, w * c), P(len * a, w * b), o], tip) + "Z";
}

/** A polygon given as local (u, v) pairs, at (x, y) rotated by deg and scaled by k. */
function polyD(x: number, y: number, deg: number, k: number, pts: readonly number[]): string {
	const co = Math.cos(deg * RAD) * k;
	const si = Math.sin(deg * RAD) * k;
	const abs: [number, number][] = [];
	for (let i = 0; i < pts.length; i += 2) {
		const u = pts[i] ?? 0;
		const v = pts[i + 1] ?? 0;
		abs.push([x + co * u - si * v, y + si * u + co * v]);
	}
	const [first, ...rest] = abs;
	return `M${f(first![0])} ${f(first![1])}` + relD("l", rest, first!) + "Z";
}

/** A dot, for Ink.fill only (drawn there as a round-capped stroke). */
function dotD(x: number, y: number, r: number): string {
	return `D${f(x)} ${f(y)} ${f(r)};`;
}

/** A compact number: one decimal, no leading zero. */
function num(n: number): string {
	return f(n).replace(/^(-?)0\./, "$1.");
}

/** Relative path data through absolute points (rounded first, so nothing drifts). */
function relD(cmd: string, pts: readonly (readonly [number, number])[], from: readonly [number, number]): string {
	let px = Math.round(from[0] * 10);
	let py = Math.round(from[1] * 10);
	let d = cmd;
	pts.forEach(([x, y], i) => {
		const rx = Math.round(x * 10);
		const ry = Math.round(y * 10);
		const a = num((rx - px) / 10);
		const b = num((ry - py) / 10);
		d += `${i && a[0] !== "-" ? " " : ""}${a}${b[0] === "-" ? "" : " "}${b}`;
		if (cmd === "l" || (i + 1) % 3 === 0) {
			px = rx;
			py = ry;
		}
	});
	return d;
}

/** n points on a ring around (x, y). */
function around(x: number, y: number, n: number, r: number, off = 0): [number, number][] {
	const out: [number, number][] = [];
	for (let i = 0; i < n; i++) out.push(at(x, y, off + (i * 360) / n, r));
	return out;
}

/** Ray strokes from r0 to r1 around (x, y) as path data. */
function raysD(x: number, y: number, n: number, r0: number, r1: number, off = 0): string {
	let d = "";
	for (let i = 0; i < n; i++) {
		const a = off + (i * 360) / n;
		const [ax, ay] = at(x, y, a, r0);
		const [bx, by] = at(x, y, a, r1);
		d += `M${f(ax)} ${f(ay)}` + relD("l", [[bx, by]], [ax, ay]);
	}
	return d;
}

/** A short straight stroke from (x, y) heading deg, as path data. */
function segD(x: number, y: number, deg: number, len: number): string {
	return `M${f(x)} ${f(y)}` + relD("l", [at(x, y, deg, len)], [x, y]);
}

/**
 * A ring of n square-tipped rays between radii r0 and r1, as one dashed circle
 * (each dash is a ray; `frac` of each slot is petal, the rest gap).
 */
function rayRing(x: number, y: number, n: number, r0: number, r1: number, frac: number, color: string, off = 0): string {
	const rm = (r0 + r1) / 2;
	const slot = (2 * Math.PI * rm) / n;
	const dash = `${f(slot * frac)} ${f(slot * (1 - frac))}`;
	return `<circle cx="${f(x)}" cy="${f(y)}" r="${f(rm)}" fill="none" stroke="${color}" stroke-width="${f(r1 - r0)}" stroke-dasharray="${dash}" stroke-dashoffset="${f((off / 360) * 2 * Math.PI * rm)}"/>`;
}

/** Round petals (circles) on a ring, as path data. */
function roundRingD(x: number, y: number, n: number, r: number, pr: number, off = 0): string {
	return around(x, y, n, r, off)
		.map(([a, b]) => dotD(a, b, pr))
		.join("");
}

/** A cubic as path data. */
function cubicD(q: readonly [Pt, Pt, Pt, Pt]): string {
	const [a, b, c, d] = q;
	return `M${f(a[0])} ${f(a[1])}C${f(b[0])} ${f(b[1])} ${f(c[0])} ${f(c[1])} ${f(d[0])} ${f(d[1])}`;
}

/** A cubic from (x0, y0) rising to (tx, ty), bowing a little outward. */
function riser(x0: number, y0: number, tx: number, ty: number): [Pt, Pt, Pt, Pt] {
	return [
		[x0, y0],
		[x0 + (tx - x0) * 0.1, y0 - (y0 - ty) * 0.45],
		[tx - (tx - x0) * 0.15, ty + (y0 - ty) * 0.3],
		[tx, ty],
	];
}

/** A dissected (feathery) leaf as stroke path data. */
function featherD(x: number, y: number, deg: number, len: number, pairs = 4, spread = 42): string {
	const [ex, ey] = at(x, y, deg, len);
	let d = `M${f(x)} ${f(y)}` + relD("l", [[ex, ey]], [x, y]);
	for (let i = 1; i <= pairs; i++) {
		const t = 0.25 + (0.7 * i) / (pairs + 1);
		const [mx, my] = at(x, y, deg, len * t);
		const l = len * 0.3 * (1.15 - t) + 1.2;
		for (const s of [-1, 1]) {
			d += segD(mx, my, deg + s * spread, l);
		}
	}
	return d;
}

/** A runcinate (toothed) leaf, local length 1. */
const TOOTHED = [0, 0, 0.22, -0.1, 0.28, -0.04, 0.45, -0.17, 0.5, -0.08, 0.68, -0.2, 0.74, -0.09, 1, 0, 0.74, 0.09, 0.68, 0.2, 0.5, 0.08, 0.45, 0.17, 0.28, 0.04, 0.22, 0.1];

/** A spread of n angles from `from` to `to`. */
function spread(n: number, from: number, to: number): number[] {
	const out: number[] = [];
	for (let i = 0; i < n; i++) out.push(n === 1 ? from : from + ((to - from) * i) / (n - 1));
	return out;
}

/** Length factor for a rosette leaf: shorter towards the horizontal. */
const droop = (a: number): number => 1 - Math.abs(a + 90) / 260;

/* ---------- 1. California poppy ---------- */
const CAP = { fol: "#8db4a4", fol2: "#a7c8b8", stem: "#79a08f", or: "#f08a1c", deep: "#d4631a", light: "#f8ad38", bud: "#9cbf96" };
function capFoliage(k: number): string {
	const ink = new Ink();
	for (const a of spread(7, -170, -10)) ink.stroke(CAP.fol, 1.2, featherD(40, 86.5, a, 15 * k * droop(a), 4, 40));
	for (const a of spread(4, -140, -40)) ink.stroke(CAP.fol2, 1.1, featherD(40, 86.5, a, 12 * k * droop(a), 3, 40));
	return ink.toString();
}
function capCup(x: number, y: number, k: number): string {
	const t = (a: number, b: number) => `${f(x + a * k)} ${f(y + b * k)}`;
	return (
		el(x, y - 8.2 * k, 6.6 * k, 2.3 * k, CAP.deep) +
		p(`M${t(-7, -9)}Q${t(-6.5, -0.5)} ${t(0, 0)}Q${t(6.5, -0.5)} ${t(7, -9)}Q${t(3.6, -6.6)} ${t(0, -8)}Q${t(-3.6, -6.6)} ${t(-7, -9)}Z`, CAP.or) +
		p(`M${t(-3.8, -7.4)}Q${t(-3.4, -0.8)} ${t(0, 0)}Q${t(3.4, -0.8)} ${t(3.8, -7.4)}Q${t(0, -10)} ${t(-3.8, -7.4)}Z`, CAP.light) +
		el(x, y + 0.3 * k, 1.8 * k, 0.8 * k, "#c98a5a")
	);
}
function capBud(x: number, y: number): string {
	return p(`M${f(x - 1.8)} ${f(y)}Q${f(x - 2.2)} ${f(y - 5)} ${f(x + 0.6)} ${f(y - 9)}Q${f(x + 2.2)} ${f(y - 4)} ${f(x + 1.8)} ${f(y)}Z`, CAP.bud) + p(`M${f(x - 0.2)} ${f(y - 5)}Q${f(x + 1)} ${f(y - 7)} ${f(x + 0.6)} ${f(y - 9)}Q${f(x + 1.6)} ${f(y - 6)} ${f(x + 1.2)} ${f(y - 4)}Z`, CAP.or);
}
function californiaPoppy(stage: GrowingStage): string {
	if (stage === "sprout") return capFoliage(1.25);
	if (stage === "leafy") {
		return stem(riser(40, 84, 33, 50), CAP.stem, 1.2) + stem(riser(41, 84, 48, 44), CAP.stem, 1.2) + capFoliage(1.6) + capBud(33, 50) + capBud(48, 44);
	}
	let s = stem(riser(39, 84, 26, 40), CAP.stem, 1.3) + stem(riser(41, 84, 50, 28), CAP.stem, 1.3) + stem(riser(40, 84, 39, 36), CAP.stem, 1.2);
	s += capFoliage(1.9);
	return s + capBud(39, 36) + capCup(26, 40, 1.05) + capCup(50, 28, 1.2);
}

/* ---------- 2. Desert marigold ---------- */
const DM = { wool: "#bcc7b5", wool2: "#9caa95", stem: "#9aa98f", ray: "#eebc1a", ray2: "#f7d84c", disc: "#d99c12", bud: "#c7cf8f" };
function dmBase(k: number): string {
	const ink = new Ink();
	for (const a of spread(9, -172, -8)) ink.fill(DM.wool2, lensD(40, 86.5, a, 11 * k * droop(a), 2.6 * k, 0));
	for (const a of spread(6, -150, -30)) ink.fill(DM.wool, lensD(40, 86.5, a, 9 * k * droop(a), 2.3 * k, 0));
	return ink.toString();
}
function dmHead(x: number, y: number, k: number): string {
	return rayRing(x, y, 18, 2.2 * k, 6.4 * k, 0.8, DM.ray, 10) + rayRing(x, y, 14, 1.8 * k, 4.6 * k, 0.75, DM.ray2) + circle(x, y, 2.3 * k, DM.disc);
}
function desertMarigold(stage: GrowingStage): string {
	if (stage === "sprout") return dmBase(1.75);
	const heads: [number, number, number][] =
		stage === "leafy"
			? [
					[33, 48, 0],
					[47, 42, 0],
				]
			: [
					[25, 40, 1],
					[53, 34, 1.05],
					[39, 24, 1.15],
					[46, 50, 0.9],
				];
	const ink = new Ink();
	for (const [x, y] of heads) ink.stroke(DM.stem, 1.2, cubicD(riser(40, 82, x, y)));
	let s = ink.toString() + dmBase(stage === "leafy" ? 1.8 : 2);
	for (const [x, y, k] of heads) s += k ? dmHead(x, y, k) : circle(x, y, 2.6, DM.bud) + circle(x, y - 0.6, 1.4, DM.ray);
	return s;
}

/* ---------- 3. Globe mallow ---------- */
const GM = { leaf: "#9fb291", leaf2: "#879b7c", stem: "#7f906f", fl: "#e8703c", fl2: "#f49a66", eye: "#b9472a", bud: "#a9b88a" };
function gmWand(x0: number, tx: number, ty: number, flowers: number, ink: Ink, fl: Ink, k = 1): void {
	const q = riser(x0, 87, tx, ty);
	ink.stroke(GM.stem, 1.4, cubicD(q));
	const nLeaves = 4;
	for (let i = 0; i < nLeaves; i++) {
		const t = 0.15 + i * 0.13;
		const [x, y] = bez(q, t);
		const side = i % 2 ? 1 : -1;
		const a = side > 0 ? -25 : -155;
		ink.fill(i % 2 ? GM.leaf : GM.leaf2, lensD(x, y, a, 7.5 * k * (1 - t * 0.5), 3.4 * k * (1 - t * 0.5), 0));
	}
	for (let i = 0; i < flowers; i++) {
		const t = 0.68 + (0.32 * i) / Math.max(1, flowers - 1);
		const [x, y] = bez(q, t);
		const side = i % 2 ? 2.4 : -2.4;
		if (flowers > 0 && k > 0.95) {
			fl.fill(GM.fl, roundRingD(x + side, y, 5, 1.5, 1.6, -90 + i * 20));
			fl.fill(GM.eye, dotD(x + side, y, 0.8));
		} else fl.fill(GM.bud, dotD(x + side * 0.6, y, 1.4));
	}
}
function globeMallow(stage: GrowingStage): string {
	const ink = new Ink();
	const fl = new Ink();
	if (stage === "sprout") {
		ink.stroke(GM.stem, 1.3, "M40 87L40 74");
		ink.fill(GM.leaf2, lensD(40, 80, -160, 8, 4, 0)).fill(GM.leaf, lensD(40, 76, -25, 8, 4, 0)).fill(GM.leaf, lensD(40, 74, -100, 6, 3, 0));
		return ink.toString();
	}
	if (stage === "leafy") {
		gmWand(38, 30, 46, 3, ink, fl, 0.9);
		gmWand(40, 41, 40, 3, ink, fl, 0.9);
		gmWand(42, 51, 48, 2, ink, fl, 0.9);
		return ink.toString() + fl.toString();
	}
	gmWand(37, 24, 30, 4, ink, fl);
	gmWand(39, 36, 16, 5, ink, fl);
	gmWand(41, 47, 20, 5, ink, fl);
	gmWand(43, 58, 34, 4, ink, fl);
	return ink.toString() + fl.toString();
}

/* ---------- 4. Arizona lupine ---------- */
const AL = { leaf: "#7aa66a", leaf2: "#93bb7f", stem: "#5f8a4e", fl: "#b2449a", fl2: "#d27cbc", white: "#f6edf3" };
function alPalm(x: number, y: number, k: number, ink: Ink, color: string): void {
	for (const a of spread(7, -170, -10)) ink.fill(color, lensD(x, y, a, 5.2 * k, 1.1 * k, 0));
}
function alSpike(x: number, y: number, h: number, ink: Ink): void {
	const rows = Math.round(h / 2.4);
	for (let i = 0; i < rows; i++) {
		const t = i / rows;
		const yy = y - i * 2.4;
		const w = 3.2 * (1 - t * 0.7);
		ink.fill(i % 2 ? AL.fl2 : AL.fl, dotD(x - w * 0.55, yy, 1.5 * (1 - t * 0.4)) + dotD(x + w * 0.55, yy - 0.6, 1.5 * (1 - t * 0.4)));
		if (i < rows - 2) ink.fill(AL.white, dotD(x + (i % 2 ? 0.8 : -0.8), yy - 0.4, 0.55));
	}
}
function arizonaLupine(stage: GrowingStage): string {
	const ink = new Ink();
	if (stage === "sprout") {
		ink.stroke(AL.stem, 1, "M40 87Q38 80 35 75M40 87Q42 78 45 72");
		alPalm(35, 75, 1, ink, AL.leaf);
		alPalm(45, 72, 1.1, ink, AL.leaf2);
		return ink.toString();
	}
	const leafy = stage === "leafy";
	const palms: [number, number, number][] = leafy
		? [
				[28, 72, 1.3],
				[52, 70, 1.3],
				[40, 64, 1.4],
				[33, 80, 1.1],
				[48, 80, 1.1],
			]
		: [
				[22, 72, 1.4],
				[58, 70, 1.4],
				[40, 66, 1.4],
				[30, 80, 1.2],
				[50, 80, 1.2],
				[32, 62, 1.1],
				[49, 58, 1.1],
			];
	const spikes: [number, number, number][] = leafy
		? [
				[36, 56, 6],
				[45, 52, 6],
			]
		: [
				[26, 52, 14],
				[38, 46, 17],
				[52, 44, 16],
				[62, 56, 11],
			];
	for (const [x, y] of palms) ink.stroke(AL.stem, 1, cubicD(riser(40, 86, x, y)));
	for (const [x, y] of spikes) ink.stroke(AL.stem, 1.3, cubicD(riser(40, 86, x, y)));
	palms.forEach(([x, y, k], i) => alPalm(x, y, k, ink, i % 2 ? AL.leaf2 : AL.leaf));
	const fl = new Ink();
	if (leafy) for (const [x, y, h] of spikes) fl.fill("#a7c48e", lensD(x, y + 1, -90, h + 2, 2, 1));
	else for (const [x, y, h] of spikes) alSpike(x, y, h, fl);
	return ink.toString() + fl.toString();
}

/* ---------- 5. Brittlebush ---------- */
const BB = { s1: "#a3ae96", s2: "#b9c3ac", s3: "#cfd6c3", stem: "#8f9579", ray: "#f2c11c", disc: "#a8761a" };
function bbDome(R: number): string {
	const ink = new Ink();
	for (const a of spread(11, -176, -4)) ink.fill(BB.s1, lensD(40, 86.5, a, R * (0.85 + 0.15 * Math.sin(-a * RAD)), R * 0.3, 0));
	for (const a of spread(9, -165, -15)) ink.fill(BB.s2, lensD(40, 85, a, R * 0.78 * (0.8 + 0.2 * Math.sin(-a * RAD)), R * 0.26, 0));
	for (const a of spread(5, -150, -30)) ink.fill(BB.s3, lensD(40, 84, a, R * 0.5, R * 0.18, 0));
	return ink.toString();
}
function brittlebush(stage: GrowingStage): string {
	if (stage === "sprout") return bbDome(16);
	if (stage === "leafy") return bbDome(22);
	const heads: [number, number][] = [
		[16, 50],
		[24, 38],
		[33, 30],
		[43, 28],
		[53, 33],
		[61, 42],
		[66, 54],
		[38, 40],
		[49, 44],
	];
	const ink = new Ink();
	for (const [x, y] of heads) {
		const [bx, by] = at(40, 80, Math.atan2(y - 80, x - 40) / RAD, 16);
		ink.stroke(BB.stem, 0.9, `M${f(bx)} ${f(by)}L${f(x)} ${f(y)}`);
	}
	const fl = new Ink();
	for (const [x, y] of heads) fl.raw(rayRing(x, y, 10, 1.2, 4.4, 0.72, BB.ray) + circle(x, y, 1.6, BB.disc));
	return ink.toString() + bbDome(26) + fl.toString();
}

/* ---------- 6. Ocotillo ---------- */
const OC = { cane: "#6f5f4e", leaf: "#7fa64e", fl: "#df4529", fl2: "#f57b3a" };
function ocotillo(stage: GrowingStage): string {
	const tips: [number, number, number][] =
		stage === "sprout"
			? [
					[34, 70, 39],
					[40, 66, 40],
					[46, 71, 41],
				]
			: stage === "leafy"
				? [
						[22, 48, 37],
						[31, 42, 38],
						[40, 40, 40],
						[49, 42, 42],
						[58, 48, 43],
					]
				: [
						[8, 24, 37],
						[17, 14, 38],
						[28, 8, 39],
						[40, 6, 40],
						[52, 8, 41],
						[63, 14, 42],
						[72, 24, 43],
						[34, 24, 39],
						[47, 22, 41],
					];
	const ink = new Ink();
	const lv = new Ink();
	const fl = new Ink();
	tips.forEach(([tx, ty, bx], j) => {
		const q: [Pt, Pt, Pt, Pt] = [
			[bx, 87],
			[bx + (tx - bx) * 0.05, 87 - (87 - ty) * 0.35],
			[tx - (tx - bx) * 0.25, ty + (87 - ty) * 0.3],
			[tx, ty],
		];
		ink.stroke(OC.cane, stage === "sprout" ? 1.3 : 1.7, cubicD(q));
		const n = stage === "sprout" ? 3 : stage === "leafy" ? 7 : 9;
		for (let i = 0; i < n; i++) {
			const t = 0.18 + (0.66 * i) / n + rnd(j * 13 + i) * 0.03;
			const [x, y] = bez(q, t);
			const [x2, y2] = bez(q, t + 0.01);
			const dir = Math.atan2(y2 - y, x2 - x) / RAD;
			lv.stroke(OC.leaf, 1.4, segD(x, y, dir + (i % 2 ? 55 : -55), 2));
		}
		if (stage === "bloom") {
			const [x, y] = bez(q, 0.9);
			const dir = Math.atan2(ty - y, tx - x) / RAD;
			fl.fill(OC.fl, lensD(x, y, dir, 10, 1.9, 0));
			const [hx, hy] = at(x, y, dir, 4);
			fl.fill(OC.fl2, lensD(hx, hy, dir, 5.5, 1, 0));
		}
	});
	return ink.toString() + lv.toString() + fl.toString();
}

/* ---------- 7. Desert sand verbena ---------- */
const SV = { leaf: "#7aa465", leaf2: "#93b97c", stem: "#83946a", fl: "#d062a2", fl2: "#e48cbf", eye: "#fbe9f3", bud: "#b8c99a" };
function svUmbel(x: number, y: number, k: number, fl: Ink): void {
	const pts: [number, number][] = [[x, y - 1 * k], ...around(x, y, 6, 3.6 * k, -90), [x - 1.8 * k, y - 3.2 * k], [x + 1.8 * k, y - 3.2 * k]];
	pts.forEach(([a, b], i) => fl.fill(i % 3 ? SV.fl : SV.fl2, dotD(a, b, 2.1 * k)));
	pts.forEach(([a, b]) => fl.fill(SV.eye, dotD(a, b, 0.6 * k)));
}
function svMat(k: number, ink: Ink): void {
	const runners: [number, number][] = [
		[10, 80],
		[70, 80],
		[20, 72],
		[60, 72],
	];
	runners.forEach(([tx, ty], j) => {
		const x = 40 + (tx - 40) * k;
		const y = 86 - (86 - ty) * k;
		const q: [Pt, Pt, Pt, Pt] = [
			[40, 86],
			[40 + (x - 40) * 0.3, 86 - 4 * k],
			[40 + (x - 40) * 0.7, y - 4 * k],
			[x, y],
		];
		ink.stroke(SV.stem, 1.1, cubicD(q));
		for (const t of [0.35, 0.65, 0.95]) {
			const [px, py] = bez(q, t);
			ink.fill(j % 2 ? SV.leaf : SV.leaf2, lensD(px, py, -125, 6 * k, 2.6 * k, 0) + lensD(px, py, -55, 6 * k, 2.6 * k, 0));
		}
	});
}
function sandVerbena(stage: GrowingStage): string {
	const ink = new Ink();
	const fl = new Ink();
	if (stage === "sprout") {
		ink.stroke(SV.stem, 1.1, "M40 87Q38 80 34 77M40 87Q43 79 47 74");
		ink.fill(SV.leaf, lensD(34, 77, -150, 6, 3, 0) + lensD(34, 77, -80, 6, 3, 0)).fill(SV.leaf2, lensD(47, 74, -100, 6, 3, 0) + lensD(47, 74, -25, 6, 3, 0));
		return ink.toString();
	}
	if (stage === "leafy") {
		svMat(0.8, ink);
		ink.stroke(SV.stem, 1.1, cubicD(riser(40, 85, 42, 54)));
		fl.fill(SV.bud, dotD(42, 53, 3)).fill(SV.fl2, dotD(41, 51.5, 1) + dotD(43.5, 52.5, 1));
		return ink.toString() + fl.toString();
	}
	svMat(1, ink);
	const heads: [number, number][] = [
		[22, 56],
		[40, 44],
		[57, 52],
		[31, 66],
	];
	for (const [x, y] of heads) ink.stroke(SV.stem, 1.1, cubicD(riser(40, 85, x, y + 2)));
	for (const [x, y] of heads) svUmbel(x, y, 1.15, fl);
	return ink.toString() + fl.toString();
}

/* ---------- 8. Firecracker penstemon ---------- */
const FP = { leaf: "#7ea698", leaf2: "#94b8aa", stem: "#5e8577", fl: "#d3272b", lip: "#ec4b3b", bud: "#9c3a2c" };
function fpRosette(k: number): string {
	const ink = new Ink();
	for (const a of spread(6, -168, -12)) ink.fill(FP.leaf, lensD(40, 86.5, a, 11 * k * droop(a), 3.4 * k, 0));
	for (const a of spread(3, -130, -50)) ink.fill(FP.leaf2, lensD(40, 86.5, a, 9 * k, 3 * k, 0));
	return ink.toString();
}
function fpStalk(x0: number, tx: number, ty: number, tubes: number, ink: Ink, fl: Ink, open: boolean): void {
	const q = riser(x0, 84, tx, ty);
	ink.stroke(FP.stem, 1.5, cubicD(q));
	for (const t of [0.28, 0.48]) {
		const [x, y] = bez(q, t);
		ink.fill(FP.leaf2, lensD(x, y, -150, 6, 2, 1) + lensD(x, y, -30, 6, 2, 1));
	}
	for (let i = 0; i < tubes; i++) {
		const t = 0.58 + (0.4 * i) / tubes;
		const [x, y] = bez(q, t);
		const a = i % 2 ? 48 : 132;
		const len = open ? 6.5 : 3.5;
		const [ex, ey] = at(x, y, a, len);
		if (open) {
			fl.stroke(FP.fl, 2, segD(x, y, a, len));
			fl.fill(FP.lip, dotD(ex, ey, 1.2));
		} else fl.stroke(FP.bud, 1.6, segD(x, y, a, len));
	}
}
function firecrackerPenstemon(stage: GrowingStage): string {
	if (stage === "sprout") return fpRosette(1.6);
	const ink = new Ink();
	const fl = new Ink();
	if (stage === "leafy") {
		fpStalk(40, 41, 46, 4, ink, fl, false);
		return ink.toString() + fpRosette(1.7) + fl.toString();
	}
	fpStalk(38, 32, 12, 7, ink, fl, true);
	fpStalk(42, 51, 26, 6, ink, fl, true);
	return ink.toString() + fpRosette(1.9) + fl.toString();
}

/* ---------- 9. Desert lily ---------- */
const DL = { leaf: "#8aa595", leaf2: "#a3bbad", edge: "#d9e2d6", stalk: "#7c9a87", fl: "#f4f1e8", shade: "#b8bdad", stripe: "#8fa684", bud: "#b9c9a8" };
const TRUMPET = [0, -0.8, 5, -1.3, 9, -4.4, 11, -3.8, 10.2, -1.6, 11.8, 0, 10.2, 1.6, 11, 3.8, 9, 4.4, 5, 1.3, 0, 0.8];
function dlRosette(k: number): string {
	const ink = new Ink();
	const angles = [-172, -155, -128, -52, -25, -8];
	for (const a of angles) ink.fill(DL.edge, lensD(40, 86.5, a, 20 * k * droop(a), 3.3 * k, 1));
	for (const a of angles) ink.fill(DL.leaf, lensD(40, 86.5, a, 19 * k * droop(a), 2.6 * k, 1));
	for (const a of [-105, -78]) ink.fill(DL.leaf2, lensD(40, 86.5, a, 14 * k, 2.4 * k, 1));
	return ink.toString();
}
function desertLily(stage: GrowingStage): string {
	if (stage === "sprout") return dlRosette(1);
	if (stage === "leafy") {
		return line(40, 86, 40, 52, DL.stalk, 1.8) + dlRosette(1.1) + p(lensD(40, 54, -90, 9, 2.4, 1), DL.bud) + p(lensD(40, 55, -60, 7, 1.6, 1), DL.bud) + p(lensD(40, 55, -120, 7, 1.6, 1), DL.bud);
	}
	const ink = new Ink();
	const flowers: [number, number, number][] = [
		[40, 24, -90],
		[40, 29, -35],
		[40, 30, -145],
		[40, 38, -15],
		[40, 39, -165],
	];
	for (const [x, y, a] of flowers) ink.fill(DL.shade, polyD(x, y + 0.6, a, 1.05, TRUMPET));
	for (const [x, y, a] of flowers) ink.fill(DL.fl, polyD(x, y, a, 1.05, TRUMPET));
	for (const [x, y, a] of flowers) {
		const [ex, ey] = at(x, y, a, 10);
		ink.stroke(DL.stripe, 0.6, `M${f(x)} ${f(y)}L${f(ex)} ${f(ey)}`);
	}
	return line(40, 86, 40, 26, DL.stalk, 2) + dlRosette(1.35) + ink.toString();
}

/* ---------- 10. Chuparosa ---------- */
const CH = { stem: "#7a9f5a", stem2: "#93b56e", leaf: "#8db666", fl: "#c42a3d", fl2: "#e04555" };
function chuparosa(stage: GrowingStage): string {
	const n = stage === "sprout" ? 5 : stage === "leafy" ? 10 : 14;
	const L = stage === "sprout" ? 17 : stage === "leafy" ? 40 : 54;
	const ink = new Ink();
	const fl = new Ink();
	for (let i = 0; i < n; i++) {
		const a = -165 + (150 * i) / (n - 1);
		const len = L * (0.75 + 0.25 * Math.sin(-a * RAD)) * (0.9 + rnd(i) * 0.15);
		const tx = 40 + Math.cos(a * RAD) * len * 0.75;
		const ty = 86 + Math.sin(a * RAD) * len * 0.8;
		const q: [Pt, Pt, Pt, Pt] = [
			[40, 86],
			[40 + (tx - 40) * 0.15, 86 - (86 - ty) * 0.8],
			[40 + (tx - 40) * 0.6, ty - len * 0.25],
			[tx, ty],
		];
		ink.stroke(i % 2 ? CH.stem : CH.stem2, 1.1, cubicD(q));
		if (stage !== "bloom") {
			const [x, y] = bez(q, 0.6);
			ink.fill(CH.leaf, lensD(x, y, a + 20, 4.5, 1.8, 0));
			continue;
		}
		for (const [t, da] of [
			[0.6, -50],
			[0.82, 40],
			[1, 0],
		] as const) {
			const [x, y] = bez(q, t);
			const [x2, y2] = bez(q, Math.min(1, t + 0.02));
			const dir = t === 1 ? Math.atan2(y - bez(q, 0.97)[1], x - bez(q, 0.97)[0]) / RAD : Math.atan2(y2 - y, x2 - x) / RAD;
			fl.fill(i % 3 ? CH.fl : CH.fl2, lensD(x, y, dir + da, 6.5, 1.3, 0));
		}
	}
	return ink.toString() + fl.toString();
}

/* ---------- 11. Desert willow ---------- */
const DW = { leaf: "#78a058", leaf2: "#93b86e", fl: "#d68ac2", fl2: "#b8649f", throat: "#f2d062", pod: "#a88c5c" };
function trunkD(x0: number, x1: number, y1: number, w0: number, w1: number): string {
	return `M${f(x0 - w0 / 2 - 1)} 87.5Q${f(x0 - w0 / 2)} 86 ${f(x0 - w0 / 2)} 84L${f(x1 - w1 / 2)} ${f(y1)}L${f(x1 + w1 / 2)} ${f(y1)}L${f(x0 + w0 / 2)} 84Q${f(x0 + w0 / 2)} 86 ${f(x0 + w0 / 2 + 1)} 87.5Z`;
}
function desertWillow(stage: GrowingStage): string {
	const ink = new Ink();
	if (stage === "sprout") {
		ink.stroke(BARK, 1.4, "M40 87L40 70");
		for (const [y, a] of [
			[78, -150],
			[76, -30],
			[72, -120],
			[71, -60],
		] as const)
			ink.fill(DW.leaf, lensD(40, y, a, 9, 1.2, 1));
		return ink.toString();
	}
	const k = stage === "leafy" ? 0.62 : 1;
	const T = (x: number, y: number): [number, number] => [40 + (x - 40) * k, 87 - (87 - y) * k];
	const [jx, jy] = T(41, 52);
	ink.fill(BARK, trunkD(40, jx, jy, 4.5 * Math.max(k, 0.8), 2.6));
	const branches: [number, number][] = [
		[16, 36],
		[26, 22],
		[42, 16],
		[57, 22],
		[66, 36],
	];
	const tips = branches.map(([x, y]) => T(x, y));
	for (const [x, y] of tips) ink.stroke(BARK, 1.5, `M${f(jx)} ${f(jy + 1)}Q${f((jx + x) / 2)} ${f(jy - (jy - y) * 0.7)} ${f(x)} ${f(y)}`);
	const lv = new Ink();
	tips.forEach(([x, y], j) => {
		for (let i = 0; i < 5; i++) {
			const t = 0.35 + i * 0.16;
			const px = jx + (x - jx) * t;
			const py = jy + (y - jy) * t - Math.sin(t * Math.PI) * 4 * k;
			const out = x < 40 ? -1 : 1;
			lv.stroke((i + j) % 2 ? DW.leaf : DW.leaf2, 1.5, segD(px, py, 90 - out * (35 + rnd(i + j * 7) * 30), 10 * k));
			lv.stroke((i + j) % 2 ? DW.leaf2 : DW.leaf, 1.5, segD(px, py, -90 + out * (60 + rnd(i * 3 + j) * 30), 8 * k));
		}
	});
	let s = ink.toString() + lv.toString();
	if (stage === "bloom") {
		const fl = new Ink();
		tips.forEach(([x, y], j) => {
			for (const [dx, dy] of [
				[0, -2.5],
				[3, 1],
				[-3, 1],
			] as const) {
				const cx = x + dx;
				const cy = y + dy;
				fl.fill(j % 2 ? DW.fl2 : DW.fl, roundRingD(cx, cy, 5, 1.7, 1.5, -90));
				fl.fill(DW.throat, dotD(cx, cy, 0.8));
			}
		});
		const pods = new Ink();
		for (const [x, y] of [tips[0]!, tips[4]!]) pods.stroke(DW.pod, 0.9, `M${f(x + 4)} ${f(y + 6)}q1 5 -.5 10`);
		s += pods.toString() + fl.toString();
	}
	return s;
}

/* ---------- 12. Fairy duster ---------- */
const FD = { twig: "#86664e", fol: "#6f9a52", fol2: "#8ab36a", pink: "#e44f7d", pale: "#f7c6d4", tip: "#c22e5c" };
function fdPuff(x: number, y: number, r: number, ink: Ink): void {
	ink.stroke(FD.pale, 0.7, raysD(x, y, 14, 0, r * 0.5, 6));
	let d = "";
	let tips = "";
	for (let i = 0; i < 15; i++) {
		const a = (i * 360) / 15 + rnd(i) * 8;
		const l = r * (0.75 + 0.25 * rnd(i + 40));
		const [ax, ay] = at(x, y, a, r * 0.3);
		const [bx, by] = at(x, y, a, l);
		d += `M${f(ax)} ${f(ay)}` + relD("l", [[bx, by]], [ax, ay]);
		tips += dotD(bx, by, 0.55);
	}
	ink.stroke(FD.pink, 0.65, d);
	ink.fill(FD.tip, tips);
}
function fdShrub(k: number, n: number, ink: Ink): [number, number][] {
	const tips: [number, number][] = [];
	for (let i = 0; i < n; i++) {
		const a = -160 + (140 * i) / (n - 1);
		const len = (34 + 8 * Math.sin(-a * RAD)) * k;
		const [tx, ty] = at(40, 86, a, len);
		ink.stroke(FD.twig, 1.1, `M40 86Q${f(40 + (tx - 40) * 0.3)} ${f(86 - len * 0.6)} ${f(tx)} ${f(ty)}`);
		tips.push([tx, ty]);
	}
	return tips;
}
function fairyDuster(stage: GrowingStage): string {
	const ink = new Ink();
	if (stage === "sprout") {
		ink.stroke(FD.twig, 1, "M40 87L40 72");
		ink.stroke(FD.fol, 1, featherD(40, 76, -140, 9, 5, 70) + featherD(40, 73, -40, 9, 5, 70));
		return ink.toString();
	}
	const k = stage === "leafy" ? 0.78 : 0.9;
	const tips = fdShrub(k, 7, ink);
	const fol = new Ink();
	tips.forEach(([x, y], i) => {
		const t = 0.55;
		const mx = 40 + (x - 40) * t;
		const my = 86 + (y - 86) * t;
		fol.stroke(i % 2 ? FD.fol : FD.fol2, 0.9, featherD(mx, my, -160 + i * 20, 9 * k, 3, 75) + featherD(x, y, -90 + (x - 40) * 1.2, 7 * k, 3, 75));
	});
	let s = ink.toString() + fol.toString();
	if (stage === "bloom") {
		const fl = new Ink();
		for (const [x, y, r] of [
			[22, 50, 6.5],
			[39, 36, 7.5],
			[57, 46, 7],
			[30, 62, 5.5],
			[51, 61, 5.5],
		] as const)
			fdPuff(x, y, r, fl);
		s += fl.toString();
	} else s += tips.map(([x, y]) => circle(x, y - 1, 1.4, "#c9667f")).join("");
	return s;
}

/* ---------- 13. Owl's clover ---------- */
const OW = { stem: "#6f9358", leaf: "#7ea263", body: "#b53f7c", body2: "#cf5c93", tip: "#f4e6ee", dot: "#f1cf45", bud: "#9db57e" };
function owlSpike(x: number, y: number, h: number, ink: Ink): void {
	ink.fill(OW.body, lensD(x, y, -90, h, 3.6, 0));
	const rows = 4;
	for (let i = 0; i < rows; i++) {
		const yy = y - h * (0.3 + i * 0.17);
		const w = 3.1 * Math.sin((0.3 + i * 0.17) * Math.PI);
		ink.fill(OW.body2, dotD(x - w * 0.6, yy + 1, 1.3) + dotD(x + w * 0.6, yy + 1, 1.3));
		ink.fill(OW.tip, dotD(x - w * 0.6, yy, 1) + dotD(x + w * 0.6, yy, 1));
		ink.fill(OW.dot, dotD(x - w * 0.6, yy, 0.4) + dotD(x + w * 0.6, yy, 0.4));
	}
	ink.fill(OW.tip, dotD(x, y - h + 1.2, 1.1));
}
function owlsClover(stage: GrowingStage): string {
	const ink = new Ink();
	const sk: [number, number, number][] =
		stage === "sprout"
			? [
					[38, 72, 0],
					[42, 70, 0],
				]
			: stage === "leafy"
				? [
						[31, 54, 6],
						[40, 46, 7],
						[49, 52, 6],
					]
				: [
						[23, 46, 15],
						[33, 36, 17],
						[44, 30, 18],
						[55, 38, 16],
						[63, 50, 13],
					];
	for (const [x, y] of sk) ink.stroke(OW.stem, 1.2, cubicD(riser(40, 87, x, y)));
	const lv = new Ink();
	sk.forEach(([x, y], j) => {
		const q = riser(40, 87, x, y);
		for (const t of [0.3, 0.55, 0.8]) {
			const [px, py] = bez(q, t);
			lv.fill(OW.leaf, lensD(px, py, -90 + (j % 2 ? 40 : -40) + t * 20, stage === "sprout" ? 6 : 8, 0.9, 1));
		}
	});
	const fl = new Ink();
	if (stage === "bloom") for (const [x, y, h] of sk) owlSpike(x, y + 2, h, fl);
	else if (stage === "leafy") for (const [x, y, h] of sk) fl.fill(OW.bud, lensD(x, y + 1, -90, h, 2.2, 0)).fill(OW.body2, dotD(x, y - h + 2.5, 1.1));
	return ink.toString() + lv.toString() + fl.toString();
}

/* ---------- 14. Dune evening primrose ---------- */
const EP = { leaf: "#93a889", leaf2: "#a9bc9f", stem: "#8a9f7e", petal: "#f7f4ec", shade: "#d8d1c0", pink: "#e9a9bd", pink2: "#d888a0", eye: "#f0cf3a", bud: "#c6b6a2" };
function epRosette(k: number): string {
	const ink = new Ink();
	for (const a of spread(8, -174, -6)) ink.fill(EP.leaf, polyD(40, 86.5, a, 15 * k * droop(a), TOOTHED));
	for (const a of spread(4, -140, -40)) ink.fill(EP.leaf2, polyD(40, 86.5, a, 11 * k, TOOTHED));
	return ink.toString();
}
function epFlower(x: number, y: number, k: number, fill: string, shade: string): string {
	const ink = new Ink();
	ink.fill(shade, roundRingD(x, y + 0.6, 4, 4.4 * k, 4.6 * k, 45));
	ink.fill(fill, roundRingD(x, y, 4, 4.2 * k, 4.6 * k, 45));
	ink.stroke(shade, 0.6, raysD(x, y, 4, 1.5 * k, 6.5 * k, 45));
	ink.fill(EP.eye, dotD(x, y, 1.7 * k));
	ink.stroke(EP.eye, 0.5, raysD(x, y, 6, 1.5 * k, 3.6 * k, 15));
	return ink.toString();
}
function duneEveningPrimrose(stage: GrowingStage): string {
	if (stage === "sprout") return epRosette(1.35);
	const ink = new Ink();
	if (stage === "leafy") {
		ink.stroke(EP.stem, 1.3, cubicD(riser(40, 84, 36, 56)) + cubicD(riser(41, 84, 47, 60)));
		return ink.toString() + epRosette(1.6) + p(lensD(36, 58, -95, 9, 2.4, 1), EP.bud) + p(lensD(47, 62, -80, 8, 2.2, 1), EP.bud);
	}
	ink.stroke(EP.stem, 1.4, cubicD(riser(39, 84, 25, 46)) + cubicD(riser(41, 84, 54, 38)) + cubicD(riser(40, 84, 41, 62)) + cubicD(riser(40, 84, 45, 26)));
	return ink.toString() + epRosette(1.8) + p(lensD(45, 28, -88, 9, 2.4, 1), EP.bud) + epFlower(25, 46, 1.25, EP.petal, EP.shade) + epFlower(54, 38, 1.35, EP.petal, EP.shade) + epFlower(41, 62, 0.95, EP.pink, EP.pink2);
}

/* ---------- 15. Mojave aster ---------- */
const MA = { stem: "#86a07c", leaf: "#93ab88", ray: "#b6a3e2", shade: "#8f7cc6", disc: "#f0c232", bud: "#a9b98f" };
function maHead(x: number, y: number, k: number, ink: Ink): void {
	ink.raw(rayRing(x, y, 20, 2 * k, 6.5 * k, 0.55, MA.shade, 9) + rayRing(x, y, 20, 2 * k, 6.1 * k, 0.55, MA.ray) + circle(x, y, 2.4 * k, MA.disc));
}
function mojaveAster(stage: GrowingStage): string {
	const ink = new Ink();
	const lv = new Ink();
	const heads: [number, number][] =
		stage === "sprout"
			? [
					[37, 72],
					[43, 70],
				]
			: stage === "leafy"
				? [
						[29, 52],
						[40, 44],
						[51, 50],
					]
				: [
						[20, 46],
						[34, 30],
						[49, 26],
						[61, 42],
						[41, 48],
						[30, 60],
					];
	heads.forEach(([x, y], j) => {
		const q = riser(40, 87, x, y);
		ink.stroke(MA.stem, 1.1, cubicD(q));
		for (const t of [0.25, 0.45, 0.65]) {
			const [px, py] = bez(q, t);
			lv.fill(MA.leaf, lensD(px, py, (j + t * 10) % 2 > 1 ? -35 : -145, stage === "sprout" ? 5 : 7, 1.4, 1));
		}
	});
	const fl = new Ink();
	if (stage === "bloom") heads.forEach(([x, y], i) => maHead(x, y, i < 4 ? 1.05 : 0.85, fl));
	else if (stage === "leafy") for (const [x, y] of heads) fl.fill(MA.bud, dotD(x, y, 2)).fill(MA.ray, dotD(x, y - 1.2, 1));
	return ink.toString() + lv.toString() + fl.toString();
}

/* ---------- 16. Ghost flower ---------- */
const GF = { stem: "#8a9e80", leaf: "#9cb090", cup: "#efe4bf", inner: "#d8c999", vein: "#c9b98a", dot: "#843d60", bud: "#d7cfa8" };
function gfCup(x: number, y: number, k: number, ink: Ink, tilt = 0): void {
	const t = (a: number, b: number): string => {
		const r = tilt * RAD;
		const u = a * k;
		const v = b * k;
		return `${f(x + u * Math.cos(r) - v * Math.sin(r))} ${f(y + u * Math.sin(r) + v * Math.cos(r))}`;
	};
	ink.fill(GF.inner, `M${t(-5.2, -8.4)}Q${t(0, -12)} ${t(5.2, -8.4)}Q${t(0, -6)} ${t(-5.2, -8.4)}Z`);
	ink.fill(GF.cup, `M${t(-5.2, -8.4)}Q${t(-5.8, -1.5)} ${t(0, 0)}Q${t(5.8, -1.5)} ${t(5.2, -8.4)}Q${t(3.6, -10)} ${t(1.8, -8)}Q${t(0, -9.8)} ${t(-1.8, -8)}Q${t(-3.6, -10)} ${t(-5.2, -8.4)}Z`);
	ink.stroke(GF.vein, 0.5, `M${t(-1.8, -8)}Q${t(-1.6, -2)} ${t(0, 0)}M${t(1.8, -8)}Q${t(1.6, -2)} ${t(0, 0)}`);
	let d = "";
	for (const [a, b] of [
		[-2.8, -3],
		[-1, -2.2],
		[0.9, -3.4],
		[2.7, -2.6],
		[-3, -5.2],
		[-0.4, -4.8],
		[2.2, -5],
		[0.6, -1.4],
	] as const) {
		const [px, py] = t(a, b).split(" ").map(Number) as [number, number];
		d += dotD(px, py, 0.42 * k);
	}
	ink.fill(GF.dot, d);
}
function ghostFlower(stage: GrowingStage): string {
	const ink = new Ink();
	const lv = new Ink();
	const fl = new Ink();
	if (stage === "sprout") {
		ink.stroke(GF.stem, 1.3, "M40 87L40 70");
		lv.fill(GF.leaf, lensD(40, 80, -150, 8, 2.2, 1) + lensD(40, 77, -30, 8, 2.2, 1) + lensD(40, 72, -110, 6, 1.8, 1) + lensD(40, 72, -70, 6, 1.8, 1));
		return ink.toString() + lv.toString();
	}
	const leafy = stage === "leafy";
	const top = leafy ? 46 : 30;
	ink.stroke(GF.stem, 1.6, `M40 87L40 ${top}`);
	const branches: [number, number, number][] = leafy
		? [
				[60, 31, 56],
				[56, 50, 50],
			]
		: [
				[66, 24, 48],
				[60, 56, 40],
				[48, 30, 44],
			];
	for (const [y0, x, y] of branches) ink.stroke(GF.stem, 1.2, `M40 ${y0}Q${f((40 + x) / 2)} ${f(y0 - 2)} ${f(x)} ${f(y)}`);
	for (const y of leafy ? [80, 72, 64, 56] : [80, 72, 64, 56, 48]) lv.fill(GF.leaf, lensD(40, y, y % 16 ? -160 : -20, 10, 2.4, 1));
	if (leafy) {
		for (const [, x, y] of branches) fl.fill(GF.bud, lensD(x, y, -90, 6, 2.2, 0));
		fl.fill(GF.bud, lensD(40, top, -90, 7, 2.4, 0));
	} else {
		gfCup(40, top, 1.1, fl);
		for (const [, x, y] of branches) gfCup(x, y, 0.95, fl, x < 40 ? -15 : 15);
	}
	return ink.toString() + lv.toString() + fl.toString();
}

/* ---------- 17. Desert chicory ---------- */
const DC = { stem: "#8aa182", leaf: "#99ae8e", ray: "#f8f6ef", shade: "#bdb8a8", eye: "#efe2b0", dot: "#e2bd3c", bud: "#b5c2a2" };
function dcHead(x: number, y: number, k: number, ink: Ink): void {
	const dots = new Ink().fill(DC.dot, roundRingD(x, y, 6, 1.2 * k, 0.4 * k));
	ink.raw(rayRing(x, y, 16, 1.8 * k, 6.9 * k, 0.8, DC.shade, 11) + rayRing(x, y, 16, 1.8 * k, 6.6 * k, 0.8, DC.ray) + circle(x, y, 2.1 * k, DC.eye) + dots);
}
function desertChicory(stage: GrowingStage): string {
	const ink = new Ink();
	const lv = new Ink();
	const fl = new Ink();
	const k = stage === "sprout" ? 0.6 : stage === "leafy" ? 1.1 : 1.3;
	for (const a of spread(5, -168, -12)) lv.fill(DC.leaf, polyD(40, 86.5, a, 11 * k * droop(a), TOOTHED));
	if (stage === "sprout") return line(40, 87, 40, 72, DC.stem, 1.2) + lv.toString() + circle(40, 71, 1.6, DC.bud);
	const heads: [number, number][] =
		stage === "leafy"
			? [
					[34, 50],
					[46, 46],
				]
			: [
					[26, 36],
					[51, 26],
					[44, 50],
					[30, 58],
				];
	ink.stroke(DC.stem, 1.4, `M40 87L40 ${stage === "leafy" ? 62 : 56}`);
	for (const [x, y] of heads) ink.stroke(DC.stem, 1.1, cubicD(riser(40, stage === "leafy" ? 64 : 62, x, y)));
	for (const [x, y] of heads) lv.fill(DC.leaf, lensD((x + 40) / 2, (y + 66) / 2, x < 40 ? -160 : -20, 5, 1, 1));
	if (stage === "leafy") for (const [x, y] of heads) fl.fill(DC.bud, lensD(x, y + 2, -90, 6, 2, 0));
	else heads.forEach(([x, y], i) => dcHead(x, y, i < 2 ? 1.1 : 0.9, fl));
	return ink.toString() + lv.toString() + fl.toString();
}

/* ---------- 18. Indian paintbrush ---------- */
const IP = { stem: "#6b8e55", leaf: "#7c9e62", rows: ["#8fa45a", "#cf6b36", "#e04a2b", "#ec5f30"], tip: "#f08a52" };
function brush(x: number, y: number, h: number, ink: Ink): void {
	const n = 4;
	for (let i = 0; i < n; i++) {
		const yy = y - (h * i) / n;
		const l = h * (0.5 - i * 0.06);
		const c = IP.rows[i] ?? IP.tip;
		ink.fill(c, lensD(x, yy, -90 - 32, l, 1.6, 1) + lensD(x, yy, -90 + 32, l, 1.6, 1) + lensD(x, yy, -90, l * 0.9, 1.9, 1));
	}
	ink.fill(IP.tip, lensD(x, y - h * 0.8, -90, h * 0.35, 1.6, 0));
}
function indianPaintbrush(stage: GrowingStage): string {
	const ink = new Ink();
	const lv = new Ink();
	const fl = new Ink();
	const sk: [number, number, number][] =
		stage === "sprout"
			? [
					[38, 72, 0],
					[42, 74, 0],
				]
			: stage === "leafy"
				? [
						[32, 52, 7],
						[41, 46, 8],
						[50, 54, 7],
					]
				: [
						[22, 44, 14],
						[33, 32, 15],
						[44, 26, 16],
						[55, 34, 15],
						[64, 48, 13],
					];
	for (const [x, y] of sk) ink.stroke(IP.stem, 1.3, cubicD(riser(40, 87, x, y)));
	sk.forEach(([x, y], j) => {
		const q = riser(40, 87, x, y);
		for (const t of [0.35, 0.6, 0.85]) {
			const [px, py] = bez(q, t);
			const s = (j + Math.round(t * 4)) % 2 ? 1 : -1;
			lv.fill(IP.leaf, lensD(px, py, -90 + s * 45, stage === "sprout" ? 6 : 9, 1.3, 1));
		}
	});
	if (stage === "bloom") for (const [x, y, h] of sk) brush(x, y + 1, h, fl);
	else if (stage === "leafy") for (const [x, y, h] of sk) fl.fill(IP.rows[0]!, lensD(x, y + 1, -90, h, 2.2, 0)).fill(IP.rows[2]!, lensD(x, y - h * 0.4, -90, h * 0.6, 1.4, 0));
	return ink.toString() + lv.toString() + fl.toString();
}

/* ---------- 19. Apache plume ---------- */
const AP = { twig: "#b9a48c", leaf: "#7c975f", leaf2: "#93ad74", plume: "#d99ea0", plume2: "#eec7c2", petal: "#f7f4ec", eye: "#e8c13a" };
function apPlume(x: number, y: number, k: number, ink: Ink, j: number): void {
	let d = "";
	let d2 = "";
	for (let i = 0; i < 9; i++) {
		const a = -155 + i * 16 + rnd(i + j * 9) * 6;
		const l = 7.5 * k * (0.75 + 0.35 * Math.sin(-a * RAD));
		const [ex, ey] = at(x, y, a, l);
		const [cx, cy] = at(x, y, a + (i % 2 ? 18 : -18), l * 0.55);
		const seg = `M${f(x)} ${f(y)}Q${f(cx)} ${f(cy)} ${f(ex)} ${f(ey)}`;
		if (i % 2) d2 += seg;
		else d += seg;
	}
	ink.stroke(AP.plume, 0.85, d);
	ink.stroke(AP.plume2, 0.85, d2);
}
function apacheShrub(k: number, ink: Ink, lv: Ink): [number, number][] {
	const tips: [number, number][] = [];
	const n = 9;
	for (let i = 0; i < n; i++) {
		const a = -150 + (120 * i) / (n - 1);
		const len = (36 + 10 * Math.sin(-a * RAD)) * k;
		const [tx, ty] = at(40, 86, a, len);
		const q: [Pt, Pt, Pt, Pt] = [
			[40, 86],
			[40 + (tx - 40) * 0.2, 86 - len * 0.5],
			[tx - (tx - 40) * 0.2, ty + 4],
			[tx, ty],
		];
		ink.stroke(AP.twig, 1, cubicD(q));
		for (let m = 0; m < 6; m++) {
			const t = 0.3 + m * 0.12;
			const [px, py] = bez(q, t);
			lv.stroke((m + i) % 2 ? AP.leaf : AP.leaf2, 1.8, segD(px, py, a + (m % 2 ? 55 : -55), 2.6 * k + 0.4));
		}
		tips.push([tx, ty]);
	}
	return tips;
}
function apachePlume(stage: GrowingStage): string {
	const ink = new Ink();
	const lv = new Ink();
	if (stage === "sprout") {
		ink.stroke(AP.twig, 1.1, "M40 87L40 70M40 78L34 72M40 75L46 69");
		for (const [x, y, a] of [
			[34, 72, -150],
			[34, 72, -90],
			[46, 69, -30],
			[46, 69, -90],
			[40, 70, -60],
			[40, 70, -120],
			[40, 82, -160],
			[40, 80, -20],
		] as const)
			lv.fill(AP.leaf, lensD(x, y, a, 4.2, 1.3, 0));
		return ink.toString() + lv.toString();
	}
	const tips = apacheShrub(stage === "leafy" ? 0.85 : 0.97, ink, lv);
	const fl = new Ink();
	if (stage === "leafy") {
		tips.forEach(([x, y], i) => {
			if (i % 2) return;
			fl.fill(AP.petal, roundRingD(x, y, 5, 1.4, 1.3, -90));
			fl.fill(AP.eye, dotD(x, y, 0.7));
		});
	} else {
		tips.forEach(([x, y], i) => {
			if (i % 3 === 1) {
				fl.fill(AP.petal, roundRingD(x, y, 5, 1.6, 1.5, -90));
				fl.fill(AP.eye, dotD(x, y, 0.8));
			} else apPlume(x, y, 1.15, fl, i);
		});
	}
	return ink.toString() + lv.toString() + fl.toString();
}

/* ---------- 20. Desert dandelion ---------- */
const DD = { leaf: "#7ea68c", leaf2: "#94b8a0", stem: "#7f9a74", ray: "#f6d43a", shade: "#d9b026", eye: "#e8a62a", red: "#b23c26", puff: "#dedad0", seed: "#a08060", tip: "#c4bca8" };
function ddHead(x: number, y: number, k: number, ink: Ink): void {
	ink.raw(rayRing(x, y, 22, 1.4 * k, 6.8 * k, 0.72, DD.shade, 8) + rayRing(x, y, 22, 1.4 * k, 6.4 * k, 0.72, DD.ray) + rayRing(x, y, 14, 0.8 * k, 3.8 * k, 0.75, DD.ray, 6) + circle(x, y, 1 * k, DD.red));
}
function ddRosette(k: number): string {
	const ink = new Ink();
	for (const a of spread(8, -175, -5)) ink.fill(DD.leaf, polyD(40, 86.5, a, 16 * k * droop(a), TOOTHED));
	for (const a of spread(4, -145, -35)) ink.fill(DD.leaf2, polyD(40, 86.5, a, 11 * k, TOOTHED));
	return ink.toString();
}
function desertDandelion(stage: GrowingStage): string {
	if (stage === "sprout") return ddRosette(1.3);
	const ink = new Ink();
	const fl = new Ink();
	if (stage === "leafy") {
		ink.stroke(DD.stem, 1.2, cubicD(riser(40, 84, 34, 56)) + cubicD(riser(41, 84, 47, 60)));
		fl.fill("#a6bb86", lensD(34, 58, -90, 7, 2.2, 0) + lensD(47, 62, -90, 6, 2, 0)).fill(DD.ray, dotD(34, 52.5, 1.2) + dotD(47, 57.5, 1.1));
		return ink.toString() + ddRosette(1.6) + fl.toString();
	}
	ink.stroke(DD.stem, 1.3, cubicD(riser(39, 84, 25, 48)) + cubicD(riser(41, 84, 55, 40)) + cubicD(riser(40, 84, 39, 26)));
	ddHead(25, 48, 1.15, fl);
	ddHead(55, 40, 1.25, fl);
	let puff = "";
	let seeds = "";
	for (let i = 0; i < 24; i++) {
		const a = (i * 360) / 24;
		const [ex, ey] = at(39, 22, a, 7.5);
		puff += `M${f(39)} ${f(22)}L${f(ex)} ${f(ey)}`;
		seeds += dotD(ex, ey, 0.75);
	}
	fl.stroke(DD.puff, 0.5, puff).fill(DD.tip, seeds).fill(DD.seed, dotD(39, 22, 1.3));
	return ink.toString() + ddRosette(1.8) + fl.toString();
}

/* ---------- 21. Bladderpod ---------- */
const BP = { twig: "#7b8a6a", leaf: "#8ea482", leaf2: "#a8ba98", fl: "#f0c62a", fl2: "#d9a81c", pod: "#bdd28e", pod2: "#97b468", seam: "#7f9a58" };
function bpShrub(k: number, ink: Ink, lv: Ink): [number, number][] {
	const tips: [number, number][] = [];
	const n = 8;
	for (let i = 0; i < n; i++) {
		const a = -165 + (150 * i) / (n - 1);
		const len = (28 + 12 * Math.sin(-a * RAD)) * k;
		const [tx, ty] = at(40, 86, a, len);
		const q: [Pt, Pt, Pt, Pt] = [
			[40, 86],
			[40 + (tx - 40) * 0.25, 86 - len * 0.55],
			[tx - (tx - 40) * 0.25, ty + 2],
			[tx, ty],
		];
		ink.stroke(BP.twig, 1.1, cubicD(q));
		for (let m = 0; m < 3; m++) {
			const [px, py] = bez(q, 0.35 + m * 0.25);
			const base = a + (m % 2 ? 60 : -60);
			for (const da of [-30, 0, 30]) lv.stroke((i + m) % 2 ? BP.leaf : BP.leaf2, 2, segD(px, py, base + da, 3.4 * k + 0.4));
		}
		tips.push([tx, ty]);
	}
	return tips;
}
function bpPod(x: number, y: number, k: number, ink: Ink, i: number): void {
	const P = (a: number, b: number) => `${f(x + a * k)} ${f(y + b * k)}`;
	ink.fill(i % 2 ? BP.pod : BP.pod2, `M${P(0, 0)}C${P(-4.2, 2)} ${P(-4.8, 9.5)} ${P(0, 10.5)}C${P(4.8, 9.5)} ${P(4.2, 2)} ${P(0, 0)}Z`);
	ink.stroke(BP.seam, 0.5, `M${P(0, 0.5)}Q${P(-1, 5.5)} ${P(0, 10.2)}`);
}
function bladderpod(stage: GrowingStage): string {
	const ink = new Ink();
	const lv = new Ink();
	const fl = new Ink();
	if (stage === "sprout") {
		ink.stroke(BP.twig, 1.1, "M40 87L40 71");
		for (const [y, a] of [
			[80, -150],
			[76, -30],
			[71, -90],
		] as const)
			for (const da of [-30, 0, 30]) lv.fill(BP.leaf, lensD(40, y, a + da, 5.5, 1.5, 0));
		return ink.toString() + lv.toString();
	}
	const tips = bpShrub(stage === "leafy" ? 0.85 : 1.1, ink, lv);
	tips.forEach(([x, y], i) => {
		if (stage === "leafy" && i % 2) return;
		fl.fill(i % 2 ? BP.fl2 : BP.fl, roundRingD(x, y - 1, 4, 1.3, 1.1, 45) + roundRingD(x + 2.6, y + 1.4, 4, 1.1, 0.9, 0));
	});
	let s = ink.toString() + lv.toString();
	if (stage === "bloom") {
		const pods = new Ink();
		[
			[20, 50],
			[30, 40],
			[47, 38],
			[58, 47],
			[36, 58],
			[52, 60],
		].forEach(([x, y], i) => {
			pods.stroke(BP.twig, 0.7, `M${f(x! - 1)} ${f(y! - 3)}L${f(x!)} ${f(y!)}`);
			bpPod(x!, y!, 1, pods, i);
		});
		s += pods.toString();
	}
	return s + fl.toString();
}

/* ---------- 22. Chia ---------- */
const CI = { leaf: "#6d965a", leaf2: "#84aa6e", stem: "#6b7a4e", bract: "#7a3353", bract2: "#9a4a6c", fl: "#6b72dc", fl2: "#9ca2f2", bud: "#8aa070" };
function chiaBall(x: number, y: number, r: number, ink: Ink, open: boolean): void {
	ink.stroke(open ? CI.bract2 : CI.leaf2, 1.1, raysD(x, y, 12, 0, r * 1.4, 15));
	ink.fill(open ? CI.bract : CI.bud, dotD(x, y, r));
	if (!open) return;
	let d = "";
	let d2 = "";
	for (const [a, l] of [
		[-150, 0.9],
		[-120, 1],
		[-90, 1.05],
		[-60, 1],
		[-30, 0.9],
		[-170, 0.6],
		[-10, 0.6],
	] as const) {
		const [px, py] = at(x, y, a, r * l);
		d += dotD(px, py, r * 0.27);
		const [qx, qy] = at(x, y, a, r * l * 0.5);
		d2 += dotD(qx, qy, r * 0.17);
	}
	ink.fill(CI.fl, d).fill(CI.fl2, d2);
}
function chiaRosette(k: number): string {
	const ink = new Ink();
	for (const a of spread(6, -170, -10)) ink.fill(CI.leaf, polyD(40, 86.5, a, 13 * k * droop(a), TOOTHED));
	for (const a of spread(3, -130, -50)) ink.fill(CI.leaf2, polyD(40, 86.5, a, 9 * k, TOOTHED));
	return ink.toString();
}
function chia(stage: GrowingStage): string {
	if (stage === "sprout") return chiaRosette(1.3);
	const ink = new Ink();
	const fl = new Ink();
	const open = stage === "bloom";
	const stems: [number, number][] = open
		? [
				[26, 32],
				[41, 18],
				[55, 28],
			]
		: [
				[33, 52],
				[47, 46],
			];
	for (const [x, y] of stems) ink.stroke(CI.stem, 1.4, cubicD(riser(40, 84, x, y)));
	for (const [x, y] of stems) {
		const q = riser(40, 84, x, y);
		chiaBall(x, y, open ? 4.3 : 2.8, fl, open);
		if (open) {
			const [mx, my] = bez(q, 0.68);
			chiaBall(mx, my, 3.6, fl, true);
		}
		const [lx, ly] = bez(q, open ? 0.42 : 0.5);
		ink.fill(CI.leaf2, lensD(lx, ly, -150, 5, 1.2, 1) + lensD(lx, ly, -30, 5, 1.2, 1));
	}
	return ink.toString() + chiaRosette(open ? 1.6 : 1.4) + fl.toString();
}

/* ---------- 23. Creosote bush ---------- */
const CR = { twig: "#5f554b", leaf: "#58773a", leaf2: "#77974a", fl: "#efcb31", fuzz: "#ece7da" };
function creosote(stage: GrowingStage): string {
	const k = stage === "sprout" ? 0.3 : stage === "leafy" ? 0.62 : 0.82;
	const n = stage === "sprout" ? 3 : stage === "leafy" ? 7 : 10;
	const ink = new Ink();
	const lv = new Ink();
	const fl = new Ink();
	for (let i = 0; i < n; i++) {
		const a = n === 3 ? -120 + i * 30 : -118 + (56 * i) / (n - 1) + (rnd(i) - 0.5) * 6;
		const len = (60 + 18 * Math.sin(-a * RAD) + rnd(i + 5) * 6) * k;
		const [tx, ty] = at(40, 86, a, len);
		ink.stroke(CR.twig, stage === "sprout" ? 0.9 : 1.1, `M${f(40 + (i - n / 2) * 0.4)} 86.5Q${f(40 + (tx - 40) * 0.3)} ${f(86 - len * 0.5)} ${f(tx)} ${f(ty)}`);
		for (let m = 0; m < 6; m++) {
			const t = 0.35 + m * 0.13;
			if (t > 1.02) break;
			const px = 40 + (tx - 40) * t + (rnd(i * 7 + m) - 0.5) * 4 * k;
			const py = 86 + (ty - 86) * t - Math.sin(t * Math.PI) * 2;
			const d = dotD(px - 1.3, py, 1.1) + dotD(px + 1.2, py - 0.6, 1.2) + dotD(px, py - 1.6, 1);
			lv.fill((m + i) % 2 ? CR.leaf : CR.leaf2, d);
			if (stage === "bloom" && (m + i) % 3 === 0) fl.fill(CR.fl, roundRingD(px + 1, py - 2.6, 5, 1.1, 0.95, -90));
			if (stage === "bloom" && (m + i * 2) % 7 === 3) fl.fill(CR.fuzz, dotD(px - 2, py + 1.5, 1.4));
		}
	}
	return ink.toString() + lv.toString() + fl.toString();
}

/* ---------- 24. Sacred datura ---------- */
const SD = { leaf: "#5f7d66", leaf2: "#748f78", vein: "#47614c", fl: "#f5f3ee", shade: "#d6d0e2", throat: "#bfa6dc", pod: "#7f9a5e", spine: "#a3b87e" };
const DATURA = [0, -1.4, 8, -2, 13, -5, 17, -8.6, 15.4, -4.8, 18.2, -2.5, 16, -0.4, 18.2, 2.2, 15.6, 4.4, 17.2, 8.2, 12.6, 4.8, 8, 2, 0, 1.4];
function datLeaves(k: number): string {
	const out: string[] = [];
	const spots: [number, number, number, number][] = [
		[40, 85, -168, 1],
		[40, 85, -12, 1],
		[40, 84, -140, 0.95],
		[40, 84, -40, 0.95],
		[40, 83, -110, 0.8],
		[40, 83, -70, 0.8],
	];
	spots.forEach(([x, y, a, s], i) => out.push(leaf(x, y, a, 20 * k * s, 7.5 * k * s, { fill: i % 2 ? SD.leaf2 : SD.leaf, dark: SD.vein, shape: 0 })));
	return out.join("");
}
function datFlower(x: number, y: number, a: number, k: number): string {
	const [mx, my] = at(x, y, a, 16 * k);
	return p(polyD(x, y + 0.7, a, k, DATURA), SD.shade) + p(polyD(x, y, a, k, DATURA), SD.fl) + el(mx, my, 1.6 * k, 4.6 * k, SD.throat, a) + el(mx - Math.cos(a * RAD) * 0.6, my - Math.sin(a * RAD) * 0.6, 1.1 * k, 3.2 * k, SD.fl, a);
}
function sacredDatura(stage: GrowingStage): string {
	if (stage === "sprout") return line(40, 87, 40, 76, SD.leaf, 1.6) + leaf(40, 77, -150, 11, 5, { fill: SD.leaf2, dark: SD.vein }) + leaf(40, 76, -30, 11, 5, { fill: SD.leaf, dark: SD.vein });
	if (stage === "leafy") return stem([[40, 84], [40, 70], [41, 60], [41, 50]], SD.leaf, 1.8) + leaf(41, 62, -150, 12, 5, { fill: SD.leaf2, dark: SD.vein }) + leaf(41, 58, -30, 12, 5, { fill: SD.leaf, dark: SD.vein }) + datLeaves(1.2) + p(lensD(41, 52, -88, 14, 2.6, 1), "#c9d2b6");
	let s = stem([[40, 80], [38, 70], [34, 62], [32, 56]], SD.leaf, 2) + stem([[40, 80], [43, 70], [47, 62], [49, 56]], SD.leaf, 2);
	s += datLeaves(1.4);
	let spines = "";
	for (let i = 0; i < 14; i++) {
		const [a, b] = at(62, 62, i * (360 / 14), 4.6);
		const [c, d] = at(62, 62, i * (360 / 14), 2);
		spines += `M${f(c)} ${f(d)}L${f(a)} ${f(b)}`;
	}
	s += `<path d="${spines}" stroke="${SD.spine}" stroke-width=".8" fill="none" stroke-linecap="round"/>` + circle(62, 62, 3.6, SD.pod);
	return s + datFlower(32, 58, -112, 1.45) + datFlower(49, 56, -62, 1.5);
}

/* ---------- 25. Desert five-spot ---------- */
const FS = { stem: "#7d8b58", leaf: "#86a35e", leaf2: "#9db878", globe: "#e7a1c5", shade: "#cd7fab", hi: "#f4c9de", spot: "#a91f3e", mouth: "#b85688" };
function fsGlobe(x: number, y: number, r: number, ink: Ink): void {
	ink.fill(FS.shade, dotD(x, y + 0.5, r));
	ink.fill(FS.globe, dotD(x - 0.3, y, r * 0.95));
	ink.fill(FS.hi, lensD(x - r * 0.55, y + r * 0.2, -80, r * 1.05, r * 0.22, 0));
	ink.fill(FS.mouth, dotD(x, y - r * 0.82, r * 0.3));
	ink.fill(FS.spot, dotD(x - r * 0.42, y + r * 0.08, r * 0.16) + dotD(x + r * 0.42, y + r * 0.08, r * 0.16) + dotD(x, y + r * 0.42, r * 0.16) + dotD(x - r * 0.25, y - r * 0.3, r * 0.14) + dotD(x + r * 0.25, y - r * 0.3, r * 0.14));
}
function fiveSpot(stage: GrowingStage): string {
	const ink = new Ink();
	const lv = new Ink();
	const fl = new Ink();
	const heads: [number, number, number][] =
		stage === "sprout"
			? [[40, 72, 0]]
			: stage === "leafy"
				? [
						[33, 52, 2.4],
						[46, 48, 2.6],
					]
				: [
						[27, 42, 6.4],
						[51, 34, 7],
						[42, 54, 5.4],
					];
	for (const [x, y] of heads) ink.stroke(FS.stem, 1.3, cubicD(riser(40, 87, x, y)));
	heads.forEach(([x, y], j) => {
		const q = riser(40, 87, x, y);
		for (const t of stage === "sprout" ? [0.35, 0.75] : [0.25, 0.5, 0.72]) {
			const [px, py] = bez(q, t);
			const sz = stage === "sprout" ? 5 : 6.5;
			lv.fill(j % 2 ? FS.leaf : FS.leaf2, lensD(px, py, -150 + t * 30, sz, sz * 0.48, 0) + lensD(px, py, -30 - t * 30, sz, sz * 0.48, 0));
		}
	});
	if (stage === "bloom") for (const [x, y, r] of heads) fsGlobe(x, y - r + 1, r, fl);
	else if (stage === "leafy") for (const [x, y, r] of heads) fl.fill(FS.shade, dotD(x, y - r + 1, r)).fill(FS.globe, dotD(x - 0.4, y - r + 0.6, r * 0.6));
	return ink.toString() + lv.toString() + fl.toString();
}

/* ---------- registry ---------- */

const kebab = (name: string): string =>
	name
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		.replace(/'/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
const sp = (name: string, draw: (stage: GrowingStage) => string): Species => ({ id: kebab(name), name, draw });

export const SPECIES: Species[] = [
	sp("California poppy", californiaPoppy),
	sp("Desert marigold", desertMarigold),
	sp("Globe mallow", globeMallow),
	sp("Arizona lupine", arizonaLupine),
	sp("Brittlebush", brittlebush),
	sp("Ocotillo", ocotillo),
	sp("Desert sand verbena", sandVerbena),
	sp("Firecracker penstemon", firecrackerPenstemon),
	sp("Desert lily", desertLily),
	sp("Chuparosa", chuparosa),
	sp("Desert willow", desertWillow),
	sp("Fairy duster", fairyDuster),
	sp("Owl's clover", owlsClover),
	sp("Dune evening primrose", duneEveningPrimrose),
	sp("Mojave aster", mojaveAster),
	sp("Ghost flower", ghostFlower),
	sp("Desert chicory", desertChicory),
	sp("Indian paintbrush", indianPaintbrush),
	sp("Apache plume", apachePlume),
	sp("Desert dandelion", desertDandelion),
	sp("Bladderpod", bladderpod),
	sp("Chia", chia),
	sp("Creosote bush", creosote),
	sp("Sacred datura", sacredDatura),
	sp("Desert five-spot", fiveSpot),
];
