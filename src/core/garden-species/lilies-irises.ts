/**
 * Garden species, family: lilies and irises. Each draws sprout, leafy and
 * bloom in the kit's flat style (see kit.ts); the kit draws soil and seed.
 */
import { blade, f, GREEN, line, type GrowingStage, type Species } from "./kit";

type St = GrowingStage;

/* ---------- private helpers ---------- */

const p = (d: string, fill: string): string => (d ? `<path d="${d}" fill="${fill}"/>` : "");

/** Stroked, unfilled path data. */
const sk = (d: string, stroke: string, w: number): string => `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${f(w)}" stroke-linecap="round"/>`;

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


const dotsD = (pts: readonly (readonly [number, number])[]): string => pts.map(([x, y]) => `M${f(x)} ${f(y)}h0`).join("");

/** Many dots of one colour in one path (zero-length round-capped strokes). */
const dots = (pts: readonly (readonly [number, number])[], r: number, fill: string): string => (pts.length ? sk(dotsD(pts), fill, 2 * r) : "");

/** Merges path data per fill (or stroke) into one <path> each, in first-seen order. */
class Ink {
	private parts = new Map<string, string>();
	fill(c: string, d: string): this {
		this.parts.set("f" + c, (this.parts.get("f" + c) ?? "") + d);
		return this;
	}
	line(c: string, w: number, d: string): this {
		const k = `s${c}|${f(w)}`;
		this.parts.set(k, (this.parts.get(k) ?? "") + d);
		return this;
	}
	dots(c: string, r: number, pts: readonly (readonly [number, number])[]): this {
		return this.line(c, 2 * r, dotsD(pts));
	}
	toString(): string {
		return [...this.parts]
			.map(([k, d]) => {
				if (k[0] === "f") return p(d, k.slice(1));
				const [c, w] = k.slice(1).split("|");
				return sk(d, c ?? "", parseFloat(w ?? "1"));
			})
			.join("");
	}
}

/** A point (u along, v across) of the frame at (x, y) heading deg, scaled len along and w across. */
function pt(u: number, v: number, x: number, y: number, deg: number, len: number, w = len): [number, number] {
	const r = (deg * Math.PI) / 180;
	const c = Math.cos(r);
	const s = Math.sin(r);
	return [x + c * u * len - s * v * w, y + s * u * len + c * v * w];
}

/** Maps a unit-space path (absolute M/L/Q/C/Z, numbers in pairs) onto the frame of `pt`. */
function loc(d: string, x: number, y: number, deg: number, len: number, w = len): string {
	let out = "";
	let u: number | null = null;
	for (const t of d.match(/[A-Za-z]|-?\d*\.?\d+/g) ?? []) {
		if (/[A-Za-z]/.test(t)) {
			out += t;
			continue;
		}
		if (u === null) {
			u = parseFloat(t);
			continue;
		}
		const [px, py] = pt(u, parseFloat(t), x, y, deg, len, w);
		out += `${/[A-Za-z]$/.test(out) ? "" : " "}${f(px)} ${f(py)}`;
		u = null;
	}
	return out;
}

/* Unit shapes, pointing along +u from the origin; w is the full width. */
const LENS = "M0 0Q.45 -1 1 0Q.45 1 0 0Z";
const SPOON = "M0 -.08C.35 -.12 .45 -.5 .78 -.5C1.08 -.5 1.08 .5 .78 .5C.45 .5 .35 .12 0 .08Z";
const OVAL = "M0 0C.1 -.62 .82 -.62 1 0C.82 .62 .1 .62 0 0Z";
/** A tepal curled back on itself (Turk's cap), hanging from the origin toward +u. */
const CURL = "M0 0C.2 1 .95 1 1 -.1C.75 .45 .35 .5 .1 -.05Z";
const TRUMPET = "M0 -.07C.45 -.08 .75 -.18 .95 -.42Q1.08 -.5 1.12 -.44Q1.02 -.25 1 0Q1.02 .25 1.12 .44Q1.08 .5 .95 .42C.75 .18 .45 .08 0 .07Z";
const BELL = "M-.7 -1C-.8 -.2 -1 .4 -1.1 .75Q-.75 .5 -.55 .9Q-.3 .55 0 .95Q.3 .55 .55 .9Q.75 .5 1.1 .75C1 .4 .8 -.2 .7 -1Q0 -1.3 -.7 -1Z";

const LILY_LEAF = "#4f8a45";

/** Alternate lance leaves up a straight stem from (40, 87) to (x1, top); the stem is drawn too. */
function leafyStem(x1: number, top: number, n: number, len: number, w: number, o: { fill?: string; stroke?: string; sw?: number; gap?: number; bottom?: number; droop?: number } = {}): string {
	const { fill = LILY_LEAF, stroke = GREEN.dark, sw = 2, gap = 6, bottom = 84, droop = 0 } = o;
	let d = "";
	for (let i = 0; i < n; i++) {
		const t = n === 1 ? 0 : i / (n - 1);
		const y = bottom + (top + gap - bottom) * t;
		const x = 40 + ((x1 - 40) * (87 - y)) / (87 - top);
		const a = i % 2 ? -32 - 18 * t + droop : -148 + 18 * t - droop;
		d += loc(LENS, x, y, a, len * (1 - 0.4 * t), w * (1 - 0.3 * t));
	}
	return line(40, 87, x1, top, stroke, sw) + p(d, fill);
}

/** A whorl of leaves around the stem at (x, y), seen from the side. */
function whorl(x: number, y: number, len: number, w: number, fill: string): string {
	let d = "";
	for (const a of [-172, -150, -122, -58, -30, -8, 165, 15]) d += loc(LENS, x, y, a, len * (0.5 + 0.5 * Math.abs(Math.cos((a * Math.PI) / 180))), w);
	return p(d, fill);
}

/** A strap leaf rising from the ground at x0 and arching over to (tx, ty) through (cx, cy). */
function strapD(x0: number, cx: number, cy: number, tx: number, ty: number, w: number): string {
	return `M${f(x0 - w)} 87Q${f(cx - w)} ${f(cy - w)} ${f(tx)} ${f(ty)}Q${f(cx + w)} ${f(cy + w)} ${f(x0 + w)} 87Z`;
}

/** Strap leaves (x0, cx, cy, tx, ty), alternating two fills. */
function straps(ls: readonly (readonly [number, number, number, number, number])[], w: number, a: string, b: string): string {
	let da = "";
	let db = "";
	ls.forEach(([x0, cx, cy, tx, ty], i) => {
		if (i % 2) db += strapD(x0, cx, cy, tx, ty, w);
		else da += strapD(x0, cx, cy, tx, ty, w);
	});
	return p(da, a) + p(db, b);
}

/** A nodding Turk's cap flower hanging from (x, y), painted into `ink`. */
function turk(ink: Ink, x: number, y: number, k: number, a: string, b: string, spot?: string, anther = "#6b3a1e"): Ink {
	ink.fill(b, loc(CURL, x, y, -28, 0.85 * k) + loc(CURL, x, y, 208, 0.85 * k, -0.85 * k));
	let st = "";
	const an: [number, number][] = [];
	for (const dx of [-0.42, -0.15, 0.15, 0.42]) {
		st += `M${f(x)} ${f(y + 0.2 * k)}L${f(x + dx * k)} ${f(y + 1.3 * k)}`;
		an.push([x + dx * k, y + 1.32 * k]);
	}
	ink.line("#c9a26a", k > 7 ? 0.6 : 0.45, st).dots(anther, k > 7 ? 0.9 : 0.6, an);
	ink.fill(a, loc(CURL, x, y, 8, k) + loc(CURL, x, y, 172, k, -k) + loc(OVAL, x, y - 0.05 * k, 90, 0.75 * k, 0.5 * k));
	if (spot) {
		const sp: [number, number][] = [];
		for (const [u, v] of [[0.35, 0.3], [0.55, 0.48], [0.75, 0.4], [0.82, 0.12]] as const) sp.push(pt(u, v, x, y, 8, k), pt(u, v, x, y, 172, k, -k));
		ink.dots(spot, k > 7 ? 0.5 : 0.42, sp);
	}
	return ink;
}

