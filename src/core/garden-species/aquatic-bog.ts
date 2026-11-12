/**
 * Garden species, family: aquatic and bog plants. Each draws sprout, leafy
 * and bloom in the kit's flat style (see kit.ts); the kit draws soil and
 * seed. Floating and marginal plants sit in a shallow pond over the soil;
 * submerged ones (eelgrass, fanwort, hornwort) grow inside a water basin.
 */
import { bez, f, type GrowingStage, type Pt, type Species } from "./kit";

/* ---------- private helpers ---------- */

const RAD = Math.PI / 180;
type P4 = readonly [Pt, Pt, Pt, Pt];

const S = <T>(st: GrowingStage, a: T, b: T, c: T): T => (st === "sprout" ? a : st === "leafy" ? b : c);

/** A filled path. */
function p(d: string, fill: string, extra = ""): string {
	return d ? `<path d="${d}" fill="${fill}"${extra}/>` : "";
}

/** A stroked path with round caps. */
function sk(d: string, stroke: string, w: number): string {
	return d ? `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${f(w)}" stroke-linecap="round" stroke-linejoin="round"/>` : "";
}

/** A rotated ellipse. */
function el(cx: number, cy: number, rx: number, ry: number, fill: string, rot = 0): string {
	const t = rot ? ` transform="rotate(${f(rot)} ${f(cx)} ${f(cy)})"` : "";
	return `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}" fill="${fill}"${t}/>`;
}

/** A cubic as path data. */
function cub(c: P4): string {
	return `M${f(c[0][0])} ${f(c[0][1])}C${f(c[1][0])} ${f(c[1][1])} ${f(c[2][0])} ${f(c[2][1])} ${f(c[3][0])} ${f(c[3][1])}`;
}

/** Tangent angle (degrees) of a cubic at t. */
function ang(c: P4, t: number): number {
	const a = bez(c, Math.max(0, t - 0.02));
	const b = bez(c, Math.min(1, t + 0.02));
	return Math.atan2(b[1] - a[1], b[0] - a[0]) / RAD;
}

/** Subpath of a pointed lens from (x, y) heading `deg`, `len` long and about 2w wide. */
function lensSub(x: number, y: number, deg: number, len: number, w: number): string {
	const c = Math.cos(deg * RAD);
	const sn = Math.sin(deg * RAD);
	const mx = x + c * len * 0.45;
	const my = y + sn * len * 0.45;
	const k = w * 1.25;
	return `M${f(x)} ${f(y)}Q${f(mx - sn * k)} ${f(my + c * k)} ${f(x + c * len)} ${f(y + sn * len)}Q${f(mx + sn * k)} ${f(my - c * k)} ${f(x)} ${f(y)}Z`;
}

/** Subpath of a rotated ellipse. */
function ovalSub(cx: number, cy: number, rx: number, ry: number, rot = 0): string {
	const dx = Math.cos(rot * RAD) * rx;
	const dy = Math.sin(rot * RAD) * rx;
	const a = `A${f(rx)} ${f(ry)} ${f(rot)} 1 0`;
	return `M${f(cx + dx)} ${f(cy + dy)}${a} ${f(cx - dx)} ${f(cy - dy)}${a} ${f(cx + dx)} ${f(cy + dy)}Z`;
}

/** An oval leaf from (x, y) heading deg (its base at the point). */
function ovalAt(x: number, y: number, deg: number, len: number, w: number): string {
	return ovalSub(x + Math.cos(deg * RAD) * len * 0.5, y + Math.sin(deg * RAD) * len * 0.5, len * 0.5, w, deg);
}

/** Subpath of a circle. */
function dotSub(x: number, y: number, r: number): string {
	return `M${f(x - r)} ${f(y)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0`;
}

/** Many dots of one colour in one path. */
function dots(pts: readonly (readonly number[])[], r: number, fill: string): string {
	let d = "";
	for (const [x = 0, y = 0, rr] of pts) d += dotSub(x, y, rr ?? r);
	return p(d, fill);
}

/** n oval petals around (x, y), as subpaths. */
function ringSub(x: number, y: number, n: number, r: number, rx: number, ry: number, off = 0): string {
	let d = "";
	for (let i = 0; i < n; i++) {
		const a = off + (i * 360) / n;
		d += ovalSub(x + Math.cos(a * RAD) * r, y + Math.sin(a * RAD) * r, rx, ry, a);
	}
	return d;
}

/** A star of pointed petals around (x, y), as subpaths. */
function starSub(x: number, y: number, n: number, len: number, w: number, off = -90): string {
	let d = "";
	for (let i = 0; i < n; i++) d += lensSub(x, y, off + (i * 360) / n, len, w);
	return d;
}

/** Leaves along a cubic, at each t: a pair (opp) or alternating sides, `spread` degrees off the tangent. */
function leavesOn(c: P4, ts: readonly number[], len: number, w: number, spread: number, opp: boolean, shrink = 0.4, round = false): string {
	let d = "";
	ts.forEach((t, i) => {
		const [x, y] = bez(c, t);
		const a = ang(c, t);
		const l = len * (1 - shrink * t);
		const mk = round ? ovalAt : lensSub;
		if (opp || i % 2 === 0) d += mk(x, y, a - spread, l, w * (l / len));
		if (opp || i % 2 === 1) d += mk(x, y, a + spread, l, w * (l / len));
	});
	return d;
}

/** A shallow pond over the soil. */
function pond(rx = 19): string {
	return `<ellipse cx="40" cy="86.4" rx="${f(rx)}" ry="3.2" fill="#4c86a8"/><path d="M${f(40 - rx * 0.7)} 86.6h${f(rx * 0.35)}M${f(40 + rx * 0.2)} 87.6h${f(rx * 0.4)}" stroke="#7fb3d0" stroke-width=".8" stroke-linecap="round"/>`;
}

/** A water basin seen in section, its rippled surface at `top`, for submerged plants. */
function pool(top: number, w = 27): string {
	const n = 6;
	const step = (2 * w) / n;
	let waves = "";
	for (let i = 0; i < n; i++) waves += `q${f(step / 4)} -1.3 ${f(step / 2)} 0t${f(step / 2)} 0`;
	const surf = `M${f(40 - w)} ${f(top)}${waves}`;
	const b = Math.min(17, w - 1);
	const body = `${surf}C${f(40 + w)} ${f(top + (87 - top) * 0.75)} ${f(40 + b + 3)} 88 ${f(40 + b)} 88H${f(40 - b)}C${f(40 - b - 3)} 88 ${f(40 - w)} ${f(top + (87 - top) * 0.75)} ${f(40 - w)} ${f(top)}Z`;
	return p(body, "#4c86a8", ` opacity=".3"`) + sk(surf, "#8ec0da", 0.9);
}

/** Subpath of a floating pad with a notch facing the viewer. */
function padSub(cx: number, cy: number, rx: number, ry: number, notch = 22): string {
	const a1 = (90 - notch / 2) * RAD;
	const a2 = (90 + notch / 2) * RAD;
	return `M${f(cx)} ${f(cy)}L${f(cx + Math.cos(a1) * rx)} ${f(cy + Math.sin(a1) * ry)}A${f(rx)} ${f(ry)} 0 1 0 ${f(cx + Math.cos(a2) * rx)} ${f(cy + Math.sin(a2) * ry)}Z`;
}

/** A floating pad with a notch facing the viewer. */
function pad(cx: number, cy: number, rx: number, ry: number, fill: string, notch = 22): string {
	return p(padSub(cx, cy, rx, ry, notch), fill);
}

/** A white three-petal flower with a shaded back layer (reads on light and dark beds). */
function tri(x: number, y: number, r: number, rx: number, ry: number, eye: number): string {
	return p(ringSub(x, y, 3, r * 0.9, rx * 0.85, ry * 0.85, -30), "#cfcab4") + p(ringSub(x, y, 3, r, rx, ry, -90), "#f8f7f2") + dots([[x, y]], eye, "#e9c64a");
}

