/**
 * Garden species, family: woodland and shade plants. Each draws sprout,
 * leafy and bloom in the kit's flat style (see kit.ts); the kit draws soil
 * and seed.
 */
import { f, leafPath, type GrowingStage, type Species } from "./kit";

/* ---------- private helpers ---------- */

const p = (d: string, fill: string): string => `<path d="${d}" fill="${fill}"/>`;

/** A stroked path with round caps and joins. */
const sp = (d: string, stroke: string, w: number): string =>
	`<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${f(w)}" stroke-linecap="round" stroke-linejoin="round"/>`;

function el(cx: number, cy: number, rx: number, ry: number, fill: string, rot = 0): string {
	const t = rot ? ` transform="rotate(${f(rot)} ${f(cx)} ${f(cy)})"` : "";
	return `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}" fill="${fill}"${t}/>`;
}

/**
 * Places a local path (absolute M/L/C/Q pairs only) at (x, y), rotated by
 * deg and scaled by k.
 */
function tf(x: number, y: number, deg: number, d: string, k = 1): string {
	const r = (deg * Math.PI) / 180;
	const c = Math.cos(r) * k;
	const s = Math.sin(r) * k;
	return d.replace(/(-?[\d.]+) (-?[\d.]+)/g, (_, a: string, b: string) => `${f(x + +a * c - +b * s)} ${f(y + +a * s + +b * c)}`);
}

/** A point at distance d from (x, y) heading deg. */
function toward(x: number, y: number, deg: number, d: number): [number, number] {
	const r = (deg * Math.PI) / 180;
	return [x + Math.cos(r) * d, y + Math.sin(r) * d];
}

/** The kit leaf outline as a subpath at (x, y) pointing deg. */
const leafSub = (x: number, y: number, deg: number, len: number, w: number, shape: 0 | 1 | 2 | 3 | 4 = 0): string => tf(x, y, deg, leafPath(len, w, shape));

/** A straight segment subpath. */
const seg = (x1: number, y1: number, x2: number, y2: number): string => `M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}`;

/** Subpath of a circle. */
function dotSub(x: number, y: number, r: number): string {
	return `M${f(x - r)} ${f(y)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0`;
}

/** Subpath of a rotated ellipse. */
function ovalSub(cx: number, cy: number, rx: number, ry: number, rot = 0): string {
	const r = (rot * Math.PI) / 180;
	const dx = Math.cos(r) * rx;
	const dy = Math.sin(r) * rx;
	const a = `A${f(rx)} ${f(ry)} ${f(rot)} 1 0`;
	return `M${f(cx + dx)} ${f(cy + dy)}${a} ${f(cx - dx)} ${f(cy - dy)}${a} ${f(cx + dx)} ${f(cy + dy)}Z`;
}

/** Subpath of a pointed lens from (x, y) heading deg. */
function lensSub(x: number, y: number, deg: number, len: number, w: number): string {
	const r = (deg * Math.PI) / 180;
	const c = Math.cos(r);
	const sn = Math.sin(r);
	const mx = x + c * len * 0.45;
	const my = y + sn * len * 0.45;
	const k = w * 1.25;
	return `M${f(x)} ${f(y)}Q${f(mx - sn * k)} ${f(my + c * k)} ${f(x + c * len)} ${f(y + sn * len)}Q${f(mx + sn * k)} ${f(my - c * k)} ${f(x)} ${f(y)}Z`;
}

/** n oval petals around (x, y), as one subpath string. */
function ringSub(x: number, y: number, n: number, r: number, rx: number, ry: number, off = 0): string {
	let d = "";
	for (let i = 0; i < n; i++) {
		const a = off + (i * 360) / n;
		const [px, py] = toward(x, y, a, r);
		d += ovalSub(px, py, rx, ry, a);
	}
	return d;
}

/** n capsule petals around (x, y) as stroke path data: draw with width 2·ry. */
function ringLine(x: number, y: number, n: number, r: number, rx: number, ry: number, off = 0): string {
	const h = Math.max(rx - ry, 0.01);
	let d = "";
	for (let i = 0; i < n; i++) {
		const a = off + (i * 360) / n;
		const [ax, ay] = toward(x, y, a, r - h);
		const [bx, by] = toward(x, y, a, r + h);
		d += seg(ax, ay, bx, by);
	}
	return d;
}

/** A point on a cubic. */
type P2 = readonly [number, number];
function cub(a: P2, b: P2, c: P2, d: P2, t: number): [number, number, number] {
	const u = 1 - t;
	const x = u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0];
	const y = u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1];
	const dx = 3 * u * u * (b[0] - a[0]) + 6 * u * t * (c[0] - b[0]) + 3 * t * t * (d[0] - c[0]);
	const dy = 3 * u * u * (b[1] - a[1]) + 6 * u * t * (c[1] - b[1]) + 3 * t * t * (d[1] - c[1]);
	return [x, y, (Math.atan2(dy, dx) * 180) / Math.PI];
}
const cd = (a: P2, b: P2, c: P2, d: P2): string => `M${f(a[0])} ${f(a[1])}C${f(b[0])} ${f(b[1])} ${f(c[0])} ${f(c[1])} ${f(d[0])} ${f(d[1])}`;

/** Merges path data per fill (or stroke) into one element each, in first-seen order. */
class Ink {
	private parts = new Map<string, string>();
	add(fill: string, d: string): this {
		this.parts.set(fill, (this.parts.get(fill) ?? "") + d);
		return this;
	}
	/** A stroke layer: key "colour|width". */
	line(stroke: string, w: number, d: string): this {
		return this.add(`${stroke}|${w}`, d);
	}
	/** A round dot of radius r, drawn as a zero-length round-capped stroke. */
	dot(fill: string, r: number, x: number, y: number): this {
		return this.line(fill, +f(r * 2), `M${f(x)} ${f(y)}h0`);
	}
	toString(): string {
		return [...this.parts]
			.map(([k, d]) => {
				const [c, w] = k.split("|");
				return w ? sp(d, c!, +w) : p(d, c!);
			})
			.join("");
	}
}

/** A lobed outline around (x, y): lobe tips at the given angles (0 = up) and radii, notches at `notch` of the radius between them; rounded or pointed. */
function lobedSub(x: number, y: number, k: number, lobes: readonly (readonly [number, number])[], notch: number, round: boolean, rot = 0): string {
	const pt = (deg: number, r: number) => toward(x, y, deg - 90 + rot, r * k);
	let d = "";
	const n = lobes.length;
	for (let i = 0; i < n; i++) {
		const [a, r] = lobes[i]!;
		const [b, rb] = lobes[(i + 1) % n]!;
		let mid = (a + (b < a ? b + 360 : b)) / 2;
		const [nx, ny] = pt(mid, Math.min(r, rb) * notch);
		if (i === 0) {
			const [pa, pr] = lobes[n - 1]!;
			mid = (pa + (a < pa ? a + 360 : a)) / 2;
			const [sx, sy] = pt(mid, Math.min(pr, r) * notch);
			d += `M${f(sx)} ${f(sy)}`;
		}
		const [tx, ty] = pt(a, round ? r * 1.22 : r);
		d += round ? `Q${f(tx)} ${f(ty)} ${f(nx)} ${f(ny)}` : `L${f(tx)} ${f(ty)}L${f(nx)} ${f(ny)}`;
	}
	return d + "Z";
}

/** A tapered arching blade from the ground at x0 to (tx, ty), bent through (cx, cy). */
function bladeSub(x0: number, cx: number, cy: number, tx: number, ty: number, w: number): string {
	return `M${f(x0 - w)} 87Q${f(cx)} ${f(cy)} ${f(tx)} ${f(ty)}Q${f(cx + w * 1.3)} ${f(cy + w * 1.6)} ${f(x0 + w)} 87Z`;
}

/** Deterministic cloud of points in an ellipse (sunflower spiral). */
function cloud(cx: number, cy: number, rx: number, ry: number, n: number): [number, number][] {
	const out: [number, number][] = [];
	for (let i = 0; i < n; i++) {
		const r = Math.sqrt((i + 0.5) / n);
		const a = i * 2.39996;
		out.push([cx + Math.cos(a) * r * rx, cy + Math.sin(a) * r * ry]);
	}
	return out;
}

/* ---------- 1. Hosta ---------- */
const HO = { leaf: "#5c9884", leaf2: "#6aa892", edge: "#e6deae", vein: "#3d6b5a", stalk: "#6c8f6e", fl: "#b7a2dc", fl2: "#9681c6" };
function hostaLeaf(x: number, y: number, a: number, len: number, w: number, fill: string): string {
	const veins = tf(x, y, a, `M1.5 0L${f(len * 0.85)} 0M1.5 0Q${f(len * 0.45)} ${f(-w * 0.62)} ${f(len * 0.9)} 0M1.5 0Q${f(len * 0.45)} ${f(w * 0.62)} ${f(len * 0.9)} 0`);
	return p(leafSub(x, y, a, len + 1.8, w + 1.3, 4), HO.edge) + p(leafSub(x, y, a, len, w, 4), fill) + sp(veins, HO.vein, 0.6);
}
function hostaMound(k: number, angles: readonly number[]): string {
	let s = "";
	const stalks = new Ink();
	angles.forEach((a, i) => {
		const [bx, by] = toward(40, 85, a, 9 * k);
		stalks.line(HO.stalk, 1.5, seg(40, 85, bx, by));
		s += hostaLeaf(bx, by, a + (a + 90) * 0.3, 17 * k, 7.8 * k, i % 2 ? HO.leaf : HO.leaf2);
	});
	return `${stalks}` + s;
}
function hosta(stage: GrowingStage): string {
	if (stage === "sprout") return hostaMound(0.6, [-125, -55, -90]);
	if (stage === "leafy") return hostaMound(1.05, [-148, -32, -122, -58, -90]);
	const sc = new Ink();
	const bells = new Ink();
	const scapes: [P2, P2, P2, P2][] = [
		[[38, 84], [37, 60], [33, 36], [30, 14]],
		[[42, 84], [44, 62], [49, 40], [53, 20]],
	];
	for (const c of scapes) {
		sc.line(HO.stalk, 1.3, cd(...c));
		for (let i = 0; i < 7; i++) {
			const t = 0.5 + i * 0.075;
			const [x, y, a] = cub(...c, t);
			const side = i % 2 ? 1 : -1;
			bells.add(i < 2 ? HO.fl : HO.fl2, tf(x, y, a + 90 + side * 55, "M0 -0.6L4.2 -1.4Q5.6 -2.2 5.8 0Q5.6 2.2 4.2 1.4L0 0.6Z", 1 - i * 0.05));
		}
	}
	return `${sc}${bells}` + hostaMound(1.12, [-150, -30, -126, -54, -102, -78]);
}

