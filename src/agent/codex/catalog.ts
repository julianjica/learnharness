import type { Api, Model } from "@earendil-works/pi-ai";
import type { ThinkingLevel } from "@earendil-works/pi-agent-core";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { piModels } from "../models.ts";

/**
 * The Codex engine's catalog (docs/codex-engine.md).
 *
 * "codex" is a logical provider: its models are pi-ai's openai-codex
 * catalog entries re-stamped with provider "codex" and zero cost (the run
 * is billed by whatever the local `codex` login is — usually a ChatGPT
 * subscription — never by LearnHarness's price table). Requests never go
 * through pi-ai: the engine routes to CodexAgent instead.
 */

export const CODEX_PROVIDER = "codex";

export function isCodexProvider(provider: string | undefined): boolean {
	return provider === CODEX_PROVIDER;
}

let cached: Model<Api>[] | undefined;
export function codexModels(): Model<Api>[] {
	if (!codexAvailable()) return [];
	if (!cached) {
		cached = piModels()
			.getModels("openai-codex")
			.map((known) => ({ ...known, provider: CODEX_PROVIDER, name: `${known.name} (Codex)`, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } }) as Model<Api>);
	}
	return cached;
}

export function codexModel(id: string): Model<Api> | undefined {
	return codexModels().find((m) => m.id === id);
}

/**
 * The executable each run spawns as `codex app-server`. Order:
 * LH_CODEX_PATH → a `codex` on PATH → the official installers' locations.
 * All of them read the same ~/.codex login.
 */
let resolvedPath: string | null | undefined;
export function codexExecutable(): string | undefined {
	if (resolvedPath !== undefined) return resolvedPath ?? undefined;
	const explicit = process.env.LH_CODEX_PATH;
	if (explicit) {
		resolvedPath = explicit;
		return explicit;
	}
	try {
		const cmd = process.platform === "win32" ? "where" : "which";
		const found = execFileSync(cmd, ["codex"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).split(/\r?\n/)[0]?.trim();
		resolvedPath = found && existsSync(found) ? found : null;
	} catch {
		resolvedPath = null;
	}
	// A desktop app launched from Finder/Explorer gets a minimal PATH, so
	// also look where the official installers put the CLI.
	if (!resolvedPath) {
		const home = os.homedir();
		const candidates = process.platform === "win32"
			? [path.join(home, ".local", "bin", "codex.exe"), path.join(home, "AppData", "Roaming", "npm", "codex.cmd")]
			: [path.join(home, ".local", "bin", "codex"), "/opt/homebrew/bin/codex", "/usr/local/bin/codex"];
		resolvedPath = candidates.find((c) => existsSync(c)) ?? null;
	}
	return resolvedPath ?? undefined;
}

/**
 * Whether the engine can be offered at all. LH_CODEX=0 hides it;
 * otherwise it is offered when an executable can be found. Sign-in is NOT
 * checked here (the CLI owns it) — a signed-out CLI fails the first turn
 * with Codex's own error text.
 */
export function codexAvailable(): boolean {
	if (process.env.LH_CODEX === "0") return false;
	if (process.env.LH_CODEX === "1") return true;
	return !!codexExecutable();
}

/** Test seam: forget cached detection. */
export function resetCodexCatalog(): void {
	cached = undefined;
	resolvedPath = undefined;
}

export type CodexEffort = "low" | "medium" | "high" | "xhigh" | "max";

/**
 * pi thinking level → Codex reasoning effort + summary. Codex models have
 * no "off": off runs at the lowest effort with no summary. "ultra"
 * (automatic task delegation) is never used.
 */
export function effortFor(level: ThinkingLevel | undefined): { effort?: CodexEffort; summary: "auto" | "none" } {
	switch (level) {
		case undefined:
			return { summary: "auto" };
		case "off":
			return { effort: "low", summary: "none" };
		case "minimal":
		case "low":
			return { effort: "low", summary: "auto" };
		case "medium":
			return { effort: "medium", summary: "auto" };
		case "high":
			return { effort: "high", summary: "auto" };
		case "xhigh":
			return { effort: "xhigh", summary: "auto" };
		default:
			return { effort: "max", summary: "auto" };
	}
}
