/**
 * GET /api/garden — the garden page's whole world (contracts/garden.ts
 * GardenPayload): beds of concept plants with their stages, the last
 * visit's stages, how many settled items still wait for a link, and
 * whether a linking run is in flight. A pure read.
 */
import { gardenView } from "@/src/server";

export const dynamic = "force-dynamic";

export function GET() {
	return Response.json(gardenView());
}
