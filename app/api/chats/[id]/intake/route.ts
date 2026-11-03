/**
 * Start a guiding session's intake (owner design 2026-11-03): one
 * transcribe job over every attached file; its result wakes the guide
 * with the problem set. Idempotent. `{ jobId: null }` when nothing is
 * attached (the problems are in the learner's message).
 */
import { AttachmentError, startIntake } from "@/src/server";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
	const { id } = await ctx.params;
	try {
		const started = startIntake(id);
		return Response.json({ jobId: started?.jobId ?? null });
	} catch (err) {
		if (err instanceof AttachmentError) return Response.json({ error: err.message }, { status: err.status });
		throw err;
	}
}
