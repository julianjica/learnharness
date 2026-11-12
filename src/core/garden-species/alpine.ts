/**
 * Garden species, family: alpine and mountain flowers. Each draws sprout,
 * leafy and bloom in the kit's flat style (see kit.ts); the kit draws soil
 * and seed. Many are low cushions and mats: their bloom is full-grown even
 * when it stays close to the ground.
 */
import { circle, f, GREEN, leaf, line, stem, type GrowingStage, type Pt, type Species } from "./kit";

/* ---------- private helpers ---------- */

/** A filled path. */
function p(d: string, fill: string): string {
	return `<path d="${d}" fill="${fill}"/>`;
}

/** A stroked path (stems, ribs, hairs). */
function sp(d: string, stroke: string, w: number): string {
	return `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round"/>`;
}

/** A rotated ellipse. */
function el(cx: number, cy: number, rx: number, ry: number, fill: string, rot = 0): string {
	const t = rot ? ` transform="rotate(${f(rot)} ${f(cx)} ${f(cy)})"` : "";
	return `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}" fill="${fill}"${t}/>`;
}

/** A group translated to (x, y), rotated and scaled. */
function g(x: number, y: number, body: string, rot = 0, k = 1): string {
	const r = rot ? ` rotate(${f(rot)})` : "";
	const s = k !== 1 ? ` scale(${f(k)})` : "";
	return `<g transform="translate(${f(x)} ${f(y)})${r}${s}">${body}</g>`;
}

/** The point r from (x, y) heading deg. */
function pol(x: number, y: number, deg: number, r: number): [number, number] {
	const a = (deg * Math.PI) / 180;
	return [x + Math.cos(a) * r, y + Math.sin(a) * r];
}

/** Merges path data per fill into one <path> each, in first-seen order. */
class Ink {
	private parts = new Map<string, string>();
	add(fill: string, d: string): this {
		this.parts.set(fill, (this.parts.get(fill) ?? "") + d);
		return this;
	}
	toString(): string {
		return [...this.parts].map(([fill, d]) => p(d, fill)).join("");
	}
}

/** Subpath of a circle. */
function dotSub(x: number, y: number, r: number): string {
	return `M${f(x - r)} ${f(y)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0`;
}

/** Round dots of radius r at each point, as one stroked path (zero-length round-capped segments). */
function dots(pts: readonly (readonly [number, number])[], r: number, fill: string): string {
	if (!pts.length) return "";
	return `<path d="${pts.map(([x, y]) => `M${f(x)} ${f(y)}h0`).join("")}" stroke="${fill}" stroke-width="${f(2 * r)}" stroke-linecap="round"/>`;
}

/** Flowers of n round petals (radius pr, centres r out) at each point, in one dashed path. */
function rings(cs: readonly (readonly [number, number])[], r: number, n: number, pr: number, fill: string, off = -90): string {
	if (!cs.length) return "";
	const rr = Number(f(r));
	let d = "";
	for (const [x, y] of cs) {
		const [ax, ay] = pol(x, y, off, rr);
		const [bx, by] = pol(x, y, off + 180, rr);
		d += `M${f(ax)} ${f(ay)}A${rr} ${rr} 0 1 1 ${f(bx)} ${f(by)}A${rr} ${rr} 0 1 1 ${f(ax)} ${f(ay)}`;
	}
	return `<path d="${d}" fill="none" stroke="${fill}" stroke-width="${f(pr * 2)}" stroke-linecap="round" stroke-dasharray="0 ${((2 * Math.PI * rr) / n).toFixed(3)}"/>`;
}

/** n radial capsule petals around (x, y) from r0 to r1, w wide, in one stroked path. */
function rays(x: number, y: number, n: number, r0: number, r1: number, w: number, fill: string, off = -90): string {
	let d = "";
	for (let i = 0; i < n; i++) {
		const a = off + (i * 360) / n;
		const [ax, ay] = pol(x, y, a, r0);
		const [bx, by] = pol(x, y, a, r1);
		d += `M${f(ax)} ${f(ay)}L${f(bx)} ${f(by)}`;
	}
	return sp(d, fill, w);
}

/** Subpath of a rotated ellipse. */
function ovalSub(cx: number, cy: number, rx: number, ry: number, rot: number): string {
	const [x1, y1] = pol(cx, cy, rot, rx);
	const [x2, y2] = pol(cx, cy, rot, -rx);
	const a = `A${f(rx)} ${f(ry)} ${f(rot)} 1 0`;
	return `M${f(x1)} ${f(y1)}${a} ${f(x2)} ${f(y2)}${a} ${f(x1)} ${f(y1)}Z`;
}

/** Subpath of a pointed lens from (x, y) heading deg, len long and about 2w wide. */
function lensSub(x: number, y: number, deg: number, len: number, w: number): string {
	const r = (deg * Math.PI) / 180;
	const c = Math.cos(r);
	const sn = Math.sin(r);
	const mx = x + c * len * 0.45;
	const my = y + sn * len * 0.45;
	const k = w * 1.25;
	return `M${f(x)} ${f(y)}Q${f(mx - sn * k)} ${f(my + c * k)} ${f(x + c * len)} ${f(y + sn * len)}Q${f(mx + sn * k)} ${f(my - c * k)} ${f(x)} ${f(y)}Z`;
}

/** Subpath of a blunt oval leaf from (x, y) heading deg. */
function blobLeafSub(x: number, y: number, deg: number, len: number, w: number): string {
	const [cx, cy] = pol(x, y, deg, len / 2);
	return ovalSub(cx, cy, len / 2, w, deg);
}

/** n round petals around (x, y) as subpaths: centres r out, radius pr. */
function roundPetals(x: number, y: number, n: number, r: number, pr: number, off = -90): string {
	let d = "";
	for (let i = 0; i < n; i++) {
		const [px, py] = pol(x, y, off + (i * 360) / n, r);
		d += dotSub(px, py, pr);
	}
	return d;
}

/** n oval petals around (x, y) as subpaths, long axis radial. */
function ovalPetals(x: number, y: number, n: number, r: number, rx: number, ry: number, off = -90): string {
	let d = "";
	for (let i = 0; i < n; i++) {
		const a = off + (i * 360) / n;
		const [px, py] = pol(x, y, a, r);
		d += ovalSub(px, py, rx, ry, a);
	}
	return d;
}

/** n pointed petals radiating from (x, y) as subpaths. */
function spikeSub(x: number, y: number, n: number, len: number, w: number, off = -90): string {
	let d = "";
	for (let i = 0; i < n; i++) d += lensSub(x, y, off + (i * 360) / n, len, w);
	return d;
}

/** A bumpy dome (cushion plant) standing on y = base, as one subpath. */
function domeSub(cx: number, base: number, w: number, h: number, n: number): string {
	let d = `M${f(cx - w)} ${f(base)}`;
	let px = cx - w;
	let py = base;
	for (let i = 1; i <= n; i++) {
		const t = Math.PI - (Math.PI * i) / n;
		const x = cx + Math.cos(t) * w;
		const y = base - Math.sin(t) * h;
		const r = Math.hypot(x - px, y - py) * 0.62;
		d += `A${f(r)} ${f(r)} 0 0 1 ${f(x)} ${f(y)}`;
		px = x;
		py = y;
	}
	return d + "Z";
}

/** Fixed spots spread over a unit half-disk (u across, v up), for flowers on cushions. */
const SPOTS: readonly Pt[] = [
	[0, 0.86], [-0.36, 0.8], [0.36, 0.78], [-0.66, 0.56], [-0.16, 0.6], [0.18, 0.58], [0.58, 0.56],
	[-0.84, 0.26], [-0.44, 0.36], [0, 0.34], [0.42, 0.34], [0.8, 0.28], [-0.62, 0.1], [-0.2, 0.14], [0.24, 0.12], [0.62, 0.1],
];

/** A cubic stem's path data. */
function cub(a: Pt, b: Pt, c: Pt, d: Pt): string {
	return `M${f(a[0])} ${f(a[1])}C${f(b[0])} ${f(b[1])} ${f(c[0])} ${f(c[1])} ${f(d[0])} ${f(d[1])}`;
}

/** Path data for stems from (x0, y0) bending to each tip (one quadratic each). */
function stalks(x0: number, y0: number, tips: readonly Pt[], bend = 0.55): string {
	return tips.map(([x, y]) => `M${f(x0)} ${f(y0)}Q${f(x0 + (x - x0) * 0.1)} ${f(y0 + (y - y0) * bend)} ${f(x)} ${f(y)}`).join("");
}

/* ---------- 1. Edelweiss ---------- */
const EDEL = { wool: "#f1ede3", shade: "#cdc6b4", leaf: "#a2b199", leaf2: "#8a9c82", stem: "#8b9a82", disk: "#d9cd92", dot: "#ae9f5c" };
function edelTuft(ink: Ink, k: number): void {
	for (let i = 0; i < 7; i++) ink.add(i % 2 ? EDEL.leaf : EDEL.leaf2, lensSub(40, 86, -168 + i * 26, (9 + (i % 2) * 3 - Math.abs(i - 3) * 0.5) * k, 1.3 * k));
}
function edelHead(x: number, y: number, k: number): string {
	let a = "";
	let b = "";
	const lens = [9, 7, 8.5, 6.5, 9.5, 7, 8, 7.5, 6.8];
	for (const [i, l] of lens.entries()) {
		const d = lensSub(x, y, -90 + i * 40, l * k, 2.3 * k);
		if (i % 2) a += d;
		else b += d;
	}
	const c = ([[0, 0], [-2.4, -1], [2.3, -0.8], [0.4, 2.4], [-1.6, 2], [1.2, -2.4]] as const).map(([dx, dy]): Pt => [x + dx * k, y + dy * k]);
	return p(a, EDEL.shade) + p(b, EDEL.wool) + dots(c, 1.6 * k, EDEL.disk) + dots(c.map(([cx, cy]): Pt => [cx + 0.3, cy + 0.3]), 0.55 * k, EDEL.dot);
}
function edelStems(ink: Ink, tips: readonly Pt[]): string {
	for (const [x, y] of tips) {
		for (const t of [0.35, 0.6]) {
			const sx = 40 + (x - 40) * t * t;
			const sy = 86 + (y - 86) * t;
			ink.add(EDEL.leaf, lensSub(sx, sy, x < 40 ? -150 : -30, 7, 1) + lensSub(sx, sy - 3, x < 40 ? -40 : -140, 6, 0.9));
		}
	}
	return sp(stalks(40, 86, tips, 0.3), EDEL.stem, 1.4);
}
function edelweiss(stage: GrowingStage): string {
	const ink = new Ink();
	if (stage === "sprout") {
		edelTuft(ink, 1.15);
		return ink.toString();
	}
	if (stage === "leafy") {
		const tips: Pt[] = [[35, 52], [47, 56]];
		const st = edelStems(ink, tips);
		edelTuft(ink, 1.5);
		return st + ink.toString() + tips.map(([x, y]) => p(spikeSub(x, y, 6, 4, 1.4), EDEL.shade) + circle(x, y, 1.8, EDEL.wool)).join("");
	}
	const tips: Pt[] = [[40, 27], [26, 42], [55, 38]];
	const st = edelStems(ink, tips);
	edelTuft(ink, 1.65);
	return st + ink.toString() + edelHead(40, 27, 1.15) + edelHead(26, 42, 0.85) + edelHead(55, 38, 0.9);
}

