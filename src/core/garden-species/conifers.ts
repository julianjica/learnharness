/**
 * Conifers: 25 species in the garden's flat style (see kit.ts). Each grows
 * from a seedling (sprout) to a young tree (leafy) to its signature fullest
 * form (bloom): its mature silhouette, cones, arils or autumn colour.
 */
import { f, line, stem, type GrowingStage, type Species } from "./kit";

/* ---------------- private helpers ---------------- */

const pt = (x: number, y: number): string => `${f(x)} ${f(y)}`;

const path = (d: string, fill: string): string => `<path d="${d}" fill="${fill}"/>`;

const strokeP = (d: string, c: string, w: number, extra = ""): string => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round"${extra}/>`;

/** Merges path data per fill (or stroke colour + width) into one <path> each, in first-seen order. */
class Ink {
	private parts = new Map<string, [string, number, string]>();
	fill(c: string, d: string): this {
		return this.put(c, 0, d);
	}
	stroke(c: string, w: number, d: string): this {
		return this.put(c, w, d);
	}
	private put(c: string, w: number, d: string): this {
		const k = `${c}|${w}`;
		const p = this.parts.get(k);
		if (p) p[2] += d;
		else this.parts.set(k, [c, w, d]);
		return this;
	}
	toString(): string {
		return [...this.parts.values()].map(([c, w, d]) => (w ? strokeP(d, c, w) : path(d, c))).join("");
	}
}

/** An axis-aligned ellipse as path data (two arcs), for merging. */
function ellD(x: number, y: number, rx: number, ry: number): string {
	return `M${pt(x - rx, y)}a${f(rx)} ${f(ry)} 0 1 0 ${f(2 * rx)} 0a${f(rx)} ${f(ry)} 0 1 0 ${f(-2 * rx)} 0Z`;
}

const circD = (x: number, y: number, r: number): string => ellD(x, y, r, r);

const segD = (x1: number, y1: number, x2: number, y2: number): string => `M${pt(x1, y1)}L${pt(x2, y2)}`;

/** Maps local coordinates (u along, v across) at (x, y) rotated by deg to "x y". */
function mapper(x: number, y: number, deg: number): (u: number, v: number) => string {
	const c = Math.cos((deg * Math.PI) / 180);
	const s = Math.sin((deg * Math.PI) / 180);
	return (u, v) => pt(x + c * u - s * v, y + s * u + c * v);
}

/** A pointed lens from (x, y) heading `deg`. */
function lensD(x: number, y: number, deg: number, len: number, w: number): string {
	const P = mapper(x, y, deg);
	return `M${P(0, 0)}C${P(len * 0.45, -w * 1.15)} ${P(len * 0.8, -w * 0.5)} ${P(len, 0)}C${P(len * 0.8, w * 0.5)} ${P(len * 0.45, w * 1.15)} ${P(0, 0)}Z`;
}

/** A feathery spray (sawtooth leaflets swept forward) from (x, y) heading `deg`. */
function featherD(x: number, y: number, deg: number, len: number, w: number, n = 4): string {
	const P = mapper(x, y, deg);
	const st = len / n;
	const wk = (k: number) => w * (1 - (k / n) * 0.55);
	let d = `M${P(0, 0)}`;
	for (let k = 0; k < n; k++) {
		d += `L${P(st * k + st * 0.9, -wk(k))}`;
		if (k < n - 1) d += `L${P(st * (k + 1), -wk(k) * 0.3)}`;
	}
	d += `L${P(len + st * 0.4, 0)}`;
	for (let k = n - 1; k >= 0; k--) {
		d += `L${P(st * k + st * 0.9, wk(k))}`;
		if (k > 0) d += `L${P(st * k, wk(k - 1) * 0.3)}`;
	}
	return d + "Z";
}

/** n needle strokes from (x, y) between two angles (degrees), radius r (ry squashes vertically). */
function fanD(x: number, y: number, r: number, n: number, from: number, to: number, ry = r): string {
	let d = "";
	for (let i = 0; i < n; i++) {
		const a = ((from + ((to - from) * i) / Math.max(1, n - 1)) * Math.PI) / 180;
		d += segD(x, y, x + Math.cos(a) * r, y + Math.sin(a) * ry);
	}
	return d;
}

/** A tapered trunk from the ground at x0 (width w0, flared foot) to (x1, y1) (width w1). */
function trunkD(x0: number, x1: number, y1: number, w0: number, w1: number): string {
	const y0 = 87.5;
	const fl = w0 * 0.35;
	return `M${pt(x0 - w0 / 2 - fl, y0)}Q${pt(x0 - w0 / 2, y0 - 1)} ${pt(x0 - w0 / 2, y0 - 4)}L${pt(x1 - w1 / 2, y1)}L${pt(x1 + w1 / 2, y1)}L${pt(x0 + w0 / 2, y0 - 4)}Q${pt(x0 + w0 / 2, y0 - 1)} ${pt(x0 + w0 / 2 + fl, y0)}Z`;
}

const trunk = (x0: number, x1: number, y1: number, w0: number, w1: number, fill: string): string => path(trunkD(x0, x1, y1, w0, w1), fill);

/** A point on a quadratic Bézier. */
function quad(a: readonly [number, number], b: readonly [number, number], c: readonly [number, number], t: number): [number, number] {
	const u = 1 - t;
	return [u * u * a[0] + 2 * u * t * b[0] + t * t * c[0], u * u * a[1] + 2 * u * t * b[1] + t * t * c[1]];
}

/** A drooping skirt (one half of a tier) from the trunk at (cx, y) out to side s (-1 left, 1 right). */
function skirtD(cx: number, y: number, hw: number, th: number, dr: number, s: number): string {
	return `M${pt(cx, y - th)}Q${pt(cx + s * hw * 0.5, y - th * 0.7)} ${pt(cx + s * hw, y + dr)}Q${pt(cx + s * hw * 0.55, y + th * 0.5)} ${pt(cx, y + th * 0.7)}Z`;
}

/** Deterministic points inside a cone (apex (cx, top), base half-width hw at bot). */
function conePoints(cx: number, top: number, bot: number, hw: number, n: number): [number, number][] {
	const out: [number, number][] = [];
	for (let i = 0; i < n; i++) {
		const u = Math.sqrt((i + 0.5) / n);
		const v = ((i * 0.618034) % 1) * 2 - 1;
		out.push([cx + v * hw * u * 0.82, top + (bot - top) * u * 0.96]);
	}
	return out;
}

/** Deterministic points in an ellipse (sunflower spiral). */
function scatter(cx: number, cy: number, rx: number, ry: number, n: number): [number, number][] {
	const out: [number, number][] = [];
	for (let i = 0; i < n; i++) {
		const a = i * 2.39996;
		const r = Math.sqrt((i + 0.5) / n);
		out.push([cx + Math.cos(a) * r * rx, cy + Math.sin(a) * r * ry]);
	}
	return out;
}

/** Three-tone clumps: dark body, mid highlight up-left, small light dab. */
function clumps(cs: readonly (readonly [number, number, number, number])[], g: readonly [string, string, string]): string {
	const a = new Ink();
	const b = new Ink();
	const c = new Ink();
	for (const [x, y, rx, ry] of cs) {
		a.fill(g[0], ellD(x, y, rx, ry));
		b.fill(g[1], ellD(x - rx * 0.12, y - ry * 0.3, rx * 0.74, ry * 0.6));
		c.fill(g[2], ellD(x - rx * 0.3, y - ry * 0.5, rx * 0.32, ry * 0.28));
	}
	return String(a) + b + c;
}

/* ---------------- species ---------------- */

