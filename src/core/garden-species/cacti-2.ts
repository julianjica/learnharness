/**
 * Garden species, family: cacti II (owner design, 2026-11-11). A second
 * batch of cacti, distinct from the ones in succulents.ts. Drawn in the
 * shared kit style; see kit.ts for the cell and the rules.
 */
import { BARK, f, type GrowingStage, type Species } from "./kit";

type XY = readonly [number, number];

// ── private helpers ──────────────────────────────────────────────────────

const fill = (d: string, c: string): string => (d ? `<path d="${d}" fill="${c}"/>` : "");

const strk = (d: string, c: string, w: number, extra = ""): string =>
	d ? `<path d="${d}" fill="none" stroke="${c}" stroke-width="${f(w)}" stroke-linecap="round" stroke-linejoin="round"${extra}/>` : "";

/** A dashed stroke: cheap texture (spine bands, dotted wool). */
const dash = (d: string, c: string, w: number, on: number, off: number, op = 1): string =>
	strk(d, c, w, ` stroke-dasharray="${f(on)} ${f(off)}"${op < 1 ? ` opacity="${op}"` : ""}`).replace(`stroke-linecap="round" `, "");

/** Round dots as one path of zero-length round-capped strokes. */
const dots = (pts: readonly XY[], r: number, c: string): string =>
	pts.length ? `<path d="${pts.map(([x, y]) => `M${f(x)} ${f(y)}h0`).join("")}" stroke="${c}" stroke-width="${f(r * 2)}" stroke-linecap="round"/>` : "";

/** Merges path data per fill into one <path> each, in first-seen order. */
class Ink {
	private parts = new Map<string, string>();
	add(c: string, d: string): this {
		this.parts.set(c, (this.parts.get(c) ?? "") + d);
		return this;
	}
	toString(): string {
		return [...this.parts].map(([c, d]) => fill(d, c)).join("");
	}
}

function mapper(x: number, y: number, deg: number): (u: number, v: number) => string {
	const c = Math.cos((deg * Math.PI) / 180);
	const s = Math.sin((deg * Math.PI) / 180);
	return (u, v) => `${f(x + c * u - s * v)} ${f(y + s * u + c * v)}`;
}

const rad = (deg: number): number => (deg * Math.PI) / 180;

/** Pointed lens from (x, y) heading deg. */
function lensD(x: number, y: number, deg: number, len: number, w: number): string {
	const P = mapper(x, y, deg);
	return `M${P(0, 0)}Q${P(len * 0.5, -w * 1.3)} ${P(len, 0)}Q${P(len * 0.5, w * 1.3)} ${P(0, 0)}`;
}

/** Ellipse as path data (rotation deg). */
function ellD(cx: number, cy: number, rx: number, ry: number, deg = 0): string {
	const c = Math.cos(rad(deg));
	const s = Math.sin(rad(deg));
	const a = `a${f(rx)} ${f(ry)} ${f(deg)} 1 0 `;
	return `M${f(cx - rx * c)} ${f(cy - rx * s)}${a}${f(2 * rx * c)} ${f(2 * rx * s)}${a}${f(-2 * rx * c)} ${f(-2 * rx * s)}`;
}

const circD = (x: number, y: number, r: number): string => ellD(x, y, r, r);

/** n lens petals radiating from (x, y). */
function starD(x: number, y: number, n: number, len: number, w: number, rot = -90): string {
	let d = "";
	for (let i = 0; i < n; i++) d += lensD(x, y, rot + (i * 360) / n, len, w);
	return d;
}

/** A front-facing flower: outer star, inner star, centre. */
function flower(x: number, y: number, n: number, r: number, outer: string, inner: string, centre: string, w = 0.32, rot = -90): string {
	return fill(starD(x, y, n, r, r * w, rot), outer) + fill(starD(x, y, n, r * 0.6, r * w * 0.7, rot + 180 / n), inner) + fill(circD(x, y, r * 0.22), centre);
}

/** Six-spoked spine stars at points, as one stroked path. */
function spineStars(pts: readonly XY[], s: number, c: string, w = 0.5): string {
	const h = s * 0.5;
	const v = s * 0.87;
	return strk(pts.map(([x, y]) => `M${f(x - s)} ${f(y)}h${f(2 * s)}M${f(x - h)} ${f(y - v)}l${f(s)} ${f(2 * v)}m0 ${f(-2 * v)}l${f(-s)} ${f(2 * v)}`).join(""), c, w);
}

/** Hex-packed points inside an ellipse. */
function grid(cx: number, cy: number, rx: number, ry: number, step: number, inset = 0.78): XY[] {
	const out: XY[] = [];
	let row = 0;
	for (let y = cy - ry; y <= cy + ry; y += step * 0.87, row++) {
		for (let x = cx - rx + (row % 2 ? step / 2 : 0); x <= cx + rx; x += step) {
			const dx = (x - cx) / rx;
			const dy = (y - cy) / ry;
			if (dx * dx + dy * dy <= inset * inset) out.push([x, y]);
		}
	}
	return out;
}

/** Points along a quadratic. */
function qPts(a: XY, c: XY, b: XY, ts: readonly number[], dx = 0): XY[] {
	return ts.map((t) => {
		const u = 1 - t;
		return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0] + dx, u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]] as XY;
	});
}

/** Points along a cubic, with heading in degrees. */
function cPts(p: readonly [XY, XY, XY, XY], n: number, from = 0, to = 1): [number, number, number][] {
	const at = (t: number): XY => {
		const u = 1 - t;
		return [
			u * u * u * p[0][0] + 3 * u * u * t * p[1][0] + 3 * u * t * t * p[2][0] + t * t * t * p[3][0],
			u * u * u * p[0][1] + 3 * u * u * t * p[1][1] + 3 * u * t * t * p[2][1] + t * t * t * p[3][1],
		];
	};
	const out: [number, number, number][] = [];
	for (let i = 0; i < n; i++) {
		const t = from + ((to - from) * (i + 0.5)) / n;
		const [x, y] = at(t);
		const [x2, y2] = at(Math.min(1, t + 0.01));
		const [x0, y0] = at(Math.max(0, t - 0.01));
		out.push([x, y, (Math.atan2(y2 - y0, x2 - x0) * 180) / Math.PI]);
	}
	return out;
}

const cD = (p: readonly [XY, XY, XY, XY]): string => `M${f(p[0][0])} ${f(p[0][1])}C${p.slice(1).map(([x, y]) => `${f(x)} ${f(y)}`).join(" ")}`;

/** Rib lines on a globe as one path. */
function meridiansD(cx: number, cy: number, rx: number, ry: number, n: number): string {
	let d = "";
	for (let k = 1; k < n; k++) {
		const off = (-1 + (2 * k) / n) * rx * 1.8;
		d += `M${f(cx)} ${f(cy - ry)}Q${f(cx + off)} ${f(cy)} ${f(cx)} ${f(cy + ry)}`;
	}
	return d;
}

function meridianPts(cx: number, cy: number, rx: number, ry: number, n: number, ts: readonly number[]): XY[] {
	const out: XY[] = [];
	for (let k = 1; k < n; k++) {
		const off = (-1 + (2 * k) / n) * rx * 1.8;
		for (const t of ts) out.push([cx + 2 * t * (1 - t) * off, cy - ry + 2 * ry * t]);
	}
	return out;
}

