/**
 * Foliage houseplants: 25 species in the garden's flat style (see kit.ts).
 */
import { CUT, GREEN, type GrowingStage, type Pt, type Species, bez, f, leafPath } from "./kit";

type St = GrowingStage;
type Shape = 0 | 1 | 2 | 3 | 4;
type Curve = readonly [Pt, Pt, Pt, Pt];

const pick = <T>(st: St, s: T, l: T, b: T): T => (st === "sprout" ? s : st === "leafy" ? l : b);
const rad = Math.PI / 180;
const g = (x: number, y: number, deg: number, inner: string, flip = false): string =>
	`<g transform="translate(${f(x)} ${f(y)}) rotate(${f(deg)})${flip ? " scale(1 -1)" : ""}">${inner}</g>`;
const P = (d: string, c: string, op?: number): string => `<path d="${d}" fill="${c}"${op === undefined ? "" : ` opacity="${op}"`}/>`;
const S = (d: string, c: string, w: number, op?: number): string =>
	`<path d="${d}" stroke="${c}" stroke-width="${f(w)}" fill="none" stroke-linecap="round" stroke-linejoin="round"${op === undefined ? "" : ` opacity="${op}"`}/>`;
const ell = (cx: number, cy: number, rx: number, ry: number, c: string, rot = 0): string =>
	`<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}" fill="${c}"${rot ? ` transform="rotate(${f(rot)} ${f(cx)} ${f(cy)})"` : ""}/>`;
/** An ellipse as path data (absolute, axis-aligned), so many can share one path. */
const eD = (cx: number, cy: number, rx: number, ry = rx): string =>
	`M${f(cx - rx)} ${f(cy)}a${f(rx)} ${f(ry)} 0 1 0 ${f(2 * rx)} 0a${f(rx)} ${f(ry)} 0 1 0 ${f(-2 * rx)} 0Z`;
const cD = (p: Curve): string => `M${f(p[0][0])} ${f(p[0][1])}C${f(p[1][0])} ${f(p[1][1])} ${f(p[2][0])} ${f(p[2][1])} ${f(p[3][0])} ${f(p[3][1])}`;
const lD = (x1: number, y1: number, x2: number, y2: number): string => `M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}`;
const qD = (x0: number, y0: number, cx: number, cy: number, x1: number, y1: number): string => `M${f(x0)} ${f(y0)}Q${f(cx)} ${f(cy)} ${f(x1)} ${f(y1)}`;
const polar = (x: number, y: number, deg: number, r: number): [number, number] => [x + Math.cos(deg * rad) * r, y + Math.sin(deg * rad) * r];
/** Moves local path data (pairs only: M L Q C Z) to (x, y), rotated by deg and scaled. */
const T = (d: string, x: number, y: number, deg: number, s = 1, flip = false): string => {
	const c = Math.cos(deg * rad);
	const sn = Math.sin(deg * rad);
	return d.replace(/(-?[\d.]+) (-?[\d.]+)/g, (_m, a: string, b: string) => {
		const u = +a * s;
		const v = (flip ? -b : +b) * s;
		return `${f(x + u * c - v * sn)} ${f(y + u * sn + v * c)}`;
	});
};
/** Local (u, v) on a leaf at (x, y) pointing deg, to absolute. */
const at = (x: number, y: number, deg: number, u: number, v: number, flip = false): [number, number] => {
	const vv = flip ? -v : v;
	const c = Math.cos(deg * rad);
	const sn = Math.sin(deg * rad);
	return [x + u * c - vv * sn, y + u * sn + vv * c];
};
const tangent = (p: Curve, t: number): number => {
	const a = bez(p, Math.max(0, t - 0.01));
	const b = bez(p, Math.min(1, t + 0.01));
	return Math.atan2(b[1] - a[1], b[0] - a[0]) / rad;
};
/** Collects path data by paint and emits one path per paint, in first-use order. */
class Pen {
	private m = new Map<string, string>();
	/** `layer` keeps mirrored shapes in a path of their own: opposite windings would cancel where they overlap. */
	fill(c: string, d: string, layer = ""): this {
		const k = `F${c}|${layer}`;
		this.m.set(k, (this.m.get(k) ?? "") + d);
		return this;
	}
	line(c: string, w: number, d: string): this {
		const k = `S${c}|${w}`;
		this.m.set(k, (this.m.get(k) ?? "") + d);
		return this;
	}
	/** A round dot of radius r: a zero-length stroke with round caps. */
	dot(c: string, r: number, x: number, y: number): this {
		return this.line(c, +f(r * 2), `M${f(x)} ${f(y)}h0`);
	}
	/** A capsule from a to b, w wide. */
	pill(c: string, w: number, a: readonly [number, number], b: readonly [number, number]): this {
		return this.line(c, +f(w), lD(a[0], a[1], b[0], b[1]));
	}
	out(): string {
		let s = "";
		for (const [k, d] of this.m) {
			if (k[0] === "F") s += P(d, k.slice(1).split("|")[0] ?? "#000");
			else {
				const [c, w] = k.slice(1).split("|");
				s += S(d, c ?? "#000", +(w ?? 1));
			}
		}
		return s;
	}
}
const lp = (L: number, w: number, shape: Shape = 0): string => leafPath(L, w, shape);

/** Arrowhead (sagittate) leaf along +x, petiole at the origin. */
const arrowD = (L: number, w: number): string =>
	`M0 0L${f(-L * 0.28)} ${f(-w * 0.85)}C${f(L * 0.12)} ${f(-w * 1.2)} ${f(L * 0.55)} ${f(-w * 0.75)} ${f(L)} 0C${f(L * 0.55)} ${f(w * 0.75)} ${f(L * 0.12)} ${f(w * 1.2)} ${f(-L * 0.28)} ${f(w * 0.85)}Z`;
/** Lopsided wing (begonia) along +x: the big lobe on -y. */
const wingD = (L: number, w: number): string =>
	`M0 0C${f(-L * 0.22)} ${f(-w * 0.7)} ${f(L * 0.08)} ${f(-w * 1.25)} ${f(L * 0.42)} ${f(-w)}C${f(L * 0.78)} ${f(-w * 0.72)} ${f(L * 0.95)} ${f(-w * 0.2)} ${f(L)} 0C${f(L * 0.78)} ${f(w * 0.3)} ${f(L * 0.4)} ${f(w * 0.55)} 0 0Z`;
/** Lopsided heart (rex begonia). */
const rexD = (L: number, w: number): string =>
	`M0 0C${f(-L * 0.32)} ${f(-w * 0.7)} ${f(-L * 0.15)} ${f(-w * 1.3)} ${f(L * 0.3)} ${f(-w * 1.1)}C${f(L * 0.66)} ${f(-w * 0.98)} ${f(L * 0.9)} ${f(-w * 0.45)} ${f(L)} 0C${f(L * 0.85)} ${f(w * 0.42)} ${f(L * 0.6)} ${f(w * 0.85)} ${f(L * 0.3)} ${f(w * 0.85)}C${f(L * 0.02)} ${f(w * 0.85)} ${f(-L * 0.14)} ${f(w * 0.4)} 0 0Z`;
/** Toothed oval: a polygon with n teeth per side. */
const toothD = (L: number, w: number, n: number): string => {
	let top = "";
	let bot = "";
	const N = n * 2;
	for (let i = 1; i < N; i++) {
		const u = i / N;
		const h = w * Math.sin(Math.PI * Math.pow(u, 0.8)) * (i % 2 ? 1.08 : 0.92);
		top += `L${f(L * u)} ${f(-h)}`;
		bot = `L${f(L * u)} ${f(h)}` + bot;
	}
	return `M0 0${top}L${f(L)} 0${bot}Z`;
};

