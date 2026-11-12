/**
 * Garden species: root vegetables and tubers (25). Drawn in the kit's flat
 * style; see kit.ts for the cell, the ground line and the shared shapes.
 * The harvest (tuber, corm, rhizome, root shoulder) shows on the soil mound
 * in the bloom stage, beside the plant's signature leaves and flowers.
 */
import { f, type GrowingStage, type LeafOptions, type Species } from "./kit";

type St = GrowingStage;
const D = Math.PI / 180;

const by = <T>(st: St, a: T, b: T, c: T): T => (st === "sprout" ? a : st === "leafy" ? b : c);

/** A point at distance r from (x, y) along deg. */
const polar = (x: number, y: number, deg: number, r: number): [number, number] => [x + Math.cos(deg * D) * r, y + Math.sin(deg * D) * r];

function ell(cx: number, cy: number, rx: number, ry: number, fill: string, rot = 0): string {
	return `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}" fill="${fill}"${rot ? ` transform="rotate(${f(rot)} ${f(cx)} ${f(cy)})"` : ""}/>`;
}

const P = (d: string, fill: string): string => `<path d="${d}" fill="${fill}"/>`;

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

/** Stroked paths merged per colour and width. */
class Pen {
	private m = new Map<string, string>();
	add(c: string, w: number, d: string): this {
		const k = `${c}|${w}`;
		this.m.set(k, (this.m.get(k) ?? "") + d);
		return this;
	}
	seg(c: string, w: number, x1: number, y1: number, x2: number, y2: number): this {
		return this.add(c, w, `M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}`);
	}
	q(c: string, w: number, x1: number, y1: number, cx: number, cy: number, x2: number, y2: number): this {
		return this.add(c, w, `M${f(x1)} ${f(y1)}Q${f(cx)} ${f(cy)} ${f(x2)} ${f(y2)}`);
	}
	toString(): string {
		let s = "";
		for (const [k, d] of this.m) {
			const [c, w] = k.split("|");
			s += `<path d="${d}" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
		}
		return s;
	}
}

/** Control points of kit leaf shapes 0, 1, 2, 4 as cubic segments in (len, w) units. */
type Curve = readonly (readonly [number, number, number, number, number, number])[];
const SHAPES: Record<0 | 1 | 2 | 4, Curve> = {
	0: [[0.3, -1, 0.8, -1, 1, 0], [0.8, 1, 0.3, 1, 0, 0]],
	1: [[0.45, -1.15, 0.8, -0.5, 1, 0], [0.8, 0.5, 0.45, 1.15, 0, 0]],
	2: [[0.05, -1.4, 1.02, -1.3, 1, 0], [1.02, 1.3, 0.05, 1.4, 0, 0]],
	4: [[0.1, -1.6, 0.75, -1.2, 1, 0], [0.75, 1.2, 0.1, 1.6, 0, 0]],
};
/** Heart with the notch at the stalk (origin) and the tip at +x. */
const HEART: Curve = [[-0.2, -0.95, 0.5, -1.15, 1, 0], [0.5, 1.15, -0.2, 0.95, 0, 0]];
/** Round kidney leaf, notch at the stalk. */
const KIDNEY: Curve = [[-0.45, -1.15, 0.95, -1.35, 1, 0], [0.95, 1.35, -0.45, 1.15, 0, 0]];
/** Obcordate leaflet (oxalis): narrow at the stalk, notched at the tip. */
const OBCORD: Curve = [[0.2, -0.6, 0.95, -1.25, 1, -0.4], [1.02, -0.1, 0.9, 0, 0.8, 0], [0.9, 0, 1.02, 0.1, 1, 0.4], [0.95, 1.25, 0.2, 0.6, 0, 0]];
/** Broad triangular (deltoid) leaf. */
const DELTA: Curve = [[-0.05, -1.1, 0.45, -0.95, 1, 0], [0.45, 0.95, -0.05, 1.1, 0, 0]];

/** Collects leaves into one path per fill and one rib path per colour. */
class Leaves {
	private fills = new Map<string, string>();
	private ribs = new Map<string, string>();
	shape(x: number, y: number, angle: number, len: number, w: number, curve: Curve, fill: string): this {
		const c = Math.cos(angle * D);
		const sn = Math.sin(angle * D);
		const pt = (u: number, v: number) => `${f(x + u * len * c - v * w * sn)} ${f(y + u * len * sn + v * w * c)}`;
		let d = `M${pt(0, 0)}`;
		for (const k of curve) d += `C${pt(k[0], k[1])} ${pt(k[2], k[3])} ${pt(k[4], k[5])}`;
		this.fills.set(fill, (this.fills.get(fill) ?? "") + d + "Z");
		return this;
	}
	rib(x: number, y: number, angle: number, len: number, dark: string): this {
		const [ax, ay] = polar(x, y, angle, 1);
		const [bx, by2] = polar(x, y, angle, len);
		this.ribs.set(dark, (this.ribs.get(dark) ?? "") + `M${f(ax)} ${f(ay)}L${f(bx)} ${f(by2)}`);
		return this;
	}
	add(x: number, y: number, angle: number, len: number, w: number, o: LeafOptions = {}): this {
		const { fill = "#6fb35a", dark = "#3f7a35", shape = 0, rib = true } = o;
		this.shape(x, y, angle, len, w, SHAPES[shape === 3 ? 1 : shape], fill);
		if (rib) this.rib(x, y, angle, len * 0.8, dark);
		return this;
	}
	raw(fill: string, d: string): this {
		this.fills.set(fill, (this.fills.get(fill) ?? "") + d);
		return this;
	}
	toString(): string {
		let s = "";
		for (const [fill, d] of this.fills) s += `<path d="${d}" fill="${fill}"/>`;
		for (const [dark, d] of this.ribs) s += `<path d="${d}" stroke="${dark}" stroke-width=".9" stroke-linecap="round" opacity=".55" fill="none"/>`;
		return s;
	}
}

/** Pinnate compound leaf: a rachis with leaflet pairs at fractions ts and a terminal leaflet. */
function compound(lv: Leaves, pen: Pen, x: number, y: number, a: number, len: number, ll: number, ratio: number, ts: number[], o: LeafOptions, stemCol: string, sw = 1.1, spread = 60): void {
	const [ex, ey] = polar(x, y, a, len);
	pen.seg(stemCol, sw, x, y, ex, ey);
	ts.forEach((t) => {
		const [px, py] = polar(x, y, a, len * t);
		const l = ll * (0.6 + 0.4 * t);
		lv.add(px, py, a - spread, l, l * ratio, o);
		lv.add(px, py, a + spread, l, l * ratio, o);
	});
	lv.add(ex, ey, a, ll * 1.1, ll * 1.1 * ratio, o);
}

/** Ellipse as path data, for merging. */
const ellD = (cx: number, cy: number, rx: number, ry: number): string =>
	`M${f(cx - rx)} ${f(cy)}a${f(rx)} ${f(ry)} 0 1 0 ${f(2 * rx)} 0a${f(rx)} ${f(ry)} 0 1 0 ${f(-2 * rx)} 0Z`;

/** A daisy: ray petals and a disc. */
function daisy(x: number, y: number, r: number, n: number, ray: string, disc: string, rot = 0): string {
	return rays(x, y, n, r * 0.35, r, Math.max(1.2, r * 0.42), ray, rot) + `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 0.42)}" fill="${disc}"/>`;
}

// ───────────────────────────────── 1. Potato
const POT = { leaf: "#4e8a3d", light: "#67a24f", rib: "#2f5f28", stem: "#3f7432", fl: "#f2eef8", flB: "#c9b6e4", eye: "#ecc53a", tub: "#c99d62", tubL: "#ddb985", tubD: "#94703f" };
function potStar(x: number, y: number, r: number): string {
	let d = "";
	for (let i = 0; i < 10; i++) {
		const [px, py] = polar(x, y, -90 + i * 36, i % 2 ? r * 0.5 : r);
		d += `${i ? "L" : "M"}${f(px)} ${f(py)}`;
	}
	return d + "Z";
}
function potato(st: St): string {
	const lv = new Leaves();
	const pen = new Pen();
	const o = { fill: POT.leaf, dark: POT.rib };
	const o2 = { fill: POT.light, dark: POT.rib };
	if (st === "sprout") {
		pen.seg(POT.stem, 1.8, 40, 87, 40, 76);
		lv.add(40, 76, -90, 7, 3.6, o2).add(40, 79, -145, 6, 3, o).add(40, 79, -35, 6, 3, o).add(40, 83, -160, 4.5, 2.4, o2).add(40, 83, -20, 4.5, 2.4, o2);
		return pen.toString() + lv.toString();
	}
	if (st === "leafy") {
		pen.q(POT.stem, 2.2, 40, 87, 39, 72, 40, 60);
		const L: [number, number, number, number][] = [[40, 82, -160, 15], [40, 78, -20, 16], [40, 72, -135, 16], [40, 68, -45, 16], [40, 62, -100, 16]];
		L.forEach(([x, y, a, l], i) => compound(lv, pen, x, y, a, l, 5.4, 0.55, [0.35, 0.68], i % 2 ? o : o2, POT.stem, 1.1, 62));
		return pen.toString() + lv.toString();
	}
	pen.q(POT.stem, 2.4, 38, 87, 35, 66, 31, 40).q(POT.stem, 2.4, 42, 87, 46, 64, 50, 36);
	const L: [number, number, number, number][] = [
		[37, 80, -170, 17], [43, 80, -10, 17], [36, 72, -150, 18], [44, 70, -30, 18], [34, 60, -140, 17], [46, 58, -40, 17], [33, 50, -115, 14], [48, 47, -65, 14],
	];
	L.forEach(([x, y, a, l], i) => compound(lv, pen, x, y, a, l, 5.8, 0.55, [0.35, 0.68], i % 2 ? o : o2, POT.stem, 1.1, 62));
	pen.q(POT.stem, 1, 31, 40, 28, 33, 24, 30).q(POT.stem, 1, 31, 40, 34, 32, 36, 28).q(POT.stem, 1, 50, 36, 50, 28, 46, 23).q(POT.stem, 1, 50, 36, 55, 30, 58, 28).q(POT.stem, 1, 50, 36, 52, 26, 54, 20);
	const fls: [number, number, number][] = [[24, 29, 3.4], [36, 27, 3.6], [29, 24, 3], [46, 22, 3.4], [58, 27, 3.4], [54, 18, 3.6]];
	let fl = "";
	let flB = "";
	fls.forEach(([x, y, r], i) => (i % 3 === 1 ? (flB += potStar(x, y, r)) : (fl += potStar(x, y, r))));
	const tub = ellD(26.5, 85, 5.2, 3.6) + ellD(53.5, 85.6, 4.4, 3.1) + ellD(44.5, 87, 3.6, 2.5);
	return (
		pen.toString() +
		lv.toString() +
		P(fl, POT.fl) +
		P(flB, POT.flB) +
		dots(fls.map(([x, y]) => [x, y]), POT.eye, 1.1) +
		P(tub, POT.tub) +
		ell(25, 83.8, 2, 1.2, POT.tubL) +
		dots([[28.5, 85.6], [24, 86.2], [52, 85], [55.5, 86.6], [44, 86.6]], POT.tubD, 0.55)
	);
}

