import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  formatComparePeriods,
  formatDuration,
  formatHeartRateZones,
  formatLongRunWeek,
  formatPaceTrend,
  formatPersonalRecords,
  formatRaceTime,
  formatRunLine,
  formatRunsList,
  formatTrainingLoad,
  formatWeeklyMileage,
  formatWeeklyMileageTable,
  toRunView,
} from "../formatting.js";
import { makeRun } from "../../analysis/__tests__/testUtils.js";
import { comparePeriods } from "../../analysis/comparePeriods.js";
import { heartRateZones } from "../../analysis/heartRateZones.js";
import { longRunProgression } from "../../analysis/longRunProgression.js";
import { paceTrends } from "../../analysis/paceTrends.js";
import { personalRecords } from "../../analysis/personalRecords.js";
import { trainingLoad } from "../../analysis/trainingLoad.js";
import { weeklyMileage } from "../../analysis/weeklyMileage.js";

const MILE = 1609.344;

describe("toRunView / formatRunLine", () => {
  it("converts meters to miles, computes pace, and converts elevation to feet", () => {
    const run = makeRun({
      name: "Sunday Long Run",
      distanceMeters: 10 * MILE,
      movingTimeSeconds: 10 * 480,
      averageHeartRate: 145,
      elevationGainMeters: 100, // ~328 ft
    });
    const view = toRunView(run);
    assert.ok(Math.abs(view.distanceMiles - 10) < 0.01);
    assert.ok(Math.abs(view.paceSecondsPerMile! - 480) < 0.1);
    assert.equal(view.paceFormatted, "8:00");
    assert.equal(view.elevationGainFeet, 328);

    const line = formatRunLine(run);
    assert.match(line, /Sunday Long Run/);
    assert.match(line, /10\.00 mi/);
    assert.match(line, /8:00\/mi/);
    assert.match(line, /avg HR 145/);
    assert.match(line, /\+328 ft gain/);
  });

  it("falls back to a humanized type when the run has no name", () => {
    const line = formatRunLine(makeRun({ name: undefined, type: "trail_run" }));
    assert.match(line, /Trail Run/);
  });

  it("omits the elevation segment when elevation data is missing", () => {
    const line = formatRunLine(makeRun({ elevationGainMeters: undefined }));
    assert.doesNotMatch(line, /ft gain/);
  });
});

describe("formatRunsList", () => {
  it("reports when nothing matched", () => {
    assert.equal(formatRunsList([]), "No runs matched.");
  });

  it("joins one formatted line per run", () => {
    const runs = [makeRun({ id: "a" }), makeRun({ id: "b" })];
    assert.equal(formatRunsList(runs).split("\n").length, 2);
  });
});

describe("formatDuration", () => {
  it("formats sub-hour durations as minutes only", () => {
    assert.equal(formatDuration(1500), "25m");
  });
  it("formats durations over an hour as h and zero-padded m", () => {
    assert.equal(formatDuration(5400), "1h30m");
  });
});

describe("formatRaceTime", () => {
  it("formats sub-hour times as m:ss, unpadded minutes", () => {
    assert.equal(formatRaceTime(1467), "24:27"); // a 5K PR, not rounded away to "24m"
  });
  it("formats hour-plus times as h:mm:ss", () => {
    assert.equal(formatRaceTime(7365), "2:02:45"); // a half marathon finish
  });
  it("zero-pads seconds under 10", () => {
    assert.equal(formatRaceTime(605), "10:05");
  });
});

describe("formatWeeklyMileage / formatWeeklyMileageTable", () => {
  it("summarizes a single week", () => {
    const weeks = weeklyMileage([
      makeRun({ date: "2026-01-05", distanceMeters: 5 * MILE, movingTimeSeconds: 5 * 480 }),
    ]);
    const text = formatWeeklyMileage(weeks[0]!);
    assert.match(text, /2026-01-05 to 2026-01-11/);
    assert.match(text, /1 run/);
    assert.match(text, /5\.0 mi/);
  });

  it("renders a markdown table with one row per week", () => {
    const weeks = weeklyMileage([
      makeRun({ date: "2026-01-05" }),
      makeRun({ date: "2026-01-12" }),
    ]);
    const table = formatWeeklyMileageTable(weeks);
    assert.match(table, /\| Week Of \| Runs \| Miles \| Moving Time \|/);
    assert.equal(table.split("\n").length, 4); // header + separator + 2 weeks
  });

  it("handles an empty training log", () => {
    assert.equal(formatWeeklyMileageTable([]), "No runs in the training log.");
  });
});