/* 1. Chinese evergreen: arching rosette of silver-feathered lances, pink midribs. */
function chineseEvergreen(st: St): string {
	const set: [number, number][] = pick(st,
		[[-128, 12], [-58, 12], [-95, 13]],
		[[-162, 18], [-20, 18], [-132, 21], [-50, 21], [-92, 22]],
		[[-170, 23], [-10, 23], [-148, 26], [-34, 26], [-122, 28], [-62, 28], [-92, 27]]);
	let s = "";
	if (st === "bloom") s += S(qD(42, 86, 43, 70, 47, 58), "#4f7a45", 1.3) + g(47, 60, -72, P(lp(11, 3.2, 1), "#e9e2bd")) + S(lD(47, 60, 50, 52), "#d9c36a", 1.4);
	for (const [a, L] of set) {
		const pa = a * 0.55 - 90 * 0.45;
		const [px, py] = polar(40, 86, pa, L * 0.32);
		s += S(lD(40, 86, px, py), "#55804a", 1.5) +
			g(px, py, a, P(lp(L, L * 0.21, 1), "#35684a") + P(lp(L * 0.8, L * 0.12, 1), "#b4cbb0") + P(lp(L * 0.5, L * 0.05, 1), "#5f8f6a") + S(`M1 0L${f(L * 0.88)} 0`, "#e07f98", 0.9));
	}
	if (st === "bloom") s += P(eD(53, 72, 1.6) + eD(56, 70, 1.6) + eD(55, 73.5, 1.6) + eD(58, 72.5, 1.5) + eD(54.5, 69, 1.5), "#d8402f");
	return s;
}

/* 2. Watermelon peperomia: red petioles, rounded silver leaves striped dark green, rat-tail spikes. */
function watermelonPeperomia(st: St): string {
	const set: [number, number, number][] = pick(st,
		[[-125, 7, 9], [-55, 7, 9], [-90, 9, 8]],
		[[-160, 10, 12], [-20, 10, 12], [-125, 15, 12], [-55, 15, 12], [-90, 18, 12]],
		[[-168, 12, 13], [-12, 12, 13], [-140, 19, 14], [-40, 19, 14], [-112, 25, 14], [-68, 25, 14], [-90, 16, 13]]);
	let s = "";
	if (st === "bloom") s += S(qD(37, 75, 35, 52, 30, 36), "#cfc68a", 1.9) + S(qD(44, 74, 47, 50, 52, 33), "#cfc68a", 1.9) + S(qD(40, 74, 40, 55, 40, 40), "#cfc68a", 1.7);
	for (const [a, pl, L] of set) {
		const [px, py] = polar(40, 86, a * 0.8 - 18, pl);
		const w = L * 0.4;
		let stripes = "";
		for (const k of [-0.62, -0.22, 0.22, 0.62]) stripes += qD(L * 0.08, 0, L * 0.5, k * w * 2.2, L * 0.95, 0);
		s += S(qD(40, 86, (40 + px) / 2, py + 3, px, py), "#a8343c", 1.3) + g(px, py, a, P(lp(L, w, 2), "#c1d3a8") + S(stripes + `M1 0L${f(L * 0.95)} 0`, "#3b6b35", 1.15));
	}
	return s;
}

/* 3. Nerve plant: a low mat of dark leaves netted with pink veins. */
function nervePlant(st: St): string {
	const rings: [number, number, number][] = pick(st,
		[[3, 3, 9]],
		[[5, 8, 12], [2, 3, 11]],
		[[7, 12, 14], [4, 6, 13], [1, 2, 11]]);
	let s = "";
	if (st === "bloom") {
		const sp = new Pen();
		for (const [x, top] of [[29, 50], [47, 46], [56, 56]] as [number, number][]) {
			sp.line("#4f7a45", 1.1, lD(x, 76, x, top + 5));
			for (let y = top; y < top + 10; y += 2.6) sp.fill("#e8e0b0", T(lp(3.5, 2.2, 1), x, y, -90));
		}
		s += sp.out();
	}
	for (const [n, r, L] of rings) {
		const pen = new Pen();
		const w = L * 0.48;
		for (let i = 0; i < n; i++) {
			const a = n === 1 ? -90 : n === 2 ? -115 + i * 50 : -165 + (150 * i) / (n - 1);
			const [x, y] = polar(40, 86, a, r);
			pen.fill("#2f5f3a", T(lp(L, w, 0), x, y, a));
			let v = `M1 0L${f(L * 0.9)} 0`;
			for (const t of [0.25, 0.5, 0.72]) v += `M${f(L * t)} 0L${f(L * (t + 0.12))} ${f(-w * 0.62)}M${f(L * t)} 0L${f(L * (t + 0.12))} ${f(w * 0.62)}`;
			pen.line("#f08ca8", 0.5, T(v, x, y, a));
		}
		s += pen.out();
	}
	return s;
}

/* 4. Polka dot plant: bushy stems of pink leaves speckled green, lilac flowers. */
function polkaDotPlant(st: St): string {
	const stems: Curve[] = pick(st,
		[[[40, 87], [40, 80], [40, 76], [40, 72]]],
		[[[40, 87], [40, 70], [41, 58], [40, 46]], [[39, 86], [36, 76], [30, 66], [28, 60]], [[41, 86], [44, 76], [50, 68], [53, 62]]],
		[[[40, 87], [40, 64], [41, 46], [40, 30]], [[39, 86], [34, 70], [26, 56], [23, 46]], [[41, 86], [46, 70], [55, 56], [58, 44]], [[40, 86], [37, 74], [33, 66], [32, 58]]]);
	const L = pick(st, 7, 9, 10);
	const sp = new Pen();
	const lv = new Pen();
	const dt = new Pen();
	const fl = new Pen();
	for (const p of stems) {
		sp.line("#7a8a4a", 1.3, cD(p));
		for (const t of [0.35, 0.6, 0.82, 1]) {
			if (st === "sprout" && t < 0.8) continue;
			const [x, y] = bez(p, t);
			const a = tangent(p, t);
			const LL = L * (t === 1 ? 0.7 : 1);
			const w = LL * 0.36;
			for (const aa of [a - 55, a + 55]) {
				lv.fill("#e98aa9", T(lp(LL, w, 1), x, y, aa));
				for (const [u, v] of [[0.3, -0.3], [0.52, 0.35], [0.7, -0.1], [0.24, 0.3], [0.55, -0.45]] as [number, number][]) dt.dot("#3e7a3e", 0.65, ...at(x, y, aa, LL * u, w * v));
			}
		}
		if (st === "bloom") {
			const [x, y] = bez(p, 1);
			fl.fill("#b88ad6", eD(x - 1.5, y - 3, 1.2, 1.8) + eD(x + 1.6, y - 2.4, 1.2, 1.8) + eD(x, y - 5, 1.1, 1.6));
		}
	}
	return sp.out() + lv.out() + dt.out() + fl.out();
}