// ───────────────────────────────── 2. Sweet potato
const SWP = { vine: "#7d4f68", leaf: "#5c9c47", light: "#76b45c", rib: "#3a6e30", fl: "#cf7fbf", rim: "#e9b4de", throat: "#7a356f", tub: "#b5573a", tubL: "#d07a58" };
function trumpet(x: number, y: number, a: number, s: number): string {
	return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(a + 90)}) scale(${f(s)})"><path d="M-.9 0L-4.2 -7.2Q0 -8.6 4.2 -7.2L.9 0Z" fill="${SWP.fl}"/><ellipse cx="0" cy="-7.4" rx="4.5" ry="1.7" fill="${SWP.rim}"/><circle cx="0" cy="-7.3" r=".9" fill="${SWP.throat}"/></g>`;
}
function sweetPotato(st: St): string {
	const lv = new Leaves();
	const pen = new Pen();
	const add = (sx: number, sy: number, x: number, y: number, a: number, l: number, i: number) => {
		pen.q(SWP.vine, 1, sx, sy, (sx + x) / 2 + 1, (sy + y) / 2 + 2, x, y);
		lv.shape(x, y, a, l, l * 0.6, HEART, i % 2 ? SWP.leaf : SWP.light).rib(x, y, a, l * 0.75, SWP.rib);
	};
	if (st === "sprout") {
		add(40, 87, 36, 77, -115, 8, 0);
		add(40, 87, 44, 74, -70, 9, 1);
		return pen.toString() + lv.toString();
	}
	if (st === "leafy") {
		pen.q(SWP.vine, 1.6, 40, 86, 26, 85, 12, 81).q(SWP.vine, 1.6, 40, 86, 55, 85, 68, 81);
		const L: [number, number, number, number, number, number][] = [
			[15, 82, 14, 70, -110, 10], [26, 85, 24, 66, -100, 12], [55, 85, 56, 64, -80, 12], [65, 82, 66, 70, -70, 10], [38, 86, 32, 56, -100, 13], [42, 86, 47, 52, -75, 13], [40, 86, 39, 62, -90, 12],
		];
		L.forEach(([sx, sy, x, y, a, l], i) => add(sx, sy, x, y, a, l, i));
		return pen.toString() + lv.toString();
	}
	pen.q(SWP.vine, 1.8, 40, 86, 22, 86, 6, 80).q(SWP.vine, 1.8, 40, 86, 58, 86, 74, 79);
	const L: [number, number, number, number, number, number][] = [
		[9, 81, 8, 70, -100, 11], [16, 84, 14, 62, -100, 13], [26, 85, 22, 52, -110, 14], [54, 85, 58, 50, -70, 14], [64, 84, 66, 60, -80, 13], [71, 80, 72, 69, -80, 11],
		[36, 86, 30, 44, -100, 14], [44, 86, 48, 40, -78, 14], [40, 86, 40, 54, -90, 13], [30, 85, 26, 70, -150, 11], [50, 85, 54, 70, -30, 11],
	];
	L.forEach(([sx, sy, x, y, a, l], i) => add(sx, sy, x, y, a, l, i));
	return (
		pen.toString() +
		lv.toString() +
		trumpet(20, 50, -105, 1) +
		trumpet(40, 38, -85, 1.1) +
		trumpet(62, 52, -70, 1) +
		ell(31, 85.4, 8.5, 3.4, SWP.tub, -8) +
		ell(51, 86.4, 6, 2.7, SWP.tub, 10) +
		ell(28, 84.2, 4, 1.1, SWP.tubL, -8)
	);
}

// ───────────────────────────────── 3. Turnip
const TUR = { leaf: "#78b65e", light: "#93ca78", rib: "#4b8a3c", root: "#f1ede4", top: "#9a4f94", topL: "#b974b2", stalk: "#6c9e50", fl: "#f0cf43" };
/** Lyrate leaf: a big terminal lobe with small lobes near the stalk. */
function lyrate(lv: Leaves, pen: Pen, x: number, y: number, a: number, len: number, w: number, fill: string, rib: string): void {
	const [tx, ty] = polar(x, y, a, len * 0.42);
	lv.add(tx, ty, a, len * 0.58, w, { fill, dark: rib });
	for (const t of [0.26]) {
		const [px, py] = polar(x, y, a, len * t);
		const l = w * 0.75;
		lv.add(px, py, a - 70, l, l * 0.55, { fill, rib: false }).add(px, py, a + 70, l, l * 0.55, { fill, rib: false });
	}
	pen.seg(rib, 1.2, x, y, tx, ty);
}
function turnipRoot(cx: number, cy: number, r: number): string {
	const h = cy - r * 0.35;
	const hw = Math.sqrt(r * r - (r * 0.35) ** 2);
	return (
		P(`${ellD(cx, cy, r, r)}M${f(cx - r * 0.25)} ${f(cy + r * 0.9)}L${f(cx)} ${f(cy + r + 2)}L${f(cx + r * 0.25)} ${f(cy + r * 0.9)}Z`, TUR.root) +
		P(`M${f(cx - hw)} ${f(h)}A${f(r)} ${f(r)} 0 0 1 ${f(cx + hw)} ${f(h)}Q${f(cx)} ${f(h + r * 0.3)} ${f(cx - hw)} ${f(h)}Z`, TUR.top) +
		ell(cx - r * 0.4, cy - r * 0.55, r * 0.22, r * 0.14, TUR.topL, -30)
	);
}
function turnip(st: St): string {
	const lv = new Leaves();
	const pen = new Pen();
	if (st === "sprout") {
		pen.seg(TUR.stalk, 1.5, 40, 87, 40, 76);
		lv.add(40, 77, -150, 7, 4, { fill: TUR.light, shape: 2, rib: false }).add(40, 77, -30, 7, 4, { fill: TUR.light, shape: 2, rib: false });
		lyrate(lv, pen, 40, 78, -92, 11, 3.4, TUR.leaf, TUR.rib);
		return pen.toString() + lv.toString();
	}
	if (st === "leafy") {
		[[-150, 24], [-122, 28], [-92, 30], [-62, 28], [-32, 24]].forEach(([a, l], i) => lyrate(lv, pen, 40, 82, a!, l!, 5.4, i % 2 ? TUR.light : TUR.leaf, TUR.rib));
		return pen.toString() + lv.toString() + turnipRoot(40, 83.5, 4.6);
	}
	pen.seg(TUR.stalk, 1.6, 40, 72, 40, 16).q(TUR.stalk, 1.1, 40, 40, 33, 34, 31, 24).q(TUR.stalk, 1.1, 40, 46, 48, 38, 50, 28);
	[[-160, 26], [-132, 30], [-104, 30], [-76, 30], [-48, 30], [-20, 26]].forEach(([a, l], i) => lyrate(lv, pen, 40, 74, a!, l!, 5.8, i % 2 ? TUR.light : TUR.leaf, TUR.rib));
	lv.add(40, 56, -150, 7, 2.6, { fill: TUR.leaf, shape: 1, rib: false }).add(40, 50, -30, 7, 2.6, { fill: TUR.light, shape: 1, rib: false });
	const fl: [number, number][] = [];
	const spike = (x: number, y: number) => fl.push([x, y], [x - 2.6, y + 3], [x + 2.6, y + 3.4], [x - 2, y + 6.4], [x + 2.4, y + 7]);
	spike(40, 13);
	spike(31, 21);
	spike(50, 25);
	const petals = fl.flatMap(([x, y]) => [[x - 1, y - 0.6], [x + 1, y - 0.6], [x - 1, y + 0.8], [x + 1, y + 0.8]] as [number, number][]);
	return pen.toString() + lv.toString() + dots(petals, TUR.fl, 1.1) + dots(fl, "#d9a92a", 0.5) + turnipRoot(40, 79, 8.6);
}

// ───────────────────────────────── 4. Parsnip
const PAR = { leaf: "#6aa54e", light: "#86bb66", rib: "#3f7a35", stem: "#5a8f42", umb: "#e3c43c", umbD: "#bf9f2a", crown: "#ede4c8", crownD: "#cdbf98" };
function umbel(pen: Pen, pts: [number, number, number?][], x: number, y: number, r: number): void {
	const n = 6;
	const by0 = y + r * 0.75;
	for (let i = 0; i <= n; i++) {
		const t = i / n - 0.5;
		const px = x + t * 2 * r;
		const py = y + t * t * r * 0.7;
		pen.seg(PAR.stem, 0.6, x, by0, px, py);
		pts.push([px, py, 1.5], [px - 1.1, py - 0.8, 1], [px + 1.1, py - 0.8, 1]);
	}
}
function parsnip(st: St): string {
	const lv = new Leaves();
	const pen = new Pen();
	const o = { fill: PAR.leaf, dark: PAR.rib, shape: 1 as const };
	const o2 = { fill: PAR.light, dark: PAR.rib, shape: 1 as const };
	if (st === "sprout") {
		compound(lv, pen, 40, 87, -95, 13, 4, 0.5, [0.55], o2, PAR.stem, 1.3, 55);
		lv.add(40, 84, -150, 6, 1.6, { fill: PAR.leaf, rib: false }).add(40, 84, -30, 6, 1.6, { fill: PAR.leaf, rib: false });
		return pen.toString() + lv.toString();
	}
	const crown = P(ellD(40, 85.4, by(st, 3, 4, 6), by(st, 2, 2.4, 3)), PAR.crown) + dots([[37, 86], [42, 86.6]], PAR.crownD, 0.6);
	if (st === "leafy") {
		[[-140, 30], [-112, 36], [-88, 40], [-64, 36], [-38, 30]].forEach(([a, l], i) => compound(lv, pen, 40, 84, a!, l!, 6.2, 0.45, [0.4, 0.62, 0.82], i % 2 ? o : o2, PAR.stem, 1.2, 58));
		return pen.toString() + lv.toString() + crown;
	}
	[[-158, 30], [-132, 34], [-50, 34], [-22, 30], [-108, 30], [-74, 30]].forEach(([a, l], i) => compound(lv, pen, 40, 84, a!, l!, 6.6, 0.45, [0.48, 0.76], i % 2 ? o : o2, PAR.stem, 1.2, 58));
	pen.seg(PAR.stem, 2, 40, 84, 40, 22).q(PAR.stem, 1.4, 40, 48, 30, 40, 26, 34).q(PAR.stem, 1.4, 40, 42, 50, 34, 55, 28);
	lv.add(40, 50, -140, 8, 2.4, o).add(40, 44, -40, 8, 2.4, o2);
	const pts: [number, number, number?][] = [];
	umbel(pen, pts, 40, 14, 9);
	umbel(pen, pts, 25, 28, 7);
	umbel(pen, pts, 56, 22, 7);
	return pen.toString() + lv.toString() + dots(pts, PAR.umb) + crown;
}

