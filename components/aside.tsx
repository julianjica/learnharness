"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpIcon } from "lucide-react";
import { MessageResponse } from "@/components/ai-elements/message";
import { cn } from "@/lib/utils";
import type { Aside, PendingAside } from "@/src/core";

/**
 * Asides — side questions while a check or problem waits (owner design
 * 2026-10-26; src/core/contracts/asides.ts). Three pieces:
 *
 *   - AsideBlock: one question + answer, a quiet tinted band with a left
 *     rule and an "Aside · 3:41 PM" kicker — document material in the
 *     learner's register, never a chat bubble. The answer renders like
 *     the teacher's prose (markdown, LaTeX, mermaid).
 *   - AsideField: "Ask a side question…" above the dock. Enter sends,
 *     Shift+Enter is a newline, Esc leaves the field. It never claims
 *     dictation (the reading field / the dock keep the mic).
 *   - useAsides: the anchor's thread — the record's pending asides plus
 *     what this view asked, and the one answer streaming now.
 */

function timeOf(iso: string): string {
	const d = new Date(iso);
	return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function AsideBlock({ aside, streaming = false, error }: { aside: Pick<Aside, "question" | "answer" | "at">; streaming?: boolean; error?: string }) {
	const time = timeOf(aside.at);
	return (
		<div data-testid="aside-block" className="rounded-lg border-l-2 border-primary/40 bg-card/60 px-4 py-3 text-sm">
			<div className="pb-1.5 font-ui text-xs font-medium uppercase tracking-wide text-muted-foreground">
				Aside{time ? ` · ${time}` : ""}
			</div>
			<div data-testid="aside-question" className="pb-2 text-foreground/80 italic">
				{aside.question}
			</div>
			{error ? (
				<div data-testid="aside-error" className="text-destructive">
					{error}
				</div>
			) : aside.answer ? (
				<div data-testid="aside-answer">
					<MessageResponse>{aside.answer}</MessageResponse>
				</div>
			) : (
				streaming && <div className="text-muted-foreground">Thinking…</div>
			)}
		</div>
	);
}

/** Every aside of a list, in order (delivered ones on an answered card, a
 *  practice marker, or the waiting anchor's thread). */
export function AsideList({ asides }: { asides: readonly Pick<Aside, "id" | "question" | "answer" | "at">[] }) {
	if (asides.length === 0) return null;
	return (
		<div data-testid="aside-list" className="flex flex-col gap-2">
			{asides.map((a) => (
				<AsideBlock key={a.id} aside={a} />
			))}
		</div>
	);
}

export function AsideField({ disabled, onAsk }: { disabled: boolean; onAsk: (question: string) => void }) {
	const [value, setValue] = useState("");
	const send = () => {
		const question = value.trim();
		if (!question || disabled) return;
		setValue("");
		onAsk(question);
	};
	return (
		<div
			data-testid="aside-field"
			className="pointer-events-auto mb-2 flex items-end gap-2 rounded-2xl border bg-card/60 px-3 py-2 transition-colors focus-within:border-primary/50"
		>
			<textarea
				value={value}
				onChange={(e) => setValue(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === "Escape") {
						// Leaves the field — claimed so the window chain does not
						// read it as the abort/dismiss key.
						e.preventDefault();
						e.stopPropagation();
						e.currentTarget.blur();
						return;
					}
					if (e.key === "Enter" && !e.shiftKey) {
						e.preventDefault();
						e.stopPropagation();
						send();
					}
				}}
				placeholder={disabled ? "Answering…" : "Ask a side question…"}
				aria-label="Ask a side question"
				rows={1}
				className="field-sizing-content lh-input max-h-32 min-w-0 flex-1 resize-none bg-transparent py-0.5 outline-none placeholder:text-muted-foreground/70"
			/>
			<button
				type="button"
				aria-label="Send side question"
				data-testid="aside-send"
				disabled={disabled || value.trim().length === 0}
				onClick={send}
				className={cn(
					"flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity",
					(disabled || value.trim().length === 0) && "opacity-40",
				)}
			>
				<ArrowUpIcon className="size-3.5" />
			</button>
		</div>
	);
}

export interface LiveAside {
	id: string;
	question: string;
	answer: string;
	at: string;
	error?: string;
	done: boolean;
}

/** The waiting anchor's side thread. `initial` seeds from the record's
 *  pending list (a reload keeps the thread); asides of other anchors are
 *  ignored — once delivered they render on their answered card. */
export function useAsides(chatId: string, anchorId: string | null, initial: readonly PendingAside[] | undefined) {
	const [items, setItems] = useState<(PendingAside | (LiveAside & { anchorId: string }))[]>(() => [...(initial ?? [])]);
	const [asking, setAsking] = useState(false);
	const abortRef = useRef<AbortController | null>(null);
	useEffect(() => () => abortRef.current?.abort(), []);

	const ask = useCallback(
		async (question: string) => {
			if (!anchorId) return;
			const id = `live_${Date.now().toString(36)}`;
			const at = new Date().toISOString();
			setAsking(true);
			setItems((xs) => [...xs, { id, anchorId, question, answer: "", at, done: false }]);
			const patch = (p: Partial<LiveAside>) => setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...p } : x)));
			const controller = new AbortController();
			abortRef.current = controller;
			try {
				const res = await fetch(`/api/chats/${chatId}/aside`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ anchorId, question }),
					signal: controller.signal,
				});
				if (!res.ok || !res.body) {
					const body = (await res.json().catch(() => null)) as { error?: string } | null;
					patch({ error: body?.error ?? "The side question could not be answered.", done: true });
					return;
				}
				// The server's id: the optimistic answered card carries the same
				// ids the record will (the delivery fold keys on them).
				const serverId = res.headers.get("X-Aside-Id");
				const reader = res.body.getReader();
				const decoder = new TextDecoder();
				let answer = "";
				for (;;) {
					const { value, done } = await reader.read();
					if (done) break;
					answer += decoder.decode(value, { stream: true });
					patch({ answer });
				}
				patch({ answer, at: new Date().toISOString(), done: true });
				if (serverId) setItems((xs) => xs.map((x) => (x.id === id ? { ...x, id: serverId } : x)));
			} catch {
				if (!controller.signal.aborted) patch({ error: "The side question could not be answered.", done: true });
			} finally {
				if (abortRef.current === controller) abortRef.current = null;
				setAsking(false);
			}
		},
		[chatId, anchorId],
	);

	const thread = anchorId ? items.filter((x) => x.anchorId === anchorId) : [];
	/** The thread's answered asides — what the answer delivers (the
	 *  optimistic card's copy; the server substitutes its own). */
	const settled = (): Aside[] =>
		thread
			.filter((x) => (x as LiveAside).done !== false && !(x as LiveAside).error && x.answer)
			.map((x) => ({ id: x.id, question: x.question, answer: x.answer, at: x.at }));
	return { thread, asking, ask, settled };
}

/** The anchor's thread in the transcript: settled asides, plus the one
 *  streaming now (or its error). */
export function AsideThread({ thread }: { thread: readonly (PendingAside | LiveAside)[] }) {
	if (thread.length === 0) return null;
	return (
		<div data-testid="aside-thread" className="flex flex-col gap-2">
			{thread.map((a) => {
				const live = a as LiveAside;
				return <AsideBlock key={a.id} aside={a} streaming={live.done === false} error={live.error} />;
			})}
		</div>
	);
}
