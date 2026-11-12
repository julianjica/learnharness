/**
 * Garden species, family: orchids. Each draws sprout, leafy and bloom in
 * the kit's flat style (see kit.ts); the kit draws soil and seed. Shapes of
 * one colour are merged into one path through a small layer stack (`Ly`).
 */
import { bez, f, type GrowingStage, type Pt, type Species } from "./kit";

type St = GrowingStage;
type P4 = [Pt, Pt, Pt, Pt];

/* ---------- private helpers ---------- */

const R = (d: number): number => (d * Math.PI) / 180;

/** Key for a stroke layer. */
const S = (c: string, w: number): string => `s|${c}|${w}`;

/** Ordered colour layers: every shape of one fill (or one stroke) becomes one path. */
class Ly {
	private m = new Map<string, string>();
	constructor(order: string[] = []) {
		for (const k of order) this.m.set(k, "");
	}
	f(fill: string, d: string): this {
		this.m.set(fill, (this.m.get(fill) ?? "") + d);
		return this;
	}
	s(c: string, w: number, d: string): this {
		return this.f(S(c, w), d);
	}
	toString(): string {
		let o = "";
		for (const [k, d] of this.m) {
			if (!d) continue;
			if (k.startsWith("s|")) {
				const [, c, w] = k.split("|");
				o += `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
			} else o += `<path d="${d}" fill="${k}"/>`;
		}
		return o;
	}
}

/** Subpath of a rotated ellipse (rx along `rot`). */
function ov(cx: number, cy: number, rx: number, ry: number, rot = 0): string {
	const r = R(rot);
	const dx = Math.cos(r) * rx;
	const dy = Math.sin(r) * rx;
	const a = `A${f(rx)} ${f(ry)} ${f(rot)} 1 0`;
	return `M${f(cx + dx)} ${f(cy + dy)}${a} ${f(cx - dx)} ${f(cy - dy)}${a} ${f(cx + dx)} ${f(cy + dy)}Z`;
}

/** Subpath of a pointed lens from (x, y) heading `deg`. */
function lens(x: number, y: number, deg: number, len: number, w: number): string {
	const r = R(deg);
	const c = Math.cos(r);
	const sn = Math.sin(r);
	const mx = x + c * len * 0.45;
	const my = y + sn * len * 0.45;
	const k = w * 1.25;
	return `M${f(x)} ${f(y)}Q${f(mx - sn * k)} ${f(my + c * k)} ${f(x + c * len)} ${f(y + sn * len)}Q${f(mx + sn * k)} ${f(my - c * k)} ${f(x)} ${f(y)}Z`;
}

/** Subpath of a circle. */
function dot(x: number, y: number, r: number): string {
	return `M${f(x - r)} ${f(y)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0`;
}

/** Straight segment subpath. */
function sg(x1: number, y1: number, x2: number, y2: number): string {
	return `M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}`;
}

/** Quadratic subpath. */
function qd(x1: number, y1: number, cx: number, cy: number, x2: number, y2: number): string {
	return `M${f(x1)} ${f(y1)}Q${f(cx)} ${f(cy)} ${f(x2)} ${f(y2)}`;
}

/** Cubic subpath. */
function cb(p: P4): string {
	const [a, b, c, d] = p;
	return `M${f(a[0])} ${f(a[1])}C${f(b[0])} ${f(b[1])} ${f(c[0])} ${f(c[1])} ${f(d[0])} ${f(d[1])}`;
}

/** Polygon subpath from local points, placed at (x, y), rotated by deg, scaled by k. */
function poly(x: number, y: number, deg: number, k: number, pts: readonly number[]): string {
	const c = Math.cos(R(deg)) * k;
	const sn = Math.sin(R(deg)) * k;
	let d = "";
	for (let i = 0; i < pts.length; i += 2) {
		const px = pts[i] ?? 0;
		const py = pts[i + 1] ?? 0;
		d += `${i ? "L" : "M"}${f(x + px * c - py * sn)} ${f(y + px * sn + py * c)}`;
	}
	return d + "Z";
}

/** A curved strap leaf from (x, y) to the tip (tx, ty), bowed by `bend`, half-width w. */
function strap(x: number, y: number, tx: number, ty: number, bend: number, w: number): string {
	const dx = tx - x;
	const dy = ty - y;
	const L = Math.hypot(dx, dy) || 1;
	const nx = -dy / L;
	const ny = dx / L;
	const cx = (x + tx) / 2 + nx * bend;
	const cy = (y + ty) / 2 + ny * bend;
	return `M${f(x - nx * w)} ${f(y - ny * w)}Q${f(cx - nx * w * 1.3)} ${f(cy - ny * w * 1.3)} ${f(tx)} ${f(ty)}Q${f(cx + nx * w * 1.3)} ${f(cy + ny * w * 1.3)} ${f(x + nx * w)} ${f(y + ny * w)}Z`;
}

/** The midrib of a strap leaf. */
function strapRib(x: number, y: number, tx: number, ty: number, bend: number): string {
	const dx = tx - x;
	const dy = ty - y;
	const L = Math.hypot(dx, dy) || 1;
	const cx = (x + tx) / 2 + (-dy / L) * bend;
	const cy = (y + ty) / 2 + (dx / L) * bend;
	const ex = x + (tx - x) * 0.85;
	const ey = y + (ty - y) * 0.85;
	return qd(x, y, cx, cy, ex + (cx - (x + tx) / 2) * 0.3, ey + (cy - (y + ty) / 2) * 0.3);
}

/** A point at heading deg, distance d from (x, y). */
function at(x: number, y: number, deg: number, d: number): [number, number] {
	return [x + Math.cos(R(deg)) * d, y + Math.sin(R(deg)) * d];
}

/** Local (dx, dy) rotated by deg and scaled by k, from (x, y). */
function loc(x: number, y: number, deg: number, k: number, dx: number, dy: number): [number, number] {
	const c = Math.cos(R(deg));
	const sn = Math.sin(R(deg));
	return [x + (dx * c - dy * sn) * k, y + (dx * sn + dy * c) * k];
}

/** Golden-angle spiral points filling a disc. */
function disc(x: number, y: number, r: number, n: number): [number, number][] {
	const out: [number, number][] = [];
	for (let i = 0; i < n; i++) {
		const rr = r * Math.sqrt((i + 0.5) / n);
		const a = i * 137.5;
		out.push(at(x, y, a, rr));
	}
	return out;
}

/** Generic front-facing orchid: three sepals, two petals, a lip, an eye. */
interface FO {
	sep: string;
	pet?: string;
	lip: string;
	eye?: string;
	sl?: number;
	sw?: number;
	pl?: number;
	pw?: number;
	/** Petal angles (right side). */
	pa?: number;
	/** Lateral sepal angle (right side). */
	sa?: number;
	lr?: number;
}
function orc(L: Ly, x: number, y: number, k: number, o: FO, rot = 0): void {
	const { sep, pet = sep, lip, eye, sl = 5, sw = 1.5, pl = 4.6, pw = 1.6, pa = -15, sa = 55, lr = 1.8 } = o;
	L.f(sep, lens(x, y, -90 + rot, sl * k, sw * k) + lens(x, y, sa + rot, sl * k, sw * k) + lens(x, y, 180 - sa + rot, sl * k, sw * k));
	L.f(pet, lens(x, y, pa + rot, pl * k, pw * k) + lens(x, y, -180 - pa + rot, pl * k, pw * k));
	const [lx, ly] = loc(x, y, rot, k, 0, lr);
	L.f(lip, ov(lx, ly, lr * k, lr * 0.85 * k, 90 + rot));
	if (eye) L.f(eye, dot(x, y - 0.2 * k, 0.65 * k));
}

/* ---------- 1. Cattleya ---------- */
const CAT = { bulb: "#86a24c", leaf: "#5b8f45", rib: "#3f6a32", sheath: "#d8cc98", stem: "#7a8a45", sep: "#d9a8e4", pet: "#c98ad8", lip: "#9b2a7d", throat: "#f2cc4a" };
function catFlower(L: Ly, x: number, y: number, k: number): void {
	L.f(CAT.sep, lens(x, y, -90, 6.5 * k, 1.3 * k) + lens(x, y, 35, 6.3 * k, 1.2 * k) + lens(x, y, 145, 6.3 * k, 1.2 * k));
	L.f(CAT.pet, ov(x - 3.6 * k, y - 1.4 * k, 3.7 * k, 2.6 * k, 18) + ov(x + 3.6 * k, y - 1.4 * k, 3.7 * k, 2.6 * k, -18));
	const u = (dx: number, dy: number) => `${f(x + dx * k)} ${f(y + dy * k)}`;
	L.f(CAT.lip, `M${u(-1.4, 0)}L${u(1.4, 0)}Q${u(3.8, 2.6)} ${u(3, 5)}Q${u(0, 6.8)} ${u(-3, 5)}Q${u(-3.8, 2.6)} ${u(-1.4, 0)}Z` + dot(x - 2.4 * k, y + 5.4 * k, 1.1 * k) + dot(x + 2.4 * k, y + 5.4 * k, 1.1 * k) + dot(x, y + 6.1 * k, 1.2 * k));
	L.f(CAT.throat, ov(x, y + 2.4 * k, 1.7 * k, 0.9 * k, 90));
}
function cattleya(st: St): string {
	const L = new Ly([CAT.sheath, CAT.leaf, S(CAT.rib, 0.8), CAT.bulb, S(CAT.stem, 1), CAT.sep, CAT.pet, CAT.lip, CAT.throat]);
	const unit = (x: number, h: number, len: number, deg: number) => {
		const top = 87 - h;
		L.f(CAT.bulb, `M${f(x - 1)} 87Q${f(x - 3.4)} ${f(top + h * 0.4)} ${f(x - 2)} ${f(top)}L${f(x + 2)} ${f(top)}Q${f(x + 3.4)} ${f(top + h * 0.4)} ${f(x + 1)} 87Z`);
		const [tx, ty] = at(x, top + 1, deg, len);
		L.f(CAT.leaf, strap(x, top + 1, tx, ty, deg < -90 ? -1 : 1, 3.4));
		L.s(CAT.rib, 0.8, sg(x, top + 1, x + (tx - x) * 0.8, top + 1 + (ty - top - 1) * 0.8));
	};
	if (st === "sprout") {
		unit(40, 9, 13, -84);
		return L.toString();
	}
	if (st === "leafy") {
		unit(34, 14, 20, -98);
		unit(46, 15, 21, -80);
		L.f(CAT.sheath, ov(46.5, 68, 4, 1.5, -80));
		return L.toString();
	}
	unit(28, 15, 19, -112);
	unit(40, 18, 22, -94);
	unit(52, 16, 20, -70);
	L.f(CAT.sheath, ov(40.6, 66, 4.5, 1.6, -84));
	L.s(CAT.stem, 1, qd(41, 64, 42, 50, 44, 36) + qd(41, 64, 36, 52, 27, 44));
	catFlower(L, 46, 28, 2.1);
	catFlower(L, 24, 40, 1.6);
	return L.toString();
}

/* ---------- 2. Dendrobium ---------- */
const DEN = { cane: "#a9ae58", node: "#7d8238", leaf: "#6aa04e", sep: "#f6dbea", pet: "#e48abd", lip: "#f7ecd8", eye: "#6b1f3a" };
function dendrobium(st: St): string {
	const L = new Ly([S(DEN.cane, 3), S(DEN.node, 0.8), DEN.leaf, DEN.sep, DEN.pet, DEN.lip, DEN.eye]);
	const cane = (x0: number, x1: number, top: number, leaves: number, flowers: boolean) => {
		L.s(DEN.cane, 3, sg(x0, 86, x1, top));
		const n = Math.floor((86 - top) / 6);
		for (let i = 1; i <= n; i++) {
			const t = i / (n + 0.5);
			const x = x0 + (x1 - x0) * t;
			const y = 86 + (top - 86) * t;
			L.s(DEN.node, 0.8, sg(x - 1.6, y, x + 1.6, y));
			const side = i % 2 ? 1 : -1;
			if (i > n - leaves) L.f(DEN.leaf, lens(x, y, side > 0 ? -35 : -145, 8, 1.8));
			if (flowers && i > 2 && i <= n - 1 && (i + Math.round(x0)) % 2 === 0) orc(L, x + side * 4.4, y + 1, 1, { sep: DEN.sep, pet: DEN.pet, lip: DEN.lip, eye: DEN.eye, pw: 1.9 });
		}
	};
	if (st === "sprout") {
		cane(40, 40, 70, 3, false);
		return L.toString();
	}
	if (st === "leafy") {
		cane(35, 33, 44, 4, false);
		cane(45, 48, 52, 4, false);
		return L.toString();
	}
	cane(30, 24, 36, 2, true);
	cane(40, 40, 14, 2, true);
	cane(50, 56, 30, 2, true);
	return L.toString();
}

/* ---------- 3. Cymbidium ---------- */
const CYM = { leaf: "#4f8a45", leaf2: "#62a050", spike: "#7a8a40", sep: "#e7a87c", lip: "#f7ead2", spot: "#b8323a" };
function cymbidium(st: St): string {
	const L = new Ly([CYM.leaf2, CYM.leaf, S(CYM.spike, 1.4), CYM.sep, CYM.lip, CYM.spot]);
	const leaves = (list: readonly (readonly [number, number, number, number])[]) => {
		list.forEach(([x, tx, ty, b], i) => L.f(i % 2 ? CYM.leaf2 : CYM.leaf, strap(x, 86, tx, ty, b, 1.5)));
	};
	if (st === "sprout") {
		leaves([[39, 30, 68, -3], [41, 50, 66, 3], [40, 41, 64, 1]]);
		return L.toString();
	}
	if (st === "leafy") {
		leaves([[38, 12, 56, -8], [42, 68, 54, 8], [39, 22, 38, -6], [41, 58, 36, 6], [40, 34, 34, -3], [40, 46, 33, 3], [40, 8, 72, -6], [40, 72, 70, 6]]);
		return L.toString();
	}
	leaves([[38, 8, 56, -8], [42, 72, 58, 8], [39, 16, 36, -7], [41, 64, 38, 7], [40, 28, 30, -4], [40, 52, 32, 4], [40, 6, 74, -6], [40, 74, 72, 6]]);
	const P: P4 = [[44, 84], [44, 60], [46, 34], [50, 12]];
	L.s(CYM.spike, 1.4, cb(P));
	[0.45, 0.6, 0.75, 0.9].forEach((t, i) => {
		const [x, y] = bez(P, t);
		const side = i % 2 ? -1 : 1;
		const fx = x + side * 5;
		orc(L, fx, y + 1, 1.45, { sep: CYM.sep, lip: CYM.lip, sw: 1.7, pw: 1.7 });
		L.f(CYM.spot, dot(fx - 0.8, y + 3.4, 0.5) + dot(fx + 0.8, y + 3.6, 0.5) + dot(fx, y + 2, 0.5));
	});
	return L.toString();
}

/* ---------- 4. Dancing lady orchid ---------- */
const ONC = { bulb: "#8aa850", leaf: "#5f9a4c", stem: "#7a6a3a", y: "#f4c52e", br: "#8a5a1e" };
function lady(L: Ly, x: number, y: number, k = 1): void {
	L.f(ONC.br, lens(x, y, -155, 2.6 * k, 0.7 * k) + lens(x, y, -25, 2.6 * k, 0.7 * k) + dot(x, y - 1 * k, 0.9 * k));
	L.f(ONC.y, `M${f(x - 0.7 * k)} ${f(y)}L${f(x + 0.7 * k)} ${f(y)}Q${f(x + 3 * k)} ${f(y + 1.4 * k)} ${f(x + 2.6 * k)} ${f(y + 3 * k)}Q${f(x)} ${f(y + 3.8 * k)} ${f(x - 2.6 * k)} ${f(y + 3 * k)}Q${f(x - 3 * k)} ${f(y + 1.4 * k)} ${f(x - 0.7 * k)} ${f(y)}Z`);
}
function dancingLady(st: St): string {
	const L = new Ly([ONC.leaf, ONC.bulb, S(ONC.stem, 0.8), ONC.br, ONC.y]);
	const bulb = (x: number, h: number, l: number) => {
		L.f(ONC.bulb, ov(x, 87 - h / 2, h / 2, 3.4, 90));
		L.f(ONC.leaf, strap(x, 88 - h, x - l * 0.45, 88 - h - l, -3, 1.8) + strap(x, 88 - h, x + l * 0.4, 88 - h - l * 0.95, 3, 1.8));
	};
	if (st === "sprout") {
		bulb(40, 8, 12);
		return L.toString();
	}
	if (st === "leafy") {
		bulb(33, 12, 26);
		bulb(47, 13, 28);
		return L.toString();
	}
	bulb(30, 12, 26);
	bulb(44, 13, 26);
	const main: P4 = [[46, 76], [50, 40], [56, 14], [72, 24]];
	const br1: P4 = [[51, 34], [44, 24], [34, 16], [22, 22]];
	const br2: P4 = [[53, 24], [58, 18], [66, 10], [72, 12]];
	const br3: P4 = [[50, 44], [44, 40], [36, 38], [28, 42]];
	L.s(ONC.stem, 0.8, cb(main) + cb(br1) + cb(br2) + cb(br3));
	const spots: [P4, number[]][] = [[main, [0.62, 0.76, 0.88, 1]], [br1, [0.35, 0.6, 0.82, 1]], [br2, [0.5, 1]], [br3, [0.45, 0.75, 1]]];
	for (const [P, ts] of spots) for (const t of ts) {
		const [x, y] = bez(P, t);
		lady(L, x, y + 2.4, 1.3);
	}
	return L.toString();
}

/* ---------- 5. Tropical slipper orchid ---------- */
const PAP = { leaf: "#557f48", mot: "#8db27a", stem: "#5e3a36", dor: "#eef0dc", str: "#4f7a40", pet: "#a8784a", wart: "#3e1e1a", pouch: "#8a2f3a", hi: "#b04a55", stam: "#d9d6a8" };
function papLeaves(L: Ly, list: readonly (readonly [number, number, number])[]): void {
	for (const [tx, ty, b] of list) {
		L.f(PAP.leaf, strap(40, 85, tx, ty, b, 3.1));
		let d = "";
		for (const t of [0.3, 0.45, 0.6, 0.75]) {
			const x = 40 + (tx - 40) * t;
			const y = 85 + (ty - 85) * t + b * 0.4;
			d += ov(x, y, 1.2, 0.8, 0) + ov(x + (tx - 40) * 0.07, y + (ty - 85) * 0.07 + 1, 0.8, 0.5, 0);
		}
		L.f(PAP.mot, d);
	}
}
function slipper(st: St): string {
	const L = new Ly([S(PAP.stem, 1.4), PAP.leaf, PAP.mot, PAP.pet, PAP.wart, PAP.dor, S(PAP.str, 0.6), PAP.pouch, PAP.hi, PAP.stam]);
	if (st === "sprout") {
		papLeaves(L, [[26, 76, -2], [54, 75, 2], [40, 66, 0]]);
		return L.toString();
	}
	if (st === "leafy") {
		papLeaves(L, [[12, 74, -3], [68, 72, 3], [20, 58, -2], [60, 56, 2]]);
		L.s(PAP.stem, 1.4, sg(40, 82, 41, 44));
		L.f(PAP.pouch, ov(41.5, 42, 3.2, 2, 80));
		return L.toString();
	}
	papLeaves(L, [[10, 76, -3], [70, 74, 3], [16, 60, -2], [64, 58, 2]]);
	const x = 41;
	const y = 30;
	L.s(PAP.stem, 1.4, sg(40, 82, x, y + 2));
	L.f(PAP.pet, lens(x, y, 16, 14, 2.6) + lens(x, y, 164, 14, 2.6));
	L.f(PAP.wart, dot(x - 5, y + 2.6, 0.5) + dot(x - 8, y + 3.2, 0.5) + dot(x + 5, y + 2.6, 0.5) + dot(x + 8, y + 3.2, 0.5) + dot(x - 6.5, y + 1.4, 0.4) + dot(x + 6.5, y + 1.4, 0.4));
	L.f(PAP.dor, ov(x, y - 7, 6.2, 5.6, 90));
	let d = "";
	for (const a of [-130, -110, -90, -70, -50]) {
		const [ex, ey] = at(x, y - 1.6, a, 10.5);
		d += sg(x, y - 2, ex, ey);
	}
	L.s(PAP.str, 0.6, d);
	L.f(PAP.pouch, ov(x, y + 5, 4.8, 4, 90));
	L.f(PAP.hi, ov(x - 1.4, y + 4, 2, 1, 70));
	L.f(PAP.stam, ov(x, y + 0.4, 1.8, 1.2, 0));
	return L.toString();
}

/* ---------- 6. Vanda ---------- */
const VAN = { stem: "#6b8a45", leaf: "#5f9a52", leaf2: "#4f8a45", root: "#b9c2b0", rtip: "#7fae6a", fl: "#8274d8", chk: "#5a4bb2", lip: "#40348e" };
function vandaFlower(L: Ly, x: number, y: number, k: number): void {
	let d = "";
	for (let i = 0; i < 5; i++) {
		const a = -90 + i * 72;
		const [px, py] = at(x, y, a, 2.4 * k);
		d += ov(px, py, 2.5 * k, 2.1 * k, a);
	}
	L.f(VAN.fl, d);
	let c = "";
	for (let i = 0; i < 5; i++) {
		const a = -90 + i * 72;
		for (const [r, o] of [[2.6, -14], [3.6, 12]] as const) {
			const [px, py] = at(x, y, a + o, r * k);
			c += dot(px, py, 0.42 * k);
		}
	}
	L.f(VAN.chk, c);
	L.f(VAN.lip, ov(x, y + 0.9 * k, 1.3 * k, 0.9 * k, 90));
}
function vanda(st: St): string {
	const L = new Ly([S(VAN.root, 1.5), S(VAN.rtip, 1.5), S(VAN.stem, 2.4), VAN.leaf, VAN.leaf2, S(VAN.stem, 1), VAN.fl, VAN.chk, VAN.lip]);
	const plant = (top: number, len: number) => {
		L.s(VAN.stem, 2.4, sg(40, 86, 40, top));
		let i = 0;
		for (let y = 82; y > top; y -= 5.5) {
			const l = len * (0.75 + 0.25 * Math.min(1, (y - top) / 25));
			const side = i % 2 ? -1 : 1;
			const tx = 40 + side * l * 0.9;
			const ty = y - l * 0.45;
			L.f(i % 2 ? VAN.leaf : VAN.leaf2, strap(40, y, tx, ty, side * -2.5, 1.7));
			i++;
		}
	};
	if (st === "sprout") {
		plant(70, 10);
		return L.toString();
	}
	if (st === "leafy") {
		plant(44, 15);
		L.s(VAN.root, 1.5, qd(40, 76, 30, 80, 26, 88) + qd(40, 80, 50, 82, 54, 88));
		return L.toString();
	}
	plant(42, 16);
	L.s(VAN.root, 1.5, qd(40, 72, 28, 74, 24, 87) + qd(40, 76, 52, 78, 58, 87) + qd(40, 66, 30, 70, 18, 80));
	L.s(VAN.rtip, 1.5, sg(24.2, 85, 24, 87) + sg(57.6, 85, 58, 87) + sg(19.6, 79, 18, 80));
	L.s(VAN.stem, 1, qd(40, 58, 46, 32, 56, 20));
	vandaFlower(L, 34, 30, 1.5);
	vandaFlower(L, 49, 32, 1.6);
	vandaFlower(L, 44, 18, 1.5);
	vandaFlower(L, 60, 22, 1.5);
	return L.toString();
}

/* ---------- 7. Pansy orchid ---------- */
const MIL = { leaf: "#8bb07a", leaf2: "#a1c08e", stem: "#7a9a5a", pet: "#d84a7c", lip: "#f7eef2", mask: "#8a1e3a" };
function milFlower(L: Ly, x: number, y: number, k: number): void {
	L.f(MIL.pet, ov(x - 2.4 * k, y + 2.6 * k, 2.2 * k, 1.1 * k, 135) + ov(x + 2.4 * k, y + 2.6 * k, 2.2 * k, 1.1 * k, 45) + ov(x, y - 3 * k, 2.6 * k, 1.9 * k, 90) + ov(x - 3.3 * k, y - 0.8 * k, 2.9 * k, 2.1 * k, 160) + ov(x + 3.3 * k, y - 0.8 * k, 2.9 * k, 2.1 * k, 20));
	L.f(MIL.lip, ov(x - 1.9 * k, y + 3 * k, 2.6 * k, 3.1 * k) + ov(x + 1.9 * k, y + 3 * k, 2.6 * k, 3.1 * k));
	L.f(MIL.mask, dot(x, y + 0.8 * k, 1.3 * k));
	L.s(MIL.mask, Math.round(5.5 * k) / 10, sg(x, y + 1, x - 2.2 * k, y + 3.6 * k) + sg(x, y + 1, x, y + 4.4 * k) + sg(x, y + 1, x + 2.2 * k, y + 3.6 * k));
}
function pansyOrchid(st: St): string {
	const L = new Ly([MIL.leaf, MIL.leaf2, S(MIL.stem, 1)]);
	const tuft = (n: number, len: number) => {
		for (let i = 0; i < n; i++) {
			const a = -150 + (120 * i) / (n - 1);
			L.f(i % 2 ? MIL.leaf : MIL.leaf2, lens(40, 86, a, len * (1 - Math.abs(a + 90) / 260), 1.7));
		}
	};
	if (st === "sprout") {
		tuft(5, 16);
		return L.toString();
	}
	if (st === "leafy") {
		tuft(9, 34);
		return L.toString();
	}
	tuft(11, 36);
	L.s(MIL.stem, 1, qd(38, 80, 30, 60, 24, 44) + qd(42, 80, 50, 56, 56, 40) + qd(40, 80, 40, 50, 40, 30));
	milFlower(L, 40, 26, 1.7);
	milFlower(L, 22, 44, 1.6);
	milFlower(L, 58, 40, 1.6);
	return L.toString();
}

/* ---------- 8. Zygopetalum ---------- */
const ZYG = { bulb: "#7ea24e", leaf: "#4f8a45", leaf2: "#5f9a52", stem: "#6f8a40", sep: "#98b84a", blot: "#6b3a25", lip: "#f3effa", vein: "#6a4fb4" };
function zygFlower(L: Ly, x: number, y: number, k: number): void {
	L.f(ZYG.sep, lens(x, y, -90, 5.4 * k, 1.5 * k) + lens(x, y, 40, 5.4 * k, 1.5 * k) + lens(x, y, 140, 5.4 * k, 1.5 * k) + lens(x, y, -30, 5 * k, 1.5 * k) + lens(x, y, -150, 5 * k, 1.5 * k));
	let d = "";
	for (const a of [-90, 40, 140, -30, -150]) {
		const [px, py] = at(x, y, a, 2.4 * k);
		const [qx, qy] = at(x, y, a, 3.8 * k);
		d += dot(px, py, 0.6 * k) + dot(qx, qy, 0.45 * k);
	}
	L.f(ZYG.blot, d);
	L.f(ZYG.lip, ov(x, y + 3.6 * k, 3 * k, 2.6 * k, 90));
	let v = "";
	for (const a of [55, 75, 90, 105, 125]) {
		const [ex, ey] = at(x, y + 1.6 * k, a, 4.2 * k);
		v += sg(x, y + 1.6 * k, ex, ey);
	}
	L.s(ZYG.vein, 0.6, v);
}
function zygopetalum(st: St): string {
	const L = new Ly([ZYG.leaf2, ZYG.leaf, ZYG.bulb, S(ZYG.stem, 1.2), ZYG.sep, ZYG.blot, ZYG.lip, S(ZYG.vein, 0.6)]);
	const bulb = (x: number, rx: number, ry: number, leaves: readonly (readonly [number, number, number])[]) => {
		leaves.forEach(([tx, ty, b], i) => L.f(i % 2 ? ZYG.leaf2 : ZYG.leaf, strap(x, 88 - ry * 2, tx, ty, b, 1.9)));
		L.f(ZYG.bulb, ov(x, 87 - ry, ry, rx, 90));
	};
	if (st === "sprout") {
		bulb(40, 3, 4, [[32, 66, -2], [48, 68, 2]]);
		return L.toString();
	}
	if (st === "leafy") {
		bulb(34, 4.4, 6, [[14, 44, -4], [30, 36, -2], [42, 38, 2]]);
		bulb(47, 4, 5.5, [[64, 42, 4], [54, 34, 2], [70, 56, 4]]);
		return L.toString();
	}
	bulb(32, 4.6, 6.4, [[10, 48, -4], [24, 38, -2], [38, 42, 2]]);
	bulb(48, 4.4, 6, [[68, 46, 4], [58, 38, 2], [72, 62, 4]]);
	L.s(ZYG.stem, 1.2, qd(40, 86, 40, 50, 46, 18) + qd(40, 70, 34, 50, 29, 32) + qd(41, 66, 48, 52, 55, 42));
	zygFlower(L, 46, 18, 1.9);
	zygFlower(L, 29, 32, 1.75);
	zygFlower(L, 55, 42, 1.6);
	return L.toString();
}

/* ---------- 9. Masdevallia ---------- */
const MAS = { leaf: "#4a8a48", leaf2: "#5c9c52", stalk: "#5f8a45", fl: "#ec5a2c", vein: "#b5361c", throat: "#7a1e10" };
const MAS_PTS = [0, -11, 1.2, -3.6, 4.6, -1.2, 6, 0.2, 9.6, 7.2, 4, 3.6, 0, 4.6, -4, 3.6, -9.6, 7.2, -6, 0.2, -4.6, -1.2, -1.2, -3.6];
function masFlower(L: Ly, x: number, y: number, k: number, deg: number): void {
	L.f(MAS.fl, poly(x, y, deg, k, MAS_PTS));
	const o = loc(x, y, deg, k, 0, 3.2);
	let v = "";
	for (const [dx, dy] of [[-4.6, 0.6], [4.6, 0.6], [0, -4]] as const) {
		const e = loc(x, y, deg, k, dx, dy);
		v += sg(o[0], o[1], e[0], e[1]);
	}
	L.s(MAS.vein, 0.6, v);
	L.f(MAS.throat, dot(o[0], o[1], 0.9 * k));
}
function masLeaves(L: Ly, n: number, h: number): void {
	for (let i = 0; i < n; i++) {
		const a = -122 + (64 * i) / (n - 1);
		const [px, py] = at(40, 86, a, h * 0.4);
		L.s(MAS.stalk, 1.1, sg(40, 86, px, py));
		L.f(i % 2 ? MAS.leaf : MAS.leaf2, lens(px, py, a, h * 0.6, 2.6));
	}
}
function masdevallia(st: St): string {
	const L = new Ly([S(MAS.stalk, 0.9), S(MAS.stalk, 1.1), MAS.leaf, MAS.leaf2, MAS.fl, S(MAS.vein, 0.6), MAS.throat]);
	if (st === "sprout") {
		masLeaves(L, 4, 18);
		return L.toString();
	}
	if (st === "leafy") {
		masLeaves(L, 6, 34);
		L.s(MAS.stalk, 0.9, qd(42, 84, 48, 60, 52, 46));
		L.f(MAS.fl, lens(52, 46, -70, 5, 1.3));
		return L.toString();
	}
	masLeaves(L, 7, 36);
	L.s(MAS.stalk, 0.9, qd(40, 84, 28, 56, 22, 36) + qd(41, 84, 44, 50, 42, 26) + qd(42, 84, 56, 56, 60, 38));
	masFlower(L, 22, 31, 1.15, -18);
	masFlower(L, 42, 21, 1.2, 4);
	masFlower(L, 60, 33, 1.15, 20);
	return L.toString();
}

/* ---------- 10. Jewel orchid ---------- */
const JEW = { leaf: "#5e3653", leaf2: "#4e2a46", vein: "#e8a7bf", stem: "#8a3f55", fl: "#f7f3ea", eye: "#f0cf4a" };
function jewelLeaf(L: Ly, x: number, y: number, deg: number, len: number, alt: boolean): void {
	const [cx, cy] = at(x, y, deg, len / 2);
	L.f(alt ? JEW.leaf2 : JEW.leaf, ov(cx, cy, len / 2, len * 0.3, deg));
	const a = loc(cx, cy, deg, 1, -len * 0.42, 0);
	const b = loc(cx, cy, deg, 1, len * 0.42, 0);
	let v = sg(a[0], a[1], b[0], b[1]);
	for (const s of [-1, 1]) {
		const p1 = loc(cx, cy, deg, 1, -len * 0.25, 0);
		const p2 = loc(cx, cy, deg, 1, len * 0.2, s * len * 0.2);
		const p3 = loc(cx, cy, deg, 1, len * 0.1, 0);
		const p4 = loc(cx, cy, deg, 1, len * 0.38, s * len * 0.12);
		v += sg(p1[0], p1[1], p2[0], p2[1]) + sg(p3[0], p3[1], p4[0], p4[1]);
	}
	L.s(JEW.vein, 0.5, v);
}
function jewel(st: St): string {
	const L = new Ly([S(JEW.stem, 1.6), JEW.leaf, JEW.leaf2, S(JEW.vein, 0.5), S(JEW.stem, 1.2), JEW.fl, JEW.eye]);
	const rosette = (x: number, y: number, k: number, angs: readonly number[]) => angs.forEach((a, i) => jewelLeaf(L, x, y, a, 13 * k, i % 2 === 1));
	if (st === "sprout") {
		L.s(JEW.stem, 1.6, sg(40, 86, 40, 76));
		rosette(40, 77, 0.9, [-160, -20, -90]);
		return L.toString();
	}
	const spike = (x: number, y: number, top: number, flowers: boolean) => {
		L.s(JEW.stem, 1.2, sg(x, y, x + 1, top));
		if (!flowers) {
			L.f(JEW.fl, ov(x + 1, top + 2, 2.4, 1.2, 90));
			return;
		}
		let d = "";
		let e = "";
		for (let i = 0; i < 9; i++) {
			const fy = top + 1 + i * 2.2;
			const fx = x + 1 + (i % 2 ? -1.9 : 1.9);
			d += dot(fx, fy, 1.25) + lens(fx, fy, i % 2 ? -150 : -30, 2.6, 0.6);
			e += dot(fx, fy + 0.6, 0.45);
		}
		L.f(JEW.fl, d);
		L.f(JEW.eye, e);
	};
	if (st === "leafy") {
		L.s(JEW.stem, 1.6, qd(40, 86, 34, 78, 26, 76) + qd(40, 86, 46, 74, 52, 70));
		rosette(26, 76, 0.95, [-170, 160, -120, -60]);
		rosette(52, 70, 1, [-150, -30, 20, -90]);
		spike(52, 66, 44, false);
		return L.toString();
	}
	L.s(JEW.stem, 1.6, qd(40, 86, 32, 80, 22, 78) + qd(40, 86, 48, 74, 56, 70) + sg(40, 86, 40, 70));
	rosette(22, 78, 1, [-175, 165, -125, -60]);
	rosette(56, 70, 1, [-150, -20, 25, -95]);
	rosette(40, 70, 0.9, [-130, -50, 200]);
	spike(55, 64, 30, true);
	spike(40, 66, 38, true);
	return L.toString();
}

/* ---------- 11. Lady's slipper orchid ---------- */
const CYP = { leaf: "#6aa652", leaf2: "#5a9646", vein: "#477d3a", stem: "#5a8a40", pouch: "#f2c836", pdot: "#b8452a", pet: "#7a3f22" };
function cypLeaf(L: Ly, x: number, y: number, deg: number, len: number, alt: boolean): void {
	const [cx, cy] = at(x, y, deg, len * 0.5);
	L.f(alt ? CYP.leaf2 : CYP.leaf, ov(cx, cy, len * 0.5, len * 0.24, deg));
	let v = "";
	for (const o of [-0.12, 0, 0.12]) {
		const a = loc(cx, cy, deg, len, -0.4, o * 0.6);
		const b = loc(cx, cy, deg, len, 0.4, o);
		v += sg(a[0], a[1], b[0], b[1]);
	}
	L.s(CYP.vein, 0.5, v);
}
function ladySlipper(st: St): string {
	const L = new Ly([S(CYP.stem, 1.8), CYP.leaf, CYP.leaf2, S(CYP.vein, 0.5), S(CYP.pet, 1.4), CYP.pet, CYP.pouch, CYP.pdot]);
	if (st === "sprout") {
		L.s(CYP.stem, 1.8, sg(40, 86, 40, 76));
		cypLeaf(L, 40, 82, -125, 13, false);
		cypLeaf(L, 40, 78, -60, 12, true);
		return L.toString();
	}
	const top = st === "leafy" ? 42 : 28;
	L.s(CYP.stem, 1.8, qd(40, 86, 40, 50, 42, top));
	cypLeaf(L, 40, 80, -150, 20, false);
	cypLeaf(L, 40, 72, -32, 20, true);
	cypLeaf(L, 40, 62, -145, 18, false);
	cypLeaf(L, 41, 54, -40, 16, true);
	if (st === "leafy") {
		L.f(CYP.leaf2, lens(42, 46, -80, 7, 1.6));
		return L.toString();
	}
	const x = 44;
	const y = 28;
	L.s(CYP.stem, 1.8, qd(42, 30, 42, 26, x, y - 1));
	L.f(CYP.pet, lens(x, y - 2, -100, 12, 2.8));
	L.s(CYP.pet, 1.6, `M${x - 1} ${y}q-4 1-5 4t-4 5-3 6-4 5M${x + 1} ${y}q4 1 5 4t4 5 3 6 4 5`);
	L.f(CYP.pouch, ov(x, y + 5.4, 6, 4.8, 0));
	L.f(CYP.pdot, dot(x - 1.8, y + 2.6, 0.6) + dot(x + 1.6, y + 2.8, 0.6) + dot(x, y + 2, 0.55));
	return L.toString();
}

/* ---------- 12. Bee orchid ---------- */
const BEE = { leaf: "#7a9e64", leaf2: "#8cb070", stem: "#6b8a4a", sep: "#eba6c6", horn: "#7fae5a", body: "#5e3a20", mark: "#e6c25a" };
function beeFlower(L: Ly, x: number, y: number, k: number): void {
	L.f(BEE.sep, lens(x, y, -90, 5.4 * k, 1.9 * k) + lens(x, y, -5, 5.6 * k, 1.9 * k) + lens(x, y, -175, 5.6 * k, 1.9 * k));
	L.f(BEE.horn, lens(x, y - 0.4 * k, -50, 2.6 * k, 0.6 * k) + lens(x, y - 0.4 * k, -130, 2.6 * k, 0.6 * k) + dot(x, y - 0.4 * k, 1 * k));
	L.f(BEE.body, ov(x, y + 3 * k, 2.8 * k, 2.3 * k, 90));
	L.s(BEE.mark, 0.6, `M${f(x - 1.3 * k)} ${f(y + 1.6 * k)}Q${f(x)} ${f(y + 4 * k)} ${f(x + 1.3 * k)} ${f(y + 1.6 * k)}` + sg(x - 1 * k, y + 4.5 * k, x + 1 * k, y + 4.5 * k));
}
function beeOrchid(st: St): string {
	const L = new Ly([S(BEE.stem, 1.2), BEE.leaf, BEE.leaf2, BEE.sep, BEE.horn, BEE.body, S(BEE.mark, 0.6)]);
	const rosette = (len: number) => {
		L.f(BEE.leaf, lens(40, 86, -172, len, 2.6) + lens(40, 86, -8, len, 2.6) + lens(40, 86, -115, len * 0.8, 2.2));
		L.f(BEE.leaf2, lens(40, 86, -150, len * 0.9, 2.4) + lens(40, 86, -30, len * 0.9, 2.4) + lens(40, 86, -70, len * 0.75, 2.2));
	};
	if (st === "sprout") {
		rosette(12);
		return L.toString();
	}
	if (st === "leafy") {
		L.s(BEE.stem, 1.2, sg(40, 84, 40, 42));
		rosette(18);
		L.f(BEE.leaf2, ov(40, 42, 3, 1.6, 90) + ov(41.6, 52, 2.6, 1.4, 70));
		return L.toString();
	}
	L.s(BEE.stem, 1.2, qd(40, 84, 39, 50, 41, 18));
	rosette(19);
	beeFlower(L, 41, 22, 1.4);
	beeFlower(L, 37, 39, 1.55);
	beeFlower(L, 44, 56, 1.55);
	return L.toString();
}

/* ---------- 13. Vanilla orchid ---------- */
const VNL = { pole: "#9a7550", poleD: "#7a5a3a", vine: "#5f8a40", leaf: "#5c9a48", leaf2: "#6fae58", fl: "#e2dc96", lip: "#f5ecc4", throat: "#e8b83a", bean: "#5f7f30", ripe: "#5a3a22" };
function vanilla(st: St): string {
	const L = new Ly([VNL.pole, S(VNL.poleD, 0.7), S(VNL.vine, 1.4), VNL.leaf, VNL.leaf2, S(VNL.bean, 2.2), S(VNL.ripe, 2.2), VNL.fl, VNL.lip, VNL.throat]);
	const plant = (top: number, n: number, len: number) => {
		L.f(VNL.pole, `M37 88L37 ${top + 1}Q40 ${top - 1} 43 ${top + 1}L43 88Z`);
		L.s(VNL.poleD, 0.7, sg(39, 86, 39, top + 4) + sg(41.4, 82, 41.4, top + 8));
		let d = "M40 86";
		let y = 86;
		for (let i = 0; i < n; i++) {
			const side = i % 2 ? -1 : 1;
			const ny = y - (86 - top) / n;
			d += `Q${40 + side * 9} ${f((y + ny) / 2)} 40 ${f(ny)}`;
			const [lx, ly] = [40 + side * 6.6, (y + ny) / 2];
			L.f(i % 2 ? VNL.leaf : VNL.leaf2, ov(...at(lx, ly, side > 0 ? -25 : -155, len / 2), len / 2, len * 0.28, side > 0 ? -25 : -155));
			y = ny;
		}
		L.s(VNL.vine, 1.4, d);
	};
	if (st === "sprout") {
		plant(68, 2, 8);
		return L.toString();
	}
	if (st === "leafy") {
		plant(38, 5, 11);
		return L.toString();
	}
	plant(16, 7, 12);
	L.s(VNL.bean, 2.2, qd(36, 44, 30, 46, 29, 52) + sg(29, 52, 30, 70) + sg(30.5, 52, 34, 68));
	L.s(VNL.ripe, 2.2, sg(28.4, 52, 25, 67));
	for (const [x, y, r] of [[57, 20, 15], [62, 36, 25], [22, 28, -10]] as const) {
		orc(L, x, y, 1.6, { sep: VNL.fl, lip: VNL.lip, eye: VNL.throat, sw: 1.1, pw: 1.1, sa: 60, pa: -40, lr: 2.2 }, r);
	}
	return L.toString();
}

/* ---------- 14. Monkey face orchid ---------- */
const DRA = { leaf: "#5f9a52", leaf2: "#4a8040", stalk: "#6a7a40", sep: "#a8344c", spot: "#6e1a2e", tail: "#5a1a2a", face: "#f2e8de", eye: "#3a1a22" };
function monkey(L: Ly, x: number, y: number, k: number): void {
	let d = "";
	let t = "";
	for (const a of [-90, 30, 150]) {
		const [px, py] = at(x, y, a, 2 * k);
		d += dot(px, py, 2.9 * k);
		const [sx, sy] = at(x, y, a, 4.4 * k);
		const [ex, ey] = at(x, y, a + 12, 10.5 * k);
		const [cx, cy] = at(x, y, a - 10, 8 * k);
		t += qd(sx, sy, cx, cy, ex, ey);
	}
	L.f(DRA.sep, d);
	L.s(DRA.tail, 0.9, t);
	let s = "";
	for (const a of [-60, -120, 10, 60, 120, 170, -90]) {
		const [px, py] = at(x, y, a, 3.7 * k);
		s += dot(px, py, 0.4 * k);
	}
	L.f(DRA.spot, s);
	L.f(DRA.face, ov(x, y + 0.3 * k, 2.2 * k, 1.9 * k, 90));
	L.f(DRA.eye, dot(x - 0.8 * k, y - 0.5 * k, 0.45 * k) + dot(x + 0.8 * k, y - 0.5 * k, 0.45 * k) + ov(x, y + 1.3 * k, 0.6 * k, 0.9 * k, 0));
}
function monkeyFace(st: St): string {
	const L = new Ly([DRA.leaf, DRA.leaf2, S(DRA.stalk, 0.9), DRA.sep, S(DRA.tail, 0.9), DRA.spot, DRA.face, DRA.eye]);
	const tuft = (n: number, len: number) => {
		for (let i = 0; i < n; i++) {
			const a = -125 + (70 * i) / (n - 1);
			L.f(i % 2 ? DRA.leaf : DRA.leaf2, lens(40, 86, a, len * (1 - Math.abs(a + 90) / 200), 2.2));
		}
	};
	if (st === "sprout") {
		tuft(4, 18);
		return L.toString();
	}
	if (st === "leafy") {
		tuft(7, 40);
		L.s(DRA.stalk, 0.9, qd(38, 84, 26, 72, 20, 76));
		L.f(DRA.sep, ov(20, 78, 2.2, 1.6, 90));
		return L.toString();
	}
	tuft(7, 42);
	L.s(DRA.stalk, 0.9, qd(38, 84, 20, 66, 18, 54) + qd(42, 84, 60, 62, 62, 48));
	monkey(L, 18, 60, 1.55);
	monkey(L, 62, 54, 1.55);
	L.s(DRA.stalk, 0.9, qd(40, 82, 46, 50, 40, 30));
	monkey(L, 40, 34, 1.4);
	return L.toString();
}

/* ---------- 15. Ghost orchid ---------- */
const GHO = { bark: "#8a6242", barkD: "#6a4a32", root: "#a9b59c", rootT: "#86b06a", fl: "#e9eedc", vein: "#9fae88", col: "#9fbf7a", ped: "#8aa070" };
function ghostFlower(L: Ly, x: number, y: number, k: number): void {
	L.f(GHO.fl, lens(x, y, -90, 4 * k, 0.8 * k) + lens(x, y, -30, 4 * k, 0.8 * k) + lens(x, y, -150, 4 * k, 0.8 * k) + ov(x, y + 2.2 * k, 2.4 * k, 1.8 * k, 90));
	L.s(GHO.fl, 1.1, `M${f(x - 0.8 * k)} ${f(y + 3.6 * k)}q${f(-2 * k)} ${f(3 * k)} ${f(-5 * k)} ${f(6 * k)}t${f(-1 * k)} ${f(4 * k)}M${f(x + 0.8 * k)} ${f(y + 3.6 * k)}q${f(2 * k)} ${f(3 * k)} ${f(5 * k)} ${f(6 * k)}t${f(1 * k)} ${f(4 * k)}`);
	L.s(GHO.vein, 0.5, sg(x, y + 1, x, y + 3.6 * k));
	L.f(GHO.col, dot(x, y, 0.7 * k));
}
function ghost(st: St): string {
	const L = new Ly([GHO.bark, S(GHO.barkD, 0.7), S(GHO.root, 1.3), S(GHO.rootT, 1.3), S(GHO.ped, 0.8), GHO.fl, S(GHO.fl, 1.1), S(GHO.vein, 0.5), GHO.col]);
	const stump = (top: number) => {
		L.f(GHO.bark, `M33 88L34 ${top + 3}L37 ${top}L40 ${top + 2}L44 ${top - 1}L46 ${top + 3}L47 88Z`);
		L.s(GHO.barkD, 0.7, sg(36.5, 84, 36, top + 6) + sg(43.6, 86, 44, top + 8) + sg(40.4, 80, 40, top + 14));
	};
	if (st === "sprout") {
		stump(74);
		L.s(GHO.root, 1.3, qd(40, 77, 34, 78, 30, 84) + qd(40, 77, 47, 76, 51, 82) + qd(40, 77, 37, 74, 33, 72));
		L.s(GHO.rootT, 1.3, sg(29.6, 84.6, 29.3, 85) + sg(51.3, 82.6, 51.5, 83));
		return L.toString();
	}
	const top = st === "leafy" ? 52 : 50;
	stump(top);
	const c: [number, number] = [40, top + 12];
	const ends: readonly (readonly [number, number, number, number])[] = [[22, 62, 30, 58], [58, 60, 50, 56], [26, 80, 30, 70], [56, 80, 52, 70], [30, 46, 34, 52], [52, 44, 48, 50], [20, 72, 26, 66], [62, 70, 56, 66], [36, 86, 40, 78]];
	let r = "";
	let tips = "";
	for (const [ex, ey, cx, cy] of ends) {
		r += qd(c[0], c[1], cx, cy, ex, ey);
		tips += sg(ex, ey, ex + (ex - cx) * 0.12, ey + (ey - cy) * 0.12);
	}
	L.s(GHO.root, 1.3, r);
	L.s(GHO.rootT, 1.3, tips);
	if (st === "leafy") return L.toString();
	L.s(GHO.ped, 0.8, qd(46, 58, 56, 46, 56, 28) + qd(36, 56, 26, 46, 26, 36));
	ghostFlower(L, 56, 24, 1.5);
	ghostFlower(L, 26, 33, 1.25);
	return L.toString();
}

/* ---------- 16. Spider orchid ---------- */
const BRA = { bulb: "#8aa850", leaf: "#5f9a4c", leaf2: "#4f8a45", stem: "#6f8a40", sep: "#d2c24a", spot: "#7a4a22", lip: "#f2edc4" };
function spider(L: Ly, x: number, y: number, k: number, rot: number): void {
	const arms: readonly (readonly [number, number])[] = [[-95, 9], [72, 13], [108, 13], [-25, 7], [-155, 7]];
	let d = "";
	let s = "";
	for (const [a, l] of arms) {
		d += lens(x, y, a + rot, l * k, 0.75 * k);
		for (const t of [0.25, 0.45]) {
			const [px, py] = at(x, y, a + rot, l * k * t);
			s += dot(px, py, 0.42 * k);
		}
	}
	L.f(BRA.sep, d);
	L.f(BRA.spot, s);
	L.f(BRA.lip, lens(x, y + 0.5, 90 + rot, 6 * k, 1.6 * k));
	const [qx, qy] = at(x, y, 90 + rot, 1.8 * k);
	L.f(BRA.spot, dot(qx, qy, 0.45 * k));
}
function spiderOrchid(st: St): string {
	const L = new Ly([BRA.leaf2, BRA.leaf, BRA.bulb, S(BRA.stem, 1), BRA.sep, BRA.lip, BRA.spot]);
	const unit = (x: number, h: number, ls: readonly (readonly [number, number, number])[]) => {
		ls.forEach(([tx, ty, b], i) => L.f(i % 2 ? BRA.leaf : BRA.leaf2, strap(x, 88 - h, tx, ty, b, 2)));
		L.f(BRA.bulb, ov(x, 87 - h / 2, h / 2, 3.6, 90));
	};
	if (st === "sprout") {
		unit(40, 7, [[34, 66, -2], [46, 64, 2]]);
		return L.toString();
	}
	if (st === "leafy") {
		unit(36, 12, [[24, 40, -3], [40, 36, 2]]);
		unit(48, 10, [[60, 42, 3]]);
		return L.toString();
	}
	unit(32, 12, [[20, 44, -3], [34, 40, 2]]);
	unit(46, 11, [[56, 46, 3]]);
	const P: P4 = [[40, 78], [38, 36], [52, 14], [68, 40]];
	L.s(BRA.stem, 1, cb(P));
	const pts: readonly (readonly [number, number])[] = [[0.42, -1], [0.7, 1], [0.97, 1]];
	for (const [t, side] of pts) {
		const [x, y] = bez(P, t);
		spider(L, x + side * 3, y + 4, 1.2, side * 10);
	}
	return L.toString();
}

/* ---------- 17. Crucifix orchid ---------- */
const EPI = { stem: "#6f9a4a", leaf: "#5c9a48", leaf2: "#6fae58", back: "#d8641e", fl: "#f39a2c", lip: "#f7d23a", bud: "#9cc070" };
function epiBall(L: Ly, x: number, y: number, r: number): void {
	L.f(EPI.back, dot(x, y, r + 0.6));
	let d = "";
	let l = "";
	for (const [px, py] of disc(x, y, r - 0.9, 13)) {
		d += dot(px, py, 1.35);
		l += dot(px, py + 0.4, 0.6);
	}
	L.f(EPI.fl, d);
	L.f(EPI.lip, l);
}
function crucifix(st: St): string {
	const L = new Ly([S(EPI.stem, 1.6), EPI.leaf, EPI.leaf2, EPI.bud, EPI.back, EPI.fl, EPI.lip]);
	const reed = (x0: number, x1: number, top: number, leafTo: number) => {
		L.s(EPI.stem, 1.6, sg(x0, 87, x1, top));
		let i = 0;
		for (let y = 82; y > leafTo; y -= 5) {
			const t = (87 - y) / (87 - top);
			const x = x0 + (x1 - x0) * t;
			const side = i % 2 ? -1 : 1;
			L.f(i % 2 ? EPI.leaf : EPI.leaf2, lens(x, y, side > 0 ? -30 : -150, 7, 1.7));
			i++;
		}
	};
	if (st === "sprout") {
		reed(40, 40, 68, 70);
		return L.toString();
	}
	if (st === "leafy") {
		reed(36, 34, 40, 48);
		reed(45, 47, 48, 54);
		L.f(EPI.bud, dot(34, 39, 2.6));
		return L.toString();
	}
	reed(33, 28, 30, 48);
	reed(41, 43, 20, 40);
	reed(48, 55, 36, 54);
	epiBall(L, 28, 28, 5.6);
	epiBall(L, 55, 33, 5);
	epiBall(L, 43, 16, 6.2);
	return L.toString();
}

/* ---------- 18. Hardy ground orchid ---------- */
const BLE = { leaf: "#7eb260", leaf2: "#6aa052", pleat: "#4f8a40", stem: "#6a8a40", fl: "#cf4e94", lip: "#9a2468", ridge: "#f3e2ec" };
function bletilla(st: St): string {
	const L = new Ly([BLE.leaf2, BLE.leaf, S(BLE.pleat, 0.5), S(BLE.stem, 1), BLE.fl, BLE.lip, S(BLE.ridge, 0.5)]);
	const leaves = (list: readonly (readonly [number, number])[]) => {
		let pl = "";
		list.forEach(([a, len], i) => {
			L.f(i % 2 ? BLE.leaf : BLE.leaf2, lens(40, 86, a, len, 3.8));
			for (const o of [-1.4, 0, 1.4]) {
				const p1 = loc(40, 86, a, 1, len * 0.1, o * 0.4);
				const p2 = loc(40, 86, a, 1, len * 0.8, o * 0.6);
				pl += sg(p1[0], p1[1], p2[0], p2[1]);
			}
		});
		L.s(BLE.pleat, 0.5, pl);
	};
	if (st === "sprout") {
		leaves([[-105, 15], [-75, 13]]);
		return L.toString();
	}
	if (st === "leafy") {
		leaves([[-130, 30], [-50, 30], [-105, 38], [-75, 36]]);
		return L.toString();
	}
	leaves([[-135, 32], [-45, 32], [-108, 40], [-72, 38]]);
	const P: P4 = [[41, 84], [42, 40], [44, 20], [62, 16]];
	const Q: P4 = [[39, 84], [37, 50], [30, 30], [16, 30]];
	L.s(BLE.stem, 1, cb(P) + cb(Q));
	let r = "";
	for (const [B, ts] of [[P, [0.72, 0.86, 1]], [Q, [0.78, 1]]] as const) {
		for (const t of ts) {
			const [x, y] = bez(B, t);
			const fy = y + 2.5;
			orc(L, x, fy, 1.45, { sep: BLE.fl, lip: BLE.lip, sl: 4.8, sw: 1.1, pl: 4.4, pw: 1.2, pa: -55, sa: 70, lr: 2.2 }, 0);
			r += sg(x, fy + 1.4, x, fy + 4.6);
		}
	}
	L.s(BLE.ridge, 0.5, r);
	return L.toString();
}

/* ---------- 19. Calanthe ---------- */
const CAL = { leaf: "#5c9850", leaf2: "#6aa65a", pleat: "#467a3c", stem: "#8aa060", fl: "#f6f2ea", sep: "#cddcae", eye: "#e0566a", bud: "#c8dcae" };
function calanthe(st: St): string {
	const L = new Ly([CAL.leaf, CAL.leaf2, S(CAL.pleat, 0.5), S(CAL.stem, 1.4), CAL.bud, CAL.sep, CAL.fl, CAL.eye]);
	const leaves = (list: readonly (readonly [number, number, number])[]) => {
		let pl = "";
		list.forEach(([a, len, w], i) => {
			const [cx, cy] = at(40, 86, a, len / 2);
			L.f(i % 2 ? CAL.leaf2 : CAL.leaf, ov(cx, cy, len / 2, w, a));
			for (const o of [-0.5, 0, 0.5]) {
				const p1 = loc(cx, cy, a, 1, -len * 0.4, o * w * 0.5);
				const p2 = loc(cx, cy, a, 1, len * 0.42, o * w * 0.8);
				pl += sg(p1[0], p1[1], p2[0], p2[1]);
			}
		});
		L.s(CAL.pleat, 0.5, pl);
	};
	if (st === "sprout") {
		leaves([[-115, 15, 3.6], [-70, 14, 3.4]]);
		return L.toString();
	}
	if (st === "leafy") {
		leaves([[-150, 30, 6], [-30, 30, 6], [-100, 34, 6.4]]);
		return L.toString();
	}
	leaves([[-155, 31, 6], [-25, 31, 6], [-120, 30, 5.6], [-68, 30, 5.6]]);
	L.s(CAL.stem, 1.4, sg(40, 84, 41, 10));
	L.f(CAL.bud, ov(41, 11, 2.2, 1.6, 90) + dot(38.8, 15, 1.3) + dot(43.2, 15.4, 1.3));
	let d = "";
	let s = "";
	let e = "";
	for (let i = 0; i < 6; i++) {
		const y = 19 + i * 5.4;
		const x = 41 + (i % 2 ? -5 : 5);
		s += lens(x, y, -90, 4, 1.1) + lens(x, y, -20, 4, 1.1) + lens(x, y, -160, 4, 1.1);
		d += ov(x - 1.6, y + 2, 1.7, 1.4, 0) + ov(x + 1.6, y + 2, 1.7, 1.4, 0) + ov(x - 1.4, y + 4.6, 1.5, 1.4, 0) + ov(x + 1.4, y + 4.6, 1.5, 1.4, 0);
		e += dot(x, y + 0.8, 0.7);
	}
	L.f(CAL.sep, s);
	L.f(CAL.fl, d);
	L.f(CAL.eye, e);
	return L.toString();
}

/* ---------- 20. Lycaste ---------- */
const LYC = { bulb: "#8aa850", bulbD: "#6a8a3e", spine: "#7a6a3a", leaf: "#7fb35e", leaf2: "#6aa052", pleat: "#5a9046", stem: "#8a9a50", sep: "#ef9f28", pet: "#f8c843", lip: "#d8701a" };
function lycFlower(L: Ly, x: number, y: number, k: number): void {
	L.f(LYC.sep, lens(x, y, -90, 6.2 * k, 2.4 * k) + lens(x, y, 28, 6.2 * k, 2.4 * k) + lens(x, y, 152, 6.2 * k, 2.4 * k));
	L.f(LYC.pet, lens(x, y + 0.4 * k, -58, 3.8 * k, 1.5 * k) + lens(x, y + 0.4 * k, -122, 3.8 * k, 1.5 * k));
	L.f(LYC.lip, ov(x, y + 1 * k, 1.4 * k, 1 * k, 90));
}
function lycaste(st: St): string {
	const L = new Ly([S(LYC.stem, 1), LYC.leaf2, LYC.leaf, S(LYC.pleat, 0.5), LYC.bulb, S(LYC.bulbD, 0.6), S(LYC.spine, 1), LYC.sep, LYC.pet, LYC.lip]);
	const bulb = (x: number, h: number, w: number, spines: boolean) => {
		L.f(LYC.bulb, ov(x, 87 - h / 2, h / 2, w, 90));
		L.s(LYC.bulbD, 0.6, sg(x - w * 0.4, 86, x - w * 0.3, 88 - h + 2) + sg(x + w * 0.4, 86, x + w * 0.3, 88 - h + 2));
		if (spines) L.s(LYC.spine, 1, sg(x - 0.6, 88 - h, x - 2.2, 84 - h) + sg(x + 0.6, 88 - h, x + 2.4, 84.6 - h));
	};
	const leaves = (x: number, y: number, list: readonly (readonly [number, number])[]) => {
		let pl = "";
		list.forEach(([a, len], i) => {
			L.f(i % 2 ? LYC.leaf : LYC.leaf2, lens(x, y, a, len, 4.2));
			for (const o of [-1.2, 1.2]) {
				const p1 = loc(x, y, a, 1, len * 0.12, o * 0.4);
				const p2 = loc(x, y, a, 1, len * 0.75, o);
				pl += sg(p1[0], p1[1], p2[0], p2[1]);
			}
		});
		L.s(LYC.pleat, 0.5, pl);
	};
	if (st === "sprout") {
		bulb(40, 8, 3, false);
		leaves(40, 80, [[-110, 13], [-72, 12]]);
		return L.toString();
	}
	if (st === "leafy") {
		bulb(32, 12, 4.4, true);
		bulb(46, 13, 4.6, false);
		leaves(46, 75, [[-118, 28], [-66, 27]]);
		return L.toString();
	}
	bulb(26, 11, 4, true);
	bulb(38, 14, 4.8, true);
	bulb(51, 14, 4.8, false);
	leaves(51, 74, [[-112, 26], [-60, 28]]);
	L.s(LYC.stem, 1, qd(30, 86, 22, 70, 18, 52) + qd(36, 86, 34, 60, 30, 40) + qd(44, 86, 46, 60, 44, 32) + qd(48, 86, 60, 72, 64, 54));
	lycFlower(L, 18, 50, 1.6);
	lycFlower(L, 30, 38, 1.7);
	lycFlower(L, 45, 30, 1.7);
	lycFlower(L, 64, 52, 1.6);
	return L.toString();
}

/* ---------- 21. Phragmipedium ---------- */
const PHR = { leaf: "#4f8a45", leaf2: "#5f9a52", stem: "#6a7a40", sep: "#ddd296", str: "#7f9a48", rib: "#a0462e", pouch: "#c08a3e", pouchD: "#8a4a2a" };
function phrag(st: St): string {
	const L = new Ly([PHR.leaf2, PHR.leaf, S(PHR.stem, 1.2), S(PHR.rib, 1.3), PHR.sep, S(PHR.str, 0.6), PHR.pouch, PHR.pouchD]);
	const fan = (list: readonly (readonly [number, number, number])[]) => list.forEach(([tx, ty, b], i) => L.f(i % 2 ? PHR.leaf : PHR.leaf2, strap(40, 86, tx, ty, b, 1.9)));
	if (st === "sprout") {
		fan([[30, 68, -3], [50, 66, 3], [41, 64, 1]]);
		return L.toString();
	}
	if (st === "leafy") {
		fan([[12, 52, -6], [68, 50, 6], [24, 40, -4], [56, 38, 4], [36, 36, -2], [48, 40, 2]]);
		L.s(PHR.stem, 1.2, sg(43, 84, 45, 40));
		L.f(PHR.pouch, ov(45, 40, 3, 1.8, 80));
		return L.toString();
	}
	fan([[10, 56, -6], [70, 56, 6], [20, 46, -4], [60, 46, 4], [32, 44, -2], [50, 46, 2]]);
	const x = 46;
	const y = 22;
	L.s(PHR.stem, 1.2, sg(43, 84, x, y + 2));
	L.s(PHR.rib, 1.3, `M${x - 1} ${y + 1}q-6 2-7 9t-4 11-3 12-4 12-2 10M${x + 1} ${y + 1}q6 2 7 9t4 11 3 12 4 12 2 10`);
	L.f(PHR.sep, lens(x, y, -92, 12, 2.6) + lens(x, y + 1, 92, 10, 2.4));
	L.s(PHR.str, 0.6, sg(x, y - 1, x - 0.4, y - 10) + sg(x - 1.4, y - 1, x - 2.2, y - 8) + sg(x + 1.4, y - 1, x + 1.4, y - 8));
	L.f(PHR.pouch, ov(x, y + 5.4, 4.6, 3.6, 90));
	L.f(PHR.pouchD, ov(x, y + 3.6, 2, 2.8, 0));
	return L.toString();
}

/* ---------- 22. Necklace orchid ---------- */
const DCH = { leaf: "#5f9a4c", leaf2: "#78ae5c", bulb: "#7a9a48", thread: "#9a9a50", fl: "#e3cc5e", fl2: "#bf9f3c" };
function necklace(st: St): string {
	const L = new Ly([S(DCH.thread, 0.7), DCH.leaf2, DCH.leaf, DCH.bulb, DCH.fl2, DCH.fl]);
	const tuft = (n: number, len: number) => {
		for (let i = 0; i < n; i++) {
			const a = -128 + (76 * i) / (n - 1);
			L.f(i % 2 ? DCH.leaf : DCH.leaf2, lens(40, 84, a, len * (1 - Math.abs(a + 90) / 220), 1.7));
		}
		L.f(DCH.bulb, ov(37, 84, 3.4, 2.2, 90) + ov(43, 84.4, 3, 2, 90));
	};
	if (st === "sprout") {
		tuft(5, 18);
		return L.toString();
	}
	const chains: P4[] =
		st === "leafy"
			? [[[39, 76], [34, 54], [26, 50], [22, 56]], [[41, 76], [46, 54], [54, 50], [58, 56]]]
			: [
					[[39, 72], [32, 36], [16, 22], [8, 44]],
					[[41, 72], [48, 36], [64, 22], [72, 44]],
					[[39, 72], [36, 30], [26, 12], [18, 30]],
					[[41, 72], [44, 30], [54, 12], [62, 30]],
					[[40, 72], [40, 34], [36, 10], [30, 18]],
				];
	let th = "";
	for (const C of chains) th += cb(C);
	L.s(DCH.thread, 0.7, th);
	tuft(9, 32);
	if (st === "leafy") return L.toString();
	let a = "";
	let b = "";
	for (const C of chains) {
		for (let i = 0; i <= 12; i++) {
			const t = 0.42 + (0.58 * i) / 12;
			const [x, y] = bez(C, t);
			const [x2, y2] = bez(C, t + 0.01);
			const dx = x2 - x;
			const dy = y2 - y;
			const L2 = Math.hypot(dx, dy) || 1;
			const s = i % 2 ? 1.1 : -1.1;
			const r = 1 - 0.35 * (i / 12);
			if (i % 2) a += dot(x - (dy / L2) * s, y + (dx / L2) * s, r);
			else b += dot(x - (dy / L2) * s, y + (dx / L2) * s, r);
		}
	}
	L.f(DCH.fl2, b);
	L.f(DCH.fl, a);
	return L.toString();
}

/* ---------- 23. Pleione ---------- */
const PLE = { bulb: "#6f8f4a", bulbD: "#55703c", leaf: "#78ae5c", sheath: "#c8c79a", sep: "#e592bd", lip: "#f7eef3", spot: "#b8642a", fr: "#f2d4e2" };
function pleFlower(L: Ly, x: number, y: number, k: number): void {
	L.f(PLE.sep, lens(x, y, -90, 6.4 * k, 1.1 * k) + lens(x, y, -40, 6.2 * k, 1.1 * k) + lens(x, y, -140, 6.2 * k, 1.1 * k) + lens(x, y, -8, 6 * k, 1.1 * k) + lens(x, y, -172, 6 * k, 1.1 * k));
	const u = (dx: number, dy: number) => `${f(x + dx * k)} ${f(y + dy * k)}`;
	L.f(PLE.lip, `M${u(-1.3, -0.6)}L${u(1.3, -0.6)}Q${u(3.6, 2.6)} ${u(2.8, 5.4)}Q${u(0, 6.6)} ${u(-2.8, 5.4)}Q${u(-3.6, 2.6)} ${u(-1.3, -0.6)}Z`);
	L.f(PLE.fr, dot(x - 2.4 * k, y + 5.6 * k, 0.8 * k) + dot(x - 0.8 * k, y + 6.2 * k, 0.8 * k) + dot(x + 0.8 * k, y + 6.2 * k, 0.8 * k) + dot(x + 2.4 * k, y + 5.6 * k, 0.8 * k));
	L.f(PLE.spot, dot(x, y + 2.2 * k, 0.4 * k) + dot(x - 0.9 * k, y + 3.4 * k, 0.4 * k) + dot(x + 0.9 * k, y + 3.4 * k, 0.4 * k) + dot(x, y + 4.4 * k, 0.4 * k));
}
function pleione(st: St): string {
	const L = new Ly([S(PLE.sheath, 1.4), PLE.leaf, PLE.bulb, S(PLE.bulbD, 0.6), PLE.sep, PLE.lip, PLE.fr, PLE.spot]);
	const bulb = (x: number, r: number) => {
		L.f(PLE.bulb, `M${f(x - 0.8)} ${f(87 - r * 2.2)}Q${f(x - r * 1.5)} ${f(87 - r * 0.9)} ${f(x - r)} 87L${f(x + r)} 87Q${f(x + r * 1.5)} ${f(87 - r * 0.9)} ${f(x + 0.8)} ${f(87 - r * 2.2)}Z`);
		L.s(PLE.bulbD, 0.6, qd(x - r * 0.4, 86, x - r * 0.6, 84 - r, x - 0.4, 87 - r * 2));
	};
	if (st === "sprout") {
		bulb(40, 4);
		L.f(PLE.leaf, lens(40, 79, -88, 12, 2.2));
		return L.toString();
	}
	if (st === "leafy") {
		bulb(33, 5);
		bulb(47, 4.6);
		L.f(PLE.leaf, lens(33, 76, -96, 34, 3.6) + lens(47, 77, -82, 32, 3.4));
		return L.toString();
	}
	bulb(30, 5);
	bulb(48, 5);
	L.f(PLE.leaf, lens(48, 76, -80, 12, 2.2));
	L.s(PLE.sheath, 1.4, qd(31, 76, 30, 66, 27, 56) + qd(47, 76, 48, 66, 54, 50));
	pleFlower(L, 25, 50, 2.3);
	pleFlower(L, 55, 44, 2.4);
	return L.toString();
}

/* ---------- 24. Disa ---------- */
const DIS = { leaf: "#5f9a4c", leaf2: "#4f8a45", stem: "#5a8a40", sep: "#d9302e", hood: "#e8553a", vein: "#9e1c22", pet: "#f2b23a" };
function disaFlower(L: Ly, x: number, y: number, k: number, deg: number): void {
	const p = (dx: number, dy: number) => loc(x, y, deg, k, dx, dy);
	const [ax, ay] = p(-3.4, 1.2);
	const [bx, by] = p(3.4, 1.2);
	L.f(DIS.sep, ov(ax, ay, 3.6 * k, 2.3 * k, 12 + deg) + ov(bx, by, 3.6 * k, 2.3 * k, -12 + deg));
	const [hx, hy] = p(0, -2.6);
	L.f(DIS.hood, ov(hx, hy, 3.2 * k, 2.6 * k, 90 + deg));
	let v = "";
	const [ox, oy] = p(0, 0.2);
	for (const a of [-140, -115, -90, -65, -40]) {
		const [ex, ey] = at(ox, oy, a + deg, 4.8 * k);
		v += sg(ox, oy, ex, ey);
	}
	for (const s of [-1, 1]) {
		const [sx, sy] = p(s * 1.2, 1.2);
		const [ex, ey] = p(s * 6, 1.4);
		v += sg(sx, sy, ex, ey);
	}
	L.s(DIS.vein, 0.5, v);
	const [px, py] = p(0, -0.6);
	L.f(DIS.pet, ov(px, py, 1.1 * k, 0.8 * k, 90 + deg));
}
function disa(st: St): string {
	const L = new Ly([DIS.leaf2, DIS.leaf, S(DIS.stem, 1.4), DIS.sep, DIS.hood, S(DIS.vein, 0.5), DIS.pet]);
	const grass = (list: readonly (readonly [number, number])[]) => list.forEach(([a, len], i) => L.f(i % 2 ? DIS.leaf : DIS.leaf2, lens(40, 86, a, len, 1.8)));
	if (st === "sprout") {
		grass([[-115, 16], [-70, 15], [-95, 18]]);
		return L.toString();
	}
	if (st === "leafy") {
		grass([[-150, 22], [-30, 22], [-120, 30], [-60, 30], [-100, 34]]);
		L.s(DIS.stem, 1.4, sg(41, 84, 42, 42));
		L.f(DIS.leaf, lens(42, 56, -60, 8, 1.4) + lens(42, 64, -125, 9, 1.4));
		L.f(DIS.sep, ov(42, 41, 2.4, 1.8, 90));
		return L.toString();
	}
	grass([[-152, 24], [-28, 24], [-122, 30], [-58, 30], [-98, 32]]);
	L.s(DIS.stem, 1.4, sg(41, 84, 40, 30) + qd(41, 56, 48, 52, 56, 50));
	L.f(DIS.leaf, lens(40.6, 60, -62, 9, 1.4) + lens(40.4, 46, -122, 8, 1.4));
	disaFlower(L, 40, 26, 2.5, 0);
	disaFlower(L, 59, 50, 1.6, 14);
	return L.toString();
}

/* ---------- 25. Bulbophyllum ---------- */
const BUL = { rhiz: "#7a6a3a", bulb: "#8aa850", leaf: "#5f9a4c", leaf2: "#4f8a45", stem: "#8a6a3a", fl: "#e08a3c", dot: "#a8401e", top: "#f2c060" };
function umbel(L: Ly, x: number, y: number, k: number): void {
	let d = "";
	let s = "";
	for (let i = 0; i < 7; i++) {
		const a = 28 + (124 * i) / 6;
		const [sx, sy] = at(x, y, a, 1.2 * k);
		d += lens(sx, sy, a, 9 * k, 1.5 * k);
		for (const t of [3.4, 5.6]) {
			const [px, py] = at(x, y, a, t * k);
			s += dot(px, py, 0.42 * k);
		}
	}
	L.f(BUL.fl, d);
	L.f(BUL.dot, s);
	L.f(BUL.top, ov(x, y - 0.8 * k, 1.8 * k, 1.4 * k, 0) + lens(x, y - 0.6 * k, -60, 2.8 * k, 0.6 * k) + lens(x, y - 0.6 * k, -120, 2.8 * k, 0.6 * k));
}
function bulbophyllum(st: St): string {
	const L = new Ly([S(BUL.rhiz, 1.6), S(BUL.stem, 0.8), BUL.leaf, BUL.leaf2, BUL.bulb, BUL.fl, BUL.dot, BUL.top]);
	const unit = (x: number, h: number, len: number, deg: number, alt: boolean) => {
		const top = 86 - h;
		const [cx, cy] = at(x, top + 1, deg, len / 2);
		L.f(alt ? BUL.leaf : BUL.leaf2, ov(cx, cy, len / 2, len * 0.2, deg));
		L.f(BUL.bulb, ov(x, 86 - h / 2, h / 2, h * 0.36, 90));
	};
	if (st === "sprout") {
		L.s(BUL.rhiz, 1.6, sg(34, 85.6, 46, 85.6));
		unit(40, 6, 12, -88, false);
		return L.toString();
	}
	if (st === "leafy") {
		L.s(BUL.rhiz, 1.6, sg(20, 85.6, 60, 85));
		unit(26, 8, 22, -100, false);
		unit(40, 9, 28, -86, true);
		unit(54, 8, 24, -72, false);
		return L.toString();
	}
	L.s(BUL.rhiz, 1.6, sg(18, 85.6, 62, 85));
	unit(22, 8, 22, -105, false);
	unit(34, 9, 28, -94, true);
	unit(46, 9, 28, -80, false);
	unit(58, 8, 22, -68, true);
	L.s(BUL.stem, 0.8, qd(26, 85, 22, 50, 24, 24) + qd(54, 85, 60, 60, 58, 40));
	umbel(L, 24, 22, 1.5);
	umbel(L, 58, 38, 1.4);
	return L.toString();
}

export const SPECIES: Species[] = [
	{ id: "cattleya", name: "Cattleya", draw: cattleya },
	{ id: "dendrobium", name: "Dendrobium", draw: dendrobium },
	{ id: "cymbidium", name: "Cymbidium", draw: cymbidium },
	{ id: "dancing-lady-orchid", name: "Dancing lady orchid", draw: dancingLady },
	{ id: "tropical-slipper-orchid", name: "Tropical slipper orchid", draw: slipper },
	{ id: "vanda", name: "Vanda", draw: vanda },
	{ id: "pansy-orchid", name: "Pansy orchid", draw: pansyOrchid },
	{ id: "zygopetalum", name: "Zygopetalum", draw: zygopetalum },
	{ id: "masdevallia", name: "Masdevallia", draw: masdevallia },
	{ id: "jewel-orchid", name: "Jewel orchid", draw: jewel },
	{ id: "ladys-slipper-orchid", name: "Lady's slipper orchid", draw: ladySlipper },
	{ id: "bee-orchid", name: "Bee orchid", draw: beeOrchid },
	{ id: "vanilla-orchid", name: "Vanilla orchid", draw: vanilla },
	{ id: "monkey-face-orchid", name: "Monkey face orchid", draw: monkeyFace },
	{ id: "ghost-orchid", name: "Ghost orchid", draw: ghost },
	{ id: "spider-orchid", name: "Spider orchid", draw: spiderOrchid },
	{ id: "crucifix-orchid", name: "Crucifix orchid", draw: crucifix },
	{ id: "hardy-ground-orchid", name: "Hardy ground orchid", draw: bletilla },
	{ id: "calanthe", name: "Calanthe", draw: calanthe },
	{ id: "lycaste", name: "Lycaste", draw: lycaste },
	{ id: "phragmipedium", name: "Phragmipedium", draw: phrag },
	{ id: "necklace-orchid", name: "Necklace orchid", draw: necklace },
	{ id: "pleione", name: "Pleione", draw: pleione },
	{ id: "disa", name: "Disa", draw: disa },
	{ id: "bulbophyllum", name: "Bulbophyllum", draw: bulbophyllum },
];
