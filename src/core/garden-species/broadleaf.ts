/**
 * Deciduous broadleaf trees: 25 species in the garden's flat style (see
 * kit.ts). Each grows from a sapling (sprout) to a young tree (leafy) to its
 * signature fullest form (bloom): autumn colour, candles, catkins, keys,
 * seed balls, pods, berries or its typical silhouette.
 */
import { GREEN, f, line, stem, type GrowingStage, type Species } from "./kit";

/* ---------------- private helpers ---------------- */

const path = (d: string, fill: string): string => `<path d="${d}" fill="${fill}"/>`;

function ell(x: number, y: number, rx: number, ry: number, fill: string, rot = 0): string {
	const t = rot ? ` transform="rotate(${f(rot)} ${f(x)} ${f(y)})"` : "";
	return `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(rx)}" ry="${f(ry)}" fill="${fill}"${t}/>`;
}

/** A tapered trunk from the ground at x0 (width w0, flared foot) to (x1, y1) (width w1). */
function trunk(x0: number, x1: number, y1: number, w0: number, w1: number, fill: string): string {
	const y0 = 87.5;
	const fl = w0 * 0.35;
	return path(
		`M${f(x0 - w0 / 2 - fl)} ${y0}Q${f(x0 - w0 / 2)} ${f(y0 - 1)} ${f(x0 - w0 / 2)} ${f(y0 - 4)}L${f(x1 - w1 / 2)} ${f(y1)}L${f(x1 + w1 / 2)} ${f(y1)}L${f(x0 + w0 / 2)} ${f(y0 - 4)}Q${f(x0 + w0 / 2)} ${f(y0 - 1)} ${f(x0 + w0 / 2 + fl)} ${y0}Z`,
		fill,
	);
}

type Pt = readonly [number, number];

/** Maps local coordinates (u along, v across) at (x, y) rotated by deg to a point. */
function mapper(x: number, y: number, deg: number): (u: number, v: number) => Pt {
	const c = Math.cos((deg * Math.PI) / 180);
	const s = Math.sin((deg * Math.PI) / 180);
	return (u, v) => [x + c * u - s * v, y + s * u + c * v];
}

const r1 = (n: number): number => Math.round(n * 10) / 10;
const num = (n: number): string => f(n).replace(/^(-?)0\./, "$1.");

/** Compact path data: an absolute start, then relative segments (repeated commands implicit). */
function rel(start: Pt, segments: readonly (readonly [string, readonly Pt[]])[], close = true): string {
	let cx = r1(start[0]);
	let cy = r1(start[1]);
	let out = `M${num(cx)} ${num(cy)}`;
	let prev = "";
	for (const [c, ps] of segments) {
		out += (c === prev ? " " : c) + ps.map(([x, y]) => `${num(r1(x) - cx)} ${num(r1(y) - cy)}`).join(" ");
		prev = c;
		const last = ps[ps.length - 1] ?? [cx, cy];
		cx = r1(last[0]);
		cy = r1(last[1]);
	}
	return (out + (close ? "z" : "")).replace(/ -/g, "-").replace(/(\.\d+) \./g, "$1.");
}

/** A closed polygon through points. */
const poly = (ps: readonly Pt[]): string => rel(ps[0] ?? [0, 0], ps.slice(1).map((p) => ["l", [p]] as const));