/* ---------- 2. Alpine aster ---------- */
const ASTER = { ray: "#ab8fdc", shade: "#7a60b6", disk: "#f2c53a", diskD: "#d8951c", leaf: "#5f9a4e", leaf2: "#7aae60", stem: "#4a7f3e" };
function asterRosette(k: number): string {
	const o = { fill: ASTER.leaf, rib: false };
	return leaf(40, 86, -168, 12 * k, 3 * k, o) + leaf(40, 86, -12, 12 * k, 3 * k, o) + leaf(40, 86, -135, 11 * k, 2.8 * k, { ...o, fill: ASTER.leaf2 }) + leaf(40, 86, -45, 11 * k, 2.8 * k, { ...o, fill: ASTER.leaf2 }) + leaf(40, 86, -100, 9 * k, 2.4 * k, o);
}
function asterHead(x: number, y: number, k: number): string {
	const ray = (fill: string, off: number, len: number) => {
		let d = "";
		for (let i = 0; i < 24; i++) {
			const a = off + i * 15;
			const [x1, y1] = pol(x, y, a, 4 * k);
			const [x2, y2] = pol(x, y, a, len * k);
			d += `M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}`;
		}
		return sp(d, fill, 1.6 * k);
	};
	return ray(ASTER.shade, 7.5, 11.5) + ray(ASTER.ray, 0, 12) + circle(x, y, 4.2 * k, ASTER.disk) + circle(x + 0.6 * k, y + 0.8 * k, 2.2 * k, ASTER.diskD);
}
function alpineAster(stage: GrowingStage): string {
	if (stage === "sprout") return asterRosette(0.95);
	if (stage === "leafy") {
		return stem([[40, 86], [40, 72], [39, 60], [40, 50]], ASTER.stem, 1.6) + asterRosette(1.4) + leaf(40, 64, -40, 7, 1.6, { fill: ASTER.leaf2, rib: false }) + circle(40, 48, 3, "#7aa060") + p(spikeSub(40, 47, 7, 3.5, 0.9, -90), ASTER.ray);
	}
	let s = stem([[40, 86], [40, 66], [37, 48], [38, 34]], ASTER.stem, 1.8) + stem([[41, 86], [44, 72], [52, 64], [57, 58]], ASTER.stem, 1.4);
	s += asterRosette(1.55) + leaf(39, 58, -150, 8, 1.8, { fill: ASTER.leaf2, rib: false }) + leaf(39, 48, -35, 7, 1.6, { fill: ASTER.leaf, rib: false });
	return s + asterHead(57, 57, 0.72) + asterHead(38, 31, 1.2);
}

/* ---------- 3. Trumpet gentian ---------- */
const GENT = { a: "#2646b6", b: "#3e66d8", throat: "#16286e", leaf: "#4c8a44", leaf2: "#64a254", calyx: "#5b8e47", spot: "#8cbc5a" };
function gentRosette(k: number): string {
	const o = { rib: true, fill: GENT.leaf };
	return leaf(40, 86, -172, 12 * k, 4 * k, o) + leaf(40, 86, -8, 12 * k, 4 * k, o) + leaf(40, 86, -140, 11 * k, 3.8 * k, { ...o, fill: GENT.leaf2 }) + leaf(40, 86, -40, 11 * k, 3.8 * k, { ...o, fill: GENT.leaf2 }) + leaf(40, 86, -110, 8 * k, 3 * k, o) + leaf(40, 86, -70, 8 * k, 3 * k, o);
}
function trumpet(x: number, base: number, top: number, w: number): string {
	const h = base - top;
	let s = p(`M${f(x - 2.4)} ${f(base)}C${f(x - 3)} ${f(base - h * 0.5)} ${f(x - w * 0.6)} ${f(top + h * 0.16)} ${f(x - w)} ${f(top)}L${f(x + w)} ${f(top)}C${f(x + w * 0.6)} ${f(top + h * 0.16)} ${f(x + 3)} ${f(base - h * 0.5)} ${f(x + 2.4)} ${f(base)}Z`, GENT.a);
	s += p(`M${f(x + 0.4)} ${f(base)}C${f(x + 1)} ${f(base - h * 0.5)} ${f(x + w * 0.35)} ${f(top + h * 0.2)} ${f(x + w * 0.62)} ${f(top)}L${f(x + w * 0.1)} ${f(top)}C${f(x + w * 0.1)} ${f(top + h * 0.2)} ${f(x)} ${f(base - h * 0.5)} ${f(x - 0.6)} ${f(base)}Z`, GENT.b);
	let lobes = "";
	for (let i = 0; i < 5; i++) {
		const x0 = x - w * 1.08 + (i * w * 2.16) / 5;
		lobes += `M${f(x0)} ${f(top + 0.6)}Q${f(x0 + w * 0.12)} ${f(top - 4)} ${f(x0 + w * 0.24)} ${f(top - 5.5)}Q${f(x0 + w * 0.36)} ${f(top - 4)} ${f(x0 + w * 0.432)} ${f(top + 0.6)}Z`;
	}
	s += p(lobes, GENT.a) + el(x, top + 0.6, w * 0.86, 2.4, GENT.throat);
	s += p(`${dotSub(x - w * 0.3, top + 0.9, 0.7)}${dotSub(x + w * 0.25, top + 1.1, 0.7)}${dotSub(x, top + 1.6, 0.6)}`, GENT.spot);
	return s + p(`M${f(x - 3.6)} ${f(base + 1)}L${f(x - 4)} ${f(base - 6)}L${f(x - 1.5)} ${f(base - 2.5)}L${f(x)} ${f(base - 7)}L${f(x + 1.5)} ${f(base - 2.5)}L${f(x + 4)} ${f(base - 6)}L${f(x + 3.6)} ${f(base + 1)}Z`, GENT.calyx);
}
function trumpetGentian(stage: GrowingStage): string {
	if (stage === "sprout") return gentRosette(0.9);
	if (stage === "leafy") {
		return gentRosette(1.3) + p("M38 82C35.5 74 37 64 40 56C43 64 44.5 74 42 82Z", GENT.a) + p("M40 56C41.5 64 42 72 41.4 82L40 82C40.2 72 40.4 64 40 56Z", GENT.b) + p("M36.6 83L36 75L38.6 78L40 72L41.4 78L44 75L43.4 83Z", GENT.calyx);
	}
	return gentRosette(1.35) + trumpet(40, 80, 43, 12) + p("M58 79C56 74 57 69 59 65C61 69 62 74 60 79Z", GENT.a) + p("M57 81L56.6 76L59 78L61.4 76L61 81Z", GENT.calyx);
}

/* ---------- 4. Alpine forget-me-not ---------- */
const FMN = { a: "#74b0f0", b: "#5d96dc", eye: "#f4d64a", leaf: "#6f9e5c", leaf2: "#89b573", stem: "#5a8a48", bud: "#e6a0c2" };
function fmnTuft(ink: Ink, k: number): void {
	for (let i = 0; i < 7; i++) ink.add(i % 2 ? FMN.leaf2 : FMN.leaf, blobLeafSub(40, 86, -165 + i * 25, (10 - Math.abs(i - 3) * 0.6) * k, 2.4 * k));
}
function fmnFlowers(spots: readonly Pt[], k: number): string {
	return rings(spots.filter((_, i) => i % 3), 1.75 * k, 5, 1.45 * k, FMN.a) + rings(spots.filter((_, i) => !(i % 3)), 1.75 * k, 5, 1.45 * k, FMN.b, -54) + dots(spots, 0.85 * k, FMN.eye);
}
function budDots(pts: readonly Pt[]): Pt[] {
	return pts.flatMap(([x, y]): Pt[] => [[x, y], [x + 2.2, y + 1.4], [x - 2, y + 1.6]]);
}
function alpineForgetMeNot(stage: GrowingStage): string {
	const ink = new Ink();
	if (stage === "sprout") {
		fmnTuft(ink, 0.95);
		return ink.toString();
	}
	if (stage === "leafy") {
		const tips: Pt[] = [[31, 56], [42, 50], [51, 58]];
		fmnTuft(ink, 1.45);
		return sp(stalks(40, 84, tips), FMN.stem, 1.1) + ink.toString() + dots(budDots(tips), 1.4, FMN.bud) + fmnFlowers([[44, 55], [33, 61]], 1);
	}
	const spots: Pt[] = [[40, 42], [32, 45], [48, 45], [25, 51], [36, 50], [44, 50], [55, 51], [20, 58], [30, 56], [40, 56], [50, 56], [60, 58], [25, 63], [35, 62], [45, 62], [55, 63]];
	fmnTuft(ink, 1.55);
	const st = sp(stalks(40, 84, [[25, 60], [33, 52], [40, 46], [48, 52], [56, 60]]), FMN.stem, 1.1);
	return st + ink.toString() + dots(budDots([[28, 40], [52, 40]]), 1.3, FMN.bud) + fmnFlowers(spots, 1.1);
}

