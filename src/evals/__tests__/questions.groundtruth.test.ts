import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { loadRuns } from "../../data/loadRuns.js";
import { distanceMiles, formatPace } from "../../data/derived.js";
import { findRuns, getRecentRuns, personalRecords, trainingLoad } from "../../analysis/index.js";
import { formatComparePeriods, formatPersonalRecords, formatTrainingLoad } from "../../server/formatting.js";
import { buildWeeklySummary } from "../../server/weeklySummary.js";
import { resolvePeriodRanges } from "../../server/comparePeriodsHelper.js";
import { comparePeriods } from "../../analysis/comparePeriods.js";
import { questions } from "../questions.js";

/**
 * This file is the thing that keeps src/evals/questions.ts honest. It
 * doesn't call the MCP server or the model -- it re-runs the exact same
 * pure functions the tools call, builds the text those tools would
 * actually return, and asserts each question's checkAnswer() accepts that
 * real text. If someone changes an analysis function later in a way that
 * changes an answer, this test (not a human re-checking numbers by hand)
 * is what catches that the eval fixtures are now stale.
 *
 * It also asserts the reverse for a sample of questions: a clearly wrong
 * answer should fail checkAnswer. A grading function that accepts
 * everything is worse than no grading function.
 */
describe("eval question ground truth", () => {
  const runs = loadRuns();

  function byId(id: string) {
    const q = questions.find((q) => q.id === id);
    if (!q) throw new Error(`No question with id "${id}"`);
    return q;
  }

  it("has between 15 and 20 questions, each covering one of the server's 6 tools", () => {
    assert.ok(questions.length >= 15 && questions.length <= 20, `expected 15-20, got ${questions.length}`);
    const validTools = new Set([
      "get_recent_runs",
      "find_runs",
      "weekly_summary",
      "compare_periods",
      "training_load",
      "personal_records",
    ]);
    for (const q of questions) {
      assert.ok(q.expectedTools.length > 0, `${q.id} has no expectedTools`);
      for (const t of q.expectedTools) {
        assert.ok(validTools.has(t), `${q.id} references unknown tool "${t}"`);
      }
    }
    const coveredTools = new Set(questions.flatMap((q) => q.expectedTools));
    assert.equal(coveredTools.size, validTools.size, "every tool should be covered by at least one question");
  });

  it("personal_records questions accept the server's actual formatted output", () => {
    const text = formatPersonalRecords(personalRecords(runs));
    for (const id of ["longest-run", "distance-prs", "fastest-pace", "highest-mileage-week"]) {
      assert.ok(byId(id).checkAnswer(text), `${id} rejected the real personal_records output:\n${text}`);
    }
  });

  it("weekly_summary questions accept the server's actual formatted output", () => {
    const plain = buildWeeklySummary(runs).text;
    assert.ok(byId("recent-week-summary").checkAnswer(plain), plain);

    const withHr = buildWeeklySummary(runs, { maxHeartRate: 190 }).text;
    assert.ok(byId("recent-week-hr-zones").checkAnswer(withHr), withHr);
  });

  it("compare_periods questions accept the server's actual formatted output", () => {
    const ranges = resolvePeriodRanges(runs, {})!;
    const text = formatComparePeriods(comparePeriods(runs, ranges.rangeA, ranges.rangeB));
    assert.ok(byId("compare-last-28-days").checkAnswer(text), text);
  });

  it("training_load questions accept the server's actual formatted output", () => {
    const latest = formatTrainingLoad(trainingLoad(runs));
    assert.ok(byId("current-training-load").checkAnswer(latest), latest);

    const asOfOct1 = formatTrainingLoad(trainingLoad(runs, "2026-10-01"));
    assert.ok(byId("training-load-as-of-date").checkAnswer(asOfOct1), asOfOct1);
  });

  it("find_runs count questions match the live filtered counts", () => {
    assert.equal(findRuns(runs, { type: "trail_run" }).length, 13);
    assert.equal(findRuns(runs, { minDistanceMiles: 5, maxDistanceMiles: 7 }).length, 18);
    assert.equal(findRuns(runs, { maxPaceSecondsPerMile: 520 }).length, 15);

    assert.ok(byId("trail-run-count").checkAnswer("You've logged 13 trail runs."));
    assert.ok(byId("mid-distance-count").checkAnswer("18 runs were between 5 and 7 miles."));
    assert.ok(byId("fast-runs-count").checkAnswer("15 runs were faster than 8:40/mi."));
  });

  it("find_runs date-range questions match the live data", () => {
    const september = findRuns(runs, { startDate: "2026-09-01", endDate: "2026-09-30" });
    const longestInSeptember = september.reduce((a, b) => (distanceMiles(b) > distanceMiles(a) ? b : a));
    assert.ok(Math.abs(distanceMiles(longestInSeptember) - 13.11) < 0.01);
    assert.ok(byId("longest-run-september").checkAnswer(`Your longest run in September was ${distanceMiles(longestInSeptember).toFixed(2)} mi.`));

    const may = findRuns(runs, { startDate: "2026-05-01", endDate: "2026-05-31" });
    const mayTotal = may.reduce((sum, r) => sum + distanceMiles(r), 0);
    assert.ok(Math.abs(mayTotal - 72.7) < 0.5);
    assert.ok(byId("total-miles-may").checkAnswer(`You ran about ${mayTotal.toFixed(1)} mi in May 2026.`));

    const june = findRuns(runs, { startDate: "2026-06-01", endDate: "2026-06-30" });
    const juneTotal = june.reduce((sum, r) => sum + distanceMiles(r), 0);
    const septTotal = september.reduce((sum, r) => sum + distanceMiles(r), 0);
    assert.ok(byId("september-vs-june").checkAnswer(`September was higher, at ${septTotal.toFixed(1)} mi vs ${juneTotal.toFixed(1)} mi in June -- about ${(septTotal - juneTotal).toFixed(1)} mi more.`));
  });

  it("get_recent_runs questions match the live ordering", () => {
    const recent = getRecentRuns(runs, 5);
    assert.equal(recent[0]!.date, "2026-10-11");
    assert.equal(recent[4]!.date, "2026-10-05");
    assert.ok(
      byId("recent-runs").checkAnswer(recent.map((r) => `${r.date}: ${distanceMiles(r).toFixed(1)} mi`).join("\n"))
    );
    const recentThree = getRecentRuns(runs, 3);
    assert.ok(
      byId("recent-three-runs").checkAnswer(
        recentThree.map((r) => `${r.date}: ${distanceMiles(r).toFixed(1)} mi`).join("\n")
      )
    );
  });

  it("trail elevation total matches the live data", () => {
    const trails = findRuns(runs, { type: "trail_run" });
    const totalFeet = trails.reduce((sum, r) => sum + (r.elevationGainMeters ?? 0) / 0.3048, 0);
    assert.ok(Math.abs(totalFeet - 8022) < 50, `expected ~8022 ft, got ${totalFeet.toFixed(0)}`);
    assert.ok(byId("trail-elevation-total").checkAnswer(`Total elevation gain across trail runs: ${totalFeet.toFixed(0)} ft.`));
  });

  it("rejects clearly wrong answers (grading isn't vacuously true)", () => {
    assert.equal(byId("longest-run").checkAnswer("Your longest run was 3.1 mi on 2026-01-01."), false);
    assert.equal(byId("current-training-load").checkAnswer("You're in a high-risk training load right now."), false);
    assert.equal(byId("trail-run-count").checkAnswer("You've done 2 trail runs."), false);
    assert.equal(byId("fastest-pace").checkAnswer("Your fastest pace was 10:30/mi."), false);
  });

  it("the fastest-pace fixture's hardcoded '8:14' matches a live recomputation", () => {
    const pr = personalRecords(runs);
    assert.equal(formatPace(pr.fastestOverallPace?.paceSecondsPerMile), "8:14");
  });
});
