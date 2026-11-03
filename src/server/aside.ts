import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { ToolResultMessage, Usage } from "@earendil-works/pi-ai";
import { PRACTICE_SIDE_TOOLS, TEACHER_SIDE_TOOLS, pickTools, runSideTurn, sideTurnMessages, sideTurnPrompt } from "../agent/aside.ts";
import { piEngineForSpec, type PiEngine } from "../agent/models.ts";
import { isSubscriptionProvider } from "../agent/subscription-connections.ts";
import { createGuideAgent, createPracticeAgent, createTeacherAgent, type TeachingAgent } from "../agent/teacher-agent.ts";
import { guideTools } from "../agent/tools/guide.ts";
import { createTeacherTools } from "../agent/tools.ts";
import { practiceTools } from "../agent/tools/practice.ts";
import { asideAnchorOf, asidesFor } from "../core/asides.ts";
import type { AsideJob, AsidePlanRevision, PendingAside } from "../core/contracts/asides.ts";
import type { CallUsage, PlanTree } from "../core/contracts.ts";
import type { LhMessage } from "../core/native-messages.ts";
import { modelsNotConfigured, providerKeyMissing as providerKeyMissingEnvelope } from "../core/settings.ts";
import { graphToolsEnabled, resolveConversationSpec } from "../core/settings-resolution.ts";
import { spawnLessonJob } from "./chat-handler.ts";
import { providerKeyPresent } from "./keys.ts";
import { refreshConnectionCatalog } from "./model-catalog.ts";
import { searchAvailable } from "./search.ts";
import { effectiveSettings, stores } from "./stores.ts";
import { beginQuietTurn, endQuietTurn } from "./turn-liveness.ts";

/**
 * POST /api/chats/[id]/aside — one side question, answered now by the
 * session's own agent (asides, owner 2026-10-26; the main teacher answers
 * them since 2026-11-03 — src/agent/aside.ts). A SIDE TURN: it runs on an
 * out-of-band copy of the record and appends nothing to it (no record
 * messages, no wake). The answer streams back as plain text; on completion
 * the aside joins the record's pending list, and the learner's next input
 * to the main agent delivers it.
 *
 * What the side turn may do: the teacher re-plans (`plan_init` saves the
 * tree at once — the aside carries the revision so the plan window shows
 * it and the teacher reads it on delivery), looks things up, and may
 * dispatch a pdf/research job (its result steers in after the check).
 * It holds the chat's in-flight slot SILENTLY for its duration — a check
 * answer 409s and steers stay queued — and never registers as the live
 * agent, so no steer can be handed into it.
 *
 * Gates, in order: unknown chat 404; malformed body 400; nothing to hang
 * on (no teach-phase check / active practice problem, or a stale anchor)
 * 409; a turn (or another side turn) running 409; then the turn route's
 * own model-configured (503) and key-present (503) gates.
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

	const effective = effectiveSettings();
	const conversation = resolveConversationSpec(record.settings, effective.models.strong);
	if (!conversation) return Response.json(modelsNotConfigured(["strong"]), { status: 503 });
	if (isSubscriptionProvider(conversation.provider)) await refreshConnectionCatalog(conversation.provider);
	if (!providerKeyPresent(conversation.provider)) return Response.json(providerKeyMissingEnvelope(conversation.provider, ["strong"]), { status: 503 });
	let engine: PiEngine;
	try {
		engine = asideRuntime.engineFor ? asideRuntime.engineFor(conversation) : piEngineForSpec(conversation, false);
	} catch {
		return Response.json({ error: "The selected model is unavailable." }, { status: 503 });
	}
	if (!beginQuietTurn(chatId)) {
		return Response.json({ error: "The lesson is still answering — ask once it finishes" }, { status: 409 });
	}

	const model = `${engine.model.provider}:${engine.model.id}`;
	const steps: CallUsage[] = [];
	const collectUsage = (usage: Usage) => steps.push(callUsage(usage));
	// The lesson's own agent, minus the ledger key: Claude Code / Codex run
	// a one-shot session, so the chat's resumed session never sees this.
	const agentOpts = {
		engine,
		messages: sideTurnMessages(record.messages, anchor),
		onUsage: collectUsage,
		toolToggles: effective.agent.tools,
		promptSwitches: effective.agent.prompts,
	};
	const jobs = { chatId, jobStore: stores.jobStore, spawn: (job: { id: string }, input: unknown) => spawnLessonJob(job.id, input), searchAvailable };
	let agent: TeachingAgent;
	if (record.kind === "practice") {
		const ctx = {
			chatId,
			chatStore: stores.chatStore,
			graphNodes: () => stores.graphStore.readNodes(),
			jobs,
			...(graphToolsEnabled(effective) ? { graph: { chatStore: stores.chatStore, graphStore: stores.graphStore } } : {}),
		};
		agent = createPracticeAgent(ctx, { ...agentOpts, tools: pickTools(practiceTools(ctx), PRACTICE_SIDE_TOOLS) });
	} else if (record.kind === "guide") {
		// The guide answers like the teacher: the same side tools (plan
		// rewrite, lookups, pdf/research jobs) — never problem/conclude.
		const ctx = { chatId, chatStore: stores.chatStore, jobStore: stores.jobStore, spawn: jobs.spawn, searchAvailable };
		agent = createGuideAgent(ctx, { ...agentOpts, tools: pickTools(guideTools(ctx, effective.agent.tools), TEACHER_SIDE_TOOLS) });
	} else {
		const ctx = { chatId, chatStore: stores.chatStore, jobStore: stores.jobStore, spawn: jobs.spawn, searchAvailable };
		agent = createTeacherAgent(ctx, { ...agentOpts, tools: pickTools(createTeacherTools(ctx, effective.agent.tools), TEACHER_SIDE_TOOLS) });
	}

	const previous = asidesFor(record.pendingAsides, anchorId);
	const id = `aside_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`;
	const controller = new AbortController();
	req.signal?.addEventListener("abort", () => controller.abort(), { once: true });

	const encoder = new TextEncoder();
	const stream = new ReadableStream<Uint8Array>({
		async start(sink) {
			try {
				const { text, messages } = await runSideTurn({
					agent,
					prompt: sideTurnPrompt(previous, question),
					signal: controller.signal,
					onDelta: (delta) => sink.enqueue(encoder.encode(delta)),
				});
				const outcome = sideOutcome(messages);
				persist(chatId, { id, anchorId, question, answer: text, at: new Date().toISOString(), model, ...outcome }, steps);
				sink.close();
			} catch (err) {
				// Nothing persists on failure (a plan_init that already ran stays
				// saved — the tree is the teacher's); the client shows the error.
				console.error(`[aside ${chatId}] failed:`, err);
				if (steps.length > 0) logUsage(chatId, id, model, steps);
				sink.error(err instanceof Error ? err : new Error(String(err)));
			} finally {
				endQuietTurn(chatId);
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

/** What the side turn did besides answering: the LAST successful plan
 *  rewrite (its mermaid + the saved tree) and the jobs it dispatched. */
