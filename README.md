# Running Coach MCP

An MCP server that gives Claude (or any MCP client) tools to query and
analyze your running data. Ask "How did my training go this month?" or "Am
I ready to bump my long run?" and get an answer grounded in your actual
numbers — not generic training advice.

**Status: Phase 1 (data layer) + Phase 2 (analysis functions).** The MCP
server itself, evals, and full tutorial writeup come in later phases. This
README will grow into a proper quickstart as those land; for now it
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
  (acute:chronic workload ratio), and `personalRecords`. None of these
  touch the filesystem or the network — they take data in and return data
  out, which is what makes them straightforward to unit test and safe to
  hand to an MCP tool later: the model will only ever see numbers this
  code already computed and verified, never numbers it has to compute
  itself from a raw run list.

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
