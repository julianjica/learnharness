# Handoff: Claude Code engine fork (from a Claude Cowork conversation)

Owner: Julian (fork `julianjica/learnharness`, branch `local-cli-engines` — formerly `claude-code-engine` + `codex-engine`, both deleted 2026-10-26).
Upstream: `amosblomqvist/learnharness`. This file carries the context of the
conversation that built the engine so work can continue in Claude Code.

## Goal

Run LearnHarness on a Claude subscription instead of an API key. Every
agent role can use the local, signed-in Claude Code CLI through
`@anthropic-ai/claude-agent-sdk`. This is for personal use only: Anthropic's
terms don't allow apps to offer claude.ai login to other users, so don't
distribute builds with it enabled.

## Decisions (made with the owner)

- Plan first, then code. Both phases were approved:
  - Phase 1: teaching agents (prober, teacher, practice).
  - Phase 2: background agents (research, demos, visuals, PDFs, extraction, auditor).
- Auth: use whatever the `claude` CLI is signed in with. `ANTHROPIC_API_KEY` and
  `ANTHROPIC_AUTH_TOKEN` are stripped from the child's env unless
  `LH_CLAUDE_CODE_USE_API_KEY=1`.
- History: each chat resumes its own Claude Code session, tracked by a ledger
  watermark. The alternative, rebuilding the transcript every turn, was rejected.
- pi stays the default engine. Claude Code is an extra provider named `claude-code`.

## Read first

- `docs/claude-code-engine.md`: the design record (architecture, the pi
  semantics that were kept, the ledger, env vars, known limits).
- `AGENTS.md`: upstream house rules. "No guessing": ask before design
  decisions, plan before implementing.

## Where things are

- `src/agent/claude-code/`:
  - `agent.ts`: `ClaudeCodeAgent extends pi Agent`.
  - `mcp.ts`: tools exposed over low-level MCP handlers.
  - `render.ts`: record → Claude Code input.
  - `sessions.ts`: the ledger at `data/claude-code/sessions.json`.
  - `stream.ts`: single-call `StreamFunction` for visual-maker and pdf-reader.
  - `catalog.ts`: models, executable detection, effort mapping.
- Hooks into the app:
  - `src/agent/models.ts`: engine for `claude-code` specs.
  - `src/agent/teacher-agent.ts` and `src/agent/subagents/pi-run.ts`: choose `ClaudeCodeAgent`.
  - `src/server/model-catalog.ts`: picker and validation.
- Tests:
  - `tests/claude-code-agent.test.ts`: scripted fake `query()` with a real MCP connection.
  - `tests/claude-code-chat-flow.test.ts`: the real turn pipeline with an isolated `LH_DATA_DIR`.

## Status (2026-10-25)

- Committed as `feat: Claude Code engine (provider "claude-code")` and pushed.
- `npm test`: everything passes except 2 tests that also fail on upstream
  `main` and are unrelated: `SessionRow` in render-sidebar, and the pi loader
  exports test in subscription-auth.
- Checked live against the real CLI:
  - tool calls over MCP;
  - pi event order (tool events are deferred until the issuing message ends,
    because Claude Code starts tools before `message_stop`);
  - PostToolBatch `{continue:false}` stops after a question or terminate;
  - steering through PostToolBatch `additionalContext`;
  - resume with a new system prompt (prober → teacher).
- Owner's first real session (martingales, all slots on `claude-code`, opus
  strong and haiku cheap) ran fine: probe → probe_done → plan_init → quizzes.
- Graph: not populated yet. The session had about 2.2k uncovered prose tokens,
  below the 4096-token extraction trigger. The extraction pipeline was run on a
  copy of that session with a stand-in `query()` and wrote the graph correctly,
  so the first REAL extraction run still needs to be watched. Look for
  `[extraction …]` lines in the `npm run dev` terminal. The manual trigger is
  the session sidebar menu → Extract, or lower Settings → Graph → chunk budget.

## Open items / ideas

1. Watch the first real extraction and auditor run on Claude Code. Their
   submit tools have large schemas, and `maxTurns` defaults to 4.
2. Picker polish: show "Claude Code (subscription)" instead of the raw
   `claude-code` provider id, and something other than "$0 / $0" pricing
   (see `subscriptionLabel` in `components/settings/model-menu.tsx`).
3. Phase 3, packaging: electron-builder doesn't unpack the SDK's bundled
   binary. Rely on an installed `claude` or `LH_CLAUDE_CODE_PATH`, or add an
   asarUnpack rule.
4. Latency: each turn spawns a Claude Code process (about 1–3 s). This could
   later be replaced by one warm streaming `query()` per live chat.
5. Repo clutter from the handoff: `0001-…patch`, `learnharness-claude-code-engine.bundle`
   and `claude-code-engine.md` in the repo root are delivery copies. Safe to
   delete. The `package-lock.json` drift from a local `npm install` was
   committed on 2026-10-27 (minor in-range bumps).

## Update 2026-10-25: upstream merge + Codex engine

- Upstream `amosblomqvist/learnharness` was added as remote `upstream`. Its
  2 new commits (issue templates and a ChatGPT test fix) were merged into
  `claude-code-engine` and pushed.
- New branch `codex-engine`, based on `claude-code-engine`, adds a second
  local-CLI engine: provider `codex`, driven by `codex app-server`. The
  design record is `docs/codex-engine.md`.
- Decisions (made with the owner):
  - fork-only;
  - app-server JSON-RPC with `dynamicTools`;
  - one process per run;
  - a tool-set change (prober → teacher) reseeds a fresh thread;
  - models come from pi's `openai-codex` catalog.
- Checked live against codex-cli 0.149.1:
  - quiz stop, then resume;
  - steering, both mid-turn and at the end of the turn;
  - the single-call stream.
- Codex open items:
  1. Watch a full real session (probe → teach handoff reseed, extraction).
  2. The `dynamicTools` / `turn/steer` APIs are experimental. Re-run the live
     checks after a `codex update`.

## Update 2026-10-26: one branch, plan limits, asides

- Single branch `local-cli-engines` (contains both engines); the old
  `claude-code-engine` and `codex-engine` branches were deleted locally and
  on GitHub. `upstream/main` has moved on (0.3.8) and is NOT merged yet.
- Plan usage limits + API-equivalent ≈$ estimates (commit 23aa5cd).
- Asides — side questions while a teach check or practice problem waits
  (docs/architecture.md "Asides"; core/server/UI commits 49fc6c9, 9661558,
  d82f30f). Open item: the golden-fixture law wants a real practice record
  containing an `aside` marker added to tests/fixtures/golden-data (+ the
  marker-coverage EXPECTED list).