/* ---------- 2. Bleeding heart ---------- */
const BH = { leaf: "#86b38c", leaf2: "#9fc4a2", stalk: "#9c5566", heart: "#e05f81", deep: "#c4476a", tip: "#f7eef1", bud: "#9fc490" };
function bhLeaf(ink: Ink, x: number, y: number, a: number, k: number, fill: string): void {
	const [tx, ty] = toward(x, y, a, 8 * k);
	const [mx, my] = toward(x, y, a, 4.5 * k);
	ink.line(BH.stalk, 0.8, seg(x, y, tx, ty));
	ink.add(fill, lensSub(tx, ty, a - 38, 6 * k, 1.5 * k) + lensSub(tx, ty, a, 7 * k, 1.7 * k) + lensSub(tx, ty, a + 38, 6 * k, 1.5 * k) + lensSub(mx, my, a - 62, 5 * k, 1.4 * k) + lensSub(mx, my, a + 62, 5 * k, 1.4 * k));
}
const HEART = "M0 0.8C-2.6 -0.6 -5 2.2 -3.6 5.6C-2.8 7.6 -1 9 0 10.4C1 9 2.8 7.6 3.6 5.6C5 2.2 2.6 -0.6 0 0.8Z";
function bleedingHeart(stage: GrowingStage): string {
	const ink = new Ink();
	if (stage === "sprout") {
		ink.line(BH.stalk, 1.4, "M40 87L39 74M40 87L43 76");
		bhLeaf(ink, 39, 74, -110, 0.8, BH.leaf);
		bhLeaf(ink, 43, 76, -55, 0.7, BH.leaf2);
		return `${ink}`;
	}
	const big = stage === "bloom";
	const arches: [P2, P2, P2, P2][] = big
		? [
				[[41, 84], [42, 42], [64, 26], [74, 44]],
				[[39, 84], [37, 52], [20, 36], [8, 50]],
			]
		: [
				[[41, 84], [42, 56], [58, 44], [66, 54]],
				[[39, 84], [37, 62], [24, 52], [16, 60]],
			];
	const k = big ? 1.15 : 1;
	for (const [a, x, y, fill] of [[-170, 38, 82, BH.leaf], [-10, 42, 82, BH.leaf], [-135, 39, 78, BH.leaf2], [-45, 41, 78, BH.leaf2], [-100, 40, 76, BH.leaf], [-75, 40, 76, BH.leaf2]] as const) bhLeaf(ink, x, y, a, k, fill);
	let hearts = "";
	const hearts2 = new Ink();
	for (const c of arches) {
		ink.line(BH.stalk, 1.3, cd(...c));
		const n = big ? 6 : 4;
		for (let i = 0; i < n; i++) {
			const t = 0.48 + (i * 0.5) / n;
			const [x, y] = cub(...c, t);
			const sc = big ? 0.95 - i * 0.09 : 0.4 - i * 0.04;
			ink.line(BH.stalk, 0.6, seg(x, y, x, y + 2));
			if (big) {
				hearts2.add(i % 2 ? BH.heart : BH.deep, tf(x, y + 1.8, 0, HEART, sc)).add(BH.tip, ovalSub(x, y + 1.8 + 10.4 * sc, 1.1 * sc, 1.9 * sc));
			} else hearts += el(x, y + 2 + 3 * sc, 2.4 * sc + 0.6, 3.4 * sc + 0.4, i ? BH.bud : "#d98aa0");
		}
	}
	return `${ink}${hearts}${hearts2}`;
}

/* ---------- 3. Trillium ---------- */
const TR = { leaf: "#4d8b4c", leaf2: "#5e9f58", rib: "#37683a", petal: "#f6f2e6", vein: "#cfc6ae", sepal: "#7aa765", eye: "#e9c24a", stalk: "#56804a" };
function trilliumPlant(x: number, wy: number, k: number, flower: boolean): string {
	let s = sp(seg(x, 86, x, wy), TR.stalk, 1.6 * k);
	const ribs = tf(x, wy, 0, `M0 0L${f(-14 * k)} ${f(1.5 * k)}M0 0L${f(14 * k)} ${f(1.5 * k)}M0 0L0 ${f(8 * k)}`);
	s += p(leafSub(x, wy, 186, 17 * k, 6.8 * k, 1) + leafSub(x, wy, -6, 17 * k, 6.8 * k, 1), TR.leaf) + p(leafSub(x, wy, 90, 10 * k, 7.5 * k, 1), TR.leaf2) + sp(ribs, TR.rib, 0.7);
	const fy = wy - 9 * k;
	s += sp(seg(x, wy, x, fy), TR.stalk, 1.1 * k);
	if (!flower) return s + p(lensSub(x, wy - 2 * k, -90, 9 * k, 2.2 * k), TR.sepal) + p(lensSub(x, wy - 4 * k, -90, 6.5 * k, 1.1 * k), TR.petal);
	s += p(lensSub(x, fy, -30, 9 * k, 1.5 * k) + lensSub(x, fy, 90, 9 * k, 1.5 * k) + lensSub(x, fy, 210, 9 * k, 1.5 * k), TR.sepal);
	s += p(leafSub(x, fy, -90, 11 * k, 4.6 * k, 0) + leafSub(x, fy, 30, 11 * k, 4.6 * k, 0) + leafSub(x, fy, 150, 11 * k, 4.6 * k, 0), TR.petal);
	s += sp(tf(x, fy, 0, `M0 -1.5L0 -9M1.3 0.8L7.6 4.4M-1.3 0.8L-7.6 4.4`, k), TR.vein, 0.6);
	return s + p(dotSub(x, fy, 1.9 * k), TR.eye);
}
function trillium(stage: GrowingStage): string {
	if (stage === "sprout") {
		return sp("M40 87L40 72", TR.stalk, 1.6) + p(lensSub(40, 72, 120, 10, 2.6) + lensSub(40, 72, 60, 10, 2.6), TR.leaf) + p(lensSub(40, 72, 95, 8, 2.4), TR.leaf2) + p(lensSub(40, 73, -90, 5, 1.4), TR.sepal);
	}
	if (stage === "leafy") return trilliumPlant(40, 52, 1.05, false);
	return trilliumPlant(28, 64, 0.72, true) + trilliumPlant(46, 46, 1.12, true);
}

/* ---------- 4. Foamflower ---------- */
const FF = { leaf: "#68a253", leaf2: "#7cb565", vein: "#7d3f3f", stalk: "#8a8f6a", foam: "#f3f0ea", pink: "#e8b9c6", bud: "#c9cfa6" };
const MAPLE: readonly (readonly [number, number])[] = [[0, 1], [52, 0.86], [105, 0.62], [255, 0.62], [308, 0.86]];
function ffLeaf(ink: Ink, x: number, y: number, r: number, rot: number, fill: string): void {
	ink.add(fill, lobedSub(x, y, r, MAPLE, 0.55, false, rot));
	let v = "";
	for (const [a, rr] of MAPLE) {
		const [tx, ty] = toward(x, y, a - 90 + rot, r * rr * 0.62);
		v += seg(x, y, tx, ty);
	}
	ink.line(FF.vein, 1, v);
}
function ffSpike(ink: Ink, x: number, base: number, top: number, lean: number): void {
	ink.line(FF.stalk, 0.8, `M${x} ${base}Q${f(x)} ${f((base + top) / 2)} ${f(x + lean)} ${top}`);
	const h = base - top;
	const n = Math.round((h * 0.5) / 2);
	for (let i = 0; i < n; i++) {
		const y = top + i * 2;
		const pr = i / n;
		const xc = x + lean * (1 - (y - top) / h) ** 2;
		const hw = 0.5 + pr * 1.8;
		const c = i < 2 ? FF.pink : FF.foam;
		ink.dot(c, 0.95, xc - hw * (i % 2 ? 0.3 : 1), y).dot(c, 0.95, xc + hw * (i % 2 ? 1 : 0.3), y + 0.8);
	}
}
function foamflower(stage: GrowingStage): string {
	const ink = new Ink();
	if (stage === "sprout") {
		ffLeaf(ink, 34, 78, 5.5, -20, FF.leaf);
		ffLeaf(ink, 46, 77, 6, 18, FF.leaf2);
		return sp("M40 87L35 79M40 87L45 78", FF.stalk, 1) + ink;
	}
	const spikes = new Ink();
	if (stage === "bloom") {
		for (const [x, top, lean] of [[30, 38, -2], [36, 28, -1], [42, 22, 0.5], [48, 30, 1.5], [53, 40, 2]] as const) ffSpike(spikes, x, 76, top, lean);
	} else {
		spikes.line(FF.stalk, 0.8, "M38 76L37 56M44 76L45 60").add(FF.bud, dotSub(37, 56, 1.2) + dotSub(37.5, 58.5, 1.2) + dotSub(45, 60, 1.2) + dotSub(44.6, 62.5, 1.1));
	}
	const k = stage === "bloom" ? 1 : 0.95;
	for (const [x, y, r, rot, fill] of [[25, 79, 8, -35, FF.leaf], [55, 79, 8, 35, FF.leaf], [33, 73, 8.5, -15, FF.leaf2], [47, 73, 8.5, 15, FF.leaf2], [40, 79, 8.5, 0, FF.leaf]] as const) ffLeaf(ink, 40 + (x - 40) * k, y, r * k, rot, fill);
	return `${spikes}${ink}`;
}

