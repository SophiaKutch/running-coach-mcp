import { containsAll, containsAny, containsNumberNear } from "./grading.js";

export interface EvalQuestion {
  id: string;
  question: string;
  /** Tool(s) the model should call at least once to answer this correctly. */
  expectedTools: string[];
  /** One-line explanation of what correctness means here, for readable reports. */
  rationale: string;
  /** Checks the model's final text answer against ground truth computed from the sample dataset. */
  checkAnswer: (answerText: string) => boolean;
}

/**
 * Every expected value below was computed by actually running this
 * project's analysis functions against `data/sample/activities.csv` --
 * none of it is hand-typed guesswork. `__tests__/questions.groundtruth.test.ts`
 * re-derives each one from the live code and asserts it still matches what's
 * hardcoded here, specifically so a later change to the analysis layer that
 * silently changes an answer gets caught instead of leaving these eval
 * questions quietly wrong.
 *
 * Two questions (`total-miles-may`, `trail-elevation-total`) are marked
 * `expectedlyHard`: `find_runs` returns a list, not an aggregate, so
 * answering them correctly requires the model to sum 20+ numbers itself
 * from tool output. They're kept in the set deliberately -- a model
 * getting these wrong is a real, useful finding about where a raw-list
 * tool isn't enough, not a bug in the eval.
 */