function scotsPine(stage: GrowingStage): string {
	const bark = "#c47a45";
	const lo = "#7b5a48";
	const g = ["#3b6557", "#517d6b", "#6e9a83"] as const;
	if (stage === "sprout") return line(40, 87, 40, 73, bark, 1.6) + clumps([[40, 80, 5, 3], [40, 73, 4.4, 4]], g);
	if (stage === "leafy") {
		const k = new Ink().stroke(bark, 1.4, segD(40, 73, 29, 69) + segD(40, 73, 51, 69) + segD(40, 63, 31, 59) + segD(40, 63, 49, 59) + segD(40, 54, 33, 51) + segD(40, 54, 47, 51));
		return (
			trunk(40, 40, 44, 3.4, 1.4, bark) +
			k +
			clumps([[27, 68, 7, 4], [53, 68, 7, 4], [30, 58, 6, 3.6], [50, 58, 6, 3.6], [33, 50, 5, 3.2], [47, 50, 5, 3.2], [40, 44, 4.5, 4.5]], g)
		);
	}
	const br = new Ink().stroke(bark, 2, segD(41.3, 45, 24, 35) + segD(41.6, 37, 57, 28) + segD(41.8, 31, 32, 21) + segD(42, 25, 49, 16));
	const cones = new Ink().fill("#8b7461", ellD(18, 40, 1.3, 2.2) + ellD(27, 40, 1.3, 2.2) + ellD(61, 33.5, 1.3, 2.2) + ellD(53, 33, 1.3, 2.2) + ellD(36, 26, 1.3, 2.2));
	return (
		trunk(40, 41, 58, 6, 4.4, lo) +
		path("M38.8 59L41 22L43 22L43.2 59Z", bark) +
		line(40.5, 66, 33, 61, lo, 1.3) +
		br +
		clumps([[22, 35, 11, 5.5], [58, 28, 12, 6], [32, 21, 10, 5.5], [50, 15, 9, 5], [42, 26, 6, 4], [68, 34, 6, 3.2]], g) +
		cones
	);
}

function douglasFir(stage: GrowingStage): string {
	const g = ["#2d5a3c", "#3f7449", "#5a8f5a"] as const;
	const tiers = (n: number, y0: number, dy: number, h0: number, dh: number, th: number, dr: number) => {
		const a = new Ink();
		const b = new Ink();
		for (let i = 0; i < n; i++) {
			a.fill(g[0], skirtD(40, y0 - i * dy, h0 - i * dh, th, dr, -1));
			b.fill(g[1], skirtD(40, y0 - i * dy, h0 - i * dh, th, dr, 1));
		}
		return String(a) + b;
	};
	if (stage === "sprout") return line(40, 87, 40, 80, "#7a5a44", 1.6) + tiers(4, 82, 4.5, 7, 1.5, 2.6, 1.6);
	if (stage === "leafy") return trunk(40, 40, 74, 3.6, 2.4, "#7a5a44") + tiers(7, 76, 6, 13, 1.6, 3.6, 2.4) + path("M40 34L41.6 41L38.4 41Z", g[1]);
	const cone = new Ink();
	const bract = new Ink();
	for (const [x, y] of [[23, 70], [58, 64], [28, 52], [52, 46], [34, 34], [47, 28]] as const) {
		cone.fill("#a07850", ellD(x, y + 3.2, 1.7, 3.4)).stroke("#7a5a44", 0.6, segD(x, y - 1, x, y));
		bract.stroke("#e0cfa2", 0.6, segD(x - 1.4, y + 2, x + 1.2, y + 3) + segD(x - 1.2, y + 4.4, x + 1.4, y + 5.2));
	}
	return trunk(40, 40, 72, 5, 3, "#7a5a44") + tiers(12, 79, 6, 22, 1.7, 4, 3) + path("M40 4L41.8 12L38.2 12Z", g[1]) + cone + bract;
}

function norwaySpruce(stage: GrowingStage): string {
	const dk = "#21463a";
	const md = "#30604a";
	const lt = "#4f8466";
	const bark = "#6e4a35";
	const draw = (n: number, y0: number, dy: number, h0: number, dh: number, top: number, curt: number) => {
		const a = new Ink();
		const b = new Ink();
		const br = new Ink();
		for (let i = 0; i < n; i++) {
			const y = y0 - i * dy;
			const hw = h0 - i * dh;
			for (const s of [-1, 1]) {
				const P0 = [40, y] as const;
				const P1 = [40 + s * hw * 0.55, y + 4.5] as const;
				const P2 = [40 + s * hw, y - 1.5] as const;
				const curve = `M${pt(40, y)}Q${pt(P1[0], P1[1])} ${pt(P2[0], P2[1])}`;
				let d = curve;
				const m = 8;
				for (let k = m; k >= 0; k--) {
					const t = k / m;
					const [x, yy] = quad(P0, P1, P2, t);
					d += `L${pt(x, yy + curt * (0.45 + 0.55 * t) * (k % 2 ? 0.55 : 1))}`;
				}
				(s < 0 ? a : b).fill(s < 0 ? dk : md, d + "Z");
				br.stroke(lt, 1.1, curve);
			}
		}
		return path(`M40 ${f(top)}L${f(40 + h0 * 0.28)} ${f(y0 + 1)}L${f(40 - h0 * 0.28)} ${f(y0 + 1)}Z`, dk) + a + b + br;
	};
	if (stage === "sprout") return line(40, 87, 40, 82, bark, 1.6) + draw(3, 79, 5, 7, 2, 66, 3);
	if (stage === "leafy") return trunk(40, 40, 72, 3.6, 2.2, bark) + draw(6, 74, 6.4, 15, 2, 36, 5);
	const cones = new Ink().fill("#9a6438", ellD(15, 76, 1.6, 4.4) + ellD(65, 69, 1.6, 4.4) + ellD(20, 55, 1.5, 4.2) + ellD(60, 49, 1.5, 4.2) + ellD(28, 35, 1.4, 3.8) + ellD(52, 28, 1.4, 3.8));
	return trunk(40, 40, 72, 5.5, 3.5, bark) + draw(10, 77, 7.2, 27, 2.4, 5, 7) + cones;
}

function coloradoBlueSpruce(stage: GrowingStage): string {
	const c = ["#507a94", "#6d97ae", "#b5d0dc"] as const;
	const spiky = (cx: number, top: number, bot: number, hw: number, m: number, sp: number) => {
		const h = bot - top;
		let d = `M${pt(cx, top)}`;
		const side = (s: number, k: number) => {
			const t = k / m;
			const o = k % 2 ? sp * (0.4 + t) : 0;
			return `L${pt(cx + s * (hw * t + o), top + h * t + (k % 2 ? 1.2 : 0))}`;
		};
		for (let k = 1; k <= m; k++) d += side(-1, k);
		d += `Q${pt(cx, bot + 2)} ${pt(cx + hw, bot)}`;
		for (let k = m - 1; k >= 1; k--) d += side(1, k);
		return d + "Z";
	};
	const frost = (cx: number, top: number, bot: number, hw: number, n: number) => {
		let d = "";
		for (const [x, y] of conePoints(cx, top + 3, bot, hw, n)) d += `M${pt(x - 1.6, y + 0.9)}L${pt(x, y - 0.5)}L${pt(x + 1.6, y + 0.9)}`;
		return strokeP(d, c[2], 0.8);
	};
	const body = (top: number, bot: number, hw: number, m: number, sp: number, n: number) =>
		path(spiky(40, top, bot, hw, m, sp), c[0]) + path(spiky(41.5, top + (bot - top) * 0.18, bot - 1.5, hw * 0.72, m - 2, sp * 0.7), c[1]) + frost(40, top, bot, hw, n);
	if (stage === "sprout") return line(40, 87, 40, 82, "#6e5040", 1.8) + body(66, 84, 7, 6, 1.2, 4);
	if (stage === "leafy") return trunk(40, 40, 80, 4, 2.6, "#6e5040") + body(38, 82, 14, 14, 1.8, 16);
	const cones = new Ink().fill("#c2a678", ellD(33, 22, 1.2, 2.8) + ellD(46, 20, 1.2, 2.8) + ellD(38, 30, 1.2, 2.8) + ellD(44, 34, 1.2, 2.8));
	return trunk(40, 40, 80, 6, 4, "#6e5040") + body(5, 82, 25, 24, 2.4, 42) + cones;
}

