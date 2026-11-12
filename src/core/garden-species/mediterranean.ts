/**
 * Garden species, family: Mediterranean shrubs and herbs. 25 species in the
 * kit's flat style (see kit.ts); the kit draws soil and seed. Each grows
 * from a seedling (sprout) to a young shrub (leafy) to its signature
 * fullest form (bloom): flowers, berries, fruit or flower heads.
 */
import { bez, f, type GrowingStage, type Pt, type Species } from "./kit";

type St = GrowingStage;
type C4 = readonly [Pt, Pt, Pt, Pt];
type N2 = [number, number];
type N3 = [number, number, number];
type N4 = [number, number, number, number];

/* ---------------- private helpers ---------------- */

const rad = (d: number): number => (d * Math.PI) / 180;
/** A number in its shortest one-decimal form (".5", "-.5"). */
const g = (n: number): string => f(n).replace(/^(-?)0\./, "$1.");
/** Numbers joined compactly: a space only where the next one has no sign. */
const J = (...ns: number[]): string => ns.map((n, i) => ((s) => (i && s[0] !== "-" ? " " : "") + s)(g(n))).join("");
const P = (x: number, y: number): string => J(x, y);
const pol = (x: number, y: number, deg: number, r: number): N2 => [x + Math.cos(rad(deg)) * r, y + Math.sin(rad(deg)) * r];
const by = <T>(st: St, a: T, b: T, c: T): T => (st === "sprout" ? a : st === "leafy" ? b : c);

