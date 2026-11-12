/**
 * Garden species, family: succulents II (owner design, 2026-11-11).
 * Drawn in the shared kit style; see kit.ts for the cell and the rules.
 */
import { bez, circle, f, type GrowingStage, line, type Pt, type Species } from "./kit";

type XY = readonly [number, number];
type Cmd = readonly (string | number)[];
type Curve = readonly [Pt, Pt, Pt, Pt];
/** x, y, angle, length, width */
type Lf = readonly [number, number, number, number, number];

// ── private helpers ──────────────────────────────────────────────────────

/** Round dots, drawn compactly as one path of zero-length round-capped strokes. */
const dots = (pts: readonly XY[], r: number, color: string): string =>
	pts.length ? `<path d="${pts.map(([x, y]) => `M${f(x)} ${f(y)}h0`).join("")}" stroke="${color}" stroke-width="${f(r * 2)}" stroke-linecap="round"/>` : "";

const ell = (x: number, y: number, rx: number, ry: number, fill: string, a = 0): string =>
	`<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(rx)}" ry="${f(ry)}" fill="${fill}"${a ? ` transform="rotate(${f(a)} ${f(x)} ${f(y)})"` : ""}/>`;

const fill = (d: string, c: string): string => (d ? `<path d="${d}" fill="${c}"/>` : "");

const strk = (d: string, c: string, w: number, opacity?: number): string =>
	d ? `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${opacity === undefined ? "" : ` opacity="${opacity}"`}/>` : "";

/** Points and directions (degrees) along a cubic. */
function along(p: Curve, n: number): [number, number, number][] {
	const out: [number, number, number][] = [];
	for (let i = 0; i < n; i++) {
		const t = (i + 0.5) / n;
		const [x, y] = bez(p, t);
		const [x2, y2] = bez(p, Math.min(1, t + 0.01));
		const [x0, y0] = bez(p, Math.max(0, t - 0.01));
		out.push([x, y, (Math.atan2(y2 - y0, x2 - x0) * 180) / Math.PI]);
	}
	return out;
}

const cubic = (p: Curve): string => `M${f(p[0][0])} ${f(p[0][1])}C${f(p[1][0])} ${f(p[1][1])} ${f(p[2][0])} ${f(p[2][1])} ${f(p[3][0])} ${f(p[3][1])}`;

const mirror = (p: Curve): Curve => [
	[80 - p[0][0], p[0][1]],
	[80 - p[1][0], p[1][1]],
	[80 - p[2][0], p[2][1]],
	[80 - p[3][0], p[3][1]],
];

/** A deterministic pseudo-random number in [0, 1). */
const rnd = (i: number): number => {
	const v = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
	return v - Math.floor(v);
};

/** A local point rotated by `a` degrees and moved to (x, y). */
function rot(x: number, y: number, a: number, lx: number, ly: number): XY {
	const r = (a * Math.PI) / 180;
	const c = Math.cos(r);
	const s = Math.sin(r);
	return [x + lx * c - ly * s, y + lx * s + ly * c];
}

/** A unit shape (path commands) scaled by (sx, sy), rotated and placed: absolute path data, so many merge into one path. */
function xf(x: number, y: number, a: number, sx: number, sy: number, cmds: readonly Cmd[]): string {
	let o = "";
	for (const cm of cmds) {
		o += cm[0];
		const nums = cm.slice(1) as number[];
		for (let i = 0; i < nums.length; i += 2) {
			const [px, py] = rot(x, y, a, nums[i]! * sx, nums[i + 1]! * sy);
			o += `${i ? " " : ""}${f(px)} ${f(py)}`;
		}
	}
	return o;
}

const half = (c1x: number, c1y: number, c2x: number, c2y: number): Cmd[] => [
	["M", 0, 0],
	["C", c1x, c1y, c2x, c2y, 1, 0],
	["C", c2x, -c2y, c1x, -c1y, 0, 0],
	["Z"],
];

/** Leaf outlines along +x: 0 oval, 1 pointed, 2 round, 4 heart-ish, 5 tongue, 6 spoon. */
const SH: Record<number, readonly Cmd[]> = {
	0: half(0.3, -1, 0.8, -1),
	1: half(0.45, -1.15, 0.8, -0.5),
	2: half(0.05, -1.4, 1.02, -1.3),
	3: [["M", 0, -0.5], ["L", 1, 0, 0, 0.5], ["Z"]],
	4: half(0.1, -1.6, 0.75, -1.2),
	5: half(0.02, -1, 1, -1.15),
	6: half(0.55, -1.5, 1.1, -0.9),
};

const lp = (x: number, y: number, a: number, len: number, w: number, sh = 0): string => xf(x, y, a, len, w, SH[sh]!);

/** Many leaves of one colour as one path. */
const leaves = (ls: readonly Lf[], sh: number, c: string): string => fill(ls.map(([x, y, a, len, w]) => lp(x, y, a, len, w, sh)).join(""), c);

/** Points on a leaf: t along its length, s across its half-width. */
const onL = (x: number, y: number, a: number, len: number, w: number, ts: readonly XY[]): XY[] => ts.map(([t, s]) => rot(x, y, a, t * len, s * w));

/** n angles evenly from `from` to `to`. */
const span = (n: number, from: number, to: number): number[] => Array.from({ length: n }, (_, i) => (n === 1 ? from : from + ((to - from) * i) / (n - 1)));

/** A fan of leaves from one point. */
const fan = (x: number, y: number, n: number, from: number, to: number, len: number, w: number): Lf[] => span(n, from, to).map((a) => [x, y, a, len, w] as const);

/** A rosette seen at a slant: n leaves around (x, y), squashed by `sq`; back half first, then the front half. */
function disc(x: number, y: number, R: number, n: number, w: number, sh: number, back: string, front: string, sq: number, off = 0): string {
	let b = "";
	let fr = "";
	for (let i = 0; i < n; i++) {
		const t = ((off + (i * 360) / n) * Math.PI) / 180;
		const ex = R * Math.cos(t);
		const ey = R * Math.sin(t) * sq;
		const d = lp(x, y, (Math.atan2(ey, ex) * 180) / Math.PI, Math.hypot(ex, ey), w, sh);
		if (Math.sin(t) < 0) b += d;
		else fr += d;
	}
	return fill(b, back) + fill(fr, front);
}

/** A daisy as one stroked path of spokes. */
function daisy(x: number, y: number, n: number, r: number, color: string, center: string, width = 1.1): string {
	let d = "";
	for (let i = 0; i < n; i++) {
		const a = (i * 2 * Math.PI) / n;
		d += `M${f(x + Math.cos(a) * 1.2)} ${f(y + Math.sin(a) * 1.2)}L${f(x + Math.cos(a) * r)} ${f(y + Math.sin(a) * r)}`;
	}
	return strk(d, color, width) + circle(x, y, r * 0.36, center);
}

/** Small five-point stars as one path of round-capped spokes. */
function stars(pts: readonly XY[], r: number, color: string, w: number, n = 5): string {
	let d = "";
	for (const [x, y] of pts)
		for (let i = 0; i < n; i++) {
			const a = (i * 2 * Math.PI) / n - Math.PI / 2;
			d += `M${f(x)} ${f(y)}l${f(Math.cos(a) * r)} ${f(Math.sin(a) * r)}`;
		}
	return strk(d, color, w);
}

// ── 1. Gasteria ──────────────────────────────────────────────────────────

const GSPK: readonly XY[] = [[0.28, 0.32], [0.42, -0.36], [0.56, 0.3], [0.7, -0.3], [0.84, 0.12], [0.36, -0.02], [0.64, 0.02]];

/** Tongue leaves stacked in two ranks, speckled white. */
function gFan(spec: readonly (readonly [number, number, number])[]): string {
	let a1 = "";
	let a2 = "";
	const sp: XY[] = [];
	spec.forEach(([a, len, w], i) => {
		const d = lp(40, 86, a, len, w, 5);
		if (Math.floor(i / 2) % 2) a2 += d;
		else a1 += d;
		sp.push(...onL(40, 86, a, len, w, GSPK));
	});
	return fill(a1, "#3d6142") + fill(a2, "#4e7652") + dots(sp, 0.45, "#dbe4cc");
}

