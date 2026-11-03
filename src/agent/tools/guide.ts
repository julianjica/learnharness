/**
 * THE GUIDE TOOLS (guiding sessions, owner design 2026-11-03): the
 * teacher's whole registry (checks, plan_init, ask, lookups, jobs) plus
 * the practice pair — `problem` and `conclude` — reshaped for a problem
 * set the learner brought:
 *
 *   - `problem` poses ONE part of one problem from the set, word for word,
 *     against the problem's node on the plan map (`nodeId`, validated like
 *     a check's). The model solution is committed before the learner sees
 *     the part, exactly as in practice; it shows only when the guide
 *     concludes or the learner presses "Show solution" (a learner-side
 *     ending, input-events "reveal-problem").
 *   - `conclude` is practice's tool, unchanged (one active part at a time,
 *     the same gate).
 *
 * Mechanics only; the method lives in prompts/guide/.
 */

import { Type, type Static } from "typebox";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { createTeacherTools, nodeIdProblem, type TeacherToolContext } from "../tools.ts";
import type { EnabledTools } from "../../core/pending.ts";
import { problemResult, invalidInputResult } from "../tool-execute.ts";
import { healEncodedArguments, healToolRecord } from "./heal.ts";
import { concludeTool, createPracticeGate, type PracticeGate } from "./practice.ts";
import { proberGraphTools, type GraphToolContext } from "./graph.ts";

export interface GuideToolContext extends TeacherToolContext {
	/** The map readers, behind the same settings gate as the prober's. */
	graph?: GraphToolContext;
}

export const guideProblemInputObject = Type.Object({
	label: Type.String({
		description: 'REQUIRED — which part this is, as the set numbers it (e.g. "Problem 3(b)").',
	}),
	nodeId: Type.String({
		description: "REQUIRED — the plan-map node of the problem this part belongs to (one of your plan_init slugs).",
	}),
	statement: Type.String({
		description:
			"REQUIRED — the part exactly as the problem set words it (markdown + LaTeX), with just enough of the problem's shared setup to stand alone. Never reworded.",
	}),
	modelSolution: Type.String({
		description:
			"REQUIRED — your full worked solution to this part, committed BEFORE the learner sees it. Hidden until you conclude or the learner presses Show solution; it is then shown verbatim.",
	}),
});

export type GuideProblemInput = Static<typeof guideProblemInputObject>;

export function guideProblemTool(
	gate: PracticeGate,
	ctx: Pick<GuideToolContext, "chatId" | "chatStore">,
): AgentTool<typeof guideProblemInputObject> {
	return {
		name: "problem",
		label: "problem",
		description:
			"Pose one part of a problem from the learner's problem set. Ends the turn — the learner works in the thinking " +
			"field; each submission arrives back as a labeled message. The modelSolution stays hidden until you conclude " +
			"or the learner presses Show solution (which ends the part for them). Only one part may be active — conclude " +
			"it before posing the next.",
		parameters: guideProblemInputObject,
		executionMode: "sequential",
		prepareArguments: (args: unknown) => healEncodedArguments(args, guideProblemInputObject) as never,
		execute: async (_toolCallId, input) => {
			if (gate.problemActive) {
				return invalidInputResult("problem", ["a part is already active — call conclude on it before posing the next one"]);
			}
			const nodeProblem = nodeIdProblem(ctx, input.nodeId);
			if (nodeProblem) return invalidInputResult("problem", [nodeProblem]);
			gate.problemActive = true;
			return problemResult();
		},
	};
}

/** The guide's registry: the teacher's tools plus problem/conclude and
 *  (gate open) the map readers. */
export function guideTools(ctx: GuideToolContext, enabled?: EnabledTools): Record<string, AgentTool<any>> {
	const gate = createPracticeGate({ chatId: ctx.chatId, chatStore: ctx.chatStore });
	return healToolRecord({
		...createTeacherTools(ctx, enabled),
		problem: guideProblemTool(gate, ctx),
		conclude: concludeTool(gate),
		...(ctx.graph ? proberGraphTools(ctx.graph) : {}),
	});
}