/** A trumpet flower from (x, y) opening toward deg, painted into `ink`. */
function trumpet(ink: Ink, x: number, y: number, deg: number, len: number, w: number, c: { a: string; b: string; throat: string; anth: string; shade?: string }): Ink {
	ink.fill(c.a, loc(TRUMPET, x, y, deg, len, w));
	if (c.shade) ink.fill(c.shade, loc("M0 0L1 0Q1.02 .25 1.12 .44Q1.08 .5 .95 .42C.75 .18 .45 .08 0 .07Z", x, y, deg, len, w));
	ink.fill(c.throat, loc("M0 -.07C.2 -.08 .35 -.09 .42 -.12L.42 .12C.35 .09 .2 .08 0 .07Z", x, y, deg, len, w));
	ink.line(c.b, 0.6, loc("M.45 0L.97 0M.5 -.1L.93 -.34M.5 .1L.93 .34", x, y, deg, len, w));
	ink.fill(c.b, loc("M.98 -.36Q1.05 0 .98 .36Q.93 0 .98 -.36Z", x, y, deg, len, w));
	ink.line("#cfd6a0", 0.5, loc("M.85 -.04L1.12 -.14M.85 .04L1.12 .14M.85 0L1.18 0", x, y, deg, len, w));
	return ink.dots(c.anth, 0.8, [pt(1.12, -0.14, x, y, deg, len, w), pt(1.12, 0.14, x, y, deg, len, w)]).dots("#c8d27a", 0.7, [pt(1.18, 0, x, y, deg, len, w)]);
}

/** Six tepals around the origin (3 back, 3 front), for face-on flowers drawn inside `g`. */
function six(k: number, shape: string, back: string, front: string, wB: number, wF: number, offset = 0): string {
	let b = "";
	let fr = "";
	for (const a of [-90, 30, 150]) b += loc(shape, 0, 0, a + offset, k, wB * k);
	for (const a of [-30, 90, 210]) fr += loc(shape, 0, 0, a + offset, k, wF * k);
	return p(b, back) + p(fr, front);
}

/** Short stamens radiating from the origin, with anthers. */
function stamens(k: number, n: number, len: number, stroke: string, anther: string, off = 15): string {
	let d = "";
	const an: [number, number][] = [];
	for (let i = 0; i < n; i++) {
		const [ex, ey] = pt(len * k, 0, 0, 0, off + (i * 360) / n, 1);
		d += `M0 0L${f(ex)} ${f(ey)}`;
		an.push([ex, ey]);
	}
	return sk(d, stroke, Math.max(0.4, 0.05 * k)) + dots(an, Math.max(0.55, 0.07 * k), anther);
}

interface IrisLook {
	std: string;
	std2: string;
	fall: string;
	fall2: string;
	/** Standards: half-spread from vertical, length, width (× k). */
	ss: number;
	sl: number;
	sw: number;
	/** Falls: spread from straight down, length, width (× k). */
	fs: number;
	fl: number;
	fw: number;
	sig?: string;
	vein?: string;
}

/** An iris flower with its centre at (x, y): standards up, falls out and down. */
function irisFlower(x: number, y: number, k: number, c: IrisLook): string {
	let s = p(loc(SPOON, x, y, -90 - c.ss, c.sl * k, c.sw * k) + loc(SPOON, x, y, -90 + c.ss, c.sl * k, c.sw * k), c.std);
	s += p(loc(SPOON, x, y, -90, c.sl * k * 1.05, c.sw * k * 1.1), c.std2);
	s += p(loc(SPOON, x, y, 90 + c.fs, c.fl * k, c.fw * k) + loc(SPOON, x, y, 90 - c.fs, c.fl * k, c.fw * k), c.fall);
	s += p(loc(SPOON, x, y, 90, c.fl * k * 0.8, c.fw * k * 0.95), c.fall2);
	if (c.vein) {
		let d = "";
		for (const a of [90 + c.fs, 90 - c.fs, 90]) {
			const l = a === 90 ? 0.8 : 1;
			d += loc("M.2 0L.7 0M.25 -.05L.62 -.22M.25 .05L.62 .22", x, y, a, c.fl * k * l, c.fw * k);
		}
		s += sk(d, c.vein, Math.max(0.4, 0.06 * k));
	}
	if (c.sig) {
		let d = "";
		for (const a of [90 + c.fs, 90 - c.fs, 90]) d += loc(LENS, x, y, a, c.fl * k * (a === 90 ? 0.4 : 0.5), c.fw * k * 0.28);
		s += p(d, c.sig);
	}
	return s;
}

/* ---------- 1. Tiger lily ---------- */
const TIG = { a: "#ea6a26", b: "#c44e1b", spot: "#3b1d12", bulb: "#3a2a2c" };
function tigerLily(st: St): string {
	if (st === "sprout") return leafyStem(40, 69, 7, 8, 2.2);
	if (st === "leafy") return leafyStem(40, 42, 12, 11, 2.4) + dots([[40.8, 70], [39.2, 62], [40.8, 54]], 1, TIG.bulb) + el(40, 37, 2.3, 5, "#a3bf6a") + sk("M40 44Q46 40 47 45", GREEN.dark, 1) + el(47, 47.5, 1.7, 3, "#c4c46a");
	let s = leafyStem(40, 30, 15, 10, 2.4) + dots([[40.9, 76], [39.1, 68], [40.9, 60], [39.1, 52], [40.9, 44]], 1.1, TIG.bulb);
	s += sk("M40 33Q30 27 26 32M40 31Q51 25 55 29M40 30C40 18 44 9 41 13", GREEN.dark, 1.3);
	const ink = new Ink();
	turk(ink, 26, 32, 8.5, TIG.a, TIG.b, TIG.spot);
	turk(ink, 55, 29, 8.5, TIG.a, TIG.b, TIG.spot);
	return s + turk(ink, 41, 13, 7.5, TIG.a, TIG.b, TIG.spot);
}

/* ---------- 2. Easter lily ---------- */
const EAST = { a: "#f5f2e6", shade: "#dcdcc6", b: "#b5bb92", throat: "#c6d99a", anth: "#e0a032" };
function easterLily(st: St): string {
	if (st === "sprout") return leafyStem(40, 70, 8, 8, 1.8);
	if (st === "leafy") return leafyStem(40, 46, 16, 11, 2) + p(loc(LENS, 40, 47, -62, 15, 4.6), "#d9e2bf") + p(loc(LENS, 40, 46, -118, 13, 4.2), "#e6ecd2");
	const ink = new Ink();
	trumpet(ink, 40, 40, 160, 22, 15, EAST);
	trumpet(ink, 40, 33, -52, 21, 14, EAST);
	trumpet(ink, 40, 37, 14, 22, 15, EAST);
	return leafyStem(40, 41, 20, 11, 2.1) + sk("M40 42L40 33", GREEN.dark, 2) + ink;
}

/* ---------- 3. Stargazer lily ---------- */
const STAR = { white: "#f7eef2", pink: "#d6336c", deep: "#9e1f4c", spot: "#7a1236" };
function stargazerHead(k: number): string {
	let s = "";
	for (const grp of [[-90, 30, 150], [-30, 90, 210]]) {
		let w = "";
		let pk = "";
		for (const a of grp) {
			w += loc(LENS, 0, 0, a, k, 0.48 * k);
			pk += loc(LENS, 0, 0, a, 0.8 * k, 0.28 * k);
		}
		s += p(w, STAR.white) + p(pk, STAR.pink);
	}
	const sp: [number, number][] = [];
	for (let i = 0; i < 6; i++) for (const r of [0.3, 0.45]) sp.push(pt(r * k, (i % 2 ? 0.06 : -0.06) * k, 0, 0, -90 + i * 60, 1));
	return s + dots(sp, 0.08 * k, STAR.spot) + el(0, 0, 0.16 * k, 0.16 * k, STAR.deep) + stamens(k, 6, 0.42, "#e5dcc0", "#8b3a1a");
}
function stargazer(st: St): string {
	if (st === "sprout") return leafyStem(40, 70, 6, 9, 3);
	if (st === "leafy") return leafyStem(40, 44, 11, 12, 3.6) + el(37, 41, 2, 4.6, "#c99aa8", -15) + el(43, 40, 2.2, 5, "#b8c98a", 12);
	let s = leafyStem(40, 36, 13, 12, 3.6) + sk("M40 38Q50 40 56 44M40 36Q30 38 27 40", GREEN.dark, 1.3) + el(27, 37, 2.1, 5, "#c67a96", -15);
	return s + g(56, 44, stargazerHead(9), 18, 1, 0.75) + g(40, 26, stargazerHead(16), 0, 1, 0.74);
}

