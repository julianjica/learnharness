# The Codex engine — design record

Date: 2026-10-25. Status: BUILT, fork-only. Sibling of
[the Claude Code engine](claude-code-engine.md); read that first.

## What it is

A third agent engine. Pick a model under the provider **`codex`** in
Settings → Models (or per session), and that role runs through the locally
installed **Codex CLI** (`codex app-server`) instead of pi. The run is billed
to whatever `codex` is signed in with, which is usually a ChatGPT
subscription, so no API key is needed. pi stays the default. The Claude Code
engine is unchanged.

**Personal use only**, like the Claude Code engine. Run this fork for
yourself and don't distribute builds that ship it enabled.

This is separate from upstream's desktop **ChatGPT** connection (provider
`chatgpt`, `electron/chatgpt.cjs`). That one signs in inside the Electron
app and calls the API directly. This one drives the CLI you already use and
works with `npm run dev` too.

## Setup

1. Install Codex and sign in once: `codex login`. `account/read` must show an
   account. Note: with keychain-backed auth, `codex login status` can say
   "Not logged in" while the app-server is signed in.
2. Start LearnHarness. In Settings → Models choose, for example,
   `codex · gpt-5.6-sol` for any slot.

| Env var | Effect |
|---|---|
| `LH_CODEX_PATH` | Explicit path to the `codex` executable. |
| `LH_CODEX=0` / `1` | Hide or force-show the provider. By default it is shown when an executable is found. |
| `LH_CODEX_USE_API_KEY=1` | Let Codex see `OPENAI_API_KEY` / `CODEX_API_KEY`. By default both are stripped so the CLI's own login decides billing. |

Executable lookup order: `LH_CODEX_PATH`, then `codex` on PATH, then
`~/.local/bin`, Homebrew and `/usr/local/bin`.

## Architecture: one adapter

`CodexAgent` (`src/agent/codex/agent.ts`) **extends** pi's `Agent`, the same
way `ClaudeCodeAgent` does. It emits the same events and the same
`AssistantMessage` / `ToolResultMessage` shapes, so ui-stream, the record,
the steer registry and the usage channel all run unchanged.

```
chat-handler ─▶ createProber/Teacher/PracticeAgent ─┬─ pi Agent        ─┐
                runSubagent (jobs)                   ├─ ClaudeCodeAgent ─┼─▶ ui-stream / record
                                                     └─ CodexAgent      ─┘
                                                          │ JSON-RPC over stdio (one child per run)
        codex app-server --disable <built-ins> -c <overrides>
          initialize {experimentalApi} → thread/start {baseInstructions, dynamicTools, model, ephemeral}
                                       | thread/resume {threadId, baseInstructions}
          turn/start {input, effort, summary}   ◀── item/tool/call (server request) ──▶ pi runToolCall
          turn/steer · turn/interrupt
```