function gasteria(stage: GrowingStage): string {
	if (stage === "sprout") return gFan([[-135, 11, 3], [-45, 11, 3], [-100, 9, 2.8], [-80, 9, 2.8]]);
	const k = stage === "leafy" ? 1 : 1.12;
	const fanned = gFan(
		([[-162, 22, 4.6], [-18, 22, 4.6], [-136, 28, 5], [-44, 28, 5], [-108, 30, 5], [-72, 30, 5]] as const).map(
			([a, len, w]) => [a, len * k, w * k] as const,
		),
	);
	if (stage === "leafy") return fanned;
	const st: Curve = [[42, 70], [44, 36], [52, 12], [68, 12]];
	let fl = "";
	const tips: XY[] = [];
	for (const [x, y] of along(st, 14).slice(6)) {
		fl += ell(x, y + 2.8, 1.3, 2.7, "#d8667a");
		tips.push([x, y + 5.3]);
	}
	return fanned + strk(cubic(st), "#8f9a6c", 1.2) + fl + dots(tips, 0.85, "#a9c47c");
}

// ── 2. Moonstones ────────────────────────────────────────────────────────

const MO = ["#a29fc6", "#bdb7d9", "#d4cde7"];
const MO_EGGS: readonly (readonly [number, number, number])[] = [
	[-90, 7, 0], [-128, 7, 0], [-52, 7, 0], [-165, 7, 0], [-15, 7, 0],
	[168, 5.5, 1], [12, 5.5, 1], [132, 5, 1], [48, 5, 1], [90, 4.2, 1],
	[-90, 2.4, 2],
];

/** Plump egg leaves, chalky lilac. */
function mRos(cx: number, cy: number, s: number): string {
	let o = "";
	const hi: XY[] = [];
	for (const [a, r, k] of MO_EGGS) {
		const t = (a * Math.PI) / 180;
		const x = cx + Math.cos(t) * r * s;
		const y = cy + Math.sin(t) * r * s * 0.8;
		o += ell(x, y, 4.4 * s, 3.1 * s, MO[k]!, a);
		if (k) hi.push([x - 1.1 * s, y - 1 * s]);
	}
	return o + dots(hi, 0.8 * s, "#e8e3f2");
}

function moonstones(stage: GrowingStage): string {
	if (stage === "sprout") return mRos(40, 80, 0.62);
	if (stage === "leafy") return strk("M40 87V64", "#958ea8", 3) + mRos(27, 81, 0.55) + mRos(40, 62, 1.2);
	const st: Curve = [[45, 48], [49, 26], [60, 15], [68, 24]];
	let bells = "";
	const mouths: XY[] = [];
	for (const [x, y] of along(st, 10).slice(5)) {
		bells += ell(x, y + 2.3, 1.5, 2.3, "#cf4a3e");
		mouths.push([x, y + 4.4]);
	}
	return (
		strk("M40 87V56M40 82Q30 80 24 72", "#958ea8", 3) +
		mRos(58, 79, 0.7) +
		mRos(23, 70, 0.85) +
		mRos(40, 54, 1.3) +
		strk(cubic(st), "#b98a8e", 1.1) +
		bells +
		dots(mouths, 0.8, "#ef9a6a")
	);
}

// ── 3. Ghost plant ───────────────────────────────────────────────────────

function gpRos(x: number, y: number, s: number): string {
	return (
		leaves(fan(x, y, 6, -172, -8, 9.5 * s, 3.5 * s), 1, "#a99aa7") +
		leaves(fan(x, y, 4, -140, -40, 7.2 * s, 3.2 * s), 1, "#c8b7b9") +
		leaves([145, 35, 90].map((a) => [x, y, a, 6 * s, 3 * s] as const), 1, "#bba9ae") +
		leaves(fan(x, y, 2, -110, -70, 4.2 * s, 2.4 * s), 1, "#ddd0cb")
	);
}

function ghostPlant(stage: GrowingStage): string {
	if (stage === "sprout") return gpRos(40, 81, 0.75);
	if (stage === "leafy") return strk("M40 87C39 79 35 73 31 66M42 87Q48 84 54 80", "#9d8a84", 2.2) + gpRos(54, 79, 0.75) + gpRos(31, 64, 1.2);
	const fl: XY[] = [[29, 21], [36, 13], [51, 10], [55, 24], [42, 18]];
	return (
		strk("M38 87C34 76 28 66 24 56M42 87C48 80 54 74 58 66", "#9d8a84", 2.4) +
		strk("M26 48C27 36 32 26 42 18M30 32Q28 26 29 21M35 25Q38 18 36 13M42 18Q48 14 51 10M42 18Q50 19 55 24", "#b29a92", 0.9) +
		gpRos(40, 81, 0.7) +
		gpRos(58, 64, 1) +
		gpRos(24, 54, 1.3) +
		stars(fl, 2.2, "#e8ddd0", 1.3) +
		dots(fl, 0.6, "#c25a4e")
	);
}

// ── 4. Black rose aeonium ────────────────────────────────────────────────

function aRos(x: number, y: number, s: number): string {
	return disc(x, y, 10 * s, 10, 3.4 * s, 6, "#4a1f3d", "#6a2f55", 0.5) + disc(x, y - 0.6 * s, 6 * s, 6, 3 * s, 6, "#7d3a64", "#8c4670", 0.5, 22) + circle(x, y - 0.8 * s, 1.5 * s, "#8a7440");
}

function blackRose(stage: GrowingStage): string {
	if (stage === "sprout") return strk("M40 87V81", "#8b7d66", 1.8) + aRos(40, 80, 0.65);
	if (stage === "leafy") return strk("M40 87V58", "#8b7d66", 3) + strk("M38.5 80h3M38.5 72h3M38.5 64h3", "#6e624f", 0.7) + aRos(40, 57, 1.1);
	const cone: XY[] = [];
	const cone2: XY[] = [];
	let row = 0;
	for (let y = 42; y >= 16; y -= 2.2, row++) {
		const hw = (5 * (y - 15)) / 27 + 0.3;
		for (let x = 40 - hw + ((row % 2) * 2.2) / 2; x <= 40 + hw + 0.1; x += 2.2) (Math.round(x + y) % 2 ? cone : cone2).push([x, y]);
	}
	return (
		strk("M40 87V48M40 70Q30 64 26 52M40 64Q52 58 56 46", "#8b7d66", 3) +
		aRos(26, 51, 0.95) +
		aRos(56, 45, 1) +
		strk("M40 46V16", "#9a8a50", 1.4) +
		dots(cone, 1.15, "#e8c64a") +
		dots(cone2, 1.15, "#d4aa36") +
		aRos(40, 48, 1.2)
	);
}

// ── 5. Buddha's temple ───────────────────────────────────────────────────

/** A square stack of flat triangular leaves: sawtooth silhouette plus pale rims. */
function temple(x: number, top: number, w0: number): string {
	const n = Math.max(2, Math.round((86 - top) / 2.6));
	const left: XY[] = [];
	let rims = "";
	for (let i = 0; i < n; i++) {
		const y = 86 - i * 2.6;
		const w = w0 * (1 - (0.45 * i) / n);
		left.push([x - w, y - 1], [x - w * 0.8, y - 2.3]);
		rims += `M${f(x - w)} ${f(y - 1)}Q${f(x)} ${f(y + 0.7)} ${f(x + w)} ${f(y - 1)}`;
	}
	const tipY = 86 - n * 2.6 - 1.2;
	const pts = [[x - w0 * 0.8, 87] as XY, ...left, [x, tipY] as XY, ...left.map(([px, py]) => [2 * x - px, py] as XY).reverse(), [x + w0 * 0.8, 87] as XY];
	return fill(`M${pts.map(([px, py]) => `${f(px)} ${f(py)}`).join("L")}Z`, "#86a27c") + strk(rims, "#bccfa9", 0.7);
}

