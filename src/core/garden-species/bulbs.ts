/**
 * Garden species, family: bulbs and corms. Each draws sprout, leafy and
 * bloom in the kit's flat style (see kit.ts); the kit draws soil and seed.
 */
import { circle, f, GREEN, leaf, type GrowingStage, type Species } from "./kit";

/* ---------- private helpers ---------- */

type Bez = readonly [readonly [number, number], readonly [number, number], readonly [number, number], readonly [number, number]];

/** A filled path. */
const p = (d: string, fill: string): string => `<path d="${d}" fill="${fill}"/>`;

/** A stroked path with round caps. */
const sk = (d: string, stroke: string, w: number): string => `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${f(w)}" stroke-linecap="round"/>`;

/** A rotated ellipse. */
function el(cx: number, cy: number, rx: number, ry: number, fill: string, rot = 0): string {
	const t = rot ? ` transform="rotate(${f(rot)} ${f(cx)} ${f(cy)})"` : "";
	return `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}" fill="${fill}"${t}/>`;
}

/** A group translated to (x, y), rotated and scaled. */
function g(x: number, y: number, body: string, rot = 0, sx = 1, sy = sx): string {
	const r = rot ? ` rotate(${f(rot)})` : "";
	const s = sx !== 1 || sy !== 1 ? ` scale(${f(sx)} ${f(sy)})` : "";
	return `<g transform="translate(${f(x)} ${f(y)})${r}${s}">${body}</g>`;
}

/** Subpath of a circle. */
function dotSub(x: number, y: number, r: number): string {
	return `M${f(x - r)} ${f(y)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0`;
}

/** Many dots of one colour in one path. */
function dots(pts: readonly (readonly [number, number])[], r: number, fill: string): string {
	return pts.length ? p(pts.map(([x, y]) => dotSub(x, y, r)).join(""), fill) : "";
}

/** Subpath of a rotated ellipse. */
function ovalSub(cx: number, cy: number, rx: number, ry: number, rot: number): string {
	const r = (rot * Math.PI) / 180;
	const dx = Math.cos(r) * rx;
	const dy = Math.sin(r) * rx;
	const a = `A${f(rx)} ${f(ry)} ${f(rot)} 1 0`;
	return `M${f(cx + dx)} ${f(cy + dy)}${a} ${f(cx - dx)} ${f(cy - dy)}${a} ${f(cx + dx)} ${f(cy + dy)}Z`;
}

/** n oval petals around (x, y) in one path, long axis radial. */
function ring(x: number, y: number, n: number, r: number, rx: number, ry: number, fill: string, off = 0): string {
	let d = "";
	for (let i = 0; i < n; i++) {
		const a = off + (i * 360) / n;
		const t = (a * Math.PI) / 180;
		d += ovalSub(x + Math.cos(t) * r, y + Math.sin(t) * r, rx, ry, a);
	}
	return p(d, fill);
}

/** Subpath of a pointed lens from (x, y) heading `deg`, `len` long and about 2w wide. */
function lensSub(x: number, y: number, deg: number, len: number, w: number): string {
	const r = (deg * Math.PI) / 180;
	const c = Math.cos(r);
	const sn = Math.sin(r);
	const mx = x + c * len * 0.45;
	const my = y + sn * len * 0.45;
	const k = w * 1.25;
	return `M${f(x)} ${f(y)}Q${f(mx - sn * k)} ${f(my + c * k)} ${f(x + c * len)} ${f(y + sn * len)}Q${f(mx + sn * k)} ${f(my - c * k)} ${f(x)} ${f(y)}Z`;
}

/** A ring of pointed petals around (x, y), as a subpath. */
function starSub(x: number, y: number, n: number, len: number, w: number, off = -90): string {
	let d = "";
	for (let i = 0; i < n; i++) d += lensSub(x, y, off + (i * 360) / n, len, w);
	return d;
}

/** A strap leaf from (x0, y0) to the tip (tx, ty), half-width w, bowed sideways by `bend`. */
function strapSub(x0: number, y0: number, tx: number, ty: number, w: number, bend = 0): string {
	const dx = tx - x0;
	const dy = ty - y0;
	const L = Math.hypot(dx, dy) || 1;
	const nx = -dy / L;
	const ny = dx / L;
	const mx = (x0 + tx) / 2 + nx * bend;
	const my = (y0 + ty) / 2 + ny * bend;
	return `M${f(x0 + nx * w)} ${f(y0 + ny * w)}Q${f(mx + nx * w)} ${f(my + ny * w)} ${f(tx)} ${f(ty)}Q${f(mx - nx * w)} ${f(my - ny * w)} ${f(x0 - nx * w)} ${f(y0 - ny * w)}Z`;
}

/** Strap leaves from the ground: [x0, tipX, tipY, halfWidth, bend]. */
type Strap = readonly [number, number, number, number, number?];
function straps(list: readonly Strap[], fill: string): string {
	return p(list.map(([x0, tx, ty, w, b]) => strapSub(x0, 87, tx, ty, w, b ?? 0)).join(""), fill);
}

/** A light stripe down the middle of each strap (crocus, star of Bethlehem). */
function stripes(list: readonly Strap[], fill: string): string {
	let d = "";
	for (const [x0, tx, ty, , b = 0] of list) {
		const dx = tx - x0;
		const dy = ty - 87;
		const L = Math.hypot(dx, dy) || 1;
		const mx = (x0 + tx) / 2 + (-dy / L) * b * 0.9;
		const my = (87 + ty) / 2 + (dx / L) * b * 0.9;
		d += `M${f(x0)} 86Q${f(mx)} ${f(my)} ${f(x0 + dx * 0.85)} ${f(87 + dy * 0.85)}`;
	}
	return sk(d, fill, 0.5);
}

/** A cubic as path data. */
const cub = (c: Bez): string => `M${f(c[0][0])} ${f(c[0][1])}C${f(c[1][0])} ${f(c[1][1])} ${f(c[2][0])} ${f(c[2][1])} ${f(c[3][0])} ${f(c[3][1])}`;

/** A point on a cubic at t, and the tangent direction in degrees. */
function at(c: Bez, t: number): [number, number, number] {
	const u = 1 - t;
	const pt = (i: 0 | 1) => u * u * u * c[0][i] + 3 * u * u * t * c[1][i] + 3 * u * t * t * c[2][i] + t * t * t * c[3][i];
	const dv = (i: 0 | 1) => 3 * u * u * (c[1][i] - c[0][i]) + 6 * u * t * (c[2][i] - c[1][i]) + 3 * t * t * (c[3][i] - c[2][i]);
	return [pt(0), pt(1), (Math.atan2(dv(1), dv(0)) * 180) / Math.PI];
}

/* ---------- 1. Crocus ---------- */
const CRO = { a: "#9a6cd8", b: "#7a4bbd", vein: "#5e3596", tube: "#dfe6d6", stig: "#f08a24", leaf: "#5f9e50" };
function crocusCup(x: number, y: number, k: number, a: string, b: string, vein: string, stig = CRO.stig): string {
	return (
		sk(`M${f(x)} 87L${f(x)} ${f(y)}`, CRO.tube, 1.3 * k) +
		el(x - 2.7 * k, y - 4.6 * k, 2.5 * k, 5.4 * k, b, -14) +
		el(x + 2.7 * k, y - 4.6 * k, 2.5 * k, 5.4 * k, b, 14) +
		sk(`M${f(x)} ${f(y - 4 * k)}L${f(x)} ${f(y - 9.4 * k)}M${f(x)} ${f(y - 8.4 * k)}l${f(-1.1 * k)} ${f(-1.3 * k)}M${f(x)} ${f(y - 8.4 * k)}l${f(1.1 * k)} ${f(-1.3 * k)}`, stig, 0.9 * k) +
		el(x, y - 3.6 * k, 2.9 * k, 5 * k, a) +
		sk(`M${f(x)} ${f(y - 0.5 * k)}L${f(x)} ${f(y - 6.5 * k)}M${f(x - 1.2 * k)} ${f(y - 1 * k)}L${f(x - 1.4 * k)} ${f(y - 5 * k)}M${f(x + 1.2 * k)} ${f(y - 1 * k)}L${f(x + 1.4 * k)} ${f(y - 5 * k)}`, vein, 0.45 * k)
	);
}
function crocus(stage: GrowingStage): string {
	if (stage === "sprout") {
		const L: Strap[] = [[38, 34, 72, 0.9], [40, 40, 69, 0.9], [42, 45, 73, 0.9], [39.5, 37, 75, 0.8]];
		return straps(L, CRO.leaf) + stripes(L, "#e6efdc");
	}
	const big = stage === "bloom";
	const k = big ? 1 : 0.85;
	const L: Strap[] = [[37, 22, 58 / k, 1, -3], [38, 30, 50, 1, -2], [40, 40, 47, 1], [42, 50, 51, 1, 2], [43, 58, 58 / k, 1, 3], [39, 34, 60, 0.9, -1], [41, 46, 60, 0.9, 1]];
	let s = straps(L, CRO.leaf) + stripes(L, "#e6efdc");
	if (!big) return s + crocusCup(37, 70, 0.7, "#c8b3e6", "#9a7ac8", CRO.vein, "#c8b3e6") + crocusCup(44, 74, 0.6, "#c8b3e6", "#9a7ac8", CRO.vein, "#c8b3e6");
	s += crocusCup(31, 70, 1.2, CRO.a, CRO.b, CRO.vein) + crocusCup(49, 68, 1.25, CRO.a, CRO.b, CRO.vein);
	return s + crocusCup(40, 76, 1.3, "#b38be4", CRO.b, CRO.vein);
}

