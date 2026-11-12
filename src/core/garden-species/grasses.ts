/**
 * Garden species: grasses and grains. Mostly blades, culms and seed heads;
 * each bloom is the plant's signature head (spike, panicle, plume, cob,
 * umbel, cone) so the 25 stay apart at bed size.
 */
import { blade, circle, f, GREEN, leaf, line, type Species } from "./kit";

type P = [number, number];

const at = <T>(a: readonly T[], i: number): T => a[i % a.length] as T;
const rad = (d: number): number => (d * Math.PI) / 180;

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

/** A stroked quadratic. */
function qline(a: P, c: P, b: P, stroke: string, w: number, extra = ""): string {
	return `<path d="M${f(a[0])} ${f(a[1])}Q${f(c[0])} ${f(c[1])} ${f(b[0])} ${f(b[1])}" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round"${extra}/>`;
}

/** A tapering blade along a quadratic: half width w at the base a, point at b. */
function sliver(a: P, c: P, b: P, w: number, fill: string): string {
	const l1 = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1;
	// Rooted at the ground, the base sits flat so it never dips below the soil line.
	const flat = a[1] >= 86;
	const bx = flat ? w : (-(c[1] - a[1]) / l1) * w;
	const by = flat ? 0 : ((c[0] - a[0]) / l1) * w;
	const l2 = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
	const cx = (-(b[1] - a[1]) / l2) * w * 1.15;
	const cy = ((b[0] - a[0]) / l2) * w * 1.15;
	return `<path d="M${f(a[0] + bx)} ${f(a[1] + by)}Q${f(c[0] + cx)} ${f(c[1] + cy)} ${f(b[0])} ${f(b[1])}Q${f(c[0] - cx)} ${f(c[1] - cy)} ${f(a[0] - bx)} ${f(a[1] - by)}Z" fill="${fill}"/>`;
}

/** The control and tip of an arching blade from (x, y) heading deg, `droop` units down at the tip. */
function archPts(x: number, y: number, deg: number, len: number, droop: number): [P, P, P] {
	const ux = Math.cos(rad(deg));
	const uy = Math.sin(rad(deg));
	return [[x, y], [x + ux * len * 0.6, y + uy * len * 0.6 - droop * 0.2], [x + ux * len, Math.min(y + uy * len + droop, y - 3)]];
}

function arch(x: number, y: number, deg: number, len: number, droop: number, w: number, fill: string): string {
	const [a, c, b] = archPts(x, y, deg, len, droop);
	return sliver(a, c, b, w, fill);
}

/** n arching blades fanned from `from` to `to` degrees; len and droop scale with how far a blade leans. */
function fan(x: number, y: number, n: number, from: number, to: number, len: number, droop: number, w: number, fills: readonly string[], spreadX = 0): string {
	let s = "";
	for (let i = 0; i < n; i++) {
		const t = n === 1 ? 0.5 : i / (n - 1);
		const deg = from + (to - from) * t;
		const lean = Math.abs(Math.cos(rad(deg)));
		s += arch(x + (t - 0.5) * spreadX, y, deg, len * (1 - lean * 0.25), droop * lean, w, at(fills, i));
	}
	return s;
}

/** An ellipse as a path segment: centre (x, y), long radius a along deg, short radius b. */
function ell(x: number, y: number, a: number, b: number, deg: number): string {
	const ux = Math.cos(rad(deg)) * a;
	const uy = Math.sin(rad(deg)) * a;
	return `M${f(x + ux)} ${f(y + uy)}A${f(a)} ${f(b)} ${f(deg)} 0 1 ${f(x - ux)} ${f(y - uy)}A${f(a)} ${f(b)} ${f(deg)} 0 1 ${f(x + ux)} ${f(y + uy)}Z`;
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
	let s = `<path d="${k1}" fill="${c1}"/><path d="${k2}" fill="${c2}"/>`;
	if (awn) {
		aw += `M${f(tip.x + Math.cos(rad(tip.deg)) * ry)} ${f(tip.y + Math.sin(rad(tip.deg)) * ry)}l${f(Math.cos(rad(tip.deg)) * awn)} ${f(Math.sin(rad(tip.deg)) * awn)}`;
		s = `<path d="${aw}" stroke="${awnColor}" stroke-width=".6" fill="none" stroke-linecap="round"/>` + s;
	}
	return s;
}

/** A jointed culm from (x, 87) to (tx, ty) with node rings every `gap`. */
function culm(x: number, tx: number, ty: number, w: number, fill: string, node: string, gap: number, nodeW = 0.9): string {
	let s = line(x, 87, tx, ty, fill, w);
	const n = Math.floor((87 - ty) / gap);
	for (let k = 1; k <= n; k++) {
		const t = (k * gap) / (87 - ty);
		if (t > 0.97) break;
		const cx = x + (tx - x) * t;
		const cy = 87 + (ty - 87) * t;
		s += line(cx - w * 0.55, cy, cx + w * 0.55, cy, node, nodeW);
	}
	return s;
}

/** Small dots filling an ellipse, row by row (dense seed heads). */
function cluster(cx: number, cy: number, rx: number, ry: number, r: number, colors: readonly string[], pointy = 0): string {
	let s = "";
	const step = r * 1.55;
	let i = 0;
	for (let y = cy - ry + r; y <= cy + ry - r * 0.5; y += step) {
		const v = (y - cy) / ry;
		let half = rx * Math.sqrt(Math.max(0, 1 - v * v));
		if (pointy) half *= Math.min(1, (y - (cy - ry)) / (ry * pointy));
		const row = Math.round((y - cy) / step);
		const off = row % 2 === 0 ? 0 : step / 2;
		for (let x = cx - half + r * 0.6 + off; x <= cx + half - r * 0.4; x += step) {
			s += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${at(colors, i++)}"/>`;
		}
	}
	return s;
}

