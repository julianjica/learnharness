/**
 * Garden species: ferns, mosses, water and carnivorous plants (25).
 * Drawn with the shared kit; see kit.ts for the style contract.
 */
import { GREEN, bez, circle, f, leaf, line, petals, stem, type GrowingStage, type Pt, type Species } from "./kit";

type Shape = 0 | 1 | 2 | 3 | 4;
const RAD = Math.PI / 180;

/** A group translated to (x, y) and rotated by deg. */
const g = (x: number, y: number, deg: number, inner: string): string => `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(deg)})">${inner}</g>`;

/** Points along a curling path: n steps from (x, y) heading deg, turning by bend degrees in all. */
function walk(x: number, y: number, deg: number, len: number, bend: number, n = 12): { x: number; y: number; a: number }[] {
	const pts = [{ x, y, a: deg }];
	let a = deg;
	for (let j = 1; j <= n; j++) {
		a += bend / n;
		x += Math.cos(a * RAD) * (len / n);
		y += Math.sin(a * RAD) * (len / n);
		pts.push({ x, y, a });
	}
	return pts;
}

const polyline = (pts: { x: number; y: number }[], stroke: string, width: number): string =>
	`<path d="M${pts.map((p) => `${f(p.x)} ${f(p.y)}`).join("L")}" stroke="${stroke}" stroke-width="${width}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;

/** A leaf outline as absolute path data (quadratic for 0/1, needle for 3), for batching many leaflets into one path. */
function leafD(x: number, y: number, deg: number, len: number, w: number, shape: Shape = 0): string {
	const c = Math.cos(deg * RAD);
	const sn = Math.sin(deg * RAD);
	const R = (u: number, v: number) => `${f(u * c - v * sn)} ${f(u * sn + v * c)}`;
	const M = `M${f(x)} ${f(y)}`;
	if (shape === 3) return `M${f(x + w * 0.5 * sn)} ${f(y - w * 0.5 * c)}l${R(len, w * 0.5)}l${R(-len, w * 0.5)}z`;
	if (shape === 2) return `${M}c${R(len * 0.05, -w * 1.4)} ${R(len * 1.02, -w * 1.3)} ${R(len, 0)}c${R(0.02 * len, w * 1.3)} ${R(-len * 0.95, w * 1.4)} ${R(-len, 0)}z`;
	const k = shape === 1 ? 0.4 : 0.5;
	return `${M}q${R(len * k, -w * 1.35)} ${R(len, 0)}q${R(len * (k - 1), w * 1.35)} ${R(-len, 0)}z`;
}

/** Path data batched by colour, painted in first-use order. */
class Ink {
	private m = new Map<string, string>();
	add(key: string, d: string): this {
		this.m.set(key, (this.m.get(key) ?? "") + d);
		return this;
	}
	leaf(fill: string, x: number, y: number, deg: number, len: number, w: number, shape: Shape = 0): this {
		return this.add(fill, leafD(x, y, deg, len, w, shape));
	}
	/** A stroke: key is "colour|width". */
	seg(color: string, width: number, x1: number, y1: number, x2: number, y2: number): this {
		return this.add(`${color}|${width}`, `M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}`);
	}
	svg(): string {
		let s = "";
		for (const [k, d] of this.m) {
			const [c, w] = k.split("|");
			s += w ? `<path d="${d}" stroke="${c}" stroke-width="${w}" stroke-linecap="round" fill="none"/>` : `<path d="${d}" fill="${c}"/>`;
		}
		return s;
	}
}

const polyD = (pts: { x: number; y: number }[]): string => `M${pts.map((p) => `${f(p.x)} ${f(p.y)}`).join("L")}`;

interface Pinnate {
	n?: number;
	/** Leaflet length at t in (0, 1) along the frond. */
	size: (t: number) => number;
	/** Leaflet angle off the rachis (degrees). */
	ang?: number;
	/** Leaflet width / length. */
	ratio?: number;
	shape?: Shape;
	a?: string;
	b?: string;
	rib?: string;
	ribW?: number;
	from?: number;
}

/** A pinnate frond whose leaflet sizes follow a profile. */
function pinnate(x: number, y: number, deg: number, len: number, bend: number, o: Pinnate): string {
	const { n = 12, ang = 62, ratio = 0.33, shape = 0, a = GREEN.light, b = GREEN.leaf, rib = GREEN.dark, ribW = 1.4, from = 2 } = o;
	const pts = walk(x, y, deg, len, bend, n);
	const ink = new Ink();
	for (let j = from; j < n; j++) {
		const p = pts[j]!;
		const l = o.size(j / n);
		if (l < 0.6) continue;
		ink.leaf(a, p.x, p.y, p.a - ang, l, l * ratio, shape).leaf(b, p.x, p.y, p.a + ang, l, l * ratio, shape);
	}
	return polyline(pts, rib, ribW) + ink.svg();
}

/** A fiddlehead rising from the ground at x. */
function fiddle(x: number, h: number, r: number, color: string = GREEN.leaf, w = 2.2): string {
	return `<path d="M${f(x)} 87C${f(x)} ${f(87 - h * 0.5)} ${f(x + r * 1.4)} ${f(87 - h * 0.7)} ${f(x + r)} ${f(87 - h)}A${f(r)} ${f(r)} 0 1 0 ${f(x - r * 0.2)} ${f(87 - h - r * 0.3)}A${f(r * 0.55)} ${f(r * 0.55)} 0 1 0 ${f(x + r * 0.6)} ${f(87 - h - r * 0.6)}" stroke="${color}" stroke-width="${w}" fill="none" stroke-linecap="round"/>`;
}

/** A shallow pond over the soil. */
function pond(rx = 19): string {
	return `<ellipse cx="40" cy="86.4" rx="${f(rx)}" ry="3.2" fill="#4c86a8"/><path d="M${f(40 - rx * 0.7)} 86.6h${f(rx * 0.35)}M${f(40 + rx * 0.2)} 87.6h${f(rx * 0.4)}" stroke="#7fb3d0" stroke-width=".8" stroke-linecap="round"/>`;
}

const S = (stage: GrowingStage, sprout: number, leafy: number, bloom: number): number => (stage === "sprout" ? sprout : stage === "leafy" ? leafy : bloom);

/* ───────────── Ferns ───────────── */

function bostonFern(stage: GrowingStage): string {
	const c = { a: "#8ccb62", b: "#6fb352", rib: "#3f7a35" };
	const fr = (deg: number, len: number, bend: number, sz: number) =>
		pinnate(40, 86, deg, len, bend, { ...c, n: 12, size: (t) => sz * (1 - t * 0.4), ang: 72, ratio: 0.46 });
	if (stage === "sprout") return fr(-125, 15, -30, 3.2) + fr(-55, 15, 30, 3.2) + fiddle(40, 14, 2.6, c.b, 1.6);
	if (stage === "leafy") return fr(-150, 28, -60, 4.2) + fr(-30, 28, 60, 4.2) + fr(-118, 36, -55, 4.6) + fr(-62, 36, 55, 4.6) + fr(-92, 40, -30, 4.8);
	return (
		fr(-160, 30, -70, 4.4) +
		fr(-20, 30, 70, 4.4) +
		fr(-135, 42, -95, 4.8) +
		fr(-45, 42, 95, 4.8) +
		fr(-112, 54, -95, 5.2) +
		fr(-68, 54, 95, 5.2) +
		fr(-96, 56, -60, 5.2) +
		fr(-84, 52, 50, 5)
	);
}

/** A fan leaflet pointing along deg. */
function fan(x: number, y: number, deg: number, r: number, fill: string): string {
	return g(x, y, deg, `<path d="M0 0L${f(r * 0.85)} ${f(-r * 0.75)}Q${f(r * 1.25)} 0 ${f(r * 0.85)} ${f(r * 0.75)}Z" fill="${fill}"/>`);
}

function maidenhair(stage: GrowingStage): string {
	const wire = "#6e4a5c";
	const ca = "#a3d67c";
	const cb = "#80c05e";
	const frondAt = (tx: number, ty: number, side: number, sc: number) => {
		const P: [Pt, Pt, Pt, Pt] = [
			[40, 87],
			[40 - side * 2, ty + (87 - ty) * 0.3],
			[tx - side * 10 * sc, ty - 7 * sc],
			[tx, ty + 5 * sc],
		];
		let s = stem(P, wire, 1.1);
		const n = sc > 0.8 ? 8 : 5;
		for (let i = 0; i < n; i++) {
			const t = 0.42 + (0.58 * i) / (n - 1);
			const [x, y] = bez(P, t);
			const [x2, y2] = bez(P, Math.min(1, t + 0.02));
			const a = Math.atan2(y2 - y, x2 - x) / RAD;
			const r = (1.8 + 1.4 * Math.sin(Math.PI * t)) * sc;
			const down = side > 0 ? 70 : -70;
			s += fan(x, y, a + down, r * 1.1, i % 2 ? ca : cb) + fan(x, y, a - down * 0.9, r * 0.8, i % 2 ? cb : ca);
		}
		return s + fan(P[3][0], P[3][1], 90, 2.4 * sc, ca);
	};
	if (stage === "sprout") return frondAt(48, 70, 1, 0.7);
	if (stage === "leafy") return frondAt(24, 54, -1, 0.85) + frondAt(56, 50, 1, 0.9);
	return frondAt(14, 46, -1, 1) + frondAt(66, 42, 1, 1) + frondAt(30, 24, -1, 1) + frondAt(52, 20, 1, 0.95);
}

function birdsNest(stage: GrowingStage): string {
	const fills = ["#7fbf45", "#94cc55", "#6aa83c"] as const;
	const rib = "#4a3523";
	const sc = S(stage, 0.32, 0.65, 1);
	const set: [number, number, number][] = [
		[-150, 40, 9],
		[-30, 40, 9],
		[-128, 56, 10],
		[-52, 56, 10],
		[-108, 66, 10.5],
		[-72, 66, 10.5],
		[-90, 70, 10],
	];
	const use = stage === "sprout" ? set.slice(4) : stage === "leafy" ? set.slice(2) : set;
	let s = "";
	use.forEach(([a, l, w], i) => {
		s += leaf(40, 85, a, l * sc, w * Math.max(sc, 0.6), { fill: fills[i % 3]!, dark: rib, shape: 0 });
	});
	if (stage !== "sprout") s += `<ellipse cx="40" cy="84" rx="${f(4 * sc + 1)}" ry="${f(2.5 * sc + 1)}" fill="#7a5638"/>`;
	if (stage === "bloom") s += fiddle(43, 14, 2, "#a7d66a", 1.6);
	return s;
}

/** A staghorn antler: thick forked strokes. */
function antler(x: number, y: number, deg: number, len: number, depth: number, w: number, fill: string): string {
	const ex = x + Math.cos(deg * RAD) * len;
	const ey = y + Math.sin(deg * RAD) * len;
	let s = line(x, y, ex, ey, fill, w);
	if (depth > 0) s += antler(ex, ey, deg - 24, len * 0.62, depth - 1, w * 0.78, fill) + antler(ex, ey, deg + 24, len * 0.62, depth - 1, w * 0.78, fill);
	return s;
}

function staghorn(stage: GrowingStage): string {
	const silver = "#93b98e";
	const silver2 = "#a9c9a2";
	const shield = (rx: number, ry: number) =>
		`<ellipse cx="40" cy="${f(87 - ry)}" rx="${f(rx)}" ry="${f(ry)}" fill="#a69563"/><path d="M${f(40 - rx * 0.6)} ${f(87 - ry * 1.2)}Q40 ${f(87 - ry * 2.2)} ${f(40 + rx * 0.6)} ${f(87 - ry * 1.2)}M${f(40 - rx * 0.8)} ${f(87 - ry * 0.6)}Q40 ${f(87 - ry * 1.5)} ${f(40 + rx * 0.8)} ${f(87 - ry * 0.6)}" stroke="#806f43" stroke-width=".8" fill="none"/>`;
	if (stage === "sprout") return antler(40, 84, -80, 11, 1, 3.2, silver) + shield(6, 4);
	if (stage === "leafy") return antler(38, 82, -118, 17, 1, 4.2, silver2) + antler(42, 82, -62, 19, 2, 4.4, silver) + shield(10, 6);
	return antler(36, 80, -152, 17, 2, 5, silver2) + antler(44, 80, -28, 17, 2, 5, silver2) + antler(38, 78, -106, 25, 2, 5.4, silver) + antler(42, 78, -72, 22, 2, 5.2, silver) + shield(15, 9);
}

function treeFern(stage: GrowingStage): string {
	const c = { a: "#8ccb62", b: "#5fa64e", rib: "#3f7a35" };
	const trunk = (top: number, w: number) => {
		let s = line(40, 87, 40, top, "#6b4a32", w);
		for (let y = 84; y > top + 2; y -= 4) s += line(40 - w / 2 + 0.6, y, 40 + w / 2 - 0.6, y - 1.5, "#4e3322", 0.9);
		return s;
	};
	const fr = (x: number, y: number, deg: number, len: number, bend: number, sz: number) =>
		pinnate(x, y, deg, len, bend, { ...c, size: (t) => sz * Math.sin(Math.PI * Math.min(1, t * 1.1 + 0.1)) + 1, ang: 66, ratio: 0.3 });
	if (stage === "sprout") return trunk(80, 5) + fr(40, 80, -130, 13, -20, 3) + fr(40, 80, -50, 13, 20, 3) + fiddle(41, 16, 2, c.b, 1.4);
	if (stage === "leafy") {
		const t = 64;
		return trunk(t, 5.5) + fr(40, t, -170, 26, -40, 6) + fr(40, t, -10, 26, 40, 6) + fr(40, t, -125, 24, -40, 6) + fr(40, t, -55, 24, 40, 6) + fr(40, t, -90, 20, 10, 5);
	}
	const t = 42;
	return (
		trunk(t, 7) +
		fr(40, t, -175, 34, -55, 8) +
		fr(40, t, -5, 34, 55, 8) +
		fr(40, t, -140, 32, -55, 8) +
		fr(40, t, -40, 32, 55, 8) +
		fr(40, t, -108, 30, -35, 7) +
		fr(40, t, -72, 30, 35, 7)
	);
}

function ostrichFern(stage: GrowingStage): string {
	const c = { a: "#9ad468", b: "#7cbf54", rib: "#467f35" };
	const size = (m: number) => (t: number) => 1 + m * Math.sin(Math.PI * Math.min(1, Math.pow(t, 1.6)));
	const fr = (dx: number, deg: number, len: number, bend: number, m: number) => pinnate(40 + dx, 87, deg, len, bend, { ...c, n: 14, size: size(m), ang: 66, ratio: 0.3 });
	const fertile = (dx: number, h: number) => {
		let s = line(40 + dx, 87, 40 + dx, 87 - h, "#6b4428", 1.6);
		for (let y = 87 - h + 2; y < 87 - h * 0.35; y += 3) s += `<ellipse cx="${f(40 + dx - 1.3)}" cy="${f(y)}" rx="1" ry="1.5" fill="#8a5a32"/><ellipse cx="${f(40 + dx + 1.3)}" cy="${f(y)}" rx="1" ry="1.5" fill="#7a4e2c"/>`;
		return s;
	};
	if (stage === "sprout") return fr(-1, -100, 20, 8, 3) + fiddle(42, 16, 2.6, c.b, 1.6);
	if (stage === "leafy") return fr(-2, -112, 40, -12, 5.5) + fr(2, -68, 40, 12, 5.5) + fr(0, -92, 46, 4, 6);
	return fr(-2, -118, 60, -14, 7) + fr(2, -62, 60, 14, 7) + fr(-1, -102, 70, -6, 7.5) + fr(1, -80, 68, 6, 7.5) + fertile(-1, 34) + fertile(2, 28);
}

function swordFern(stage: GrowingStage): string {
	const c = { a: "#4f9a4a", b: "#3f8640", rib: "#2c5d2a" };
	const fr = (deg: number, len: number, bend: number, sz: number) =>
		pinnate(40, 86, deg, len, bend, { ...c, n: 13, size: (t) => sz * (t < 0.75 ? 1 : (1 - t) * 4), ang: 82, ratio: 0.26, shape: 1 });
	if (stage === "sprout") return fr(-98, 20, 6, 3.6) + fiddle(42, 13, 2.4, c.a, 1.6);
	if (stage === "leafy") return fr(-124, 40, 8, 5) + fr(-56, 40, -8, 5) + fr(-100, 46, 4, 5.2) + fr(-80, 44, -4, 5.2);
	return fr(-140, 50, 10, 5.6) + fr(-40, 50, -10, 5.6) + fr(-118, 62, 6, 6) + fr(-62, 62, -6, 6) + fr(-98, 70, 2, 6) + fr(-82, 66, -2, 6);
}

function asparagusFern(stage: GrowingStage): string {
	const ca = "#b2da74";
	const cb = "#8cc152";
	const berries: [number, number][] = [];
	const plume = (dx: number, deg: number, len: number, bend: number, sz: number) => {
		const pts = walk(40 + dx, 86, deg, len, bend, 10);
		let d = "";
		pts.slice(2).forEach((p, i) => {
			const r = sz * 1.7 * (1 - i / 13);
			for (let k = 0; k < 7; k++) {
				const a = (p.a + k * 51 + i * 29) * RAD;
				d += `M${f(p.x)} ${f(p.y)}l${f(Math.cos(a) * r)} ${f(Math.sin(a) * r)}`;
			}
			if (i % 4 === 2) berries.push([p.x + Math.cos((p.a + 90) * RAD) * sz, p.y + Math.sin((p.a + 90) * RAD) * sz]);
		});
		return polyline(pts.slice(1, 9), cb, sz * 0.9) + `<path d="${d}" stroke="${ca}" stroke-width=".8" stroke-linecap="round"/>`;
	};
	if (stage === "sprout") return plume(0, -92, 18, 6, 2.4);
	if (stage === "leafy") return plume(-3, -112, 36, -18, 3) + plume(3, -70, 34, 18, 3) + plume(0, -92, 42, 4, 3.2);
	const s = plume(-4, -140, 36, -40, 3.2) + plume(4, -40, 36, 40, 3.2) + plume(-2, -112, 52, -22, 3.6) + plume(2, -70, 50, 22, 3.6) + plume(0, -92, 60, 6, 3.8);
	return s + berries.map(([x, y]) => circle(x, y, 1.4, "#d6463a") + circle(x - 0.5, y - 0.5, 0.5, "#fff", 0.6)).join("");
}

function hollyFern(stage: GrowingStage): string {
	const c = { a: "#3f8a55", b: "#2f7346", rib: "#24502f" };
	const fr = (deg: number, len: number, bend: number, sz: number, n: number) =>
		pinnate(40, 86, deg, len, bend, { ...c, n, size: (t) => sz * (1 - t * 0.4), ang: 52, ratio: 0.42, shape: 1, from: 1 });
	if (stage === "sprout") return fr(-110, 16, 15, 5, 5) + fr(-70, 14, -15, 4.5, 4);
	if (stage === "leafy") return fr(-140, 34, -20, 8, 7) + fr(-40, 34, 20, 8, 7) + fr(-95, 40, 8, 8.5, 7);
	return fr(-155, 40, -35, 9.5, 8) + fr(-25, 40, 35, 9.5, 8) + fr(-120, 54, -25, 10, 9) + fr(-60, 54, 25, 10, 9) + fr(-90, 62, 6, 10, 9);
}

function royalFern(stage: GrowingStage): string {
	const c = { a: "#9cc86a", b: "#82b656", rib: "#55803a" };
	const fr = (deg: number, len: number, bend: number, sz: number, fertile: boolean) => {
		const n = 10;
		const pts = walk(40, 86, deg, len, bend, n);
		const ink = new Ink();
		let subs = "";
		for (let j = 2; j < n; j++) {
			const p = pts[j]!;
			const l = sz * (1 - j / n / 2);
			for (const side of [-1, 1]) {
				ink.leaf(side < 0 ? c.a : c.b, p.x, p.y, p.a + side * 62, l, l * 0.24, 2);
				const ex = p.x + Math.cos((p.a + side * 62) * RAD) * l * 0.8;
				const ey = p.y + Math.sin((p.a + side * 62) * RAD) * l * 0.8;
				subs += `M${f(p.x)} ${f(p.y)}L${f(ex)} ${f(ey)}`;
			}
		}
		let s = polyline(pts, c.rib, 1.4) + `<path d="${subs}" stroke="${c.rib}" stroke-width=".7" fill="none"/>` + ink.svg();
		if (fertile) {
			const tip = pts[n]!;
			for (let k = 0; k < 7; k++) {
				const a = tip.a - 70 + k * 23;
				s += `<ellipse cx="${f(tip.x + Math.cos(a * RAD) * 3.4)}" cy="${f(tip.y + Math.sin(a * RAD) * 3.4)}" rx="2.3" ry="1.4" fill="${k % 2 ? "#c26a32" : "#a8532a"}" transform="rotate(${f(a)} ${f(tip.x + Math.cos(a * RAD) * 3.4)} ${f(tip.y + Math.sin(a * RAD) * 3.4)})"/>`;
			}
			s += circle(tip.x, tip.y, 2.6, "#b85e2e");
		}
		return s;
	};
	if (stage === "sprout") return fr(-96, 22, 10, 3, false);
	if (stage === "leafy") return fr(-125, 40, -10, 6, false) + fr(-55, 40, 10, 6, false) + fr(-92, 46, 4, 6.5, false);
	return fr(-136, 44, -15, 6.5, false) + fr(-44, 44, 15, 6.5, false) + fr(-110, 64, -6, 7.5, true) + fr(-72, 64, 6, 7.5, true);
}

