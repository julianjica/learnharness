/**
 * Guiding sessions — the server side of attachments and intake (owner
 * design 2026-11-03). A guide is created like any session (POST
 * /api/chats, kind "guide"); then the client uploads each attached PDF
 * on its own request (each body stays under the proxy's buffer cap)
 * and asks for the intake: one transcribe job over every file, whose
 * steer wakes the guide with the problem set.
 *
 * Files live at data/attachments/<chatId>/ and die with the session
 * (deleteChatSession calls removeAttachments).
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { PATHS } from "../../config.ts";
import { intakeCallId, type ChatAttachment } from "../core/contracts.ts";
import { spawnLessonJob } from "./chat-handler.ts";
import { stores } from "./stores.ts";

/** Owner-approved limits (plan 2026-11-03). */
export const MAX_ATTACHMENTS = 10;
export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;

export class AttachmentError extends Error {
	constructor(
		message: string,
		readonly status: number,
	) {
		super(message);
	}
}

function chatDir(chatId: string): string {
	return path.join(PATHS.attachments, chatId);
}

/** A filename safe to write: the basename, no control or path characters,
 *  with a .pdf extension, made unique within the session's folder. */
function safeName(dir: string, original: string): string {
	const base = path.basename(original).replace(/[^\w.\- ()]+/g, "_").replace(/^\.+/, "").slice(0, 120) || "attachment";
	const stem = base.toLowerCase().endsWith(".pdf") ? base.slice(0, -4) : base;
	let name = `${stem}.pdf`;
	for (let i = 2; fs.existsSync(path.join(dir, name)); i++) name = `${stem} (${i}).pdf`;
	return name;
}

/** Store one uploaded PDF on a guiding session and record it. Throws
 *  AttachmentError (404 / 400 / 409 / 413) on a refusal. */
export function addAttachment(chatId: string, originalName: string, bytes: Uint8Array): ChatAttachment {
	const record = stores.chatStore.getChat(chatId);
	if (!record) throw new AttachmentError("Unknown chat", 404);
	if (record.kind !== "guide") throw new AttachmentError("Attachments belong to guiding sessions", 400);
	if (stores.jobStore.findJobByToolCallId(chatId, intakeCallId(chatId))) {
		throw new AttachmentError("The problem set is already being read — attach files before starting", 409);
	}
	const existing = record.attachments ?? [];
	if (existing.length >= MAX_ATTACHMENTS) throw new AttachmentError(`At most ${MAX_ATTACHMENTS} files per session`, 400);
	if (bytes.byteLength > MAX_ATTACHMENT_BYTES) throw new AttachmentError("Each file must be 20 MB or smaller", 413);
	if (bytes.byteLength < 5 || Buffer.from(bytes.subarray(0, 5)).toString("latin1") !== "%PDF-") {
		throw new AttachmentError(`${originalName} is not a PDF`, 400);
	}
	const dir = chatDir(chatId);
	fs.mkdirSync(dir, { recursive: true });
	const name = safeName(dir, originalName);
	const filePath = path.join(dir, name);
	fs.writeFileSync(filePath, bytes);
	const attachment: ChatAttachment = { name: path.basename(originalName) || name, path: filePath, bytes: bytes.byteLength };
	stores.chatStore.saveAttachments(chatId, [...existing, attachment]);
	return attachment;
}

/** Start the intake: one transcribe job over every attached file.
 *  Idempotent (the intake call id keys the job). Null when nothing is
 *  attached — a typed-in problem set needs no intake. */
export function startIntake(chatId: string): { jobId: string } | null {
	const record = stores.chatStore.getChat(chatId);
	if (!record) throw new AttachmentError("Unknown chat", 404);
	if (record.kind !== "guide") throw new AttachmentError("Intake belongs to guiding sessions", 400);
	const files = (record.attachments ?? []).map(({ name, path: filePath }) => ({ name, path: filePath }));
	if (files.length === 0) return null;
	const toolCallId = intakeCallId(chatId);
	const existing = stores.jobStore.findJobByToolCallId(chatId, toolCallId);
	if (existing) return { jobId: existing.id };
	const job = stores.jobStore.createJob({ kind: "transcribe", chatId, toolCallId });
	spawnLessonJob(job.id, { files });
	return { jobId: job.id };
}

/** Remove a session's attachment folder (session deletion). */
export function removeAttachments(chatId: string): void {
	fs.rmSync(chatDir(chatId), { recursive: true, force: true });
}
