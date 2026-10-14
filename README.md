# Running Coach MCP

An MCP server that gives Claude (or any MCP client) tools to query and
analyze your running data. Ask "How did my training go this month?" or "Am
I ready to bump my long run?" and get an answer grounded in your actual
numbers — not generic training advice.

**Status: Phase 1 (data layer) + Phase 2 (analysis functions) + Phase 3
(MCP server) + Phase 4 (evals).** The full tutorial writeup is the last
phase left. This README will grow into a proper quickstart as that lands;
for now it documents what's here.

## What's here right now

- `src/data/types.ts` — the canonical `Run` shape every analysis function
  will build on, regardless of which platform the data came from.
- `src/data/strava.ts` — parses a Strava bulk-export `activities.csv` into
  normalized `Run[]`, filtering out non-running activities and skipping
  (not crashing on) malformed rows.
- `src/data/derived.ts` — pace/distance-unit conversions, computed on
  demand rather than stored, so they can't drift out of sync with the
  underlying distance and time.
- `src/data/loadRuns.ts` — the entry point the rest of the project will
  call; defaults to the bundled sample data.
- `data/sample/activities.csv` — a synthetic, anonymized export (157 rows,
  ~6 months of training) so you can clone this repo and run it with no
  login, no API keys, and no real personal data.
- `src/analysis/` — pure functions over normalized `Run[]`: `weeklyMileage`,
  `paceTrends`, `heartRateZones`, `longRunProgression`, `trainingLoad`
  (acute:chronic workload ratio), `personalRecords`, `getRecentRuns`,
  `findRuns`, and `comparePeriods`. None of these touch the filesystem or
  the network — they take data in and return data out, which is what
  makes them straightforward to unit test and safe to hand to an MCP tool:
  the model only ever sees numbers this code already computed and
  verified, never numbers it has to compute itself from a raw run list.
- `src/server/` — the MCP server. `formatting.ts`, `weeklySummary.ts`, and
  `comparePeriodsHelper.ts` are pure and unit tested (they build the actual
  response text/logic); `schemas.ts`, `tools.ts`, `resources.ts`,
  `prompts.ts`, and `index.ts` wire those up to the
  `@modelcontextprotocol/server` SDK — see "Running the MCP server" below.
- `src/evals/` — the grounding check. `questions.ts` has 18 questions with
  ground truth computed directly from the sample dataset; `grading.ts` is
  the pure scoring logic; `runEvals.ts` is the harness that actually asks
  Claude the questions with this server's tools available and grades the
  results — see "Running the evals" below.

## Using your own data

1. In Strava, go to **Settings → My Account → Download or Delete Your
   Account → Download Request**, and request your bulk export. Strava
   emails you a zip file (this can take a while).
2. Unzip it and find `activities.csv`.
3. Don't commit it — put it under `data/private/` (already gitignored) and
   pass that path to `loadRuns("data/private/activities.csv")` instead of
   relying on the default sample.

## Running the tests

```bash
npm install
npm test
```

## Running the MCP server

This project uses the current `@modelcontextprotocol/server` (v2) SDK —
not the older `@modelcontextprotocol/sdk` package you'll see in a lot of
existing tutorials. `npm install` pulls it in alongside `zod`.

**Tools:** `get_recent_runs`, `find_runs`, `weekly_summary`,
`compare_periods`, `training_load`, `personal_records`.
**Resources:** `training-log://all` (every run as JSON) and
`training-log://weekly-summary` (a markdown weekly-mileage table).
**Prompts:** `weekly-review` and `plan-next-4-weeks`.

Run it directly over stdio:

```bash
npm start
```