/* ───────────── Mosses ───────────── */

function cushionMoss(stage: GrowingStage): string {
	const c = ["#7fa66c", "#93b87e", "#a8c991", "#bcd7a5"] as const;
	const dome = (cx: number, rx: number, h: number) => {
		let s = `<path d="M${f(cx - rx)} 87.5C${f(cx - rx)} ${f(87 - h * 1.3)} ${f(cx + rx)} ${f(87 - h * 1.3)} ${f(cx + rx)} 87.5Z" fill="${c[0]}"/>`;
		s += `<path d="M${f(cx - rx * 0.8)} ${f(87 - h * 0.25)}C${f(cx - rx * 0.75)} ${f(87 - h * 1.15)} ${f(cx + rx * 0.6)} ${f(87 - h * 1.2)} ${f(cx + rx * 0.65)} ${f(87 - h * 0.45)}C${f(cx + rx * 0.2)} ${f(87 - h * 0.6)} ${f(cx - rx * 0.4)} ${f(87 - h * 0.5)} ${f(cx - rx * 0.8)} ${f(87 - h * 0.25)}Z" fill="${c[1]}"/>`;
		s += `<ellipse cx="${f(cx - rx * 0.25)}" cy="${f(87 - h * 0.78)}" rx="${f(rx * 0.35)}" ry="${f(h * 0.14)}" fill="${c[3]}"/>`;
		// tiny leaf stars as texture
		const n = Math.round(rx / 3);
		for (let i = 0; i < n; i++) {
			const t = (i + 0.5) / n;
			const x = cx - rx * 0.75 + rx * 1.5 * t;
			const y = 87 - h * (0.3 + 0.55 * Math.sin(Math.PI * t)) + (i % 2) * 3;
			s += `<path d="M${f(x - 1.2)} ${f(y)}h2.4M${f(x)} ${f(y - 1.2)}v2.4" stroke="#5f8a52" stroke-width=".6" stroke-linecap="round"/>`;
		}
		return s;
	};
	if (stage === "sprout") return dome(40, 8, 7);
	if (stage === "leafy") return dome(32, 11, 12) + dome(46, 13, 17);
	return dome(22, 12, 14) + dome(57, 14, 18) + dome(39, 20, 30);
}