/* 5. Prayer plant: horizontal oval leaves, pale feathered centre, red herringbone veins. */
function marantaLeaf(L: number, w: number): string {
	let v = "";
	for (let t = 0.2; t < 0.72; t += 0.125) v += `M${f(L * t)} 0L${f(L * (t + 0.1))} ${f(-w * 0.55)}M${f(L * t)} 0L${f(L * (t + 0.1))} ${f(w * 0.55)}`;
	return P(lp(L, w, 0), "#3a6e3c") + P(lp(L * 0.86, w * 0.42, 0), "#a9c97e") + S(v, "#c9364c", 0.5) + S(`M1 0L${f(L * 0.93)} 0`, "#d6404f", 0.9);
}
function prayerPlant(st: St): string {
	const set: [number, number, number, number][] = pick(st,
		[[-140, 7, -165, 11], [-40, 7, -15, 11]],
		[[-150, 12, -172, 16], [-30, 12, -8, 16], [-115, 14, -140, 15], [-65, 14, -38, 15], [-92, 13, -100, 13]],
		[[-155, 14, -176, 19], [-25, 14, -4, 19], [-125, 20, -158, 18], [-55, 20, -22, 18], [-105, 24, -128, 17], [-75, 24, -52, 17], [-90, 18, -86, 15]]);
	let s = "";
	if (st === "bloom") s += S(qD(42, 80, 48, 50, 56, 40), "#6f7a4a", 0.8) + S(qD(38, 80, 32, 54, 26, 44), "#6f7a4a", 0.8) + P(eD(56, 39, 1.6) + eD(59, 41, 1.4) + eD(26, 43, 1.6) + eD(23, 44.5, 1.4), "#f3eef6") + P(eD(56, 39, 0.5) + eD(26, 43, 0.5), "#9a5ab8");
	for (const [pa, pl, a, L] of set) {
		const [px, py] = polar(40, 86, pa, pl);
		s += S(qD(40, 86, 40, py, px, py), "#5f7a45", 1.2) + g(px, py, a, marantaLeaf(L, L * 0.36));
	}
	return s;
}

/* 6. Rex begonia: big lopsided hearts, burgundy rim, silver ring, dark heart; pink flower sprays. */
function rexLeaf(L: number, w: number): string {
	const d = rexD(L, w);
	return P(d, "#7a2a46") + `<path d="${d}" fill="#c8cbd8" transform="translate(${f(L * 0.06)} 0) scale(.78)"/>` + `<path d="${d}" fill="#4d1f38" transform="scale(.4)"/>` +
		S(`M0 0L${f(L * 0.85)} 0M${f(L * 0.2)} 0L${f(L * 0.5)} ${f(-w * 0.7)}M${f(L * 0.2)} 0L${f(L * 0.45)} ${f(w * 0.6)}`, "#5a2340", 0.6);
}
function rexBegonia(st: St): string {
	const set: [number, number, number, number, boolean][] = pick(st,
		[[-120, 4, -125, 11, false], [-60, 4, -50, 10, true]],
		[[-150, 6, -165, 16, false], [-30, 6, -12, 16, true], [-100, 9, -110, 17, false], [-70, 8, -60, 15, true]],
		[[-155, 7, -170, 20, false], [-25, 7, -8, 20, true], [-120, 11, -132, 21, false], [-60, 11, -48, 21, true], [-90, 14, -95, 19, false]]);
	let s = "";
	if (st === "bloom") {
		s += S(qD(36, 80, 30, 52, 24, 40) + qD(44, 80, 52, 52, 58, 42), "#a24d63", 1);
		const pk = new Pen();
		for (const [x, y] of [[24, 40], [21, 43], [27, 43], [24, 37], [58, 42], [61, 39], [55, 39], [58, 45]] as [number, number][]) pk.fill("#f2a6bd", eD(x, y, 1.8, 1.5));
		s += pk.out();
	}
	for (const [pa, pl, a, L, flip] of set) {
		const [px, py] = polar(40, 86, pa, pl);
		s += S(lD(40, 86, px, py), "#9a4a5a", 1.6) + g(px, py, a, rexLeaf(L, L * 0.62), flip);
	}
	return s;
}

/* 7. Angel wing begonia: jointed canes, silver-spotted wings, hanging coral flower clusters. */
interface Pens { a: Pen; b: Pen; c: Pen }
type CaneLeaf = (p: Pens, x: number, y: number, deg: number, L: number, flip: boolean) => void;
function caneBegonia(st: St, leafFn: CaneLeaf, flower: string, centre: string, canes: Curve[], L: number): string {
	const wood = new Pen();
	const nodes = new Pen();
	for (const p of canes) {
		wood.line("#6f8f4a", pick(st, 1.5, 2, 2.4), cD(p));
		for (const t of [0.3, 0.55, 0.78]) {
			const [x, y] = bez(p, t);
			nodes.line("#a7c47a", 1.2, `M${f(x - 1.3)} ${f(y)}L${f(x + 1.3)} ${f(y)}`);
		}
	}
	const pens: Pens = { a: new Pen(), b: new Pen(), c: new Pen() };
	const fl = new Pen();
	canes.forEach((p, ci) => {
		const ts = st === "sprout" ? [0.65, 1] : [0.35, 0.58, 0.8, 1];
		ts.forEach((t, i) => {
			const [x, y] = bez(p, t);
			const right = (i + ci) % 2 === 0;
			leafFn(pens, x, y, right ? 28 - t * 40 : 152 + t * 40, L * (t === 1 ? 0.75 : 1), !right);
		});
		if (st === "bloom" && ci < 2) {
			const [x, y] = bez(p, 0.62);
			const dx = ci ? 5 : -5;
			fl.line("#b0566a", 0.8, qD(x, y, x + dx * 1.4, y - 2, x + dx * 1.6, y + 6));
			for (const [u, v] of [[0, 0], [-1.6, 2.4], [1.6, 2.4], [0, 4.2], [-1.2, 6], [1.3, 6.2]] as [number, number][]) fl.fill(flower, eD(x + dx * 1.6 + u, y + 7 + v, 1.6, 1.9));
			fl.fill(centre, eD(x + dx * 1.6, y + 15, 1.3, 1.6));
		}
	});
	return wood.out() + nodes.out() + pens.a.out() + pens.b.out() + pens.c.out() + fl.out();
}
const angelLeaf: CaneLeaf = (p, x, y, deg, L, flip) => {
	const w = L * 0.42;
	p.a.fill("#4f8a46", T(wingD(L, w), x, y, deg, 1, flip), flip ? "m" : "");
	for (const [u, v] of [[0.3, -0.4], [0.5, -0.55], [0.62, -0.2], [0.42, 0.15], [0.2, -0.75], [0.75, -0.35], [0.3, -0.1]] as [number, number][]) p.b.dot("#dfe9d6", 0.65, ...at(x, y, deg, L * u, w * v, flip));
	p.c.line("#2f5a30", 0.6, T(`M1 0L${f(L * 0.9)} 0`, x, y, deg));
};
function angelWingBegonia(st: St): string {
	const canes: Curve[] = pick(st,
		[[[40, 87], [40, 80], [40, 74], [40, 70]]],
		[[[40, 87], [40, 70], [39, 56], [40, 44]], [[38, 86], [34, 76], [31, 66], [30, 60]]],
		[[[40, 87], [41, 60], [39, 40], [40, 20]], [[38, 86], [33, 70], [28, 54], [26, 40]], [[42, 86], [47, 72], [52, 58], [55, 46]]]);
	return caneBegonia(st, angelLeaf, "#f2808e", "#e0606f", canes, pick(st, 10, 15, 17));
}