/* ---------- 1. Victoria water lily ---------- */
function vpad(cx: number, cy: number, rx: number, ry: number): string {
	let rib = "";
	for (let i = 0; i < 12; i++) {
		const a = (i * 30 + 15) * RAD;
		rib += `M${f(cx)} ${f(cy + ry * 0.15)}L${f(cx + Math.cos(a) * (rx - 1.6))} ${f(cy + ry * 0.15 + Math.sin(a) * ry * 0.62)}`;
	}
	return el(cx, cy - ry * 0.28, rx, ry, "#b2564a") + el(cx, cy + ry * 0.15, rx - 1, ry * 0.75, "#58994a") + sk(rib, "#447f3c", 0.5);
}
function victoriaFlower(x: number, y: number, k: number): string {
	let o = "";
	for (const a of [-176, -156, -136, -44, -24, -4]) o += lensSub(x, y, a, 11 * k, 2.3 * k);
	let m = "";
	for (const a of [-118, -100, -80, -62]) m += lensSub(x, y, a, 12 * k, 2.4 * k);
	let i = "";
	for (const a of [-128, -108, -72, -52]) i += lensSub(x, y, a, 7.5 * k, 2.2 * k);
	return p(o, "#ece6d6") + p(m, "#f8f5ee") + p(i, "#e0869f") + el(x, y - 1, 3 * k, 1.2 * k, "#f0c84a");
}
function victoria(st: GrowingStage): string {
	if (st === "sprout") return pond(16) + vpad(38, 85.4, 9, 2.4) + p("M47 86C47 81 49 77 53 75C52 79 51 83 49.5 86Z", "#8a4a3e");
	if (st === "leafy") return pond(26) + vpad(27, 85.2, 13, 3.2) + vpad(53, 86, 12, 2.9) + sk("M40 86L40 75", "#6f8c4a", 1.4) + el(40, 72, 2.6, 4, "#8a5a46") + p("M38.4 70Q40 66 41.6 70Z", "#ece6d6");
	return pond(34) + vpad(21, 84.6, 15, 3.8) + vpad(59, 85.2, 15, 3.6) + vpad(40, 87.6, 11, 1.6) + victoriaFlower(40, 82.5, 1.45);
}

/* ---------- 2. Yellow pond lily ---------- */
function globe(x: number, y: number, k: number): string {
	return el(x, y, 3.8 * k, 3.5 * k, "#dcae22") + p(ovalSub(x - 2.3 * k, y + 0.4 * k, 2.2 * k, 3.4 * k, -16) + ovalSub(x + 2.3 * k, y + 0.4 * k, 2.2 * k, 3.4 * k, 16), "#f2cf42") + el(x, y - 3 * k, 2 * k, 0.9 * k, "#a8862a");
}
function yellowPondLily(st: GrowingStage): string {
	const d = "#4b8a3c";
	const l = "#66a44e";
	const sc = "#6c9a4e";
	if (st === "sprout") return pond(15) + pad(36, 85.4, 9, 2.4, l) + sk("M45 86C45 81 46 77 47 74", sc, 1.3) + globe(47, 72, 0.55);
	if (st === "leafy") return pond(22) + pad(27, 85.5, 11, 2.9, d) + pad(53, 85.8, 10, 2.7, l) + pad(42, 87.6, 8, 1.8, l) + sk("M37 86C37 78 36 72 35 66M45 86C45 80 46 76 47 74", sc, 1.4) + globe(35, 64, 0.85) + globe(47, 72.5, 0.5);
	return (
		pond(28) +
		pad(21, 85.4, 12, 3, d) +
		pad(59, 85.6, 11, 2.8, l) +
		pad(40, 87.6, 10, 1.8, l) +
		pad(44, 84.2, 8, 2, d, 30) +
		sk("M33 86C33 76 30 64 29 56M41 86C41 74 42 66 43 62M48 86C49 80 53 76 55 73", sc, 1.5) +
		globe(29, 53, 1.25) +
		globe(43, 59, 1.05) +
		globe(55, 71, 0.8)
	);
}

/* ---------- 3. Water poppy ---------- */
function poppy(x: number, y: number, k: number): string {
	return el(x, y - 2.4 * k, 3.4 * k, 2.8 * k, "#e8d062") + p(ovalSub(x - 2.9 * k, y, 3.3 * k, 2.6 * k, -28) + ovalSub(x + 2.9 * k, y, 3.3 * k, 2.6 * k, 28), "#f6e79a") + el(x, y - 0.6 * k, 1.5 * k, 1.1 * k, "#8a3a2c") + dots([[x - 0.6 * k, y - 1.1 * k], [x + 0.6 * k, y - 1.1 * k]], 0.35 * k, "#e2b04a");
}
function waterPoppy(st: GrowingStage): string {
	const dk = "#2f7438";
	const lt = "#4f9a4a";
	const lv = (pts: readonly (readonly number[])[]) => {
		let a = "";
		let b = "";
		pts.forEach(([x = 0, y = 0, r = 5], i) => {
			a += ovalSub(x, y, r, r * 0.36);
			b += ovalSub(x - r * 0.15, y - r * 0.08, r * 0.7, r * 0.18);
			void i;
		});
		return p(a, dk) + p(b, lt);
	};
	if (st === "sprout") return pond(15) + lv([[35, 85.6, 5], [45, 86.4, 4.4]]) + sk("M41 86L42 79", "#5d8a46", 1.1) + el(42, 77.6, 1.4, 2, "#9cbf6a");
	if (st === "leafy") return pond(21) + lv([[27, 85.8, 6], [52, 85.6, 6], [39, 87.6, 5], [44, 84.4, 4]]) + sk("M38 86L37 74", "#5d8a46", 1.2) + poppy(37, 73, 1);
	return pond(26) + lv([[22, 85.6, 7], [58, 85.4, 7], [36, 87.8, 6], [47, 84.2, 5], [30, 84.4, 4.6]]) + sk("M27 86L26 75M41 86L42 69M54 86L55 78", "#5d8a46", 1.3) + poppy(26, 74, 1.3) + poppy(42, 68, 1.45) + poppy(55, 77, 1.15);
}

/* ---------- 4. Water hawthorn ---------- */
function hawthorn(x: number, y: number, k: number): string {
	let arm = "";
	let wh = "";
	let bl = "";
	for (const s of [-1, 1]) {
		const dx = s * 5 * k;
		const dy = -6 * k;
		const len = Math.hypot(dx, dy);
		const nx = -dy / len;
		const ny = dx / len;
		arm += `M${f(x)} ${f(y)}l${f(dx)} ${f(dy)}`;
		for (let i = 1; i <= 3; i++) {
			const t = i / 3.2;
			const px = x + dx * t;
			const py = y + dy * t;
			for (const side of [-1, 1]) {
				wh += ovalSub(px + nx * side * 1.4 * k, py + ny * side * 1.4 * k, 1.7 * k, 1.25 * k, Math.atan2(ny, nx) / RAD);
			}
			bl += dotSub(px, py, 0.4 * k);
		}
	}
	return sk(arm, "#b9b49a", 2.2 * k) + p(wh, "#f4f1e6") + p(bl, "#2e2a26");
}
function waterHawthorn(st: GrowingStage): string {
	const lf = (pts: readonly (readonly number[])[]) => {
		let a = "";
		let b = "";
		for (const [x = 0, y = 0, r = 8, rot = 0] of pts) {
			a += ovalSub(x, y, r, 1.5, rot);
			b += dotSub(x - r * 0.4, y - 0.3, 0.45) + dotSub(x + r * 0.3, y + 0.2, 0.4);
		}
		return p(a, "#4f7f3a") + p(b, "#7a4a3a");
	};
	if (st === "sprout") return pond(15) + lf([[36, 85.8, 7, -4], [45, 86.6, 6, 6]]);
	if (st === "leafy") return pond(22) + lf([[27, 85.6, 9, -5], [53, 85.8, 9, 4], [40, 87.8, 8, 0]]) + sk("M41 86L41 77", "#6f8a52", 1.2) + hawthorn(41, 77, 0.8);
	return pond(27) + lf([[21, 85.6, 10, -4], [59, 85.4, 10, 5], [38, 88, 9, 2], [47, 84.4, 7, -3]]) + sk("M29 86L29 76M41 86L41 70M53 86L53 78", "#6f8a52", 1.3) + hawthorn(29, 76, 1.05) + hawthorn(41, 70, 1.25) + hawthorn(53, 78, 1);
}