function buddhasTemple(stage: GrowingStage): string {
	if (stage === "sprout") return temple(40, 72, 5);
	if (stage === "leafy") return temple(28, 66, 5.5) + temple(40, 48, 8);
	const bloom = (x: number, y: number) => strk(`M${f(x)} ${f(y + 5)}V${f(y)}`, "#9a9a7a", 0.8) + dots([[x - 1.6, y], [x + 1.6, y], [x, y - 1.4], [x - 0.8, y + 1.2], [x + 0.8, y + 1.2]], 1.2, "#f3e2e8") + dots([[x, y]], 0.6, "#d58ea8");
	return temple(24, 48, 7) + temple(57, 42, 7.5) + temple(40, 28, 9.5) + bloom(40, 19) + bloom(24, 39) + bloom(57, 33);
}

// ── 6. Calico hearts ─────────────────────────────────────────────────────

function calico(spec: readonly (readonly [number, number, number])[]): string {
	let a1 = "";
	let a2 = "";
	const big: XY[] = [];
	const small: XY[] = [];
	spec.forEach(([a, len, w], i) => {
		const d = lp(40, 86, a, len, w, 6);
		if (i % 2) a2 += d;
		else a1 += d;
		big.push(...onL(40, 86, a, len, w, [[0.58, 0.32], [0.78, -0.3]]));
		small.push(...onL(40, 86, a, len, w, [[0.7, 0.08], [0.88, 0.4], [0.5, -0.25], [0.92, -0.1]]));
	});
	return fill(a1, "#9fa98a") + fill(a2, "#b2bb9a") + dots(big, 1.05, "#7a3a4a") + dots(small, 0.6, "#86434f");
}

function calicoHearts(stage: GrowingStage): string {
	if (stage === "sprout") return calico([[-130, 10, 3], [-50, 10, 3], [-90, 11, 3.2]]);
	const k = stage === "leafy" ? 1 : 1.15;
	const body = calico(([[-158, 17, 4.2], [-22, 17, 4.2], [-128, 21, 4.6], [-52, 21, 4.6], [-104, 23, 4.6], [-76, 23, 4.6]] as const).map(([a, len, w]) => [a, len * k, w * k] as const));
	if (stage === "leafy") return body;
	const st: Curve = [[41, 66], [42, 44], [44, 26], [48, 10]];
	let tubes = "";
	const tips: XY[] = [];
	along(st, 10)
		.slice(4)
		.forEach(([x, y, a], i) => {
			const [tx, ty] = rot(x, y, a + (i % 2 ? 60 : -60), 3.4, 0);
			tubes += `M${f(x)} ${f(y)}L${f(tx)} ${f(ty)}`;
			tips.push([tx, ty]);
		});
	return body + strk(cubic(st), "#a49a80", 0.9) + strk(tubes, "#e6cfcf", 1.6) + dots(tips, 0.8, "#c2707e");
}

// ── 7. Blue chalksticks ──────────────────────────────────────────────────

function fingers(spec: readonly (readonly [number, number, number])[], w: number): string {
	let a = "";
	let b = "";
	spec.forEach(([x0, tx, ty], i) => {
		const d = `M${f(x0)} 87Q${f(x0 + (tx - x0) * 0.15)} ${f((87 + ty) / 2)} ${f(tx)} ${f(ty)}`;
		if (i % 2) b += d;
		else a += d;
	});
	return strk(a, "#82abc2", w) + strk(b, "#a5c5d8", w);
}

function blueChalksticks(stage: GrowingStage): string {
	if (stage === "sprout") return fingers([[38, 33, 74], [42, 47, 73], [40, 39, 70], [40, 43, 77]], 3);
	if (stage === "leafy")
		return fingers([[34, 18, 64], [46, 62, 64], [36, 22, 54], [44, 58, 54], [37, 28, 47], [43, 52, 47], [39, 34, 43], [41, 46, 43], [40, 40, 40], [38, 30, 58], [42, 50, 58], [40, 36, 52], [40, 44, 52]], 3.4);
	const heads: [number, number][] = [[29, 20], [44, 15], [57, 22]];
	let brush = "";
	for (const [x, y] of heads) for (const dx of [-2, -1, 0, 1, 2]) brush += `M${f(x + dx * 0.4)} ${f(y)}L${f(x + dx * 0.9)} ${f(y - 3.2 + Math.abs(dx) * 0.5)}`;
	return (
		strk("M38 62Q34 40 29 20M40 60Q42 38 44 15M42 62Q50 40 57 22", "#7d9db0", 0.9) +
		fingers(
			[[32, 10, 66], [48, 70, 66], [33, 13, 54], [47, 67, 54], [35, 19, 45], [45, 61, 45], [36, 25, 38], [44, 55, 38], [38, 32, 34], [42, 48, 34], [40, 40, 32], [36, 23, 57], [44, 57, 57], [38, 33, 48], [42, 47, 48], [40, 39, 44]],
			3.6,
		) +
		heads.map(([x, y]) => ell(x, y + 0.6, 1.7, 1.2, "#9ab6c6")).join("") +
		strk(brush, "#e9e2cc", 0.9)
	);
}

// ── 8. String of bananas ─────────────────────────────────────────────────

const BANANA: readonly Cmd[] = [["M", 0, 0], ["Q", 0.6, 0, 1, -0.32]];

/** Trailing strands set with upturned banana leaves. */
function bananas(strands: readonly (readonly [Curve, number])[], L: number): string {
	let st = "";
	let a = "";
	let b = "";
	for (const [p, n] of strands) {
		st += cubic(p);
		along(p, n).forEach(([x, y, d], i) => {
			const r = (d * Math.PI) / 180;
			const up = Math.sin(r - 0.73) < Math.sin(r + 0.73) ? d - 42 : d + 42;
			const sy = Math.sin(((up - 90) * Math.PI) / 180) < 0 ? L : -L;
			const sh = xf(x, y, up + (i % 2 ? 10 : -10), L, sy, BANANA);
			if (i % 2) b += sh;
			else a += sh;
		});
	}
	return strk(st, "#6a9446", 0.7) + strk(a, "#9fcd6c", 2.3) + strk(b, "#87ba5a", 2.3);
}

function stringOfBananas(stage: GrowingStage): string {
	if (stage === "sprout")
		return bananas(
			[
				[[[40, 86], [39, 81], [37, 77], [35, 72]], 3],
				[[[40, 86], [41, 81], [44, 78], [46, 74]], 3],
			],
			4,
		);
	if (stage === "leafy") {
		const arc: Curve = [[39, 86], [32, 70], [20, 66], [13, 80]];
		return bananas(
			[
				[arc, 7],
				[mirror(arc), 7],
				[[[40, 86], [40, 76], [38, 64], [36, 54]], 6],
				[[[41, 86], [44, 78], [48, 72], [50, 64]], 4],
			],
			4.4,
		);
	}
	const hi: Curve = [[39, 86], [30, 58], [14, 54], [8, 78]];
	const trail: Curve = [[38, 86], [30, 84], [20, 84], [12, 86]];
	const flower = (x: number, y: number) => dots([[x - 1.2, y], [x + 1.2, y], [x, y - 1.1], [x, y + 0.9]], 1.5, "#f3efe2") + dots([[x - 0.9, y - 1.8], [x + 0.9, y - 1.8], [x, y - 2.5]], 0.5, "#9c78b0");
	return (
		strk("M33 52Q30 38 28 26M40 58Q41 40 42 21M47 54Q52 42 54 30", "#7c9a5c", 0.8) +
		bananas(
			[
				[trail, 6],
				[mirror(trail), 6],
				[hi, 10],
				[mirror(hi), 10],
				[[[40, 86], [38, 66], [34, 54], [30, 44]], 8],
				[[[41, 86], [43, 68], [46, 56], [50, 47]], 8],
			],
			4.6,
		) +
		flower(28, 25) +
		flower(42, 20) +
		flower(54, 29)
	);
}