/** A flat strap stem (epiphyllum) with notched edges, as a filled outline. */
function strapD(x: number, y: number, deg: number, len: number, w: number, bend: number, notches = 5): string {
	const n = 30;
	const pts: [number, number, number][] = [];
	let a = rad(deg);
	let px = x;
	let py = y;
	for (let i = 0; i <= n; i++) {
		const t = i / n;
		const taper = t < 0.1 ? 0.3 : t < 0.3 ? 0.3 + ((t - 0.1) / 0.2) * 0.7 : t < 0.82 ? 1 : Math.sqrt(Math.max(0, 1 - ((t - 0.82) / 0.18) ** 2));
		const notch = t < 0.25 ? 1 : 1 - 0.32 * Math.abs(Math.sin((t - 0.25) * notches * Math.PI));
		pts.push([px, py, taper * notch * w]);
		a += rad(bend) / n;
		px += (Math.cos(a) * len) / n;
		py += (Math.sin(a) * len) / n;
	}
	const side = (s: number) =>
		pts.map(([cx, cy, ww], i) => {
			const nx = i < n ? pts[i + 1]![0] - cx : cx - pts[i - 1]![0];
			const ny = i < n ? pts[i + 1]![1] - cy : cy - pts[i - 1]![1];
			const l = Math.hypot(nx, ny) || 1;
			return `${f(cx - (ny / l) * ww * s)} ${f(cy + (nx / l) * ww * s)}`;
		});
	return `M${side(1).join("L")}L${side(-1).reverse().join("L")}Z`;
}

/** Midline of a strap, for a rib stroke. */
function strapRib(x: number, y: number, deg: number, len: number, bend: number): string {
	const n = 18;
	let a = rad(deg);
	let px = x;
	let py = y;
	let d = `M${f(x)} ${f(y)}`;
	for (let i = 1; i <= n * 0.9; i++) {
		a += rad(bend) / n;
		px += (Math.cos(a) * len) / n;
		py += (Math.sin(a) * len) / n;
		d += `L${f(px)} ${f(py)}`;
	}
	return d;
}

function strapTip(x: number, y: number, deg: number, len: number, bend: number, t = 1): XY {
	const n = 18;
	let a = rad(deg);
	let px = x;
	let py = y;
	for (let i = 0; i < n * t; i++) {
		a += rad(bend) / n;
		px += (Math.cos(a) * len) / n;
		py += (Math.sin(a) * len) / n;
	}
	return [px, py];
}

const SPINE = "#efe9cf";

// ── 1. Organ pipe cactus ────────────────────────────────────────────────

const OP = { back: "#4a7c50", front: "#5e9561", rib: "#2f5a37" };

function organPipe(stage: GrowingStage): string {
	type C = [number, number, number];
	const [back, front, w]: [C[], C[], number] =
		stage === "sprout"
			? [[], [[39, 37, 72], [41, 43, 76]], 5]
			: stage === "leafy"
				? [[[39, 35, 50], [41, 45, 48]], [[38, 28, 60], [40, 40, 44], [42, 52, 62]], 6]
				: [[[38, 30, 22], [42, 50, 20], [40, 40, 13]], [[36, 21, 36], [39, 34, 27], [41, 45, 25], [44, 59, 38]], 7];
	const colD = (cs: C[], dx = 0) => cs.map(([b, t, y]) => `M${f(b + dx)} 86Q${f(t + dx)} 84 ${f(t + dx)} ${f(y)}`).join("");
	const all = [...back, ...front];
	const o = w * 0.24;
	const ribs = colD(all, -o) + colD(all, o);
	const ar: XY[] = [];
	for (const [b, t, y] of all) ar.push(...qPts([b, 86], [t, 84], [t, y], [0.5, 0.65, 0.8, 0.92], -o), ...qPts([b, 86], [t, 84], [t, y], [0.58, 0.72, 0.86, 0.97], o));
	let s = strk(colD(back), OP.back, w) + strk(colD(front), OP.front, w) + strk(ribs, OP.rib, 0.7, ` opacity=".5"`) + dots(ar, 0.6, SPINE);
	if (stage === "bloom") {
		const tips: XY[] = all.map(([, t, y]) => [t, y - 2.4]);
		const fl = new Ink();
		[0, 2, 4, 6].forEach((i) => fl.add("#ecd3e6", starD(tips[i]![0], tips[i]![1], 7, 3.6, 1.2)));
		s += fl + dots([0, 2, 4, 6].map((i) => tips[i]!), 0.9, "#e2c25a");
		s += fill([1, 3, 5].map((i) => circD(tips[i]![0], tips[i]![1] + 0.6, 2.4)).join(""), "#c8443c");
		s += dots([1, 3, 5].map((i) => [tips[i]![0] - 0.8, tips[i]![1]] as XY), 0.45, "#f1b29c");
	}
	return s;
}

// ── 2. Hedgehog cactus ──────────────────────────────────────────────────

function hedgehog(stage: GrowingStage): string {
	type E = [number, number, number, number, number];
	const [back, front]: [E[], E[]] =
		stage === "sprout"
			? [[], [[40, 81, 4.5, 6.5, 0]]]
			: stage === "leafy"
				? [[[33, 77, 5.5, 10, -12], [47, 78, 5.5, 9, 12]], [[40, 75, 6.5, 12.5, 0]]]
				: [[[31, 75, 6.5, 12, -14], [49, 75, 6.5, 12, 14]], [[40, 71, 7.5, 16, 0], [25, 81, 5, 7, -25], [55, 81, 5, 7, 25]]];
	const all = [...back, ...front];
	let s = fill(back.map((e) => ellD(...e)).join(""), "#5a8746") + fill(front.map((e) => ellD(...e)).join(""), "#6fa055");
	const pts: XY[] = [];
	for (const [x, y, rx, ry] of all) pts.push(...grid(x, y, rx, ry, 4, 0.8));
	s += spineStars(pts, 1.3, SPINE, 0.45);
	if (stage === "bloom") {
		for (const [x, y] of [[40, 51], [28, 61], [52, 61]] as XY[]) s += flower(x, y, 10, 7, "#cf3d86", "#e683b4", "#93c55a", 0.3);
	}
	return s;
}

// ── 3. Rat tail cactus ──────────────────────────────────────────────────

function ratTail(stage: GrowingStage): string {
	type C = [XY, XY, XY, XY];
	const stems: C[] =
		stage === "sprout"
			? [[[39, 86], [38, 80], [36, 75], [34, 72]], [[41, 86], [42, 80], [44, 77], [46, 75]]]
			: stage === "leafy"
				? [[[38, 86], [35, 64], [24, 58], [17, 76]], [[42, 86], [45, 64], [56, 58], [63, 78]], [[40, 86], [40, 64], [34, 52], [29, 56]]]
				: [
						[[38, 86], [34, 56], [16, 48], [8, 84]],
						[[42, 86], [46, 56], [64, 48], [72, 84]],
						[[40, 86], [40, 44], [24, 34], [17, 62]],
						[[41, 86], [43, 40], [58, 34], [63, 66]],
						[[40, 86], [42, 70], [50, 62], [54, 86]],
					];
	let s = strk(stems.map(cD).join(""), "#7f9c55", 3.4);
	const sp: XY[] = [];
	for (const c of stems) for (const [x, y, a] of cPts(c, 14)) {
		const o = 1.4;
		sp.push([x - Math.sin(rad(a)) * o, y + Math.cos(rad(a)) * o], [x + Math.sin(rad(a)) * o * 0.4, y - Math.cos(rad(a)) * o * 0.4]);
	}
	s += dots(sp, 0.55, "#c07a42");
	if (stage === "bloom") {
		const fl = new Ink();
		const tips: XY[] = [];
		stems.slice(0, 4).forEach((c, i) => {
			for (const [x, y, a] of cPts(c, 3, 0.25, 0.8)) {
				const side = i % 2 ? 90 : -90;
				const d = a + side * (y > 60 ? -1 : 1);
				fl.add("#d33f78", lensD(x, y, d, 8, 2.1));
				const tx = x + Math.cos(rad(d)) * 7.2;
				const ty = y + Math.sin(rad(d)) * 7.2;
				fl.add("#e65a90", starD(tx, ty, 5, 2.4, 1, d));
				tips.push([tx, ty]);
			}
		});
		s += fl + dots(tips, 0.6, "#f6c0d4");
	}
	return s;
}