/* ---------- 5. Frogbit ---------- */
function frogbit(st: GrowingStage): string {
	const ros = (x: number, k: number) => [ovalSub(x - 3.2 * k, 85.2, 3 * k, 2 * k, -14) + ovalSub(x + 3.2 * k, 85.2, 3 * k, 2 * k, 14), dotSub(x, 82.8 - k, 2.7 * k)];
	const fl = (x: number, y: number, k: number) => tri(x, y, 1.5 * k, 1.6 * k, 1.25 * k, 0.7 * k);
	const draw = (rs: readonly (readonly number[])[], stol: string) => {
		let a = "";
		let b = "";
		let nt = "";
		for (const [x = 0, k = 1] of rs) {
			const [s0 = "", s1 = ""] = ros(x, k);
			a += s0;
			b += s1;
			nt += `M${f(x)} ${f(82.8 - k - 2.7 * k)}l0 ${f(1.6 * k)}`;
		}
		return sk(stol, "#9a7a5a", 0.7) + p(a, "#4f9a40") + p(b, "#79bf58") + sk(nt, "#3f7a35", 0.6);
	};
	if (st === "sprout") return pond(15) + draw([[40, 1]], "");
	if (st === "leafy") return pond(22) + draw([[30, 1.1], [51, 1]], "M30 86.6Q40 88.4 51 86.6") + sk("M30 81L31 76", "#5f8a48", 0.8) + fl(31, 75, 1);
	return (
		pond(28) +
		draw([[20, 1.05], [40, 1.3], [60, 1.05]], "M20 86.6Q30 88.6 40 86.8Q50 88.6 60 86.6") +
		sk("M38 79L35 72M43 79L46 70M21 82L22 76M58 82L59 75", "#5f8a48", 0.8) +
		fl(35, 71, 1.3) +
		fl(46, 69, 1.3) +
		fl(22, 75, 1.1) +
		fl(59, 74, 1.1)
	);
}

/* ---------- 6. Water forget-me-not ---------- */
function fmnCluster(x: number, y: number, k: number): [string, string, string] {
	let pet = "";
	let eye = "";
	for (const [ox, oy] of [[0, 0.4], [-3.6, 1.8], [3.5, 1.6], [-2, -3], [2.2, -2.8]] as const) {
		const cx = x + ox * k;
		const cy = y + oy * k;
		pet += dotSub(cx, cy, 1.6 * k);
		eye += dotSub(cx, cy, 0.5 * k);
	}
	const bud = dotSub(x, y - 4.4 * k, 0.8 * k) + dotSub(x + 1.6 * k, y - 4.6 * k, 0.65 * k);
	return [pet, eye, bud];
}
function waterForgetMeNot(st: GrowingStage): string {
	const stems: P4[] = S<P4[]>(
		st,
		[[[40, 86], [40, 80], [38, 76], [37, 72]]],
		[
			[[38, 86], [36, 76], [30, 68], [27, 62]],
			[[42, 86], [43, 74], [47, 64], [50, 58]],
		],
		[
			[[36, 86], [30, 76], [22, 66], [18, 58]],
			[[39, 86], [37, 70], [33, 54], [32, 42]],
			[[42, 86], [44, 70], [48, 54], [50, 44]],
			[[45, 86], [52, 76], [59, 66], [62, 58]],
		],
	);
	let st_ = "";
	let lv = "";
	let pet = "";
	let eye = "";
	let bud = "";
	const k = S(st, 0.8, 1, 1.15);
	for (const c of stems) {
		st_ += cub(c);
		lv += leavesOn(c, st === "sprout" ? [0.35, 0.65] : [0.25, 0.45, 0.65], S(st, 7, 8, 9), 1.6, 50, false, 0.3);
		if (st !== "sprout") {
			const [x, y] = c[3];
			const r = fmnCluster(x, y - 2, k);
			pet += r[0];
			eye += r[1];
			bud += r[2];
		}
	}
	const top = st === "sprout" ? p(lensSub(37, 72, -110, 5, 1.3) + lensSub(37, 72, -60, 5, 1.3), "#7cba5a") : "";
	return pond(S(st, 14, 20, 24)) + sk(st_, "#5a8f45", 1.2) + p(lv, "#68a84e") + top + p(pet, "#6aa9e2") + p(bud, "#e7a3c0") + p(eye, "#f2d24a");
}

/* ---------- 7. Bogbean ---------- */
function trifol(x: number, y: number, deg: number, k: number): string {
	return ovalAt(x, y, deg - 48, 7.5 * k, 2 * k) + ovalAt(x, y, deg, 8.5 * k, 2.3 * k) + ovalAt(x, y, deg + 48, 7.5 * k, 2 * k);
}
function bogbean(st: GrowingStage): string {
	const sc = "#5f8a48";
	const lfc = "#5e9a50";
	if (st === "sprout") return pond(14) + sk("M40 86L40 76", sc, 1.2) + p(trifol(40, 76, -90, 0.9), lfc);
	const leaves = S<[number, number, number, number][]>(
		st,
		[],
		[[30, 66, -120, 1], [50, 68, -60, 1], [40, 60, -90, 0.9]],
		[[24, 66, -140, 1.15], [56, 66, -40, 1.15], [32, 56, -110, 1.05], [49, 58, -70, 1]],
	);
	let pet = "";
	let lv = "";
	for (const [x, y, a, k] of leaves) {
		pet += `M${f(x > 40 ? 42 : 38)} 86Q${f((x + 40) / 2)} ${f(y + 10)} ${f(x)} ${f(y)}`;
		lv += trifol(x, y, a, k);
	}
	const top = S(st, 0, 40, 26);
	const c: P4 = [[40, 86], [40, 70], [41, 52], [41, top]];
	pet += cub(c);
	let star = "";
	let mid = "";
	const bud: number[][] = [];
	const fl = st === "leafy" ? [] : [[0.62, -1], [0.72, 1], [0.8, -1], [0.88, 1]];
	for (const [t = 0, s = 1] of fl) {
		const [x, y] = bez(c, t);
		pet += `M${f(x)} ${f(y)}l${f(s * 3)} -1`;
		star += starSub(x + s * 3.6, y - 1, 5, 3.4, 1.1, -90 + s * 10);
		mid += dotSub(x + s * 3.6, y - 1, 0.9);
	}
	bud.push([41, top - 1.4, 1.5], [39.6, top + 1.4, 1.2], [42.4, top + 2.2, 1.2]);
	if (st === "leafy") bud.push([40, top + 4, 1.1]);
	return pond(S(st, 14, 21, 25)) + sk(pet, sc, 1.2) + p(lv, lfc) + p(star, "#f6eef0") + p(mid, "#e4a0b4") + dots(bud, 1, "#e48aa6");
}

/* ---------- 8. Water mint ---------- */
function mintHead(x: number, y: number, r: number): [string, string] {
	let a = "";
	let b = "";
	for (let i = 0; i < 7; i++) {
		const t = i * 51.4 * RAD;
		a += dotSub(x + Math.cos(t) * r * 0.65, y + Math.sin(t) * r * 0.55, r * 0.42);
	}
	for (const [ox, oy] of [[0, -0.3], [-0.35, 0.1], [0.35, 0.05]] as const) b += dotSub(x + ox * r, y + oy * r, r * 0.3);
	return [a, b];
}
function waterMint(st: GrowingStage): string {
	const stems: P4[] = S<P4[]>(
		st,
		[[[40, 86], [40, 80], [40, 76], [40, 72]]],
		[
			[[38, 86], [37, 74], [33, 62], [31, 52]],
			[[42, 86], [43, 74], [47, 64], [49, 56]],
		],
		[
			[[36, 86], [32, 74], [24, 62], [21, 50]],
			[[40, 86], [40, 70], [39, 50], [39, 30]],
			[[44, 86], [48, 74], [56, 62], [59, 48]],
		],
	);
	let sd = "";
	let lv = "";
	let rib = "";
	let ha = "";
	let hb = "";
	stems.forEach((c, i) => {
		sd += cub(c);
		const ts = st === "sprout" ? [0.55] : [0.18, 0.4, 0.62, 0.8];
		lv += leavesOn(c, ts, S(st, 6, 8, 9), 2.4, 62, true, 0.35);
		for (const t of ts) {
			const [x, y] = bez(c, t);
			const a = ang(c, t);
			const l = S(st, 6, 8, 9) * (1 - 0.35 * t) * 0.75;
			rib += `M${f(x)} ${f(y)}l${f(Math.cos((a - 62) * RAD) * l)} ${f(Math.sin((a - 62) * RAD) * l)}M${f(x)} ${f(y)}l${f(Math.cos((a + 62) * RAD) * l)} ${f(Math.sin((a + 62) * RAD) * l)}`;
		}
		if (st === "sprout") {
			lv += lensSub(40, 72, -120, 5, 1.8) + lensSub(40, 72, -60, 5, 1.8);
			return;
		}
		const [x, y] = c[3];
		const r = st === "leafy" ? 3 : i === 1 ? 5 : 4.4;
		const h = mintHead(x, y - r * 0.6, r);
		ha += h[0];
		hb += h[1];
		if (st === "bloom") {
			const [wx, wy] = bez(c, 0.8);
			const w = mintHead(wx, wy, 2.6);
			ha += w[0];
			hb += w[1];
		}
	});
	return pond(S(st, 13, 20, 24)) + sk(sd, "#6b4a5e", 1.5) + p(lv, "#5e9150") + sk(rib, "#5a4258", 0.5) + p(ha, "#b49ad6") + p(hb, "#d6c4ec");
}

