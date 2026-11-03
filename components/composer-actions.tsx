"use client";

import { useRef, type ReactNode } from "react";
import { DumbbellIcon, PaperclipIcon, XIcon } from "lucide-react";

/** Home and the draft share one wrapping action row. Picker controls lead;
 * setup is centered only when it is the sole action. */
export function ComposerActions({ picker, setup }: { picker?: ReactNode; setup?: ReactNode }) {
	if (!picker && !setup) return null;
	return (
		<div
			data-testid="composer-actions"
			className={`pointer-events-auto mb-2 flex flex-wrap items-center gap-2 ${picker ? "justify-start" : "justify-center"}`}
		>
			{picker}
			{setup}
		</div>
	);
}

/** Count and Clear stay together if the setup action wraps onto another line.
 * These are node counts, even when a whole chain supplied the selection. */
export function NodePickerControl({ count, onOpen, onClear }: {
	count: number;
	onOpen?: () => void;
	onClear?: () => void;
}) {
	return (
		<div className="flex items-center gap-1.5">
			<button
				type="button"
				data-testid="practice-props-chip"
				onClick={onOpen}
				className={
					"flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 font-ui text-xs transition-colors " +
					(count > 0
						? "border-border bg-card text-foreground hover:bg-accent"
						: "border-dashed border-border/80 bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground")
				}
			>
				<DumbbellIcon aria-hidden="true" className="size-3.5 text-muted-foreground" />
				{count > 0 ? `${count} ${count === 1 ? "node" : "nodes"} selected` : "Pick nodes"}
			</button>
			{count > 0 && (
				<button
					type="button"
					data-testid="practice-props-clear"
					onClick={onClear}
					className="cursor-pointer rounded-full px-2 py-1 font-ui text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
				>
					Clear
				</button>
			)}
		</div>
	);
}

/** The client-side mirror of the server's attachment limits
 *  (src/server/guide.ts — the server stays the gate). */
export const GUIDE_MAX_FILES = 10;
export const GUIDE_MAX_FILE_BYTES = 20 * 1024 * 1024;

/** Keep the PDFs a pick adds, within the limits; returns the kept list
 *  and a one-line note on anything refused. Pure. */
export function addGuideFiles(current: readonly File[], picked: readonly File[]): { files: File[]; note: string | null } {
	const files = [...current];
	const refused: string[] = [];
	for (const f of picked) {
		const isPdf = f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
		if (!isPdf) refused.push(`${f.name} is not a PDF`);
		else if (f.size > GUIDE_MAX_FILE_BYTES) refused.push(`${f.name} is over 20 MB`);
		else if (files.length >= GUIDE_MAX_FILES) refused.push(`at most ${GUIDE_MAX_FILES} files`);
		else if (!files.some((g) => g.name === f.name && g.size === f.size)) files.push(f);
	}
	return { files, note: refused.length > 0 ? `Not attached: ${refused.join("; ")}.` : null };
}

/** The guide's attach control (guiding sessions, owner 2026-11-03): a
 *  dashed "Attach PDFs" pill (the pick pill's register) plus one chip per
 *  attached file with its remove ×. */
export function AttachPdfsControl({ files, onAdd, onRemove, note }: {
	files: readonly File[];
	onAdd: (picked: File[]) => void;
	onRemove: (index: number) => void;
	note?: string | null;
}) {
	const inputRef = useRef<HTMLInputElement>(null);
	return (
		<div className="flex flex-wrap items-center gap-1.5">
			<input
				ref={inputRef}
				type="file"
				accept="application/pdf,.pdf"
				multiple
				hidden
				data-testid="guide-file-input"
				onChange={(e) => {
					const picked = Array.from(e.target.files ?? []);
					e.target.value = "";
					if (picked.length > 0) onAdd(picked);
				}}
			/>
			<button
				type="button"
				data-testid="guide-attach"
				onClick={() => inputRef.current?.click()}
				className="flex cursor-pointer items-center gap-1.5 rounded-full border border-dashed border-border/80 bg-transparent px-3 py-1.5 font-ui text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
			>
				<PaperclipIcon aria-hidden="true" className="size-3.5" />
				{files.length > 0 ? "Attach more" : "Attach PDFs"}
			</button>
			{files.map((f, i) => (
				<span
					key={`${f.name}-${f.size}-${i}`}
					data-testid="guide-file-chip"
					className="flex items-center gap-1 rounded-full border border-border bg-card py-1 pr-1 pl-3 font-ui text-xs text-foreground"
				>
					<span className="max-w-48 truncate">{f.name}</span>
					<button
						type="button"
						aria-label={`Remove ${f.name}`}
						onClick={() => onRemove(i)}
						className="cursor-pointer rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
					>
						<XIcon className="size-3" />
					</button>
				</span>
			))}
			{note && <span className="font-ui text-xs text-destructive">{note}</span>}
		</div>
	);
}