// ───────────────────────────────── 5. Rutabaga
const RUT = { leaf: "#7aa597", light: "#97bcaf", rib: "#4f7c6b", root: "#e4c47c", rootL: "#f1db9f", top: "#7c4876", ring: "#5e3459" };
function rutaRoot(cx: number, top: number, hw: number, h: number): string {
	const b = top + h;
	return (
		P(`M${f(cx)} ${f(top)}C${f(cx + hw * 1.25)} ${f(top + h * 0.05)} ${f(cx + hw * 1.15)} ${f(b - h * 0.2)} ${f(cx + 1)} ${f(b)}L${f(cx - 1)} ${f(b)}C${f(cx - hw * 1.15)} ${f(b - h * 0.2)} ${f(cx - hw * 1.25)} ${f(top + h * 0.05)} ${f(cx)} ${f(top)}Z`, RUT.root) +
		P(`M${f(cx)} ${f(top)}C${f(cx + hw * 1.1)} ${f(top + h * 0.03)} ${f(cx + hw * 1.08)} ${f(top + h * 0.38)} ${f(cx + hw)} ${f(top + h * 0.5)}Q${f(cx)} ${f(top + h * 0.6)} ${f(cx - hw)} ${f(top + h * 0.5)}C${f(cx - hw * 1.08)} ${f(top + h * 0.38)} ${f(cx - hw * 1.1)} ${f(top + h * 0.03)} ${f(cx)} ${f(top)}Z`, RUT.top) +
		`<path d="M${f(cx - hw * 0.5)} ${f(top + h * 0.12)}Q${f(cx)} ${f(top + h * 0.2)} ${f(cx + hw * 0.5)} ${f(top + h * 0.12)}M${f(cx - hw * 0.75)} ${f(top + h * 0.28)}Q${f(cx)} ${f(top + h * 0.37)} ${f(cx + hw * 0.75)} ${f(top + h * 0.28)}" stroke="${RUT.ring}" stroke-width=".8" fill="none"/>` +
		ell(cx - hw * 0.55, top + h * 0.68, hw * 0.18, h * 0.14, RUT.rootL, 15)
	);
}
function rutabaga(st: St): string {
	const lv = new Leaves();
	const pen = new Pen();
	if (st === "sprout") {
		pen.seg(RUT.rib, 1.5, 40, 87, 40, 74);
		lv.add(40, 75, -145, 8, 5, { fill: RUT.light, shape: 2, rib: false }).add(40, 75, -35, 8, 5, { fill: RUT.light, shape: 2, rib: false }).add(40, 76, -92, 10, 4.6, { fill: RUT.leaf, dark: RUT.rib });
		return pen.toString() + lv.toString();
	}
	const big = st === "bloom";
	const y0 = big ? 58 : 76;
	const L = big
		? [[-155, 28, 8], [-128, 34, 9], [-100, 36, 9.5], [-76, 36, 9.5], [-50, 34, 9], [-24, 28, 8]]
		: [[-145, 24, 6.4], [-115, 28, 7], [-85, 30, 7.2], [-55, 26, 6.6]];
	L.forEach(([a, l, w], i) => lyrate(lv, pen, 40, y0, a!, l!, w! * 0.78, i % 2 ? RUT.light : RUT.leaf, RUT.rib));
	return pen.toString() + lv.toString() + (big ? rutaRoot(40, 57, 10, 31) : rutaRoot(40, 75, 5, 13));
}

// ───────────────────────────────── 6. Celeriac
const CEL = { stalk: "#97c473", stalkD: "#6f9e4f", leaf: "#5a9b44", light: "#76b35b", rib: "#3a6e30", root: "#dcd0a4", rootD: "#b6a77a", rootL: "#ece4c4", hair: "#a08d64" };
function celery(lv: Leaves, x: number, y: number, a: number, s: number, i: number): void {
	const fill = i % 2 ? CEL.leaf : CEL.light;
	lv.add(x, y, a - 38, s * 0.85, s * 0.42, { fill, rib: false, shape: 1 }).add(x, y, a + 38, s * 0.85, s * 0.42, { fill, rib: false, shape: 1 }).add(x, y, a, s, s * 0.48, { fill, dark: CEL.rib, shape: 1 });
}
function celeriac(st: St): string {
	const lv = new Leaves();
	const pen = new Pen();
	if (st === "sprout") {
		[[-120, 10], [-90, 13], [-60, 10]].forEach(([a, l], i) => {
			const [x, y] = polar(40, 86, a!, l!);
			pen.seg(CEL.stalkD, 1.3, 40, 86, x, y);
			celery(lv, x, y, a!, 5, i);
		});
		return pen.toString() + lv.toString();
	}
	const big = st === "bloom";
	const y0 = big ? 72 : 82;
	const L = big ? [[-150, 30], [-130, 40], [-112, 48], [-96, 52], [-80, 50], [-64, 46], [-46, 40], [-28, 30]] : [[-135, 30], [-112, 38], [-90, 40], [-68, 36], [-45, 30]];
	L.forEach(([a, l], i) => {
		const [x, y] = polar(40, y0, a!, l!);
		pen.q(i % 2 ? CEL.stalk : CEL.stalkD, big ? 2 : 1.6, 40, y0, (40 + x) / 2, (y0 + y) / 2 + 2, x, y);
		celery(lv, x, y, a!, big ? 8.5 : 7, i);
		const [mx, my] = polar(40, y0, a!, l! * 0.7);
		celery(lv, mx, my, a! + (i % 2 ? 50 : -50), big ? 5.5 : 4.5, i + 1);
	});
	if (!big) return pen.toString() + lv.toString() + P(ellD(40, 83.5, 6.5, 4.2), CEL.root) + ell(37.5, 82.2, 2, 1.2, CEL.rootL);
	const knobs = ellD(29.5, 81.5, 3, 2.6) + ellD(50.5, 82, 3.2, 2.6) + ellD(34, 85.5, 3, 2.4) + ellD(46, 85.6, 3.2, 2.4) + ellD(40, 86.5, 3, 2);
	return (
		pen.toString() +
		lv.toString() +
		`<path d="M30 85L26 88M33 87L31 88.5M48 87L50 88.5M51 85L55 88" stroke="${CEL.hair}" stroke-width=".7" fill="none"/>` +
		P(ellD(40, 78.5, 12.5, 8) + knobs, CEL.root) +
		`<path d="M31 80Q34 82 37 80.6M43 82Q46 83.5 49 81.5M36 85Q38 86.4 40 85.4" stroke="${CEL.rootD}" stroke-width=".8" fill="none"/>` +
		ell(34, 75.6, 3.4, 1.8, CEL.rootL, -15) +
		dots([[44.5, 76.5], [47.6, 78.6], [32.5, 83.6]], CEL.rootD, 0.6)
	);
}

// ───────────────────────────────── 7. Jerusalem artichoke
const JA = { stem: "#4f7d38", leaf: "#5d9944", light: "#77b05a", rib: "#36652a", ray: "#f3c22e", disc: "#b07d2a", tub: "#d4ab8c", tubD: "#a77d62" };
function jaStem(lv: Leaves, pen: Pen, x0: number, x1: number, top: number, n: number, ll: number, phase: number): void {
	pen.q(JA.stem, 2, x0, 87, x0 + (x1 - x0) * 0.2, (87 + top) / 2, x1, top);
	for (let i = 0; i < n; i++) {
		const t = 0.2 + (0.72 * i) / Math.max(1, n - 1);
		const y = 87 + (top - 87) * t;
		const x = x0 + (x1 - x0) * t * t;
		const side = (i + phase) % 2 ? 1 : -1;
		const l = ll * (1 - t * 0.35);
		lv.add(x, y, -90 + side * 58, l, l * 0.3, { fill: i % 2 ? JA.leaf : JA.light, dark: JA.rib, shape: 1 });
	}
}
function jerusalemArtichoke(st: St): string {
	const lv = new Leaves();
	const pen = new Pen();
	if (st === "sprout") {
		jaStem(lv, pen, 40, 40, 70, 3, 8, 0);
		lv.add(40, 70.5, -90, 5, 1.8, { fill: JA.light, shape: 1, rib: false });
		return pen.toString() + lv.toString();
	}
	if (st === "leafy") {
		jaStem(lv, pen, 38, 34, 40, 6, 15, 0);
		jaStem(lv, pen, 42, 48, 46, 5, 14, 1);
		lv.add(34, 40.5, -95, 7, 2.2, { fill: JA.light, shape: 1, rib: false }).add(48, 46.5, -85, 7, 2.2, { fill: JA.light, shape: 1, rib: false });
		return pen.toString() + lv.toString();
	}
	jaStem(lv, pen, 37, 28, 16, 7, 15, 0);
	jaStem(lv, pen, 40, 44, 10, 8, 15, 1);
	jaStem(lv, pen, 43, 56, 22, 6, 14, 0);
	pen.q(JA.stem, 1.2, 42.5, 34, 50, 30, 54, 36).q(JA.stem, 1.2, 33, 38, 24, 34, 18, 32);
	return (
		pen.toString() +
		lv.toString() +
		daisy(28, 16, 5.6, 11, JA.ray, JA.disc) +
		daisy(44, 10, 5.8, 11, JA.ray, JA.disc, 10) +
		daisy(56, 22, 5.4, 11, JA.ray, JA.disc, 5) +
		daisy(18, 32, 4.4, 10, JA.ray, JA.disc) +
		daisy(54, 36, 4, 10, JA.ray, JA.disc, 8) +
		P(ellD(26.5, 85.6, 4, 2.8) + ellD(30.5, 84, 2.6, 2.2) + ellD(23, 84.5, 2.2, 1.8) + ellD(53, 85.8, 3.4, 2.4) + ellD(56, 84.4, 2, 1.7), JA.tub) +
		dots([[27.5, 86.4], [24, 85.4], [53.5, 86.4]], JA.tubD, 0.5)
	);
}

// ───────────────────────────────── 8. Cassava
const CAS = { stem: "#a3866a", node: "#7c624d", pet: "#b84c42", leaf: "#4e8e41", light: "#69a757", rib: "#2f5f28" };
function palmate(lv: Leaves, pen: Pen, sx: number, sy: number, x: number, y: number, a: number, n: number, len: number, spread: number, i: number): void {
	pen.q(CAS.pet, 1, sx, sy, (sx + x) / 2, Math.min(sy, y) - 2, x, y);
	for (let k = 0; k < n; k++) {
		const t = k / (n - 1) - 0.5;
		const l = len * (1 - Math.abs(t) * 0.9);
		lv.add(x, y, a + t * spread, l, l * 0.17, { fill: (i + k) % 2 ? CAS.leaf : CAS.light, dark: CAS.rib, shape: 1, rib: l > 7 });
	}
}
function cassava(st: St): string {
	const lv = new Leaves();
	const pen = new Pen();
	if (st === "sprout") {
		pen.seg(CAS.stem, 2, 40, 87, 40, 72);
		palmate(lv, pen, 40, 72, 34, 70, -130, 5, 8, 150, 0);
		palmate(lv, pen, 40, 72, 46, 69, -50, 5, 8, 150, 1);
		return pen.toString() + lv.toString();
	}
	if (st === "leafy") {
		pen.seg(CAS.stem, 2.6, 40, 87, 40, 52);
		pen.add(CAS.node, 2.8, "M39 78h2M39 70h2M39 62h2");
		palmate(lv, pen, 40, 56, 30, 56, 160, 5, 11, 150, 0);
		palmate(lv, pen, 40, 56, 50, 55, 20, 5, 11, 150, 1);
		palmate(lv, pen, 40, 52, 30, 44, -140, 7, 13, 170, 0);
		palmate(lv, pen, 40, 52, 50, 43, -40, 7, 13, 170, 1);
		palmate(lv, pen, 40, 52, 40, 42, -90, 7, 13, 170, 0);
		return pen.toString() + lv.toString();
	}
	pen.seg(CAS.stem, 3, 40, 87, 40, 50).q(CAS.stem, 2.4, 40, 50, 34, 40, 27, 30).q(CAS.stem, 2.4, 40, 50, 47, 38, 53, 28);
	pen.add(CAS.node, 3.2, "M38.8 80h2.4M38.8 72h2.4M38.8 64h2.4M38.8 56h2.4");
	palmate(lv, pen, 40, 60, 28, 62, 165, 5, 11, 140, 0);
	palmate(lv, pen, 40, 58, 52, 60, 15, 5, 11, 140, 1);
	palmate(lv, pen, 27, 30, 16, 32, 165, 7, 13, 165, 0);
	palmate(lv, pen, 27, 30, 22, 20, -125, 7, 14, 170, 1);
	palmate(lv, pen, 27, 30, 33, 18, -80, 7, 13, 170, 0);
	palmate(lv, pen, 53, 28, 64, 30, 15, 7, 13, 165, 1);
	palmate(lv, pen, 53, 28, 58, 18, -55, 7, 14, 170, 0);
	palmate(lv, pen, 53, 28, 46, 20, -105, 7, 12, 170, 1);
	return pen.toString() + lv.toString() + ell(30, 86, 7, 2.2, "#8f6a4a", -12) + ell(51, 86.6, 5, 1.8, "#8f6a4a", 14);
}

