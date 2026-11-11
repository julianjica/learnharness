/**
 * The garden's fs adapter (core/ports.ts GardenStore): data/garden/links.jsonl
 * (append-only, one GardenLink per line) and data/garden/visit.json (the
 * last-visit snapshot, read-modify-write). Persistence and nothing else.
 */
import fs from "node:fs";
import path from "node:path";
import { GARDEN_LINKS_FILE, GARDEN_VISIT_FILE } from "../../config.ts";
import type { GardenLink, GardenStage, GardenVisit } from "../core/contracts/garden.ts";
import { GARDEN_STAGES } from "../core/contracts/garden.ts";
import type { GardenStore } from "../core/ports.ts";

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const isString = (v: unknown): v is string => typeof v === "string";

const isLink = (v: unknown): v is GardenLink =>
	isRecord(v) &&
	isString(v.chatId) &&
	isString(v.itemId) &&
	Array.isArray(v.nodeIds) &&
	v.nodeIds.every(isString) &&
	isString(v.linkedAt) &&
	(v.verdict === undefined || v.verdict === "right" || v.verdict === "notRight");

export const gardenStore: GardenStore = {
	appendLinks(links) {
		if (links.length === 0) return;
		fs.mkdirSync(path.dirname(GARDEN_LINKS_FILE), { recursive: true });
		fs.appendFileSync(GARDEN_LINKS_FILE, links.map((l) => `${JSON.stringify(l)}\n`).join(""), "utf-8");
	},
	readLinks() {
		let raw: string;
		try {
			raw = fs.readFileSync(GARDEN_LINKS_FILE, "utf-8");
		} catch {
			return [];
		}
		const out: GardenLink[] = [];
		for (const line of raw.split("\n")) {
			if (!line.trim()) continue;
			try {
				const parsed: unknown = JSON.parse(line);
				if (isLink(parsed)) out.push(parsed);
			} catch {
				// a torn append: skip the line, never fail the read
			}
		}
		return out;
	},
	readVisit() {
		try {
			const parsed: unknown = JSON.parse(fs.readFileSync(GARDEN_VISIT_FILE, "utf-8"));
			if (!isRecord(parsed) || !isString(parsed.visitedAt) || !isRecord(parsed.stages)) return null;
			const stages: Record<string, GardenStage> = {};
			for (const [id, stage] of Object.entries(parsed.stages)) {
				if ((GARDEN_STAGES as readonly unknown[]).includes(stage)) stages[id] = stage as GardenStage;
			}
			return { visitedAt: parsed.visitedAt, stages };
		} catch {
			return null;
		}
	},
	writeVisit(visit: GardenVisit) {
		fs.mkdirSync(path.dirname(GARDEN_VISIT_FILE), { recursive: true });
		fs.writeFileSync(GARDEN_VISIT_FILE, JSON.stringify(visit), "utf-8");
	},
};
