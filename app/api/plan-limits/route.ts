import { planLimits } from "@/src/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/plan-limits — the local-CLI plans' usage limits
 * (docs/claude-code-engine.md, docs/codex-engine.md, "Plan limits"):
 * one snapshot per offered engine (5-hour / weekly % used, reset times),
 * read from the signed-in CLI without spending tokens. Snapshots younger
 * than a minute come from the cache (runs keep it fresh); `?refresh=1`
 * forces a new reading (the Settings panel's Refresh).
 */
export async function GET(req: Request) {
	const refresh = new URL(req.url).searchParams.get("refresh") === "1";
	return Response.json({ plans: await planLimits(refresh ? 0 : 60_000) });
}