// ───────────────────────────────── 9. Taro
const TARO = { leaf: "#4d8b5d", light: "#62a171", vein: "#2b5f3b", pet: "#7d6a82", corm: "#8b6c4f", ring: "#5e4733", cormL: "#a6876a" };
function taroLeaf(lv: Leaves, pen: Pen, x: number, y: number, a: number, len: number, fill: string): void {
	lv.shape(x, y, a, len, len * 0.55, HEART, fill);
	const [tx, ty] = polar(x, y, a, len * 0.9);
	pen.seg(TARO.vein, 0.8, x, y, tx, ty);
	for (const t of [0.35, 0.6]) {
		const [mx, my] = polar(x, y, a, len * t);
		for (const s of [-1, 1]) {
			const [ex, ey] = polar(mx, my, a + s * 50, len * 0.3 * (1.1 - t));
			pen.seg(TARO.vein, 0.6, mx, my, ex, ey);
		}
	}
}
function taro(st: St): string {
	const lv = new Leaves();
	const veins = new Pen();
	const pen = new Pen();
	const leafAt = (x: number, y: number, a: number, len: number, i: number, cx: number, cy: number) => {
		pen.q(TARO.pet, len > 15 ? 2.2 : 1.6, 40, 86, cx, cy, x, y);
		taroLeaf(lv, veins, x, y, a, len, i % 2 ? TARO.leaf : TARO.light);
	};
	if (st === "sprout") {
		leafAt(42, 70, 70, 11, 1, 41, 78);
		pen.q(TARO.pet, 1.6, 40, 86, 37, 78, 35, 68);
		return pen.toString() + P("M35 68Q32.5 72 35 76Q37.5 72 35 68Z", TARO.light) + lv.toString() + veins.toString();
	}
	if (st === "leafy") {
		leafAt(29, 50, 115, 17, 0, 34, 70);
		leafAt(52, 46, 65, 18, 1, 47, 66);
		leafAt(40, 64, 90, 11, 0, 40, 76);
		return pen.toString() + lv.toString() + veins.toString() + ell(40, 85.5, 4, 2.6, TARO.corm);
	}
	leafAt(22, 34, 118, 24, 0, 26, 60);
	leafAt(59, 30, 62, 25, 1, 54, 60);
	leafAt(39, 18, 88, 26, 0, 36, 48);
	return (
		pen.toString() +
		lv.toString() +
		veins.toString() +
		P(ellD(40, 82.5, 6.5, 5.4) + ellD(31.5, 86, 3, 2.2) + ellD(48.5, 86, 3, 2.2), TARO.corm) +
		`<path d="M34.6 80.5Q40 82.5 45.4 80.5M34 84Q40 86 46 84M30 85.6Q31.5 86.6 33 85.6M47 85.6Q48.5 86.6 50 85.6" stroke="${TARO.ring}" stroke-width=".8" fill="none"/>` +
		ell(37, 79.4, 1.8, 1, TARO.cormL)
	);
}

// ───────────────────────────────── 10. Yam
const YAM = { stake: "#a5825c", vine: "#4b7b32", leaf: "#3d873d", light: "#58a250", vein: "#28572a", tub: "#7e5638", tubL: "#a07856", hair: "#4f3322", bul: "#8a6644" };
function yam(st: St): string {
	const lv = new Leaves();
	const pen = new Pen();
	const top = by(st, 72, 38, 10);
	if (st !== "sprout") pen.seg(YAM.stake, 2.2, 40, 88, 40, top - 2);
	let d = "M40 87";
	const n = st === "sprout" ? 3 : st === "leafy" ? 8 : 14;
	const pts: [number, number][] = [];
	for (let i = 1; i <= n; i++) {
		const y = 87 + ((top - 87) * i) / n;
		const x = 40 + (i % 2 ? 3.4 : -3.4) * (st === "sprout" ? 0.6 : 1);
		d += `L${f(x)} ${f(y)}`;
		pts.push([x, y]);
	}
	pen.add(YAM.vine, 1.3, d);
	const bul: [number, number][] = [];
	pts.forEach(([x, y], i) => {
		if (i === 0 && st !== "sprout") return;
		const side = i % 2 ? -1 : 1;
		const l = st === "sprout" ? 8 : st === "leafy" ? 11 : 12.5 - (i / n) * 3;
		const [lx, ly] = polar(x, y, side > 0 ? -20 : -160, 3);
		pen.seg(YAM.vine, 0.9, x, y, lx, ly);
		const a = side > 0 ? 55 : 125;
		lv.shape(lx, ly, a, l, l * 0.6, HEART, i % 3 ? YAM.leaf : YAM.light).rib(lx, ly, a, l * 0.8, YAM.vein);
		if (st === "bloom" && i % 4 === 2) bul.push([x + side * 1.6, y + 1.5]);
	});
	if (st === "sprout") return pen.toString() + lv.toString();
	if (st === "leafy") return pen.toString() + lv.toString();
	return (
		pen.toString() +
		lv.toString() +
		dots(bul, YAM.bul, 1.5) +
		P(`M17 85C17 79.4 29 79.6 40 81C51 82.4 61 80.4 63 84.4C64.4 88 52 88.6 40 88.2C28 87.8 17 89 17 85Z`, YAM.tub) +
		P(`M21 83.4C28 81.4 35 81.8 42 82.8C35 83.8 28 83.6 21 83.4Z`, YAM.tubL) +
		dots([[22, 86], [28, 85], [33, 86.8], [46, 85.6], [52, 86.2], [58, 85], [39, 84.8]], YAM.hair, 0.5)
	);
}

// ───────────────────────────────── 11. Ginger
const GIN = { cane: "#6a9b4c", leaf: "#6fb35a", light: "#8cc46a", rib: "#3f7a35", rhz: "#d9b67c", rhzL: "#ead0a0", rhzD: "#ad8a52", cone: "#8eb85a", coneD: "#5e8a39", lip: "#6a3f86", lipY: "#e8d04a" };
/** A reed cane with alternate, two-ranked narrow leaves. */
function cane(lv: Leaves, pen: Pen, x0: number, x1: number, top: number, n: number, ll: number, lw: number, col: string, fill: [string, string], rib: string, shape: 0 | 1, sw = 1.6): void {
	pen.q(col, sw, x0, 87, x0, (87 + top) / 2, x1, top);
	for (let i = 0; i < n; i++) {
		const t = 0.25 + (0.75 * i) / Math.max(1, n - 1);
		const y = 87 + (top - 87) * t;
		const x = x0 + (x1 - x0) * t * t;
		const side = i % 2 ? 1 : -1;
		const l = ll * (1 - t * 0.3);
		lv.add(x, y, -90 + side * (i === n - 1 ? 18 : 52), l, lw, { fill: fill[i % 2]!, dark: rib, shape });
	}
}
function ginger(st: St): string {
	const lv = new Leaves();
	const pen = new Pen();
	const fl: [string, string] = [GIN.leaf, GIN.light];
	if (st === "sprout") {
		cane(lv, pen, 40, 41, 72, 3, 9, 1.8, GIN.cane, fl, GIN.rib, 1);
		return pen.toString() + lv.toString() + P(ellD(40, 86, 3.4, 1.8), GIN.rhz);
	}
	if (st === "leafy") {
		cane(lv, pen, 38, 34, 44, 6, 14, 2.6, GIN.cane, fl, GIN.rib, 1);
		cane(lv, pen, 43, 49, 50, 5, 13, 2.6, GIN.cane, fl, GIN.rib, 1);
		return pen.toString() + lv.toString() + P(ellD(40, 86, 6, 2.4), GIN.rhz);
	}
	cane(lv, pen, 34, 26, 22, 7, 16, 2.8, GIN.cane, fl, GIN.rib, 1);
	cane(lv, pen, 39, 40, 12, 9, 16, 2.8, GIN.cane, fl, GIN.rib, 1);
	cane(lv, pen, 44, 52, 26, 7, 15, 2.8, GIN.cane, fl, GIN.rib, 1);
	pen.q(GIN.coneD, 1.6, 54, 86, 60, 76, 63, 64);
	let scales = "";
	for (let i = 0; i < 4; i++) scales += `M${f(60.5 + (i % 2) * 0.6)} ${f(62.5 - i * 2.4)}Q63 ${f(64 - i * 2.4)} ${f(65.5 - (i % 2) * 0.6)} ${f(62.5 - i * 2.4)}`;
	return (
		pen.toString() +
		lv.toString() +
		P(ellD(63, 58, 4, 7), GIN.cone) +
		`<path d="${scales}" stroke="${GIN.coneD}" stroke-width=".8" fill="none"/>` +
		P("M64.5 53.5Q70 50 70.5 54.5Q69 57.5 65 56Z", GIN.lip) +
		dots([[68.5, 54.6]], GIN.lipY, 0.9) +
		P(ellD(32, 85, 7, 3) + ellD(25, 83.2, 3.4, 2.4) + ellD(41.5, 84.4, 4, 2.6) + ellD(48, 86, 3.6, 2.2) + ellD(37, 82.2, 2.2, 1.8), GIN.rhz) +
		ell(29, 83.6, 2.6, 0.9, GIN.rhzL) +
		`<path d="M29 83.4v3.2M36 83v3.6M44 82.6v3.4M24 81.6v3" stroke="${GIN.rhzD}" stroke-width=".7" fill="none"/>`
	);
}