/* ---------- 5. Coral bells ---------- */
const CB = { leaf: "#8a3456", leaf2: "#a5486b", vein: "#d495b0", stalk: "#86505c", bell: "#e85d4c", bell2: "#f39478" };
function scallopSub(x: number, y: number, r: number, n: number): string {
	let d = "";
	for (let i = 0; i <= n; i++) {
		const a = -90 + 18 + (i * (360 - 36)) / n;
		const [px, py] = toward(x, y, a, r);
		if (i === 0) d += `M${f(x)} ${f(y + r * 0.1)}L${f(px)} ${f(py)}`;
		else {
			const [cx, cy] = toward(x, y, a - 180 / n, r * 1.25);
			d += `Q${f(cx)} ${f(cy)} ${f(px)} ${f(py)}`;
		}
	}
	return d + "Z";
}
function cbLeaf(ink: Ink, x: number, y: number, r: number, fill: string): void {
	ink.add(fill, scallopSub(x, y, r, 8));
	let v = "";
	for (const a of [-90, -35, -145, 20, 200]) {
		const [tx, ty] = toward(x, y, a, r * 0.75);
		v += seg(x, y + r * 0.1, tx, ty);
	}
	ink.line(CB.vein, 0.6, v);
}
function coralBells(stage: GrowingStage): string {
	const ink = new Ink();
	if (stage === "sprout") {
		cbLeaf(ink, 35, 80, 5.5, CB.leaf);
		cbLeaf(ink, 45, 79, 6, CB.leaf2);
		return `${ink}`;
	}
	const wires = new Ink();
	const bells = new Ink();
	if (stage === "bloom") {
		const stems: [P2, P2, P2, P2][] = [
			[[36, 76], [34, 56], [30, 36], [26, 16]],
			[[40, 76], [40, 52], [42, 30], [42, 10]],
			[[44, 76], [47, 56], [52, 38], [57, 20]],
		];
		for (const c of stems) {
			wires.line(CB.stalk, 0.8, cd(...c));
			for (let i = 0; i < 6; i++) {
				const t = 0.5 + i * 0.1;
				const [x, y, a] = cub(...c, t);
				const side = i % 2 ? 1 : -1;
				const [tx, ty] = toward(x, y, a + side * 60, 3 - i * 0.25);
				wires.line(CB.stalk, 0.8, seg(x, y, tx, ty));
				bells.add(i % 2 ? CB.bell : CB.bell2, ovalSub(tx, ty + 1, 1.1, 1.6));
			}
			const [ex, ey] = cub(...c, 1);
			bells.add(CB.bell, ovalSub(ex, ey, 1, 1.5));
		}
	} else wires.line(CB.stalk, 0.8, "M39 74L37 56M42 74L44 58").add(CB.bell2, dotSub(37, 56, 1) + dotSub(44, 58, 1));
	const k = stage === "bloom" ? 1.05 : 1;
	for (const [x, y, r, fill] of [[27, 80, 7.5, CB.leaf], [53, 80, 7.5, CB.leaf], [34, 73, 8, CB.leaf2], [46, 73, 8, CB.leaf], [40, 80, 8, CB.leaf2]] as const) cbLeaf(ink, 40 + (x - 40) * k, y, r * k, fill);
	return `${wires}${bells}${ink}`;
}

/* ---------- 6. Lungwort ---------- */
const LW = { leaf: "#4c7d46", leaf2: "#5b8f52", spot: "#d4e0cb", stalk: "#6a7a52", pink: "#e183ab", blue: "#6d8ae0", violet: "#9b78cf", calyx: "#5f8550" };
const SPOTS: readonly (readonly [number, number, number])[] = [[0.25, 0.25, 0.7], [0.36, -0.35, 0.8], [0.48, 0.15, 0.9], [0.6, -0.3, 0.7], [0.7, 0.32, 0.7], [0.8, -0.05, 0.6], [0.4, 0.5, 0.6], [0.56, -0.55, 0.5]];
function lwLeaves(k: number, angles: readonly number[]): string {
	const ink = new Ink();
	const spots = new Ink();
	angles.forEach((a, i) => {
		const len = 20 * k * (1 - Math.abs(a + 90) / 400);
		const w = 4.6 * k;
		ink.add(i % 2 ? LW.leaf : LW.leaf2, leafSub(40, 86, a, len, w, 1));
		for (const [u, v, r] of SPOTS) {
			const [px, py] = toward(40, 86, a, u * len);
			const [qx, qy] = toward(px, py, a + 90, v * w);
			spots.dot(LW.spot, r > 0.75 ? 0.85 * k : 0.6 * k, qx, qy);
		}
	});
	return `${ink}${spots}`;
}
function lwCluster(ink: Ink, x: number, y: number): void {
	const fl: readonly (readonly [number, number, string])[] = [[-150, 4, LW.blue], [-30, 4, LW.pink], [-90, 3.6, LW.violet], [160, 4.2, LW.pink], [20, 4.2, LW.blue], [110, 3, LW.pink], [70, 3.4, LW.violet]];
	for (const [a, d, c] of fl) {
		const [cx, cy] = toward(x, y, a, d);
		ink.add(LW.calyx, lensSub(x, y, a, d * 0.7, 1));
		ink.add(c, dotSub(cx, cy, 1.7));
	}
}
function lungwort(stage: GrowingStage): string {
	if (stage === "sprout") return lwLeaves(0.6, [-135, -45, -100]);
	if (stage === "leafy") return lwLeaves(1.15, [-172, -8, -148, -32, -120, -60]);
	const st = new Ink();
	const fl = new Ink();
	for (const [x0, cx, x, y] of [[38, 33, 30, 46], [40, 41, 42, 40], [42, 50, 53, 48]] as const) {
		st.line(LW.stalk, 1.1, `M${x0} 84Q${cx} ${f((84 + y) / 2)} ${x} ${y}`);
		st.add(LW.leaf2, leafSub((x0 + x) / 2, (84 + y) / 2 + 4, x < 40 ? -150 : -30, 6, 2, 1));
		lwCluster(fl, x, y);
	}
	return `${st}${fl}` + lwLeaves(1.2, [-174, -6, -150, -30, -124, -56]);
}

/* ---------- 7. Solomon's seal ---------- */
const SS = { leaf: "#78a86a", leaf2: "#8ab979", rib: "#55804a", stalk: "#6c8c55", bell: "#eef0dc", tip: "#9dbf7c" };
function ssArch(ink: Ink, c: [P2, P2, P2, P2], n: number, k: number, bells: boolean, bellInk: Ink): void {
	ink.line(SS.stalk, 1.4, cd(...c));
	const dir = c[3][0] > c[0][0] ? 1 : -1;
	for (let i = 0; i < n; i++) {
		const t = 0.32 + (i * 0.66) / n;
		const [x, y, a] = cub(...c, t);
		const side = i % 2 ? 1 : -1;
		const la = a - dir * 22 * side;
		const sz = k * (1 - i * 0.04);
		ink.add(i % 2 ? SS.leaf : SS.leaf2, leafSub(x, y, la, 11 * sz, 3.4 * sz, 0));
		ink.line(SS.rib, 0.5, tf(x, y, la, `M1 0L${f(9 * sz)} 0`));
		if (bells && i < n - 1) {
			for (const dx of [-1.6, 1.4]) {
				bellInk.line(SS.stalk, 0.5, seg(x, y + 1, x + dx, y + 3.5));
				bellInk.add(SS.bell, `M${f(x + dx - 1.1)} ${f(y + 3.4)}L${f(x + dx - 1)} ${f(y + 7.4)}Q${f(x + dx)} ${f(y + 8.4)} ${f(x + dx + 1)} ${f(y + 7.4)}L${f(x + dx + 1.1)} ${f(y + 3.4)}Z`);
				bellInk.add(SS.tip, dotSub(x + dx, y + 7.6, 0.75));
			}
		}
	}
}
function solomonsSeal(stage: GrowingStage): string {
	const ink = new Ink();
	const bells = new Ink();
	if (stage === "sprout") {
		ink.line(SS.stalk, 1.6, "M40 87Q40 76 42 70");
		return `${ink}` + p(lensSub(41, 78, -100, 11, 2.2) + lensSub(41, 80, -60, 8, 2), SS.leaf) + p(lensSub(41.5, 74, -75, 6, 1.4), SS.leaf2);
	}
	if (stage === "leafy") {
		ssArch(ink, [[41, 86], [41, 56], [52, 44], [66, 48]], 6, 0.9, false, bells);
		ssArch(ink, [[39, 86], [38, 66], [28, 56], [17, 60]], 5, 0.8, false, bells);
		return `${ink}`;
	}
	ssArch(ink, [[41, 86], [40, 42], [56, 26], [74, 34]], 8, 1, true, bells);
	ssArch(ink, [[39, 86], [37, 56], [24, 40], [8, 46]], 7, 0.95, true, bells);
	return `${bells}${ink}`;
}

/* ---------- 8. Wood anemone ---------- */
const WA = { leaf: "#5e9a4f", leaf2: "#71ad5d", stalk: "#86604c", petal: "#f7f4ee", back: "#e7c2d0", eye: "#f0c93a" };
function waLeaf(ink: Ink, x: number, y: number, a: number, k: number, fill: string): void {
	for (const d of [-40, 0, 40]) ink.add(fill, lensSub(x, y, a + d, (d === 0 ? 7 : 6) * k, 1.8 * k));
}
function waFlower(x: number, y: number, k: number): string {
	return p(ringSub(x, y, 6, 3.2 * k, 2.8 * k, 1.9 * k, 30), WA.back) + p(ringSub(x, y, 6, 3 * k, 2.6 * k, 1.7 * k), WA.petal) + p(dotSub(x, y, 1.5 * k), WA.eye);
}
function woodAnemone(stage: GrowingStage): string {
	const ink = new Ink();
	const stems: readonly (readonly [number, number, number])[] =
		stage === "sprout" ? [[40, 72, 0.7]] : stage === "leafy" ? [[33, 58, 0.95], [46, 54, 1]] : [[28, 50, 1], [41, 40, 1.1], [54, 52, 1]];
	for (const [x, top, k] of stems) {
		const x0 = 40 + (x - 40) * 0.3;
		ink.line(WA.stalk, 0.9, `M${f(x0)} 86Q${f(x)} 70 ${x} ${top}`);
		const wy = top + (86 - top) * 0.38;
		waLeaf(ink, x, wy, -150, k, WA.leaf);
		waLeaf(ink, x, wy, -30, k, WA.leaf);
		waLeaf(ink, x, wy, 95, k * 0.7, WA.leaf2);
	}
	if (stage !== "sprout") for (const [x, a] of [[34, -140], [46, -40], [40, -95]] as const) waLeaf(ink, x, 86, a, 1, WA.leaf2);
	let fl = "";
	if (stage === "bloom") for (const [x, top, k] of stems) fl += waFlower(x, top, k);
	else if (stage === "leafy") for (const [x, top] of stems) fl += p(ovalSub(x, top, 2, 2.6), WA.back) + p(ovalSub(x, top - 0.6, 1.4, 1.8), WA.petal);
	return `${ink}${fl}`;
}