/* 8. Cast iron plant: tall glossy dark lances on bare stalks, purple bells at the soil. */
function castIron(st: St): string {
	const set: [number, number, number, number][] = pick(st,
		[[40, -92, 6, 13], [38, -112, 4, 10]],
		[[40, -90, 10, 28], [38, -114, 8, 25], [42, -66, 8, 25], [39, -132, 5, 20], [41, -48, 5, 20]],
		[[40, -88, 14, 38], [37, -108, 13, 36], [43, -72, 12, 35], [36, -126, 9, 31], [44, -54, 9, 31], [39, -144, 5, 25], [41, -36, 5, 25]]);
	let s = "";
	for (const [x, a, pl, L] of [...set].reverse()) {
		const pa = a * 0.5 - 45;
		const [px, py] = polar(x, 86, pa, pl);
		s += S(lD(x, 86, px, py), "#3f6a3a", 1.3) + g(px, py, a, P(lp(L, L * 0.17, 1), "#2e6a3d") + P(`M${f(L * 0.12)} 0C${f(L * 0.4)} ${f(-L * 0.15)} ${f(L * 0.75)} ${f(-L * 0.1)} ${f(L * 0.92)} 0Z`, "#3f7f4a") + S(`M1 0L${f(L * 0.92)} 0`, "#8cbf7a", 0.7));
	}
	if (st === "bloom") s += P(eD(31, 84.5, 2.6, 2) + eD(49, 85, 2.6, 2) + eD(56, 85.5, 2.2, 1.7), "#6a2a5c") + P(eD(31, 83.8, 1, 0.7) + eD(49, 84.3, 1, 0.7) + eD(56, 84.9, 0.9, 0.6), "#e9d7a8");
	return s;
}

/* 9. Swiss cheese vine: climbs a moss pole; lopsided leaves with oval holes. */
function cheeseLeaf(pen: Pen, cut: Pen, x: number, y: number, deg: number, L: number, w: number, holes: boolean, flip: boolean): void {
	pen.fill("#5aa048", T(`M0 0C${f(L * 0.1)} ${f(-w * 1.2)} ${f(L * 0.75)} ${f(-w * 1.05)} ${f(L)} 0C${f(L * 0.7)} ${f(w * 0.8)} ${f(L * 0.15)} ${f(w * 1.05)} 0 0Z`, x, y, deg, 1, flip), flip ? "m" : "");
	if (holes) for (const [u, v] of [[0.3, -0.45], [0.55, -0.5], [0.42, 0.45], [0.66, 0.36], [0.78, -0.3]] as [number, number][]) cut.pill(CUT, w * 0.3, at(x, y, deg, L * (u - 0.06), w * v * 0.8, flip), at(x, y, deg, L * (u + 0.06), w * v * 0.75, flip));
	cut.line("#3f7a35", 0.7, T(`M1 0L${f(L * 0.9)} 0`, x, y, deg));
}
function swissCheeseVine(st: St): string {
	const top = pick(st, 70, 42, 16);
	let s = st === "sprout" ? "" : S(lD(40, 87, 40, top), "#7b5b3c", 4.2) + S(lD(39, 86, 39, top + 2), "#9a7a52", 1);
	const H = 86 - top;
	const vine: Curve = [[41, 86], [46, 86 - H * 0.35], [35, 86 - H * 0.7], [41, top + 3]];
	s += S(cD(vine), GREEN.dark, 1.3);
	const ts = pick(st, [0.55, 1], [0.25, 0.45, 0.65, 0.85, 1], [0.12, 0.24, 0.36, 0.48, 0.6, 0.72, 0.84, 0.95, 1.02]);
	const L = pick(st, 8, 13, 15);
	const pen = new Pen();
	const cut = new Pen();
	ts.forEach((t, i) => {
		const [x, y] = bez(vine, Math.min(t, 1));
		const right = i % 2 === 0;
		const a = t > 1 ? -95 : right ? -12 + (i % 3) * 8 : 192 - (i % 3) * 8;
		const LL = L * (t > 0.95 ? 0.8 : 1);
		cheeseLeaf(pen, cut, x, y, a, LL, LL * 0.36, st !== "sprout", !right);
	});
	if (st === "bloom") {
		s += S(qD(40, 30, 54, 34, 60, 52), GREEN.dark, 1);
		cheeseLeaf(pen, cut, 60, 52, 80, 10, 3.6, true, false);
		cheeseLeaf(pen, cut, 52, 36, 20, 10, 3.6, true, false);
	}
	return s + pen.out() + cut.out();
}

/* 10. Syngonium: pink-centred arrowheads on rosy stalks. */
function syngLeaf(L: number, w: number): string {
	const d = arrowD(L, w);
	return P(d, "#6aa452") + `<path d="${d}" fill="#f1b6c2" transform="translate(${f(L * 0.06)} 0) scale(.72)"/>` + S(`M0 0L${f(L * 0.88)} 0M${f(L * 0.05)} 0L${f(-L * 0.18)} ${f(-w * 0.6)}M${f(L * 0.05)} 0L${f(-L * 0.18)} ${f(w * 0.6)}`, "#d9879a", 0.6);
}
function syngonium(st: St): string {
	const set: [number, number, number][] = pick(st,
		[[-100, 11, 9], [-70, 8, 8]],
		[[-145, 16, 14], [-35, 16, 14], [-110, 25, 15], [-72, 22, 14]],
		[[-155, 18, 16], [-25, 18, 16], [-128, 28, 17], [-52, 28, 17], [-100, 38, 18], [-78, 33, 17], [-140, 10, 12]]);
	let s = "";
	for (const [pa, pl, L] of set) {
		const [px, py] = polar(40, 86, pa, pl);
		const a = pa + (pa < -90 ? -55 : 55);
		s += S(qD(40, 86, 40 + (px - 40) * 0.3, py, px, py), "#c48896", 1.3) + g(px, py, a, syngLeaf(L, L * 0.42));
	}
	return s;
}

/* 11. African mask plant: upright stalks, near-black arrowheads with bold white veins. */
function maskLeaf(L: number, w: number): string {
	let v = `M0 0L${f(-L * 0.22)} ${f(-w * 0.7)}M0 0L${f(-L * 0.22)} ${f(w * 0.7)}`;
	for (const t of [0.22, 0.48]) v += `M${f(L * t)} 0Q${f(L * (t + 0.1))} ${f(-w * 0.45)} ${f(L * (t + 0.08))} ${f(-w * 0.75)}M${f(L * t)} 0Q${f(L * (t + 0.1))} ${f(w * 0.45)} ${f(L * (t + 0.08))} ${f(w * 0.75)}`;
	return P(arrowD(L, w), "#2d5b3e") + S(v, "#dfe9d6", 0.6) + S(`M0 0L${f(L * 0.92)} 0`, "#eef4e8", 1);
}
function africanMask(st: St): string {
	const set: [number, number, number][] = pick(st,
		[[-90, 9, 10]],
		[[-118, 22, 17], [-62, 22, 17], [-90, 30, 18]],
		[[-128, 30, 20], [-52, 30, 20], [-104, 42, 21], [-76, 40, 21], [-150, 16, 16]]);
	let s = "";
	for (const [pa, pl, L] of set) {
		const [px, py] = polar(40, 86, pa, pl);
		const a = pa < -91 ? pa - 85 : pa > -89 ? pa + 85 : -10;
		s += S(qD(40, 86, 40 + (px - 40) * 0.4, (86 + py) / 2, px, py), "#7f9a64", 1.5) + g(px, py, a, maskLeaf(L, L * 0.4), a < -90);
	}
	return s;
}