// ───────────────────────────────── 12. Turmeric
const TUM = { leaf: "#5ea34d", light: "#7ab866", rib: "#3c7533", pet: "#5a8f45", spikeG: "#b9d888", spikeP: "#e396bf", spikeW: "#f6e4ee", rhz: "#c98e3c", cut: "#f08a12", cutL: "#f8b54a" };
function turmeric(st: St): string {
	const lv = new Leaves();
	const pen = new Pen();
	const L = by(
		st,
		[[-115, 4, 12, 3.4], [-70, 4, 11, 3.2]],
		[[-140, 6, 22, 6], [-112, 8, 26, 7], [-80, 8, 26, 7], [-50, 6, 22, 6]],
		[[-150, 8, 26, 7.4], [-126, 11, 32, 8.6], [-100, 12, 36, 9.2], [-76, 12, 35, 9], [-52, 11, 32, 8.6], [-30, 8, 26, 7.4]],
	);
	L.forEach(([a, sl, l, w], i) => {
		const [sx, sy] = polar(40, 86, a!, sl!);
		pen.seg(TUM.pet, 1.6, 40, 86, sx, sy);
		lv.add(sx, sy, a!, l!, w!, { fill: i % 2 ? TUM.leaf : TUM.light, dark: TUM.rib });
		const [m1x, m1y] = polar(sx, sy, a!, l! * 0.5);
		for (const s of [-1, 1]) {
			const [ex, ey] = polar(m1x, m1y, a! + s * 35, w! * 0.8);
			pen.seg(TUM.rib, 0.5, m1x, m1y, ex, ey);
		}
	});
	if (st !== "bloom") return pen.toString() + lv.toString();
	pen.seg(TUM.pet, 2, 40, 86, 40, 64);
	let g = "";
	let pk = "";
	for (let i = 0; i < 7; i++) {
		const y = 66 - i * 3.3;
		const w = 5.6 - i * 0.45;
		const d = `M${f(40 - w)} ${f(y - 2.6)}Q${f(40 - w * 0.6)} ${f(y + 2)} 40 ${f(y + 2.2)}Q${f(40 + w * 0.6)} ${f(y + 2)} ${f(40 + w)} ${f(y - 2.6)}Q40 ${f(y)} ${f(40 - w)} ${f(y - 2.6)}Z`;
		if (i < 4) g += d;
		else pk += d;
	}
	return (
		pen.toString() +
		lv.toString() +
		P(g, TUM.spikeG) +
		P(pk, TUM.spikeP) +
		dots([[40, 43.4], [37.4, 46.6], [42.6, 46.6]], TUM.spikeW, 1) +
		P(ellD(28, 85.6, 6, 2.4) + ellD(23, 84, 2.8, 1.9) + ellD(51, 86.2, 4.4, 2), TUM.rhz) +
		P(ellD(56, 85.8, 2.6, 2.3), TUM.cut) +
		ell(55.6, 85.4, 1.2, 1, TUM.cutL)
	);
}

// ───────────────────────────────── 13. Horseradish
const HOR = { leaf: "#5c9b47", light: "#77b15d", rib: "#3c7631", stalk: "#6a9a4d", fl: "#f7f5ed", flD: "#b8c49a", root: "#e9dfc4", rootD: "#c5b48a" };
/** A long leaf with a scalloped margin. */
function wavy(lv: Leaves, x: number, y: number, a: number, len: number, w: number, fill: string): [number, number, number?][] {
	lv.add(x, y, a, len, w, { fill, dark: HOR.rib });
	const out: [number, number, number?][] = [];
	for (let u = 0.15; u < 0.92; u += 0.11) {
		const v = 0.74 * w * Math.pow(Math.sin(Math.PI * u), 0.8);
		for (const s of [-1, 1]) {
			const [px, py] = polar(x, y, a, len * u);
			const [qx, qy] = polar(px, py, a + 90 * s, v);
			out.push([qx, qy, w * 0.22]);
		}
	}
	return out;
}
function horseradish(st: St): string {
	const lv = new Leaves();
	const pen = new Pen();
	const L = by(
		st,
		[[-110, 13, 3.2], [-72, 12, 3]],
		[[-130, 30, 5.2], [-108, 36, 6], [-84, 38, 6], [-60, 32, 5.4]],
		[[-145, 30, 5.6], [-125, 38, 6.4], [-104, 44, 6.8], [-62, 40, 6.6], [-40, 32, 5.8]],
	);
	const sc: [number, number, number?][] = [];
	const sc2: [number, number, number?][] = [];
	L.forEach(([a, l, w], i) => {
		const pts = wavy(lv, 40, 86, a!, l!, w!, i % 2 ? HOR.leaf : HOR.light);
		(i % 2 ? sc : sc2).push(...pts);
	});
	const leaves = lv.toString() + dots(sc, HOR.leaf) + dots(sc2, HOR.light);
	if (st === "sprout") return leaves;
	const crown = P(ellD(40, 85.6, by(st, 3, 4, 6), by(st, 2, 2.2, 2.8)), HOR.root) + `<path d="M37 86.6Q40 87.4 43 86.6" stroke="${HOR.rootD}" stroke-width=".7" fill="none"/>`;
	if (st === "leafy") return leaves + crown;
	pen.q(HOR.stalk, 1.6, 41, 86, 46, 50, 50, 12).q(HOR.stalk, 1, 47, 48, 56, 36, 62, 26).q(HOR.stalk, 1, 49, 30, 42, 22, 38, 14).q(HOR.stalk, 1, 48, 38, 56, 28, 64, 16);
	const fl: [number, number][] = [];
	const spray = (x0: number, y0: number, x1: number, y1: number) => {
		for (let t = 0; t <= 1.001; t += 0.2) {
			const x = x0 + (x1 - x0) * t;
			const y = y0 + (y1 - y0) * t;
			fl.push([x - 1.6, y], [x + 1.6, y + 0.5]);
		}
	};
	spray(50, 20, 50, 10);
	spray(58, 32, 62, 25);
	spray(41, 19, 38, 13);
	spray(59, 24, 64, 15);
	return pen.toString() + leaves + dots(fl, HOR.flD, 1.5) + dots(fl, HOR.fl, 1.05) + crown;
}

// ───────────────────────────────── 14. Daikon
const DAI = { root: "#f3f1ea", shade: "#d9d5c8", top: "#b4d287", leaf: "#5ba04b", light: "#78b863", rib: "#3c7a32" };
function daikonRoot(top: number, hw: number): string {
	const neck = top + hw * 0.9;
	return (
		P(`M${f(40 - hw)} 88L${f(40 - hw)} ${f(neck)}Q${f(40 - hw)} ${f(top)} 40 ${f(top)}Q${f(40 + hw)} ${f(top)} ${f(40 + hw)} ${f(neck)}L${f(40 + hw)} 88Z`, DAI.root) +
		P(`M${f(40 + hw * 0.45)} 88L${f(40 + hw * 0.45)} ${f(neck + 2)}L${f(40 + hw)} ${f(neck + 2)}L${f(40 + hw)} 88Z`, DAI.shade) +
		P(`M${f(40 - hw)} ${f(neck + 3)}L${f(40 - hw)} ${f(neck)}Q${f(40 - hw)} ${f(top)} 40 ${f(top)}Q${f(40 + hw)} ${f(top)} ${f(40 + hw)} ${f(neck)}L${f(40 + hw)} ${f(neck + 3)}Q40 ${f(neck + 1.5)} ${f(40 - hw)} ${f(neck + 3)}Z`, DAI.top)
	);
}
function daikon(st: St): string {
	const lv = new Leaves();
	const pen = new Pen();
	if (st === "sprout") {
		pen.seg(DAI.rib, 1.4, 40, 84, 40, 76);
		lv.add(40, 77, -150, 7.5, 4, { fill: DAI.light, shape: 4, rib: false }).add(40, 77, -30, 7.5, 4, { fill: DAI.light, shape: 4, rib: false });
		return pen.toString() + lv.toString() + daikonRoot(83, 2.2);
	}
	const big = st === "bloom";
	const y0 = big ? 58 : 75;
	const L = big ? [[-155, 28], [-128, 34], [-104, 38], [-78, 38], [-52, 34], [-25, 28]] : [[-140, 24], [-110, 30], [-75, 30], [-42, 24]];
	L.forEach(([a, l], i) => {
		const ts = big ? [0.22, 0.38, 0.54, 0.7] : [0.3, 0.5, 0.7];
		compound(lv, pen, 40, y0, a!, l! * 0.85, big ? 6.6 : 5.6, 0.42, ts, { fill: i % 2 ? DAI.leaf : DAI.light, dark: DAI.rib, shape: 1 }, DAI.rib, 1.3, 64);
	});
	return pen.toString() + lv.toString() + (big ? daikonRoot(56, 6) : daikonRoot(73, 4));
}

// ───────────────────────────────── 15. Jicama
const JIC = { cane: "#b99b6b", vine: "#5b8a3c", leaf: "#5c9b46", light: "#78b660", rib: "#3a6e30", fl: "#8f8ada", flD: "#5f59b3", root: "#d9b886", rootD: "#a98552", rootL: "#ecd3a8" };
function trifol(lv: Leaves, x: number, y: number, a: number, s: number, i: number): void {
	const fill = i % 2 ? JIC.leaf : JIC.light;
	lv.add(x, y, a - 62, s * 0.85, s * 0.5, { fill, dark: JIC.rib, shape: 1 }).add(x, y, a + 62, s * 0.85, s * 0.5, { fill, dark: JIC.rib, shape: 1 }).add(x, y, a, s, s * 0.6, { fill, dark: JIC.rib, shape: 1 });
}
function jicama(st: St): string {
	const lv = new Leaves();
	const pen = new Pen();
	if (st === "sprout") {
		pen.q(JIC.vine, 1.4, 40, 87, 38, 80, 41, 72);
		trifol(lv, 41, 73, -90, 6.5, 0);
		lv.add(40, 83, -150, 5, 2.6, { fill: JIC.leaf, rib: false, shape: 2 }).add(40, 83, -30, 5, 2.6, { fill: JIC.leaf, rib: false, shape: 2 });
		return pen.toString() + lv.toString();
	}
	const top = st === "leafy" ? 40 : 10;
	pen.seg(JIC.cane, 1.8, 26, 88, 48, top).seg(JIC.cane, 1.8, 54, 88, 32, top);
	const wind = (x0: number, x1: number, y1: number, phase: number) => {
		let d = `M40 87`;
		const n = 8;
		const pts: [number, number][] = [];
		for (let i = 1; i <= n; i++) {
			const t = i / n;
			const y = 87 + (y1 - 87) * t;
			const x = x0 + (x1 - x0) * t + ((i + phase) % 2 ? 2.4 : -2.4);
			d += `L${f(x)} ${f(y)}`;
			pts.push([x, y]);
		}
		pen.add(JIC.vine, 1.2, d);
		return pts;
	};
	const p1 = wind(28, 46, top + 4, 0);
	const p2 = wind(52, 34, top + 4, 1);
	const s = st === "leafy" ? 7 : 8.5;
	[...p1, ...p2].forEach(([x, y], i) => {
		if (i % 8 === 0 || (st === "bloom" && i % 3 === 1)) return;
		const side = x < 40 ? -1 : 1;
		const a = side < 0 ? -150 + (i % 3) * 18 : -30 - (i % 3) * 18;
		const [lx, ly] = polar(x, y, a, 4);
		pen.seg(JIC.vine, 0.8, x, y, lx, ly);
		trifol(lv, lx, ly, a, s, i);
	});
	if (st === "leafy") return pen.toString() + lv.toString() + P("M34 86Q40 79 46 86Z", JIC.root);
	const fl: [number, number][] = [];
	const rac = (x: number, y: number, dx: number) => {
		pen.seg(JIC.vine, 0.8, x, y, x + dx * 5, y - 8);
		for (let k = 0; k < 4; k++) fl.push([x + dx * (1.5 + k * 1.2), y - 2 - k * 2]);
	};
	rac(22, 46, -1);
	rac(58, 40, 1);
	rac(40, 22, -0.6);
	rac(30, 32, -1);
	rac(50, 28, 1);
	return (
		pen.toString() +
		lv.toString() +
		dots(fl.map(([x, y]) => [x + 0.5, y + 0.6]), JIC.flD, 1.6) +
		dots(fl, JIC.fl, 1.4) +
		P("M29.5 85.5Q31 76 40 75.5Q49 76 50.5 85.5Q46 88.4 40 88.4Q34 88.4 29.5 85.5Z", JIC.root) +
		`<path d="M33 81Q36 82.5 38 80.6M43 83.6Q46 84.6 48 82.6M40 75.5V73" stroke="${JIC.rootD}" stroke-width=".8" fill="none"/>` +
		ell(35, 79.6, 2.6, 1.3, JIC.rootL, -25)
	);
}