// ── 4. Peruvian apple cactus ────────────────────────────────────────────

const PA = { body: "#79a5a1", rib: "#4b7a76", trunk: "#8b8170" };

function peruvianApple(stage: GrowingStage): string {
	const w = stage === "sprout" ? 6 : 7.5;
	let trunk = "";
	let br: string[];
	if (stage === "sprout") br = ["M40 86V68"];
	else if (stage === "leafy") {
		trunk = "M40 87V76";
		br = ["M40 78Q40 60 40 38", "M40 76Q30 70 29 50"];
	} else {
		trunk = "M40 87V70";
		br = ["M40 72Q38 50 40 14", "M40 72Q26 62 24 30", "M40 70Q56 62 58 24", "M39 74Q22 72 15 52", "M41 74Q60 72 65 56"];
	}
	let s = strk(trunk, PA.trunk, 8) + strk(br.join(""), PA.body, w);
	const ribs = xShift(br, -w * 0.24) + xShift(br, w * 0.24);
	s += strk(ribs, PA.rib, 0.7, ` opacity=".5"`);
	if (stage === "bloom") {
		s += fill(ellD(20.5, 40, 2.6, 3.4, -10) + ellD(62, 38, 2.6, 3.4, 10) + ellD(35, 44, 2.4, 3.2) + ellD(19, 58, 2.4, 3.1), "#c8456a") + dots([[19.8, 38.8], [61.3, 36.8], [34.3, 42.8], [18.4, 56.9]], 0.6, "#e98ba4");
		s += flower(40, 10.5, 9, 6, "#f3efe2", "#fffdf5", "#e6cf7a", 0.3) + flower(58, 21, 9, 4.6, "#f3efe2", "#fffdf5", "#e6cf7a", 0.3);
	}
	return s;
}

// ── 5. Totem pole cactus ────────────────────────────────────────────────

function totemPole(stage: GrowingStage): string {
	const [cols, r]: [[number, number][], number] =
		stage === "sprout" ? [[[40, 74]], 3.4] : stage === "leafy" ? [[[35, 52], [45, 44]], 4.2] : [[[30, 36], [40, 16], [51, 40]], 4.8];
	const dark = new Ink();
	const light = new Ink();
	const knobs: XY[] = [];
	let core = "";
	for (const [x, top] of cols) {
		core += `M${f(x)} 86V${f(top + r)}`;
		let i = 0;
		for (let y = 85 - r * 0.6; y >= top + r * 0.6; y -= r * 1.2, i++) {
			const dx = i % 2 ? 0.8 : -0.8;
			dark.add("#5f8e47", circD(x + dx + 0.6, y + 0.5, r));
			light.add("#97c073", circD(x + dx - 0.4, y - 0.5, r * 0.8));
			knobs.push([x + dx, y]);
		}
	}
	let s = strk(core, "#5f8e47", r * 1.8) + dark + light;
	if (stage === "bloom") {
		const fl = new Ink();
		const sel = knobs.filter((_k, i) => i % 4 === 2);
		for (const [x, y] of sel) fl.add("#f2a9c2", starD(x + 2.5, y - 1, 6, 2.6, 1));
		s += fl + dots(sel.map(([x, y]) => [x + 2.5, y - 1] as XY), 0.6, "#c75b80");
	}
	return s;
}

// ── 6. Easter cactus ────────────────────────────────────────────────────

/** Chains of flat oval segments; returns segment path data and tip points with heading. */
function segChains(chains: [number, number, number[]][], len: number, w: number): [string, [number, number, number][]] {
	let d = "";
	const tips: [number, number, number][] = [];
	for (const [x0, y0, angs] of chains) {
		let x = x0;
		let y = y0;
		for (const a of angs) {
			const ex = x + Math.cos(rad(a)) * len;
			const ey = y + Math.sin(rad(a)) * len;
			d += ellD((x + ex) / 2, (y + ey) / 2, len * 0.56, w, a);
			x = ex;
			y = ey;
		}
		tips.push([x, y, angs[angs.length - 1]!]);
	}
	return [d, tips];
}

function easter(stage: GrowingStage): string {
	const ch: [number, number, number[]][] =
		stage === "sprout"
			? [[40, 86, [-95, -88]]]
			: stage === "leafy"
				? [[39, 86, [-140, -130, -122]], [40, 86, [-100, -94, -90, -94]], [41, 86, [-60, -66, -72]], [40, 86, [-30, -40]]]
				: [
						[39, 86, [-165, -152, -140]],
						[39, 86, [-126, -118, -110, -104]],
						[40, 86, [-100, -95, -90, -92, -96]],
						[41, 86, [-80, -84, -86, -82]],
						[41, 86, [-58, -64, -72, -78]],
						[41, 86, [-18, -30, -42]],
					];
	const [d, tips] = segChains(ch, stage === "sprout" ? 6.5 : 8.5, stage === "sprout" ? 2.4 : 2.9);
	let s = fill(d, "#5c984c");
	if (stage === "bloom") {
		const c: XY[] = tips.map(([x, y, a]) => [x + Math.cos(rad(a)) * 3, y + Math.sin(rad(a)) * 3]);
		s += fill(c.map(([x, y]) => starD(x, y, 8, 5.4, 1.4)).join(""), "#e0473b") + dots(c, 2, "#f07a5a") + dots(c, 1.1, "#f2c94c");
	}
	return s;
}

// ── 7. Orchid cactus ────────────────────────────────────────────────────

function strapPlant(straps: [number, number, number, number, number, number][], body: string, rib: string, notches = 5): string {
	return fill(straps.map((p) => strapD(...p, notches)).join(""), body) + strk(straps.map(([x, y, a, l, , b]) => strapRib(x, y, a, l, b)).join(""), rib, 0.8, ` opacity=".7"`);
}

function orchidCactus(stage: GrowingStage): string {
	if (stage === "sprout") return strapPlant([[40, 86, -100, 16, 3.6, -14], [41, 86, -66, 12, 3.2, 20]], "#5c9b4f", "#3c6d36");
	if (stage === "leafy") return strapPlant([[39, 86, -118, 30, 4.6, -55], [41, 86, -62, 30, 4.6, 55], [40, 86, -94, 32, 4.4, 10]], "#5c9b4f", "#3c6d36");
	let s = strapPlant([[38, 86, -122, 36, 5.2, -70], [42, 86, -58, 36, 5.2, 70], [40, 86, -97, 30, 5, -10], [41, 86, -78, 22, 4.4, 45]], "#5c9b4f", "#3c6d36");
	s += strk("M37 59Q43 52 46 42", "#8a3a47", 1.6);
	s += fill(starD(47, 32, 9, 13, 3.6, -80), "#e2546d") + fill(starD(47, 32, 9, 8.5, 3, -60), "#f39aa8");
	s += strk("M47 32l-3 -4M47 32l1 -5M47 32l4 -3M47 32l-4 1", "#fbefe8", 0.6) + dots([[44, 28], [48, 27], [51, 29], [43, 33]], 0.8, "#f3d97a");
	return s;
}