/* 12. Purple waffle plant: a low mound of puckered metallic-purple leaves, small white flowers. */
function purpleWaffle(st: St): string {
	const rings: [number, number, number][] = pick(st,
		[[3, 4, 10]],
		[[6, 8, 13], [3, 4, 12]],
		[[7, 12, 14], [5, 7, 13], [2, 3, 12]]);
	let s = "";
	rings.forEach(([n, r, L], ri) => {
		const pen = new Pen();
		const w = L * 0.4;
		for (let i = 0; i < n; i++) {
			const a = n === 2 ? -115 + i * 50 : -162 + (144 * i) / (n - 1);
			const [x, y] = polar(40, 86, a, r);
			pen.fill((i + ri) % 2 ? "#6a5688" : "#7a6494", T(toothD(L, w, 3), x, y, a));
			pen.fill("#9480b0", T(lp(L * 0.7, w * 0.35, 0), x, y, a));
			let v = `M1 0L${f(L * 0.88)} 0`;
			for (const t of [0.28, 0.55]) v += `M${f(L * t)} 0L${f(L * (t + 0.14))} ${f(-w * 0.7)}M${f(L * t)} 0L${f(L * (t + 0.14))} ${f(w * 0.7)}`;
			pen.line("#3f2f5a", 0.6, T(v, x, y, a));
		}
		s += pen.out();
	});
	if (st === "bloom") {
		const fl = new Pen();
		let eye = "";
		for (const [x, y] of [[30, 58], [44, 53], [54, 61], [37, 52]] as [number, number][]) {
			for (let k = 0; k < 5; k++) fl.fill("#eee4f4", eD(...polar(x, y, k * 72 - 90, 1.6), 1.2));
			eye += eD(x, y, 0.8);
		}
		s += fl.out() + P(eye, "#e8c94a");
	}
	return s;
}

/* 13. Wandering dude: trailing stems of purple leaves with silver stripes, magenta three-petal flowers. */
function wanderingDude(st: St): string {
	const stems: Curve[] = pick(st,
		[[[40, 86], [40, 78], [36, 74], [32, 74]], [[40, 86], [41, 80], [45, 76], [48, 77]]],
		[[[40, 86], [38, 62], [22, 62], [14, 80]], [[40, 86], [42, 62], [58, 62], [66, 80]], [[40, 86], [40, 72], [40, 64], [41, 56]]],
		[[[40, 86], [36, 54], [16, 56], [11, 80]], [[40, 86], [44, 54], [64, 56], [69, 80]], [[40, 86], [38, 66], [28, 62], [22, 72]], [[40, 86], [42, 66], [52, 62], [58, 72]], [[40, 86], [40, 66], [40, 54], [41, 44]]]);
	const sp = new Pen();
	const lv = new Pen();
	const sv = new Pen();
	const L = pick(st, 8, 9, 10);
	for (const p of stems) {
		sp.line("#7a4a7a", 1.2, cD(p));
		for (let t = pick(st, 0.5, 0.25, 0.33); t <= 1.01; t += pick(st, 0.5, 0.25, 0.33)) {
			const [x, y] = bez(p, t);
			const a = tangent(p, t);
			for (const aa of [a - 40, a + 40]) {
				const w = L * 0.36;
				lv.fill("#5e2f78", T(lp(L, w, 1), x, y, aa));
				sv.line("#c9d2e6", 0.7, T(`M${f(L * 0.12)} ${f(-w * 0.2)}Q${f(L * 0.45)} ${f(-w * 0.5)} ${f(L * 0.82)} ${f(-w * 0.12)}M${f(L * 0.12)} ${f(w * 0.2)}Q${f(L * 0.45)} ${f(w * 0.5)} ${f(L * 0.82)} ${f(w * 0.12)}`, x, y, aa));
			}
		}
	}
	let s = sp.out() + lv.out() + sv.out();
	if (st === "bloom") {
		const fl = new Pen();
		let eye = "";
		for (const [x, y] of [[16, 56], [64, 57], [41, 41], [28, 63]] as [number, number][]) {
			for (const k of [0, 120, 240]) fl.fill("#e2589f", T(lp(3.2, 1.5, 2), x, y, k - 90));
			eye += eD(x, y, 0.7);
		}
		s += fl.out() + P(eye, "#f4e07a");
	}
	return s;
}

/* 14. Moses-in-the-cradle: stiff sword rosette, green above, purple beneath; boat bracts in the heart. */
function mosesInTheCradle(st: St): string {
	const n = pick(st, 4, 7, 11);
	const L = pick(st, 14, 28, 36);
	const back = new Pen();
	const front = new Pen();
	for (let i = 0; i < n; i++) {
		const a = -165 + (150 * i) / (n - 1);
		const k = 1 - Math.abs(a + 90) / 160;
		const pen = Math.abs(a + 90) > 40 ? back : front;
		const purple = i % 2 === 1;
		pen.fill(purple ? "#6e2f7c" : "#46704a", T(lp(L * (0.55 + k * 0.5), L * 0.1, 1), 40, 85, a));
		if (!purple) pen.line("#7a3f8a", 0.6, T(`M2 -0.6L${f(L * 0.5)} -1.5`, 40, 85, a));
	}
	let s = back.out() + front.out();
	if (st === "bloom") s += P(T(lp(7, 2.8, 2), 34, 80, -150) + T(lp(7, 2.8, 2), 46, 80, -30), "#7f3a90") + P(eD(33, 78, 1.1) + eD(35, 79.6, 1.1) + eD(47, 78, 1.1) + eD(45, 79.6, 1.1), "#f7f4f2");
	return s;
}

/* 15. Umbrella tree: slender stems topped with drooping umbrellas of glossy leaflets; red flower arms. */
function umbrella(pen: Pen, x: number, y: number, L: number, n: number): void {
	for (let i = 0; i < n; i++) {
		const a = -200 + (220 * i) / (n - 1);
		pen.fill(i % 2 ? "#3f8a3e" : "#4f9a46", T(lp(L, L * 0.24, 0), x, y, a));
		pen.line("#8fc27a", 0.6, T(`M1 0L${f(L * 0.85)} 0`, x, y, a));
	}
}
function umbrellaTree(st: St): string {
	const heads: [number, number, number, number][] = pick(st,
		[[40, 72, 6, 5]],
		[[40, 52, 10, 7], [30, 66, 8, 6], [51, 62, 8, 6]],
		[[38, 32, 13, 9], [24, 50, 11, 8], [56, 44, 12, 8], [47, 64, 9, 7]]);
	let s = "";
	const stems = new Pen();
	for (const [x, y] of heads) stems.line("#7f7a4a", 1.4, qD(40, 86, 40 + (x - 40) * 0.2, (86 + y) / 2, x, y));
	s += stems.out();
	if (st === "bloom") {
		const r = new Pen();
		for (const a of [-130, -110, -90, -70, -50]) {
			const [ex, ey] = polar(46, 26, a, 16);
			r.line("#c8343c", 1.4, qD(46, 26, (46 + ex) / 2 + 2, (26 + ey) / 2, ex, ey));
		}
		s += r.out();
	}
	const pen = new Pen();
	for (const [x, y, L, n] of heads) umbrella(pen, x, y, L, n);
	s += pen.out();
	if (st === "bloom") {
		let dots = "";
		for (const a of [-130, -110, -90, -70, -50]) for (const t of [0.55, 0.8, 1]) {
			const [dx, dy] = polar(46, 26, a, 16 * t);
			dots += eD(dx + 0.6, dy, 0.9);
		}
		s += P(dots, "#e2553f");
	}
	return s;
}