/* ---------- 2. Snowdrop ---------- */
const SD = { leaf: "#7a9f8b", w: "#f7f7f1", sh: "#bfc9b8", g: "#5f9e50", stem: "#5d8a62" };
function snowHead(x: number, y: number, k: number, dir: number): string {
	return (
		el(x, y, 1.2 * k, 1.5 * k, SD.g) +
		el(x, y + 8.4 * k, 1.5 * k, 1.5 * k, SD.w) +
		el(x, y + 8.6 * k, 0.9 * k, 0.6 * k, SD.g) +
		el(x - 2.3 * k, y + 5 * k, 1.8 * k, 4.2 * k, SD.sh, 20) +
		el(x + 2.3 * k, y + 5 * k, 1.8 * k, 4.2 * k, SD.sh, -20) +
		el(x + dir * 0.4 * k, y + 5.2 * k, 2.1 * k, 4.4 * k, SD.w)
	);
}
function snowStem(x0: number, top: number, dir: number): string {
	return sk(`M${f(x0)} 87C${f(x0)} ${f(top + 12)} ${f(x0)} ${f(top - 2)} ${f(x0 + dir * 5)} ${f(top + 2)}`, SD.stem, 1.2) + p(lensSub(x0 + dir * 0.4, top + 1, -90 + dir * 40, 4, 0.8), SD.g);
}
function snowdrop(stage: GrowingStage): string {
	if (stage === "sprout") return straps([[39, 37.5, 72, 1.5], [41, 42, 71, 1.5]], SD.leaf) + el(40, 71, 1.3, 2.4, SD.w);
	if (stage === "leafy") {
		return straps([[38, 33, 56, 1.7, -2], [42, 47, 54, 1.7, 2], [40, 40, 62, 1.5]], SD.leaf) + snowStem(40, 54, 1) + el(45, 59, 1.6, 3.4, SD.w);
	}
	let s = straps([[33, 24, 56, 1.7, -3], [35, 32, 48, 1.7, -1], [43, 46, 46, 1.7, 1], [45, 56, 54, 1.7, 3], [39, 38, 60, 1.5]], SD.leaf);
	s += snowStem(34, 46, -1) + snowStem(43, 40, 1) + snowStem(39, 56, 1);
	return s + snowHead(29, 48, 1, -1) + snowHead(48, 42, 1.1, 1) + snowHead(44, 58, 0.95, 1);
}

/* ---------- 3. Grape hyacinth ---------- */
const GH = { a: "#4b5cc8", b: "#8796e6", back: "#2f3c94", rim: "#d9def8", leaf: "#6aa15a" };
function grape(x: number, yb: number, h: number, hw: number): string {
	const n = Math.max(2, Math.round(h / 2.1));
	const lo: [number, number][] = [];
	const hi: [number, number][] = [];
	const rim: [number, number][] = [];
	for (let j = 0; j < n; j++) {
		const y = yb - j * 2.1;
		const w = hw * (1 - (0.6 * j) / n);
		const m = Math.max(1, Math.round((2 * w) / 2.6) + (j % 2));
		for (let i = 0; i < m; i++) {
			const px = m === 1 ? x : x - w + (2 * w * i) / (m - 1);
			(j > n * 0.62 ? hi : lo).push([px, y]);
			if (j <= n * 0.62) rim.push([px, y + 0.8]);
		}
	}
	const back = p(`M${f(x - hw - 0.8)} ${f(yb + 1)}Q${f(x - hw)} ${f(yb - h * 0.6)} ${f(x)} ${f(yb - h - 1)}Q${f(x + hw)} ${f(yb - h * 0.6)} ${f(x + hw + 0.8)} ${f(yb + 1)}Z`, GH.back);
	return back + dots(lo, 1.25, GH.a) + dots(hi, 1.1, GH.b) + dots(rim.filter((_, i) => i % 2 === 0), 0.4, GH.rim);
}
function grapeHyacinth(stage: GrowingStage): string {
	if (stage === "sprout") return straps([[38, 32, 74, 0.9, -2], [40, 39, 70, 0.9], [42, 47, 74, 0.9, 2]], GH.leaf);
	const L: Strap[] = [[36, 16, 74, 1.1, -7], [37, 24, 62, 1.1, -5], [39, 34, 58, 1, -2], [41, 47, 58, 1, 2], [43, 56, 62, 1.1, 5], [44, 64, 74, 1.1, 7]];
	if (stage === "leafy") return straps(L, GH.leaf) + sk("M40 87L40 70", GREEN.dark, 1.3) + grape(40, 70, 7, 2.6).replace(GH.back, "#3f6f8a");
	let s = straps(L, GH.leaf) + sk("M33 87L33 66M40 87L40 60M47 87L47 68", GREEN.dark, 1.5);
	return s + grape(33, 66, 14, 3.6) + grape(47, 68, 13, 3.4) + grape(40, 60, 17, 4);
}

/* ---------- 4. Giant allium ---------- */
const AL = { a: "#7e4fbf", b: "#9b6ad6", c: "#c6a2ee", leaf: "#7fa36a", stem: "#5c8a4a" };
function giantAllium(stage: GrowingStage): string {
	const L: Strap[] = [[38, 18, 80, 2.6, -4], [42, 62, 80, 2.6, 4], [40, 30, 70, 2.4, -3]];
	if (stage === "sprout") return straps([[38, 33, 70, 2.4, -1], [42, 47, 72, 2.4, 1]], AL.leaf);
	if (stage === "leafy") return straps(L, AL.leaf) + sk("M40 87L40 48", AL.stem, 2.2) + p("M40 34Q36 40 37 46Q40 49 43 46Q44 40 40 34Z", "#d8d3b8");
	let s = straps(L, AL.leaf) + sk("M40 87C40 60 41 45 40 32", AL.stem, 2.2) + circle(40, 22, 13, AL.a) + circle(39, 20.6, 11.4, AL.b);
	const pts: [number, number][] = [];
	for (let i = 0; i < 44; i++) {
		const r = 11.2 * Math.sqrt((i + 0.5) / 44);
		const t = i * 2.39996;
		pts.push([40 + Math.cos(t) * r, 22 + Math.sin(t) * r]);
	}
	return s + dots(pts, 1.15, AL.c);
}

/* ---------- 5. Freesia ---------- */
const FR = { a: "#f3cb45", b: "#f8e08a", throat: "#e48a24", bud: "#b7c96a", leaf: "#6aa45a" };
function funnel(x: number, y: number, k: number, rot: number): string {
	const body = p("M-.8 0L-3 -6Q0 -7.5 3 -6L.8 0Z", FR.a) + p(ovalSub(-2.6, -7, 1.9, 1.5, -20) + ovalSub(2.6, -7, 1.9, 1.5, 20) + ovalSub(0, -8.3, 2.1, 1.6, 0), FR.b) + el(0, -6.6, 1, 0.8, FR.throat);
	return g(x, y, body, rot, k);
}
function freesia(stage: GrowingStage): string {
	const L: Strap[] = [[38, 26, 56, 1.4, -3], [39, 34, 50, 1.4, -1], [41, 46, 52, 1.4, 1], [42, 54, 58, 1.4, 3]];
	if (stage === "sprout") return straps([[39, 36, 70, 1.2, -1], [41, 44, 72, 1.2, 1]], FR.leaf);
	const A: Bez = [[40, 87], [40, 62], [38, 46], [42, 40]];
	if (stage === "leafy") return straps(L, FR.leaf) + sk(cub(A) + "Q46 37 56 38", GREEN.dark, 1.3) + p(lensSub(46, 38, -70, 4, 1) + lensSub(50, 37.6, -80, 3.4, 0.9) + lensSub(54, 37.8, -85, 2.8, 0.8), FR.bud);
	const B: Bez = [[40, 87], [40, 58], [41, 36], [44, 30]];
	let s = straps(L, FR.leaf) + sk(cub(B) + "Q50 25 64 27", GREEN.dark, 1.3) + sk("M39 87C38 66 34 56 28 52Q24 50 16 52", GREEN.dark, 1.2);
	s += p(lensSub(59, 26.6, -85, 3.4, 0.9) + lensSub(62.5, 26.8, -88, 2.6, 0.8) + lensSub(19, 51.2, -95, 3, 0.8), FR.bud);
	s += funnel(55, 26.5, 0.85, 12) + funnel(50, 27, 1, 8) + funnel(45, 28.6, 1.1, 2);
	return s + funnel(23, 51, 0.9, -8) + funnel(28.5, 52.5, 1, -4);
}