/* ---------- 4. Martagon lily ---------- */
const MART = { a: "#c47aa8", b: "#9a5486", spot: "#5a2448", leaf: "#4d8545" };
function martagon(st: St): string {
	if (st === "sprout") return line(40, 87, 40, 72, GREEN.dark, 1.6) + whorl(40, 77, 9, 3.6, MART.leaf);
	const top = st === "leafy" ? 38 : 9;
	let s = line(40, 87, 40, top, GREEN.dark, 1.8) + whorl(40, 66, 14, 4.6, MART.leaf);
	if (st === "leafy") return s + whorl(40, 54, 10, 3.6, MART.leaf) + dots([[40, 37], [37, 41], [43, 43], [37.5, 46]], 1.6, "#a7bf72");
	s += whorl(40, 54, 11, 3.8, MART.leaf) + p(loc(LENS, 40, 46, -150, 6, 1.6) + loc(LENS, 40, 44, -30, 6, 1.6), MART.leaf);
	const fl: [number, number, number][] = [[31, 40, 5.2], [49, 34, 5], [31, 28, 4.7], [49, 22, 4.4], [32, 17, 4], [47.5, 12, 3.6]];
	let ped = "";
	for (const [x, y] of fl) ped += `M40 ${f(y + 3)}Q${f(x + (x < 40 ? 2 : -2))} ${f(y - 3)} ${f(x)} ${f(y)}`;
	s += sk(ped, GREEN.dark, 0.9) + el(40, 8, 1.2, 2, "#a7bf72");
	const ink = new Ink();
	for (const [x, y, k] of fl) turk(ink, x, y, k, MART.a, MART.b, MART.spot, "#d9832a");
	return s + ink;
}

/* ---------- 5. Madonna lily ---------- */
const MAD = { a: "#fbfaf3", shade: "#e0dfcc", b: "#b9bc9c", throat: "#e6e0ae", anth: "#e5a51c" };
function madonnaRosette(k: number): string {
	let d = "";
	let e = "";
	[-172, -150, -128, -52, -30, -8].forEach((a, i) => {
		const s = loc(LENS, 40, 86, a, 15 * k * (1 - Math.abs(a + 90) / 260), 3.6 * k);
		if (i % 2) e += s;
		else d += s;
	});
	return p(d, "#6f9e5a") + p(e, "#85b36c");
}
function madonna(st: St): string {
	if (st === "sprout") return madonnaRosette(0.8);
	if (st === "leafy") return leafyStem(40, 40, 12, 6, 1.6, { fill: "#6f9e5a" }) + madonnaRosette(1.1) + p(loc(LENS, 40, 42, -70, 9, 3.4) + loc(LENS, 40, 42, -110, 9, 3.4) + loc(LENS, 40, 41, -90, 10, 3.4), "#dfe5c4");
	let s = leafyStem(40, 26, 14, 6, 1.6, { fill: "#6f9e5a" }) + madonnaRosette(1.25);
	const ink = new Ink();
	for (const [y, a] of [[30, 200], [30, -20], [25, -135], [25, -45], [22, -90]] as const) trumpet(ink, 40, y, a, 12, 13, MAD);
	return s + ink;
}

/* ---------- 6. Daylily ---------- */
const DAY = { back: "#e2803a", front: "#f39a46", eye: "#b3452a", throat: "#f2cc5a", rib: "#f7c07a" };
function dayHead(k: number): string {
	let s = six(k, LENS, DAY.back, DAY.front, 0.48, 0.6);
	let d = "";
	for (const a of [-30, 90, 210]) d += loc("M.4 0L.85 0", 0, 0, a, k);
	s += sk(d, DAY.rib, 0.06 * k) + el(0, 0, 0.36 * k, 0.36 * k, DAY.eye) + el(0, 0, 0.18 * k, 0.18 * k, DAY.throat);
	return s + sk(`M0 0Q${f(0.3 * k)} ${f(-0.3 * k)} ${f(0.55 * k)} ${f(-0.55 * k)}M0 0Q${f(0.1 * k)} ${f(-0.4 * k)} ${f(0.2 * k)} ${f(-0.7 * k)}`, "#f2d07a", 0.06 * k);
}
function dayClump(k: number): string {
	const L = (x0: number, cx: number, cy: number, tx: number, ty: number) => [x0, 40 + (cx - 40) * k, 87 - (87 - cy) * k, 40 + (tx - 40) * k, 87 - (87 - ty) * k] as const;
	return straps([L(38, 24, 36, 10, 66), L(41, 56, 36, 70, 66), L(38, 30, 34, 18, 52), L(42, 50, 32, 62, 52), L(39, 36, 40, 28, 44), L(41, 46, 40, 54, 46)], 1.8, "#5f9a4c", "#79ae5f");
}
function daylily(st: St): string {
	if (st === "sprout") return dayClump(0.35);
	if (st === "leafy") return sk("M40 84C40 64 44 50 47 40", GREEN.dark, 1.5) + dayClump(0.85) + p(loc(LENS, 47, 41, -70, 9, 3) + loc(LENS, 47, 41, -30, 7, 2.6), "#b9b86a");
	let s = sk("M40 84C40 56 36 38 31 26M41 84C42 60 48 44 54 33", GREEN.dark, 1.6) + dayClump(1);
	s += p(loc(LENS, 33, 28, -40, 9, 3) + loc(LENS, 54, 33, -110, 8, 2.8), "#c9a95a");
	return s + g(54, 31, dayHead(9), 20, 1, 0.82) + g(31, 23, dayHead(11), -12, 1, 0.82);
}

/* ---------- 7. Asiatic lily ---------- */
const ASI = { back: "#e8b12a", front: "#f6cd4a", heart: "#e8792c", freck: "#7a3418" };
function asiHead(k: number): string {
	const sp: [number, number][] = [];
	for (let i = 0; i < 6; i++) sp.push(pt(0.32 * k, 0, 0, 0, -90 + i * 60, 1), pt(0.42 * k, 0.07 * k, 0, 0, -80 + i * 60, 1));
	return six(k, "M0 -.06C.2 -.1 .3 -.55 .62 -.5C.85 -.45 .95 -.15 1 0C.95 .15 .85 .45 .62 .5C.3 .55 .2 .1 0 .06Z", ASI.back, ASI.front, 0.62, 0.7) + el(0, 0, 0.3 * k, 0.3 * k, ASI.heart) + dots(sp, 0.06 * k, ASI.freck) + stamens(k, 6, 0.38, "#d9c48a", "#8b3a1a", 0);
}
function asiatic(st: St): string {
	if (st === "sprout") return leafyStem(40, 70, 10, 6, 1.6);
	if (st === "leafy") return leafyStem(40, 44, 22, 8, 1.8) + p(loc(LENS, 40, 45, -60, 9, 3.6) + loc(LENS, 40, 45, -120, 9, 3.6) + loc(LENS, 40, 44, -90, 10, 3.6), "#b8c98a");
	let s = leafyStem(40, 40, 26, 8, 1.8) + sk("M40 41Q32 38 28 32M40 41Q48 37 53 30M40 41L40 22", GREEN.dark, 1.2);
	return s + g(28, 30, asiHead(9), -18, 1, 0.68) + g(53, 28, asiHead(9), 16, 1, 0.68) + g(40, 19, asiHead(10), 0, 1, 0.66);
}