/* ---------- 9. Bloodroot ---------- */
const BR = { leaf: "#8eb08d", leaf2: "#a1c09f", vein: "#64886a", stalk: "#c0563d", petal: "#f8f5ec", shade: "#d9d1bc", eye: "#e8b33a" };
const BR_LOBES: readonly (readonly [number, number])[] = [[0, 1], [40, 0.95], [82, 0.85], [125, 0.7], [235, 0.7], [278, 0.85], [320, 0.95]];
function brLeaf(x: number, y: number, r: number, sx: number, fill: string): string {
	let v = "";
	for (const [a] of BR_LOBES) {
		const [tx, ty] = toward(0, 0, a - 90, r * 0.75);
		v += seg(0, r * 0.15, tx, ty);
	}
	return `<g transform="translate(${f(x)} ${f(y)}) scale(${f(sx)} 1)">${p(lobedSub(0, 0, r, BR_LOBES, 0.72, true), fill)}${sp(v, BR.vein, 0.7)}</g>`;
}
function bloodroot(stage: GrowingStage): string {
	if (stage === "sprout") return sp("M40 87L40 74", BR.stalk, 1.4) + p(ovalSub(40, 70, 1.8, 3.2), BR.petal) + brLeaf(40, 78, 6, 0.45, BR.leaf);
	if (stage === "leafy") return sp("M40 87L40 52", BR.stalk, 1.6) + p(ovalSub(40, 49, 2.6, 4.4), BR.petal) + p(ovalSub(41, 50, 1, 3), BR.shade) + sp("M37 87L36 72", BR.stalk, 1.4) + brLeaf(38, 70, 12, 0.55, BR.leaf);
	const s = sp("M42 87Q44 60 45 30", BR.stalk, 1.6) + sp("M38 87Q36 76 31 66", BR.stalk, 1.6) + sp("M41 87Q44 80 53 76", BR.stalk, 1.4);
	const fl = p(ringSub(45, 28, 9, 5.8, 4.6, 1.7, 20), BR.shade) + p(ringSub(45, 28, 9, 5.6, 4.6, 1.5), BR.petal) + p(dotSub(45, 28, 2.4), BR.eye);
	return s + brLeaf(31, 62, 14, 1, BR.leaf) + brLeaf(54, 72, 9, 0.75, BR.leaf2) + fl;
}

/* ---------- 10. Jack-in-the-pulpit ---------- */
const JP = { leaf: "#5f9a50", leaf2: "#72ad5f", rib: "#3f7038", stalk: "#6f8a58", tube: "#7da26a", stripe: "#5d2f44", hood: "#6c3450", hstripe: "#b6cf96", throat: "#2f1d24", spadix: "#8a5a40" };
function jpLeaf(x: number, y: number, k: number): string {
	const o = new Ink();
	for (const [a, l, fill] of [[195, 15, JP.leaf], [-15, 15, JP.leaf], [100, 10, JP.leaf2]] as const) {
		o.add(fill, leafSub(x, y, a, l * k, 5.2 * k, 1));
		o.line(JP.rib, 0.6, tf(x, y, a, `M0 0L${f(l * k * 0.85)} 0`));
	}
	return `${o}`;
}
function jpSpathe(x: number, y: number, k: number): string {
	return (
		p(tf(x, y, 0, "M-4.4 -12C-6 -24 -2 -31 3 -30.6C7.6 -30 9.6 -25 8 -18.4L6.6 -20C6 -15 4.4 -13 4 -12Z", k), JP.hood) +
		sp(tf(x, y, 0, "M-3.4 -15C-4.2 -24 -1 -28.6 3.4 -28.4M-1.2 -14C-1.6 -22 1.4 -26 5.4 -26M1.6 -14C1.8 -20 4 -23 6.6 -22.6", k), JP.hstripe, 0.55) +
		p(tf(x, y, 0, "M-3.2 -12.4C-3.4 -19 0.4 -22.6 3.8 -20.4C4.8 -17 4.2 -14 3.4 -12.4Z", k), JP.throat) +
		p(tf(x, y, 0, "M0 -12C-0.8 -14 -0.6 -18 0.6 -19C1.8 -18 1.8 -14 1.4 -12Z", k), JP.spadix) +
		p(tf(x, y, 0, "M-3.6 0L-4.2 -12.6Q0 -10.6 4.2 -12.6L3.6 0Z", k), JP.tube) +
		sp(tf(x, y, 0, "M-2 -1L-2.2 -11.4M0 -1L0 -11M2 -1L2.2 -11.4", k), JP.stripe, 0.7)
	);
}
function jackInThePulpit(stage: GrowingStage): string {
	if (stage === "sprout") return p("M37.6 87L38.6 70Q40 66 41.4 70L42.4 87Z", JP.tube) + sp("M39.2 85L39.6 72M40.8 85L40.6 72", JP.stripe, 0.6);
	if (stage === "leafy") return sp("M39 87L38 56M41 87L43 50", JP.stalk, 1.6) + jpLeaf(38, 56, 0.95) + jpLeaf(43, 50, 0.95);
	return sp("M37 87L32 30M44 87L50 24M40 87L40 80", JP.stalk, 1.7) + jpLeaf(32, 30, 1.1) + jpLeaf(50, 24, 1.1) + jpSpathe(40, 82, 1.45);
}

/* ---------- 11. Mayapple ---------- */
const MA = { top: "#6aa65a", hi: "#84bd6c", under: "#467d40", rib: "#4a8442", stalk: "#7d9a5a", petal: "#f4f0e2", shade: "#d3cdb4", eye: "#e2c24a" };
const UMB_UNDER = "M-1 0.12L-0.86 0.32L-0.72 0.2L-0.56 0.38L-0.38 0.22L-0.18 0.4L0 0.24L0.18 0.4L0.38 0.22L0.56 0.38L0.72 0.2L0.86 0.32L1 0.12Z";
function umbrella(x: number, y: number, r: number): string {
	return (
		p(tf(x, y, 0, UMB_UNDER, r), MA.under) +
		p(tf(x, y, 0, "M-1 0.14C-0.7 -0.34 0.7 -0.34 1 0.14Q0 0.3 -1 0.14Z", r), MA.top) +
		p(tf(x, y, 0, "M-0.55 -0.12C-0.3 -0.26 0.3 -0.26 0.55 -0.12Q0 -0.06 -0.55 -0.12Z", r), MA.hi) +
		sp(tf(x, y, 0, "M0 -0.2L-0.86 0.18M0 -0.2L-0.4 0.22M0 -0.2L0.4 0.22M0 -0.2L0.86 0.18", r), MA.rib, 0.5)
	);
}
function mayapple(stage: GrowingStage): string {
	if (stage === "sprout") return sp("M40 87L40 68", MA.stalk, 1.6) + p("M40 64Q36 70 34.6 78L36.6 76.4L37.8 78.6L39.2 76.6L40 78.8L40.8 76.6L42.2 78.6L43.4 76.4L45.4 78Q44 70 40 64Z", MA.top) + p("M40 64Q38 70 37.8 77L40 76Z", MA.hi);
	if (stage === "leafy") return sp("M40 87L40 52", MA.stalk, 1.8) + umbrella(40, 52, 17) + sp("M30 87L30 70", MA.stalk, 1.4) + umbrella(30, 70, 10);
	const s = sp("M44 87L44 58L32 42M44 58L56 38M44 58Q46 62 47 64", MA.stalk, 1.8);
	const fl = p("M43.2 64Q41 66.4 42 70.4Q47 72.4 52 70.4Q53 66.4 50.8 64Q47 62.8 43.2 64Z", MA.shade) + p("M43.6 63.4Q42.4 66.6 44 70Q47 71.4 50 70Q51.6 66.6 50.4 63.4Q47 62 43.6 63.4Z", MA.petal) + p(dotSub(47, 70.6, 1.3), MA.eye);
	return sp("M23 87L23 66", MA.stalk, 1.5) + umbrella(23, 66, 11) + s + umbrella(32, 42, 15) + umbrella(56, 38, 16) + fl;
}

/* ---------- 12. Hellebore ---------- */
const HB = { leaf: "#3e6c46", leaf2: "#4c7f53", rib: "#2c5233", stalk: "#86606a", petal: "#b8677f", petal2: "#cf8399", blotch: "#8d4762", eye: "#a7c070", anther: "#efe0a0" };
function hbLeaf(ink: Ink, x: number, y: number, a: number, k: number, fill: string): void {
	const [tx, ty] = toward(x, y, a, 9 * k);
	ink.line(HB.stalk, 1, seg(x, y, tx, ty));
	for (let i = 0; i < 7; i++) {
		const d = -72 + i * 24;
		ink.add(fill, leafSub(tx, ty, a + d, 11 * k * (1 - Math.abs(d) / 220), 2.4 * k, 1));
	}
}
function hbFace(x: number, y: number, k: number): string {
	let st = "";
	for (let i = 0; i < 8; i++) {
		const [ax, ay] = toward(x, y, i * 45, 2.6 * k);
		st += dotSub(ax, ay, 0.6 * k);
	}
	return p(ringSub(x, y, 5, 4 * k, 4.2 * k, 3.6 * k, -90), HB.petal) + p(dotSub(x, y, 3.4 * k), HB.blotch) + p(st, HB.anther) + p(dotSub(x, y, 1.4 * k), HB.eye);
}
function hbNod(x: number, y: number, k: number): string {
	return p(tf(x, y, 0, "M-6 2Q-6 -4 0 -5Q6 -4 6 2Q3 0.6 0 1.6Q-3 0.6 -6 2Z", k), HB.petal) + p(tf(x, y, 0, "M-4 1.4Q-4.6 -3.2 0 -4.2Q4.6 -3.2 4 1.4Q2 0.8 0 1.2Q-2 0.8 -4 1.4Z", k), HB.petal2) + sp(tf(x, y, 0, "M-1.6 1.4L-1.2 3.4M0 1.6L0 3.8M1.6 1.4L1.2 3.4", k), HB.anther, 0.7);
}
function hellebore(stage: GrowingStage): string {
	const ink = new Ink();
	const k = stage === "sprout" ? 0.55 : stage === "leafy" ? 1 : 1.05;
	const leaves: readonly (readonly [number, string])[] = stage === "sprout" ? [[-130, HB.leaf], [-50, HB.leaf2]] : [[-160, HB.leaf], [-20, HB.leaf], [-125, HB.leaf2], [-55, HB.leaf2]];
	for (const [a, fill] of leaves) hbLeaf(ink, 40, 86, a, k, fill);
	if (stage !== "bloom") return `${ink}`;
	const st = sp("M39 84Q34 64 28 50M40 84Q41 62 43 40M41 84Q48 66 55 52M40 84Q38 70 36 62", HB.stalk, 1.2);
	return st + ink + hbFace(28, 50, 1.05) + hbNod(55, 54, 1) + hbFace(43, 40, 1.15) + hbNod(36, 64, 0.9);
}