/* ---------- 5. Mossy saxifrage ---------- */
const MOSS = { base: "#3f7a33", a: "#5a9a44", b: "#82be5e", stalk: "#9a6a58", petal: "#f6f4ec", shade: "#cfcab8", eye: "#c9d670" };
function mossCushion(w: number, h: number): string {
	let fingers = "";
	for (const s of [0.9, 0.62, 0.34]) {
		const n = Math.round(9 * s) + 2;
		for (let i = 0; i < n; i++) {
			const t = 12 + (156 * (i + 0.5)) / n + s * 20;
			const a = (Math.min(t, 168) * Math.PI) / 180;
			const x = 40 + Math.cos(a) * w * s;
			const y = 87 - Math.sin(a) * h * s;
			fingers += lensSub(x, y, -(a * 180) / Math.PI, 4.2, 0.9);
		}
	}
	return p(domeSub(40, 87, w, h, 9), MOSS.base) + p(domeSub(40, 87, w * 0.9, h * 0.86, 8), MOSS.a) + p(fingers, MOSS.b);
}
function mossFlowers(cs: readonly Pt[], k: number): string {
	return rings(cs, 2.3 * k, 5, 1.9 * k, MOSS.shade, -54) + rings(cs, 2.2 * k, 5, 1.8 * k, MOSS.petal) + dots(cs, k, MOSS.eye);
}
function mossySaxifrage(stage: GrowingStage): string {
	if (stage === "sprout") return mossCushion(10, 11);
	if (stage === "leafy") {
		const tips: Pt[] = [[32, 58], [40, 54], [48, 59]];
		return sp(tips.map(([x, y]) => `M${f(x)} 74L${f(x)} ${f(y)}`).join(""), MOSS.stalk, 0.9) + mossCushion(19, 16) + p(tips.map(([x, y]) => dotSub(x, y, 1.5)).join(""), MOSS.shade);
	}
	const fl: Pt[] = [[26, 54], [34, 46], [45, 44], [54, 52], [40, 38]];
	const d = fl.map(([x, y]) => `M${f(40 + (x - 40) * 0.6)} 74Q${f(x)} ${f(y + 10)} ${f(x)} ${f(y)}`).join("");
	return sp(d, MOSS.stalk, 0.9) + mossCushion(22, 18) + mossFlowers(fl, 1.1);
}

/* ---------- 6. Moss campion ---------- */
const CAMP = { base: "#356b2e", a: "#4f8f3c", dot: "#6fae52", pink: "#e56aa8", pinkD: "#b8407e", eye: "#f8d4e4" };
function campion(w: number, h: number, flowers: number, bud: boolean): string {
	const tex: Pt[] = [];
	for (let v = 0.12; v < 0.95; v += 0.17) {
		const half = Math.sqrt(1 - v * v);
		for (let u = -half + 0.08; u < half - 0.04; u += 0.16) tex.push([40 + u * w * 0.9 + ((v * 7) % 2), 87 - v * h * 0.9]);
	}
	const fl = SPOTS.slice(0, flowers).map(([u, v]): Pt => [40 + u * w * 0.86, 87 - v * h * 0.9]);
	const top = bud ? dots(fl, 1.3, CAMP.pinkD) : rings(fl, 1.55, 5, 1.25, CAMP.pink) + dots(fl, 0.65, CAMP.eye);
	return p(domeSub(40, 87, w, h, 15), CAMP.base) + p(domeSub(40, 87, w * 0.94, h * 0.92, 14), CAMP.a) + dots(tex, 0.75, CAMP.dot) + top;
}
function mossCampion(stage: GrowingStage): string {
	if (stage === "sprout") return campion(9, 10, 0, false);
	if (stage === "leafy") return campion(19, 17, 4, true);
	return campion(27, 25, 16, false);
}

/* ---------- 7. Alpine poppy ---------- */
const APOP = { a: "#f6df70", b: "#e3c048", c: "#fbeea6", eye: "#97ad62", st: "#ee9e22", leaf: "#93ab89", leaf2: "#a9bf9e", stalk: "#8ea482", bud: "#8a7a52" };
function dividedLeaf(x: number, y: number, deg: number, len: number): string {
	let d = lensSub(x, y, deg, len, 1);
	for (const t of [0.35, 0.58, 0.8]) {
		const [px, py] = pol(x, y, deg, len * t);
		const l = len * (0.42 - t * 0.25);
		d += lensSub(px, py, deg - 48, l, 0.9) + lensSub(px, py, deg + 48, l, 0.9);
	}
	return d;
}
function poppyTuft(k: number): string {
	const ink = new Ink();
	for (const [i, a] of [-152, -122, -98, -76, -50, -26].entries()) ink.add(i % 2 ? APOP.leaf : APOP.leaf2, dividedLeaf(40, 86, a, (13 - Math.abs(a + 90) / 20) * k));
	return ink.toString();
}
function poppyCup(x: number, y: number, k: number): string {
	let s = el(x, y - 3 * k, 7 * k, 2.6 * k, APOP.b) + el(x - 4 * k, y, 4 * k, 5.2 * k, APOP.a, -28) + el(x + 4 * k, y, 4 * k, 5.2 * k, APOP.a, 28);
	s += p(`M${f(x - 6 * k)} ${f(y - 2 * k)}Q${f(x)} ${f(y + 10 * k)} ${f(x + 6 * k)} ${f(y - 2 * k)}Q${f(x)} ${f(y + 1 * k)} ${f(x - 6 * k)} ${f(y - 2 * k)}Z`, APOP.c);
	let st = "";
	for (let i = 0; i < 6; i++) st += dotSub(x - 3.6 * k + i * 1.44 * k, y - 3 * k + Math.abs(i - 2.5) * 0.3, 0.7 * k);
	return s + p(st, APOP.st) + circle(x, y - 3.4 * k, 1.2 * k, APOP.eye);
}
function nodBud(x: number, y: number, k: number): string {
	return el(x, y, 2.5 * k, 3.6 * k, APOP.bud, -15) + el(x - 0.6 * k, y - 0.6 * k, 1.2 * k, 2.2 * k, "#a3946a", -15);
}
function alpinePoppy(stage: GrowingStage): string {
	if (stage === "sprout") return poppyTuft(0.85);
	if (stage === "leafy") {
		return sp("M40 84Q38 60 33 52Q31 50 30 53M41 84Q44 66 49 60Q51 58 52 61", APOP.stalk, 1.1) + poppyTuft(1.35) + nodBud(30, 56, 1) + nodBud(52, 64, 0.9);
	}
	const s = sp("M40 84Q38 54 33 34M41 84Q45 60 52 45M41 84Q52 74 58 62Q60 59 61 62", APOP.stalk, 1.2) + poppyTuft(1.45);
	return s + nodBud(61, 65, 1) + poppyCup(52, 43, 1) + poppyCup(33, 31, 1.2);
}

/* ---------- 8. Mountain avens ---------- */
const AVENS = { leaf: "#3d6e38", leaf2: "#55894a", under: "#c3ccb8", petal: "#fbfaf2", shade: "#d3cfbf", eye: "#f0c23a", eyeD: "#c99418", stalk: "#7c6a52" };
function scallopSub(x: number, y: number, deg: number, len: number, w: number): string {
	let d = blobLeafSub(x, y, deg, len, w);
	for (const t of [0.36, 0.64]) {
		const [cx, cy] = pol(x, y, deg, len * t);
		const [ax, ay] = pol(cx, cy, deg - 90, w * 0.85);
		const [bx, by] = pol(cx, cy, deg + 90, w * 0.85);
		d += dotSub(ax, ay, w * 0.42) + dotSub(bx, by, w * 0.42);
	}
	return d;
}
function avensMat(k: number, n: number): string {
	const ink = new Ink();
	const angles = [-176, -150, -126, -104, -82, -58, -34, -8];
	for (const [i, a] of angles.entries()) {
		if (n < 8 && i % 2) continue;
		const l = (i % 2 ? 11 : 13) * k;
		ink.add(i % 3 === 1 ? AVENS.leaf2 : AVENS.leaf, scallopSub(40 + (a < -90 ? -2 : 2), 86, a, l, 2.1 * k));
		if (i % 3 === 2) ink.add(AVENS.under, lensSub(40, 86, a + (a < -90 ? 10 : -10), l * 0.7, 0.9 * k));
	}
	return ink.toString();
}
function avensFlower(x: number, y: number, k: number): string {
	return rays(x, y, 8, 2 * k, 5.4 * k, 3.6 * k, AVENS.shade, -67.5) + rays(x, y, 8, 2 * k, 5 * k, 3.4 * k, AVENS.petal) + circle(x, y, 2.1 * k, AVENS.eye) + rings([[x, y]], 1.1 * k, 6, 0.45 * k, AVENS.eyeD);
}
function mountainAvens(stage: GrowingStage): string {
	if (stage === "sprout") return avensMat(0.85, 4);
	if (stage === "leafy") return sp("M41 84Q44 70 46 58", AVENS.stalk, 1.1) + avensMat(1.35, 8) + el(46, 56, 2.4, 3.2, AVENS.shade) + el(46, 58, 2.2, 1.6, AVENS.leaf2);
	return sp("M39 84Q34 66 31 50M42 84Q47 64 50 44M43 84Q54 74 61 66", AVENS.stalk, 1.2) + avensMat(1.6, 8) + el(61, 64, 2.4, 3.2, AVENS.shade, 20) + avensFlower(31, 50, 1.3) + avensFlower(50, 43, 1.4);
}