function europeanLarch(stage: GrowingStage): string {
	const twig = "#6b4a36";
	const tuft = (x: number, y: number) => `M${pt(x, y)}l-2.4-1.5m2.4 1.5l-.8-2.7m.8 2.7l.8-2.7m-.8 2.7l2.4-1.5`;
	const draw = (n: number, y0: number, dy: number, h0: number, dh: number, top: number, w0: number, pal: readonly [string, string], cones: boolean) => {
		const br = new Ink();
		const a = new Ink();
		const cn = new Ink();
		for (let i = 0; i < n; i++) {
			const y = y0 - i * dy;
			const hw = h0 - i * dh;
			for (const s of [-1, 1]) {
				const P0 = [40, y] as const;
				const P1 = [40 + s * hw * 0.5, y + 1] as const;
				const P2 = [40 + s * hw, y + 4] as const;
				br.stroke(twig, 0.9, `M${pt(P0[0], P0[1])}Q${pt(P1[0], P1[1])} ${pt(P2[0], P2[1])}`);
				[0.4, 0.7, 1].forEach((t, j) => {
					const [x, yy] = quad(P0, P1, P2, t);
					a.stroke((i + j) % 2 ? pal[1] : pal[0], 1.3, tuft(x, yy));
					if (cones && j === 1 && (i + (s > 0 ? 1 : 0)) % 2 === 0) cn.fill("#8a5a3a", ellD(x + s * 1.2, yy - 3.4, 1.1, 1.7));
				});
			}
		}
		return trunk(40, 40, top, w0, 1, twig) + br + a + cn;
	};
	const green = ["#86b85a", "#a9d07a"] as const;
	if (stage === "sprout") return draw(3, 82, 5, 6, 1.5, 68, 1.6, green, false);
	if (stage === "leafy") return draw(6, 76, 7, 15, 2, 34, 3, green, false);
	return draw(9, 78, 8.2, 27, 2.8, 6, 5, ["#d4a02a", "#ebc44e"], true);
}

function cedarOfLebanon(stage: GrowingStage): string {
	const g = ["#2f5641", "#436f52", "#5d8c66"] as const;
	const bark = "#6e5444";
	const plates = (ps: readonly (readonly [number, number, number, number])[]) => {
		const a = new Ink();
		const b = new Ink();
		const c = new Ink();
		const plate = (x: number, y: number, rx: number, ry: number) => `M${pt(x - rx, y)}Q${pt(x - rx * 0.8, y - ry)} ${pt(x, y - ry)}Q${pt(x + rx * 0.8, y - ry)} ${pt(x + rx, y)}Q${pt(x, y + ry * 0.4)} ${pt(x - rx, y)}Z`;
		for (const [x, y, rx, ry] of ps) {
			a.fill(g[0], plate(x, y, rx, ry));
			b.fill(g[1], plate(x - rx * 0.06, y - ry * 0.4, rx * 0.84, ry * 0.6));
			c.fill(g[2], plate(x - rx * 0.25, y - ry * 0.75, rx * 0.4, ry * 0.25));
		}
		return String(a) + b + c;
	};
	if (stage === "sprout") return line(40, 87, 40, 72, bark, 1.6) + plates([[40, 80, 7, 2.6], [40, 73, 4.5, 2.2]]);
	if (stage === "leafy") return trunk(40, 40, 44, 4, 1.6, bark) + plates([[40, 74, 16, 4], [40, 64, 13, 4], [40, 55, 10, 3.6], [40, 47, 6, 3.2]]);
	const limbs = new Ink().stroke(bark, 2.6, segD(40, 64, 18, 60) + segD(40, 58, 62, 52) + segD(40, 51, 25, 43) + segD(40, 45, 56, 36) + segD(40, 40, 40, 28));
	const cones = new Ink().fill("#b6a97e", ellD(20, 53.5, 1.6, 2.6) + ellD(28, 53.5, 1.6, 2.6) + ellD(60, 46.5, 1.6, 2.6) + ellD(28, 35.5, 1.6, 2.6) + ellD(54, 29.5, 1.6, 2.6) + ellD(44, 14.5, 1.6, 2.6));
	return trunk(40, 40, 44, 8, 5, bark) + limbs + plates([[16, 62, 13, 5], [63, 54, 13, 5], [25, 44, 15, 5], [55, 38, 14, 5.2], [39, 30, 17, 5.5], [42, 21, 10, 4.2]]) + cones;
}

function deodarCedar(stage: GrowingStage): string {
	const g = ["#5a7f66", "#759a7b", "#9bb99a"] as const;
	const bark = "#7a6250";
	const draw = (n: number, y0: number, dy: number, h0: number, dh: number, th: number, dr: number, topY: number) => {
		const a = new Ink();
		const b = new Ink();
		for (let i = 0; i < n; i++) {
			const y = y0 - i * dy;
			const hw = h0 - i * dh;
			a.fill(g[0], skirtD(40, y, hw, th, dr, -1));
			b.fill(g[1], skirtD(40, y, hw, th, dr, 1));
		}
		const nod = strokeP(`M40 ${f(topY + 6)}Q40 ${f(topY)} ${f(44)} ${f(topY + 1.5)}`, g[1], 1.6);
		return String(a) + b + nod;
	};
	if (stage === "sprout") return line(40, 87, 40, 80, bark, 1.6) + draw(3, 81, 5, 8, 2, 2.4, 3, 66);
	if (stage === "leafy") return trunk(40, 40, 76, 3.6, 2.4, bark) + draw(6, 76, 6.6, 19, 2.6, 3.6, 5, 36);
	const cones = new Ink().fill("#c4b892", ellD(22, 63, 1.5, 2.4) + ellD(60, 56, 1.5, 2.4) + ellD(30, 43, 1.4, 2.2) + ellD(50, 37, 1.4, 2.2));
	const tips = new Ink().fill(g[2], skirtD(40, 72.5, 22, 1.6, 4, -1) + skirtD(40, 58.5, 17, 1.4, 3.5, 1) + skirtD(40, 44.5, 12, 1.2, 3, -1) + skirtD(40, 30.5, 8, 1, 2.5, 1));
	return trunk(40, 40, 76, 6, 4, bark) + draw(9, 76, 7, 32, 3.3, 4.4, 7, 6) + tips + cones;
}

function blueAtlasCedar(stage: GrowingStage): string {
	const g = ["#557f97", "#77a0b6", "#a9c5d4"] as const;
	const bark = "#6a5a50";
	const arm = (br: Ink, a: Ink, b: Ink, x0: number, y0: number, deg: number, len: number, w: number) => {
		const r = (deg * Math.PI) / 180;
		const x1 = x0 + Math.cos(r) * len;
		const y1 = y0 + Math.sin(r) * len;
		br.stroke(bark, 1.8, segD(x0, y0, x1, y1));
		for (const [t, k] of [[0.45, 0.8], [0.72, 1], [1, 0.75]] as const) {
			const x = x0 + Math.cos(r) * len * t;
			const y = y0 + Math.sin(r) * len * t;
			a.fill(g[0], ellD(x, y, w * 1.9 * k, w * k));
			b.fill(g[1], ellD(x - 0.5, y - w * k * 0.35, w * 1.4 * k, w * 0.55 * k));
		}
	};
	const build = (arms: readonly (readonly [number, number, number, number, number])[]) => {
		const br = new Ink();
		const a = new Ink();
		const b = new Ink();
		for (const [x, y, d, l, w] of arms) arm(br, a, b, x, y, d, l, w);
		return String(br) + a + b;
	};
	if (stage === "sprout") return line(40, 87, 40, 72, bark, 1.6) + build([[40, 78, -150, 6, 2.2], [40, 76, -30, 6, 2.2], [40, 72, -90, 3, 2.2]]);
	if (stage === "leafy") return trunk(40, 40, 44, 3.6, 1.4, bark) + build([[40, 72, -158, 15, 2.8], [40, 66, -24, 14, 2.8], [40, 58, -148, 11, 2.6], [40, 52, -32, 10, 2.6], [40, 46, -100, 4, 2.6]]);
	const cones = new Ink().fill("#c9c39a", ellD(14, 44, 1.5, 2.6) + ellD(64, 37, 1.5, 2.6) + ellD(26, 25, 1.5, 2.6) + ellD(52, 20, 1.5, 2.6) + ellD(36, 13, 1.4, 2.4));
	return (
		trunk(40, 40, 30, 7, 3, bark) +
		build([[40, 68, -160, 28, 3.2], [40, 60, -24, 28, 3.2], [40, 52, -142, 24, 3.2], [40, 46, -40, 22, 3.2], [40, 40, -120, 20, 3], [40, 34, -66, 18, 3]]) +
		cones
	);
}