/* ---------- 13. Astilbe ---------- */
const AS = { leaf: "#4a7b46", leaf2: "#5d8f55", stalk: "#8a4a54", plume: "#e1709d", plume2: "#c94b7c", hi: "#f2a6c2", bud: "#b9a07a" };
function asLeaf(ink: Ink, x: number, y: number, a: number, k: number, fill: string): void {
	const [tx, ty] = toward(x, y, a, 10 * k);
	const [mx, my] = toward(x, y, a, 5.5 * k);
	ink.line(AS.stalk, 0.8, seg(x, y, tx, ty));
	ink.add(fill, leafSub(tx, ty, a, 6 * k, 2 * k, 1) + leafSub(mx, my, a - 55, 5 * k, 1.8 * k, 1) + leafSub(mx, my, a + 55, 5 * k, 1.8 * k, 1) + leafSub(tx, ty, a - 40, 4.4 * k, 1.6 * k, 1) + leafSub(tx, ty, a + 40, 4.4 * k, 1.6 * k, 1));
}
function asPlume(plume: Ink, hi: Ink, x: number, base: number, top: number, w: number, col: string): void {
	plume.line(AS.stalk, 1, seg(x, base, x, top));
	let d = "";
	let h = "";
	let i = 0;
	for (let y = top + 1; y < top + (base - top) * 0.62; y += 2.4) {
		const pr = (y - top) / ((base - top) * 0.62);
		const hw = 0.3 + pr * w;
		const o = i++ % 2 ? 0.8 : -0.8;
		d += `M${f(x - hw + o)} ${f(y + hw * 0.5)}Q${f(x)} ${f(y - 0.6)} ${f(x + hw + o)} ${f(y + hw * 0.5)}`;
		h += `M${f(x - hw * 0.5 + o)} ${f(y)}h0M${f(x + hw * 0.6 + o)} ${f(y + 0.3)}h0`;
	}
	plume.line(col, 1.9, d);
	hi.line(AS.hi, 1, h);
}
function astilbe(stage: GrowingStage): string {
	const ink = new Ink();
	const k = stage === "sprout" ? 0.65 : stage === "leafy" ? 1.15 : 1.2;
	const angles = stage === "sprout" ? [-130, -50, -95] : [-168, -12, -140, -40, -112, -68, -90];
	angles.forEach((a, i) => asLeaf(ink, 40, 86, a, k, i % 2 ? AS.leaf : AS.leaf2));
	if (stage !== "bloom") {
		if (stage === "leafy") return sp("M40 76L40 52M45 76L47 58", AS.stalk, 1) + p(ovalSub(40, 53, 1.2, 3) + ovalSub(47, 59, 1.1, 2.6), AS.bud) + ink;
		return `${ink}`;
	}
	const plume = new Ink();
	const hi = new Ink();
	asPlume(plume, hi, 31, 70, 26, 4.6, AS.plume2);
	asPlume(plume, hi, 49, 70, 24, 4.6, AS.plume2);
	asPlume(plume, hi, 40, 70, 12, 5.6, AS.plume);
	return `${plume}${hi}${ink}`;
}

/* ---------- 14. Wild ginger ---------- */
const WG = { leaf: "#3f7e46", leaf2: "#4f9552", hi: "#79b276", vein: "#2c5a33", stalk: "#7a6a4a", jug: "#7a2b35", jug2: "#9a3d46" };
const KIDNEY = "M0 0C-0.2 0.06 -0.56 0.06 -0.62 -0.24C-0.66 -0.6 -0.32 -0.8 0 -0.8C0.32 -0.8 0.66 -0.6 0.62 -0.24C0.56 0.06 0.2 0.06 0 0Z";
function wgLeaf(ink: Ink, x: number, y: number, k: number, rot: number, fill: string): void {
	ink.add(fill, tf(x, y, rot, KIDNEY, k));
	ink.add(WG.hi, tf(x, y, rot, "M-0.42 -0.5Q-0.2 -0.72 0.1 -0.7Q-0.18 -0.6 -0.42 -0.5Z", k));
	ink.line(WG.vein, 0.6, tf(x, y, rot, "M0 0L0 -0.66M0 0L-0.42 -0.46M0 0L0.42 -0.46M0 0L-0.52 -0.12M0 0L0.52 -0.12", k));
}
function wildGinger(stage: GrowingStage): string {
	const ink = new Ink();
	const leaves: readonly (readonly [number, number, number, number, string])[] =
		stage === "sprout"
			? [[35, 78, 9, -15, WG.leaf], [45, 76, 10, 12, WG.leaf2]]
			: stage === "leafy"
				? [[27, 72, 14, -18, WG.leaf], [53, 70, 15, 16, WG.leaf], [40, 64, 16, 0, WG.leaf2], [33, 80, 12, -8, WG.leaf2], [48, 80, 12, 10, WG.leaf2]]
				: [[24, 70, 15, -20, WG.leaf], [56, 68, 16, 18, WG.leaf], [40, 58, 18, 0, WG.leaf2], [31, 79, 13, -10, WG.leaf2], [50, 80, 13, 10, WG.leaf], [38, 72, 12, -4, WG.leaf]];
	let st = "";
	for (const [x, y] of leaves) st += `M40 86Q${f((40 + x) / 2)} ${f(y + 6)} ${f(x)} ${f(y)}`;
	for (const [x, y, k, rot, fill] of leaves) wgLeaf(ink, x, y, k, rot, fill);
	let jug = "";
	if (stage === "bloom") {
		jug = p("M44.4 86.6Q43 82 45.6 80Q48.4 79 50 81.4Q51.6 84.4 49.4 86.8Z", WG.jug) + p("M45.6 80.6L43.4 76.6L46.8 79.4ZM48 79.6L49 75.4L49.6 79.8ZM50 81.2L53.8 79.4L50.8 82.8Z", WG.jug2) + p(dotSub(47.4, 83, 1.1), "#3a1a20");
	}
	return sp(st, WG.stalk, 1) + jug + ink;
}

/* ---------- 15. Virginia bluebells ---------- */
const VB = { leaf: "#84ac9b", leaf2: "#97bdac", rib: "#5f8a78", stalk: "#6c8e7c", blue: "#6f9ee6", blue2: "#9dc0f2", pink: "#e59ec0" };
const TRUMPET = "M-0.7 0L-0.9 5Q-2.6 7.6 -2.7 9.4Q0 10.4 2.7 9.4Q2.6 7.6 0.9 5L0.7 0Z";
function vbStem(ink: Ink, fl: Ink, c: [P2, P2, P2, P2], n: number, k: number, bloom: boolean): void {
	ink.line(VB.stalk, 1.3, cd(...c));
	for (let i = 0; i < n; i++) {
		const [x, y, a] = cub(...c, 0.22 + i * 0.16);
		const side = i % 2 ? 1 : -1;
		ink.add(i % 2 ? VB.leaf : VB.leaf2, leafSub(x, y, a + side * 40, 11 * k * (1 - i * 0.1), 4 * k, 0));
	}
	const [ex, ey] = cub(...c, 1);
	if (!bloom) {
		fl.add(VB.pink, dotSub(ex, ey + 1.5, 1.4) + dotSub(ex - 2, ey + 2.8, 1.2) + dotSub(ex + 2, ey + 2.8, 1.2));
		return;
	}
	const tr: readonly (readonly [number, number, number, string])[] = [[-5.4, 2, 24, VB.blue], [-1.8, 3.4, 6, VB.blue2], [1.9, 3.2, -8, VB.blue], [5.4, 1.6, -26, VB.blue2]];
	for (const [dx, dy, rot, c2] of tr) {
		ink.line(VB.stalk, 0.6, seg(ex, ey, ex + dx * k, ey + dy));
		fl.add(c2, tf(ex + dx * k, ey + dy, rot, TRUMPET, k));
	}
	fl.add(VB.pink, ovalSub(ex - 1.4, ey - 1.2, 1.1, 1.6, 20) + ovalSub(ex + 1.4, ey - 1.4, 1.1, 1.6, -20));
}
function virginiaBluebells(stage: GrowingStage): string {
	const ink = new Ink();
	const fl = new Ink();
	if (stage === "sprout") {
		ink.line(VB.stalk, 1.4, "M40 87L40 72");
		ink.add(VB.leaf, leafSub(40, 76, -140, 10, 3.6) + leafSub(40, 74, -40, 10, 3.6)).add(VB.leaf2, leafSub(40, 72, -90, 7, 2.6));
		return `${ink}`;
	}
	const bloom = stage === "bloom";
	const stems: [P2, P2, P2, P2][] = bloom
		? [
				[[38, 86], [36, 62], [26, 46], [22, 36]],
				[[40, 86], [40, 56], [42, 36], [42, 22]],
				[[42, 86], [46, 64], [56, 50], [60, 40]],
			]
		: [
				[[39, 86], [37, 70], [31, 60], [30, 54]],
				[[41, 86], [44, 68], [50, 58], [52, 50]],
			];
	for (const c of stems) vbStem(ink, fl, c, bloom ? 4 : 3, bloom ? 1 : 0.95, bloom);
	return `${ink}${fl}`;
}

