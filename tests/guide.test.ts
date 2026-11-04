/**
 * GUIDING SESSIONS (owner design 2026-11-03): a problem set the learner
 * brings, solved by their own hand. Pins the mechanics under the guide:
 *
 *   - the record: kind "guide", attachments, the sidebar's problem flag;
 *   - "Show solution": the reveal marker (silent, unlocked by a
 *     submission), its face in the view, the deferred conclude pair;
 *   - the map: problem nodes turn done from conclusions;
 *   - the guide's problem tool gates;
 *   - the intake: the transcribe job (runner + steer), compaction keeping
 *     the problem set verbatim, attachment storage refusals;
 *   - the guide prompt's composition;
 *   - guide styles (2026-11-04): coach vs partner registries and
 *     prompts, mark_done on the map, the switch's discards.
 */

import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { after, afterEach, describe, it } from "node:test";

import { createFauxCore, fauxAssistantMessage, fauxText, fauxToolCall, type AssistantMessage, type FauxResponseStep, type ToolResultMessage } from "@earendil-works/pi-ai";
import { PATHS } from "../config.ts";
import {
	activeProblemOf,
	newThinkingMessage,
	newUserMessage,
	toLlmMessages,
	asAgentMessages,
	PRACTICE_CONCLUDE_TOOL,
	PRACTICE_PROBLEM_TOOL,
	type LhMessage,
} from "../src/core/native-messages.ts";
import { dismissAppends, guideStyleSwitchAppends, inputAppends, parseDismissInput } from "../src/core/input-events.ts";
import { danglingQuestionOf } from "../src/core/native-messages.ts";
import { guideStyleOf } from "../src/core/contracts.ts";
import { latestGuideStyle } from "../components/chat.tsx";
import { projectView } from "../src/core/view.ts";
import { derivePlanStatuses, derivePlanStatusesLh, derivedNodeStatus, type PlanTree } from "../src/core/contracts/plan.ts";
import { buildCompactionPrompt, problemSetOf } from "../src/core/compaction.ts";
import { buildSubagentSteer, intakeCallId, isSubagentFailure, TRANSCRIPT_HEADING, type SteerMessage, type TranscribeResult } from "../src/core/contracts.ts";
import { asideAnchorOf } from "../src/core/asides.ts";
import { composeInstructions } from "../src/agent/teacher-agent.ts";
import { guideTools } from "../src/agent/tools/guide.ts";
import { createJobRunner, pdfModelOverride } from "../src/agent/subagents/runner.ts";
import type { PiEngine } from "../src/agent/models.ts";
import { chatStore } from "../src/store/chats.ts";
import { jobStore } from "../src/store/jobs.ts";
import { addAttachment, AttachmentError, removeAttachments, switchGuideStyle } from "../src/server/guide.ts";

const STAMPS = {
	api: "faux",
	provider: "test",
	model: "test-model",
	usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
	stopReason: "toolUse",
} as const;

const TREE: PlanTree = {
	nodes: [
		{ id: "markov", title: "Markov's inequality" },
		{ id: "p1", title: "Problem 1" },
		{ id: "p2", title: "Problem 2" },
	],
	edges: [{ from: "markov", to: "p1" }],
	version: 1,
} as PlanTree;

function call(id: string, name: string, args: Record<string, unknown>, isError = false): LhMessage[] {
	const assistant: LhMessage & AssistantMessage = { id: `a_${id}`, role: "assistant", content: [{ type: "toolCall", id, name, arguments: args as never }], timestamp: 1, ...STAMPS };
	const result: LhMessage & ToolResultMessage = { id: `r_${id}`, role: "toolResult", toolCallId: id, toolName: name, content: [{ type: "text", text: "ok" }], details: null, isError, timestamp: 2 };
	return [assistant, result];
}

const pose = (id: string, nodeId: string, label = "Problem 1(a)", lastPart = true) =>
	call(id, PRACTICE_PROBLEM_TOOL, { label, nodeId, lastPart, statement: `${label} statement`, modelSolution: `${label} solution` });