/** A bristly head along a quadratic: hairs at ±splay degrees from the axis, a core stroke on top. */
function brush(a: P, c: P, b: P, n: number, hair: number, splay: number, hairColor: string, core: string, coreW: number): string {
	let d = "";
	for (let k = 0; k <= n; k++) {
		const p = qpt(a, c, b, k / n);
		const l = hair * (k === n ? 0.6 : 1 - (k / n) * 0.35);
		for (const sd of [-1, 1]) {
			const g = rad(p.deg + sd * splay);
			d += `M${f(p.x)} ${f(p.y)}l${f(Math.cos(g) * l)} ${f(Math.sin(g) * l)}`;
		}
	}
	return `<path d="${d}" stroke="${hairColor}" stroke-width=".6" fill="none" stroke-linecap="round"/>` + qline(a, c, b, core, coreW);
}

/* ---------- species ---------- */

function wheat(stage: string): string {
	if (stage === "sprout") return blade(39, 33, 66) + blade(41, 47, 64, GREEN.light);
	if (stage === "leafy") return blade(38, 20, 60) + blade(39, 30, 44, GREEN.light) + blade(40, 40, 36) + blade(41, 51, 44, GREEN.light) + blade(42, 61, 58);
	let s = blade(38, 22, 64) + blade(42, 58, 62, GREEN.light);
	for (const [tx, ty] of [
		[33, 22],
		[41, 16],
		[50, 24],
	] as [number, number][]) {
		s += `<path d="M40 87Q40 50 ${tx} ${ty}" stroke="#c9a646" stroke-width="1.4" fill="none"/>`;
		for (let k = 0; k < 5; k++) {
			const y = ty + 3 + k * 3.2;
			const x = tx + ((40 - tx) * (k * 3.2)) / 60;
			s += `<ellipse cx="${f(x - 1.8)}" cy="${f(y)}" rx="1.6" ry="3" fill="#e3b955" transform="rotate(-25 ${f(x - 1.8)} ${f(y)})"/><ellipse cx="${f(x + 1.8)}" cy="${f(y)}" rx="1.6" ry="3" fill="#d8a93f" transform="rotate(25 ${f(x + 1.8)} ${f(y)})"/>`;
		}
		s += `<ellipse cx="${tx}" cy="${ty}" rx="1.5" ry="3" fill="#e3b955"/>`;
	}
	return s + blade(40, 34, 52) + blade(40, 47, 50, GREEN.light);
}

function barley(stage: string): string {
	const g = ["#7db864", "#94c776"] as const;
	if (stage === "sprout") return fan(40, 87, 3, -125, -60, 20, 5, 1.9, g);
	if (stage === "leafy") return fan(40, 87, 6, -150, -35, 42, 14, 2.1, g);
	let s = fan(40, 87, 5, -160, -25, 34, 16, 2.1, g);
	const heads: [P, P, P, P][] = [
		[[36, 56], [30, 40], [26, 31], [20, 25]],
		[[40, 50], [41, 33], [42, 25], [45, 18]],
		[[45, 56], [51, 42], [56, 34], [62, 30]],
	];
	for (const [c, h, hc, tip] of heads) {
		s += qline([40, 87], c, h, "#bfae5a", 1.3);
		s += spike(h, hc, tip, 0, 6, 1.5, 2.5, "#e2cf78", "#cdb55a", 20, 8, "#d9c787");
	}
	return s + fan(40, 87, 2, -120, -62, 26, 6, 1.9, g);
}

function oat(stage: string): string {
	const g = ["#80ad74", "#97bf86"] as const;
	if (stage === "sprout") return blade(39, 34, 68, g[0], 1.5) + blade(41, 46, 64, g[1], 1.5);
	if (stage === "leafy") return fan(40, 87, 5, -140, -45, 40, 12, 1.6, g) + blade(40, 41, 40, g[1], 1.5);
	let s = fan(40, 87, 4, -150, -35, 30, 12, 1.6, g);
	let pa = "";
	let pb = "";
	let br = "";
	const spikelet = (x: number, y: number, tilt: number) => {
		for (const [d, side] of [
			[90 + tilt - 12, 1],
			[90 + tilt + 12, -1],
		] as [number, number][]) {
			const e = ell(x + Math.cos(rad(d)) * 3.5, y + Math.sin(rad(d)) * 3.5, 3.5, 1.5, d);
			if (side > 0) pa += e;
			else pb += e;
		}
	};
	for (const [tx, ty, side] of [
		[31, 12, -1],
		[51, 18, 1],
	] as [number, number, number][]) {
		s += `<path d="M40 87Q40 50 ${tx} ${ty}" stroke="#a9b86a" stroke-width="1.2" fill="none"/>`;
		for (let k = 0; k < 4; k++) {
			const t = k / 4;
			const x = tx + (40 - tx) * t * 0.35;
			const y = ty + t * 30;
			for (const d of [-1, 1]) {
				const bx = x + d * (5 + k * 1.2);
				const by = y + 3.5;
				br += `M${f(x)} ${f(y)}L${f(bx)} ${f(by)}`;
				spikelet(bx, by, d * 10 * side);
			}
		}
		spikelet(tx, ty, 0);
	}
	return s + `<path d="${br}" stroke="#a9b86a" stroke-width=".8" stroke-linecap="round"/><path d="${pa}" fill="#d6dca0"/><path d="${pb}" fill="#bcc77e"/>`;
}

