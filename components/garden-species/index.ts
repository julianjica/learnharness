/**
 * All garden species (owner design, 2026-11-11): 8 families × 25, drawn in
 * the shared kit style. A concept's id picks its species by hash, so the
 * same concept always grows as the same plant.
 */
import { SPECIES as FERNS_WATER } from "./ferns-water";
import { SPECIES as FLOWERS } from "./flowers";
import { SPECIES as GRASSES } from "./grasses";
import { SPECIES as HERBS_VEG } from "./herbs-veg";
import { seed, type GrowingStage, type Species } from "./kit";
import type { GardenStage } from "@/src/core";
import { SPECIES as SHRUBS_VINES } from "./shrubs-vines";
import { SPECIES as SUCCULENTS } from "./succulents";
import { SPECIES as TREES } from "./trees";
import { SPECIES as TROPICAL } from "./tropical";

export type { Species } from "./kit";

export const ALL_SPECIES: readonly Species[] = [
	...FLOWERS,
	...TREES,
	...SUCCULENTS,
	...GRASSES,
	...FERNS_WATER,
	...HERBS_VEG,
	...TROPICAL,
	...SHRUBS_VINES,
];

/** FNV-1a: a stable small hash of the concept id. */
function hash(id: string): number {
	let h = 0x811c9dc5;
	for (let i = 0; i < id.length; i++) {
		h ^= id.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	return h >>> 0;
}

/** The species a concept grows as: fixed by its id. */
export function speciesOf(nodeId: string): Species {
	return ALL_SPECIES[hash(nodeId) % ALL_SPECIES.length]!;
}

const markupCache = new Map<string, string>();

/** The plant's markup at a stage (the soil is drawn separately, so it never animates). */
export function plantMarkup(nodeId: string, stage: GardenStage): string {
	const species = speciesOf(nodeId);
	const key = `${species.id}:${stage}`;
	let markup = markupCache.get(key);
	if (markup === undefined) {
		markup = stage === "seed" ? seed() : species.draw(stage as GrowingStage);
		markupCache.set(key, markup);
	}
	return markup;
}