const conclude = (id: string, outcome: string) => call(id, PRACTICE_CONCLUDE_TOOL, { outcome, verdict: "v", rung: null, missClass: null, retest: false });
const record = (messages: LhMessage[], kind = "guide") => ({ messages, kind });

const createdChats: string[] = [];
const createdJobs: string[] = [];
after(() => {
	for (const id of createdChats) {
		fs.rmSync(path.join(PATHS.chats, `${id}.json`), { force: true });
		removeAttachments(id);
	}
	for (const id of createdJobs) fs.rmSync(path.join(PATHS.data, "jobs", `${id}.json`), { force: true });
});

// ─── the record ─────────────────────────────────────────────────────────────

describe("the guide record", () => {
	it("createChat stamps kind guide; attachments save; the summary flags an active part", () => {
		const chat = chatStore.createChat("Test: guide record", "guide");
		createdChats.push(chat.id);
		assert.equal(chat.kind, "guide");
		chatStore.saveAttachments(chat.id, [{ name: "ps3.pdf", path: "/tmp/ps3.pdf", bytes: 10 }]);
		assert.deepEqual(chatStore.getChat(chat.id)?.attachments, [{ name: "ps3.pdf", path: "/tmp/ps3.pdf", bytes: 10 }]);
		chatStore.saveMessages(chat.id, pose("call_p1", "p1"));
		const summary = chatStore.listChats().find((c) => c.id === chat.id)!;
		assert.equal(summary.kind, "guide");
		assert.equal(summary.pendingProblem, true);
	});
});

// ─── Show solution ──────────────────────────────────────────────────────────

describe("Show solution (reveal-problem)", () => {
	const posed = pose("call_p1", "p1");
	const worked = [...posed, newThinkingMessage("call_p1", "I tried Markov")];

	it("parses like a dismissal", () => {
		assert.deepEqual(parseDismissInput({ type: "reveal-problem", problemCallId: "call_p1" }), { type: "reveal-problem", problemCallId: "call_p1" });
	});

	it("refuses outside guides, before any submission, and off the active part", () => {
		const input = { type: "reveal-problem", problemCallId: "call_p1" } as const;
		assert.throws(() => dismissAppends(record(worked, "practice"), input), /guiding-session/);
		assert.throws(() => dismissAppends(record(posed), input), /submitted work/);
		assert.throws(() => dismissAppends(record(worked), { ...input, problemCallId: "call_other" }), /no active problem/);
	});

	it("the marker ends the part at once and renders the committed solution", () => {
		const appended = [...worked, ...dismissAppends(record(worked), { type: "reveal-problem", problemCallId: "call_p1" })];
		assert.equal(activeProblemOf(appended), null, "the slot frees");
		const view = projectView(appended);
		const face = view.at(-1)!.parts[0] as { type: string; input: { outcome: string }; reveal?: string };
		assert.equal(face.type, "tool-conclude");
		assert.equal(face.input.outcome, "revealed");
		assert.equal(face.reveal, "Problem 1(a) solution");
		assert.ok(toLlmMessages(asAgentMessages(appended)).every((m) => JSON.stringify(m).indexOf("problem-dismissed") < 0), "the marker is UI-only");
	});

	it("the next input carries a conclude pair with outcome revealed, hidden in the view", () => {
		const revealed = [...worked, ...dismissAppends(record(worked), { type: "reveal-problem", problemCallId: "call_p1" })];
		const next = inputAppends(record(revealed), { type: "text", text: "why does step 2 hold?" });
		const pairCall = next[0] as AssistantMessage;
		assert.equal(pairCall.content[0]!.type, "toolCall");
		assert.deepEqual((pairCall.content[0] as { arguments: unknown }).arguments, { outcome: "revealed" });
		const view = projectView([...revealed, ...next]);
		const concludeParts = view.flatMap((m) => m.parts).filter((p) => p.type === "tool-conclude");
		assert.equal(concludeParts.length, 1, "one face — the pair adds no second card");
	});

	it("the Next signal is allowed in guides", () => {
		const done = [...worked, ...conclude("call_c1", "solved")];
		assert.equal(inputAppends(record(done), { type: "next" }).at(-1)!.role, "custom");
	});
});