// ── 8. Dragon fruit cactus ──────────────────────────────────────────────

const DF = { stem: "#66a654", ridge: "#8fcc72", fruit: "#df447c", scale: "#97c95c" };

function dfStems(stems: [XY, XY, XY, XY][]): string {
	const d = stems.map(cD).join("");
	return strk(d, DF.stem, 4.4) + strk(d, DF.ridge, 1.1, ` opacity=".8"`) + dots(stems.flatMap((c) => cPts(c, 6).map(([x, y]) => [x + 2, y] as XY)), 0.6, "#3f7a35");
}

function dragonFruit(stage: GrowingStage): string {
	if (stage === "sprout") return dfStems([[[40, 86], [41, 80], [39, 76], [41, 70]], [[40, 82], [42, 80], [45, 78], [46, 75]]]);
	if (stage === "leafy") {
		return strk("M37 87V44", BARK, 3.8) + strk("M32 44H42", BARK, 2) + dfStems([[[42, 86], [46, 74], [40, 62], [42, 48]], [[41, 46], [34, 42], [29, 48], [28, 56]]]);
	}
	let s = strk("M37 87V32", BARK, 4) + strk("M31 32H43", BARK, 2.2);
	s += dfStems([
		[[42, 86], [46, 72], [40, 58], [43, 46]],
		[[43, 46], [45, 40], [40, 36], [40, 31]],
		[[40, 31], [30, 26], [21, 34], [19, 50]],
		[[40, 31], [50, 26], [60, 32], [61, 48]],
		[[39, 33], [33, 34], [30, 40], [30, 46]],
	]);
	const fruit = (x: number, y: number) => {
		let sc = "";
		for (const a of [-150, -110, -70, -30, 0, 180, 150, 30]) sc += lensD(x + Math.cos(rad(a)) * 3.4, y + Math.sin(rad(a)) * 4.3, a, 3, 0.9);
		return [ellD(x, y, 4.6, 5.8), sc];
	};
	const fr = [fruit(19, 57), fruit(61, 55), fruit(30, 52)];
	s += fill(fr.map((p) => p[1]).join(""), DF.scale) + fill(fr.map((p) => p[0]).join(""), DF.fruit) + dots([[17.6, 55], [59.6, 53], [28.6, 50]], 1, "#f07aa4");
	s += fill(starD(48, 24, 8, 6, 1.8, -60), "#f2eedd") + dots([[48, 24]], 1.4, "#e6d46a");
	return s;
}

// ── 9. Queen of the night ───────────────────────────────────────────────

function queenOfTheNight(stage: GrowingStage): string {
	const body = "#467f44";
	const rib = "#2c5a2e";
	if (stage === "sprout") return strapPlant([[40, 86, -95, 18, 3.2, -6]], body, rib, 4);
	if (stage === "leafy") return strapPlant([[39, 86, -108, 38, 3.6, -25], [41, 86, -78, 34, 3.6, 25], [40, 86, -92, 44, 3.6, 8]], body, rib, 4);
	let s = strapPlant([[39, 86, -106, 46, 3.8, -24], [41, 86, -76, 42, 3.8, 26], [40, 86, -92, 54, 3.8, 8], [39, 86, -140, 26, 3.4, -30], [41, 86, -40, 26, 3.4, 30]], body, rib, 4);
	s += strk("M35 66C26 64 18 56 20 40", "#b05a4a", 1.4) + strk("M47 62C56 58 62 48 60 36", "#b05a4a", 1.3);
	s += fill(lensD(60, 37, -95, 11, 2.2), "#e3cdb6");
	s += fill(starD(21, 28, 12, 12, 1.3, -80), "#c4845c") + fill(starD(21, 28, 10, 9.5, 2.6, -90), "#f7f4ea") + fill(circD(21, 28, 2.6), "#efe2a8");
	s += strk("M21 28l-2.2 -2.4M21 28l.6 -3M21 28l2.6 -1.6M21 28l2.2 1.6M21 28l-2.6 1", "#f4ecc4", 0.5);
	return s;
}

// ── 10. Fishhook barrel cactus ──────────────────────────────────────────

function fishhookBarrel(stage: GrowingStage): string {
	const [cy, rx, ry, n] = stage === "sprout" ? [81, 5.5, 6, 4] : stage === "leafy" ? [73.5, 10.5, 13.5, 6] : [65, 14, 21.5, 8];
	let s = fill(ellD(cy === 81 ? 40 : 40, cy, rx, ry), "#5a8a4f") + strk(meridiansD(40, cy, rx, ry, n), "#3d6a38", 0.8, ` opacity=".6"`);
	const pts = meridianPts(40, cy, rx, ry, n, stage === "sprout" ? [0.35, 0.65] : [0.2, 0.4, 0.6, 0.8]);
	s += strk(pts.map(([x, y]) => `M${f(x)} ${f(y)}l0 -3q0 -1.3 1.2 -.6`).join(""), "#c9573c", 0.65) + dots(pts, 0.55, "#e9dcc0");
	if (stage === "bloom") {
		const top = cy - ry + 1.6;
		const fr = new Ink();
		[-6, 0, 6].forEach((dx) => fr.add("#e8c44a", ellD(40 + dx, top + 1, 1.8, 2.2)));
		s += fr;
		for (const [dx, dy] of [[-10, 2.2], [-4, -1.4], [4, -1.4], [10, 2.2]] as XY[]) {
			const x = 40 + dx;
			const y = top + dy - 1;
			s += fill(lensD(x, y + 3, -90 - dx * 2, 6, 2.2) + lensD(x, y + 3, -60 - dx * 2, 5, 1.8) + lensD(x, y + 3, -120 - dx * 2, 5, 1.8), "#e57b34") + dots([[x, y - 0.5]], 0.9, "#f4c84a");
		}
	}
	return s;
}

// ── 11. Bishop's cap ────────────────────────────────────────────────────

function bishopsCap(stage: GrowingStage): string {
	const [hw, top] = stage === "sprout" ? [6.5, 74] : stage === "leafy" ? [11, 60] : [16, 48];
	const cx = 40;
	const h = 86 - top;
	const L = cx - hw;
	const R = cx + hw;
	const inn = hw * 0.62;
	let s = fill(`M${f(L)} 86C${f(L - hw * 0.12)} ${f(top + h * 0.45)} ${f(cx - hw * 0.5)} ${f(top + h * 0.05)} ${cx} ${top}C${f(cx + hw * 0.5)} ${f(top + h * 0.05)} ${f(R + hw * 0.12)} ${f(top + h * 0.45)} ${f(R)} 86Z`, "#66745f");
	s += fill(`M${f(cx - inn)} 86C${f(cx - inn)} ${f(top + h * 0.45)} ${f(cx - hw * 0.25)} ${f(top + h * 0.1)} ${cx} ${top}V86Z`, "#8f9c86");
	s += fill(`M${f(cx + inn)} 86C${f(cx + inn)} ${f(top + h * 0.45)} ${f(cx + hw * 0.25)} ${f(top + h * 0.1)} ${cx} ${top}V86Z`, "#aeb8a4");
	const sp: XY[] = [];
	for (const [x, y] of grid(cx, top + h * 0.55, hw * 0.95, h * 0.55, stage === "sprout" ? 2.6 : 3.6, 0.95)) if (y > top + 3 && y < 85) sp.push([x + ((y * 7) % 1.3), y]);
	s += dots(sp, 0.42, "#eef0e6") + strk(`M${cx} ${top + 1}V85`, "#c8d0bc", 0.9);
	const ar: XY[] = [];
	for (let y = top + 4; y < 84; y += stage === "sprout" ? 4 : 5) {
		const t = (y - top) / h;
		ar.push([cx, y], [cx - inn * Math.min(1, t * 1.6), y + 2], [cx + inn * Math.min(1, t * 1.6), y + 2]);
	}
	s += dots(ar, stage === "sprout" ? 0.6 : 0.85, "#806a52");
	if (stage === "bloom") s += flower(40, 44, 12, 7, "#f2d04a", "#f6e27d", "#e0893a", 0.24);
	return s;
}