// ── 9. String of dolphins ────────────────────────────────────────────────

const DOLPHIN: readonly Cmd[] = [["M", 0, 0.4], ["C", 1, -2.8, 4.6, -3.8, 6.8, -1.9], ["L", 8.2, -1.6, 7, -0.5], ["C", 5.2, -0.3, 3, 0.6, 1.3, 1.8], ["Z"], ["M", 2.8, -2.6], ["L", 2.2, -4.8, 4.6, -3.1], ["Z"]];

/** Strands of leaping dolphins: each leaf points up and forward. */
function dolphins(strands: readonly (readonly [Curve, number])[], s: number): string {
	let st = "";
	let a = "";
	let b = "";
	for (const [p, n] of strands) {
		st += cubic(p);
		along(p, n).forEach(([x, y, d], i) => {
			const right = Math.cos((d * Math.PI) / 180) >= 0;
			const ang = right ? d - 62 : d + 62;
			const sh = xf(x, y, ang, s, right ? s : -s, DOLPHIN);
			if (i % 2) b += sh;
			else a += sh;
		});
	}
	return strk(st, "#5e8f68", 0.7) + fill(a, "#84c3a0") + fill(b, "#a2d6b6");
}

function stringOfDolphins(stage: GrowingStage): string {
	if (stage === "sprout")
		return dolphins(
			[
				[[[40, 86], [40, 80], [42, 76], [46, 72]], 2],
				[[[40, 86], [39, 81], [37, 78], [34, 76]], 2],
			],
			0.75,
		);
	if (stage === "leafy")
		return dolphins(
			[
				[[[40, 86], [42, 60], [58, 56], [64, 74]], 5],
				[[[40, 86], [38, 64], [24, 58], [16, 72]], 5],
				[[[40, 86], [41, 74], [48, 68], [52, 76]], 2],
			],
			0.85,
		);
	const flower = (x: number, y: number) => dots([[x - 1.2, y], [x + 1.2, y], [x, y - 1.1]], 1.5, "#f2e1e6") + dots([[x, y - 0.2]], 0.7, "#c87a92");
	return (
		strk("M41 74Q43 50 47 30M39 70Q34 52 30 40", "#6f9a72", 0.8) +
		dolphins(
			[
				[[[40, 86], [44, 44], [64, 36], [70, 62]], 7],
				[[[40, 86], [36, 50], [18, 42], [10, 64]], 7],
				[[[40, 86], [43, 68], [56, 64], [60, 80]], 3],
				[[[40, 86], [37, 70], [26, 66], [21, 80]], 3],
			],
			0.95,
		) +
		flower(47, 29) +
		flower(30, 39)
	);
}

// ── 10. Pig's ear ────────────────────────────────────────────────────────

/** Opposite pairs of round leaves with a red rim. */
function rimPairs(pairs: readonly (readonly [number, number, number, number, number])[], body: string, rim: string, k = 1): string {
	let o = "";
	for (const [y, aL, aR, len, w] of pairs)
		for (const a of [aL, aR]) o += fill(lp(40, y, a, (len + 1) * k, (w + 0.7) * k, 2), rim) + fill(lp(40, y, a, len * k, w * k, 2), body);
	return o;
}

/** Upturned spoon leaves in opposite pairs along stems: [x, y, stem angle, len, w]. */
function peLeaves(ls: readonly Lf[]): string {
	let rim = "";
	let body = "";
	for (const [x, y, a, len, w] of ls)
		for (const da of [-36, 36]) {
			rim += lp(x, y, a + da, len + 0.9, w + 0.6, 6);
			body += lp(x, y, a + da, len, w, 6);
		}
	return fill(rim, "#b84a4a") + fill(body, "#a8c3bb");
}

function pigsEar(stage: GrowingStage): string {
	const ST = "#8aa093";
	if (stage === "sprout") return line(40, 87, 40, 80, ST, 1.8) + peLeaves([[40, 84, -90, 8, 2.8], [40, 80, -90, 6, 2.4]]);
	if (stage === "leafy")
		return strk("M40 87V60M40 76Q48 70 51 62", ST, 2.4) + peLeaves([[40, 82, -90, 11, 3.6], [40, 72, -90, 11, 3.6], [51, 63, -70, 9, 3.2], [40, 62, -90, 9, 3.2]]);
	const bells: XY[] = [[33, 23], [37, 26], [42, 27], [47, 26], [51, 23]];
	let ped = "";
	let b = "";
	for (const [x, y] of bells) {
		ped += `M42 18Q${f((x + 42) / 2)} ${f(y - 4)} ${f(x)} ${f(y)}`;
		b += ell(x, y + 2.4, 1.6, 2.8, "#d6513a");
	}
	return (
		strk("M40 87V52M40 78Q30 72 26 60M40 72Q50 66 55 56", ST, 2.6) +
		strk("M40 54C40 40 41 28 42 18", "#b07a62", 1.4) +
		strk(ped, "#b07a62", 0.7) +
		b +
		dots(bells.map(([x, y]) => [x, y + 5] as const), 0.9, "#ec8a5a") +
		circle(42, 16, 1.4, "#d6513a") +
		peLeaves([[40, 83, -90, 12, 4], [26, 61, -110, 10, 3.6], [55, 57, -65, 10, 3.6], [33, 70, -125, 10, 3.6], [48, 67, -55, 10, 3.6], [40, 64, -90, 11, 3.8], [40, 55, -90, 9, 3.2]])
	);
}

// ── 11. Paddle plant ─────────────────────────────────────────────────────

const PADDLES = [[86, -158, -22, 13, 6.5], [81, -132, -48, 14, 7], [75, -114, -66, 14, 7], [69, -100, -80, 12, 6]] as const;

function paddlePlant(stage: GrowingStage): string {
	const PB = "#b7cea2";
	const PR = "#c6503f";
	if (stage === "sprout") return rimPairs([[86, -140, -40, 9, 4.5], [84, -105, -75, 9, 4.2]], PB, PR);
	if (stage === "leafy") return rimPairs(PADDLES, PB, PR);
	const fl: XY[] = [];
	const fl2: XY[] = [];
	let row = 0;
	for (let y = 40; y >= 10; y -= 1.9, row++) {
		const hw = 3.4 * Math.min(1, (y - 7) / 14);
		for (const dx of [-hw, 0, hw]) (row % 2 ? fl : fl2).push([40 + dx + (row % 2 ? 0.8 : -0.8) * (dx === 0 ? 1 : 0), y]);
	}
	return (
		strk("M40 70V40", "#c9c29a", 3.4) +
		fill("M36.4 42Q36 22 40 8Q44 22 43.6 42Z", "#d9cf86") +
		dots(fl, 1.1, "#f2ecc0") +
		dots(fl2, 1.1, "#e6dc9c") +
		rimPairs(PADDLES, PB, PR, 1.18)
	);
}

// ── 12. Mother of thousands ──────────────────────────────────────────────

const MT_TEETH: readonly XY[] = [[0.3, 0.66], [0.45, 0.72], [0.6, 0.62], [0.75, 0.44], [0.3, -0.66], [0.45, -0.72], [0.6, -0.62], [0.75, -0.44]];

function mtLeaves(pairs: readonly (readonly [number, number, number, number, number])[]): string {
	let a = "";
	let b = "";
	const p: XY[] = [];
	for (const [y, aL, aR, len, w] of pairs)
		for (const ang of [aL, aR]) {
			a += lp(40, y, ang, len, w, 1);
			b += `M${f(rot(40, y, ang, 2, 0)[0])} ${f(rot(40, y, ang, 2, 0)[1])}L${f(rot(40, y, ang, len * 0.85, 0)[0])} ${f(rot(40, y, ang, len * 0.85, 0)[1])}`;
			p.push(...onL(40, y, ang, len, w, MT_TEETH));
		}
	return fill(a, "#668c64") + strk(b, "#8a5a6a", 0.7, 0.7) + dots(p, 0.85, "#a8d87c");
}

