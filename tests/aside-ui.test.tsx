/**
 * Asides in the transcript (components/aside.tsx, owner 2026-10-26): the
 * Aside block's face, delivered asides above their answered card (and the
 * skipped card), and old answers rendering exactly as before.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AsideBlock, AsideThread } from "../components/aside.tsx";
import { AnsweredCard } from "../components/answered-card.tsx";
import type { QuestionAnswerData } from "../src/core/index.ts";

const asides = [{ id: "as1", question: "why does it flip?", answer: "Because the **slope** turns.", at: "2026-10-26T15:41:00Z" }];
const answer = (extra: Partial<QuestionAnswerData> = {}): QuestionAnswerData =>
	({ kind: "quiz", questionText: "Which way?", options: [{ index: 1, label: "Up" }, { index: 2, label: "Down" }], dontKnow: false, answers: [{ label: "Down", value: "Down", index: 2 }], correct: true, correctIndices: [2], answeredAt: "t", ...extra }) as QuestionAnswerData;

describe("Aside blocks", () => {
	it("show the kicker, the question, and the answer as prose", () => {
		const html = renderToStaticMarkup(<AsideBlock aside={asides[0]!} />);
		assert.match(html, /Aside · /);
		assert.match(html, /why does it flip\?/);
		assert.match(html, /data-testid="aside-answer"/);
	});

	it("a streaming aside without text yet says so; an error replaces the answer", () => {
		assert.match(renderToStaticMarkup(<AsideBlock aside={{ question: "q", answer: "", at: "t" }} streaming />), /Thinking…/);
		assert.match(renderToStaticMarkup(<AsideThread thread={[{ id: "l", question: "q", answer: "", at: "t", done: true, error: "Nope" }]} />), /data-testid="aside-error"[^>]*>Nope/);
	});

	it("delivered asides render above their answered card — and the skipped card", () => {
		const html = renderToStaticMarkup(<AnsweredCard answer={answer({ asides })} />);
		assert.ok(html.indexOf("aside-block") > -1 && html.indexOf("aside-block") < html.indexOf("Which way?"));
		const skipped = renderToStaticMarkup(<AnsweredCard answer={{ kind: "quiz", questionText: "Which way?", dontKnow: false, answers: [], dismissed: true, answeredAt: "t", asides }} />);
		assert.match(skipped, /aside-block[\s\S]*— skipped/);
	});

	it("an answer without asides renders no aside markup (old records unchanged)", () => {
		assert.ok(!renderToStaticMarkup(<AnsweredCard answer={answer()} />).includes("aside"));
	});
});