/* ---------- 8. Turk's cap lily ---------- */
const TURK = { a: "#d9362b", b: "#a82620", star: "#6fa04a" };
function turksCap(st: St): string {
	if (st === "sprout") return leafyStem(40, 70, 7, 7, 1.6, { fill: "#5c9450" });
	if (st === "leafy") return leafyStem(40, 40, 14, 9, 2, { fill: "#5c9450" }) + sk("M40 42Q34 36 31 40M40 42Q46 36 49 40", GREEN.dark, 1) + dots([[31, 42], [49, 42], [40, 38]], 1.7, "#8fae5a");
	let s = leafyStem(40, 38, 16, 9, 2, { fill: "#5c9450" });
	const fl: [number, number, number][] = [[18, 36, 5.6], [29, 26, 5.6], [40, 20, 5.4], [51, 26, 5.6], [62, 36, 5.6]];
	let ped = "";
	for (const [x, y] of fl) ped += `M40 39Q${f(x + (40 - x) * 0.25)} ${f(y - 12)} ${f(x)} ${f(y)}`;
	s += sk(ped, GREEN.dark, 1);
	const ink = new Ink();
	for (const [x, y, k] of fl) turk(ink, x, y, k, TURK.a, TURK.b, "#5a1a14", "#5a2a14").fill(TURK.star, loc(LENS, x, y + 0.6, 60, 2.6, 1.2) + loc(LENS, x, y + 0.6, 120, 2.6, 1.2));
	return s + ink;
}

/* ---------- 9. Flame lily ---------- */
const FLAME = { red: "#d8322a", yellow: "#f2c230", stam: "#a7a24a", leaf: "#5e9a48" };
function flameHead(x: number, y: number, k: number): string {
	let yel = "";
	let red = "";
	for (const a of [-150, -128, -106, -74, -52, -30]) {
		yel += loc("M0 0C.3 -.6 .5 .5 .7 -.2C.85 -.6 .95 -.2 1 0C.9 .45 .6 .2 .45 .7C.3 1 .15 .6 0 0Z", x, y, a, k, 0.42 * k);
		red += loc("M0 0C.3 -.4 .5 .3 .68 -.1C.8 -.35 .88 -.1 .9 0C.8 .3 .55 .1 .42 .45C.3 .6 .15 .4 0 0Z", x, y, a, k, 0.42 * k);
	}
	let st = "";
	const an: [number, number][] = [];
	for (const a of [168, 145, 122, 58, 35, 12]) {
		const [ex, ey] = pt(0.75 * k, 0, x, y, a, 1);
		st += `M${f(x)} ${f(y)}L${f(ex)} ${f(ey)}`;
		an.push([ex, ey]);
	}
	return sk(st, FLAME.stam, 0.6) + dots(an, 0.9, "#8a5a1a") + p(yel, FLAME.yellow) + p(red, FLAME.red) + sk(`M${f(x)} ${f(y)}q${f(0.4 * k)} ${f(0.2 * k)} ${f(0.75 * k)} ${f(0.05 * k)}`, "#9aa04a", 0.7);
}
function flameVine(top: number, ls: readonly (readonly [number, number, number])[]): string {
	let d = "";
	let tw = "";
	for (const [x, y, a] of ls) {
		d += loc(LENS, x, y, a, 11, 3.2);
		const [tx, ty] = pt(1, 0, x, y, a, 11);
		const dir = Math.cos((a * Math.PI) / 180) < 0 ? -1 : 1;
		tw += `M${f(tx)} ${f(ty)}q${f(dir * 3)} -1 ${f(dir * 2.4)} -3.6q${f(-dir * 0.8)} -1.2 ${f(-dir * 1.8)} .2`;
	}
	const tip = top < 30 ? "C36 48 46 42 42 32C40 24 45 18 44 " + top : "C38 52 43 46 42 " + top;
	return sk(`M40 87C35 77 46 68 41 58${tip}`, GREEN.dark, 1.5) + p(d, FLAME.leaf) + sk(tw, GREEN.dark, 0.6);
}
function flameLily(st: St): string {
	if (st === "sprout") return sk("M40 87C38 80 42 76 41 70", GREEN.dark, 1.4) + p(loc(LENS, 40.5, 77, -150, 9, 2.8) + loc(LENS, 41, 72, -35, 8, 2.6), FLAME.leaf);
	const ls = [[38.5, 78, -150], [43, 68, -28], [38.5, 56, -155], [44, 47, -26], [41, 37, -150]] as const;
	if (st === "leafy") return flameVine(42, ls.slice(0, 4)) + sk("M42 50Q50 46 52 50", GREEN.dark, 1) + p(loc(LENS, 52, 50, 80, 7, 2.6), "#b6bf5a");
	let s = flameVine(16, ls) + sk("M42 46Q34 40 29 40M43 26Q48 22 52 22", GREEN.dark, 1.1);
	return s + flameHead(28, 41, 13) + flameHead(52, 22, 14);
}

/* ---------- 10. Blackberry lily ---------- */
const BB = { a: "#f08a2a", spot: "#a32a1a", leaf: "#6f9e7a", leaf2: "#88b492", berry: "#2a2433", shine: "#8a8494", husk: "#c9b088" };
function bbFan(k: number): string {
	let s = "";
	[[35, 22, 52], [37, 29, 45], [39, 35, 40], [41, 44, 40], [43, 51, 45], [45, 58, 52]].forEach(([x0, tx, ty], i) => {
		s += blade(x0!, 40 + (tx! - 40) * k, 87 - (87 - ty!) * k, i % 2 ? BB.leaf2 : BB.leaf, 2.6);
	});
	return s;
}
function bbHead(x: number, y: number, k: number): string {
	let d = "";
	const sp: [number, number][] = [];
	for (let i = 0; i < 6; i++) {
		d += loc(OVAL, x, y, -90 + i * 60, k, 0.75 * k);
		sp.push(pt(0.4, 0.1, x, y, -90 + i * 60, k), pt(0.6, -0.12, x, y, -90 + i * 60, k));
	}
	return p(d, BB.a) + dots(sp, 0.5, BB.spot) + dots([[x, y]], 0.9, "#c9a23a");
}
function blackberryLily(st: St): string {
	if (st === "sprout") return bbFan(0.4);
	if (st === "leafy") return sk("M40 84L40 40", GREEN.dark, 1.3) + bbFan(0.95) + p(loc(LENS, 40, 41, -100, 6, 2.2) + loc(LENS, 40, 41, -60, 5, 2), "#c9a24a");
	let s = sk("M40 84L40 34M40 36Q34 30 29 22M40 34Q46 26 51 18M40 38Q50 36 55 36", GREEN.dark, 1.2) + bbFan(1.05);
	s += p(loc(LENS, 55, 36, -40, 6, 3.4) + loc(LENS, 55, 36, -140, 6, 3.4) + loc(LENS, 55, 36, -90, 6.5, 3.4), BB.husk);
	s += dots([[53.5, 32.5], [56.5, 32.5], [55, 30], [52.5, 29.6], [57.5, 29.6], [55, 27.2]], 1.6, BB.berry) + dots([[53, 32], [56, 32], [54.5, 29.5], [52, 29.1], [57, 29.1], [54.5, 26.7]], 0.45, BB.shine);
	return s + bbHead(29, 21, 6.5) + bbHead(51, 17, 6.5);
}

/* ---------- irises ---------- */
/** A fan of sword leaves: [x0, tipX, tipY] × k toward the root, alternating two fills. */
function swords(ls: readonly (readonly [number, number, number])[], k: number, a: string, b: string, w: number, rib?: string): string {
	let s = "";
	let r = "";
	ls.forEach(([x0, tx, ty], i) => {
		const X = 40 + (tx - 40) * k;
		const Y = 87 - (87 - ty) * k;
		s += blade(x0, X, Y, i % 2 ? b : a, w);
		if (rib) r += `M${f(x0)} 86Q${f(x0 - 0.5)} ${f((87 + Y) / 2)} ${f(X)} ${f(Y + 3)}`;
	});
	return s + (rib ? sk(r, rib, 0.5) : "");
}