/** Merges path data per fill (or per stroke) into one <path> each, in first-seen order. Dots (from dotD) become round-capped zero-length strokes. */
class Ink {
	private parts = new Map<string, string>();
	private n = 0;
	add(fill: string, d: string): this {
		const rest = d.replace(/D([^,]+),([^,]+),([^;]+);/g, (_, x: string, y: string, r: string) => {
			this.stroke(fill, Number(r) * 2, `M${x} ${y}h0`);
			return "";
		});
		if (rest) this.parts.set(fill, (this.parts.get(fill) ?? "") + rest);
		return this;
	}
	/** A stroked path; key carries colour and width. */
	stroke(color: string, w: number, d: string): this {
		const k = `s${num(w)}|${color}`;
		this.parts.set(k, (this.parts.get(k) ?? "") + d);
		return this;
	}
	/** Raw markup at this point in the paint order (a crown base between limbs and leaves). */
	raw(markup: string): this {
		this.parts.set(`r${this.n++}`, markup);
		return this;
	}
	toString(): string {
		return [...this.parts]
			.map(([k, d]) => {
				if (k.startsWith("r")) return d;
				if (!k.startsWith("s")) return path(d, k);
				const [w, c] = k.slice(1).split("|");
				return `<path d="${d}" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
			})
			.join("");
	}
}

/** Fills through Ink (so dots work outside a crown too). */
const paint = (d: string, fill: string): string => new Ink().add(fill, d).toString();

/** A polygon through local (u, v) points (fractions of len, w), mirrored across the midrib. */
function mirrored(x: number, y: number, deg: number, len: number, w: number, pts: readonly Pt[]): string {
	const P = mapper(x, y, deg);
	return poly([P(0, 0), ...pts.map(([u, v]) => P(u * len, -v * w)), ...[...pts].reverse().slice(1).map(([u, v]) => P(u * len, v * w))]);
}

/** A leaf outline in absolute coordinates: 1 pointed lens, 0 oval. */
function lensD(x: number, y: number, deg: number, len: number, w: number, shape: 0 | 1 = 1): string {
	const P = mapper(x, y, deg);
	const [a, b, c] = shape === 1 ? [0.45, 1.15, 0.5] : [0.3, 1, 1];
	return rel(P(0, 0), [["c", [P(len * a, -w * b), P(len * 0.8, -w * c), P(len, 0)]], ["c", [P(len * 0.8, w * c), P(len * a, w * b), P(0, 0)]]]);
}

/** A heart-shaped leaf, notched at the stalk. */
function heartD(x: number, y: number, deg: number, len: number, w: number): string {
	const P = mapper(x, y, deg);
	return rel(P(len * 0.14, 0), [["c", [P(-len * 0.12, -w * 1.45), P(len * 0.78, -w * 1.25), P(len, 0)]], ["c", [P(len * 0.78, w * 1.25), P(-len * 0.12, w * 1.45), P(len * 0.14, 0)]]]);
}

/** A palmate leaf centred at (x, y) with n pointed lobes, opening upward at rot 0. */
function palmD(x: number, y: number, r: number, n: number, rot = 0, inner = 0.42): string {
	const spread = 250;
	const start = -90 - spread / 2;
	const step = spread / (n - 1);
	const P = mapper(x, y, rot);
	const at = (deg: number, rad: number) => P(Math.cos((deg * Math.PI) / 180) * rad, Math.sin((deg * Math.PI) / 180) * rad);
	const ps: Pt[] = [P(0, r * 0.12)];
	for (let i = 0; i < n; i++) {
		if (i > 0) ps.push(at(start + step * (i - 0.5), r * inner));
		ps.push(at(start + step * i, r));
	}
	return poly(ps);
}

/** A dot token, merged by Ink into a round-capped stroke of its colour. */
const dotD = (x: number, y: number, r: number): string => `D${num(r1(x))},${num(r1(y))},${num(r1(r))};`;

/** Points spread evenly over an ellipse (sunflower spiral), deterministic. */
function scatter(cx: number, cy: number, rx: number, ry: number, n: number): [number, number, number][] {
	const out: [number, number, number][] = [];
	for (let i = 0; i < n; i++) {
		const a = i * 2.39996;
		const r = Math.sqrt((i + 0.5) / n);
		out.push([cx + Math.cos(a) * r * rx, cy + Math.sin(a) * r * ry, a]);
	}
	return out;
}

type LeafD = (x: number, y: number, deg: number, i: number) => string;

/** Leaves scattered over an ellipse, each pointing outward from its centre, merged per colour into `ink`. */
function crown(ink: Ink, cx: number, cy: number, rx: number, ry: number, n: number, pal: readonly string[], d: LeafD, keep?: (x: number, y: number) => boolean): Ink {
	scatter(cx, cy, rx, ry, n).forEach(([x, y], i) => {
		if (keep && !keep(x, y)) return;
		const dx = x - cx;
		const dy = y - cy;
		const out = dx * dx + dy * dy > 4 ? (Math.atan2(dy, dx) * 180) / Math.PI : -90;
		ink.add(pal[i % pal.length] ?? GREEN.leaf, d(x, y, out + ((i * 53) % 50) - 25, i));
	});
	return ink;
}

/** A pinnate leaf: a curving rachis with paired leaflets (two tones) and a tip leaflet. */
function pinnate(ink: Ink, x: number, y: number, deg: number, len: number, bend: number, leaflet: number, rib: string, a: string, b: string, n = 7): Ink {
	const step = len / n;
	let ang = (deg * Math.PI) / 180;
	let px = x;
	let py = y;
	const pts: Pt[] = [];
	for (let j = 1; j <= n; j++) {
		ang += (bend * Math.PI) / 180 / n;
		px += Math.cos(ang) * step;
		py += Math.sin(ang) * step;
		pts.push([px, py]);
		const ad = (ang * 180) / Math.PI;
		if (j >= 2 && j < n) ink.add(a, qlens(px, py, ad - 60, leaflet, leaflet * 0.3)).add(b, qlens(px, py, ad + 60, leaflet, leaflet * 0.3));
		if (j === n) ink.add(a, qlens(px, py, ad, leaflet, leaflet * 0.3));
	}
	return ink.stroke(rib, 0.9, rel([x, y], pts.map((p) => ["l", [p]] as const), false));
}
/** Straight segments as one stroked subpath list: [x1, y1, x2, y2][]. */
const segs = (ls: readonly (readonly number[])[]): string => ls.map(([a, b, c, d]) => `M${f(a ?? 0)} ${f(b ?? 0)}L${f(c ?? 0)} ${f(d ?? 0)}`).join("");

/** A cubic limb as subpath data. */
const limbD = (p: readonly (readonly [number, number])[]): string => `M${p.map(([x, y], i) => (i === 1 ? "C" : "") + `${f(x)} ${f(y)}`).join(" ")}`;

/** A sapling: a thin stem with leaves drawn at its top by `top(x, y)`. */
function sapling(h: number, top: (x: number, y: number) => string, color: string, w = 1.8): string {
	return line(40, 87, 40, 87 - h, color, w) + top(40, 87 - h);
}

/** An egg-shaped crown outline, pointed at the top. */
function ovoid(cx: number, top: number, bot: number, hw: number): string {
	const h = bot - top;
	return `M${f(cx)} ${f(top)}C${f(cx + hw * 0.9)} ${f(top + h * 0.04)} ${f(cx + hw * 1.05)} ${f(top + h * 0.5)} ${f(cx + hw * 0.95)} ${f(top + h * 0.72)}C${f(cx + hw * 0.85)} ${f(bot)} ${f(cx - hw * 0.85)} ${f(bot)} ${f(cx - hw * 0.95)} ${f(top + h * 0.72)}C${f(cx - hw * 1.05)} ${f(top + h * 0.5)} ${f(cx - hw * 0.9)} ${f(top + h * 0.04)} ${f(cx)} ${f(top)}Z`;
}

/** A hanging samara pair (maple key) at (x, y). */
function samara(ink: Ink, x: number, y: number, fill: string, seedFill: string): Ink {
	return ink.add(fill, lensD(x, y, 62, 5, 1.6, 0) + lensD(x, y, 118, 5, 1.6, 0)).add(seedFill, dotD(x, y + 0.6, 1));
}

/** A slim pointed leaflet from two quadratic arcs (compact). */
function qlens(x: number, y: number, deg: number, len: number, w: number): string {
	const P = mapper(x, y, deg);
	return rel(P(0, 0), [["q", [P(len * 0.45, -w * 2), P(len, 0)]], ["q", [P(len * 0.55, w * 2), P(0, 0)]]]);
}

/** A lumpy crown outline: an ellipse arc (degrees from..to) of n outward bumps, closed straight. */
function cloudD(cx: number, cy: number, rx: number, ry: number, n: number, bump = 0.12, from = 0, to = 360): string {
	const pt = (deg: number, k: number): Pt => [cx + Math.cos((deg * Math.PI) / 180) * rx * k, cy + Math.sin((deg * Math.PI) / 180) * ry * k];
	const step = (to - from) / n;
	const segments: (readonly [string, readonly Pt[]])[] = [];
	for (let i = 1; i <= n; i++) segments.push(["q", [pt(from + step * (i - 0.5), 1 + bump * 2), pt(from + step * i, 1)]]);
	return rel(pt(from, 1), segments);
}

/* ---------------- species ---------------- */

const MAPLE_BARK = "#6f6156";

function sugarMaple(stage: GrowingStage): string {
	const mp = (x: number, y: number, deg: number, r: number) => palmD(x, y, r, 5, deg + 90, 0.52);
	if (stage === "sprout") return sapling(16, (x, y) => path(mp(x - 5.5, y + 3, -140, 5.5) + mp(x + 5.5, y + 3, -40, 5.5), GREEN.leaf) + path(mp(x, y - 2, -90, 4.6), GREEN.light), MAPLE_BARK, 1.6);
	if (stage === "leafy") {
		const ink = crown(new Ink().raw(path(cloudD(40, 49, 14, 15, 9, 0.1), GREEN.dark)), 40, 49, 13, 13, 18, [GREEN.leaf, GREEN.light, GREEN.leaf, "#e39a34"], (x, y, d) => mp(x, y, d, 4.4));
		return trunk(40, 40, 58, 5, 3, MAPLE_BARK) + ink;
	}
	const ink = new Ink().stroke(MAPLE_BARK, 2.6, limbD([[40, 66], [34, 58], [26, 52], [20, 44]]) + limbD([[40, 62], [46, 54], [54, 50], [60, 42]])).raw(path(cloudD(40, 38, 24, 27, 12, 0.08), "#b5481e"));
	crown(ink, 40, 38, 22, 25, 36, ["#e0762a", "#f0a02c", "#f6c544", "#d65a22"], (x, y, d) => mp(x, y, d, 5.4));
	const ground = new Ink().add("#e9932c", mp(16, 83.5, 20, 3.2) + mp(66, 84.5, -30, 3.2)).add("#f3bf3e", mp(23, 85.5, -10, 2.8));
	return trunk(40, 40, 52, 9, 5, MAPLE_BARK) + ink + ground;
}
function redMaple(stage: GrowingStage): string {
	const gb = "#8d8a86";
	const tl = (x: number, y: number, deg: number, r: number) => palmD(x, y, r, 3, deg + 90, 0.55);
	const key = (ink: Ink, x: number, y: number) => ink.add("#ef9a7c", lensD(x, y, 70, 6, 1.3) + lensD(x, y, 110, 6, 1.3)).add("#8e2a22", dotD(x, y + 0.4, 1));
	if (stage === "sprout") return sapling(17, (x, y) => path(tl(x - 5, y + 3, -140, 5) + tl(x + 5, y + 3, -40, 5), "#7aae4c") + path(tl(x, y - 2, -90, 4.2), "#c94a3a"), "#a13c30", 1.6);
	if (stage === "leafy") {
		const ink = crown(new Ink().raw(path(cloudD(40, 47, 10, 16, 9, 0.08), GREEN.dark)), 40, 47, 9, 15, 16, [GREEN.leaf, GREEN.light, "#c94a3a"], (x, y, d) => tl(x, y, d, 4.2));
		return trunk(40, 40, 60, 4.5, 2.6, gb) + ink;
	}
	const ink = crown(new Ink().raw(path(cloudD(40, 35, 17, 27, 11, 0.08), "#7e1c1c")), 40, 35, 16, 25, 32, ["#c62828", "#dd4430", "#ea6440", "#a82222"], (x, y, d) => tl(x, y, d, 5));
	[[27, 58], [53, 60], [34, 64], [46, 65], [24, 46], [57, 44]].forEach(([x, y]) => key(ink, x ?? 0, y ?? 0));
	return trunk(40, 40, 58, 7, 4, gb) + ink;
}
function europeanBeech(stage: GrowingStage): string {
	const bk = "#9b978d";
	const pal = ["#4f8f3a", "#6aa648", "#86bd5c", "#5a9a40", "#b07a3a"] as const;
	const oval = (x: number, y: number, d: number) => lensD(x, y, d, 5.2, 2.2, 0);
	const inDome = (cx: number, cy: number, rx: number, ry: number) => (x: number, y: number) => y < cy - 1 && ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1;
	const husk = (ink: Ink, x: number, y: number) => {
		ink.add("#7a4a26", [45, 135, 225, 315].map((a) => qlens(x, y, a, 3.4, 1.1)).join(""));
		ink.add("#c08a50", dotD(x - 0.6, y - 0.4, 0.9) + dotD(x + 0.7, y + 0.3, 0.9));
	};
	if (stage === "sprout") return sapling(15, (x, y) => path(lensD(x, y + 2, -150, 8, 3.6, 0) + lensD(x, y + 2, -30, 8, 3.6, 0), "#c47a3a") + path(lensD(x, y, -105, 6, 2.6, 0) + lensD(x, y, -75, 6, 2.6, 0), pal[1]), bk, 1.8);
	if (stage === "leafy") {
		const ink = crown(new Ink().raw(path(cloudD(40, 72, 20, 38, 9, 0.06, 180, 360), "#2f6a2c")), 40, 54, 17, 17, 26, pal.slice(0, 4), oval, inDome(40, 72, 19, 36));
		return trunk(40, 40, 70, 6, 4, bk) + ink;
	}
	const ink = crown(new Ink().raw(path(cloudD(40, 72, 35, 64, 15, 0.05, 178, 362), "#2f6a2c")), 40, 42, 32, 31, 56, pal, oval, inDome(40, 72, 33, 61));
	[[22, 62], [56, 58], [34, 48], [50, 34], [28, 34], [46, 66]].forEach(([x, y]) => husk(ink, x ?? 0, y ?? 0));
	return trunk(40, 40, 64, 12, 7, bk) + path("M31 82Q34 78 36 72L38 72Q36 80 31 82ZM49 82Q46 78 44 72L42 72Q44 80 49 82Z", "#85817a") + ink;
}
function horseChestnut(stage: GrowingStage): string {
	const hc = (x: number, y: number, deg: number, r: number, n = 7) => {
		let d = "";
		const h = (n - 1) / 2;
		for (let k = -h; k <= h; k++) d += qlens(x, y, deg + k * 26, r * (1 - Math.abs(k) * 0.14), r * 0.24);
		return d;
	};
	const candle = (ink: Ink, x: number, y: number, h: number) => {
		ink.add("#f6f0e2", rel([x - 2.5, y], [["q", [[x - 2.2, y - h * 0.5], [x, y - h]]], ["q", [[x + 2.2, y - h * 0.5], [x + 2.5, y]]]]));
		ink.add("#e06a7c", dotD(x - 0.8, y - h * 0.3, 0.55) + dotD(x + 0.9, y - h * 0.55, 0.5));
		ink.add("#f0c44a", dotD(x + 0.6, y - h * 0.18, 0.5));
	};
	if (stage === "sprout") return sapling(15, (x, y) => path(hc(x, y, -90, 9, 5), GREEN.leaf) + path(hc(x, y + 6, -170, 5, 3) + hc(x, y + 6, -10, 5, 3), GREEN.light), "#7a5a40", 1.8);
	if (stage === "leafy") {
		const ink = crown(new Ink().raw(path(cloudD(40, 50, 14, 14, 8, 0.1), "#2c5e2e")), 40, 50, 11, 11, 8, ["#3f7f39", "#5a9a48"], (x, y, d) => hc(x, y, d, 6.5));
		return trunk(40, 40, 62, 5, 3, "#7a5a40") + ink;
	}
	const ink = crown(new Ink().raw(path(cloudD(40, 38, 26, 24, 13, 0.08), "#2c5e2e")), 40, 38, 22, 20, 17, ["#3f7f39", "#5a9a48"], (x, y, d) => hc(x, y, d, 8, 5));
	[[26, 44], [38, 30], [52, 38], [46, 52], [30, 58], [56, 56], [20, 34], [60, 26], [40, 16], [34, 46]].forEach(([x, y]) => candle(ink, x ?? 0, y ?? 0, 8));
	return trunk(40, 40, 60, 10, 5, "#7a5a40") + ink;
}
function linden(stage: GrowingStage): string {
	const lb = "#7a6656";
	const pal = ["#5a9a4a", "#76b05a", "#4f8c40"] as const;
	const hl = (x: number, y: number, d: number) => heartD(x, y, d, 6, 3.2);
	const bloomer = (ink: Ink, x: number, y: number) => {
		ink.add("#dfe2a2", lensD(x, y, 70, 7, 1.4, 0));
		ink.stroke("#9aa25a", 0.6, `M${f(x)} ${f(y)}L${f(x - 1.2)} ${f(y + 5)}`);
		ink.add("#f3df72", dotD(x - 1.2, y + 5.6, 1) + dotD(x - 2.8, y + 6.6, 0.9) + dotD(x + 0.4, y + 6.8, 0.9) + dotD(x - 1.3, y + 7.8, 0.85));
	};
	if (stage === "sprout") return sapling(16, (x, y) => path(heartD(x, y + 2, -150, 8, 4) + heartD(x, y + 2, -30, 8, 4), pal[0]) + path(heartD(x, y, -90, 6, 3), pal[1]), lb, 1.6);
	if (stage === "leafy") {
		const ink = crown(new Ink(), 40, 50, 12, 14, 16, pal, hl);
		return trunk(40, 40, 64, 4.5, 3, lb) + path(ovoid(40, 32, 68, 15), "#3f7a3c") + ink;
	}
	const ink = crown(new Ink(), 40, 37, 20, 24, 32, pal, hl);
	[[26, 46], [52, 42], [36, 54], [46, 28], [30, 30], [56, 56], [22, 58], [42, 40]].forEach(([x, y]) => bloomer(ink, x ?? 0, y ?? 0));
	return trunk(40, 40, 62, 8, 4.5, lb) + path(ovoid(40, 6, 68, 25), "#3f7a3c") + ink;
}

function ash(stage: GrowingStage): string {
	const ab = "#8e877c";
	const rib = "#3f6a32";
	const la = "#7ab45a";
	const lb2 = "#5e9a48";
	const base = "#457f38";
	const keys = (ink: Ink, x: number, y: number) => {
		ink.stroke("#8a7a50", 0.6, `M${f(x)} ${f(y - 2)}l0 2`);
		[[-1.4, 0, 84], [0, 0.6, 90], [1.4, 0, 96], [-0.6, 1.4, 88], [0.8, 1.4, 93]].forEach(([dx, dy, a], i) => ink.add(i % 2 ? "#b8955a" : "#d8bc7c", lensD(x + (dx ?? 0), y + (dy ?? 0), a ?? 90, 7, 1, 1)));
	};
	if (stage === "sprout") {
		const ink = new Ink();
		pinnate(ink, 40, 73, -90, 10, 0, 3.2, rib, la, lb2, 5);
		return line(40, 87, 40, 72, ab, 1.6) + ink + paint(dotD(40, 72, 0.9), "#222");
	}
	if (stage === "leafy") {
		const ink = new Ink().stroke(ab, 2, limbD([[40, 66], [36, 60], [30, 56], [26, 52]]) + limbD([[40, 62], [44, 56], [50, 52], [54, 48]])).raw(path(cloudD(40, 48, 14, 8, 8, 0.12), base));
		([[26, 52, -150], [26, 52, -100], [54, 48, -30], [54, 48, -80], [40, 46, -90]] as const).forEach(([x, y, d]) => pinnate(ink, x, y, d, 11, 10, 3.4, rib, la, lb2, 6));
		return trunk(40, 40, 50, 5, 2.5, ab) + ink;
	}
	const ink = new Ink()
		.stroke(ab, 2.8, limbD([[40, 62], [32, 54], [24, 48], [18, 40]]) + limbD([[40, 58], [48, 50], [56, 46], [62, 38]]) + limbD([[40, 52], [36, 40], [32, 32], [30, 24]]) + limbD([[40, 50], [46, 38], [50, 30], [52, 22]]))
		.raw(path(cloudD(19, 40, 11, 9, 8, 0.12) + cloudD(61, 37, 11, 9, 8, 0.12) + cloudD(41, 25, 15, 11, 9, 0.12), base));
	const tips: [number, number, number][] = [[18, 40, -170], [18, 40, -120], [18, 40, 150], [30, 24, -140], [30, 24, -80], [52, 22, -100], [52, 22, -40], [62, 38, -60], [62, 38, 10], [40, 34, -150], [40, 34, -30]];
	tips.forEach(([x, y, d], i) => pinnate(ink, x, y, d, x < 20 || x > 60 ? 10.5 : 13, i % 2 ? 12 : -12, 4, rib, la, lb2, 5));
	[[24, 50], [56, 47], [36, 42], [47, 30], [28, 30]].forEach(([x, y]) => keys(ink, x ?? 0, y ?? 0));
	return trunk(40, 40, 50, 8, 4, ab) + ink;
}
function americanElm(stage: GrowingStage): string {
	const eb = "#6e5f52";
	const vase = (cx: number, top: number, hw: number, dep: number) =>
		`M${f(cx - hw)} ${f(top + dep)}C${f(cx - hw * 1.12)} ${f(top + dep * 0.3)} ${f(cx - hw * 0.55)} ${f(top)} ${f(cx)} ${f(top)}C${f(cx + hw * 0.55)} ${f(top)} ${f(cx + hw * 1.12)} ${f(top + dep * 0.3)} ${f(cx + hw)} ${f(top + dep)}C${f(cx + hw * 0.7)} ${f(top + dep * 0.78)} ${f(cx + hw * 0.35)} ${f(top + dep * 0.7)} ${f(cx)} ${f(top + dep * 0.64)}C${f(cx - hw * 0.35)} ${f(top + dep * 0.7)} ${f(cx - hw * 0.7)} ${f(top + dep * 0.78)} ${f(cx - hw)} ${f(top + dep)}Z`;
	const pal = ["#4f8a3e", "#6aa24e", "#5a9644"] as const;
	const sm = (x: number, y: number, d: number) => lensD(x, y, d, 4.2, 1.8, 1);
	if (stage === "sprout") return sapling(16, (x, y) => path(lensD(x, y + 2, -155, 8, 3, 1) + lensD(x, y + 2, -25, 8, 3, 1) + lensD(x, y - 1, -90, 6, 2.4, 1), pal[0]), eb, 1.5);
	if (stage === "leafy") {
		const ink = new Ink().stroke(eb, 1.8, limbD([[40, 70], [36, 62], [30, 56], [25, 52]]) + limbD([[40, 70], [44, 62], [50, 56], [55, 52]]) + segs([[40, 70, 37, 46], [40, 70, 43, 46]]));
		ink.raw(path(vase(40, 32, 18, 22), "#33652f"));
		crown(ink, 40, 42, 17, 8, 22, pal, sm, (x, y) => y < 52 - Math.abs(x - 40) * 0.2);
		return trunk(40, 40, 70, 4, 3, eb) + ink;
	}
	const ink = new Ink().stroke(eb, 3, limbD([[40, 68], [32, 58], [20, 50], [10, 44]]) + limbD([[40, 68], [48, 58], [60, 50], [70, 44]])).stroke(eb, 2.4, limbD([[40, 66], [36, 54], [28, 40], [24, 30]]) + limbD([[40, 66], [44, 54], [52, 40], [56, 30]]));
	const leaves = crown(new Ink(), 40, 26, 32, 18, 46, pal, sm, (x, y) => y < 46 - Math.abs(x - 40) * 0.05 && y > 8);
	const seeds = new Ink().add("#d3dca0", [[14, 44], [66, 44], [30, 32], [52, 20], [40, 38], [22, 24]].map(([x, y]) => dotD(x ?? 0, y ?? 0, 1.3)).join(""));
	return trunk(40, 40, 68, 8, 5, eb) + ink + path(vase(40, 8, 34, 40), "#33652f") + leaves + seeds;
}

function londonPlane(stage: GrowingStage): string {
	const tb = "#b7ad8c";
	const patches = (x: number, ys: number[], w: number) => {
		const ink = new Ink();
		ys.forEach((y, i) => ink.add(i % 2 ? "#e2dac2" : "#7f8a62", dotD(x + ((i % 3) - 1) * w * 0.22, y, w * 0.2)));
		return ink.toString();
	};
	const pl = (x: number, y: number, d: number, r = 5) => palmD(x, y, r, 5, d + 90, 0.6);
	const ball = (ink: Ink, x: number, y: number, l: number) => {
		ink.stroke("#6a5a3a", 0.6, rel([x, y], [["q", [[x + 1, y + l / 2], [x, y + l]]]], false));
		ink.add("#8b6a3c", dotD(x, y + l + 1.8, 2));
		ink.add("#b38d55", dotD(x - 0.6, y + l + 1.2, 0.7));
	};
	if (stage === "sprout") return sapling(16, (x, y) => path(pl(x - 5, y + 3, -135, 5.5) + pl(x + 5, y + 3, -45, 5.5), "#5c9444") + path(pl(x, y - 2, -90, 4.4), "#78ac56"), "#9a8e70", 1.8);
	if (stage === "leafy") {
		const ink = crown(new Ink().raw(path(cloudD(40, 46, 15, 13, 9, 0.1), "#3c6e33")), 40, 46, 13, 12, 14, ["#5c9444", "#78ac56"], (x, y, d) => pl(x, y, d, 4.2));
		ball(ink, 33, 56, 4);
		return trunk(40, 40, 56, 5, 3.5, tb) + patches(40, [80, 72, 64], 5) + ink;
	}
	const ink = new Ink().stroke(tb, 3, limbD([[40, 52], [34, 46], [28, 42], [22, 40]]) + limbD([[40, 50], [46, 44], [52, 42], [58, 40]])).raw(path(cloudD(40, 30, 28, 21, 13, 0.08), "#3c6e33"));
	crown(ink, 40, 30, 26, 19, 34, ["#5c9444", "#78ac56", "#4f8a3c"], (x, y, d) => pl(x, y, d));
	[[20, 42, 6], [27, 46, 9], [50, 46, 7], [58, 42, 10], [40, 48, 5], [34, 26, 6], [48, 24, 8]].forEach(([x, y, l]) => ball(ink, x ?? 0, y ?? 0, l ?? 6));
	return trunk(40, 40, 42, 9, 5, tb) + patches(40, [82, 76, 70, 64, 58, 52], 8) + ink;
}
function hornbeam(stage: GrowingStage): string {
	const gb = "#8a8b84";
	const pal = ["#5c9a40", "#7bb352", "#4f8c38"] as const;
	const hl = (x: number, y: number, d: number) => lensD(x, y, d, 4.6, 1.9, 1);
	const flame = (cx: number, top: number, bot: number, hw: number) => {
		const h = bot - top;
		return `M${f(cx)} ${f(top)}C${f(cx + hw * 0.8)} ${f(top + h * 0.08)} ${f(cx + hw * 1.1)} ${f(top + h * 0.35)} ${f(cx + hw)} ${f(top + h * 0.55)}C${f(cx + hw * 0.85)} ${f(top + h * 0.85)} ${f(cx + hw * 0.4)} ${f(bot)} ${f(cx)} ${f(bot)}C${f(cx - hw * 0.4)} ${f(bot)} ${f(cx - hw * 0.85)} ${f(top + h * 0.85)} ${f(cx - hw)} ${f(top + h * 0.55)}C${f(cx - hw * 1.1)} ${f(top + h * 0.35)} ${f(cx - hw * 0.8)} ${f(top + h * 0.08)} ${f(cx)} ${f(top)}Z`;
	};
	const chain = (ink: Ink, x: number, y: number) => {
		ink.stroke("#9aa060", 0.6, `M${f(x)} ${f(y)}L${f(x)} ${f(y + 8)}`);
		[2, 5, 8].forEach((dy) => ink.add("#d6dd8e", lensD(x, y + dy, 50, 3.4, 1.1) + lensD(x, y + dy, 130, 3.4, 1.1) + lensD(x, y + dy, 90, 4, 1.1)));
	};
	const fluted = (x: number, top: number) => new Ink().stroke("#b0b1aa", 0.7, segs([[x - 1.6, 86, x - 1, top], [x + 1.4, 86, x + 0.9, top]])).toString();
	if (stage === "sprout") return sapling(16, (x, y) => path(lensD(x, y + 2, -150, 8, 3, 1) + lensD(x, y + 2, -30, 8, 3, 1), pal[0]) + path(lensD(x, y, -90, 7, 2.6, 1), pal[1]) + new Ink().stroke("#3f7a35", 0.5, segs([[x - 3, y, x - 5, y - 1.5], [x + 3, y, x + 5, y - 1.5]])), gb, 1.6);
	if (stage === "leafy") {
		const ink = crown(new Ink(), 40, 50, 8, 16, 18, pal, hl);
		return trunk(40, 40, 66, 4.5, 3, gb) + path(flame(40, 32, 70, 11), "#3d7232") + ink;
	}
	const ink = crown(new Ink(), 40, 34, 14, 27, 34, pal, hl);
	[[30, 40], [50, 34], [36, 56], [46, 50], [32, 22], [48, 18], [40, 30]].forEach(([x, y]) => chain(ink, x ?? 0, y ?? 0));
	return trunk(40, 40, 68, 8, 5, gb) + fluted(40, 70) + path(flame(40, 5, 72, 18), "#3d7232") + ink;
}

function sweetgum(stage: GrowingStage): string {
	const sb = "#6a5444";
	const star = (x: number, y: number, d: number, r = 5) => palmD(x, y, r, 5, d + 90, 0.32);
	const pyramid = (top: number, bot: number, hw: number) => {
		const h = bot - top;
		return rel([40, top], [["c", [[40 + hw * 0.25, top + h * 0.2], [40 + hw, bot - h * 0.25], [40 + hw, bot - 3]]], ["q", [[40, bot + 4], [40 - hw, bot - 3]]], ["c", [[40 - hw, bot - h * 0.25], [40 - hw * 0.25, top + h * 0.2], [40, top]]]]);
	};
	const inside = (top: number, bot: number, hw: number) => (x: number, y: number) => y > top + 3 && Math.abs(x - 40) < ((y - top) / (bot - top)) * hw * 1.15;
	const gumball = (ink: Ink, x: number, y: number) => {
		ink.stroke("#4a3626", 0.6, `M${f(x)} ${f(y)}l.4 4`);
		ink.stroke("#7a5a3a", 0.7, segs([0, 45, 90, 135].map((a) => [x + 0.4 - Math.cos((a * Math.PI) / 180) * 2.8, y + 6.2 - Math.sin((a * Math.PI) / 180) * 2.8, x + 0.4 + Math.cos((a * Math.PI) / 180) * 2.8, y + 6.2 + Math.sin((a * Math.PI) / 180) * 2.8])));
		ink.add("#7a5a3a", dotD(x + 0.4, y + 6.2, 2));
	};
	if (stage === "sprout") return sapling(16, (x, y) => path(star(x - 5, y + 3, -140, 5) + star(x + 5, y + 3, -40, 5), GREEN.leaf) + path(star(x, y - 2, -90, 4.4), "#b8323a"), sb, 1.6);
	if (stage === "leafy") {
		const ink = crown(new Ink().raw(path(pyramid(32, 72, 14), "#3f6a32")), 40, 52, 13, 19, 26, [GREEN.leaf, "#c0563a", GREEN.light, "#e08a32"], (x, y, d) => star(x, y, d, 4.4), inside(32, 72, 14));
		return trunk(40, 40, 70, 4.5, 3, sb) + ink;
	}
	const ink = crown(new Ink().raw(path(pyramid(6, 74, 26), "#5a1f30")), 40, 41, 27, 34, 76, ["#7a2b54", "#b8323a", "#e0702a", "#f0b83a", "#9a2a3a"], (x, y, d) => star(x, y, d, 4.8), inside(6, 74, 26));
	[[20, 68], [30, 70], [50, 68], [60, 64], [40, 72], [27, 56], [53, 52]].forEach(([x, y]) => gumball(ink, x ?? 0, y ?? 0));
	return trunk(40, 40, 70, 7, 4.5, sb) + ink;
}
function tulipTree(stage: GrowingStage): string {
	const tb = "#7a6a58";
	const pal = ["#5a9a44", "#78b25a", "#4c8a3a"] as const;
	const TULIP: readonly (readonly [number, number])[] = [[0.08, 0.55], [0.38, 1], [0.5, 0.78], [0.96, 0.82], [0.84, 0]];
	const tl = (x: number, y: number, d: number, s = 6) => mirrored(x, y, d, s, s * 0.55, TULIP);
	const flower = (ink: Ink, x: number, y: number) => {
		ink.add("#dcd36a", `M${f(x - 3)} ${f(y - 3)}Q${f(x - 3.2)} ${f(y + 2.8)} ${f(x)} ${f(y + 2.8)}Q${f(x + 3.2)} ${f(y + 2.8)} ${f(x + 3)} ${f(y - 3)}L${f(x + 1.5)} ${f(y - 1.4)}L${f(x)} ${f(y - 3.6)}L${f(x - 1.5)} ${f(y - 1.4)}Z`);
		ink.add("#f08a2a", `M${f(x - 2.7)} ${f(y + 0.4)}Q${f(x)} ${f(y - 1)} ${f(x + 2.7)} ${f(y + 0.4)}Q${f(x + 2)} ${f(y + 2.6)} ${f(x)} ${f(y + 2.6)}Q${f(x - 2)} ${f(y + 2.6)} ${f(x - 2.7)} ${f(y + 0.4)}Z`);
	};
	if (stage === "sprout") return sapling(18, (x, y) => path(tl(x, y + 3, -150, 8) + tl(x, y + 3, -30, 8), pal[0]) + path(tl(x, y, -90, 6.5), pal[1]), tb, 1.6);
	if (stage === "leafy") {
		const ink = crown(new Ink(), 40, 46, 9, 12, 14, pal, (x, y, d) => tl(x, y, d, 5));
		return trunk(40, 40, 52, 4, 2.6, tb) + path(ovoid(40, 32, 62, 12), "#3e7a36") + ink;
	}
	const ink = crown(new Ink(), 40, 27, 16, 19, 28, pal, (x, y, d) => tl(x, y, d));
	[[30, 24], [48, 18], [52, 34], [32, 40], [42, 29], [24, 34], [56, 25], [40, 12], [44, 43]].forEach(([x, y]) => flower(ink, x ?? 0, y ?? 0));
	return trunk(40, 40, 40, 7, 4, tb) + path(ovoid(40, 4, 50, 21), "#3e7a36") + ink;
}

function blackLocust(stage: GrowingStage): string {
	const bk = "#6a5646";
	const pal = ["#7fae5a", "#9cc270", "#6a9e4c"] as const;
	const base = "#557f3e";
	const lf = (x: number, y: number, d: number) => qlens(x, y, d, 3.8, 1.5);
	const raceme = (ink: Ink, x: number, y: number, n = 6) => {
		ink.stroke("#8a9a6a", 0.5, rel([x, y], [["q", [[x + 1, y + n], [x + 0.3, y + n * 2]]]], false));
		for (let k = 0; k < n; k++) ink.add(k % 2 ? "#e9e5d4" : "#f8f6ee", dotD(x + Math.sin(k * 0.9) * 0.7 + (k % 2 ? 0.9 : -0.9), y + 1.2 + k * 1.9, 1.15));
	};
	const furrows = (x: number, top: number) => new Ink().stroke("#4a3c30", 0.6, segs([[x - 1.8, 86, x - 1, top], [x + 0.2, 85, x + 0.4, top + 4], [x + 2, 86, x + 1.2, top + 2]])).toString();
	if (stage === "sprout") {
		const ink = new Ink();
		pinnate(ink, 40, 73, -120, 10, 10, 3, GREEN.dark, pal[0], pal[2], 5);
		pinnate(ink, 40, 75, -50, 9, -10, 3, GREEN.dark, pal[0], pal[2], 5);
		return line(40, 87, 40, 72, bk, 1.6) + ink;
	}
	if (stage === "leafy") {
		const ink = new Ink().stroke(bk, 2, limbD([[40, 66], [36, 58], [28, 56], [26, 50]]) + limbD([[40, 62], [46, 56], [52, 52], [52, 46]])).raw(path(cloudD(28, 50, 9, 7, 7, 0.14) + cloudD(51, 46, 9, 8, 7, 0.14), base));
		crown(ink, 28, 50, 8, 6, 10, pal, lf);
		crown(ink, 51, 46, 8, 7, 10, pal, lf);
		raceme(ink, 31, 54, 4);
		raceme(ink, 49, 51, 3);
		return trunk(40, 40, 60, 5, 3, bk) + ink;
	}
	const ink = new Ink()
		.stroke(bk, 3, limbD([[40, 60], [32, 54], [24, 48], [16, 44]]) + limbD([[40, 56], [46, 44], [56, 40], [62, 30]]) + limbD([[40, 58], [38, 44], [32, 30], [34, 20]]))
		.raw(path(cloudD(18, 42, 13, 10, 8, 0.14) + cloudD(60, 32, 13, 11, 8, 0.14) + cloudD(36, 20, 15, 11, 9, 0.14), base));
	crown(ink, 19, 42, 11, 9, 18, pal, lf);
	crown(ink, 60, 32, 12, 10, 18, pal, lf);
	crown(ink, 36, 20, 14, 10, 20, pal, lf);
	[[12, 47], [22, 49], [54, 39], [65, 40], [29, 26], [43, 27], [58, 24], [17, 36]].forEach(([x, y]) => raceme(ink, x ?? 0, y ?? 0));
	return trunk(40, 40, 58, 8, 5, bk) + furrows(40, 62) + ink;
}
function honeyLocust(stage: GrowingStage): string {
	const bk = "#4f3e33";
	const pal = ["#a6c35a", "#c4d46e", "#8cae48"] as const;
	const tiny = (x: number, y: number, d: number) => qlens(x, y, d, 2.8, 0.9);
	const thorns = (x: number, ys: number[]) =>
		new Ink().stroke("#a0603e", 0.8, segs(ys.flatMap((y, i) => {
			const s = i % 2 ? 1 : -1;
			const x0 = x + s * 2.6;
			return [[x0, y, x0 + s * 4, y - 1], [x0 + s * 2, y - 0.5, x0 + s * 3, y - 3], [x0 + s * 2, y - 0.5, x0 + s * 3, y + 2]];
		}))).toString();
	const pod = (ink: Ink, x: number, y: number, l: number, s: number) => ink.stroke("#5a2f22", 2, `M${f(x)} ${f(y)}C${f(x + 3 * s)} ${f(y + l * 0.3)} ${f(x - 3 * s)} ${f(y + l * 0.6)} ${f(x + s)} ${f(y + l)}`);
	if (stage === "sprout") {
		const ink = new Ink();
		pinnate(ink, 40, 74, -125, 9, 8, 2.6, GREEN.dark, pal[0], pal[2], 6);
		pinnate(ink, 40, 74, -55, 9, -8, 2.6, GREEN.dark, pal[0], pal[2], 6);
		return line(40, 87, 40, 73, bk, 1.6) + ink;
	}
	if (stage === "leafy") {
		const ink = new Ink().stroke(bk, 1.8, limbD([[40, 64], [34, 58], [28, 54], [24, 50]]) + limbD([[40, 62], [46, 56], [52, 52], [56, 50]]));
		crown(ink, 40, 50, 16, 8, 30, pal, tiny);
		return trunk(40, 40, 54, 5, 3, bk) + thorns(40, [80, 72]) + ell(40, 50, 15, 8, "#7f9e40") + ink;
	}
	const ink = new Ink().stroke(bk, 2.6, limbD([[40, 56], [30, 48], [20, 44], [10, 40]]) + limbD([[40, 54], [50, 46], [60, 42], [70, 38]]) + limbD([[40, 54], [36, 42], [32, 32], [28, 22]]) + limbD([[40, 52], [46, 40], [50, 32], [54, 22]]));
	crown(ink, 16, 38, 11, 7, 22, pal, tiny);
	crown(ink, 63, 36, 10, 7, 22, pal, tiny);
	crown(ink, 40, 24, 22, 11, 46, pal, tiny);
	[[14, 42, 13, 1], [24, 44, 15, -1], [56, 40, 14, 1], [66, 40, 12, -1], [34, 32, 13, 1], [48, 30, 14, -1]].forEach(([x, y, l, s]) => pod(ink, x ?? 0, y ?? 0, l ?? 12, s ?? 1));
	return trunk(40, 40, 54, 8, 5, bk) + thorns(40, [82, 76, 70, 64]) + ell(16, 38, 11, 7, "#7f9e40") + ell(64, 36, 11, 7, "#7f9e40") + ell(40, 24, 21, 11, "#7f9e40") + ink;
}

function catalpa(stage: GrowingStage): string {
	const cb = "#806a52";
	const pal = ["#7cb45a", "#94c46e", "#6aa44a"] as const;
	const big = (x: number, y: number, d: number) => heartD(x, y, d, 8.5, 4.4);
	const panicle = (ink: Ink, x: number, y: number) => {
		let d = "";
		([[0, 0], [-2.6, 2.6], [2.6, 2.6], [-1.3, 5], [1.3, 5], [-3.6, 5.4], [3.6, 5.4], [0, 7.4]] as const).forEach(([dx, dy]) => (d += dotD(x + dx, y + dy - 5, 1.6)));
		ink.add("#fbf8f0", d).add("#8a4a9a", dotD(x - 0.6, y - 4.6, 0.5) + dotD(x + 2.2, y - 2, 0.5) + dotD(x - 2, y + 0.6, 0.5)).add("#f0c440", dotD(x + 1, y + 0.2, 0.5));
	};
	const pod = (ink: Ink, x: number, y: number, l: number) => ink.stroke("#7a6a3a", 1.2, `M${f(x)} ${f(y)}Q${f(x + 1.2)} ${f(y + l / 2)} ${f(x + 0.4)} ${f(y + l)}`);
	if (stage === "sprout") return sapling(14, (x, y) => path(heartD(x, y + 1, -160, 10, 5) + heartD(x, y + 1, -20, 10, 5), pal[0]), cb, 1.8);
	if (stage === "leafy") {
		const ink = crown(new Ink(), 40, 50, 12, 9, 10, pal, (x, y, d) => heartD(x, y, d, 7.5, 3.8));
		panicle(ink, 34, 46);
		return trunk(40, 40, 58, 5, 3.4, cb) + ell(40, 50, 15, 12, "#5a9444") + ink;
	}
	const ink = new Ink().stroke(cb, 3, limbD([[40, 60], [32, 54], [22, 50], [14, 46]]) + limbD([[40, 58], [48, 52], [58, 48], [66, 44]]));
	crown(ink, 40, 38, 24, 16, 22, pal, big);
	[[24, 34], [40, 24], [54, 32], [32, 46], [50, 46], [16, 44], [64, 42]].forEach(([x, y]) => panicle(ink, x ?? 0, y ?? 0));
	[[22, 54, 16], [27, 55, 13], [56, 52, 15]].forEach(([x, y, l]) => pod(ink, x ?? 0, y ?? 0, l ?? 14));
	return trunk(40, 40, 56, 9, 5, cb) + ell(40, 38, 27, 19, "#5a9444") + ink;
}

function alder(stage: GrowingStage): string {
	const ab = "#6e6862";
	const pal = ["#43744a", "#5a8c5c", "#3a6840"] as const;
	const base = "#2c5232";
	const rl = (x: number, y: number, d: number) => lensD(x, y, d, 4.6, 2.4, 0);
	const cones = (ink: Ink, x: number, y: number) => {
		ink.stroke("#6a5040", 0.6, segs([[x, y, x - 2, y + 3], [x, y, x, y + 3.4], [x, y, x + 2, y + 3]]));
		ink.add("#4a3020", dotD(x - 2, y + 4.4, 1.4) + dotD(x, y + 4.9, 1.5) + dotD(x + 2, y + 4.4, 1.4));
		ink.add("#8a6040", dotD(x - 2.3, y + 4, 0.5) + dotD(x - 0.3, y + 4.4, 0.5) + dotD(x + 1.7, y + 4, 0.5));
	};
	const catkin = (ink: Ink, x: number, y: number) => ink.stroke("#b8807a", 1.8, rel([x, y], [["q", [[x + 0.8, y + 3.5], [x + 0.2, y + 7.5]]]], false));
	if (stage === "sprout") return sapling(16, (x, y) => path(lensD(x, y + 2, -150, 7, 3.4, 0) + lensD(x, y + 2, -30, 7, 3.4, 0) + lensD(x, y, -90, 6, 3, 0), pal[1]), ab, 1.6);
	if (stage === "leafy") {
		const ink = crown(new Ink().raw(path(ovoid(40, 32, 70, 13), base)), 40, 52, 9, 15, 18, pal, rl);
		catkin(ink, 33, 56);
		catkin(ink, 47, 50);
		return trunk(40, 40, 66, 4.5, 3, ab) + ink;
	}
	const ink = crown(new Ink().raw(path(ovoid(40, 5, 74, 22), base)), 40, 38, 16, 28, 36, pal, rl);
	[[27, 52], [53, 48], [34, 30], [48, 24], [25, 64], [55, 62], [40, 44]].forEach(([x, y]) => cones(ink, x ?? 0, y ?? 0));
	[[30, 38], [50, 36], [36, 58], [46, 60], [42, 16]].forEach(([x, y]) => catkin(ink, x ?? 0, y ?? 0));
	return trunk(46, 44, 72, 3.6, 2.4, ab) + trunk(38, 39, 70, 6, 4, ab) + ink;
}
function hawthorn(stage: GrowingStage): string {
	const hb = "#6a4e3c";
	const lob = (x: number, y: number, d: number, r = 3.6) => palmD(x, y, r, 5, d + 90, 0.45);
	const flowers = (ink: Ink, x: number, y: number) => {
		let d = "";
		([[0, 0], [-2.4, 1.2], [2.4, 1], [-1, -2.2], [1.6, -2], [0.4, 2.6]] as const).forEach(([dx, dy]) => (d += dotD(x + dx, y + dy, 1.3)));
		ink.add("#f8f4ea", d).add("#d9788a", dotD(x, y, 0.45) + dotD(x - 2.4, y + 1.2, 0.4) + dotD(x + 1.6, y - 2, 0.4));
	};
	const spines = (ls: number[][]) => new Ink().stroke(hb, 0.7, segs(ls)).toString();
	if (stage === "sprout") return sapling(14, (x, y) => path(lob(x - 4.5, y + 3, -140, 4.2) + lob(x + 4.5, y + 3, -40, 4.2) + lob(x, y - 1.5, -90, 3.6), "#4f8a3c"), hb, 1.6) + spines([[40, 80, 43, 78]]);
	if (stage === "leafy") {
		const ink = new Ink().stroke(hb, 2.6, limbD([[40, 87], [36, 76], [44, 70], [40, 62]])).raw(path("M24 58C22 50 30 46 40 46C50 46 58 50 56 58C48 62 32 62 24 58Z", "#2f5a2c"));
		crown(ink, 40, 54, 15, 8, 18, ["#4f8a3c", "#64a04a"], (x, y, d) => lob(x, y, d, 3.4));
		flowers(ink, 32, 52);
		flowers(ink, 48, 50);
		return ink + spines([[38, 74, 35, 72], [43, 70, 46, 68]]);
	}
	const ink = new Ink().stroke(hb, 5, limbD([[38, 87], [33, 74], [48, 70], [41, 58]])).stroke(hb, 2.6, limbD([[41, 62], [32, 58], [22, 56], [14, 52]]) + limbD([[41, 60], [50, 56], [60, 54], [68, 48]]));
	const leaves = crown(new Ink(), 40, 44, 32, 13, 34, ["#4f8a3c", "#64a04a"], (x, y, d) => lob(x, y, d, 3.4));
	scatter(40, 43, 30, 12, 20).forEach(([x, y]) => flowers(leaves, x, y));
	return ink + path("M6 52C4 38 18 30 40 30C62 30 78 38 74 52C64 60 16 60 6 52Z", "#2f5a2c") + leaves + spines([[36, 78, 32, 76], [44, 70, 48, 68], [24, 57, 22, 60]]);
}

function rowan(stage: GrowingStage): string {
	const rb = "#8a8580";
	const rib = "#3f6a32";
	const la = "#6fae4e";
	const lb2 = "#4f8c3a";
	const base = "#3f7232";
	const berries = (ink: Ink, x: number, y: number, fill: string, hi: string, r = 1.5) => {
		let d = "";
		let h = "";
		([[0, 0], [-2.6, 0.8], [2.6, 0.8], [-1.3, 2.6], [1.3, 2.6], [-3.4, 2.8], [3.4, 2.8], [0, 4.2]] as const).forEach(([dx, dy], i) => {
			d += dotD(x + dx, y + dy, r);
			if (i % 2 === 0) h += dotD(x + dx - r * 0.35, y + dy - r * 0.35, r * 0.35);
		});
		ink.add(fill, d).add(hi, h);
	};
	if (stage === "sprout") {
		const ink = new Ink();
		pinnate(ink, 40, 73, -90, 11, 0, 3.4, rib, la, lb2, 6);
		pinnate(ink, 40, 77, -150, 7, 8, 2.6, rib, la, lb2, 4);
		return line(40, 87, 40, 72, rb, 1.6) + ink;
	}
	if (stage === "leafy") {
		const ink = new Ink().raw(path(cloudD(40, 48, 12, 10, 8, 0.12), base));
		([[40, 56, -150], [40, 56, -30], [40, 52, -90], [40, 54, -120], [40, 54, -60]] as const).forEach(([x, y, d]) => pinnate(ink, x, y, d, 12, 0, 3.4, rib, la, lb2, 6));
		berries(ink, 31, 46, "#f1ead2", "#fffaf0", 1.1);
		berries(ink, 50, 44, "#f1ead2", "#fffaf0", 1.1);
		return trunk(40, 40, 54, 4, 2.4, rb) + ink;
	}
	const ink = new Ink().stroke(rb, 2.4, limbD([[40, 62], [34, 54], [28, 46], [24, 38]]) + limbD([[40, 60], [46, 52], [52, 44], [56, 36]]) + limbD([[40, 56], [40, 44], [40, 32], [40, 24]])).raw(path(cloudD(40, 34, 23, 18, 11, 0.1), base));
	([[24, 38, -170], [24, 38, -120], [56, 36, -10], [56, 36, -60], [40, 24, -90], [40, 24, -140], [40, 24, -40], [30, 50, -160], [50, 48, -20]] as const).forEach(([x, y, d], i) =>
		pinnate(ink, x, y, d, 14, i % 2 ? 10 : -10, 3.8, rib, la, lb2, 6),
	);
	[[22, 44], [56, 42], [35, 32], [48, 28], [30, 21], [42, 46]].forEach(([x, y]) => berries(ink, x ?? 0, y ?? 0, "#e5502a", "#f6a070"));
	return trunk(40, 40, 56, 6, 3.5, rb) + ink;
}
function redOak(stage: GrowingStage): string {
	const ob = "#5a4a3e";
	const LOBES: readonly Pt[] = [[0.18, 0.3], [0.26, 0.95], [0.38, 0.38], [0.55, 1], [0.64, 0.36], [0.82, 0.7], [0.88, 0.22], [1, 0]];
	const ro = (x: number, y: number, d: number, s = 7.5) => mirrored(x, y, d, s, s * 0.5, LOBES);
	const acorn = (ink: Ink, x: number, y: number) => {
		ink.add("#b07a40", dotD(x, y + 2.3, 2.5));
		ink.add("#6e4e2e", rel([x - 3.3, y], [["q", [[x, y - 2.4], [x + 3.3, y]]], ["q", [[x, y + 1.4], [x - 3.3, y]]]]));
	};
	if (stage === "sprout") return sapling(16, (x, y) => path(ro(x, y + 2, -150, 9) + ro(x, y + 2, -30, 9), "#5a9a45") + path(ro(x, y, -90, 7), "#b5462a"), ob, 1.8);
	if (stage === "leafy") {
		const ink = crown(new Ink().raw(path(cloudD(40, 52, 17, 12, 9, 0.1), "#3d6e33")), 40, 52, 15, 11, 16, ["#5a9a45", "#79b257", "#b5462a"], (x, y, d) => ro(x, y, d, 6));
		return trunk(40, 40, 60, 6, 3.5, ob) + ink;
	}
	const ink = new Ink().stroke(ob, 3.4, limbD([[40, 64], [32, 58], [22, 54], [14, 48]]) + limbD([[40, 62], [48, 56], [58, 52], [66, 46]])).raw(path(cloudD(40, 40, 31, 22, 13, 0.08), "#6a2218"));
	crown(ink, 40, 40, 29, 20, 38, ["#a3321f", "#c24a28", "#8a2a1c", "#d0652e"], (x, y, d) => ro(x, y, d));
	[[20, 52], [34, 58], [50, 56], [62, 46], [28, 38], [48, 34], [40, 46]].forEach(([x, y]) => acorn(ink, x ?? 0, y ?? 0));
	return trunk(40, 40, 56, 12, 6.5, ob) + ink;
}
function cottonwood(stage: GrowingStage): string {
	const cb = "#7e7264";
	const pal = ["#7aa846", "#9cc25a", "#5f8f38"] as const;
	const DELTA: readonly (readonly [number, number])[] = [[0.06, 0.95], [0.3, 0.92], [1, 0]];
	const dl = (x: number, y: number, d: number, s = 5.4) => mirrored(x, y, d, s, s * 0.6, DELTA);
	const fluff = (ink: Ink, pts: number[][]) => {
		ink.add("#eeebe0", pts.map(([x, y, r]) => dotD(x ?? 0, y ?? 0, r ?? 1.8)).join(""));
		ink.add("#9a9282", pts.map(([x, y]) => dotD(x ?? 0, y ?? 0, 0.5)).join(""));
	};
	const furrows = (x: number, top: number, w: number) => new Ink().stroke("#5a5046", 0.7, segs([[x - w * 0.3, 86, x - w * 0.2, top], [x + w * 0.05, 85, x, top + 6], [x + w * 0.32, 86, x + w * 0.22, top + 2]])).toString();
	if (stage === "sprout") return sapling(18, (x, y) => path(dl(x, y + 3, -150, 7) + dl(x, y + 3, -30, 7), pal[0]) + path(dl(x, y, -90, 6), pal[1]), cb, 1.7);
	if (stage === "leafy") {
		const ink = crown(new Ink(), 40, 46, 12, 14, 18, pal, (x, y, d) => dl(x, y, d));
		fluff(ink, [[30, 40, 1.4], [52, 52, 1.4]]);
		return trunk(40, 40, 56, 5.5, 3.5, cb) + ell(40, 46, 14, 16, "#4f7f34") + ink;
	}
	const ink = new Ink()
		.stroke(cb, 3.4, limbD([[40, 60], [32, 52], [22, 46], [16, 40]]) + limbD([[40, 58], [48, 50], [56, 42], [62, 34]]))
		.raw(path(cloudD(18, 38, 11, 10, 8, 0.12) + cloudD(60, 30, 12, 12, 8, 0.12) + cloudD(38, 28, 20, 20, 11, 0.1), "#4f7f34"));
	crown(ink, 18, 38, 10, 9, 12, pal, (x, y, d) => dl(x, y, d));
	crown(ink, 60, 30, 11, 10, 14, pal, (x, y, d) => dl(x, y, d));
	crown(ink, 38, 26, 18, 18, 28, pal, (x, y, d) => dl(x, y, d));
	fluff(ink, [[26, 30, 1.8], [46, 20, 1.8], [52, 40, 1.8], [34, 44, 1.6], [62, 52, 1.6], [12, 56, 1.5], [70, 18, 1.5], [22, 70, 1.4], [58, 72, 1.4], [16, 84, 1.8], [64, 86, 1.6], [40, 14, 1.6]]);
	return trunk(40, 40, 56, 12, 7, cb) + furrows(40, 60, 12) + ink;
}

function katsura(stage: GrowingStage): string {
	const kb = "#6e5a4e";
	const rh = (x: number, y: number, d: number, s = 4.6) => heartD(x, y, d, s, s * 0.62);
	if (stage === "sprout") return sapling(15, (x, y) => path(rh(x, y + 2, -150, 7) + rh(x, y + 2, -30, 7), "#b0506a") + path(rh(x, y, -90, 5.6), "#c97a8a"), kb, 1.5);
	if (stage === "leafy") {
		const ink = crown(new Ink(), 40, 52, 12, 14, 20, ["#6f9e7e", "#86b08e", "#c46a7a"], (x, y, d) => rh(x, y, d));
		return trunk(37, 38, 66, 3, 2, kb) + trunk(43, 42, 66, 3, 2, kb) + path(ovoid(40, 34, 70, 15), "#4a7a5c") + ink;
	}
	const ink = new Ink().stroke(kb, 2.4, segs([[34, 80, 30, 54], [46, 80, 50, 54], [40, 80, 40, 40]])).raw(path(ovoid(40, 6, 70, 24), "#c97a3e"));
	crown(ink, 40, 38, 21, 28, 58, ["#f2b04e", "#f6cc6e", "#e88a6a", "#e6a050", "#f0b8a0"], (x, y, d) => rh(x, y, d));
	const ground = new Ink().add("#f2b04e", rh(16, 85, -20, 3) + rh(62, 85, 200, 3)).add("#e88a6a", rh(22, 85.5, 30, 2.6) + rh(68, 85.5, 160, 2.6));
	return trunk(34, 32, 64, 4, 2.6, kb) + trunk(40, 40, 60, 4.5, 3, kb) + trunk(46, 48, 64, 4, 2.6, kb) + ink + ground;
}

function easternRedbud(stage: GrowingStage): string {
	const rb = "#6e5054";
	const pal = ["#c2468a", "#d96aa8", "#e89ac4"] as const;
	const dotsAlong = (ink: Ink, pts: readonly (readonly [number, number])[], step: number, r: number) => {
		let k = 0;
		for (let i = 1; i < pts.length; i++) {
			const [x0, y0] = pts[i - 1] ?? [0, 0];
			const [x1, y1] = pts[i] ?? [0, 0];
			const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / step));
			for (let j = 0; j < n; j++, k++) {
				const t = j / n;
				const x = x0 + (x1 - x0) * t;
				const y = y0 + (y1 - y0) * t;
				const o = k % 2 ? 1.4 : -1.4;
				ink.add(pal[k % 3] ?? pal[0], dotD(x + o * 0.6, y - 0.6, r) + dotD(x - o * 0.5, y + 0.9, r * 0.85));
			}
		}
	};
	const zig = (ink: Ink, w: number, pts: readonly (readonly [number, number])[]) => ink.stroke(rb, w, `M${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join("L")}`);
	if (stage === "sprout") return sapling(15, (x, y) => path(heartD(x, y + 2, -150, 8, 4.4) + heartD(x, y + 2, -30, 8, 4.4), GREEN.leaf) + paint(dotD(x - 1, y - 1, 1.4) + dotD(x + 1.4, y - 2, 1.2), pal[0]), rb, 1.6);
	if (stage === "leafy") {
		const ink = new Ink();
		zig(ink, 2.4, [[40, 87], [38, 76], [41, 68]]);
		zig(ink, 1.6, [[41, 68], [34, 62], [30, 54]]);
		zig(ink, 1.6, [[41, 68], [47, 62], [52, 54]]);
		zig(ink, 1.3, [[41, 68], [40, 58], [42, 48]]);
		dotsAlong(ink, [[41, 68], [34, 62], [30, 54]], 3, 1.3);
		dotsAlong(ink, [[41, 68], [47, 62], [52, 54]], 3, 1.3);
		dotsAlong(ink, [[41, 68], [40, 58], [42, 48]], 3, 1.3);
		dotsAlong(ink, [[39, 82], [38, 76]], 3, 1.1);
		return ink.toString();
	}
	const ink = new Ink();
	const limbs: [number, readonly Pt[]][] = [
		[3.6, [[38, 87], [36, 78], [30, 70], [24, 64]]],
		[3.6, [[42, 87], [44, 78], [50, 70], [56, 64]]],
		[2.4, [[24, 64], [16, 58], [10, 50]]],
		[2.4, [[24, 64], [22, 52], [16, 42]]],
		[2.4, [[56, 64], [64, 58], [70, 50]]],
		[2.4, [[56, 64], [58, 52], [64, 42]]],
		[2.2, [[37, 80], [34, 66], [30, 54], [28, 40]]],
		[2.2, [[43, 80], [46, 66], [50, 54], [52, 40]]],
		[1.6, [[16, 42], [10, 36], [12, 28]]],
		[1.6, [[16, 42], [20, 34], [18, 26]]],
		[1.6, [[64, 42], [70, 36], [68, 28]]],
		[1.6, [[64, 42], [60, 34], [62, 26]]],
		[1.6, [[28, 40], [24, 30], [28, 20]]],
		[1.6, [[28, 40], [34, 32], [36, 22]]],
		[1.6, [[52, 40], [56, 30], [52, 20]]],
		[1.6, [[52, 40], [46, 32], [44, 22]]],
		[1.4, [[30, 54], [40, 46], [40, 30], [40, 16]]],
		[1.2, [[10, 50], [5, 46]]],
		[1.2, [[70, 50], [75, 46]]],
	];
	limbs.forEach(([w, p]) => zig(ink, w, p));
	limbs.forEach(([, p]) => dotsAlong(ink, p, 3.2, 1.5));
	return ink.toString();
}

function serviceberry(stage: GrowingStage): string {
	const sb = "#8f8c88";
	const pal = ["#5e9a48", "#78ae58", "#4c8a3c"] as const;
	const ov = (x: number, y: number, d: number) => lensD(x, y, d, 4.4, 2.2, 0);
	const star = (ink: Ink, x: number, y: number, r = 3) => {
		let d = "";
		for (let k = 0; k < 5; k++) d += lensD(x, y, k * 72 - 90, r, r * 0.2, 0);
		ink.add("#f1eada", d).add("#b8963a", dotD(x, y, 0.7));
	};
	const berries = (ink: Ink, x: number, y: number) => {
		ink.stroke("#7a3a3a", 0.6, segs([[x, y, x - 2.4, y + 3.2], [x, y, x + 0.4, y + 4], [x, y, x + 2.8, y + 2.8]]));
		ink.add("#b8344a", dotD(x - 2.4, y + 4.4, 1.4)).add("#5a2a5a", dotD(x + 0.4, y + 5.4, 1.5)).add("#3a3a6e", dotD(x + 2.8, y + 4, 1.4));
	};
	const stems = (ink: Ink, w: number, tops: readonly (readonly [number, number])[]) => ink.stroke(sb, w, tops.map(([x, y]) => `M40 87Q${f(40 + (x - 40) * 0.3)} ${f((87 + y) / 2)} ${f(x)} ${f(y)}`).join(""));
	if (stage === "sprout") {
		const ink = new Ink();
		stems(ink, 1.3, [[36, 70], [44, 72]]);
		ink.add("#b0784a", ov(36, 70, -120) + ov(44, 72, -60));
		star(ink, 36, 68, 2.6);
		star(ink, 44.5, 69.5, 2.4);
		return ink.toString();
	}
	if (stage === "leafy") {
		const ink = new Ink();
		stems(ink, 1.8, [[30, 50], [38, 44], [46, 46], [52, 54]]);
		crown(ink, 40, 52, 13, 10, 14, ["#b0784a", "#8aa858", "#c08a5a"], ov);
		[[30, 48], [38, 42], [46, 44], [52, 52], [34, 56], [48, 58], [40, 50], [26, 56], [56, 46]].forEach(([x, y]) => star(ink, x ?? 0, y ?? 0));
		return ink.toString();
	}
	const ink = new Ink();
	stems(ink, 2.6, [[22, 34], [34, 22], [48, 20], [60, 32]]);
	stems(ink, 1.8, [[14, 48], [66, 46], [42, 30]]);
	ink.raw(ell(22, 38, 12, 11, "#3f7232") + ell(58, 36, 12, 11, "#3f7232") + ell(40, 26, 15, 12, "#3f7232"));
	crown(ink, 40, 34, 26, 20, 36, pal, ov);
	[[22, 40], [34, 30], [50, 26], [58, 40], [30, 50], [46, 44], [16, 52], [64, 52], [40, 18]].forEach(([x, y]) => berries(ink, x ?? 0, y ?? 0));
	star(ink, 28, 22);
	star(ink, 56, 22);
	return ink.toString();
}

function sassafras(stage: GrowingStage): string {
	const sb = "#7a5e4a";
	const mit = (x: number, y: number, d: number, i: number, s = 5.6) => {
		const main = lensD(x, y, d, s, s * 0.38, 0);
		if (i % 3 === 0) return main;
		const thumb = qlens(x, y, d - 42, s * 0.68, s * 0.22);
		return i % 3 === 1 ? main + thumb : main + thumb + qlens(x, y, d + 42, s * 0.68, s * 0.22);
	};
	const fruit = (ink: Ink, x: number, y: number) => {
		ink.stroke("#d0302a", 0.9, `M${f(x)} ${f(y)}L${f(x + 0.3)} ${f(y + 3.4)}`);
		ink.add("#d0302a", `M${f(x - 1)} ${f(y + 3.6)}Q${f(x + 0.3)} ${f(y + 5)} ${f(x + 1.6)} ${f(y + 3.6)}Z`);
		ink.add("#2a2f5a", dotD(x + 0.3, y + 5.6, 1.6)).add("#7f86b8", dotD(x - 0.2, y + 5, 0.45));
	};
	if (stage === "sprout") return sapling(16, (x, y) => path(mit(x, y + 2, -150, 1, 8) + mit(x, y + 2, -30, 2, 8) + mit(x, y, -90, 0, 6), "#6aa44a"), sb, 1.6);
	if (stage === "leafy") {
		const ink = crown(new Ink(), 40, 52, 13, 12, 16, ["#6aa44a", "#84b860", "#5a9640"], (x, y, d, i) => mit(x, y, d, i, 5));
		return trunk(40, 40, 62, 4.5, 3, sb) + ell(40, 52, 14, 13, "#3f7232") + ink;
	}
	const tiers: [number, number, number, number, number][] = [[22, 60, 14, 6, 10], [58, 50, 14, 6, 10], [24, 38, 13, 6, 10], [56, 28, 13, 6, 9], [40, 18, 11, 6, 8]];
	const ink = new Ink().stroke(sb, 2.4, segs([[40, 70, 18, 64], [40, 58, 62, 52], [40, 46, 20, 40], [40, 36, 58, 30]])).raw(tiers.map(([x, y, rx, ry]) => ell(x, y, rx + 1, ry + 2, "#3f7232")).join(""));
	tiers.forEach(([x, y, rx, ry, n], t) => crown(ink, x, y, rx, ry, n, t % 2 ? ["#6aa44a", "#e0782e", "#84b860"] : ["#84b860", "#6aa44a", "#d84a2a"], (a, b, d, i) => mit(a, b, d, i + t)));
	[[18, 62], [28, 62], [52, 52], [62, 50], [20, 40], [30, 40], [52, 30], [44, 20]].forEach(([x, y]) => fruit(ink, x ?? 0, y ?? 0));
	return trunk(40, 40, 18, 5, 2.4, sb) + ink;
}

function persianIronwood(stage: GrowingStage): string {
	const ib = "#8a7a6a";
	const gl = (x: number, y: number, d: number) => lensD(x, y, d, 4.8, 2.3, 0);
	if (stage === "sprout") return sapling(14, (x, y) => path(gl(x, y + 2, -165) + gl(x, y + 2, -15), GREEN.leaf) + path(gl(x, y, -90), "#c8382a"), ib, 1.6);
	if (stage === "leafy") {
		const ink = new Ink().stroke(ib, 2, segs([[40, 72, 26, 62], [40, 70, 54, 60], [40, 68, 40, 56]])).raw(path("M18 62C18 52 28 48 40 48C52 48 62 52 62 62C54 66 26 66 18 62Z", "#5a2a3a"));
		crown(ink, 40, 56, 19, 7, 22, [GREEN.leaf, "#e8862a", GREEN.light, "#c8382a", "#f0c040"], gl);
		return trunk(40, 40, 70, 5, 3.5, ib) + ink;
	}
	const ink = new Ink().stroke(ib, 3.4, limbD([[40, 74], [32, 66], [20, 62], [10, 56]]) + limbD([[40, 74], [48, 66], [60, 62], [70, 56]])).stroke(ib, 2.4, segs([[40, 72, 30, 50], [40, 72, 50, 50], [40, 72, 40, 40]]));
	const pal = ["#f0c040", "#e8862a", "#c8382a", "#7a2a5a", "#a4b84a"] as const;
	ink.raw(path("M5 56C4 46 18 42 40 42C62 42 76 46 75 56C64 62 16 62 5 56Z", "#5a2a3a") + path("M16 42C16 30 26 26 40 26C54 26 64 30 64 42C54 46 26 46 16 42Z", "#6a2e3a"));
	crown(ink, 40, 52, 32, 8, 40, pal, gl);
	crown(ink, 40, 36, 22, 9, 30, pal, gl);
	return trunk(36, 36, 74, 5, 4, ib) + trunk(44, 44, 74, 5, 4, ib) + ink;
}

function hackberry(stage: GrowingStage): string {
	const hb = "#8c857c";
	const pal = ["#5e9a48", "#78ae58", "#4c8a3c"] as const;
	const base = "#3f6e35";
	const asym = (x: number, y: number, d: number) => lensD(x, y, d, 5, 2, 1);
	/** Corky ridges: short knobbly strokes in two tones across the trunk. */
	const cork = (x: number, top: number, w: number) => {
		const ink = new Ink();
		for (let y = 85, i = 0; y > top; y -= 2.6, i++) {
			const off = (((i * 37) % 9) / 9 - 0.5) * w * 0.55;
			const l = 1.4 + (i % 3) * 0.9;
			ink.stroke(i % 2 ? "#a9a194" : "#6e675e", 1.3, `M${f(x + off - l / 2)} ${f(y)}h${f(l)}`);
		}
		return ink.toString();
	};
	const berries = (ink: Ink, x: number, y: number) => {
		ink.stroke("#5a6a3a", 0.5, segs([[x, y, x - 1.6, y + 3], [x, y, x + 1.8, y + 3.4]]));
		ink.add("#4a2848", dotD(x - 1.6, y + 4, 1.2)).add("#c8803a", dotD(x + 1.8, y + 4.4, 1.1));
	};
	if (stage === "sprout") return sapling(16, (x, y) => path(asym(x, y + 2, -150) + asym(x, y + 2, -30) + asym(x, y, -95), pal[0]), hb, 1.7);
	if (stage === "leafy") {
		const ink = crown(new Ink().raw(path(cloudD(40, 50, 16, 12, 9, 0.1), base)), 40, 50, 14, 11, 18, pal, asym);
		return trunk(40, 40, 58, 6, 3.5, hb) + cork(40, 62, 6) + ink;
	}
	const ink = new Ink()
		.stroke(hb, 3.4, limbD([[40, 60], [34, 50], [24, 42], [16, 36]]) + limbD([[40, 58], [46, 48], [56, 40], [64, 34]]) + limbD([[40, 56], [40, 44], [38, 32], [40, 22]]))
		.raw(path(cloudD(18, 34, 12, 11, 8, 0.12) + cloudD(62, 32, 12, 11, 8, 0.12) + cloudD(40, 22, 17, 13, 9, 0.12), base));
	crown(ink, 19, 34, 10, 10, 14, pal, asym);
	crown(ink, 61, 32, 10, 10, 14, pal, asym);
	crown(ink, 40, 22, 16, 12, 22, pal, asym);
	[[16, 40], [26, 36], [56, 38], [64, 30], [34, 24], [46, 28], [40, 14]].forEach(([x, y]) => berries(ink, x ?? 0, y ?? 0));
	return trunk(40, 40, 56, 12, 7, hb) + cork(40, 58, 12) + ink;
}
export const SPECIES: Species[] = [
	{ id: "sugar-maple", name: "Sugar maple", draw: sugarMaple },
	{ id: "red-maple", name: "Red maple", draw: redMaple },
	{ id: "european-beech", name: "European beech", draw: europeanBeech },
	{ id: "horse-chestnut", name: "Horse chestnut", draw: horseChestnut },
	{ id: "linden", name: "Linden", draw: linden },
	{ id: "ash", name: "Ash", draw: ash },
	{ id: "american-elm", name: "American elm", draw: americanElm },
	{ id: "london-plane", name: "London plane", draw: londonPlane },
	{ id: "hornbeam", name: "Hornbeam", draw: hornbeam },
	{ id: "sweetgum", name: "Sweetgum", draw: sweetgum },
	{ id: "tulip-tree", name: "Tulip tree", draw: tulipTree },
	{ id: "black-locust", name: "Black locust", draw: blackLocust },
	{ id: "honey-locust", name: "Honey locust", draw: honeyLocust },
	{ id: "catalpa", name: "Catalpa", draw: catalpa },
	{ id: "alder", name: "Alder", draw: alder },
	{ id: "hawthorn", name: "Hawthorn", draw: hawthorn },
	{ id: "rowan", name: "Rowan", draw: rowan },
	{ id: "red-oak", name: "Red oak", draw: redOak },
	{ id: "cottonwood", name: "Cottonwood", draw: cottonwood },
	{ id: "katsura", name: "Katsura", draw: katsura },
	{ id: "eastern-redbud", name: "Eastern redbud", draw: easternRedbud },
	{ id: "serviceberry", name: "Serviceberry", draw: serviceberry },
	{ id: "sassafras", name: "Sassafras", draw: sassafras },
	{ id: "persian-ironwood", name: "Persian ironwood", draw: persianIronwood },
	{ id: "hackberry", name: "Hackberry", draw: hackberry },
];