// ── 12. Feather cactus ──────────────────────────────────────────────────

/** A fluffy dome: a circle whose rim is a ring of scallops, as one path. */
function fluffD(x: number, y: number, r: number): string {
	const n = Math.max(8, Math.round(r * 1.6));
	const s = r * 0.42;
	let d = "";
	for (let i = 0; i <= n; i++) {
		const t = (i * 2 * Math.PI) / n;
		d += `${i ? `A${f(s)} ${f(s)} 0 0 1 ` : "M"}${f(x + Math.cos(t) * r)} ${f(y + Math.sin(t) * r)}`;
	}
	return d;
}

function feather(stage: GrowingStage): string {
	const domes: [number, number, number][] =
		stage === "sprout"
			? [[40, 82, 4.6]]
			: stage === "leafy"
				? [[34, 80, 6], [46, 80, 6], [40, 76, 6.5]]
				: [[29, 78, 7.5], [51, 78, 7.5], [40, 71, 8.5], [34, 82, 6.5], [47, 82, 6.5], [22, 84, 4.5], [58, 84, 4.5]];
	let s = "";
	for (const [x, y, r] of domes) s += fill(circD(x + 0.7, y + 0.8, r * 1.1), "#c3beb1") + fill(fluffD(x - 0.4, y - 0.4, r * 0.9), "#f3f1ea");
	s += dots(domes.flatMap(([x, y, r]) => grid(x, y, r, r, 3.4, 0.7).map(([a, b]) => [a + 0.3, b + 0.4] as XY)), 0.35, "#d6d1c5");
	if (stage === "bloom") {
		const at: XY[] = [[40, 62], [29, 70], [51, 70], [34, 75], [47, 76]];
		s += fill(at.map(([x, y]) => starD(x, y, 6, 2.6, 1)).join(""), "#efb9c4") + dots(at, 0.7, "#d9a542");
	}
	return s;
}

// ── 13. Teddy bear cholla ───────────────────────────────────────────────

function teddyBear(stage: GrowingStage): string {
	let trunk = "";
	let segs: [number, number, number][];
	let rx = 5.8;
	let ry = 3.4;
	if (stage === "sprout") {
		segs = [[40, 81, -90], [37, 72, -110]];
		rx = 4.6;
		ry = 2.8;
	} else if (stage === "leafy") {
		trunk = "M40 87V72";
		segs = [[40, 66, -90], [33, 59, -125], [47, 59, -55], [29, 51, -100], [51, 51, -80], [40, 56, -90]];
	} else {
		trunk = "M40 87V58M40 64L34 58M40 66L47 60";
		segs = [
			[40, 52, -90], [33, 47, -130], [47, 47, -50], [27, 40, -105], [53, 40, -75], [40, 43, -90],
			[35, 33, -100], [45, 33, -80], [22, 32, -95], [58, 32, -85], [40, 25, -90], [29, 25, -110], [52, 25, -70],
		];
	}
	let s = strk(trunk, "#4c3f34", 4.6);
	s += fill(segs.map(([x, y, a]) => ellD(x + 0.6, y + 0.5, rx, ry, a)).join(""), "#bfa564");
	s += fill(segs.map(([x, y, a]) => ellD(x - 0.3, y - 0.3, rx * 0.86, ry * 0.8, a)).join(""), "#e8d59c");
	const pts: XY[] = [];
	for (const [x, y, a] of segs) for (const t of [-0.6, -0.2, 0.2, 0.6]) for (const v of [-1, 1]) pts.push([x + Math.cos(rad(a)) * rx * t - Math.sin(rad(a)) * ry * v * 0.95, y + Math.sin(rad(a)) * rx * t + Math.cos(rad(a)) * ry * v * 0.95]);
	s += dots(pts, 0.7, "#f8efcc");
	if (stage === "bloom") {
		s += fill(ellD(23, 86.5, 4, 2.2, -8) + ellD(58, 87, 4, 2.2, 10), "#d8c286");
		const fl: XY[] = [[22, 25], [58, 25], [40, 18], [29, 18], [52, 18]];
		s += fill(fl.map(([x, y]) => starD(x, y, 6, 3, 1.2)).join(""), "#d6e08a") + dots(fl, 0.8, "#9db54a");
	}
	return s;
}

// ── 14. Senita ──────────────────────────────────────────────────────────

function senita(stage: GrowingStage): string {
	type C = [number, number, number];
	const [cols, w, beard]: [C[], number, number] =
		stage === "sprout"
			? [[[38, 37, 72], [42, 43, 75]], 4.6, 0]
			: stage === "leafy"
				? [[[35, 31, 54], [40, 40, 44], [45, 49, 52]], 5.6, 6]
				: [[[31, 23, 34], [35, 31, 22], [40, 40, 14], [45, 49, 18], [49, 57, 30]], 6.2, 20];
	const colD = (dx: number) => cols.map(([b, t, y]) => `M${f(b + dx)} 86L${f(t + dx)} ${f(y)}`).join("");
	let s = strk(colD(0), "#6b8c4e", w) + strk(colD(-w * 0.25) + colD(w * 0.25), "#46663a", 0.6, ` opacity=".55"`);
	if (beard) {
		const bd = cols.map(([b, t, y]) => {
			const k = beard / (86 - y);
			return `M${f(t)} ${f(y)}L${f(t + (b - t) * k)} ${f(y + beard)}`;
		}).join("");
		s += strk(bd, "#a39f93", w + 0.8);
		const hair: string[] = [];
		for (const [b, t, y] of cols) for (let yy = y + 1.5; yy < y + beard; yy += 2.6) {
			const x = t + ((b - t) * (yy - y)) / (86 - y);
			hair.push(`M${f(x - w / 2 - 1.4)} ${f(yy)}l2 .6M${f(x + w / 2 + 1.4)} ${f(yy + 1.2)}l-2 .6`);
		}
		s += strk(hair.join(""), "#8c887d", 0.6) + dash(bd, "#c9c5ba", w * 0.6, 0.5, 1.2);
	}
	if (stage === "bloom") {
		const at: XY[] = cols.map(([b, t, y], i) => [t + (i % 2 ? 3.6 : -3.6), y + 7]);
		s += fill(at.map(([x, y]) => starD(x, y, 6, 2.8, 1.1)).join(""), "#e88db4") + dots(at, 0.7, "#f6d9e4");
	}
	return s;
}

// ── 15. Chin cactus ─────────────────────────────────────────────────────