// ───────────────────────────────── 16. Salsify
const SAL = { leaf: "#7aa76a", light: "#94bd85", stem: "#6b9a5a", fl: "#8d5dab", flC: "#5a3678", bract: "#6a9a55", seed: "#efede4", seedD: "#a9a48f" };
function grass(x0: number, tx: number, ty: number, fill: string, w = 1.3): string {
	const my = (87 + ty) / 2;
	return `M${f(x0 - w)} 87Q${f(x0 + (tx - x0) * 0.2 - 0.5)} ${f(my)} ${f(tx)} ${f(ty)}Q${f(x0 + (tx - x0) * 0.2 + 2)} ${f(my)} ${f(x0 + w)} 87Z`;
}
function salsify(st: St): string {
	const g1 = by(st, [[39, 32, 72], [41, 46, 74]], [[38, 22, 52], [39, 30, 44], [41, 46, 42], [42, 56, 52], [40, 38, 56]], [[37, 16, 58], [38, 24, 48], [41, 50, 46], [43, 62, 56], [39, 32, 60], [42, 46, 62]]);
	let a = "";
	let b = "";
	g1.forEach(([x, tx, ty], i) => (i % 2 ? (a += grass(x!, tx!, ty!, "", st === "sprout" ? 1 : 1.5)) : (b += grass(x!, tx!, ty!, "", st === "sprout" ? 1 : 1.5))));
	const leaves = P(a, SAL.leaf) + P(b, SAL.light);
	if (st !== "bloom") {
		if (st === "sprout") return leaves;
		return leaves + `<path d="M40 86Q39 66 36 48" stroke="${SAL.stem}" stroke-width="1.3" fill="none"/>` + P(ellD(36, 46, 1.8, 3.2), SAL.bract) + dots([[36, 43]], SAL.fl, 0.9);
	}
	const pen = new Pen();
	pen.q(SAL.stem, 1.5, 39, 86, 34, 60, 26, 36).q(SAL.stem, 1.5, 41, 86, 46, 50, 52, 22).q(SAL.stem, 1.2, 40, 86, 40, 66, 38, 52);
	let clock = "";
	let tips: [number, number][] = [];
	for (let i = 0; i < 26; i++) {
		const ang = -90 + i * (360 / 26);
		const [x, y] = polar(52, 17, ang, 10.5);
		clock += `M52 17L${f(x)} ${f(y)}`;
		tips.push([x, y]);
	}
	tips = tips.filter(([, y]) => y < 26.8);
	return (
		pen.toString() +
		leaves +
		rays(26, 34, 8, 2, 9.5, 1.3, SAL.bract, 22) +
		rays(26, 34, 14, 1.5, 6.2, 2, SAL.fl) +
		`<circle cx="26" cy="34" r="1.8" fill="${SAL.flC}"/>` +
		`<path d="${clock}" stroke="${SAL.seedD}" stroke-width=".6" fill="none"/>` +
		dots(tips, SAL.seedD, 1.5) +
		dots(tips, SAL.seed, 1.05) +
		`<circle cx="52" cy="17" r="1.6" fill="${SAL.bract}"/>` +
		P(ellD(38, 50, 1.8, 3.4), SAL.bract) +
		dots([[38, 47]], SAL.fl, 0.9)
	);
}

// ───────────────────────────────── 17. Burdock
const BUR = { leaf: "#5a8f45", light: "#76a85e", under: "#a3bf8a", vein: "#355f2a", stem: "#8a4a42", burr: "#6c8a3a", hook: "#a8bf72", tuft: "#b0508f" };
function burdock(st: St): string {
	const lv = new Leaves();
	const pen = new Pen();
	const L = by(
		st,
		[[-140, 10], [-40, 11]],
		[[-160, 22], [-122, 25], [-58, 26], [-20, 22], [-90, 22]],
		[[-170, 23], [-140, 26], [-40, 26], [-10, 23], [-112, 22], [-70, 22]],
	);
	const y0 = 86;
	L.forEach(([a, l], i) => {
		const [sx, sy] = polar(40, y0, a!, l! * 0.25);
		pen.seg(BUR.stem, 1.4, 40, y0, sx, sy);
		lv.shape(sx, sy, a!, l!, l! * 0.62, HEART, i % 2 ? BUR.leaf : BUR.light);
		const [tx, ty] = polar(sx, sy, a!, l! * 0.85);
		pen.seg(BUR.vein, 0.7, sx, sy, tx, ty);
		for (const t of [0.3, 0.55]) {
			const [mx, my] = polar(sx, sy, a!, l! * t);
			for (const s of [-1, 1]) {
				const [ex, ey] = polar(mx, my, a! + s * 55, l! * 0.28);
				pen.seg(BUR.vein, 0.5, mx, my, ex, ey);
			}
		}
	});
	if (st !== "bloom") return lv.toString() + pen.toString();
	const stalk = new Pen();
	stalk.q(BUR.stem, 2.2, 40, 86, 40, 50, 40, 22).q(BUR.stem, 1.4, 40, 50, 32, 40, 24, 28).q(BUR.stem, 1.4, 40, 44, 50, 36, 56, 24).q(BUR.stem, 1.1, 40, 30, 34, 22, 31, 14).q(BUR.stem, 1.1, 40, 32, 46, 24, 49, 13);
	const burrs: [number, number][] = [[40, 19], [24, 25], [56, 21], [31, 11], [49, 10], [19, 33], [61, 31]];
	stalk.q(BUR.stem, 1, 30, 36, 24, 34, 19, 33).q(BUR.stem, 1, 50, 36, 56, 34, 61, 31);
	const hooks: [number, number][] = [];
	burrs.forEach(([x, y]) => {
		for (let k = 0; k < 9; k++) hooks.push(polar(x, y, 40 + k * 22.5, 3.6));
	});
	const tuft = burrs.flatMap(([x, y]) => [[x - 1.2, y - 3.2], [x, y - 3.8], [x + 1.2, y - 3.2]] as [number, number][]);
	return (
		stalk.toString() +
		lv.toString() +
		pen.toString() +
		dots(burrs.map(([x, y]) => [x, y + 0.4, 3.4]), BUR.burr) +
		dots(hooks, BUR.hook, 0.65) +
		dots(tuft, BUR.tuft, 1.2)
	);
}

// ───────────────────────────────── 18. Shallot
const SHA = { a: "#6c9c86", b: "#88b59f", bulb: "#b97a58", bulbL: "#d9a083", bulbD: "#8a4f38", tint: "#a7647a" };
function drop(x: number, y: number, s: number): string {
	return `M${f(x)} ${f(y - 8 * s)}C${f(x + 2 * s)} ${f(y - 5 * s)} ${f(x + 5 * s)} ${f(y - 2 * s)} ${f(x + 5 * s)} ${f(y + 1.5 * s)}C${f(x + 5 * s)} ${f(y + 4.6 * s)} ${f(x + 2.6 * s)} ${f(y + 5 * s)} ${f(x)} ${f(y + 5 * s)}C${f(x - 2.6 * s)} ${f(y + 5 * s)} ${f(x - 5 * s)} ${f(y + 4.6 * s)} ${f(x - 5 * s)} ${f(y + 1.5 * s)}C${f(x - 5 * s)} ${f(y - 2 * s)} ${f(x - 2 * s)} ${f(y - 5 * s)} ${f(x)} ${f(y - 8 * s)}Z`;
}
function shallot(st: St): string {
	const pen = new Pen();
	const tubes = (x: number, y: number, list: [number, number, number][], w: number) =>
		list.forEach(([tx, ty, bend], i) => pen.q(i % 2 ? SHA.a : SHA.b, w, x, y, x + (tx - x) * 0.2 + bend, (y + ty) / 2, tx, ty));
	if (st === "sprout") {
		tubes(40, 86, [[37, 70, -1], [43, 72, 1], [40, 68, 0]], 1.8);
		return pen.toString() + P(drop(40, 85.4, 0.45), SHA.bulb);
	}
	if (st === "leafy") {
		tubes(36, 82, [[24, 48, -2], [32, 42, -1], [38, 52, 0]], 2.4);
		tubes(44, 82, [[42, 40, 0], [50, 46, 1], [58, 54, 2]], 2.4);
		return pen.toString() + P(drop(36, 84.5, 0.6) + drop(44, 84.5, 0.6), SHA.bulb);
	}
	const bulbs: [number, number, number][] = [[29, 81, 0.9], [51, 81, 0.9], [40, 79, 1.05], [34.5, 84.2, 0.75], [45.5, 84.2, 0.75]];
	tubes(29, 74, [[12, 34, -3], [20, 28, -2], [24, 44, -1]], 2.6);
	tubes(51, 74, [[60, 28, 2], [68, 36, 3], [56, 42, 1]], 2.6);
	tubes(40, 71, [[32, 20, -1], [40, 14, 0], [47, 22, 1], [36, 36, 0], [44, 32, 0]], 2.8);
	let d = "";
	let hl = "";
	let lines = "";
	bulbs.forEach(([x, y, s]) => {
		d += drop(x, y, s);
		hl += ellD(x - 2.2 * s, y + 0.4 * s, 0.9 * s, 2.2 * s);
		lines += `M${f(x + 1.2 * s)} ${f(y - 5 * s)}Q${f(x + 3.6 * s)} ${f(y)} ${f(x + 1.8 * s)} ${f(y + 4.6 * s)}`;
	});
	return pen.toString() + P(d, SHA.bulb) + P(hl, SHA.bulbL) + `<path d="${lines}" stroke="${SHA.bulbD}" stroke-width=".7" fill="none"/>`;
}