// ─── the map ────────────────────────────────────────────────────────────────

describe("problem nodes turn done", () => {
	it("native fold: solved parts → solved; never done before the last part", () => {
		const first = [...call("q1", "quiz", { nodeId: "markov" }), ...pose("call_a", "p1", "Problem 1(a)", false), ...conclude("c_a", "solved")];
		assert.equal(derivePlanStatusesLh(TREE, first).done.has("p1"), false, "1(a) concluded, but 1(b) is still to come");
		const messages = [...first, ...pose("call_b", "p1", "Problem 1(b)")];
		let s = derivePlanStatusesLh(TREE, messages);
		assert.equal(s.done.has("p1"), false, "1(b) is still open");
		assert.equal(derivedNodeStatus(s, "p1"), "current");
		s = derivePlanStatusesLh(TREE, [...messages, ...conclude("c_b", "solvedWithHints")]);
		assert.equal(s.done.get("p1"), "solved");
		assert.equal(derivedNodeStatus(s, "p1"), "done");
		assert.equal(derivedNodeStatus(s, "markov"), "visited");
	});

	it("native fold: a revealed part marks the node viewed; refused poses count for nothing", () => {
		const worked = [...pose("call_a", "p2"), newThinkingMessage("call_a", "try")];
		const revealed = [...worked, ...dismissAppends(record(worked), { type: "reveal-problem", problemCallId: "call_a" })];
		assert.equal(derivePlanStatusesLh(TREE, revealed).done.get("p2"), "viewed");
		assert.equal(derivePlanStatusesLh(TREE, call("bad", PRACTICE_PROBLEM_TOOL, { nodeId: "p1" }, true)).current, null);
	});

	it("view fold: the same reading over the client's parts", () => {
		const worked = [...pose("call_a", "p2"), newThinkingMessage("call_a", "try")];
		const revealed = [...worked, ...dismissAppends(record(worked), { type: "reveal-problem", problemCallId: "call_a" })];
		const s = derivePlanStatuses(TREE, projectView(revealed));
		assert.equal(s.done.get("p2"), "viewed");
	});
});

// ─── side questions anchor on parts and checks ─────────────────────────────

describe("guide asides", () => {
	it("anchor on an active part, and on a waiting check with no probe phase", () => {
		assert.equal(asideAnchorOf(record(pose("call_a", "p1")))?.kind, "problem");
		const check: LhMessage[] = [{ id: "a_q", role: "assistant", content: [{ type: "toolCall", id: "q1", name: "quiz", arguments: { question: "Q?", options: ["x", "y"], nodeId: "markov" } }], timestamp: 1, ...STAMPS }];
		assert.equal(asideAnchorOf(record(check))?.kind, "check");
		assert.equal(asideAnchorOf(record(check, "teach")), null, "teaching still requires the probe to be done");
	});
});

// ─── the guide's tools ─────────────────────────────────────────────────────