/* ---------- 9. Glacier buttercup ---------- */
const GLB = { white: "#f8f1f2", pink: "#eba8ba", pinkD: "#cf7c96", eye: "#eab72e", eyeD: "#c58c18", leaf: "#477a3c", leaf2: "#5f9450", stalk: "#8c5a50" };
function lobedLeaves(spots: readonly (readonly [number, number, number])[]): string {
	const ink = new Ink();
	let pet = "";
	for (const [i, [x, y, k]] of spots.entries()) {
		pet += `M40 86Q${f(40 + (x - 40) * 0.3)} ${f(y + 6)} ${f(x)} ${f(y + 3 * k)}`;
		let d = "";
		const up = Math.atan2(y - 86, x - 40) * (180 / Math.PI);
		for (const da of [-48, 0, 48]) {
			const [cx, cy] = pol(x, y, up + da, 2.6 * k);
			d += ovalSub(cx, cy, 3.4 * k, 2.2 * k, up + da);
		}
		ink.add(i % 2 ? GLB.leaf2 : GLB.leaf, d + dotSub(x, y, 2.4 * k));
	}
	return sp(pet, GLB.stalk, 1.1) + ink.toString();
}
function glbFlower(x: number, y: number, k: number, pink: boolean): string {
	return rings([[x, y]], 3 * k, 5, 2.6 * k, GLB.pinkD, -54) + rings([[x, y]], 2.9 * k, 5, 2.6 * k, pink ? GLB.pink : GLB.white) + circle(x, y, 1.9 * k, GLB.eye) + rings([[x, y]], 1 * k, 5, 0.4 * k, GLB.eyeD);
}
function glacierButtercup(stage: GrowingStage): string {
	if (stage === "sprout") return lobedLeaves([[34, 76, 0.85], [46, 74, 0.9]]);
	if (stage === "leafy") return sp("M40 84Q41 66 41 54", GLB.stalk, 1.2) + lobedLeaves([[24, 72, 1.05], [56, 72, 1.05], [33, 63, 1.1], [48, 64, 1.1]]) + el(41, 52, 2.6, 3.4, GLB.white) + el(41, 54.5, 2.6, 1.4, GLB.pinkD);
	return sp("M40 84Q40 60 40 40M40 84Q34 66 27 52M41 84Q48 66 54 50", GLB.stalk, 1.3) + lobedLeaves([[21, 74, 1.1], [59, 74, 1.1], [30, 66, 1.15], [50, 66, 1.15]]) + glbFlower(27, 52, 1.05, false) + glbFlower(54, 50, 1.05, true) + glbFlower(40, 39, 1.2, false);
}

/* ---------- 10. Alpine pasqueflower ---------- */
const PASQ = { white: "#f7f5ee", out: "#aaa2cf", shade: "#d3cfc3", eye: "#f2c230", leaf: "#5e9150", ruff: "#7aa266", mop: "#e3e0d2", mopD: "#a8a492", stalk: "#6e8a5c" };
function featherD(x: number, y: number, deg: number, len: number): string {
	const [ex, ey] = pol(x, y, deg, len);
	let d = `M${f(x)} ${f(y)}L${f(ex)} ${f(ey)}`;
	for (const t of [0.4, 0.62, 0.84]) {
		const [px, py] = pol(x, y, deg, len * t);
		const l = len * 0.36 * (1.2 - t);
		for (const s of [-1, 1]) {
			const [qx, qy] = pol(px, py, deg + s * 50, l);
			const [mx, my] = pol(px, py, deg + s * 50, l * 0.55);
			const [tx, ty] = pol(mx, my, deg + s * 95, l * 0.45);
			const [ux, uy] = pol(mx, my, deg + s * 10, l * 0.5);
			d += `M${f(px)} ${f(py)}L${f(qx)} ${f(qy)}M${f(mx)} ${f(my)}L${f(tx)} ${f(ty)}M${f(mx)} ${f(my)}L${f(ux)} ${f(uy)}`;
		}
	}
	return d;
}
function pasqLeaves(len: number): string {
	return sp(featherD(40, 86, -152, len) + featherD(40, 86, -28, len) + featherD(40, 86, -112, len * 0.9) + featherD(40, 86, -68, len * 0.9), PASQ.leaf, 1.2);
}
function ruffD(x: number, y: number, k: number): string {
	let d = "";
	for (const a of [-160, -130, -100, -80, -50, -20]) {
		const [tx, ty] = pol(x, y, a, 5 * k);
		d += `M${f(x)} ${f(y)}L${f(tx)} ${f(ty)}`;
	}
	return d;
}
function pasqCup(x: number, y: number, k: number): string {
	let s = el(x, y - 2.6 * k, 7 * k, 3 * k, PASQ.out) + el(x - 5 * k, y, 3.4 * k, 6.2 * k, PASQ.out, -28) + el(x + 5 * k, y, 3.4 * k, 6.2 * k, PASQ.out, 28);
	s += el(x - 2.2 * k, y + 0.8 * k, 3.6 * k, 6.6 * k, PASQ.white, -10) + el(x + 2.2 * k, y + 0.8 * k, 3.6 * k, 6.6 * k, PASQ.white, 10);
	const st: Pt[] = [];
	for (let i = 0; i < 7; i++) st.push([x - 3.6 * k + i * 1.2 * k, y - 4.4 * k - Math.sin((i / 6) * Math.PI) * 1.2 * k]);
	return s + dots(st, 0.75 * k, PASQ.eye);
}
function mop(x: number, y: number, r: number): string {
	let a = "";
	for (let i = 0; i < 16; i++) {
		const deg = -90 + i * 22.5;
		const l = r * (i % 2 ? 0.85 : 1);
		const [tx, ty] = pol(x, y, deg, l);
		const [cx, cy] = pol(x, y, deg + 40, l * 0.55);
		const [ux, uy] = pol(tx, ty, deg + 120, 2);
		a += `M${f(x)} ${f(y)}Q${f(cx)} ${f(cy)} ${f(tx)} ${f(ty)}L${f(ux)} ${f(uy)}`;
	}
	return sp(a, PASQ.mopD, 2.2) + sp(a, PASQ.mop, 1.2) + circle(x, y, 1.8, "#8c7a5a");
}
function alpinePasqueflower(stage: GrowingStage): string {
	if (stage === "sprout") return pasqLeaves(11);
	if (stage === "leafy") return sp("M40 84Q41 64 40 50", PASQ.stalk, 1.4) + sp(ruffD(40, 60, 1), PASQ.ruff, 1) + pasqLeaves(16) + el(40, 47, 3.6, 5.4, PASQ.out) + el(39, 46, 1.6, 4, PASQ.white, 6);
	let s = sp("M40 84Q38 60 34 38M41 84Q48 66 55 48", PASQ.stalk, 1.5) + sp(ruffD(37, 54, 1.2) + ruffD(50, 60, 1), PASQ.ruff, 1.1) + pasqLeaves(19);
	return s + mop(56, 42, 8.5) + pasqCup(34, 31, 1.25);
}

/* ---------- 11. Alpine snowbell ---------- */
const SNOW = { a: "#9a7ccc", b: "#b49be0", leaf: "#3f7a3a", leaf2: "#55904a", stalk: "#7b5a6e" };
const SNOW_BELL = (() => {
	let d = "M-1.3 0C-2.6 3 -4 6 -5 9";
	for (let i = 0; i < 9; i++) d += `L${f(-5 + (i + 0.5) * (10 / 9))} ${i % 2 ? 9.6 : 11.6}`;
	return d + "L5 9C4 6 2.6 3 1.3 0Z";
})();
function snowBell(x: number, y: number, k: number, rot: number, fill: string): string {
	return g(x, y, p(SNOW_BELL, fill) + `<path d="M-.4 1L-2.6 9.4M1.2 1L1.6 9.6" stroke="#7a5cae" stroke-width=".6" opacity=".6"/>`, rot, k);
}
function snowLeaves(spots: readonly (readonly [number, number, number])[]): string {
	const ink = new Ink();
	let pet = "";
	for (const [i, [x, y, r]] of spots.entries()) {
		pet += `M40 86Q${f(40 + (x - 40) * 0.5)} ${f(y + 5)} ${f(x)} ${f(y + r * 0.5)}`;
		ink.add(i % 2 ? SNOW.leaf2 : SNOW.leaf, `M${f(x)} ${f(y + r * 0.5)}C${f(x - r * 0.5)} ${f(y + r)} ${f(x - r * 1.2)} ${f(y + r * 0.5)} ${f(x - r)} ${f(y - r * 0.4)}C${f(x - r * 0.8)} ${f(y - r * 1.1)} ${f(x + r * 0.8)} ${f(y - r * 1.1)} ${f(x + r)} ${f(y - r * 0.4)}C${f(x + r * 1.2)} ${f(y + r * 0.5)} ${f(x + r * 0.5)} ${f(y + r)} ${f(x)} ${f(y + r * 0.5)}Z`);
	}
	return sp(pet, SNOW.leaf, 1) + ink.toString();
}
function alpineSnowbell(stage: GrowingStage): string {
	if (stage === "sprout") return snowLeaves([[34, 78, 4.2], [46, 76, 4.6]]);
	if (stage === "leafy") return sp("M40 84Q40 62 42 52Q44 49 46 52", SNOW.stalk, 1.1) + snowLeaves([[24, 79, 5], [56, 78, 5.2], [31, 70, 5.4], [49, 69, 5.6]]) + el(46.4, 55.4, 1.6, 3.4, SNOW.a, -10);
	let s = sp("M39 84Q36 54 34 36Q33 33 30 36M34 36Q36 34 38 36M41 84Q46 62 50 48Q51 45 47 47M50 48Q53 46 55 49", SNOW.stalk, 1.1);
	s += snowLeaves([[21, 80, 5.4], [59, 79, 5.6], [28, 70, 5.6], [52, 70, 6], [40, 76, 4.8]]);
	return s + snowBell(30, 35.5, 1.3, 22, SNOW.a) + snowBell(38, 35.5, 1.25, -14, SNOW.b) + snowBell(47, 46.5, 1.15, 18, SNOW.b) + snowBell(55, 48.5, 1.1, -16, SNOW.a);
}

