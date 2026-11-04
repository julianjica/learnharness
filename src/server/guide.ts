/**
 * Guiding sessions — the server side of attachments and intake (owner
 * design 2026-11-03). A guide is created like any session (POST
 * /api/chats, kind "guide"); then the client uploads each attached PDF
 * on its own request (each body stays under the proxy's buffer cap).
 * The first turn starts the intake (chat-handler ensureGuideIntake): one
 * transcribe job over every file, whose steer wakes the guide with the
 * problem set.
 *
 * Files live at data/attachments/<chatId>/ and die with the session
 * (deleteChatSession calls removeAttachments).
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { PATHS } from "../../config.ts";
import { guideStyleOf, intakeCallId, type ChatAttachment, type GuideStyle } from "../core/contracts.ts";
import { guideStyleSwitchAppends } from "../core/input-events.ts";
import { emit } from "../core/events.ts";
import { isTurnRunning } from "./turn-liveness.ts";
import { ensureGuideIntake } from "./chat-handler.ts";
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

/** Start the intake explicitly (POST …/intake). The turn handler starts
 *  it on its own once the opening message is on disk; this is the same
 *  idempotent call. Null when nothing is attached. */
export function startIntake(chatId: string): { jobId: string } | null {
	const record = stores.chatStore.getChat(chatId);
	if (!record) throw new AttachmentError("Unknown chat", 404);
	if (record.kind !== "guide") throw new AttachmentError("Intake belongs to guiding sessions", 400);
	return ensureGuideIntake(chatId);
}

/** Remove a session's attachment folder (session deletion). */
export function removeAttachments(chatId: string): void {
	fs.rmSync(chatDir(chatId), { recursive: true, force: true });
}

/** Flip a guiding session's style (owner design 2026-11-04). Atomic and
 *  silent like a dismissal: anything waiting is discarded, the style is
 *  saved, the style marker lands, nothing wakes — the learner's next
 *  input carries it to the guide. 409 while a turn runs (the client stops
 *  it and retries); a no-op when the style is already set. */
export function switchGuideStyle(chatId: string, style: GuideStyle): { changed: boolean } {
	const record = stores.chatStore.getChat(chatId);
	if (!record) throw new AttachmentError("Unknown chat", 404);
	if (record.kind !== "guide") throw new AttachmentError("Styles belong to guiding sessions", 400);
	if (guideStyleOf(record) === style) return { changed: false };
	if (isTurnRunning(chatId)) throw new AttachmentError("The guide is mid-reply", 409);
	const appends = guideStyleSwitchAppends(record, style);
	stores.chatStore.saveMessages(chatId, [...record.messages, ...appends]);
	stores.chatStore.saveGuideStyle(chatId, style);
	emit("record-changed", { chatId });
	return { changed: true };
}