function motherOfThousands(stage: GrowingStage): string {
	if (stage === "sprout") return line(40, 87, 40, 76, "#7a7a5a", 1.8) + mtLeaves([[82, -150, -30, 9, 2.4], [77, -120, -60, 8, 2.2]]);
	if (stage === "leafy") return line(40, 87, 40, 50, "#7a7a5a", 2.4) + mtLeaves([[80, -162, -18, 18, 4], [70, -150, -30, 19, 4.2], [60, -134, -46, 17, 4], [52, -112, -68, 12, 3.2]]);
	const bells: XY[] = [[29, 24], [33, 26.5], [37.5, 27.5], [42.5, 27.5], [47, 26.5], [51, 24], [35, 21.5], [45, 21.5]];
	let ped = "";
	let b = "";
	for (const [x, y] of bells) {
		ped += `M40 19Q${f((x + 40) / 2)} ${f(Math.min(y, 20) - 2)} ${f(x)} ${f(y)}`;
		b += ell(x, y + 2.5, 1.3, 2.6, "#c88aa4");
	}
	return (
		line(40, 87, 40, 19, "#7a7a5a", 2.4) +
		strk(ped, "#8a7a6a", 0.6) +
		b +
		dots(bells.map(([x, y]) => [x, y + 4.9] as const), 0.7, "#8a4a68") +
		mtLeaves([[80, -164, -16, 18, 4], [71, -152, -28, 20, 4.3], [62, -138, -42, 18, 4.1], [53, -124, -56, 15, 3.6], [45, -108, -72, 10, 2.8]])
	);
}

// ── 13. Elephant bush ────────────────────────────────────────────────────

type Seg = readonly [number, number, number, number, number];

/** Red-brown branches set with pairs of tiny round leaves. */
function eBush(segs: readonly Seg[], from: number): string {
	let st = "";
	const a: XY[] = [];
	const b: XY[] = [];
	segs.forEach(([x1, y1, x2, y2, w], i) => {
		st += line(x1, y1, x2, y2, "#8e4a3c", w);
		if (i < from) return;
		const L = Math.hypot(x2 - x1, y2 - y1);
		const nx = -(y2 - y1) / L;
		const ny = (x2 - x1) / L;
		const n = Math.max(1, Math.floor(L / 3.6));
		for (let k = 1; k <= n; k++) {
			const t = k / n;
			const x = x1 + (x2 - x1) * t;
			const y = y1 + (y2 - y1) * t;
			(k % 2 ? a : b).push([x + nx * 2.1, y + ny * 2.1]);
			(k % 2 ? b : a).push([x - nx * 2.1, y - ny * 2.1]);
		}
		a.push([x2, y2 - 1.2]);
	});
	return st + dots(a, 1.55, "#79b957") + dots(b, 1.55, "#93cc6a");
}

const EB_BLOOM: readonly Seg[] = [
	[40, 87, 40, 62, 3.2],
	[40, 74, 26, 58, 2],
	[26, 58, 17, 44, 1.5],
	[26, 58, 31, 44, 1.3],
	[40, 66, 40, 42, 2.1],
	[40, 42, 34, 25, 1.4],
	[40, 46, 48, 29, 1.3],
	[40, 68, 55, 54, 2],
	[55, 54, 64, 40, 1.5],
	[55, 54, 52, 41, 1.2],
];

function elephantBush(stage: GrowingStage): string {
	if (stage === "sprout") return eBush([[40, 87, 40, 72, 1.6]], 0);
	if (stage === "leafy") return eBush([[40, 87, 40, 66, 2.4], [40, 76, 30, 63, 1.6], [40, 70, 51, 58, 1.6], [40, 66, 38, 50, 1.4]], 1);
	const pink: XY[] = [];
	for (const [x, y] of [[17, 44], [31, 44], [34, 25], [48, 29], [64, 40], [52, 41], [40, 41]] as const)
		pink.push([x, y - 3], [x - 1.6, y - 4.4], [x + 1.6, y - 4.4], [x, y - 5.8], [x - 1.4, y - 2], [x + 1.4, y - 2]);
	return eBush(EB_BLOOM, 1) + dots(pink, 0.85, "#eaa2c2");
}

// ── 14. String of hearts ─────────────────────────────────────────────────

const HEART: readonly Cmd[] = [["M", 1, 0], ["C", 0.45, -1.05, -0.3, -0.65, 0.22, 0], ["C", -0.3, 0.65, 0.45, 1.05, 1, 0], ["Z"]];

/** Thin purple strands with sparse pairs of marbled hearts. */
function hearts(strands: readonly (readonly [Curve, number])[], L: number, lanterns: readonly XY[] = []): string {
	let st = "";
	let h = "";
	const m: XY[] = [];
	for (const [p, n] of strands) {
		st += cubic(p);
		for (const [x, y, d] of along(p, n))
			for (const a of [d - 80, d + 80]) {
				h += xf(x, y, a, L, L, HEART);
				m.push(rot(x, y, a, L * 0.48, 0));
			}
	}
	let lt = "";
	for (const [x, y] of lanterns) lt += strk(`M${f(x)} ${f(y)}V${f(y - 2)}`, "#8a5a7a", 0.6) + ell(x, y - 4, 1.1, 2.3, "#dcb2c6") + circle(x, y - 6.4, 1.1, "#5c2f50");
	return strk(st, "#8a5a7a", 0.7) + fill(h, "#4f7656") + dots(m, L * 0.2, "#b7c6b4") + lt;
}

function stringOfHearts(stage: GrowingStage): string {
	if (stage === "sprout")
		return hearts(
			[
				[[[40, 86], [39, 80], [37, 76], [35, 72]], 2],
				[[[40, 86], [41, 80], [43, 77], [45, 74]], 2],
			],
			4,
		);
	if (stage === "leafy") {
		const arc: Curve = [[40, 86], [36, 60], [24, 54], [18, 72]];
		return hearts([[arc, 4], [mirror(arc), 4], [[[40, 86], [40, 76], [39, 68], [38, 60]], 2]], 4.6);
	}
	const hi: Curve = [[40, 86], [34, 36], [14, 28], [8, 72]];
	const lo: Curve = [[40, 86], [38, 60], [26, 54], [22, 74]];
	return hearts([[hi, 6], [mirror(hi), 6], [lo, 3], [mirror(lo), 3]], 5, [[30, 40], [50, 40], [16, 44], [64, 47]]);
}

// ── 15. Sticks on fire ───────────────────────────────────────────────────

const FIRE = {
	sprout: ["#8fa84a", "#a8ad46", "#c2a845"],
	leafy: ["#8fa84a", "#a8ad46", "#c4a240", "#d98a36", "#e5672f"],
	bloom: ["#a3a44a", "#bfa243", "#d68a38", "#e4692f", "#e5502c", "#ec3f2a"],
} as const;
const FIRE_W = [3.2, 2.6, 2.1, 1.7, 1.4, 1.2];

function sticks(x: number, y: number, a: number, len: number, depth: number, max: number, segs: string[]): void {
	const [x2, y2] = rot(x, y, a, len, 0);
	segs[depth] += `M${f(x)} ${f(y)}L${f(x2)} ${f(y2)}`;
	if (depth >= max) return;
	const sp = 19 + (depth % 2) * 7 + rnd(x * 7 + y) * 6;
	sticks(x2, y2, a - sp, len * (0.76 + rnd(x + y * 3) * 0.08), depth + 1, max, segs);
	sticks(x2, y2, a + sp * 0.9, len * (0.74 + rnd(x * 5 - y) * 0.08), depth + 1, max, segs);
}