/* ---------- 12. Purple saxifrage ---------- */
const PSAX = { leaf: "#5a8a6a", leaf2: "#7aa585", stem: "#6a5a48", a: "#a8308f", b: "#c656b4", eye: "#f2d24a" };
type Cubic = readonly [Pt, Pt, Pt, Pt];
function bezAt(c: Cubic, t: number): [number, number] {
	const u = 1 - t;
	const at = (i: 0 | 1) => u * u * u * c[0][i] + 3 * u * u * t * c[1][i] + 3 * u * t * t * c[2][i] + t * t * t * c[3][i];
	return [at(0), at(1)];
}
function beadStems(cs: readonly Cubic[], stroke: string, l1: string, l2: string, r: number): string {
	let d = "";
	const a: Pt[] = [];
	const b: Pt[] = [];
	for (const c of cs) {
		d += cub(...c);
		for (let t = 0.12; t <= 1.001; t += 0.11) {
			const [x, y] = bezAt(c, t);
			const [x2, y2] = bezAt(c, Math.min(1, t + 0.02));
			const ang = (Math.atan2(y2 - y, x2 - x) * 180) / Math.PI;
			a.push(pol(x, y, ang - 90, r * 0.9));
			b.push(pol(x, y, ang + 90, r * 0.9));
		}
	}
	return sp(d, stroke, 1) + dots(a, r, l1) + dots(b, r, l2);
}
function psaxFlowers(cs: readonly Pt[], k: number): string {
	return rings(cs, 2.4 * k, 5, 2.2 * k, PSAX.a, -54) + rings(cs, 2.1 * k, 5, 1.8 * k, PSAX.b) + dots(cs, k, PSAX.eye);
}
const PSAX_STEMS: readonly Cubic[] = [
	[[40, 86], [32, 84], [22, 82], [12, 80]],
	[[40, 86], [48, 84], [58, 82], [68, 80]],
	[[40, 86], [36, 80], [28, 74], [21, 70]],
	[[40, 86], [44, 80], [52, 74], [59, 70]],
	[[40, 86], [38, 78], [34, 70], [32, 64]],
	[[40, 86], [42, 78], [46, 70], [48, 63]],
];
function scaleCubic(c: Cubic, k: number): Cubic {
	const s = (q: Pt): Pt => [40 + (q[0] - 40) * k, 86 + (q[1] - 86) * k];
	return [s(c[0]), s(c[1]), s(c[2]), s(c[3])];
}
function purpleSaxifrage(stage: GrowingStage): string {
	if (stage === "sprout") return beadStems([PSAX_STEMS[4], PSAX_STEMS[5]].flatMap((c) => (c ? [scaleCubic(c, 0.55)] : [])), PSAX.stem, PSAX.leaf, PSAX.leaf2, 1.2);
	if (stage === "leafy") {
		const cs = PSAX_STEMS.map((c) => scaleCubic(c, 0.8));
		return beadStems(cs, PSAX.stem, PSAX.leaf, PSAX.leaf2, 1.3) + dots(cs.slice(2).map((c): Pt => [c[3][0], c[3][1] - 1.5]), 1.6, PSAX.a);
	}
	return beadStems(PSAX_STEMS, PSAX.stem, PSAX.leaf, PSAX.leaf2, 1.4) + psaxFlowers([[12, 77], [68, 77], [27, 79], [53, 79], [40, 67]], 1.1) + psaxFlowers([[21, 66], [59, 66], [32, 59], [48, 58]], 1.35);
}

/* ---------- 13. Rock jasmine ---------- */
const RJ = { leaf: "#8aa87a", leaf2: "#a7c093", runner: "#9a6a5a", stalk: "#7f8f6a", pink: "#f0a4bc", pinkD: "#cf6f92", eye: "#f2c94a" };
function rjRosette(x: number, y: number, k: number): string {
	let a = "";
	let b = "";
	for (let i = 0; i < 9; i++) {
		const d = lensSub(x, y, -172 + i * 20.5, (6 - Math.abs(i - 4) * 0.4) * k, 1.3 * k);
		if (i % 2) a += d;
		else b += d;
	}
	return p(a, RJ.leaf) + p(b, RJ.leaf2);
}
function umbel(x: number, y: number, k: number, open: boolean): string {
	let ped = "";
	const fl: Pt[] = [];
	for (const a of [-160, -128, -105, -75, -52, -20, -90]) {
		const [fx, fy] = pol(x, y, a, (a === -90 ? 5 : 6.4) * k);
		ped += `M${f(x)} ${f(y)}L${f(fx)} ${f(fy)}`;
		fl.push([fx, fy]);
	}
	return sp(ped, RJ.stalk, 0.7) + (open ? rings(fl, 1.5 * k, 5, 1.25 * k, RJ.pink) + dots(fl, 0.65 * k, RJ.eye) : dots(fl, 1.1 * k, RJ.pinkD));
}
function rockJasmine(stage: GrowingStage): string {
	if (stage === "sprout") return rjRosette(40, 86, 1.6);
	if (stage === "leafy") return sp("M40 84Q41 66 40 56M36 86Q28 84 22 86", RJ.runner, 0.9) + rjRosette(22, 86, 1.2) + rjRosette(40, 86, 2.2) + umbel(40, 56, 0.9, false);
	const s = sp("M34 86Q24 82 17 86M46 86Q56 82 63 86", RJ.runner, 0.9) + sp("M40 84Q38 58 33 38M41 84Q46 64 51 52", RJ.stalk, 1.1);
	return s + rjRosette(17, 86, 1.3) + rjRosette(63, 86, 1.2) + rjRosette(40, 86, 2.4) + umbel(51, 52, 1.05, true) + umbel(33, 38, 1.3, true);
}

/* ---------- 14. Alpine columbine ---------- */
const COL = { a: "#4458c2", b: "#6b7ee0", c: "#c4ccf4", eye: "#f2d24a", leaf: "#6e9a86", leaf2: "#86b09c", stalk: "#5e7f6c" };
function ternLeaves(spots: readonly (readonly [number, number, number])[]): string {
	let pet = "";
	let s = "";
	for (const [i, [x, y, k]] of spots.entries()) {
		pet += `M40 86Q${f(40 + (x - 40) * 0.4)} ${f(y + 4)} ${f(x)} ${f(y)}`;
		const d: Pt[] = [];
		for (const a of [-150, -90, -30]) {
			const [cx, cy] = pol(x, y, a, 4 * k);
			for (const da of [-50, 0, 50]) d.push(pol(cx, cy, a + da, 1.6 * k));
			d.push([cx, cy]);
		}
		s += dots(d, 1.7 * k, i % 2 ? COL.leaf2 : COL.leaf);
	}
	return sp(pet, COL.stalk, 1) + s;
}
function colFace(x: number, y: number, k: number): string {
	return p(spikeSub(x, y, 5, 10 * k, 2.8 * k, -90), COL.a) + rings([[x, y]], 2.8 * k, 5, 2.4 * k, COL.c, -54) + rings([[x, y]], 2.6 * k, 5, 2.1 * k, COL.b, -54) + rings([[x, y]], 0.9 * k, 6, 0.6 * k, COL.eye);
}
/** A nodding columbine seen side-on, hanging at (x, y): sepals below, spurs hooking up and in. */
function colSide(x: number, y: number, k: number, rot: number): string {
	const spurs = sp("M-2.4 0Q-6 -3 -7.4 -6.6Q-7.6 -8.2 -6 -7.6M0 0Q0 -4 -.6 -7.4Q-.4 -8.8 .8 -8M2.4 0Q6 -3 7.4 -6.6Q7.6 -8.2 6 -7.6", COL.b, 1.4);
	const body = p(lensSub(0, 0, 150, 9, 2.4) + lensSub(0, 0, 30, 9, 2.4) + lensSub(0, 0, 110, 8, 2.2) + lensSub(0, 0, 70, 8, 2.2), COL.a) + p("M-3.4 -1L-2.8 6.4Q0 8 2.8 6.4L3.4 -1Z", COL.b) + p("M-1.6 7L1.6 7L1 8.6L-1 8.6Z", COL.c);
	return g(x, y, spurs + body, rot, k);
}
function alpineColumbine(stage: GrowingStage): string {
	if (stage === "sprout") return ternLeaves([[35, 76, 0.85], [46, 74, 0.9]]);
	if (stage === "leafy") return sp("M40 84Q40 62 44 50Q47 46 50 50", COL.stalk, 1.2) + ternLeaves([[25, 74, 1.1], [55, 74, 1.1], [33, 64, 1.15], [48, 62, 1.15]]) + el(50, 54, 2.2, 3.4, COL.a) + sp("M48.6 51L48 48M51.4 51L52 48", COL.b, 1.4);
	const s = sp("M40 84Q38 56 33 32M41 84Q46 56 54 42Q57 38 59 42", COL.stalk, 1.3) + ternLeaves([[22, 74, 1.2], [58, 74, 1.2], [30, 63, 1.25], [50, 61, 1.25], [36, 50, 0.8]]);
	return s + colSide(59, 44, 1.15, -6) + colFace(33, 28, 1.25);
}

/* ---------- 15. Spring gentian ---------- */
const SG = { a: "#1c4cd4", b: "#3a6cf0", tube: "#2a3a8e", eye: "#f2f4fa", leaf: "#4f8a42", leaf2: "#67a256" };
function sgRosette(ink: Ink, x: number, y: number, k: number): void {
	for (const [i, a] of [-168, -128, -90, -52, -12].entries()) ink.add(i % 2 ? SG.leaf2 : SG.leaf, lensSub(x, y, a, (a === -90 ? 6 : 8) * k, 2 * k));
}
function sgFace(x: number, y: number, k: number): string {
	let lobes = "";
	for (let i = 0; i < 5; i++) {
		const a = -90 + i * 72;
		const [cx, cy] = pol(x, y, a, 3.2 * k);
		lobes += ovalSub(cx, cy, 3 * k, 2.3 * k, a);
	}
	return p(lobes, SG.a) + p(spikeSub(x, y, 5, 3 * k, 1 * k, -54), SG.b) + p(spikeSub(x, y, 5, 1.8 * k, 0.6 * k, -54), SG.eye) + circle(x, y, 0.6 * k, SG.tube);
}
function springGentian(stage: GrowingStage): string {
	const ink = new Ink();
	if (stage === "sprout") {
		sgRosette(ink, 40, 86, 1.4);
		return ink.toString();
	}
	if (stage === "leafy") {
		sgRosette(ink, 31, 86, 1.6);
		sgRosette(ink, 49, 86, 1.7);
		return ink.toString() + line(49, 80, 49, 62, SG.tube, 2.4) + el(49, 58, 2, 5, SG.a) + p("M46.8 64L47 58L49 61L51 58L51.2 64Z", SG.leaf2);
	}
	sgRosette(ink, 25, 86, 1.6);
	sgRosette(ink, 55, 86, 1.7);
	sgRosette(ink, 40, 86, 1.9);
	return ink.toString() + sp("M25 80L26 64M55 80L54 56M40 79L40 46", SG.tube, 2.6) + sgFace(26, 61, 1.35) + sgFace(54, 53, 1.45) + sgFace(40, 43, 1.6);
}