Or point the [MCP Inspector](https://github.com/modelcontextprotocol/inspector)
at it, to poke at tools/resources/prompts from a browser UI before wiring
it into a host:

```bash
npm run inspect
```

### Connecting it to a host

Replace `/absolute/path/to/running-coach-mcp` below with this project's
actual path on your machine (`pwd` from inside it will tell you).

**Claude Desktop** — edit (or create)
`~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "running-coach": {
      "type": "stdio",
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/running-coach-mcp/src/server/index.ts"]
    }
  }
}
```

Restart Claude Desktop after saving.

**Claude Code** — from inside this project's folder:

```bash
claude mcp add running-coach -- npx tsx src/server/index.ts
```

**VS Code** — create `.vscode/mcp.json` in this project's folder:

```json
{
  "servers": {
    "running-coach": {
      "type": "stdio",
      "command": "npx",
      "args": ["tsx", "src/server/index.ts"]
    }
  }
}
```

To use your own Strava export instead of the sample data, add an `env`
block to whichever config above you're using:

```json
"env": { "RUNNING_COACH_DATA_PATH": "/absolute/path/to/data/private/activities.csv" }
```

### What's been verified where

Everything under `src/data`, `src/analysis`, and the pure parts of
`src/server` (`formatting.ts`, `weeklySummary.ts`, `comparePeriodsHelper.ts`)
is unit tested and was verified in the sandbox this project was built in —
no internet access there, by design, which is also why that code has zero
runtime dependencies. `src/server/schemas.ts`, `tools.ts`, `resources.ts`,
`prompts.ts`, and `index.ts` call directly into the
`@modelcontextprotocol/server` SDK and `zod`, neither of which could be
installed in that sandbox, so this layer is written carefully against the
current SDK docs but has only been syntax-checked, not run. Run
`npm run inspect` first and confirm each tool/resource/prompt looks right
before wiring this into a host you rely on.

## Running the evals

The question set lives in `src/evals/questions.ts`: 18 questions whose
correct answers were computed by actually running this project's own
analysis functions against `data/sample/activities.csv` (not hand-typed) --
`npm test` includes `questions.groundtruth.test.ts`, which re-derives every
expected value from the live code and fails if the fixtures and the code
ever drift apart.

Three questions are marked `expectedlyHard` in `questions.ts`: `find_runs`
returns a list, not an aggregate, so "how many total miles in May" or
"total elevation gain across my trail runs" requires the model to sum 15-25
numbers itself from tool output, rather than reading one field. They're
kept in the set on purpose -- a model getting one of these wrong is a real
finding about where a raw-list tool stops being enough, which is exactly
the kind of limit this phase exists to surface.

`npm run eval` is the harness that actually runs the check: it spawns the
MCP server, asks Claude each question with the server's tools available,
tracks which tools got called, and grades the final answer. This calls the
real Anthropic API and needs your own key:

```bash
ANTHROPIC_API_KEY=sk-ant-... ANTHROPIC_MODEL=claude-sonnet-4-5 npm run eval
```

`ANTHROPIC_MODEL` isn't defaulted in code deliberately -- a model id
hardcoded today would likely be stale whenever this is actually run; check
[docs.claude.com](https://docs.claude.com) for a current one. This also
means the eval script itself (`src/evals/runEvals.ts`) could not be
executed in the sandbox this project was built in: no network access to
call the Anthropic API, and `@anthropic-ai/sdk` / `@modelcontextprotocol/client`
couldn't be installed either. It's written against both SDKs' current docs
and syntax-checked, but it's genuinely unverified until you run it --
expect to debug it a little on the first pass, the same way you would any
new integration test.

Each run prints a pass/fail report to the terminal and writes
`eval-results/latest.md` (gitignored) with a results table you can reference
later -- worth keeping a copy of a good run for the Phase 6 blog post.

## Design notes (for anyone reading this as a portfolio project)

- **SI units internally, display units at the edges.** Distance and time
  are stored in meters/seconds; miles, km, and formatted paces are derived
  functions, not stored fields. This is the same "keep the math in code,
  let the model only interpret it" principle the later MCP/eval phases
  depend on — it starts here, in how the data is shaped.
- **Skip-and-record, not throw-or-silently-drop.** Real exports are messy
  (blank dates, cross-training entries, missing heart-rate data from
  before you owned a chest strap). The parser records *why* each row was
  excluded instead of crashing or quietly losing data, which made it much
  easier to trust the numbers once this got wired into analysis.
- **Zero runtime dependencies in the data layer.** `src/data/csv.ts` is a
  small hand-rolled CSV parser instead of a library — Strava's export is
  simple enough (comma-separated, one quoted column) that this is a
  deliberate, documented trade-off rather than an oversight. Tests run on
  Node's built-in test runner (`node:test`) for the same reason.
- **Honest about what the data can and can't support.** `heartRateZones`
  can only classify each *run* by its average heart rate, not report true
  time-in-zone, because a Strava CSV export has one average-HR number per
  run rather than a continuous HR stream. The code says so in a comment
  instead of quietly presenting a more precise-looking number than the
  data actually supports — the same discipline the Phase 4 evals are
  meant to check for in the model's answers, applied here to the code
  that will ground them.
- **`trainingLoad` is a documented heuristic, not medical advice.** It
  implements the acute:chronic workload ratio (7-day load vs. 28-day
  baseline) from sports-science literature, with the commonly-cited
  classification bands — not a personalized risk assessment.
- **A sixth tool that wasn't in the original plan.** The original Phase 3
  tool list was 5 tools, but Phase 2 shipped 6 analysis functions —
  `personalRecords` had nowhere to go. Rather than leave it as dead code,
  this added a `personal_records` tool so every analysis function Phase 2
  wrote is actually reachable by the model.
- **Tool results are plain text, not structured output.** The current SDK
  supports an `outputSchema` + `structuredContent` pattern alongside text,
  which would be a nice addition — it was deliberately left out of this
  phase because it couldn't be verified without the real SDK installed,
  and a schema mismatch would fail at runtime in a way this project had
  no way to catch here. Worth adding once Phase 4's evals are in place to
  catch a regression if one slips in.
- **Computing eval ground truth found two real bugs before any model ever
  saw this server.** `formatPersonalRecords` was feeding PR times through
  `formatDuration`, a minute-precision formatter meant for run durations —
  a 24:27 5K PR displayed as "24m". Writing the ground-truth for
  `fastest-pace`/`distance-prs` meant computing the real number by hand
  and noticing it didn't match the server's own text. Fixed by adding
  `formatRaceTime` (second-precision `mm:ss`/`h:mm:ss`) and switching
  `formatPersonalRecords` to use it. Separately, no tool surfaced
  elevation gain anywhere in its output despite it being computed and
  stored on every run — the `trail-elevation-total` question is what
  surfaced the gap. Fixed by adding `+N ft gain` to `formatRunLine` when
  elevation data is present. Neither bug would have shown up from reading
  the code; both showed up from trying to grade an answer against it.
  That's the actual argument for evals, not just the one in the README.
- **A real-data bug the sample dataset couldn't catch: evening runs dated
  a day late.** `parseStravaDate` used to pull the calendar date via
  `parsed.toISOString().slice(0, 10)`. Strava's CSV export has no
  timezone marker — it's the runner's local start time — so
  `new Date(raw)` parses it in the local timezone of whatever machine
  runs the server. `.toISOString()` then converts that through UTC before
  truncating to a date, which silently rolls any evening run onto the
  *next* calendar day for anyone west of UTC (most of the US): a 7:30pm
  run in Seattle becomes "2:30am UTC the next day". Every test fixture
  and the synthetic sample data happened to use morning timestamps, so
  this passed 94/94 tests and shipped in Phase 4 — it only surfaced when
  a real user pointed the server at her own Strava export and noticed a
  run was dated a day off. Fixed by reading the date from the parsed
  `Date` object's local getters (`getFullYear`/`getMonth`/`getDate`)
  instead of round-tripping through UTC, with a regression test that
  forces `process.env.TZ` to `America/Los_Angeles` to reproduce the
  rollover deterministically regardless of what timezone the test runner
  itself is in. The fix also shifted a handful of runs across month/week
  boundaries in the sample data, which `questions.groundtruth.test.ts`
  caught immediately — three eval fixtures (`total-miles-may`,
  `training-load-as-of-date`, `recent-three-runs`) had their expected
  values regenerated from the corrected code rather than hand-adjusted,
  exactly the drift-detection this test exists for. A good reminder that
  a synthetic dataset, however large, can't cover every timezone a test
  machine might run in — this one only runs on the server operator's own
  machine, which is what made the local-time assumption fixable rather
  than a design flaw.
- **The eval set is a grounding check on tool outputs, not a benchmark of
  the model.** `checkAnswer` looks for the right numbers in the final
  text, and `toolsCoverExpected` checks the right tools got called — it
  isn't scoring prose quality, tone, or which exact phrasing the model
  used. The goal is catching "the server's answer was wrong or
  incomplete," which is a property of this codebase, not of whichever
  model happens to be running `npm run eval` that day.