function chin(stage: GrowingStage): string {
	const [cy, rx, ry, n] = stage === "sprout" ? [83, 6, 4, 5] : stage === "leafy" ? [80, 10.5, 7, 7] : [78.5, 15, 9.5, 9];
	let s = fill(ellD(40, cy, rx, ry), "#5c7050") + strk(meridiansD(40, cy, rx, ry, n), "#43553a", 0.7, ` opacity=".7"`);
	const pts = meridianPts(40, cy, rx, ry, n, stage === "sprout" ? [0.4, 0.7] : [0.25, 0.48, 0.72]);
	s += fill(pts.map(([x, y]) => ellD(x, y + 1, 1.8, 1.3)).join(""), "#728863");
	s += dots(pts, 0.6, "#d8ceb2") + strk(pts.map(([x, y]) => `M${f(x)} ${f(y)}q-1.6 .2 -2.3 1.4M${f(x)} ${f(y)}q1.6 .2 2.3 1.4`).join(""), "#d2c7a8", 0.4);
	if (stage === "bloom") {
		const fl = (x: number, y: number) =>
			strk(`M${x} ${y + 9}V${y + 3}`, "#7f966a", 2.6) +
			fill([-150, -125, -105, -75, -55, -30].map((a) => lensD(x, y + 3, a, 8.5, 2.3)).join(""), "#f4dce1") +
			fill([-125, -90, -55].map((a) => lensD(x, y + 3, a, 5, 1.8)).join(""), "#df7f97");
		s += fl(34, 63) + fl(47, 61);
	}
	return s;
}

// ── 16. Brain cactus ────────────────────────────────────────────────────

function waveD(x0: number, x1: number, n: number, y: (x: number) => number, amp: number): string {
	const step = (x1 - x0) / n;
	let d = `M${f(x0)} ${f(y(x0))}`;
	for (let i = 0; i < n; i++) {
		const xa = x0 + step * (i + 0.5);
		const xb = x0 + step * (i + 1);
		d += `Q${f(xa)} ${f(y(xa) - (i % 2 ? -amp : amp))} ${f(xb)} ${f(y(xb))}`;
	}
	return d;
}

function brain(stage: GrowingStage): string {
	const [x0, x1, top, n] = stage === "sprout" ? [35, 45, 79, 3] : stage === "leafy" ? [27, 53, 68, 6] : [18, 62, 56, 9];
	const hw = (x1 - x0) / 2;
	const yTop = (dy: number) => (x: number) => top + dy + ((x - 40) / hw) ** 2 * (86 - top) * 0.35;
	const crest = waveD(x0, x1, n, yTop(0), 5);
	let s = fill(`${crest}C${f(x1 + 2)} ${f(yTop(0)(x1) + 8)} ${f(x1 - 2)} 84 ${f(x1 - 4)} 87H${f(x0 + 4)}C${f(x0 + 2)} 84 ${f(x0 - 2)} ${f(yTop(0)(x0) + 8)} ${f(x0)} ${f(yTop(0)(x0))}Z`, "#5f8f42");
	let ridges = crest;
	const rows = stage === "sprout" ? [] : stage === "leafy" ? [5.5] : [6, 12, 18];
	for (const dy of rows) ridges += waveD(x0 + dy * 0.5, x1 - dy * 0.5, n - (dy > 10 ? 2 : 1), yTop(dy), 4);
	s += strk(ridges, "#86b25c", 2.6) + dash(ridges, "#e6ca6a", 2, 0.5, 0.8);
	if (stage === "bloom") {
		const at: XY[] = [];
		for (let i = 1; i < n; i += 2) {
			const x = x0 + ((x1 - x0) / n) * (i + 0.5);
			at.push([x, yTop(0)(x) - 4.5]);
		}
		s += fill(at.map(([x, y]) => starD(x, y, 6, 2.8, 1.1)).join(""), "#f5e6b0") + dots(at, 0.7, "#e0a35a");
	}
	return s;
}

// ── 17. Turk's cap cactus ───────────────────────────────────────────────

function turksCap(stage: GrowingStage): string {
	const [cy, rx, ry, n] = stage === "sprout" ? [82, 5.5, 5, 4] : stage === "leafy" ? [76, 11.5, 10.5, 7] : [74, 14, 12.5, 9];
	let s = fill(ellD(40, cy, rx, ry), "#4d8a56") + strk(meridiansD(40, cy, rx, ry, n), "#2f5f3a", 0.8, ` opacity=".6"`);
	s += dots(meridianPts(40, cy, rx, ry, n, [0.25, 0.5, 0.75]), 0.6, "#e5dcc0");
	if (stage === "leafy") s += fill(ellD(40, cy - ry + 0.8, 4, 1.6), "#c76a52");
	if (stage === "bloom") {
		const t = cy - ry + 1;
		const top = 46;
		s += fill(`M31 ${t}V${top + 6}Q31 ${top} 40 ${top}Q49 ${top} 49 ${top + 6}V${t}Z`, "#b5423a");
		const wool: string[] = [];
		for (let y = top + 2.5; y < t - 0.5; y += 2.2) wool.push(`M31.6 ${f(y)}H48.4`);
		s += dash(wool.join(""), "#e9c2b2", 1, 0.5, 1.1, 0.8);
		s += strk(`M31.5 ${f(top + 3)}l-1.6 -1M48.5 ${f(top + 3)}l1.6 -1M34 ${top}.6l-.6 -1.8M46 ${top}.6l.6 -1.8M40 ${top}l0 -1.8`, "#8e2f2a", 0.6);
		s += fill(lensD(36, top + 1, -105, 6, 1.6) + lensD(43, top + 1, -80, 6, 1.6) + lensD(49, top + 8, -30, 5, 1.4), "#ec5d9e") + fill(ellD(31, top + 10, 1.4, 2.6, 20) + ellD(39.5, top - 1, 1.3, 2.4), "#d94c6e");
	}
	return s;
}

// ── 18. Silver torch ────────────────────────────────────────────────────

function silverTorch(stage: GrowingStage): string {
	const [cols, w]: [[number, number, number][], number] =
		stage === "sprout"
			? [[[40, 40, 70]], 4.6]
			: stage === "leafy"
				? [[[37, 34, 46], [40, 41, 38], [43, 47, 50]], 5]
				: [[[34, 26, 26], [37, 33, 12], [40, 40, 8], [43, 46, 16], [46, 54, 30]], 5.4];
	const d = cols.map(([b, t, y]) => `M${b} 86L${t} ${y}`).join("");
	let s = strk(d, "#b4bcae", w) + strk(cols.map(([b, t, y]) => `M${b - 0.6} 86L${t - 0.6} ${y}`).join(""), "#d9ddd3", w * 0.62);
	s += dash(d, "#8f9886", w * 0.95, 0.5, 1.1, 0.45);
	if (stage === "bloom") {
		const fl = new Ink();
		const tips: XY[] = [];
		cols.forEach(([b, t, y], i) => {
			for (const k of [0.25, 0.5]) {
				const yy = y + (86 - y) * k;
				const x = t + (b - t) * k;
				const side = (i + (k > 0.3 ? 1 : 0)) % 2 ? 1 : -1;
				const a = side > 0 ? -25 : -155;
				const sx = x + side * w * 0.4;
				fl.add("#cf3838", lensD(sx, yy, a, 8, 1.9));
				tips.push([sx + Math.cos(rad(a)) * 7.6, yy + Math.sin(rad(a)) * 7.6]);
			}
		});
		s += fl + dots(tips, 0.7, "#5c9e4a");
	}
	return s;
}

// ── 19. Powder puff cactus ──────────────────────────────────────────────

