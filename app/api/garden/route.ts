/**
 * GET /api/garden — the garden page's whole world (contracts/garden.ts
 * GardenPayload): beds of concept plants with their stages, the last
 * visit's stages, how many settled items still wait for a link, and
 * whether a linking run is in flight. Each plant carries its species'
 * drawing; a concept seen for the first time gets its species picked and
 * saved (data/garden/species.json) — the only write.
 */
import { gardenView } from "@/src/server";

export const dynamic = "force-dynamic";

export function GET() {
	return Response.json(gardenView());
}