/* ---------- 9. Purple loosestrife ---------- */
function loosestrife(st: GrowingStage): string {
	const wands: P4[] = S<P4[]>(
		st,
		[[[40, 87], [40, 80], [40, 74], [40, 68]]],
		[
			[[38, 87], [36, 72], [32, 56], [30, 44]],
			[[40, 87], [40, 70], [40, 52], [41, 36]],
			[[42, 87], [45, 72], [49, 58], [52, 46]],
		],
		[
			[[36, 87], [32, 70], [22, 46], [18, 26]],
			[[38, 87], [36, 66], [31, 36], [30, 14]],
			[[40, 87], [41, 62], [41, 30], [42, 8]],
			[[42, 87], [45, 64], [50, 36], [53, 16]],
			[[44, 87], [49, 70], [58, 48], [62, 30]],
		],
	);
	let sd = "";
	let lv = "";
	let fa = "";
	let fb = "";
	for (const c of wands) {
		sd += cub(c);
		const leafTs = st === "sprout" ? [0.4, 0.7, 0.95] : st === "leafy" ? [0.15, 0.3, 0.45, 0.6, 0.75, 0.9] : [0.1, 0.2, 0.3, 0.4, 0.5];
		for (const t of leafTs) {
			const [x, y] = bez(c, t);
			const a = ang(c, t);
			const l = S(st, 5, 6, 6.5) * (1 - 0.5 * t);
			for (const sd of [-40, 40]) lv += `M${f(x)} ${f(y)}l${f(Math.cos((a + sd) * RAD) * l)} ${f(Math.sin((a + sd) * RAD) * l)}`;
		}
		if (st !== "bloom") continue;
		for (let j = 0; j < 9; j++) {
			const t = 0.52 + j * 0.053;
			const [x, y] = bez(c, t);
			const a = ang(c, t);
			const w = 2.6 * (1 - (t - 0.5) * 1.4);
			const s = j % 2 ? 1 : -1;
			const nx = Math.cos((a + 90) * RAD) * w * s;
			const ny = Math.sin((a + 90) * RAD) * w * s;
			fa += dotSub(x + nx, y + ny, 1.6 * (w / 2.6) + 0.4);
			fb += dotSub(x - nx * 0.4, y - ny * 0.4, 1.3 * (w / 2.6) + 0.35);
		}
		const [tx, ty] = c[3];
		fb += dotSub(tx, ty, 0.8);
	}
	if (st === "leafy") {
		for (const c of wands) {
			const [x, y] = c[3];
			fa += ovalSub(x, y + 1.6, 1.2, 2.6, 90);
		}
	}
	return sk(sd, "#5d6e3e", 1.2) + sk(lv, "#5c8f48", 1.9) + p(fa, "#b5348a") + p(fb, "#d8609f");
}

/* ---------- 10. Flowering rush ---------- */
function floweringRush(st: GrowingStage): string {
	const bl = S<string[]>(
		st,
		["M38 86C38 80 37 76 35 70", "M41 86C41 80 43 76 45 72"],
		["M36 86C35 72 30 60 26 50", "M39 86C39 70 37 56 37 44", "M42 86C43 72 47 60 52 50", "M44 86C46 76 52 68 56 64"],
		["M34 86C32 70 24 54 18 44", "M37 86C36 66 32 46 31 34", "M42 86C43 66 47 48 50 36", "M45 86C47 72 55 58 62 50", "M39 86C40 70 44 58 48 52"],
	);
	let s = pond(S(st, 13, 20, 25)) + sk(bl.join(""), "#4e8a56", 1.8) + sk(bl.slice(1, 3).join(""), "#6aa66a", 0.7);
	if (st === "sprout") return s;
	const cx = 40;
	const cy = S(st, 0, 34, 22);
	s += sk(`M40 86C40 70 41 50 ${cx} ${cy}`, "#5f8a4a", 1.2);
	if (st === "leafy") return s + p(lensSub(cx, cy + 1, -100, 6, 1.2) + lensSub(cx, cy + 1, -80, 6, 1.2), "#9a6a5a") + dots([[cx - 1, cy - 4], [cx + 1.4, cy - 3.6], [cx, cy - 6]], 1, "#e6a2b4");
	const ends: number[][] = [];
	let sp = "";
	for (const [a, l] of [[-165, 12], [-140, 13], [-118, 15], [-98, 16], [-78, 15], [-58, 14], [-36, 13], [-14, 12]] as const) {
		const x = cx + Math.cos(a * RAD) * l;
		const y = cy + Math.sin(a * RAD) * l;
		sp += `M${cx} ${cy}L${f(x)} ${f(y)}`;
		ends.push([x, y]);
	}
	let outer = "";
	let inner = "";
	ends.forEach(([x = 0, y = 0], i) => {
		const k = i % 2 ? 1 : 0.85;
		outer += ringSub(x, y, 3, 1.5 * k, 1.6 * k, 1.1 * k, -90);
		inner += ringSub(x, y, 3, 1.3 * k, 1.3 * k, 0.8 * k, -30);
	});
	return s + sk(sp, "#6f8a4a", 0.6) + p(lensSub(cx, cy, 70, 6, 1) + lensSub(cx, cy, 110, 6, 1), "#9a6a5a") + p(outer, "#f2b3c2") + p(inner, "#d97a98") + dots(ends, 0.6, "#8a2f4a");
}

/* ---------- 11. Water plantain ---------- */
function waterPlantain(st: GrowingStage): string {
	const lfs = S<[number, number, number, number][]>(
		st,
		[[38, 77, -110, 8], [42, 78, -70, 7]],
		[[34, 70, -125, 12], [46, 70, -55, 12], [40, 66, -92, 11]],
		[[30, 70, -140, 13], [50, 70, -40, 13], [35, 64, -112, 13], [45, 64, -68, 13]],
	);
	let pt = "";
	let lv = "";
	let rib = "";
	for (const [x, y, a, l] of lfs) {
		pt += `M40 86Q${f((x + 40) / 2)} ${f(y + 8)} ${f(x)} ${f(y)}`;
		lv += ovalAt(x, y, a, l, l * 0.3);
		rib += `M${f(x)} ${f(y)}l${f(Math.cos(a * RAD) * l * 0.85)} ${f(Math.sin(a * RAD) * l * 0.85)}`;
	}
	let s = pond(S(st, 13, 20, 24)) + sk(pt, "#5f8a48", 1.1) + p(lv, "#5f9e4c") + sk(rib, "#3f7a35", 0.5);
	if (st === "sprout") return s;
	const top = S(st, 0, 40, 8);
	let br = `M40 86L40 ${top}`;
	const tips: number[][] = [];
	const whorls = st === "leafy" ? [[58, 6], [50, 4.5], [44, 3]] : [[62, 15], [50, 13], [39, 11], [29, 8.5], [20, 6], [13, 3.5]];
	for (const [y = 0, w = 0] of whorls) {
		for (const s2 of [-1, 1]) {
			const ex = 40 + s2 * w;
			const ey = y - w * 0.55;
			br += `M40 ${f(y)}L${f(ex)} ${f(ey)}`;
			tips.push([ex, ey]);
			if (w > 7) {
				const mx = 40 + s2 * w * 0.55;
				const my = y - w * 0.3;
				br += `M${f(mx)} ${f(my)}l${f(s2 * w * 0.2)} ${f(-w * 0.45)}M${f(mx)} ${f(my)}l${f(s2 * w * 0.3)} ${f(w * 0.12)}`;
				tips.push([mx + s2 * w * 0.2, my - w * 0.45], [mx + s2 * w * 0.3, my + w * 0.12]);
			}
		}
	}
	tips.push([40, top]);
	s += sk(br, "#7a9a58", 0.7);
	if (st === "leafy") return s + dots(tips, 0.7, "#c9d9a6");
	return s + dots(tips, 1.15, "#f0d2de") + dots(tips.filter((_, i) => i % 2 === 0), 0.6, "#d07a98");
}

