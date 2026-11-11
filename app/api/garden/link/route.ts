/**
 * POST /api/garden/link — the backfill: run the garden's linking step over
 * every past teach/guide session that has settled, already-extracted items
 * with no link yet. Fire-and-forget (202); 409 while one is running.
 */
import { startGardenBackfill } from "@/src/server";

export const dynamic = "force-dynamic";

export function POST() {
	if (!startGardenBackfill()) return Response.json({ error: "Linking is already running" }, { status: 409 });
	return Response.json({ started: true }, { status: 202 });
}
