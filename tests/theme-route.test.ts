/**
 * The optional local theme (config.ts THEME_FILE): GET /api/theme.css
 * serves data/theme.css when present and an empty stylesheet — never a
 * 404 — when absent.
 *
 * Isolated LH_DATA_DIR, set before any config-loading import.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, describe, it } from "node:test";

const TMP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lh-theme-route-"));
process.env.LH_DATA_DIR = TMP_DATA;

const { GET } = await import("../app/api/theme.css/route.ts");
const { THEME_FILE } = await import("../config.ts");

after(() => fs.rmSync(TMP_DATA, { recursive: true, force: true }));

describe("GET /api/theme.css", () => {
	it("serves an empty stylesheet when there is no local theme", async () => {
		const res = await GET();
		assert.equal(res.status, 200);
		assert.match(res.headers.get("Content-Type") ?? "", /^text\/css/);
		assert.equal(await res.text(), "");
	});

	it("serves data/theme.css when present", async () => {
		assert.equal(THEME_FILE, path.join(TMP_DATA, "theme.css"));
		fs.writeFileSync(THEME_FILE, "html.dark { --background: #000; }");
		const res = await GET();
		assert.equal(res.status, 200);
		assert.equal(await res.text(), "html.dark { --background: #000; }");
	});
});