/* ---------- 12. Lizard's tail ---------- */
function heartSub(x: number, y: number, deg: number, len: number, w: number): string {
	const c = Math.cos(deg * RAD);
	const sn = Math.sin(deg * RAD);
	const P = (u: number, v: number) => `${f(x + u * c - v * sn)} ${f(y + u * sn + v * c)}`;
	return `M${P(0, 0)}C${P(-len * 0.15, -w * 1.2)} ${P(len * 0.55, -w * 1.1)} ${P(len, 0)}C${P(len * 0.55, w * 1.1)} ${P(-len * 0.15, w * 1.2)} ${P(0, 0)}Z`;
}
function lizardsTail(st: GrowingStage): string {
	const stems: P4[] = S<P4[]>(
		st,
		[[[40, 86], [40, 80], [40, 76], [40, 70]]],
		[
			[[38, 86], [36, 74], [32, 62], [30, 52]],
			[[42, 86], [44, 72], [48, 60], [50, 50]],
		],
		[
			[[36, 86], [32, 72], [24, 58], [21, 44]],
			[[40, 86], [40, 70], [39, 52], [38, 34]],
			[[44, 86], [48, 72], [55, 58], [58, 46]],
		],
	);
	let sd = "";
	let lv = "";
	let tail = "";
	let tip = "";
	stems.forEach((c, i) => {
		sd += cub(c);
		const ts = st === "sprout" ? [0.6, 0.9] : [0.25, 0.48, 0.7, 0.9];
		ts.forEach((t, j) => {
			const [x, y] = bez(c, t);
			const a = ang(c, t) + (j % 2 ? 58 : -58);
			lv += heartSub(x, y, a, S(st, 7, 9, 10) * (1 - t * 0.25), S(st, 2.6, 3.2, 3.6) * (1 - t * 0.25));
		});
		if (st === "sprout") return;
		const [x, y] = c[3];
		const s = i === 0 ? -1 : 1;
		const h = st === "leafy" ? 6 : 12;
		tail += `M${f(x)} ${f(y)}C${f(x)} ${f(y - h * 0.6)} ${f(x + s * h * 0.5)} ${f(y - h * 1.1)} ${f(x + s * h * 0.8)} ${f(y - h * 0.8)}`;
		tip += `M${f(x + s * h * 0.8)} ${f(y - h * 0.8)}q${f(s * h * 0.25)} ${f(h * 0.2)} ${f(s * h * 0.25)} ${f(h * 0.55)}`;
	});
	return pond(S(st, 13, 20, 25)) + sk(sd, "#4f7a3c", 1.4) + p(lv, "#4f9a48") + sk(tail, st === "leafy" ? "#cfd8a8" : "#ebe6cc", 2.6) + sk(tip, "#d3cca4", 1.6);
}

/* ---------- 13. Cardinal flower ---------- */
function cardinal(st: GrowingStage): string {
	const top = S(st, 72, 40, 8);
	const c: P4 = [[40, 87], [40, 70], [41, 40], [40, top]];
	let lv = "";
	const lts = S(st, [0.4, 0.7, 0.95], [0.1, 0.25, 0.4, 0.55, 0.7, 0.85], [0.06, 0.14, 0.22, 0.3, 0.38, 0.45]);
	lts.forEach((t, i) => {
		const [x, y] = bez(c, t);
		lv += lensSub(x, y, (i % 2 ? -30 : -150) + (i % 2 ? 1 : -1) * t * 20, S(st, 7, 11, 13) * (1 - t * 0.4), S(st, 1.6, 2, 2.2));
	});
	let s = (st === "bloom" ? `<path d="M30 87Q34 80 38 86M50 87Q46 80 42 86" fill="none" stroke="#5d6e3e" stroke-width="1"/>` : "") + sk(cub(c), "#5a5a34", S(st, 1.4, 1.8, 2)) + p(lv, "#4f7d3e");
	if (st === "sprout") return s;
	let red = "";
	let dark = "";
	const n = st === "leafy" ? 3 : 9;
	for (let i = 0; i < n; i++) {
		const t = st === "leafy" ? 0.88 + i * 0.05 : 0.5 + i * 0.056;
		const [x, y] = bez(c, t);
		if (st === "leafy") {
			dark += ovalSub(x + (i % 2 ? 1.6 : -1.6), y, 1.8, 0.9, i % 2 ? -20 : 200);
			continue;
		}
		const sd = i % 2 ? 1 : -1;
		const k = 1.55 - (t - 0.5) * 1.2;
		const fx = x + sd * 3 * k;
		const fy = y - 1.2 * k;
		red += lensSub(x, y, sd > 0 ? -18 : -162, 3.4 * k, 1 * k);
		for (const a of [30, 60, 90]) red += lensSub(fx, fy, sd > 0 ? a - 10 : 190 - a, 4.2 * k, 1.1 * k);
		red += lensSub(fx, fy, sd > 0 ? -60 : -120, 3.6 * k, 0.6 * k) + lensSub(fx, fy, sd > 0 ? -35 : -145, 3.4 * k, 0.6 * k);
		dark += lensSub(x, y, sd > 0 ? -60 : -120, 3 * k, 0.6 * k);
	}
	s += p(red, "#d42a35") + p(dark, st === "leafy" ? "#b8323a" : "#5a6a34");
	return s + (st === "bloom" ? p(ovalSub(40, top - 1, 1, 2.4, 90), "#b8323a") : "");
}

/* ---------- 14. Swamp milkweed ---------- */
function umbel(x: number, y: number, r: number): [string, string, string] {
	let a = "";
	let b = "";
	let c = "";
	for (let i = 0; i < 9; i++) {
		const t = (-180 + i * 22.5) * RAD;
		a += dotSub(x + Math.cos(t) * r * 0.78, y + Math.sin(t) * r * 0.6 + r * 0.2, r * 0.25);
	}
	for (let i = 0; i < 5; i++) {
		const t = (-160 + i * 35) * RAD;
		b += dotSub(x + Math.cos(t) * r * 0.42, y + Math.sin(t) * r * 0.38, r * 0.24);
	}
	c += dotSub(x, y - r * 0.15, r * 0.25);
	return [a, b, c];
}
function swampMilkweed(st: GrowingStage): string {
	const stems: P4[] = S<P4[]>(
		st,
		[[[40, 87], [40, 80], [40, 76], [40, 70]]],
		[
			[[40, 87], [40, 70], [40, 54], [40, 40]],
			[[40, 64], [36, 58], [32, 52], [30, 48]],
		],
		[
			[[39, 87], [39, 66], [38, 44], [38, 24]],
			[[39, 60], [34, 52], [26, 44], [22, 34]],
			[[39, 54], [44, 46], [52, 36], [56, 28]],
			[[42, 87], [46, 70], [56, 58], [61, 46]],
		],
	);
	let sd = "";
	let lv = "";
	let a = "";
	let b = "";
	let cc = "";
	stems.forEach((c, i) => {
		sd += cub(c);
		const ts = st === "sprout" ? [0.5, 0.9] : i === 0 ? [0.2, 0.38, 0.56, 0.74] : [0.45, 0.8];
		lv += leavesOn(c, ts, S(st, 7, 10, 11), 1.6, 35, true, 0.35);
		if (st === "sprout") return;
		const [x, y] = c[3];
		const r = st === "leafy" ? 3.4 : 5.2;
		const u = umbel(x, y - r * 0.4, r);
		a += u[0];
		b += u[1];
		cc += u[2];
	});
	if (st === "leafy") return sk(sd, "#5a7a44", 1.5) + p(lv, "#5c9450") + p(a + b + cc, "#c98a9c");
	return sk(sd, "#5a7a44", 1.5) + p(lv, "#5c9450") + p(a, "#c2507a") + p(b, "#e07a9e") + p(cc, "#f4b8cc");
}

