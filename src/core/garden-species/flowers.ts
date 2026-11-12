/**
 * Garden species, family: flowers. Each draws sprout, leafy and bloom in
 * the kit's flat style (see kit.ts); the kit draws soil and seed.
 */
import { BARK, bez, blade, circle, f, GREEN, leaf, line, stem, type GrowingStage, type Species } from "./kit";

/* ---------- private helpers ---------- */

/** A rotated ellipse. */
function el(cx: number, cy: number, rx: number, ry: number, fill: string, rot = 0): string {
	const t = rot ? ` transform="rotate(${f(rot)} ${f(cx)} ${f(cy)})"` : "";
	return `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}" fill="${fill}"${t}/>`;
}

/** A filled path. */
function p(d: string, fill: string): string {
	return `<path d="${d}" fill="${fill}"/>`;
}

/** A group translated to (x, y), rotated and scaled. */
function g(x: number, y: number, body: string, rot = 0, sx = 1, sy = sx): string {
	const r = rot ? ` rotate(${f(rot)})` : "";
	const s = sx !== 1 || sy !== 1 ? ` scale(${f(sx)} ${f(sy)})` : "";
	return `<g transform="translate(${f(x)} ${f(y)})${r}${s}">${body}</g>`;
}

/** n leaves fanned from (x, y) between two angles. */
function fan(x: number, y: number, n: number, from: number, to: number, len: number, w: number, o: Parameters<typeof leaf>[5] = {}): string {
	let s = "";
	for (let i = 0; i < n; i++) {
		const a = n === 1 ? from : from + ((to - from) * i) / (n - 1);
		s += leaf(x, y, a, len * (1 - Math.abs(a + 90) / 300), w, o);
	}
	return s;
}