function sticksOnFire(stage: GrowingStage): string {
	const cols = FIRE[stage];
	const segs = cols.map(() => "");
	const len = stage === "sprout" ? 6 : stage === "leafy" ? 12 : 15.5;
	sticks(40, 87, -90, len, 0, cols.length - 1, segs);
	return segs.map((d, i) => strk(d, cols[i]!, FIRE_W[i]!)).join("");
}

// ── 16. Desert rose ──────────────────────────────────────────────────────

/** A swollen bottle trunk. */
function caudex(cx: number, w: number, top: number): string {
	const h = 87 - top;
	return (
		fill(
			`M${f(cx - w * 0.9)} 87C${f(cx - w * 1.3)} ${f(87 - h * 0.4)} ${f(cx - w * 0.45)} ${f(top + h * 0.3)} ${f(cx - w * 0.35)} ${f(top)}L${f(cx + w * 0.35)} ${f(top)}C${f(cx + w * 0.45)} ${f(top + h * 0.3)} ${f(cx + w * 1.3)} ${f(87 - h * 0.4)} ${f(cx + w * 0.9)} 87Z`,
			"#b59674",
		) + ell(cx - w * 0.45, 87 - h * 0.38, w * 0.22, h * 0.22, "#c9ad8a")
	);
}

const tuft = (x: number, y: number, s: number): string =>
	leaves(fan(x, y, 3, -150, -30, 8 * s, 2.6 * s), 6, "#3e7c46") + leaves(fan(x, y, 2, -115, -65, 8.5 * s, 2.6 * s), 6, "#55985a");

function adenium(pts: readonly XY[]): string {
	const p: XY[] = [];
	for (const [x, y] of pts) for (let i = 0; i < 5; i++) p.push(rot(x, y, i * 72 - 90, 2.3, 0));
	return dots(p, 2, "#e2527f") + dots(pts, 1.5, "#f7dde6") + dots(pts, 0.6, "#c03a66");
}

function desertRose(stage: GrowingStage): string {
	if (stage === "sprout") return caudex(40, 4.5, 80) + tuft(40, 80, 0.75);
	if (stage === "leafy") return caudex(40, 9, 70) + strk("M37.5 71Q32 64 28 58M42.5 71Q48 64 52 56", "#a88a6a", 3) + tuft(28, 58, 1) + tuft(52, 56, 1) + tuft(40, 70, 0.8);
	return (
		caudex(40, 12, 64) +
		strk("M35.5 65Q28 56 22 48M40 64V42M44.5 65Q54 56 58 44", "#a88a6a", 3.4) +
		tuft(22, 48, 1.1) +
		tuft(40, 42, 1.1) +
		tuft(58, 44, 1.1) +
		adenium([[16, 42], [27, 40], [36, 35], [46, 35], [55, 38], [64, 40]])
	);
}

// ── 17. Bear's paw ───────────────────────────────────────────────────────

const CLAWS: readonly XY[] = [[0.93, -0.55], [0.99, -0.18], [0.99, 0.18], [0.93, 0.55]];

function paws(ls: readonly Lf[]): string {
	let a = "";
	let b = "";
	const c: XY[] = [];
	ls.forEach(([x, y, ang, len, w], i) => {
		const d = lp(x, y, ang, len, w, 6);
		if (i % 2) b += d;
		else a += d;
		c.push(...onL(x, y, ang, len, w, CLAWS));
	});
	return fill(a, "#8abd68") + fill(b, "#9fcc7c") + dots(c, 0.55, "#8a2c2c");
}

const pair = (x: number, y: number, aL: number, aR: number, len: number, w: number): Lf[] => [[x, y, aL, len, w], [x, y, aR, len, w]];

function bearsPaw(stage: GrowingStage): string {
	if (stage === "sprout") return line(40, 87, 40, 80, "#7d8a5a", 1.6) + paws([...pair(40, 82, -140, -40, 7, 2.8), ...pair(40, 80, -105, -75, 6, 2.6)]);
	if (stage === "leafy") return line(40, 87, 40, 62, "#7d8a5a", 2.2) + paws([...pair(40, 80, -152, -28, 10, 3.8), ...pair(40, 72, -132, -48, 10.5, 4), ...pair(40, 64, -112, -68, 10, 3.8), ...pair(40, 61, -97, -83, 7, 3)]);
	const bells: XY[] = [[33, 28], [36.5, 25], [30, 32], [49, 31], [52.5, 28], [46, 34]];
	return (
		strk("M40 60Q40 42 35 26M40 60Q44 44 51 30", "#8a7a5a", 1) +
		bells.map(([x, y]) => ell(x, y + 2.4, 1.5, 2.6, "#ef915f")).join("") +
		dots(bells.map(([x, y]) => [x, y + 4.8] as const), 0.75, "#f6c86e") +
		strk("M40 87V58M40 78Q30 74 26 66M40 72Q50 68 54 60", "#7d8a5a", 2.4) +
		paws([
			...pair(40, 82, -160, -20, 11, 4),
			...pair(26, 66, -150, -95, 10, 3.8),
			...pair(54, 60, -85, -30, 10, 3.8),
			...pair(40, 72, -135, -45, 11, 4.2),
			...pair(40, 64, -115, -65, 10.5, 4),
			...pair(40, 59, -98, -82, 7.5, 3.2),
		])
	);
}

// ── 18. Medusa's head ────────────────────────────────────────────────────

/** Snake-like arms: out from the caudex, then up. */
function arms(spec: readonly (readonly [number, number, number])[], c: string): string {
	let d = "";
	const bumps: XY[] = [];
	const tips: Lf[] = [];
	for (const [sx, tx, ty] of spec) {
		const p: Curve = [[sx, 83], [sx + (tx - sx) * 0.5, 84], [tx - (tx - sx) * 0.12, ty + (83 - ty) * 0.42], [tx, ty]];
		d += cubic(p);
		along(p, 7).forEach(([x, y], i) => i > 1 && bumps.push([x + (i % 2 ? 0.6 : -0.6), y]));
		tips.push([tx, ty, -90, 3.2, 1.5], [tx, ty, -130, 2.8, 1.4], [tx, ty, -50, 2.8, 1.4]);
	}
	return strk(d, c, 2.8) + dots(bumps, 0.45, "#a8c88e") + leaves(tips, 1, "#9fcf72");
}

function medusasHead(stage: GrowingStage): string {
	const body = (rx: number) => ell(40, 84, rx, rx * 0.42, "#8a9a68") + ell(40, 82.6, rx * 0.55, rx * 0.2, "#9fae7c");
	if (stage === "sprout") return arms([[38, 30, 76], [42, 50, 76]], "#6b9158") + body(5) + arms([[38, 33, 80], [42, 47, 80]], "#80a86a");
	if (stage === "leafy") return arms([[37, 22, 62], [39, 32, 57], [41, 48, 57], [43, 58, 62]], "#6b9158") + body(8) + arms([[36, 13, 72], [38, 24, 69], [42, 56, 69], [44, 67, 72]], "#80a86a");
	const ring: XY[] = [];
	for (let i = 0; i < 9; i++) {
		const t = (i * 2 * Math.PI) / 9;
		ring.push([40 + Math.cos(t) * 5.5, 81.6 + Math.sin(t) * 1.8]);
	}
	return (
		arms([[36, 12, 60], [38, 22, 52], [39, 31, 48], [41, 49, 48], [42, 58, 52], [44, 68, 60]], "#6b9158") +
		body(11) +
		arms([[35, 6, 72], [37, 15, 68], [39, 25, 66], [41, 55, 66], [43, 65, 68], [45, 74, 72]], "#80a86a") +
		dots(ring, 1, "#ece4a6") +
		dots(ring, 0.4, "#c9b85a")
	);
}

// ── 19. Baseball plant ───────────────────────────────────────────────────