describe("formatLongRunWeek", () => {
  it("reports both the week's longest run and the cumulative record", () => {
    const weeks = longRunProgression([
      makeRun({ id: "w1", date: "2026-01-05", distanceMeters: 10 * MILE, name: "Long Run" }),
    ]);
    const text = formatLongRunWeek(weeks[0]!);
    assert.match(text, /10\.0 mi/);
    assert.match(text, /Long Run/);
    assert.match(text, /to date: 10\.0 mi/);
  });
});

describe("formatPaceTrend", () => {
  it("flags insufficient data under 3 weeks", () => {
    const result = paceTrends([makeRun({ date: "2026-01-05" })]);
    assert.match(formatPaceTrend(result), /Not enough weeks/);
  });

  it("describes an improving trend with a direction and magnitude", () => {
    const runs = ["2026-01-05", "2026-01-12", "2026-01-19", "2026-01-26"].map((date, i) =>
      makeRun({ date, distanceMeters: MILE, movingTimeSeconds: 600 - i * 20 })
    );
    const text = formatPaceTrend(paceTrends(runs));
    assert.match(text, /getting faster/);
    assert.match(text, /improving/);
  });
});

describe("formatHeartRateZones", () => {
  it("reports when no runs had heart rate data", () => {
    const result = heartRateZones([makeRun({ averageHeartRate: undefined })], 190);
    assert.equal(formatHeartRateZones(result), "No runs had heart rate data to classify.");
  });

  it("lists populated zones and notes excluded runs", () => {
    const result = heartRateZones(
      [makeRun({ averageHeartRate: 140 }), makeRun({ averageHeartRate: undefined })],
      190
    );
    const text = formatHeartRateZones(result);
    assert.match(text, /Zone 3/);
    assert.match(text, /1 run\(s\) had no recorded heart rate/);
  });
});

describe("formatTrainingLoad", () => {
  it("includes the ratio, classification narrative, and disclaimer", () => {
    const runs = [
      makeRun({ date: "2026-01-01", movingTimeSeconds: 1800 }),
      makeRun({ date: "2026-01-22", movingTimeSeconds: 9000 }),
    ];
    const text = formatTrainingLoad(trainingLoad(runs, "2026-01-28"));
    assert.match(text, /ratio/);
    assert.match(text, /injury risk/);
    assert.match(text, /not personalized medical or coaching advice/);
  });

  it("handles insufficient data", () => {
    assert.equal(
      formatTrainingLoad(trainingLoad([], "2026-01-28")),
      "Not enough recent training history to compute a training load ratio."
    );
  });
});

describe("formatComparePeriods", () => {
  it("reports both periods and the deltas between them", () => {
    const runs = [
      makeRun({ date: "2026-02-05", distanceMeters: 5 * MILE, movingTimeSeconds: 5 * 480 }),
      makeRun({ date: "2026-01-05", distanceMeters: 3 * MILE, movingTimeSeconds: 3 * 540 }),
    ];
    const text = formatComparePeriods(
      comparePeriods(runs, { start: "2026-02-01", end: "2026-02-28" }, { start: "2026-01-01", end: "2026-01-31" })
    );
    assert.match(text, /2026-02-01 to 2026-02-28/);
    assert.match(text, /more in the first period/);
    assert.match(text, /faster in the first period/);
  });
});

describe("formatPersonalRecords", () => {
  it("lists every populated record", () => {
    const runs = [
      makeRun({ id: "5k", date: "2026-01-05", distanceMeters: 5000, movingTimeSeconds: 1200 }),
      makeRun({ id: "long", date: "2026-01-12", distanceMeters: 20 * MILE, movingTimeSeconds: 20 * 600 }),
    ];
    const text = formatPersonalRecords(personalRecords(runs));
    assert.match(text, /Longest run/);
    assert.match(text, /Fastest sustained pace/);
    assert.match(text, /Best 5K: 20:00/); // 1200 seconds, exact mm:ss, not rounded to "20m"
    assert.match(text, /Highest-mileage week/);
  });

  it("handles an empty training log", () => {
    assert.equal(formatPersonalRecords(personalRecords([])), "No runs in the training log yet.");
  });
});
