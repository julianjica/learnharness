/**
 * Garden species: squashes, legumes and fruiting vegetables (25). Drawn in
 * the kit's flat style; see kit.ts for the cell, the ground line and the
 * shared shapes. Every drawing goes through a Paint, which merges all
 * shapes of one colour into one path to keep the markup small.
 */
import { GREEN, f, type GrowingStage, type Species } from "./kit";

type St = GrowingStage;
type XY = [number, number];
const D = Math.PI / 180;
const by = <T>(st: St, a: T, b: T, c: T): T => (st === "sprout" ? a : st === "leafy" ? b : c);
const polar = (x: number, y: number, deg: number, r: number): XY => [x + Math.cos(deg * D) * r, y + Math.sin(deg * D) * r];
const r1 = (v: number): number => Math.round(v * 10) / 10;
const pt = (p: readonly number[]): string => `${f(p[0]!)} ${f(p[1]!)}`;
/** Deterministic 0..1 noise. */
const rnd = (i: number): number => {
	const s = Math.sin(i * 12.9898 + 4.1) * 43758.5453;
	return s - Math.floor(s);
};

/** Numbers joined as compactly as SVG path syntax allows ("-.5.5" is -0.5, 0.5). */
function nums(a: readonly number[]): string {
	let s = "";
	let prevDot = false;
	a.forEach((v, i) => {
		const t = f(v).replace(/^(-?)0\./, "$1.");
		if (i && t[0] !== "-" && !(t[0] === "." && prevDot)) s += " ";
		s += t;
		prevDot = t.includes(".");
	});
	return s;
}

/** A closed smooth outline through the midpoints of `p`, with each point as the control (relative q commands). */
function smooth(p: readonly XY[]): string {
	const n = p.length;
	const mid = (i: number): XY => {
		const a = p[i % n]!;
		const b = p[(i + 1) % n]!;
		return [r1((a[0] + b[0]) / 2), r1((a[1] + b[1]) / 2)];
	};
	let cur = mid(n - 1);
	let d = `M${pt(cur)}`;
	for (let i = 0; i < n; i++) {
		const c: XY = [r1(p[i]![0]), r1(p[i]![1])];
		const e = mid(i);
		d += `q${nums([c[0] - cur[0], c[1] - cur[1], e[0] - cur[0], e[1] - cur[1]])}`;
		cur = e;
	}
	return d + "Z";
}

/** Control points of kit leaf shapes 0, 1, 2, 4 as [c1, c2, tip, c3, c4] in (len, w) units. */
const SHAPES: Record<0 | 1 | 2 | 4, readonly (readonly [number, number])[]> = {
	0: [[0.3, -1], [0.8, -1], [1, 0], [0.8, 1], [0.3, 1]],
	1: [[0.45, -1.15], [0.8, -0.5], [1, 0], [0.8, 0.5], [0.45, 1.15]],
	2: [[0.05, -1.4], [1.02, -1.3], [1, 0], [1.02, 1.3], [0.05, 1.4]],
	4: [[0.1, -1.6], [0.75, -1.2], [1, 0], [0.75, 1.2], [0.1, 1.6]],
};

interface PalmOpts {
	lobes: number;
	/** 0 = round, 1 = cut to the centre. */
	depth: number;
	/** >1 narrows the lobes, <1 narrows the sinuses. */
	k?: number;
	fill: string;
	vein?: string;
	/** Petiole notch at the back (default true). */
	notch?: boolean;
	/** Squash along the leaf's cross axis (for side views). */
	sy?: number;
	/** Outline points per lobe: 3 (default) or 2 for gentle scallops. */
	per?: 2 | 3;
}

/** Shapes merged by colour: one path per fill, one per stroke colour and width, in first-use order. */
class Paint {
	private m = new Map<string, { c: string; w: number; d: string }>();
	private add(k: string, c: string, w: number, d: string): this {
		const e = this.m.get(k);
		if (e) e.d += d;
		else this.m.set(k, { c, w, d });
		return this;
	}
	fill(c: string, d: string): this {
		return this.add(`f${c}`, c, 0, d);
	}
	stroke(c: string, w: number, d: string): this {
		return this.add(`s${w}${c}`, c, w, d);
	}
	/** A kit-shaped leaf at (x, y) pointing at `ang`; `rib` colours a midrib. */
	leaf(x: number, y: number, ang: number, len: number, w: number, fill: string, shape: 0 | 1 | 2 | 4 = 0, rib?: string): this {
		const c = Math.cos(ang * D);
		const s = Math.sin(ang * D);
		const x0 = r1(x);
		const y0 = r1(y);
		const at = (u: number, v: number): XY => [r1(x + u * c - v * s) - x0, r1(y + u * s + v * c) - y0];
		const k = SHAPES[shape].map(([u, v]) => at(u * len, v * w));
		const tip = k[2]!;
		const rel = (q: XY) => [q[0] - tip[0], q[1] - tip[1]];
		this.fill(fill, `M${pt([x0, y0])}c${nums([...k[0]!, ...k[1]!, ...tip])}c${nums([...rel(k[3]!), ...rel(k[4]!), -tip[0], -tip[1]])}z`);
		if (rib) this.stroke(rib, 0.7, `M${pt([x0, y0])}m${nums(at(1, 0))}l${nums(at(len * 0.78 - 1, 0))}`);
		return this;
	}
	/** A trifoliate leaf: petiole of length pl from (x, y) along ang, then three leaflets. */
	tri(x: number, y: number, ang: number, pl: number, len: number, w: number, fill: string, stalk: string, rib?: string, shape: 0 | 1 | 2 | 4 = 1): this {
		const e = polar(x, y, ang, pl);
		this.stroke(stalk, 0.9, `M${pt([x, y])}L${pt(e)}`);
		return this.leaf(e[0], e[1], ang - 68, len * 0.85, w * 0.9, fill, shape, rib)
			.leaf(e[0], e[1], ang + 68, len * 0.85, w * 0.9, fill, shape, rib)
			.leaf(e[0], e[1], ang, len, w, fill, shape, rib);
	}
	/** A palmately lobed leaf seen face-on, centred on (cx, cy), its middle lobe pointing at `rot`. */
	palm(cx: number, cy: number, rot: number, R: number, o: PalmOpts): this {
		const sy = o.sy ?? 1;
		const c = Math.cos(rot * D);
		const s = Math.sin(rot * D);
		const per = 360 / o.lobes;
		const offs = o.per === 2 ? [0, 0.5] : [-0.42, 0, 0.42];
		const pts: XY[] = [];
		for (let j = 0; j < o.lobes; j++)
			for (const q of offs) {
				let a = 180 + per / 2 + (j + q) * per;
				a = ((a + 180) % 360) - 180;
				const u = (1 + Math.cos(o.lobes * a * D)) / 2;
				let r = R * (1 - o.depth + o.depth * Math.pow(u, o.k ?? 1));
				if (o.notch !== false && Math.abs(a) > 140) r *= 0.55;
				const lx = Math.cos(a * D) * r;
				const ly = Math.sin(a * D) * r * sy;
				pts.push([cx + lx * c - ly * s, cy + lx * s + ly * c]);
			}
		this.fill(o.fill, smooth(pts));
		if (o.vein) {
			let d = "";
			const h = (o.lobes - 1) / 2;
			const b = polar(cx, cy, rot + 180, R * 0.12);
			for (let j = -h; j <= h; j++) {
				if (Math.abs((j * 360) / o.lobes) > 150) continue;
				d += `M${pt(b)}L${pt(polar(cx, cy, rot + (j * 360) / o.lobes, R * 0.7 * (1 - o.depth * 0.2)))}`;
			}
			this.stroke(o.vein, 0.7, d);
		}
		return this;
	}
	/** A body along a gently bent centreline from (x, y): half-width prof(t) for t in 0..1. */
	body(x: number, y: number, ang: number, len: number, prof: (t: number) => number, fill: string, bend = 0, n = 7): this {
		const L: XY[] = [];
		const R: XY[] = [];
		const dx = Math.cos(ang * D);
		const dy = Math.sin(ang * D);
		for (let i = 0; i <= n; i++) {
			const t = i / n;
			const off = bend * len * 4 * t * (1 - t);
			const cx = x + dx * t * len - dy * off;
			const cy = y + dy * t * len + dx * off;
			const dOff = bend * 4 * (1 - 2 * t);
			let tx = dx - dy * dOff;
			let ty = dy + dx * dOff;
			const m = Math.hypot(tx, ty);
			tx /= m;
			ty /= m;
			const h = Math.max(0.25, prof(t));
			L.push([cx - ty * h, cy + tx * h]);
			R.push([cx + ty * h, cy - tx * h]);
		}
		return this.fill(fill, smooth([...L, ...R.reverse()]));
	}
	ell(cx: number, cy: number, rx: number, ry: number, fill: string, rot = 0): this {
		const a = polar(cx, cy, rot, -rx);
		const b = polar(cx, cy, rot, rx);
		return this.fill(fill, `M${pt(a)}A${f(rx)} ${f(ry)} ${f(rot)} 1 0 ${pt(b)}A${f(rx)} ${f(ry)} ${f(rot)} 1 0 ${pt(a)}Z`);
	}
	/** Round dots as zero-length round-capped strokes. */
	dots(pts: readonly (readonly number[])[], c: string, r: number): this {
		let d = "";
		for (const p of pts) d += `M${pt(p)}h0`;
		return this.stroke(c, r1(2 * r), d);
	}
	/** A quadratic stroke from (x, y) along ang, bowed sideways by bend × len. */
	pod(x: number, y: number, ang: number, len: number, bend: number, w: number, c: string): this {
		const e = polar(x, y, ang, len);
		const m = polar(x, y, ang, len / 2);
		const k = polar(m[0], m[1], ang + 90, bend * len);
		return this.stroke(c, w, `M${pt([x, y])}Q${pt(k)} ${pt(e)}`);
	}
	/** A five-petalled open flower (cucurbit, okra) of radius R. */
	star(x: number, y: number, R: number, fill: string, eye: string, rot = -90, depth = 0.4): this {
		this.palm(x, y, rot, R, { lobes: 5, depth, k: 0.8, fill, notch: false });
		return this.dots([[x, y]], eye, R * 0.28);
	}
	/** A small pea-family flower: banner and keel. */
	pea(x: number, y: number, ang: number, s: number, c: string, c2 = c): this {
		const [kx, ky] = polar(x, y, ang + 180, s * 1.2);
		this.ell(x, y, s * 1.3, s, c, ang + 90);
		return this.ell(kx, ky, s * 0.8, s * 0.6, c2, ang);
	}
	toString(): string {
		let s = "";
		for (const { c, w, d } of this.m.values())
			s += w ? `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>` : `<path d="${d}" fill="${c}"/>`;
		return s;
	}
}

