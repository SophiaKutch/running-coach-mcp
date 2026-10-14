# Running Coach MCP

An MCP server that gives Claude (or any MCP client) tools to query and
analyze your running data. Ask "How did my training go this month?" or "Am
I ready to bump my long run?" and get an answer grounded in your actual
numbers — not generic training advice.

**Status: Phase 1 (data layer) + Phase 2 (analysis functions) + Phase 3
(MCP server).** Evals and the full tutorial writeup come in later phases.
This README will grow into a proper quickstart as those land; for now it
documents what's here.

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
- `src/server/` — the MCP server. `formatting.ts` is pure and unit tested
  (turns analysis results into text); `schemas.ts`, `tools.ts`,
  `resources.ts`, `prompts.ts`, and `index.ts` wire those up to the
  `@modelcontextprotocol/server` SDK — see "Running the MCP server" below.

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

Everything under `src/data`, `src/analysis`, and `src/server/formatting.ts`
is unit tested and was verified in the sandbox this project was built in —
no internet access there, by design, which is also why that code has zero
runtime dependencies. `src/server/schemas.ts`, `tools.ts`, `resources.ts`,
`prompts.ts`, and `index.ts` call directly into the
`@modelcontextprotocol/server` SDK and `zod`, neither of which could be
installed in that sandbox, so this layer is written carefully against the
current SDK docs but has only been syntax-checked, not run. Run
`npm run inspect` first and confirm each tool/resource/prompt looks right
before wiring this into a host you rely on.

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
