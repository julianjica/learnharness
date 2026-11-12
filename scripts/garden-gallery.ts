/**
 * Render garden species to an HTML gallery and a PNG, for checking the
 * drawings by eye.
 *
 *   npx tsx scripts/garden-gallery.ts <family|all> <out.png> [--light]
 *
 * <family> is a module in src/core/garden-species/ exporting SPECIES.
 * Writes <out>.html next to the PNG. Needs Google Chrome.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { drawCell, type Species } from "../src/core/garden-species/kit";

const STAGES = ["seed", "sprout", "leafy", "bloom"] as const;
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

async function load(family: string): Promise<readonly Species[]> {
	if (family === "all") return (await import("../src/core/garden-species/index")).ALL_SPECIES;
	const mod = await import(`../src/core/garden-species/${family}`);
	return mod.SPECIES as Species[];
}

function page(species: readonly Species[], light: boolean): string {
	const bg = light ? "#ffffff" : "#1c1c1c";
	const rows = species
		.map(
			(s, i) =>
				`<tr><td>${i + 1}. ${s.name}<br><small>${s.id}</small></td>${STAGES.map(
					(st) => `<td><svg viewBox="0 0 80 96" width="88" height="106">${drawCell(s, st)}</svg></td>`,
				).join("")}<td><svg viewBox="0 0 80 96" width="44" height="53">${drawCell(s, "bloom")}</svg></td></tr>`,
		)
		.join("");
	return `<!doctype html><meta charset="utf-8"><style>
:root{--lh-garden-cut:${bg}} body{margin:0;background:${bg};color:${light ? "#222" : "#ddd"};font:12px -apple-system,system-ui,sans-serif;padding:12px}
table{border-collapse:collapse} td{padding:2px 8px;vertical-align:middle;border-bottom:1px solid ${light ? "#eee" : "#2a2a2a"}} small{color:#888}
th{font-weight:normal;color:#888}
</style><table><tr><th></th>${STAGES.map((s) => `<th>${s}</th>`).join("")}<th>bed size</th></tr>${rows}</table>`;
}

async function screenshot(html: string, png: string, height: number): Promise<void> {
	const profile = mkdtempSync(path.join(tmpdir(), "lh-gallery-"));
	const child = spawn(
		CHROME,
		["--headless=new", "--disable-gpu", "--no-first-run", `--user-data-dir=${profile}`, `--window-size=640,${height}`, "--virtual-time-budget=2000", `--screenshot=${png}`, pathToFileURL(html).href],
		{ stdio: "ignore" },
	);
	for (let i = 0; i < 60 && !existsSync(png); i++) await new Promise((r) => setTimeout(r, 500));
	await new Promise((r) => setTimeout(r, 500));
	child.kill();
	rmSync(profile, { recursive: true, force: true });
	if (!existsSync(png)) throw new Error("screenshot failed");
}

async function main() {
	const [family, out, flag] = process.argv.slice(2);
	if (!family || !out) throw new Error("usage: garden-gallery <family|all> <out.png> [--light]");
	const species = await load(family);
	const png = path.resolve(out);
	const html = png.replace(/\.png$/, "") + ".html";
	rmSync(png, { force: true });
	writeFileSync(html, page(species, flag === "--light"));
	await screenshot(html, png, 60 + species.length * 120);
	console.log(`${species.length} species → ${png}`);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
