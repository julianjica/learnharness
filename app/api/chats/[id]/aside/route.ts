// POST /api/chats/[id]/aside — a side question while a check or practice
// problem waits (asides, owner 2026-10-26). Streams the answer as plain
// text; not a turn (src/server/aside.ts has the gates and persistence).
import { handleAsideRequest } from "@/src/server";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
	const { id } = await ctx.params;
	return handleAsideRequest(id, request);
}