function rice(stage: string): string {
	const g = ["#6fbf4f", "#8ad06a", "#5aa840"] as const;
	if (stage === "sprout") return fan(40, 87, 4, -130, -55, 20, 4, 1.3, g, 4);
	if (stage === "leafy") return fan(40, 87, 9, -155, -25, 44, 16, 1.4, g, 6);
	let s = fan(40, 87, 9, -165, -15, 40, 22, 1.4, g, 6);
	const arcs: [P, P, number][] = [
		[[36, 14], [18, 30], 4],
		[[42, 8], [60, 22], 5],
	];
	for (const [c, b, n] of arcs) {
		const a: P = [40, 86];
		s += qline(a, c, b, "#a9b55a", 1.1);
		for (let k = 0; k < n; k++) {
			const p = qpt(a, c, b, 0.72 + (0.28 * k) / (n - 1));
			const len = 8 + k * 1.5;
			const ex = p.x + (b[0] > 40 ? 1.5 : -1.5);
			s += line(p.x, p.y, ex, p.y + len, "#b9b46a", 0.6);
			for (let j = 0; j < 3; j++) {
				const y = p.y + 2.5 + j * (len / 3);
				const x = p.x + ((ex - p.x) * (y - p.y)) / len;
				s += `<ellipse cx="${f(x + (j % 2 ? 1.1 : -1.1))}" cy="${f(y)}" rx="1.15" ry="2" fill="${j % 2 ? "#cfa63e" : "#e4c45e"}" transform="rotate(${j % 2 ? -18 : 18} ${f(x)} ${f(y)})"/>`;
			}
		}
	}
	return s;
}

function corn(stage: string): string {
	const st = "#6f9d45";
	const g = [GREEN.leaf, GREEN.light] as const;
	const leaves = (ys: number[], len: number, droop: number) => ys.map((y, i) => arch(40, y, i % 2 ? -25 : -155, len, droop, 2.8, at(g, i))).join("");
	if (stage === "sprout") return line(40, 87, 40, 72, st, 2.6) + leaves([80, 74], 13, 4);
	if (stage === "leafy") return line(40, 87, 40, 42, st, 3.2) + leaves([80, 70, 60, 52], 22, 12) + arch(40, 44, -100, 10, 0, 2.2, GREEN.light);
	let s = line(40, 87, 40, 16, st, 3.8);
	s += leaves([82, 72, 62, 50, 40, 31], 26, 14);
	// tassel
	for (const d of [-125, -105, -90, -75, -55]) s += line(40, 17, 40 + Math.cos(rad(d)) * 10, 17 + Math.sin(rad(d)) * 10, "#d8b75a", 1);
	// ear
	s += `<g transform="translate(41.5 61) rotate(-58) scale(1.2)"><ellipse cx="11" cy="0" rx="9.5" ry="3.9" fill="#f2c94c"/><path d="M5 -2.6h12M4 0h15M5 2.6h12" stroke="#dba52e" stroke-width=".7" stroke-dasharray="1.4 .9"/>`;
	s += `<path d="M0 0C3 -6 11 -6.5 17 -2.2C11 -3 5 -1.5 0 0Z" fill="#9ccb6c"/><path d="M0 0C3 6 11 6.5 17 2.2C11 3 5 1.5 0 0Z" fill="#7cb655"/><path d="M20.3 0l3.4 -2.4M20.3 0l3.8 .8M20.3 0l2.8 2.8" stroke="#b5733a" stroke-width=".8" stroke-linecap="round"/></g>`;
	return s;
}

function rye(stage: string): string {
	const g = ["#86a98c", "#9dbca0"] as const;
	if (stage === "sprout") return blade(39, 36, 64, g[0], 1.2) + blade(41, 45, 66, g[1], 1.2) + blade(40, 40, 70, g[0], 1);
	if (stage === "leafy") return fan(40, 87, 6, -125, -55, 46, 6, 1.2, g);
	let s = fan(40, 87, 6, -140, -40, 36, 10, 1.2, g);
	const heads: [P, P, P, P][] = [
		[[36, 44], [29, 30], [27, 22], [24, 12]],
		[[40, 40], [37, 27], [37, 19.5], [38, 10.5]],
		[[45, 44], [47, 29], [50, 21], [53, 13]],
		[[49, 52], [57, 36], [61, 30], [66, 23]],
	];
	for (const [c, h, hc, tip] of heads) {
		s += qline([40, 87], c, h, "#a89a74", 1);
		s += spike(h, hc, tip, 0, 5, 1.05, 2.3, "#b49b6c", "#9c8258", 22, 3, "#9c8a6a");
	}
	return s;
}

function sorghum(stage: string): string {
	const st = "#7f9a4c";
	const g = ["#64a35e", "#7cb872"] as const;
	const lf = (ys: number[], len: number, droop: number) =>
		ys
			.map((y, i) => {
				const [a, c, b] = archPts(40, y, i % 2 ? -30 : -150, len, droop);
				return sliver(a, c, b, 2.9, at(g, i)) + qline(a, c, b, "#e8efd8", 0.6, ` opacity=".8"`);
			})
			.join("");
	if (stage === "sprout") return line(40, 87, 40, 74, st, 2.4) + lf([80, 75], 14, 5);
	if (stage === "leafy") return line(40, 87, 40, 46, st, 3) + lf([80, 70, 60, 51], 24, 14);
	let s = line(40, 87, 40, 30, st, 3.4) + lf([80, 70, 60, 50, 41], 27, 16);
	s += line(40, 30, 40, 22, "#8a8a4a", 1.6);
	return s + cluster(40, 19, 8, 11, 2.1, ["#b04a2c", "#c8643a", "#8f3a22", "#bd5532"]);
}

