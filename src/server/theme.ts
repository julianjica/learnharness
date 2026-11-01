import fs from "node:fs";
import { THEME_FILE } from "../../config.ts";

/** The user's optional local theme (config.ts THEME_FILE) — "" when absent. */
export async function readLocalTheme(): Promise<string> {
	try {
		return await fs.promises.readFile(THEME_FILE, "utf8");
	} catch {
		return "";
	}
}