function englishYew(stage: GrowingStage): string {
	const g = ["#1f3b2a", "#2c5038", "#3e6a48"] as const;
	const bark = "#8a4a3a";
	if (stage === "sprout") {
		const n = new Ink();
		for (let j = 0; j < 6; j++) {
			const y = 84 - j * 2.6;
			const l = 5.4 - j * 0.5;
			n.fill(g[1], lensD(40, y, 195, l, 1.1) + lensD(40, y, -15, l, 1.1));
		}
		n.fill(g[2], lensD(40, 69.5, -90, 3, 1));
		return line(40, 87, 40, 69, "#4a6a3a", 1.2) + n;
	}
	const dome = (cs: readonly (readonly [number, number, number])[], lights: readonly (readonly [number, number, number])[]) => {
		const a = new Ink();
		const b = new Ink();
		for (const [x, y, r] of cs) a.fill(g[0], circD(x, y, r));
		for (const [x, y, r] of lights) b.fill(g[1], circD(x, y, r));
		return String(a) + b;
	};
	if (stage === "leafy")
		return (
			trunk(40, 40, 72, 5, 3.4, bark) +
			dome(
				[[40, 64, 14], [29, 70, 8], [51, 70, 8], [33, 57, 8], [47, 57, 8], [40, 52, 7]],
				[[35, 58, 5], [44, 54, 4], [31, 66, 4]],
			) +
			path(ellD(36, 54, 2.2, 1.4), g[2])
		);
	const aril = new Ink();
	const seedI = new Ink();
	for (const [x, y] of scatter(40, 42, 25, 19, 15)) {
		aril.fill("#d23a2e", circD(x, y, 1.7));
		seedI.fill("#3a2228", circD(x, y - 0.4, 0.6));
	}
	return (
		trunk(37, 36, 58, 8, 5, bark) +
		trunk(44, 46, 60, 5, 3.5, bark) +
		dome(
			[[40, 42, 27], [16, 40, 10], [22, 26, 10], [38, 18, 12], [56, 23, 11], [65, 38, 10], [62, 54, 9], [18, 56, 8], [40, 58, 14]],
			[[26, 30, 8], [38, 26, 9], [52, 30, 8], [30, 44, 7], [48, 42, 7], [20, 46, 5]],
		) +
		path(ellD(30, 23, 4, 2) + ellD(44, 20, 3.5, 1.8) + ellD(22, 36, 2.6, 1.6), g[2]) +
		aril +
		seedI
	);
}

function monkeyPuzzle(stage: GrowingStage): string {
	const dk = "#2f5a32";
	const lt = "#6e9c52";
	const bark = "#7d746a";
	const rope = (d: string, w: number) => strokeP(d, dk, w) + strokeP(d, lt, Math.round(w * 4.2) / 10, ` stroke-dasharray="0.8 1.5"`);
	const whorls = (ws: readonly (readonly [number, number, number])[]) => {
		let d = "";
		for (const [y, hw, up] of ws) {
			for (const s of [-1, 1]) d += `M40 ${f(y)}C${pt(40 + s * hw * 0.6, y + 2)} ${pt(40 + s * hw, y + 1)} ${pt(40 + s * hw, y - up)}`;
			d += `M40 ${f(y)}Q${pt(40 - hw * 0.35, y - 1)} ${pt(40 - hw * 0.45, y - up * 0.9)}M40 ${f(y)}Q${pt(40 + hw * 0.35, y - 1)} ${pt(40 + hw * 0.45, y - up * 0.9)}`;
		}
		return d;
	};
	if (stage === "sprout") return rope("M40 87L40 69" + whorls([[77, 6, 4]]), 2.6);
	if (stage === "leafy") return trunk(40, 40, 60, 3, 1.6, bark) + rope("M40 66L40 38" + whorls([[72, 18, 7], [62, 14, 7], [53, 10, 6], [45, 6, 5]]), 2.8);
	const scars = new Ink().stroke("#a49a8e", 0.7, segD(38, 76, 42, 76) + segD(38.3, 68, 41.7, 68) + segD(38.6, 60, 41.4, 60) + segD(38.8, 52, 41.2, 52));
	const cones = new Ink().fill("#7c8a3a", circD(29, 19, 3.2) + circD(53, 17, 3.2) + circD(41, 13, 2.8));
	const flecks = new Ink().fill("#b8c06a", circD(28, 18, 0.8) + circD(30, 20.5, 0.6) + circD(52, 16, 0.8) + circD(54, 18.5, 0.6) + circD(40, 12, 0.7));
	return trunk(40, 40, 44, 6, 3, bark) + scars + rope("M40 48L40 8" + whorls([[48, 30, 12], [40, 24, 11], [32, 17, 9], [25, 10, 7]]), 3.2) + cones + flecks;
}

function giantSequoia(stage: GrowingStage): string {
	const bark = "#b5603a";
	const furrow = "#8a4228";
	const g = ["#3a6640", "#4f7d4a", "#6b9658"] as const;
	if (stage === "sprout") return line(40, 87, 40, 80, bark, 1.8) + clumps([[40, 79, 6, 3.4], [40, 74, 4.6, 3.2], [40, 70, 3, 2.8]], ["#3f6e52", "#55866a", "#74a083"]);
	if (stage === "leafy")
		return trunk(40, 40, 70, 5.5, 2.4, bark) + clumps([[40, 72, 12, 5], [40, 64, 10, 5], [40, 56, 8, 5], [40, 49, 6, 4.6], [40, 43, 4, 4]], ["#3f6e52", "#55866a", "#74a083"]);
	const f2 = new Ink().stroke(furrow, 0.9, segD(35, 85, 37.5, 50) + segD(40, 86, 40, 46) + segD(45, 85, 42.5, 50) + segD(32, 86, 34, 74) + segD(48, 86, 46, 74));
	return (
		trunk(40, 40, 12, 20, 4, bark) +
		f2 +
		clumps([[33, 47, 9, 5], [49, 43, 10, 5.5], [30, 37, 10, 5.5], [51, 32, 10, 6], [32, 26, 9, 5.5], [48, 21, 9, 5.5], [38, 14, 8, 5.5], [41, 32, 6, 5]], g)
	);
}

function dawnRedwood(stage: GrowingStage): string {
	const bark = "#9a5236";
	const draw = (n: number, y0: number, dy: number, h0: number, dh: number, w: number, pal: readonly [string, string, string], topY: number) => {
		const a = new Ink();
		const b = new Ink();
		for (let i = 0; i < n; i++) {
			const y = y0 - i * dy;
			const hw = h0 - i * dh;
			a.fill(pal[0], featherD(40, y, -158, hw, w, 5));
			b.fill(pal[1], featherD(40, y - dy * 0.5, -22, hw * 0.96, w, 5));
		}
		b.fill(pal[2], featherD(40, topY + 7, -90, 7, w * 0.8, 3));
		return String(a) + b;
	};
	const green = ["#6aa24e", "#8cbc66", "#a6cf7e"] as const;
	if (stage === "sprout") return line(40, 87, 40, 72, bark, 1.4) + draw(2, 82, 5, 7, 2, 1.8, green, 64);
	if (stage === "leafy") return trunk(40, 40, 40, 3.6, 1.2, bark) + draw(6, 76, 6.6, 15, 1.8, 2.4, green, 32);
	const flutes = new Ink().stroke("#7a3c26", 0.7, segD(37.5, 85, 38.6, 74) + segD(42.5, 85, 41.4, 74));
	return trunk(40, 40, 10, 8, 1.4, bark) + flutes + draw(9, 78, 7.8, 26, 2.4, 2.6, ["#b0552e", "#d0763f", "#e8a060"], 4);
}

