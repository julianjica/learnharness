/**
 * Palms and cycads: 25 species in the garden's flat style (see kit.ts). Each
 * grows from a seedling (sprout) to a young palm (leafy) to its signature
 * fullest form (bloom): its crown, trunk, crownshaft, flowers, fruit or cones.
 */
import { bez, CUT, f, type GrowingStage, type Pt, type Species } from "./kit";

type St = GrowingStage;
type P4 = readonly [Pt, Pt, Pt, Pt];
type Hw = (t: number) => number;

const rad = Math.PI / 180;
const pt = (x: number, y: number): string => `${f(x)} ${f(y)}`;
const pick = <T>(st: St, s: T, l: T, b: T): T => (st === "sprout" ? s : st === "leafy" ? l : b);

/** Compacts path data: drops repeated L / implicit-after-M letters, leading zeros and needless spaces. */
function tidy(d: string): string {
	let out = "";
	let prev = "";
	let num = false;
	for (const tok of d.match(/[A-Za-z]|-?[\d.]+/g) ?? []) {
		if (/[A-Za-z]/.test(tok)) {
			if (tok === "L" && (prev === "L" || prev === "M")) {
				prev = "L";
				continue;
			}
			out += tok;
			prev = tok;
			num = false;
		} else {
			const t = tok.replace(/^(-?)0\./, "$1.");
			out += (num && t[0] !== "-" ? " " : "") + t;
			num = true;
		}
	}
	return out;
}