/** Scale the drawing about the root (40, 87). */
const sc = (s: number, inner: string): string => (s === 1 ? inner : `<g transform="matrix(${f(s)} 0 0 ${f(s)} ${f(40 - 40 * s)} ${f(87 - 87 * s)})">${inner}</g>`);
const cat = (...ps: Paint[]): string => ps.join("");

/** Half-width profiles. */
const cyl = (w: number) => (t: number) => w * Math.pow(Math.sin(Math.PI * t), 0.4);
const spindle = (w: number, p = 0.9) => (t: number) => w * Math.pow(Math.sin(Math.PI * t), p);
const bumpy = (w: number, n: number) => (t: number) => w * Math.pow(Math.sin(Math.PI * t), 0.45) * (0.78 + 0.22 * Math.abs(Math.sin(n * Math.PI * t)));
const gauss = (t: number, m: number, s: number) => Math.exp(-((t - m) ** 2) / (2 * s * s));

const STAKE = "#a27a54";
const YEL = "#f2c53d";
const ORA = "#e0892a";

// ── sprouts ──────────────────────────────────────────────────────────────
/** A cucurbit seedling: two oval seed leaves and a first lobed leaf. */
function cucSprout(fill: string, o: Partial<PalmOpts> = {}): string {
	const p = new Paint();
	p.stroke(GREEN.dark, 1.8, "M40 87.5Q39 81 40 75");
	p.leaf(40, 75.5, -160, 9.5, 3.6, GREEN.light).leaf(40, 75.5, -20, 9.5, 3.6, GREEN.light);
	p.stroke(GREEN.dark, 1.1, "M40 75Q40 71 42 68.5");
	p.palm(42.5, 66, -75, 5.5, { lobes: 5, depth: 0.35, k: 1.2, vein: GREEN.dark, ...o, fill });
	return `${p}`;
}
/** A bean seedling: fleshy seed halves and two heart-shaped first leaves. */
function beanSprout(fill: string, coty = "#d2d58a"): string {
	const p = new Paint();
	p.stroke(GREEN.dark, 1.7, "M40 87.5Q41 79 40 70");
	p.ell(36.6, 79, 3.4, 2.2, coty, 20).ell(43.4, 79, 3.4, 2.2, coty, -20);
	p.leaf(40, 70.5, -150, 9, 3.6, fill, 4, GREEN.dark).leaf(40, 70.5, -30, 9, 3.6, fill, 4, GREEN.dark);
	return `${p}`;
}
/** A fine-leaved legume seedling (chickpea, lentil): a thin shoot with small leaflets. */
function fineSprout(fill: string, r: number, h = 18): string {
	const p = new Paint();
	p.stroke(GREEN.dark, 1, `M40 87.5Q39 ${f(87 - h / 2)} 40.5 ${f(87 - h)}`);
	const pts: number[][] = [];
	for (let i = 0; i < 4; i++) {
		const y = 87 - h * (0.45 + i * 0.17);
		const sp = 2.2 + i * 0.1 - i * 0.4;
		pts.push([40 - sp - r, y], [40.4 + sp + r, y - 0.6]);
	}
	pts.push([40.6, 87 - h - r]);
	return `${p.dots(pts, fill, r)}`;
}

// ── 1. Zucchini / 23. Pattypan: bush squashes ───────────────────────────
function bushLeaves(p: Paint, back: string, front: string, vein: string, stalk: string, mottle?: string): void {
	const L: [number, number, number][] = [
		[-162, 26, 11],
		[-22, 26, 11],
		[-128, 32, 12.5],
		[-56, 32, 12.5],
		[-92, 35, 13],
	];
	const ms: number[][] = [];
	let st = "";
	for (const [a, len, R] of L) {
		const e = polar(40, 84, a, len);
		st += `M40 84Q${pt([40 + (e[0] - 40) * 0.4, e[1] + (84 - e[1]) * 0.2])} ${pt(e)}`;
	}
	p.stroke(stalk, 1.8, st);
	L.forEach(([a, len, R], i) => {
		const [x, y] = polar(40, 84, a, len);
		p.palm(x, y, a, R, { lobes: 5, depth: 0.42, k: 1.5, fill: i < 2 ? back : front, vein });
		if (mottle) for (let j = -1; j <= 1; j++) ms.push(polar(x, y, a + j * 72 + 30, R * 0.42));
	});
	if (mottle) p.dots(ms, mottle, 1.1);
}
const ZUC = { a: "#3f7f3a", b: "#4f9445", vein: "#2b5a2a", stalk: "#86b866", mot: "#9fc493", fruit: "#2c5f30", speck: "#5f9257", cap: "#7c8f4f" };
function zucchini(st: St): string {
	if (st === "sprout") return cucSprout(ZUC.b, { depth: 0.42, k: 1.5 });
	const p = new Paint();
	bushLeaves(p, ZUC.a, ZUC.b, ZUC.vein, ZUC.stalk, ZUC.mot);
	if (st === "leafy") return sc(0.74, `${p}${new Paint().ell(40, 60, 2, 3.4, YEL)}`);
	const fr = new Paint();
	fr.body(43, 85, -13, 31, cyl(3.8), ZUC.fruit).body(37, 85.5, 195, 27, cyl(3.5), ZUC.fruit);
	const sp: number[][] = [];
	for (let i = 0; i < 7; i++) {
		sp.push(polar(43, 85, -13, 7 + i * 3.4).map((v, j) => v + (j ? (i % 2 ? -1.4 : 1.2) : 0)));
		if (i < 6) sp.push(polar(37, 85.5, 195, 7 + i * 3.3).map((v, j) => v + (j ? (i % 2 ? 1.2 : -1.3) : 0)));
	}
	fr.dots(sp, ZUC.speck, 0.55).dots([[43, 85], [37, 85.5]], ZUC.cap, 1.9);
	fr.stroke("#c8a02c", 1.6, "M40 62L40 56").star(40, 50, 7.5, YEL, ORA, -90, 0.35);
	return cat(p, fr);
}
const PAT = { a: "#5b9e4b", b: "#6fb257", vein: "#3c7334", stalk: "#9ac77a", cream: "#f1e8c0", rim: "#d9cc93", yel: "#f0c63c", yrim: "#d6a52a" };
function pattypan(st: St): string {
	if (st === "sprout") return cucSprout(PAT.b, { depth: 0.38, k: 1.3 });
	const p = new Paint();
	bushLeaves(p, PAT.a, PAT.b, PAT.vein, PAT.stalk);
	if (st === "leafy") return sc(0.74, `${p}`);
	const fr = new Paint();
	// side-on saucer, face-on saucer, small yellow one
	const sc2 = { notch: false, per: 2 } as const;
	fr.palm(56, 82, 0, 11, { ...sc2, lobes: 12, depth: 0.1, fill: PAT.rim, sy: 0.5 });
	fr.palm(56, 81.2, 0, 10, { ...sc2, lobes: 12, depth: 0.1, fill: PAT.cream, sy: 0.4 });
	fr.palm(24, 79, 0, 8.6, { ...sc2, lobes: 10, depth: 0.14, fill: PAT.rim });
	fr.palm(24, 79, 0, 7.4, { ...sc2, lobes: 10, depth: 0.14, fill: PAT.cream });
	fr.palm(41, 84, 0, 6.6, { ...sc2, lobes: 10, depth: 0.12, fill: PAT.yrim, sy: 0.55 });
	fr.palm(41, 83.4, 0, 6, { ...sc2, lobes: 10, depth: 0.12, fill: PAT.yel, sy: 0.45 });
	fr.dots([[24, 79]], PAT.rim, 2).dots([[56, 77.5], [41, 80.6]], "#7c8f4f", 1.2);
	fr.stroke("#c8a02c", 1.6, "M40 62L40 56").star(40, 50, 7, YEL, ORA, -90, 0.35);
	return cat(p, fr);
}

// ── 2. Butternut / 3. Acorn / 5. Watermelon / 6. Cantaloupe: sprawling vines ──
/** Ground runners with leaves raised on petioles: [x, y, R, rot]. */
function sprawl(p: Paint, runners: string, vine: string, leaves: readonly (readonly number[])[], o: PalmOpts, alt?: string): void {
	let st = runners;
	for (const [x, y] of leaves) st += `M${f(x!)} 86Q${f(x! + 2)} ${f((86 + y!) / 2)} ${pt([x!, y!])}`;
	p.stroke(vine, 1.6, st);
	leaves.forEach(([x, y, R, rot], i) => p.palm(x!, y!, rot ?? -90, R!, { ...o, fill: alt && i % 2 ? alt : o.fill }));
}
const tendril = (x: number, y: number, s = 1): string => `M${pt([x, y])}c${f(2 * s)} -3 ${f(5 * s)} -3 ${f(5 * s)} 0c0 2 ${f(-2.6 * s)} 2.2 ${f(-2.8 * s)} .4`;

