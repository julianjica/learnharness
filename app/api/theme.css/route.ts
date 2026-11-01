import { readLocalTheme } from "@/src/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/theme.css — the user's optional local theme (config.ts
 * THEME_FILE, data/theme.css). Linked from the root layout, so it must
 * never 404: no file = an empty stylesheet. Read per request, so an edit
 * shows on reload without a rebuild.
 */
export async function GET() {
	return new Response(await readLocalTheme(), {
		headers: { "Content-Type": "text/css; charset=utf-8", "Cache-Control": "no-store" },
	});
}
