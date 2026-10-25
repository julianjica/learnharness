import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { PATHS } from "../../../config.ts";

export { fingerprintOf } from "../claude-code/sessions.ts";

/**
 * The Codex thread ledger (docs/codex-engine.md, "History").
 *
 * Same watermark as the Claude Code ledger — `covered` persisted record
 * messages, `fingerprint` of the last one — plus `toolsFingerprint`:
 * Codex fixes a thread's dynamic tools at thread/start (resume cannot
 * change them), so a run whose tool set differs (prober → teacher) must
 * start a NEW thread seeded with the transcript.
 *
 * Sole writer: this module. One small JSON file; writes are atomic
 * (write-then-rename).
 */

export interface ThreadEntry {
	threadId: string;
	covered: number;
	fingerprint: string;
	toolsFingerprint: string;
}

export const CODEX_DIR = path.join(PATHS.data, "codex");
/** The cwd every Codex process runs in — keeps LearnHarness's threads
 *  out of the user's own project histories. */
export const CODEX_WORKDIR = path.join(CODEX_DIR, "workdir");
const LEDGER = path.join(CODEX_DIR, "sessions.json");

export interface ThreadLedger {
	get(chatId: string): ThreadEntry | undefined;
	set(chatId: string, entry: ThreadEntry): void;
	delete(chatId: string): void;
}

function readAll(): Record<string, ThreadEntry> {
	try {
		const parsed = JSON.parse(fs.readFileSync(LEDGER, "utf8")) as unknown;
		return parsed && typeof parsed === "object" ? (parsed as Record<string, ThreadEntry>) : {};
	} catch {
		return {};
	}
}

function writeAll(all: Record<string, ThreadEntry>): void {
	fs.mkdirSync(CODEX_DIR, { recursive: true });
	const tmp = `${LEDGER}.${process.pid}.tmp`;
	fs.writeFileSync(tmp, JSON.stringify(all, null, "\t"));
	fs.renameSync(tmp, LEDGER);
}

export const fileLedger: ThreadLedger = {
	get(chatId) {
		const entry = readAll()[chatId];
		return entry && typeof entry.threadId === "string" && Number.isSafeInteger(entry.covered) && typeof entry.fingerprint === "string" && typeof entry.toolsFingerprint === "string" ? entry : undefined;
	},
	set(chatId, entry) {
		const all = readAll();
		all[chatId] = entry;
		writeAll(all);
	},
	delete(chatId) {
		const all = readAll();
		if (!(chatId in all)) return;
		delete all[chatId];
		writeAll(all);
	},
};

/** In-memory ledger (tests). */
export function memoryLedger(): ThreadLedger & { entries: Map<string, ThreadEntry> } {
	const entries = new Map<string, ThreadEntry>();
	return {
		entries,
		get: (chatId) => entries.get(chatId),
		set: (chatId, entry) => void entries.set(chatId, entry),
		delete: (chatId) => void entries.delete(chatId),
	};
}

/** Names + schemas + descriptions: what the thread was started with. */
export function toolsFingerprintOf(tools: readonly AgentTool<any, any>[]): string {
	const shape = [...tools].map((t) => [t.name, t.description, t.parameters]).sort((a, b) => String(a[0]).localeCompare(String(b[0])));
	return createHash("sha256").update(JSON.stringify(shape)).digest("hex").slice(0, 16);
}
