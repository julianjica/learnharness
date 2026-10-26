import type { Usage } from "@earendil-works/pi-ai";
import { runAside } from "../agent/aside.ts";
import { piEngineForSpec, type PiEngine } from "../agent/models.ts";
import { isSubscriptionProvider } from "../agent/subscription-connections.ts";
import { asideAnchorOf, asideContext, asidesFor } from "../core/asides.ts";
import type { PendingAside } from "../core/contracts/asides.ts";
import type { CallUsage } from "../core/contracts.ts";
import { modelsNotConfigured, providerKeyMissing as providerKeyMissingEnvelope } from "../core/settings.ts";
import { resolveConversationSpec } from "../core/settings-resolution.ts";
import { providerKeyPresent } from "./keys.ts";
import { refreshConnectionCatalog } from "./model-catalog.ts";
import { effectiveSettings, stores } from "./stores.ts";
import { isTurnRunning } from "./turn-liveness.ts";

/**
 * POST /api/chats/[id]/aside — one side question, answered now (asides,
 * owner 2026-10-26; src/core/contracts/asides.ts). Not a turn: no
 * beginTurn, no record messages, no wake. The answer streams back as
 * plain text; on completion the aside joins the record's pending list,
 * and the learner's next input to the main agent delivers it.
 *
 * Gates, in order: unknown chat 404; malformed body 400; nothing to hang
 * on (no teach-phase check / active practice problem, or a stale anchor)
 * 409; a lesson turn running 409 (one live call per chat); then the turn
 * route's own model-configured (503) and key-present (503) gates. The
 * call is foreground — the learner asked.
 */

const MAX_QUESTION_CHARS = 4000;

/** Test seam: the engine for the resolved conversation spec. */
export const asideRuntime: { engineFor?: (spec: { provider: string; id: string }) => PiEngine } = {};

export async function handleAsideRequest(chatId: string, req: Request): Promise<Response> {
	const record = stores.chatStore.getChat(chatId);
	if (!record) return Response.json({ error: "Unknown chat" }, { status: 404 });

	const body = (await req.json().catch(() => null)) as { anchorId?: unknown; question?: unknown } | null;
	const question = typeof body?.question === "string" ? body.question.trim() : "";
	const anchorId = typeof body?.anchorId === "string" ? body.anchorId : "";
	if (!question || !anchorId) return Response.json({ error: "anchorId and a non-empty question are required" }, { status: 400 });
	if (question.length > MAX_QUESTION_CHARS) return Response.json({ error: `question exceeds ${MAX_QUESTION_CHARS} characters` }, { status: 400 });

	const anchor = asideAnchorOf(record);
	if (!anchor || anchor.anchorId !== anchorId) {
		return Response.json({ error: "Nothing is waiting for a side question" }, { status: 409 });
	}
	if (isTurnRunning(chatId)) {
		return Response.json({ error: "The lesson is still answering — ask once it finishes" }, { status: 409 });
	}

	const conversation = resolveConversationSpec(record.settings, effectiveSettings().models.strong);
	if (!conversation) return Response.json(modelsNotConfigured(["strong"]), { status: 503 });
	if (isSubscriptionProvider(conversation.provider)) await refreshConnectionCatalog(conversation.provider);
	if (!providerKeyPresent(conversation.provider)) return Response.json(providerKeyMissingEnvelope(conversation.provider, ["strong"]), { status: 503 });
	let engine: PiEngine;
	try {
		engine = asideRuntime.engineFor ? asideRuntime.engineFor(conversation) : piEngineForSpec(conversation, false);
	} catch {
		return Response.json({ error: "The selected model is unavailable." }, { status: 503 });
	}
	const model = `${engine.model.provider}:${engine.model.id}`;
	const context = asideContext(record.messages, anchor);
	const previous = asidesFor(record.pendingAsides, anchorId);
	const id = `aside_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`;
	const controller = new AbortController();
	req.signal?.addEventListener("abort", () => controller.abort(), { once: true });

	const encoder = new TextEncoder();
	const stream = new ReadableStream<Uint8Array>({
		async start(sink) {
			try {
				const { text, usage } = await runAside({
					engine,
					context,
					previous,
					question,
					signal: controller.signal,
					onDelta: (delta) => sink.enqueue(encoder.encode(delta)),
				});
				persist(chatId, { id, anchorId, question, answer: text, at: new Date().toISOString(), model }, usage);
				sink.close();
			} catch (err) {
				// Nothing persists on failure; the client shows the error in the block.
				console.error(`[aside ${chatId}] failed:`, err);
				sink.error(err instanceof Error ? err : new Error(String(err)));
			}
		},
		cancel() {
			controller.abort();
		},
	});
	return new Response(stream, {
		headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Aside-Id": id },
	});
}

/** The completed aside joins the pending list — unless its check was
 *  answered meanwhile (a stale teach anchor would never deliver); practice
 *  delivers every pending aside with the next input, so it always keeps.
 *  Usage lands in the turns log either way: the call was spent. */
function persist(chatId: string, aside: PendingAside, usage: Usage): void {
	const record = stores.chatStore.getChat(chatId);
	if (!record) return;
	const current = asideAnchorOf(record);
	if (record.kind === "practice" || current?.anchorId === aside.anchorId) {
		stores.chatStore.appendPendingAside(chatId, aside);
	} else {
		console.info(`[aside ${chatId}] check answered while the aside ran — not delivered`);
	}
	const step: CallUsage = {
		inputTokens: usage.input,
		outputTokens: usage.output,
		cacheReadTokens: usage.cacheRead,
		cacheWriteTokens: usage.cacheWrite,
		cacheWrite1hTokens: usage.cacheWrite1h ?? 0,
		reasoningTokens: usage.reasoning ?? 0,
	};
	stores.chatStore.appendTurnUsage(chatId, { id: aside.id, messageId: aside.id, at: aside.at, model: aside.model ?? "", steps: [step] });
}