/* ---------- 16. Wild columbine ---------- */
const WC = { leaf: "#7a9f84", leaf2: "#8fb497", stalk: "#9a5a4a", red: "#d33a2e", red2: "#e9604a", yellow: "#f2cc4a", stamen: "#f6dc6a" };
function wcTern(ink: Ink, x: number, y: number, k: number): void {
	ink.line(WC.stalk, 0.7, seg(40, 86, x, y));
	for (const [a, fill] of [[-150, WC.leaf], [-90, WC.leaf2], [-30, WC.leaf]] as const) {
		const [cx, cy] = toward(x, y, a, 4 * k);
		ink.add(fill, lobedSub(cx, cy, 3 * k, [[-50, 1], [0, 1.1], [50, 1], [160, 0.7], [200, 0.7]], 0.6, true, a + 90));
	}
}
function wcFlower(x: number, y: number, k: number, rot: number): string {
	return (
		p(tf(x, y, rot, "M-3.6 0.4L-2.2 -6.4Q-1.6 -7.6 -1 -6.4L-0.6 -1L0.6 -1L1 -6.4Q1.6 -7.6 2.2 -6.4L3.6 0.4Z", k), WC.red) +
		p(tf(x, y, rot, "M-3.6 0L-2.4 6.2Q0 7.2 2.4 6.2L3.6 0Q0 -1 -3.6 0Z", k), WC.red) +
		p(tf(x, y, rot, "M-2.6 2.6L-4.6 6.8L-1.4 5ZM2.6 2.6L4.6 6.8L1.4 5Z", k), WC.red2) +
		p(tf(x, y, rot, "M-2.4 6.2L-2.6 8.8Q0 9.8 2.6 8.8L2.4 6.2Z", k), WC.yellow) +
		sp(tf(x, y, rot, "M-0.8 9L-0.6 12.4M0.8 9L0.6 12.4M0 9.4L0 13", k), WC.stamen, 0.7)
	);
}
function wildColumbine(stage: GrowingStage): string {
	const ink = new Ink();
	if (stage === "sprout") {
		wcTern(ink, 35, 76, 0.8);
		wcTern(ink, 45, 74, 0.85);
		return `${ink}`;
	}
	const base: readonly (readonly [number, number, number])[] = [[26, 74, 1.1], [54, 74, 1.1], [33, 66, 1.15], [47, 64, 1.15], [40, 72, 1]];
	for (const [x, y, k] of base) wcTern(ink, x, y, k);
	if (stage === "leafy") return sp("M40 84Q42 64 46 54", WC.stalk, 1) + ink + p(ovalSub(46.5, 56, 2, 3), WC.red);
	const st = sp("M40 84Q40 54 30 36Q28 32 26 34M41 84Q44 50 52 30Q54 26 56 28M40.6 70Q48 56 60 52", WC.stalk, 1.1);
	return st + ink + wcFlower(26, 36, 1.05, 20) + wcFlower(56, 30, 1.05, -18) + wcFlower(60, 54, 0.9, -6);
}

/* ---------- 17. Sweet woodruff ---------- */
const SW = { leaf: "#5aa548", leaf2: "#74ba5d", stalk: "#4f8a40", star: "#f5f3ea", shade: "#b8c0a6", eye: "#cdd47a" };
function swWhorl(ink: Ink, x: number, y: number, k: number, fill: string): void {
	let d = "";
	for (let i = 0; i < 8; i++) {
		const [tx, ty] = toward(x, y, i * 45 + 22, 6 * k);
		d += `M${f(x)} ${f(y)}L${f(tx)} ${f(y + (ty - y) * 0.42)}`;
	}
	ink.line(fill, 1.7, d);
}
function swStars(ink: Ink, x: number, y: number, n: number): void {
	for (const [px, py] of cloud(x, y, 4.2, 2.6, n)) {
		ink.line(SW.shade, 1.1, `M${f(px - 1.1)} ${f(py + 0.5)}h2.8m-1.4 -1.4v2.8`);
		ink.line(SW.star, 1.1, `M${f(px - 1.4)} ${f(py)}h2.8m-1.4 -1.4v2.8`);
		ink.dot(SW.eye, 0.4, px, py);
	}
}
function sweetWoodruff(stage: GrowingStage): string {
	const stems: readonly (readonly [number, number, number])[] =
		stage === "sprout" ? [[40, 72, 0.8]] : stage === "leafy" ? [[24, 66, 1], [34, 58, 1], [46, 56, 1], [56, 64, 1]] : [[18, 66, 1], [28, 56, 1], [40, 50, 1.05], [52, 54, 1], [62, 64, 1]];
	let st = "";
	const wh = new Ink();
	const fl = new Ink();
	stems.forEach(([x, top, k], i) => {
		const x0 = 40 + (x - 40) * 0.5;
		st += `M${f(x0)} 87Q${f(x)} 80 ${x} ${top}`;
		const n = Math.max(2, Math.floor((86 - top) / 9));
		for (let j = 0; j < n; j++) {
			const y = top + 3 + j * 8.2;
			swWhorl(wh, x + (x0 - x) * ((y - top) / (87 - top)) ** 2, y, k * (1 - j * 0.06), (i + j) % 2 ? SW.leaf : SW.leaf2);
		}
		if (stage === "bloom") swStars(fl, x, top - 2, 6);
		else if (stage === "leafy") fl.dot(SW.eye, 1, x, top - 1).dot(SW.eye, 1, x - 1.6, top).dot(SW.eye, 1, x + 1.6, top);
	});
	return sp(st, SW.stalk, 1) + wh + fl;
}

/* ---------- 18. Hepatica ---------- */
const HP = { leaf: "#5a8a50", leaf2: "#6b9c5c", mottle: "#8c4c5e", stalk: "#8a6a5c", petal: "#9b8ee0", petal2: "#b4a9ec", eye: "#f5f2ea", anther: "#e9dfb0" };
const TRILOBE = "M0 0C-3 1 -8 -1 -7 -5C-6.5 -8 -3.6 -8.4 -2.6 -7.2C-3.2 -11.4 3.2 -11.4 2.6 -7.2C3.6 -8.4 6.5 -8 7 -5C8 -1 3 1 0 0Z";
function hpLeaf(ink: Ink, x: number, y: number, k: number, rot: number, fill: string): void {
	ink.add(fill, tf(x, y, rot, TRILOBE, k));
	ink.add(HP.mottle, tf(x, y, rot, "M-1.2 -4.6Q0 -6.4 1.2 -4.6Q0 -3.4 -1.2 -4.6ZM-4.8 -3.6Q-3.6 -5 -2.6 -3.4Q-3.8 -2.6 -4.8 -3.6ZM4.8 -3.6Q3.6 -5 2.6 -3.4Q3.8 -2.6 4.8 -3.6Z", k));
}
function hpFlower(x: number, y: number, k: number, c: string): string {
	let st = "";
	for (let i = 0; i < 7; i++) {
		const [ax, ay] = toward(x, y, i * 51, 1.6 * k);
		st += `M${f(ax)} ${f(ay)}h0`;
	}
	return sp(ringLine(x, y, 7, 3 * k, 2.6 * k, 1.5 * k, -90), c, 3 * k) + p(dotSub(x, y, 1.5 * k), HP.eye) + sp(st, HP.anther, 0.9);
}
function hepatica(stage: GrowingStage): string {
	const ink = new Ink();
	const leaves: readonly (readonly [number, number, number, number, string])[] =
		stage === "sprout" ? [[35, 80, 0.75, -25, HP.leaf], [45, 79, 0.8, 22, HP.leaf2]] : [[24, 80, 1.1, -40, HP.leaf], [56, 80, 1.1, 40, HP.leaf], [33, 76, 1.2, -15, HP.leaf2], [47, 75, 1.2, 15, HP.leaf2], [40, 81, 1, 0, HP.leaf]];
	let st = "";
	for (const [x, y] of leaves) st += `M40 86L${f(x)} ${f(y)}`;
	for (const [x, y, k, rot, fill] of leaves) hpLeaf(ink, x, y, k, rot, fill);
	if (stage === "sprout") return sp(st, HP.stalk, 0.8) + ink;
	const fl: readonly (readonly [number, number, number])[] = stage === "leafy" ? [[36, 62, 0], [46, 64, 0]] : [[26, 60, 1], [36, 52, 1.1], [46, 54, 1.1], [56, 62, 1], [41, 64, 0.9]];
	let fs = "";
	let heads = "";
	fl.forEach(([x, y, k], i) => {
		fs += `M${f(40 + (x - 40) * 0.2)} 85Q${f(x)} 74 ${x} ${y}`;
		heads += k ? hpFlower(x, y, k, i % 2 ? HP.petal2 : HP.petal) : p(ovalSub(x, y, 1.6, 2.4), HP.petal);
	});
	return sp(fs, HP.stalk, 0.9) + sp(st, HP.stalk, 0.8) + ink + heads;
}

/* ---------- 19. Trout lily ---------- */
const TL = { leaf: "#7aa064", leaf2: "#86ad6e", blotch: "#7e5444", stalk: "#8a7a5a", petal: "#f2c83a", back: "#d6a42a", anther: "#8a4a2a" };
function tlLeaf(x: number, y: number, a: number, len: number, w: number, fill: string): string {
	let b = "";
	for (const [u, v, r] of [[0.22, 0.25, 1], [0.34, -0.3, 1.3], [0.48, 0.2, 1.4], [0.62, -0.25, 1.1], [0.74, 0.18, 0.9], [0.84, -0.05, 0.7]] as const) {
		const [px, py] = toward(x, y, a, u * len);
		const [qx, qy] = toward(px, py, a + 90, v * w);
		b += ovalSub(qx, qy, r * 1.4, r * 0.8, a);
	}
	return p(leafSub(x, y, a, len, w, 1), fill) + p(b, TL.blotch);
}
function tlFlower(x: number, y: number, k: number): string {
	return (
		p(tf(x, y, 0, "M0 0Q-3 4 -6.4 2.6Q-7.6 -1 -6.8 -4Q-5.4 0 -1 2ZM0 0Q3 4 6.4 2.6Q7.6 -1 6.8 -4Q5.4 0 1 2Z", k), TL.back) +
		sp(tf(x, y, 0, "M-0.8 2.6L-1.4 7.4M0.6 2.6L1.2 7.6M0 2.8L0 8", k), TL.anther, 0.8 * k) +
		p(tf(x, y, 0, "M0 0Q-4.6 3 -4.8 6.4Q-6.4 3.6 -5.2 -1Q-3.6 2.4 -0.6 1.4ZM0 0Q4.6 3 4.8 6.4Q6.4 3.6 5.2 -1Q3.6 2.4 0.6 1.4ZM-1.6 0.4Q0 5 1.6 0.4Q0 -0.6 -1.6 0.4Z", k), TL.petal)
	);
}
function troutLily(stage: GrowingStage): string {
	if (stage === "sprout") return tlLeaf(40, 87, -96, 16, 3.6, TL.leaf);
	if (stage === "leafy") return tlLeaf(39, 87, -128, 26, 6, TL.leaf) + tlLeaf(41, 87, -58, 24, 5.6, TL.leaf2) + sp("M40 86Q40 60 44 54", TL.stalk, 1.1) + p(ovalSub(44.6, 57, 1.6, 3.2, -10), TL.back);
	return sp("M40 86Q38 50 46 42Q48 41 49 43M40 86Q36 64 28 60Q26 59.6 25.4 61", TL.stalk, 1.2) + tlLeaf(38, 87, -150, 27, 6.6, TL.leaf) + tlLeaf(42, 87, -36, 27, 6.6, TL.leaf2) + tlFlower(49, 44, 1.25) + tlFlower(25.4, 62, 0.95);
}

