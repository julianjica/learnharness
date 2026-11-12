/**
 * Garden species, family: carnivorous plants. Each draws sprout, leafy and
 * bloom in the kit's flat style (see kit.ts); the kit draws soil and seed.
 */
import { bez, circle, f, GREEN, leaf, line, stem, type GrowingStage, type Pt, type Species } from "./kit";

/* ---------- private helpers ---------- */

const RAD = Math.PI / 180;
type P4 = readonly [Pt, Pt, Pt, Pt];

const S = (stage: GrowingStage, sprout: number, leafy: number, bloom: number): number => (stage === "sprout" ? sprout : stage === "leafy" ? leafy : bloom);

/** A rotated ellipse. */
function el(cx: number, cy: number, rx: number, ry: number, fill: string, rot = 0): string {
	const t = rot ? ` transform="rotate(${f(rot)} ${f(cx)} ${f(cy)})"` : "";
	return `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}" fill="${fill}"${t}/>`;
}

/** A filled path. */
function p(d: string, fill: string): string {
	return `<path d="${d}" fill="${fill}"/>`;
}

/** A stroked path. */
function sp(d: string, stroke: string, w: number, extra = ""): string {
	return `<path d="${d}" stroke="${stroke}" stroke-width="${f(w)}" fill="none" stroke-linecap="round"${extra}/>`;
}

/** A group translated to (x, y), rotated and scaled. */
function g(x: number, y: number, body: string, rot = 0, sx = 1, sy = Math.abs(sx)): string {
	const r = rot ? ` rotate(${f(rot)})` : "";
	const s = sx !== 1 || sy !== 1 ? ` scale(${f(sx)} ${f(sy)})` : "";
	return `<g transform="translate(${f(x)} ${f(y)})${r}${s}">${body}</g>`;
}

/** Subpath of a circle. */
function dotSub(x: number, y: number, r: number): string {
	return `M${f(x - r)} ${f(y)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0`;
}

/** Subpath of a rotated ellipse. */
function ovalSub(cx: number, cy: number, rx: number, ry: number, rot: number): string {
	const r = rot * RAD;
	const dx = Math.cos(r) * rx;
	const dy = Math.sin(r) * rx;
	const a = `A${f(rx)} ${f(ry)} ${f(rot)} 1 0`;
	return `M${f(cx + dx)} ${f(cy + dy)}${a} ${f(cx - dx)} ${f(cy - dy)}${a} ${f(cx + dx)} ${f(cy + dy)}Z`;
}

/** Subpath of a pointed lens from (x, y) heading `deg`, `len` long and about 2w wide. */
function lensSub(x: number, y: number, deg: number, len: number, w: number): string {
	const r = deg * RAD;
	const c = Math.cos(r);
	const sn = Math.sin(r);
	const mx = x + c * len * 0.4;
	const my = y + sn * len * 0.4;
	const k = w * 1.25;
	return `M${f(x)} ${f(y)}Q${f(mx - sn * k)} ${f(my + c * k)} ${f(x + c * len)} ${f(y + sn * len)}Q${f(mx + sn * k)} ${f(my - c * k)} ${f(x)} ${f(y)}Z`;
}

/** n capsule petals around (x, y) in one path (round-capped strokes, radii rx along and ry across). */
function ring(x: number, y: number, n: number, r: number, rx: number, ry: number, fill: string, off = 0): string {
	const h = Math.max(0.05, rx - ry);
	let d = "";
	for (let i = 0; i < n; i++) {
		const a = (off + (i * 360) / n) * RAD;
		const c = Math.cos(a);
		const s = Math.sin(a);
		d += `M${f(x + c * (r - h))} ${f(y + s * (r - h))}L${f(x + c * (r + h))} ${f(y + s * (r + h))}`;
	}
	return sp(d, fill, ry * 2);
}

/** A five-petalled flower of radius r. */
function flower5(x: number, y: number, r: number, fill: string, eye: string, off = -90): string {
	return ring(x, y, 5, r * 0.55, r * 0.5, r * 0.36, fill, off) + circle(x, y, r * 0.28, eye);
}

/** A shallow pond over the soil (same look as the water plants). */
function pond(rx = 19): string {
	return `<ellipse cx="40" cy="86.4" rx="${f(rx)}" ry="3.2" fill="#4c86a8"/><path d="M${f(40 - rx * 0.7)} 86.6h${f(rx * 0.35)}M${f(40 + rx * 0.2)} 87.6h${f(rx * 0.4)}" stroke="#7fb3d0" stroke-width=".8" stroke-linecap="round"/>`;
}

/** Glandular hairs with a drop of dew, batched into two paths. */
class Dew {
	h = "";
	d = "";
	constructor(
		private hc: string,
		private dc: string,
		private hw = 0.6,
		private dr = 1.3,
	) {}
	add(x: number, y: number, deg: number, len: number): void {
		const x2 = x + Math.cos(deg * RAD) * len;
		const y2 = y + Math.sin(deg * RAD) * len;
		if (len > 0.3) this.h += `M${f(x)} ${f(y)}l${f(x2 - x)} ${f(y2 - y)}`;
		this.d += `M${f(x2)} ${f(y2)}h0`;
	}
	/** Hairs on both sides of a curve from t = from to 1. */
	along(pts: P4, from: number, n: number, len: number, spread = 90, alt = false): void {
		for (let i = 0; i < n; i++) {
			const t = from + ((1 - from) * i) / Math.max(1, n - 1);
			const [x, y] = bez(pts, t);
			const [ax, ay] = bez(pts, Math.max(0, t - 0.02));
			const [bx, by] = bez(pts, Math.min(1, t + 0.02));
			const a = Math.atan2(by - ay, bx - ax) / RAD;
			if (!alt || i % 2) this.add(x, y, a - spread, len);
			if (!alt || !(i % 2)) this.add(x, y, a + spread, len);
			if (i === n - 1) this.add(x, y, a, len * 0.8);
		}
	}
	out(): string {
		return (this.h ? `<path d="${this.h}" stroke="${this.hc}" stroke-width="${f(this.hw)}" stroke-linecap="round"/>` : "") + (this.d ? `<path d="${this.d}" stroke="${this.dc}" stroke-width="${f(this.dr)}" stroke-linecap="round"/>` : "");
	}
}

/** A straight line as a Bézier (for Dew.along). */
const straight = (x: number, y: number, deg: number, len: number): P4 => {
	const c = Math.cos(deg * RAD) * len;
	const s = Math.sin(deg * RAD) * len;
	return [
		[x, y],
		[x + c / 3, y + s / 3],
		[x + (c * 2) / 3, y + (s * 2) / 3],
		[x + c, y + s],
	];
};

/* ---------- Nepenthes pitchers (local: base at 0,0, mouth up) ---------- */

/** A slender lowland pitcher, about 23 tall at k = 1. */
function slenderPit(k: number): string {
	return (
		el(-1.4, -22.2, 3.6, 1.8, "#a9c460", -12) +
		p("M0 0C-4 0 -5 -4 -5 -8C-5 -12 -3 -14 -3.5 -19L3.5 -19C3 -14 5 -12 5 -8C5 -4 4 0 0 0Z", "#9cbd5a") +
		p("M-4.9 -10.5C-4.2 -14 -3 -15 -3.5 -19L3.5 -19C3 -15 4.2 -14 4.9 -10.5C2 -11.8 -2 -11.8 -4.9 -10.5Z" + dotSub(-2, -6, 0.7) + dotSub(1.6, -4, 0.6) + dotSub(2.6, -8, 0.6), "#c4544a") +
		sp("M-1.8 -10L-2.2 -2M1.8 -10L2.2 -2", "#7f9e44", 0.7) +
		el(0, -19, 4.2, 1.4, "#9a2234") +
		el(0, -19.2, 2.7, 0.6, "#3e161c")
	);
}

/** Low's hourglass pitcher with its upright bristly lid, about 37 tall. */
function lowiiPit(): string {
	return (
		el(0, -30, 5.2, 7, "#7c3f2a") +
		sp("M-2.6 -32v5M0 -33v6M2.6 -32v5", "#e6d2ae", 0.55) +
		p("M0 0C-5 0 -6.5 -4 -5 -7.5C-3.5 -10 -2.5 -11 -2.5 -13C-2.5 -15 -6 -18 -8 -22L8 -22C6 -18 2.5 -15 2.5 -13C2.5 -11 3.5 -10 5 -7.5C6.5 -4 5 0 0 0Z", "#98913f") +
		p("M-2.5 -13C-2.5 -15 -6 -18 -8 -22L8 -22C6 -18 2.5 -15 2.5 -13Z", "#7e3a2a") +
		el(0, -22, 8, 1.8, "#3e1a12")
	);
}

