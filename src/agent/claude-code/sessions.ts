import fs from "node:fs";
import path from "node:path";
import { PATHS } from "../../../config.ts";

/**
 * The Claude Code session ledger (docs/claude-code-engine.md, "History").
 *
 * pi is stateless per turn: the record IS the agent state. Claude Code
 * keeps its own conversation, so each chat maps to one Claude Code
 * session that is RESUMED turn over turn. The ledger records how much of
 * the chat record that session has already seen:
 *
 *   covered      — count of persisted record messages the session holds
 *   fingerprint  — role:timestamp of the last covered message
 *
 * On the next turn, if the record still has that message at that index,
 * only the messages after it are sent (resume). Any divergence — a
 * compaction rewrite, a reset, a record edited elsewhere — fails the
 * check and the turn starts a NEW session seeded with the full transcript.
 * The record stays the source of truth; the ledger is a cache.
 *
 * Sole writer: this module. One small JSON file; writes are atomic
 * (write-then-rename).
 */

export interface SessionEntry {
	sessionId: string;
	covered: number;
	fingerprint: string;
}

export const CLAUDE_CODE_DIR = path.join(PATHS.data, "claude-code");
/** The cwd every Claude Code process runs in — keeps LearnHarness's
 *  sessions out of the user's own project histories. */
export const CLAUDE_CODE_WORKDIR = path.join(CLAUDE_CODE_DIR, "workdir");
const LEDGER = path.join(CLAUDE_CODE_DIR, "sessions.json");

export interface SessionLedger {
	get(chatId: string): SessionEntry | undefined;
	set(chatId: string, entry: SessionEntry): void;
	delete(chatId: string): void;
}

function readAll(): Record<string, SessionEntry> {
	try {
		const parsed = JSON.parse(fs.readFileSync(LEDGER, "utf8")) as unknown;
		return parsed && typeof parsed === "object" ? (parsed as Record<string, SessionEntry>) : {};
	} catch {
		return {};
	}
}

function writeAll(all: Record<string, SessionEntry>): void {
	fs.mkdirSync(CLAUDE_CODE_DIR, { recursive: true });
	const tmp = `${LEDGER}.${process.pid}.tmp`;
	fs.writeFileSync(tmp, JSON.stringify(all, null, "\t"));
	fs.renameSync(tmp, LEDGER);
}

export const fileLedger: SessionLedger = {
	get(chatId) {
		const entry = readAll()[chatId];
		return entry && typeof entry.sessionId === "string" && Number.isSafeInteger(entry.covered) && typeof entry.fingerprint === "string" ? entry : undefined;
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

/** In-memory ledger (tests, and sub-agents that never resume). */
export function memoryLedger(): SessionLedger & { entries: Map<string, SessionEntry> } {
	const entries = new Map<string, SessionEntry>();
	return {
		entries,
		get: (chatId) => entries.get(chatId),
		set: (chatId, entry) => void entries.set(chatId, entry),
		delete: (chatId) => void entries.delete(chatId),
	};
}

export function fingerprintOf(message: unknown): string {
	const m = message as { role?: string; timestamp?: number } | undefined;
	return `${m?.role ?? "?"}:${m?.timestamp ?? "?"}`;
}