function baldCypress(stage: GrowingStage): string {
	const bark = "#8a6a52";
	const g = ["#557f42", "#6f9a52", "#93b86c"] as const;
	const moss = "#b6bcaa";
	const knee = (x: number, h: number) => `M${pt(x - 2, 87.6)}Q${pt(x - 1.6, 87.6 - h)} ${pt(x, 87.6 - h)}Q${pt(x + 1.6, 87.6 - h)} ${pt(x + 2, 87.6)}Z`;
	if (stage === "sprout") return line(40, 87, 40, 72, bark, 1.4) + path(featherD(40, 80, -160, 7, 1.8, 3) + featherD(40, 76, -20, 7, 1.8, 3) + featherD(40, 73, -90, 5, 1.6, 3), g[1]);
	if (stage === "leafy") {
		const a = new Ink();
		const b = new Ink();
		for (let i = 0; i < 5; i++) {
			const y = 72 - i * 6;
			a.fill(g[0], featherD(40, y, -170, 14 - i * 2, 2.4, 4));
			b.fill(g[1], featherD(40, y - 3, -10, 13 - i * 2, 2.4, 4));
		}
		b.fill(g[2], featherD(40, 46, -90, 7, 2, 3));
		return path("M33 87.6Q38 86 38.4 78L39.2 46L40.8 46L41.6 78Q42 86 47 87.6Z", bark) + path(knee(52, 3), bark) + a + b;
	}
	const limbs = new Ink().stroke(bark, 2, segD(40, 46, 22, 33) + segD(40, 40, 58, 30) + segD(40, 36, 40, 22));
	const sprays = new Ink().fill(g[1], featherD(14, 31, 150, 9, 2.2, 3) + featherD(66, 29, 30, 9, 2.2, 3) + featherD(30, 36, 120, 7, 2, 3) + featherD(52, 35, 60, 7, 2, 3));
	const strands = [[20, 34, 13], [26, 36, 9], [33, 37, 12], [50, 36, 10], [57, 34, 14], [63, 32, 8]] as const;
	let md = "";
	for (const [x, y, l] of strands) md += `M${pt(x, y)}q1.2 ${f(l / 4)} 0 ${f(l / 2)}q-1.2 ${f(l / 4)} 0 ${f(l / 2)}`;
	return (
		path("M22 87.6Q34 86 35.6 74Q37 66 38 56L39 24L41 24L42 56Q43 66 44.4 74Q46 86 58 87.6Z", bark) +
		path(knee(14, 4.5) + knee(20, 3) + knee(64, 4) + knee(70, 2.6), bark) +
		limbs +
		clumps([[40, 22, 22, 8], [22, 30, 12, 6], [58, 28, 12, 6.5], [40, 32, 15, 5], [32, 15, 10, 4], [50, 15, 9, 4]], g) +
		sprays +
		strokeP(md, moss, 1.3)
	);
}

function easternHemlock(stage: GrowingStage): string {
	const dk = "#23473a";
	const md = "#336049";
	const under = "#7f9e8f";
	const bark = "#6f5040";
	const draw = (n: number, y0: number, dy: number, h0: number, dh: number, top: number, lw: number, cones: boolean) => {
		const br = new Ink();
		const a = new Ink();
		const u = new Ink();
		const cn = new Ink();
		for (let i = 0; i < n; i++) {
			const y = y0 - i * dy;
			const hw = h0 - i * dh;
			for (const s of [-1, 1]) {
				const P0 = [40, y] as const;
				const P1 = [40 + s * hw * 0.6, y - 0.5] as const;
				const P2 = [40 + s * hw, y + 4.5] as const;
				br.stroke(dk, 1.1, `M${pt(P0[0], P0[1])}Q${pt(P1[0], P1[1])} ${pt(P2[0], P2[1])}`);
				for (const t of [0.38, 0.78]) {
					const [x, yy] = quad(P0, P1, P2, t);
					const deg = s > 0 ? 28 + t * 25 : 152 - t * 25;
					a.fill(md, lensD(x, yy, deg, hw * 0.42 + 1, lw));
					if (t > 0.5) u.stroke(under, 0.6, segD(x + s * 1, yy + 1, x + s * hw * 0.3, yy + 1 + hw * 0.16));
				}
				if (cones && i % 2 === 0) cn.fill("#8c6b4c", ellD(P2[0], P2[1] + 1.8, 1, 1.4));
			}
		}
		const core = path(`M40 ${f(top)}L${f(40 + h0 * 0.22)} ${f(y0 + 1)}L${f(40 - h0 * 0.22)} ${f(y0 + 1)}Z`, dk);
		const nod = strokeP(`M40 ${f(top + 6)}Q40 ${f(top)} ${f(36)} ${f(top + 1.4)}`, dk, 1.3);
		return core + nod + br + a + u + cn;
	};
	if (stage === "sprout") return line(40, 87, 40, 82, bark, 1.4) + draw(3, 81, 4.6, 7, 1.6, 66, 1.4, false);
	if (stage === "leafy") return trunk(40, 40, 74, 3.4, 2, bark) + draw(6, 75, 6.4, 15, 1.8, 36, 1.9, false);
	return trunk(40, 40, 74, 5, 3, bark) + draw(10, 76, 7, 26, 2.3, 5, 2.4, true);
}

function fraserFir(stage: GrowingStage): string {
	const dk = "#23503a";
	const md = "#2f6247";
	const silver = "#b9cfc2";
	const draw = (n: number, b0: number, db: number, h0: number, dh: number, th: number) => {
		const a = new Ink();
		const b = new Ink();
		const s = new Ink();
		for (let i = 0; i < n; i++) {
			const bot = b0 - i * db;
			const hw = h0 - i * dh;
			const top = bot - th;
			a.fill(dk, `M40 ${f(top)}L${pt(40 - hw, bot - 2.5)}Q${pt(40 - hw * 0.55, bot + 1)} 40 ${f(bot + 0.6)}Z`);
			b.fill(md, `M40 ${f(top)}L${pt(40 + hw, bot - 2.5)}Q${pt(40 + hw * 0.55, bot + 1)} 40 ${f(bot + 0.6)}Z`);
			s.stroke(silver, 0.7, `M${pt(40 - hw + 1, bot - 1.6)}Q${pt(40 - hw * 0.55, bot + 1.4)} ${pt(40, bot + 1)}Q${pt(40 + hw * 0.55, bot + 1.4)} ${pt(40 + hw - 1, bot - 1.6)}`);
		}
		return String(a) + b + s;
	};
	if (stage === "sprout") return line(40, 87, 40, 82, "#6a4a3a", 1.6) + draw(3, 83, 5, 7, 1.8, 9);
	if (stage === "leafy") return trunk(40, 40, 78, 3.6, 2.4, "#6a4a3a") + draw(6, 80, 7, 14, 1.8, 13);
	const cones = new Ink().fill("#8270b8", ellD(34, 31, 1.1, 2.4) + ellD(46, 30, 1.1, 2.4) + ellD(37, 22, 1.1, 2.2) + ellD(43, 15, 1, 2) + ellD(31, 39, 1.1, 2.4));
	return trunk(40, 40, 78, 5, 3, "#6a4a3a") + draw(8, 81, 8.6, 19, 2, 17) + cones;
}