/** The Rajah's huge red urn, about 30 tall with its lid. */
function rajahPit(): string {
	return (
		el(1, -24, 9, 5.5, "#a52f3c", -8) +
		el(1, -24.4, 6.4, 3.4, "#d06a52", -8) +
		p("M0 0C-11 0 -13 -6 -12 -11C-11 -15 -8 -16 -8 -17L8 -17C8 -16 11 -15 12 -11C13 -6 11 0 0 0Z", "#b33440") +
		sp("M-3 -14.5L-3.6 -2M3 -14.5L3.6 -2M-8 -12C-9 -8 -8 -4 -6 -2M8 -12C9 -8 8 -4 6 -2", "#8a1f30", 1) +
		el(0, -17, 9.6, 3, "#7c1a2a") +
		`<ellipse cx="0" cy="-17" rx="8.4" ry="2.3" fill="none" stroke="#d2606a" stroke-width="1" stroke-dasharray=".5 1"/>` +
		el(0, -17.4, 6.2, 1.4, "#3a0f16")
	);
}

/** Attenborough's tall bell, pale yellow with purple stripes, lid raised. */
function bellPit(): string {
	return (
		p("M-1 -21L-2 -26L2 -26L1 -21Z", "#b9b45a") +
		el(0, -28.5, 6, 4.4, "#cfcb72") +
		el(0, -28.3, 4, 2.6, "#b2564e") +
		p("M0 0C-7 0 -8.5 -4 -8.5 -9C-8.5 -14 -7 -17 -8 -21L8 -21C7 -17 8.5 -14 8.5 -9C8.5 -4 7 0 0 0Z", "#d1c65c") +
		sp("M-5 -19C-6 -13 -6 -6 -4.4 -1.4M-1.8 -19.6V-.6M1.8 -19.6V-.6M5 -19C6 -13 6 -6 4.4 -1.4", "#8a3d62", 0.9) +
		el(0, -21, 8.6, 2.2, "#8a2a4a") +
		el(0, -21.2, 6.2, 1.1, "#4a1a28")
	);
}

/** A climbing Nepenthes: stem, leaves and pitchers hung from tendrils. */
function nepVine(stage: GrowingStage, pit: (k: number) => string, h: number, c: { leaf: string; stem: string; w: number }, ks: readonly number[]): string {
	const o = { fill: c.leaf, shape: 1 as const };
	if (stage === "sprout") {
		const k = (ks[0] ?? 0.6) * 0.55;
		return line(40, 87, 40, 72, c.stem, 1.6) + leaf(40, 78, -155, 10, c.w * 0.7, o) + leaf(40, 73, -30, 10, c.w * 0.7, o) + sp("M48.7 68C51 72 53 80 51 87", "#7a9a48", 0.7) + g(51, 87, pit(k), 0, k);
	}
	const P: P4 =
		stage === "leafy"
			? [
					[40, 87],
					[44, 72],
					[35, 60],
					[40, 44],
				]
			: [
					[40, 87],
					[47, 64],
					[32, 40],
					[41, 10],
				];
	const spots: readonly (readonly [number, number, number, number])[] =
		stage === "leafy"
			? [
					[0.22, -1, 13, ks[0] ?? 0],
					[0.5, 1, 13, ks[1] ?? 0],
					[0.8, -1, 10, 0],
					[0.97, 1, 7, 0],
				]
			: [
					[0.14, -1, 15, ks[0] ?? 0],
					[0.32, 1, 15, ks[1] ?? 0],
					[0.52, -1, 14, ks[2] ?? 0],
					[0.7, 1, 13, ks[3] ?? 0],
					[0.86, -1, 10, 0],
					[0.97, 1, 8, 0],
				];
	let s = stem(P, c.stem, stage === "leafy" ? 1.8 : 2.2);
	let pits = "";
	for (const [t, side, len, k] of spots) {
		const [x, y] = bez(P, t);
		const a = side < 0 ? -165 : -15;
		const tx = x + Math.cos(a * RAD) * len;
		const ty = y + Math.sin(a * RAD) * len;
		s += leaf(x, y, a, len, c.w, o);
		if (!k) continue;
		const px = tx + side * 1.5;
		const py = Math.min(ty + h * k + 5, 87);
		pits += sp(`M${f(tx)} ${f(ty)}C${f(tx + side * 4)} ${f(ty + 5)} ${f(px + side * 4)} ${f(py + 4)} ${f(px)} ${f(py)}`, "#7a9a48", 0.7) + g(px, py, pit(k), 0, k);
	}
	return s + pits;
}

/* ---------- 1. Tropical pitcher plant ---------- */
function tropicalPitcher(stage: GrowingStage): string {
	return nepVine(stage, () => slenderPit(1), 23, { leaf: "#6aa34c", stem: "#5a7d3a", w: 3 }, stage === "leafy" ? [0.6, 0.55] : [0.75, 0.7, 0.65, 0.6]);
}

/* ---------- 2. Rajah pitcher plant ---------- */
function rajahPitcher(stage: GrowingStage): string {
	const o = { fill: "#689a46", dark: "#d8c66a" };
	if (stage === "sprout") return leaf(40, 86, -160, 11, 3.6, o) + leaf(40, 86, -25, 11, 3.6, o) + leaf(40, 86, -95, 9, 3, o) + g(47, 87, rajahPit(), 0, 0.4);
	if (stage === "leafy") {
		return leaf(40, 86, -168, 18, 5, o) + leaf(40, 86, -12, 18, 5, o) + leaf(40, 85, -130, 20, 5.5, o) + leaf(40, 85, -55, 20, 5.5, o) + leaf(40, 85, -92, 18, 5, o) + g(30, 87, rajahPit(), 0, 0.55) + g(52, 87.5, rajahPit(), 0, 0.85);
	}
	let s = leaf(40, 86, -174, 34, 6.5, o) + leaf(40, 86, -6, 34, 6.5, o) + leaf(40, 85, -146, 38, 7.5, o) + leaf(40, 85, -34, 38, 7.5, o) + leaf(40, 84, -116, 44, 7.5, o) + leaf(40, 84, -64, 44, 7.5, o);
	s += g(20, 87, rajahPit(), 0, 0.7) + g(60, 87, rajahPit(), 0, 0.75);
	return s + g(40, 87.5, rajahPit(), 0, 1.45);
}

/* ---------- Sarracenia trumpets ---------- */

/** Quadratic point. */
function qpt(a: Pt, c: Pt, b: Pt, s: number): [number, number] {
	const u = 1 - s;
	return [u * u * a[0] + 2 * u * s * c[0] + s * s * b[0], u * u * a[1] + 2 * u * s * c[1] + s * s * b[1]];
}

interface Tube {
	L: [Pt, Pt, Pt];
	R: [Pt, Pt, Pt];
	tx: number;
	ty: number;
}

function tube(x: number, y: number, h: number, wb: number, wt: number, lean: number): Tube {
	const tx = x + lean;
	const ty = y - h;
	return {
		L: [
			[x - wb, y],
			[x - wb + lean * 0.15, y - h * 0.6],
			[tx - wt, ty],
		],
		R: [
			[x + wb, y],
			[x + wb + lean * 0.15, y - h * 0.6],
			[tx + wt, ty],
		],
		tx,
		ty,
	};
}

/** The part of a tube between heights s0 and s1 (0 base, 1 mouth) as a subpath. */
function band(t: Tube, s0: number, s1: number): string {
	const n = 5;
	let d = "";
	for (let i = 0; i <= n; i++) {
		const [x, y] = qpt(t.L[0], t.L[1], t.L[2], s0 + ((s1 - s0) * i) / n);
		d += `${i ? "L" : "M"}${f(x)} ${f(y)}`;
	}
	for (let i = n; i >= 0; i--) {
		const [x, y] = qpt(t.R[0], t.R[1], t.R[2], s0 + ((s1 - s0) * i) / n);
		d += `L${f(x)} ${f(y)}`;
	}
	return d + "Z";
}

type TubeSpec = readonly [x: number, h: number, wt: number, lean: number];

/** A clump of trumpets drawn back to front with a per-species top. */
function trumpets(specs: readonly TubeSpec[], body: (t: Tube, wt: number, lean: number) => string): string {
	let s = "";
	for (const [x, h, wt, lean] of specs) s += body(tube(x, 87, h, Math.max(0.8, wt * 0.28), wt, lean), wt, lean);
	return s;
}