/* ---------- 6. Gladiolus ---------- */
const GL = { a: "#f0705e", b: "#d9493f", c: "#fbd2c4", fleck: "#b8323a", leaf: "#5f9a52", bud: "#9fbf72" };
function gladFlower(x: number, y: number, k: number): string {
	return ring(x, y, 5, 2.6 * k, 2.8 * k, 2.5 * k, GL.b, -54) + ring(x, y - 0.4 * k, 3, 2.4 * k, 2.8 * k, 2.4 * k, GL.a, -90) + el(x, y + 2.6 * k, 3 * k, 2 * k, GL.a) + p(lensSub(x, y - 1 * k, 90, 4.6 * k, 1.1 * k), GL.c) + sk(`M${f(x)} ${f(y + 0.4 * k)}l0 ${f(2 * k)}`, GL.fleck, 0.5 * k);
}
function gladiolus(stage: GrowingStage): string {
	if (stage === "sprout") return straps([[39, 35, 66, 1.8, -1], [40.5, 42, 64, 1.8, 0.5], [41, 46, 70, 1.6, 1]], GL.leaf);
	const L: Strap[] = [[38, 26, 50, 2.2, -1], [39, 33, 40, 2.2, -0.5], [41, 47, 42, 2.2, 0.5], [42, 54, 52, 2.2, 1]];
	if (stage === "leafy") {
		return straps(L, GL.leaf) + sk("M40 87L40 34", GREEN.dark, 1.5) + p(lensSub(40, 50, -110, 6, 1.4) + lensSub(40, 44, -70, 6, 1.4) + lensSub(40, 39, -100, 5, 1.2) + lensSub(40, 35, -80, 4.5, 1.1), GL.bud) + p(lensSub(39.5, 50, -110, 3.6, 0.9), GL.a);
	}
	let s = straps(L, GL.leaf) + sk("M40 87C40 60 41 30 41 8", GREEN.dark, 1.6);
	s += p(lensSub(41, 22, -105, 6, 1.3) + lensSub(41, 17, -78, 5, 1.1) + lensSub(41, 13, -95, 4.5, 1) + lensSub(41, 10, -86, 3.5, 0.8), GL.bud);
	const fl: [number, number, number][] = [[36, 60, 1.25], [44.5, 52, 1.2], [36.5, 44, 1.12], [45, 36.5, 1.02], [37.5, 29.5, 0.92]];
	return s + fl.map(([x, y, k]) => gladFlower(x, y, k)).join("");
}

/* ---------- 7. Crocosmia ---------- */
const CC = { a: "#ec5a22", b: "#c23a1a", c: "#f6a03a", leaf: "#6a9f55" };
function spray(c: Bez, from: number, n: number, k: number): string {
	let fa = "";
	let fb = "";
	for (let i = 0; i < n; i++) {
		const t = from + ((1 - from) * i) / (n - 1);
		const [x, y, d] = at(c, t);
		const up = d + (Math.cos((d * Math.PI) / 180) >= 0 ? -70 : 70);
		const sz = (1 - (0.55 * i) / n) * k;
		if (i < n - 3) fa += lensSub(x, y, up, 5.2 * sz, 1.4 * sz);
		else fb += lensSub(x, y, up, 4 * sz, 1 * sz);
	}
	return p(fa, CC.a) + p(fb, CC.b);
}
function crocosmia(stage: GrowingStage): string {
	if (stage === "sprout") return straps([[39, 33, 68, 1.5, -2], [41, 46, 66, 1.5, 2], [40, 40, 72, 1.3]], CC.leaf);
	const L: Strap[] = [[37, 14, 56, 1.8, -6], [38, 24, 44, 1.8, -4], [40, 36, 40, 1.7, -1], [42, 52, 42, 1.8, 4], [43, 64, 54, 1.8, 6]];
	if (stage === "leafy") {
		const A: Bez = [[40, 87], [40, 56], [44, 38], [56, 38]];
		return straps(L, CC.leaf) + sk(cub(A), GREEN.dark, 1.1) + spray(A, 0.75, 5, 0.7).replace(CC.a, "#9fbf5a").replace(CC.b, "#8aad4c");
	}
	const A: Bez = [[41, 87], [41, 46], [46, 22], [68, 28]];
	const B: Bez = [[39, 87], [38, 56], [32, 34], [12, 40]];
	let s = straps(L, CC.leaf) + sk(cub(A) + cub(B), GREEN.dark, 1.3);
	return s + spray(A, 0.58, 9, 1.45) + spray(B, 0.6, 8, 1.35);
}

/* ---------- 8. Amaryllis ---------- */
const AM = { a: "#cc2a3d", b: "#a51c30", c: "#f19aa4", eye: "#c8d870", leaf: "#5c984a", stem: "#6f9e4f" };
function trumpet(x: number, y: number, rot: number, k: number): string {
	const body = p(lensSub(6, 0, -62, 7, 2) + lensSub(6, 0, 62, 7, 2), AM.b) + p("M0 -1L7 -3.4L7 3.4L0 1Z", AM.a) + p(lensSub(6, 0, -28, 8, 2.2) + lensSub(6, 0, 28, 8, 2.2), AM.a) + p(lensSub(7, 0, -28, 5, 0.6) + lensSub(7, 0, 28, 5, 0.6), AM.c);
	return g(x, y, body, rot, k);
}
function amaryllis(stage: GrowingStage): string {
	const L: Strap[] = [[37, 12, 70, 2.7, -6], [38, 22, 58, 2.6, -4], [42, 58, 60, 2.6, 4], [43, 68, 72, 2.7, 6]];
	if (stage === "sprout") return straps([[38, 33, 76, 2.3, -1], [42, 47, 76, 2.3, 1]], AM.leaf) + p("M37.6 87L37.6 76Q40 68 42.4 76L42.4 87Z", AM.stem) + p("M38.3 78Q40 70 41.7 78Z", AM.b);
	if (stage === "leafy") return straps(L, AM.leaf) + sk("M40 87L40 50", AM.stem, 3.2) + p("M36.6 52Q36 42 40 36Q44 42 43.4 52Z", "#94b866") + p("M38 50Q38 42 40 38Q42 42 42 50Z", AM.b);
	let s = straps(L, AM.leaf) + sk("M40 87L40 34", AM.stem, 3.4);
	s += trumpet(38.5, 33, 195, 1.15) + trumpet(41.5, 33, -15, 1.15);
	s += p(starSub(40, 25, 6, 10.5, 3.3, -90), AM.a) + p(starSub(40, 25, 6, 6.5, 0.9, -90), AM.c) + circle(40, 25, 2, AM.eye);
	return s + sk("M40 25l-1.6 -4M40 25l1.6 -4M40 25l0 -4.6", "#f7e9a8", 0.5);
}

