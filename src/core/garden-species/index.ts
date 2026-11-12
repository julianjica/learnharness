/**
 * All garden species (owner design, 2026-11-11): 1000 named, real plants in
 * 40 families of 25, flat illustrations on the shared kit (kit.ts). Server
 * only: GET /api/garden sends each plant's drawing, so the browser ships no
 * species — this module is deliberately NOT exported from the core barrel.
 *
 * A concept's species is picked once and remembered (data/garden/species.json,
 * pickSpecies): new concepts prefer a species not yet in the garden, and adding
 * species later never changes a plant that already has one.
 */
import type { GardenStage } from "../contracts/garden.ts";
import { SPECIES as ALPINE } from "./alpine.ts";
import { SPECIES as AQUATIC_BOG } from "./aquatic-bog.ts";
import { SPECIES as BAMBOOS_SEDGES } from "./bamboos-sedges.ts";
import { SPECIES as BERRIES } from "./berries.ts";
import { SPECIES as BROADLEAF } from "./broadleaf.ts";
import { SPECIES as BULBS } from "./bulbs.ts";
import { SPECIES as CACTI_2 } from "./cacti-2.ts";
import { SPECIES as CARNIVOROUS } from "./carnivorous.ts";
import { SPECIES as CEREALS_GRASSES } from "./cereals-grasses.ts";
import { SPECIES as CLIMBERS } from "./climbers.ts";
import { SPECIES as CONIFERS } from "./conifers.ts";
import { SPECIES as CULINARY_HERBS } from "./culinary-herbs.ts";
import { SPECIES as DESERT_FLOWERS } from "./desert-flowers.ts";
import { SPECIES as FERNS_2 } from "./ferns-2.ts";
import { SPECIES as FERNS_WATER } from "./ferns-water.ts";
import { SPECIES as FLOWERING_SHRUBS } from "./flowering-shrubs.ts";
import { SPECIES as FLOWERS } from "./flowers.ts";
import { SPECIES as FRUIT_NUT_TREES } from "./fruit-nut-trees.ts";
import { SPECIES as GRASSES } from "./grasses.ts";
import { SPECIES as GREENS } from "./greens.ts";
import { SPECIES as HEDGES_EVERGREENS } from "./hedges-evergreens.ts";
import { SPECIES as HERBS_VEG } from "./herbs-veg.ts";
import { SPECIES as HOUSEPLANTS_2 } from "./houseplants-2.ts";
import { SPECIES as LILIES_IRISES } from "./lilies-irises.ts";
import { SPECIES as MEADOW } from "./meadow.ts";
import { SPECIES as MEDICINAL } from "./medicinal.ts";
import { SPECIES as MEDITERRANEAN } from "./mediterranean.ts";
import { SPECIES as ORCHIDS } from "./orchids.ts";
import { SPECIES as PALMS } from "./palms.ts";
import { SPECIES as PRAIRIE } from "./prairie.ts";
import { SPECIES as ROOTS_TUBERS } from "./roots-tubers.ts";
import { SPECIES as SHRUBS_VINES } from "./shrubs-vines.ts";
import { SPECIES as SQUASH_LEGUMES } from "./squash-legumes.ts";
import { SPECIES as SUCCULENTS } from "./succulents.ts";
import { SPECIES as SUCCULENTS_2 } from "./succulents-2.ts";
import { SPECIES as TREES } from "./trees.ts";
import { SPECIES as TROPICAL } from "./tropical.ts";
import { SPECIES as TROPICAL_FLOWERS } from "./tropical-flowers.ts";
import { SPECIES as TROPICAL_TREES } from "./tropical-trees.ts";
import { SPECIES as WOODLAND } from "./woodland.ts";
import { seed, type GrowingStage, type Species } from "./kit.ts";

export type { Species } from "./kit.ts";

/** The catalogue. Order matters: the first 200 (batch 1) seed the one-time
 *  migration from hash-picked plants, and new species are only ever appended. */
export const ALL_SPECIES: readonly Species[] = [
	...FLOWERS,
	...TREES,
	...SUCCULENTS,
	...GRASSES,
	...FERNS_WATER,
	...HERBS_VEG,
	...TROPICAL,
	...SHRUBS_VINES,
	...ALPINE,
	...PRAIRIE,
	...MEADOW,
	...DESERT_FLOWERS,
	...MEDITERRANEAN,
	...BULBS,
	...ORCHIDS,
	...LILIES_IRISES,
	...WOODLAND,
	...CLIMBERS,
	...CONIFERS,
	...BROADLEAF,
	...TROPICAL_TREES,
	...FRUIT_NUT_TREES,
	...PALMS,
	...BAMBOOS_SEDGES,
	...CEREALS_GRASSES,
	...CACTI_2,
	...SUCCULENTS_2,
	...FERNS_2,
	...AQUATIC_BOG,
	...CARNIVOROUS,
	...HOUSEPLANTS_2,
	...GREENS,
	...ROOTS_TUBERS,
	...SQUASH_LEGUMES,
	...CULINARY_HERBS,
	...MEDICINAL,
	...BERRIES,
	...FLOWERING_SHRUBS,
	...HEDGES_EVERGREENS,
	...TROPICAL_FLOWERS,
];

/** Batch 1's size: before picks were remembered, hash % 200 chose the plant. */
export const LEGACY_COUNT = 200;

const BY_ID = new Map(ALL_SPECIES.map((s) => [s.id, s]));

/** FNV-1a: a stable small hash of the concept id. */
function hash(id: string): number {
	let h = 0x811c9dc5;
	for (let i = 0; i < id.length; i++) {
		h ^= id.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	return h >>> 0;
}

/** Give every concept without a (still existing) species one, keeping all
 *  saved picks. A new pick starts at the concept's hash and takes the first
 *  species not already in the garden (any species once all are used). With
 *  no saved picks at all (the first run), a concept first tries the plant
 *  the old hash % 200 rule showed, so an existing garden keeps its look. */
export function pickSpecies(nodeIds: readonly string[], saved: Readonly<Record<string, string>> | null): { picks: Record<string, string>; changed: boolean } {
	const picks: Record<string, string> = { ...(saved ?? {}) };
	let changed = saved === null;
	const used = new Set(Object.values(picks).filter((id) => BY_ID.has(id)));
	const n = ALL_SPECIES.length;
	for (const nodeId of nodeIds) {
		const current = picks[nodeId];
		if (current !== undefined && BY_ID.has(current)) continue;
		const h = hash(nodeId);
		let chosen: string | undefined;
		if (saved === null) {
			const legacy = ALL_SPECIES[h % Math.min(LEGACY_COUNT, n)]!.id;
			if (!used.has(legacy)) chosen = legacy;
		}
		for (let i = 0; chosen === undefined && i < n; i++) {
			const id = ALL_SPECIES[(h + i) % n]!.id;
			if (!used.has(id)) chosen = id;
		}
		chosen ??= ALL_SPECIES[h % n]!.id;
		picks[nodeId] = chosen;
		used.add(chosen);
		changed = true;
	}
	return { picks, changed };
}

export function speciesById(id: string): Species | undefined {
	return BY_ID.get(id);
}

const svgCache = new Map<string, string>();

/** A species' drawing at a stage (the soil is the page's, so it never animates). */
export function speciesSvg(species: Species, stage: GardenStage): string {
	const key = `${species.id}:${stage}`;
	let svg = svgCache.get(key);
	if (svg === undefined) {
		svg = stage === "seed" ? seed() : species.draw(stage as GrowingStage);
		svgCache.set(key, svg);
	}
	return svg;
}