/* ---------- 20. Wild violet ---------- */
const WV = { leaf: "#4e9a50", leaf2: "#62ad5c", vein: "#3a7440", stalk: "#5f8550", petal: "#6a4bb8", petal2: "#7e60cc", throat: "#f2eefa", eye: "#f2c84a", line: "#3c2b78" };
const HEARTLEAF = "M0 0C-1.8 -0.6 -3.6 -4 -0.6 -5.6C1.4 -6.6 4 -6.6 9 0C4 6.6 1.4 6.6 -0.6 5.6C-3.6 4 -1.8 0.6 0 0Z";
function wvFlower(x: number, y: number, k: number): string {
	return (
		p(ovalSub(x - 1.7 * k, y - 2.8 * k, 1.8 * k, 2.8 * k, -18 + 90) + ovalSub(x + 1.7 * k, y - 2.8 * k, 1.8 * k, 2.8 * k, 18 + 90), WV.petal) +
		p(ovalSub(x - 2.8 * k, y + 0.4 * k, 2.4 * k, 1.6 * k, 15) + ovalSub(x + 2.8 * k, y + 0.4 * k, 2.4 * k, 1.6 * k, -15) + ovalSub(x, y + 2.6 * k, 2.2 * k, 2.4 * k), WV.petal2) +
		p(ovalSub(x, y + 1 * k, 1.2 * k, 1.4 * k), WV.throat) +
		sp(`M${f(x)} ${f(y + 1.6 * k)}L${f(x)} ${f(y + 3.8 * k)}M${f(x - 0.9 * k)} ${f(y + 1.6 * k)}L${f(x - 1.4 * k)} ${f(y + 3.4 * k)}M${f(x + 0.9 * k)} ${f(y + 1.6 * k)}L${f(x + 1.4 * k)} ${f(y + 3.4 * k)}`, WV.line, 0.4) +
		p(dotSub(x, y + 0.4 * k, 0.6 * k), WV.eye)
	);
}
function wildViolet(stage: GrowingStage): string {
	const ink = new Ink();
	const leaves: readonly (readonly [number, number, number, number, string])[] =
		stage === "sprout"
			? [[36, 78, 1, -110, WV.leaf], [44, 77, 1.1, -70, WV.leaf2]]
			: stage === "leafy"
				? [[26, 76, 1.5, -150, WV.leaf], [54, 76, 1.5, -30, WV.leaf], [33, 68, 1.6, -115, WV.leaf2], [47, 67, 1.6, -65, WV.leaf2], [40, 74, 1.4, -90, WV.leaf]]
				: [[24, 76, 1.5, -155, WV.leaf], [56, 76, 1.5, -25, WV.leaf], [32, 68, 1.6, -118, WV.leaf2], [48, 67, 1.6, -62, WV.leaf2], [40, 74, 1.4, -90, WV.leaf], [30, 80, 1.2, -170, WV.leaf2], [50, 80, 1.2, -10, WV.leaf2]];
	let st = "";
	for (const [x, y] of leaves) st += `M40 86Q${f((40 + x) / 2)} ${f(y + 5)} ${f(x)} ${f(y)}`;
	for (const [x, y, k, rot, fill] of leaves) {
		ink.add(fill, tf(x, y, rot, HEARTLEAF, k));
		ink.line(WV.vein, 0.5, tf(x, y, rot, "M0 0L7 0M1 0L4 -3M1 0L4 3", k));
	}
	let fl = "";
	let fst = "";
	if (stage === "bloom") {
		for (const [x, y, k] of [[22, 58, 1.1], [38, 50, 1.2], [55, 56, 1.15], [46, 62, 0.9]] as const) {
			fst += `M40 85Q${f(x)} 74 ${f(x + 0.6)} ${f(y + 3)}`;
			fl += wvFlower(x, y, k);
		}
	} else if (stage === "leafy") {
		fst = "M40 85Q44 70 46 58";
		fl = p(tf(46, 58, -60, "M0 0L2 -2.4L4.6 -1.2L3.4 1.2Z", 1), WV.petal);
	}
	return sp(st, WV.stalk, 0.9) + sp(fst, WV.stalk, 0.8) + ink + fl;
}

/* ---------- 21. Brunnera ---------- */
const BN = { rim: "#5f8f5a", silver: "#cfd8d0", vein: "#6f9a6a", stalk: "#6a8a6a", blue: "#6aa0ee", eye: "#f5e48a" };
function bnLeaf(x: number, y: number, rot: number, k: number): string {
	return p(tf(x, y, rot, HEARTLEAF, k * 1.08), BN.rim) + p(tf(x + Math.cos((rot * Math.PI) / 180) * 0.3 * k, y + Math.sin((rot * Math.PI) / 180) * 0.3 * k, rot, HEARTLEAF, k * 0.92), BN.silver) + sp(tf(x, y, rot, "M0 0L7.6 0M1 0Q2.4 -2.6 4.4 -4.4M1 0Q2.4 2.6 4.4 4.4M3 0L5.6 -2.4M3 0L5.6 2.4M0.4 -0.6L-1.2 -4.4M0.4 0.6L-1.2 4.4", k), BN.vein, 0.5);
}
function bnSpray(x: number, y: number, n: number, rx: number, ry: number): string {
	let tw = "";
	let bl = "";
	for (const [px, py] of cloud(x, y, rx, ry, n)) {
		tw += `M${f(x)} ${f(y + ry + 4)}L${f(px)} ${f(py)}`;
		bl += `M${f(px)} ${f(py)}h0`;
	}
	return sp(tw, BN.stalk, 0.4) + sp(bl, BN.blue, 2.5) + sp(bl, BN.eye, 0.8);
}
function brunnera(stage: GrowingStage): string {
	if (stage === "sprout") return sp("M40 86L36 78M40 86L44 77", BN.stalk, 0.9) + bnLeaf(36, 78, -115, 1) + bnLeaf(44, 77, -65, 1.05);
	const leaves: readonly (readonly [number, number, number, number])[] = [[24, 76, -160, 1.7], [56, 76, -20, 1.7], [32, 68, -120, 1.9], [48, 68, -60, 1.9], [40, 76, -90, 1.6]];
	let st = "";
	for (const [x, y] of leaves) st += `M40 86Q${f((40 + x) / 2)} ${f(y + 5)} ${f(x)} ${f(y)}`;
	let s = sp(st, BN.stalk, 1);
	let spray = "";
	if (stage === "bloom") {
		s = sp("M39 80Q34 56 28 38M41 80Q42 50 44 30M42 80Q48 60 56 44", BN.stalk, 0.9) + s;
		spray = bnSpray(28, 34, 13, 7, 5) + bnSpray(44, 25, 15, 8, 5.5) + bnSpray(56, 40, 12, 6.5, 4.6);
	} else spray = sp("M40 78L41 58", BN.stalk, 0.8) + p(dotSub(41, 57, 1) + dotSub(39.6, 58.6, 0.9) + dotSub(42.4, 58.8, 0.9), "#d9a6c8");
	return s + spray + leaves.map(([x, y, r, k]) => bnLeaf(x, y, r, k)).join("");
}

/* ---------- 22. Spotted deadnettle ---------- */
const DN = { leaf: "#5c8e52", silver: "#e1e9dd", stalk: "#6a7a50", hood: "#c25aa6", lip: "#e18cc6" };
function dnStem(ink: Ink, c: [P2, P2, P2, P2], n: number, k: number, flowers: boolean, fl: Ink): void {
	ink.line(DN.stalk, 1.1, cd(...c));
	for (let i = 0; i < n; i++) {
		const [x, y, a] = cub(...c, 0.2 + (i * 0.75) / n);
		const sz = k * (1 - i * 0.07);
		for (const s of [-1, 1]) {
			const la = a + s * 70;
			ink.add(DN.leaf, leafSub(x, y, la, 7 * sz, 3.2 * sz, 4));
			ink.line(DN.silver, 1.3, tf(x, y, la, `M${f(1.4 * sz)} 0L${f(4.8 * sz)} 0`));
		}
	}
	if (!flowers) return;
	const [ex, ey, ea] = cub(...c, 0.98);
	for (const [d, s] of [[-45, 1], [-130, -1], [-88, 1], [-10, 1], [-170, -1]] as const) {
		const [fx, fy] = toward(ex, ey, ea + 90 + d, 2.4);
		fl.add(DN.hood, tf(fx, fy, 0, `M0 0C0 -3 ${2 * s} -4.6 ${4.2 * s} -4C${3 * s} -3 ${2 * s} -1.6 ${1.6 * s} 0.4Z`, 1));
		fl.add(DN.lip, ovalSub(fx + 1.6 * s, fy + 1, 1.3, 0.9));
	}
}
function spottedDeadnettle(stage: GrowingStage): string {
	const ink = new Ink();
	const fl = new Ink();
	if (stage === "sprout") {
		dnStem(ink, [[40, 87], [40, 82], [39, 76], [39, 72]], 2, 0.85, false, fl);
		return `${ink}`;
	}
	const big = stage === "bloom";
	const stems: [P2, P2, P2, P2][] = big
		? [
				[[38, 86], [24, 86], [10, 84], [8, 68]],
				[[42, 86], [56, 86], [70, 84], [72, 68]],
				[[39, 86], [34, 76], [28, 64], [28, 52]],
				[[41, 86], [46, 74], [50, 60], [50, 48]],
			]
		: [
				[[38, 86], [28, 86], [18, 84], [16, 72]],
				[[42, 86], [52, 86], [62, 84], [64, 72]],
				[[40, 86], [40, 76], [41, 66], [41, 58]],
			];
	for (const c of stems) dnStem(ink, c, 3, big ? 1.1 : 1, big, fl);
	return `${ink}${fl}`;
}