function millet(stage: string): string {
	const g = ["#78b05a", "#91c271"] as const;
	if (stage === "sprout") return fan(40, 87, 3, -130, -50, 18, 6, 2, g);
	if (stage === "leafy") return fan(40, 87, 6, -160, -20, 36, 18, 2.4, g) + line(40, 87, 40, 50, "#7d9e52", 1.6) + `<rect x="37.7" y="38" width="4.6" height="13" rx="2.3" fill="#a4c27a"/>`;
	let s = "";
	const candle = (x: number, y: number, h: number, tilt: number) => {
		let c = `<g transform="rotate(${tilt} ${x} ${y + h})"><rect x="${f(x - 2.8)}" y="${f(y)}" width="5.6" height="${f(h)}" rx="2.8" fill="#c7b285"/>`;
		for (let yy = y + 2; yy < y + h - 1; yy += 2.4) c += `<path d="M${f(x - 1.6)} ${f(yy)}h3.2" stroke="#a8926a" stroke-width=".8" stroke-linecap="round" stroke-dasharray=".1 1.5"/>`;
		return c + `</g>`;
	};
	for (const [x, top, h, tilt] of [
		[30, 14, 17, -12],
		[41, 6, 19, 2],
		[51, 18, 16, 14],
	] as [number, number, number, number][]) {
		s += line(40, 87, x + (tilt > 0 ? 3 : tilt < 0 ? -3 : 0) * 0, top + h, "#9aa45c", 1.4) + candle(x, top, h, tilt);
	}
	return fan(40, 87, 7, -165, -15, 36, 20, 2.4, g) + s;
}

function bamboo(stage: string): string {
	const c = "#8ab450";
	const node = "#557a30";
	const g = ["#5f9e4a", "#7cb85c"] as const;
	const spray = (x: number, y: number, side: number, n: number, len: number) => {
		let s = line(x, y, x + side * 4, y - 2, node, 0.8);
		for (let i = 0; i < n; i++) s += leaf(x + side * 4, y - 2, side > 0 ? 10 + i * 22 - 20 : 170 - i * 22 + 20, len, 2.1, { fill: at(g, i), shape: 1, rib: false });
		return s;
	};
	if (stage === "sprout") return culm(40, 40, 68, 2.6, c, node, 6) + spray(40, 74, 1, 2, 8) + leaf(40, 68, -70, 8, 2, { fill: g[1], shape: 1, rib: false }) + leaf(40, 68, -120, 8, 2, { fill: g[0], shape: 1, rib: false });
	if (stage === "leafy")
		return culm(36, 34, 46, 2.8, c, node, 7) + culm(44, 46, 38, 2.8, c, node, 7) + spray(35, 60, -1, 3, 10) + spray(45, 52, 1, 3, 10) + spray(34, 48, -1, 2, 9) + spray(46, 40, 1, 3, 9);
	let s = culm(34, 28, 16, 3.2, c, node, 8) + culm(41, 42, 8, 3.4, c, node, 8) + culm(47, 54, 22, 3, c, node, 8);
	s += spray(31, 46, -1, 3, 11) + spray(29, 30, -1, 3, 10) ;
	s += spray(42, 28, 1, 3, 11) + spray(42, 12, 1, 2, 9);
	s += spray(52, 40, 1, 3, 11) + spray(54, 26, 1, 3, 10);
	return s;
}

function pampas(stage: string): string {
	const g = ["#89a877", "#a3bd90", "#7a9a6a"] as const;
	if (stage === "sprout") return fan(40, 87, 5, -150, -30, 18, 8, 1, g);
	if (stage === "leafy") return fan(40, 87, 13, -172, -8, 40, 24, 1.1, g, 6);
	let s = fan(40, 87, 13, -175, -5, 36, 26, 1.1, g, 8);
	const plume = (x: number, y: number, deg: number) => leaf(x, y, deg, 23, 5.5, { fill: "#c9b285", shape: 0, rib: false }) + leaf(x, y, deg - 4, 22, 3.6, { fill: "#e2d2ae", shape: 1, rib: false }) + leaf(x, y, deg - 6, 17, 1.8, { fill: "#f3ebd8", shape: 1, rib: false });
	for (const [bx, by, deg] of [
		[27, 38, -112],
		[37, 30, -95],
		[45, 34, -80],
		[54, 42, -66],
	] as [number, number, number][]) {
		s += line(40, 85, bx, by, "#c2b088", 1) + plume(bx, by, deg);
	}
	return s;
}

function fountain(stage: string): string {
	const g = ["#7ea65e", "#94b874", "#6d9750"] as const;
	if (stage === "sprout") return fan(40, 87, 6, -150, -30, 18, 9, 0.9, g);
	if (stage === "leafy") return fan(40, 87, 15, -172, -8, 38, 30, 0.9, g, 4);
	let s = fan(40, 87, 15, -175, -5, 36, 32, 0.9, g, 4);
	for (const [deg, len, droop] of [
		[-145, 40, 16],
		[-118, 50, 12],
		[-93, 56, 6],
		[-66, 50, 12],
		[-38, 40, 16],
	] as [number, number, number][]) {
		const [a, c, b] = archPts(40, 86, deg, len, droop);
		s += qline(a, c, b, "#a8907a", 0.8);
		const [ta, tc, tb] = qtail(a, c, b, 0.55);
		s += brush(ta, tc, tb, 9, 3.4, 32, "#c08aa6", "#d6a8bf", 1.6);
	}
	return s;
}