/* ---------- 11. Siberian iris ---------- */
const SIB: IrisLook = { std: "#5257b8", std2: "#6a70cc", fall: "#3d409e", fall2: "#474bab", ss: 16, sl: 1.1, sw: 0.5, fs: 48, fl: 1.5, fw: 0.75, vein: "#e3e1f2" };
const SIB_LEAVES = [[35, 22, 40], [36, 28, 34], [37, 33, 30], [38, 37, 28], [39, 41, 30], [40, 45, 32], [41, 50, 36], [42, 55, 40], [43, 59, 46], [37, 18, 52], [43, 63, 54]] as const;
function siberian(st: St): string {
	if (st === "sprout") return swords(SIB_LEAVES, 0.35, "#6e9a5e", "#88b276", 1);
	if (st === "leafy") return sk("M40 84L39 30M41 84L46 34", GREEN.dark, 1) + swords(SIB_LEAVES, 0.92, "#6e9a5e", "#88b276", 1.1) + dots([[39, 29], [46, 33]], 1.5, "#5a5eb0");
	let s = sk("M39 84C38 50 34 30 31 22M40 84L44 15M41 84C44 50 52 36 54 28", GREEN.dark, 1) + swords(SIB_LEAVES, 1.05, "#6e9a5e", "#88b276", 1.1);
	return s + irisFlower(31, 22, 5, SIB) + irisFlower(44, 15, 5.4, SIB) + irisFlower(54, 28, 4.8, SIB);
}

/* ---------- 12. Japanese iris ---------- */
const JAP = { fall: "#7c4fbf", fall2: "#8a5ccc", std: "#6a3fb0", vein: "#efe9f8", sig: "#f2c230" };
function japHead(k: number): string {
	let s = p(loc(SPOON, 0, 0, -112, 0.5 * k, 0.28 * k) + loc(SPOON, 0, 0, -68, 0.5 * k, 0.28 * k), JAP.std);
	s += p(loc(OVAL, 0, 0, 158, k, 0.95 * k) + loc(OVAL, 0, 0, 22, k, 0.95 * k), JAP.fall) + p(loc(OVAL, 0, 0, 90, 0.85 * k, 0.95 * k), JAP.fall2);
	let v = "";
	let sg = "";
	for (const [a, l] of [[158, 1], [22, 1], [90, 0.85]] as const) {
		v += loc("M.15 0L.9 0M.2 -.04L.8 -.32M.2 .04L.8 .32M.25 -.06L.6 -.4M.25 .06L.6 .4", 0, 0, a, l * k, 0.95 * k);
		sg += loc(LENS, 0, 0, a, 0.42 * l * k, 0.22 * k);
	}
	return s + sk(v, JAP.vein, 0.05 * k) + p(sg, JAP.sig) + p(loc(LENS, 0, 0, -90, 0.35 * k, 0.2 * k), "#9a76d8");
}
const JAP_LEAVES = [[35, 20, 46], [37, 28, 38], [39, 36, 34], [41, 46, 36], [43, 55, 42], [45, 62, 50]] as const;
function japaneseIris(st: St): string {
	if (st === "sprout") return swords(JAP_LEAVES, 0.38, "#5e9a52", "#74ad62", 1.8, "#3f7a35");
	if (st === "leafy") return sk("M40 84L41 36", GREEN.dark, 1.4) + swords(JAP_LEAVES, 0.92, "#5e9a52", "#74ad62", 2, "#3f7a35") + el(41, 33, 1.8, 4, "#7c9a5a") + el(41, 31, 1.2, 2.4, JAP.fall);
	return sk("M40 84L40 28", GREEN.dark, 1.6) + swords(JAP_LEAVES, 1, "#5e9a52", "#74ad62", 2.1, "#3f7a35") + g(40, 25, japHead(15), 0, 1, 0.66);
}

/* ---------- 13. Dutch iris ---------- */
const DUTCH: IrisLook = { std: "#3c5ec4", std2: "#4a6ed2", fall: "#5c80dc", fall2: "#6e8fe4", ss: 7, sl: 1.25, sw: 0.36, fs: 58, fl: 1.35, fw: 0.72, sig: "#f5c518" };
const DUTCH_LEAVES = [[38, 30, 44], [39, 35, 38], [41, 46, 40], [42, 52, 48]] as const;
function dutchIris(st: St): string {
	if (st === "sprout") return swords(DUTCH_LEAVES, 0.38, "#7aa38c", "#8fb59f", 1.2);
	if (st === "leafy") return sk("M40 84L39 40", GREEN.dark, 1.3) + swords(DUTCH_LEAVES, 0.95, "#7aa38c", "#8fb59f", 1.2) + el(39, 37, 1.8, 4.6, "#86a86a") + el(39, 34, 1.1, 2.6, DUTCH.std);
	return sk("M39 84L36 22M41 84L50 32", GREEN.dark, 1.4) + swords(DUTCH_LEAVES, 1, "#7aa38c", "#8fb59f", 1.3) + irisFlower(36, 21, 7.5, DUTCH) + irisFlower(50, 31, 6.4, DUTCH);
}

/* ---------- 14. Dwarf iris ---------- */
const DWARF: IrisLook = { std: "#6a3ab0", std2: "#7a48c0", fall: "#4b2588", fall2: "#552c96", ss: 12, sl: 1.15, sw: 0.4, fs: 52, fl: 1.4, fw: 0.7, sig: "#f2d24a", vein: "#f2eefa" };
const DWARF_LEAVES = [[37, 26, 50], [39, 34, 44], [41, 46, 46], [43, 56, 52]] as const;
function dwarfIris(st: St): string {
	if (st === "sprout") return swords(DWARF_LEAVES, 0.38, "#5e9a5e", "#78b078", 0.9);
	if (st === "leafy") return swords(DWARF_LEAVES, 0.75, "#5e9a5e", "#78b078", 0.9) + line(37, 87, 36, 64, "#c9d4a8", 1.8) + el(36, 61, 1.8, 4.4, DWARF.std) + line(44, 87, 45, 68, "#c9d4a8", 1.6) + el(45, 66, 1.5, 3.6, "#8fa86a");
	return line(36, 87, 34, 64, "#c9d4a8", 2) + line(44, 87, 47, 70, "#c9d4a8", 1.8) + swords(DWARF_LEAVES, 0.8, "#5e9a5e", "#78b078", 0.9) + irisFlower(34, 60, 6.5, DWARF) + irisFlower(47, 66, 5.8, DWARF);
}

/* ---------- 15. Yellow flag iris ---------- */
const YF: IrisLook = { std: "#e2ac10", std2: "#ebb81a", fall: "#f2c21b", fall2: "#f6cc34", ss: 12, sl: 1, sw: 0.36, fs: 44, fl: 1.5, fw: 0.8, vein: "#8a5a1a" };
const YF_LEAVES = [[34, 18, 36], [36, 26, 26], [38, 33, 20], [40, 40, 18], [42, 48, 22], [44, 55, 30], [46, 62, 40]] as const;
function yellowFlag(st: St): string {
	if (st === "sprout") return swords(YF_LEAVES, 0.32, "#5f9a4c", "#77ad5f", 1.8);
	if (st === "leafy") return swords(YF_LEAVES, 0.72, "#5f9a4c", "#77ad5f", 2.4) + sk("M41 84L44 36", GREEN.dark, 1.3) + el(44, 33, 1.8, 4.4, "#9ab85a") + el(44, 30.5, 1.1, 2.2, YF.fall);
	let s = swords(YF_LEAVES, 1, "#5f9a4c", "#77ad5f", 2.6) + sk("M41 84L46 14M44 46Q34 40 30 34M45 32Q52 30 57 26", GREEN.dark, 1.3);
	return s + irisFlower(46, 13, 6.6, YF) + irisFlower(30, 33, 6.2, YF) + irisFlower(57, 25, 6, YF);
}