const BUT = { leaf: "#68a853", alt: "#5a9a49", vein: "#3d7535", vine: "#7fb35f", fruit: "#e4b97c", end: "#c9965a", cap: "#6f7f45" };
function butternut(st: St): string {
	if (st === "sprout") return cucSprout(BUT.leaf, { depth: 0.25, k: 1 });
	const o: PalmOpts = { lobes: 5, depth: 0.28, k: 1, fill: BUT.leaf, vein: BUT.vein };
	const p = new Paint();
	if (st === "leafy") {
		sprawl(p, `M40 86Q28 85 16 82M40 86Q52 85 62 81${tendril(62, 81)}`, BUT.vine, [[26, 64, 9, -110], [52, 62, 9.5, -70], [40, 56, 10, -90]], o, BUT.alt);
		return `${p}`;
	}
	sprawl(p, `M40 86Q24 86 7 82M40 86Q57 86 73 80${tendril(70, 80)}`, BUT.vine, [[12, 66, 8.5, -120], [26, 56, 10.5, -105], [68, 62, 9, -60], [54, 52, 11, -75], [40, 47, 11.5, -90]], o, BUT.alt);
	const fr = new Paint();
	const prof = (t: number) => (4.4 + 5.4 * Math.min(1, Math.max(0, (t - 0.38) / 0.42)) ** 1.5) * Math.pow(Math.sin(Math.PI * t), 0.32);
	fr.body(17, 82.6, -8, 38, prof, BUT.fruit, 0, 10);
	fr.ell(52.4, 78.6, 2, 2.4, BUT.end, -8).stroke(BUT.cap, 2.6, "M17.5 82.4L14 82");
	fr.stroke("#c8a02c", 1.2, "M64 86L64 74").star(64, 70, 5, YEL, ORA, -80);
	return cat(p, fr);
}

const ACO = { leaf: "#4c8d42", alt: "#3f7c38", vein: "#2b5a2a", vine: "#78ab58", fruit: "#2f5534", rib: "#1d3a23", patch: "#e2943a", stalk: "#8d8a55" };
function acornFruit(p: Paint, x: number, top: number, s: number): void {
	const h = (t: number) => 9 * s * Math.sqrt(Math.min(1, t * 3.2)) * (1 - t * t * 0.86);
	p.body(x, top, 90, 17 * s, h, ACO.fruit, 0, 8);
	p.ell(x + 4 * s, top + 12 * s, 3.4 * s, 2.4 * s, ACO.patch, -25);
	let d = "";
	for (const o of [-6, -2.6, 2.6, 6]) d += `M${pt([x + o * 0.5 * s, top + 1.2 * s])}Q${pt([x + o * 1.3 * s, top + 8 * s])} ${pt([x + o * 0.25 * s, top + 16 * s])}`;
	p.stroke(ACO.rib, 0.9, d);
	p.stroke(ACO.stalk, 2.4 * s, `M${pt([x, top + 1])}L${pt([x + 0.6, top - 2.6 * s])}`);
}
function acorn(st: St): string {
	if (st === "sprout") return cucSprout(ACO.leaf, { depth: 0.32, k: 0.8 });
	const o: PalmOpts = { lobes: 5, depth: 0.32, k: 0.8, fill: ACO.leaf, vein: ACO.vein };
	const p = new Paint();
	if (st === "leafy") {
		sprawl(p, "M40 86Q30 85 20 82", ACO.vine, [[24, 62, 9, -115], [55, 61, 9, -65], [40, 54, 10, -90]], o, ACO.alt);
		return `${p}`;
	}
	sprawl(p, `M40 86Q26 86 10 80M40 86Q54 86 70 82${tendril(68, 82)}`, ACO.vine, [[14, 62, 9, -120], [64, 58, 10, -60], [26, 50, 11, -105], [52, 48, 11, -75], [39, 40, 11.5, -90]], o, ACO.alt);
	const fr = new Paint();
	acornFruit(fr, 28, 67.5, 1.2);
	acornFruit(fr, 54, 74.5, 0.78);
	fr.stroke("#c8a02c", 1.2, "M66 85L68 74").star(68, 70, 4.6, YEL, ORA, -70);
	return cat(p, fr);
}

const WAT = { leaf: "#5f9356", alt: "#507f4a", vein: "#355f33", vine: "#7aa65c", rind: "#4a8a42", stripe: "#24502a", light: "#6ea75f" };
function watermelon(st: St): string {
	if (st === "sprout") return cucSprout(WAT.leaf, { lobes: 5, depth: 0.6, k: 0.7 });
	const o: PalmOpts = { lobes: 7, depth: 0.58, k: 0.7, fill: WAT.leaf, vein: WAT.vein };
	const p = new Paint();
	if (st === "leafy") {
		sprawl(p, `M40 86Q26 86 12 83M40 86Q54 86 68 83${tendril(66, 83)}`, WAT.vine, [[20, 72, 8, -120], [60, 70, 8.5, -60], [33, 62, 9, -100], [48, 60, 9, -80]], o, WAT.alt);
		return `${p}`;
	}
	sprawl(p, `M40 86Q24 87 5 83M40 86Q57 87 75 83${tendril(5, 82, -1)}`, WAT.vine, [[10, 70, 8, -130], [70, 68, 8, -50], [22, 58, 9.5, -110], [58, 56, 9.5, -70], [40, 52, 10, -90]], o, WAT.alt);
	const fr = new Paint();
	const prof = (t: number) => 11 * Math.pow(Math.sin(Math.PI * t), 0.5);
	fr.body(18, 77, 0, 44, prof, WAT.rind, 0, 10);
	let d = "";
	for (const k of [-0.62, -0.22, 0.2, 0.6]) {
		for (let i = 0; i <= 12; i++) {
			const t = 0.04 + (i / 12) * 0.92;
			const y = 77 + k * prof(t) + (i % 2 ? 0.9 : -0.9) * Math.sin(Math.PI * t);
			d += `${i ? "L" : "M"}${pt([18 + t * 44, y])}`;
		}
	}
	fr.stroke(WAT.stripe, 1.9, d);
	fr.stroke("#c8a02c", 1.1, "M52 86L54 77").star(54, 74, 3.6, YEL, ORA, -80);
	return cat(p, fr);
}

const CAN = { leaf: "#72aa5c", alt: "#629c4f", vein: "#437a3a", vine: "#86b866", fruit: "#d3ae74", net: "#efe1bc", rib: "#b88f55" };
function cantaloupe(p: Paint, x: number, y: number, r: number): void {
	p.ell(x, y, r, r * 0.92, CAN.fruit);
	let d = "";
	const rr = r - 1;
	for (const dir of [45, -45, 0]) {
		const c = Math.cos(dir * D);
		const s = Math.sin(dir * D);
		for (let k = -rr + 2.6; k < rr; k += dir ? 3.6 : 99) {
			if (!dir) break;
			const h = Math.sqrt(rr * rr - k * k) * 0.92;
			d += `M${pt([x - s * k - c * h, y + c * k - s * h])}L${pt([x - s * k + c * h, y + c * k + s * h])}`;
		}
	}
	p.stroke(CAN.net, 0.55, d);
	p.stroke(CAN.rib, 1.6, `M${pt([x + 0.3, y - r * 0.92 + 0.6])}l.6 -2.4`);
}
function cantaloupeSp(st: St): string {
	if (st === "sprout") return cucSprout(CAN.leaf, { depth: 0.14, k: 1 });
	const o: PalmOpts = { lobes: 5, depth: 0.14, k: 1, fill: CAN.leaf, vein: CAN.vein };
	const p = new Paint();
	if (st === "leafy") {
		sprawl(p, `M40 86Q28 85 14 83M40 86Q52 85 64 83${tendril(64, 83)}`, CAN.vine, [[24, 66, 8.5, -110], [55, 64, 8.5, -70], [40, 58, 9.5, -90]], o, CAN.alt);
		return `${p}`;
	}
	sprawl(p, `M40 86Q24 86 7 82M40 86Q56 86 74 82${tendril(72, 82)}`, CAN.vine, [[12, 64, 8.5, -120], [68, 60, 9, -60], [27, 52, 10, -105], [53, 50, 10, -75], [40, 44, 10, -90]], o, CAN.alt);
	const fr = new Paint();
	cantaloupe(fr, 29, 76.6, 10.6);
	fr.stroke("#c8a02c", 1.1, "M44 86L44 76").star(44, 73, 3.6, YEL, ORA, -80);
	cantaloupe(fr, 57, 79.8, 7.6);
	return cat(p, fr);
}

// ── 4. Cucumber: net trellis ────────────────────────────────────────────
const CUC = { leaf: "#6aaa52", alt: "#5a9a47", vein: "#3a6e32", vine: "#7aae5a", fruit: "#2a5a2c", spine: "#b4d89a", post: STAKE, net: "#b49b7c" };
function trellisNet(p: Paint): void {
	let d = "";
	for (let y = 22; y <= 82; y += 10) d += `M17 ${y}H63`;
	for (let x = 25; x <= 55; x += 7.5) d += `M${x} 14V87`;
	p.stroke(CUC.net, 0.45, d).stroke(CUC.post, 2.2, "M17 88V12M63 88V12");
}
function cucumber(st: St): string {
	if (st === "sprout") return cucSprout(CUC.leaf, { depth: 0.25, k: 2.2 });
	const p = new Paint();
	trellisNet(p);
	const top = by(st, 0, 46, 16);
	const v = new Paint();
	let d = "M40 87.5";
	const nodes: XY[] = [];
	for (let y = 80, i = 0; y > top; y -= 9, i++) {
		const x = 40 + (i % 2 ? 4 : -4);
		d += `Q${pt([40 + (i % 2 ? -3 : 3), y + 4.5])} ${pt([x, y])}`;
		nodes.push([x, y]);
	}
	v.stroke(CUC.vine, 1.6, d);
	let td = "";
	nodes.forEach(([x, y], i) => {
		const sg = i % 2 ? 1 : -1;
		const lx = x + sg * 10;
		v.stroke(CUC.vine, 1, `M${pt([x, y])}L${pt([lx, y - 2])}`);
		v.palm(lx, y - 2, -90 + sg * 30, i > nodes.length - 3 ? 6 : 8, { lobes: 5, depth: 0.25, k: 2.2, fill: i % 3 ? CUC.leaf : CUC.alt, vein: CUC.vein });
		td += tendril(x - sg, y - 1, -sg * 0.8);
	});
	v.stroke(CUC.vine, 0.8, td);
	if (st === "leafy") return cat(p, v);
	const fr = new Paint();
	const C: [number, number, number][] = [
		[30, 50, 17],
		[50, 42, 16],
		[31, 69, 15],
		[50, 62, 17],
	];
	const sp: number[][] = [];
	for (const [x, y, len] of C) {
		fr.body(x, y, 90, len, cyl(3.4), CUC.fruit, 0.03, 6);
		for (let j = 1; j < 6; j++) sp.push([x + (j % 2 ? -1.4 : 1.3), y + (j * len) / 6.2]);
	}
	fr.dots(sp, CUC.spine, 0.45);
	fr.star(45, 30, 2.8, YEL, ORA).star(35, 22, 2.4, YEL, ORA).star(36, 76, 2.6, YEL, ORA);
	return cat(p, v, fr);
}