/** A nodding Sarracenia flower hung from a hooked scape rising at sx. */
function sarrFlower(sx: number, x: number, y: number, petal: string, sepal: string, k = 1): string {
	return (
		sp(`M${f(sx)} 87C${f(sx)} ${f(y + 18)} ${f(x)} ${f(y - 9 * k)} ${f(x)} ${f(y - 2.5 * k)}`, "#6f8f44", 1.1) +
		p(`M${f(x - 4.6 * k)} ${f(y)}Q${f(x)} ${f(y - 5 * k)} ${f(x + 4.6 * k)} ${f(y)}Z`, sepal) +
		p(ovalSub(x - 3 * k, y + 3 * k, 3.2 * k, 1.5 * k, 80) + ovalSub(x + 3 * k, y + 3 * k, 3.2 * k, 1.5 * k, 100) + ovalSub(x, y + 3.6 * k, 3.4 * k, 1.6 * k, 90), petal) +
		el(x, y + 0.3 * k, 4.8 * k, 1.2 * k, sepal)
	);
}

/* ---------- 3. Purple pitcher plant ---------- */
const PURPLE_PIT =
	p("M0 1.5C7 5 15 3 17.5 -6L10.5 -9C8 -3 4 -.5 0 -1Z", "#8aa54a") +
	p("M10.5 -9L17.5 -6C17 -3 15.5 -1 13.5 0C12 -3 11.5 -6 10.5 -9Z", "#8e3d5e") +
	sp("M3 0.5C8 1 12 -1 14 -6M5 2C10 2.6 14 0 16 -5", "#7a2d55", 0.6) +
	el(14, -7.5, 3.8, 1.4, "#4a1830", 22) +
	p("M16.6 -6.5C20.5 -6.5 23.5 -11.5 21.5 -14.5C19.5 -17 15 -14 14.5 -9Z", "#9a4a6a") +
	sp("M17 -8L20.5 -13M16 -9L18 -14", "#6e2448", 0.5);

function purplePitcher(stage: GrowingStage): string {
	const pit = (x: number, side: number, rot: number, k: number) => g(x, 86.5, PURPLE_PIT, -side * rot, side * k, k);
	if (stage === "sprout") return pit(39, -1, 30, 0.55) + pit(41, 1, 30, 0.6);
	if (stage === "leafy") return sarrFlower(43, 44, 46, "#7a2238", "#8e3d5e", 0.8) + pit(38, -1, 20, 0.95) + pit(42, 1, 22, 1) + pit(39, -1, 52, 0.85) + pit(41, 1, 55, 0.9);
	return sarrFlower(43, 46, 22, "#7a2238", "#8e3d5e", 1.1) + pit(37, -1, 14, 1.25) + pit(43, 1, 14, 1.3) + pit(38, -1, 40, 1.15) + pit(42, 1, 42, 1.2) + pit(39, -1, 66, 0.95) + pit(41, 1, 68, 1);
}

/* ---------- 4. Yellow trumpet pitcher ---------- */
function flavaTube(t: Tube, wt: number, lean: number): string {
	const { tx, ty } = t;
	return (
		p(band(t, 0, 1), "#c9c64c") +
		p(band(t, 0, 0.3), "#93ad48") +
		p(`M${f(tx - wt * 0.8)} ${f(ty)}L${f(tx - wt * 0.3 + lean * 0.05)} ${f(ty - wt * 1.1)}L${f(tx + wt * 0.6)} ${f(ty - wt * 1.1)}L${f(tx + wt * 0.6)} ${f(ty)}Z`, "#d9c840") +
		el(tx + wt * 0.05, ty - wt * 1.5, wt * 1.25, wt * 1.05, "#e2cf42", lean * 2) +
		el(tx, ty + 1.7, wt * 0.75, 1.4, "#b54a38") +
		el(tx, ty, wt, wt * 0.3, "#6a3420")
	);
}
function yellowTrumpet(stage: GrowingStage): string {
	if (stage === "sprout") return trumpets([[37, 14, 2, -1], [42, 18, 2.3, 1]], flavaTube);
	if (stage === "leafy")
		return trumpets([[30, 30, 3, -4], [50, 34, 3.2, 4], [36, 42, 3.4, -1], [44, 46, 3.6, 1.5]], flavaTube);
	return sarrFlower(54, 60, 50, "#e4d24a", "#c4b83c") + trumpets([[26, 44, 3.6, -5], [52, 52, 3.8, 5], [32, 60, 4, -2], [46, 64, 4.2, 2], [39, 70, 4.4, 0]], flavaTube);
}

/* ---------- 5. White-topped pitcher ---------- */
function leucoTube(t: Tube, wt: number, lean: number): string {
	const { tx, ty } = t;
	const s0 = 0.62;
	let v = "";
	for (let i = 0; i < 5; i++) {
		const [ax, ay] = qpt(t.L[0], t.L[1], t.L[2], s0 + 0.04);
		const [bx] = qpt(t.R[0], t.R[1], t.R[2], s0 + 0.04);
		const u = (i + 0.5) / 5;
		v += `M${f(tx - wt + 2 * wt * u)} ${f(ty + 0.8)}L${f(ax + (bx - ax) * u)} ${f(ay + (i % 2) * 2)}`;
	}
	const hx = tx + wt * 0.15;
	const hy = ty - wt * 1.35;
	return (
		p(band(t, 0, 1), "#84a84c") +
		p(band(t, s0, 1), "#efe9e1") +
		p(ovalSub(hx, hy, wt * 1.3, wt * 1.05, lean * 2) + dotSub(hx - wt * 0.9, hy - wt * 0.7, wt * 0.45) + dotSub(hx + wt * 0.9, hy - wt * 0.6, wt * 0.45) + dotSub(hx, hy - wt * 1.05, wt * 0.45), "#efe9e1") +
		sp(v + `M${f(hx)} ${f(hy + wt * 0.8)}L${f(hx)} ${f(hy - wt * 0.9)}M${f(hx - wt * 0.9)} ${f(hy + wt * 0.3)}L${f(hx)} ${f(hy - wt * 0.2)}L${f(hx + wt * 0.9)} ${f(hy + wt * 0.3)}`, "#b3303c", 0.45) +
		el(tx, ty, wt, wt * 0.3, "#7c2228")
	);
}
function whiteTopped(stage: GrowingStage): string {
	if (stage === "sprout") return trumpets([[37, 15, 2.2, -1], [42, 19, 2.4, 1]], leucoTube);
	if (stage === "leafy") return trumpets([[31, 32, 3.2, -4], [49, 36, 3.3, 4], [36, 44, 3.6, -1], [44, 48, 3.6, 1]], leucoTube);
	return sarrFlower(25, 20, 52, "#c22a3a", "#9e2a3a") + trumpets([[28, 48, 3.8, -6], [52, 54, 4, 6], [34, 62, 4.2, -2], [46, 66, 4.2, 2], [40, 71, 4.4, 0]], leucoTube);
}

/* ---------- 6. Parrot pitcher plant ---------- */
const PARROT_PIT =
	p("M0 -1L13 -3C14.5 -1 14.5 1 13 2.5L0 1Z", "#8aa64a") +
	sp("M3 0L12 -1.5M6 .6L12.5 1", "#a8343a", 0.5) +
	p(dotSub(15.5, -0.4, 3.8) + "M18 -2.8L20.4 -1.6L18.6 .2Z", "#b8383a") +
	p(dotSub(14.4, -1.6, 0.7) + dotSub(16.4, -2.2, 0.6) + dotSub(15.6, 0.6, 0.6) + dotSub(17.6, -0.6, 0.5), "#f2e6d6");

function parrotPitcher(stage: GrowingStage): string {
	const pit = (side: number, rot: number, k: number) => g(40 + side * 1.5, 86, PARROT_PIT, -side * rot, side * k, k);
	if (stage === "sprout") return pit(-1, 14, 0.62) + pit(1, 16, 0.66) + pit(-1, 44, 0.5) + pit(1, 48, 0.55);
	if (stage === "leafy") return sarrFlower(41, 42, 50, "#c23a3e", "#a8343a", 0.8) + pit(-1, 4, 1.1) + pit(1, 5, 1.1) + pit(-1, 18, 1) + pit(1, 20, 1) + pit(-1, 36, 0.85) + pit(1, 38, 0.85);
	return (
		sarrFlower(41, 44, 26, "#c23a3e", "#a8343a", 1.1) +
		pit(-1, 2, 1.5) + pit(1, 3, 1.5) + pit(-1, 14, 1.4) + pit(1, 16, 1.4) + pit(-1, 28, 1.25) + pit(1, 30, 1.25) + pit(-1, 46, 1.05) + pit(1, 48, 1.05)
	);
}