function fescue(stage: string): string {
	const b = ["#8fb3c6", "#6f97ad", "#a9c7d6"] as const;
	const tuft = (n: number, len: number) => {
		let s = "";
		for (let i = 0; i < n; i++) {
			const t = i / (n - 1);
			const deg = -168 + 156 * t;
			const l = len * (0.6 + 0.4 * Math.sin(Math.PI * t)) * (i % 3 === 1 ? 0.85 : 1);
			s += leaf(40 + (t - 0.5) * 6, 86, deg, l, 2.2, { fill: at(b, i), shape: 3, rib: false });
		}
		return s;
	};
	if (stage === "sprout") return tuft(9, 13);
	if (stage === "leafy") return tuft(21, 30);
	let s = "";
	for (const [tx, ty] of [
		[27, 30],
		[35, 22],
		[44, 20],
		[53, 28],
	] as [number, number][]) {
		s += line(40, 80, tx, ty, "#bba468", 0.9) + leaf(tx, ty + 7, -90 + (tx - 40) * 0.6, 9, 1.7, { fill: "#cfb878", shape: 1, rib: false });
	}
	return s + tuft(25, 34);
}

function cattail(stage: string): string {
	const g = ["#78a85e", "#8fbb70", "#679a50"] as const;
	const sword = (x: number, tx: number, ty: number, w: number, fill: string) => sliver([x, 87], [x + (tx - x) * 0.3, (87 + ty) / 2], [tx, ty], w, fill);
	if (stage === "sprout") return sword(39, 34, 66, 1.4, g[0]) + sword(40, 41, 62, 1.4, g[1]) + sword(41, 47, 68, 1.4, g[2]);
	if (stage === "leafy") return sword(37, 22, 46, 1.8, g[0]) + sword(39, 31, 34, 1.8, g[1]) + sword(41, 46, 32, 1.8, g[2]) + sword(42, 58, 44, 1.8, g[0]) + sword(40, 40, 50, 1.6, g[1]);
	let s = sword(37, 18, 44, 1.9, g[0]) + sword(38, 27, 30, 1.9, g[1]) + sword(42, 54, 28, 1.9, g[2]) + sword(43, 64, 42, 1.9, g[0]);
	const head = (x: number, top: number, h: number) => line(x, 87, x, top, "#7f9a52", 1.4) + line(x, top, x, top - 9, "#b39466", 1.1) + `<rect x="${f(x - 3.1)}" y="${top}" width="6.2" height="${h}" rx="3.1" fill="#6e4326"/><rect x="${f(x - 1.9)}" y="${top + 2}" width="1.3" height="${h - 4}" rx=".65" fill="#8f5c38"/>`;
	s += head(35, 24, 15) + head(45, 33, 13);
	return s + sword(40, 41, 40, 1.7, g[1]);
}

function papyrus(stage: string): string {
	const st = "#5f9a45";
	const umbel = (x: number, y: number, r: number, n: number) => {
		let rays = "";
		let tips = "";
		for (let i = 0; i < n; i++) {
			const deg = -200 + (220 * i) / (n - 1);
			const tx = x + Math.cos(rad(deg)) * r;
			const ty = y + Math.sin(rad(deg)) * r * 0.85 + (Math.abs(deg + 90) > 70 ? r * 0.2 : 0);
			rays += `M${f(x)} ${f(y)}Q${f(x + Math.cos(rad(deg)) * r * 0.6)} ${f(y + Math.sin(rad(deg)) * r * 0.6 - r * 0.15)} ${f(tx)} ${f(ty)}`;
			tips += `M${f(tx)} ${f(ty)}h0`;
		}
		return `<path d="${rays}" stroke="#7fbb5e" stroke-width=".8" fill="none"/><path d="${tips}" stroke="#a8d07a" stroke-width="1.8" stroke-linecap="round"/>` + circle(x, y, 1.2, "#c9b46a");
	};
	const sheath = leaf(40, 87, -100, 7, 2.2, { fill: "#a5845a", shape: 1, rib: false }) + leaf(40, 87, -78, 6, 2, { fill: "#8f7049", shape: 1, rib: false });
	if (stage === "sprout") return line(40, 87, 40, 70, st, 1.5) + umbel(40, 70, 6, 9) + sheath;
	if (stage === "leafy") return line(40, 87, 30, 48, st, 1.5) + line(40, 87, 48, 40, st, 1.5) + line(40, 87, 40, 58, st, 1.4) + umbel(30, 48, 8, 11) + umbel(48, 40, 8, 11) + umbel(40, 58, 6, 9) + sheath;
	let s = "";
	for (const [x, y, r] of [
		[22, 36, 9],
		[56, 34, 10],
		[33, 20, 11],
		[48, 16, 11],
		[41, 46, 8],
	] as [number, number, number][]) s += line(40, 87, x, y, st, 1.5) + umbel(x, y, r, 13);
	return s + sheath;
}

function sugarcane(stage: string): string {
	const cane = "#8c4f6b";
	const node = "#d7b5be";
	const g = ["#79ad55", "#90c06a"] as const;
	if (stage === "sprout") return culm(40, 40, 77, 3.6, cane, node, 5, 0.8) + arch(40, 78, -120, 14, 4, 1.4, g[0]) + arch(40, 78, -60, 14, 4, 1.4, g[1]) + arch(40, 78, -90, 12, 0, 1.3, g[0]);
	if (stage === "leafy") return culm(36, 34, 56, 4, cane, node, 6) + culm(44, 46, 62, 4, cane, node, 6) + fan(34, 57, 4, -165, -60, 26, 14, 1.6, g) + fan(46, 63, 4, -120, -15, 26, 14, 1.6, g);
	let s = culm(35, 32, 34, 4.4, cane, node, 7) + culm(44, 46, 26, 4.6, cane, node, 7) + culm(50, 56, 44, 4, cane, node, 7);
	s += fan(32, 36, 4, -175, -80, 30, 18, 1.7, g) + fan(56, 46, 3, -60, -5, 24, 16, 1.7, g) + fan(46, 28, 4, -150, -20, 26, 16, 1.7, g);
	return s + brush([46, 28], [46.5, 20], [48, 9], 9, 4, 28, "#e6e1d3", "#cfc6b2", 1.6);
}

