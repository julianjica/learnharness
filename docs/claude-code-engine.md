# The Claude Code engine — design record

Date: 2026-10-24. Status: BUILT (phases 1 + 2), fork-only.

## What it is

A second agent engine. Pick a model under the provider **`claude-code`** in
Settings → Models (or per session), and that role runs through the locally
installed **Claude Code** (`@anthropic-ai/claude-agent-sdk`) instead of pi.
The run is billed to whatever `claude` is signed in with — typically a Pro or
Max subscription — so no API key is needed for it. pi stays the default for
every other provider; nothing about pi was removed.

**Personal use only.** Anthropic's terms do not allow third-party apps to
offer claude.ai login / subscription limits to their users. Run this fork for
yourself; do not distribute builds that ship it enabled.

## Setup

1. Install Claude Code and sign in once: `claude` → `/login`.
2. `npm install` (adds the Agent SDK and the MCP SDK).
3. Start LearnHarness. In Settings → Models choose `claude-code ·
   claude-sonnet-5-5` (or opus/haiku) for any slot.

| Env var | Effect |
|---|---|
| `LH_CLAUDE_CODE_PATH` | Explicit path to the `claude` executable. |
| `LH_CLAUDE_CODE=0` / `1` | Hide / force-show the provider (default: shown when an executable is found). |
| `LH_CLAUDE_CODE_USE_API_KEY=1` | Let Claude Code see `ANTHROPIC_API_KEY` from LearnHarness's keys. By default it is stripped so the CLI's own login decides billing. |

Executable lookup: `LH_CLAUDE_CODE_PATH` → `claude` on PATH → the installer
locations (`~/.local/bin`, `~/.claude/local`, Homebrew, `/usr/local/bin`) → the
SDK's bundled binary.

## Architecture: one adapter

The app consumes one agent surface — pi's `Agent`: `subscribe`, `continue`,
`prompt`, `steer`, `abort`, `state.messages` and the `AgentEvent` stream.
`ClaudeCodeAgent` (`src/agent/claude-code/agent.ts`) **extends** pi's `Agent`
and re-implements the run on Claude Code's `query()`, emitting the same events
and the same `AssistantMessage` / `ToolResultMessage` shapes. ui-stream, the
record, the steer registry, the usage channel and every UI component run
unchanged.

```
chat-handler ─▶ createProber/Teacher/PracticeAgent ─┬─ pi Agent           ─┐
                runSubagent (jobs)                   └─ ClaudeCodeAgent    ─┴─▶ ui-stream / record
                                                          │
       query({ systemPrompt: <ours>, tools: [], settingSources: [],
               mcpServers: { lh: <our AgentTools> }, allowedTools, permissionMode: "dontAsk",
               hooks: { PreToolUse, PostToolBatch }, resume | sessionId, effort, thinking })
```