/* ---------- 9. Persian buttercup ---------- */
const RA = { a: "#f39466", b: "#d9663c", c: "#fbc9a6", eye: "#8fae58", leaf: "#5a9a4e", leaf2: "#77b062" };
function trefoil(x: number, y: number, a: number, k: number, fill: string): string {
	const o = { fill, shape: 2 as const, rib: false };
	return leaf(x, y, a - 38, 5 * k, 2.4 * k, o) + leaf(x, y, a, 6 * k, 2.8 * k, o) + leaf(x, y, a + 38, 5 * k, 2.4 * k, o);
}
function ranun(x: number, y: number, r: number): string {
	let arcs = "";
	for (const [kk, dy] of [[0.86, -0.08], [0.64, -0.18], [0.42, -0.26]] as const) {
		const cy = y + dy * r;
		const rr = kk * r;
		for (const [a0, a1] of [[15, 62], [62, 118], [118, 165]] as const) {
			const t0 = (a0 * Math.PI) / 180;
			const t1 = (a1 * Math.PI) / 180;
			arcs += `M${f(x + Math.cos(t0) * rr)} ${f(cy + Math.sin(t0) * rr)}A${f(rr * 0.5)} ${f(rr * 0.5)} 0 0 0 ${f(x + Math.cos(t1) * rr)} ${f(cy + Math.sin(t1) * rr)}`;
		}
	}
	return circle(x, y, r, RA.b) + el(x, y - 0.08 * r, 0.86 * r, 0.84 * r, RA.a) + el(x, y - 0.18 * r, 0.64 * r, 0.62 * r, "#f7ad84") + el(x, y - 0.26 * r, 0.42 * r, 0.4 * r, RA.c) + sk(arcs, RA.b, 0.5) + circle(x, y - 0.3 * r, 0.16 * r, RA.eye);
}
function ranunBase(k: number): string {
	return trefoil(38, 85, -160, k, RA.leaf) + trefoil(42, 85, -20, k, RA.leaf) + trefoil(39, 84, -120, k * 0.9, RA.leaf2) + trefoil(41, 84, -60, k * 0.9, RA.leaf2);
}
function persianButtercup(stage: GrowingStage): string {
	if (stage === "sprout") return ranunBase(0.8);
	if (stage === "leafy") return sk("M40 86C40 70 37 60 36 52M40 86C41 72 45 64 46 58", GREEN.dark, 1.3) + trefoil(38, 66, -150, 0.8, RA.leaf) + ranunBase(1.2) + el(36, 50, 2.6, 3, "#9cc27a") + el(46, 56, 2.2, 2.6, "#9cc27a") + el(36, 49, 1.4, 1.2, RA.a);
	let s = sk("M40 86C40 66 33 52 30 40M40 86C41 66 47 52 50 34M40 86C40 72 41 62 42 56", GREEN.dark, 1.4);
	s += trefoil(36, 66, -160, 0.9, RA.leaf) + trefoil(45, 62, -20, 0.9, RA.leaf) + ranunBase(1.35);
	return s + ranun(30, 38, 7.4) + ranun(50, 32, 8) + ranun(42, 54, 6.4);
}

/* ---------- 10. Poppy anemone ---------- */
const AN = { a: "#5a4cc0", b: "#463a9e", c: "#7466d6", white: "#f4f2fa", eye: "#1d1830", leaf: "#4f9447" };
function anemone(x: number, y: number, k: number, a: string, b: string): string {
	return (
		p(starSub(x, y + 6 * k, 10, 4 * k, 0.7 * k, 0), AN.leaf) +
		ring(x, y, 6, 3.6 * k, 3.6 * k, 3.1 * k, b, 30) +
		ring(x, y, 6, 3.6 * k, 3.6 * k, 3.1 * k, a, 0) +
		circle(x, y, 2.9 * k, AN.white) +
		circle(x, y, 2 * k, AN.eye) +
		dots(Array.from({ length: 12 }, (_, i) => [x + Math.cos(i * 0.5236) * 2.6 * k, y + Math.sin(i * 0.5236) * 2.6 * k] as const), 0.45 * k, AN.eye)
	);
}
function parsley(x: number, y: number, a: number, k: number, fill: string): string {
	return p(lensSub(x, y, a, 7 * k, 1.1 * k) + lensSub(x, y, a - 25, 6 * k, 1 * k) + lensSub(x, y, a + 25, 6 * k, 1 * k) + lensSub(x, y, a - 50, 4.5 * k, 0.9 * k) + lensSub(x, y, a + 50, 4.5 * k, 0.9 * k), fill);
}
function anemoneBase(k: number): string {
	return parsley(38, 86, -155, k, AN.leaf) + parsley(42, 86, -25, k, AN.leaf) + parsley(40, 85, -90, k * 0.9, "#6aa858") + parsley(39, 86, -120, k * 0.8, "#6aa858") + parsley(41, 86, -60, k * 0.8, "#6aa858");
}
function poppyAnemone(stage: GrowingStage): string {
	if (stage === "sprout") return anemoneBase(0.9);
	if (stage === "leafy") return sk("M40 86C40 72 38 64 37 56", GREEN.dark, 1.4) + anemoneBase(1.5) + p(starSub(37, 60, 10, 3.4, 0.6, 0), AN.leaf) + el(37, 54, 2.4, 3, AN.b);
	let s = sk("M40 86C40 66 34 50 32 38M40 86C41 70 48 60 50 50", GREEN.dark, 1.5) + anemoneBase(1.7);
	return s + anemone(32, 36, 1.35, AN.a, AN.b) + anemone(50, 48, 1.15, "#c43a6a", "#9e2a54");
}

/* ---------- 11. Siberian squill ---------- */
const SQ = { a: "#3a5fd2", b: "#25409e", stem: "#7a5f7c", leaf: "#4f9447" };
function squillBell(x: number, y: number, k: number): string {
	return p(lensSub(x, y, 55, 5 * k, 1.5 * k) + lensSub(x, y, 125, 5 * k, 1.5 * k) + lensSub(x, y, 90, 5.6 * k, 1.6 * k), SQ.a) + sk(`M${f(x)} ${f(y + 0.5)}l0 ${f(4.4 * k)}`, SQ.b, 0.5);
}
function squillStem(x0: number, top: number, dir: number, k: number): string {
	const c: Bez = [[x0, 87], [x0, 72], [x0 + dir * 1, top + 4], [x0 + dir * 6, top]];
	let s = sk(cub(c), SQ.stem, 1);
	for (const t of [0.62, 0.82, 1]) {
		const [x, y] = at(c, t);
		s += sk(`M${f(x)} ${f(y)}q${f(dir * 1.5)} 0 ${f(dir * 2)} 2`, SQ.stem, 0.7) + squillBell(x + dir * 2, y + 2, k);
	}
	return s;
}
function siberianSquill(stage: GrowingStage): string {
	if (stage === "sprout") return straps([[39, 36, 74, 1.6, -1], [41, 44, 74, 1.6, 1]], SQ.leaf) + el(40, 75, 1.4, 2, SQ.b);
	const L: Strap[] = [[37, 22, 66, 1.8, -4], [39, 32, 60, 1.8, -2], [41, 48, 60, 1.8, 2], [43, 58, 66, 1.8, 4]];
	if (stage === "leafy") return straps(L, SQ.leaf) + sk("M40 87C40 74 41 68 44 66", SQ.stem, 1) + p(lensSub(44, 66, 80, 3.6, 1.2) + lensSub(41.4, 72, 100, 3, 1), SQ.b);
	return straps(L, SQ.leaf) + squillStem(35, 54, -1, 1) + squillStem(44, 50, 1, 1.05) + squillStem(40, 62, 1, 0.9);
}

/* ---------- 12. Glory-of-the-snow ---------- */
const GS = { a: "#7d9be8", b: "#5f7fd6", eye: "#f7f7fb", dot: "#f2d36b", leaf: "#5e9a54" };
function gloryStar(x: number, y: number, k: number, fill: string): string {
	return p(starSub(x, y, 6, 4.6 * k, 1.5 * k), fill) + circle(x, y, 1.9 * k, GS.eye) + circle(x, y, 0.7 * k, GS.dot);
}
function gloryOfTheSnow(stage: GrowingStage): string {
	if (stage === "sprout") return straps([[39, 35, 74, 1.8, -1.5], [41, 45, 74, 1.8, 1.5]], GS.leaf);
	const L: Strap[] = [[38, 20, 66, 2.3, -5], [42, 60, 66, 2.3, 5], [40, 34, 62, 2, -2]];
	if (stage === "leafy") return straps(L, GS.leaf) + sk("M41 87C41 72 42 66 42 60", GREEN.dark, 1.1) + p(lensSub(42, 60, -90, 4, 1.2) + lensSub(42, 63, -40, 3.5, 1) + lensSub(42, 65, -140, 3.5, 1), GS.b);
	let s = straps(L, GS.leaf) + sk("M41 87C41 66 42 56 42 46M42 66Q34 62 32 56M42 61Q49 58 51 52M42 55Q36 52 34 47M42 50Q46 49 47 46M36 87C35 76 30 70 26 66", GREEN.dark, 1);
	return s + gloryStar(32, 56, 1.05, GS.a) + gloryStar(51, 52, 1.05, GS.a) + gloryStar(34, 47, 0.95, GS.b) + gloryStar(47, 45, 0.9, GS.a) + gloryStar(42, 42, 0.85, GS.b) + gloryStar(26, 65, 0.95, GS.a);
}