/* ---------- 16. Louisiana iris ---------- */
const LOU: IrisLook = { std: "#a8304e", std2: "#b83c5c", fall: "#982848", fall2: "#a8304e", ss: 58, sl: 0.95, sw: 0.62, fs: 62, fl: 1.2, fw: 0.9, sig: "#f2c230" };
const LOU_STRAPS = [[37, 24, 40, 12, 60], [43, 56, 40, 68, 60], [38, 30, 34, 22, 46], [42, 50, 34, 60, 48], [39, 38, 36, 34, 40], [41, 44, 38, 50, 42]] as const;
function louisiana(st: St): string {
	const sc = (k: number) => LOU_STRAPS.map(([x0, cx, cy, tx, ty]) => [x0, 40 + (cx - 40) * k, 87 - (87 - cy) * k, 40 + (tx - 40) * k, 87 - (87 - ty) * k] as const);
	if (st === "sprout") return straps(sc(0.35), 1.6, "#5a9450", "#70a862");
	if (st === "leafy") return sk("M40 84L41 40", GREEN.dark, 1.4) + straps(sc(0.9), 2, "#5a9450", "#70a862") + el(41, 37, 1.8, 4.4, "#7c9a5a") + el(41, 34.5, 1.2, 2.4, LOU.std);
	return sk("M40 84L42 50L36 28M42 50L54 42", GREEN.dark, 1.5) + straps(sc(1), 2.2, "#5a9450", "#70a862") + irisFlower(54, 40, 7.4, LOU) + irisFlower(35, 25, 8.6, LOU);
}

/* ---------- 17. Pacific coast iris ---------- */
const PAC: IrisLook = { std: "#a98fd4", std2: "#b9a0dc", fall: "#efdfa6", fall2: "#f4e7b8", ss: 20, sl: 1, sw: 0.45, fs: 50, fl: 1.4, fw: 0.85, vein: "#7d55a8" };
const PAC_LEAVES = [[34, 14, 62], [35, 20, 52], [37, 28, 44], [38, 34, 40], [40, 40, 38], [42, 47, 40], [43, 53, 44], [45, 60, 52], [46, 66, 62]] as const;
function pacificCoast(st: St): string {
	if (st === "sprout") return swords(PAC_LEAVES, 0.38, "#4f8a4a", "#69a060", 1.1);
	if (st === "leafy") return swords(PAC_LEAVES, 0.92, "#4f8a4a", "#69a060", 1.2) + sk("M41 84L45 46", GREEN.dark, 1) + el(45, 44, 1.6, 4, "#8fa86a") + el(45, 41.5, 1, 2.2, PAC.std);
	return sk("M38 84L30 46M41 84L46 38M43 84L57 52", GREEN.dark, 1) + swords(PAC_LEAVES, 1, "#4f8a4a", "#69a060", 1.2) + irisFlower(30, 44, 6.4, PAC) + irisFlower(57, 50, 6, PAC) + irisFlower(46, 36, 6.8, PAC);
}

/* ---------- 18. Crested iris ---------- */
const CREST: IrisLook = { std: "#b8c3f2", std2: "#c4cdf5", fall: "#9aa9e6", fall2: "#a6b4ec", ss: 50, sl: 0.9, sw: 0.55, fs: 62, fl: 1.25, fw: 0.85, sig: "#f4f2fa" };
function crestFans(xs: readonly number[], h: number): string {
	let a = "";
	let b = "";
	for (const x of xs) {
		a += loc(LENS, x, 87, -128, h * 0.75, h * 0.16) + loc(LENS, x, 87, -52, h * 0.75, h * 0.16);
		b += loc(LENS, x, 87, -100, h, h * 0.18) + loc(LENS, x, 87, -80, h * 0.9, h * 0.17);
	}
	return p(a, "#7cb466") + p(b, "#94c47a");
}
function crestHead(x: number, y: number, k: number): string {
	return irisFlower(x, y, k, CREST) + p(loc(LENS, x, y, 90 + CREST.fs, 0.5 * k, 0.12 * k) + loc(LENS, x, y, 90 - CREST.fs, 0.5 * k, 0.12 * k) + loc(LENS, x, y, 90, 0.45 * k, 0.12 * k), "#f0a030");
}
function crestedIris(st: St): string {
	if (st === "sprout") return crestFans([37, 44], 12);
	if (st === "leafy") return crestFans([24, 34, 46, 56], 22) + line(46, 80, 47, 65, GREEN.dark, 0.9) + el(47, 63, 1.2, 2.6, CREST.fall);
	let s = sk("M24 80L22 64M34 80L33 58M46 80L47 61M56 80L58 66M40 82L41 70", GREEN.dark, 0.9) + crestFans([20, 30, 40, 50, 60], 24);
	return s + crestHead(22, 63, 4.8) + crestHead(33, 57, 5) + crestHead(47, 60, 5) + crestHead(58, 65, 4.6) + crestHead(41, 70, 4.2);
}

/* ---------- 19. Toad lily ---------- */
const TOAD = { petal: "#f1e8f4", spot: "#7b3f8e", heart: "#9a4fae", leaf: "#4f7e3f", leaf2: "#5f9048" };
function toadStar(ink: Ink, x: number, y: number, k: number): void {
	let d = "";
	const sp: [number, number][] = [];
	for (let i = 0; i < 6; i++) {
		const a = -90 + i * 60;
		d += loc(LENS, x, y, a, k, 0.5 * k);
		sp.push(pt(0.62, 0, x, y, a, k));
	}
	ink.fill(TOAD.petal, d).dots(TOAD.spot, 0.5, sp).dots(TOAD.heart, 0.25 * k, [[x, y]]);
	ink.line(TOAD.heart, 0.5, `M${f(x - 0.3 * k)} ${f(y - 0.55 * k)}L${f(x)} ${f(y)}L${f(x + 0.3 * k)} ${f(y - 0.55 * k)}M${f(x)} ${f(y)}l0 ${f(-0.65 * k)}`);
}
type Bz = readonly [readonly [number, number], readonly [number, number], readonly [number, number], readonly [number, number]];
function toadLily(st: St): string {
	const sc = st === "sprout" ? 0.32 : st === "leafy" ? 0.75 : 1;
	const S = (x: number, y: number) => [40 + (x - 40) * sc, 87 - (87 - y) * sc] as const;
	const arches: Bz[] = [
		[S(39, 87), S(36, 56), S(28, 38), S(14, 34)],
		[S(41, 87), S(44, 52), S(54, 34), S(68, 30)],
		[S(40, 87), S(40, 58), S(40, 36), S(44, 18)],
	];
	const n = st === "sprout" ? 3 : 6;
	const len = st === "sprout" ? 8 : st === "leafy" ? 10 : 11;
	const fl = st === "bloom" ? [[0.45, 0.7, 0.92], [0.5, 0.72, 0.94], [0.55, 0.8]] : [[], [], []];
	let stems = "";
	let la = "";
	let lb = "";
	const ink = new Ink();
	arches.forEach((c, j) => {
		const at = (t: number): [number, number] => {
			const u = 1 - t;
			const m = (i: 0 | 1) => u * u * u * c[0][i] + 3 * u * u * t * c[1][i] + 3 * u * t * t * c[2][i] + t * t * t * c[3][i];
			return [m(0), m(1)];
		};
		stems += `M${c[0].map(f).join(" ")}C${c[1].map(f).join(" ")} ${c[2].map(f).join(" ")} ${c[3].map(f).join(" ")}`;
		for (let i = 1; i <= n; i++) {
			const t = i / (n + 1);
			const [x, y] = at(t);
			const [x2, y2] = at(t + 0.02);
			const dir = (Math.atan2(y2 - y, x2 - x) * 180) / Math.PI;
			const l = len * (1 - 0.4 * t);
			if (i % 2) la += loc(LENS, x, y, dir - 50, l, l * 0.42);
			else lb += loc(LENS, x, y, dir + 50, l, l * 0.42);
		}
		for (const t of fl[j] ?? []) {
			const [x, y] = at(t);
			toadStar(ink, x, y - 1, 4.4);
		}
	});
	const buds = st === "leafy" ? dots([[22, 52], [57, 49], [42, 32]], 1.2, "#c9a8d4") : "";
	return sk(stems, GREEN.dark, 1.3) + p(la, TOAD.leaf) + p(lb, TOAD.leaf2) + buds + ink;
}