function lemongrass(stage: string): string {
	const g = ["#a3cc5c", "#88b84a", "#b5d670"] as const;
	const base = ["#e3e6bf", "#d3d8a3", "#cdb8a8"] as const;
	const stalks = (xs: number[], top: number) => xs.map((x, i) => sliver([x, 87.5], [x + (x - 40) * 0.1, (87 + top) / 2], [x + (x - 40) * 0.25, top], 1.9, at(base, i))).join("");
	if (stage === "sprout") return fan(40, 76, 4, -140, -40, 14, 6, 1.4, g) + stalks([38.5, 41.5], 72);
	if (stage === "leafy") return fan(40, 70, 9, -165, -15, 32, 18, 1.6, g) + stalks([35, 38, 41, 44], 64);
	return fan(40, 66, 13, -172, -8, 44, 30, 1.8, g, 6) + fan(40, 66, 4, -120, -60, 30, 8, 1.6, [g[2], g[0]]) + stalks([32, 35.5, 38.5, 41.5, 44.5, 48], 58);
}

function foxtail(stage: string): string {
	const g = ["#8ab65e", "#a1c676"] as const;
	if (stage === "sprout") return blade(39, 35, 70, g[0], 1.5) + blade(41, 46, 68, g[1], 1.5);
	const head = (deg: number, len: number, droop: number) => {
		const [a, c, b] = archPts(40, 86, deg, len, droop);
		const [ta, tc, tb] = qtail(a, c, b, 0.6);
		return qline(a, c, b, "#97a85a", 1) + brush(ta, tc, tb, 12, 3.2, 55, "#cfc56a", "#b5bd55", 3.6) + qline(ta, tc, tb, "#d3d47c", 1.4);
	};
	if (stage === "leafy") return fan(40, 87, 5, -150, -30, 30, 12, 1.8, g) + head(-92, 42, 6);
	return fan(40, 87, 6, -160, -20, 30, 14, 1.8, g) + head(-112, 54, 9) + head(-88, 66, 5) + head(-66, 54, 9);
}

function zebra(stage: string): string {
	const green = "#6aa152";
	const band = "#ecd36a";
	const striped = (deg: number, len: number, droop: number, w: number) => {
		const [a, c, b] = archPts(40, 87, deg, len, droop);
		let bands = "";
		for (const t of [0.34, 0.5, 0.66, 0.81]) {
			const p = qpt(a, c, b, t);
			const h = w * (1.25 - t);
			const nx = Math.cos(rad(p.deg + 90)) * h;
			const ny = Math.sin(rad(p.deg + 90)) * h;
			bands += `M${f(p.x - nx)} ${f(p.y - ny)}L${f(p.x + nx)} ${f(p.y + ny)}`;
		}
		return sliver(a, c, b, w, green) + `<path d="${bands}" stroke="${band}" stroke-width="1.3"/>`;
	};
	const many = (n: number, len: number, droop: number, w: number) => {
		let s = "";
		for (let i = 0; i < n; i++) {
			const deg = -150 + (120 * i) / (n - 1);
			const lean = Math.abs(Math.cos(rad(deg)));
			s += striped(deg, len * (1 - lean * 0.15), droop * lean * 1.4, w);
		}
		return s;
	};
	if (stage === "sprout") return many(3, 22, 4, 1.5);
	if (stage === "leafy") return many(7, 48, 22, 1.6);
	let s = "";
	for (const [tx, ty] of [
		[28, 18],
		[40, 13],
		[52, 18],
	] as [number, number][]) {
		s += line(40, 80, tx, ty + 14, "#b6967a", 0.9) + brush([tx, ty + 14], [tx, ty + 8], [tx + (tx - 40) * 0.12, ty], 7, 4, 22, "#d39a80", "#bb7c62", 1.4);
	}
	return s + many(9, 48, 24, 1.7);
}

function featherReed(stage: string): string {
	const g = ["#6f9c55", "#86b06a"] as const;
	if (stage === "sprout") return fan(40, 87, 4, -125, -55, 20, 3, 1.1, g);
	if (stage === "leafy") return fan(40, 87, 8, -150, -30, 26, 12, 1.2, g) + fan(40, 87, 5, -105, -75, 44, 2, 1.1, g, 4);
	let s = "";
	for (let i = 0; i < 9; i++) {
		const t = i / 8;
		const x = 31 + t * 18;
		const top = 10 + Math.abs(t - 0.5) * 16 + (i % 2) * 3;
		s += line(40, 85, x, top + 15, "#c3a76a", 0.9) + leaf(x, top + 16, -90 + (t - 0.5) * 12, 17, 2.1, { fill: i % 2 ? "#d6bb7f" : "#c7a865", shape: 1, rib: false });
	}
	return fan(40, 87, 9, -160, -20, 28, 12, 1.2, g) + s;
}