/* ---------- 13. Winter aconite ---------- */
const WA = { a: "#f5c518", b: "#d9a514", stam: "#c87a0e", ruff: "#5aa04c", ruff2: "#7cbc5e" };
function aconite(x: number, y: number, k: number): string {
	const ruff = g(x, y + 2.6 * k, p(starSub(0, 0, 12, 9.5 * k, 1.2 * k, 0), WA.ruff) + p(starSub(0, 0, 8, 7.5 * k, 1 * k, 22), WA.ruff2), 0, 1, 0.5);
	const bowl = p(`M${f(x - 5 * k)} ${f(y)}Q${f(x - 4.6 * k)} ${f(y + 4.6 * k)} ${f(x)} ${f(y + 4.8 * k)}Q${f(x + 4.6 * k)} ${f(y + 4.6 * k)} ${f(x + 5 * k)} ${f(y)}Z`, WA.b);
	const face = g(x, y, ring(0, 0, 6, 3 * k, 2.8 * k, 2.3 * k, WA.a, -90) + circle(0, 0, 2.2 * k, "#e3ad10") + dots(([[-1, -0.6], [1, -0.6], [0, 0.9], [-1.2, 0.9], [1.2, 0.9], [0, -1.4]] as const).map(([u, v]) => [u * k, v * k] as const), 0.55 * k, WA.stam), 0, 1, 0.62);
	return sk(`M${f(x)} 87L${f(x)} ${f(y + 3)}`, "#6b8f3e", 1.2 * k) + ruff + bowl + face;
}
function winterAconite(stage: GrowingStage): string {
	if (stage === "sprout") return sk("M38 87C38 80 36 78 34 79M43 87C43 81 45 79 47 80", "#6b8f3e", 1.3) + el(34, 80, 2, 1.6, "#c9c95a") + el(47, 81, 1.8, 1.5, "#c9c95a");
	if (stage === "leafy") {
		const r = (x: number, y: number, k: number) => g(x, y, p(starSub(0, 0, 12, 8 * k, 1.2 * k, 0), WA.ruff) + p(starSub(0, 0, 9, 6 * k, 1 * k, 15), WA.ruff2), 0, 1, 0.45);
		return sk("M33 87L33 76M46 87L46 72M40 87L40 80", "#6b8f3e", 1.3) + r(33, 76, 1.1) + r(46, 72, 1.2) + r(40, 80, 1) + circle(33, 73.6, 2, WA.b) + circle(46, 69.2, 2.3, WA.b) + circle(40, 78, 1.6, WA.b);
	}
	return aconite(29, 68, 1.3) + aconite(51, 66, 1.35) + aconite(40, 75, 1.25);
}

/* ---------- 14. Crown imperial ---------- */
const CI = { a: "#ec7a2a", b: "#c8561c", tip: "#f6b04a", leaf: "#6aa65a", leaf2: "#4f8f45", stem: "#5c8a45" };
function crownLeaves(y0: number, y1: number, k: number): string {
	let d = "";
	let e = "";
	for (let y = y0, i = 0; y >= y1; y -= 6, i++) {
		const L = 12 * k * (1 - (i * 0.08));
		d += lensSub(40, y, -150 + (i % 2) * 8, L, 1.7 * k) + lensSub(40, y, -30 - (i % 2) * 8, L, 1.7 * k);
		e += lensSub(40, y - 2, -115, L * 0.8, 1.4 * k) + lensSub(40, y - 2, -65, L * 0.8, 1.4 * k);
	}
	return p(e, CI.leaf2) + p(d, CI.leaf);
}
function crownImperial(stage: GrowingStage): string {
	if (stage === "sprout") return sk("M40 87L40 78", CI.stem, 2.4) + p(lensSub(40, 82, -130, 9, 1.6) + lensSub(40, 82, -50, 9, 1.6) + lensSub(40, 80, -100, 9, 1.4) + lensSub(40, 80, -80, 9, 1.4), CI.leaf);
	if (stage === "leafy") return sk("M40 87L40 46", CI.stem, 2.6) + crownLeaves(80, 56, 1) + p(starSub(40, 46, 8, 5, 1, -90), CI.leaf2) + dots([[36.5, 49], [40, 50], [43.5, 49]], 1.6, "#9fbf72");
	let s = sk("M40 87L40 24", CI.stem, 2.8) + crownLeaves(82, 58, 1.1);
	let tuft = "";
	for (let i = 0; i < 9; i++) tuft += lensSub(40, 25, -160 + i * 17.5, 9 + (i % 2 ? 0 : 2) - Math.abs(i - 4) * 0.4, 1.4);
	s += p(tuft, CI.leaf);
	let back = "";
	let front = "";
	let stalk = "";
	for (const [dx, dy] of [[-7.5, 0], [-2.6, -1], [2.6, -1], [7.5, 0]] as const) {
		back += ovalSub(40 + dx, 31 + dy, 2.6, 4.4, dx * 2);
		stalk += `M40 26Q${f(40 + dx * 0.8)} ${f(25)} ${f(40 + dx)} ${f(27 + dy)}`;
	}
	for (const dx of [-10, -5, 0, 5, 10]) {
		front += ovalSub(40 + dx, 33.5 - Math.abs(dx) * 0.12, 2.8, 4.8, dx * 1.6);
		stalk += `M40 26Q${f(40 + dx * 0.8)} ${f(26)} ${f(40 + dx)} ${f(29.5 - Math.abs(dx) * 0.12)}`;
	}
	s += sk(stalk, CI.stem, 0.9) + p(back, CI.b) + p(front, CI.a);
	return s + dots([-10, -5, 0, 5, 10].map((dx) => [40 + dx * 1.04, 38 - Math.abs(dx) * 0.12] as const), 0.9, CI.tip);
}

/* ---------- 15. Star of Bethlehem ---------- */
const SB = { w: "#f8f7f0", sh: "#a9b597", eye: "#c9d36a", leaf: "#6aa45a", bud: "#d7e4bf" };
function sbStar(x: number, y: number, k: number): string {
	return p(starSub(x, y, 6, 4.6 * k, 1.5 * k, -90), SB.sh) + p(starSub(x, y, 6, 4.4 * k, 1.35 * k, -60), SB.w) + circle(x, y, 1.2 * k, SB.eye);
}
function starOfBethlehem(stage: GrowingStage): string {
	const L: Strap[] = [[37, 16, 74, 1, -6], [38, 24, 64, 1, -4], [42, 56, 64, 1, 4], [43, 64, 74, 1, 6], [40, 34, 66, 0.9, -1], [40, 46, 66, 0.9, 1]];
	if (stage === "sprout") {
		const S: Strap[] = [[38, 33, 74, 0.9, -2], [40, 40, 70, 0.9], [42, 47, 74, 0.9, 2]];
		return straps(S, SB.leaf) + stripes(S, "#eef4e4");
	}
	let s = straps(L, SB.leaf) + stripes(L, "#eef4e4");
	if (stage === "leafy") return s + sk("M40 87L40 60M40 64Q36 60 35 56M40 64Q44 60 45 56", GREEN.dark, 1) + dots([[35, 55], [40, 58.5], [45, 55]], 1.6, SB.bud);
	const fl: [number, number, number][] = [[28, 50, 1], [34, 42, 1.05], [46, 42, 1.05], [52, 50, 1], [40, 47, 1.1], [24, 57, 0.85], [56, 57, 0.85]];
	s += sk(fl.map(([x, y]) => `M40 70Q${f((x + 40) / 2)} ${f(y + 6)} ${f(x)} ${f(y)}`).join("") + "M40 87L40 70", GREEN.dark, 0.9);
	return s + dots([[31, 38.5], [49, 38.5]], 1.4, SB.bud) + fl.map(([x, y, k]) => sbStar(x, y, k)).join("");
}