function powderPuff(stage: GrowingStage): string {
	const balls: [number, number, number][] =
		stage === "sprout"
			? [[40, 82, 5]]
			: stage === "leafy"
				? [[33, 81, 6], [47, 81, 6], [40, 76, 7]]
				: [[29, 80, 7], [51, 80, 7], [40, 76, 8.5], [34, 67, 6], [47, 67, 6.5]];
	let s = "";
	for (const [x, y, r] of balls) s += fill(circD(x + 0.6, y + 0.6, r), "#4f7c63") + fill(circD(x - 0.3, y - 0.3, r * 0.9), "#77a68a");
	const rings = balls.map(([x, y, r]) => circD(x - 0.3, y - 0.3, r * 0.72) + circD(x - 0.3, y - 0.3, r * 0.42) + circD(x - 0.3, y - 0.3, r * 0.14)).join("");
	s += dash(rings, "#f6f6f0", 2.2, 0.35, 0.8, 0.85);
	if (stage === "bloom") {
		const fl: XY[] = [];
		for (const [x, y, r] of balls) for (const a of [-125, -55]) fl.push([x + Math.cos(rad(a)) * r * 0.85, y + Math.sin(rad(a)) * r * 0.85]);
		s += fill(fl.map(([x, y]) => starD(x, y, 6, 2.4, 0.9)).join(""), "#f3e8bb") + dots(fl, 0.5, "#d6a83e");
		s += fill(ellD(23, 76, 1, 2.4, -30) + ellD(57, 75, 1, 2.4, 30) + ellD(41, 60, 1, 2.4, 10), "#c93c3c");
	}
	return s;
}

// ── 20. Lady finger cactus ──────────────────────────────────────────────

function ladyFinger(stage: GrowingStage): string {
	const f0: [number, number, number, number][] =
		stage === "sprout"
			? [[39, 85, -100, 9], [42, 85, -70, 7]]
			: stage === "leafy"
				? [[38, 85, -100, 18], [42, 85, -78, 16], [35, 86, -150, 13], [45, 86, -30, 13], [40, 85, -88, 10]]
				: [
						[38, 85, -100, 24], [42, 85, -80, 22], [35, 86, -128, 20], [45, 86, -52, 20], [33, 86, -160, 18], [47, 86, -20, 18],
						[40, 84, -90, 14], [36, 86, -112, 12], [44, 86, -68, 12], [37, 86, -175, 11], [43, 86, -5, 11],
					];
	const d = f0.map(([x, y, a, l]) => `M${x} ${y}l${f(Math.cos(rad(a)) * l)} ${f(Math.sin(rad(a)) * l)}`).join("");
	let s = strk(d, "#5e8a43", 5.4) + strk(d, "#7fae5b", 3.6) + dash(d, "#e2c25c", 5.2, 0.6, 1.2, 0.95);
	if (stage === "bloom") {
		const at: XY[] = [0, 3, 4, 5].map((i) => {
			const [x, y, a, l] = f0[i]!;
			return [x + Math.cos(rad(a)) * l * 0.75 - Math.sin(rad(a)) * 3.4, y + Math.sin(rad(a)) * l * 0.75 + Math.cos(rad(a)) * 3.4];
		});
		at.push([40 + Math.cos(rad(-80)) * 22 * 0.6 + 3.4, 85 + Math.sin(rad(-80)) * 22 * 0.6]);
		s += fill(at.map(([x, y]) => starD(x, y, 6, 2.7, 1.1)).join(""), "#f4e7a8") + dots(at, 0.6, "#d58d3c");
	}
	return s;
}

// ── 21. Cardón ──────────────────────────────────────────────────────────

function cardon(stage: GrowingStage): string {
	let trunk: string;
	let back: string[];
	let front: string[];
	let w: number;
	if (stage === "sprout") {
		trunk = "";
		back = [];
		front = ["M40 86V68"];
		w = 8;
	} else if (stage === "leafy") {
		trunk = "M40 87V76";
		back = ["M38 78Q30 78 30 66V48"];
		front = ["M40 86V36", "M42 78Q51 78 51 66V52"];
		w = 8;
	} else {
		trunk = "M40 87V72";
		back = ["M38 74Q30 72 30 52V12", "M42 74Q50 72 50 50V10"];
		front = ["M37 76Q19 76 19 54V24", "M40 86V8", "M43 76Q61 76 61 54V20"];
		w = 9;
	}
	let s = strk(trunk, "#6c8a76", 15) + strk(back.join(""), "#6c8a76", w) + strk(front.join(""), "#86a58f", w);
	const all = [...back, ...front];
	s += strk(xShift(all, -w * 0.3) + xShift(all, 0) + xShift(all, w * 0.3), "#4d6b57", 0.6, ` opacity=".55"`);
	if (stage === "bloom") {
		const tips: XY[] = [[30, 9], [50, 7], [19, 21], [40, 5.5], [61, 17]];
		s += fill(tips.map(([x, y]) => starD(x, y, 7, 3.4, 1.2)).join(""), "#f1ede0") + dots(tips, 0.8, "#e0c25a");
	}
	return s;
}

/** Shifts the x of every "x y" pair in a path made of M/Q/V commands. */
function xShift(ds: string[], dx: number): string {
	return ds
		.map((d) => {
			const tokens = d.match(/[MQV]|-?\d+(\.\d+)?/g) ?? [];
			let out = "";
			let cmd = "";
			let idx = 0;
			for (const t of tokens) {
				if (/[MQV]/.test(t)) {
					cmd = t;
					idx = 0;
					out += t;
					continue;
				}
				const n = +t;
				const isX = cmd !== "V" && idx % 2 === 0;
				out += (idx > 0 ? " " : "") + f(isX ? n + dx : n);
				idx++;
			}
			return out;
		})
		.join("");
}

// ── 22. Mistletoe cactus ────────────────────────────────────────────────

function mistletoe(stage: GrowingStage): string {
	const strands: [number, number, number][] =
		stage === "sprout"
			? [[34, 74, 76], [44, 72, 78], [39, 70, 72]]
			: stage === "leafy"
				? [[22, 62, 80], [30, 56, 72], [36, 52, 60], [44, 52, 62], [50, 56, 72], [58, 62, 80], [27, 64, 86], [53, 64, 86]]
				: [[10, 50, 84], [16, 44, 74], [24, 40, 66], [31, 36, 52], [37, 34, 44], [43, 34, 46], [49, 36, 54], [56, 40, 66], [64, 44, 74], [70, 50, 84], [20, 56, 86], [60, 56, 86], [28, 50, 80], [52, 50, 80]];
	let d = "";
	const ends: XY[] = [];
	const forks: XY[] = [];
	for (const [ex, peak, ey] of strands) {
		const px = 40 + (ex - 40) * 0.35;
		d += `M40 85C${f(40 + (ex - 40) * 0.05)} ${f(peak)} ${f(ex - (ex - 40) * 0.15)} ${f(peak - 4)} ${f(ex)} ${f(ey)}`;
		if (stage !== "sprout") {
			const fx = px + (ex - 40) * 0.25;
			const fy = peak + 2;
			d += `M${f(fx)} ${f(fy)}q${f((ex - 40) * 0.15)} -2 ${f((ex - 40) * 0.22 + (ex > 40 ? 1 : -1))} ${f(Math.min(14, ey - fy) * 0.6)}`;
			forks.push([fx + (ex - 40) * 0.22 + (ex > 40 ? 1 : -1), fy + Math.min(14, ey - fy) * 0.6]);
		}
		ends.push([ex, ey]);
	}
	let s = strk(d, "#86b964", stage === "sprout" ? 1.4 : 1.3);
	if (stage === "bloom") {
		const b = [...ends.filter((_e, i) => i % 2 === 0).map(([x, y]) => [x, Math.min(y, 85)] as XY), ...forks.filter((_e, i) => i % 3 !== 1)];
		s += dots(b, 1.25, "#f0d6e0") + dots(b.map(([x, y]) => [x - 0.4, y - 0.4] as XY), 0.4, "#ffffff");
	}
	return s;
}