/* ---------- 7. Hooded pitcher plant ---------- */
function minorTube(t: Tube, wt: number, lean: number): string {
	const { tx, ty } = t;
	const d = lean < 0 ? -1 : 1;
	const [ax, ay] = qpt(t.L[0], t.L[1], t.L[2], 0.72);
	const [bx] = qpt(t.R[0], t.R[1], t.R[2], 0.72);
	const hood = `M${f(tx - d * wt)} ${f(ty + 1)}C${f(tx - d * wt * 1.2)} ${f(ty - wt * 2.4)} ${f(tx + d * wt * 2)} ${f(ty - wt * 2.4)} ${f(tx + d * wt * 1.7)} ${f(ty + wt * 0.2)}C${f(tx + d * wt)} ${f(ty - wt * 0.4)} ${f(tx)} ${f(ty)} ${f(tx - d * wt)} ${f(ty + 1)}Z`;
	const spots = dotSub(ax + (bx - ax) * 0.35, ay - 1, 0.6) + dotSub(ax + (bx - ax) * 0.7, ay - 3, 0.6) + dotSub(tx - d * wt * 0.2, ty - wt * 1.2, 0.65) + dotSub(tx + d * wt * 0.7, ty - wt * 1.3, 0.6) + dotSub(tx + d * wt * 0.3, ty - wt * 0.5, 0.5);
	return p(band(t, 0, 1), "#8aac4c") + p(band(t, 0.55, 1), "#c9b24a") + p(hood, "#c7a945") + p(spots, "#f4f0d8");
}
function hoodedPitcher(stage: GrowingStage): string {
	if (stage === "sprout") return trumpets([[37, 13, 2, -1], [42, 17, 2.2, 1]], minorTube);
	if (stage === "leafy") return trumpets([[31, 28, 3, -3], [49, 31, 3, 3], [37, 38, 3.4, -1], [44, 42, 3.4, 1]], minorTube);
	return sarrFlower(57, 62, 46, "#eadc7c", "#c9be5a") + trumpets([[27, 38, 3.6, -4], [52, 44, 3.8, 4], [33, 52, 4, -2], [46, 56, 4, 2], [40, 62, 4.2, 0.5]], minorTube);
}

/* ---------- 8. Butterwort ---------- */
function butterFlower(x: number, y: number, k: number): string {
	return (
		sp(`M${f(x + 3 * k)} ${f(y)}l${f(3.5 * k)} ${f(1.2 * k)}`, "#6a4aa0", 1.3 * k) +
		ring(x, y, 5, 2.4 * k, 2.1 * k, 1.5 * k, "#8a5ac4", -90) +
		el(x, y + 0.4 * k, 1.2 * k, 1.5 * k, "#f2eef8") +
		circle(x, y + 0.9 * k, 0.5 * k, "#e8c23a")
	);
}
function butterwort(stage: GrowingStage): string {
	const k = S(stage, 0.68, 0.85, 1);
	const o = { fill: "#b2cd62", dark: "#8aa648" };
	const o2 = { fill: "#a2c058", dark: "#7f9a42" };
	const shine = (x: number, y: number) => dotSub(x, y, 0.5);
	let s = "";
	let dots = "";
	const leaves: readonly (readonly [number, number])[] = [
		[-176, 19],
		[-4, 19],
		[-154, 19],
		[-26, 19],
		[-128, 16],
		[-52, 16],
		[-104, 13],
		[-76, 13],
	];
	for (const [a, L] of leaves) {
		const len = L * k;
		const w = 4.2 * k;
		s += leaf(40, 86, a, len, w, Math.abs(a + 90) > 50 ? o2 : o);
		dots += shine(40 + Math.cos(a * RAD) * len * 0.45, 86 + Math.sin(a * RAD) * len * 0.45 - 1.2 * k) + shine(40 + Math.cos(a * RAD) * len * 0.7, 86 + Math.sin(a * RAD) * len * 0.7 + 1.2 * k);
	}
	s += p(dots, "#f4f8e2");
	if (stage === "sprout") return s;
	const stalk = (x0: number, x: number, y: number) => sp(`M${f(x0)} 82Q${f(x0)} ${f(y + 8)} ${f(x)} ${f(y + 1)}`, "#6e7e42", 0.9);
	if (stage === "leafy") return stalk(41, 43, 52) + s + el(43, 51, 1.6, 2.4, "#8a5ac4", 20);
	return stalk(38, 30, 42) + stalk(42, 50, 34) + stalk(40, 41, 48) + s + butterFlower(30, 41, 1.15) + butterFlower(50, 33, 1.25) + butterFlower(41, 47, 1.05);
}

/* ---------- 9. Bladderwort ---------- */
function snap(x: number, y: number, k: number): string {
	return el(x, y - 1.7 * k, 2.2 * k, 1.6 * k, "#e4c23a") + el(x, y + 1 * k, 3.4 * k, 2.4 * k, "#efce3e") + el(x, y + 0.2 * k, 1.4 * k, 1 * k, "#d8862a") + sp(`M${f(x)} ${f(y + 3 * k)}l${f(-0.6 * k)} ${f(2.2 * k)}`, "#d8a63a", 0.9 * k);
}
function bladderwort(stage: GrowingStage): string {
	const rx = S(stage, 15, 20, 23);
	let s = pond(rx);
	const k = S(stage, 0.6, 0.85, 1);
	let threads = "";
	let bl = "";
	const strands: readonly (readonly [number, number, number])[] = [
		[-1, 18, -2],
		[1, 18, -1],
		[-1, 12, -6],
		[1, 13, -7],
	];
	for (const [d, L, rise] of strands) {
		const x1 = 40 + d * L * k;
		const y1 = 85 + rise * k;
		threads += `M40 85Q${f(40 + d * L * 0.5 * k)} ${f(85 + rise * 1.6 * k)} ${f(x1)} ${f(y1)}`;
		for (let i = 1; i <= 3; i++) {
			const t = i / 3.4;
			const bx = 40 + d * L * k * t;
			const by = 85 + rise * k * (t * 1.1) - 0.6;
			threads += `M${f(bx)} ${f(by)}l${f(d * 1.4)} -2.2M${f(bx)} ${f(by)}l${f(d * 1.6)} 1.4`;
			bl += dotSub(bx + d * 1.6, by + 1.6, 0.75);
		}
	}
	s += sp(threads, "#86a84e", 0.75) + p(bl, "#4e6a34");
	if (stage === "sprout") return s;
	if (stage === "leafy") return line(40, 85, 40, 46, "#6f9440", 1.2) + s + el(40, 44, 1.8, 2.6, "#e4c23a");
	return line(40, 85, 40, 20, "#6f9440", 1.3) + sp("M40 40l-4 -2M40 32l4 -2M40 25l-3.5 -2", "#6f9440", 0.8) + s + snap(35.5, 38.5, 1.1) + snap(44.5, 30.5, 1.1) + snap(36.5, 23.5, 1) + snap(40, 18, 0.8);
}

/* ---------- 10. Waterwheel plant ---------- */
function waterwheel(stage: GrowingStage): string {
	const rx = S(stage, 15, 20, 23);
	let spokes = "";
	let traps = "";
	let hubs = "";
	const chain = (P: P4, n: number, r0: number, r1: number) => {
		let st = `M${f(P[0][0])} ${f(P[0][1])}C${f(P[1][0])} ${f(P[1][1])} ${f(P[2][0])} ${f(P[2][1])} ${f(P[3][0])} ${f(P[3][1])}`;
		for (let i = 0; i < n; i++) {
			const t = 0.12 + (0.88 * i) / Math.max(1, n - 1);
			const [x, y] = bez(P, t);
			const r = r0 + (r1 - r0) * (i / Math.max(1, n - 1));
			for (let j = 0; j < 7; j++) {
				const a = ((j * 360) / 7 + i * 20) * RAD;
				const dx = Math.cos(a) * r;
				const dy = Math.sin(a) * r;
				st += `M${f(x)} ${f(y)}l${f(dx)} ${f(dy)}`;
				traps += `M${f(x + dx * 1.25)} ${f(y + dy * 1.25)}h0`;
			}
			hubs += `M${f(x)} ${f(y)}h0`;
		}
		spokes += st;
	};
	if (stage === "sprout") {
		chain([[40, 85], [36, 83], [32, 82], [28, 82]], 3, 2.4, 1.8);
		chain([[40, 85], [44, 83], [48, 81], [52, 80]], 3, 2.4, 1.8);
	} else if (stage === "leafy") {
		chain([[40, 85], [32, 82], [24, 82], [17, 80]], 4, 3.2, 2.2);
		chain([[40, 85], [48, 82], [56, 82], [63, 80]], 4, 3.2, 2.2);
		chain([[40, 84], [42, 72], [48, 62], [54, 56]], 4, 3.2, 2.2);
	} else {
		chain([[40, 85], [30, 82], [20, 83], [10, 80]], 5, 3.6, 2.4);
		chain([[40, 85], [50, 82], [60, 83], [70, 80]], 5, 3.6, 2.4);
		chain([[40, 84], [43, 68], [53, 56], [62, 52]], 5, 3.5, 2.3);
		chain([[40, 84], [37, 70], [28, 60], [20, 58]], 5, 3.5, 2.3);
	}
	let s = pond(rx) + sp(spokes, "#86b356", 0.6) + sp(traps, "#b2d46a", 1.9) + sp(hubs, "#5f8f3e", 1.6);
	if (stage === "bloom") s += sp("M40 82C40 70 41 56 40 44", "#7aa04e", 0.9) + flower5(40, 42, 4.2, "#f2ede0", "#c8d27a");
	return s;
}