/* ---------- 20. Lily of the valley ---------- */
const LOV = { bell: "#f3f1e4", shade: "#c4c7ae", leaf: "#5f9a4c", leaf2: "#78b05e" };
const LOV_LEAF = "M0 0C.25 -.55 .8 -.5 1 0C.8 .5 .25 .55 0 0Z";
function lovLeaves(k: number): string {
	return p(loc(LOV_LEAF, 38, 87, -102, 36 * k, 15 * k), LOV.leaf) + p(loc(LOV_LEAF, 42, 87, -72, 32 * k, 13 * k), LOV.leaf2) + sk(loc("M.05 0L.9 0", 38, 87, -102, 36 * k) + loc("M.05 0L.9 0", 42, 87, -72, 32 * k), GREEN.dark, 0.7);
}
function lilyOfTheValley(st: St): string {
	if (st === "sprout") return lovLeaves(0.45);
	if (st === "leafy") return sk("M41 86C42 66 46 56 52 54", GREEN.dark, 1) + lovLeaves(0.95) + dots([[47, 58], [50, 56], [52.5, 55]], 1, "#d8e2b8");
	let s = sk("M41 86C42 60 46 44 60 42", GREEN.dark, 1.1);
	const bells: [number, number, number][] = [[44, 64, 2.8], [45.2, 55.5, 2.9], [48, 49, 2.8], [52, 45.4, 2.6], [56, 43.5, 2.3], [59.5, 42.5, 1.9]];
	let ped = "";
	let b = "";
	let sh = "";
	for (const [x, y, r] of bells) {
		ped += `M${f(x - 0.8)} ${f(y - 1)}q${f(r)} 0 ${f(r * 0.9)} ${f(r + 1.8)}`;
		b += loc(BELL, x + r * 0.9, y + r * 2 + 1, 0, r);
		sh += loc("M-1.1 .75Q-.75 .5 -.55 .9Q-.3 .55 0 .95Q.3 .55 .55 .9Q.75 .5 1.1 .75L.9 -.1Q.4 .5 -.1 .3Q.2 -.3 .7 -1L.85 -.5Q.95 .3 1.1 .75Z", x + r * 0.9, y + r * 2 + 1, 0, r);
	}
	return lovLeaves(1.05) + s + sk(ped, GREEN.dark, 0.7) + p(b, LOV.bell) + p(sh, LOV.shade);
}

/* ---------- 21. Foxtail lily ---------- */
const FOX = { lo: "#d98a4a", mid: "#f2a548", hi: "#f7cf7a", bud: "#d6d07a" };
function foxRosette(k: number): string {
	return straps([[37, 26, 66, 12, 78], [43, 54, 66, 68, 78], [38, 30, 60, 20, 70], [42, 50, 60, 60, 70]].map(([x0, cx, cy, tx, ty]) => [x0!, 40 + (cx! - 40) * k, 87 - (87 - cy!) * k, 40 + (tx! - 40) * k, 87 - (87 - ty!) * k] as const), 1.8, "#6a9e56", "#80b268");
}
function foxtail(st: St): string {
	if (st === "sprout") return foxRosette(0.6);
	if (st === "leafy") return line(40, 84, 40, 42, "#6f9a4a", 2) + foxRosette(1) + p(`M38.4 58Q38 48 40 38Q42 48 41.6 58Z`, "#a8c06a");
	let lo: [number, number][] = [];
	let mid: [number, number][] = [];
	let hi: [number, number][] = [];
	let bud: [number, number][] = [];
	let row = 0;
	for (let y = 52; y >= 6; y -= 2, row++) {
		const w = 0.8 + 3.6 * Math.min(1, (y - 6) / 30);
		const n = Math.max(1, Math.round(w / 1.5));
		for (let i = 0; i <= n; i++) {
			const x = 40 - w + (2 * w * i) / n + (row % 2 ? 0.8 : -0.8) * (n > 1 ? 1 : 0);
			const pnt: [number, number] = [Math.min(46.5, Math.max(33.5, x)), y];
			if (y > 40) lo.push(pnt);
			else if (y > 22) mid.push(pnt);
			else if (y > 12) hi.push(pnt);
			else bud.push(pnt);
		}
	}
	const s = line(40, 84, 40, 6, "#6f9a4a", 2.2) + foxRosette(1.15);
	return s + dots(lo, 1.05, FOX.lo) + dots(mid, 1.15, FOX.mid) + dots(hi, 1.05, FOX.hi) + dots(bud, 0.95, FOX.bud);
}

/* ---------- 22. Peruvian lily ---------- */
const PER = { a: "#ec7f8a", b: "#f49ba4", yel: "#f6cf4a", streak: "#5a2a2a", leaf: "#6aa258" };
function perHead(x: number, y: number, k: number, rot: number): string {
	let a = "";
	let b = "";
	let yl = "";
	for (const ang of [-150, -30, 90]) a += loc(SPOON, x, y, ang + rot, k, 0.78 * k);
	for (const ang of [150, 30]) b += loc(SPOON, x, y, ang + rot, 0.9 * k, 0.6 * k);
	let st = "";
	for (const ang of [-110, -70]) {
		yl += loc(SPOON, x, y, ang + rot, 0.95 * k, 0.48 * k);
		st += loc("M.35 -.06L.6 -.1M.4 .06L.68 .08M.3 0L.5 0", x, y, ang + rot, 0.95 * k, 0.48 * k);
	}
	return p(a, PER.a) + p(b, PER.b) + p(yl, PER.yel) + sk(st, PER.streak, 0.5) + sk(`M${f(x)} ${f(y)}q${f(k * 0.2)} ${f(-k * 0.5)} ${f(k * 0.45)} ${f(-k * 0.7)}M${f(x)} ${f(y)}q${f(-k * 0.05)} ${f(-k * 0.5)} ${f(k * 0.15)} ${f(-k * 0.8)}`, "#c96a74", 0.5);
}
function peruvian(st: St): string {
	if (st === "sprout") return leafyStem(40, 70, 6, 8, 2.4, { fill: PER.leaf, droop: 40 });
	if (st === "leafy") return leafyStem(40, 46, 10, 10, 3, { fill: PER.leaf, droop: 40 }) + sk("M40 48L36 42M40 48L44 41", GREEN.dark, 1) + p(loc(LENS, 36, 42, -110, 5, 2.4) + loc(LENS, 44, 41, -70, 5, 2.4), "#d4a0a4");
	let s = leafyStem(40, 40, 12, 10, 3, { fill: PER.leaf, droop: 40 }) + sk("M40 41Q32 38 26 32M40 41Q48 38 54 30M40 41L40 22", GREEN.dark, 1.1);
	return s + perHead(26, 31, 8.5, -15) + perHead(54, 29, 8.5, 15) + perHead(40, 20, 9, 0);
}