| File | Role |
|---|---|
| `codex/catalog.ts` | Provider `codex`: pi's `openai-codex` catalog, re-stamped at zero cost. Also executable detection and the thinking-level → effort mapping. |
| `codex/rpc.ts` | The wire: `spawnCodex` (line-framed JSON-RPC over the child's stdio), `CodexClient`, the CLI flags, and the child env. |
| `codex/agent.ts` | `CodexAgent`: maps Codex items to pi messages, runs tools, applies stop rules, steering and abort, and updates the ledger. |
| `codex/render.ts` | Record → `UserInput[]`. It reuses `claude-code/render.ts`, with images sent as `data:` URLs. |
| `codex/sessions.ts` | The thread ledger (`data/codex/sessions.json`), with a tool-set fingerprint. |
| `codex/stream.ts` | pi `StreamFunction` on Codex: one step, tools not executed (visual-maker, pdf-reader). |

Touched outside the folder, in the same places as the Claude Code engine:
- `models.ts`
- `teacher-agent.ts` and `subagents/pi-run.ts`, which pick the agent class
- `server/model-catalog.ts`
- `claude-code/agent.ts`, which now exports `persistedView` and `steerText` for reuse

## Making Codex a bare model runner

The CLI normally adds a coding agent's environment. Each child gets:
- `--disable` for: apps, plugins, multi_agent, skill_search, shell_tool,
  unified_exec, view_image, image_generation, goals, computer_use,
  browser_use(_external), in_app_browser, tool_suggest, memories,
  recommended_plugins, personality, hooks, workspace_dependencies and
  shell_snapshot.
- `-c` overrides: `web_search="disabled"`, `mcp_servers={}` (so the user's
  configured MCP servers don't start), `include_environment_context`,
  `include_permissions_instructions`, `include_apps_instructions` and
  `include_collaboration_mode_instructions` all `=false`,
  `skills.include_instructions=false`, `project_doc_max_bytes=0`, and
  `tools.update_plan` and `tools.experimental_request_user_input` both
  `={enabled=false}`.
- `sandbox: read-only`, `approvalPolicy: never`, and a cwd of
  `data/codex/workdir`, which keeps these threads out of your project histories.
- `baseInstructions` set to our system prompt, which replaces Codex's own.

**Code mode stays on.** Every current Codex model is
`tool_mode: code_mode_only`: the model writes JavaScript in `exec`, and that
code calls our tools (`tools.quiz({...})`). Disabling `code_mode_host` makes
every tool call fail ("code-mode host is disabled"). The app-server still
reports each call as a `dynamicToolCall` item, followed by an `item/tool/call`
request that carries the logical tool name and parsed arguments, so the record
shows `quiz`, not `exec`.

## Semantics carried over from pi

- **One pi turn = one Codex step**: a model response plus the tool batch its
  `exec` ran. Codex marks the end of every step with
  `thread/tokenUsage/updated`, which arrives after the batch's last tool result
  and before the next response starts. This was observed live on fresh and
  resumed threads. The assistant message stays open until then, so every
  tool call of the step lands in it. Its `last` breakdown is the message's
  usage. Cached and cache-write tokens are split out of `inputTokens`, as in
  pi's Responses mapping. Cost is 0.
- **Tools** run through pi's `runToolCall` (heal → validation → execute). An
  invalid input answers Codex with `success: false` and pi's error text.
  Tool events are deferred until their message's `message_end`, which keeps
  pi's order.
- **Question-stop / terminate.** At the step end the results are appended and
  `turn_end` is emitted. Then the question stopper and the "all results
  terminate" rule are evaluated. Either one sends `turn/interrupt`, and
  anything Codex emits after that is ignored. Interrupting at the step end
  (not right after the tool response) leaves the call's result recorded in
  Codex's thread. Interrupting mid-exec cancels it. Both were verified live,
  and the thread resumes fine either way.
- **Steering.** A marker steered mid-run is appended to the transcript at the
  next step end and sent with `turn/steer {expectedTurnId}`. If Codex refuses
  (the turn is not steerable), the text becomes input for the next
  `turn/start`. Markers waiting when the turn completes start one more turn.
  Both paths were verified live.
- **Abort** sends `turn/interrupt`, closes the child, and settles the open
  message as `aborted`.
- **Failures** become an `error` assistant message carrying Codex's text.
  Sources: `turn/completed` with status `failed`, an `error` notification
  without `willRetry`, the child dying, or a missing CLI.

## History: resume + ledger

This is the Claude Code ledger, with one addition. `sessions.json` maps each
chat to `{ threadId, covered, fingerprint, toolsFingerprint }`.

- If the record still has the fingerprinted message at `covered` **and** the
  run's tool set matches `toolsFingerprint`, only the tail is sent. The tail
  is sent with `thread/resume` plus the current `baseInstructions`, and a
  resumed thread follows the new prompt.
- Otherwise the whole transcript seeds a **new** thread. Reasons include:
  - a divergence: compaction, an abort, a failure, a missing entry;
  - a different tool set;
  - Codex no longer having the thread.

**Why the tool fingerprint:** `dynamicTools` exist only on `thread/start`.
They persist with the thread and come back on resume, even in a new process,
but they can't be changed. So prober → teacher, which changes the tool set,
reseeds once per chat.

Sub-agents run ephemeral threads (`ephemeral: true`).

## Verification

- `tests/codex-agent.test.ts` drives `CodexAgent` against a scripted fake
  app-server (`tests/fixtures/fake-codex.ts`) that speaks the real messages
  in the live order. It covers:
  - dynamic tool schemas, tool correlation, validation errors and pi event order;
  - usage mapping and deltas;
  - question-stop with interrupt, plus resume;
  - ignoring stray events after a stop;
  - reseed on a tool-set change, on divergence, and when the thread is missing;
  - steering (accepted, and refused → next turn);
  - abort, a crash at startup, and a failed turn;
  - the `runSubagent` turn cap, the single-call stream, effort mapping, CLI flags and env stripping.
- `tests/codex-chat-flow.test.ts` runs the production prober through
  `handleChatRequest` with only the transport scripted. The watermark survives
  real persistence, so the answer turn resumes the thread.
- Live checks against `codex-cli 0.149.1` (gpt-5.6-luna):
  - a teacher quiz stops the run, and the answer resumes the same thread;
  - prompt caching works on resume;
  - a steer at the end of a turn starts a follow-up turn, and a mid-turn steer at a tool boundary changes the next tool call;
  - the single-call stream returns the call unexecuted;
  - the model-visible tool list contains only ours plus code mode's own tools.

## Known limits

- **Experimental API.** `dynamicTools`, `experimentalApi` and `turn/steer`
  are experimental app-server surfaces, so a Codex update can break them.
  Re-run the live checks after upgrading the CLI.
- **Leftover built-ins.** A few Codex built-ins remain visible to the model:
  `exec` and `wait` (code mode itself), `apply_patch` (harmless under the
  read-only sandbox with `approvalPolicy: never`), and the MCP-resource
  listers (empty, since no MCP servers are configured). Two short developer
  messages about multi-agent mode still appear. No config key found so far
  removes them.
- **Late tool events.** They appear when the step ends rather than when the
  tool starts, because the message stays open until the batch finishes.
- **Exec steps with no tool calls.** A step whose `exec` ran code without
  calling any LearnHarness tool counts as a step with no tool calls, so
  `finishTurn` runs on it. pi has no equivalent step.
- **Spawn latency.** Each run spawns `codex app-server`, which takes about
  1–2 s. Reasoning summaries arrive only when the model emits them.
- **Codex's own compaction.** Codex runs auto-compaction inside the thread.
  The app's compaction still works: it diverges the ledger and reseeds.
- **Model catalog.** It comes from pi, not from the installed CLI. A model
  your CLI doesn't serve fails at turn time with Codex's error.
- **Desktop packaging.** Install `codex` or set `LH_CODEX_PATH`. Nothing is
  bundled.
