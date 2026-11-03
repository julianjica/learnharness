/**
 * A guiding session's attachments (owner design 2026-11-03): one PDF per
 * request, as multipart form data under the field "file". Each request
 * stays under the proxy's body buffer (next.config.ts). Refusals:
 * 404 unknown chat, 400 not a guide / not a PDF / too many files,
 * 409 the intake already started, 413 over 20 MB.
 */
import { addAttachment, AttachmentError } from "@/src/server";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
	const { id } = await ctx.params;
	let form: FormData;
	try {
		form = await req.formData();
	} catch {
		return Response.json({ error: "Expected multipart form data" }, { status: 400 });
	}
	const file = form.get("file");
	if (!(file instanceof File)) return Response.json({ error: 'Missing the "file" field' }, { status: 400 });
	try {
		const attachment = addAttachment(id, file.name, new Uint8Array(await file.arrayBuffer()));
		return Response.json({ attachment });
	} catch (err) {
		if (err instanceof AttachmentError) return Response.json({ error: err.message }, { status: err.status });
		throw err;
	}
}