/* ---------- 16. Alpenrose ---------- */
const AR = { leaf: "#2d5c34", leaf2: "#3f7444", rust: "#a0602e", wood: "#6a4632", fl: "#d43f6a", fl2: "#ee6f90", flD: "#a92c55" };
function arWhorl(ink: Ink, x: number, y: number, k: number): void {
	for (const [i, a] of [-200, -160, -120, -60, -20, 20].entries()) {
		ink.add(i % 2 ? AR.leaf : AR.leaf2, lensSub(x, y, a, 8 * k, 1.8 * k));
		if (i === 1 || i === 4) ink.add(AR.rust, lensSub(x, y + 0.6, a + (i === 1 ? 14 : -14), 5 * k, 1 * k));
	}
}
function arTrusses(tips: readonly Pt[], k: number): string {
	let a = "";
	const b: Pt[] = [];
	for (const [x, y] of tips) {
		for (const deg of [-165, -128, -90, -52, -15, -109, -71]) {
			a += lensSub(x, y, deg, 6.6 * k, 1.5 * k);
			b.push(pol(x, y, deg, 5.6 * k));
		}
	}
	return p(a, AR.flD) + dots(b, 1.8 * k, AR.fl) + dots(b, 0.7 * k, AR.fl2);
}
function alpenrose(stage: GrowingStage): string {
	const ink = new Ink();
	if (stage === "sprout") {
		arWhorl(ink, 40, 72, 0.9);
		return sp("M40 87L40 72", AR.wood, 1.8) + ink.toString();
	}
	const tips: Pt[] = stage === "leafy" ? [[26, 60], [40, 50], [54, 58]] : [[19, 54], [31, 40], [47, 36], [61, 50], [40, 56]];
	const kk = stage === "leafy" ? 1 : 1.05;
	const wood = tips.map(([x, y]) => `M${f(40 + (x - 40) * 0.1)} 87Q${f(40 + (x - 40) * 0.25)} ${f(y + 14)} ${f(x)} ${f(y)}`).join("");
	for (const [x, y] of tips) arWhorl(ink, x, y + 2, kk);
	for (const [x, y] of tips) ink.add(AR.leaf, lensSub(40 + (x - 40) * 0.45, (87 + y) / 2, x < 40 ? -160 : -20, 6, 1.4));
	const s = sp(wood, AR.wood, 2) + ink.toString();
	if (stage === "leafy") return s + p(tips.map(([x, y]) => ovalSub(x, y - 1, 1.6, 2.2, -90)).join(""), AR.flD);
	return s + arTrusses(tips.map(([x, y]): Pt => [x, y - 1]), 0.95);
}

/* ---------- 17. Globeflower ---------- */
const GLOBE = { a: "#f4d23a", b: "#dcae1e", c: "#fae37e", leaf: "#468a3a", leaf2: "#5ea04c", stalk: "#3f7a35" };
function palmLeaf(ink: Ink, x: number, y: number, k: number, fill: string, rot = 0): void {
	let d = "";
	for (const a of [-170, -130, -90, -50, -10]) {
		d += lensSub(x, y, a + rot, 8 * k, 2.2 * k);
		if (k < 0.9) continue;
		const [mx, my] = pol(x, y, a + rot, 5.5 * k);
		d += lensSub(mx, my, a + rot - 35, 3 * k, 0.8 * k) + lensSub(mx, my, a + rot + 35, 3 * k, 0.8 * k);
	}
	ink.add(fill, d + dotSub(x, y, 1.6 * k));
}
function globe(x: number, y: number, k: number): string {
	return circle(x, y, 8 * k, GLOBE.b) + el(x - 3.8 * k, y + 0.4 * k, 4.4 * k, 7.4 * k, GLOBE.a, -14) + el(x + 3.8 * k, y + 0.4 * k, 4.4 * k, 7.4 * k, GLOBE.a, 14) + el(x, y + 1 * k, 4.4 * k, 7.2 * k, GLOBE.c) + el(x - 1.2 * k, y - 3.4 * k, 1.6 * k, 2.2 * k, "#fdf0b4", -20);
}
function globeLeaves(ink: Ink, spots: readonly (readonly [number, number, number])[]): string {
	for (const [i, [x, y, k]] of spots.entries()) palmLeaf(ink, x, y, k, i % 2 ? GLOBE.leaf2 : GLOBE.leaf, (x - 40) * 0.6);
	return sp(spots.map(([x, y]) => `M40 86Q${f(40 + (x - 40) * 0.3)} ${f(y + 6)} ${f(x)} ${f(y)}`).join(""), GLOBE.stalk, 1.1);
}
function globeflower(stage: GrowingStage): string {
	const ink = new Ink();
	if (stage === "sprout") {
		const st = globeLeaves(ink, [[40, 74, 0.95]]);
		return st + ink.toString();
	}
	if (stage === "leafy") {
		const st = globeLeaves(ink, [[24, 72, 1.1], [56, 72, 1.1], [32, 64, 1.1]]);
		palmLeaf(ink, 43, 58, 0.7, GLOBE.leaf2);
		return sp("M40 86Q42 64 42 48", GLOBE.stalk, 1.6) + st + ink.toString() + circle(42, 45, 3.6, "#8cc068") + el(42, 44, 1.6, 2.6, GLOBE.c);
	}
	const st = globeLeaves(ink, [[22, 74, 1.15], [58, 74, 1.15], [30, 66, 1.15], [50, 66, 1.1]]);
	palmLeaf(ink, 39, 56, 0.75, GLOBE.leaf2);
	palmLeaf(ink, 48, 52, 0.65, GLOBE.leaf);
	return sp("M40 86Q38 56 36 30M40 86Q46 62 55 44", GLOBE.stalk, 1.7) + st + ink.toString() + globe(55, 40, 0.88) + globe(36, 24, 1.05);
}

/* ---------- 18. Arnica ---------- */
const ARN = { ray: "#f6ae2c", rayD: "#df8a16", disk: "#e47a18", diskD: "#a85414", leaf: "#5d9a48", leaf2: "#77b05c", stalk: "#4f8a3c" };
function arnBase(k: number): string {
	const o = { rib: true, fill: ARN.leaf };
	return leaf(40, 86, -172, 13 * k, 4.6 * k, o) + leaf(40, 86, -8, 13 * k, 4.6 * k, o) + leaf(40, 86, -128, 12 * k, 4.2 * k, { ...o, fill: ARN.leaf2 }) + leaf(40, 86, -52, 12 * k, 4.2 * k, { ...o, fill: ARN.leaf2 });
}
const ARN_JIT = [0, 8, -6, 4, -9, 6, -3, 9, -5, 3, -7, 5, 0];
const ARN_LEN = [9, 7.5, 10, 8, 9.5, 7, 10, 8.5, 7.5, 9.5, 8, 9, 10];
function arnHead(x: number, y: number, k: number): string {
	let a = "";
	let b = "";
	for (const [i, j] of ARN_JIT.entries()) {
		const deg = -90 + i * 27.7 + j;
		const l = (ARN_LEN[i] ?? 9) * k;
		const [ox, oy] = pol(x, y, deg, 2.5 * k);
		const r = (deg * Math.PI) / 180;
		const [tx, ty] = pol(ox, oy, deg + 6, l);
		const nx = -Math.sin(r) * 1.4 * k;
		const ny = Math.cos(r) * 1.4 * k;
		const [mx, my] = pol(ox, oy, deg + 4, l * 0.85);
		const d = `M${f(ox - nx)} ${f(oy - ny)}L${f(tx - nx)} ${f(ty - ny)}L${f(mx)} ${f(my)}L${f(tx + nx)} ${f(ty + ny)}L${f(ox + nx)} ${f(oy + ny)}Z`;
		if (i % 2) a += d;
		else b += d;
	}
	return p(a, ARN.rayD) + p(b, ARN.ray) + circle(x, y, 4 * k, ARN.disk) + p(roundPetals(x, y, 6, 2 * k, 0.5 * k) + dotSub(x, y, 0.6 * k), ARN.diskD);
}
function arnica(stage: GrowingStage): string {
	const pair = (y: number, k: number) => leaf(40, y, -155, 8 * k, 2.6 * k, { fill: ARN.leaf2, rib: false }) + leaf(40, y, -25, 8 * k, 2.6 * k, { fill: ARN.leaf2, rib: false });
	if (stage === "sprout") return arnBase(0.85);
	if (stage === "leafy") return line(40, 86, 40, 48, ARN.stalk, 1.8) + arnBase(1.3) + pair(66, 1) + circle(40, 46, 3.4, "#7aa85c") + p(spikeSub(40, 45, 7, 3.4, 0.9), ARN.ray);
	return stem([[40, 86], [40, 64], [38, 44], [38, 30]], ARN.stalk, 1.9) + stem([[40, 62], [46, 56], [52, 50], [56, 46]], ARN.stalk, 1.4) + arnBase(1.5) + pair(64, 1.1) + pair(48, 0.7) + arnHead(56, 45, 0.78) + arnHead(38, 28, 1.1);
}