function haircapMoss(stage: GrowingStage): string {
	const dk = "#3f7a33";
	const lf = "#5c9a3c";
	const lt = "#79b24e";
	const shoot = (x: number, h: number, lean: number) => {
		const tx = x + lean;
		const ty = 87 - h;
		const ink = new Ink();
		for (let k = 1; k <= 3; k++) {
			const yy = 87 - (h * k) / 3.3;
			const xx = x + (lean * k) / 3.3;
			ink.leaf(lf, xx, yy, -150, 3.4, 0.8, 3).leaf(lf, xx, yy, -30, 3.4, 0.8, 3);
		}
		for (let i = 0; i < 7; i++) ink.leaf(i % 2 ? lt : lf, tx, ty, -180 + i * 30, 4.6, 1, 3);
		return line(x, 87, tx, ty, dk, 1.4) + ink.svg();
	};
	const capsule = (x: number, top: number, lean: number) => {
		const tx = x + lean;
		return (
			`<path d="M${f(x)} 80Q${f(x + lean * 0.2)} ${f((80 + top) / 2)} ${f(tx)} ${f(top)}" stroke="#c4713a" stroke-width="1" fill="none"/>` +
			`<rect x="${f(tx - 1.6)}" y="${f(top - 4.2)}" width="3.2" height="5" rx="1" fill="#a87a3e" transform="rotate(${f(lean * 2 + 20)} ${f(tx)} ${f(top)})"/>` +
			`<path d="M${f(tx - 2.4)} ${f(top - 3)}Q${f(tx)} ${f(top - 9)} ${f(tx + 2.4)} ${f(top - 3)}Z" fill="#e3c06a" transform="rotate(${f(lean * 2 + 20)} ${f(tx)} ${f(top)})"/>`
		);
	};
	if (stage === "sprout") return shoot(37, 10, -1) + shoot(43, 13, 1);
	if (stage === "leafy") return shoot(30, 16, -3) + shoot(36, 22, -1) + shoot(42, 24, 1) + shoot(48, 18, 3) + shoot(39, 13, 0);
	return capsule(34, 30, -8) + capsule(43, 24, 2) + capsule(49, 36, 10) + shoot(24, 16, -4) + shoot(30, 22, -3) + shoot(36, 26, -1) + shoot(42, 27, 1) + shoot(48, 23, 3) + shoot(54, 17, 4) + shoot(39, 15, 0);
}

