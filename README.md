<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/lh_banner_dark.png">
    <source media="(prefers-color-scheme: light)" srcset="docs/assets/lh_banner_light.png">
    <img src="docs/assets/lh_banner_light.png" alt="LearnHarness" width="640">
  </picture>
</p>

<p align="center"><strong>An agent harness for learning.</strong></p>

<p align="center">
  <a href="https://learnharness.ai">Download</a> ·
  <a href="#how-it-works">How it works</a> ·
  <a href="docs/development.md">Documentation</a> ·
  <a href="https://github.com/amosblomqvist/learnharness/issues">Issues</a>
</p>

> **This is a fork.** Besides API keys, it can run every agent on a **Claude** (Pro/Max) or **ChatGPT** (Plus/Pro/Team/Edu) subscription through the Claude Code or Codex CLI you already have signed in. See [Use a Claude or ChatGPT plan instead of API keys](#use-a-claude-or-chatgpt-plan-instead-of-api-keys). It is for personal use only.

LearnHarness uses AI agents to plan and teach lessons from your current understanding to your goal. It builds a detailed picture of what you understand and how you reason. That picture is updated as you learn.

Instead of just giving you an explanation, it uses your answers and thinking to decide what you need next. Teaching builds understanding one reasoning step at a time. Practice makes it usable. A persistent knowledge graph carries it across sessions.

![LearnHarness teaching session](docs/assets/teaching-session.png)

## How it works

1. **Measure.** Before teaching, the agent finds where your understanding ends on each part the lesson depends on. Your answers, confidence, and thinking show it where to start.
2. **Plan.** It works out a dependency map from that starting point to your goal. You can see the plan, and the lesson adapts when your understanding turns out different.
3. **Teach.** Each step builds on something you already understand. You predict, get an explanation, and check your understanding. Confusions are repaired before anything is built on them. The aim is for the goal to feel obviously true, not merely familiar.
4. **Practice.** Separate sessions pose varied problems that require the right knowledge to come to mind without being named first. Problems and hints adapt to your reasoning.

**Think out loud.** The thinking fields let you explain your reasoning, uncertainties, and reactions in your own words. This is how the agent gets a detailed picture rather than just a record of right and wrong answers. You can type or use dictation.

The agent can also research questions in the background, create visual explanations, and build interactive demonstrations.

## Knowledge that carries forward

What you are taught accumulates as propositions and reasoning chains: individual claims and the premises that lead to them. The graph shows this structure, with links back to the source sessions. You can also import notes.

Future teaching sessions can read the graph instead of starting from scratch. Practice sessions can draw their material from it. It stores the ideas and their connections, not ratings of your ability.

![LearnHarness knowledge graph](docs/assets/knowledge-graph.png)

## Download and get started

**[Download from learnharness.ai](https://learnharness.ai)** · [GitHub Releases](https://github.com/amosblomqvist/learnharness/releases)

- **macOS (Apple Silicon):** signed and notarized DMG. Drag the app to Applications.
- **Windows (x64):** run the installer. It is currently unsigned; Windows may show an “unknown publisher” or SmartScreen warning.
- **Linux (x64):** make the AppImage executable and open it, or install the Debian/Ubuntu `.deb`.

Add your provider API key and choose your models, then start a session with what you want to understand. LearnHarness supports 30+ provider options, including OpenAI, Anthropic, Google, DeepSeek, and OpenRouter. Optional dictation and web search use separate service keys.

All three platforms support in-app updates.

## Your keys, your data

- **Your keys and models.** No LearnHarness subscription or markup. You pay your providers for usage; a live cost meter shows model costs.
- **Local storage.** Your chats, graph, settings, and API keys live on your machine. Learning records are plain files you can inspect.
- **External services.** Models run through your configured providers. Model requests send the context needed for the task; web research and dictation also contact external services. Local storage does not mean offline processing.
- **Inspectable behavior.** System prompts are visible and editable. The app is open source under the AGPL-3.0 license.

## Use a Claude or ChatGPT plan instead of API keys

Upstream LearnHarness bills every model call to a provider API key. This fork adds two extra **engines** that run the agents through a coding CLI installed on your machine. The run is then billed to whatever plan that CLI is signed in with, and you need no API key for them.

| Provider in Settings → Models | Runs through | Paid by | Models offered |
|---|---|---|---|
| `claude-code` | [Claude Code](https://docs.anthropic.com/en/docs/claude-code) (`claude`) | Your Claude Pro / Max plan | Claude Opus, Sonnet, Haiku |
| `codex` | [Codex CLI](https://github.com/openai/codex) (`codex app-server`) | Your ChatGPT Plus / Pro / Team / Edu plan | GPT-5.6 / GPT-6 Codex models |

Everything else stays the same: the teaching method, the plan tree, the knowledge graph, practice and local storage. pi (the normal API-key engine) is still the default, and you can mix engines per slot.

> **Personal use only.** Anthropic's terms don't allow apps to offer claude.ai sign-in to other users, and the same caution applies to ChatGPT plans. Run this fork for yourself. Don't distribute builds with these engines enabled.

### Requirements

- **Run from source.** The downloads on learnharness.ai are upstream builds and don't include these engines. You need Node.js and `npm` to run this fork (see [Development and support](#development-and-support)).
- **The CLI installed and signed in**, for each plan you want to use:
  - **Claude:** install Claude Code, run `claude` once and sign in with `/login`.
  - **ChatGPT:** install the Codex CLI and run `codex login`. If you store credentials in the system keychain, `codex login status` can still say "Not logged in" even though Codex is signed in. The first turn in LearnHarness tells you either way.
- **A plan with room in it.** Runs count against your plan's normal usage limits, including background work.

### Setup

```bash
git clone https://github.com/julianjica/learnharness.git
cd learnharness
git checkout local-cli-engines # the branch with both engines
npm install
npm run dev                   # open http://localhost:3000
```

1. Open **Settings → Models**.
2. For each slot (**strong**, **cheap**, **vision**), choose a model under `claude-code` or `codex`. For example, `claude-code · claude-opus-5-5` for strong and `claude-code · claude-haiku-5-5` for cheap. A provider is listed only when its CLI is found.
3. Start a session as usual. You can also override the model for a single session.

You can mix freely: Claude for teaching and Codex for background jobs, or a plan for some slots and an API key for others.

### What changes when you use a plan

- **Cost meter:** plan runs show the plan's name plus an **API-equivalent estimate**, e.g. `Claude plan ≈$0.40` or `$0.12 + ChatGPT plan ≈$0.40` when a session also used an API key. The estimate is what the same tokens would cost at that model's API price (the price table LearnHarness already uses). It's marked ≈, and it's never added to real spend.
- **Plan usage limits:** open the cost in a session's stats bar, or go to **Settings → Providers → Plans (local CLIs)**. You'll see each plan's windows (for example 5-hour and weekly) with the % used and the reset time, read live from the signed-in CLI without spending tokens. Readings stay up to date during runs and are refreshed when older than a minute. Settings has a Refresh button.
- **Thinking level:** it maps to the CLI's reasoning effort (low → max). On Codex, "off" means its lowest effort.
- **Speed:** each turn starts a CLI process, which adds about 1–3 s.
- **History:** each chat keeps its own Claude Code session or Codex thread, so later turns send only what's new. These sessions run in `data/claude-code/` and `data/codex/` and stay out of your own project history.
- **No extra powers:** the CLIs' own tools (shell, file editing, web search, MCP servers, plugins) are switched off. The agents use only LearnHarness's tools.
- **Other services:** web search and dictation still use their own service keys, if you want them.
- **Errors:** if the CLI is signed out or a rate limit is hit, the turn shows the CLI's own error message.

### Options (environment variables)

| Variable | Effect |
|---|---|
| `LH_CLAUDE_CODE_PATH` / `LH_CODEX_PATH` | Use this executable instead of searching PATH and the usual install locations. |
| `LH_CLAUDE_CODE=0\|1` / `LH_CODEX=0\|1` | Hide or force-show the provider. |
| `LH_CLAUDE_CODE_USE_API_KEY=1` / `LH_CODEX_USE_API_KEY=1` | Let the CLI see an `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` saved in LearnHarness. By default these are hidden from it, so the run is billed to your plan, not your key. |

### Already on the official desktop app?

The upstream desktop app has its own **ChatGPT** sign-in (provider `chatgpt`) that works without this fork. The `codex` engine here is the alternative for running from source, or if you'd rather reuse your Codex CLI login.

Design notes and known limits: [docs/claude-code-engine.md](docs/claude-code-engine.md) and [docs/codex-engine.md](docs/codex-engine.md).

## Development and support

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # deterministic, no LLM, no network
```

See the [development guide](docs/development.md), [architecture](docs/architecture.md), and [desktop release guide](docs/desktop-release.md).

Questions, bug reports, and feature requests: [GitHub Issues](https://github.com/amosblomqvist/learnharness/issues).

## License

[AGPL-3.0](LICENSE)

The app is free and open forever. If we ever charge for anything, it will be for convenience — managed keys, hosting — never for features you can run locally.