/* ---------- 11. Rainbow plant ---------- */
function rainbowPlant(stage: GrowingStage): string {
	const k = S(stage, 0.32, 0.68, 1);
	const stems: readonly P4[] = [
		[[40, 87], [40, 66], [38, 44], [37, 22]],
		[[40, 87], [44, 70], [50, 54], [55, 36]],
		[[40, 87], [36, 72], [29, 60], [24, 46]],
	];
	const use = stage === "sprout" ? stems.slice(0, 1) : stems;
	let st = "";
	let lv = "";
	let gl = "";
	let flowers = "";
	use.forEach((P0, si) => {
		const P = P0.map(([x, y]) => [40 + (x - 40) * (stage === "sprout" ? 1 : 1), 87 - (87 - y) * k] as const) as unknown as P4;
		st += `M${f(P[0][0])} ${f(P[0][1])}C${f(P[1][0])} ${f(P[1][1])} ${f(P[2][0])} ${f(P[2][1])} ${f(P[3][0])} ${f(P[3][1])}`;
		const n = stage === "sprout" ? 4 : 7;
		for (let i = 0; i < n; i++) {
			const t = 0.12 + (0.86 * i) / (n - 1);
			const [x, y] = bez(P, t);
			const [bx, by] = bez(P, Math.min(1, t + 0.02));
			const a = Math.atan2(by - y, bx - x) / RAD + (i % 2 ? 38 : -38);
			const L = (stage === "sprout" ? 8 : 12) * (1 - t * 0.35);
			const ex = x + Math.cos(a * RAD) * L;
			const ey = y + Math.sin(a * RAD) * L;
			lv += `M${f(x)} ${f(y)}Q${f(x + Math.cos(a * RAD) * L * 0.6)} ${f(y + Math.sin(a * RAD) * L * 0.5)} ${f(ex)} ${f(ey)}`;
			for (let j = 1; j <= 3; j++) gl += `M${f(x + ((ex - x) * j) / 3.4)} ${f(y + ((ey - y) * j) / 3.4 - 0.5)}h0`;
			if (stage === "bloom" && i === 3 + si && si < 3) {
				const fx = ex + (i % 2 ? 4 : -4);
				const fy = ey - 3;
				lv += `M${f(x)} ${f(y)}L${f(fx)} ${f(fy)}`;
				flowers += flower5(fx, fy, 5, "#a96ad2", "#f0cf3a");
			}
		}
		if (stage === "bloom") flowers += flower5(P[3][0], P[3][1] - 2, 5.2, "#a96ad2", "#f0cf3a", -90 + si * 20);
	});
	return sp(st, "#6f9a48", 1.2) + sp(lv, "#9cc46a", 1) + `<path d="${gl}" stroke="#eef6ff" stroke-width="1.1" stroke-linecap="round" opacity=".85"/>` + flowers;
}

/* ---------- 12. Albany pitcher plant ---------- */
const ALBANY_PIT =
	p("M-6 0C-7.5 -6 -3 -10.5 2 -10C6.5 -9.5 7.5 -5 6.5 0C4 1.5 -3.5 1.5 -6 0Z", "#8f3c38") +
	sp("M-3.4 -8L-4.2 -1M1 -9.2L1 -1M4.8 -8L5.4 -1", "#d8b4a0", 0.6, ` stroke-dasharray=".6 .7"`) +
	el(2, -10.2, 5, 1.3, "#4a161a") +
	`<ellipse cx="2" cy="-10.2" rx="5" ry="1.3" fill="none" stroke="#b8606a" stroke-width=".6" stroke-dasharray=".4 .6"/>` +
	p("M-3 -10.6C-3 -16 7 -16 7 -11Z", "#6e5a3a") +
	sp("M-1.4 -11.4L-.4 -14.2M1.4 -11.4L1.6 -14.8M4 -11.2L4 -14.4M6 -11.4L5.4 -13.4", "#efe2d0", 0.55);

function albanyPitcher(stage: GrowingStage): string {
	const o = { fill: "#5fa048", dark: "#3f7a35", shape: 2 as const };
	const lf = (a: number, L: number) => {
		const x = 40 + Math.cos(a * RAD) * L * 0.5;
		const y = 86 + Math.sin(a * RAD) * L * 0.5;
		return line(40, 86, x, y, "#4f8a3c", 1) + leaf(x, y, a, L * 0.6, L * 0.2, o);
	};
	const pit = (x: number, k: number, flip = 1) => g(x, 87, ALBANY_PIT, 0, flip * k, k);
	if (stage === "sprout") return lf(-125, 14) + lf(-55, 14) + pit(46, 0.55);
	if (stage === "leafy") return lf(-130, 22) + lf(-50, 22) + lf(-100, 26) + lf(-78, 24) + pit(28, 0.85, -1) + pit(52, 0.9) + pit(40, 1);
	let s = sp("M41 80C42 60 44 36 45 14", "#6f8a46", 1);
	let fl = "";
	for (const [x, y] of [
		[45, 12],
		[43, 14.5],
		[47, 15],
		[44.5, 18],
		[46.6, 20],
		[44, 23],
	] as const)
		fl += dotSub(x, y, 1.5);
	s += p(fl, "#efe6c4") + p(dotSub(45, 12, 0.5) + dotSub(43, 14.5, 0.5) + dotSub(47, 15, 0.5), "#c9b24a");
	s += lf(-140, 26) + lf(-40, 26) + lf(-112, 32) + lf(-70, 30) + lf(-92, 24);
	return s + pit(20, 1, -1) + pit(60, 1) + pit(30, 1.1, -1) + pit(50, 1.15) + pit(40, 1.3);
}

/* ---------- 13. Sun pitcher ---------- */
function helioTube(t: Tube, wt: number): string {
	const { tx, ty } = t;
	return (
		p(band(t, 0, 1), "#93b452") +
		p(band(t, 0.5, 1), "#c4503c") +
		sp(`M${f(tx + wt * 0.15)} ${f(ty + 1)}L${f(tx + wt * 0.05)} ${f(ty + (87 - ty) * 0.45)}`, "#7a3328", 0.7) +
		el(tx, ty, wt * 1.3, wt * 0.45, "#d9715a") +
		el(tx, ty + 0.2, wt * 0.95, wt * 0.28, "#4e1a1a") +
		el(tx - wt * 0.75, ty - wt * 0.7, wt * 0.42, wt * 0.32, "#9a2a2c", 30)
	);
}
function sunPitcher(stage: GrowingStage): string {
	if (stage === "sprout") return trumpets([[37, 13, 2.4, -1], [42, 16, 2.6, 1]], helioTube);
	const tubes: readonly TubeSpec[] =
		stage === "leafy"
			? [
					[31, 26, 3.6, -3],
					[49, 30, 3.8, 3],
					[36, 38, 4.2, -1],
					[44, 42, 4.4, 1],
				]
			: [
					[25, 34, 4.2, -5],
					[55, 38, 4.4, 5],
					[31, 48, 4.8, -3],
					[49, 52, 5, 3],
					[37, 60, 5.2, -1],
					[43, 56, 5.2, 1],
				];
	let s = trumpets(tubes, helioTube);
	if (stage === "bloom") {
		s =
			sp("M58 87C60 60 62 30 64 16C65 12 67 11 68 13", "#7a8f48", 1) +
			p(ovalSub(68, 16, 3, 1.4, 70) + ovalSub(66, 16.5, 3, 1.4, 105) + ovalSub(70, 16.5, 3, 1.4, 75), "#f2dbe0") +
			p(ovalSub(62.6, 32, 2.8, 1.3, 80) + ovalSub(61, 32.4, 2.8, 1.3, 105), "#e8c4cc") +
			sp("M62 30l1 -3", "#7a8f48", 0.8) +
			s;
	}
	return s;
}