// ───────────────────────────────── 19. Wasabi
const WAS = { leaf: "#4f9a52", light: "#6cb36a", vein: "#2d6634", pet: "#86b56e", rhz: "#9fc47e", rhzD: "#6c9752", fl: "#f7f6ef", flD: "#a9c48f" };
function wasabi(st: St): string {
	const lv = new Leaves();
	const pen = new Pen();
	const veins = new Pen();
	const top = by(st, 86, 82, 70);
	const L = by(
		st,
		[[-125, 12, 6], [-60, 13, 6.5]],
		[[-150, 22, 9], [-118, 28, 10], [-88, 32, 10], [-58, 28, 10], [-28, 22, 9]],
		[[-158, 28, 11], [-132, 38, 12], [-108, 44, 12.5], [-80, 46, 12.5], [-54, 40, 12], [-26, 30, 11]],
	);
	L.forEach(([a, l, s], i) => {
		const [x, y] = polar(40, top, a!, l!);
		pen.q(WAS.pet, st === "sprout" ? 1.1 : 1.4, 40, top, (40 + x) / 2, (top + y) / 2 + 3, x, y);
		const la = a! * 0.6 - 36;
		lv.shape(x, y, la, s!, s! * 0.62, KIDNEY, i % 2 ? WAS.leaf : WAS.light);
		for (const k of [-55, -20, 20, 55]) {
			const [ex, ey] = polar(x, y, la + k, s! * 0.7);
			veins.seg(WAS.vein, 0.6, x, y, ex, ey);
		}
	});
	if (st === "sprout") return pen.toString() + lv.toString() + veins.toString();
	const rhz = st === "leafy" ? P("M36.5 88V83Q40 80.5 43.5 83V88Z", WAS.rhz) : P("M34.5 88V74Q34.5 70 40 69.5Q45.5 70 45.5 74V88Z", WAS.rhz) + `<path d="M35 76Q40 78 45 76M35 80.5Q40 82.5 45 80.5M35 85Q40 87 45 85" stroke="${WAS.rhzD}" stroke-width=".9" fill="none"/>`;
	if (st === "leafy") return pen.toString() + lv.toString() + veins.toString() + rhz;
	const fs = new Pen();
	fs.q(WAS.pet, 1, 40, 70, 30, 60, 24, 50).q(WAS.pet, 1, 40, 70, 52, 62, 58, 54);
	const fl: [number, number][] = [[24, 49], [21, 51.5], [26.5, 46.6], [22.5, 46.6], [58, 53], [61, 55], [56, 50.4], [60.5, 50.6]];
	return pen.toString() + lv.toString() + veins.toString() + fs.toString() + dots(fl, WAS.flD, 1.8) + dots(fl, WAS.fl, 1.4) + rhz;
}

// ───────────────────────────────── 20. Yacon
const YAC = { stem: "#7a4e5e", leaf: "#4f8f43", light: "#6aa858", rib: "#2f5f28", fl: "#f2a23a", flC: "#b8661c", tub: "#bb8766", tubL: "#d4a888", tubD: "#8e5f45" };
function yacon(st: St): string {
	const lv = new Leaves();
	const pen = new Pen();
	const stemPairs = (x0: number, x1: number, top: number, n: number, l: number) => {
		pen.q(YAC.stem, 2.2, x0, 87, x0, (87 + top) / 2, x1, top);
		for (let i = 0; i < n; i++) {
			const t = 0.25 + (0.7 * i) / Math.max(1, n - 1);
			const y = 87 + (top - 87) * t;
			const x = x0 + (x1 - x0) * t * t;
			const ll = l * (1 - t * 0.4);
			const spread = i % 2 ? 40 : 62;
			lv.shape(x, y, -90 - spread - 10, ll, ll * 0.55, DELTA, YAC.leaf).shape(x, y, -90 + spread + 10, ll, ll * 0.55, DELTA, YAC.light).rib(x, y, -100 - spread, ll * 0.8, YAC.rib).rib(x, y, -80 + spread, ll * 0.8, YAC.rib);
		}
	};
	if (st === "sprout") {
		stemPairs(40, 40, 72, 2, 9);
		return pen.toString() + lv.toString();
	}
	if (st === "leafy") {
		stemPairs(40, 40, 42, 4, 17);
		return pen.toString() + lv.toString();
	}
	stemPairs(37, 32, 24, 5, 19);
	stemPairs(43, 50, 30, 4, 18);
	pen.q(YAC.stem, 1, 32, 24, 30, 18, 26, 14).q(YAC.stem, 1, 32, 24, 36, 18, 40, 16).q(YAC.stem, 1, 50, 30, 54, 24, 57, 20);
	return (
		pen.toString() +
		lv.toString() +
		daisy(26, 13, 3.8, 9, YAC.fl, YAC.flC) +
		daisy(40, 15, 3.6, 9, YAC.fl, YAC.flC, 15) +
		daisy(57, 19, 3.8, 9, YAC.fl, YAC.flC, 8) +
		P(ellD(29, 85.6, 6.4, 2.8) + ellD(51, 85.8, 5.6, 2.6), YAC.tub) +
		ell(41, 86.8, 4.6, 2, YAC.tubD, 6) +
		P(ellD(27.5, 84.6, 3, 0.9) + ellD(50, 84.8, 2.6, 0.8), YAC.tubL)
	);
}

// ───────────────────────────────── 21. Oca
const OCA = { stem: "#a54b4b", leaf: "#6bab55", light: "#86c06e", fl: "#f0c63a", flC: "#c88618", tub: "#d8486b", tubL: "#f08ca2", tubD: "#9e2c49" };
function oxalis(lv: Leaves, x: number, y: number, s: number, i: number): void {
	const fill = i % 2 ? OCA.leaf : OCA.light;
	for (const a of [-90, 25, 155]) lv.shape(x, y, a + (i % 3) * 8, s, s * 0.62, OBCORD, fill);
}
function oca(st: St): string {
	const lv = new Leaves();
	const pen = new Pen();
	const L = by(
		st,
		[[36, 76, 4.5], [44, 74, 5]],
		[[24, 64, 6], [32, 56, 6.4], [42, 54, 6.6], [52, 58, 6.4], [58, 68, 6], [38, 66, 5.6], [47, 66, 5.6]],
		[[14, 66, 6.4], [20, 56, 6.8], [28, 48, 7], [38, 44, 7.2], [49, 46, 7], [58, 52, 6.8], [65, 62, 6.4], [30, 62, 6.4], [44, 58, 6.6], [55, 66, 6]],
	);
	L.forEach(([x, y, s], i) => {
		pen.q(OCA.stem, 1.2, 40, 86, (40 + x!) / 2 + (x! < 40 ? -2 : 2), (86 + y!) / 2, x!, y!);
		oxalis(lv, x!, y!, s!, i);
	});
	if (st !== "bloom") return pen.toString() + lv.toString();
	const fp: [number, number][] = [[24, 38], [46, 34], [60, 42]];
	let fl = "";
	fp.forEach(([x, y], i) => {
		pen.q(OCA.stem, 0.8, 40, 80, x, y + 12, x, y);
		fl += petalsD(x, y, 5, 2.1, 2.2, 1.5, i * 20);
	});
	return (
		pen.toString() +
		lv.toString() +
		P(fl, OCA.fl) +
		dots(fp, OCA.flC, 1) +
		ell(29, 85.4, 6, 2.8, OCA.tub, -14) +
		ell(51, 85.6, 5.6, 2.6, OCA.tub, 16) +
		ell(40, 87, 4.4, 2.2, OCA.tub) +
		`<path d="M26 83.6Q27.4 86 26.6 87.6M30 82.6Q31.6 85 30.8 86.8M48.6 83.6Q47.2 86 48 87.6M52.6 84.4Q51.4 86.6 52.2 88M38.6 85.2v3.4M41.6 85.2v3.4" stroke="${OCA.tubD}" stroke-width=".7" fill="none"/>` +
		ell(27, 83.8, 2.2, 0.9, OCA.tubL, -14)
	);
}
/** n ellipse petals as one path (rx along the radius). */
function petalsD(x: number, y: number, n: number, r: number, rx: number, ry: number, off = 0): string {
	let d = "";
	for (let i = 0; i < n; i++) {
		const a = off + (i * 360) / n;
		const [cx, cy] = polar(x, y, a, r);
		const [ax, ay] = polar(cx, cy, a, -rx);
		const [bx, by2] = polar(cx, cy, a, rx);
		const [nx, ny] = polar(0, 0, a + 90, ry * 1.33);
		d += `M${f(ax)} ${f(ay)}C${f(ax + nx)} ${f(ay + ny)} ${f(bx + nx)} ${f(by2 + ny)} ${f(bx)} ${f(by2)}C${f(bx - nx)} ${f(by2 - ny)} ${f(ax - nx)} ${f(ay - ny)} ${f(ax)} ${f(ay)}Z`;
	}
	return d;
}

// ───────────────────────────────── 22. Arrowroot
const ARR = { stem: "#5d9450", leaf: "#5a9e50", light: "#78b56a", rib: "#36682f", rhz: "#efe7d4", rhzD: "#bfb08c", fl: "#fbfaf4", calyx: "#9cc48a" };
function arrowroot(st: St): string {
	const lv = new Leaves();
	const pen = new Pen();
	const leafOn = (x: number, y: number, a: number, l: number, i: number) => {
		const [px, py] = polar(x, y, a, 3);
		pen.seg(ARR.stem, 1, x, y, px, py);
		lv.add(px, py, a, l, l * 0.4, { fill: i % 2 ? ARR.leaf : ARR.light, dark: ARR.rib, shape: 1 });
	};
	if (st === "sprout") {
		pen.seg(ARR.stem, 1.4, 40, 87, 40, 72);
		leafOn(40, 80, -145, 9, 0);
		leafOn(40, 73, -40, 9, 1);
		return pen.toString() + lv.toString();
	}
	if (st === "leafy") {
		pen.q(ARR.stem, 1.6, 40, 87, 38, 66, 36, 46).q(ARR.stem, 1.3, 41, 87, 46, 70, 50, 58);
		leafOn(39.6, 80, -160, 13, 0);
		leafOn(39, 70, -30, 14, 1);
		leafOn(37.6, 60, -150, 14, 0);
		leafOn(37, 51, -60, 13, 1);
		leafOn(36, 46, -110, 11, 0);
		leafOn(47, 66, -20, 12, 1);
		leafOn(50, 58, -70, 11, 0);
		return pen.toString() + lv.toString();
	}
	pen.add(ARR.stem, 1.6, "M40 87Q38 68 36 52L30 38L28 20M36 52L44 40L48 24M40 87Q44 74 50 64L58 52L60 40");
	pen.add(ARR.stem, 0.8, "M28 20L24 12M28 20L32 13M48 24L46 15M48 24L53 17M60 40L64 33");
	leafOn(39, 76, -160, 14, 0);
	leafOn(38, 64, -25, 15, 1);
	leafOn(36, 52, -155, 15, 0);
	leafOn(31, 40, -165, 13, 1);
	leafOn(30, 38, -60, 12, 0);
	leafOn(44, 40, -10, 13, 1);
	leafOn(46, 32, -150, 11, 0);
	leafOn(50, 64, -10, 14, 0);
	leafOn(58, 52, -150, 12, 1);
	leafOn(58, 52, -20, 12, 0);
	leafOn(29, 28, -150, 10, 1);
	leafOn(48, 26, -20, 10, 0);
	const fl: [number, number][] = [[24, 12], [32, 13], [46, 15], [53, 17], [64, 33], [25.6, 9.6], [30.4, 10.4], [47.4, 12.4], [65.2, 30.6]];
	return (
		pen.toString() +
		lv.toString() +
		dots(fl, ARR.calyx, 1.9) +
		dots(fl, ARR.fl, 1.4) +
		P("M20 85.6Q24 82.6 34 83Q44 83.6 52 85.6Q44 88 34 88Q24 88 20 85.6Z", ARR.rhz) +
		`<path d="M26 83.4Q27 85.6 26 87.6M32 83Q33 85.6 32 87.8M38 83.2Q39 85.6 38 88M44 84Q45 86 44 87.8" stroke="${ARR.rhzD}" stroke-width=".7" fill="none"/>`
	);
}

