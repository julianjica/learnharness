/**
 * The garden's server entry (owner design, 2026-11-11 — contracts/garden.ts):
 * a read over the graph, the chat records, and the link ledger, with each
 * plant drawn as its remembered species (picked on first sight); the visit
 * snapshot; and the backfill that runs the linking step over every past
 * teach/guide session.
 */
import { coverageOf, messageViewLines } from "../core/coverage.ts";
import { emit } from "../core/events.ts";
import { deriveGarden, gardenEvidence, gardenItemsOf, gardenStages, linkableItems } from "../core/garden.ts";
import { getGraph } from "../core/graph.ts";
import type { ChatRecord } from "../core/contracts/chat.ts";
import type { GardenBed, GardenPayload } from "../core/contracts/garden.ts";
import { pickSpecies, speciesById, speciesSvg } from "../core/garden-species/index.ts";
import { extractionStatuses } from "../agent/subagents/extraction.ts";
import { extraction } from "./chat-handler.ts";
import { stores } from "./stores.ts";

interface LhGardenGlobal {
	/** The backfill's single-flight flag (globalThis: one per process). */
	__lhGardenBackfill?: { running: boolean };
}

function backfillState(): { running: boolean } {
	const g = globalThis as typeof globalThis & LhGardenGlobal;
	return (g.__lhGardenBackfill ??= { running: false });
}

function allChats(): ChatRecord[] {
	return stores.chatStore
		.listChats()
		.map((summary) => stores.chatStore.getChat(summary.id))
		.filter((record): record is ChatRecord => record !== null && record !== undefined);
}

/** Settled, already-extracted items of one chat that no link covers yet. */
function unlinkedCount(record: ChatRecord, coverage: ReturnType<typeof stores.graphStore.readCoverage>, linked: ReadonlySet<string>): number {
	if (record.kind === "practice") return 0;
	const items = gardenItemsOf(record);
	if (items.length === 0) return 0;
	const covered = coverageOf(record.messages, coverage, record.id);
	const uncovered = new Set(covered.uncovered);
	let lastCovered = -1;
	covered.slots.forEach((slot, i) => {
		if (messageViewLines(slot.message, slot.message.id).length > 0 && !uncovered.has(i)) lastCovered = i;
	});
	return linkableItems(items, lastCovered, linked).length;
}

function linkedIdsByChat(): Map<string, Set<string>> {
	const out = new Map<string, Set<string>>();
	for (const link of stores.gardenStore.readLinks()) {
		const set = out.get(link.chatId) ?? new Set<string>();
		set.add(link.itemId);
		out.set(link.chatId, set);
	}
	return out;
}

/** Draw every plant as its species, picking (and saving) one for any
 *  concept that has none yet. */
function drawBeds(beds: GardenBed[]): GardenBed[] {
	const nodeIds = beds.flatMap((bed) => bed.plants.map((plant) => plant.nodeId));
	const { picks, changed } = pickSpecies(nodeIds, stores.gardenStore.readSpecies());
	if (changed) stores.gardenStore.writeSpecies(picks);
	return beds.map((bed) => ({
		...bed,
		plants: bed.plants.map((plant) => {
			const species = speciesById(picks[plant.nodeId]!)!;
			return { ...plant, art: { speciesId: species.id, speciesName: species.name, svg: speciesSvg(species, plant.stage) } };
		}),
	}));
}

/** GET /api/garden. */
export function gardenView(): GardenPayload {
	const graph = getGraph(stores.graphStore);
	const chats = allChats();
	const links = stores.gardenStore.readLinks();
	const evidence = gardenEvidence(chats, links, new Set(graph.nodes.map((n) => n.id)));
	const sessions: Record<string, string> = {};
	for (const chat of chats) sessions[chat.id] = chat.title ?? chat.id;
	const fileSources: Record<string, string> = {};
	for (const source of stores.graphStore.readSources()) fileSources[source.id] = source.filePath;
	const beds = drawBeds(deriveGarden(graph.nodes, evidence, { sessions, fileSources }));
	const coverage = stores.graphStore.readCoverage();
	const linked = linkedIdsByChat();
	const unlinked = chats.reduce((sum, chat) => sum + unlinkedCount(chat, coverage, linked.get(chat.id) ?? new Set()), 0);
	const visit = stores.gardenStore.readVisit();
	return {
		beds,
		...(visit ? { previous: visit.stages } : {}),
		unlinked,
		linking: backfillState().running || extractionStatuses().some((run) => run.phase === "linking"),
	};
}

/** POST /api/garden/visit: the learner has seen the garden as it stands. */
export function markGardenVisited(): void {
	const graph = getGraph(stores.graphStore);
	const chats = allChats();
	const evidence = gardenEvidence(chats, stores.gardenStore.readLinks(), new Set(graph.nodes.map((n) => n.id)));
	const beds = deriveGarden(graph.nodes, evidence, { sessions: {}, fileSources: {} });
	stores.gardenStore.writeVisit({ visitedAt: new Date().toISOString(), stages: gardenStages(beds) });
}

/** POST /api/garden/link: the backfill. Fire-and-forget; false when one is
 *  already running. Sessions run one after another (each linker call
 *  still queues on the shared background semaphore); one session's
 *  failure never stops the rest. */
export function startGardenBackfill(): boolean {
	const state = backfillState();
	if (state.running) return false;
	state.running = true;
	emit("activity-changed", {});
	void (async () => {
		try {
			const coverage = stores.graphStore.readCoverage();
			const linked = linkedIdsByChat();
			for (const chat of allChats()) {
				if (unlinkedCount(chat, coverage, linked.get(chat.id) ?? new Set()) === 0) continue;
				try {
					const n = await extraction.linkChat(chat.id);
					console.info(`[garden] backfill: ${chat.id} linked ${n} item(s)`);
				} catch (err) {
					console.error(`[garden] backfill: ${chat.id} failed:`, err);
				}
			}
		} finally {
			state.running = false;
			emit("activity-changed", {});
		}
	})();
	return true;
}