/* ---------- Sundews ---------- */
const DEW_RED = "#c8423a";
const DEW_DROP = "#f4e9ac";

/* ---------- 14. Cape sundew ---------- */
function capeSundew(stage: GrowingStage): string {
	const k = S(stage, 0.42, 0.75, 1);
	const lf = "#93bf5c";
	const dew = new Dew(DEW_RED, DEW_DROP, 0.55, 1.2);
	let s = "";
	const leaves: readonly (readonly [number, number, number])[] = [
		[-150, 22, -1],
		[-30, 22, 1],
		[-124, 32, -1],
		[-56, 32, 1],
		[-104, 38, 1],
		[-78, 36, -1],
		[-92, 28, 1],
	];
	const n = stage === "sprout" ? 4 : leaves.length;
	for (const [a, L, c] of leaves.slice(0, n)) {
		const l = L * k;
		const r = a * RAD;
		const x3 = 40 + Math.cos(r) * l;
		const y3 = 86 + Math.sin(r) * l;
		const pts: P4 = [
			[40 + Math.cos(r) * 2, 85],
			[40 + Math.cos(r) * l * 0.4, 86 + Math.sin(r) * l * 0.55],
			[x3 + c * 1 * k, y3 - 4 * k],
			[x3 + c * 5 * k, y3 + 1.5 * k],
		];
		s += stem(pts, lf, 1.9 * Math.max(k, 0.7));
		dew.along(pts, 0.35, Math.round(5.5 * k) + 2, 1.8 * k + 0.6, 70);
	}
	let fl = "";
	if (stage === "leafy") fl = stem([[42, 85], [43, 62], [45, 50], [49, 46]], "#7da04e", 1) + el(49.5, 46, 1.4, 1.9, "#e98fb8");
	if (stage === "bloom") {
		const P: P4 = [
			[42, 85],
			[43, 50],
			[47, 22],
			[56, 14],
		];
		fl = stem(P, "#7da04e", 1.1);
		for (const t of [0.66, 0.76, 0.86, 0.95]) {
			const [x, y] = bez(P, t);
			fl += flower5(x - 2.5, y - 2, 2.9, "#ea8fbc", "#f6dc6a");
		}
		fl += el(57, 14, 1.3, 1.7, "#d97aa6");
	}
	return fl + s + dew.out();
}

/* ---------- 15. Fork-leaved sundew ---------- */
function forkSundew(stage: GrowingStage): string {
	const k = S(stage, 0.4, 0.72, 1);
	const lf = "#b8c45e";
	const dew = new Dew(DEW_RED, DEW_DROP, 0.55, 1.15);
	let s = "";
	const leaves: readonly (readonly [number, number, number])[] = [
		[-118, 22, 30],
		[-62, 22, 30],
		[-96, 30, 34],
		[-150, 12, 22],
		[-30, 12, 22],
	];
	const n = stage === "sprout" ? 2 : leaves.length;
	for (const [a, pet, arm] of leaves.slice(0, n)) {
		const fx = 40 + Math.cos(a * RAD) * pet * k;
		const fy = 86 + Math.sin(a * RAD) * pet * k;
		s += line(40, 86, fx, fy, "#8aa04e", 1.1);
		for (const d of [-26, 26]) {
			const b = a + d;
			const L = arm * k;
			const pts: P4 = [
				[fx, fy],
				[fx + Math.cos(b * RAD) * L * 0.4, fy + Math.sin(b * RAD) * L * 0.4],
				[fx + Math.cos((b - d * 0.4) * RAD) * L * 0.75, fy + Math.sin((b - d * 0.4) * RAD) * L * 0.75],
				[fx + Math.cos((b - d * 0.6) * RAD) * L, fy + Math.sin((b - d * 0.6) * RAD) * L],
			];
			s += stem(pts, lf, 1.7);
			dew.along(pts, 0.3, Math.round(2.5 * k) + 2, 1.3 * k + 0.4, 75);
		}
	}
	let fl = "";
	if (stage === "bloom") {
		const P: P4 = [
			[40, 85],
			[38, 60],
			[34, 34],
			[28, 18],
		];
		fl = stem(P, "#7da04e", 1);
		for (const t of [0.78, 0.9, 1]) {
			const [x, y] = bez(P, t);
			fl += flower5(x + 2.5, y - 1, 3.4, "#f4efe4", "#d8c25a");
		}
	}
	return fl + s + dew.out();
}

/* ---------- 16. Pygmy sundew ---------- */
function pygmySundew(stage: GrowingStage): string {
	const k = S(stage, 0.7, 1, 1.2);
	const dew = new Dew(DEW_RED, DEW_DROP, 0.5, 1);
	let pets = "";
	let pads = "";
	for (let i = 0; i < 9; i++) {
		const a = -180 + (i * 180) / 8;
		const L = 6 * k;
		const x = 40 + Math.cos(a * RAD) * L;
		const y = 85 + Math.sin(a * RAD) * L * 0.55;
		pets += `M40 85L${f(x)} ${f(y)}`;
		pads += dotSub(x, y, 1.5 * k);
		for (let j = 0; j < 5; j++) dew.add(x, y, a - 70 + j * 35, 2.1 * k);
	}
	let s = sp(pets, "#9c6a3a", 0.8) + dew.out() + p(pads, "#c95a3c");
	s += p(dotSub(40, 83, 2.4 * k), "#e8e2d6") + p(dotSub(39, 82, 0.8) + dotSub(41.2, 81.8, 0.8) + dotSub(40, 80.6, 0.8), "#8cb04e");
	if (stage === "sprout") return s;
	if (stage === "leafy") return sp("M41 82C42 72 44 64 45 58", "#7a8a46", 0.8) + el(45, 57, 1.3, 1.8, "#f4efe4") + s;
	return (
		sp("M39 82C37 70 33 62 30 56M41 82C42 70 46 58 49 50M40 82C40 74 40 70 41 66", "#7a8a46", 0.9) +
		flower5(30, 54, 7, "#f6f1e6", "#b8323a") +
		flower5(49, 48, 7.4, "#f6f1e6", "#b8323a") +
		el(41.2, 64.4, 1.4, 2, "#f6f1e6") +
		s
	);
}

/* ---------- 17. Spoon-leaved sundew ---------- */
function spoonSundew(stage: GrowingStage): string {
	const k = S(stage, 0.65, 0.85, 1);
	const dew = new Dew("#d8463a", DEW_DROP, 0.5, 1.1);
	let pets = "";
	let blades = "";
	const n = stage === "sprout" ? 5 : 11;
	for (let i = 0; i < n; i++) {
		const a = -178 + (i * 176) / (n - 1);
		const L = (i % 2 ? 12 : 15) * k;
		const dx = Math.cos(a * RAD);
		const dy = Math.sin(a * RAD) * 0.55 - 0.1;
		const x1 = 40 + dx * L * 0.45;
		const y1 = 86 + dy * L * 0.45;
		const cx = 40 + dx * L * 0.75;
		const cy = 86 + dy * L * 0.75;
		const rot = Math.atan2(dy, dx) / RAD;
		pets += `M40 86L${f(x1)} ${f(y1)}`;
		const rx = L * 0.3;
		const ry = 2.4 * k;
		blades += ovalSub(cx, cy, rx, ry, rot);
		for (let j = 0; j < 7; j++) {
			const th = (-120 + j * 40) * RAD;
			const lx = Math.cos(th) * rx;
			const ly = Math.sin(th) * ry;
			const r = rot * RAD;
			const px = cx + lx * Math.cos(r) - ly * Math.sin(r);
			const py = cy + lx * Math.sin(r) + ly * Math.cos(r);
			dew.add(px, py, Math.atan2(py - cy, px - cx) / RAD, 1.8 * k);
		}
	}
	let s = sp(pets, "#b4583a", 1.2) + dew.out() + p(blades, "#c94a3a");
	if (stage === "sprout") return s;
	const stalk = (P: P4, ts: readonly number[]) => {
		let o = stem(P, "#8a6a40", 0.9);
		for (const t of ts) {
			const [x, y] = bez(P, t);
			o += flower5(x + 2, y, 3, "#f0a6c4", "#f4e08a");
		}
		return o;
	};
	if (stage === "leafy") return stem([[41, 84], [41, 70], [42, 60], [45, 55]], "#8a6a40", 0.9) + el(45.5, 54.5, 1.2, 1.7, "#f0a6c4") + s;
	return (
		stalk([[38, 84], [37, 66], [34, 52], [30, 44]], [0.8, 1]) +
		stalk([[42, 84], [43, 62], [46, 44], [51, 38]], [0.75, 0.88, 1]) +
		s
	);
}