/* ---------- 23. Clivia ---------- */
const CLI = { leaf: "#2f6b3a", leaf2: "#3d7d45", a: "#ec6a2a", b: "#c9501e", throat: "#f4c04a", anth: "#f2d24a" };
function cliviaLeaves(k: number): string {
	const L = (x0: number, cx: number, cy: number, tx: number, ty: number) => [x0, 40 + (cx - 40) * k, 87 - (87 - cy) * k, 40 + (tx - 40) * k, 87 - (87 - ty) * k] as const;
	return straps([L(38, 22, 52, 6, 68), L(42, 58, 52, 74, 68), L(39, 28, 46, 14, 54), L(41, 52, 46, 66, 54), L(39, 34, 44, 24, 44), L(41, 46, 44, 56, 44)], 2.8, CLI.leaf, CLI.leaf2);
}
function clivia(st: St): string {
	if (st === "sprout") return cliviaLeaves(0.4);
	if (st === "leafy") return line(40, 84, 40, 46, "#5d8a3a", 2.6) + cliviaLeaves(0.95) + dots([[37.5, 44], [42.5, 44], [40, 41.5], [38.5, 47], [41.5, 47]], 1.8, "#7a9a4a");
	let s = line(40, 84, 40, 34, "#5d8a3a", 3) + cliviaLeaves(1.05);
	const c = { a: CLI.a, b: CLI.b, throat: CLI.throat, anth: CLI.anth };
	const ink = new Ink();
	let ped = "";
	for (const a of [145, 35, -172, -8, -132, -48, -90]) {
		const [px, py] = pt(4, 0, 40, 30, a, 1);
		ped += `M40 28L${f(px)} ${f(py)}`;
		trumpet(ink, px, py, a, 13, 11, c);
	}
	return s + sk(ped, "#5d8a3a", 1.2) + ink;
}

/* ---------- 24. Pineapple lily ---------- */
const PINE = { leaf: "#5f9a4c", leaf2: "#77aa5e", stem: "#7a8a4a", fl: "#dbe3b6", eye: "#8a4a7a", tuft: "#6fa452" };
function pineRosette(k: number): string {
	let a = "";
	let b = "";
	[-170, -150, -128, -52, -30, -10].forEach((ang, i) => {
		const d = loc(LENS, 40, 86, ang, 24 * k * (1 - Math.abs(ang + 90) / 300), 7 * k);
		if (i % 2) b += d;
		else a += d;
	});
	return p(a, PINE.leaf) + p(b, PINE.leaf2);
}
function pineappleLily(st: St): string {
	if (st === "sprout") return pineRosette(0.55);
	if (st === "leafy") return line(40, 84, 40, 46, PINE.stem, 3.2) + pineRosette(1) + p(loc(LENS, 40, 48, -130, 6, 2.4) + loc(LENS, 40, 48, -50, 6, 2.4) + loc(LENS, 40, 48, -90, 7, 2.4), PINE.tuft) + p("M37.5 60Q37 52 40 49Q43 52 42.5 60Z", "#b8c68a");
	let s = line(40, 84, 40, 22, PINE.stem, 3.6) + pineRosette(1.15);
	const fl: [number, number][] = [];
	const eyes: [number, number][] = [];
	for (let r = 0, y = 54; y >= 26; y -= 2.6, r++) for (const dx of r % 2 ? [-4.6, -1.5, 1.5, 4.6] : [-3, 0, 3]) {
		fl.push([40 + dx, y]);
		eyes.push([40 + dx, y]);
	}
	s += dots(fl, 1.7, PINE.fl) + dots(eyes, 0.55, PINE.eye);
	let t = "";
	for (const a of [-160, -135, -112, -90, -68, -45, -20]) t += loc(LENS, 40, 24, a, a === -90 ? 9 : 8.5 - Math.abs(a + 90) / 40, 3.2);
	return s + p(t, PINE.tuft);
}

/* ---------- 25. Red spider lily ---------- */
const SPI = { red: "#d42a2a", deep: "#a81e22", stam: "#e0453a" };
function spiderHead(x: number, y: number, k: number): string {
	let tep = "";
	let back = "";
	let st = "";
	const an: [number, number][] = [];
	for (let i = 0; i < 12; i++) {
		const a = -180 + i * 30 + (i % 2 ? 8 : 0);
		const d = loc("M0 0C.3 -.25 .6 .2 .8 -.05C.95 -.25 1.05 -.1 1 .05C.85 .15 .7 .25 .5 .2C.3 .15 .15 .2 0 0Z", x, y, a, 0.62 * k, 0.6 * k);
		if (i % 2) back += d;
		else tep += d;
	}
	for (const a of [-172, -155, -138, -120, -100, -80, -60, -42, -25, -8, 10, 170]) {
		const [mx, my] = pt(0.55 * k, 0, x, y, a, 1);
		const [ex, ey] = pt(1.02 * k, 0, x, y, a + (a < -90 || a > 90 ? 22 : -22), 1);
		st += `M${f(x)} ${f(y)}Q${f(mx)} ${f(my)} ${f(ex)} ${f(ey - 0.12 * k)}`;
		an.push([ex, ey - 0.12 * k]);
	}
	return p(back, SPI.deep) + sk(st, SPI.stam, 0.55) + dots(an, 0.55, "#f0b04a") + p(tep, SPI.red) + dots([[x, y]], 0.12 * k, SPI.deep);
}
function redSpider(st: St): string {
	if (st === "sprout") return blade(38, 30, 68, "#3f6e45", 1.1) + blade(40, 39, 64, "#4a7c50", 1.1) + blade(42, 49, 68, "#3f6e45", 1.1) + sk("M38.5 84Q36 76 31 69M40 84L39.2 66M41.5 84Q45 76 48.5 69", "#a8c4a0", 0.4);
	if (st === "leafy") return sk("M39 87C39 66 37 54 35 44M41 87C42 70 46 60 49 52", "#5d8a3a", 1.8) + p(loc(LENS, 35, 44, -110, 6, 3) + loc(LENS, 35, 44, -70, 6, 3) + loc(LENS, 35, 44, -90, 7, 3) + loc(LENS, 49, 52, -100, 5, 2.6) + loc(LENS, 49, 52, -65, 5, 2.6), SPI.deep) + p(loc(LENS, 35, 44, -90, 4, 1.4) + loc(LENS, 49, 52, -85, 3.6, 1.2), SPI.red);
	return sk("M39 87C39 64 38 44 36 30M41 87C42 70 50 58 56 50", "#5d8a3a", 1.9) + spiderHead(56, 48, 13) + spiderHead(36, 27, 17);
}

export const SPECIES: Species[] = [
	{ id: "tiger-lily", name: "Tiger lily", draw: tigerLily },
	{ id: "easter-lily", name: "Easter lily", draw: easterLily },
	{ id: "stargazer-lily", name: "Stargazer lily", draw: stargazer },
	{ id: "martagon-lily", name: "Martagon lily", draw: martagon },
	{ id: "madonna-lily", name: "Madonna lily", draw: madonna },
	{ id: "daylily", name: "Daylily", draw: daylily },
	{ id: "asiatic-lily", name: "Asiatic lily", draw: asiatic },
	{ id: "turks-cap-lily", name: "Turk's cap lily", draw: turksCap },
	{ id: "flame-lily", name: "Flame lily", draw: flameLily },
	{ id: "blackberry-lily", name: "Blackberry lily", draw: blackberryLily },
	{ id: "siberian-iris", name: "Siberian iris", draw: siberian },
	{ id: "japanese-iris", name: "Japanese iris", draw: japaneseIris },
	{ id: "dutch-iris", name: "Dutch iris", draw: dutchIris },
	{ id: "dwarf-iris", name: "Dwarf iris", draw: dwarfIris },
	{ id: "yellow-flag-iris", name: "Yellow flag iris", draw: yellowFlag },
	{ id: "louisiana-iris", name: "Louisiana iris", draw: louisiana },
	{ id: "pacific-coast-iris", name: "Pacific coast iris", draw: pacificCoast },
	{ id: "crested-iris", name: "Crested iris", draw: crestedIris },
	{ id: "toad-lily", name: "Toad lily", draw: toadLily },
	{ id: "lily-of-the-valley", name: "Lily of the valley", draw: lilyOfTheValley },
	{ id: "foxtail-lily", name: "Foxtail lily", draw: foxtail },
	{ id: "peruvian-lily", name: "Peruvian lily", draw: peruvian },
	{ id: "clivia", name: "Clivia", draw: clivia },
	{ id: "pineapple-lily", name: "Pineapple lily", draw: pineappleLily },
	{ id: "red-spider-lily", name: "Red spider lily", draw: redSpider },
];