// ── 23. Dancing bones cactus ────────────────────────────────────────────

function bottleD(x: number, y: number, deg: number, len: number, w: number): string {
	const P = mapper(x, y, deg);
	return `M${P(0, -0.7)}C${P(len * 0.5, -0.8)} ${P(len * 0.5, -w)} ${P(len * 0.78, -w)}C${P(len * 1.04, -w)} ${P(len * 1.04, w)} ${P(len * 0.78, w)}C${P(len * 0.5, w)} ${P(len * 0.5, 0.8)} ${P(0, 0.7)}Z`;
}

function dancingBones(stage: GrowingStage): string {
	const depth = stage === "sprout" ? 1 : stage === "leafy" ? 2 : 3;
	const lens = [10, 9, 8];
	let d = "";
	const tips: [number, number, number][] = [];
	const grow = (x: number, y: number, a: number, k: number) => {
		const l = lens[k]!;
		d += bottleD(x, y, a, l, 1.9 - k * 0.2);
		const ex = x + Math.cos(rad(a)) * l * 0.95;
		const ey = y + Math.sin(rad(a)) * l * 0.95;
		if (k + 1 < depth) {
			grow(ex, ey, a - 24, k + 1);
			grow(ex, ey, a + 24, k + 1);
		} else tips.push([ex, ey, a]);
	};
	const bases = stage === "sprout" ? [-98, -78] : [-125, -90, -55];
	for (const a of bases) grow(40, 86, a, 0);
	let s = fill(d, "#78a84f");
	if (stage === "bloom") s += fill(tips.map(([x, y, a]) => lensD(x, y, a, 4.2, 1.8)).join(""), "#f0a43a") + dots(tips.map(([x, y, a]) => [x + Math.cos(rad(a)) * 3.6, y + Math.sin(rad(a)) * 3.6] as XY), 0.6, "#f7d77a");
	return s;
}

// ── 24. Snowball cactus ─────────────────────────────────────────────────

function snowball(stage: GrowingStage): string {
	const [cy, r] = stage === "sprout" ? [82.5, 5] : stage === "leafy" ? [77, 10] : [71.5, 15.5];
	let s = fill(ellD(40.6, cy + 0.6, r, r * 0.97), "#bdb9ac") + fill(ellD(39.5, cy - 0.5, r * 0.9, r * 0.88), "#efeee7");
	const rings: string[] = [];
	for (let k = 0.85; k > 0.1; k -= 0.22) rings.push(ellD(39.5, cy - 0.5, r * k * 0.9, r * k * 0.88));
	s += dash(rings.join(""), "#cfccc0", 1.4, 0.4, 1.1, 0.9) + dots(grid(40, cy, r, r, stage === "sprout" ? 2.6 : 3.4, 0.7), 0.35, "#8fb07a");
	if (stage === "bloom") {
		const at: XY[] = [];
		for (const a of [-170, -140, -110, -70, -40, -10]) at.push([40 + Math.cos(rad(a)) * r * 0.62, cy - r * 0.62 + Math.sin(rad(a)) * 4]);
		at.push([40, cy - r - 1.5]);
		s += fill(at.map(([x, y]) => starD(x, y, 7, 3.2, 1.2)).join(""), "#e3739f") + dots(at, 0.7, "#f6d873");
	}
	return s;
}

// ── 25. Thimble cactus ──────────────────────────────────────────────────

function thimble(stage: GrowingStage): string {
	const balls: XY[] =
		stage === "sprout"
			? [[38, 83], [42.5, 80]]
			: stage === "leafy"
				? [[30, 83], [37, 84], [44, 83], [51, 84], [34, 77], [41, 76], [48, 78], [39, 70]]
				: [
						[24, 84], [31, 84], [38, 85], [45, 84], [52, 84], [58, 85],
						[28, 77], [35, 77], [42, 76], [49, 77], [55, 78],
						[32, 70], [39, 69], [46, 70], [52, 71],
						[36, 62], [43, 62], [49, 64], [40, 55],
					];
	const [rx, ry] = [3.6, 4.2];
	let s = fill(balls.map(([x, y]) => ellD(x + 0.5, y + 0.6, rx, ry)).join(""), "#4f7e45") + fill(balls.map(([x, y]) => ellD(x - 0.3, y - 0.3, rx * 0.86, ry * 0.86)).join(""), "#7db267");
	s += spineStars(balls.flatMap(([x, y]) => [[x - 1.1, y - 1.4], [x + 1.3, y + 0.8]] as XY[]), 1.3, "#f4f2ea", 0.45);
	if (stage === "bloom") {
		const at: XY[] = [[27, 73], [53, 74], [36, 66], [46, 59], [40, 50], [31, 80], [56, 81]];
		s += fill(at.map(([x, y]) => starD(x, y, 6, 2.6, 1)).join(""), "#efe4b0") + dots(at, 0.6, "#cf9a3a");
	}
	return s;
}

// ── registry ─────────────────────────────────────────────────────────────

export const SPECIES: Species[] = [
	{ id: "organ-pipe-cactus", name: "Organ pipe cactus", draw: organPipe },
	{ id: "hedgehog-cactus", name: "Hedgehog cactus", draw: hedgehog },
	{ id: "rat-tail-cactus", name: "Rat tail cactus", draw: ratTail },
	{ id: "peruvian-apple-cactus", name: "Peruvian apple cactus", draw: peruvianApple },
	{ id: "totem-pole-cactus", name: "Totem pole cactus", draw: totemPole },
	{ id: "easter-cactus", name: "Easter cactus", draw: easter },
	{ id: "orchid-cactus", name: "Orchid cactus", draw: orchidCactus },
	{ id: "dragon-fruit-cactus", name: "Dragon fruit cactus", draw: dragonFruit },
	{ id: "queen-of-the-night", name: "Queen of the night", draw: queenOfTheNight },
	{ id: "fishhook-barrel-cactus", name: "Fishhook barrel cactus", draw: fishhookBarrel },
	{ id: "bishops-cap", name: "Bishop's cap", draw: bishopsCap },
	{ id: "feather-cactus", name: "Feather cactus", draw: feather },
	{ id: "teddy-bear-cholla", name: "Teddy bear cholla", draw: teddyBear },
	{ id: "senita", name: "Senita", draw: senita },
	{ id: "chin-cactus", name: "Chin cactus", draw: chin },
	{ id: "brain-cactus", name: "Brain cactus", draw: brain },
	{ id: "turks-cap-cactus", name: "Turk's cap cactus", draw: turksCap },
	{ id: "silver-torch", name: "Silver torch", draw: silverTorch },
	{ id: "powder-puff-cactus", name: "Powder puff cactus", draw: powderPuff },
	{ id: "lady-finger-cactus", name: "Lady finger cactus", draw: ladyFinger },
	{ id: "cardon", name: "Cardón", draw: cardon },
	{ id: "mistletoe-cactus", name: "Mistletoe cactus", draw: mistletoe },
	{ id: "dancing-bones-cactus", name: "Dancing bones cactus", draw: dancingBones },
	{ id: "snowball-cactus", name: "Snowball cactus", draw: snowball },
	{ id: "thimble-cactus", name: "Thimble cactus", draw: thimble },
];