/** Subpath of a rotated ellipse (two arcs), for packing many petals in one path. */
function ovalSub(cx: number, cy: number, rx: number, ry: number, rot: number): string {
	const r = (rot * Math.PI) / 180;
	const dx = Math.cos(r) * rx;
	const dy = Math.sin(r) * rx;
	const a = `A${f(rx)} ${f(ry)} ${f(rot)} 1 0`;
	return `M${f(cx + dx)} ${f(cy + dy)}${a} ${f(cx - dx)} ${f(cy - dy)}${a} ${f(cx + dx)} ${f(cy + dy)}Z`;
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

/** n petals in one path (same arguments as the kit's `petals`); each is a round-capped stroke, so (rx, ry) give a capsule. */
function ring(x: number, y: number, n: number, r: number, rx: number, ry: number, fill: string, off = 0): string {
	if (rx === ry) {
		let d = "";
		for (let i = 0; i < n; i++) {
			const t = ((off + (i * 360) / n) * Math.PI) / 180;
			d += dotSub(x + Math.cos(t) * r, y + Math.sin(t) * r, rx);
		}
		return p(d, fill);
	}
	if (ry > rx * 0.8) {
		let d = "";
		for (let i = 0; i < n; i++) {
			const t = ((off + (i * 360) / n) * Math.PI) / 180;
			d += ovalSub(x + Math.cos(t) * r, y + Math.sin(t) * r, rx, ry, off + (i * 360) / n);
		}
		return p(d, fill);
	}
	const h = rx - ry;
	let d = "";
	for (let i = 0; i < n; i++) {
		const t = ((off + (i * 360) / n) * Math.PI) / 180;
		const c = Math.cos(t);
		const sn = Math.sin(t);
		d += `M${f(x + c * (r - h))} ${f(y + sn * (r - h))}L${f(x + c * (r + h))} ${f(y + sn * (r + h))}`;
	}
	return `<path d="${d}" stroke="${fill}" stroke-width="${f(ry * 2)}" stroke-linecap="round" fill="none"/>`;
}

/** A ring of pointed petals around (x, y), in one path. */
function spikes(x: number, y: number, n: number, len: number, w: number, fill: string, off = 0): string {
	let d = "";
	for (let i = 0; i < n; i++) d += lensSub(x, y, off + (i * 360) / n, len, w);
	return p(d, fill);
}

/** Subpath of a polygon given in local coords, placed at (x, y), rotated by deg and scaled by k. */
function polySub(x: number, y: number, deg: number, k: number, pts: readonly number[]): string {
	const r = (deg * Math.PI) / 180;
	const c = Math.cos(r) * k;
	const sn = Math.sin(r) * k;
	let d = "";
	for (let i = 0; i < pts.length; i += 2) {
		const px = pts[i] ?? 0;
		const py = pts[i + 1] ?? 0;
		d += `${i ? "L" : "M"}${f(x + px * c - py * sn)} ${f(y + px * sn + py * c)}`;
	}
	return d + "Z";
}

/** Subpath of a circle. */
function dotSub(x: number, y: number, r: number): string {
	return `M${f(x - r)} ${f(y)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0`;
}

/** A plain flower head of oval petals with a centre. */
function daisyHead(x: number, y: number, n: number, r: number, rx: number, ry: number, fill: string, shade: string, eye: string, eyeR: number): string {
	return ring(x, y, n, r, rx, ry, shade, 180 / n) + ring(x, y, n, r, rx, ry, fill) + circle(x, y, eyeR, eye);
}


/* ---------- 1. Rose ---------- */
const ROSE = { red: "#c92a3a", deep: "#a01d2c", light: "#e04a55", leaf: "#5f9a4c" };
function roseLeaf(x: number, y: number, a: number, k = 1): string {
	const r = (a * Math.PI) / 180;
	const tx = x + Math.cos(r) * 7 * k;
	const ty = y + Math.sin(r) * 7 * k;
	const o = { fill: ROSE.leaf, rib: false };
	return (
		line(x, y, tx, ty, GREEN.dark, 1) +
		leaf(x + Math.cos(r) * 3.5 * k, y + Math.sin(r) * 3.5 * k, a - 50, 5.5 * k, 2.6 * k, o) +
		leaf(x + Math.cos(r) * 3.5 * k, y + Math.sin(r) * 3.5 * k, a + 50, 5.5 * k, 2.6 * k, o) +
		leaf(tx, ty, a, 7 * k, 3.2 * k, o)
	);
}
function thorns(x: number, ys: number[]): string {
	return ys.map((y, i) => p(i % 2 ? `M${f(x + 0.8)} ${f(y)}l2.4 -1.6l-2.4 -.4Z` : `M${f(x - 0.8)} ${f(y)}l-2.4 -1.6l2.4 -.4Z`, "#7a3b2a")).join("");
}
function rose(stage: GrowingStage): string {
	if (stage === "sprout") return line(40, 87, 40, 70, GREEN.dark, 2) + roseLeaf(40, 74, -150, 0.8) + roseLeaf(40, 72, -30, 0.8);
	const top = stage === "leafy" ? 42 : 26;
	let s = stem([[40, 87], [40, 70], [41, 50], [40, top]], GREEN.dark, 2.4) + thorns(40, [80, 68, 56, 46]);
	s += roseLeaf(40, 76, -160) + roseLeaf(40, 64, -20) + roseLeaf(40, 54, -155);
	if (stage === "leafy") return s + roseLeaf(40, 48, -25, 0.8) + el(40, top - 3, 3.2, 4.5, ROSE.red) + leaf(40, top + 1, -125, 6, 2, { rib: false, shape: 1 }) + leaf(40, top + 1, -55, 6, 2, { rib: false, shape: 1 });
	s += roseLeaf(40, 44, -25, 0.9);
	const y = top - 6;
	s += leaf(40, y + 8, 150, 7, 2, { rib: false, shape: 1 }) + leaf(40, y + 8, 30, 7, 2, { rib: false, shape: 1 });
	s += circle(40, y, 10.5, ROSE.deep) + el(31.5, y + 2, 4.5, 7, ROSE.red, 20) + el(48.5, y + 2, 4.5, 7, ROSE.red, -20);
	s += p(`M29.5 ${f(y)}Q30 ${f(y + 12)} 40 ${f(y + 12)}Q50 ${f(y + 12)} 50.5 ${f(y)}Q45 ${f(y + 5)} 40 ${f(y + 5)}Q35 ${f(y + 5)} 29.5 ${f(y)}Z`, ROSE.light);
	s += el(40, y - 2, 6, 4.6, ROSE.red);
	s += `<path d="M36 ${f(y - 2)}Q40 ${f(y - 7)} 44 ${f(y - 2)}Q41 ${f(y + 1)} 38 ${f(y - 1.5)}Q40 ${f(y - 4)} 42 ${f(y - 2)}" fill="none" stroke="${ROSE.deep}" stroke-width="1" stroke-linecap="round"/>`;
	return s;
}

/* ---------- 2. Tulip ---------- */
const TULIP = { a: "#e5506f", b: "#f27a92", leaf: "#7aa86c" };
function tulipLeaves(len: number): string {
	const o = { fill: TULIP.leaf, shape: 1 as const, rib: false };
	return leaf(39, 87, -112, len, len * 0.2, o) + leaf(41, 87, -68, len * 0.9, len * 0.2, o);
}
function tulip(stage: GrowingStage): string {
	if (stage === "sprout") return leaf(39.5, 87, -96, 15, 3.4, { fill: TULIP.leaf, shape: 1, rib: false }) + leaf(40.5, 87, -82, 12, 3, { fill: "#8db87e", shape: 1, rib: false });
	const top = stage === "leafy" ? 46 : 30;
	let s = line(40, 86, 40, top, GREEN.dark, 2.2) + tulipLeaves(stage === "leafy" ? 30 : 34);
	if (stage === "leafy") return s + p(`M36 ${top}C35 ${top - 6} 38 ${top - 10} 40 ${top - 11}C42 ${top - 10} 45 ${top - 6} 44 ${top}C42 ${top + 2} 38 ${top + 2} 36 ${top}Z`, "#a9c98a") + p(`M38 ${top - 6}C38.5 ${top - 9} 40 ${top - 11} 40 ${top - 11}C41 ${top - 10} 42 ${top - 8} 42 ${top - 6}Z`, TULIP.a);
	const y = top - 4;
	s += p(`M31 ${y - 10}C30 ${y} 35 ${y + 5} 40 ${y + 5}C45 ${y + 5} 50 ${y} 49 ${y - 10}L45 ${y - 6}L40 ${y - 14}L35 ${y - 6}Z`, TULIP.a);
	s += p(`M35 ${y - 7}C34 ${y} 37 ${y + 5} 40 ${y + 5}C43 ${y + 5} 46 ${y} 45 ${y - 7}C43 ${y - 12} 41 ${y - 14} 40 ${y - 15}C39 ${y - 14} 37 ${y - 12} 35 ${y - 7}Z`, TULIP.b);
	return s;
}

/* ---------- 3. Daisy ---------- */
const DAISY = { petal: "#f6f3ea", shade: "#c9c2b0", eye: "#f2c230" };
function daisyRosette(k: number): string {
	return fan(40, 86, 4, -172, -8, 12 * k, 2.6 * k, { shape: 0, fill: GREEN.leaf }) + fan(40, 86, 3, -140, -40, 10 * k, 2.4 * k, { shape: 0, fill: GREEN.light });
}
function daisy(stage: GrowingStage): string {
	if (stage === "sprout") return daisyRosette(1);
	const heads: [number, number][] = stage === "leafy" ? [[32, 50], [47, 44]] : [[28, 40], [50, 28], [38, 54]];
	let s = "";
	for (const [x, y] of heads) s += stem([[40, 85], [40, 70], [x, y + 14], [x, y]], GREEN.dark, 1.4);
	s += daisyRosette(stage === "leafy" ? 1.4 : 1.6);
	if (stage === "leafy") return s + heads.map(([x, y]) => circle(x, y, 2.6, "#9dc27a") + ring(x, y - 1.5, 3, 1.4, 1, 1.6, DAISY.petal, -90)).join("");
	return s + heads.map(([x, y], i) => daisyHead(x, y, 14, i === 1 ? 6 : 5, i === 1 ? 4.6 : 3.8, 1.25, DAISY.petal, DAISY.shade, DAISY.eye, i === 1 ? 2.8 : 2.3)).join("");
}

/* ---------- 4. Sunflower ---------- */
function sunflower(stage: GrowingStage): string {
	const o = { shape: 4 as const };
	if (stage === "sprout") return line(40, 87, 40, 70, GREEN.dark, 2.2) + leaf(40, 70, -160, 9, 4.5, { shape: 2 }) + leaf(40, 70, -20, 9, 4.5, { shape: 2 });
	const top = stage === "leafy" ? 40 : 26;
	let s = line(40, 87, 40, top, GREEN.dark, 3) + leaf(40, 76, -170, 17, 7, o) + leaf(40, 66, -12, 17, 7, o) + leaf(40, 56, -165, 14, 6, o) + leaf(40, 47, -18, 12, 5.5, o);
	if (stage === "leafy") return s + leaf(40, top, -120, 9, 4, o) + leaf(40, top, -60, 9, 4, o) + circle(40, top - 3, 3.4, "#9dc27a");
	const y = top - 6;
	s += ring(40, y, 18, 11, 5.4, 2.1, "#e9a91c", 10) + ring(40, y, 18, 10.5, 5.2, 2.1, "#f4c430");
	s += circle(40, y, 7, "#6b4423") + circle(40, y, 4.4, "#553419");
	return s + ([[37, y - 3], [43, y - 2], [42, y + 3], [36.5, y + 2.5], [40, y]] as const).map(([x, yy]) => circle(x, yy, 0.9, "#8d5f36")).join("");
}

/* ---------- 5. Red poppy ---------- */
const POPPY = { a: "#e8402c", b: "#c92e20", leaf: "#8aa877", stem: "#6f8f5a" };
function poppyBase(k: number): string {
	const o = { shape: 1 as const, rib: false, fill: POPPY.leaf };
	return fan(40, 86, 5, -170, -10, 13 * k, 2.8 * k, o) + fan(40, 86, 2, -125, -55, 10 * k, 2.4 * k, { ...o, fill: "#9db88b" });
}
function poppy(stage: GrowingStage): string {
	if (stage === "sprout") return poppyBase(0.9);
	if (stage === "leafy") {
		return (
			stem([[40, 86], [39, 66], [36, 46], [46, 42]], POPPY.stem, 1.4) +
			poppyBase(1.4) +
			el(47, 47, 3, 4.4, "#7f9a6c", -15) +
			el(47.2, 47.8, 1.6, 2.6, POPPY.a, -15)
		);
	}
	const [x, y] = [35, 24];
	let s = stem([[40, 86], [40, 60], [34, 40], [x, y + 4]], POPPY.stem, 1.5) + stem([[41, 86], [44, 66], [50, 54], [54, 49]], POPPY.stem, 1.3);
	s += el(54.5, 52, 2.6, 3.8, "#7f9a6c", -20) + poppyBase(1.6);
	s += ring(x, y, 4, 5.6, 7.4, 7, POPPY.b, 45) + ring(x, y, 4, 4.8, 6.4, 6, POPPY.a);
	s += circle(x, y, 3.6, "#2a1a1a") + circle(x, y, 1.8, "#6b7a4f");
	return s + ring(x, y, 8, 3.6, 0.7, 0.7, "#2a1a1a");
}

/* ---------- 6. Calla lily ---------- */
const CALLA = { white: "#f5f1e4", throat: "#ddd3b4", base: "#9cc27a", leaf: "#4f8f4a" };
function callaLeaves(k: number): string {
	let s = "";
	for (const [a, l, h] of [[-130, 15, 18], [-55, 16, 22], [-100, 13, 30]] as const) {
		const r = (a * Math.PI) / 180;
		const tx = 40 + Math.cos(r) * h * k;
		const ty = 86 + Math.sin(r) * h * k;
		s += line(40, 86, tx, ty, GREEN.dark, 1.4) + leaf(tx, ty, a, l * k, l * k * 0.33, { shape: 4, fill: CALLA.leaf });
	}
	return s;
}
function calla(stage: GrowingStage): string {
	if (stage === "sprout") return line(40, 87, 40, 76, GREEN.dark, 1.4) + leaf(40, 77, -100, 10, 3.6, { shape: 4, fill: CALLA.leaf });
	if (stage === "leafy") return line(41, 86, 42, 44, GREEN.dark, 2) + p("M42 46C39 41 40 34 44 31C45 36 45 42 42 46Z", CALLA.base) + p("M43.5 38C42.5 35.5 43 33 44 31C44.8 34 44.6 36 43.5 38Z", CALLA.white) + callaLeaves(1);
	let s = line(41, 86, 42, 40, GREEN.dark, 2.2) + callaLeaves(1.2);
	s += p("M42 41C37 35 33 26 35 18C37 11 45 9 50 12C54 15 50 20 47 22C46 29 44 35 42 41Z", CALLA.white);
	s += p("M42 41C39 37 37 33 37 29C40 31 44 30 46 26C45 32 44 36 42 41Z", CALLA.base);
	s += p("M37.5 18C38.5 13 45 11.5 48.5 13.5C46 15 43 18 41 22C39.5 21 38 20 37.5 18Z", CALLA.throat);
	return s + line(41.5, 23, 43.5, 15, "#efc23a", 2.2);
}

/* ---------- 7. Bearded iris ---------- */
const IRIS = { std: "#8a6bd1", fall: "#5c3fa0", beard: "#f2c230", leaf: "#78a48a" };
function irisFan(k: number): string {
	return blade(37, 40 - 13 * k, 87 - 30 * k, IRIS.leaf, 2.2) + blade(39, 40 - 4 * k, 87 - 40 * k, "#8bb59b", 2.2) + blade(41, 40 + 6 * k, 87 - 38 * k, IRIS.leaf, 2.2) + blade(43, 40 + 14 * k, 87 - 28 * k, "#8bb59b", 2.2);
}
function iris(stage: GrowingStage): string {
	if (stage === "sprout") return irisFan(0.5);
	if (stage === "leafy") return line(40, 86, 40, 40, GREEN.dark, 2) + irisFan(1.05) + el(40, 37, 2.6, 5, "#8fb07e") + el(40, 34.5, 1.6, 3, IRIS.std);
	const y = 26;
	let s = line(40, 86, 40, y + 4, GREEN.dark, 2.2) + irisFan(1.2);
	s += el(35, y - 7, 3.6, 7, IRIS.std, -25) + el(45, y - 7, 3.6, 7, IRIS.std, 25) + el(40, y - 9, 4, 7.5, "#9a7edb");
	s += el(32, y + 5, 4.6, 7.5, IRIS.fall, 35) + el(48, y + 5, 4.6, 7.5, IRIS.fall, -35) + el(40, y + 5, 4.4, 7, "#6a4cb0");
	return s + el(34, y + 2, 0.9, 2.4, IRIS.beard, 35) + el(46, y + 2, 0.9, 2.4, IRIS.beard, -35) + el(40, y + 2.2, 1, 2.6, IRIS.beard);
}

/* ---------- 8. Daffodil ---------- */
const DAFF = { petal: "#f6df6a", cup: "#f2a52a", rim: "#e08617", leaf: "#6fa564" };
function daffLeaves(k: number): string {
	return blade(37, 40 - 12 * k, 87 - 32 * k, DAFF.leaf, 1.8) + blade(39, 40 - 3 * k, 87 - 40 * k, GREEN.light, 1.8) + blade(42, 40 + 11 * k, 87 - 34 * k, DAFF.leaf, 1.8);
}
function daffodil(stage: GrowingStage): string {
	if (stage === "sprout") return daffLeaves(0.5);
	if (stage === "leafy") return stem([[40, 86], [40, 60], [41, 46], [44, 42]], GREEN.dark, 1.8) + daffLeaves(1.05) + el(45.5, 43.5, 2.2, 4, "#c9c48a", -40);
	const [x, y] = [40, 26];
	let s = stem([[40, 86], [40, 60], [38, 36], [x - 2, y + 4]], GREEN.dark, 2) + daffLeaves(1.25);
	s += el(x - 3.2, y + 3, 1.6, 3, "#c9c48a", -30);
	s += g(x, y, spikes(0, 0, 6, 12, 4.8, DAFF.petal, -90), -10, 0.62, 1);
	s += g(x, y, `<path d="M0 -4.2L10 -6Q11.4 0 10 6L0 4.2Z" fill="${DAFF.cup}"/><ellipse cx="10" cy="0" rx="1.8" ry="6.2" fill="${DAFF.rim}"/>`, -10);
	return s;
}

/* ---------- 9. Peony ---------- */
const PEONY = { a: "#f2a0b6", b: "#f6bccb", c: "#e9829f", leaf: "#4f8a45" };
function peonyBush(k: number): string {
	let st = "";
	let a1 = "";
	let a2 = "";
	for (const [a, l] of [[-160, 20], [-130, 24], [-50, 24], [-20, 20], [-100, 22], [-78, 22]] as const) {
		const r = (a * Math.PI) / 180;
		const tx = 40 + Math.cos(r) * l * k;
		const ty = 86 + Math.sin(r) * l * k;
		st += `M40 86L${f(tx)} ${f(ty)}`;
		a1 += lensSub(tx, ty, a - 28, 9 * k, 2.6 * k) + lensSub(tx, ty, a + 28, 9 * k, 2.6 * k);
		a2 += lensSub(tx, ty, a, 10.5 * k, 2.9 * k);
	}
	return `<path d="${st}" stroke="${GREEN.dark}" stroke-width="1.2" fill="none"/>` + p(a1, PEONY.leaf) + p(a2, GREEN.leaf);
}
function peony(stage: GrowingStage): string {
	if (stage === "sprout") return line(40, 87, 40, 74, "#8a3b4a", 1.8) + leaf(40, 75, -140, 8, 3, { shape: 1, fill: "#8f6a5a", rib: false }) + leaf(40, 75, -40, 8, 3, { shape: 1, fill: "#7a8a55", rib: false });
	if (stage === "leafy") return line(40, 86, 40, 46, GREEN.dark, 1.6) + peonyBush(1.15) + circle(40, 44, 3.6, "#8fb07e") + circle(40, 43, 2, PEONY.c);
	const [x, y] = [40, 30];
	let s = line(40, 86, 40, y, GREEN.dark, 2) + line(40, 70, 56, 46, GREEN.dark, 1.4) + peonyBush(1.3);
	s += circle(56, 45, 3.4, "#8fb07e") + circle(56, 44, 2, PEONY.c);
	s += ring(x, y, 7, 8, 6.4, 5.2, PEONY.c, 10) + circle(x, y, 9, PEONY.a) + ring(x, y - 1, 6, 4.6, 4.6, 3.6, PEONY.b, 30);
	return s + circle(x, y - 2, 3.6, "#f9d3dd") + ring(x, y - 2, 5, 2.6, 1.6, 1.2, PEONY.c);
}

/* ---------- 10. Carnation ---------- */
const CARN = { a: "#f07ba0", b: "#d9507f", leaf: "#8aaba1", stem: "#6f9488" };
function frill(x: number, y: number, r: number, fill: string): string {
	let d = "";
	const n = 13;
	for (let i = 0; i <= n; i++) {
		const a = Math.PI + (Math.PI * i) / n;
		const rr = i % 2 ? r : r * 0.82;
		d += `${i ? "L" : "M"}${f(x + Math.cos(a) * rr)} ${f(y + Math.sin(a) * rr * 0.85)}`;
	}
	return p(`${d}Q${f(x)} ${f(y + r * 0.45)} ${f(x - r * 0.82)} ${f(y)}Z`, fill);
}
function carnLeaves(top: number): string {
	let s = "";
	const o = { fill: CARN.leaf, shape: 1 as const, rib: false };
	for (let y = 80, i = 0; y > top + 6; y -= 11, i++) s += circle(40, y, 1.3, CARN.stem) + leaf(40, y, -150 + i * 4, 12 - i, 1.6, o) + leaf(40, y, -30 - i * 4, 12 - i, 1.6, o);
	return s;
}
function carnation(stage: GrowingStage): string {
	if (stage === "sprout") return fan(40, 86, 4, -150, -30, 12, 1.6, { fill: CARN.leaf, shape: 1, rib: false });
	const top = stage === "leafy" ? 44 : 30;
	let s = line(40, 86, 40, top, CARN.stem, 1.6) + carnLeaves(top) + fan(40, 86, 4, -165, -15, 11, 1.6, { fill: CARN.leaf, shape: 1, rib: false });
	if (stage === "leafy") return s + el(40, top - 2, 2.2, 4.5, CARN.leaf) + el(40, top - 6.5, 1.4, 1.6, CARN.a);
	s += el(40, top - 1, 2.4, 5.5, CARN.leaf);
	s += frill(40, top - 5, 13, CARN.b) + frill(40, top - 5.6, 10, CARN.a) + frill(40, top - 6.2, 6, "#f7a5c0");
	return s;
}

/* ---------- 11. Marigold ---------- */
const MARI = { a: "#f39a24", b: "#e07818", c: "#c45f12", leaf: "#3f7a35" };
function mariBush(k: number): string {
	const c = { rib: GREEN.dark, a: "#5d9447", b: MARI.leaf };
	return `<path d="M40 86L40 ${f(86 - 26 * k)}" stroke="${GREEN.dark}" stroke-width="1.4"/>` + `<g transform="translate(40 86) scale(${f(k)}) translate(-40 -86)">${frondsOf(c)}</g>`;
}
function frondsOf(c: { rib: string; a: string; b: string }): string {
	return ([[-150, 22, -20], [-30, 22, 20], [-120, 26, -10], [-60, 26, 10], [-92, 24, 4]] as const).map(([d, l, b]) => frondLite(40, 86, d, l, b, 4.5, c)).join("");
}
/** A slimmer frond with fewer leaflets (kit `frond` is 12-step). */
function frondLite(x: number, y: number, deg: number, len: number, bend: number, leaflet: number, c: { rib: string; a: string; b: string }): string {
	const n = 6;
	const step = len / n;
	let a = (deg * Math.PI) / 180;
	let px = x;
	let py = y;
	let d = `M${f(x)} ${f(y)}`;
	let la = "";
	let lb = "";
	for (let j = 1; j <= n; j++) {
		a += (bend * Math.PI) / 180 / n;
		px += Math.cos(a) * step;
		py += Math.sin(a) * step;
		d += `L${f(px)} ${f(py)}`;
		if (j >= 2) {
			const l = (1 - j / (n + 1)) * leaflet + 1.6;
			const ad = (a * 180) / Math.PI;
			la += lensSub(px, py, ad - 55, l, l * 0.35);
			lb += lensSub(px, py, ad + 55, l, l * 0.35);
		}
	}
	return `<path d="${d}" stroke="${c.rib}" stroke-width="1.1" fill="none" stroke-linecap="round"/>` + p(la, c.a) + p(lb, c.b);
}
function pompom(x: number, y: number, r: number): string {
	return circle(x, y, r, MARI.b) + ring(x, y, 10, r * 0.72, r * 0.42, r * 0.42, MARI.a) + circle(x, y, r * 0.55, MARI.b) + ring(x, y, 6, r * 0.32, r * 0.28, r * 0.28, MARI.a, 30) + circle(x, y, r * 0.2, MARI.c);
}
function marigold(stage: GrowingStage): string {
	if (stage === "sprout") return frondLite(40, 86, -125, 13, -10, 3, { rib: GREEN.dark, a: "#5d9447", b: MARI.leaf }) + frondLite(40, 86, -55, 13, 10, 3, { rib: GREEN.dark, a: "#5d9447", b: MARI.leaf });
	if (stage === "leafy") return mariBush(1.45) + circle(40, 48, 2.6, "#7fa35a") + circle(40, 47, 1.4, MARI.a);
	let s = line(40, 86, 28, 44, GREEN.dark, 1.4) + line(40, 86, 52, 40, GREEN.dark, 1.4) + line(40, 86, 40, 32, GREEN.dark, 1.4) + mariBush(1.65);
	return s + pompom(27, 44, 7) + pompom(53, 40, 7.5) + pompom(40, 30, 8.5);
}

/* ---------- 12. Zinnia ---------- */
const ZIN = { a: "#c42f6d", b: "#e04787", c: "#ef74a6", eye: "#f2c230" };
function zinnia(stage: GrowingStage): string {
	const o = { shape: 0 as const };
	if (stage === "sprout") return line(40, 87, 40, 72, GREEN.dark, 1.8) + leaf(40, 72, -165, 9, 3.6, o) + leaf(40, 72, -15, 9, 3.6, o);
	const top = stage === "leafy" ? 42 : 26;
	let s = line(40, 87, 40, top, GREEN.dark, 2.2);
	for (const [y, l] of [[76, 15], [62, 13], [49, 11]] as const) if (y > top + 4) s += leaf(40, y, -168, l, 4.4, o) + leaf(40, y, -12, l, 4.4, o);
	if (stage === "leafy") return s + leaf(40, top + 2, -120, 8, 3, o) + leaf(40, top + 2, -60, 8, 3, o) + circle(40, top - 1, 3, "#8fb07e") + circle(40, top - 2, 1.6, ZIN.b);
	const y = top - 5;
	s += ring(40, y, 14, 8.4, 4.4, 2.6, ZIN.a) + ring(40, y - 0.6, 12, 5.8, 3.2, 2.2, ZIN.b, 15) + ring(40, y - 1.2, 10, 3.4, 2.1, 1.6, ZIN.c);
	return s + circle(40, y - 1.2, 2, "#7a2a3c") + ring(40, y - 1.2, 6, 2, 0.6, 0.6, ZIN.eye);
}

/* ---------- 13. Cosmos ---------- */
const COS = { a: "#e17fb1", b: "#f4c6dc", c: "#c6448a", eye: "#f2c230", stem: "#5a9244" };
function threadLeaf(x: number, y: number, a: number, len: number): string {
	const r = (a * Math.PI) / 180;
	let d = `M${f(x)} ${f(y)}L${f(x + Math.cos(r) * len)} ${f(y + Math.sin(r) * len)}`;
	for (const t of [0.35, 0.6, 0.85]) {
		const px = x + Math.cos(r) * len * t;
		const py = y + Math.sin(r) * len * t;
		for (const q of [-45, 45]) {
			const rr = r + (q * Math.PI) / 180;
			d += `M${f(px)} ${f(py)}l${f(Math.cos(rr) * len * 0.35)} ${f(Math.sin(rr) * len * 0.35)}`;
		}
	}
	return `<path d="${d}" stroke="${COS.stem}" stroke-width=".75" stroke-linecap="round" fill="none"/>`;
}
function cosmosHead(x: number, y: number, r: number, fill: string, shade: string): string {
	const k = r / 6;
	const pts = [0, 0, 3.4, -2.6, 8.8, -3.3, 8.2, -1.6, 9.4, 0, 8.2, 1.6, 8.8, 3.3, 3.4, 2.6];
	let a = "";
	let b = "";
	for (let i = 0; i < 8; i++) {
		const sub = polySub(x, y, i * 45 + 10, k, pts);
		if (i % 2) b += sub;
		else a += sub;
	}
	return p(a, fill) + p(b, shade) + circle(x, y, r * 0.36, COS.eye);
}
function cosmos(stage: GrowingStage): string {
	if (stage === "sprout") return line(40, 87, 40, 72, COS.stem, 1.2) + threadLeaf(40, 76, -150, 9) + threadLeaf(40, 74, -30, 9);
	const heads: [number, number][] = stage === "leafy" ? [[33, 46], [48, 40]] : [[26, 32], [52, 20], [44, 46]];
	let s = "";
	for (const [x, y] of heads) s += stem([[40, 87], [40, 70], [x, y + 16], [x, y]], COS.stem, 1.2);
	for (const [x, y, a, l] of [[40, 78, -150, 11], [40, 72, -35, 12], [38, 64, -140, 10], [42, 60, -40, 10], [36, 54, -120, 8]] as const) s += threadLeaf(x, y, a, l * (stage === "leafy" ? 1 : 1.15));
	if (stage === "leafy") return s + heads.map(([x, y]) => circle(x, y, 2.2, "#7fa35a") + circle(x, y - 0.6, 1.2, COS.a)).join("");
	return s + cosmosHead(26, 32, 5.6, COS.a, "#d66da3") + cosmosHead(53, 20, 6, COS.b, "#ecb2cd") + cosmosHead(45, 46, 4.8, COS.c, "#b83a7c");
}

/* ---------- 14. Dahlia ---------- */
const DAHL = { a: "#e8845a", b: "#f29d6c", c: "#f8bd8f", d: "#c9623d", leaf: "#3f7a35" };
function dahliaLeaf(x: number, y: number, a: number, k = 1): string {
	const r = (a * Math.PI) / 180;
	const o = { fill: DAHL.leaf, shape: 0 as const };
	const mx = x + Math.cos(r) * 5 * k;
	const my = y + Math.sin(r) * 5 * k;
	return line(x, y, mx, my, GREEN.dark, 1.2) + leaf(mx, my, a - 45, 7 * k, 3 * k, o) + leaf(mx, my, a + 45, 7 * k, 3 * k, o) + leaf(mx, my, a, 9 * k, 3.6 * k, o);
}
function dahlia(stage: GrowingStage): string {
	if (stage === "sprout") return line(40, 87, 40, 72, GREEN.dark, 2) + dahliaLeaf(40, 76, -155, 0.75) + dahliaLeaf(40, 74, -25, 0.75);
	const top = stage === "leafy" ? 44 : 32;
	let s = line(40, 87, 40, top, GREEN.dark, 2.6) + dahliaLeaf(40, 78, -165) + dahliaLeaf(40, 68, -15) + dahliaLeaf(40, 58, -160, 0.9) + dahliaLeaf(40, 50, -22, 0.8);
	if (stage === "leafy") return s + circle(40, top - 2, 3.6, "#7fa35a") + spikes(40, top - 3, 6, 2.6, 1.2, DAHL.a, -90);
	const y = top - 10;
	s += spikes(40, y, 16, 14, 3.6, DAHL.d, 11) + spikes(40, y, 16, 13, 3.6, DAHL.a) + spikes(40, y, 12, 9.5, 3, DAHL.b, 15) + spikes(40, y, 10, 6, 2.4, DAHL.c, 5);
	return s + circle(40, y, 1.8, "#e98a5a");
}

/* ---------- 15. Chrysanthemum ---------- */
const MUM = { a: "#f2d15c", b: "#e3b23a", c: "#f8e391", leaf: "#4f8a45" };
function mumLeaf(x: number, y: number, a: number, k = 1): string {
	const o = { fill: MUM.leaf, shape: 4 as const };
	return leaf(x, y, a, 11 * k, 4.4 * k, o) + leaf(x, y, a - 25 * Math.sign(Math.cos((a * Math.PI) / 180) || 1), 7 * k, 3 * k, { ...o, rib: false });
}
function chrysanthemum(stage: GrowingStage): string {
	if (stage === "sprout") return line(40, 87, 40, 72, GREEN.dark, 1.8) + mumLeaf(40, 74, -160, 0.7) + mumLeaf(40, 72, -20, 0.7);
	const top = stage === "leafy" ? 44 : 30;
	let s = stem([[40, 87], [41, 70], [39, 50], [40, top]], GREEN.dark, 2.2) + mumLeaf(40, 78, -165) + mumLeaf(40, 68, -15) + mumLeaf(40, 58, -160, 0.9) + mumLeaf(40, 50, -20, 0.8);
	if (stage === "leafy") return s + circle(40, top - 2, 3.4, "#8fb07e") + ring(40, top - 4, 5, 1.4, 1, 0.8, MUM.a, -90);
	const y = top - 10;
	s += ring(40, y, 26, 9, 5.2, 0.95, MUM.b) + ring(40, y, 22, 7.2, 4.4, 1.05, MUM.a, 8) + ring(40, y, 16, 4.6, 3.2, 1.1, MUM.c, 4);
	return s + circle(40, y, 2.6, MUM.a) + ring(40, y, 6, 1.4, 1, 0.7, MUM.b);
}

/* ---------- 16. Hyacinth ---------- */
const HYA = { a: "#6a7fd8", b: "#8a9de6", c: "#4f62bd", leaf: "#6fa564" };
function hyaLeaves(k: number): string {
	const o = { fill: HYA.leaf, shape: 1 as const, rib: false };
	return leaf(39, 87, -125, 24 * k, 4 * k, o) + leaf(41, 87, -55, 24 * k, 4 * k, o) + leaf(39, 87, -102, 26 * k, 3.8 * k, { ...o, fill: GREEN.light }) + leaf(41, 87, -78, 25 * k, 3.8 * k, { ...o, fill: GREEN.light });
}
function hyacinth(stage: GrowingStage): string {
	if (stage === "sprout") return hyaLeaves(0.6);
	if (stage === "leafy") {
		let s = line(40, 86, 40, 50, GREEN.dark, 2.4) + hyaLeaves(1.15);
		for (let y = 48; y < 64; y += 3.4) s += circle(37.5, y, 1.7, "#a9c98a") + circle(42.5, y + 1.7, 1.7, "#9cc27a");
		return s + circle(40, 47, 1.6, HYA.b);
	}
	let s = line(40, 86, 40, 26, GREEN.dark, 2.6) + hyaLeaves(1.3);
	let i = 0;
	let fa = "";
	let fb = "";
	let fc = "";
	let eyes = "";
	let notch = "";
	for (let y = 62; y >= 22; y -= 4, i++) {
		const w = y < 30 ? 3.2 : 6;
		for (const dx of i % 2 ? [-w, 0, w] : [-w * 0.55, w * 0.55]) {
			const x = 40 + dx;
			const sub = dotSub(x, y, 2.3);
			if (dx === 0) fb += sub;
			else if (i % 3) fa += sub;
			else fc += sub;
			eyes += dotSub(x, y, 0.5);
			for (let q = 0; q < 3; q++) notch += polySub(x, y, i * 23 + q * 120, 1, [1.4, -0.35, 2.6, 0, 1.4, 0.35]);
		}
	}
	return s + p(fa, HYA.a) + p(fb, HYA.b) + p(fc, HYA.c) + p(notch, "#4655ad") + p(eyes, "#c9d2fa");
}

/* ---------- 17. Foxglove ---------- */
const FOX = { a: "#c56aae", b: "#d98bc4", spot: "#7a2e64", leaf: "#7fa36a" };
function foxBell(x: number, y: number, side: number, k: number, fill: string): string {
	const body = `<path d="M0 0C${f(-3 * k)} ${f(2 * k)} ${f(-3.6 * k)} ${f(6 * k)} ${f(-3.2 * k)} ${f(8.5 * k)}L${f(3.2 * k)} ${f(8.5 * k)}C${f(3.6 * k)} ${f(6 * k)} ${f(3 * k)} ${f(2 * k)} 0 0Z" fill="${fill}"/><ellipse cx="0" cy="${f(8.4 * k)}" rx="${f(3 * k)}" ry="${f(1.1 * k)}" fill="#f2d4e8"/><circle cx="${f(-0.8 * k)}" cy="${f(7.8 * k)}" r="${f(0.45 * k)}" fill="${FOX.spot}"/><circle cx="${f(0.9 * k)}" cy="${f(7.6 * k)}" r="${f(0.45 * k)}" fill="${FOX.spot}"/>`;
	return g(x, y, body, side * -28);
}
function foxRosette(k: number): string {
	return fan(40, 86, 5, -168, -12, 15 * k, 4.6 * k, { fill: FOX.leaf }) + fan(40, 86, 2, -120, -60, 11 * k, 4 * k, { fill: "#93b47e" });
}
function foxglove(stage: GrowingStage): string {
	if (stage === "sprout") return foxRosette(0.8);
	if (stage === "leafy") {
		let s = line(40, 86, 40, 40, GREEN.dark, 2) + foxRosette(1.3);
		for (let y = 44; y < 62; y += 4) s += el(42, y, 1.4, 2, "#9cbc85", -30);
		return s;
	}
	let s = stem([[40, 86], [40, 50], [40, 30], [41, 8]], GREEN.dark, 2) + foxRosette(1.5);
	s += leaf(40, 66, -155, 10, 3.2, { fill: FOX.leaf }) + leaf(40, 60, -25, 9, 3, { fill: FOX.leaf });
	for (let i = 0; i < 9; i++) {
		const y = 52 - i * 4.4;
		const side = i % 2 ? 1 : -1;
		const k = 1.2 - i * 0.075;
		s += i > 6 ? el(40.6 + side * 1.6, y, 1.2, 1.8, FOX.b) : foxBell(40 + side * 1.2, y, side, k, i % 2 ? FOX.a : FOX.b);
	}
	return s + circle(41, 9, 1, "#9cbc85");
}

/* ---------- 18. Snapdragon ---------- */
const SNAP = { a: "#f4c542", b: "#f6d873", lip: "#ee8a3a", leaf: "#5d9a4c" };
function snapFloret(x: number, y: number, side: number, k: number): string {
	return g(x, y, el(2.6, -1.3, 2.8, 2.2, SNAP.a) + el(2.8, 1.4, 2.6, 1.8, SNAP.b) + el(4.2, 0.1, 1.3, 0.6, SNAP.lip), 0, side * k, k);
}
function snapdragon(stage: GrowingStage): string {
	const o = { fill: SNAP.leaf, shape: 1 as const };
	if (stage === "sprout") return line(40, 87, 40, 72, GREEN.dark, 1.6) + leaf(40, 76, -150, 9, 2.4, o) + leaf(40, 76, -30, 9, 2.4, o) + leaf(40, 72, -110, 6, 1.8, o) + leaf(40, 72, -70, 6, 1.8, o);
	const top = stage === "leafy" ? 40 : 12;
	let s = line(40, 87, 40, top, GREEN.dark, 2);
	for (let y = 80, i = 0; y > (stage === "leafy" ? 46 : 54); y -= 6, i++) s += leaf(40, y, i % 2 ? -25 : -155, 12 - i, 2.6, o);
	if (stage === "leafy") {
		for (let y = 44; y < 56; y += 3) s += el(38.5, y, 1.3, 1.8, "#9cbc85", 25) + el(41.5, y + 1.5, 1.3, 1.8, "#9cbc85", -25);
		return s;
	}
	for (let i = 0; i < 8; i++) {
		const y = 50 - i * 4.4;
		const side = i % 2 ? 1 : -1;
		const k = 1.25 - i * 0.07;
		s += i > 5 ? el(40 + side * 1.8, y, 1.4, 2, i > 6 ? "#9cbc85" : SNAP.b) : snapFloret(40 + side * 1, y, side, k);
	}
	return s + el(40, 13, 1.1, 1.8, "#9cbc85");
}

/* ---------- 19. Bluebell ---------- */
const BELL = { a: "#5b6dcf", b: "#7586dd", leaf: "#5f9e58" };
function bellLeaves(k: number): string {
	return blade(37, 40 - 16 * k, 87 - 24 * k, BELL.leaf, 1.4) + blade(39, 40 - 5 * k, 87 - 32 * k, GREEN.light, 1.4) + blade(42, 40 + 14 * k, 87 - 26 * k, BELL.leaf, 1.4);
}
function bell(x: number, y: number, k: number, fill: string, rot: number): string {
	return g(x, y, `<path d="M0 0C-2.4 .6 -3 4 -3 6.4L-3.8 8L-2 7.4L-1 8.3L0 7.4L1 8.3L2 7.4L3.8 8L3 6.4C3 4 2.4 .6 0 0Z" fill="${fill}"/>`, rot, k);
}
function bluebell(stage: GrowingStage): string {
	if (stage === "sprout") return bellLeaves(0.55);
	if (stage === "leafy") return stem([[40, 86], [40, 60], [42, 44], [52, 46]], GREEN.dark, 1.5) + bellLeaves(1.05) + ([[45, 45.5], [49, 45], [52, 46]] as const).map(([x, y]) => el(x, y + 2, 1.2, 1.8, "#7f9fc0")).join("");
	const P = [[38, 86], [36, 44], [46, 14], [62, 26]] as const;
	let s = stem(P, GREEN.dark, 1.6) + bellLeaves(1.3);
	const ts = [0.42, 0.53, 0.64, 0.75, 0.85, 0.94];
	for (const [i, t] of ts.entries()) {
		const [x, y] = bez(P, t);
		const k = 1.15 - i * 0.07;
		s += line(x, y, x + 1.6, y + 3, GREEN.dark, 0.8) + (i > 4 ? el(x + 1.6, y + 4.6, 1.3, 2, BELL.b) : bell(x + 1.6, y + 3, k, i % 2 ? BELL.b : BELL.a, 8));
	}
	return s;
}

/* ---------- 20. Lupine ---------- */
const LUP = { a: "#7a55c4", b: "#9d7fdc", c: "#c3a6ee", leaf: "#6aa35a" };
function palm(x: number, y: number, k: number): string {
	let a = "";
	let b = "";
	for (let i = 0; i < 7; i++) {
		const sub = lensSub(x, y, -180 + i * 30, (7.5 - Math.abs(i - 3) * 0.6) * k, 1.3 * k);
		if (i % 2) a += sub;
		else b += sub;
	}
	return p(a, LUP.leaf) + p(b, "#7db46a") + circle(x, y, k, GREEN.dark);
}
function lupineLeaves(k: number): string {
	let s = "";
	for (const [a, l] of [[-150, 13], [-30, 14], [-115, 18], [-68, 17]] as const) {
		const r = (a * Math.PI) / 180;
		const tx = 40 + Math.cos(r) * l * k;
		const ty = 86 + Math.sin(r) * l * k;
		s += line(40, 86, tx, ty, GREEN.dark, 1) + palm(tx, ty, k);
	}
	return s;
}
function lupine(stage: GrowingStage): string {
	if (stage === "sprout") return line(40, 87, 40, 76, GREEN.dark, 1.2) + palm(40, 75, 0.9);
	if (stage === "leafy") {
		let s = line(40, 86, 40, 46, GREEN.dark, 2) + lupineLeaves(1.25);
		for (let y = 48; y < 62; y += 3) s += el(38.6, y, 1.2, 1.6, "#9cbc85") + el(41.4, y + 1.5, 1.2, 1.6, "#9cbc85");
		return s;
	}
	let s = line(40, 86, 40, 10, GREEN.dark, 2.2) + lupineLeaves(1.45);
	for (let i = 0; i < 12; i++) {
		const y = 56 - i * 3.6;
		const w = 5.2 - i * 0.38;
		const c = i < 5 ? LUP.a : i < 9 ? LUP.b : LUP.c;
		s += el(40 - w, y, 2, 1.5, c, -25) + el(40 + w, y + 1.8, 2, 1.5, c, 25) + (i < 10 ? el(40, y - 0.6, 1.6, 1.3, i < 5 ? LUP.b : LUP.c) : "");
	}
	return s + el(40, 11, 1, 1.8, "#c9b4ee");
}

/* ---------- 21. Cornflower ---------- */
const CORN = { a: "#3f6fd8", b: "#5b88e6", eye: "#3a2d7a", stem: "#7a9a7e", bud: "#8aa58c" };
function cornHead(x: number, y: number, k: number): string {
	const pts = [0, 0, 4.2, -2.6, 4.6, -1.2, 5.8, -1.6, 5.2, 0, 5.8, 1.6, 4.6, 1.2, 4.2, 2.6];
	let a = "";
	let b = "";
	for (let i = 0; i < 9; i++) {
		const sub = polySub(x, y, i * 40 + 10, k, pts);
		if (i % 2) a += sub;
		else b += sub;
	}
	return p(a, CORN.a) + p(b, CORN.b) + circle(x, y, 1.8 * k, CORN.eye);
}
function cornflower(stage: GrowingStage): string {
	const o = { fill: CORN.stem, shape: 1 as const, rib: false };
	if (stage === "sprout") return fan(40, 86, 4, -150, -30, 12, 1.5, o);
	if (stage === "leafy") {
		let s = stem([[40, 86], [40, 60], [36, 50], [34, 44]], CORN.stem, 1.3) + stem([[40, 86], [41, 64], [46, 52], [48, 48]], CORN.stem, 1.3) + fan(40, 86, 5, -160, -20, 15, 1.6, o);
		s += leaf(39, 66, -140, 10, 1.3, o) + leaf(42, 62, -35, 9, 1.3, o);
		return s + el(34, 43, 2, 2.6, CORN.bud) + el(48, 47, 2, 2.6, CORN.bud) + el(48, 45, 1.2, 0.8, CORN.a);
	}
	let s = stem([[40, 86], [40, 56], [32, 40], [28, 30]], CORN.stem, 1.3) + stem([[40, 86], [41, 50], [48, 30], [50, 20]], CORN.stem, 1.3) + stem([[40, 70], [44, 62], [52, 52], [56, 46]], CORN.stem, 1.1);
	s += fan(40, 86, 5, -160, -20, 16, 1.6, o) + leaf(38, 60, -150, 11, 1.3, o) + leaf(43, 52, -30, 10, 1.3, o) + leaf(41, 42, -60, 9, 1.2, o);
	s += el(28, 32, 2.2, 2.8, CORN.bud) + el(50, 22, 2.2, 2.8, CORN.bud) + el(56, 48, 2, 2.6, CORN.bud);
	return s + cornHead(28, 28, 1.25) + cornHead(50, 18, 1.35) + cornHead(56, 45, 0.95);
}

/* ---------- 22. Pansy ---------- */
const PAN = { top: "#6b3fa8", side: "#f2cf4a", low: "#f2c33a", face: "#3b2050" };
function pansyFace(x: number, y: number, k: number): string {
	const b = el(-3.4, -4.4, 4, 4.8, PAN.top, -15) + el(3.4, -4.4, 4, 4.8, PAN.top, 15) + el(-4.6, 0.6, 3.6, 3.2, PAN.side) + el(4.6, 0.6, 3.6, 3.2, PAN.side) + el(0, 3.4, 4.6, 4, PAN.low);
	const face = `<path d="M0 0L-4.6 1.6L-2.4 3.4L0 5.6L2.4 3.4L4.6 1.6Z" fill="${PAN.face}"/>` + circle(0, 0.4, 1, "#f6e27a");
	return g(x, y, b + face, 0, k);
}
function pansyMound(k: number): string {
	const o = { shape: 2 as const };
	return fan(40, 86, 5, -172, -8, 11 * k, 3.4 * k, { ...o, fill: GREEN.leaf }) + fan(40, 86, 3, -135, -45, 9 * k, 3 * k, { ...o, fill: GREEN.light });
}
function pansy(stage: GrowingStage): string {
	if (stage === "sprout") return pansyMound(0.9);
	if (stage === "leafy") return stem([[40, 86], [40, 70], [44, 58], [45, 52]], GREEN.dark, 1.2) + pansyMound(1.4) + el(45, 51, 1.8, 2.8, "#8fb07e") + el(45, 49.4, 1, 1.4, PAN.top);
	let s = stem([[40, 86], [38, 70], [32, 56], [30, 46]], GREEN.dark, 1.3) + stem([[40, 86], [42, 68], [50, 52], [52, 38]], GREEN.dark, 1.3);
	s += pansyMound(1.6);
	return s + pansyFace(30, 46, 1.05) + pansyFace(52, 37, 1.25);
}

/* ---------- 23. Gerbera ---------- */
const GER = { a: "#f2563a", b: "#f77c55", c: "#d6402a", eye: "#3d3a1e", ring: "#f2c230" };
function gerberaBase(k: number): string {
	const o = { fill: "#4f8a45", shape: 1 as const };
	return leaf(40, 86, -176, 17 * k, 3.6 * k, o) + leaf(40, 86, -4, 17 * k, 3.6 * k, o) + leaf(40, 86, -150, 15 * k, 3.4 * k, { ...o, fill: GREEN.leaf }) + leaf(40, 86, -30, 15 * k, 3.4 * k, { ...o, fill: GREEN.leaf });
}
function gerbera(stage: GrowingStage): string {
	if (stage === "sprout") return gerberaBase(0.8);
	if (stage === "leafy") return stem([[40, 86], [40, 68], [41, 56], [41, 48]], "#5d8c46", 1.6) + gerberaBase(1.25) + circle(41, 46.5, 3, "#7fa35a") + ring(41, 44.4, 5, 1.2, 1, 0.8, GER.a, -90);
	const [x, y] = [40, 24];
	let s = stem([[40, 86], [41, 60], [39, 40], [x, y]], "#5d8c46", 1.8) + gerberaBase(1.45);
	s += ring(x, y, 22, 10, 5.2, 1.5, GER.c, 8) + ring(x, y, 22, 9.6, 5, 1.5, GER.a) + ring(x, y, 18, 6.2, 2.8, 1, GER.b, 5);
	return s + circle(x, y, 3.6, GER.ring) + circle(x, y, 2.4, GER.eye);
}

/* ---------- 24. Black-eyed Susan ---------- */
const BES = { a: "#f2b21c", b: "#d98e14", eye: "#4a2a14", leaf: "#5a8f45" };
function susanHead(x: number, y: number, k: number): string {
	let a1 = "";
	let b1 = "";
	for (let i = 0; i < 12; i++) {
		const a = (i * 360) / 12 + 15;
		const t = (a * Math.PI) / 180;
		const droop = Math.sin(t) > 0 ? 1.15 : 0.95;
		const sub = ovalSub(x + Math.cos(t) * 5.4 * droop * k, y + Math.sin(t) * 5.4 * droop * k, 4 * droop * k, 1.5 * k, a);
		if (i % 2) a1 += sub;
		else b1 += sub;
	}
	return p(a1, BES.a) + p(b1, BES.b) + circle(x, y - 0.4 * k, 3.4 * k, BES.eye) + circle(x - 1 * k, y - 1.4 * k, 0.9 * k, "#6e4224");
}
function susan(stage: GrowingStage): string {
	const o = { fill: BES.leaf, shape: 1 as const };
	if (stage === "sprout") return fan(40, 86, 4, -160, -20, 11, 3.2, o);
	if (stage === "leafy") return line(40, 86, 40, 44, GREEN.dark, 1.8) + fan(40, 86, 5, -170, -10, 16, 4, o) + leaf(40, 64, -150, 11, 3, o) + leaf(40, 56, -30, 10, 3, o) + circle(40, 43, 2.6, "#7fa35a") + circle(40, 42, 1.2, BES.a);
	let s = line(40, 86, 40, 26, GREEN.dark, 1.8) + stem([[40, 62], [34, 52], [28, 46], [26, 40]], GREEN.dark, 1.4) + stem([[40, 54], [46, 46], [52, 42], [55, 36]], GREEN.dark, 1.4);
	s += fan(40, 86, 5, -170, -10, 17, 4.2, o) + leaf(40, 70, -150, 11, 3, o) + leaf(40, 66, -28, 11, 3, o);
	return s + susanHead(26, 40, 0.9) + susanHead(55, 35, 0.95) + susanHead(40, 24, 1.1);
}

/* ---------- 25. Hibiscus ---------- */
const HIB = { a: "#e8456b", b: "#d32f58", eye: "#8a1534", leaf: "#2f7a3e", col: "#f6c7d2" };
function hibLeaf(x: number, y: number, a: number, k = 1): string {
	return leaf(x, y, a, 12 * k, 5 * k, { fill: HIB.leaf, shape: 1, dark: "#1f5a2c" });
}
function hibShrub(k: number): string {
	let s = line(40, 87, 40, 87 - 30 * k, BARK, 2.4 * k) + line(40, 87 - 10 * k, 40 - 14 * k, 87 - 32 * k, BARK, 1.6 * k) + line(40, 87 - 14 * k, 40 + 14 * k, 87 - 34 * k, BARK, 1.6 * k);
	for (const [dx, dy, a] of [[-14, -32, -150], [-14, -32, -100], [14, -34, -30], [14, -34, -80], [0, -30, -60], [0, -30, -120], [-8, -20, -170], [8, -22, -10], [-11, -26, 160], [11, -28, 20]] as const) s += hibLeaf(40 + dx * k, 87 + dy * k, a, k);
	return s;
}
function hibiscus(stage: GrowingStage): string {
	if (stage === "sprout") return line(40, 87, 40, 72, BARK, 1.8) + hibLeaf(40, 74, -150, 0.75) + hibLeaf(40, 73, -30, 0.75) + hibLeaf(40, 72, -90, 0.6);
	if (stage === "leafy") return hibShrub(1.15) + el(54, 45, 2.2, 4, "#5f9a4c", 20) + el(54.8, 42, 1.3, 1.8, HIB.a, 20);
	let s = hibShrub(1.35);
	const [x, y] = [40, 28];
	for (let i = 0; i < 5; i++) s += g(x, y, el(7.4, 0, 7.6, 5.6, i % 2 ? HIB.a : "#ee5a7c") + line(2, 0, 11, 0, HIB.b, 0.9) + line(3, 0, 9.5, -2.6, HIB.b, 0.7) + line(3, 0, 9.5, 2.6, HIB.b, 0.7), i * 72 - 54);
	s += circle(x, y, 3.4, HIB.eye) + line(x, y, x + 9, y - 10, HIB.col, 1.3);
	return s + ([[49, -10.5], [50.4, -9], [48, -12]] as const).map(([dx, dy]) => circle(dx, y + dy, 0.9, "#f2c230")).join("") + el(60, 46, 2, 3.8, "#5f9a4c", 30);
}

export const SPECIES: Species[] = [
	{ id: "rose", name: "Rose", draw: rose },
	{ id: "tulip", name: "Tulip", draw: tulip },
	{ id: "daisy", name: "Daisy", draw: daisy },
	{ id: "sunflower", name: "Sunflower", draw: sunflower },
	{ id: "red-poppy", name: "Red poppy", draw: poppy },
	{ id: "calla-lily", name: "Calla lily", draw: calla },
	{ id: "bearded-iris", name: "Bearded iris", draw: iris },
	{ id: "daffodil", name: "Daffodil", draw: daffodil },
	{ id: "peony", name: "Peony", draw: peony },
	{ id: "carnation", name: "Carnation", draw: carnation },
	{ id: "marigold", name: "Marigold", draw: marigold },
	{ id: "zinnia", name: "Zinnia", draw: zinnia },
	{ id: "cosmos", name: "Cosmos", draw: cosmos },
	{ id: "dahlia", name: "Dahlia", draw: dahlia },
	{ id: "chrysanthemum", name: "Chrysanthemum", draw: chrysanthemum },
	{ id: "hyacinth", name: "Hyacinth", draw: hyacinth },
	{ id: "foxglove", name: "Foxglove", draw: foxglove },
	{ id: "snapdragon", name: "Snapdragon", draw: snapdragon },
	{ id: "bluebell", name: "Bluebell", draw: bluebell },
	{ id: "lupine", name: "Lupine", draw: lupine },
	{ id: "cornflower", name: "Cornflower", draw: cornflower },
	{ id: "pansy", name: "Pansy", draw: pansy },
	{ id: "gerbera", name: "Gerbera", draw: gerbera },
	{ id: "black-eyed-susan", name: "Black-eyed Susan", draw: susan },
	{ id: "hibiscus", name: "Hibiscus", draw: hibiscus },
];