// ───────────────────────────────── 23. Crosne
const CRO = { stem: "#5d8a48", leaf: "#5f9a4a", light: "#7cb366", rib: "#3a6a2e", fl: "#d488b8", flD: "#a75a8e", tub: "#f2eadb", tubD: "#c2b28f" };
function crosne(st: St): string {
	const lv = new Leaves();
	const pen = new Pen();
	const leafs: [number, number, number, number][] = [];
	const stalk = (x0: number, x1: number, top: number, n: number, l: number) => {
		pen.q(CRO.stem, 1.6, x0, 87, x0, (87 + top) / 2, x1, top);
		for (let i = 0; i < n; i++) {
			const t = 0.22 + (0.62 * i) / Math.max(1, n - 1);
			const y = 87 + (top - 87) * t;
			const x = x0 + (x1 - x0) * t * t;
			leafs.push([x, y, -90 - (i % 2 ? 50 : 70), l * (1 - t * 0.4)], [x, y, -90 + (i % 2 ? 50 : 70), l * (1 - t * 0.4)]);
		}
	};
	if (st === "sprout") stalk(40, 40, 72, 2, 8);
	else if (st === "leafy") {
		stalk(38, 33, 44, 3, 10);
		stalk(43, 50, 50, 3, 9.5);
	} else {
		stalk(36, 25, 28, 4, 11);
		stalk(40, 42, 20, 5, 11);
		stalk(44, 57, 30, 4, 10.5);
	}
	leafs.forEach(([x, y, a, l], i) => lv.add(x, y, a, l, l * 0.42, { fill: i % 2 ? CRO.leaf : CRO.light, dark: CRO.rib, shape: 4 }));
	if (st !== "bloom") return pen.toString() + lv.toString();
	const fl: [number, number][] = [];
	for (const [x, y] of [[26, 26], [42, 18], [56, 28]] as const) {
		pen.seg(CRO.stem, 1, x, y, x + (x - 40) * 0.08, y - 13);
		for (let k = 0; k < 4; k++) {
			const yy = y - 2 - k * 3.2;
			const xx = x + (x - 40) * 0.08 * ((k + 1) / 4);
			const w = 2.6 - k * 0.4;
			fl.push([xx - w, yy], [xx + w, yy], [xx, yy - 0.6]);
		}
	}
	const beads = (x: number, y: number, dir: number) => {
		let d = "";
		let r = "";
		for (let k = 0; k < 5; k++) {
			const rr = 2.3 - Math.abs(k - 1.5) * 0.35;
			const cx = x + dir * k * 3.2;
			const cy = y - Math.sin(k * 0.9) * 0.8;
			d += ellD(cx, cy, rr * 0.85, rr);
			if (k) r += `M${f(cx - dir * 1.5)} ${f(cy - rr * 0.8)}v${f(rr * 1.6)}`;
		}
		return [d, r];
	};
	const [b1, r1] = beads(24, 85.6, 1);
	const [b2, r2] = beads(56, 86, -1);
	return pen.toString() + lv.toString() + dots(fl, CRO.flD, 1.5) + dots(fl, CRO.fl, 1.1) + P(b1! + b2!, CRO.tub) + `<path d="${r1}${r2}" stroke="${CRO.tubD}" stroke-width=".7" fill="none"/>`;
}

// ───────────────────────────────── 24. Konjac
const KON = { stalk: "#8f936d", spot: "#4b5238", spotL: "#cfcfae", leaf: "#4f8a43", light: "#69a55a", rib: "#2f5f28", spathe: "#74243a", inner: "#4a1424", edge: "#9a4058", spadix: "#7a4450", spadixL: "#9c6872", corm: "#8a6a4c" };
function mottled(x: number, y0: number, y1: number, w: number): string {
	const sp: [number, number][] = [];
	const lt: [number, number][] = [];
	for (let y = y0 - 3; y > y1 + 2; y -= 4) {
		sp.push([x - w * 0.18, y]);
		lt.push([x + w * 0.2, y - 2]);
	}
	return line(x, y0, x, y1, KON.stalk, w) + dots(sp, KON.spot, w * 0.22) + dots(lt, KON.spotL, w * 0.16);
}
const line = (x1: number, y1: number, x2: number, y2: number, c: string, w: number) => `<path d="M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}" stroke="${c}" stroke-width="${f(w)}" stroke-linecap="round"/>`;
function konjacLeaf(lv: Leaves, pen: Pen, x: number, y: number, s: number): void {
	for (const a of [-160, -90, -20]) {
		const arm = a === -90 ? 0 : 1;
		const [ex, ey] = polar(x, y, a + (arm ? (a < -90 ? 30 : -30) : 0), 12 * s);
		const [mx, my] = polar(x, y, a + (arm ? (a < -90 ? 30 : -30) : 0), 6 * s);
		pen.seg(KON.stalk, 1.2, x, y, ex, ey);
		const da = Math.atan2(ey - y, ex - x) / D;
		for (const [px, py, k] of [[mx, my, 0], [ex, ey, 1]] as const) {
			lv.add(px, py, da - 55, 6 * s, 2.4 * s, { fill: k ? KON.leaf : KON.light, dark: KON.rib, shape: 1 }).add(px, py, da + 55, 6 * s, 2.4 * s, { fill: k ? KON.light : KON.leaf, dark: KON.rib, shape: 1 });
		}
		lv.add(ex, ey, da, 7 * s, 2.6 * s, { fill: KON.leaf, dark: KON.rib, shape: 1 });
	}
}
function konjac(st: St): string {
	const lv = new Leaves();
	const pen = new Pen();
	if (st === "sprout") {
		konjacLeaf(lv, pen, 40, 74, 0.55);
		return mottled(40, 87, 74, 2.4) + pen.toString() + lv.toString();
	}
	if (st === "leafy") {
		konjacLeaf(lv, pen, 40, 46, 1.25);
		return mottled(40, 87, 46, 3.4) + pen.toString() + lv.toString();
	}
	return (
		mottled(40, 87, 72, 4.4) +
		P("M14 52C16 40 28 36 40 36C52 36 64 40 66 52Q60 47 54 50Q48 45 40 48Q32 45 26 50Q20 47 14 52Z", KON.inner) +
		P("M40 80C30 78 21 67 14 52Q20 57 26 54Q32 60 40 57Q48 60 54 54Q60 57 66 52C59 67 50 78 40 80Z", KON.spathe) +
		dots([[30, 66], [47, 70], [36, 73], [52, 62], [25, 60]], KON.edge, 1.1) +
		P("M14 52Q20 57 26 54Q32 60 40 57Q48 60 54 54Q60 57 66 52Q60 59.4 54 56.6Q48 62 40 59.4Q32 62 26 56.6Q20 59.4 14 52Z", KON.edge) +
		P("M36 58C35.6 38 37.2 18 40 5C42.8 18 44.4 38 44 58Z", KON.spadix) +
		P("M37.6 50C37.6 36 38.4 22 39.6 12C39.4 24 39.4 38 39.6 50Z", KON.spadixL) +
		P(ellD(40, 86, 9, 2.8), KON.corm)
	);
}

// ───────────────────────────────── 25. Galangal
const GAL = { cane: "#4c8443", leaf: "#4a974e", light: "#66ad62", rib: "#2c5e2e", rhz: "#cf8573", rhzL: "#e3a898", rhzD: "#97503f", fl: "#f4f1e4", streak: "#c4463a" };
function galangal(st: St): string {
	const lv = new Leaves();
	const pen = new Pen();
	const fl: [string, string] = [GAL.leaf, GAL.light];
	if (st === "sprout") {
		cane(lv, pen, 40, 40, 70, 3, 10, 2.8, GAL.cane, fl, GAL.rib, 0);
		return pen.toString() + lv.toString() + P(ellD(40, 86, 3.6, 1.8), GAL.rhz);
	}
	if (st === "leafy") {
		cane(lv, pen, 36, 30, 40, 6, 15, 3.8, GAL.cane, fl, GAL.rib, 0, 2);
		cane(lv, pen, 41, 42, 34, 6, 15, 3.8, GAL.cane, fl, GAL.rib, 0, 2);
		cane(lv, pen, 45, 52, 46, 5, 14, 3.6, GAL.cane, fl, GAL.rib, 0, 2);
		return pen.toString() + lv.toString() + P(ellD(40, 86, 7, 2.4), GAL.rhz);
	}
	cane(lv, pen, 33, 20, 22, 7, 17, 4.2, GAL.cane, fl, GAL.rib, 0, 2.2);
	cane(lv, pen, 38, 34, 16, 8, 17, 4.2, GAL.cane, fl, GAL.rib, 0, 2.2);
	cane(lv, pen, 47, 60, 24, 7, 16, 4, GAL.cane, fl, GAL.rib, 0, 2.2);
	pen.q(GAL.cane, 2.2, 43, 87, 43, 50, 47, 14);
	const fp: [number, number][] = [[47, 12], [44, 9], [50, 9], [46.6, 6.4], [42.6, 13], [51.4, 13.2], [49, 16]];
	return (
		pen.toString() +
		lv.toString() +
		dots(fp, GAL.fl, 2) +
		dots(fp.map(([x, y]) => [x + 0.5, y + 0.6]), GAL.streak, 0.6) +
		P(ellD(31, 85.2, 8, 3) + ellD(48, 85.8, 6.6, 2.6) + ellD(24, 83.6, 3, 2.2), GAL.rhz) +
		ell(29, 83.8, 3, 0.9, GAL.rhzL) +
		`<path d="M27 82.6v4.6M32 82.4v5M37 82.8v4.4M45 83.4v4.6M50 83.4v4.6M54 84v3.2" stroke="${GAL.rhzD}" stroke-width=".7" fill="none"/>`
	);
}

export const SPECIES: Species[] = [
	{ id: "potato", name: "Potato", draw: potato },
	{ id: "sweet-potato", name: "Sweet potato", draw: sweetPotato },
	{ id: "turnip", name: "Turnip", draw: turnip },
	{ id: "parsnip", name: "Parsnip", draw: parsnip },
	{ id: "rutabaga", name: "Rutabaga", draw: rutabaga },
	{ id: "celeriac", name: "Celeriac", draw: celeriac },
	{ id: "jerusalem-artichoke", name: "Jerusalem artichoke", draw: jerusalemArtichoke },
	{ id: "cassava", name: "Cassava", draw: cassava },
	{ id: "taro", name: "Taro", draw: taro },
	{ id: "yam", name: "Yam", draw: yam },
	{ id: "ginger", name: "Ginger", draw: ginger },
	{ id: "turmeric", name: "Turmeric", draw: turmeric },
	{ id: "horseradish", name: "Horseradish", draw: horseradish },
	{ id: "daikon", name: "Daikon", draw: daikon },
	{ id: "jicama", name: "Jicama", draw: jicama },
	{ id: "salsify", name: "Salsify", draw: salsify },
	{ id: "burdock", name: "Burdock", draw: burdock },
	{ id: "shallot", name: "Shallot", draw: shallot },
	{ id: "wasabi", name: "Wasabi", draw: wasabi },
	{ id: "yacon", name: "Yacon", draw: yacon },
	{ id: "oca", name: "Oca", draw: oca },
	{ id: "arrowroot", name: "Arrowroot", draw: arrowroot },
	{ id: "crosne", name: "Crosne", draw: crosne },
	{ id: "konjac", name: "Konjac", draw: konjac },
	{ id: "galangal", name: "Galangal", draw: galangal },
];