/* 16. Weeping fig: grey trunk, arching branches weeping with small pointed leaves, tiny figs. */
function weepingFig(st: St): string {
	const top = pick(st, 72, 52, 44);
	let s = S(cD([[40, 87], [40, 80], [41, top + 10], [40, top]]), "#9a917f", pick(st, 1.4, 2.4, 3.4));
	const br: Curve[] = pick(st,
		[[[40, 72], [37, 66], [33, 66], [31, 70]], [[40, 72], [43, 66], [47, 66], [49, 70]]],
		[[[40, 52], [32, 40], [22, 42], [17, 60]], [[40, 52], [48, 40], [58, 42], [63, 60]], [[40, 52], [38, 44], [33, 42], [29, 50]], [[40, 52], [42, 44], [47, 42], [51, 50]]],
		[[[40, 44], [28, 18], [12, 22], [7, 58]], [[40, 44], [52, 18], [68, 22], [73, 58]], [[40, 44], [34, 24], [22, 26], [18, 52]], [[40, 44], [46, 24], [58, 26], [62, 52]], [[40, 44], [38, 22], [30, 20], [28, 44]], [[40, 44], [42, 22], [50, 20], [52, 44]]]);
	const wood = new Pen();
	for (const p of br) wood.line("#8f8676", pick(st, 0.8, 1, 1.2), cD(p));
	s += wood.out();
	const lv = new Pen();
	const L = pick(st, 5, 5.5, 6);
	br.forEach((p, bi) => {
		for (let t = 0.12, i = 0; t <= 1.01; t += pick(st, 0.3, 0.12, 0.075), i++) {
			const [x, y] = bez(p, t);
			const a = tangent(p, t) * 0.4 + 54 + (i % 2 ? 32 : -32);
			lv.fill((i + bi) % 3 === 0 ? "#7cb35a" : (i + bi) % 3 === 1 ? "#3f7f3a" : "#55954a", T(lp(L, L * 0.34, 1), x, y, a));
		}
	});
	s += lv.out();
	if (st === "bloom") s += P(eD(14, 42, 1) + eD(66, 44, 1) + eD(30, 32, 1) + eD(51, 30, 1) + eD(24, 52, 1) + eD(57, 54, 1), "#d9823a");
	return s;
}

/* 17. Norfolk Island pine: a straight trunk with flat, airy tiers of bottlebrush branches. */
function norfolkPine(st: St): string {
	const tiers: [number, number][] = pick(st,
		[[80, 7], [74, 5], [69, 3]],
		[[74, 15], [64, 12], [55, 9], [47, 6]],
		[[76, 25], [65, 21], [54, 17], [44, 13], [35, 10], [27, 7], [20, 4]]);
	const top = pick(st, 64, 41, 13);
	let s = S(lD(40, 87, 40, top + 3), "#8a6242", pick(st, 1.2, 2, 2.6));
	const br = new Pen();
	const tuft = new Pen();
	const tip = new Pen();
	for (const [y, len] of tiers) {
		for (const side of [-1, 1]) {
			const ex = 40 + side * len;
			const ey = y - 2 - len * 0.08;
			br.line("#3f6a35", 1, qD(40, y, 40 + side * len * 0.6, y + 1.2, ex, ey));
			let d = "";
			for (let t = 0.15; t <= 1; t += 0.1) {
				const x = 40 + side * len * t;
				const yy = y + 1 - t * (3 + len * 0.08) * t;
				d += `M${f(x - side * 1.4)} ${f(yy - 2.4)}L${f(x + side * 0.8)} ${f(yy)}L${f(x - side * 1.4)} ${f(yy + 2.2)}`;
			}
			tuft.line("#5f9a4a", 1, d);
			tip.fill("#8cc46a", T(lp(3.5, 1.3, 1), ex, ey, side > 0 ? -40 : -140));
		}
	}
	s += br.out() + tuft.out() + tip.out();
	s += P(T(lp(top < 40 ? 7 : 5, 1.5, 1), 40, top + 6, -90), "#5f9a4a");
	return s;
}

/* 18. Polka dot begonia: long olive wings with bold white dots, red undersides, white flowers. */
const polkaBegoniaLeaf: CaneLeaf = (p, x, y, deg, L, flip) => {
	const w = L * 0.3;
	p.a.fill("#b0313e", T(`M0 0C${f(L * 0.06)} ${f(w * 0.75)} ${f(L * 0.5)} ${f(w * 0.75)} ${f(L)} 0Z`, x, y, deg, 1, flip), flip ? "m" : "");
	p.b.fill("#3b5a3a", T(wingD(L, w), x, y, deg, 1, flip), flip ? "m" : "");
	for (const [u, v] of [[0.22, -0.45], [0.4, -0.65], [0.38, -0.2], [0.58, -0.45], [0.75, -0.2], [0.56, 0.1], [0.25, 0.15], [0.86, -0.06]] as [number, number][]) p.c.dot("#f2f1ea", 1, ...at(x, y, deg, L * u, w * v, flip));
};
function polkaDotBegonia(st: St): string {
	const canes: Curve[] = pick(st,
		[[[40, 87], [40, 80], [40, 74], [40, 69]]],
		[[[40, 87], [41, 72], [39, 58], [40, 44]], [[41, 86], [45, 76], [49, 68], [51, 62]]],
		[[[40, 87], [41, 62], [39, 42], [41, 22]], [[41, 86], [47, 72], [53, 60], [56, 48]], [[39, 86], [35, 76], [31, 66], [29, 58]]]);
	return caneBegonia(st, polkaBegoniaLeaf, "#f6f3ee", "#f2d34a", canes, pick(st, 11, 17, 19));
}

/* 19. Aluminum plant: opposite quilted leaves with raised silver patches. */
function aluminumPlant(st: St): string {
	const stems: Curve[] = pick(st,
		[[[40, 87], [40, 80], [40, 76], [40, 72]]],
		[[[40, 87], [40, 72], [40, 60], [40, 48]], [[39, 86], [35, 78], [31, 72], [29, 66]], [[41, 86], [45, 78], [49, 72], [51, 66]]],
		[[[40, 87], [40, 66], [41, 48], [40, 30]], [[39, 86], [33, 72], [27, 60], [24, 50]], [[41, 86], [47, 72], [53, 60], [56, 48]], [[40, 86], [37, 78], [33, 74], [31, 72]], [[40, 86], [43, 78], [47, 74], [49, 72]]]);
	const sp = new Pen();
	const lv = new Pen();
	const sv = new Pen();
	const L = pick(st, 9, 12, 13);
	for (const p of stems) {
		sp.line("#9a8a62", 1.3, cD(p));
		for (const t of st === "sprout" ? [1] : [0.45, 0.75, 1]) {
			const [x, y] = bez(p, t);
			const a = tangent(p, t);
			const LL = L * (t === 1 ? 0.7 : 1);
			const w = LL * 0.38;
			for (const aa of [a - 62, a + 62]) {
				lv.fill("#356b52", T(lp(LL, w, 1), x, y, aa));
				for (const [u, v, k] of [[0.32, -0.42, 1], [0.32, 0.42, 1], [0.6, -0.32, 0.85], [0.6, 0.32, 0.85]] as [number, number, number][]) sv.pill("#dfe8e6", w * 0.36 * k, at(x, y, aa, LL * (u - 0.07), w * v), at(x, y, aa, LL * (u + 0.07), w * v));
			}
		}
	}
	let s = sp.out() + lv.out() + sv.out();
	if (st === "bloom") s += P(eD(40, 28, 1.6) + eD(38, 30, 1.2) + eD(42, 30, 1.2) + eD(24, 48, 1.4) + eD(56, 46, 1.4), "#e8d8c8");
	return s;
}