function nobleFir(stage: GrowingStage): string {
	const g = ["#3d6b67", "#58897f", "#86aca4"] as const;
	const bark = "#7a6a5e";
	const draw = (n: number, y0: number, dy: number, h0: number, dh: number, th: number) => {
		const a = new Ink();
		const b = new Ink();
		const c = new Ink();
		for (let i = 0; i < n; i++) {
			const y = y0 - i * dy;
			const hw = h0 - i * dh;
			for (const s of [-1, 1]) {
				const d = `M40 ${f(y - th * 0.5)}L${pt(40 + s * hw, y - th)}Q${pt(40 + s * (hw + 1.6), y + th * 0.4)} ${pt(40 + s * (hw - 2), y + th * 0.5)}L40 ${f(y + th * 0.6)}Z`;
				(s < 0 ? a : b).fill(s < 0 ? g[0] : g[1], d);
			}
			c.stroke(g[2], 0.8, segD(40 - hw + 1.5, y - th * 0.9, 40 + hw - 1.5, y - th * 0.9));
		}
		return String(a) + b + c;
	};
	if (stage === "sprout") return line(40, 87, 40, 72, bark, 1.6) + draw(2, 80, 6, 7, 2, 3);
	if (stage === "leafy") return trunk(40, 40, 38, 3.6, 1.4, bark) + draw(4, 72, 9, 15, 3, 4) + draw(1, 42, 1, 5, 0, 3.4);
	const cones = new Ink().fill("#9fa65a", ellD(32, 31, 2.4, 5) + ellD(40, 22, 2.4, 5.2) + ellD(48, 30, 2.4, 5) + ellD(26, 40, 2.1, 4.2));
	const bract = new Ink().stroke("#d6cf98", 0.6, segD(30.4, 30, 33.6, 30) + segD(30.4, 32.6, 33.6, 32.6) + segD(38.4, 21, 41.6, 21) + segD(38.4, 23.6, 41.6, 23.6) + segD(46.4, 29, 49.6, 29) + segD(46.4, 31.6, 49.6, 31.6) + segD(24.6, 40, 27.4, 40));
	return trunk(40, 40, 16, 5.6, 1.8, bark) + draw(6, 78, 9, 24, 2.6, 5) + draw(1, 24, 1, 6, 0, 4) + cones + bract;
}

function koreanFir(stage: GrowingStage): string {
	const g = ["#2d5a3f", "#3f7550", "#7aa88a"] as const;
	const body = (top: number, bot: number, hw: number) => {
		const h = bot - top;
		const outer = `M40 ${f(top)}C${pt(40 + hw * 0.4, top + h * 0.12)} ${pt(40 + hw, top + h * 0.55)} ${pt(40 + hw, bot - 2)}Q40 ${f(bot + 3)} ${pt(40 - hw, bot - 2)}C${pt(40 - hw, top + h * 0.55)} ${pt(40 - hw * 0.4, top + h * 0.12)} 40 ${f(top)}Z`;
		let sc = "";
		for (let r = 0; r < 4; r++) {
			const y = top + h * (0.3 + r * 0.18);
			const w = hw * (0.5 + r * 0.14);
			sc += `M${pt(40 - w, y)}Q${pt(40 - w / 2, y + 2.4)} 40 ${f(y)}Q${pt(40 + w / 2, y + 2.4)} ${pt(40 + w, y)}`;
		}
		return path(outer, g[0]) + path(`M${f(42)} ${f(top + h * 0.12)}C${pt(40 + hw * 0.6, top + h * 0.3)} ${pt(40 + hw * 0.85, top + h * 0.6)} ${pt(40 + hw * 0.8, bot - 4)}L42 ${f(bot - 3)}Z`, g[1]) + strokeP(sc, g[2], 0.7);
	};
	if (stage === "sprout") return line(40, 87, 40, 82, "#6a4a3a", 1.6) + body(70, 83, 7);
	if (stage === "leafy") return trunk(40, 40, 80, 4, 3, "#6a4a3a") + body(44, 81, 15) + path(ellD(40, 47, 1.2, 2.4), "#5a4a9a");
	const cn = new Ink();
	const tip = new Ink();
	for (const [x, y] of [[40, 32], [33, 41], [47, 40], [27, 52], [40, 50], [53, 51], [22, 63], [33, 61], [47, 62], [58, 63], [28, 72], [52, 73], [40, 70]] as const) {
		cn.fill("#5a4a9e", ellD(x, y, 1.5, 3));
		tip.fill("#9a8cd6", ellD(x - 0.4, y - 1.6, 0.6, 1));
	}
	return trunk(40, 40, 82, 6, 4, "#6a4a3a") + body(24, 82, 27) + cn + tip;
}

function bristleconePine(stage: GrowingStage): string {
	const wood = "#d8cfc0";
	const live = "#7a5034";
	const g = ["#2c5638", "#4a7a50"] as const;
	const fox = (d: string[]) => strokeP(d.join(""), g[0], 4.6) + strokeP(d.join(""), g[1], 1.8);
	if (stage === "sprout") return stem([[40, 87], [41, 82], [38, 78], [40, 74]], live, 1.6) + fox(["M40 76Q40 72 42 68"]);
	if (stage === "leafy")
		return (
			stem([[40, 88], [44, 78], [34, 70], [40, 60]], live, 3.2) +
			stem([[38, 72], [32, 70], [28, 66], [26, 62]], live, 1.8) +
			fox(["M26 64Q24 58 27 52", "M40 62Q39 55 42 48", "M41 70Q48 68 52 60"]) +
			path(ellD(27.5, 50.5, 1.2, 1.8) + ellD(42.5, 46.5, 1.2, 1.8), "#5e3d63")
		);
	const cones = new Ink().fill("#5e3d63", ellD(17, 41, 1.5, 2.2) + ellD(66, 31, 1.5, 2.2) + ellD(45, 35, 1.4, 2));
	const body = "M26 87.6Q35 85 34 77Q32 68 37 61Q41 56 38 49L45 48Q47 56 44 62Q41 69 46 77Q49 85 56 87.6Z";
	const cracks = new Ink().stroke("#b3a894", 0.7, "M33 86Q37 80 36 74M39 66Q37 60 40 55M47 85Q44 80 44 74");
	return (
		strokeP("M39 52L33 40L26 28M33 40L30 38", wood, 2.4) +
		strokeP("M44 50L50 36L54 24M50 36L55 34", wood, 2) +
		path(body, wood) +
		cracks +
		strokeP("M45 87Q41 80 42 72Q45 62 42 52", live, 2.6) +
		stem([[37, 62], [30, 60], [24, 58], [19, 55]], live, 2.4) +
		stem([[43, 58], [50, 54], [56, 50], [62, 46]], live, 2.4) +
		fox(["M19 56Q13 50 17 43", "M62 48Q68 42 66 33", "M43 52Q42 44 45 37", "M26 59Q30 54 30 50"]) +
		cones
	);
}

function stonePine(stage: GrowingStage): string {
	const bark = "#9a6040";
	const g = ["#3c6a3a", "#50824a", "#6c9c5a"] as const;
	if (stage === "sprout") {
		const k = new Ink().stroke("#7fa8a0", 1, fanD(40, 76, 8, 11, -170, -10)).stroke("#9cc0b4", 1, fanD(40, 75, 5, 6, -150, -30));
		return line(40, 87, 40, 75, bark, 1.6) + k;
	}
	if (stage === "leafy") return trunk(40, 40, 60, 4, 2.4, bark) + clumps([[40, 60, 15, 11], [30, 64, 7, 5], [50, 64, 7, 5], [40, 52, 9, 6]], g);
	const fork = new Ink().stroke(bark, 3, segD(40, 52, 26, 28) + segD(40, 52, 55, 27) + segD(40, 48, 40, 28)).stroke(bark, 2, segD(33, 40, 16, 28) + segD(48, 40, 64, 28));
	const dome = path("M5 30Q7 11 40 9Q73 11 75 30Q40 35 5 30Z", g[0]) + path("M10 26Q14 14 40 12.5Q64 14 68 24Q40 27 10 26Z", g[1]) + path(ellD(26, 16, 7, 2) + ellD(46, 14, 7, 2) + ellD(60, 19, 4, 1.5), g[2]);
	const cones = new Ink().fill("#7a4e2e", ellD(20, 33.5, 2.4, 2.8) + ellD(56, 33.5, 2.4, 2.8) + ellD(40, 34.5, 2.4, 2.8));
	return trunk(40, 40, 50, 6, 4, bark) + fork + dome + cones;
}