/* ---------- 18. Dewy pine ---------- */
function dewyPine(stage: GrowingStage): string {
	const k = S(stage, 0.4, 0.75, 1);
	const top = 87 - 16 * k;
	let s = p(`M${f(40 - 3 * k)} 87L${f(40 - 1.6 * k)} ${f(top)}L${f(40 + 1.6 * k)} ${f(top)}L${f(40 + 3 * k)} 87Z`, "#8a6242");
	let lv = "";
	let curl = "";
	let gl = "";
	const leaves: readonly (readonly [number, number, number])[] = [
		[-170, 26, 10],
		[-10, 26, 10],
		[-150, 30, 4],
		[-30, 30, 4],
		[-128, 32, -2],
		[-52, 32, -2],
		[-108, 30, -6],
		[-72, 30, -6],
		[-160, 20, 14],
		[-20, 20, 14],
	];
	const n = stage === "sprout" ? 4 : leaves.length;
	for (const [a, L, droop] of leaves.slice(0, n)) {
		const l = L * k;
		const ex = 40 + Math.cos(a * RAD) * l;
		const ey = top + Math.sin(a * RAD) * l + droop * k;
		const cx = 40 + Math.cos(a * RAD) * l * 0.55;
		const cy = top + Math.sin(a * RAD) * l * 0.8 - 3 * k;
		lv += `M40 ${f(top)}Q${f(cx)} ${f(cy)} ${f(ex)} ${f(ey)}`;
		for (let j = 2; j <= 6; j++) {
			const [gx, gy] = qpt([40, top], [cx, cy], [ex, ey], j / 6.3);
			gl += `M${f(gx)} ${f(gy - 0.6)}h0`;
		}
	}
	if (stage !== "sprout")
		for (const [x, d] of [
			[38, -1],
			[42, 1],
		] as const) {
			const y = top - 12 * k;
			lv += `M${f(x)} ${f(top)}C${f(x)} ${f(top - 6 * k)} ${f(x + d * 2)} ${f(y)} ${f(x + d * 4)} ${f(y)}`;
			curl += dotSub(x + d * 4.6, y + 1.4, 1.6);
		}
	s += sp(lv, "#a7b84c", 1.15) + (curl ? sp(curl, "#a7b84c", 1.1) : "") + `<path d="${gl}" stroke="#cf4a3a" stroke-width="1.2" stroke-linecap="round"/>` + `<path d="${gl.replace(/h0/g, "h0")}" stroke="#f4ecc8" stroke-width=".55" stroke-linecap="round"/>`;
	if (stage !== "bloom") return s;
	return sp("M40 70C40 50 38 36 34 24M40 60C42 48 46 36 50 28M40 52C41 44 42 34 41 18", "#8a9a48", 1) + s + flower5(34, 22, 8.4, "#f2d23a", "#d89a2a") + flower5(50, 26, 8, "#f2d23a", "#d89a2a", -60) + flower5(41, 14, 7.6, "#f2d23a", "#d89a2a", -80);
}

/* ---------- 19. Corkscrew plant ---------- */
function corkFlower(x: number, y: number, k: number): string {
	return sp(`M${f(x)} ${f(y + 1.5 * k)}l${f(-0.5 * k)} ${f(3 * k)}`, "#8a6ac0", 1 * k) + el(x, y - 1.8 * k, 1.8 * k, 1.4 * k, "#b49ad8") + el(x, y + 0.6 * k, 3.4 * k, 2.2 * k, "#c3abe4") + el(x, y, 1.2 * k, 0.9 * k, "#efd04a");
}
function corkscrew(stage: GrowingStage): string {
	const k = S(stage, 0.8, 0.9, 1);
	let traps = "";
	const trap = (side: number, L: number, y: number) => {
		const n = Math.round(L / 2.4);
		let d = "";
		for (let i = 0; i < n; i++) {
			const x = 40 + side * (4 + i * 2.4) * k;
			const yy = y + i * 0.15;
			d += ovalSub(x, yy, 1.5 * k, 0.9 * k, side * 65);
		}
		traps += d;
	};
	trap(-1, S(stage, 8, 18, 26), 86.6);
	trap(1, S(stage, 8, 18, 26), 86.6);
	if (stage !== "sprout") {
		trap(-1, S(stage, 8, 10, 16), 84.6);
		trap(1, S(stage, 8, 10, 16), 84.6);
	}
	let s = `<path d="${traps}" fill="none" stroke="#d2c299" stroke-width=".8"/>`;
	const o = { fill: "#6ea84c", shape: 2 as const, rib: false };
	for (const a of [-160, -125, -90, -55, -20]) s += leaf(40, 85.5, a, 7 * k, 2.4 * k, o);
	if (stage === "sprout") return s;
	if (stage === "leafy") return sp("M40 84C40 74 41 66 42 58", "#7a8a52", 0.8) + el(42, 57, 1.3, 1.8, "#c3abe4") + s;
	return sp("M39 84C37 66 33 50 31 40M41 84C42 62 46 42 50 30M40 84C40 70 40 60 41 54", "#7a8a52", 0.8) + s + corkFlower(31, 37, 1.25) + corkFlower(50, 27, 1.3) + corkFlower(41, 51, 1.15);
}

/* ---------- 20. Roridula ---------- */
function roridula(stage: GrowingStage): string {
	const k = S(stage, 0.38, 0.7, 1);
	const tips: readonly (readonly [number, number, number])[] = [
		[40, 22, 11],
		[25, 38, 10],
		[56, 34, 10],
		[18, 60, 8],
		[62, 58, 8],
	];
	const use = stage === "sprout" ? tips.slice(0, 1) : stage === "leafy" ? tips.slice(0, 3) : tips;
	let br = "";
	let lv = "";
	let gl = "";
	let fl = "";
	use.forEach(([tx0, ty0, r0], i) => {
		const tx = 40 + (tx0 - 40) * k;
		const ty = 87 - (87 - ty0) * k;
		const r = r0 * Math.max(k, 0.55);
		br += `M40 87Q${f(40 + (tx - 40) * 0.2)} ${f(ty + (87 - ty) * 0.5)} ${f(tx)} ${f(ty)}`;
		const n = 14;
		for (let j = 0; j < n; j++) {
			const a = (j * 360) / n + i * 9;
			const L = r * (j % 2 ? 0.8 : 1);
			const ex = tx + Math.cos(a * RAD) * L;
			const ey = ty + Math.sin(a * RAD) * L;
			lv += `M${f(tx)} ${f(ty)}L${f(ex)} ${f(ey)}`;
			gl += `M${f(tx + (ex - tx) * 0.65)} ${f(ty + (ey - ty) * 0.65)}h0M${f(ex)} ${f(ey)}h0`;
		}
		if (stage === "bloom" && i < 3) fl += flower5(tx + 2, ty - 1, 6, "#e88aac", "#f2d24a", -90 + i * 15);
	});
	return sp(br, "#7a5a3c", 1.8 * Math.max(k, 0.6)) + sp(lv, "#8eae4c", 1.2) + `<path d="${gl}" stroke="#e6e0a6" stroke-width="1.1" stroke-linecap="round"/>` + fl;
}

/* ---------- 21. Low's pitcher plant ---------- */
function lowsPitcher(stage: GrowingStage): string {
	return nepVine(stage, () => lowiiPit(), 37, { leaf: "#5d8d44", stem: "#6f5a36", w: 4.2 }, stage === "leafy" ? [0.55, 0.5] : [0.62, 0.6, 0, 0.52]);
}