function ball(cx: number, cy: number, rx: number, ry: number): string {
	let ribs = "";
	for (let k = 1; k < 8; k++) {
		const off = (-1 + (2 * k) / 8) * rx * 1.8;
		ribs += `M${f(cx)} ${f(cy - ry)}Q${f(cx + off)} ${f(cy)} ${f(cx)} ${f(cy + ry)}`;
	}
	let bands = "";
	for (let j = 1; j < 7; j++) {
		const y = cy - ry + (2 * ry * j) / 7;
		const hw = rx * Math.sqrt(1 - ((y - cy) / ry) ** 2) * 0.98;
		bands += `M${f(cx - hw)} ${f(y)}Q${f(cx)} ${f(y + ry * 0.16)} ${f(cx + hw)} ${f(y)}`;
	}
	return ell(cx, cy, rx, ry, "#a4ae8c") + strk(bands, "#8b6879", Math.max(0.8, ry * 0.09), 0.55) + strk(ribs, "#76845f", 0.8, 0.75) + ell(cx, cy - ry + 0.9, rx * 0.18, 0.8, "#76845f");
}

function baseballPlant(stage: GrowingStage): string {
	if (stage === "sprout") return ball(40, 81, 6, 6.2);
	if (stage === "leafy") return ball(40, 74.5, 12, 13);
	const cy: XY[] = [[36.5, 49.5], [43.5, 49.5], [40, 48]];
	return ball(40, 68, 17.5, 19.5) + strk("M36.5 51.5V49.5M43.5 51.5V49.5M40 50V48", "#8a8a5a", 0.8) + dots(cy, 1.2, "#c8a86c") + dots(cy, 0.5, "#ecdca6");
}

// ── 20. Lace aloe ────────────────────────────────────────────────────────

const LACE = [
	[11, -178, -2, 14, 4.2, "#335c3e"],
	[9, -162, -18, 13, 4, "#3f6c49"],
	[7, -144, -36, 11.5, 3.8, "#4c7b55"],
	[3, -112, -68, 8.5, 3.4, "#5a8a5f"],
] as const;

function laceAloe(stage: GrowingStage): string {
	const s = stage === "sprout" ? 0.5 : stage === "leafy" ? 1.1 : 1.3;
	let o = "";
	let br = "";
	const spk: XY[] = [];
	for (const [n, from, to, len, w, c] of LACE) {
		const ls = fan(40, 86, n, from, to, len * s, w * s);
		o += leaves(ls, 1, c);
		for (const [x, y, a, L, W] of ls) {
			if (s > 0.6) spk.push(...onL(x, y, a, L, W, [[0.32, 0.28], [0.5, -0.24], [0.68, 0.16]]));
			const [ax, ay] = rot(x, y, a, L - 0.3, 0);
			const [bx, by] = rot(x, y, a, L + 1.5 * s, 0);
			br += `M${f(ax)} ${f(ay)}L${f(bx)} ${f(by)}`;
		}
		o += dots(spk.splice(0), 0.42, "#e4ecdc");
	}
	o += strk(br, "#eef2e6", 0.5);
	if (stage !== "bloom") return o;
	const main: Curve = [[41, 74], [42, 52], [44, 34], [46, 16]];
	const side: Curve = [[43, 42], [40, 36], [35, 30], [31, 22]];
	let tubes = "";
	for (const [x, y] of [...along(main, 14).slice(8), ...along(side, 9).slice(4)]) tubes += `M${f(x)} ${f(y)}l${f(x > 42 ? 1.4 : -1.4)} 3.2`;
	return strk(cubic(main) + cubic(side), "#94785a", 1.1) + strk(tubes, "#e0603e", 1.7) + o;
}

// ── 21. Silver dollar plant ──────────────────────────────────────────────

function coins(pts: readonly XY[], r: number): string {
	const sp: XY[] = pts.map(([x, y]) => [x + r * 0.3, y - r * 0.2]);
	return dots(pts, r + 0.6, "#b4525e") + dots(pts, r, "#b9cdcb") + dots(sp, 0.35, "#7f9290");
}

function silverDollar(stage: GrowingStage): string {
	if (stage === "sprout") return line(40, 87, 40, 80, "#8d7c66", 1.6) + coins([[36.5, 79], [43.5, 79], [40, 75.5]], 3);
	if (stage === "leafy")
		return (
			strk("M40 87V62M40 72Q32 67 29 59M40 67Q48 63 51 56", "#8d7c66", 2.6) +
			coins([[29, 55.5], [25, 59.5], [33, 58], [51, 52.5], [47, 56], [55, 56], [40, 58.5], [36, 63], [44, 63], [36, 74], [44, 72]], 3.4)
		);
	const fl: XY[] = [[24, 46], [21, 48.5], [14, 37], [58, 37], [61, 39.5], [38, 25], [41, 27.5], [35, 27.5]];
	return (
		strk("M40 87V52", "#8d7c66", 3.6) +
		strk("M40 74Q28 68 24 56M40 64Q52 58 58 46M40 56Q36 46 38 34M24 58Q16 56 14 46", "#8d7c66", 2) +
		coins(
			[[24, 52.5], [20, 56], [28, 55], [14, 42.5], [10, 46], [18, 46], [58, 42.5], [54, 46], [62, 46], [38, 30.5], [34, 34], [42, 34], [40, 49], [44, 54], [33, 64], [48, 62], [36, 76], [44, 74]],
			3.5,
		) +
		stars(fl, 1.8, "#ecdfe4", 1.2) +
		dots(fl, 0.55, "#d88aa0")
	);
}

// ── 22. Dudleya ──────────────────────────────────────────────────────────

const DUD = [
	[9, -168, -12, 17, 3.8, "#b3c0ae"],
	[7, -150, -30, 18, 3.6, "#c9d3c4"],
	[5, -128, -52, 16, 3.4, "#dde4d8"],
	[2, -100, -80, 11, 3, "#eef1ea"],
] as const;

const dRos = (y: number, s: number): string => DUD.map(([n, from, to, len, w, c]) => leaves(fan(40, y, n, from, to, len * s, w * s), 1, c)).join("");

function dudleya(stage: GrowingStage): string {
	if (stage === "sprout") return dRos(86, 0.55);
	if (stage === "leafy") return line(40, 87, 40, 80, "#8a7a62", 3) + dRos(80, 1.2);
	const stems = "M33 66C26 48 18 36 10 32M40 62C40 44 42 28 46 14M47 66C54 50 62 40 70 36";
	const ends: XY[] = [[10, 32], [46, 14], [70, 36]];
	const fl: XY[] = [];
	let tw = "";
	for (const [x, y] of ends)
		for (const [dx, dy] of [[-3, -3], [0, -4], [3, -2.5]] as const) {
			tw += `M${f(x)} ${f(y)}l${f(dx)} ${f(dy)}`;
			fl.push([x + dx, y + dy], [x + dx * 0.5, y + dy * 0.5]);
		}
	const bracts: Lf[] = [[27, 50, -150, 3.5, 1.2], [19, 39, -40, 3.5, 1.2], [41, 40, -150, 3.5, 1.2], [42, 28, -30, 3.5, 1.2], [53, 50, -30, 3.5, 1.2], [61, 41, -140, 3.5, 1.2]];
	return line(40, 87, 40, 76, "#8a7a62", 3.4) + strk(stems + tw, "#c6584a", 1.3) + leaves(bracts, 1, "#d8826f") + dots(fl, 1.15, "#efd162") + dRos(76, 1.35);
}

// ── 23. Split rock ───────────────────────────────────────────────────────