// ── 7. Bitter melon: bamboo stake ───────────────────────────────────────
const BIT = { leaf: "#5ea84a", alt: "#4b9440", vein: "#356a2e", vine: "#7cb45a", fruit: "#9bcd63", wart: "#c8e5a0", ridge: "#6f9e45", ripe: "#ec8a2c", seed: "#c8283a", cane: "#c9ad72", node: "#9d8150" };
function bamboo(p: Paint, top: number): void {
	p.stroke(BIT.cane, 2.2, `M40 88V${top}`);
	let d = "";
	for (let y = 80; y > top + 3; y -= 13) d += `M38.8 ${y}h2.4`;
	p.stroke(BIT.node, 1, d);
}
function twiner(v: Paint, top: number, vine: string, leafAt: (x: number, y: number, sg: number, i: number) => void, step = 8, amp = 3.5): XY[] {
	let d = "M40 87.5";
	const nodes: XY[] = [];
	for (let y = 82, i = 0; y > top; y -= step, i++) {
		const x = 40 + (i % 2 ? amp : -amp);
		d += `Q${pt([40, y + step / 2])} ${pt([x, y])}`;
		nodes.push([x, y]);
	}
	v.stroke(vine, 1.3, d);
	nodes.forEach(([x, y], i) => leafAt(x, y, i % 2 ? 1 : -1, i));
	return nodes;
}
function bitterMelon(st: St): string {
	if (st === "sprout") return cucSprout(BIT.leaf, { depth: 0.65, k: 1.8 });
	const p = new Paint();
	bamboo(p, by(st, 0, 38, 8));
	const v = new Paint();
	twiner(v, by(st, 0, 42, 14), BIT.vine, (x, y, sg, i) => {
		const lx = x + sg * 8;
		v.stroke(BIT.vine, 0.9, `M${pt([x, y])}L${pt([lx, y - 1])}`);
		v.palm(lx, y - 1, -90 + sg * 40, 6.6, { lobes: 5, depth: 0.7, k: 1.8, fill: i % 2 ? BIT.leaf : BIT.alt, vein: BIT.vein });
	});
	if (st === "leafy") return cat(p, v);
	const fr = new Paint();
	const F: [number, number, number, string][] = [
		[31, 34, 21, BIT.fruit],
		[50, 46, 19, BIT.fruit],
		[29, 60, 18, BIT.ripe],
	];
	const w: number[][] = [];
	let rd = "";
	for (const [x, y, len, c] of F) {
		fr.stroke(BIT.vine, 0.9, `M${pt([x, y - 3])}L${pt([x, y])}`);
		fr.body(x, y, 92, len, spindle(4.2), c, 0.02, 8);
		if (c === BIT.fruit) {
			for (let j = 1; j < 9; j++) w.push([x + (j % 3) - 1.2, y + (j * len) / 9.5]);
			rd += `M${pt([x - 1.6, y + 3])}Q${pt([x - 2.4, y + len / 2])} ${pt([x - 0.6, y + len - 3])}M${pt([x + 1.8, y + 3])}Q${pt([x + 2.6, y + len / 2])} ${pt([x + 1, y + len - 3])}`;
		}
	}
	fr.stroke(BIT.ridge, 0.6, rd).dots(w, BIT.wart, 0.6);
	// the ripe one has split, showing red seeds
	fr.body(28, 66, 94, 10, spindle(1.8), "#f6c76e", 0, 6).dots([[27.6, 68], [28, 71], [27.8, 74]], BIT.seed, 1);
	fr.star(47, 26, 2.6, YEL, ORA).star(34, 74, 2.4, YEL, ORA);
	return cat(p, v, fr);
}

// ── 8. Okra ─────────────────────────────────────────────────────────────
const OKR = { leaf: "#5a9c48", alt: "#4b8a3e", vein: "#33652e", stem: "#6f7f3b", pod: "#9acd62", ridge: "#5e9a40", petal: "#f4e8a6", eye: "#7b2d3c" };
function okra(st: St): string {
	if (st === "sprout") {
		const p = new Paint();
		p.stroke(OKR.stem, 1.8, "M40 87.5Q40 81 40 72");
		p.leaf(40, 72.5, -158, 7, 4, GREEN.light, 2).leaf(40, 72.5, -22, 7, 4, GREEN.light, 2);
		p.stroke(OKR.stem, 1, "M40 72L41 67").palm(41.6, 64.5, -80, 4.6, { lobes: 5, depth: 0.5, k: 1.3, fill: OKR.leaf, vein: OKR.vein });
		return `${p}`;
	}
	const top = by(st, 0, 42, 18);
	const p = new Paint();
	p.stroke(OKR.stem, by(st, 2.4, 2.4, 3), `M40 87.5Q41 ${f((87 + top) / 2)} 40 ${top}`);
	const L: [number, number, number][] =
		st === "leafy"
			? [[80, -1, 10], [68, 1, 10.5], [57, -1, 9.5], [47, 1, 7.5]]
			: [[80, -1, 10.5], [70, 1, 11.5], [59, -1, 11], [48, 1, 10], [38, -1, 8], [28, 1, 6.5]];
	let pd = "";
	L.forEach(([y, sg, R]) => pd += `M40 ${y}Q${pt([40 + sg * R * 0.5, y - R * 0.4])} ${pt([40 + sg * R * 1.25, y - R * 0.55])}`);
	p.stroke(OKR.stem, 1.2, pd);
	L.forEach(([y, sg, R], i) => p.palm(40 + sg * R * 1.35, y - R * 0.6, -90 + sg * 45, R, { lobes: 5, depth: 0.62, k: 1.3, fill: i % 2 ? OKR.alt : OKR.leaf, vein: OKR.vein }));
	if (st === "leafy") return `${p.ell(40, 41, 1.6, 2.8, OKR.pod)}`;
	const fr = new Paint();
	const P: [number, number, number, number][] = [
		[41.5, 62, -62, 16],
		[38.5, 51, -118, 15],
		[41.5, 40, -66, 13],
	];
	let rd = "";
	for (const [x, y, a, len] of P) {
		fr.body(x, y, a, len, (t) => 3 * Math.pow(Math.sin(Math.PI * Math.min(0.5, t * 1.6)), 0.6) * (1 - t * 0.85), OKR.pod, 0.02, 6);
		rd += `M${pt(polar(x, y, a, 2))}L${pt(polar(x, y, a, len - 2))}`;
	}
	fr.stroke(OKR.ridge, 0.6, rd);
	fr.palm(47, 22, -60, 7.5, { lobes: 5, depth: 0.22, k: 0.6, fill: OKR.petal, notch: false }).dots([[47, 22]], OKR.eye, 2.3);
	fr.ell(40, 16.5, 1.6, 2.8, OKR.pod);
	return cat(p, fr);
}