function quinoa(stage: string): string {
	const st = "#7d9a4c";
	const g = ["#78a85a", "#92bd6c"] as const;
	const goose = (x: number, y: number, deg: number, len: number, w: number, fill: string) =>
		`<g transform="translate(${f(x)} ${f(y)}) rotate(${f(deg)})"><path d="M0 0L${f(len * 0.25)} 0L${f(len * 0.42)} ${f(-w)}L${f(len * 0.62)} ${f(-w * 0.85)}L${f(len)} 0L${f(len * 0.62)} ${f(w * 0.85)}L${f(len * 0.42)} ${f(w)}L${f(len * 0.25)} 0Z" fill="${fill}" stroke="${fill}" stroke-width="1.2" stroke-linejoin="round"/><path d="M0 0L${f(len * 0.8)} 0" stroke="#4f7a3a" stroke-width=".7" opacity=".55"/></g>`;
	const red = ["#c23a64", "#d95c7c", "#a82c50", "#e07a5a"] as const;
	if (stage === "sprout") return line(40, 87, 40, 70, st, 1.8) + goose(40, 72, -155, 11, 4.5, g[0]) + goose(40, 72, -25, 11, 4.5, g[1]);
	if (stage === "leafy") return line(40, 87, 40, 40, st, 2.4) + goose(40, 76, -165, 16, 6, g[0]) + goose(40, 68, -15, 16, 6, g[1]) + goose(40, 58, -160, 14, 5.5, g[1]) + goose(40, 50, -20, 13, 5, g[0]) + cluster(40, 38, 3.6, 5.5, 1.5, ["#a9c46a", "#bcd47e"]);
	let s = line(40, 87, 40, 24, st, 2.6);
	s += goose(40, 80, -168, 17, 6.5, g[0]) + goose(40, 72, -12, 17, 6.5, g[1]) + goose(40, 62, -165, 15, 6, g[1]) + goose(40, 54, -15, 14, 5.5, g[0]);
	s += line(40, 50, 28, 40, st, 1.4) + line(40, 46, 52, 36, st, 1.4);
	s += cluster(27, 37, 4.2, 6, 1.7, red) + cluster(53, 33, 4.2, 6, 1.7, red);
	return s + cluster(40, 22, 8.5, 17, 1.9, red, 0.9);
}

function buckwheat(stage: string): string {
	const st = "#b0545c";
	const g = ["#74b05a", "#8ec26e"] as const;
	const lf = (x: number, y: number, deg: number, len: number) => line(x, y, x + Math.cos(rad(deg)) * 3, y + Math.sin(rad(deg)) * 3, st, 0.9) + leaf(x + Math.cos(rad(deg)) * 3, y + Math.sin(rad(deg)) * 3, deg, len, len * 0.42, { fill: at(g, deg < -90 ? 0 : 1), shape: 4 });
	const flowers = (x: number, y: number) => {
		let s = "";
		const pts: P[] = [
			[0, 0],
			[-3.2, 1],
			[3.2, 0.8],
			[-1.6, -2.8],
			[1.8, -2.6],
			[0, 3],
			[-4, -2],
			[4, -1.8],
		];
		pts.forEach(([dx, dy], i) => {
			s += `<circle cx="${f(x + dx)}" cy="${f(y + dy)}" r="1.9" fill="${i % 3 === 2 ? "#eab3c4" : "#f7ecef"}"/><circle cx="${f(x + dx)}" cy="${f(y + dy)}" r=".6" fill="#d77a95"/>`;
		});
		return s;
	};
	if (stage === "sprout") return line(40, 87, 40, 70, st, 1.5) + lf(40, 72, -150, 9) + lf(40, 72, -30, 9);
	if (stage === "leafy") return line(40, 87, 40, 42, st, 1.8) + line(40, 64, 50, 50, st, 1.3) + lf(40, 78, -160, 13) + lf(40, 68, -20, 13) + lf(40, 58, -155, 12) + lf(50, 52, -30, 10) + lf(40, 46, -130, 10) + lf(40, 44, -60, 9);
	let s = line(40, 87, 40, 22, st, 2) + line(40, 66, 25, 34, st, 1.4) + line(40, 58, 56, 30, st, 1.4);
	s += lf(40, 80, -165, 14) + lf(40, 72, -15, 14) + lf(32, 50, -160, 11) + lf(48, 46, -20, 11) + lf(40, 44, -150, 10) + lf(40, 38, -30, 10);
	return s + flowers(25, 30) + flowers(56, 26) + flowers(40, 18);
}

function seaOats(stage: string): string {
	const g = ["#9db38c", "#b2c4a2"] as const;
	if (stage === "sprout") return fan(40, 87, 3, -130, -50, 18, 7, 1.1, g);
	if (stage === "leafy") return fan(40, 87, 7, -160, -20, 36, 20, 1.2, g);
	let s = fan(40, 87, 7, -165, -15, 34, 22, 1.2, g);
	const flake = (x: number, y: number, deg: number) => `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(deg)})"><path d="M0 0L2.7 3.6L0 8.6L-2.7 3.6Z" fill="${deg > 0 ? "#dcb562" : "#c99c48"}"/><path d="M0 .6V7.8" stroke="#a9813a" stroke-width=".5"/></g>`;
	for (const [c, b] of [
		[[36, 8], [20, 20]],
		[[45, 6], [61, 16]],
	] as [P, P][]) {
		const a: P = [40, 86];
		s += qline(a, c, b, "#c4a868", 1.1);
		for (let k = 0; k < 5; k++) {
			const p = qpt(a, c, b, 0.6 + k * 0.1);
			const drop = 2 + (k % 2) * 3;
			s += line(p.x, p.y, p.x, p.y + drop, "#c4a868", 0.6) + flake(p.x, p.y + drop, k % 2 ? 8 : -8) + flake(p.x, p.y + drop + 7.5, k % 2 ? -6 : 6);
		}
	}
	return s;
}