export function sideOutcome(messages: readonly AgentMessage[]): { planRevision?: AsidePlanRevision; jobs?: AsideJob[] } {
	const calls = new Map<string, { name: string; args: unknown }>();
	let planRevision: AsidePlanRevision | undefined;
	const jobs: AsideJob[] = [];
	for (const m of messages) {
		const role = (m as { role?: string }).role;
		if (role === "assistant") {
			for (const b of (m as { content: { type: string; id?: string; name?: string; arguments?: unknown }[] }).content) {
				if (b.type === "toolCall" && b.id && b.name) calls.set(b.id, { name: b.name, args: b.arguments });
			}
		} else if (role === "toolResult") {
			const r = m as ToolResultMessage;
			if (r.isError) continue;
			if (r.toolName === "plan_init") {
				const details = r.details as { ok?: boolean; tree?: PlanTree } | undefined;
				const mermaid = (calls.get(r.toolCallId)?.args as { mermaid?: unknown } | undefined)?.mermaid;
				if (details?.ok === true && details.tree && typeof mermaid === "string") planRevision = { mermaid, tree: details.tree };
			} else if (r.toolName === "research" || r.toolName === "pdf") {
				const text = r.content.map((c) => (c.type === "text" ? c.text : "")).join("");
				const jobId = /Dispatched \(job ([A-Za-z0-9_]+)\)/.exec(text)?.[1];
				if (jobId) jobs.push({ tool: r.toolName, jobId });
			}
		}
	}
	return { ...(planRevision ? { planRevision } : {}), ...(jobs.length > 0 ? { jobs } : {}) };
}

/** The completed aside joins the pending list — unless its check was
 *  answered meanwhile (a stale teach anchor would never deliver); practice
 *  delivers every pending aside with the next input, so it always keeps.
 *  Usage lands in the turns log either way: the calls were spent. */
function persist(chatId: string, aside: PendingAside, steps: CallUsage[]): void {
	const record = stores.chatStore.getChat(chatId);
	if (!record) return;
	const current = asideAnchorOf(record);
	// Problem anchors (practice, and a guide's parts) deliver as a marker
	// with the next input, so they always keep; a check's asides keep only
	// while that check still waits.
	const problemAnchor = record.kind === "practice" || (record.kind === "guide" && isProblemCall(record.messages, aside.anchorId));
	if (problemAnchor || current?.anchorId === aside.anchorId) {
		stores.chatStore.appendPendingAside(chatId, aside);
	} else {
		console.info(`[aside ${chatId}] check answered while the aside ran — not delivered`);
	}
	logUsage(chatId, aside.id, aside.model ?? "", steps);
}

function isProblemCall(messages: readonly LhMessage[], callId: string): boolean {
	return messages.some(
		(m) =>
			(m as { role?: string }).role === "assistant" &&
			(m as { content: { type: string; id?: string; name?: string }[] }).content.some((b) => b.type === "toolCall" && b.id === callId && b.name === "problem"),
	);
}

function logUsage(chatId: string, id: string, model: string, steps: CallUsage[]): void {
	if (steps.length === 0) return;
	stores.chatStore.appendTurnUsage(chatId, { id, messageId: id, at: new Date().toISOString(), model, steps });
}

function callUsage(usage: Usage): CallUsage {
	return {
		inputTokens: usage.input,
		outputTokens: usage.output,
		cacheReadTokens: usage.cacheRead,
		cacheWriteTokens: usage.cacheWrite,
		cacheWrite1hTokens: usage.cacheWrite1h ?? 0,
		reasoningTokens: usage.reasoning ?? 0,
	};
}