function clubMoss(stage: GrowingStage): string {
	const st = "#4b8a3c";
	const nd = "#6aa84a";
	const nd2 = "#86bd5c";
	const ink = new Ink();
	let cones = "";
	const branch = (x: number, y: number, deg: number, len: number, depth: number, cone: boolean): string => {
		const pts = walk(x, y, deg, len, 0, Math.max(3, Math.round(len / 3)));
		ink.add(`${st}|2.2`, polyD(pts));
		pts.slice(1).forEach((p, i) => ink.leaf(i % 2 ? nd : nd2, p.x, p.y, p.a - 55, 3.2, 0.9, 3).leaf(i % 2 ? nd2 : nd, p.x, p.y, p.a + 55, 3.2, 0.9, 3));
		const e = pts[pts.length - 1]!;
		if (depth > 0) void (branch(e.x, e.y, deg - 19, len * 0.75, depth - 1, cone) + branch(e.x, e.y, deg + 19, len * 0.75, depth - 1, cone));
		else if (cone) cones += `<ellipse cx="${f(e.x + Math.cos(deg * RAD) * 4)}" cy="${f(e.y + Math.sin(deg * RAD) * 4)}" rx="4.2" ry="1.7" fill="#d6c25a" transform="rotate(${f(deg)} ${f(e.x + Math.cos(deg * RAD) * 4)} ${f(e.y + Math.sin(deg * RAD) * 4)})"/>`;
		return "";
	};
	const runner = (x1: number, x2: number) => line(x1, 86.5, x2, 86.5, st, 2) + leaf(x1, 86.5, 180, 3, 0.9, { fill: nd, shape: 3, rib: false }) + leaf(x2, 86.5, 0, 3, 0.9, { fill: nd, shape: 3, rib: false });
	if (stage === "sprout") return runner(30, 50) + branch(40, 86, -90, 14, 0, false) + ink.svg();
	if (stage === "leafy") return runner(22, 58) + branch(30, 86, -96, 16, 1, false) + branch(48, 86, -84, 18, 1, false) + ink.svg();
	return runner(14, 66) + branch(23, 86, -100, 15, 2, true) + branch(40, 86, -90, 22, 1, true) + branch(57, 86, -80, 15, 2, true) + ink.svg() + cones;
}

function spikemoss(stage: GrowingStage): string {
	const ca = "#5fb59a";
	const cb = "#4a9c84";
	const rib = "#357a66";
	const one = (x: number, y: number, deg: number, len: number, bend: number, depth: number, ink: Ink): Ink => {
		const n = 6;
		const pts = walk(x, y, deg, len, bend, n);
		ink.add(`${rib}|1`, polyD(pts));
		pts.slice(1).forEach((p, i) => {
			const sz = 3.2 - (i / n) * 1.2;
			ink.leaf(ca, p.x, p.y, p.a - 55, sz, sz * 0.42, 1).leaf(cb, p.x, p.y, p.a + 55, sz, sz * 0.42, 1);
			if (depth > 0 && (i === 1 || i === 3)) one(p.x, p.y, p.a + (i === 1 ? -40 : 40) * Math.sign(bend || 1), len * 0.5, bend, depth - 1, ink);
		});
		return ink;
	};
	const ink = new Ink();
	const sprays = (list: [number, number, number, number][]) => {
		for (const [deg, len, bend, depth] of list) one(40, 86, deg, len, bend, depth, ink);
		return ink.svg();
	};
	if (stage === "sprout") return sprays([[-130, 14, 30, 0], [-50, 14, -30, 0]]);
	if (stage === "leafy") return sprays([[-165, 26, 25, 1], [-15, 26, -25, 1], [-120, 28, 20, 1], [-60, 28, -20, 1]]);
	return sprays([[-172, 34, 30, 1], [-8, 34, -30, 1], [-138, 38, 25, 1], [-42, 38, -25, 1], [-106, 40, 15, 1], [-76, 40, -15, 1]]);
}

/* ───────────── Water plants ───────────── */

/** A floating pad in perspective, notched toward the viewer-right. */
function pad(cx: number, cy: number, rx: number, ry: number, fill: string, notch = 20): string {
	const a1 = (90 - notch / 2) * RAD;
	const a2 = (90 + notch / 2) * RAD;
	const p1: [number, number] = [cx + Math.cos(a1) * rx, cy + Math.sin(a1) * ry];
	const p2: [number, number] = [cx + Math.cos(a2) * rx, cy + Math.sin(a2) * ry];
	return `<path d="M${f(cx)} ${f(cy)}L${f(p1[0])} ${f(p1[1])}A${f(rx)} ${f(ry)} 0 1 0 ${f(p2[0])} ${f(p2[1])}Z" fill="${fill}"/>`;
}