/* ---------- 15. Golden club ---------- */
function goldenClub(st: GrowingStage): string {
	const lfs = S<[number, number, number][]>(
		st,
		[[-105, 10, 3]],
		[[-130, 15, 4], [-60, 16, 4.2], [-95, 18, 4.4]],
		[[-150, 17, 4.6], [-35, 17, 4.6], [-120, 20, 5], [-62, 21, 5]],
	);
	let a = "";
	let b = "";
	for (const [g, l, w] of lfs) {
		a += ovalAt(40, 85, g, l, w);
		b += ovalAt(40 + Math.cos(g * RAD) * l * 0.15, 85 + Math.sin(g * RAD) * l * 0.15, g + 4, l * 0.8, w * 0.35);
	}
	let s = pond(S(st, 14, 21, 26)) + p(a, "#5a8c82") + p(b, "#86b0a6");
	if (st === "sprout") return s;
	const clubs: [string, number, number][] = st === "leafy" ? [["M41 86C41 78 42 72 45 66", 45, 66]] : [["M38 86C37 74 32 66 28 58", 28, 58], ["M41 86C41 72 42 60 44 48", 44, 48], ["M43 86C45 76 50 70 54 64", 54, 64]];
	let wh = "";
	let gd = "";
	for (const [d, x, y] of clubs) {
		wh += d;
		const t = x < 40 ? -125 : x > 50 ? -60 : -82;
		gd += `M${f(x)} ${f(y)}l${f(Math.cos(t * RAD) * 7)} ${f(Math.sin(t * RAD) * 7)}`;
	}
	return s + sk(wh, "#ebe7d6", 2.4) + sk(gd, "#e0b324", 3.2);
}

/* ---------- 16. Skunk cabbage ---------- */
function hood(x: number, y: number, k: number): string {
	const P = (u: number, v: number) => `${f(x + u * k)} ${f(y + v * k)}`;
	const body = `M${P(-5, 0)}C${P(-6.5, -9)} ${P(-3, -14)} ${P(1.5, -17)}C${P(1, -13)} ${P(6, -10)} ${P(5.5, 0)}Z`;
	const slit = `M${P(-0.6, -2)}C${P(-2, -6)} ${P(-1, -10)} ${P(0.8, -12)}C${P(1.6, -9)} ${P(1.8, -5)} ${P(0.6, -2)}Z`;
	const mot = dotSub(x - 3.2 * k, y - 4 * k, 0.8 * k) + dotSub(x + 3.4 * k, y - 6 * k, 0.7 * k) + dotSub(x - 2.4 * k, y - 9 * k, 0.6 * k) + dotSub(x + 2.6 * k, y - 2 * k, 0.7 * k);
	return p(body, "#7a2e3c") + p(mot, "#c49a6e") + p(slit, "#3a1820") + dots([[x + 0.2 * k, y - 5 * k]], 1.2 * k, "#c9a24a");
}
function skunkCabbage(st: GrowingStage): string {
	if (st === "sprout") return hood(40, 87, 1);
	const big = st === "bloom";
	const lfs = big
		? [[-158, 22, 8.5, "#4f9a40"], [-22, 22, 8.5, "#4f9a40"], [-125, 26, 9.5, "#62ae4c"], [-55, 26, 9.5, "#62ae4c"], [-92, 24, 9, "#6fba56"]]
		: [[-125, 16, 5, "#4f9a40"], [-58, 17, 5, "#62ae4c"], [-90, 18, 4, "#6fba56"]];
	let s = "";
	let rib = "";
	for (const [g = 0, l = 0, w = 0, c = ""] of lfs as [number, number, number, string][]) {
		s += p(ovalAt(40, 86, g, l, w), c);
		rib += `M40 86l${f(Math.cos(g * RAD) * l * 0.9)} ${f(Math.sin(g * RAD) * l * 0.9)}`;
	}
	return s + sk(rib, "#3f7a35", 0.8) + (big ? hood(29, 88, 0.85) + hood(50, 88, 0.7) : hood(33, 88, 0.7));
}

/* ---------- 17. Bog rosemary ---------- */
function bogRosemary(st: GrowingStage): string {
	const br: P4[] = S<P4[]>(
		st,
		[[[40, 87], [40, 82], [39, 78], [39, 72]]],
		[
			[[39, 87], [36, 78], [30, 70], [27, 62]],
			[[40, 87], [40, 76], [41, 66], [41, 56]],
			[[41, 87], [45, 78], [50, 70], [54, 64]],
		],
		[
			[[38, 87], [32, 80], [22, 72], [18, 62]],
			[[39, 87], [36, 74], [31, 62], [29, 50]],
			[[40, 87], [41, 72], [42, 58], [43, 44]],
			[[41, 87], [46, 76], [52, 64], [55, 54]],
			[[42, 87], [50, 80], [58, 74], [63, 66]],
		],
	);
	let sd = "";
	let lv = "";
	let pd = "";
	let urn = "";
	let mouth = "";
	br.forEach((c, i) => {
		sd += cub(c);
		const ts = st === "sprout" ? [0.5, 0.75, 1] : [0.35, 0.55, 0.75, 0.95];
		lv += leavesOn(c, ts, S(st, 6, 7.5, 8), 1.2, 40, true, 0.2);
		if (st === "sprout") return;
		const [x, y] = c[3];
		const n = st === "leafy" ? (i === 1 ? 2 : 0) : 3;
		for (let j = 0; j < n; j++) {
			const dx = (j - (n - 1) / 2) * 3.4;
			const ux = x + dx;
			const uy = y + 4.5 + Math.abs(dx) * 0.2;
			pd += `M${f(x)} ${f(y - 0.5)}Q${f(x + dx * 0.9)} ${f(y - 1.5)} ${f(ux)} ${f(uy - 2)}`;
			urn += ovalSub(ux, uy, 1.5, 1.9, 90);
			mouth += dotSub(ux, uy + 1.7, 0.6);
		}
	});
	return sk(sd, "#7a5a4a", 1.2) + p(lv, "#7fa69c") + sk(pd, "#c2607a", 0.6) + p(urn, "#f2adc0") + p(mouth, "#d97a96");
}

/* ---------- 18. Sphagnum moss ---------- */
function sphagnum(st: GrowingStage): string {
	const cols = ["#8cc05a", "#b9cf63", "#c45a62", "#7aae4c", "#d87c74"];
	const out: string[] = ["", "", "", "", ""];
	const heads: number[][] = [];
	const add = (x: number, y: number, r: number, c: number) => {
		heads.push([x, y, r, c]);
	};
	if (st === "sprout") {
		add(37, 80, 2.6, 0);
		add(42, 78, 2.8, 3);
		add(45.5, 82, 2.4, 1);
	} else {
		const W = st === "leafy" ? 14 : 27;
		const H = st === "leafy" ? 11 : 22;
		const rows = st === "leafy" ? 3 : 5;
		for (let rI = 0; rI < rows; rI++) {
			const y = 84 - (rI * H) / rows;
			const span = W * Math.sqrt(1 - Math.pow((rI + 0.5) / (rows + 0.2), 2));
			const n = Math.max(1, Math.round((span * 2) / 5.2));
			for (let j = 0; j < n; j++) {
				const x = 40 - span + ((j + 0.5) * span * 2) / n + (rI % 2 ? 1.3 : -1.3);
				add(x, y - (j % 2) * 1.4, st === "leafy" ? 2.8 : 3.1, (rI * 3 + j * 2) % (st === "leafy" ? 4 : 5));
			}
		}
	}
	let stems = "";
	for (const [x = 0, y = 0, r = 2, c = 0] of heads) {
		for (const a0 of [0, 60, 120]) {
			const g = (a0 + c * 13 + x * 7) * RAD;
			const dx = Math.cos(g) * r;
			const dy = Math.sin(g) * r;
			out[c] += `M${f(x - dx)} ${f(y - dy)}l${f(2 * dx)} ${f(2 * dy)}`;
		}
		if (st === "sprout") stems += `M${f(x)} ${f(y)}L${f(x + (x - 41) * 0.2)} 87`;
	}
	const mound = st === "sprout" ? "" : p(`M${st === "leafy" ? "24 88C25 76 33 71 40 71C47 71 55 76 56 88Z" : "11 88C12 72 26 61 40 61C54 61 68 72 69 88Z"}`, "#5d8a3e");
	return mound + sk(stems, "#5f8a42", 0.9) + out.map((d, i) => sk(d, cols[i] ?? "#8cc05a", 1.25)).join("");
}