// ── 9. Tomatillo / 21. Ground cherry: husked fruits ─────────────────────
const lantern = (w: number) => (t: number) => w * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.1)), 0.7) * (1 - 0.35 * t) + 0.2;
function husk(p: Paint, x: number, y: number, len: number, w: number, fill: string, vein: string, stalk: string, ang = 90): void {
	p.stroke(stalk, 0.8, `M${pt([x, y - 3])}L${pt([x, y])}`);
	p.body(x, y, ang, len, lantern(w), fill, 0, 7);
	const e = polar(x, y, ang, len);
	p.stroke(vein, 0.55, `M${pt([x, y + 0.8])}Q${pt([x - w * 0.8, y + len * 0.45])} ${pt(e)}M${pt([x, y + 0.8])}Q${pt([x + w * 0.8, y + len * 0.45])} ${pt(e)}M${pt([x, y + 0.8])}L${pt(e)}`);
}
const TOM = { leaf: "#5e9f4e", alt: "#4f8e43", vein: "#33672e", stem: "#5c8a3e", husk: "#bddb8b", hvein: "#7ea154", fruit: "#93c84a", fl: "#f1d248", eye: "#4a3a2a" };
function tomatillo(st: St): string {
	if (st === "sprout") {
		const p = new Paint();
		p.stroke(TOM.stem, 1.6, "M40 87.5Q40 80 40 71");
		p.leaf(40, 72, -155, 7.5, 3, GREEN.light).leaf(40, 72, -25, 7.5, 3, GREEN.light).leaf(40, 71, -115, 6, 2.8, TOM.leaf, 1, TOM.vein).leaf(40, 71, -65, 6, 2.8, TOM.leaf, 1, TOM.vein);
		return `${p}`;
	}
	const p = new Paint();
	const B: [number, number, number, number][] =
		st === "leafy"
			? [[40, 87, 30, 52], [40, 87, 50, 54], [40, 87, 40, 44]]
			: [[40, 87, 18, 44], [40, 87, 62, 46], [40, 80, 30, 26], [40, 80, 52, 28], [40, 87, 40, 18]];
	let sd = "";
	for (const [x, y, ex, ey] of B) sd += `M${x} ${y}Q${pt([x + (ex - x) * 0.2, (y + ey) / 2])} ${ex} ${ey}`;
	p.stroke(TOM.stem, 1.7, sd);
	let i = 0;
	for (const [x, y, ex, ey] of B) {
		for (let t = 0.35; t <= 1.01; t += 0.22, i++) {
			const px = x + (ex - x) * t;
			const py = y + (ey - y) * t;
			const sg = i % 2 ? 1 : -1;
			p.leaf(px, py, -90 + sg * 60 + (ex - x) * 0.6, 9, 3.8, i % 3 ? TOM.leaf : TOM.alt, 1, TOM.vein);
		}
		p.leaf(ex, ey, -90 + (ex - x) * 0.8, 7, 3, TOM.leaf, 1, TOM.vein);
	}
	if (st === "leafy") return `${p.dots([[34, 60], [47, 62]], TOM.fl, 1.4)}`;
	const fr = new Paint();
	const H: [number, number][] = [[22, 50], [57, 52], [31, 36], [49, 33], [41, 52], [62, 66], [17, 64]];
	for (const [x, y] of H) husk(fr, x, y, 11, 5.4, TOM.husk, TOM.hvein, TOM.stem);
	fr.ell(41, 59, 4.6, 4.4, TOM.fruit).stroke(TOM.hvein, 0.6, "M37 56Q36 62 41 64.5M45 56Q46 62 41 64.5");
	fr.dots([[28, 46], [54, 42], [37, 28]], TOM.fl, 1.6).dots([[28, 46], [54, 42], [37, 28]], TOM.eye, 0.6);
	return cat(p, fr);
}
const GRC = { leaf: "#7cae5a", alt: "#6a9c4c", vein: "#4a7a3a", stem: "#6e9a4a", husk: "#dcc58a", hvein: "#b0945a", berry: "#f0b432", fl: "#f2dc6a", eye: "#6a4a2a" };
function groundCherry(st: St): string {
	if (st === "sprout") {
		const p = new Paint();
		p.stroke(GRC.stem, 1.4, "M40 87.5Q40 82 40 76");
		p.leaf(40, 76.5, -160, 7, 3, GREEN.light).leaf(40, 76.5, -20, 7, 3, GREEN.light).leaf(40, 76, -90, 6, 3.2, GRC.leaf, 4, GRC.vein);
		return `${p}`;
	}
	const p = new Paint();
	const B: [number, number, number][] =
		st === "leafy"
			? [[22, 70, 0], [58, 70, 0], [40, 58, 0]]
			: [[8, 70, 0], [72, 70, 0], [20, 54, 0], [60, 54, 0], [40, 46, 0]];
	let sd = "";
	for (const [ex, ey] of B) sd += `M40 87Q${pt([40 + (ex - 40) * 0.55, 86])} ${ex} ${ey}`;
	p.stroke(GRC.stem, 1.4, sd);
	let i = 0;
	for (const [ex, ey] of B) {
		for (let t = 0.4; t <= 1.01; t += 0.3, i++) {
			const px = 40 + (ex - 40) * t;
			const py = 87 + (ey - 87) * t * t - 2;
			p.leaf(px, py, -90 + (i % 2 ? 45 : -45) + (ex - 40) * 0.5, 8, 4, i % 3 ? GRC.leaf : GRC.alt, 4, GRC.vein);
		}
	}
	if (st === "leafy") return `${p.dots([[30, 70], [50, 68]], GRC.fl, 1.2)}`;
	const fr = new Paint();
	const H: [number, number][] = [[17, 64], [63, 64], [30, 62], [50, 60], [28, 50], [53, 47]];
	for (const [x, y] of H) husk(fr, x, y, 7.5, 3.5, GRC.husk, GRC.hvein, GRC.stem);
	// fallen husks, and one opened round a golden berry
	fr.body(20, 85, -10, 6.5, lantern(3), GRC.husk, 0, 6).body(66, 86, 190, 6.5, lantern(3), GRC.husk, 0, 6);
	fr.ell(40, 74, 3, 2.4, GRC.husk, -30).ell(46, 74.5, 3, 2.4, GRC.husk, 30).dots([[43, 72.6]], GRC.berry, 3);
	fr.dots([[36, 56], [45, 56]], GRC.fl, 1.4).dots([[36, 56], [45, 56]], GRC.eye, 0.5);
	return cat(p, fr);
}

// ── 10. Habanero ────────────────────────────────────────────────────────
const HAB = { leaf: "#4f9444", alt: "#64a855", vein: "#2f6229", stem: "#4a7a36", ora: "#f2861c", red: "#d8452a", cap: "#4f7a2e", fl: "#f2efe2" };
function habanero(st: St): string {
	if (st === "sprout") {
		const p = new Paint();
		p.stroke(HAB.stem, 1.6, "M40 87.5Q40 81 40 72");
		p.leaf(40, 72.5, -160, 7.5, 2.6, GREEN.light).leaf(40, 72.5, -20, 7.5, 2.6, GREEN.light).leaf(40, 72, -112, 6.5, 2.8, HAB.leaf, 1, HAB.vein).leaf(40, 72, -68, 6.5, 2.8, HAB.leaf, 1, HAB.vein);
		return `${p}`;
	}
	const s = st === "leafy" ? 0.74 : 1;
	const p = new Paint();
	p.stroke(HAB.stem, 2.2, "M40 87.5L40 72M40 76Q30 70 26 58M40 74Q50 68 54 56M40 72Q41 60 40 46");
	// a rounded dome of leaves
	const cx = 40;
	const cy = 56;
	for (let i = 0; i < 34; i++) {
		const a = i * 137.5;
		const r = 22 * Math.sqrt((i + 0.5) / 34);
		const x = cx + Math.cos(a * D) * r * 1.05;
		const y = cy + Math.sin(a * D) * r * 0.82;
		p.leaf(x, y, -90 + (x - cx) * 2.6 + (rnd(i) - 0.5) * 40, 8, 3.4, i % 3 ? HAB.leaf : HAB.alt, 1, HAB.vein);
	}
	if (st === "leafy") return sc(s, `${p}`);
	const fr = new Paint();
	const P: [number, number, string][] = [[24, 60, HAB.ora], [32, 66, HAB.red], [43, 64, HAB.ora], [53, 62, HAB.ora], [58, 52, HAB.red], [36, 50, HAB.ora], [48, 46, HAB.red], [20, 48, HAB.ora], [30, 40, HAB.ora]];
	const caps: number[][] = [];
	for (const [x, y, c] of P) {
		fr.body(x, y, 96, 9.5, (t) => 4 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.15)), 0.5) * (1 - 0.4 * t) * (0.88 + 0.12 * Math.cos(t * 18)), c, 0.04, 7);
		caps.push([x, y + 0.3]);
	}
	fr.dots(caps, HAB.cap, 1.6).dots([[46, 54], [28, 52], [40, 38]], HAB.fl, 1.3);
	return cat(p, fr);
}

// ── Legumes ─────────────────────────────────────────────────────────────
/** 11. Green bean: a pole bean. */
const GBN = { leaf: "#68a84f", alt: "#5a9846", vein: "#3c7334", vine: "#6e9e4a", pod: "#86c050", pole: "#9a7350", fl: "#efe6f6", fl2: "#c7a9e0" };
function greenBean(st: St): string {
	if (st === "sprout") return beanSprout(GBN.leaf);
	const p = new Paint();
	p.stroke(GBN.pole, 2.6, `M40 88V${by(st, 0, 36, 7)}`);
	const v = new Paint();
	twiner(
		v,
		by(st, 0, 40, 12),
		GBN.vine,
		(x, y, sg, i) => v.tri(x, y, -90 + sg * 55, 5, 8, 4, i % 2 ? GBN.leaf : GBN.alt, GBN.vine, GBN.vein),
		8.5,
		3,
	);
	if (st === "leafy") return cat(p, v);
	const fr = new Paint();
	for (const [x, y, sg] of [[37, 70, -1], [43, 60, 1], [37, 46, -1], [43, 36, 1], [38, 26, -1]] as const) {
		const px = 40 + sg * 6;
		fr.pod(px, y, 90 + sg * 4, 18, 0.05 * sg, 2.1, GBN.pod).pod(px + sg * 1.6, y + 1, 84 + sg * 18, 15, -0.06 * sg, 2.1, GBN.pod);
	}
	fr.pea(45, 52, -60, 1.4, GBN.fl, GBN.fl2).pea(35, 38, -120, 1.4, GBN.fl, GBN.fl2).pea(44, 22, -60, 1.3, GBN.fl, GBN.fl2);
	return cat(p, v, fr);
}

/** 12. Broad bean: upright square stems, glaucous leaves, fat pods. */
const BRB = { leaf: "#94b78e", alt: "#80a67c", vein: "#5c7f5a", stem: "#5f8a55", pod: "#72b04f", seam: "#4c8238", fl: "#f2f0e8", blot: "#2a2420" };
function broadBean(st: St): string {
	if (st === "sprout") {
		const p = new Paint();
		p.stroke(BRB.stem, 2, "M40 87.5L40 70");
		p.leaf(40, 76, -150, 7.5, 3.4, BRB.leaf, 2).leaf(40, 76, -30, 7.5, 3.4, BRB.leaf, 2).leaf(40, 70.5, -120, 6, 2.8, BRB.alt, 2).leaf(40, 70.5, -60, 6, 2.8, BRB.alt, 2);
		return `${p}`;
	}
	const S: [number, number][] = by<[number, number][]>(st, [], [[40, 40], [33, 50], [47, 52]], [[40, 12], [30, 22], [51, 24]]);
	const p = new Paint();
	let sd = "";
	for (const [x, top] of S) sd += `M${x < 40 ? 39 : x > 40 ? 41 : 40} 87.5L${x} ${top}`;
	p.stroke(BRB.stem, 2.4, sd);
	const fl: number[][] = [];
	const bl: number[][] = [];
	S.forEach(([x, top], k) => {
		const bx = x < 40 ? 39 : x > 40 ? 41 : 40;
		for (let y = 80 - k * 3, i = 0; y > top + 3; y -= 9, i++) {
			const t = (87.5 - y) / (87.5 - top);
			const px = bx + (x - bx) * t;
			const sg = i % 2 ? 1 : -1;
			const len = 8 - t * 2.5;
			const ang = -90 + sg * 58;
			const [ex, ey] = polar(px, y, ang, 3);
			p.stroke(BRB.stem, 0.8, `M${pt([px, y])}L${f(ex)} ${f(ey)}`);
			p.leaf(ex, ey, ang - 28, len, len * 0.3, i % 2 ? BRB.leaf : BRB.alt).leaf(ex, ey, ang + 28, len, len * 0.3, i % 2 ? BRB.alt : BRB.leaf);
			if (st === "bloom" && t > 0.5 && t < 0.92) {
				fl.push([px - sg * 2.6, y - 1, sg]);
				bl.push(polar(px - sg * 2.6, y - 1, sg > 0 ? 200 : -20, 1.2));
			}
		}
		p.leaf(x, top, -105, 4.5, 1.6, BRB.leaf).leaf(x, top, -75, 4.5, 1.6, BRB.alt);
	});
	if (st === "leafy") return `${p}`;
	const fr = new Paint();
	for (const [x, y, sg] of fl) fr.pea(x!, y!, sg! > 0 ? 180 : 0, 1.5, BRB.fl);
	fr.dots(bl, BRB.blot, 0.5);
	let sm = "";
	for (const [x, y, a] of [[38.6, 70, -124], [41.4, 64, -56], [37, 52, -114]] as const) {
		fr.body(x, y, a, 19, bumpy(3.4, 3), BRB.pod, 0.04, 8);
		sm += `M${pt(polar(x, y, a, 3))}L${pt(polar(x, y, a, 16))}`;
	}
	fr.stroke(BRB.seam, 0.6, sm);
	return cat(p, fr);
}