/* ---------- 23. Japanese forest grass ---------- */
const JF = { green: "#6f9a45", lime: "#b0c24c", gold: "#dec64e", seed: "#cdb98e" };
function forestGrass(stage: GrowingStage): string {
	const ink = new Ink();
	const k = stage === "sprout" ? 0.4 : stage === "leafy" ? 0.75 : 1;
	const ys = (y: number) => 87 - (87 - y) * k;
	const xs = (x: number) => 40 + (x - 40) * (0.55 + k * 0.45);
	// [x0, cx, cy, tx, ty, colour]
	const blades: readonly (readonly [number, number, number, number, number, string])[] = [
		[37, 26, 44, 8, 70, JF.green],
		[38, 30, 40, 13, 60, JF.lime],
		[40, 44, 32, 74, 72, JF.green],
		[41, 46, 30, 70, 58, JF.lime],
		[39, 40, 28, 62, 48, JF.green],
		[39, 36, 36, 20, 52, JF.gold],
		[40, 42, 34, 76, 80, JF.gold],
		[41, 48, 36, 72, 66, JF.gold],
		[40, 44, 30, 66, 52, JF.gold],
		[39, 38, 32, 52, 42, JF.lime],
		[38, 34, 46, 10, 78, JF.gold],
		[40, 46, 46, 68, 76, JF.lime],
		[41, 44, 40, 60, 60, JF.gold],
	];
	const use = stage === "sprout" ? blades.filter((_, i) => i % 3 === 1) : stage === "leafy" ? blades.filter((_, i) => i % 4 !== 3) : blades;
	for (const [x0, cx, cy, tx, ty, c] of use) ink.add(c, bladeSub(x0, xs(cx), ys(cy), xs(tx), ys(ty), stage === "sprout" ? 0.9 : 1.4));
	let seeds = "";
	if (stage === "bloom") {
		let d = "";
		let dots = "";
		for (const [x0, y0, x1, y1] of [[44, 50, 54, 34], [42, 48, 48, 30], [46, 54, 60, 42]] as const) {
			d += `M${x0} ${y0}Q${f((x0 + x1) / 2 - 2)} ${f((y0 + y1) / 2)} ${x1} ${y1}`;
			for (let i = 0; i < 4; i++) {
				const t = 0.4 + i * 0.2;
				dots += ovalSub(x0 + (x1 - x0) * t + (i % 2 ? 1.4 : -1.4), y0 + (y1 - y0) * t, 0.9, 1.5, 30);
			}
		}
		seeds = sp(d, JF.seed, 0.5) + p(dots, JF.seed);
	}
	return seeds + ink;
}

/* ---------- 24. Ligularia ---------- */
const LG = { leaf: "#4a7d48", leaf2: "#5a8f54", vein: "#2f5a35", stalk: "#5d3c4c", yellow: "#f2c230", orange: "#df9a1c" };
/** A toothed heart-shaped leaf, sinus at the origin, tip along +x. */
const LGLEAF = (() => {
	const pts: string[] = [];
	const n = 22;
	for (let i = 0; i <= n; i++) {
		const t = -Math.PI + (i / n) * Math.PI * 2;
		const r = (i % 2 ? 0.92 : 1) * 5.2;
		const u = Math.cos(t) * r * 0.95 + 4.6 + Math.cos(t) * Math.abs(Math.cos(t)) * -0.6;
		const v = Math.sin(t) * r * (1 - 0.25 * (Math.cos(t) + 1) / 2);
		pts.push(`${f(i === 0 || i === n ? -0.2 : u)} ${f(i === 0 || i === n ? 0 : v)}`);
	}
	return `M0 0L${pts.join("L")}Z`;
})();
function lgLeaves(k: number): string {
	const ink = new Ink();
	const leaves: readonly (readonly [number, number, number, number, string])[] = [[28, 78, 10, 180 - 55, LG.leaf], [52, 78, 10, 180 + 55, LG.leaf], [34, 70, 10.5, 180 - 20, LG.leaf2], [46, 70, 10.5, 180 + 20, LG.leaf2], [40, 78, 10, 180, LG.leaf]];
	let st = "";
	for (const [x0, y0, r, rot, fill] of leaves) {
		const x = 40 + (x0 - 40) * k;
		const y = 86 - (86 - y0) * k;
		st += `M40 86L${f(x)} ${f(y)}`;
		ink.add(fill, tf(x, y, rot - 270, LGLEAF, (k * r) / 6));
		ink.line(LG.vein, 0.6, tf(x, y, rot - 270, "M0 0L8.6 0M0.6 0L3.4 -4M0.6 0L3.4 4M3 0L6 -3.4M3 0L6 3.4", (k * r) / 6));
	}
	return sp(st, LG.stalk, 1.2) + ink;
}
function lgSpire(o: Ink, y: Ink, x: number, top: number, len: number): void {
	o.line(LG.stalk, 1.3, seg(x, 80, x, top));
	let a = "";
	let b = "";
	for (let i = 0; i < len / 1.8; i++) {
		const yy = top + i * 1.8;
		const pr = i / (len / 1.8);
		const hw = 0.6 + Math.min(pr * 3, 1) * 2.4 * (1 - pr * 0.35);
		const sx = i % 2 ? 1 : -1;
		a += `M${f(x + sx * hw)} ${f(yy)}h0`;
		b += `M${f(x - sx * hw * 0.5)} ${f(yy + 0.9)}h0`;
	}
	o.line(LG.orange, 2, b);
	y.line(LG.yellow, 2.6, a);
}
function ligularia(stage: GrowingStage): string {
	if (stage === "sprout") return lgLeaves(0.45);
	if (stage === "leafy") return lgLeaves(0.95);
	const o = new Ink();
	const y = new Ink();
	lgSpire(o, y, 31, 18, 30);
	lgSpire(o, y, 42, 8, 36);
	lgSpire(o, y, 52, 20, 28);
	return `${o}${y}` + lgLeaves(1.05);
}

/* ---------- 25. Bugleweed ---------- */
const BW = { leaf: "#6a4260", leaf2: "#93648a", rib: "#4a2c44", blue: "#5a5cd2", blue2: "#8a8cf0", bract: "#5e3a58" };
/** A flat rosette seen from a low angle: leaves radiate in a squashed ring around (x, y). */
function bwRosette(x: number, k: number, n: number, y = 85, mid = ""): string {
	const back = new Ink();
	const front = new Ink();
	for (let i = 0; i < n; i++) {
		const a = -90 + 180 / n + (i * 360) / n;
		const ink = Math.sin((a * Math.PI) / 180) < 0 ? back : front;
		const d = leafSub(x, y, a, 11 * k, 4.4 * k, 2) + "";
		const sq = d.replace(/(-?[\d.]+) (-?[\d.]+)/g, (_, u: string, v: string) => `${u} ${f(y + (+v - y) * 0.5)}`);
		ink.add(i % 2 ? BW.leaf : BW.leaf2, sq);
		const [tx, ty] = toward(x, y, a, 8.6 * k);
		ink.line(BW.rib, 0.5, `M${f(x)} ${f(y)}L${f(tx)} ${f(y + (ty - y) * 0.5)}`);
	}
	return `${back}${mid}${front}`;
}
function bwSpike(o: Ink, x: number, base: number, top: number): void {
	let a = "";
	let b = "";
	const h = base - top;
	for (let y = top + 1; y < base; y += 2.4) {
		const pr = (y - top) / h;
		const hw = 0.8 + pr * 2;
		a += seg(x - hw, y, x + hw, y);
		b += `M${f(x - hw * 0.6)} ${f(y - 0.5)}h0M${f(x + hw * 0.7)} ${f(y - 0.3)}h0`;
	}
	o.line(BW.bract, 1, seg(x, base, x, top)).line(BW.blue, 2.3, a).line(BW.blue2, 1.2, b);
}
function bugleweed(stage: GrowingStage): string {
	if (stage === "sprout") return bwRosette(40, 0.95, 6, 84);
	const runners = sp("M30 86Q20 87 13 86M50 86Q60 87 67 86", BW.leaf, 0.9);
	if (stage === "leafy") return runners + bwRosette(40, 1.3, 9) + bwRosette(14, 0.55, 6, 86) + bwRosette(66, 0.55, 6, 86);
	const o = new Ink();
	bwSpike(o, 33, 84, 56);
	bwSpike(o, 40, 84, 46);
	bwSpike(o, 47, 84, 54);
	bwSpike(o, 15, 86, 70);
	bwSpike(o, 65, 86, 72);
	return runners + bwRosette(40, 1.35, 9, 85, `${o}`) + bwRosette(15, 0.6, 6, 86) + bwRosette(65, 0.6, 6, 86);
}

/* ---------- the family ---------- */
export const SPECIES: Species[] = [
	{ id: "hosta", name: "Hosta", draw: hosta },
	{ id: "bleeding-heart", name: "Bleeding heart", draw: bleedingHeart },
	{ id: "trillium", name: "Trillium", draw: trillium },
	{ id: "foamflower", name: "Foamflower", draw: foamflower },
	{ id: "coral-bells", name: "Coral bells", draw: coralBells },
	{ id: "lungwort", name: "Lungwort", draw: lungwort },
	{ id: "solomons-seal", name: "Solomon's seal", draw: solomonsSeal },
	{ id: "wood-anemone", name: "Wood anemone", draw: woodAnemone },
	{ id: "bloodroot", name: "Bloodroot", draw: bloodroot },
	{ id: "jack-in-the-pulpit", name: "Jack-in-the-pulpit", draw: jackInThePulpit },
	{ id: "mayapple", name: "Mayapple", draw: mayapple },
	{ id: "hellebore", name: "Hellebore", draw: hellebore },
	{ id: "astilbe", name: "Astilbe", draw: astilbe },
	{ id: "wild-ginger", name: "Wild ginger", draw: wildGinger },
	{ id: "virginia-bluebells", name: "Virginia bluebells", draw: virginiaBluebells },
	{ id: "wild-columbine", name: "Wild columbine", draw: wildColumbine },
	{ id: "sweet-woodruff", name: "Sweet woodruff", draw: sweetWoodruff },
	{ id: "hepatica", name: "Hepatica", draw: hepatica },
	{ id: "trout-lily", name: "Trout lily", draw: troutLily },
	{ id: "wild-violet", name: "Wild violet", draw: wildViolet },
	{ id: "brunnera", name: "Brunnera", draw: brunnera },
	{ id: "spotted-deadnettle", name: "Spotted deadnettle", draw: spottedDeadnettle },
	{ id: "japanese-forest-grass", name: "Japanese forest grass", draw: forestGrass },
	{ id: "ligularia", name: "Ligularia", draw: ligularia },
	{ id: "bugleweed", name: "Bugleweed", draw: bugleweed },
];
