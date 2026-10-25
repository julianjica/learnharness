import type { AgentTool } from "@earendil-works/pi-agent-core";
import {
	createAssistantMessageEventStream,
	getCurrentSystemPrompt,
	getCurrentTools,
	type Api,
	type AssistantMessage,
	type AssistantMessageEventStream,
	type Model,
	type SimpleStreamOptions,
	type TranscriptContext,
} from "@earendil-works/pi-ai";
import type { ThinkingLevel } from "@earendil-works/pi-agent-core";
import { CodexAgent } from "./agent.ts";
import type { ConnectFn } from "./rpc.ts";

/**
 * pi's StreamFunction contract on Codex: ONE model step, tool calls
 * returned unexecuted (docs/codex-engine.md, "Background agents").
 *
 * Two sub-agents (visual-maker, pdf-reader) run their own loop and call
 * engine.streamFn directly; this serves them. Each call is a fresh,
 * ephemeral thread seeded with the rendered transcript; the step's calls
 * are recorded (Codex is told "Recorded.") and the turn is interrupted.
 */
export function codexStreamFn(level: ThinkingLevel | undefined, connect?: ConnectFn) {
	return (model: Model<Api>, context: TranscriptContext, options?: SimpleStreamOptions): AssistantMessageEventStream => {
		const stream = createAssistantMessageEventStream();
		const declared = getCurrentTools(context.messages);
		const tools: AgentTool<any, any>[] = declared.map((tool) => ({
			...tool,
			label: tool.name,
			execute: async () => {
				throw new Error("single-call stream never executes tools");
			},
		}));
		const reasoning = (options as { reasoning?: ThinkingLevel } | undefined)?.reasoning;
		const agent = new CodexAgent({
			systemPrompt: getCurrentSystemPrompt(context.messages),
			model,
			thinkingLevel: reasoning ?? level ?? "off",
			tools,
			messages: context.messages.filter((m) => m.role !== "system"),
			singleCall: true,
			...(connect ? { connect } : {}),
		});
		let started = false;
		let final: AssistantMessage | undefined;
		agent.subscribe((event) => {
			if (event.type === "message_start" && event.message.role === "assistant" && !started) {
				started = true;
				stream.push({ type: "start", partial: event.message as AssistantMessage });
			} else if (event.type === "message_update" && !final) {
				stream.push(event.assistantMessageEvent);
			} else if (event.type === "message_end" && event.message.role === "assistant" && !final) {
				final = event.message as AssistantMessage;
			}
		});
		const empty = (stopReason: "error" | "aborted", errorMessage?: string): AssistantMessage => ({
			role: "assistant", content: [], api: model.api, provider: model.provider, model: model.id,
			usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
			stopReason, ...(errorMessage ? { errorMessage } : {}), timestamp: Date.now(),
		});
		const signal = options?.signal;
		const onAbort = () => agent.abort();
		signal?.addEventListener("abort", onAbort, { once: true });
		void agent
			.continue()
			.catch((error: unknown) => {
				if (!final) final = empty("error", error instanceof Error ? error.message : String(error));
			})
			.finally(() => {
				signal?.removeEventListener("abort", onAbort);
				if (!final) final = signal?.aborted ? empty("aborted") : empty("error", "Codex produced no response");
				if (!started) stream.push({ type: "start", partial: final });
				if (final.stopReason === "error" || final.stopReason === "aborted") stream.push({ type: "error", reason: final.stopReason, error: final });
				else stream.push({ type: "done", reason: final.stopReason as "stop" | "length" | "toolUse", message: final });
				stream.end(final);
			});
		return stream;
	};
}