/** Merges path data per fill / stroke into one <path> each, in first-use order (keeps markup small). */
class Ink {
	private m = new Map<string, string>();
	private n = 0;
	fill(c: string, d: string): this {
		return this.put(`f${c}`, d);
	}
	stroke(c: string, w: number, d: string): this {
		return this.put(`s${c}|${f(w)}`, d);
	}
	/** Round dots of radius r as zero-length round-capped strokes (compact). */
	dots(c: string, r: number, ps: readonly (readonly [number, number])[]): this {
		return this.stroke(c, r * 2, ps.map(([x, y]) => `M${pt(x, y)}h0`).join(""));
	}
	raw(s: string): this {
		this.m.set(`r${this.n++}`, s);
		return this;
	}
	private put(k: string, d: string): this {
		this.m.set(k, (this.m.get(k) ?? "") + d);
		return this;
	}
	toString(): string {
		let s = "";
		for (const [k, d] of this.m) {
			if (k[0] === "r") s += d;
			else if (k[0] === "f") s += `<path d="${tidy(d)}" fill="${k.slice(1)}"/>`;
			else {
				const [c, w] = k.slice(1).split("|");
				s += `<path d="${tidy(d)}" stroke="${c}" stroke-width="${w}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
			}
		}
		return s;
	}
}

/** Maps local (u along, v across) at (x, y) heading `deg` to "x y". */
function mapper(x: number, y: number, deg: number): (u: number, v: number) => string {
	const c = Math.cos(deg * rad);
	const s = Math.sin(deg * rad);
	return (u, v) => pt(x + c * u - s * v, y + s * u + c * v);
}

/** A circle subpath. */
/** A dot as a zero-length subpath: stroke it round-capped at twice the radius. */
const dotD = (x: number, y: number): string => `M${pt(x, y)}h0`;
/** An axis-aligned ellipse subpath. */
const ovD = (x: number, y: number, rx: number, ry: number): string => `M${pt(x - rx, y)}a${f(rx)} ${f(ry)} 0 1 0 ${f(2 * rx)} 0a${f(rx)} ${f(ry)} 0 1 0 ${f(-2 * rx)} 0`;
/** A pointed lens subpath from (x, y) heading `deg`. */
function lensD(x: number, y: number, deg: number, len: number, w: number): string {
	const P = mapper(x, y, deg);
	return `M${P(0, 0)}Q${P(len * 0.5, -w)} ${P(len, 0)}Q${P(len * 0.5, w)} ${P(0, 0)}Z`;
}
/** A blunt strap (oval) subpath from (x, y) heading `deg`. */
function strapD(x: number, y: number, deg: number, len: number, w: number): string {
	const P = mapper(x, y, deg);
	return `M${P(0, 0)}C${P(len * 0.15, -w)} ${P(len * 1.05, -w)} ${P(len, 0)}C${P(len * 1.05, w)} ${P(len * 0.15, w)} ${P(0, 0)}Z`;
}
const curveD = (p: P4): string => `M${pt(p[0][0], p[0][1])}C${pt(p[1][0], p[1][1])} ${pt(p[2][0], p[2][1])} ${pt(p[3][0], p[3][1])}`;
const segD = (x0: number, y0: number, x1: number, y1: number): string => `M${pt(x0, y0)}L${pt(x1, y1)}`;

/** Points spread evenly over an ellipse (sunflower spiral), deterministic. */
function scatter(cx: number, cy: number, rx: number, ry: number, n: number): [number, number][] {
	const out: [number, number][] = [];
	for (let i = 0; i < n; i++) {
		const a = i * 2.39996;
		const r = Math.sqrt((i + 0.5) / n);
		out.push([cx + Math.cos(a) * r * rx, cy + Math.sin(a) * r * ry]);
	}
	return out;
}
const dotsD = (ps: readonly (readonly [number, number])[]): string => ps.map(([x, y]) => dotD(x, y)).join("");

/** A trunk path: straight from the ground at x0 up to `top`, leaning by `lean` at the top. */
const up = (x0: number, top: number, lean = 0): P4 => [
	[x0, 88],
	[x0, 88 - (88 - top) * 0.35],
	[x0 + lean * 0.6, top + (88 - top) * 0.3],
	[x0 + lean, top],
];
const seg = (x0: number, y0: number, x1: number, y1: number): P4 => [
	[x0, y0],
	[x0 + (x1 - x0) / 3, y0 + (y1 - y0) / 3],
	[x0 + ((x1 - x0) * 2) / 3, y0 + ((y1 - y0) * 2) / 3],
	[x1, y1],
];

/** Point and unit normal on a cubic at t. */
function frame(p: P4, t: number): [number, number, number, number] {
	const [x, y] = bez(p, t);
	const [x1, y1] = bez(p, Math.max(0, t - 0.01));
	const [x2, y2] = bez(p, Math.min(1, t + 0.01));
	const a = Math.atan2(y2 - y1, x2 - x1);
	return [x, y, -Math.sin(a), Math.cos(a)];
}
/** A filled body along p with half-width hw(t). */
function bodyD(p: P4, hw: Hw, n = 10): string {
	const L: string[] = [];
	const R: string[] = [];
	for (let i = 0; i <= n; i++) {
		const [x, y, nx, ny] = frame(p, i / n);
		const w = hw(i / n);
		L.push(pt(x + nx * w, y + ny * w));
		R.push(pt(x - nx * w, y - ny * w));
	}
	return `M${L.join("L")}L${R.reverse().join("L")}Z`;
}
/** k-1 rings across a body, from t0 to t1. */
function ringsD(p: P4, hw: Hw, k: number, t0 = 0, t1 = 1, sag = 0.6): string {
	let d = "";
	for (let i = 1; i < k; i++) {
		const t = t0 + ((t1 - t0) * i) / k;
		const [x, y, nx, ny] = frame(p, t);
		const w = hw(t) * 0.92;
		d += `M${pt(x + nx * w, y + ny * w)}Q${pt(x, y + sag)} ${pt(x - nx * w, y - ny * w)}`;
	}
	return d;
}
/** Short slanted hatching across a body (fibre, leaf bases). */
function hatchD(p: P4, hw: Hw, k: number, slant: number, t0 = 0, t1 = 1): string {
	let d = "";
	for (let i = 0; i < k; i++) {
		const t = t0 + ((t1 - t0) * (i + 0.5)) / k;
		const [x, y, nx, ny] = frame(p, t);
		const w = hw(t) * 0.8;
		const o = i % 2 ? 0.3 : -0.3;
		d += `M${pt(x + nx * w, y + ny * w + o)}L${pt(x - nx * w, y - ny * w - slant + o)}`;
	}
	return d;
}

interface FeatherO {
	a: string;
	b?: string;
	rib: string;
	/** 0 stiff … 1 hanging. */
	droop?: number;
	/** Leaflet angle to the rachis. */
	ang?: number;
	/** Extra leaflet angles each side (plumose fronds). */
	plume?: readonly number[];
	w?: number;
	ribW?: number;
	n?: number;
	/** How much leaflets shorten toward the tip (0 … 1). */
	taper?: number;
	/** Bare petiole fraction. */
	bare?: number;
	/** Petiole colour over the bare part (default: rib). */
	petC?: string;
}
/** A pinnate frond: a curving rachis with stroked leaflet pairs (one V per node). Returns the tip. */
function feather(ink: Ink, x: number, y: number, deg: number, len: number, bend: number, leaflet: number, o: FeatherO): [number, number] {
	const { a, b = a, rib, droop = 0.4, ang = 55, plume = [], w = 1, ribW = 1.1, taper = 0.6, bare = 0, petC } = o;
	const n = Math.max(5, Math.min(o.n ?? 9, Math.round(len / 2.1)));
	const step = len / n;
	let t = deg * rad;
	let px = x;
	let py = y;
	let d = `M${pt(x, y)}`;
	let pd = d;
	let la = "";
	let lb = "";
	const tip = (A: number, l: number): [number, number] => {
		const vx = Math.cos(A) * (1 - droop);
		const vy = Math.sin(A) * (1 - droop) + droop;
		const m = Math.hypot(vx, vy) || 1;
		return [px + (vx / m) * l, py + (vy / m) * l];
	};
	for (let j = 1; j <= n; j++) {
		t += (bend * rad) / n;
		px += Math.cos(t) * step;
		py += Math.sin(t) * step;
		d += `L${pt(px, py)}`;
		if (j / n <= bare + 0.01) pd += `L${pt(px, py)}`;
		if (j < n && j / n > bare) {
			const l = leaflet * (1 - (taper * j) / n) * (0.6 + 0.4 * Math.sin((Math.PI * j) / n)) + 0.8;
			[ang, ...plume].forEach((A, k) => {
				const ll = k ? l * 0.8 : l;
				const [x1, y1] = tip(t - A * rad, ll);
				const [x2, y2] = tip(t + A * rad, ll);
				const v = `M${pt(x1, y1)}L${pt(px, py)}L${pt(x2, y2)}`;
				if (k) lb += v;
				else la += v;
			});
		}
	}
	ink.stroke(a, w, la);
	if (lb) ink.stroke(b, w, lb);
	ink.stroke(rib, ribW, d);
	if (petC) ink.stroke(petC, ribW + 0.3, pd);
	return [px, py];
}
type Fr = readonly (readonly [number, number, number])[];
/** Fronds from (x, y), each [deg, bend, len]; plain fronds alternate colours a / b. */
function crown(ink: Ink, x: number, y: number, fr: Fr, leaflet: number, o: FeatherO): void {
	fr.forEach(([d, b, L], i) => feather(ink, x, y, d, L, b, leaflet, o.plume?.length ? o : { ...o, a: i % 2 && o.b ? o.b : o.a }));
}

interface FanO {
	c: string;
	c2?: string;
	rib?: string;
	/** Notch depth: radius fraction of the splits (1 = entire). */
	inner?: number;
	spread?: number;
	n?: number;
	/** Hanging tips (weeping fan). */
	weep?: number;
	pet?: string;
	petW?: number;
}
/** A palmate fan opening along `dir` from (x, y). */
function fanAt(ink: Ink, x: number, y: number, dir: number, r: number, c: string, o: FanO): void {
	const { rib, inner = 0.7, spread = 150, n = 12, weep = 0 } = o;
	const at = (deg: number, rr: number): [number, number] => [x + Math.cos(deg * rad) * rr, y + Math.sin(deg * rad) * rr];
	const step = spread / n;
	let d = `M${pt(x, y)}`;
	let rd = "";
	let wd = "";
	for (let i = 0; i <= n; i++) {
		const a = dir - spread / 2 + step * i;
		if (i > 0) {
			const [nx, ny] = at(a - step / 2, r * inner);
			d += `L${pt(nx, ny)}`;
		}
		const [tx, ty] = at(a, r);
		d += `L${pt(tx, ty)}`;
		if (rib && i > 0 && i < n && i % 2) {
			const [rx, ry] = at(a, r * 0.86);
			rd += `M${pt(x, y)}L${pt(rx, ry)}`;
		}
		if (weep && i % 2 === 0) {
			const ox = Math.cos(a * rad) * 1.5;
			wd += `M${pt(tx, ty)}q${f(ox)} ${f(weep * 0.4)} ${f(ox * 0.7)} ${f(weep)}`;
		}
	}
	let out = `<path d="${tidy(d)}Z" fill="${c}"/>`;
	if (wd) out += `<path d="${tidy(wd)}" stroke="${c}" stroke-width=".8" fill="none" stroke-linecap="round"/>`;
	if (rd) out += `<path d="${tidy(rd)}" stroke="${rib}" stroke-width=".5" fill="none" stroke-linecap="round"/>`;
	ink.raw(out);
}
type Fans = readonly (readonly [number, number, number])[];
/** Fans on petioles from (x, y): each [dir, petiole length, radius]. */
function fanCrown(ink: Ink, x: number, y: number, fans: Fans, o: FanO): void {
	const { c, c2 = c, pet = o.rib ?? c, petW = 1.2 } = o;
	let pd = "";
	for (const [dir, p] of fans) {
		pd += segD(x, y, x + Math.cos(dir * rad) * p, y + Math.sin(dir * rad) * p);
	}
	ink.stroke(pet, petW, pd);
	fans.forEach(([dir, p, r], i) => fanAt(ink, x + Math.cos(dir * rad) * p, y + Math.sin(dir * rad) * p, dir, r, i % 2 ? c2 : c, o));
}

/** Strands hanging from (x, y) fanned between angles, beaded with fruit. */
function tassel(ink: Ink, x: number, y: number, from: number, to: number, k: number, len: number, strand: string, bead: string, r: number, gap: number): void {
	let sd = "";
	let bd = "";
	for (let i = 0; i < k; i++) {
		const a = (from + ((to - from) * i) / Math.max(1, k - 1)) * rad;
		const L = len * (0.8 + 0.2 * Math.sin(i * 2.1));
		const ex = x + Math.cos(a) * L;
		const ey = y + Math.sin(a) * L;
		sd += `M${pt(x, y)}Q${pt(x + Math.cos(a) * L * 0.5 + (ex - x) * 0.2, y + Math.sin(a) * L * 0.4)} ${pt(ex, ey)}`;
		for (let s = gap; s <= L; s += gap) bd += dotD(x + (ex - x) * (s / L), y + (ey - y) * (s / L));
	}
	ink.stroke(strand, 0.6, sd).stroke(bead, r * 2, bd);
}

/* ---------------- species ---------------- */

/* 1. Royal palm: smooth swollen grey column, long bright crownshaft, arching crown. */
const ROY = { a: "#5a9a48", b: "#74b05a", rib: "#3f7a35", trunk: "#bdb9ae", ring: "#99958b", shaft: "#8cc257" };
function royal(st: St): string {
	const ink = new Ink();
	const o: FeatherO = { a: ROY.a, b: ROY.b, rib: ROY.rib, droop: 0.45 };
	if (st === "sprout") {
		ink.fill(ROY.trunk, bodyD(up(40, 81), (t) => 3 - t)).fill(ROY.shaft, bodyD(seg(40, 82, 40, 75), (t) => 2 - 0.5 * t));
		crown(ink, 40, 75, [[-150, -40, 11], [-95, 10, 10], [-30, 40, 11]], 3.5, o);
		return ink.toString();
	}
	const leafy = st === "leafy";
	const top = pick(st, 0, 60, 46);
	const hw: Hw = leafy ? (t) => 3.6 - 0.8 * t : (t) => 3.3 + 1.4 * Math.sin(Math.PI * Math.min(1, t * 1.15)) - 0.4 * t;
	const p = up(40, top);
	ink.fill(ROY.trunk, bodyD(p, hw)).stroke(ROY.ring, 0.5, ringsD(p, hw, leafy ? 6 : 9, 0.05, 1, 0.3));
	const sh = leafy ? 9 : 15;
	ink.fill(ROY.shaft, bodyD(seg(40, top + 1, 40, top - sh), (t) => (leafy ? 3 : 3.4) - 0.7 * t));
	const cy = top - sh;
	if (leafy) crown(ink, 40, cy, [[-170, -45, 17], [-130, -45, 18], [-92, 10, 14], [-50, 45, 18], [-10, 45, 17]], 5, o);
	else {
		crown(ink, 40, cy, [[-178, -55, 24], [-150, -60, 25], [-120, -45, 22], [-94, 8, 18], [-60, 45, 22], [-30, 60, 25], [-2, 55, 24]], 7, o);
		tassel(ink, 38.5, top + 1, 105, 160, 4, 9, "#c9b98a", "#eadfb8", 0.75, 1.8);
		tassel(ink, 41.5, top + 1, 20, 75, 4, 9, "#c9b98a", "#eadfb8", 0.75, 1.8);
	}
	return ink.toString();
}

/* 2. California fan palm: thick column, a shaggy petticoat of dead fans, a crown of fans. */
const CAL = { c: "#6f9a5a", c2: "#82ac6a", rib: "#4d7a3e", trunk: "#9c8264", ring: "#7d664c", skirt: "#a8875a", skirtD: "#7c6140" };
function california(st: St): string {
	const ink = new Ink();
	const o: FanO = { c: CAL.c, c2: CAL.c2, rib: CAL.rib, spread: 140, n: 11, inner: 0.72, pet: "#6b7a48" };
	if (st === "sprout") {
		ink.stroke(CAL.rib, 1.2, segD(40, 87, 38, 76) + segD(40, 87, 44, 78));
		fanAt(ink, 38, 76, -100, 7, CAL.c, { ...o, n: 7 });
		fanAt(ink, 44, 78, -55, 5.5, CAL.c2, { ...o, n: 6 });
		return ink.toString();
	}
	const leafy = st === "leafy";
	const top = leafy ? 66 : 36;
	const hw: Hw = (t) => (leafy ? 5 : 5.2) - 0.8 * t;
	const p = up(40, top);
	ink.fill(CAL.trunk, bodyD(p, hw)).stroke(CAL.ring, 0.6, ringsD(p, hw, leafy ? 5 : 12));
	const skirtBot = leafy ? top + 9 : top + 28;
	const sw = leafy ? 7 : 9.5;
	let zz = `M${pt(40 - sw + 2, top - 1)}Q${pt(40 - sw - 2, (top + skirtBot) / 2)} ${pt(40 - sw, skirtBot)}`;
	for (let i = 1; i <= 8; i++) zz += `L${pt(40 - sw + (sw * 2 * i) / 8 - sw / 8, skirtBot + (i % 2 ? 2 : 0))}`;
	zz += `L${pt(40 + sw, skirtBot)}Q${pt(40 + sw + 2, (top + skirtBot) / 2)} ${pt(40 + sw - 2, top - 1)}Z`;
	let sd = "";
	for (let i = 0; i < 7; i++) {
		const x = 40 - sw + 2 + ((sw * 2 - 4) * i) / 6;
		sd += `M${pt(x, top + 2)}L${pt(x + (x - 40) * 0.2, skirtBot - 1)}`;
	}
	ink.fill(CAL.skirt, zz).stroke(CAL.skirtD, 0.6, sd);
	const cy = top - 1;
	if (leafy) fanCrown(ink, 40, cy, [[-160, 7, 10], [-125, 8, 10], [-90, 8, 10], [-55, 8, 10], [-20, 7, 10]], o);
	else fanCrown(ink, 40, cy, [[-172, 8, 12], [-142, 9, 12], [-114, 9, 12], [-90, 9, 12], [-66, 9, 12], [-38, 9, 12], [-8, 8, 12]], o);
	return ink.toString();
}

/* 3. Bismarck palm: stout trunk, a huge sphere of stiff silver-blue fans. */
const BIS = { c: "#9fbcc4", c2: "#b6ced4", rib: "#6a8c97", back: "#7d9ea8", trunk: "#a39782", ring: "#847a66" };
function bismarck(st: St): string {
	const ink = new Ink();
	const o: FanO = { c: BIS.c, c2: BIS.c2, rib: BIS.rib, spread: 170, n: 11, inner: 0.8, pet: "#8aa2a8", petW: 1.5 };
	if (st === "sprout") {
		fanCrown(ink, 40, 86, [[-120, 9, 7], [-60, 9, 7], [-90, 4, 6]], { ...o, n: 9 });
		return ink.toString();
	}
	if (st === "leafy") {
		const p = up(40, 72);
		const hw: Hw = () => 5.5;
		ink.fill(BIS.trunk, bodyD(p, hw)).stroke(BIS.ring, 0.6, ringsD(p, hw, 4)).fill(BIS.back, ovD(40, 66, 11, 8));
		fanCrown(ink, 40, 72, [[160, 8, 11], [20, 8, 11], [-160, 10, 13], [-125, 11, 13], [-90, 11, 13], [-55, 11, 13], [-20, 10, 13]], o);
		return ink.toString();
	}
	const p = up(40, 48);
	const hw: Hw = (t) => 6 - 1.2 * t;
	ink.fill(BIS.trunk, bodyD(p, hw)).stroke(BIS.ring, 0.6, ringsD(p, hw, 10)).fill(BIS.back, ovD(40, 40, 13, 11));
	fanCrown(ink, 40, 47, [[155, 9, 13], [25, 9, 13], [-178, 10, 15], [-2, 10, 15], [-148, 11, 15], [-32, 11, 15], [-118, 11, 15], [-62, 11, 15], [-90, 11, 15]], o);
	return ink.toString();
}

/* 4. Sago palm (cycad): short shaggy trunk, a stiff rosette of glossy dark fronds, golden cone. */
const SAGO = { a: "#2f6a3a", b: "#3f8049", rib: "#2a5530", trunk: "#6b5034", scale: "#4c3824", cone: "#c9a04e", coneD: "#a07a34" };
function sago(st: St): string {
	const ink = new Ink();
	const o: FeatherO = { a: SAGO.a, b: SAGO.b, rib: SAGO.rib, droop: 0.05, ang: 68, w: 1, taper: 0.5, n: 14 };
	if (st === "sprout") {
		crown(ink, 40, 86, [[-125, -10, 14], [-60, 10, 14], [-92, 0, 11]], 3, o);
		return ink.toString();
	}
	const leafy = st === "leafy";
	const top = leafy ? 80 : 72;
	const p = seg(40, 88, 40, top);
	const hw: Hw = (t) => (leafy ? 5 : 7) - 1 * t;
	ink.fill(SAGO.trunk, bodyD(p, hw)).stroke(SAGO.scale, 0.6, hatchD(p, hw, leafy ? 3 : 6, 2.5) + hatchD(p, (t) => -hw(t), leafy ? 3 : 6, 2.5));
	if (leafy) crown(ink, 40, top, [[-170, -20, 19], [-140, -20, 21], [-112, -10, 21], [-90, 0, 19], [-68, 10, 21], [-40, 20, 21], [-10, 20, 19]], 4, o);
	else {
		crown(ink, 40, top, [[-176, -18, 26], [-154, -22, 28], [-132, -22, 29], [-111, -12, 28], [-90, 2, 26], [-69, 12, 28], [-48, 22, 29], [-26, 22, 28], [-4, 18, 26]], 5, o);
		ink.fill(SAGO.cone, ovD(40, top - 2, 6.5, 5)).stroke(SAGO.coneD, 1.2, dotsD(scatter(40, top - 2.5, 5, 3.8, 14)));
	}
	return ink.toString();
}

/* 5. Areca palm: a clump of ringed yellow canes with arching yellow-green fronds. */
const ARE = { a: "#93bd55", b: "#aecd6d", rib: "#a99641", cane: "#c9b45a", ring: "#9a8a3e" };
function areca(st: St): string {
	const ink = new Ink();
	const o: FeatherO = { a: ARE.a, b: ARE.b, rib: ARE.rib, droop: 0.35, ang: 50, w: 0.9, ribW: 0.9, n: 8 };
	const canes = pick(
		st,
		[[38, 78, -3], [42, 80, 3]] as const,
		[[36, 64, -5], [40, 56, 0], [45, 66, 6]] as const,
		[[32, 52, -9], [37, 42, -4], [43, 36, 3], [48, 46, 8], [53, 58, 12]] as const,
	);
	const L = pick(st, 9, 15, 19);
	for (const [x, top, lean] of canes) {
		const p = up(40 + lean * 0.2, top, lean - lean * 0.2 + (x - 40 - lean));
		const hw: Hw = () => (st === "sprout" ? 0.8 : 1.3);
		ink.fill(ARE.cane, bodyD(p, hw, 6)).stroke(ARE.ring, 0.5, st === "sprout" ? "" : ringsD(p, hw, 6, 0, 1, 0));
		const [tx, ty] = bez(p, 1);
		const lean2 = lean * 2;
		crown(ink, tx, ty, [[-150 + lean2, -75, L], [-30 + lean2, 75, L], [-95 + lean2, 20 + lean2, L * 0.8]], pick(st, 3, 5, 6), o);
	}
	return ink.toString();
}

/* 6. Kentia palm: slim ringed trunk, wide flat fronds with hanging leaflets, long fruit spikes. */
const KEN = { a: "#3d7a46", b: "#4f8f57", rib: "#2f5f36", trunk: "#9a9474", ring: "#787355" };
function kentia(st: St): string {
	const ink = new Ink();
	const o: FeatherO = { a: KEN.a, b: KEN.b, rib: KEN.rib, droop: 0.85, ang: 70, w: 1.7, n: 12, taper: 0.5, bare: 0.18 };
	if (st === "sprout") {
		crown(ink, 40, 87, [[-120, 30, 16], [-70, 40, 14]], 4, o);
		return ink.toString();
	}
	const leafy = st === "leafy";
	const top = leafy ? 68 : 40;
	const p = up(40, top, leafy ? 0 : 1);
	const hw: Hw = () => (leafy ? 2 : 2.5);
	ink.fill(KEN.trunk, bodyD(p, hw)).stroke(KEN.ring, 0.5, ringsD(p, hw, leafy ? 7 : 18, 0, 1, 0.2));
	const [x, y] = bez(p, 1);
	if (leafy) crown(ink, x, y, [[-160, -60, 22], [-125, -55, 22], [-92, 15, 18], [-55, 55, 22], [-20, 60, 22]], 6, o);
	else {
		tassel(ink, x - 1, y + 4, 100, 116, 2, 22, "#8a7a4a", "#b0543a", 0.9, 2.6);
		tassel(ink, x + 1, y + 4, 64, 80, 2, 20, "#8a7a4a", "#b0543a", 0.9, 2.6);
		crown(ink, x, y, [[-172, -70, 27], [-140, -70, 27], [-112, -45, 24], [-88, 12, 20], [-62, 45, 24], [-36, 70, 27], [-6, 70, 27]], 8, o);
	}
	return ink.toString();
}

/* 7. Parlor palm: small clump of thin green stems, fine fronds, beaded yellow flower sprays. */
const PAR = { a: "#58a04c", b: "#72b65e", rib: "#3f7a35", stem: "#5f8f4a", spray: "#d9822b", bead: "#f2c443" };
function parlor(st: St): string {
	const ink = new Ink();
	const o: FeatherO = { a: PAR.a, b: PAR.b, rib: PAR.rib, droop: 0.3, ang: 60, w: 1.1, n: 10 };
	const stems = pick(st, [[40, 76, 0]] as const, [[35, 60, -4], [44, 56, 3]] as const, [[31, 54, -8], [40, 44, 0], [49, 52, 7]] as const);
	const L = pick(st, 8, 13, 15);
	if (st === "bloom") {
		let sd = "";
		let bd = "";
		for (const [x0, y0, x1, y1] of [[38, 87, 25, 64], [42, 87, 56, 66]] as const) {
			sd += `M${pt(x0, y0)}Q${pt(x0 + (x1 - x0) * 0.2, y1 + 6)} ${pt(x1, y1)}`;
			for (let k = 0; k < 4; k++) {
				const t = 0.55 + k * 0.15;
				const bx = x0 + (x1 - x0) * t;
				const by = y0 + (y1 - y0) * t + 2;
				const side = x1 < x0 ? -1 : 1;
				const ex = bx + side * 5;
				const ey = by - 4 + k;
				sd += `M${pt(bx, by)}L${pt(ex, ey)}`;
				for (let s = 1; s <= 4; s++) bd += dotD(bx + ((ex - bx) * s) / 4, by + ((ey - by) * s) / 4);
			}
		}
		ink.stroke(PAR.spray, 0.8, sd).stroke(PAR.bead, 1.6, bd);
	}
	for (const [x, top, lean] of stems) {
		const p = up(40 + lean * 0.3, top, x - 40 - lean * 0.3);
		ink.stroke(PAR.stem, st === "sprout" ? 1 : 1.3, curveD(p));
		const [tx, ty] = bez(p, 1);
		const l2 = lean * 2;
		crown(ink, tx, ty, [[-160 + l2, -55, L], [-120 + l2, -30, L], [-60 + l2, 30, L], [-20 + l2, 55, L]], pick(st, 3, 4, 4.5), o);
	}
	return ink.toString();
}

/* 8. Bottle palm: a swollen bottle-shaped trunk, green crownshaft, a few strongly recurved fronds. */
const BOT = { a: "#5a9447", b: "#70a858", rib: "#3f6f33", trunk: "#b8ad98", ring: "#958b78", shaft: "#86b058" };
function bottle(st: St): string {
	const ink = new Ink();
	const o: FeatherO = { a: BOT.a, b: BOT.b, rib: BOT.rib, droop: 0.12, ang: 40, w: 1.2 };
	const top = pick(st, 79, 64, 46);
	const amp = pick(st, 2.6, 4.6, 6.8);
	const neck = pick(st, 1.2, 1.8, 2.6);
	const hw: Hw = (t) => neck + amp * Math.exp(-(((t - 0.3) / 0.28) ** 2)) + (1 - t) * 0.8;
	const p = up(40, top);
	ink.fill(BOT.trunk, bodyD(p, hw, 14)).stroke(BOT.ring, 0.5, st === "sprout" ? "" : ringsD(p, hw, pick(st, 1, 7, 12), 0, 1, 0.4));
	const sh = pick(st, 4, 7, 11);
	ink.fill(BOT.shaft, bodyD(seg(40, top + 1, 40, top - sh), (t) => neck + 0.5 - 0.4 * t));
	const cy = top - sh;
	const s = pick(st, 0.5, 0.8, 1);
	crown(ink, 40, cy, [[-160, -85, 20 * s], [-125, -90, 21 * s], [-92, -10, 15 * s], [-55, 90, 21 * s], [-20, 85, 20 * s]], 6 * s, o);
	return ink.toString();
}

/* 9. Foxtail palm: grey trunk, crownshaft, bushy bottle-brush fronds, red fruit. */
const FOX = { a: "#4f9545", b: "#68ab55", rib: "#3c7034", trunk: "#c4bfb3", ring: "#a19c90", shaft: "#7db35d", fruit: "#d8432b" };
function foxtail(st: St): string {
	const ink = new Ink();
	const o: FeatherO = { a: FOX.a, b: FOX.b, rib: FOX.rib, droop: 0.1, ang: 30, plume: [100], w: 1.1, taper: 0.15, n: 10 };
	if (st === "sprout") {
		crown(ink, 40, 87, [[-110, -15, 15], [-70, 20, 13]], 2.8, o);
		return ink.toString();
	}
	const leafy = st === "leafy";
	const top = leafy ? 66 : 42;
	const p = up(40, top);
	const hw: Hw = (t) => (leafy ? 2.8 : 3.2) - 0.5 * t;
	ink.fill(FOX.trunk, bodyD(p, hw)).stroke(FOX.ring, 0.5, ringsD(p, hw, leafy ? 6 : 16, 0, 1, 0.3));
	const sh = leafy ? 7 : 11;
	ink.fill(FOX.shaft, bodyD(seg(40, top + 1, 40, top - sh), (t) => (leafy ? 2.8 : 3.4) - 0.7 * t));
	const cy = top - sh;
	if (leafy) crown(ink, 40, cy, [[-160, -50, 18], [-120, -40, 18], [-90, 0, 15], [-60, 40, 18], [-20, 50, 18]], 4.4, o);
	else {
		crown(ink, 40, cy, [[-168, -50, 24], [-132, -45, 25], [-100, -15, 21], [-74, 20, 21], [-44, 45, 25], [-10, 50, 24]], 5.6, o);
		ink.stroke("#b39a5a", 0.7, segD(38.5, top + 1, 34, top + 4) + segD(41.5, top + 1, 46, top + 4)).stroke(FOX.fruit, 2.5, dotsD(scatter(33.5, top + 7, 3.6, 4.2, 12)) + dotsD(scatter(46.5, top + 7, 3.6, 4.2, 12)));
	}
	return ink.toString();
}

/* 10. Windmill palm: hairy brown trunk, stiff dark fans on long petioles, yellow flower clusters. */
const WIN = { c: "#3e7a45", c2: "#4c8a50", rib: "#2c5c33", trunk: "#5c4432", fibre: "#86664a", flower: "#e2c34a" };
function windmill(st: St): string {
	const ink = new Ink();
	const o: FanO = { c: WIN.c, c2: WIN.c2, rib: WIN.rib, spread: 190, n: 14, inner: 0.5, pet: "#5d6b3c", petW: 1 };
	if (st === "sprout") {
		fanCrown(ink, 40, 87, [[-115, 10, 6], [-70, 13, 6.5]], { ...o, n: 10 });
		return ink.toString();
	}
	const leafy = st === "leafy";
	const top = leafy ? 68 : 40;
	const p = up(40, top);
	const hw: Hw = (t) => (leafy ? 2.4 : 2.6) + (leafy ? 1 : 1.6) * t;
	ink.fill(WIN.trunk, bodyD(p, hw)).stroke(WIN.fibre, 0.6, hatchD(p, hw, leafy ? 6 : 14, 3) + hatchD(p, (t) => -hw(t), leafy ? 5 : 13, 2.4, 0.04, 1));
	if (leafy) fanCrown(ink, 40, top, [[-160, 9, 8], [-122, 11, 8], [-90, 10, 8], [-58, 11, 8], [-20, 9, 8]], o);
	else {
		ink.stroke(WIN.flower, 2, dotsD(scatter(32.5, top + 5, 3.4, 4.4, 14)) + dotsD(scatter(47.5, top + 5, 3.4, 4.4, 14)));
		fanCrown(ink, 40, top, [[-168, 11, 10], [-134, 14, 10.5], [-104, 15, 10.5], [-76, 15, 10.5], [-46, 14, 10.5], [-12, 11, 10]], o);
	}
	return ink.toString();
}

/* 11. Chinese fan palm: glossy fans whose segment tips hang in a weeping fringe, blue-green fruit. */
const CHI = { c: "#6aa656", c2: "#7db766", rib: "#4b7f3c", trunk: "#a89272", ring: "#88745a", fruit: "#5e9ea8" };
function chineseFan(st: St): string {
	const ink = new Ink();
	const o: FanO = { c: CHI.c, c2: CHI.c2, rib: CHI.rib, spread: 160, n: 10, inner: 0.72, weep: 5, pet: "#5f8a48" };
	if (st === "sprout") {
		fanCrown(ink, 40, 87, [[-110, 11, 6.5], [-65, 8, 5.5]], { ...o, n: 8, weep: 3 });
		return ink.toString();
	}
	const leafy = st === "leafy";
	const top = leafy ? 70 : 44;
	const p = up(40, top);
	const hw: Hw = (t) => 3.8 - 0.6 * t;
	ink.fill(CHI.trunk, bodyD(p, hw)).stroke(CHI.ring, 0.6, ringsD(p, hw, leafy ? 5 : 14));
	if (leafy) fanCrown(ink, 40, top, [[-160, 8, 10], [-125, 9, 10], [-90, 9, 10], [-55, 9, 10], [-20, 8, 10]], { ...o, weep: 4 });
	else {
		ink.stroke("#7b6a44", 0.6, segD(37, top, 33, top + 6) + segD(43, top, 47, top + 6)).stroke(CHI.fruit, 2.6, dotsD(scatter(33, top + 8.5, 3, 3.6, 9)) + dotsD(scatter(47, top + 8.5, 3, 3.6, 9)));
		fanCrown(ink, 40, top - 1, [[-172, 9, 12], [-142, 10, 12], [-114, 10, 12], [-90, 10, 12], [-66, 10, 12], [-38, 10, 12], [-8, 9, 12]], o);
	}
	return ink.toString();
}

/* 12. Pygmy date palm: a few slim knobbly trunks, fine soft fronds, dark purple dates. */
const PYG = { a: "#4f8a40", b: "#62a050", rib: "#3a6a30", trunk: "#6e5a40", knob: "#4e3e2a", date: "#7a3e62" };
function pygmyDate(st: St): string {
	const ink = new Ink();
	const o: FeatherO = { a: PYG.a, b: PYG.b, rib: PYG.rib, droop: 0.45, ang: 50, w: 0.9, n: 8, taper: 0.6 };
	if (st === "sprout") {
		ink.fill(PYG.trunk, bodyD(up(40, 82), () => 1.6));
		crown(ink, 40, 82, [[-150, -40, 11], [-95, 5, 10], [-30, 40, 11]], 3.5, o);
		return ink.toString();
	}
	const trunks = st === "leafy" ? ([[40, 64, 0]] as const) : ([[29, 54, -1], [40, 42, 0], [52, 58, 1]] as const);
	const L = st === "leafy" ? 15 : 17;
	for (const [x, top, side] of trunks) {
		const p = up(40 + side * 3, top, x - 40 - side * 3);
		const hw: Hw = () => 2;
		ink.fill(PYG.trunk, bodyD(p, hw, 6)).stroke(PYG.knob, 0.7, hatchD(p, hw, Math.round((88 - top) / 3.5), 1.5));
	}
	for (const [x, top, side] of trunks) {
		const s = side * 12;
		const fr: Fr = [[-168 + s, -55, L], [-128 + s, -45, L], [-90 + s, 0, L * 0.85], [-52 + s, 45, L], [-12 + s, 55, L]];
		crown(ink, x, top, side < 0 ? fr.slice(0, 4) : side > 0 ? fr.slice(1) : fr, 5, o);
		if (st === "bloom") ink.stroke(PYG.date, 2.1, dotsD(scatter(x - 3, top + 5, 2.4, 3, 8)) + dotsD(scatter(x + 3, top + 5, 2.4, 3, 8)));
	}
	return ink.toString();
}

/* 13. Traveller's palm: paddle leaves on long stalks spread in one flat fan. */
const TRV = { a: "#5a9a50", b: "#6fae5c", rib: "#c8dc9a", pet: "#7f9e5a", trunk: "#a7a39a", ring: "#86827a", sheath: "#6f9a52" };
function traveller(st: St): string {
	const ink = new Ink();
	const k = pick(st, 3, 6, 10);
	const pet = pick(st, 7, 12, 15);
	const L = pick(st, 7, 12, 15);
	const W = pick(st, 2, 3, 3.6);
	const top = pick(st, 87, 84, 60);
	if (st === "bloom") {
		const p = up(40, top);
		const hw: Hw = () => 3.6;
		ink.fill(TRV.trunk, bodyD(p, hw)).stroke(TRV.ring, 0.6, ringsD(p, hw, 9));
	}
	const span = pick(st, 70, 130, 156);
	let pd = "";
	let rd = "";
	let td = "";
	const tops: [number, number, number][] = [];
	for (let i = 0; i < k; i++) {
		const a = -90 - span / 2 + (span * i) / (k - 1);
		const ex = 40 + Math.cos(a * rad) * pet;
		const ey = top + Math.sin(a * rad) * pet;
		pd += segD(40, top, ex, ey);
		tops.push([ex, ey, a]);
	}
	ink.stroke(TRV.pet, pick(st, 1, 1.5, 1.8), pd);
	if (st !== "sprout") ink.fill(TRV.sheath, `M${pt(37, top + 1)}L${pt(43, top + 1)}L${pt(40 + pet * 0.35, top - pet * 0.3)}L${pt(40 - pet * 0.35, top - pet * 0.3)}Z`);
	tops.forEach(([x, y, a], i) => {
		ink.fill(i % 2 ? TRV.b : TRV.a, strapD(x, y, a, L, W));
		const P = mapper(x, y, a);
		rd += `M${P(0.5, 0)}L${P(L * 0.92, 0)}`;
		if (st !== "sprout") td += `M${P(L * 0.45, -W * 0.9)}L${P(L * 0.5, -W * 0.25)}M${P(L * 0.7, W * 0.85)}L${P(L * 0.74, W * 0.25)}`;
	});
	ink.stroke(TRV.rib, 0.7, rd);
	if (td) ink.stroke(CUT, 0.7, td);
	return ink.toString();
}

/* 14. Fishtail palm: twice-divided fronds of jagged wedge leaflets, long hanging fruit tassels. */
const FIS = { a: "#4d8f45", b: "#62a452", rib: "#3a6a32", trunk: "#9a9688", ring: "#7a766a", strand: "#7a6a48", fruit: "#8c2f4c" };
function wedgeD(x: number, y: number, deg: number, len: number, w: number): string {
	const P = mapper(x, y, deg);
	return `M${P(0, 0)}L${P(len, -w * 0.8)}L${P(len * 0.84, -w * 0.05)}L${P(len * 0.96, w * 0.5)}Z`;
}
/** A twice-divided frond: side branches every second node, each ending in a pair of wedge leaflets. */
function fishFrond(ink: Ink, x: number, y: number, deg: number, len: number, bend: number, s: number): void {
	const n = 6;
	const step = len / n;
	let t = deg * rad;
	let px = x;
	let py = y;
	let d = `M${pt(x, y)}`;
	let bd = "";
	for (let j = 1; j <= n; j++) {
		t += (bend * rad) / n;
		px += Math.cos(t) * step;
		py += Math.sin(t) * step;
		d += `L${pt(px, py)}`;
		if (j % 2 === 0) {
			const bl = (j === n ? 3.5 : 7.5 - j * 0.5) * s;
			for (const side of j === n ? [0] : [-1, 1]) {
				const bb = t + side * 52 * rad;
				const mx = px + Math.cos(bb) * bl * 0.5;
				const my = py + Math.sin(bb) * bl * 0.5;
				const ex = px + Math.cos(bb) * bl;
				const ey = py + Math.sin(bb) * bl;
				bd += `M${pt(px, py)}L${pt(ex, ey)}`;
				const bdg = bb / rad;
				ink.fill(FIS.a, wedgeD(mx, my, bdg + (side || 1) * 50, 3.4 * s, 2.4 * s) + wedgeD(ex, ey, bdg - 22, 3.6 * s, 2.5 * s));
				ink.fill(FIS.b, wedgeD(ex, ey, bdg + 22, 3.6 * s, 2.5 * s));
			}
		}
	}
	ink.stroke(FIS.rib, 0.6, bd).stroke(FIS.rib, 1.1, d);
}
function fishtail(st: St): string {
	const ink = new Ink();
	if (st === "sprout") {
		fishFrond(ink, 40, 87, -100, 15, 25, 0.8);
		fishFrond(ink, 40, 87, -60, 9, 20, 0.6);
		return ink.toString();
	}
	const leafy = st === "leafy";
	const top = leafy ? 72 : 40;
	const p = up(40, top);
	const hw: Hw = () => (leafy ? 2.2 : 2.8);
	ink.fill(FIS.trunk, bodyD(p, hw)).stroke(FIS.ring, 0.5, ringsD(p, hw, leafy ? 5 : 11, 0, 1, 0.2));
	if (!leafy) {
		tassel(ink, 37, top + 5, 98, 122, 4, 20, FIS.strand, FIS.fruit, 0.95, 4);
		tassel(ink, 43, top + 5, 58, 82, 4, 20, FIS.strand, FIS.fruit, 0.95, 4);
	}
	const fr = leafy
		? ([[-160, -40, 19], [-118, -30, 18], [-86, 10, 15], [-55, 35, 18], [-18, 40, 19]] as const)
		: ([[-165, -40, 25], [-125, -35, 25], [-90, 10, 21], [-55, 35, 25], [-15, 40, 25]] as const);
	for (const [d, b, L] of fr) fishFrond(ink, 40, top, d, L, b, leafy ? 0.85 : 1);
	return ink.toString();
}

/* 15. Lady palm: a clump of thin fibrous canes with small hand-like fans of broad blunt fingers. */
const LADY = { a: "#3f7f45", b: "#52944f", rib: "#2c5c32", cane: "#4e3f30", fibre: "#75604a" };
function ladyFan(ink: Ink, x: number, y: number, dir: number, r: number, k: number, c: string): void {
	let d = "";
	for (let i = 0; i < k; i++) d += strapD(x, y, dir - 70 + (140 * i) / (k - 1), r * (1 - Math.abs(i - (k - 1) / 2) * 0.08), r * 0.17);
	ink.fill(c, d);
}
function lady(st: St): string {
	const ink = new Ink();
	const canes = pick(
		st,
		[[40, 74, 0]] as const,
		[[34, 60, -1], [44, 54, 1]] as const,
		[[28, 58, -1], [34, 44, -1], [41, 36, 0], [47, 46, 1], [53, 60, 1]] as const,
	);
	const r = pick(st, 7, 9, 10);
	for (const [x, top] of canes) {
		const p = up(40 + (x - 40) * 0.25, top, (x - 40) * 0.75);
		const hw: Hw = () => (st === "sprout" ? 0.7 : 1.1);
		ink.fill(LADY.cane, bodyD(p, hw, 6));
		if (st !== "sprout") ink.stroke(LADY.fibre, 0.5, hatchD(p, hw, Math.round((88 - top) / 4), 1.6));
	}
	canes.forEach(([x, top], i) => {
		const dir = -90 + (x - 40) * 2;
		const c = i % 2 ? LADY.b : LADY.a;
		ladyFan(ink, x, top, dir, r, st === "sprout" ? 4 : 6, c);
		if (st !== "sprout") {
			const p = up(40 + (x - 40) * 0.25, top, (x - 40) * 0.75);
			const [lx, ly] = bez(p, 0.72);
			const side = x === 40 || x === 41 ? (i % 2 ? 1 : -1) : Math.sign(x - 40);
			ladyFan(ink, lx, ly, -90 + side * 62, r * 0.85, 5, i % 2 ? LADY.a : LADY.b);
		}
	});
	return ink.toString();
}

/* 16. Queen palm: grey trunk, plumy weeping fronds, hanging bunches of orange fruit. */
const QUE = { a: "#5d9e4c", b: "#78b462", rib: "#447a38", trunk: "#a3a097", ring: "#85827a", fruit: "#e88a2a", spathe: "#8a6a40" };
function queen(st: St): string {
	const ink = new Ink();
	const o: FeatherO = { a: QUE.a, b: QUE.b, rib: QUE.rib, droop: 0.7, ang: 45, plume: [90], w: 1, taper: 0.55, n: 8 };
	if (st === "sprout") {
		crown(ink, 40, 87, [[-115, 25, 16], [-75, 30, 13]], 3.5, o);
		return ink.toString();
	}
	const leafy = st === "leafy";
	const top = leafy ? 68 : 36;
	const p = up(40, top, leafy ? 0 : 1.5);
	const hw: Hw = (t) => 3.2 - 0.3 * t;
	ink.fill(QUE.trunk, bodyD(p, hw)).stroke(QUE.ring, 0.5, ringsD(p, hw, leafy ? 6 : 16, 0, 1, 0.3));
	const [x, y] = bez(p, 1);
	if (leafy) crown(ink, x, y, [[-165, -65, 20], [-128, -60, 20], [-92, 15, 16], [-55, 60, 20], [-15, 65, 20]], 6, o);
	else {
		ink.fill(QUE.spathe, lensD(x - 2, y + 2, 125, 13, 2.2));
		tassel(ink, x - 3, y + 6, 100, 130, 6, 16, "#b0874a", QUE.fruit, 1.1, 2.6);
		tassel(ink, x + 3, y + 5, 55, 80, 5, 14, "#b0874a", QUE.fruit, 1.1, 2.6);
		crown(ink, x, y, [[-172, -75, 27], [-142, -75, 27], [-112, -50, 24], [-88, 8, 19], [-62, 50, 24], [-34, 75, 27], [-6, 75, 27]], 7.5, o);
	}
	return ink.toString();
}

/* 17. Oil palm: stout trunk studded with old leaf bases, dense dark crown, red-and-black fruit bunches. */
const OIL = { a: "#3d7436", b: "#4f8a45", rib: "#2f5a2a", trunk: "#7a6146", stub: "#5a4630", fruit: "#d9532c", tip: "#2e1d18", shine: "#f08a4a" };
function oil(st: St): string {
	const ink = new Ink();
	const o: FeatherO = { a: OIL.a, b: OIL.b, rib: OIL.rib, droop: 0.35, ang: 55, w: 1.2, n: 12 };
	if (st === "sprout") {
		crown(ink, 40, 87, [[-120, -10, 15], [-68, 15, 14], [-94, 0, 12]], 3.5, o);
		return ink.toString();
	}
	const leafy = st === "leafy";
	const top = leafy ? 74 : 46;
	const p = up(40, top);
	const hw: Hw = () => (leafy ? 5 : 5.6);
	let sd = "";
	for (let y = 85, i = 0; y > top + 1; y -= 4.2, i++) {
		for (const x of i % 2 ? [37.2, 42.8] : [35, 40, 45]) sd += `M${pt(x - 1.6, y)}L${pt(x, y - 3.6)}L${pt(x + 1.6, y)}Z`;
	}
	ink.fill(OIL.trunk, bodyD(p, hw)).fill(OIL.stub, sd);
	if (leafy) crown(ink, 40, top, [[-172, -40, 19], [-140, -40, 20], [-110, -20, 19], [-90, 0, 17], [-70, 20, 19], [-40, 40, 20], [-8, 40, 19]], 5, o);
	else {
		crown(ink, 40, top - 2, [[-178, -40, 24], [-155, -45, 25], [-130, -35, 24], [-108, -20, 22], [-89, 4, 20], [-68, 25, 22], [-45, 35, 24], [-22, 45, 25], [-1, 40, 24]], 6, o);
		const bunch = scatter(40, top + 1, 7.5, 4.5, 24);
		ink.fill(OIL.tip, ovD(40, top + 1.3, 8, 5)).stroke(OIL.fruit, 2.5, dotsD(bunch.filter((_, i) => i % 4 !== 3))).stroke(OIL.shine, 0.8, dotsD(bunch.filter((_, i) => i % 5 === 1).map(([x, y]) => [x - 0.4, y - 0.4] as const)));
	}
	return ink.toString();
}

/* 18. Cabbage palmetto: criss-cross "boot" leaf bases, a dense round head of curved fans, cream flower sprays. */
const CAB = { c: "#6c9858", c2: "#82ab6a", rib: "#4d7a3e", trunk: "#a58b68", boot: "#7d6648", flower: "#e8d9a6", spray: "#a8976a" };
function cabbage(st: St): string {
	const ink = new Ink();
	const o: FanO = { c: CAB.c, c2: CAB.c2, rib: CAB.rib, spread: 140, n: 10, inner: 0.76, pet: "#6b7d48" };
	if (st === "sprout") {
		fanCrown(ink, 40, 87, [[-112, 7, 7], [-68, 6, 6]], { ...o, n: 7 });
		return ink.toString();
	}
	const leafy = st === "leafy";
	const top = leafy ? 72 : 44;
	const p = up(40, top);
	const hw: Hw = () => (leafy ? 4.2 : 3.8);
	let bd = "";
	const y0 = leafy ? 86 : 70;
	for (let y = y0; y > top + 2; y -= 4) bd += `M${pt(36.6, y)}L${pt(43.4, y - 4)}M${pt(43.4, y)}L${pt(36.6, y - 4)}`;
	ink.fill(CAB.trunk, bodyD(p, hw)).stroke(CAB.boot, 0.9, bd);
	if (!leafy) ink.stroke(CAB.boot, 0.5, ringsD(p, hw, 5, 0, 0.36, 0.3));
	if (leafy) fanCrown(ink, 40, top, [[-165, 6, 10], [-130, 7, 10], [-92, 7, 10], [-55, 7, 10], [-18, 6, 10]], o);
	else {
		let sd = "";
		let fd = "";
		for (const side of [-1, 1]) {
			const ex = 40 + side * 24;
			sd += `M${pt(40 + side * 3, top - 2)}Q${pt(40 + side * 18, top - 6)} ${pt(ex, top + 10)}`;
			for (let k = 0; k <= 6; k++) {
				const t = 0.35 + k * 0.11;
				const bx = (1 - t) ** 2 * (40 + side * 3) + 2 * (1 - t) * t * (40 + side * 18) + t * t * ex;
				const by = (1 - t) ** 2 * (top - 2) + 2 * (1 - t) * t * (top - 6) + t * t * (top + 10);
				fd += dotD(bx, by + 1.6) + dotD(bx + side * 0.6, by - 1.2);
			}
		}
		fanCrown(ink, 40, top - 4, [[150, 6, 10], [30, 6, 10], [-176, 7, 11], [-4, 7, 11], [-148, 8, 11], [-32, 8, 11], [-120, 8, 11], [-60, 8, 11], [-90, 8, 11]], o);
		ink.stroke(CAB.spray, 0.7, sd).stroke(CAB.flower, 2.1, fd);
	}
	return ink.toString();
}

/* 19. Triangle palm: leaf bases stacked in three ranks forming a triangle, stiff blue-grey fronds in a V. */
const TRI = { a: "#7ba28a", b: "#90b59d", rib: "#5c7f69", trunk: "#9c988e", ring: "#7c786e", base: "#9a8670", baseD: "#76644f", wool: "#c2b29a" };
function triangle(st: St): string {
	const ink = new Ink();
	const o: FeatherO = { a: TRI.a, b: TRI.b, rib: TRI.rib, droop: 0.05, ang: 35, w: 1.1, n: 12, taper: 0.55, bare: 0.12 };
	if (st === "sprout") {
		crown(ink, 40, 87, [[-110, 0, 15], [-70, 0, 15]], 3, o);
		return ink.toString();
	}
	const leafy = st === "leafy";
	const tb = leafy ? 86 : 70;
	const tt = leafy ? 70 : 48;
	const half = leafy ? 9 : 13;
	if (!leafy) {
		const p = seg(40, 88, 40, 69);
		const hw: Hw = () => 4;
		ink.fill(TRI.trunk, bodyD(p, hw)).stroke(TRI.ring, 0.6, ringsD(p, hw, 5));
	}
	ink.fill(TRI.base, `M${pt(36, tb)}L${pt(44, tb)}L${pt(40 + half, tt)}L${pt(40 - half, tt)}Z`);
	let vd = "";
	for (let k = 1; k <= 3; k++) vd += `M${pt(40, tb - 1)}L${pt(40 - half * (0.35 * k), tt + 1)}M${pt(40, tb - 1)}L${pt(40 + half * (0.35 * k), tt + 1)}`;
	ink.stroke(TRI.baseD, 0.6, vd).fill(TRI.wool, ovD(40, tt + 1.2, half * 0.55, 1.2));
	const L = leafy ? 22 : 32;
	const lf = leafy ? 4.5 : 6;
	crown(ink, 40 - half + 1, tt + 1, [[-125, -20, L]], lf, o);
	crown(ink, 40 + half - 1, tt + 1, [[-55, 20, L]], lf, o);
	crown(ink, 40 - half * 0.5, tt + 1, [[-108, -12, L * 1.05]], lf, o);
	crown(ink, 40 + half * 0.5, tt + 1, [[-72, 12, L * 1.05]], lf, o);
	crown(ink, 40, tt + 1, [[-90, -8, L * 0.85]], lf, o);
	if (!leafy) {
		crown(ink, 40 - half + 3, tt + 4, [[-150, -35, L * 0.85]], lf, o);
		crown(ink, 40 + half - 3, tt + 4, [[-30, 35, L * 0.85]], lf, o);
	}
	return ink.toString();
}

/* 20. Coco de mer: huge pleated fans and the famous double coconut. */
const COC = { c: "#3f7a46", c2: "#4f8d52", rib: "#2c5a33", trunk: "#8f8676", ring: "#706858", nut: "#5b3c24", nutHi: "#86603e", fruit: "#6e7034", fruitHi: "#8d8f48" };
function nutD(x: number, y: number, s: number): string {
	return ovD(x - 2.9 * s, y, 3.5 * s, 4.3 * s) + ovD(x + 2.9 * s, y, 3.5 * s, 4.3 * s);
}
function cocoDeMer(st: St): string {
	const ink = new Ink();
	const o: FanO = { c: COC.c, c2: COC.c2, rib: COC.rib, spread: 140, n: 12, inner: 0.9, pet: "#5d6b40", petW: 1.4 };
	if (st === "sprout") {
		ink.stroke(COC.rib, 1.6, `M${pt(40, 80)}Q${pt(40, 74)} ${pt(41, 70)}`);
		fanAt(ink, 41, 70, -92, 7.5, COC.c, { ...o, n: 8 });
		ink.fill(COC.nut, nutD(40, 83.5, 0.95)).stroke("#3a2616", 0.6, segD(40, 80, 40, 87)).fill(COC.nutHi, ovD(36.6, 81.5, 1.2, 1.6) + ovD(42.4, 81.5, 1.2, 1.6));
		return ink.toString();
	}
	if (st === "leafy") {
		fanCrown(ink, 42, 86, [[-120, 22, 13], [-64, 22, 13], [-92, 30, 12]], o);
		ink.fill(COC.nut, nutD(29, 84.5, 0.8)).stroke("#3a2616", 0.5, segD(29, 81.5, 29, 87.5)).fill(COC.nutHi, ovD(26.3, 83, 1, 1.3) + ovD(31.3, 83, 1, 1.3));
		return ink.toString();
	}
	const top = 42;
	const p = up(40, top);
	const hw: Hw = () => 3;
	ink.fill(COC.trunk, bodyD(p, hw)).stroke(COC.ring, 0.6, ringsD(p, hw, 10));
	fanCrown(ink, 40, top, [[-165, 9, 14], [-128, 10, 14], [-90, 10, 14], [-52, 10, 14], [-15, 9, 14]], o);
	ink.fill(COC.fruit, nutD(34, top + 7, 0.62) + nutD(46, top + 7, 0.62) + nutD(40, top + 9, 0.62)).stroke(COC.fruitHi, 1.4, dotsD([[31.8, top + 5.5], [44.8, top + 5.5], [38.8, top + 7.5]]));
	ink.fill(COC.nut, nutD(53, 84.3, 0.75)).stroke("#3a2616", 0.5, segD(53, 81.3, 53, 87.3)).fill(COC.nutHi, ovD(50.5, 82.8, 0.9, 1.2) + ovD(55.3, 82.8, 0.9, 1.2));
	return ink.toString();
}

/* 21. Raffia palm: a short trunk shooting up enormous plume-like fronds, scaly fruit on hanging ropes. */
const RAF = { a: "#4f8c43", b: "#64a052", rib: "#b0682e", trunk: "#6d5338", fibre: "#8a6c4a", fruit: "#8b4a26", scale: "#5c2c14", shine: "#c07a48" };
function raffia(st: St): string {
	const ink = new Ink();
	const o: FeatherO = { a: RAF.a, b: RAF.b, rib: RAF.rib, droop: 0.55, ang: 50, w: 1, ribW: 1.3, n: 14, taper: 0.6, bare: 0.12 };
	if (st === "sprout") {
		crown(ink, 40, 87, [[-100, -8, 20], [-80, 8, 18]], 3.5, o);
		return ink.toString();
	}
	const leafy = st === "leafy";
	const top = leafy ? 84 : 74;
	if (!leafy) {
		const p = seg(40, 88, 40, top);
		const hw: Hw = (t) => 5 - t;
		ink.fill(RAF.trunk, bodyD(p, hw)).stroke(RAF.fibre, 0.6, hatchD(p, hw, 4, 2.5));
	}
	if (leafy) crown(ink, 40, top, [[-135, -20, 30], [-112, -10, 36], [-90, 0, 38], [-68, 10, 36], [-45, 20, 30]], 4.5, o);
	else {
		crown(ink, 40, top, [[-140, -30, 40], [-120, -18, 50], [-101, -8, 56], [-80, 8, 56], [-60, 18, 50], [-40, 30, 40]], 5.5, o);
		let fd = "";
		let sc = "";
		let hi = "";
		let rope = "";
		for (const [x0, x1, y1] of [[37, 27, 84], [43, 54, 82]] as const) {
			rope += `M${pt(x0, top - 1)}Q${pt(x1 + (x0 - x1) * 0.2, top - 2)} ${pt(x1, y1 - 3)}`;
			for (const [dx, dy] of [[0, 0], [-2.6, -3.6], [2.4, -3.2]] as const) {
				const x = x1 + dx * (x1 < 40 ? 1 : -1);
				const y = y1 + dy;
				fd += ovD(x, y, 2, 2.7);
				sc += `M${pt(x - 1.6, y - 1.2)}L${pt(x + 1.6, y + 0.8)}M${pt(x + 1.6, y - 1.2)}L${pt(x - 1.6, y + 0.8)}`;
				hi += dotD(x - 0.8, y - 1.2);
			}
		}
		ink.stroke("#7a5a36", 0.8, rope).fill(RAF.fruit, fd).stroke(RAF.scale, 0.45, sc).stroke(RAF.shine, 1, hi);
	}
	return ink.toString();
}

/* 22. Talipot palm: thick trunk, huge fans, and its once-in-a-lifetime towering cream flower plume. */
const TAL = { c: "#5f9a4f", c2: "#73ac5f", rib: "#467a3a", trunk: "#a29d92", ring: "#827d72", plume: "#e9daa6", branch: "#b39f68" };
function talipot(st: St): string {
	const ink = new Ink();
	const o: FanO = { c: TAL.c, c2: TAL.c2, rib: TAL.rib, spread: 165, n: 14, inner: 0.74, pet: "#6c7c48", petW: 1.4 };
	if (st === "sprout") {
		fanCrown(ink, 40, 87, [[-90, 9, 8]], { ...o, n: 10 });
		return ink.toString();
	}
	if (st === "leafy") {
		const p = up(40, 72);
		const hw: Hw = () => 4.6;
		ink.fill(TAL.trunk, bodyD(p, hw)).stroke(TAL.ring, 0.6, ringsD(p, hw, 4));
		fanCrown(ink, 40, 72, [[-160, 8, 13], [-125, 10, 13], [-90, 10, 13], [-55, 10, 13], [-20, 8, 13]], o);
		return ink.toString();
	}
	const top = 58;
	const p = up(40, top);
	const hw: Hw = () => 4.8;
	ink.fill(TAL.trunk, bodyD(p, hw)).stroke(TAL.ring, 0.6, ringsD(p, hw, 8));
	fanCrown(ink, 40, top, [[160, 8, 12], [20, 8, 12], [-176, 10, 14], [-4, 10, 14], [-145, 10, 14], [-35, 10, 14]], o);
	let bd = `M${pt(40, top - 4)}L${pt(40, 6)}`;
	let fd = "";
	for (let k = 0; k < 9; k++) {
		const y = top - 8 - k * 5.4;
		const L = 15 * (1 - k / 9.5) + 1.5;
		for (const side of [-1, 1]) {
			const ex = 40 + side * L;
			bd += `M${pt(40, y)}Q${pt(40 + side * L * 0.6, y - 2.5)} ${pt(ex, y + 1.5)}`;
			for (let s = 0.3; s <= 1.01; s += 0.23) fd += dotD(40 + side * L * s, y - 1.6 * Math.sin(s * Math.PI) + 1.5 * s * s);
		}
	}
	fd += dotD(40, 6.5);
	ink.stroke(TAL.branch, 1, bd).stroke(TAL.plume, 2.7, fd);
	return ink.toString();
}

/* 23. Cardboard palm (cycad): low rosette of stiff fronds with broad oval leathery leaflets, rust cones. */
const CAR = { a: "#7c9c52", b: "#8fae62", rib: "#5f7038", caudex: "#7a5c3c", cone: "#9a5a34", coneD: "#6e3c20" };
function cardFrond(ink: Ink, x: number, y: number, deg: number, len: number, bend: number, lf: number): void {
	const n = 7;
	const step = len / n;
	let t = deg * rad;
	let px = x;
	let py = y;
	let d = `M${pt(x, y)}`;
	let la = "";
	let lb = "";
	for (let j = 1; j <= n; j++) {
		t += (bend * rad) / n;
		px += Math.cos(t) * step;
		py += Math.sin(t) * step;
		d += `L${pt(px, py)}`;
		if (j >= 2) {
			const l = lf * (j === n ? 0.8 : 1 - (j / n) * 0.25);
			la += lensD(px, py, t / rad - 62, l, l * 0.42);
			lb += lensD(px, py, t / rad + 62, l, l * 0.42);
		}
	}
	ink.fill(CAR.a, la).fill(CAR.b, lb).stroke(CAR.rib, 0.9, d);
}
function cardboard(st: St): string {
	const ink = new Ink();
	if (st === "sprout") {
		for (const [d, b, L] of [[-120, -10, 13], [-62, 12, 13]] as const) cardFrond(ink, 40, 87, d, L, b, 3.6);
		return ink.toString();
	}
	const leafy = st === "leafy";
	const y = leafy ? 84 : 81;
	ink.fill(CAR.caudex, ovD(40, y + 2, leafy ? 4.5 : 6.5, leafy ? 3.5 : 5));
	const fr = leafy
		? ([[-165, -20, 18], [-128, -15, 19], [-90, 0, 17], [-52, 15, 19], [-15, 20, 18]] as const)
		: ([[-172, -25, 23], [-145, -25, 24], [-118, -15, 25], [-90, 0, 22], [-62, 15, 25], [-35, 25, 24], [-8, 25, 23]] as const);
	for (const [d, b, L] of fr) cardFrond(ink, 40, y, d, L, b, leafy ? 4.6 : 5.6);
	if (!leafy) {
		let cd = "";
		let rd = "";
		for (const [x, h, tilt] of [[34.5, 11, -14], [40, 14, 0], [45.5, 11, 14]] as const) {
			cd += strapD(x, y + 1, -90 + tilt, h, 2.6);
			const P = mapper(x, y + 1, -90 + tilt);
			for (let k = 2.5; k < h - 1.5; k += 2.2) rd += `M${P(k, -2.1)}L${P(k + 0.8, 0)}L${P(k, 2.1)}`;
		}
		ink.fill(CAR.cone, cd).stroke(CAR.coneD, 0.55, rd);
	}
	return ink.toString();
}

/* 24. Mediterranean fan palm: a clump of short shaggy trunks, stiff deeply split grey-green fans. */
const MED = { c: "#7e9b78", c2: "#94ae8b", rib: "#5c7656", trunk: "#6b5642", fibre: "#8e765c", fruit: "#c47a2e" };
function medFan(st: St): string {
	const ink = new Ink();
	const o: FanO = { c: MED.c, c2: MED.c2, spread: 180, n: 10, inner: 0.36, pet: "#7b8a5e", petW: 1 };
	if (st === "sprout") {
		fanCrown(ink, 40, 87, [[-115, 9, 6.5], [-68, 7, 5.5]], { ...o, n: 10 });
		return ink.toString();
	}
	const trunks = st === "leafy" ? ([[34, 76], [46, 72]] as const) : ([[27, 64], [40, 52], [54, 68]] as const);
	const r = st === "leafy" ? 8 : 9.5;
	for (const [x, top] of trunks) {
		const p = up(40 + (x - 40) * 0.3, top, (x - 40) * 0.7);
		const hw: Hw = (t) => 2.4 + 0.5 * t;
		ink.fill(MED.trunk, bodyD(p, hw, 6)).stroke(MED.fibre, 0.6, hatchD(p, hw, Math.round((88 - top) / 3), 2.2));
	}
	for (const [x, top] of trunks) {
		const s = (x - 40) * 1.2;
		fanCrown(ink, x, top, [[-155 + s, 6, r], [-112 + s, 8, r], [-68 + s, 8, r], [-25 + s, 6, r]], o);
	}
	if (st === "bloom") ink.stroke(MED.fruit, 2.1, dotsD(scatter(36.5, 57, 2.4, 2.6, 7)) + dotsD(scatter(43.5, 57, 2.4, 2.6, 7)));
	return ink.toString();
}

/* 25. Sealing wax palm: a clump of canes topped by brilliant red crownshafts and red-stalked fronds. */
const SEA = { a: "#4f8f45", b: "#62a454", rib: "#c8382b", dark: "#3a6a32", cane: "#7d8a4a", ring: "#5e6a34", shaft: "#d63a2c" };
function sealingWax(st: St): string {
	const ink = new Ink();
	const o: FeatherO = { a: SEA.a, b: SEA.b, rib: SEA.dark, petC: SEA.rib, bare: 0.22, droop: 0.2, ang: 58, w: 1, taper: 0.5, n: 7 };
	const canes = pick(
		st,
		[[40, 82, 0]] as const,
		[[35, 68, -1], [45, 64, 1]] as const,
		[[30, 54, -1], [37, 44, -1], [45, 40, 1], [52, 54, 1]] as const,
	);
	const sh = pick(st, 5, 8, 10);
	const L = pick(st, 11, 17, 21);
	for (const [x, top] of canes) {
		const p = up(40 + (x - 40) * 0.25, top, (x - 40) * 0.75);
		const hw: Hw = () => (st === "sprout" ? 1 : 1.4);
		if (st !== "sprout") ink.fill(SEA.cane, bodyD(p, hw, 6)).stroke(SEA.ring, 0.5, ringsD(p, hw, Math.round((88 - top) / 4), 0, 1, 0));
	}
	for (const [x, top] of canes) {
		const side = Math.sign(x - 40);
		const s = side * 10;
		const lean = side * 1.2;
		const base = st === "sprout" ? 87 : top + 1;
		ink.fill(SEA.shaft, bodyD(seg(x, base, x + lean, top - sh), (t) => (st === "sprout" ? 1.3 : 1.8) - 0.4 * t));
		crown(ink, x + lean, top - sh, [[-148 + s, -50, L], [-32 + s, 50, L], [-96 + s, 10 * side, L * 0.95]], pick(st, 3, 4, 5), o);
	}
	return ink.toString();
}

const kebab = (name: string): string =>
	name
		.toLowerCase()
		.replace(/'/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
const S = (name: string, draw: (st: St) => string): Species => ({ id: kebab(name), name, draw });

export const SPECIES: Species[] = [
	S("Royal palm", royal),
	S("California fan palm", california),
	S("Bismarck palm", bismarck),
	S("Sago palm", sago),
	S("Areca palm", areca),
	S("Kentia palm", kentia),
	S("Parlor palm", parlor),
	S("Bottle palm", bottle),
	S("Foxtail palm", foxtail),
	S("Windmill palm", windmill),
	S("Chinese fan palm", chineseFan),
	S("Pygmy date palm", pygmyDate),
	S("Traveller's palm", traveller),
	S("Fishtail palm", fishtail),
	S("Lady palm", lady),
	S("Queen palm", queen),
	S("Oil palm", oil),
	S("Cabbage palmetto", cabbage),
	S("Triangle palm", triangle),
	S("Coco de mer", cocoDeMer),
	S("Raffia palm", raffia),
	S("Talipot palm", talipot),
	S("Cardboard palm", cardboard),
	S("Mediterranean fan palm", medFan),
	S("Sealing wax palm", sealingWax),
];