export const questions: (EvalQuestion & { expectedlyHard?: boolean })[] = [
  {
    id: "longest-run",
    question: "What's my longest run, and when was it?",
    expectedTools: ["personal_records"],
    rationale: "Longest run is the 2026-09-28 half marathon, 13.11 mi.",
    checkAnswer: (a) => containsNumberNear(a, 13.1, 0.15) && containsAny(a, ["2026-09-28", "september 28"]),
  },
  {
    id: "distance-prs",
    question: "What are my personal-best times for 5K, 10K, and half marathon?",
    expectedTools: ["personal_records"],
    rationale: "Best 5K 24:27 (2026-07-01), best 10K 59:12 (2026-07-05), best half 2:02:45 (2026-09-28).",
    checkAnswer: (a) => containsAll(a, ["24:27", "59:12", "2:02:45"]),
  },
  {
    id: "fastest-pace",
    question: "What's the fastest pace I've ever run, and which run was it?",
    expectedTools: ["personal_records"],
    rationale: "Fastest overall pace is 8:14/mi on the 2026-05-20 Track Workout.",
    checkAnswer: (a) => containsAll(a, ["8:14"]) && containsAny(a, ["2026-05-20", "may 20", "track workout"]),
  },
  {
    id: "highest-mileage-week",
    question: "Which week had my highest mileage, and how many miles was it?",
    expectedTools: ["personal_records"],
    rationale: "Highest-mileage week starts 2026-09-28, at ~45.7 mi.",
    checkAnswer: (a) => containsNumberNear(a, 45.7, 0.3) && containsAny(a, ["2026-09-28", "september 28"]),
  },
  {
    id: "recent-week-summary",
    question: "Give me a summary of my most recent week of training -- mileage, pace, and my longest run that week.",
    expectedTools: ["weekly_summary"],
    rationale: "Most recent week (2026-10-05 to 2026-10-11): 27.2 mi, 5 runs, longest run 9.8 mi.",
    checkAnswer: (a) => containsNumberNear(a, 27.2, 0.3) && containsNumberNear(a, 9.8, 0.3),
  },
  {
    id: "recent-week-hr-zones",
    question: "Using a max heart rate of 190, what heart-rate zone was I mostly training in last week?",
    expectedTools: ["weekly_summary"],
    rationale: "All 5 runs in the most recent week average-HR-classify into zone 3.",
    checkAnswer: (a) => containsAny(a, ["zone 3"]),
  },
  {
    id: "compare-last-28-days",
    question: "How does my training over the last 28 days compare to the 28 days before that -- mileage and pace?",
    expectedTools: ["compare_periods"],
    rationale: "Last 28 days: ~123.7 mi. Prior 28 days: ~110.6 mi.",
    checkAnswer: (a) => containsNumberNear(a, 123.7, 0.5) && containsNumberNear(a, 110.6, 0.5),
  },
  {
    id: "current-training-load",
    question: "What's my current training load, and is it in a sustainable range?",
    expectedTools: ["training_load"],
    rationale: "As of the most recent run (2026-10-11), ratio ~0.87, classified sustainable.",
    checkAnswer: (a) => containsAny(a, ["sustainable"]) && containsNumberNear(a, 0.87, 0.03),
  },
  {
    id: "training-load-as-of-date",
    question: "As of October 1, 2026, what was my training load?",
    expectedTools: ["training_load"],
    rationale: "As of 2026-10-01, ratio ~1.10, classified sustainable.",
    checkAnswer: (a) => containsAny(a, ["sustainable"]) && containsNumberNear(a, 1.1, 0.03),
  },
  {
    id: "trail-run-count",
    question: "How many of my runs were trail runs?",
    expectedTools: ["find_runs"],
    rationale: "13 runs are type trail_run.",
    checkAnswer: (a) => containsNumberNear(a, 13, 0.5),
  },
  {
    id: "mid-distance-count",
    question: "How many of my runs were between 5 and 7 miles?",
    expectedTools: ["find_runs"],
    rationale: "18 runs fall in the 5-7 mile range.",
    checkAnswer: (a) => containsNumberNear(a, 18, 0.5),
  },
  {
    id: "longest-run-september",
    question: "What was my longest run in September 2026?",
    expectedTools: ["find_runs"],
    rationale: "Longest run in September is the 13.11 mi half marathon on 2026-09-28 (requires finding the max in a returned list, not just reading a single field).",
    checkAnswer: (a) => containsNumberNear(a, 13.1, 0.15),
  },
  {
    id: "total-miles-may",
    question: "How many total miles did I run in May 2026?",
    expectedTools: ["find_runs"],
    expectedlyHard: true,
    rationale: "May 2026 total is 72.7 mi -- find_runs returns a list, so this requires the model to sum the returned numbers itself.",
    checkAnswer: (a) => containsNumberNear(a, 72.7, 3),
  },
  {
    id: "recent-runs",
    question: "Show me my 5 most recent runs, with dates.",
    expectedTools: ["get_recent_runs"],
    rationale: "The most recent run is 2026-10-11; the 5th-most-recent is 2026-10-05.",
    checkAnswer: (a) => containsAny(a, ["2026-10-11", "october 11"]) && containsAny(a, ["2026-10-05", "october 5"]),
  },
  {
    id: "recent-three-runs",
    question: "Show me my 3 most recent runs with their dates and distances.",
    expectedTools: ["get_recent_runs"],
    rationale: "The 3 most recent runs are 2026-10-11, 2026-10-10, and 2026-10-08.",
    checkAnswer: (a) => containsAny(a, ["2026-10-11", "october 11"]) && containsAny(a, ["2026-10-08", "october 8"]),
  },
  {
    id: "fast-runs-count",
    question: "How many runs have I done faster than an 8:40/mile pace?",
    expectedTools: ["find_runs"],
    rationale: "15 runs have a pace at or faster than 520 sec/mile (8:40/mi).",
    checkAnswer: (a) => containsNumberNear(a, 15, 0.5),
  },
  {
    id: "trail-elevation-total",
    question: "What's the total elevation gain across all my trail runs, in feet?",
    expectedTools: ["find_runs"],
    expectedlyHard: true,
    rationale: "Trail runs total ~8022 ft of elevation gain -- again requires summing 13 numbers from a returned list.",
    checkAnswer: (a) => containsNumberNear(a, 8022, 500),
  },
  {
    id: "september-vs-june",
    question: "Did I run more total miles in September or June 2026, and by about how much?",
    expectedTools: ["find_runs"],
    expectedlyHard: true,
    rationale: "September (~128.4 mi) beats June (~83.7 mi) by about 44.7 mi -- requires two tool calls plus summing both lists.",
    checkAnswer: (a) => containsAny(a, ["september"]) && containsNumberNear(a, 44.7, 5),
  },
];