| File | Role |
|---|---|
| `claude-code/catalog.ts` | Provider `claude-code`: models (pi's Anthropic catalog, re-stamped, zero cost), executable detection, thinking → effort. |
| `claude-code/agent.ts` | `ClaudeCodeAgent`: stream-event translation, tool execution, stop rules, steering, abort, ledger. |
| `claude-code/mcp.ts` | AgentTools → in-process MCP server via the **low-level** handlers (verbatim TypeBox JSON Schema; raw args reach pi's heal + validation). |
| `claude-code/render.ts` | Record → Claude Code input (delta for resume, full transcript for a fresh session). |
| `claude-code/sessions.ts` | The session ledger (`data/claude-code/sessions.json`). |
| `claude-code/stream.ts` | pi `StreamFunction` on Claude Code: one call, tools unexecuted (visual-maker, pdf-reader). |

Touched outside the folder: `models.ts` (engine for `claude-code` specs),
`teacher-agent.ts` and `subagents/pi-run.ts` (pick the agent class),
`server/model-catalog.ts` (catalog + validation).

## Semantics carried over from pi

- **Tools** run through pi's exported `runToolCall` (prepareArguments heal →
  validation → execute → afterToolCall), so invalid input produces the same
  error result the model retries on. The MCP handler only bridges.
- **Tool-call ids.** The PreToolUse hook records Claude Code's `tool_use_id`;
  the MCP handler claims it (name + identical args, else first by name).
  Records keep bare tool names (`mcp__lh__` stripped).
- **Event order.** Claude Code starts a tool as soon as its `tool_use` block
  closes, before the message's closing events. Tool events for a still-open
  message are deferred until its `message_end` (pi's order), and PostToolBatch
  finalizes the message if its closing events haven't arrived yet.
- **Question-stop / terminate.** The PostToolBatch hook appends the results,
  emits `turn_end`, then evaluates the teacher's question stopper and "all
  results terminate". Either one returns `{ continue: false }` and the run ends.
  As in pi, an ended run leaves its steering queue for the registry to settle.
- **Steering.** A marker steered mid-run is appended to the transcript
  (`message_start/end`, so the registry sees it consumed) and handed to the
  model as PostToolBatch `additionalContext` at the next boundary. Markers
  waiting when the model finishes on its own start one more turn as a user
  message. Markers queued before the run are injected at its start.
- **Abort** settles the open message as `stopReason: "aborted"`. A failure
  (not signed in, rate limit, CLI missing) becomes an `error` assistant
  message carrying Claude Code's text, the same way pi surfaces provider errors.
- **Usage** comes from the stream's `message_start` / `message_delta`. Cost is
  0 because the subscription pays for it.

## History: resume + ledger

pi is stateless per turn. Claude Code keeps a session per chat, which is
**resumed** each turn. `sessions.json` records, per chat, `{ sessionId,
covered, fingerprint }`: how many *persisted* record messages the session
holds, and `role:timestamp` of the last one. In-memory question placeholders
are excluded because the learner's answer replaces them in the record.

On each turn:

- If the record still has that fingerprint at that index, only the tail is sent
  (learner text, the answer as `[Result for your quiz call] …`, steer
  markers), with `resume`.
- Any divergence sends the whole model-facing transcript (via `toLlmMessages`)
  as one seed message to a **new** session. Divergences include a compaction
  marker, an assistant message in the tail, an abort, a failure, or a missing
  ledger entry. The record stays the source of truth; the ledger is only a cache.

Prober → teacher reuses the same session with the teacher's system prompt and
tools. This was verified live: a resumed session follows the new system prompt.

Sub-agents run one-shot unpersisted sessions (`persistSession: false`).

## Verification

- `tests/claude-code-agent.test.ts`: a scripted fake of `query()` that streams
  Anthropic events, runs the hooks, honors `continue: false`, and calls our
  tools over a **real** MCP connection. It covers schemas, tool correlation,
  validation errors, early tool execution order, question-stop + resume,
  divergence → fresh seed, steering, abort, startup failure, `runSubagent`
  maxTurns, the single-call streamFn, and effort mapping.
- `tests/claude-code-chat-flow.test.ts` runs the production prober through
  `handleChatRequest` with only `query()` scripted. It shows the watermark
  survives real persistence, so the answer turn resumes the session.
- Live check against the real CLI: tool calls over MCP, deferred event order,
  PostToolBatch stop on a terminating question, a steer delivered through
  `additionalContext` that changed the next tool call's arguments, and resume
  with a new system prompt.

## Plan limits and API-equivalent cost

Shared by both local-CLI engines.

- **Labels.** `claude-code:*` turns read as **"Claude plan"** and `codex:*` turns as **"ChatGPT plan"** (`PLAN_ENGINES` in `src/core/prices.ts`). Every cost surface treats them like upstream's subscription connections: never "unpriced", never added to real dollars.
- **≈ estimate.** At read time, plan usage is priced through pi's catalog under the model's API twin: `claude-code:X` → `anthropic:X`, and `codex:X` → `openai-codex:X`. It uses the same `callCost` as API turns. `SessionPricing.planEstimate` / `turnEstimates`, `jobEstimate` and the graph summary's `estimate` fields carry it. The UI shows it apart from real spend, marked ≈. A model with no catalog price gets no estimate (never a fake $0). Nothing is stored.
- **Live limits** (`src/agent/plan-limits.ts`, `GET /api/plan-limits`). There's one in-memory snapshot per engine: windows with % used and reset time, the plan type, and an extra-usage or credits note.
  - **Codex:** read with `account/rateLimits/read` on a short-lived app-server. `CodexAgent` also records every `account/rateLimits/updated` that runs receive.
  - **Claude Code:** read with the Agent SDK's `usage_EXPERIMENTAL_…` request on a session that is never prompted. A run's `rate_limit_event` schedules a debounced re-read (the event's own fields are under-documented, so they aren't parsed).
  - **Cost and staleness:** neither read spends tokens. The route serves snapshots younger than 60 s from cache, and `?refresh=1` forces a read.
  - **Shown in:** the stats-bar popover (only the plans the session used) and Settings → Providers → Plans (local CLIs).
- **Limits.** Which windows appear depends on the account; the UI shows whatever comes back. Claude's usage request is experimental in the SDK and is parsed defensively, so an unknown shape shows "unavailable".

## Known limits

- Each turn spawns a Claude Code process, which adds about 1–3 s of latency.
- Claude Code runs its own auto-compaction inside the session. The app's
  compaction still works too: it diverges the ledger, so the next turn starts
  a fresh, compacted session.
- Desktop packaging: electron-builder does not unpack the SDK's bundled
  binary. Install `claude` or set `LH_CLAUDE_CODE_PATH`.
- Subscription rate limits apply. Background jobs on `claude-code` count
  against the same limits.