/* ---------- 16. Nerine ---------- */
const NE = { a: "#ef7aa8", b: "#d24f86", stam: "#c23a74", tip: "#7a1f4a", leaf: "#6aa45a", stem: "#5f8f4a" };
function nerine(stage: GrowingStage): string {
	if (stage === "sprout") return straps([[39, 36, 74, 1.4, -1], [41, 45, 75, 1.4, 1]], NE.leaf);
	const L: Strap[] = [[37, 22, 74, 1.5, -4], [39, 30, 66, 1.5, -2], [41, 50, 66, 1.5, 2], [43, 58, 74, 1.5, 4]];
	if (stage === "leafy") return straps(L, NE.leaf) + sk("M40 87L40 48", NE.stem, 1.6) + p("M40 36Q37 42 37.5 48Q40 50 42.5 48Q43 42 40 36Z", "#c9b48a") + p(lensSub(40, 44, -120, 4, 1) + lensSub(40, 44, -60, 4, 1), NE.a);
	let s = straps(L, NE.leaf) + sk("M40 87C40 66 41 46 40 32", NE.stem, 1.6);
	const cx = 40;
	const cy = 30;
	let ped = "";
	let pa = "";
	let pb = "";
	let st = "";
	const tips: [number, number][] = [];
	const fl: [number, number][] = [[-165, 11], [-130, 12], [-95, 12], [-60, 12], [-20, 11], [20, 9], [160, 9]];
	fl.forEach(([a, r], i) => {
		const t = (a * Math.PI) / 180;
		const x = cx + Math.cos(t) * r;
		const y = cy + Math.sin(t) * r;
		ped += `M${cx} ${cy}L${f(x)} ${f(y)}`;
		for (let j = 0; j < 6; j++) {
			const d = a + 180 + 30 + j * 60;
			if (j % 2) pb += lensSub(x, y, d, 5, 0.75);
			else pa += lensSub(x, y, d, 5, 0.75);
		}
		for (const o of [-18, 0, 18]) {
			const u = ((a + o) * Math.PI) / 180;
			const ex = x + Math.cos(u) * 6.5;
			const ey = y + Math.sin(u) * 6.5;
			st += `M${f(x)} ${f(y)}L${f(ex)} ${f(ey)}`;
			tips.push([ex, ey]);
		}
		void i;
	});
	return s + sk(ped, NE.stem, 0.7) + p(pb, NE.b) + p(pa, NE.a) + sk(st, NE.stam, 0.45) + dots(tips, 0.5, NE.tip);
}

/* ---------- 17. Agapanthus ---------- */
const AG = { a: "#4f73d0", b: "#8ea6ec", c: "#3a58ad", leaf: "#4f8a45", leaf2: "#62a050", stem: "#5c8a4a" };
function agapanthus(stage: GrowingStage): string {
	const L1: Strap[] = [[36, 10, 76, 2.3, -6], [38, 18, 62, 2.3, -5], [42, 62, 62, 2.3, 5], [44, 70, 76, 2.3, 6]];
	const L2: Strap[] = [[38, 26, 56, 2.2, -3], [42, 54, 56, 2.2, 3], [40, 36, 58, 2, -1]];
	if (stage === "sprout") return straps([[38, 30, 72, 1.8, -2], [42, 50, 72, 1.8, 2]], AG.leaf) + straps([[40, 39, 70, 1.6]], AG.leaf2);
	if (stage === "leafy") return straps(L1.map(([a, b, c, w, e]) => [a, (b - 40) * 0.8 + 40, 87 - (87 - c) * 0.8, w, e] as const), AG.leaf) + straps(L2.map(([a, b, c, w, e]) => [a, b, 87 - (87 - c) * 0.8, w, e] as const), AG.leaf2);
	let s = straps(L1, AG.leaf) + straps(L2, AG.leaf2) + sk("M40 87C40 66 41 48 40 32", AG.stem, 1.8);
	const cx = 40;
	const cy = 30;
	let ped = "";
	let fa = "";
	let fb = "";
	let fc = "";
	for (let i = 0; i < 17; i++) {
		const a = -190 + i * 12.5 + (i % 2) * 3;
		const r = i % 2 ? 9 : 11;
		const t = (a * Math.PI) / 180;
		const x = cx + Math.cos(t) * r;
		const y = cy + Math.sin(t) * r * 0.95;
		ped += `M${cx} ${cy}L${f(x)} ${f(y)}`;
		if (i % 3 === 0) fc += lensSub(x, y, a, 6, 1.9);
		else fa += lensSub(x, y, a, 6, 1.9);
		fb += lensSub(x + Math.cos(t) * 2.5, y + Math.sin(t) * 2.5, a, 3.4, 1.3);
	}
	for (const a of [20, 55, 125, 160]) {
		const t = (a * Math.PI) / 180;
		const x = cx + Math.cos(t) * 6;
		const y = cy + Math.sin(t) * 6;
		ped += `M${cx} ${cy}L${f(x)} ${f(y)}`;
		fc += lensSub(x, y, a, 4.5, 1.4);
	}
	return s + sk(ped, AG.stem, 0.6) + p(fc, AG.c) + p(fa, AG.a) + p(fb, AG.b);
}

/* ---------- 18. Canna ---------- */
const CN = { leaf: "#8e4f5f", leaf2: "#a8636b", rib: "#5e2e3c", stem: "#7a4450", a: "#e8432e", b: "#f27a2a", c: "#f6b23a" };
function canna(stage: GrowingStage): string {
	const o = { fill: CN.leaf, dark: CN.rib, shape: 1 as const };
	const o2 = { fill: CN.leaf2, dark: CN.rib, shape: 1 as const };
	if (stage === "sprout") return sk("M40 87L40 76", CN.stem, 2) + leaf(40, 80, -125, 12, 4, o) + leaf(40, 78, -62, 12, 4, o2);
	if (stage === "leafy") return sk("M40 87L40 46", CN.stem, 2.4) + leaf(40, 80, -165, 19, 6, o) + leaf(40, 72, -18, 19, 6, o2) + leaf(40, 62, -145, 16, 5, o2) + leaf(40, 54, -38, 15, 5, o) + leaf(40, 48, -100, 10, 3, o2);
	let s = sk("M40 87L40 30", CN.stem, 2.6) + leaf(40, 84, -158, 24, 8.5, o) + leaf(40, 78, -24, 24, 8.5, o2) + leaf(40, 68, -132, 22, 8, o2) + leaf(40, 60, -50, 21, 7.5, o) + leaf(40, 50, -112, 15, 5, o);
	s += el(30, 30, 3.4, 7, CN.b, -55) + el(50, 29, 3.4, 7, CN.b, 55) + el(34, 20, 3.6, 8, CN.a, -24) + el(46, 20, 3.6, 8, CN.a, 24) + el(40, 16, 3.8, 8.5, CN.a);
	return s + el(40, 27, 4, 4.6, CN.c) + dots([[38.8, 26], [41.4, 27.4], [39.4, 29]], 0.65, CN.a) + el(43, 37, 1.6, 3, CN.a, 20);
}

/* ---------- 19. Cyclamen ---------- */
const CY = { leaf: "#2f5d3a", silver: "#9cb6a2", a: "#e0508a", b: "#c23a73", eye: "#7c1a44", stem: "#8a5a5a" };
function cyLeaf(x: number, y: number, a: number, len: number, w: number): string {
	return leaf(x, y, a, len, w, { fill: CY.leaf, shape: 4, rib: false }) + leaf(x, y, a, len * 0.8, w * 0.68, { fill: CY.silver, shape: 4, rib: false }) + leaf(x, y, a, len * 0.55, w * 0.42, { fill: CY.leaf, shape: 4, rib: false });
}
function cyRosette(k: number): string {
	const list: [number, number][] = [[-175, 11], [-5, 11], [-145, 12], [-35, 12], [-112, 12], [-68, 12]];
	return list.map(([a, l]) => cyLeaf(40, 85, a, l * k, 5 * k)).join("");
}
function cyFlower(x: number, y: number, k: number): string {
	return p(lensSub(x - 0.6, y, -112, 9 * k, 1.8 * k) + lensSub(x + 0.6, y, -68, 9 * k, 1.8 * k), CY.b) + p(lensSub(x, y, -98, 10 * k, 2 * k) + lensSub(x, y, -82, 10 * k, 2 * k), CY.a) + circle(x, y + 0.8, 1.4 * k, CY.eye);
}
function cyclamen(stage: GrowingStage): string {
	if (stage === "sprout") return cyRosette(0.75);
	if (stage === "leafy") return sk("M40 84C40 72 44 66 44 62", CY.stem, 1) + cyRosette(1.2) + p(lensSub(44, 63, -94, 6, 1.2), CY.a) + circle(44, 64, 1, CY.eye);
	let s = sk("M38 84C36 70 30 62 29 56M40 84C40 70 42 56 42 49M42 84C44 72 51 66 52 60", CY.stem, 1.1);
	s += sk("M29 56q0 3 1 3.5M42 49q0 3 1 3M52 60q0 3 -1 3.5", CY.stem, 1);
	return s + cyRosette(1.35) + cyFlower(30, 59.5, 1) + cyFlower(43, 52, 1.1) + cyFlower(51, 63.5, 0.95);
}