/* ---------- 19. Bog arum ---------- */
function spathe(x: number, y: number, k: number, tilt: number): string {
	const body = `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(tilt)}) scale(${f(k)})"><path d="M0 4C-5.5 1 -6 -6 0 -11C6 -6 5.5 1 0 4Z" fill="#f7f6ef"/><path d="M0 4C-2 1 -3 -4 0 -11C1 -6 1.5 0 0 4Z" fill="#d3d6bc"/>${el(0, -2, 1.3, 3.6, "#e4c23a")}</g>`;
	return body;
}
function bogArum(st: GrowingStage): string {
	const lfs = S<[number, number, number, number, number][]>(
		st,
		[[40, 74, -95, 9, 3.8]],
		[[30, 66, -130, 13, 5], [50, 66, -50, 13, 5], [40, 60, -92, 12, 4.6]],
		[[24, 66, -150, 15, 5.6], [56, 66, -30, 15, 5.6], [33, 58, -115, 14, 5.2], [49, 56, -68, 14, 5.2]],
	);
	let pt = "";
	let lv = "";
	let rib = "";
	for (const [x, y, a, l, w] of lfs) {
		pt += `M40 86Q${f((x + 40) / 2)} ${f(y + 6)} ${f(x)} ${f(y)}`;
		lv += heartSub(x, y, a, l, w);
		rib += `M${f(x)} ${f(y)}l${f(Math.cos(a * RAD) * l * 0.8)} ${f(Math.sin(a * RAD) * l * 0.8)}`;
	}
	let s = pond(S(st, 13, 21, 26)) + sk(pt, "#4f8a42", 1.2) + p(lv, "#3f8a45") + sk(rib, "#2f6a35", 0.5);
	if (st === "sprout") return s;
	if (st === "leafy") return s + sk("M40 86L40 66", "#4f8a42", 1.4) + spathe(40, 62, 0.75, 5);
	return s + sk("M40 86C40 72 39 58 38 46M44 86C45 78 48 74 50 72", "#4f8a42", 1.5) + spathe(38, 41, 1.15, -8) + dots([[48, 69.5], [50.6, 69], [49.4, 67], [51.4, 71.2], [48.6, 72], [50.4, 73.6]], 1.4, "#c8322e") + dots([[48, 69], [50.2, 68.6]], 0.45, "#f08a7a");
}

/* ---------- 20. Parrot's feather ---------- */
function featherSub(c: P4, n: number, len: number): string {
	let d = "";
	for (let i = 0; i <= n; i++) {
		const t = 0.25 + (0.75 * i) / n;
		const [x, y] = bez(c, t);
		const a = ang(c, t);
		const l = len * (0.55 + 0.45 * Math.sin(Math.min(1, (t - 0.25) / 0.6) * Math.PI * 0.5)) * (t > 0.92 ? 0.6 : 1);
		for (const s of [-1, 1]) {
			const g = (a + s * 75) * RAD;
			d += `M${f(x)} ${f(y)}l${f(Math.cos(g) * l)} ${f(Math.sin(g) * l)}`;
		}
	}
	return d;
}
function parrotsFeather(st: GrowingStage): string {
	const stems: P4[] = S<P4[]>(
		st,
		[[[40, 86], [40, 82], [41, 78], [42, 74]]],
		[
			[[34, 86], [30, 80], [27, 72], [27, 64]],
			[[40, 86], [40, 78], [41, 68], [42, 58]],
			[[46, 86], [51, 80], [54, 74], [55, 66]],
		],
		[
			[[30, 86], [22, 82], [17, 74], [16, 62]],
			[[36, 86], [33, 74], [30, 60], [30, 46]],
			[[41, 86], [41, 72], [42, 54], [44, 36]],
			[[45, 86], [49, 74], [54, 60], [56, 48]],
			[[50, 86], [58, 82], [63, 74], [65, 64]],
		],
	);
	let sd = "";
	let fa = "";
	let fb = "";
	stems.forEach((c, i) => {
		sd += cub(c);
		const n = Math.round(S(st, 6, 10, 14) * (i === 2 && st === "bloom" ? 1.25 : 1));
		const d = featherSub(c, n, S(st, 3.4, 4.4, 5));
		if (i % 2) fa += d;
		else fb += d;
	});
	return pond(S(st, 13, 21, 27)) + sk(fb, "#6fb79a", 1.1) + sk(fa, "#8fd0b0", 1.1) + sk(sd, "#4f8a6e", 1.1);
}

/* ---------- 21. Water soldier ---------- */
function serrSub(x: number, y: number, deg: number, len: number, w: number): string {
	const c = Math.cos(deg * RAD);
	const sn = Math.sin(deg * RAD);
	const P = (u: number, v: number) => `${f(x + u * c - v * sn)} ${f(y + u * sn + v * c)}`;
	const n = 5;
	let up = "";
	let dn = "";
	for (let i = 1; i <= n; i++) {
		const u = (i / (n + 1)) * len;
		const ww = w * (1 - u / len);
		up += `L${P(u, -ww)}L${P(u + len * 0.06, -ww * 0.7)}`;
		dn = `L${P(u + len * 0.06, ww * 0.7)}L${P(u, ww)}` + dn;
	}
	return `M${P(0, -w * 0.6)}${up}L${P(len, 0)}${dn}L${P(0, w * 0.6)}Z`;
}
function waterSoldier(st: GrowingStage): string {
	const set = S<[number, number, number][]>(
		st,
		[[-115, 11, 1.6], [-65, 11, 1.6], [-90, 13, 1.8]],
		[[-160, 15, 2.2], [-20, 15, 2.2], [-132, 20, 2.4], [-48, 20, 2.4], [-108, 23, 2.4], [-72, 23, 2.4], [-90, 24, 2.4]],
		[[-168, 18, 2.6], [-12, 18, 2.6], [-145, 24, 2.8], [-35, 24, 2.8], [-122, 29, 2.9], [-58, 29, 2.9], [-104, 32, 2.9], [-76, 32, 2.9], [-90, 30, 2.6]],
	);
	let a = "";
	let b = "";
	set.forEach(([g, l, w], i) => {
		const d = serrSub(40, 84, g, l, w);
		if (i % 2) a += d;
		else b += d;
	});
	let s = pond(S(st, 14, 22, 27)) + p(b, "#3f7a40") + p(a, "#5a9a4c") + el(40, 85, S(st, 4, 6, 7), 2.2, "#4f8a42");
	if (st !== "bloom") return s;
	for (const [x, y, k] of [[27, 66, 1.2], [53, 64, 1.1]] as const) {
		s += sk(`M40 84Q${f((x + 40) / 2)} ${f(y + 12)} ${f(x)} ${f(y + 2)}`, "#5f8a48", 1) + tri(x, y, 2 * k, 2.2 * k, 1.8 * k, 1 * k);
	}
	return s;
}

/* ---------- 22. Eelgrass ---------- */
function eelgrass(st: GrowingStage): string {
	const top = S(st, 62, 34, 18);
	const rib = S<[number, number, number][]>(
		st,
		[[38, 14, -1], [41, 19, 1], [43, 15, 1]],
		[[30, 26, -1], [34, 40, 1], [38, 50, -1], [42, 46, 1], [46, 38, -1], [50, 28, 1]],
		[[26, 40, -1], [30, 58, 1], [34, 68, -1], [37, 62, 1], [40, 70, -1], [44, 66, 1], [48, 60, -1], [52, 50, 1], [56, 36, -1]],
	);
	let a = "";
	let b = "";
	rib.forEach(([x, h, s], i) => {
		const ty = 87 - h;
		const d = `M${f(x)} 87C${f(x + s * 5)} ${f(87 - h * 0.35)} ${f(x - s * 5)} ${f(87 - h * 0.7)} ${f(x + s * 2.5)} ${f(ty)}`;
		const lay = ty < top + 1 ? `q${f(s * 3)} -1.2 ${f(s * 9)} 0.6` : "";
		if (i % 2) a += d + lay;
		else b += d + lay;
	});
	let s = pool(top, S(st, 15, 22, 28)) + sk(b, "#4f9a50", 2) + sk(a, "#72b85e", 2);
	if (st !== "bloom") return s;
	s += sk("M44 87C46 84 42 82 44 79C46 76 42 74 44 71C46 68 42 66 44 63C46 60 42 56 44 50C45 40 44 28 44 19", "#9cc87a", 0.7);
	return s + tri(44, 18, 1.3, 1.4, 1, 0.5);
}

