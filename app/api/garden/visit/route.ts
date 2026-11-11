/**
 * POST /api/garden/visit — the learner has seen the garden as it stands:
 * snapshot every plant's stage as the next "since your last visit" baseline.
 */
import { markGardenVisited } from "@/src/server";

export const dynamic = "force-dynamic";

export function POST() {
	markGardenVisited();
	return Response.json({ ok: true });
}