/* ---------- 20. Summer snowflake ---------- */
const SF = { w: "#f7f7f1", sh: "#bfc9b8", dot: "#4f9a45", leaf: "#5f9a4c", stem: "#5d8a52" };
function bellSub(x: number, y: number, k: number, w: number): string {
	return `M${f(x - 3 * w)} ${f(y + 1 * k)}Q${f(x - 3.8 * w)} ${f(y + 7 * k)} ${f(x - 3.4 * w)} ${f(y + 7.4 * k)}L${f(x + 3.4 * w)} ${f(y + 7.4 * k)}Q${f(x + 3.8 * w)} ${f(y + 7 * k)} ${f(x + 3 * w)} ${f(y + 1 * k)}Q${f(x)} ${f(y - 1.4 * k)} ${f(x - 3 * w)} ${f(y + 1 * k)}Z`;
}
function sfBell(x: number, y: number, k: number): string {
	return p(bellSub(x, y, k, k), SF.sh) + p(bellSub(x - 0.7 * k, y, k, 0.72 * k), SF.w) + dots([[x - 2.4 * k, y + 7.1 * k], [x, y + 7.6 * k], [x + 2.4 * k, y + 7.1 * k]], 0.6 * k, SF.dot);
}
function summerSnowflake(stage: GrowingStage): string {
	if (stage === "sprout") return straps([[38.5, 36, 68, 1.6, -1], [41.5, 44, 66, 1.6, 1], [40, 40, 72, 1.4]], SF.leaf);
	const L: Strap[] = [[37, 28, 40, 1.9, -3], [38.5, 33, 32, 1.9, -1], [41.5, 47, 34, 1.9, 1], [43, 54, 42, 1.9, 3], [40, 38, 46, 1.7]];
	if (stage === "leafy") return straps(L.map(([a, b, c, w, e]) => [a, b, c + 14, w, e] as const), SF.leaf) + sk("M40 87C40 70 41 56 41 46", SF.stem, 1.4) + p(lensSub(41, 47, -88, 6, 1.4), "#9fbf72") + el(42.5, 51.5, 1.4, 2.6, SF.w, -10);
	let s = straps(L, SF.leaf) + sk("M40 87C40 60 41 36 41 22", SF.stem, 1.5) + p(lensSub(41, 23, -85, 7, 1.4), "#9fbf72");
	const bells: [number, number, number][] = [[31, 30, 1], [37.5, 33, 1.05], [45, 31, 1.05], [51, 36, 0.95], [28, 39, 0.9]];
	s += sk(bells.map(([x, y]) => `M41 24Q${f(x + (41 - x) * 0.3)} ${f(22)} ${f(x)} ${f(y)}`).join(""), SF.stem, 0.8);
	return s + bells.map(([x, y, k]) => sfBell(x, y, k)).join("");
}

/* ---------- 21. Ixia ---------- */
const IX = { a: "#f3e3a0", b: "#e2cc7a", eye: "#8c2134", bud: "#e8b6b0", leaf: "#6aa45a", stem: "#6f9a4f" };
function ixSpike(c: Bez, k: number): [string, [number, number][], string] {
	let d = "";
	const eyes: [number, number][] = [];
	for (const [t, side] of [[0.72, -1], [0.8, 1], [0.87, -1], [0.93, 1]] as const) {
		const [x, y] = at(c, t);
		const fx = x + side * 2.2 * k;
		d += starSub(fx, y, 6, 3.5 * k, 1.25 * k, -90);
		eyes.push([fx, y]);
	}
	const [bx, by, bd] = at(c, 1);
	return [d, eyes, lensSub(bx, by + 1.5, bd, 3.4, 0.9) + lensSub(bx - 0.6, by + 3, bd - 25, 2.6, 0.8)];
}
function ixia(stage: GrowingStage): string {
	const L: Strap[] = [[38, 30, 62, 0.9, -2], [39, 34, 56, 0.9, -1], [41, 46, 56, 0.9, 1], [42, 50, 62, 0.9, 2], [40, 40, 60, 0.8]];
	if (stage === "sprout") return straps([[39, 36, 72, 0.9, -1], [40, 40, 70, 0.9], [41, 44, 72, 0.9, 1]], IX.leaf);
	if (stage === "leafy") return straps(L, IX.leaf) + sk("M40 87C40 70 41 56 41 42", IX.stem, 0.9) + p(lensSub(41, 46, -110, 3.4, 0.9) + lensSub(41, 49, -70, 3.4, 0.9) + lensSub(41, 43, -90, 3, 0.8), "#c9cf8a");
	const A: Bez = [[38, 87], [37, 60], [32, 40], [28, 18]];
	const B: Bez = [[40, 87], [40, 60], [41, 36], [42, 10]];
	const C: Bez = [[42, 87], [43, 62], [49, 42], [54, 22]];
	const sp = [ixSpike(A, 1), ixSpike(B, 1.05), ixSpike(C, 0.95)];
	return straps(L, IX.leaf) + sk(cub(A) + cub(B) + cub(C), IX.stem, 0.8) + p(sp.map((x) => x[2]).join(""), IX.bud) + p(sp.map((x) => x[0]).join(""), IX.a) + dots(sp.flatMap((x) => x[1]), 1.25, IX.eye);
}

/* ---------- 22. Harlequin flower ---------- */
const HQ = { eye: "#f4c51c", ring: "#2a1616", leaf: "#5f9a4c" };
function harl(x: number, y: number, k: number, a: string, b: string): string {
	return ring(x, y, 3, 3.5 * k, 3.5 * k, 2.6 * k, b, -30) + ring(x, y, 3, 3.6 * k, 3.6 * k, 2.6 * k, a, -90) + circle(x, y, 2.6 * k, HQ.eye) + ring(x, y, 6, 2.5 * k, 0.9 * k, 0.75 * k, HQ.ring, -90) + circle(x, y, 1 * k, "#f8dc5a");
}
function harlequinFlower(stage: GrowingStage): string {
	if (stage === "sprout") return straps([[39, 35, 70, 1.3, -1], [40.5, 41, 67, 1.3], [41.5, 46, 72, 1.3, 1]], HQ.leaf);
	const L: Strap[] = [[37.5, 26, 58, 1.6, -2], [39, 33, 50, 1.6, -1], [41, 47, 50, 1.6, 1], [42.5, 54, 58, 1.6, 2]];
	if (stage === "leafy") return straps(L, HQ.leaf) + sk("M40 87C40 70 39 56 37 48M40 87C41 72 44 62 46 56", GREEN.dark, 1) + p(lensSub(37, 50, -100, 5, 1.2) + lensSub(46, 58, -80, 4.5, 1.1), "#d0763e");
	let s = straps(L, HQ.leaf) + sk("M40 87C40 66 34 50 30 40M40 87C41 64 46 46 50 34M40 87C40 74 42 62 42 54M34 52Q28 52 24 56", GREEN.dark, 1.1);
	return s + p(lensSub(50, 36, -70, 4, 1) + lensSub(30, 42, -110, 3.6, 1), "#d0763e") + harl(30, 40, 1.25, "#f07a2a", "#d65f1c") + harl(50, 32, 1.3, "#d9302e", "#b82424") + harl(42, 54, 1.15, "#c33b8f", "#a02c74") + harl(24, 56, 0.95, "#f2a03a", "#d9852a");
}

/* ---------- 23. Camassia ---------- */
const CM = { a: "#8088e2", b: "#6a6fcc", bud: "#5357b8", dot: "#f2d36b", leaf: "#6aa45a" };
function camassia(stage: GrowingStage): string {
	const L: Strap[] = [[37, 14, 66, 1.4, -7], [38, 22, 56, 1.4, -4], [39.5, 32, 52, 1.3, -1], [41, 50, 54, 1.4, 3], [42.5, 64, 62, 1.4, 6]];
	if (stage === "sprout") return straps([[39, 34, 70, 1.2, -2], [41, 46, 70, 1.2, 2]], CM.leaf);
	if (stage === "leafy") {
		const Ls = L.map(([a, b, c, w, e]) => [a, (b - 40) * 0.8 + 40, 87 - (87 - c) * 0.8, w, e] as const);
		return straps(Ls, CM.leaf) + sk("M40 87L40 44", GREEN.dark, 1.2) + p(lensSub(40, 56, -120, 4, 1) + lensSub(40, 53, -60, 4, 1) + lensSub(40, 50, -115, 3.6, 0.9) + lensSub(40, 47, -65, 3.4, 0.9) + lensSub(40, 45, -90, 3, 0.8), CM.bud);
	}
	let s = straps(L, CM.leaf) + sk("M40 87C40 60 41 30 40 8", GREEN.dark, 1.3);
	let fa = "";
	let fb = "";
	let buds = "";
	const ds: [number, number][] = [];
	for (let i = 0; i < 12; i++) {
		const y = 60 - i * 3.5;
		const side = i % 2 ? 1 : -1;
		const x = 40 + side * (3.4 - i * 0.08);
		if (y > 28) {
			const k = 1 - i * 0.03;
			if (i % 3) fa += starSub(x, y, 6, 5 * k, 1 * k, i * 10);
			else fb += starSub(x, y, 6, 5 * k, 1 * k, i * 10);
			ds.push([x, y]);
		} else buds += lensSub(40, y, -90 + side * 40, 4 - (28 - y) * 0.1, 0.9);
	}
	return s + p(fb, CM.b) + p(fa, CM.a) + p(buds, CM.bud) + dots(ds, 0.8, CM.dot);
}