function waterLily(stage: GrowingStage): string {
	const pd = "#4f9448";
	const pl = "#69ac58";
	const petal = (deg: number, len: number, fill: string) => leaf(40, 80, deg, len, len * 0.32, { fill, shape: 1, rib: false });
	if (stage === "sprout") return pond(15) + pad(36, 85, 9, 2.6, pl) + `<path d="M46 86C46 80 49 76 52 74C50 78 50 82 48 86Z" fill="${pd}"/>`;
	if (stage === "leafy") return pond(21) + pad(28, 85.5, 10, 2.8, pd) + pad(50, 85, 11, 3, pl) + pad(40, 87.2, 8, 2, pd) + line(40, 85, 40, 66, "#5d9a50", 1.4) + `<ellipse cx="40" cy="63" rx="3" ry="5" fill="#e98fb2"/><path d="M38 66Q40 60 42 66Z" fill="${pd}"/>`;
	let s = pond(22) + pad(22, 85.5, 11, 3, pd) + pad(58, 85.5, 12, 3.2, pl) + pad(40, 87.4, 14, 2.6, pd, 30);
	for (let i = 0; i < 9; i++) s += petal(-180 + i * 22.5, 20, "#ec9ab9");
	for (let i = 0; i < 7; i++) s += petal(-162 + i * 24, 15, "#f5c2d6");
	for (let i = 0; i < 5; i++) s += petal(-140 + i * 25, 10, "#fbdce7");
	return s + `<ellipse cx="40" cy="79" rx="4" ry="2" fill="#f2c13d"/>` + leaf(40, 81, 180, 9, 2, { fill: pl, shape: 1, rib: false }) + leaf(40, 81, 0, 9, 2, { fill: pl, shape: 1, rib: false });
}

function lotus(stage: GrowingStage): string {
	const lf = "#5aa67a";
	const lfd = "#468a64";
	const st = "#6a9a5a";
	const shield = (x: number, y: number, rx: number, tilt: number) =>
		g(x, y, tilt, `<ellipse cx="0" cy="0" rx="${f(rx)}" ry="${f(rx * 0.32)}" fill="${lf}"/><path d="M${f(-rx * 0.9)} ${f(-rx * 0.05)}Q0 ${f(-rx * 0.45)} ${f(rx * 0.9)} ${f(-rx * 0.05)}Q0 ${f(rx * 0.12)} ${f(-rx * 0.9)} ${f(-rx * 0.05)}Z" fill="${lfd}"/>${circle(0, -rx * 0.12, 1, "#9cc98a")}`);
	const flower = (x: number, y: number, s: number) => {
		let r = "";
		for (const [a, l, c] of [
			[-160, 12, "#e68aa9"],
			[-20, 12, "#e68aa9"],
			[-130, 14, "#f0a7c0"],
			[-50, 14, "#f0a7c0"],
			[-105, 15, "#f6c1d3"],
			[-75, 15, "#f6c1d3"],
		] as const)
			r += leaf(x, y, a, l * s, l * s * 0.42, { fill: c, shape: 1, rib: false });
		return r + `<ellipse cx="${f(x)}" cy="${f(y - 2 * s)}" rx="${f(3 * s)}" ry="${f(1.6 * s)}" fill="#f0c84a"/>`;
	};
	const pod = (x: number, y: number) =>
		`<path d="M${f(x - 5)} ${f(y - 3)}L${f(x + 5)} ${f(y - 3)}L${f(x + 1.5)} ${f(y + 4)}L${f(x - 1.5)} ${f(y + 4)}Z" fill="#a9c36a"/><ellipse cx="${f(x)}" cy="${f(y - 3)}" rx="5" ry="1.5" fill="#c2d684"/>` +
		[-2.8, 0, 2.8].map((d) => circle(x + d, y - 3, 0.8, "#6c7d3a")).join("");
	if (stage === "sprout") return pond(15) + stem([[40, 86], [40, 78], [42, 74], [44, 70]], st, 1.3) + shield(44, 69, 8, -8);
	if (stage === "leafy") return pond(21) + stem([[34, 86], [33, 70], [28, 60], [26, 55]], st, 1.4) + stem([[46, 86], [47, 66], [52, 52], [53, 46]], st, 1.4) + shield(26, 54, 12, -10) + shield(53, 45, 13, 8) + stem([[40, 86], [40, 74], [40, 66], [40, 62]], st, 1.3) + `<ellipse cx="40" cy="58" rx="3.6" ry="5.5" fill="#ee9ab8"/>`;
	return (
		pond(23) +
		stem([[30, 86], [29, 68], [22, 58], [19, 54]], st, 1.5) +
		stem([[50, 86], [51, 70], [58, 62], [61, 58]], st, 1.5) +
		stem([[44, 86], [45, 64], [52, 50], [56, 42]], st, 1.4) +
		stem([[38, 86], [37, 60], [39, 40], [38, 30]], st, 1.6) +
		shield(19, 53, 14, -12) +
		shield(61, 57, 13, 10) +
		pod(56, 40) +
		flower(38, 30, 1.25)
	);
}

function waterHyacinth(stage: GrowingStage): string {
	const lf = "#4ea14b";
	const lf2 = "#63b45a";
	const bulb = "#97cc6c";
	const leafOn = (x: number, deg: number, len: number, sc: number, fill: string) => {
		const ex = x + Math.cos(deg * RAD) * len;
		const ey = 86 + Math.sin(deg * RAD) * len;
		return `<ellipse cx="${f(x + (ex - x) * 0.55)}" cy="${f(86 + (ey - 86) * 0.55)}" rx="${f(len * 0.5)}" ry="${f(2.4 * sc)}" fill="${bulb}" transform="rotate(${f(deg)} ${f(x + (ex - x) * 0.55)} ${f(86 + (ey - 86) * 0.55)})"/>` + leaf(ex, ey, deg, 12 * sc, 6 * sc, { fill, shape: 2 });
	};
	const flower = (x: number, y: number) => petals(x, y, 6, 2.2, 2.4, 1.5, "#b6a3ea") + circle(x, y - 1.2, 1, "#f3d34a") + circle(x, y, 0.8, "#7a62c8");
	if (stage === "sprout") return pond(15) + leafOn(37, -115, 8, 0.6, lf2) + leafOn(43, -65, 8, 0.6, lf);
	if (stage === "leafy") return pond(21) + leafOn(34, -150, 10, 0.85, lf) + leafOn(46, -30, 10, 0.85, lf) + leafOn(37, -110, 14, 0.95, lf2) + leafOn(43, -70, 14, 0.95, lf2);
	let s = pond(23) + leafOn(32, -160, 12, 1, lf) + leafOn(48, -20, 12, 1, lf) + leafOn(35, -125, 16, 1.05, lf2) + leafOn(45, -55, 16, 1.05, lf2);
	s += line(40, 86, 40, 30, "#5f9a50", 1.8);
	(
		[
		[40, 26],
		[35, 32],
		[45, 32],
		[36, 39],
		[44, 39],
		[38, 46],
		[43, 47],
	] as const
	).forEach(([x, y]) => (s += flower(x, y)));
	return s + leafOn(40, -92, 14, 1, lf);
}

/** An arrowhead leaf, attached at (x, y), tip pointing deg. */
function arrowLeaf(x: number, y: number, deg: number, L: number, fill: string): string {
	const d = `M${f(L)} 0C${f(L * 0.65)} ${f(-L * 0.4)} ${f(L * 0.1)} ${f(-L * 0.45)} ${f(-L * 0.72)} ${f(-L * 0.5)}L${f(-L * 0.08)} 0L${f(-L * 0.72)} ${f(L * 0.5)}C${f(L * 0.1)} ${f(L * 0.45)} ${f(L * 0.65)} ${f(L * 0.4)} ${f(L)} 0Z`;
	return g(x, y, deg, `<path d="${d}" fill="${fill}"/><path d="M0 0L${f(L * 0.85)} 0M0 0L${f(-L * 0.55)} ${f(-L * 0.38)}M0 0L${f(-L * 0.55)} ${f(L * 0.38)}" stroke="#2f6a32" stroke-width=".7" opacity=".55"/>`);
}