/* 20. Hoya: thick waxy leaves twining over a wire hoop; balls of pink star flowers. */
function hoya(st: St): string {
	let s = "";
	const P1: Curve = st === "sprout" ? [[40, 87], [40, 80], [41, 76], [40, 70]] : st === "leafy" ? [[40, 87], [33, 74], [26, 66], [27, 50]] : [[40, 87], [26, 80], [16, 56], [24, 32]];
	const P2: Curve = st === "bloom" ? [[24, 32], [32, 18], [50, 18], [58, 32]] : [[27, 50], [30, 40], [40, 36], [48, 42]];
	const P3: Curve = [[58, 32], [64, 56], [54, 76], [48, 86]];
	if (st === "sprout") s += S(lD(42, 87, 42, 68), "#9c8a6a", 1);
	else if (st === "leafy") s += S(`M24 87L24 54C24 36 56 36 56 54L56 87`, "#9c8a6a", 1);
	else s += S(`M18 87L18 40C18 10 62 10 62 40L62 87`, "#9c8a6a", 1.1);
	const curves = st === "sprout" ? [P1] : st === "leafy" ? [P1, P2] : [P1, P2, P3];
	const vine = new Pen();
	for (const c of curves) vine.line("#6b7a3f", 1.1, cD(c));
	s += vine.out();
	const lv = new Pen();
	const L = pick(st, 7, 8, 8.5);
	curves.forEach((c, ci) => {
		const step = st === "sprout" ? 0.5 : 0.2;
		for (let t = st === "sprout" ? 0.5 : 0.1; t <= 1.01; t += step) {
			const [x, y] = bez(c, t);
			const a = tangent(c, t);
			lv.fill((ci + Math.round(t * 10)) % 3 ? "#3f7a45" : "#57904f", T(lp(L, L * 0.38, 0), x, y, a - 70) + T(lp(L, L * 0.38, 0), x, y, a + 70));
		}
	});
	s += lv.out();
	if (st === "bloom") {
		const fl = new Pen();
		const eye = new Pen();
		for (const [cx, cy] of [[40, 20], [16, 60], [62, 60]] as [number, number][]) {
			for (const [u, v] of [[0, -3.4], [-3.2, -1.2], [3.2, -1.2], [-2, 2.6], [2, 2.6], [0, 0]] as [number, number][]) {
				fl.fill("#f4c5d2", T(`M0 -2L0.6 -0.6L2 -0.4L1 0.6L1.2 2L0 1.3L-1.2 2L-1 0.6L-2 -0.4L-0.6 -0.6Z`, cx + u, cy + v, 0, 1.05));
				eye.fill("#a8233e", eD(cx + u, cy + v, 0.5));
			}
		}
		s += fl.out() + eye.out();
	}
	return s;
}

/* 21. Chinese money plant: round pancake leaves on long stalks around an upright stem; pups at the base. */
function moneyPlant(st: St): string {
	const top = pick(st, 76, 58, 42);
	let s = S(lD(40, 87, 40, top), "#6f8a45", pick(st, 1.4, 1.8, 2.2));
	const leaves: [number, number, number, number, number][] = [];
	const n = pick(st, 3, 7, 11);
	const R = pick(st, 4, 5.4, 6.2);
	for (let i = n - 1; i >= 0; i--) {
		const k = i / n;
		const y = top + (86 - top) * 0.5 * k;
		const ang = i === 0 ? -90 : -90 + (i % 2 ? -1 : 1) * (22 + 75 * k);
		const [x, yy] = polar(40, y, ang, pick(st, 6, 10, 12) * (0.9 + k * 0.8));
		leaves.push([40, y, x, yy, R * (1 - k * 0.25)]);
	}
	if (st !== "sprout") leaves.push([27, 86, 25, 79, 3.4], [55, 86, 57, 80.5, 3]);
	const pet = new Pen();
	const lf = new Pen();
	const dot = new Pen();
	for (const [sx, sy, x, y, r] of leaves) {
		pet.line("#7f9a4f", 0.8, lD(sx, sy, x, y));
		lf.fill(r < 3.6 ? "#7cbf5a" : "#5aa548", eD(x, y, r, r * 0.86));
		dot.dot("#3f7a35", 0.7, x, y + 0.5);
	}
	return s + pet.out() + lf.out() + dot.out();
}

/* 22. Purple passion plant: velvety toothed leaves glowing purple; orange tufted flowers. */
function purplePassion(st: St): string {
	const stems: Curve[] = pick(st,
		[[[40, 87], [40, 80], [40, 76], [40, 72]]],
		[[[40, 87], [40, 72], [40, 60], [41, 48]], [[39, 86], [32, 78], [26, 72], [22, 70]], [[41, 86], [48, 78], [54, 72], [58, 70]]],
		[[[40, 87], [40, 64], [41, 46], [40, 32]], [[39, 86], [30, 74], [20, 66], [13, 66]], [[41, 86], [50, 74], [60, 66], [67, 66]], [[40, 86], [36, 70], [30, 56], [28, 46]], [[40, 86], [44, 70], [50, 56], [53, 44]]]);
	const sp = new Pen();
	const lv = new Pen();
	const L = pick(st, 9, 12, 13);
	for (const p of stems) {
		sp.line("#7a3f8a", 1.3, cD(p));
		for (const t of st === "sprout" ? [1] : st === "leafy" ? [0.4, 0.7, 1] : [0.5, 1]) {
			const [x, y] = bez(p, t);
			const a = tangent(p, t);
			const LL = L * (t === 1 ? 0.75 : 1);
			for (const aa of [a - 50, a + 50]) {
				lv.fill("#5d4486", T(toothD(LL, LL * 0.42, 4), x, y, aa));
				lv.line("#c08ae6", 0.6, T(`M1 0L${f(LL * 0.85)} 0`, x, y, aa));
			}
		}
	}
	let s = sp.out() + lv.out();
	if (st === "bloom") {
		const fl = new Pen();
		for (const [x, y] of [[40, 26], [28, 41], [54, 39], [13, 61]] as [number, number][]) {
			fl.line("#ee8a2c", 1.1, [-50, -70, -90, -110, -130].map((a) => lD(x, y, ...polar(x, y, a, 4))).join(""));
			fl.fill("#7f9a4a", eD(x, y + 1, 1.6, 1.3));
		}
		s += fl.out();
	}
	return s;
}

