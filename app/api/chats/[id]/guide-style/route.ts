/**
 * Flip a guiding session's style (owner design 2026-11-04): body
 * { style: "coach" | "partner" }. Silent like a dismissal — anything
 * waiting is discarded, the style marker lands, nothing wakes. 409 while
 * a turn runs (the client stops it and retries).
 */
import { AttachmentError, switchGuideStyle } from "@/src/server";

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
	const { id } = await ctx.params;
	const body = (await req.json().catch(() => null)) as { style?: unknown } | null;
	const style = body?.style;
	if (style !== "coach" && style !== "partner") {
		return Response.json({ error: 'style must be "coach" or "partner"' }, { status: 400 });
	}
	try {
		return Response.json(switchGuideStyle(id, style));
	} catch (err) {
		if (err instanceof AttachmentError) return Response.json({ error: err.message }, { status: err.status });
		throw err;
	}
}