describe("guide tools", () => {
	function ctxWith(messages: LhMessage[], tree?: PlanTree) {
		const chat = { id: "chat_guide_tools", messages, kind: "guide", ...(tree ? { tree } : {}) };
		return {
			chatId: chat.id,
			chatStore: { getChat: () => chat } as never,
			jobStore: { findJobByToolCallId: () => null, createJob: () => ({ id: "j" }) } as never,
			spawn: () => {},
		};
	}
	const args = { label: "Problem 1(a)", nodeId: "p1", lastPart: true, statement: "s", modelSolution: "m" };

	it("carry the teacher's set plus problem/conclude", () => {
		const tools = guideTools(ctxWith([], TREE));
		for (const name of ["plan_init", "ask_user_question", "problem", "conclude", "read", "pdf"]) assert.ok(tools[name], name);
		assert.equal(tools.probe_done, undefined);
	});

	it("problem validates nodeId against the map and gates one active part", async () => {
		const noMap = guideTools(ctxWith([]));
		const refused = await noMap.problem!.execute("t1", args);
		assert.match(JSON.stringify(refused), /No plan map exists yet/);
		const tools = guideTools(ctxWith([], TREE));
		const ok = await tools.problem!.execute("t2", args);
		assert.doesNotMatch(JSON.stringify(ok), /matches no node/);
		assert.match(JSON.stringify(await tools.problem!.execute("t3", args)), /already active/);
		await tools.conclude!.execute("t4", { outcome: "solved", verdict: "v", rung: null, missClass: null, retest: false });
		assert.doesNotMatch(JSON.stringify(await tools.problem!.execute("t5", args)), /already active/);
	});
});

// ─── the intake ─────────────────────────────────────────────────────────────