function arrowhead(stage: GrowingStage): string {
	const st = "#5c9a4c";
	const lf = "#5fae52";
	const lf2 = "#74bf5f";
	const leafOn = (P: [Pt, Pt, Pt, Pt], deg: number, L: number, fill: string) => stem(P, st, 1.3) + arrowLeaf(P[3][0], P[3][1], deg, L, fill);
	const flower = (x: number, y: number) => petals(x, y + 0.5, 3, 2.5, 2.5, 2.1, "#cfc8b4", -90) + petals(x, y, 3, 2.4, 2.4, 2, "#f6f3ea", -90) + circle(x, y, 1.3, "#e2b93a");
	if (stage === "sprout") return pond(15) + leafOn([[40, 86], [40, 80], [41, 74], [42, 70]], -95, 10, lf2);
	if (stage === "leafy")
		return pond(21) + leafOn([[36, 86], [35, 72], [28, 62], [24, 56]], -120, 15, lf) + leafOn([[44, 86], [45, 70], [52, 58], [55, 52]], -60, 15, lf2) + leafOn([[40, 86], [40, 70], [40, 60], [40, 50]], -90, 14, lf);
	let s =
		pond(23) +
		leafOn([[34, 86], [32, 70], [22, 58], [17, 52]], -130, 17, lf) +
		leafOn([[46, 86], [48, 70], [58, 56], [62, 50]], -50, 17, lf2) +
		leafOn([[38, 86], [37, 66], [32, 50], [30, 42]], -100, 16, lf2) +
		leafOn([[42, 86], [44, 72], [50, 64], [53, 66]], -20, 12, lf);
	s += stem([[41, 86], [42, 60], [46, 34], [47, 18]], st, 1.4);
	for (const [y, w] of [
		[42, 6],
		[32, 5],
		[23, 4],
	] as const) {
		const x = 44 + (42 - y) * 0.13;
		s += line(x, y, x - w, y + 3, st, 0.8) + line(x, y, x + w, y + 3, st, 0.8) + flower(x - w, y + 3) + flower(x + w, y + 3);
	}
	return s + `<ellipse cx="47" cy="17" rx="1.5" ry="2.4" fill="#cfe3b0"/>`;
}

function pickerelweed(stage: GrowingStage): string {
	const st = "#4c8a45";
	const lf = "#3f8f4f";
	const lf2 = "#55a463";
	const leafOn = (x: number, tx: number, ty: number, deg: number, L: number, fill: string) =>
		stem([[x, 86], [x, 86 - (86 - ty) * 0.5], [tx, ty + 6], [tx, ty]], st, 1.4) + leaf(tx, ty, deg, L, L * 0.33, { fill, shape: 4, dark: "#2a6038" });
	const spike = (x: number, top: number, h: number) => {
		let s = line(x, top + h + 6, x, top, st, 1.6);
		for (let i = 0; i < 7; i++) {
			const y = top + (i * h) / 6;
			const r = 2.6 - Math.abs(i - 3) * 0.25;
			s += circle(x - 1.9, y + 0.6, r, i % 2 ? "#6a6fd8" : "#7d85e6") + circle(x + 1.9, y, r, i % 2 ? "#7d85e6" : "#6a6fd8");
		}
		return s + circle(x, top - 1.5, 1.7, "#8f97ec");
	};
	if (stage === "sprout") return pond(15) + leafOn(40, 41, 72, -88, 12, lf2);
	if (stage === "leafy") return pond(21) + leafOn(36, 30, 64, -105, 20, lf) + leafOn(44, 50, 62, -72, 20, lf2) + leafOn(40, 40, 58, -90, 18, lf);
	return pond(23) + leafOn(34, 22, 62, -120, 22, lf2) + leafOn(46, 58, 60, -60, 22, lf) + leafOn(38, 32, 50, -100, 24, lf) + leafOn(43, 50, 46, -78, 24, lf2) + spike(40, 18, 22);
}

function marshMarigold(stage: GrowingStage): string {
	const st = "#4a8a3a";
	const lf = "#4f9a3e";
	const lf2 = "#63ad4c";
	const kidney = (x: number, y: number, r: number, fill: string) =>
		`<path d="M${f(x)} ${f(y + r * 0.2)}C${f(x - r * 0.5)} ${f(y + r * 0.9)} ${f(x - r * 1.3)} ${f(y + r * 0.3)} ${f(x - r * 1.1)} ${f(y - r * 0.4)}C${f(x - r * 0.9)} ${f(y - r * 1.1)} ${f(x + r * 0.9)} ${f(y - r * 1.1)} ${f(x + r * 1.1)} ${f(y - r * 0.4)}C${f(x + r * 1.3)} ${f(y + r * 0.3)} ${f(x + r * 0.5)} ${f(y + r * 0.9)} ${f(x)} ${f(y + r * 0.2)}Z" fill="${fill}"/><path d="M${f(x)} ${f(y + r * 0.2)}L${f(x)} ${f(y - r * 0.7)}M${f(x)} ${f(y + r * 0.1)}L${f(x - r * 0.7)} ${f(y - r * 0.5)}M${f(x)} ${f(y + r * 0.1)}L${f(x + r * 0.7)} ${f(y - r * 0.5)}" stroke="#2f6a2c" stroke-width=".7" opacity=".5"/>`;
	const leafOn = (tx: number, ty: number, r: number, fill: string) => stem([[40, 86], [40, 80], [tx, ty + 6], [tx, ty + r * 0.2]], st, 1.3) + kidney(tx, ty, r, fill);
	const flower = (x: number, y: number, r: number) => petals(x, y, 5, r * 0.55, r * 0.55, r * 0.5, "#f6c722", -90) + circle(x, y, r * 0.3, "#e09a12");
	if (stage === "sprout") return leafOn(35, 74, 5, lf2) + leafOn(46, 76, 4.5, lf);
	if (stage === "leafy") return leafOn(26, 70, 7, lf) + leafOn(54, 70, 7, lf) + leafOn(34, 60, 8, lf2) + leafOn(48, 58, 8, lf2) + leafOn(40, 76, 6, lf);
	let s = leafOn(20, 72, 8, lf) + leafOn(60, 72, 8, lf) + leafOn(28, 58, 9, lf2) + leafOn(52, 58, 9, lf2) + leafOn(40, 70, 8, lf);
	s += stem([[40, 86], [38, 60], [30, 44], [26, 38]], st, 1.3) + stem([[40, 86], [42, 58], [50, 40], [54, 34]], st, 1.3) + stem([[40, 86], [40, 56], [40, 36], [40, 26]], st, 1.3);
	return s + flower(26, 38, 8) + flower(54, 34, 8) + flower(40, 25, 9);
}