/* ---------- 19. Alpine toadflax ---------- */
const TOAD = { leaf: "#8cb2a6", leaf2: "#a7c6ba", stem: "#6c8f86", a: "#7a52bc", b: "#9a76d6", palate: "#f39a2a" };
function toadStems(cs: readonly Cubic[], tEnd: number): string {
	let d = "";
	let la = "";
	let lb = "";
	for (const c of cs) {
		d += cub(...c);
		for (let t = 0.2; t <= tEnd; t += 0.16) {
			const [x, y] = bezAt(c, t);
			const [x2, y2] = bezAt(c, t + 0.03);
			const ang = (Math.atan2(y2 - y, x2 - x) * 180) / Math.PI;
			la += lensSub(x, y, ang - 50, 6.4, 0.9);
			lb += lensSub(x, y, ang + 50, 6.4, 0.9);
		}
	}
	return sp(d, TOAD.stem, 1.1) + p(la, TOAD.leaf) + p(lb, TOAD.leaf2);
}
function toadFlower(x: number, y: number, k: number, rot: number): string {
	return g(x, y, sp("M-1 0L-6.5 1.6", TOAD.b, 1.5) + el(1.6, -2.2, 2.6, 2.1, TOAD.a, -10) + el(2.2, 1.8, 2.9, 2, TOAD.b, 8) + el(2.4, 0.8, 1.5, 1.1, TOAD.palate), rot, k);
}
const TOAD_STEMS: readonly Cubic[] = [
	[[40, 86], [30, 82], [20, 72], [18, 56]],
	[[40, 86], [50, 82], [60, 72], [62, 54]],
	[[40, 86], [38, 74], [34, 60], [38, 44]],
];
function alpineToadflax(stage: GrowingStage): string {
	if (stage === "sprout") {
		const c = TOAD_STEMS[2];
		return c ? toadStems([scaleCubic(c, 0.45)], 1) : "";
	}
	if (stage === "leafy") return toadStems(TOAD_STEMS.map((c) => scaleCubic(c, 0.8)), 0.95) + p(dotSub(26, 66, 1.3) + dotSub(54, 63.5, 1.3) + dotSub(37.5, 52, 1.3), TOAD.a);
	let s = toadStems(TOAD_STEMS, 0.8);
	for (const [x, y, r] of [[18, 54, -80], [14, 62, -150], [23, 61, -40], [62, 52, -100], [66, 60, -20], [57, 59, -140], [38, 42, -90], [33, 49, -150], [43, 49, -30]] as const) s += toadFlower(x, y, 1.05, r + 90);
	return s;
}

/* ---------- 20. Dwarf willow ---------- */
const DW = { wood: "#7a5236", leaf: "#4c9842", leaf2: "#69b454", cat: "#c4503a", cat2: "#e9c04a" };
function dwShoots(shoots: readonly (readonly [number, number])[], cats: boolean): string {
	const ink = new Ink();
	let wood = "M14 86.6Q27 84 40 86.6Q53 84 66 86.6";
	let cd = "";
	let yd = "";
	for (const [i, [x, h]] of shoots.entries()) {
		const top = 86 - h;
		wood += `M${f(x)} 86L${f(x + (i % 2 ? 1 : -1))} ${f(top)}`;
		const lf = (y: number, a: number, fill: string) => ink.add(fill, blobLeafSub(x, y, a, 7, 3.2) + "");
		lf(top + 3, i % 2 ? -150 : -30, DW.leaf);
		lf(top + 6, i % 2 ? -30 : -150, DW.leaf2);
		if (h > 12) lf(top + 9, i % 2 ? -160 : -20, DW.leaf);
		if (cats) {
			const cx = x + (i % 2 ? 1 : -1);
			cd += ovalSub(cx, top - 3, 4, 1.9, -90);
			for (let j = 0; j < 4; j++) yd += dotSub(cx + (j % 2 ? 0.9 : -0.9), top - 5.6 + j * 1.6, 0.55);
		}
	}
	return sp(wood, DW.wood, 1.8) + ink.toString() + (cats ? p(cd, DW.cat) + p(yd, DW.cat2) : "");
}
function dwarfWillow(stage: GrowingStage): string {
	if (stage === "sprout") return sp("M40 87L40 76", DW.wood, 1.4) + p(blobLeafSub(40, 78, -145, 7, 3.4), DW.leaf) + p(blobLeafSub(40, 76, -35, 7, 3.4), DW.leaf2);
	if (stage === "leafy") return dwShoots([[26, 11], [40, 16], [54, 12]], false);
	return dwShoots([[18, 10], [29, 15], [40, 18], [51, 14], [62, 11]], true);
}

/* ---------- 21. Alpine bistort ---------- */
const BIS = { leaf: "#4c8846", leaf2: "#66a05a", stalk: "#6e8a52", fl: "#f7eef0", fl2: "#ebb6c4", bulb: "#7e4054", bulb2: "#a35f72" };
function bisLeaves(k: number): string {
	const o = { shape: 1 as const, rib: true, fill: BIS.leaf };
	return leaf(39, 86, -118, 18 * k, 2.6 * k, o) + leaf(41, 86, -64, 19 * k, 2.6 * k, { ...o, fill: BIS.leaf2 }) + leaf(39, 86, -142, 14 * k, 2.4 * k, { ...o, fill: BIS.leaf2 }) + leaf(41, 86, -38, 14 * k, 2.4 * k, o);
}
function alpineBistort(stage: GrowingStage): string {
	if (stage === "sprout") return bisLeaves(0.8);
	if (stage === "leafy") {
		let buds = "";
		for (let y = 44; y < 56; y += 2.2) buds += dotSub(40 + ((y * 7) % 2) - 0.5, y, 1.1);
		return line(40, 86, 40, 44, BIS.stalk, 1.4) + bisLeaves(1.35) + leaf(40, 66, -50, 9, 1.2, { shape: 1, rib: false, fill: BIS.leaf2 }) + p(buds, "#a3bf86");
	}
	let fl = "";
	let fl2 = "";
	let bu = "";
	let bu2 = "";
	for (let i = 0; i < 9; i++) {
		const y = 26 - i * 1.7;
		const w = 1.6 - i * 0.12;
		fl += dotSub(40 - w, y, 1.25) + (i < 8 ? dotSub(40 + w, y - 0.8, 1.2) : "");
		if (i % 3 === 1) fl2 += dotSub(40, y - 0.4, 0.9);
	}
	for (let i = 0; i < 6; i++) {
		const y = 42 - i * 2.6;
		bu += dotSub(38.6, y, 1.45);
		bu2 += dotSub(41.4, y - 1.3, 1.45);
	}
	return line(40, 86, 40, 14, BIS.stalk, 1.4) + bisLeaves(1.6) + leaf(40, 62, -50, 11, 1.3, { shape: 1, rib: false, fill: BIS.leaf2 }) + p(bu, BIS.bulb) + p(bu2, BIS.bulb2) + p(fl, BIS.fl) + p(fl2, BIS.fl2);
}

/* ---------- 22. Alpine sea holly ---------- */
const SH = { cone: "#5a6cc4", coneD: "#3e4c96", bract: "#7f8fd6", bract2: "#a9b4ea", stem: "#6872ac", leaf: "#4e8a48", leaf2: "#689e58" };
function hollyHead(x: number, y: number, k: number): string {
	let teeth = "";
	for (let i = 0; i < 14; i++) {
		const a = -90 + i * (360 / 14) + 6;
		const [px, py] = pol(x, y, a, 11 * k * 0.6);
		const [qx, qy] = pol(px, py, a - 40, 2.6 * k);
		const [rx, ry] = pol(px, py, a + 40, 2.6 * k);
		teeth += `M${f(qx)} ${f(qy)}L${f(px)} ${f(py)}L${f(rx)} ${f(ry)}`;
	}
	const cd: Pt[] = [];
	for (let j = 0; j < 4; j++) for (let i = 0; i < 3; i++) cd.push([x + (i - 1) * 2 * k + (j % 2) * k * 0.9 - 0.4 * k, y - 7 * k + j * 2.1 * k]);
	return sp(teeth, SH.bract, 0.7) + p(spikeSub(x, y, 14, 11 * k, 1.5 * k, -84), SH.bract) + p(spikeSub(x, y, 14, 7 * k, 0.9 * k, -97), SH.bract2) + el(x, y - 3.4 * k, 3.2 * k, 5.4 * k, SH.cone) + dots(cd, 0.55 * k, SH.coneD);
}
function hollyBase(k: number): string {
	let d = "";
	for (const [x, y] of [[26, 74], [54, 74], [33, 68], [47, 68]] as const) d += `M40 86L${f(40 + (x - 40) * k)} ${f(86 + (y - 86) * k)}`;
	const o = { shape: 4 as const, fill: SH.leaf };
	return sp(d, SH.leaf, 1.1) + leaf(40 - 14 * k, 86 - 12 * k, -150, 10 * k, 4 * k, o) + leaf(40 + 14 * k, 86 - 12 * k, -30, 10 * k, 4 * k, o) + leaf(40 - 7 * k, 86 - 18 * k, -115, 9 * k, 3.6 * k, { ...o, fill: SH.leaf2 }) + leaf(40 + 7 * k, 86 - 18 * k, -65, 9 * k, 3.6 * k, { ...o, fill: SH.leaf2 });
}
function alpineSeaHolly(stage: GrowingStage): string {
	if (stage === "sprout") return hollyBase(0.75);
	if (stage === "leafy") return line(40, 84, 40, 52, "#6f8a7a", 1.8) + hollyBase(1.1) + p(spikeSub(40, 50, 10, 6, 1, -90), "#8fae8a") + el(40, 47.6, 2, 3.2, "#7fa080");
	return sp("M40 84Q40 60 40 34M40 66Q48 60 56 52", SH.stem, 2) + p(lensSub(40, 62, -150, 7, 1.3) + lensSub(40, 62, -30, 7, 1.3), SH.bract) + hollyBase(1.25) + hollyHead(56, 52, 0.72) + hollyHead(40, 32, 1.15);
}