/* ---------- 22. Attenborough's pitcher plant ---------- */
function attenboroughPitcher(stage: GrowingStage): string {
	const o = { fill: "#7aa84e", dark: "#4f7a3a" };
	if (stage === "sprout") return leaf(40, 86, -140, 10, 3, o) + leaf(40, 86, -40, 10, 3, o) + g(44, 87, bellPit(), 0, 0.45);
	const k = S(stage, 0.5, 0.75, 1);
	let s = stem([[40, 87], [40, 80], [41, 72], [40, 87 - 30 * k]], "#6f7a3c", 2.4 * k);
	for (const [y, a, L] of [
		[80, -160, 16],
		[80, -20, 16],
		[74, -140, 18],
		[74, -40, 18],
		[66, -118, 16],
		[66, -62, 16],
		[60, -92, 12],
	] as const)
		s += leaf(40, 87 - (87 - y) * k * 1.4, a, L * k * 1.15, 4.4 * k, o);
	if (stage === "leafy") return s + g(25, 87, bellPit(), 0, 0.85) + g(56, 87.4, bellPit(), 0, 0.95);
	return s + g(18, 87, bellPit(), 0, 1.05) + g(62, 87, bellPit(), 0, 1.1) + g(40, 88, bellPit(), 0, 1.4);
}

/* ---------- 23. King sundew ---------- */
function kingSundew(stage: GrowingStage): string {
	const k = S(stage, 0.32, 0.62, 1);
	const dew = new Dew("#b8323a", DEW_DROP, 0.6, 1.25);
	let blades = "";
	const leaves: readonly (readonly [number, number])[] = [
		[-128, 48],
		[-52, 48],
		[-112, 62],
		[-68, 62],
		[-98, 70],
		[-82, 68],
		[-140, 36],
		[-40, 36],
	];
	const n = stage === "sprout" ? 4 : leaves.length;
	for (const [a, L] of leaves.slice(0, n)) {
		const l = L * k;
		blades += lensSub(40, 86, a, l, 1.6 + l * 0.03);
		dew.along(straight(40, 86, a, l), 0.2, Math.round(l / 4.2) + 2, 1.9, 82, true);
	}
	let fl = "";
	if (stage === "bloom") {
		fl = sp("M44 86C46 70 52 58 58 46", "#8a6a3a", 1.2);
		fl += flower5(58, 44, 9, "#d24a9a", "#f2d24a") + flower5(54.6, 55, 8, "#d24a9a", "#f2d24a", -60) + el(60, 39, 1.8, 2.4, "#c23e8a");
	}
	return p(blades, "#9eb04a") + dew.out() + fl;
}

/* ---------- 24. Pale pitcher plant ---------- */
function alataTube(t: Tube, wt: number, lean: number): string {
	const { tx, ty } = t;
	const d = lean < 0 ? -1 : 1;
	return (
		p(band(t, 0, 1), "#c4cd80") +
		p(band(t, 0, 0.25), "#9fb35c") +
		sp(`M${f(tx - wt * 0.6)} ${f(ty + 1)}l.2 5M${f(tx)} ${f(ty + 1)}v6M${f(tx + wt * 0.6)} ${f(ty + 1)}l-.2 5`, "#b8584e", 0.55) +
		el(tx, ty, wt, wt * 0.32, "#8a3a2e") +
		el(tx + d * wt * 0.5, ty - wt * 0.95, wt * 1.05, wt * 0.82, "#d6d79a", d * 25) +
		sp(`M${f(tx + d * wt * 0.1)} ${f(ty - 0.4)}L${f(tx + d * wt * 0.9)} ${f(ty - wt * 1.6)}`, "#b8584e", 0.5)
	);
}
function palePitcher(stage: GrowingStage): string {
	if (stage === "sprout") return trumpets([[37, 15, 1.6, -1], [42, 19, 1.8, 1]], alataTube);
	if (stage === "leafy") return trumpets([[33, 34, 2.4, -3], [47, 38, 2.4, 3], [38, 46, 2.7, -1], [43, 50, 2.7, 1]], alataTube);
	return sarrFlower(22, 16, 56, "#ece6a8", "#cfcf86") + trumpets([[30, 52, 2.8, -4], [50, 58, 2.9, 4], [35, 66, 3.1, -2], [45, 72, 3.2, 2], [40, 62, 3, 0]], alataTube);
}

/* ---------- 25. Carnivorous bromeliad ---------- */
function bromeliad(stage: GrowingStage): string {
	const k = S(stage, 0.32, 0.65, 1);
	const strap = (x: number, h: number, w: number, lean: number) => {
		const tx = x + lean;
		const ty = 87 - h;
		return `M${f(x - w)} 87Q${f(x - w + lean * 0.2)} ${f(87 - h * 0.5)} ${f(tx - w)} ${f(ty + w)}Q${f(tx)} ${f(ty - w * 1.2)} ${f(tx + w)} ${f(ty + w)}Q${f(x + w + lean * 0.2)} ${f(87 - h * 0.5)} ${f(x + w)} 87Z`;
	};
	const back: readonly (readonly [number, number, number])[] = [
		[35, 46, -9],
		[45, 46, 9],
		[37, 56, -4],
		[43, 56, 4],
	];
	const front: readonly (readonly [number, number, number])[] = [
		[36, 40, -6],
		[44, 40, 6],
		[40, 50, 0],
	];
	let b = "";
	let fr = "";
	for (const [x, h, lean] of back) b += strap(x, h * k, 3.4 * Math.max(k, 0.6), lean * k);
	for (const [x, h, lean] of front) fr += strap(x, h * k, 3.6 * Math.max(k, 0.6), lean * k);
	let s = p(b, "#b6bb4c") + p(fr, "#d0d06a") + sp(`M36 87L${f(36 - 5 * k)} ${f(87 - 30 * k)}M44 87L${f(44 + 5 * k)} ${f(87 - 30 * k)}M40 87V${f(87 - 38 * k)}`, "#e6e2b4", 0.6, ` opacity=".7"`);
	if (stage !== "bloom") return s;
	let fl = "";
	for (const [x, y] of [
		[40, 8],
		[37, 13],
		[43, 15],
		[35, 19],
		[45, 21],
		[38, 24],
		[42, 27],
		[34, 26],
		[46, 30],
	] as const)
		fl += dotSub(x, y, 1.6);
	s = sp("M40 40V10M40 18L35 20M40 24L45 22M40 28L34 27M40 31L46 31", "#8a9a4a", 1) + s + p(fl, "#ebe3c2");
	return s;
}

export const SPECIES: Species[] = [
	{ id: "tropical-pitcher-plant", name: "Tropical pitcher plant", draw: tropicalPitcher },
	{ id: "rajah-pitcher-plant", name: "Rajah pitcher plant", draw: rajahPitcher },
	{ id: "purple-pitcher-plant", name: "Purple pitcher plant", draw: purplePitcher },
	{ id: "yellow-trumpet-pitcher", name: "Yellow trumpet pitcher", draw: yellowTrumpet },
	{ id: "white-topped-pitcher", name: "White-topped pitcher", draw: whiteTopped },
	{ id: "parrot-pitcher-plant", name: "Parrot pitcher plant", draw: parrotPitcher },
	{ id: "hooded-pitcher-plant", name: "Hooded pitcher plant", draw: hoodedPitcher },
	{ id: "butterwort", name: "Butterwort", draw: butterwort },
	{ id: "bladderwort", name: "Bladderwort", draw: bladderwort },
	{ id: "waterwheel-plant", name: "Waterwheel plant", draw: waterwheel },
	{ id: "rainbow-plant", name: "Rainbow plant", draw: rainbowPlant },
	{ id: "albany-pitcher-plant", name: "Albany pitcher plant", draw: albanyPitcher },
	{ id: "sun-pitcher", name: "Sun pitcher", draw: sunPitcher },
	{ id: "cape-sundew", name: "Cape sundew", draw: capeSundew },
	{ id: "fork-leaved-sundew", name: "Fork-leaved sundew", draw: forkSundew },
	{ id: "pygmy-sundew", name: "Pygmy sundew", draw: pygmySundew },
	{ id: "spoon-leaved-sundew", name: "Spoon-leaved sundew", draw: spoonSundew },
	{ id: "dewy-pine", name: "Dewy pine", draw: dewyPine },
	{ id: "corkscrew-plant", name: "Corkscrew plant", draw: corkscrew },
	{ id: "roridula", name: "Roridula", draw: roridula },
	{ id: "lows-pitcher-plant", name: "Low's pitcher plant", draw: lowsPitcher },
	{ id: "attenboroughs-pitcher-plant", name: "Attenborough's pitcher plant", draw: attenboroughPitcher },
	{ id: "king-sundew", name: "King sundew", draw: kingSundew },
	{ id: "pale-pitcher-plant", name: "Pale pitcher plant", draw: palePitcher },
	{ id: "carnivorous-bromeliad", name: "Carnivorous bromeliad", draw: bromeliad },
];