function switchgrass(stage: string): string {
	const g = ["#6c9e5e", "#84b26e", "#5e8f52"] as const;
	if (stage === "sprout") return fan(40, 87, 4, -115, -65, 20, 2, 1.1, g, 3);
	if (stage === "leafy") return fan(40, 87, 9, -125, -55, 48, 6, 1.2, g, 6);
	let s = "";
	const haze = (x: number, top: number, h: number) => {
		let d = `M${f(x)} ${f(top + h)}L${f(x)} ${f(top)}`;
		let dots = "";
		let dots2 = "";
		for (let k = 0; k < 6; k++) {
			const y = top + 2 + k * (h / 6);
			const l = 3 + Math.sin(((k + 1) / 7) * Math.PI) * 5;
			for (const sd of [-1, 1]) {
				const ex = x + sd * l;
				const ey = y - l * 0.9;
				d += `M${f(x)} ${f(y)}L${f(ex)} ${f(ey)}`;
				dots += `M${f(ex)} ${f(ey)}h0M${f(x + sd * l * 0.55)} ${f(y - l * 0.5)}h0`;
				dots2 += `M${f(x + sd * l * 0.8 + 0.6)} ${f(y - l * 0.9 + 1.4)}h0`;
			}
		}
		return `<path d="${d}" stroke="#b28a96" stroke-width=".5" fill="none"/><path d="${dots}" stroke="#c98a96" stroke-width="1.7" stroke-linecap="round"/><path d="${dots2}" stroke="#9e6478" stroke-width="1.4" stroke-linecap="round"/>`;
	};
	for (const [x, y, h] of [
		[29, 20, 18],
		[40, 11, 20],
		[51, 18, 18],
	] as [number, number, number][]) s += line(40, 86, x, y + h, "#a98a7a", 0.8) + haze(x, y, h);
	return s + fan(40, 87, 11, -128, -52, 46, 6, 1.2, g, 6);
}

function wildRice(stage: string): string {
	const g = ["#78ad58", "#93c070"] as const;
	if (stage === "sprout") return arch(40, 87, -110, 22, 4, 2, g[0]) + arch(40, 87, -70, 20, 5, 2, g[1]);
	if (stage === "leafy") return fan(40, 87, 6, -150, -30, 44, 20, 2.2, g);
	let s = fan(40, 87, 6, -160, -25, 42, 24, 2.2, g);
	const head = (x: number, top: number) => {
		let h = line(40, 86, x, top + 30, "#8aa45a", 1.2) + line(x, top + 30, x, top, "#7d6a5a", 1);
		// male part: drooping spreading branches
		for (let k = 0; k < 3; k++) {
			const y = top + 18 + k * 4;
			for (const sd of [-1, 1]) {
				const ex = x + sd * (6 + k * 1.5);
				const ey = y + 5;
				h += qline([x, y], [x + sd * 4, y - 1], [ex, ey], "#b8a26a", 0.6);
				h += `<ellipse cx="${f(ex)}" cy="${f(ey + 1.6)}" rx=".9" ry="1.9" fill="#e4cf86"/>`;
			}
		}
		// female part: erect dark grains with long awns
		return h + spike([x, top + 15], [x, top + 8], [x, top], 0, 5, 0.9, 2.3, "#7a4560", "#5e3448", 16, 5.5, "#8d6676");
	};
	return s + head(31, 14) + head(49, 18);
}

function horsetail(stage: string): string {
	const st = "#6e9e5a";
	const node = "#2f4a2c";
	const br = "#86b56c";
	const stemWhorls = (x: number, top: number, gap: number, maxLen: number) => {
		let s = "";
		let d = "";
		for (let y = 87 - gap; y > top + 3; y -= gap) {
			const t = (87 - y) / (87 - top);
			const l = maxLen * (1 - t * 0.7);
			for (const deg of [-160, -135, -110, -70, -45, -20]) d += `M${f(x)} ${f(y)}l${f(Math.cos(rad(deg)) * l)} ${f(Math.sin(rad(deg)) * l * 0.9 + l * 0.35)}`;
			s += line(x - 1.4, y, x + 1.4, y, node, 1);
		}
		return `<path d="${d}" stroke="${br}" stroke-width=".7" fill="none" stroke-linecap="round"/>` + line(x, 87, x, top, st, 2.2) + s;
	};
	if (stage === "sprout") return culm(40, 40, 68, 2.2, st, node, 5, 1) + `<path d="M40 64.5L41.2 68.5H38.8Z" fill="${node}"/>`;
	if (stage === "leafy") return stemWhorls(34, 44, 7, 7) + stemWhorls(46, 50, 7, 6.5);
	const fertile = line(40, 87, 40, 38, "#cdb592", 1.8) + line(38.6, 60, 41.4, 60, "#8a6a4a", 1) + line(38.6, 50, 41.4, 50, "#8a6a4a", 1) + `<ellipse cx="40" cy="32" rx="3" ry="6" fill="#a37b4a"/>` + `<path d="M37.5 29.5h5M37.2 32h5.6M37.5 34.5h5" stroke="#7e5a34" stroke-width=".7" stroke-dasharray="1 .8"/>`;
	return stemWhorls(28, 18, 7, 9) + stemWhorls(52, 14, 7, 9) + fertile + stemWhorls(38, 32, 8, 6);
}

/* ---------- registry ---------- */

const ENTRIES: [string, (stage: string) => string][] = [
	["Wheat", wheat],
	["Barley", barley],
	["Oat", oat],
	["Rice", rice],
	["Corn", corn],
	["Rye", rye],
	["Sorghum", sorghum],
	["Millet", millet],
	["Bamboo", bamboo],
	["Pampas grass", pampas],
	["Fountain grass", fountain],
	["Blue fescue", fescue],
	["Cattail", cattail],
	["Papyrus", papyrus],
	["Sugarcane", sugarcane],
	["Lemongrass", lemongrass],
	["Foxtail", foxtail],
	["Zebra grass", zebra],
	["Feather reed grass", featherReed],
	["Quinoa", quinoa],
	["Buckwheat", buckwheat],
	["Sea oats", seaOats],
	["Switchgrass", switchgrass],
	["Wild rice", wildRice],
	["Horsetail", horsetail],
];

export const SPECIES: Species[] = ENTRIES.map(([name, draw]) => ({
	id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
	name,
	draw,
}));