describe("the intake", () => {
	afterEach(() => {
		pdfModelOverride.current = undefined;
	});

	it("the steer opens with the problem-set heading; compaction keeps it verbatim", () => {
		const result: TranscribeResult = { files: [{ name: "ps.pdf", path: "/x/ps.pdf", pagesRead: [1] }], transcript: "## Problem 1\nShow $P(X\\ge a)\\le E[X]/a$." };
		const steer = buildSubagentSteer({ id: "job_t", kind: "transcribe", toolCallId: intakeCallId("c") }, result);
		assert.ok(steer.content.startsWith(TRANSCRIPT_HEADING));
		assert.equal(problemSetOf([steer as LhMessage]), steer.content);
		const prompt = buildCompactionPrompt({ spanText: "…", planTreeText: null, kind: "guide", problemSetText: steer.content });
		assert.match(prompt, /## The problem set/);
		assert.ok(prompt.includes("Show $P(X\\ge a)\\le E[X]/a$."));
		assert.doesNotMatch(buildCompactionPrompt({ spanText: "…", planTreeText: null, kind: "teach", problemSetText: steer.content }), /## The problem set/);
		assert.equal(isSubagentFailure("transcribe", { files: [], transcript: "Transcription failed: x" }), true);
	});

	it("the runner transcribes every attached file into one steer", async () => {
		const chat = chatStore.createChat("Test: guide intake", "guide");
		createdChats.push(chat.id);
		const fixture = path.join(import.meta.dirname, "fixtures", "sample-3page.pdf");
		chatStore.saveAttachments(chat.id, [
			{ name: "one.pdf", path: fixture, bytes: 1 },
			{ name: "two.pdf", path: fixture, bytes: 1 },
		]);
		const job = jobStore.createJob({ kind: "transcribe", chatId: chat.id, toolCallId: intakeCallId(chat.id) });
		createdJobs.push(job.id);
		const perFile = (n: number): FauxResponseStep[] => [
			fauxAssistantMessage([fauxToolCall("pdf_info", {}, { id: `i${n}` })], { stopReason: "toolUse" }),
			fauxAssistantMessage([fauxToolCall("pdf_extract", { pages: "1" }, { id: `e${n}` })], { stopReason: "toolUse" }),
			fauxAssistantMessage([fauxText(`## Problem ${n}\nCompute $\\int x\\,dx$.`)]),
		];
		const faux = createFauxCore({ tokenSize: { min: 64, max: 64 } });
		faux.setResponses([...perFile(1), ...perFile(2)]);
		pdfModelOverride.current = { model: faux.getModel(), streamFn: faux.streamSimple } as PiEngine;
		const steers: SteerMessage[] = [];
		const runner = createJobRunner({ chatStore, jobStore, deliver: async (s) => void steers.push(s) });
		await runner.runJob(job.id); // no input: resolved from the record's attachments
		assert.equal(steers.length, 1);
		const result = (steers[0]!.details as { result: TranscribeResult }).result;
		assert.deepEqual(result.files.map((f) => f.name), ["one.pdf", "two.pdf"]);
		assert.match(result.transcript, /# one\.pdf[\s\S]*## Problem 1[\s\S]*# two\.pdf[\s\S]*## Problem 2/);
		assert.ok(steers[0]!.content.startsWith(TRANSCRIPT_HEADING));
	});

	it("attachments: PDFs only, guides only, stored under the session", () => {
		const chat = chatStore.createChat("Test: guide attachments", "guide");
		createdChats.push(chat.id);
		const teach = chatStore.createChat("Test: teach attachments");
		createdChats.push(teach.id);
		const pdf = new Uint8Array(fs.readFileSync(path.join(import.meta.dirname, "fixtures", "sample-3page.pdf")));
		assert.throws(() => addAttachment(teach.id, "a.pdf", pdf), (e: unknown) => e instanceof AttachmentError && e.status === 400);
		assert.throws(() => addAttachment(chat.id, "notes.txt", new TextEncoder().encode("hello")), /not a PDF/);
		const a = addAttachment(chat.id, "../ps 3.pdf", pdf);
		const b = addAttachment(chat.id, "../ps 3.pdf", pdf);
		assert.equal(a.name, "ps 3.pdf");
		assert.ok(a.path.startsWith(path.join(PATHS.attachments, chat.id)), "never escapes the session folder");
		assert.notEqual(a.path, b.path, "same name twice keeps both");
		assert.equal(chatStore.getChat(chat.id)?.attachments?.length, 2);
	});
});

// ─── the prompt ─────────────────────────────────────────────────────────────

describe("the guide prompt", () => {
	it("composes the guide doctrine with the teacher's method, not its planning", () => {
		const text = composeInstructions("guide");
		assert.match(text, /guiding session/);
		assert.match(text, /The solution law/);
		assert.match(text, /Principle i — Unconditional truths first/);
		assert.doesNotMatch(text, /# The plan\n/);
		assert.doesNotMatch(text, /# The probe/);
	});

	it("the learner's typed problems work with no intake", () => {
		const messages = [newUserMessage("Problem 1: show that …")];
		assert.equal(problemSetOf(messages), null);
	});
});

// ─── guide styles ───────────────────────────────────────────────────────────

describe("guide styles", () => {
	const ctxWith = (tree?: PlanTree) => {
		const chat = { id: "chat_guide_styles", messages: [] as LhMessage[], kind: "guide", ...(tree ? { tree } : {}) };
		return {
			chatId: chat.id,
			chatStore: { getChat: () => chat } as never,
			jobStore: { findJobByToolCallId: () => null, createJob: () => ({ id: "j" }) } as never,
			spawn: () => {},
		};
	};

	it("the record defaults to coach; the store saves partner", () => {
		const chat = chatStore.createChat("Test: guide style", "guide");
		createdChats.push(chat.id);
		assert.equal(guideStyleOf(chat), "coach");
		chatStore.saveGuideStyle(chat.id, "partner");
		assert.equal(guideStyleOf(chatStore.getChat(chat.id)!), "partner");
	});

	it("partner drops the check and card tools and adds mark_done", () => {
		const coach = guideTools(ctxWith(TREE));
		assert.ok(coach.problem && coach.conclude && (coach.quiz || coach.explain));
		assert.equal(coach.mark_done, undefined);
		const partner = guideTools(ctxWith(TREE), undefined, "partner");
		for (const name of ["quiz", "explain", "problem", "conclude"]) assert.equal(partner[name], undefined, name);
		for (const name of ["mark_done", "ask_user_question", "plan_init", "read", "pdf"]) assert.ok(partner[name], name);
	});

	it("mark_done validates the node against the map", async () => {
		const refused = await guideTools(ctxWith(), undefined, "partner").mark_done!.execute("t1", { nodeId: "p1" });
		assert.match(JSON.stringify(refused), /No plan map exists yet/);
		const ok = await guideTools(ctxWith(TREE), undefined, "partner").mark_done!.execute("t2", { nodeId: "p1" });
		assert.match(JSON.stringify(ok), /Marked p1 done/);
	});

	it("mark_done turns a node done (worked) in both folds; a refused call counts for nothing", () => {
		const messages = [...call("call_m1", "mark_done", { nodeId: "p1" }), ...call("call_m2", "mark_done", { nodeId: "p2" }, true)];
		const native = derivePlanStatusesLh(TREE, messages);
		assert.equal(native.done.get("p1"), "worked");
		assert.equal(derivedNodeStatus(native, "p1"), "done");
		assert.equal(native.done.has("p2"), false);
		const view = derivePlanStatuses(TREE, [
			{ parts: [{ type: "tool-mark_done", state: "output-available", input: { nodeId: "p1" } }] },
			{ parts: [{ type: "tool-mark_done", state: "output-error", input: { nodeId: "p2" } }] },
		]);
		assert.equal(view.done.get("p1"), "worked");
		assert.equal(view.done.has("p2"), false);
	});

	it("the switch skips a waiting check, discards the active part, and lands the marker", () => {
		const ask: LhMessage & AssistantMessage = {
			id: "a_ask",
			role: "assistant",
			content: [{ type: "toolCall", id: "call_ask", name: "ask_user_question", arguments: { question: "Which problems?" } as never }],
			timestamp: 3,
			...STAMPS,
		};
		const withCheck = [...pose("call_p1", "p1"), ask];
		assert.ok(danglingQuestionOf(withCheck));
		const appends = guideStyleSwitchAppends(record(withCheck), "partner");
		const after = [...withCheck, ...appends];
		assert.equal(danglingQuestionOf(after), null);
		assert.equal(activeProblemOf(after), null);
		const marker = appends.at(-1) as { customType?: string; content?: string; details?: unknown };
		assert.equal(marker.customType, "guide-style");
		assert.match(marker.content!, /\[STYLE: PARTNER\]/);
		assert.equal(latestGuideStyle(after), "partner");
		// The model reads the marker; the view renders a divider.
		assert.ok(toLlmMessages(after).some((m) => JSON.stringify(m).includes("[STYLE: PARTNER]")));
		assert.ok(projectView(after).some((m) => m.parts.some((p) => p.type === "data-guide-style")));
		assert.throws(() => guideStyleSwitchAppends(record([], "practice"), "partner"));
	});

	it("switchGuideStyle saves the style once and refuses non-guides", () => {
		const chat = chatStore.createChat("Test: guide switch", "guide");
		createdChats.push(chat.id);
		assert.deepEqual(switchGuideStyle(chat.id, "partner"), { changed: true });
		assert.deepEqual(switchGuideStyle(chat.id, "partner"), { changed: false });
		const saved = chatStore.getChat(chat.id)!;
		assert.equal(guideStyleOf(saved), "partner");
		assert.equal(saved.messages.filter((m) => (m as { customType?: string }).customType === "guide-style").length, 1);
		const teach = chatStore.createChat("Test: not a guide");
		createdChats.push(teach.id);
		assert.throws(() => switchGuideStyle(teach.id, "partner"), AttachmentError);
	});

	it("each style composes its own prompt", () => {
		const coach = composeInstructions("guide", undefined, "coach");
		const partner = composeInstructions("guide", undefined, "partner");
		assert.equal(composeInstructions("guide"), coach);
		assert.match(coach, /Your style: check & coach/);
		assert.doesNotMatch(coach, /Your style: working partner/);
		assert.match(partner, /Your style: working partner/);
		assert.doesNotMatch(partner, /Your style: check & coach/);
		assert.match(partner, /The solution law/);
		assert.doesNotMatch(partner, /## The question tools/);
		assert.doesNotMatch(partner, /Principle i — Unconditional truths first/);
	});

	it("compaction names the style", () => {
		const prompt = buildCompactionPrompt({ spanText: "…", planTreeText: null, kind: "guide", problemSetText: "THE PROBLEM SET", guideStyle: "partner" });
		assert.match(prompt, /PARTNER style/);
	});
});