/* 23. Stromanthe: upright lances splashed cream and pink, magenta undersides; red bracts. */
function stromLeaf(L: number, w: number, under: boolean): string {
	if (under) return P(lp(L, w, 1), "#c9557a") + S(`M1 0L${f(L * 0.9)} 0`, "#8a2f50", 0.6);
	return P(lp(L, w, 1), "#3d6b45") +
		P(`M${f(L * 0.08)} ${f(-w * 0.15)}C${f(L * 0.3)} ${f(-w * 1.05)} ${f(L * 0.55)} ${f(-w * 0.55)} ${f(L * 0.72)} ${f(-w * 0.75)}C${f(L * 0.8)} ${f(-w * 0.35)} ${f(L * 0.5)} ${f(-w * 0.1)} ${f(L * 0.08)} ${f(-w * 0.15)}Z`, "#efe6c6") +
		P(`M${f(L * 0.2)} ${f(w * 0.1)}C${f(L * 0.35)} ${f(w * 0.85)} ${f(L * 0.5)} ${f(w * 0.75)} ${f(L * 0.62)} ${f(w * 0.6)}C${f(L * 0.55)} ${f(w * 0.2)} ${f(L * 0.4)} ${f(w * 0.1)} ${f(L * 0.2)} ${f(w * 0.1)}Z`, "#ec98b2") +
		S(`M1 0L${f(L * 0.9)} 0`, "#2a4a30", 0.6);
}
function stromanthe(st: St): string {
	const set: [number, number, number, boolean][] = pick(st,
		[[-98, 6, 12, false], [-72, 5, 10, true]],
		[[-128, 14, 20, false], [-52, 14, 20, true], [-104, 20, 22, false], [-78, 18, 21, false]],
		[[-140, 18, 22, false], [-40, 18, 22, false], [-120, 26, 25, true], [-60, 26, 25, false], [-100, 32, 26, false], [-80, 30, 25, true], [-155, 10, 18, false]]);
	let s = "";
	if (st === "bloom") s += S(qD(41, 86, 44, 60, 47, 34), "#7a4a4a", 1) + P(T(lp(5, 2.2, 1), 47, 34, -110) + T(lp(5, 2.2, 1), 47, 34, -70) + T(lp(4.5, 2, 1), 47, 36, -150) + T(lp(4.5, 2, 1), 47, 36, -30), "#c4303f") + P(eD(45, 29, 1) + eD(49, 29.5, 1), "#f6f2ee");
	for (const [pa, pl, L, under] of set) {
		const [px, py] = polar(40, 86, pa, pl);
		const a = pa + (pa + 90) * 0.15;
		s += S(lD(40, 86, px, py), "#b06078", 1.1) + g(px, py, a, stromLeaf(L, L * 0.2, under));
	}
	return s;
}

/* 24. Fatsia: big glossy palmate leaves on long stalks; white ball umbels and black berries. */
function fatsiaLeaf(pen: Pen, x: number, y: number, R: number, tilt: number, c: string): void {
	pen.fill(c, eD(x, y, R * 0.42));
	for (let k = 0; k < 7; k++) {
		const a = tilt - 90 + (k - 3) * 40;
		const L = R * (1 - Math.abs(k - 3) * 0.09);
		pen.fill(c, T(lp(L, L * 0.36, 0), x, y, a));
		pen.line("#8cbf7a", 0.5, T(`M0 0L${f(L * 0.82)} 0`, x, y, a));
	}
}
function fatsia(st: St): string {
	const set: [number, number, number, number][] = pick(st,
		[[40, 72, 7, 0]],
		[[40, 50, 12, 0], [26, 64, 10, -20], [55, 62, 10, 20]],
		[[40, 44, 14, 0], [22, 58, 12, -20], [58, 56, 12, 20], [32, 72, 9, -10], [50, 73, 9, 12]]);
	let s = "";
	if (st === "bloom") {
		s += S(`M44 46L48 26M48 34L41 22M48 34L56 22M48 30L48 18M46 38L35 30`, "#d8d2a8", 0.9);
		s += P(eD(48, 18, 2.6) + eD(41, 22, 2.4) + eD(56, 22, 2.4) + eD(48, 26, 2.2), "#ebe5c8") + P(eD(34, 29, 1.5) + eD(31.5, 30.5, 1.5) + eD(33, 32.5, 1.4), "#2a2632");
	}
	const st2 = new Pen();
	for (const [x, y] of set) st2.line("#5f8a4a", 1.3, qD(40, 86, 40 + (x - 40) * 0.3, (86 + y) / 2, x, y));
	s += st2.out();
	set.forEach(([x, y, R, tilt], i) => {
		const pen = new Pen();
		fatsiaLeaf(pen, x, y, R, tilt, i % 2 ? "#3a7a40" : "#2e6a38");
		s += pen.out();
	});
	return s;
}

/* 25. African violet: a flat rosette of velvety round leaves crowned with violet flowers. */
function africanViolet(st: St): string {
	const rings: [number, number, number][] = pick(st,
		[[3, 2, 8]],
		[[7, 4, 11], [4, 2, 9]],
		[[9, 5, 13], [6, 3, 11]]);
	let s = "";
	rings.forEach(([n, r, L], ri) => {
		const pen = new Pen();
		for (let i = 0; i < n; i++) {
			const a = -178 + (176 * i) / (n - 1);
			const [x, y] = polar(40, 85, a, r);
			const aa = a * (ri ? 0.85 : 0.6) + (a < -90 ? -70 : -20) * (ri ? 0.15 : 0.4) + (a < -90 ? 0 : 0);
			pen.fill(ri ? "#4f7a45" : "#3d663a", T(lp(L, L * 0.42, 2), x, y, aa));
			pen.line("#8aa874", 0.6, T(`M1 0L${f(L * 0.8)} 0`, x, y, aa));
		}
		s += pen.out();
	});
	if (st !== "sprout") {
		const fl: [number, number][] = st === "leafy" ? [[38, 66], [44, 68]] : [[40, 58], [32, 62], [48, 61], [36, 67], [45, 67], [27, 68], [53, 68]];
		const stalks = new Pen();
		for (const [x, y] of fl) stalks.line("#7a5a6a", 0.8, qD(40, 80, x, (80 + y) / 2, x, y));
		s += stalks.out();
		const pp = new Pen();
		for (const [x, y] of fl) for (let k = 0; k < 5; k++) pp.fill("#8a4fc8", eD(...polar(x, y, k * 72 - 90, 2), 1.9, 1.9));
		s += pp.out() + P(fl.map(([x, y]) => eD(x, y, 1.1)).join(""), "#f2d23a");
	}
	return s;
}

const ALL: [string, (st: St) => string][] = [
	["Chinese evergreen", chineseEvergreen],
	["Watermelon peperomia", watermelonPeperomia],
	["Nerve plant", nervePlant],
	["Polka dot plant", polkaDotPlant],
	["Prayer plant", prayerPlant],
	["Rex begonia", rexBegonia],
	["Angel wing begonia", angelWingBegonia],
	["Cast iron plant", castIron],
	["Swiss cheese vine", swissCheeseVine],
	["Syngonium", syngonium],
	["African mask plant", africanMask],
	["Purple waffle plant", purpleWaffle],
	["Wandering dude", wanderingDude],
	["Moses-in-the-cradle", mosesInTheCradle],
	["Umbrella tree", umbrellaTree],
	["Weeping fig", weepingFig],
	["Norfolk Island pine", norfolkPine],
	["Polka dot begonia", polkaDotBegonia],
	["Aluminum plant", aluminumPlant],
	["Hoya", hoya],
	["Chinese money plant", moneyPlant],
	["Purple passion plant", purplePassion],
	["Stromanthe", stromanthe],
	["Fatsia", fatsia],
	["African violet", africanViolet],
];

export const SPECIES: Species[] = ALL.map(([name, draw]) => ({
	id: name
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.replace(/'/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, ""),
	name,
	draw,
}));