/* ---------- 24. Tuberose ---------- */
const TB = { w: "#f8f5ec", sh: "#c4b99f", pink: "#efc3cc", leaf: "#6aa45a", stem: "#7aa85a" };
/** Tuberose flowers on the stem: [y, k, rotations]; tubes, faces and eyes each in one path. */
function tubeFls(list: readonly (readonly [number, number, readonly number[]])[]): string {
	let tube = "";
	let face = "";
	const eyes: [number, number][] = [];
	for (const [y, k, rots] of list) {
		for (const r of rots) {
			const t = ((r - 90) * Math.PI) / 180;
			const fx = 40 + Math.cos(t) * 6.3 * k;
			const fy = y + Math.sin(t) * 6.3 * k;
			tube += `M40 ${f(y)}L${f(40 + Math.cos(t) * 5.2 * k)} ${f(y + Math.sin(t) * 5.2 * k)}`;
			face += starSub(fx, fy, 6, 2.8 * k, 0.95 * k, r - 90);
			eyes.push([fx, fy]);
		}
	}
	return sk(tube, TB.sh, 1.6) + dots(eyes, 2.1, TB.sh) + p(face, TB.w) + dots(eyes, 0.6, "#d9cfa6");
}
function tuberose(stage: GrowingStage): string {
	const L: Strap[] = [[37, 14, 78, 1.2, -6], [38, 20, 64, 1.2, -5], [39, 28, 56, 1.1, -2], [41, 52, 56, 1.1, 2], [42, 60, 64, 1.2, 5], [43, 66, 78, 1.2, 6]];
	if (stage === "sprout") return straps([[39, 34, 72, 1.1, -2], [40, 40, 69, 1], [41, 46, 72, 1.1, 2]], TB.leaf);
	if (stage === "leafy") return straps(L, TB.leaf) + sk("M40 87L40 38", TB.stem, 1.4) + p(lensSub(40, 44, -125, 4.5, 1.1) + lensSub(40, 44, -55, 4.5, 1.1) + lensSub(40, 40, -110, 4, 1) + lensSub(40, 40, -70, 4, 1) + lensSub(40, 38, -90, 3.4, 0.9), TB.pink);
	let s = straps(L, TB.leaf) + sk("M40 87C40 60 41 30 40 9", TB.stem, 1.4) + p(lensSub(40, 56, -150, 5, 0.9) + lensSub(40, 64, -30, 5, 0.9), TB.leaf);
	s += p(lensSub(40, 21, -125, 4.6, 1.1) + lensSub(40, 21, -55, 4.6, 1.1) + lensSub(40, 16, -112, 4.2, 1) + lensSub(40, 16, -68, 4.2, 1) + lensSub(40, 12, -100, 3.6, 0.9) + lensSub(40, 12, -80, 3.6, 0.9) + lensSub(40, 10, -90, 3, 0.8), TB.pink);
	return s + tubeFls([[48, 1.15, [-42, 40]], [40, 1.1, [-42, 40]], [32, 1.02, [-42, 40, 0]], [26, 0.92, [-42, 40]]]);
}

/* ---------- 25. Autumn crocus ---------- */
const AC = { a: "#d98ad0", b: "#b866b4", vein: "#9a4c97", tube: "#e9dfe6", anth: "#f2c94c", leaf: "#5c9a4a", leaf2: "#77b062" };
function colchicum(x: number, y: number, k: number, a: string): string {
	return (
		sk(`M${f(x)} 87L${f(x)} ${f(y)}`, AC.tube, 1.5 * k) +
		el(x - 3 * k, y - 5.5 * k, 2.8 * k, 6.4 * k, AC.b, -12) +
		el(x + 3 * k, y - 5.5 * k, 2.8 * k, 6.4 * k, AC.b, 12) +
		dots([[x - 1 * k, y - 9 * k], [x + 1 * k, y - 9.4 * k]], 0.8 * k, AC.anth) +
		p(`M${f(x - 3.4 * k)} ${f(y - 5 * k)}Q${f(x - 3.6 * k)} ${f(y - 11 * k)} ${f(x)} ${f(y - 11.6 * k)}Q${f(x + 3.6 * k)} ${f(y - 11 * k)} ${f(x + 3.4 * k)} ${f(y - 5 * k)}Q${f(x + 3 * k)} ${f(y + 0.5 * k)} ${f(x)} ${f(y + 0.5 * k)}Q${f(x - 3 * k)} ${f(y + 0.5 * k)} ${f(x - 3.4 * k)} ${f(y - 5 * k)}Z`, a) +
		sk(`M${f(x)} ${f(y - 0.5 * k)}L${f(x)} ${f(y - 8 * k)}`, AC.vein, 0.45 * k)
	);
}
function autumnCrocus(stage: GrowingStage): string {
	const o = { fill: AC.leaf, shape: 1 as const, rib: false };
	const o2 = { ...o, fill: AC.leaf2 };
	if (stage === "sprout") return leaf(39, 87, -100, 15, 3.4, o) + leaf(41, 87, -80, 14, 3.2, o2);
	if (stage === "leafy") return leaf(38, 87, -128, 30, 5, o) + leaf(42, 87, -52, 30, 5, o) + leaf(39, 87, -104, 36, 5.2, o2) + leaf(41, 87, -78, 34, 5, o2) + leaf(40, 87, -92, 26, 4, o);
	return colchicum(29, 73, 1.2, AC.a) + colchicum(51, 72, 1.25, AC.a) + colchicum(35, 66, 1.3, "#e29cd8") + colchicum(46, 63, 1.35, "#e29cd8") + colchicum(40, 79, 1.25, AC.a);
}

export const SPECIES: Species[] = [
	{ id: "crocus", name: "Crocus", draw: crocus },
	{ id: "snowdrop", name: "Snowdrop", draw: snowdrop },
	{ id: "grape-hyacinth", name: "Grape hyacinth", draw: grapeHyacinth },
	{ id: "giant-allium", name: "Giant allium", draw: giantAllium },
	{ id: "freesia", name: "Freesia", draw: freesia },
	{ id: "gladiolus", name: "Gladiolus", draw: gladiolus },
	{ id: "crocosmia", name: "Crocosmia", draw: crocosmia },
	{ id: "amaryllis", name: "Amaryllis", draw: amaryllis },
	{ id: "persian-buttercup", name: "Persian buttercup", draw: persianButtercup },
	{ id: "poppy-anemone", name: "Poppy anemone", draw: poppyAnemone },
	{ id: "siberian-squill", name: "Siberian squill", draw: siberianSquill },
	{ id: "glory-of-the-snow", name: "Glory-of-the-snow", draw: gloryOfTheSnow },
	{ id: "winter-aconite", name: "Winter aconite", draw: winterAconite },
	{ id: "crown-imperial", name: "Crown imperial", draw: crownImperial },
	{ id: "star-of-bethlehem", name: "Star of Bethlehem", draw: starOfBethlehem },
	{ id: "nerine", name: "Nerine", draw: nerine },
	{ id: "agapanthus", name: "Agapanthus", draw: agapanthus },
	{ id: "canna", name: "Canna", draw: canna },
	{ id: "cyclamen", name: "Cyclamen", draw: cyclamen },
	{ id: "summer-snowflake", name: "Summer snowflake", draw: summerSnowflake },
	{ id: "ixia", name: "Ixia", draw: ixia },
	{ id: "harlequin-flower", name: "Harlequin flower", draw: harlequinFlower },
	{ id: "camassia", name: "Camassia", draw: camassia },
	{ id: "tuberose", name: "Tuberose", draw: tuberose },
	{ id: "autumn-crocus", name: "Autumn crocus", draw: autumnCrocus },
];