/* ---------- 23. Floating heart ---------- */
function floatingHeart(st: GrowingStage): string {
	const pads = S<[number, number, number, number][]>(
		st,
		[[38, 85.6, 7, 2.2]],
		[[27, 85.6, 9, 2.6], [52, 85.8, 9, 2.6], [40, 87.6, 7, 1.8]],
		[[20, 85.4, 10, 2.8], [60, 85.6, 10, 2.8], [34, 87.6, 9, 2], [48, 84.4, 8, 2.2]],
	);
	let a = "";
	let mot = "";
	for (const [x, y, rx, ry] of pads) {
		a += padSub(x, y, rx, ry, 34);
		mot += dotSub(x - rx * 0.5, y - ry * 0.3, 0.6) + dotSub(x + rx * 0.45, y - ry * 0.1, 0.5) + dotSub(x - rx * 0.1, y - ry * 0.55, 0.45);
	}
	let s = pond(S(st, 14, 21, 27)) + p(a, "#4d8c43") + p(mot, "#7a5a3a");
	const fls = S<number[][]>(st, [], [[40, 78, 0.9]], [[27, 76, 1.05], [40, 72, 1.25], [54, 77, 1.05], [33, 81, 0.8]]);
	if (st === "sprout") return s + sk("M43 86L44 80", "#5f8a48", 0.9) + el(44, 79, 1.2, 1.8, "#d9c25a");
	let stalks = "";
	let pet = "";
	let fr = "";
	let eye = "";
	for (const [x = 0, y = 0, k = 1] of fls) {
		stalks += `M${f(x)} 86L${f(x)} ${f(y)}`;
		for (let i = 0; i < 5; i++) {
			const g = -90 + i * 72;
			pet += ovalSub(x + Math.cos(g * RAD) * 2.4 * k, y + Math.sin(g * RAD) * 1.5 * k, 2.4 * k, 1.5 * k, g * 0.6);
			fr += dotSub(x + Math.cos(g * RAD) * 4.4 * k, y + Math.sin(g * RAD) * 2.7 * k, 0.5 * k);
		}
		eye += dotSub(x, y, 0.9 * k);
	}
	return s + sk(stalks, "#5f8a48", 1) + p(pet + fr, "#f2cc36") + p(eye, "#d29a1e");
}

/* ---------- 24. Fanwort ---------- */
function fanSub(x: number, y: number, deg: number, l: number): string {
	let d = "";
	for (const i of [-1.5, -0.5, 0.5, 1.5]) {
		const g = (deg + i * 22) * RAD;
		d += `M${f(x)} ${f(y)}l${f(Math.cos(g) * l)} ${f(Math.sin(g) * l)}`;
	}
	return d;
}
function fanwort(st: GrowingStage): string {
	const top = S(st, 64, 36, 20);
	const stems: P4[] = S<P4[]>(
		st,
		[[[40, 87], [40, 82], [41, 78], [41, 72]]],
		[
			[[36, 87], [34, 76], [31, 66], [30, 56]],
			[[42, 87], [43, 74], [42, 60], [44, 44]],
			[[46, 87], [50, 78], [52, 70], [53, 62]],
		],
		[
			[[32, 87], [28, 74], [22, 60], [21, 42]],
			[[38, 87], [37, 70], [34, 46], [34, 22]],
			[[43, 87], [45, 70], [48, 48], [49, 24]],
			[[48, 87], [54, 76], [59, 64], [60, 48]],
		],
	);
	let sd = "";
	let fa = "";
	let fb = "";
	stems.forEach((c) => {
		sd += cub(c);
		const n = S(st, 3, 4, 6);
		for (let i = 1; i <= n; i++) {
			const t = 0.12 + (0.88 * i) / n;
			const [x, y] = bez(c, t);
			const a = ang(c, t);
			const l = S(st, 4.4, 5.6, 6.2) * (1 - 0.25 * t);
			const d = fanSub(x, y, a - 70, l) + fanSub(x, y, a + 70, l);
			if (i % 2) fa += d;
			else fb += d;
		}
	});
	let s = pool(top, S(st, 15, 22, 28)) + sk(sd, "#4f8a42", 0.9) + sk(fa, "#7cc05c", 0.7) + sk(fb, "#5fa84a", 0.7);
	if (st !== "bloom") return s;
	let wh = "";
	const eyes: number[][] = [];
	for (const [x, y] of [[34, 17], [49, 19]] as const) {
		s += sk(`M${x} 22L${x} ${y}`, "#4f8a42", 0.8);
		wh += ringSub(x, y, 6, 1.5, 1.5, 1, -90);
		eyes.push([x, y]);
	}
	return s + p(wh, "#f6f4ea") + dots(eyes, 0.9, "#e9c64a");
}

/* ---------- 25. Hornwort ---------- */
function hornwort(st: GrowingStage): string {
	const top = S(st, 64, 36, 16);
	const stems: P4[] = S<P4[]>(
		st,
		[[[40, 87], [40, 82], [39, 78], [40, 72]]],
		[
			[[37, 87], [35, 74], [31, 62], [30, 50]],
			[[43, 87], [45, 74], [48, 64], [50, 54]],
		],
		[
			[[34, 87], [30, 72], [22, 58], [20, 38]],
			[[39, 87], [38, 66], [35, 44], [36, 22]],
			[[44, 87], [47, 66], [50, 46], [50, 26]],
			[[47, 87], [55, 76], [61, 62], [61, 48]],
		],
	);
	let sd = "";
	let nd = "";
	let tip = "";
	let tail = "";
	stems.forEach((c) => {
		sd += cub(c);
		const [ex, ey] = c[3];
		tail += lensSub(ex, ey + S(st, 3, 4, 5), ang(c, 0.97), S(st, 4, 5, 6.5), S(st, 1.4, 1.8, 2.2));
		const n = S(st, 5, 8, 11);
		for (let i = 1; i <= n; i++) {
			const t = 0.15 + (0.85 * i) / n;
			const [x, y] = bez(c, t);
			const a = ang(c, t);
			const near = t > 0.75;
			const l = near ? 3.6 : 4.8;
			let d = "";
			for (const o of [-130, -75, 75, 130]) {
				const g = (a + o) * RAD;
				d += `M${f(x)} ${f(y)}l${f(Math.cos(g) * l)} ${f(Math.sin(g) * l)}`;
			}
			if (near) tip += d;
			else nd += d;
		}
	});
	return pool(top, S(st, 15, 22, 28)) + sk(sd, "#2f5a2e", 1) + sk(nd, "#3f6e35", 1) + sk(tip, "#4d7f3a", 1.1) + p(tail, "#4d7f3a");
}

export const SPECIES: Species[] = [
	{ id: "victoria-water-lily", name: "Victoria water lily", draw: victoria },
	{ id: "yellow-pond-lily", name: "Yellow pond lily", draw: yellowPondLily },
	{ id: "water-poppy", name: "Water poppy", draw: waterPoppy },
	{ id: "water-hawthorn", name: "Water hawthorn", draw: waterHawthorn },
	{ id: "frogbit", name: "Frogbit", draw: frogbit },
	{ id: "water-forget-me-not", name: "Water forget-me-not", draw: waterForgetMeNot },
	{ id: "bogbean", name: "Bogbean", draw: bogbean },
	{ id: "water-mint", name: "Water mint", draw: waterMint },
	{ id: "purple-loosestrife", name: "Purple loosestrife", draw: loosestrife },
	{ id: "flowering-rush", name: "Flowering rush", draw: floweringRush },
	{ id: "water-plantain", name: "Water plantain", draw: waterPlantain },
	{ id: "lizards-tail", name: "Lizard's tail", draw: lizardsTail },
	{ id: "cardinal-flower", name: "Cardinal flower", draw: cardinal },
	{ id: "swamp-milkweed", name: "Swamp milkweed", draw: swampMilkweed },
	{ id: "golden-club", name: "Golden club", draw: goldenClub },
	{ id: "skunk-cabbage", name: "Skunk cabbage", draw: skunkCabbage },
	{ id: "bog-rosemary", name: "Bog rosemary", draw: bogRosemary },
	{ id: "sphagnum-moss", name: "Sphagnum moss", draw: sphagnum },
	{ id: "bog-arum", name: "Bog arum", draw: bogArum },
	{ id: "parrots-feather", name: "Parrot's feather", draw: parrotsFeather },
	{ id: "water-soldier", name: "Water soldier", draw: waterSoldier },
	{ id: "eelgrass", name: "Eelgrass", draw: eelgrass },
	{ id: "floating-heart", name: "Floating heart", draw: floatingHeart },
	{ id: "fanwort", name: "Fanwort", draw: fanwort },
	{ id: "hornwort", name: "Hornwort", draw: hornwort },
];