/** Two fat half-domes parted by a deep split, speckled dark. */
function splitPair(x: number, top: number, r: number, seed: number): string {
	const h = 87 - top;
	const L = `M${f(x - 0.7)} 87V${f(top)}A${f(r)} ${f(h)} 0 0 0 ${f(x - 0.7 - r)} 87Z`;
	const R = `M${f(x + 0.7)} 87V${f(top)}A${f(r)} ${f(h)} 0 0 1 ${f(x + 0.7 + r)} 87Z`;
	const sp: XY[] = [];
	for (let i = 0; sp.length < r * 2.2 && i < 200; i++) {
		const u = rnd(seed + i) * 2 - 1;
		const v = rnd(seed + i + 97);
		if (u * u + v * v < 0.78 && Math.abs(u) > 0.08) sp.push([x + u * r, 87 - v * h]);
	}
	return fill(L + R, "#8f9e7c") + fill(`M${f(x - 0.7)} ${f(top + 1.6)}Q${f(x - r * 0.5)} ${f(top + 0.3)} ${f(x - r * 0.8)} ${f(top + h * 0.4)}Q${f(x - r * 0.45)} ${f(top + 2.5)} ${f(x - 0.7)} ${f(top + 3.4)}Z`, "#a7b593") + dots(sp, 0.5, "#5d6b4f");
}

function splitRock(stage: GrowingStage): string {
	if (stage === "sprout") return splitPair(40, 79, 5.5, 3);
	if (stage === "leafy") return ell(40, 70, 1.4, 3.2, "#a7b593") + splitPair(40, 67, 11, 7);
	return (
		splitPair(26, 73, 9, 11) +
		ell(52, 64, 1.5, 3.4, "#a7b593") +
		strk("M52 66V54", "#9aa77e", 1.6) +
		splitPair(52, 64, 13, 19) +
		daisy(52, 47, 24, 10.5, "#f19a46", "#f8e6a8", 1.2)
	);
}

// ── 24. Baby toes ────────────────────────────────────────────────────────

function toes(spec: readonly (readonly [number, number, number])[]): string {
	let a = "";
	let b = "";
	const tips: XY[] = [];
	spec.forEach(([x0, tx, ty], i) => {
		const d = `M${f(x0)} 87L${f(tx)} ${f(ty + 1)}`;
		if (i % 2) b += d;
		else a += d;
		tips.push([tx, ty]);
	});
	return strk(a, "#6a9c5c", 3.8) + strk(b, "#94c282", 3.8) + dots(tips, 1.75, "#dcebcf") + dots(tips, 0.7, "#b6d2a4");
}

function babyToes(stage: GrowingStage): string {
	if (stage === "sprout") return toes([[38, 36, 77], [42, 44, 78], [40, 40, 74]]);
	if (stage === "leafy")
		return toes([[31, 26, 70], [49, 56, 71], [33, 29, 64], [47, 53, 66], [35, 33, 60], [45, 49, 62], [37, 36, 57], [43, 45, 59], [39, 39, 56], [41, 42, 57], [36, 34, 67], [44, 46, 67]]);
	return (
		strk("M34 52L28 42M44 49L46 38M54 58L59 48", "#7aa86a", 1.2) +
		toes([
			[25, 14, 72], [55, 66, 72], [28, 19, 62], [52, 61, 62], [31, 25, 54], [49, 55, 54], [34, 31, 49], [46, 49, 49],
			[37, 37, 46], [43, 43, 46], [33, 27, 64], [47, 53, 64], [40, 40, 58],
		]) +
		daisy(28, 40, 18, 6, "#ede6d8", "#e8c040") +
		daisy(46, 36, 18, 6.5, "#ede6d8", "#e8c040") +
		daisy(60, 46, 16, 5, "#ede6d8", "#e8c040")
	);
}

// ── 25. Cobweb houseleek ─────────────────────────────────────────────────

/** A globular rosette: red-tipped fleshy leaves around a slanted ring, webbed with white threads. */
function cob(x: number, y: number, s: number): string {
	const R = 6.5 * s;
	const sq = 0.72;
	let back = "";
	let front = "";
	let inner = "";
	let web = "";
	const tips: XY[] = [];
	for (let i = 0; i < 8; i++) {
		const t = ((i * 45 + 22) * Math.PI) / 180;
		const ex = R * Math.cos(t);
		const ey = R * Math.sin(t) * sq;
		const d = lp(x, y, (Math.atan2(ey, ex) * 180) / Math.PI, Math.hypot(ex, ey), 3 * s, 1);
		if (Math.sin(t) < 0) back += d;
		else front += d;
		tips.push([x + ex * 0.9, y + ey * 0.9]);
		if (i % 2 === 0) inner += lp(x, y - s, -90 + (i - 3) * 22, R * 0.6, 2.6 * s, 1);
	}
	tips.forEach(([ax, ay], i) => {
		const [bx, by] = tips[(i + 3) % 8]!;
		web += `M${f(ax)} ${f(ay)}L${f(bx)} ${f(by)}`;
	});
	return (
		fill(back, "#5c874e") +
		ell(x, y, R * 0.62, R * 0.5, "#6c9759") +
		fill(inner, "#8ab474") +
		fill(front, "#78a364") +
		dots(tips, 0.7 * s, "#a3485a") +
		strk(web, "#f3f2ec", 0.4, 0.85) +
		circle(x, y - s, 1.7 * s, "#f3f2ec", 0.9)
	);
}

function cobwebHouseleek(stage: GrowingStage): string {
	if (stage === "sprout") return cob(40, 81, 1);
	if (stage === "leafy") return cob(24, 81, 1.05) + cob(57, 82, 0.95) + cob(40, 76, 1.6);
	const fl: XY[] = [[33, 36], [47, 36], [36, 31], [44, 31], [40, 35], [40, 28]];
	const stalkLeaves: Lf[] = [];
	for (const y of [64, 55, 46]) stalkLeaves.push([40, y, -115, 5.5, 2.2], [40, y - 3, -65, 5.5, 2.2]);
	return (
		strk("M40 74V38", "#a4a874", 3.6) +
		leaves(stalkLeaves, 1, "#8aa86a") +
		stars(fl, 3, "#d83e68", 1.4, 8) +
		dots(fl, 1, "#8c2246") +
		cob(17, 82, 1.1) +
		cob(63, 82, 1.1) +
		cob(40, 76, 1.8)
	);
}

// ── the family ───────────────────────────────────────────────────────────

export const SPECIES: Species[] = [
	{ id: "gasteria", name: "Gasteria", draw: gasteria },
	{ id: "moonstones", name: "Moonstones", draw: moonstones },
	{ id: "ghost-plant", name: "Ghost plant", draw: ghostPlant },
	{ id: "black-rose-aeonium", name: "Black rose aeonium", draw: blackRose },
	{ id: "buddhas-temple", name: "Buddha's temple", draw: buddhasTemple },
	{ id: "calico-hearts", name: "Calico hearts", draw: calicoHearts },
	{ id: "blue-chalksticks", name: "Blue chalksticks", draw: blueChalksticks },
	{ id: "string-of-bananas", name: "String of bananas", draw: stringOfBananas },
	{ id: "string-of-dolphins", name: "String of dolphins", draw: stringOfDolphins },
	{ id: "pigs-ear", name: "Pig's ear", draw: pigsEar },
	{ id: "paddle-plant", name: "Paddle plant", draw: paddlePlant },
	{ id: "mother-of-thousands", name: "Mother of thousands", draw: motherOfThousands },
	{ id: "elephant-bush", name: "Elephant bush", draw: elephantBush },
	{ id: "string-of-hearts", name: "String of hearts", draw: stringOfHearts },
	{ id: "sticks-on-fire", name: "Sticks on fire", draw: sticksOnFire },
	{ id: "desert-rose", name: "Desert rose", draw: desertRose },
	{ id: "bears-paw", name: "Bear's paw", draw: bearsPaw },
	{ id: "medusas-head", name: "Medusa's head", draw: medusasHead },
	{ id: "baseball-plant", name: "Baseball plant", draw: baseballPlant },
	{ id: "lace-aloe", name: "Lace aloe", draw: laceAloe },
	{ id: "silver-dollar-plant", name: "Silver dollar plant", draw: silverDollar },
	{ id: "dudleya", name: "Dudleya", draw: dudleya },
	{ id: "split-rock", name: "Split rock", draw: splitRock },
	{ id: "baby-toes", name: "Baby toes", draw: babyToes },
	{ id: "cobweb-houseleek", name: "Cobweb houseleek", draw: cobwebHouseleek },
];