/** 13. Chickpea: a low branching bush, small leaflets, puffy pods. */
const CHK = { leaf: "#86a96a", alt: "#9cbb80", stem: "#6d8f4f", pod: "#cfcf92", podD: "#aead6e", fl: "#c45a8a" };
function pinnateDots(p: Paint, pts: number[][], x: number, y: number, ang: number, len: number, r: number, stalk: string, n = 4): void {
	const e = polar(x, y, ang, len);
	p.stroke(stalk, 0.6, `M${pt([x, y])}L${pt(e)}`);
	for (let i = 1; i <= n; i++) {
		const [px, py] = polar(x, y, ang, (len * i) / n);
		if (i === n) pts.push([px, py]);
		else for (const sg of [-1, 1]) pts.push(polar(px, py, ang + sg * 80, r * 1.4));
	}
}
function chickpea(st: St): string {
	if (st === "sprout") return fineSprout(CHK.leaf, 1.4, 17);
	const s = st === "leafy" ? 0.72 : 1;
	const p = new Paint();
	const B: [number, number][] = [[12, 60], [22, 46], [34, 40], [46, 40], [58, 46], [68, 60]];
	let sd = "";
	for (const [ex, ey] of B) sd += `M40 87.5Q${pt([40 + (ex - 40) * 0.25, 70])} ${ex} ${ey}`;
	p.stroke(CHK.stem, 1.3, sd);
	const a: number[][] = [];
	const b: number[][] = [];
	B.forEach(([ex, ey], k) => {
		for (let t = 0.45, i = 0; t <= 1.01; t += 0.18, i++) {
			const u = t;
			const px = 40 + (ex - 40) * (0.5 * u + 0.5 * u * u);
			const py = 87.5 + (ey - 87.5) * u;
			const dir = Math.atan2(ey - 87.5, ex - 40) / D;
			pinnateDots(p, (i + k) % 2 ? a : b, px, py, dir + (i % 2 ? 50 : -50), 7, 1.25, CHK.stem);
		}
	});
	p.dots(a, CHK.leaf, 1.25).dots(b, CHK.alt, 1.25);
	if (st === "leafy") return sc(s, `${p}`);
	const fr = new Paint();
	const P: [number, number, number][] = [[20, 60, -20], [30, 52, 30], [44, 50, -30], [55, 56, 20], [37, 63, 10], [62, 68, -10], [16, 72, 15], [50, 66, 40]];
	let bk = "";
	for (const [x, y, r] of P) {
		fr.ell(x, y, 3.8, 2.8, CHK.pod, r);
		bk += `M${pt(polar(x, y, r, 3.6))}l${pt(polar(0, 0, r - 30, 1.6))}`;
	}
	fr.stroke(CHK.podD, 0.8, bk);
	fr.dots([[26, 44], [50, 42], [12, 56], [66, 52]], CHK.fl, 1.4);
	return cat(p, fr);
}

/** 14. Lentil: a slender airy tuft. */
const LEN = { leaf: "#8cbc5e", alt: "#74a84c", stem: "#6e9a4a", fl: "#c7b5e6", pod: "#c9c27e" };
function lentil(st: St): string {
	if (st === "sprout") return fineSprout(LEN.leaf, 0.9, 20);
	const p = new Paint();
	const S: [number, number, number][] =
		st === "leafy"
			? [[36, 48, 38], [40, 44, 40], [44, 48, 42]]
			: [[30, 20, 34], [35, 16, 38], [40, 12, 40], [45, 15, 42], [50, 20, 46], [26, 30, 32], [54, 28, 48]];
	let sd = "";
	for (const [ex, ey, cx] of S) sd += `M40 87.5Q${cx} ${f((87 + ey) / 2)} ${ex} ${ey}`;
	p.stroke(LEN.stem, 0.8, sd);
	const a: number[][] = [];
	const b: number[][] = [];
	const fl: number[][] = [];
	const pods: number[][] = [];
	S.forEach(([ex, ey, cx], k) => {
		for (let t = 0.3, i = 0; t < 1; t += 0.14, i++) {
			const u = 1 - t;
			const px = u * u * 40 + 2 * u * t * cx + t * t * ex;
			const py = u * u * 87.5 + 2 * u * t * ((87 + ey) / 2) + t * t * ey;
			const dir = Math.atan2(ey - 87.5, ex - 40) / D + (i % 2 ? 42 : -42);
			pinnateDots(p, (i + k) % 2 ? a : b, px, py, dir, 6, 0.75, LEN.stem, 4);
			if (st === "bloom" && i % 2 && t > 0.5) (k % 2 ? fl : pods).push(polar(px, py, dir + 180 + (i % 4 ? 70 : -70), 2.4));
		}
		if (st === "bloom") fl.push([ex, ey - 1]);
	});
	p.dots(a, LEN.leaf, 0.8).dots(b, LEN.alt, 0.8);
	if (st === "leafy") return `${p}`;
	const fr = new Paint();
	for (const [x, y] of pods) fr.ell(x!, y!, 2.3, 1.4, LEN.pod, -30);
	fr.dots(fl, LEN.fl, 1.15);
	return cat(p, fr);
}

/** 15. Soybean: an upright bush, leaves starting to yellow, fuzzy pod clusters. */
const SOY = { leaf: "#5f9a45", alt: "#78ad52", yel: "#aaa848", vein: "#3c6a2e", stem: "#6c8040", pod: "#b2a466", podD: "#8f8248", fuzz: "#d8cd96" };
function soybean(st: St): string {
	if (st === "sprout") return beanSprout(SOY.leaf, "#e2d89a");
	const p = new Paint();
	const top = by(st, 0, 44, 16);
	p.stroke(SOY.stem, 2.2, `M40 87.5Q41 ${f((87 + top) / 2)} 40 ${top}M40 74Q30 66 26 ${top + 22}M40 70Q50 62 54 ${top + 20}`);
	const N: [number, number, number][] = [];
	for (let y = 74, i = 0; y > top - 1; y -= 8, i++) N.push([40, y, i % 2 ? 1 : -1]);
	N.push([26, top + 22, -1], [54, top + 20, 1]);
	N.forEach(([x, y, sg], i) => {
		const fill = st === "bloom" && i % 3 === 1 ? SOY.yel : i % 2 ? SOY.leaf : SOY.alt;
		p.tri(x, y, -90 + sg * (50 + (y - top) * 0.6), 9, 8, 3.8, fill, SOY.stem, SOY.vein);
	});
	if (st === "leafy") return `${p}`;
	const fr = new Paint();
	const pods: [number, number, number][] = [];
	for (const [x, y, k] of [[40, 74, 1], [40, 58, 1], [40, 42, 1], [31.6, 61, 0], [49, 57, 0]] as const) {
		pods.push([x - 1, y, 118], [x + 1, y, 62]);
		if (k) pods.push([x - 1, y - 2, 150], [x + 1, y - 2, 30]);
	}
	const fz: number[][] = [];
	for (const [x, y, a] of pods) {
		fr.pod(x, y, a, 7, 0.08, 3.2, SOY.pod);
		fz.push(polar(x, y, a, 2.5), polar(x, y, a, 6));
	}
	fr.dots(fz, SOY.fuzz, 0.7);
	return cat(p, fr);
}

/** 16. Peanut: a low clump, 4-leaflet leaves, yellow flowers, pods on the soil. */
const PNT = { leaf: "#6aa84e", alt: "#5a9644", vein: "#3c6e33", stem: "#7a9a50", fl: "#f2b134", peg: "#d6c39a", shell: "#d9b27a", net: "#b38955" };
function peanutLeaf(p: Paint, x: number, y: number, ang: number, s: number, fill: string): void {
	const e = polar(x, y, ang, 6 * s);
	const m = polar(x, y, ang, 2.8 * s);
	p.stroke(PNT.stem, 0.8, `M${pt([x, y])}L${pt(e)}`);
	for (const q of [m, e]) p.leaf(q[0], q[1], ang - 55, 5 * s, 2.6 * s, fill, 2, PNT.vein).leaf(q[0], q[1], ang + 55, 5 * s, 2.6 * s, fill, 2, PNT.vein);
}
function peanut(st: St): string {
	if (st === "sprout") {
		const p = new Paint();
		p.stroke(PNT.stem, 1.6, "M40 87.5Q40 81 40 74");
		p.ell(37, 80, 3, 2, "#e4cf9a", 15).ell(43, 80, 3, 2, "#e4cf9a", -15);
		peanutLeaf(p, 40, 75, -90, 0.9, PNT.leaf);
		return `${p}`;
	}
	const s = st === "leafy" ? 0.78 : 1;
	const p = new Paint();
	const B: [number, number][] = [[10, 66], [20, 56], [32, 50], [48, 50], [60, 56], [70, 66]];
	let sd = "";
	for (const [ex, ey] of B) sd += `M40 87.5Q${pt([40 + (ex - 40) * 0.45, 84])} ${ex} ${ey}`;
	p.stroke(PNT.stem, 1.4, sd);
	B.forEach(([ex, ey], k) => {
		const dir = Math.atan2(ey - 86, ex - 40) / D;
		peanutLeaf(p, ex, ey, dir, 1, k % 2 ? PNT.leaf : PNT.alt);
		const [mx, my] = [40 + (ex - 40) * 0.55, 86 + (ey - 86) * 0.5];
		peanutLeaf(p, mx, my, dir - 40 * Math.sign(ex - 40), 0.85, k % 2 ? PNT.alt : PNT.leaf);
	});
	if (st === "leafy") return sc(s, `${p}`);
	const fr = new Paint();
	fr.stroke(PNT.peg, 0.7, "M28 72Q27 80 26 86M52 72Q54 80 55 86M38 74Q37 81 36.5 86");
	fr.pea(28, 70, -90, 1.8, PNT.fl).pea(52, 70, -90, 1.8, PNT.fl).pea(44, 64, -80, 1.6, PNT.fl).pea(35, 62, -100, 1.6, PNT.fl);
	const nut = (x: number, y: number, a: number) => fr.body(x, y, a, 10, (t) => 2.6 * Math.pow(Math.sin(Math.PI * t), 0.4) * (0.8 + 0.22 * Math.cos(2 * Math.PI * t)), PNT.shell, 0, 8);
	nut(14, 86.4, -8);
	nut(57, 86.6, 6);
	nut(64, 84, -20);
	fr.dots([[17, 85.4], [21, 85.6], [60, 86.6], [64, 87.2], [67, 82.4], [71, 81]], PNT.net, 0.5);
	return cat(p, fr);
}