function japaneseBlackPine(stage: GrowingStage): string {
	const bark = "#3e3633";
	const g = ["#1f3d2b", "#33603f"] as const;
	const candle = "#ece5cc";
	const tufts = (ts: readonly (readonly [number, number, number])[]) => {
		const a = new Ink();
		const b = new Ink();
		const c = new Ink();
		for (const [x, y, r] of ts) {
			a.stroke(g[0], 1.4, fanD(x, y, r, 11, -175, -5, r * 0.75));
			b.stroke(g[1], 1.2, fanD(x, y - 0.5, r * 0.65, 7, -160, -20, r * 0.55));
			c.stroke(candle, 1.6, segD(x - 1.2, y - r * 0.5, x - 1.5, y - r * 0.5 - 3.2) + segD(x + 1.3, y - r * 0.45, x + 1.6, y - r * 0.45 - 2.6));
		}
		return String(a) + b + c;
	};
	if (stage === "sprout") return line(40, 87, 40, 77, bark, 1.6) + tufts([[40, 78, 7]]);
	if (stage === "leafy")
		return stem([[40, 88], [36, 76], [48, 66], [44, 54]], bark, 3) + stem([[39, 72], [34, 70], [30, 68], [26, 67]], bark, 1.6) + tufts([[26, 68, 8], [46, 56, 8], [51, 66, 6]]) + line(44, 68, 51, 67, bark, 1.4);
	const br = new Ink().stroke(bark, 2.6, segD(36, 66, 16, 60)).stroke(bark, 2.2, segD(47, 50, 66, 44) + segD(45, 40, 28, 33));
	return stem([[34, 88], [28, 68], [54, 54], [46, 26]], bark, 5) + br + tufts([[14, 61, 8], [23, 62, 7], [66, 45, 9], [58, 46, 6], [28, 34, 8], [35, 36, 6], [46, 27, 9]]);
}

function westernRedCedar(stage: GrowingStage): string {
	const bark = "#a0502e";
	const g = ["#4f7d34", "#6e9c44", "#9cc266"] as const;
	const draw = (n: number, y0: number, dy: number, h0: number, dh: number, th: number) => {
		const a = new Ink();
		const b = new Ink();
		const c = new Ink();
		for (let i = 0; i < n; i++) {
			const y = y0 - i * dy;
			const hw = h0 - i * dh;
			for (const s of [-1, 1]) {
				const d = `M${pt(40, y - th)}Q${pt(40 + s * hw * 0.5, y + 1)} ${pt(40 + s * hw, y - 3.5)}Q${pt(40 + s * hw * 0.6, y + th + 3)} ${pt(40, y + th)}Z`;
				(s < 0 ? a : b).fill(s < 0 ? g[0] : g[1], d);
				c.fill(g[2], featherD(40 + s * hw * 0.96, y - 3.2, s > 0 ? -38 : -142, hw * 0.22 + 1.6, 1.3, 3));
			}
		}
		const top = y0 - (n - 1) * dy - th;
		return String(a) + b + path(`M40 ${f(top - 7)}L${f(41.5)} ${f(top + 1)}L${f(38.5)} ${f(top + 1)}Z`, g[1]) + c;
	};
	if (stage === "sprout") return line(40, 87, 40, 82, bark, 1.6) + draw(3, 80, 4.5, 7, 1.5, 2);
	if (stage === "leafy") return trunk(40, 40, 72, 4, 2.4, bark) + draw(6, 72, 6.4, 15, 1.8, 3);
	const flutes = new Ink().stroke("#7c3a20", 0.8, segD(35.5, 86, 38.4, 74) + segD(44.5, 86, 41.6, 74));
	return trunk(40, 40, 70, 12, 3.4, bark) + flutes + draw(10, 73, 6.5, 28, 2.5, 3.6);
}

function leylandCypress(stage: GrowingStage): string {
	const g = ["#3d5f46", "#55785a", "#76966f"] as const;
	const body = (top: number, bot: number, hw: number, r: number, n: number) => {
		const h = bot - top;
		const env = (t: number) => hw * Math.min(1, 0.3 + t * 1.15);
		const m = 7;
		const side = (s: number) => {
			let d = "";
			const ks = s < 0 ? Array.from({ length: m }, (_, i) => i + 1) : Array.from({ length: m }, (_, i) => m - 1 - i);
			for (const k of ks) {
				const t0 = s < 0 ? (k - 1) / m : (k + 1) / m;
				const t1 = k / m;
				const tm = (t0 + t1) / 2;
				const cx = 40 + s * (env(tm) + r * 0.7);
				const end = k === 0 ? `40 ${f(top)}` : pt(40 + s * env(t1), top + h * t1);
				d += `Q${pt(cx, top + h * tm)} ${end}`;
			}
			return d;
		};
		const outer = `M40 ${f(top)}${side(-1)}Q40 ${f(bot + 2)} ${pt(40 + env(1), bot)}${side(1)}Z`;
		const b = new Ink();
		const c = new Ink();
		for (const [x, y] of scatter(40 + hw * 0.1, top + h * 0.55, hw * 0.65, h * 0.4, n)) b.fill(g[1], ellD(x, y, r * 1.1, r * 0.55));
		for (const [x, y] of scatter(37, top + h * 0.45, hw * 0.4, h * 0.3, Math.ceil(n / 3))) c.fill(g[2], ellD(x, y, r * 0.45, r * 0.3));
		return path(outer, g[0]) + b + c;
	};
	if (stage === "sprout") return line(40, 87, 40, 82, "#6a5040", 1.6) + body(66, 84, 6, 2, 4);
	if (stage === "leafy") return trunk(40, 40, 80, 4, 3, "#6a5040") + body(36, 82, 12, 3.4, 9);
	return trunk(40, 40, 80, 6, 4, "#6a5040") + body(5, 82, 22, 4.6, 16) + path(circD(30, 50, 1.4) + circD(50, 40, 1.4) + circD(44, 64, 1.4) + circD(26, 70, 1.4) + circD(54, 72, 1.4), "#7a5a3a");
}

function arborvitae(stage: GrowingStage): string {
	const g = ["#2e7844", "#46944f", "#6bb066"] as const;
	const fan = (x: number, y: number, r: number) => `M${pt(x, y)}L${pt(x - r * 0.6, y - r * 0.7)}L${pt(x - r * 0.2, y - r * 0.62)}L${pt(x, y - r)}L${pt(x + r * 0.2, y - r * 0.62)}L${pt(x + r * 0.6, y - r * 0.7)}Z`;
	const body = (top: number, bot: number, hw: number, r: number) => {
		const h = bot - top;
		const outer = `M40 ${f(top)}C${pt(40 + hw * 0.7, top + h * 0.12)} ${pt(40 + hw * 1.05, top + h * 0.45)} ${pt(40 + hw, top + h * 0.75)}C${pt(40 + hw * 0.92, bot - 1)} ${pt(40 + hw * 0.4, bot)} 40 ${f(bot)}C${pt(40 - hw * 0.4, bot)} ${pt(40 - hw * 0.92, bot - 1)} ${pt(40 - hw, top + h * 0.75)}C${pt(40 - hw * 1.05, top + h * 0.45)} ${pt(40 - hw * 0.7, top + h * 0.12)} 40 ${f(top)}Z`;
		const b = new Ink();
		const c = new Ink();
		const rows = Math.round(h / (r * 1.15));
		for (let i = 0; i < rows; i++) {
			const t = (i + 0.8) / (rows + 0.6);
			const y = top + h * t + r * 0.5;
			const w = hw * Math.sin(Math.PI * Math.min(0.95, 0.15 + t * 0.85)) * 0.7;
			const cols = Math.max(1, Math.round((2 * w) / (r * 1.2)));
			for (let j = 0; j < cols; j++) {
				const x = cols === 1 ? 40 : 40 - w + (2 * w * j) / (cols - 1) + (i % 2 ? r * 0.3 : -r * 0.3);
				((i + j) % 3 === 0 ? c : b).fill((i + j) % 3 === 0 ? g[2] : g[1], fan(x, y, r));
			}
		}
		return path(outer, g[0]) + b + c;
	};
	if (stage === "sprout") return line(40, 87, 40, 76, "#6a4a3a", 1.2) + path(fan(40, 78, 7) + fan(37, 83, 5) + fan(43, 84, 5), g[1]);
	if (stage === "leafy") return trunk(40, 40, 82, 3, 2, "#6a4a3a") + body(42, 84, 10, 4);
	return trunk(40, 40, 82, 4.4, 3, "#6a4a3a") + body(12, 85, 15, 4.6) + path(ellD(37, 20, 1, 1.8) + ellD(43, 22, 1, 1.8) + ellD(40, 16, 0.9, 1.6) + ellD(35, 27, 1, 1.8), "#b08a5a");
}

