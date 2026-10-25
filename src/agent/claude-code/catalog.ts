import type { Api, Model } from "@earendil-works/pi-ai";
import type { ThinkingLevel } from "@earendil-works/pi-agent-core";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { piModels } from "../models.ts";

/**
 * The Claude Code engine's catalog (docs/claude-code-engine.md).
 *
 * "claude-code" is a logical provider: its models are pi-ai's Anthropic
 * catalog entries re-stamped with provider "claude-code" and zero cost
 * (the run is billed by whatever the local `claude` login is — usually a
 * subscription — never by LearnHarness's price table). Requests never go
 * through pi-ai: the engine routes to ClaudeCodeAgent instead.
 */

export const CLAUDE_CODE_PROVIDER = "claude-code";

/** Current-generation ids Claude Code accepts by name. Entries pi-ai's
 *  catalog does not know are dropped (never fabricated). */
const MODEL_IDS = ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5", "claude-opus-5", "claude-sonnet-5"] as const;

export function isClaudeCodeProvider(provider: string | undefined): boolean {
	return provider === CLAUDE_CODE_PROVIDER;
}

let cached: Model<Api>[] | undefined;
export function claudeCodeModels(): Model<Api>[] {
	if (!claudeCodeAvailable()) return [];
	if (!cached) {
		const anthropic = piModels().getModels("anthropic");
		cached = MODEL_IDS.flatMap((id) => {
			const known = anthropic.find((m) => m.id === id);
			return known
				? [{ ...known, provider: CLAUDE_CODE_PROVIDER, name: `${known.name} (Claude Code)`, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } } as Model<Api>]
				: [];
		});
	}
	return cached;
}

export function claudeCodeModel(id: string): Model<Api> | undefined {
	return claudeCodeModels().find((m) => m.id === id);
}

/**
 * The executable the SDK spawns. Order: LH_CLAUDE_CODE_PATH → a `claude`
 * on PATH → the official installers' locations → undefined (the SDK's
 * bundled platform binary). All of them read the same ~/.claude login.
 */
let resolvedPath: string | null | undefined;
export function claudeCodeExecutable(): string | undefined {
	if (resolvedPath !== undefined) return resolvedPath ?? undefined;
	const explicit = process.env.LH_CLAUDE_CODE_PATH;
	if (explicit) {
		resolvedPath = explicit;
		return explicit;
	}
	try {
		const cmd = process.platform === "win32" ? "where" : "which";
		const found = execFileSync(cmd, ["claude"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).split(/\r?\n/)[0]?.trim();
		resolvedPath = found && existsSync(found) ? found : null;
	} catch {
		resolvedPath = null;
	}
	// A desktop app launched from Finder/Explorer gets a minimal PATH, so
	// also look where the official installers put the CLI.
	if (!resolvedPath) {
		const home = os.homedir();
		const candidates = process.platform === "win32"
			? [path.join(home, ".local", "bin", "claude.exe"), path.join(home, "AppData", "Roaming", "npm", "claude.cmd")]
			: [path.join(home, ".local", "bin", "claude"), path.join(home, ".claude", "local", "claude"), "/opt/homebrew/bin/claude", "/usr/local/bin/claude"];
		resolvedPath = candidates.find((c) => existsSync(c)) ?? null;
	}
	return resolvedPath ?? undefined;
}

/** Bundled binary present? (the SDK's optional platform package). */
function bundledBinaryPresent(): boolean {
	try {
		const require = createRequire(import.meta.url);
		const pkg = require.resolve("@anthropic-ai/claude-agent-sdk/package.json");
		const base = path.dirname(path.dirname(pkg));
		const platformPkg = path.join(base, `claude-agent-sdk-${process.platform}-${process.arch}`);
		return existsSync(platformPkg);
	} catch {
		return false;
	}
}

/**
 * Whether the engine can be offered at all. LH_CLAUDE_CODE=0 hides it;
 * otherwise it is offered when some executable can be found. Sign-in is
 * NOT checked here (the CLI owns it) — a signed-out CLI fails the first
 * turn with Claude Code's own error text.
 */
export function claudeCodeAvailable(): boolean {
	if (process.env.LH_CLAUDE_CODE === "0") return false;
	if (process.env.LH_CLAUDE_CODE === "1") return true;
	return !!claudeCodeExecutable() || bundledBinaryPresent();
}

/** Test seam: forget cached detection. */
export function resetClaudeCodeCatalog(): void {
	cached = undefined;
	resolvedPath = undefined;
}

/** pi thinking level → Claude Code effort. "off" disables thinking. */
export function effortFor(level: ThinkingLevel | undefined): { effort?: "low" | "medium" | "high" | "xhigh" | "max"; thinkingOff: boolean } {
	switch (level) {
		case undefined:
			return { thinkingOff: false };
		case "off":
			return { thinkingOff: true };
		case "minimal":
		case "low":
			return { effort: "low", thinkingOff: false };
		case "medium":
			return { effort: "medium", thinkingOff: false };
		case "high":
			return { effort: "high", thinkingOff: false };
		case "xhigh":
			return { effort: "xhigh", thinkingOff: false };
		default:
			return { effort: "max", thinkingOff: false };
	}
}