/** Merges path data per fill (or per stroke colour and width) into one <path> each, in first-seen order. */
class Ink {
	private m = new Map<string, string>();
	fill(c: string, d: string): this {
		this.m.set(c, (this.m.get(c) ?? "") + d);
		return this;
	}
	line(c: string, w: number, d: string): this {
		const k = `${c}|${f(w)}`;
		this.m.set(k, (this.m.get(k) ?? "") + d);
		return this;
	}
	/** A round dot drawn as a zero-length round-capped stroke (compact). */
	dot(c: string, x: number, y: number, r: number): this {
		return this.line(c, r * 2, `M${P(x, y)}h0`);
	}
	seg(c: string, w: number, x1: number, y1: number, x2: number, y2: number): this {
		return this.line(c, w, `M${P(x1, y1)}l${J(x2 - x1, y2 - y1)}`);
	}
	toString(): string {
		return [...this.m]
			.map(([k, d]) => {
				const [c, w] = k.split("|");
				return w === undefined ? `<path d="${d}" fill="${c}"/>` : `<path d="${d}" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
			})
			.join("");
	}
}

/** Leaf shapes (cubic control ratios): 0 oval, 1 pointed lance, 2 round, 3 obovate (spoon). */
type Sh = 0 | 1 | 2 | 3;
const SHAPES: Record<Sh, N4> = { 0: [0.3, 1, 0.8, 1], 1: [0.45, 1.15, 0.8, 0.5], 2: [0.05, 1.4, 1.02, 1.3], 3: [0.3, 0.5, 1.05, 1.7] };

/** A leaf outline from (x, y) heading `deg`, `len` long, about 2w wide. */
function leafD(x: number, y: number, deg: number, len: number, w: number, shape: Sh = 1): string {
	const c = Math.cos(rad(deg));
	const s = Math.sin(rad(deg));
	const p = (u: number, v: number): N2 => [c * u - s * v, s * u + c * v];
	const [a, b, cc, d] = SHAPES[shape];
	const [tx, ty] = p(len, 0);
	if (shape === 1) {
		const [qx, qy] = p(len * 0.45, -w * 1.6);
		const [rx2, ry2] = p(len * 0.45, w * 1.6);
		return `M${P(x, y)}q${J(qx, qy, tx, ty)}q${J(rx2 - tx, ry2 - ty, -tx, -ty)}z`;
	}
	const [ax, ay] = p(len * a, -w * b);
	const [bx, by2] = p(len * cc, -w * d);
	const [ex, ey] = p(len * cc, w * d);
	const [hx, hy] = p(len * a, w * b);
	return `M${P(x, y)}c${J(ax, ay, bx, by2, tx, ty, ex - tx, ey - ty, hx - tx, hy - ty, -tx, -ty)}z`;
}

/** A rotated ellipse as two arcs. */
function ovalD(cx: number, cy: number, rx: number, ry: number, rot = 0): string {
	const [dx, dy] = pol(0, 0, rot, rx);
	const a = `a${J(rx, ry, rot)} 1 0`;
	return `M${P(cx + dx, cy + dy)}${a}${J(-2 * dx, -2 * dy)}${a}${J(2 * dx, 2 * dy)}z`;
}

const curveD = (p: C4): string => `M${P(...p[0])}C${P(...p[1])} ${P(...p[2])} ${P(...p[3])}`;

/** A stalk from the ground at x0 to the tip (tx, ty), leaning by `bend`. */
function stalk(x0: number, tx: number, ty: number, bend = 0, y0 = 87): C4 {
	const h = y0 - ty;
	return [
		[x0, y0],
		[x0 + (tx - x0) * 0.1, y0 - h * 0.45],
		[tx - (tx - x0) * 0.3 + bend, ty + h * 0.3],
		[tx, ty],
	];
}

/** Position and heading (degrees) on a curve at t. */
function at(p: C4, t: number): N3 {
	const [x, y] = bez(p, t);
	const [xa, ya] = bez(p, t - 0.02);
	return [x, y, (Math.atan2(y - ya, x - xa) * 180) / Math.PI];
}

interface Along {
	t0?: number;
	t1?: number;
	n: number;
	len: number;
	w: number;
	shape?: Sh;
	spread?: number;
	fills: readonly string[];
	opp?: boolean;
	shrink?: number;
	/** Draw each leaf as a stroke of this width (needles) instead of a shape. */
	needle?: number;
	tip?: boolean;
}

/** Leaves along a curve, paired (opp) or alternate, angled `spread` from the stem. */
function along(ink: Ink, p: C4, o: Along): void {
	const { t0 = 0.2, t1 = 0.95, n, len, w, shape = 1, spread = 40, fills, opp = true, shrink = 0.3, needle, tip = false } = o;
	const put = (x: number, y: number, ang: number, L: number, fill: string) => {
		if (needle) {
			const [ex, ey] = pol(x, y, ang, L);
			ink.seg(fill, needle, x, y, ex, ey);
		} else ink.fill(fill, leafD(x, y, ang, L, (w * L) / len, shape));
	};
	for (let i = 0; i < n; i++) {
		const u = n === 1 ? 1 : i / (n - 1);
		const [x, y, a] = at(p, t0 + (t1 - t0) * u);
		const L = len * (1 - shrink * u);
		const sides = opp ? [-1, 1] : [i % 2 ? 1 : -1];
		sides.forEach((sd, j) => put(x, y, a + sd * spread, L, fills[(i + j) % fills.length]!));
	}
	if (tip) {
		const [x, y, a] = at(p, 1);
		put(x, y, a, len * (1 - shrink) * 0.9, fills[0]!);
	}
}

/** Points spread evenly over an ellipse (sunflower spiral), deterministic. */
function scatter(cx: number, cy: number, rx: number, ry: number, n: number): N3[] {
	const out: N3[] = [];
	for (let i = 0; i < n; i++) {
		const a = i * 2.39996;
		const r = Math.sqrt((i + 0.5) / n);
		out.push([cx + Math.cos(a) * r * rx, cy + Math.sin(a) * r * ry, a]);
	}
	return out;
}

/** A leafy dome: a base ellipse covered by leaves pointing outward. */
function mound(ink: Ink, cx: number, cy: number, rx: number, ry: number, n: number, len: number, w: number, fills: readonly string[], base: string, shape: Sh = 1): void {
	ink.fill(base, ovalD(cx, cy, rx - len * 0.85, ry - len * 0.85));
	scatter(cx, cy, rx - len * 0.8, ry - len * 0.8, n).forEach(([x, y], i) => {
		const a = (Math.atan2((y - cy) / ry, (x - cx) / rx) * 180) / Math.PI + ((i * 37) % 30) - 15;
		ink.fill(fills[i % fills.length]!, leafD(x, y, a, len, w, shape));
	});
}

/** n round petals (dots) around (x, y) with a centre dot. */
function rosette(ink: Ink, x: number, y: number, n: number, dist: number, r: number, petal: string, centre: string, cr: number, off = 0): void {
	for (let i = 0; i < n; i++) {
		const [px, py] = pol(x, y, off + (i * 360) / n, dist);
		ink.dot(petal, px, py, r);
	}
	ink.dot(centre, x, y, cr);
}

/** Oval petals (shapes) around (x, y). */
function corolla(ink: Ink, x: number, y: number, n: number, len: number, w: number, fill: string, off = 0, shape: Sh = 2): void {
	for (let i = 0; i < n; i++) ink.fill(fill, leafD(x, y, off + (i * 360) / n, len, w, shape));
}

/** A tapered trunk from the ground at x0 (width w0) to (x1, y1) (width w1). */
function trunkD(x0: number, x1: number, y1: number, w0: number, w1: number): string {
	const fl = w0 * 0.35;
	return `M${P(x0 - w0 / 2 - fl, 87.5)}Q${P(x0 - w0 / 2, 86.5)} ${P(x0 - w0 / 2, 83.5)}L${P(x1 - w1 / 2, y1)}L${P(x1 + w1 / 2, y1)}L${P(x0 + w0 / 2, 83.5)}Q${P(x0 + w0 / 2, 86.5)} ${P(x0 + w0 / 2 + fl, 87.5)}Z`;
}

/** Stalks fanned from the base: n tips spread between x (from..to), heights by a gentle arch. */
function fanStalks(n: number, xFrom: number, xTo: number, yTop: number, ySide: number, base = 3): C4[] {
	const out: C4[] = [];
	for (let i = 0; i < n; i++) {
		const u = n === 1 ? 0.5 : i / (n - 1);
		const tx = xFrom + (xTo - xFrom) * u;
		const k = Math.abs(u - 0.5) * 2;
		const ty = yTop + (ySide - yTop) * k * k + (((i * 7) % 5) - 2) * 0.8;
		out.push(stalk(40 + (u - 0.5) * base * 2, tx, ty, (tx - 40) * 0.08));
	}
	return out;
}

/* ---------------- species ---------------- */

// 1. Oleander: tall clump of straight stems, whorled narrow leaves, pink flower clusters at the tips.
const OL = { stem: "#5f7d4a", a: "#3d6a3b", b: "#568747", fl: "#ea86a8", fl2: "#d25a86", eye: "#fbe0e8" };
function oleander(st: St): string {
	const ink = new Ink();
	const ss = by<N4[]>(
		st,
		[[40, 41, 68, 0]],
		[
			[38, 29, 48, -2],
			[40, 41, 40, 0],
			[42, 53, 46, 2],
		],
		[
			[36, 16, 34, -3],
			[38, 28, 22, -2],
			[40, 41, 15, 0],
			[42, 54, 21, 2],
			[44, 65, 33, 3],
		],
	);
	const ps = ss.map(([x0, tx, ty, b]) => stalk(x0, tx, ty, b));
	ps.forEach((p) => ink.line(OL.stem, by(st, 1.3, 1.5, 1.7), curveD(p)));
	ps.forEach((p) => along(ink, p, { t0: 0.3, t1: 0.9, n: by(st, 2, 4, 4), len: by(st, 8, 11, 12), w: 1.5, spread: 26, fills: [OL.a, OL.b], shrink: 0.2, tip: true }));
	if (st === "leafy") ink.dot(OL.fl2, 41, 38, 1.6).dot(OL.fl2, 53.5, 44, 1.3);
	if (st === "bloom")
		ps.forEach((p, i) => {
			const [x, y] = p[3];
			for (const [dx, dy, k] of [[-4, 0, 1], [4, 0.4, 1], [-1.6, 3.6, 0], [2.6, 3.8, 1], [0, -3.4, 0]] as N3[]) rosette(ink, x + dx, y + dy, 5, 1.6, 1.5, k ? OL.fl2 : OL.fl, OL.eye, 0.7, i * 25 + dx * 9);
		});
	return String(ink);
}

// 2. Myrtle: dense dome of small glossy leaves, fluffy white flowers and blue-black berries.
const MY = { trunk: "#6e5a45", base: "#24432a", a: "#2f5c37", b: "#467a45", fl: "#fbf8ef", st: "#e8d27a", berry: "#2f2e52" };
function myrtle(st: St): string {
	const ink = new Ink();
	if (st === "sprout") {
		const p = stalk(40, 40, 68);
		ink.line(MY.trunk, 1.4, curveD(p));
		along(ink, p, { t0: 0.3, t1: 0.95, n: 4, len: 5, w: 2, shape: 0, spread: 55, fills: [MY.a, MY.b], shrink: 0.2, tip: true });
		return String(ink);
	}
	const [cy, rx, ry, n] = by<N4>(st, [0, 0, 0, 0], [63, 15, 15, 32], [50, 29, 27, 64]);
	ink.line(MY.trunk, 2.4, `M40 87L40 ${f(cy + ry * 0.5)}M40 82L${P(40 - rx * 0.45, cy + ry * 0.5)}M40 80L${P(40 + rx * 0.4, cy + ry * 0.55)}`);
	mound(ink, 40, cy, rx, ry, n, 6.5, 2.2, [MY.a, MY.b], MY.base, 1);
	if (st === "bloom") {
		scatter(40, cy - 2, rx * 0.78, ry * 0.75, 11).forEach(([x, y], i) => {
			if (i === 0) return;
			rosette(ink, x, y, 6, 2, 1.2, MY.fl, MY.fl, 1.9, i * 17);
		});
		scatter(40, cy - 2, rx * 0.78, ry * 0.75, 11).forEach(([x, y], i) => i && ink.dot(MY.st, x, y, 0.8));
		for (const [x, y] of [[30, 63], [52, 61], [40, 47], [21, 50], [59, 44]] as N2[]) ink.dot(MY.berry, x, y, 1.7).dot(MY.berry, x + 2.6, y + 1.2, 1.5);
	}
	return String(ink);
}

// 3. Bay laurel: a dense broad cone of large leathery leaves, cream flower tufts and dark berries.
const BAY = { trunk: "#76604a", base: "#2f4f2a", a: "#3d6532", b: "#527d3f", c: "#668f4a", fl: "#efe3a0", berry: "#3a2b3e" };
function bayCone(ink: Ink, top: number, bot: number, hw: number, rows: number, len: number): void {
	ink.fill(BAY.base, `M${P(40, top)}Q${P(40 + hw * 0.62, top + (bot - top) * 0.35)} ${P(40 + hw, bot - 3)}Q${P(40, bot + 4)} ${P(40 - hw, bot - 3)}Q${P(40 - hw * 0.62, top + (bot - top) * 0.35)} ${P(40, top)}Z`);
	for (let r = 0; r < rows; r++) {
		const v = (r + 0.6) / rows;
		const y = top + (bot - top) * v;
		const half = hw * Math.pow(v, 0.75) * 0.82;
		const k = Math.max(1, Math.round((half * 2) / (len * 0.62)));
		for (let j = 0; j <= k; j++) {
			const x = 40 - half + (2 * half * (j + (r % 2) * 0.5)) / (k + 0.5);
			const u = (x - 40) / Math.max(half, 1);
			const a = -90 + u * 62 + (((r * 5 + j * 3) % 5) - 2) * 5;
			ink.fill([BAY.a, BAY.b, BAY.c][(r + j) % 3]!, leafD(x, y + len * 0.45, a, len, len * 0.3, 1));
		}
	}
}
function bayLaurel(st: St): string {
	const ink = new Ink();
	if (st === "sprout") {
		ink.seg(BAY.trunk, 1.6, 40, 87, 40, 70);
		ink.fill(BAY.b, leafD(40, 74, -140, 10, 3.2, 1) + leafD(40, 74, -40, 10, 3.2, 1)).fill(BAY.c, leafD(40, 70, -92, 9, 3, 1));
		return String(ink);
	}
	const [top, bot, hw, rows] = by<N4>(st, [0, 0, 0, 0], [40, 80, 15, 6], [8, 80, 26, 9]);
	ink.fill(BAY.trunk, trunkD(40, 40, bot - 4, by(st, 3, 3, 5), 2.5));
	bayCone(ink, top, bot, hw, rows, by(st, 8, 8, 10));
	if (st === "bloom") {
		for (const [x, y] of [[33, 30], [47, 26], [40, 44], [28, 54], [53, 50], [36, 66], [50, 68], [22, 72], [60, 72], [41, 18]] as N2[]) ink.dot(BAY.fl, x, y, 1.3).dot(BAY.fl, x + 1.6, y + 1, 1.1).dot(BAY.fl, x - 1.3, y + 1.3, 1);
		for (const [x, y] of [[44, 37], [30, 62], [56, 60], [45, 75]] as N2[]) ink.dot(BAY.berry, x, y, 1.6);
	}
	return String(ink);
}

// 4. Rockrose (gum cistus): low dark mound, big papery white flowers with maroon blotches.
const RR = { stem: "#5a4a3a", base: "#2b4528", a: "#3a5c35", b: "#557a44", fl: "#f9f4ea", bl: "#7c2036", eye: "#efc03a", bud: "#8aa060" };
function rockFlower(ink: Ink, x: number, y: number, r: number, off: number): void {
	corolla(ink, x, y, 5, r, r * 0.52, RR.fl, off);
	for (let i = 0; i < 5; i++) {
		const [bx, by2] = pol(x, y, off + i * 72, r * 0.42);
		ink.dot(RR.bl, bx, by2, r * 0.13);
	}
	ink.dot(RR.eye, x, y, r * 0.24);
}
function rockrose(st: St): string {
	const ink = new Ink();
	if (st === "sprout") {
		const p = stalk(40, 40, 70);
		ink.line(RR.stem, 1.3, curveD(p));
		along(ink, p, { t0: 0.35, t1: 0.95, n: 3, len: 8, w: 1.8, spread: 38, fills: [RR.a, RR.b], shrink: 0.2, tip: true });
		return String(ink);
	}
	const [cy, rx, ry, n] = by<N4>(st, [0, 0, 0, 0], [69, 19, 17, 28], [64, 33, 23, 52]);
	ink.line(RR.stem, 2, `M40 87L${P(34, cy + 8)}M40 87L${P(47, cy + 8)}`);
	mound(ink, 40, cy, rx, ry, n, 8, 1.8, [RR.a, RR.b], RR.base, 1);
	if (st === "leafy") ink.fill(RR.bud, ovalD(36, cy - ry + 4, 2, 2.6) + ovalD(47, cy - ry + 6, 1.8, 2.4));
	else {
		rockFlower(ink, 22, 54, 8, -10);
		rockFlower(ink, 42, 45, 9, 15);
		rockFlower(ink, 60, 53, 8, 40);
		rockFlower(ink, 33, 66, 6.5, 5);
		ink.fill(RR.bud, ovalD(54, 38, 1.8, 2.5) + ovalD(29, 41, 1.7, 2.3));
	}
	return String(ink);
}

// 5. Santolina: a tight silver cushion of coral-like foliage with yellow button flowers on bare stalks.
const SAN = { base: "#8b9784", a: "#aab49f", b: "#cbd2c0", stalk: "#8b9784", fl: "#e8c22c", fl2: "#c99a14" };
function santoCushion(ink: Ink, cy: number, rx: number, ry: number, n: number): void {
	ink.fill(SAN.base, `M${P(40 - rx, 87)}Q${P(40 - rx, cy - ry * 0.6)} ${P(40, cy - ry)}Q${P(40 + rx, cy - ry * 0.6)} ${P(40 + rx, 87)}Z`);
	for (let i = 1; i < 12; i++) {
		const a = 180 + i * 15;
		const [x, y] = pol(40, 87, a, 1);
		const ex = 40 + (x - 40) * rx;
		const ey = 87 + (y - 87) * (87 - cy + ry * 0.92);
		ink.dot(SAN.base, ex, ey, 2);
	}
	scatter(40, cy + 4, rx * 0.85, ry * 0.8, n).forEach(([x, y], i) => y < 86 && ink.dot(i % 3 ? SAN.a : SAN.b, x, y, i % 3 ? 1.3 : 0.9));
}
function santolina(st: St): string {
	const ink = new Ink();
	const [cy, rx, ry, n] = by<N4>(st, [80, 8, 7, 10], [72, 18, 15, 34], [71, 27, 15, 56]);
	if (st === "bloom")
		for (const [x, y] of [[18, 44], [26, 34], [34, 40], [40, 27], [47, 36], [54, 31], [62, 42], [30, 50], [51, 47]] as N2[]) ink.line(SAN.stalk, 0.9, `M${P(x * 0.5 + 20, 62)}Q${P(x, 60)} ${P(x, y)}`);
	santoCushion(ink, cy, rx, ry, n);
	if (st === "bloom")
		for (const [x, y] of [[18, 44], [26, 34], [34, 40], [40, 27], [47, 36], [54, 31], [62, 42], [30, 50], [51, 47]] as N2[]) ink.dot(SAN.fl, x, y, 3).dot(SAN.fl2, x + 0.7, y + 0.8, 1.1);
	if (st === "leafy") ink.dot(SAN.fl2, 38, 52, 1.4).dot(SAN.fl2, 46, 55, 1.2);
	return String(ink);
}

// 6. Curry plant: upright fountain of silver needle-leaved stems, mustard flower clusters.
const CUR = { stem: "#97a08a", a: "#b2bca7", b: "#d1d8c6", fl: "#d7a12a", fl2: "#ecc34e" };
function curryPlant(st: St): string {
	const ink = new Ink();
	const ps = by(st, fanStalks(3, 34, 46, 70, 73, 1), fanStalks(6, 22, 58, 46, 54), fanStalks(9, 14, 66, 24, 40));
	ps.forEach((p) => ink.line(CUR.stem, 1, curveD(p)));
	ps.forEach((p) => along(ink, p, { t0: 0.15, t1: by(st, 1, 1, 0.82), n: by(st, 5, 8, 8), len: by(st, 4, 5, 5), w: 1, spread: 32, fills: [CUR.a, CUR.b], shrink: 0.3, needle: 1.1, tip: st !== "bloom" }));
	if (st === "bloom")
		ps.forEach((p, i) => {
			const [x, y] = p[3];
			for (const [dx, dy] of [[0, -1.6], [-2.6, -0.4], [2.6, -0.4], [-1.3, 1.4], [1.3, 1.4], [-3.6, 1.8], [3.6, 1.8]] as N2[]) ink.dot((i + dx) % 2 ? CUR.fl : CUR.fl2, x + dx, y + dy, 1.35);
		});
	return String(ink);
}

// 7. Oregano: low sprawling mat of round leaves, upright stems with pink-mauve flower clusters.
const ORE = { stem: "#5e7c43", a: "#5f8f44", b: "#7cab56", br: "#a35a8d", fl: "#eab6d8" };
function oregano(st: St): string {
	const ink = new Ink();
	const mat = by(st, fanStalks(3, 30, 50, 72, 78, 1), fanStalks(7, 12, 68, 54, 72), fanStalks(7, 9, 71, 56, 74));
	const flo = st === "bloom" ? fanStalks(6, 20, 60, 22, 34, 2) : [];
	[...mat, ...flo].forEach((p) => ink.line(ORE.stem, 1, curveD(p)));
	mat.forEach((p) => along(ink, p, { t0: 0.3, t1: 1, n: by(st, 3, 4, 4), len: by(st, 3.6, 4.2, 4.4), w: 2.3, needle: 3, spread: 62, fills: [ORE.a, ORE.b], shrink: 0.25, tip: true }));
	flo.forEach((p) => along(ink, p, { t0: 0.5, t1: 0.85, n: 2, len: 2.8, w: 1.7, needle: 2.4, spread: 60, fills: [ORE.b], shrink: 0.2 }));
	flo.forEach((p, i) => {
		const [x, y] = p[3];
		for (const [dx, dy] of [[-4.5, 2.5], [4.5, 2.5], [0, -1]] as N2[]) {
			ink.seg(ORE.stem, 0.7, x, y + 4, x + dx, y + dy);
			for (const [ex, ey] of [[-0.9, 0.6], [0.9, 0.6], [0, -1]] as N2[]) ink.dot(ORE.br, x + dx + ex, y + dy + ey, 1.6);
			for (const [ex, ey] of [[-0.8, -0.8], [0.9, 0.4]] as N2[]) ink.dot(ORE.fl, x + dx + ex + (i % 2) * 0.3, y + dy + ey, 0.8);
		}
	});
	return String(ink);
}

// 8. Sweet marjoram: upright soft grey-green bush, pale green "knot" flower heads.
const MAR = { stem: "#71866a", a: "#8ea284", b: "#a9ba9d", knot: "#bccb9f", hi: "#e3ead3", fl: "#ffffff" };
function sweetMarjoram(st: St): string {
	const ink = new Ink();
	const ps = by(st, fanStalks(2, 37, 43, 70, 70, 1), fanStalks(6, 26, 54, 44, 52, 2), fanStalks(7, 20, 60, 24, 38, 2));
	ps.forEach((p) => ink.line(MAR.stem, 1, curveD(p)));
	ps.forEach((p) => along(ink, p, { t0: 0.25, t1: by(st, 1, 1, 0.8), n: by(st, 3, 5, 4), len: 3.6, w: 2.4, needle: 2.8, spread: 55, fills: [MAR.a, MAR.b], shrink: 0.3, tip: st !== "bloom" }));
	if (st === "bloom")
		ps.forEach((p) => {
			const [x, y] = p[3];
			for (const [dx, dy] of [[0, 0], [-3.4, 3], [3.4, 3], [-1.6, 5.8], [1.8, 6]] as N2[]) ink.dot(MAR.knot, x + dx, y + dy, 1.9);
			for (const [dx, dy] of [[0, 0], [-3.4, 3], [3.4, 3], [-1.6, 5.8], [1.8, 6]] as N2[]) ink.dot(MAR.hi, x + dx - 0.5, y + dy - 0.5, 0.8);
			ink.dot(MAR.fl, x + 0.6, y - 1, 0.6).dot(MAR.fl, x - 3, y + 2.2, 0.6);
		});
	return String(ink);
}

// 9. Strawberry tree: red-barked small tree, glossy crown, red-orange-yellow bumpy fruit and white bell clusters.
const ARB = { bark: "#9a4a33", base: "#22422a", a: "#2e5a34", b: "#447340", red: "#d63b2c", or: "#ef8a2b", yel: "#e8c23c", bell: "#f7f0e2" };
function strawberryTree(st: St): string {
	const ink = new Ink();
	if (st === "sprout") {
		const p = stalk(40, 41, 67);
		ink.line(ARB.bark, 1.6, curveD(p));
		along(ink, p, { t0: 0.4, t1: 0.95, n: 3, len: 7, w: 2.2, opp: false, spread: 48, fills: [ARB.a, ARB.b], shrink: 0.1, tip: true });
		return String(ink);
	}
	const [cy, rx, ry, n] = by<N4>(st, [0, 0, 0, 0], [50, 15, 12, 28], [36, 30, 22, 66]);
	ink.fill(ARB.bark, trunkD(40, 41, cy + 4, by(st, 4, 4, 7), 3));
	ink.line(ARB.bark, by(st, 1.8, 1.8, 2.8), `M${P(40, cy + 22)}Q${P(32, cy + 14)} ${P(40 - rx * 0.6, cy + 4)}M${P(41, cy + 18)}Q${P(48, cy + 12)} ${P(40 + rx * 0.6, cy + 3)}`);
	mound(ink, 40, cy, rx, ry, n, 8, 2.6, [ARB.a, ARB.b], ARB.base, 1);
	const bells = (x: number, y: number) => ink.dot(ARB.bell, x, y, 1.1).dot(ARB.bell, x - 1.7, y + 1.6, 1.1).dot(ARB.bell, x + 1.7, y + 1.6, 1.1).dot(ARB.bell, x, y + 3, 1.1);
	if (st === "leafy") bells(44, 52);
	else {
		([[24, 40, ARB.red], [36, 46, ARB.or], [50, 42, ARB.red], [58, 32, ARB.yel], [42, 26, ARB.red], [28, 28, ARB.or], [46, 54, ARB.red], [18, 46, ARB.yel], [62, 46, ARB.or]] as [number, number, string][]).forEach(([x, y, c]) =>
			ink.dot(c, x, y, 2.6),
		);
		for (const [x, y] of [[24, 40], [36, 46], [50, 42], [58, 32], [42, 26], [28, 28], [46, 54], [18, 46], [62, 46]] as N2[]) ink.dot("#fff3", x - 0.8, y - 0.9, 0.7);
		bells(34, 34);
		bells(54, 22);
	}
	return String(ink);
}

// 10. Mastic tree: low wide dark-olive dome with pinnate leaves and bunches of red and black berries.
const MAS = { stem: "#5f5442", base: "#34462a", a: "#465f35", b: "#5f7a44", red: "#c9413a", blk: "#2b2324", pink: "#e27b86" };
function pinnateLeaf(ink: Ink, x: number, y: number, deg: number, len: number): void {
	const [ex, ey] = pol(x, y, deg, len);
	ink.seg(MAS.stem, 0.6, x, y, ex, ey);
	for (let k = 1; k <= 3; k++) {
		const [px, py] = pol(x, y, deg, (len * k) / 3.4);
		ink.seg(k % 2 ? MAS.b : MAS.a, 1.9, px, py, ...pol(px, py, deg - 55, 2.6)).seg(k % 2 ? MAS.b : MAS.a, 1.9, px, py, ...pol(px, py, deg + 55, 2.6));
	}
	ink.seg(MAS.b, 1.9, ex, ey, ...pol(ex, ey, deg, 2.2));
}
function mastic(st: St): string {
	const ink = new Ink();
	if (st === "sprout") {
		ink.seg(MAS.stem, 1.4, 40, 87, 40, 74);
		pinnateLeaf(ink, 40, 76, -140, 10);
		pinnateLeaf(ink, 40, 76, -40, 10);
		pinnateLeaf(ink, 40, 74, -90, 8);
		return String(ink);
	}
	const [cy, rx, ry, n] = by<N4>(st, [0, 0, 0, 0], [70, 20, 17, 26], [64, 30, 23, 46]);
	ink.line(MAS.stem, 2.2, `M36 87L${P(32, cy + 6)}M44 87L${P(48, cy + 6)}`);
	mound(ink, 40, cy, rx, ry, n, 7, 2.3, [MAS.a, MAS.b], MAS.base, 1);
	const edge = by<N3[]>(st, [], [[-160, 0, 9], [-120, 0, 9], [-90, 0, 9], [-60, 0, 9], [-20, 0, 9]], [[-165, 0, 9], [-140, 0, 10], [-115, 0, 11], [-90, 0, 11], [-65, 0, 11], [-40, 0, 10], [-15, 0, 9]]);
	for (const [a, , len] of edge) {
		const [x, y] = [40 + Math.cos(rad(a)) * (rx - 5), cy + Math.sin(rad(a)) * (ry - 5)];
		pinnateLeaf(ink, x, y, a, len);
	}
	if (st === "bloom")
		([[22, 54, 0], [36, 46, 1], [52, 50, 0], [60, 62, 1], [28, 66, 1], [44, 62, 0], [16, 68, 0]] as N3[]).forEach(([x, y, k]) => {
			for (const [dx, dy, j] of [[0, 0, 0], [-1.8, 1.4, 1], [1.8, 1.4, 0], [0, 2.8, 1], [-1.2, 4.2, 0], [1.2, 4.2, 1], [0, 5.6, 0]] as N3[]) ink.dot((j + k) % 2 ? MAS.blk : k ? MAS.red : MAS.pink, x + dx, y + dy, 1.35);
		});
	return String(ink);
}

// 11. Spanish broom: a fountain of near-leafless green rush stems, yellow pea flowers along the tips.
const BRM = { stem: "#5b8d3c", leaf: "#78a650", fl: "#f5c62e", fl2: "#d99d17" };
function spanishBroom(st: St): string {
	const ink = new Ink();
	const n = by(st, 4, 10, 15);
	const L = by(st, 18, 44, 68);
	for (let i = 0; i < n; i++) {
		const u = i / (n - 1);
		const a = -90 + (u - 0.5) * by(st, 50, 75, 70);
		const len = L * (0.82 + 0.18 * Math.sin(u * Math.PI)) * (1 - ((i * 3) % 4) * 0.03);
		const x0 = 40 + (u - 0.5) * 4;
		const [tx, ty] = pol(x0, 87, a, len);
		const [cx, cy] = pol(x0, 87, -90 + (a + 90) * 0.4, len * 0.55);
		ink.line(BRM.stem, 1.2, `M${P(x0, 87)}Q${P(cx, cy)} ${P(tx, ty)}`);
		const p: C4 = [[x0, 87], [x0 + (cx - x0) * 0.66, 87 + (cy - 87) * 0.66], [tx + (cx - tx) * 0.66, ty + (cy - ty) * 0.66], [tx, ty]];
		if (st !== "bloom" && i % 2) along(ink, p, { t0: 0.35, t1: 0.75, n: 2, len: 3.4, w: 0.9, spread: 35, fills: [BRM.leaf], opp: false, shrink: 0 });
		if (st === "bloom")
			for (let k = 0; k < 5; k++) {
				const [x, y, d] = at(p, 0.5 + k * 0.12);
				const [fx, fy] = pol(x, y, d + (k % 2 ? 90 : -90), 1.3);
				ink.dot(BRM.fl, fx, fy, 1.8).dot(BRM.fl2, fx + (k % 2 ? 0.8 : -0.8), fy + 0.9, 0.85);
			}
	}
	return String(ink);
}

// 12. Rue: glaucous blue-green bush of rounded lobed leaflets, small four-petalled yellow cups.
const RUE = { stem: "#5f827a", a: "#7a9fa2", b: "#9bbdb8", fl: "#e8c73e", eye: "#8ea24a" };
function rue(st: St): string {
	const ink = new Ink();
	const ps = by(st, fanStalks(3, 33, 47, 70, 72, 1), fanStalks(6, 20, 60, 46, 56, 2), fanStalks(8, 14, 66, 34, 50, 2));
	ps.forEach((p) => ink.line(RUE.stem, 1.1, curveD(p)));
	ps.forEach((p, s) => {
		const n = by(st, 3, 4, 4);
		for (let i = 0; i < n; i++) {
			const [x, y, a] = at(p, 0.3 + (by(st, 0.65, 0.65, 0.5) * i) / (n - 1));
			const sd = (i + s) % 2 ? 1 : -1;
			const [lx, ly] = pol(x, y, a + sd * 50, 2.6);
			ink.seg(RUE.stem, 0.6, x, y, lx, ly);
			for (const o of [-38, 0, 38]) ink.seg(o ? RUE.a : RUE.b, 2.1, ...pol(lx, ly, a + sd * 50 + o, 1.2), ...pol(lx, ly, a + sd * 50 + o, 3.3));
		}
	});
	if (st === "bloom")
		ps.forEach((p, s) => {
			const [x, y, a] = at(p, 0.86);
			const [tx, ty] = p[3];
			ink.seg(RUE.stem, 0.7, x, y, x - 4, ty).seg(RUE.stem, 0.7, x, y, x + 4, ty + 1);
			for (const [fx, fy] of [[tx, ty - 1], [x - 4, ty + 0.5], [x + 4, ty + 1.5]] as N2[]) rosette(ink, fx, fy, 4, 1.4, 1.2, RUE.fl, RUE.eye, 0.75, 45 + s * 10 + a * 0);
		});
	else ps.slice(-1).forEach((p) => along(ink, p, { t0: 1, t1: 1, n: 1, len: 3.5, w: 1.5, shape: 3, spread: 0, fills: [RUE.b] }));
	return String(ink);
}

// 13. Jerusalem sage: woolly grey-green leaves, stems ringed with whorls of hooded yellow flowers.
const JS = { stem: "#7a8a62", a: "#8f9c74", b: "#adb890", fl: "#e8b52a", fl2: "#f4cf55", cal: "#7f8a55" };
function whorl(ink: Ink, x: number, y: number, r: number): void {
	ink.dot(JS.cal, x, y, r * 0.45);
	for (let k = 0; k < 7; k++) {
		const a = k * 51 + 12;
		const dx = Math.cos(rad(a)) * r;
		const dy = Math.sin(rad(a)) * r * 0.45;
		const deg = (Math.atan2(dy - 1.2, dx) * 180) / Math.PI;
		ink.seg(k % 2 ? JS.fl : JS.fl2, r * 0.48, x + dx * 0.3, y + dy * 0.3, ...pol(x + dx * 0.3, y + dy * 0.3, deg, r * 0.75));
	}
}
function jerusalemSage(st: St): string {
	const ink = new Ink();
	const ps = by(st, fanStalks(1, 40, 40, 69, 69, 0), fanStalks(4, 26, 54, 42, 50, 2), fanStalks(5, 18, 62, 14, 32, 3));
	ps.forEach((p) => ink.line(JS.stem, 1.6, curveD(p)));
	ps.forEach((p) => along(ink, p, { t0: 0.18, t1: by(st, 0.95, 0.95, 0.52), n: by(st, 2, 3, 3), len: by(st, 9, 9.5, 10), w: 2.8, shape: 0, spread: 58, fills: [JS.a, JS.b], shrink: 0.3, tip: st === "leafy" }));
	if (st === "leafy") ps.slice(1, 3).forEach((p) => ink.dot(JS.cal, p[3][0], p[3][1] - 1, 2));
	if (st === "bloom")
		ps.forEach((p) => {
			const [x1, y1] = bez(p, 0.68);
			whorl(ink, x1, y1, 5.6);
			const [x2, y2] = bez(p, 0.98);
			whorl(ink, x2, y2, 4.8);
		});
	return String(ink);
}

// 14. Mediterranean spurge: bottlebrush stems of blue-grey leaves crowned by tall lime-green flower columns.
const SPU = { stem: "#68827a", a: "#7a978f", b: "#9ab3aa", head: "#b2c63e", fl: "#d6e35a", eye: "#6d7428" };
function spurge(st: St): string {
	const ink = new Ink();
	const ps = by(st, fanStalks(2, 37, 43, 70, 70, 1), fanStalks(5, 22, 58, 46, 54, 3), fanStalks(7, 13, 67, 32, 46, 4));
	ps.forEach((p) => ink.line(SPU.stem, 1.6, curveD(p)));
	ps.forEach((p) => along(ink, p, { t0: 0.08, t1: 1, n: by(st, 6, 10, 10), len: by(st, 4.5, 5.5, 6), w: 1, spread: by(st, 55, 50, 50), fills: [SPU.a, SPU.b], shrink: 0.35, needle: 1.5, tip: st !== "bloom" }));
	if (st === "bloom")
		ps.forEach((p, i) => {
			const [x, y, a] = at(p, 1);
			const [cx, cy] = pol(x, y, a, 4.5);
			ink.fill(SPU.head, ovalD(cx, cy, 7.5, 4.8, a));
			scatter(cx, cy, 4.6, 4.6, 7).forEach(([dx, dy], k) => ink.dot((k + i) % 2 ? SPU.fl : SPU.head, dx + Math.cos(rad(a)) * (k % 3), dy + Math.sin(rad(a)) * (k % 3), 1.5));
			scatter(cx, cy, 4, 4, 4).forEach(([dx, dy]) => ink.dot(SPU.eye, dx, dy, 0.5));
		});
	return String(ink);
}

// 15. Tree heath: tall plumes of fine needle foliage, frosted with tiny white honey-scented bells.
const HEA = { trunk: "#6a4e3a", a: "#365a36", b: "#4c7444", fl: "#f1e8e2", fl2: "#e3c3cf" };
function treeHeath(st: St): string {
	const ink = new Ink();
	const ps = by(st, fanStalks(1, 40, 40, 68, 68, 0), fanStalks(4, 28, 52, 40, 46, 2), fanStalks(6, 18, 62, 8, 26, 4));
	ps.forEach((p) => ink.line(HEA.trunk, by(st, 1.2, 1.6, 2), curveD(p)));
	ps.forEach((p, s) => {
		const n = by(st, 7, 11, 13);
		for (let i = 0; i < n; i++) {
			const u = i / (n - 1);
			const [x, y, a] = at(p, 0.22 + 0.78 * u);
			const r = by(st, 4, 6, 7.5) * Math.sin(Math.min(1, (1 - u) * 1.6 + 0.15) * Math.PI * 0.5);
			for (const sd of [-1, 1]) {
				const [ex, ey] = pol(x, y, a + sd * (55 + ((i * 13) % 20)), r);
				ink.seg((i + s) % 2 ? HEA.a : HEA.b, 1.1, x, y, ex, ey);
				if (st === "bloom" && u > 0.25) ink.dot((i + s) % 3 ? HEA.fl : HEA.fl2, ex, ey, 1.1);
			}
		}
	});
	return String(ink);
}

// 16. Caper bush: sprawling arching stems of round leaves, white flowers with long purple stamens, green buds.
const CAP = { stem: "#7a8a52", a: "#6c9a4d", b: "#88b462", pet: "#f6e9f0", pet2: "#ebcfe0", stm: "#a14e9e", anth: "#5b2f63", bud: "#7c9a46" };
function caperFlower(ink: Ink, x: number, y: number, r: number, tilt: number): void {
	for (const [a, c] of [[tilt - 145, CAP.pet2], [tilt - 35, CAP.pet2], [tilt + 145, CAP.pet], [tilt + 35, CAP.pet]] as [number, string][]) ink.fill(c, leafD(x, y, a, r, r * 0.55, 2));
	for (let k = 0; k < 9; k++) {
		const a = tilt - 90 + (k - 4) * 15;
		const L = r * (1.25 + ((k * 5) % 3) * 0.12);
		const [ex, ey] = pol(x, y, a, L);
		ink.line(CAP.stm, 0.55, `M${P(x, y)}Q${P(...pol(x, y, a + 8, L * 0.6))} ${P(ex, ey)}`);
		ink.dot(CAP.anth, ex, ey, 0.6);
	}
}
function caperBush(st: St): string {
	const ink = new Ink();
	const arcs = by<C4[]>(
		st,
		[[[40, 87], [40, 78], [44, 72], [48, 72]], [[40, 87], [40, 80], [36, 74], [32, 75]]],
		[[[40, 87], [36, 62], [20, 58], [12, 70]], [[40, 87], [44, 60], [60, 56], [68, 68]], [[40, 87], [40, 66], [34, 52], [28, 50]], [[40, 87], [42, 68], [50, 56], [54, 54]]],
		[[[40, 87], [34, 54], [16, 52], [10, 70]], [[40, 87], [46, 52], [64, 50], [70, 68]], [[40, 87], [38, 56], [28, 38], [18, 36]], [[40, 87], [42, 54], [54, 38], [62, 36]], [[40, 87], [40, 64], [42, 40], [38, 30]]],
	);
	arcs.forEach((p) => ink.line(CAP.stem, 1.3, curveD(p)));
	arcs.forEach((p, s) => {
		const n = by(st, 3, 6, 7);
		for (let i = 0; i < n; i++) {
			const [x, y, a] = at(p, 0.3 + (0.7 * i) / (n - 1));
			const sd = (i + s) % 2 ? 1 : -1;
			const [lx, ly] = pol(x, y, a + sd * 70, 1.2);
			ink.fill(i % 2 ? CAP.a : CAP.b, leafD(lx, ly, a + sd * 70, by(st, 4.5, 5.5, 6), by(st, 2, 2.4, 2.6), 2));
		}
	});
	if (st === "leafy") ink.fill(CAP.bud, ovalD(28, 47, 1.6, 2.2) + ovalD(55, 51, 1.5, 2));
	if (st === "bloom") {
		caperFlower(ink, 20, 34, 6.5, -10);
		caperFlower(ink, 60, 32, 6.5, 12);
		caperFlower(ink, 40, 24, 7, 0);
		caperFlower(ink, 12, 50, 5.5, -30);
		ink.fill(CAP.bud, ovalD(70, 54, 1.7, 2.3) + ovalD(30, 42, 1.6, 2.2) + ovalD(50, 44, 1.5, 2));
	}
	return String(ink);
}

// 17. Hyssop: clump of upright leafy stems topped by long one-sided spikes of deep blue flowers.
const HYS = { stem: "#4f7a40", a: "#3e6e3a", b: "#5a8a48", fl: "#4c5bc0", fl2: "#7584dc" };
function hyssop(st: St): string {
	const ink = new Ink();
	const ps = by(st, fanStalks(2, 37, 43, 68, 68, 1), fanStalks(6, 26, 54, 40, 48, 2), fanStalks(7, 18, 62, 10, 26, 3));
	ps.forEach((p) => ink.line(HYS.stem, 1.1, curveD(p)));
	ps.forEach((p) => along(ink, p, { t0: 0.18, t1: by(st, 1, 1, 0.55), n: by(st, 4, 6, 4), len: by(st, 5.5, 6.5, 7), w: 1.7, spread: 42, fills: [HYS.a, HYS.b], shrink: 0.3, tip: st !== "bloom" }));
	if (st === "bloom")
		ps.forEach((p, s) => {
			for (let k = 0; k < 8; k++) {
				const [x, y, a] = at(p, 0.58 + k * 0.06);
				const sd = (k + s) % 2 ? 1 : -1;
				ink.seg(k % 3 ? HYS.fl : HYS.fl2, 1.9, x, y, ...pol(x, y, a + sd * 40, 3 - k * 0.15));
			}
		});
	return String(ink);
}

// 18. Wormwood: silvery feathery foliage, tall stems with drooping sprays of tiny yellow flower balls.
const WOR = { rib: "#8b968a", a: "#b4beb2", b: "#d2d9cf", fl: "#d1c15a", stalk: "#9aa496" };
function feather(ink: Ink, x: number, y: number, deg: number, len: number, bend: number, lf: number, s: number): void {
	const n = 7;
	let a = deg;
	let px = x;
	let py = y;
	let d = `M${P(x, y)}`;
	for (let j = 1; j <= n; j++) {
		a += bend / n;
		[px, py] = pol(px, py, a, len / n);
		d += `L${P(px, py)}`;
		const l = lf * (1 - j / (n + 2)) + 1;
		for (const sd of [-1, 1]) ink.seg((j + s) % 2 ? WOR.a : WOR.b, 1.6, px, py, ...pol(px, py, a + sd * 58, l));
	}
	ink.line(WOR.rib, 1, d);
}
function wormwood(st: St): string {
	const ink = new Ink();
	const flo = st === "bloom" ? fanStalks(3, 26, 54, 12, 22, 2) : [];
	flo.forEach((p) => ink.line(WOR.stalk, 1.1, curveD(p)));
	const fr = by<N4[]>(
		st,
		[[-120, 15, 20, 3], [-60, 15, -20, 3]],
		[[-160, 20, 30, 4], [-125, 30, 25, 4.5], [-90, 34, 0, 4.5], [-55, 30, -25, 4.5], [-20, 20, -30, 4]],
		[[-170, 22, 30, 4.5], [-140, 32, 30, 5], [-112, 38, 22, 5], [-90, 34, 0, 5], [-68, 38, -22, 5], [-40, 32, -30, 5], [-10, 22, -30, 4.5]],
	);
	fr.forEach(([deg, len, bend, lf], i) => feather(ink, 40, 85, deg, len, bend, lf, i));
	flo.forEach((p, s) => {
		for (let k = 0; k < 5; k++) {
			const [x, y, a] = at(p, 0.55 + k * 0.1);
			const sd = (k + s) % 2 ? 1 : -1;
			const [ex, ey] = pol(x, y, a + sd * 70, 5);
			ink.line(WOR.stalk, 0.6, `M${P(x, y)}Q${P(...pol(x, y, a + sd * 60, 3))} ${P(ex, ey + 2)}`);
			for (let j = 0; j < 3; j++) ink.dot(WOR.fl, x + (ex - x) * (0.4 + j * 0.3), y + (ey + 2 - y) * (0.4 + j * 0.3) + 1, 0.95);
		}
		ink.dot(WOR.fl, p[3][0], p[3][1], 1);
	});
	return String(ink);
}

// 19. Tree germander: airy silver-white branching shrub, small grey leaves, pale blue lipped flowers.
const TG = { stem: "#a9ae9f", a: "#7f927c", b: "#c3ccbc", fl: "#a6b8ec", lip: "#6f86d4" };
function treeGermander(st: St): string {
	const ink = new Ink();
	const ps = by(st, fanStalks(2, 36, 44, 68, 70, 1), fanStalks(5, 18, 62, 40, 50, 2), fanStalks(7, 12, 68, 14, 36, 3));
	const twigs: C4[] = [];
	ps.forEach((p, i) => {
		ink.line(TG.stem, 1.2, curveD(p));
		if (st === "sprout") return;
		const [x, y, a] = at(p, 0.6);
		const sd = i % 2 ? 1 : -1;
		const [tx, ty] = pol(x, y, a + sd * 38, by(st, 0, 10, 15));
		twigs.push([[x, y], [x, y], [tx, ty], [tx, ty]]);
	});
	twigs.forEach((p) => ink.line(TG.stem, 0.9, curveD(p)));
	[...ps, ...twigs].forEach((p, i) => {
		const n = by(st, 3, 4, 4);
		for (let k = 0; k < n; k++) {
			const [x, y, a] = at(p, 0.35 + (0.57 * k) / (n - 1));
			for (const sd of [-1, 1]) ink.dot((k + i + (sd > 0 ? 1 : 0)) % 2 ? TG.b : TG.a, ...pol(x, y, a + sd * 55, 1.9), 1.35);
		}
	});
	if (st === "bloom")
		[...ps, ...twigs].forEach((p, i) => {
			for (const t of [1, 0.78]) {
				const [x, y, a] = at(p, t);
				const sd = (i + (t < 1 ? 1 : 0)) % 2 ? 1 : -1;
				ink.fill(TG.fl, leafD(x, y, a + sd * 30, 4.6, 1.8, 3));
				const [lx, ly] = pol(x, y, a + sd * 30, 4);
				ink.dot(TG.lip, lx, ly, 1.1);
			}
		});
	return String(ink);
}

// 20. Winter savory: a stiff, dark, spiky little bush with whorls of tiny white flowers.
const WS = { stem: "#4d6a3e", a: "#355c33", b: "#4d7a43", fl: "#f1e9f2", fl2: "#d5b4dc" };
function winterSavory(st: St): string {
	const ink = new Ink();
	const ps = by(st, fanStalks(3, 34, 46, 72, 74, 1), fanStalks(9, 18, 62, 50, 58, 2), fanStalks(11, 10, 70, 36, 52, 3));
	ps.forEach((p) => ink.line(WS.stem, 1, curveD(p)));
	ps.forEach((p) => along(ink, p, { t0: 0.15, t1: 1, n: by(st, 4, 6, 6), len: 4.4, w: 1, spread: 30, fills: [WS.a, WS.b], shrink: 0.2, needle: 1.3, tip: true }));
	if (st === "bloom")
		ps.forEach((p, s) => {
			for (const t of [0.62, 0.78, 0.92]) {
				const [x, y] = bez(p, t);
				ink.dot(WS.fl, x - 1.6, y, 1).dot(WS.fl, x + 1.6, y, 1).dot((s + t * 10) % 2 > 1 ? WS.fl2 : WS.fl, x, y - 0.6, 0.9);
			}
		});
	return String(ink);
}

// 21. Spanish lavender: grey mound, short stalks with fat dark purple heads and pale violet "rabbit ears".
const SL = { stem: "#7b8c6c", a: "#8a9f85", b: "#a7b8a0", head: "#4a2d6c", dot: "#6d4593", ear: "#c895de" };
function spanishLavender(st: St): string {
	const ink = new Ink();
	const leaves = by(st, fanStalks(4, 32, 48, 70, 74, 1), fanStalks(9, 16, 64, 46, 60, 2), fanStalks(10, 12, 68, 52, 66, 2));
	const flo = st === "bloom" ? fanStalks(7, 14, 66, 20, 32, 2) : st === "leafy" ? fanStalks(2, 34, 46, 38, 38, 1) : [];
	[...leaves, ...flo].forEach((p) => ink.line(SL.stem, 1, curveD(p)));
	leaves.forEach((p) => along(ink, p, { t0: 0.2, t1: 1, n: by(st, 4, 6, 6), len: 4.5, w: 1, spread: 30, fills: [SL.a, SL.b], shrink: 0.25, needle: 1.4, tip: true }));
	flo.forEach((p) => {
		const [x, y, a] = at(p, 1);
		const big = st === "bloom" ? 1 : 0.6;
		const [cx, cy] = pol(x, y, a, 3.6 * big);
		ink.fill(SL.head, ovalD(cx, cy, 4.4 * big, 2.5 * big, a));
		for (const k of [-1.6, 0.4, 2.4]) ink.dot(SL.dot, ...pol(cx, cy, a, k * big), 0.6);
		const [ex, ey] = pol(cx, cy, a, 3.6 * big);
		ink.fill(SL.ear, leafD(ex, ey, a - 22, 6 * big, 2.2 * big, 3) + leafD(ex, ey, a + 22, 6 * big, 2.2 * big, 3) + (big === 1 ? leafD(ex, ey, a, 4, 1.4, 3) : ""));
	});
	return String(ink);
}

// 22. Pittosporum: rounded shrub of glossy leaf rosettes, creamy star-flower clusters in their hearts.
const PIT = { stem: "#7a756a", base: "#2a4f2c", a: "#3d7a3b", b: "#5a964a", hi: "#7fb262", fl: "#f7f0d6", eye: "#e0c46a" };
function rosetteLeaves(ink: Ink, x: number, y: number, len: number, off: number, flower: boolean): void {
	for (let k = 0; k < 5; k++) ink.fill(k % 2 ? PIT.a : PIT.b, leafD(x, y, off + k * 72, len, len * 0.38, 3));
	if (flower) {
		for (const [dx, dy] of [[-1.4, -0.9], [1.4, -0.9], [0, 1.4], [0, -0.1]] as N2[]) ink.dot(PIT.fl, x + dx, y + dy, 1.35);
		ink.dot(PIT.eye, x - 1.4, y - 0.9, 0.45).dot(PIT.eye, x + 1.4, y - 0.9, 0.45).dot(PIT.eye, x, y + 1.4, 0.45);
	} else ink.dot(PIT.hi, x, y, 1.2);
}
function pittosporum(st: St): string {
	const ink = new Ink();
	if (st === "sprout") {
		ink.seg(PIT.stem, 1.5, 40, 87, 40, 72);
		rosetteLeaves(ink, 40, 70, 7, -90, false);
		return String(ink);
	}
	const [cy, rx, ry, n] = by<N4>(st, [0, 0, 0, 0], [60, 14, 14, 6], [48, 25, 25, 13]);
	ink.line(PIT.stem, 2.2, `M40 87L40 ${f(cy + ry * 0.6)}M40 84L${P(40 - rx * 0.5, cy + ry * 0.55)}M40 82L${P(40 + rx * 0.5, cy + ry * 0.6)}`);
	ink.fill(PIT.base, ovalD(40, cy, rx * 0.8, ry * 0.78));
	scatter(40, cy, rx * 0.84, ry * 0.82, n).forEach(([x, y], i) => rosetteLeaves(ink, x, y, by(st, 0, 8, 9), i * 23, st === "bloom" && i % 4 !== 3));
	return String(ink);
}

// 23. Tree mallow: tall woolly stems, big soft lobed leaves below, many mauve-pink flowers with dark eyes.
const TM = { stem: "#7d936a", a: "#6a9656", b: "#86ad6a", fl: "#d47ab3", fl2: "#e8a3cf", eye: "#7a2a68" };
function lobedD(x: number, y: number, r: number, rot: number): string {
	let d = "";
	for (let k = 0; k < 5; k++) {
		const a = rot - 90 + (k - 2) * 42;
		const [cx, cy] = pol(x, y, a, r * 0.55);
		d += ovalD(cx, cy, r * 0.5, r * 0.34, a);
	}
	return d + ovalD(x, y, r * 0.45, r * 0.4);
}
function treeMallow(st: St): string {
	const ink = new Ink();
	const ps = by(st, fanStalks(1, 40, 40, 66, 66, 0), fanStalks(3, 30, 50, 34, 40, 2), fanStalks(3, 22, 58, 10, 18, 3));
	ps.forEach((p) => ink.line(TM.stem, by(st, 1.6, 2, 2.4), curveD(p)));
	const big = by<N4[]>(st, [[40, 74, 7, -40], [40, 76, 6, 35]], [[33, 70, 10, -50], [47, 68, 10, 45], [36, 54, 8, -30], [45, 50, 8, 30]], [[30, 72, 11, -55], [50, 70, 11, 50], [33, 56, 10, -40], [48, 54, 10, 40], [36, 42, 8, -25], [46, 38, 8, 25]]);
	big.forEach(([x, y, r, rot], i) => ink.fill(i % 2 ? TM.a : TM.b, lobedD(x + Math.sin(rad(rot)) * r * 0.5, y - Math.cos(rad(rot)) * r * 0.4, r, rot)));
	if (st === "leafy") ps.forEach((p) => ink.dot(TM.fl, p[3][0], p[3][1], 1.6));
	if (st === "bloom")
		ps.forEach((p, s) => {
			for (let k = 0; k < 6; k++) {
				const [x, y, a] = at(p, 0.42 + k * 0.115);
				const [fx, fy] = pol(x, y, a + ((k + s) % 2 ? 60 : -60), k === 5 ? 0 : 3.4);
				rosette(ink, fx, fy, 5, 1.9, 1.85, k % 2 ? TM.fl : TM.fl2, TM.eye, 0.9, k * 31 + s * 11);
			}
		});
	return String(ink);
}

// 24. Shrubby hare's-ear: dome of leathery blue-green oblong leaves, umbrellas of small yellow flowers.
const HE = { stem: "#5c7a66", base: "#2f4f45", a: "#4f7a6c", b: "#6a9283", ray: "#9a9a3a", fl: "#dccb3c", fl2: "#b9a92a" };
function umbel(ink: Ink, x: number, y: number, r: number): void {
	for (let k = 0; k < 7; k++) {
		const a = -90 + (k - 3) * 24;
		const [ex, ey] = pol(x, y, a, r);
		ink.seg(HE.ray, 0.6, x, y, ex, ey);
		ink.dot(HE.fl, ex, ey, 1.25).dot(HE.fl2, ex + 1.1, ey + 0.4, 0.7).dot(HE.fl, ex - 1.1, ey + 0.5, 0.8);
	}
}
function haresEar(st: St): string {
	const ink = new Ink();
	if (st === "sprout") {
		const p = stalk(40, 40, 68);
		ink.line(HE.stem, 1.3, curveD(p));
		along(ink, p, { t0: 0.3, t1: 0.9, n: 2, len: 8, w: 1.8, shape: 0, spread: 42, fills: [HE.a, HE.b], shrink: 0.1, tip: true });
		return String(ink);
	}
	const [cy, rx, ry, n] = by<N4>(st, [0, 0, 0, 0], [66, 17, 18, 22], [60, 27, 24, 44]);
	ink.line(HE.stem, 2, `M40 87L40 ${f(cy + 8)}M40 85L34 ${f(cy + 10)}M40 85L46 ${f(cy + 10)}`);
	mound(ink, 40, cy, rx, ry, n, 9, 2.4, [HE.a, HE.b], HE.base, 1);
	if (st === "leafy") umbel(ink, 40, cy - ry + 4, 4);
	else
		for (const [x, y] of [[22, 42], [34, 36], [47, 35], [59, 42], [28, 50], [52, 50]] as N2[]) {
			ink.seg(HE.stem, 0.9, x, y + 8, x, y);
			umbel(ink, x, y, 5.5);
		}
	return String(ink);
}

// 25. Sea lavender: flat rosette of spoon leaves, wiry branching stems carrying an airy lavender cloud.
const SEA = { a: "#4d7c49", b: "#679552", wire: "#6c8458", fl: "#a48ad8", fl2: "#cbb8f0", wh: "#f4f0fb" };
function seaLavender(st: St): string {
	const ink = new Ink();
	const [n, len, w] = by<N3>(st, [4, 13, 4], [6, 15, 5], [7, 16, 5.2]);
	const wires = by<N4[]>(st, [], [[40, 85, 32, 54], [40, 85, 41, 46], [40, 85, 50, 56]], [[40, 85, 22, 30], [40, 85, 32, 22], [40, 85, 44, 18], [40, 85, 56, 26], [40, 85, 64, 36]]);
	wires.forEach(([x0, y0, tx, ty]) => ink.line(SEA.wire, 0.9, `M${P(x0, y0)}Q${P(x0 + (tx - x0) * 0.2, (y0 + ty) / 2)} ${P(tx, ty)}`));
	const cloud: N2[] = [];
	wires.forEach(([x0, y0, tx, ty], i) => {
		for (let k = 0; k < 3; k++) {
			const u = 0.55 + k * 0.17;
			const bx = x0 + (tx - x0) * u * u;
			const by2 = y0 + (ty - y0) * u;
			const sd = (i + k) % 2 ? 1 : -1;
			const [ex, ey] = [bx + sd * 7, by2 - 6];
			ink.seg(SEA.wire, 0.6, bx, by2, ex, ey);
			cloud.push([ex, ey], [bx + sd * 4, by2 - 3]);
		}
		cloud.push([tx, ty]);
	});
	for (let i = 0; i < n; i++) {
		const a = -160 + (140 * i) / (n - 1);
		ink.fill(i % 2 ? SEA.a : SEA.b, leafD(40, 85.5, a, len * (1 - Math.abs(a + 90) / 300), w, 3));
	}
	if (st === "leafy") cloud.forEach(([x, y], i) => i % 2 || ink.dot(SEA.fl, x, y, 1.1));
	if (st === "bloom")
		cloud.forEach(([x, y], i) => {
			for (const [dx, dy, r] of [[0, 0, 1.3], [-1.8, 1, 1], [1.8, 0.8, 1.1], [0.6, -1.7, 1], [-1.2, -1.4, 0.9]] as N3[]) ink.dot((i + dx) % 2 ? SEA.fl2 : SEA.fl, x + dx, y + dy, r);
			ink.dot(SEA.wh, x + 0.4, y - 0.3, 0.45);
		});
	return String(ink);
}

const kebab = (name: string): string =>
	name
		.toLowerCase()
		.replace(/'/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");

const ALL: [string, (st: St) => string][] = [
	["Oleander", oleander],
	["Myrtle", myrtle],
	["Bay laurel", bayLaurel],
	["Rockrose", rockrose],
	["Santolina", santolina],
	["Curry plant", curryPlant],
	["Oregano", oregano],
	["Sweet marjoram", sweetMarjoram],
	["Strawberry tree", strawberryTree],
	["Mastic tree", mastic],
	["Spanish broom", spanishBroom],
	["Rue", rue],
	["Jerusalem sage", jerusalemSage],
	["Mediterranean spurge", spurge],
	["Tree heath", treeHeath],
	["Caper bush", caperBush],
	["Hyssop", hyssop],
	["Wormwood", wormwood],
	["Tree germander", treeGermander],
	["Winter savory", winterSavory],
	["Spanish lavender", spanishLavender],
	["Pittosporum", pittosporum],
	["Tree mallow", treeMallow],
	["Shrubby hare's-ear", haresEar],
	["Sea lavender", seaLavender],
];

export const SPECIES: Species[] = ALL.map(([name, draw]) => ({ id: kebab(name), name, draw }));