function umbrellaPine(stage: GrowingStage): string {
	const g = ["#2a5f33", "#4a8a40", "#8cbe5e"] as const;
	const bark = "#7a5a46";
	const whorls = (ws: readonly (readonly [number, number])[]) => {
		const back = new Ink();
		const front = new Ink();
		const tip = new Ink();
		for (const [y, r] of ws) {
			const n = 13;
			for (let i = 0; i < n; i++) {
				const a = (i / n) * Math.PI * 2 + 0.2;
				const x2 = 40 + Math.cos(a) * r;
				const y2 = y + Math.sin(a) * r * 0.38;
				(Math.sin(a) < 0 ? back : front).stroke(Math.sin(a) < 0 ? g[0] : g[1], 1.6, segD(40, y, x2, y2));
				if (Math.sin(a) >= 0 && i % 2 === 0) tip.fill(g[2], circD(x2, y2, 0.7));
			}
		}
		return String(back) + front + tip;
	};
	if (stage === "sprout") return line(40, 87, 40, 74, bark, 1.4) + whorls([[80, 6], [74, 4.4]]);
	if (stage === "leafy") return trunk(40, 40, 42, 3, 1.2, bark) + whorls([[76, 14], [68, 12], [60, 10], [52, 8], [45, 5.5]]);
	const cones = path(ellD(31, 29, 2.2, 3.2) + ellD(50, 37, 2.2, 3.2), "#8a8a52");
	return trunk(40, 40, 10, 5, 1.4, bark) + whorls([[80, 22], [72, 21], [64, 19], [56, 17], [48, 15], [40, 12.5], [32, 10], [24, 7.5], [16, 5]]) + cones;
}

function wollemiPine(stage: GrowingStage): string {
	const bark = "#5a4636";
	const bub = "#8a745c";
	const g = ["#3d6a3a", "#5c8c4c"] as const;
	const fronds = (fs: readonly (readonly [number, number, number, number, number])[]) => {
		const br = new Ink();
		const a = new Ink();
		fs.forEach(([x, y, s, L, fl], i) => {
			const tx = x + s * L;
			br.stroke(bark, 1.1, segD(x, y, tx, y - 2));
			a.fill(i % 2 ? g[1] : g[0], featherD(tx, y - 2, s > 0 ? 80 : 100, fl, 2.4, 4));
		});
		return String(br) + a;
	};
	const bubbles = (pts: readonly (readonly [number, number])[]) => path(pts.map(([x, y]) => circD(x, y, 0.75)).join(""), bub);
	if (stage === "sprout") return line(40, 87, 40, 70, bark, 1.6) + fronds([[40, 77, -1, 4, 7], [40, 73, 1, 4, 7]]) + path(featherD(40, 71, -90, 4, 1.6, 3), g[1]);
	if (stage === "leafy") {
		const fs: [number, number, number, number, number][] = [];
		for (let i = 0; i < 5; i++) fs.push([39.5, 72 - i * 7, i % 2 ? 1 : -1, 6 - i * 0.6, 12 - i]);
		return stem([[40, 88], [40, 70], [39, 50], [39.5, 36]], bark, 2.6) + fronds(fs) + bubbles([[40, 82], [39.8, 70], [39.3, 58]]) + path(featherD(39.5, 38, -90, 5, 1.8, 3), g[1]);
	}
	const fs: [number, number, number, number, number][] = [];
	for (let i = 0; i < 9; i++) fs.push([33.5, 74 - i * 7.2, -1, 7 + (i % 3) * 2 - i * 0.4, 13 - i * 0.3]);
	for (let i = 0; i < 8; i++) fs.push([44.5, 71 - i * 7.2, 1, 6 + (i % 2) * 3 - i * 0.3, 13 - i * 0.3]);
	const trunks = stem([[34, 88], [34, 60], [33, 30], [33.5, 10]], bark, 3) + stem([[42, 88], [44, 60], [44.5, 30], [44.5, 16]], bark, 2.6) + stem([[38, 88], [39, 78], [39, 66], [39, 56]], bark, 1.8);
	const cones = path(circD(24.5, 31, 2.3) + circD(54, 33, 2.3) + circD(26, 55, 2.1), "#8fa84c") + path(ellD(52, 51.5, 1, 2.4) + ellD(23, 69, 1, 2.4), "#a0683a");
	return (
		trunks +
		bubbles([[34, 80], [34, 66], [33.6, 50], [33.5, 36], [43, 82], [44, 64], [44.5, 46], [44.5, 30], [39, 72]]) +
		fronds(fs) +
		path(featherD(33.5, 12, -90, 6, 1.8, 3) + featherD(44.5, 18, -90, 6, 1.8, 3), g[1]) +
		cones
	);
}

export const SPECIES: Species[] = [
	{ id: "scots-pine", name: "Scots pine", draw: scotsPine },
	{ id: "douglas-fir", name: "Douglas fir", draw: douglasFir },
	{ id: "norway-spruce", name: "Norway spruce", draw: norwaySpruce },
	{ id: "colorado-blue-spruce", name: "Colorado blue spruce", draw: coloradoBlueSpruce },
	{ id: "european-larch", name: "European larch", draw: europeanLarch },
	{ id: "cedar-of-lebanon", name: "Cedar of Lebanon", draw: cedarOfLebanon },
	{ id: "deodar-cedar", name: "Deodar cedar", draw: deodarCedar },
	{ id: "blue-atlas-cedar", name: "Blue Atlas cedar", draw: blueAtlasCedar },
	{ id: "english-yew", name: "English yew", draw: englishYew },
	{ id: "monkey-puzzle", name: "Monkey puzzle", draw: monkeyPuzzle },
	{ id: "giant-sequoia", name: "Giant sequoia", draw: giantSequoia },
	{ id: "dawn-redwood", name: "Dawn redwood", draw: dawnRedwood },
	{ id: "bald-cypress", name: "Bald cypress", draw: baldCypress },
	{ id: "eastern-hemlock", name: "Eastern hemlock", draw: easternHemlock },
	{ id: "fraser-fir", name: "Fraser fir", draw: fraserFir },
	{ id: "noble-fir", name: "Noble fir", draw: nobleFir },
	{ id: "korean-fir", name: "Korean fir", draw: koreanFir },
	{ id: "bristlecone-pine", name: "Bristlecone pine", draw: bristleconePine },
	{ id: "stone-pine", name: "Stone pine", draw: stonePine },
	{ id: "japanese-black-pine", name: "Japanese black pine", draw: japaneseBlackPine },
	{ id: "western-red-cedar", name: "Western red cedar", draw: westernRedCedar },
	{ id: "leyland-cypress", name: "Leyland cypress", draw: leylandCypress },
	{ id: "arborvitae", name: "Arborvitae", draw: arborvitae },
	{ id: "japanese-umbrella-pine", name: "Japanese umbrella pine", draw: umbrellaPine },
	{ id: "wollemi-pine", name: "Wollemi pine", draw: wollemiPine },
];