function waterLettuce(stage: GrowingStage): string {
	const back = "#86b878";
	const front = ["#a6d394", "#b9dfa8"] as const;
	const rib = "#6c9e5c";
	const spat = (deg: number, L: number, W: number, fill: string) => {
		const d = `M0 0C${f(L * 0.3)} ${f(-W * 0.35)} ${f(L * 0.62)} ${f(-W)} ${f(L * 0.92)} ${f(-W * 0.85)}C${f(L * 1.04)} ${f(-W * 0.6)} ${f(L * 0.98)} ${f(-W * 0.2)} ${f(L * 1.04)} 0C${f(L * 0.98)} ${f(W * 0.2)} ${f(L * 1.04)} ${f(W * 0.6)} ${f(L * 0.92)} ${f(W * 0.85)}C${f(L * 0.62)} ${f(W)} ${f(L * 0.3)} ${f(W * 0.35)} 0 0Z`;
		let ribs = "";
		for (const k of [-0.6, -0.3, 0, 0.3, 0.6]) ribs += `M1 0Q${f(L * 0.5)} ${f(W * k * 0.6)} ${f(L * 0.92)} ${f(W * k * 1.15)}`;
		const bx = 40 + Math.cos(deg * RAD) * 3;
		return g(bx, 85.5, deg, `<path d="${d}" fill="${fill}"/><path d="${ribs}" stroke="${rib}" stroke-width=".6" fill="none" opacity=".7"/>`);
	};
	const ring = (sc: number, n: number) => {
		let s = "";
		const angs = n === 3 ? [-140, -40, -90] : [-176, -4, -150, -30, -122, -58, -100, -80];
		angs.forEach((a, i) => {
			const side = Math.abs(a + 90) / 90;
			s += spat(a, (24 - side * 9) * sc, (9 - side * 2) * sc, i < angs.length - 2 ? back : front[0]);
		});
		return s;
	};
	if (stage === "sprout") return pond(15) + ring(0.5, 3) + spat(-90, 9, 4, front[1]);
	if (stage === "leafy") return pond(21) + ring(0.8, 8) + spat(-110, 15, 6, front[1]) + spat(-70, 15, 6, front[0]);
	return pond(25) + ring(1.15, 8) + spat(-125, 22, 8, front[1]) + spat(-55, 22, 8, front[1]) + spat(-90, 20, 7.5, front[0]);
}

/* ───────────── Carnivorous plants ───────────── */

/** An open flytrap, hinged at (x, y), pointing deg. */
function trap(x: number, y: number, deg: number, L: number, W: number): string {
	let teeth = "";
	for (let i = 1; i < 10; i++) {
		const t = Math.PI * (i / 10);
		for (const side of [-1, 1]) {
			const ex = (L / 2) * (1 - Math.cos(t));
			const ey = side * (W / 2) * Math.sin(t);
			const ox = ex + -Math.cos(t) * 0 + (Math.cos(t) * 0 + 0);
			teeth += `M${f(ox)} ${f(ey)}L${f(ox + (ex - L / 2) * 0.25)} ${f(ey + side * 2.2)}`;
		}
	}
	return g(
		x,
		y,
		deg,
		`<path d="${teeth}" stroke="#a9d36d" stroke-width=".6" stroke-linecap="round"/><ellipse cx="${f(L / 2)}" cy="0" rx="${f(L / 2)}" ry="${f(W / 2)}" fill="#8cc35a"/><ellipse cx="${f(L / 2)}" cy="0" rx="${f(L / 2 - 1)}" ry="${f(W / 2 - 1.2)}" fill="#d4473b"/><path d="M1 0L${f(L - 1)} 0" stroke="#9b2c28" stroke-width=".8"/>`,
	);
}

function venusFlytrap(stage: GrowingStage): string {
	const pet = "#79b84e";
	const arm = (deg: number, pl: number, L: number, W: number) => {
		const ex = 40 + Math.cos(deg * RAD) * pl;
		const ey = 85 + Math.sin(deg * RAD) * pl;
		return leaf(40, 85, deg, pl + 1, Math.max(1.6, pl * 0.18), { fill: pet, shape: 1, rib: false }) + trap(ex, ey, deg, L, W);
	};
	if (stage === "sprout") return arm(-140, 6, 7, 6) + arm(-40, 6, 7, 6) + arm(-90, 5, 6, 5);
	if (stage === "leafy") return arm(-168, 9, 11, 9) + arm(-12, 9, 11, 9) + arm(-128, 12, 13, 10) + arm(-52, 12, 13, 10) + arm(-90, 13, 13, 10);
	let s = line(42, 86, 42, 22, "#7aa356", 1.4);
	for (const [dx, y] of [
		[0, 18],
		[-4, 22],
		[4, 21],
	] as const)
		s += petals(42 + dx, y + 0.5, 5, 2.4, 2.3, 1.7, "#cfc8b4") + petals(42 + dx, y, 5, 2.3, 2.2, 1.6, "#f6f3ea") + circle(42 + dx, y, 0.9, "#9cc86a");
	return s + arm(-175, 11, 14, 11) + arm(-5, 11, 14, 11) + arm(-140, 14, 16, 12) + arm(-40, 14, 16, 12) + arm(-108, 16, 15, 11) + arm(-72, 16, 15, 11);
}

/** A trumpet pitcher from (x, 87) to its mouth at (x + lean, top), w wide. */
function trumpet(x: number, top: number, w: number, lean: number, red: number): string {
	const mx = x + lean;
	const h = 87 - top;
	const body = `<path d="M${f(x - 1.3)} 87C${f(x - 1.5)} ${f(87 - h * 0.5)} ${f(mx - w * 0.4)} ${f(top + h * 0.3)} ${f(mx - w / 2)} ${f(top)}L${f(mx + w / 2)} ${f(top + 1)}C${f(mx + w * 0.3)} ${f(top + h * 0.35)} ${f(x + 1.8)} ${f(87 - h * 0.45)} ${f(x + 1.3)} 87Z" fill="#b8cc56"/>`;
	let veins = "";
	for (let k = 0; k < 4; k++) {
		const t = 0.1 + k * 0.08;
		veins += `M${f(mx - w / 2 + (w * k) / 3.5 + 0.6)} ${f(top + 0.6)}L${f(mx - w * 0.2 + k * 0.6)} ${f(top + h * t * red + 4)}`;
	}
	const mouth = `<ellipse cx="${f(mx)}" cy="${f(top + 0.5)}" rx="${f(w / 2)}" ry="${f(w * 0.2)}" fill="#7a2a2a"/>`;
	const lid = `<path d="M${f(mx - w / 2)} ${f(top)}C${f(mx - w / 2 - 1)} ${f(top - w * 0.9)} ${f(mx + w * 0.7)} ${f(top - w * 1.1)} ${f(mx + w * 0.55)} ${f(top - w * 0.1)}Z" fill="#c4473a"/>`;
	return body + `<path d="${veins}" stroke="#b8392f" stroke-width=".8" stroke-linecap="round"/>` + mouth + lid;
}

function pitcherPlant(stage: GrowingStage): string {
	if (stage === "sprout") return trumpet(38, 70, 4.5, -1, 1) + trumpet(43, 74, 4, 1.5, 1);
	if (stage === "leafy") return trumpet(32, 52, 6.5, -5, 1) + trumpet(46, 46, 7, 5, 1) + trumpet(39, 40, 7.5, 0, 1);
	let s = stem([[50, 86], [52, 60], [62, 44], [62, 40]], "#7aa356", 1.3);
	s += `<path d="M58 40C56 46 60 52 63 52C67 52 68 46 66 40Z" fill="#b83a3c"/><path d="M58 40Q62 36 66 40Z" fill="#9a2d33"/>` + leaf(62, 52, 120, 5, 1.6, { fill: "#c9505a", shape: 1, rib: false }) + leaf(62, 52, 60, 5, 1.6, { fill: "#c9505a", shape: 1, rib: false });
	return s + trumpet(26, 40, 7, -9, 1) + trumpet(50, 28, 8, 4, 1) + trumpet(33, 22, 8.5, -3, 1) + trumpet(42, 14, 9, 1, 1) + trumpet(57, 48, 6.5, 9, 1);
}

