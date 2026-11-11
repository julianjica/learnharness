import { GardenView } from "@/components/garden";

/**
 * The garden (owner design, 2026-11-11): its own page, reached from the
 * sprout in the sidebar header — never shown inside a session. The view
 * fetches /api/garden itself and follows the events channel.
 */
export const dynamic = "force-dynamic";

export default function GardenPage() {
	return <GardenView />;
}