/** 17. Black-eyed pea: long pods held up in pairs above big leaves. */
const BEP = { leaf: "#4f9a48", alt: "#61ab55", vein: "#2f6229", stem: "#5d8a44", pod: "#d0b66a", young: "#8fbf5a", fl: "#c8a8e0", bean: "#f0e8d0", eye: "#2a221e" };
function blackEyedPea(st: St): string {
	if (st === "sprout") return beanSprout(BEP.leaf);
	const p = new Paint();
	const N: [number, number, number][] = [[40, 80, -1], [40, 76, 1], [40, 72, -1], [40, 68, 1], [40, 66, -1]];
	p.stroke(BEP.stem, 2, "M40 87.5L40 64");
	N.forEach(([x, y, sg], i) => p.tri(x, y, -90 + sg * (75 - i * 12), by(st, 0, 11, 13), by(st, 0, 10, 11.5), 4, i % 2 ? BEP.leaf : BEP.alt, BEP.stem, BEP.vein));
	if (st === "leafy") return `${p}`;
	const fr = new Paint();
	fr.stroke(BEP.stem, 1, "M40 68Q33 50 29 36M40 68Q47 48 52 34M40 66Q40 52 41 42");
	const V: [number, number, string][] = [[29, 36, BEP.pod], [52, 34, BEP.pod], [41, 42, BEP.young]];
	for (const [x, y, c] of V) fr.pod(x, y, -128, 17, 0.14, 2.2, c).pod(x, y, -52, 17, -0.14, 2.2, c);
	fr.pea(41, 41, -90, 1.7, BEP.fl).pea(29, 35, -90, 1.5, BEP.fl);
	const beans: number[][] = [[28, 86, 10], [33.4, 87, -12], [51, 86.4, 6]];
	for (const [x, y, r] of beans) fr.ell(x!, y!, 2.3, 1.5, BEP.bean, r);
	for (const [x, y, r] of beans) fr.ell(x! + 0.2, y! - 0.4, 0.9, 0.5, BEP.eye, r);
	return cat(p, fr);
}

/** 18. Lima bean: broad, flat crescent pods in hanging clusters. */
const LIM = { leaf: "#72b056", alt: "#5f9c48", vein: "#3f7334", stem: "#5f8f45", pod: "#c4df8c", seed: "#e3f0bd", fl: "#eef0d8" };
function limaBean(st: St): string {
	if (st === "sprout") return beanSprout(LIM.leaf);
	const p = new Paint();
	const B: [number, number][] = by<[number, number][]>(st, [], [[30, 52], [50, 50], [40, 44]], [[22, 40], [58, 38], [34, 28], [48, 26]]);
	let sd = "";
	for (const [ex, ey] of B) sd += `M40 87.5Q${pt([40 + (ex - 40) * 0.2, (87 + ey) / 2])} ${ex} ${ey}`;
	p.stroke(LIM.stem, 1.7, sd);
	let i = 0;
	for (const [ex, ey] of B) {
		for (let t = 0.6; t <= 1.01; t += 0.4, i++) {
			const x = 40 + (ex - 40) * t;
			const y = 87.5 + (ey - 87.5) * t;
			p.tri(x, y, -90 + (i % 2 ? 50 : -50) + (ex - 40), 5, 9.5, 4.8, i % 2 ? LIM.leaf : LIM.alt, LIM.stem, LIM.vein, 4);
		}
	}
	if (st === "leafy") return `${p}`;
	const fr = new Paint();
	const seeds: number[][] = [];
	for (const [x, y] of [[29, 58], [51, 56], [40, 67]] as const) {
		for (const a of [72, 108]) {
			const b = a < 90 ? -0.13 : 0.13;
			fr.body(x, y, a, 14, (t) => 3.4 * Math.pow(Math.sin(Math.PI * t), 0.5) * (0.62 + 0.38 * Math.abs(Math.sin(3 * Math.PI * t))), LIM.pod, b, 9);
			for (const t of [0.17, 0.5, 0.83]) {
				const m = polar(x, y, a, 14 * t);
				seeds.push(polar(m[0], m[1], a + 90, b * 14 * 4 * t * (1 - t)));
			}
		}
	}
	fr.dots(seeds, LIM.seed, 1.6).dots([[29, 57.6], [51, 55.6], [40, 66.6]], LIM.stem, 1.2);
	fr.pea(33, 44, -90, 1.4, LIM.fl).pea(47, 42, -90, 1.4, LIM.fl);
	return cat(p, fr);
}

/** 25. Mung bean: an erect little bush crowned with clusters of slender dark pods. */
const MUN = { leaf: "#5e9c48", alt: "#72ae58", vein: "#386a2e", stem: "#6a8a44", pod: "#3a302a", young: "#a6cf6c", fl: "#f0dc6a" };
function mungBean(st: St): string {
	if (st === "sprout") return beanSprout(MUN.leaf, "#c8d88a");
	const p = new Paint();
	const top = by(st, 0, 48, 34);
	p.stroke(MUN.stem, 2, `M40 87.5L40 ${top}M40 76Q31 70 29 ${top + 12}M40 74Q49 68 51 ${top + 10}`);
	const N: [number, number, number][] = [[40, 78, -1], [40, 72, 1], [40, 66, -1], [40, 60, 1], [40, top + 6, -1], [29, top + 12, -1], [51, top + 10, 1]];
	N.forEach(([x, y, sg], i) => p.tri(x, y, -90 + sg * 62, 6, 8.5, 3.6, i % 2 ? MUN.leaf : MUN.alt, MUN.stem, MUN.vein));
	if (st === "leafy") return `${p}`;
	const fr = new Paint();
	const C: [number, number][] = [[40, 36], [29, 48], [51, 46]];
	fr.stroke(MUN.stem, 0.9, "M40 34L40 36");
	for (const [x, y] of C) {
		for (let j = 0; j < 6; j++) {
			const a = -30 + j * 48 + (rnd(x + j) - 0.5) * 12;
			fr.pod(x, y, a, 8.5, 0.05, 2.6, j % 2 ? MUN.young : MUN.pod);
		}
	}
	fr.dots([[34, 30], [47, 30]], MUN.fl, 1.3);
	return cat(p, fr);
}

/** 24. Winged bean: a teepee of two poles, frilly four-winged pods, pale blue flowers. */
const WGB = { leaf: "#5ea24c", alt: "#4d903f", vein: "#356a2e", vine: "#6e9e4a", pod: "#a6d86c", frill: "#5f9a36", pole: "#9a7350", fl: "#9db2ec", fl2: "#7c92d6" };
function wingedBean(st: St): string {
	if (st === "sprout") return beanSprout(WGB.leaf);
	const p = new Paint();
	p.stroke(WGB.pole, 2.2, "M24 88L45 8M56 88L35 8");
	const top = by(st, 0, 48, 14);
	const v = new Paint();
	let vd = "";
	const nodes: [number, number, number][] = [];
	for (const [x0, x1, sg] of [[25, 44, -1], [55, 36, 1]] as const) {
		vd += `M40 87.5Q${(40 + x0) / 2} 87 ${x0 + (x1 - x0) * 0.05} 84`;
		for (let y = 80, i = 0; y > top; y -= 11, i++) {
			const t = (88 - y) / 80;
			const x = x0 + (x1 - x0) * t + (i % 2 ? 2.4 : -2.4);
			vd += `L${pt([x, y])}`;
			nodes.push([x, y, (i % 2 ? 1 : -1) * sg]);
		}
	}
	v.stroke(WGB.vine, 1.2, vd);
	nodes.forEach(([x, y, sg], i) => v.tri(x, y, -90 + sg * 70, 4, 7.5, 3.8, i % 2 ? WGB.leaf : WGB.alt, WGB.vine, WGB.vein));
	if (st === "leafy") return cat(p, v);
	const fr = new Paint();
	let fd = "";
	for (const [x, y, len] of [[29, 44, 22], [51, 40, 22], [40, 58, 20]] as const) {
		fr.body(x, y, 90, len, (t) => 2.6 * Math.pow(Math.sin(Math.PI * t), 0.25), WGB.pod, 0.02, 6);
		for (const sg of [-1, 1]) {
			fd += `M${pt([x + sg * 2.6, y + 1.5])}`;
			for (let j = 1; j < len / 2; j++) fd += `L${pt([x + sg * (2.6 + (j % 2 ? 1.4 : 0)), y + 1.5 + j * 2])}`;
		}
	}
	fr.stroke(WGB.frill, 1, fd);
	fr.pea(44, 30, -70, 2.2, WGB.fl, WGB.fl2).pea(34, 30, -110, 2.2, WGB.fl, WGB.fl2).pea(47, 70, -70, 2, WGB.fl, WGB.fl2).pea(31, 72, -110, 2, WGB.fl, WGB.fl2);
	return cat(p, v, fr);
}