function sundew(stage: GrowingStage): string {
	const pet = "#8cba5a";
	const pad = "#9cc45e";
	const leafOn = (deg: number, pl: number, r: number) => {
		const ex = 40 + Math.cos(deg * RAD) * pl;
		const ey = 85 + Math.sin(deg * RAD) * pl;
		let s = line(40, 85, ex, ey, pet, 1.1) + circle(ex, ey, r, pad);
		let hairs = "";
		let dew = "";
		const n = Math.round(r * 3.4);
		for (let i = 0; i < n; i++) {
			const a = deg - 130 + (260 * i) / (n - 1);
			const x1 = ex + Math.cos(a * RAD) * r * 0.5;
			const y1 = ey + Math.sin(a * RAD) * r * 0.5;
			const x2 = ex + Math.cos(a * RAD) * (r + 2.4);
			const y2 = ey + Math.sin(a * RAD) * (r + 2.4);
			hairs += `M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}`;
			dew += `M${f(x2)} ${f(y2)}h0`;
		}
		s += `<path d="${hairs}" stroke="#cf3f38" stroke-width=".7"/><path d="${dew}" stroke="#f6e7a6" stroke-width="1.5" stroke-linecap="round"/>`;
		return s + circle(ex, ey, r * 0.55, "#c9483c");
	};
	if (stage === "sprout") return leafOn(-130, 7, 2.2) + leafOn(-50, 7, 2.2) + leafOn(-92, 8, 2);
	if (stage === "leafy") return leafOn(-170, 12, 3.2) + leafOn(-10, 12, 3.2) + leafOn(-135, 15, 3.4) + leafOn(-45, 15, 3.4) + leafOn(-100, 17, 3.4) + leafOn(-75, 16, 3.2);
	let s = `<path d="M42 85C42 60 44 36 48 24C50 18 54 17 55 20" stroke="#7d9e4e" stroke-width="1.3" fill="none" stroke-linecap="round"/>`;
	for (const [x, y] of [
		[44.5, 40],
		[46, 31],
		[48.6, 23],
	] as const)
		s += petals(x, y, 5, 2, 2, 1.5, "#f2a8c5") + circle(x, y, 0.8, "#fbe9a0");
	s += `<ellipse cx="55" cy="21" rx="1.4" ry="1.9" fill="#d98aa8"/>`;
	return s + leafOn(-176, 17, 3.8) + leafOn(-4, 17, 3.8) + leafOn(-145, 21, 4) + leafOn(-35, 21, 4) + leafOn(-115, 23, 4) + leafOn(-65, 23, 4) + leafOn(-90, 16, 3.4);
}

/** A cobra lily pitcher from (x, 87) rising to h, hood facing dir (±1). */
function cobra(x: number, h: number, dir: number, w: number): string {
	const top = 87 - h;
	const body = "#b0be5e";
	const hx = x - dir * w * 0.3;
	const tube = `<path d="M${f(x - 1.2)} 87C${f(x - 1.6)} ${f(87 - h * 0.5)} ${f(hx - w * 0.45)} ${f(top + h * 0.25)} ${f(hx - w * 0.5)} ${f(top)}L${f(hx + w * 0.5)} ${f(top)}C${f(hx + w * 0.35)} ${f(top + h * 0.3)} ${f(x + 1.8)} ${f(87 - h * 0.5)} ${f(x + 1.2)} 87Z" fill="${body}"/>`;
	const hood = `<path d="M${f(-w * 0.5)} 0C${f(-w * 0.65)} ${f(-w * 1.1)} ${f(w * 0.2)} ${f(-w * 1.5)} ${f(w * 1.05)} ${f(-w * 1.15)}C${f(w * 1.75)} ${f(-w * 0.85)} ${f(w * 1.8)} ${f(w * 0.05)} ${f(w * 1.3)} ${f(w * 0.3)}C${f(w * 0.9)} ${f(w * 0.45)} ${f(w * 0.55)} ${f(w * 0.25)} ${f(w * 0.5)} 0Z" fill="${body}"/><path d="M${f(-w * 0.35)} ${f(-w * 0.55)}C${f(-w * 0.3)} ${f(-w * 1.1)} ${f(w * 0.5)} ${f(-w * 1.3)} ${f(w * 1.1)} ${f(-w * 0.95)}C${f(w * 0.6)} ${f(-w * 0.75)} ${f(w * 0.1)} ${f(-w * 0.6)} ${f(-w * 0.35)} ${f(-w * 0.55)}Z" fill="#d2d58e"/>`;
	const spots = (
		[
			[0.05, -0.85],
			[0.45, -0.95],
			[0.85, -0.85],
			[0.25, -0.7],
		] as const
	)
		.map(([dx, dy]) => circle(dx * w, dy * w, w * 0.09, "#f3f1d2"))
		.join("");
	const mouth = `<ellipse cx="${f(w * 1.05)}" cy="${f(w * 0.22)}" rx="${f(w * 0.32)}" ry="${f(w * 0.13)}" fill="#7a3a26" transform="rotate(-15 ${f(w * 1.05)} ${f(w * 0.22)})"/>`;
	const tongue = `<path d="M${f(w * 1.0)} ${f(w * 0.28)}L${f(w * 1.3)} ${f(w * 0.24)}L${f(w * 1.42)} ${f(w * 0.95)}L${f(w * 1.22)} ${f(w * 0.7)}L${f(w * 1.06)} ${f(w * 0.98)}L${f(w * 1.02)} ${f(w * 0.4)}Z" fill="#c4472f"/>`;
	return tube + `<g transform="translate(${f(hx)} ${f(top)}) scale(${dir} 1)">${hood}${spots}${mouth}${tongue}</g>`;
}

function cobraLily(stage: GrowingStage): string {
	if (stage === "sprout") return cobra(39, 15, 1, 5);
	if (stage === "leafy") return cobra(33, 28, -1, 7) + cobra(46, 38, 1, 8);
	return cobra(25, 40, -1, 8) + cobra(55, 46, 1, 8.5) + cobra(37, 58, -1, 10) + cobra(47, 30, 1, 7);
}


export const SPECIES: Species[] = [
	{ id: "boston-fern", name: "Boston fern", draw: bostonFern },
	{ id: "maidenhair-fern", name: "Maidenhair fern", draw: maidenhair },
	{ id: "birds-nest-fern", name: "Bird's nest fern", draw: birdsNest },
	{ id: "staghorn-fern", name: "Staghorn fern", draw: staghorn },
	{ id: "tree-fern", name: "Tree fern", draw: treeFern },
	{ id: "ostrich-fern", name: "Ostrich fern", draw: ostrichFern },
	{ id: "sword-fern", name: "Sword fern", draw: swordFern },
	{ id: "asparagus-fern", name: "Asparagus fern", draw: asparagusFern },
	{ id: "holly-fern", name: "Holly fern", draw: hollyFern },
	{ id: "royal-fern", name: "Royal fern", draw: royalFern },
	{ id: "cushion-moss", name: "Cushion moss", draw: cushionMoss },
	{ id: "haircap-moss", name: "Haircap moss", draw: haircapMoss },
	{ id: "club-moss", name: "Club moss", draw: clubMoss },
	{ id: "spikemoss", name: "Spikemoss", draw: spikemoss },
	{ id: "water-lily", name: "Water lily", draw: waterLily },
	{ id: "lotus", name: "Lotus", draw: lotus },
	{ id: "water-hyacinth", name: "Water hyacinth", draw: waterHyacinth },
	{ id: "arrowhead", name: "Arrowhead", draw: arrowhead },
	{ id: "pickerelweed", name: "Pickerelweed", draw: pickerelweed },
	{ id: "marsh-marigold", name: "Marsh marigold", draw: marshMarigold },
	{ id: "venus-flytrap", name: "Venus flytrap", draw: venusFlytrap },
	{ id: "pitcher-plant", name: "Pitcher plant", draw: pitcherPlant },
	{ id: "sundew", name: "Sundew", draw: sundew },
	{ id: "water-lettuce", name: "Water lettuce", draw: waterLettuce },
	{ id: "cobra-lily", name: "Cobra lily", draw: cobraLily },
];