/* ---------- 23. Alpine azalea ---------- */
const AZ = { wood: "#6e3e32", leaf: "#376339", leaf2: "#508552", fl: "#f2a6bc", fl2: "#fbd2de", eye: "#c44a6e", bud: "#b8304e" };
const AZ_TWIGS: readonly (readonly [Pt, Pt])[] = [
	[[18, 74], [12, 70]], [[24, 68], [20, 62]], [[32, 64], [30, 58]], [[40, 62], [41, 56]], [[48, 64], [51, 58]], [[56, 68], [60, 62]], [[62, 74], [68, 70]],
];
function alpineAzalea(stage: GrowingStage): string {
	const k = stage === "sprout" ? 0.45 : stage === "leafy" ? 0.78 : 1;
	const s = (q: Pt): Pt => [40 + (q[0] - 40) * k, 86 + (q[1] - 86) * k];
	const twigs = stage === "sprout" ? AZ_TWIGS.slice(2, 5) : AZ_TWIGS;
	let wood = "";
	let a = "";
	let b = "";
	for (const [m, t] of twigs) {
		const [mx, my] = s(m);
		const [tx, ty] = s(t);
		wood += `M40 86Q${f((40 + mx) / 2)} ${f(my + 4 * k)} ${f(mx)} ${f(my)}L${f(tx)} ${f(ty)}`;
		for (let j = 0; j <= 3; j++) {
			const u = j / 3;
			const x = 40 + (mx - 40) * (0.4 + u * 0.6) + (tx - mx) * u * 0.6;
			const y = 86 + (my - 86) * (0.4 + u * 0.6) + (ty - my) * u * 0.6 - u * 2;
			const ang = (Math.atan2(ty - 86, tx - 40) * 180) / Math.PI;
			a += lensSub(x, y, ang - 60, 3.6, 1.1);
			b += lensSub(x, y, ang + 60, 3.6, 1.1);
		}
	}
	let out = sp(wood, AZ.wood, 1.3) + p(a, AZ.leaf) + p(b, AZ.leaf2);
	if (stage === "sprout") return out;
	const fl: Pt[] = [];
	const bud: Pt[] = [];
	for (const [i, [, t]] of twigs.entries()) {
		const [tx, ty] = s(t);
		if (stage === "leafy") {
			if (i % 2 === 0) bud.push([tx, ty - 1]);
			continue;
		}
		for (const [dx, dy] of [[-2.2, -1.2], [2.2, -0.6], [0, -3.4]] as const) fl.push([tx + dx, ty + dy]);
		bud.push([tx + (i % 2 ? 3.6 : -3.6), ty + 1.6]);
	}
	out += dots(bud, stage === "leafy" ? 1.2 : 1, AZ.bud);
	return stage === "leafy" ? out : out + rings(fl, 1.3, 5, 1.05, AZ.fl) + dots(fl, 0.55, AZ.eye);
}

/* ---------- 24. Sky pilot ---------- */
const SKY = { leaf: "#5c9a50", leaf2: "#78b264", rach: "#3f7a35", fl: "#6a5cd2", fl2: "#8a7ee6", flD: "#4a3eaa", anth: "#f2a02a" };
function ladders(spec: readonly (readonly [number, number])[]): string {
	let r = "";
	let a = "";
	let b = "";
	for (const [deg, len] of spec) {
		const [ex, ey] = pol(40, 86, deg, len);
		r += `M40 86L${f(ex)} ${f(ey)}`;
		for (let t = 0.3; t <= 1.001; t += 0.135) {
			const [x, y] = pol(40, 86, deg, len * t);
			const l = 2.6 - t;
			const [ax, ay] = pol(x, y, deg - 58, 1.4);
			const [bx, by] = pol(x, y, deg + 58, 1.4);
			const [cx, cy] = pol(x, y, deg - 58, 1.4 + l);
			const [dx, dy] = pol(x, y, deg + 58, 1.4 + l);
			a += `M${f(ax)} ${f(ay)}L${f(cx)} ${f(cy)}`;
			b += `M${f(bx)} ${f(by)}L${f(dx)} ${f(dy)}`;
		}
	}
	return sp(r, SKY.rach, 0.8) + sp(a, SKY.leaf, 2) + sp(b, SKY.leaf2, 2);
}
function skyHead(x: number, y: number, k: number): string {
	let tube = "";
	const m: Pt[] = [];
	for (const deg of [-200, -170, -140, -115, -90, -65, -40, -10, 20, -152, -28]) {
		tube += lensSub(x, y, deg, 6.4 * k, 1.5 * k);
		m.push(pol(x, y, deg, 6.2 * k));
	}
	return circle(x, y, 4 * k, SKY.flD) + p(tube, SKY.flD) + dots(m, 2.1 * k, SKY.fl) + dots(m, 0.8 * k, SKY.anth) + circle(x, y - 1.2 * k, 2.2 * k, SKY.fl2);
}
function skyPilot(stage: GrowingStage): string {
	if (stage === "sprout") return ladders([[-125, 11], [-90, 13], [-55, 11]]);
	const tuft: [number, number][] = [[-160, 16], [-122, 19], [-90, 20], [-58, 19], [-20, 16]];
	if (stage === "leafy") return line(40, 86, 41, 52, SKY.rach, 1.6) + ladders(tuft) + rings([[41, 50]], 2.2, 6, 1.4, SKY.flD) + circle(41, 50, 1.4, SKY.flD);
	return stem([[40, 86], [40, 64], [41, 46], [40, 30]], SKY.rach, 1.8) + ladders(tuft.map(([d, l]) => [d, l * 1.12] as [number, number])) + skyHead(40, 30, 1.25);
}

/* ---------- 25. Alpine wallflower ---------- */
const WALL = { a: "#f6c428", b: "#ec9a26", c: "#f9da62", eye: "#b8701a", leaf: "#6f9a58", leaf2: "#87ae6e", stalk: "#4f7f3e" };
const RACEME: readonly Pt[] = [[0, -3.4], [-4, -1], [4, -1], [-6, 3.4], [0, 1.4], [6, 3.4], [-3, 6], [3, 6]];
function wallRaceme(x: number, y: number, k: number, open: boolean): string {
	const bud: Pt[] = [[x, y - 7.6 * k], [x - 2 * k, y - 6.2 * k], [x + 2 * k, y - 6.2 * k]];
	const fl = RACEME.map(([dx, dy]): Pt => [x + dx * k, y + dy * k]);
	if (!open) return dots(bud.concat(fl.map(([fx, fy]): Pt => [fx * 0.6 + x * 0.4, fy * 0.6 + y * 0.4])), 1.25 * k, "#9cba78");
	return dots(bud, 1.25 * k, WALL.b) + rings(fl.filter((_, i) => i % 3 !== 1), 1.9 * k, 4, 1.75 * k, WALL.a, -45) + rings(fl.filter((_, i) => i % 3 === 1), 1.9 * k, 4, 1.75 * k, WALL.c, -45) + dots(fl, 0.55 * k, WALL.eye);
}
function wallLeaves(ink: Ink, tips: readonly Pt[]): void {
	for (const [i, [x, y]] of tips.entries()) {
		for (const t of [0.3, 0.55, 0.75]) {
			const sx = 40 + (x - 40) * t * t;
			const sy = 86 + (y - 86) * t;
			ink.add(i % 2 ? WALL.leaf : WALL.leaf2, lensSub(sx, sy, (t * 100) % 2 ? -150 : -30, 9 - t * 4, 1.2));
		}
	}
}
function alpineWallflower(stage: GrowingStage): string {
	const ink = new Ink();
	const base = (k: number) => {
		for (const [i, a] of [-165, -135, -110, -70, -45, -15].entries()) ink.add(i % 2 ? WALL.leaf2 : WALL.leaf, lensSub(40, 86, a, (12 - Math.abs(a + 90) / 25) * k, 1.4 * k));
	};
	if (stage === "sprout") {
		base(1.1);
		return ink.toString();
	}
	const tips: Pt[] = stage === "leafy" ? [[35, 54], [46, 50]] : [[29, 40], [42, 30], [55, 42]];
	wallLeaves(ink, tips);
	base(1.4);
	const st = sp(stalks(40, 86, tips, 0.3), WALL.stalk, 1.4);
	return st + ink.toString() + tips.map(([x, y], i) => wallRaceme(x, y - 4, stage === "leafy" ? 0.8 : i === 1 ? 1.15 : 1, stage === "bloom")).join("");
}

export const SPECIES: Species[] = [
	{ id: "edelweiss", name: "Edelweiss", draw: edelweiss },
	{ id: "alpine-aster", name: "Alpine aster", draw: alpineAster },
	{ id: "trumpet-gentian", name: "Trumpet gentian", draw: trumpetGentian },
	{ id: "alpine-forget-me-not", name: "Alpine forget-me-not", draw: alpineForgetMeNot },
	{ id: "mossy-saxifrage", name: "Mossy saxifrage", draw: mossySaxifrage },
	{ id: "moss-campion", name: "Moss campion", draw: mossCampion },
	{ id: "alpine-poppy", name: "Alpine poppy", draw: alpinePoppy },
	{ id: "mountain-avens", name: "Mountain avens", draw: mountainAvens },
	{ id: "glacier-buttercup", name: "Glacier buttercup", draw: glacierButtercup },
	{ id: "alpine-pasqueflower", name: "Alpine pasqueflower", draw: alpinePasqueflower },
	{ id: "alpine-snowbell", name: "Alpine snowbell", draw: alpineSnowbell },
	{ id: "purple-saxifrage", name: "Purple saxifrage", draw: purpleSaxifrage },
	{ id: "rock-jasmine", name: "Rock jasmine", draw: rockJasmine },
	{ id: "alpine-columbine", name: "Alpine columbine", draw: alpineColumbine },
	{ id: "spring-gentian", name: "Spring gentian", draw: springGentian },
	{ id: "alpenrose", name: "Alpenrose", draw: alpenrose },
	{ id: "globeflower", name: "Globeflower", draw: globeflower },
	{ id: "arnica", name: "Arnica", draw: arnica },
	{ id: "alpine-toadflax", name: "Alpine toadflax", draw: alpineToadflax },
	{ id: "dwarf-willow", name: "Dwarf willow", draw: dwarfWillow },
	{ id: "alpine-bistort", name: "Alpine bistort", draw: alpineBistort },
	{ id: "alpine-sea-holly", name: "Alpine sea holly", draw: alpineSeaHolly },
	{ id: "alpine-azalea", name: "Alpine azalea", draw: alpineAzalea },
	{ id: "sky-pilot", name: "Sky pilot", draw: skyPilot },
	{ id: "alpine-wallflower", name: "Alpine wallflower", draw: alpineWallflower },
];