// ── 19. Bottle gourd / 20. Luffa / 22. Chayote: climbing gourds ──────────
const BOT = { leaf: "#78b862", alt: "#68a654", vein: "#4a8040", vine: "#86b866", fruit: "#bcd88c", speck: "#d9ebb4", fl: "#f4f1e6", eye: "#e4c64a" };
function bottleGourd(st: St): string {
	if (st === "sprout") return cucSprout(BOT.leaf, { depth: 0.12 });
	const p = new Paint();
	p.stroke(STAKE, 2.2, "M13 88V30Q40 4 67 30V88");
	const v = new Paint();
	const o: PalmOpts = { lobes: 5, depth: 0.12, k: 1, fill: BOT.leaf, vein: BOT.vein };
	const L: [number, number, number][] =
		st === "leafy"
			? [[18, 76, 7], [9, 66, 6.5], [18, 56, 7.5], [9, 46, 6.5], [17, 38, 6]]
			: [[18, 76, 7.5], [8, 64, 7], [18, 52, 7.5], [8, 40, 6.5], [20, 28, 7.5], [30, 16, 7.5], [44, 14, 7.5], [57, 20, 7.5], [66, 32, 7], [72, 44, 6]];
	v.stroke(BOT.vine, 1.4, st === "leafy" ? "M40 87.5Q20 86 14 76L13 40" : "M40 87.5Q20 86 14 76L13 32Q40 6 66 30L68 44");
	L.forEach(([x, y, R], i) => v.palm(x, y, -90 + (x - 40) * 1.2, R, { ...o, fill: i % 2 ? BOT.alt : BOT.leaf }));
	if (st === "leafy") return cat(p, v);
	const fr = new Paint();
	fr.stroke(BOT.vine, 1.2, "M40 17L40 25");
	const prof = (t: number) => Math.pow(Math.sin(Math.PI * t), 0.4) * (2.4 + 2.6 * gauss(t, 0.18, 0.1) + 7.6 * gauss(t, 0.74, 0.17));
	fr.body(40, 24, 90, 48, prof, BOT.fruit, 0.015, 12);
	fr.dots([[37, 29], [42, 33], [35, 58], [44, 62], [38, 66], [45, 55]], BOT.speck, 0.6);
	fr.star(26, 26, 4, BOT.fl, BOT.eye).star(58, 26, 4, BOT.fl, BOT.eye).star(10, 52, 3.6, BOT.fl, BOT.eye);
	return cat(p, v, fr);
}

const LUF = { leaf: "#5f9e48", alt: "#4f8c3e", vein: "#356a2e", vine: "#7cb05a", fruit: "#4f8a3c", ridge: "#2f5e2a", dry: "#b0905e", dryR: "#8a6c40", fl: "#f6cf3a", eye: "#d58f1c" };
function luffa(st: St): string {
	if (st === "sprout") return cucSprout(LUF.leaf, { depth: 0.3, k: 1.8 });
	const p = new Paint();
	p.stroke(STAKE, 2.4, "M40 88V12M12 13H68");
	const v = new Paint();
	const o: PalmOpts = { lobes: 5, depth: 0.32, k: 1.8, fill: LUF.leaf, vein: LUF.vein };
	if (st === "leafy") {
		twiner(v, 40, LUF.vine, (x, y, sg, i) => {
			v.stroke(LUF.vine, 0.9, `M${pt([x, y])}L${pt([x + sg * 8, y - 1])}`);
			v.palm(x + sg * 8, y - 1, -90 + sg * 35, 7, { ...o, fill: i % 2 ? LUF.leaf : LUF.alt });
		}, 9, 3);
		return cat(p, v);
	}
	twiner(v, 20, LUF.vine, (x, y, sg, i) => {
		v.stroke(LUF.vine, 0.9, `M${pt([x, y])}L${pt([x + sg * 8, y - 1])}`);
		v.palm(x + sg * 8, y - 1, -90 + sg * 35, 7.4, { ...o, fill: i % 2 ? LUF.leaf : LUF.alt });
	}, 12, 3);
	v.stroke(LUF.vine, 1.3, "M40 14Q26 10 13 15M40 14Q54 10 67 15");
	for (const [x, i] of [[16, 0], [27, 1], [53, 0], [64, 1]] as const) v.palm(x, 12, -90, 6.5, { ...o, fill: i ? LUF.leaf : LUF.alt });
	const fr = new Paint();
	let rd = "";
	let dr = "";
	for (const [x, len, c] of [[21, 34, LUF.fruit], [31, 26, LUF.fruit], [58, 30, LUF.dry]] as const) {
		fr.stroke(LUF.vine, 1, `M${x} 16V20`);
		fr.body(x, 19, 90, len, (t) => 3.6 * Math.pow(Math.sin(Math.PI * t), 0.35) * (0.8 + 0.2 * t), c, 0.01, 8);
		const d = `M${x - 1.6} 23V${f(19 + len - 3)}M${x + 1.6} 23V${f(19 + len - 3)}M${x} 22V${f(19 + len - 1)}`;
		if (c === LUF.dry) dr += d;
		else rd += d;
	}
	fr.stroke(LUF.ridge, 0.6, rd).stroke(LUF.dryR, 0.6, dr);
	fr.star(49, 24, 5.2, LUF.fl, LUF.eye).star(66, 30, 4.4, LUF.fl, LUF.eye).star(30, 56, 4.4, LUF.fl, LUF.eye);
	return cat(p, v, fr);
}

const CHY = { leaf: "#6aa850", alt: "#5a9644", vein: "#3c6e33", vine: "#7cb05a", fruit: "#c6de8f", crease: "#98b964", fl: "#efe9b0" };
function chayote(st: St): string {
	if (st === "sprout") return cucSprout(CHY.leaf, { depth: 0.18, k: 2 });
	const p = new Paint();
	p.stroke(STAKE, 2.4, "M10 88V36M70 88V36").stroke(STAKE, 1.8, "M8 40H72M8 62H72");
	const v = new Paint();
	const o: PalmOpts = { lobes: 5, depth: 0.2, k: 2, fill: CHY.leaf, vein: CHY.vein };
	const L: [number, number, number][] =
		st === "leafy"
			? [[34, 70, 7.5], [46, 62, 8], [36, 52, 8], [48, 44, 7.5], [40, 38, 7]]
			: [[30, 74, 7], [48, 68, 7.5], [36, 56, 7.5], [16, 34, 7.5], [28, 30, 8.5], [42, 28, 9], [56, 31, 8.5], [66, 36, 7], [24, 44, 6.5], [60, 46, 6.5]];
	v.stroke(CHY.vine, 1.4, st === "leafy" ? "M40 87.5Q34 72 42 60T40 40" : `M40 87.5Q34 72 42 60T40 40Q24 38 10 36M40 40Q56 36 70 38${tendril(70, 38)}${tendril(8, 37, -1)}`);
	L.forEach(([x, y, R], i) => v.palm(x, y, -90 + (x - 40) * 1.3, R, { ...o, fill: i % 2 ? CHY.alt : CHY.leaf }));
	if (st === "leafy") return cat(p, v);
	const fr = new Paint();
	let cd = "";
	for (const [x, y, s] of [[22, 42, 1], [37, 42, 1.1], [54, 42, 0.95]] as const) {
		fr.stroke(CHY.vine, 1, `M${x} ${y - 2}V${y + 1}`);
		fr.body(x, y, 90, 15 * s, (t) => s * (2 + 5.4 * Math.pow(t, 0.9)) * Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.55 + 0.45)), 0.5) * Math.pow(Math.sin(Math.PI * t), 0.3), CHY.fruit, 0, 8);
		const b = y + 15 * s;
		cd += `M${pt([x - 2 * s, y + 4 * s])}Q${pt([x - 4.4 * s, b - 4])} ${pt([x - 1.4 * s, b - 1])}M${pt([x + 2 * s, y + 4 * s])}Q${pt([x + 4.4 * s, b - 4])} ${pt([x + 1.4 * s, b - 1])}M${pt([x, b - 3])}V${f(b - 0.6)}`;
	}
	fr.stroke(CHY.crease, 0.7, cd);
	fr.dots([[30, 22], [50, 22], [62, 27]], CHY.fl, 1.2);
	return cat(p, v, fr);
}

export const SPECIES: Species[] = [
	{ id: "zucchini", name: "Zucchini", draw: zucchini },
	{ id: "butternut-squash", name: "Butternut squash", draw: butternut },
	{ id: "acorn-squash", name: "Acorn squash", draw: acorn },
	{ id: "cucumber", name: "Cucumber", draw: cucumber },
	{ id: "watermelon", name: "Watermelon", draw: watermelon },
	{ id: "cantaloupe", name: "Cantaloupe", draw: cantaloupeSp },
	{ id: "bitter-melon", name: "Bitter melon", draw: bitterMelon },
	{ id: "okra", name: "Okra", draw: okra },
	{ id: "tomatillo", name: "Tomatillo", draw: tomatillo },
	{ id: "habanero", name: "Habanero", draw: habanero },
	{ id: "green-bean", name: "Green bean", draw: greenBean },
	{ id: "broad-bean", name: "Broad bean", draw: broadBean },
	{ id: "chickpea", name: "Chickpea", draw: chickpea },
	{ id: "lentil", name: "Lentil", draw: lentil },
	{ id: "soybean", name: "Soybean", draw: soybean },
	{ id: "peanut", name: "Peanut", draw: peanut },
	{ id: "black-eyed-pea", name: "Black-eyed pea", draw: blackEyedPea },
	{ id: "lima-bean", name: "Lima bean", draw: limaBean },
	{ id: "bottle-gourd", name: "Bottle gourd", draw: bottleGourd },
	{ id: "luffa", name: "Luffa", draw: luffa },
	{ id: "ground-cherry", name: "Ground cherry", draw: groundCherry },
	{ id: "chayote", name: "Chayote", draw: chayote },
	{ id: "pattypan-squash", name: "Pattypan squash", draw: pattypan },
	{ id: "winged-bean", name: "Winged bean", draw: wingedBean },
	{ id: "mung-bean", name: "Mung bean", draw: mungBean },
];
