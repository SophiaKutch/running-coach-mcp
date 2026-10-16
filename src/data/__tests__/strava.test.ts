import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadStravaCsvFile, parseStravaCsv } from "../strava.js";
import { formatPace, paceSecondsPerMile } from "../derived.js";

const HEADERS =
  "Activity ID,Activity Date,Activity Name,Activity Type,Elapsed Time,Moving Time,Distance,Max Heart Rate,Average Heart Rate,Elevation Gain,Activity Description";

function csv(...rows: string[]): string {
  return [HEADERS, ...rows].join("\n");
}

describe("parseStravaCsv", () => {
  it("normalizes a valid run row", () => {
    const { runs, skipped } = parseStravaCsv(
      csv('111,"Apr 13, 2026, 6:30:00 AM",Easy Run,Run,1325,1305,3476,150,140,36')
    );

    assert.equal(skipped.length, 0);
    assert.equal(runs.length, 1);
    const run = runs[0]!;
    assert.equal(run.id, "111");
    assert.equal(run.date, "2026-04-13");
    assert.equal(run.type, "run");
    assert.equal(run.distanceMeters, 3476);
    assert.equal(run.movingTimeSeconds, 1305);
    assert.equal(run.elapsedTimeSeconds, 1325);
    assert.equal(run.averageHeartRate, 140);
    assert.equal(run.maxHeartRate, 150);
    assert.equal(run.elevationGainMeters, 36);
    assert.equal(run.source, "strava");
  });

  it("maps Trail Run and Race activity types", () => {
    const { runs } = parseStravaCsv(
      csv(
        '1,"Apr 13, 2026, 6:30:00 AM",Trail Loop,Trail Run,1500,1400,4000,,,200',
        '2,"Apr 20, 2026, 8:00:00 AM",Local 10K,Race,2400,2380,10000,,,50'
      )
    );
    assert.deepEqual(
      runs.map((r) => r.type),
      ["trail_run", "race"]
    );
  });

  it("skips non-running activity types and records why", () => {
    const { runs, skipped } = parseStravaCsv(
      csv(
        '1,"Apr 13, 2026, 6:30:00 AM",Bike Commute,Ride,1500,1400,7200,,,45',
        '2,"Apr 13, 2026, 6:30:00 AM",Lift,Weight Training,2700,2700,0,,,'
      )
    );
    assert.equal(runs.length, 0);
    assert.equal(skipped.length, 2);
    assert.match(skipped[0]!.reason, /non-running activity type: Ride/);
    assert.match(skipped[1]!.reason, /non-running activity type: Weight Training/);
  });

  it("leaves heart rate undefined rather than 0 when the export has no HR data", () => {
    const { runs } = parseStravaCsv(
      csv('1,"Apr 13, 2026, 6:30:00 AM",Easy Run,Run,1325,1305,3476,,,36')
    );
    assert.equal(runs[0]!.averageHeartRate, undefined);
    assert.equal(runs[0]!.maxHeartRate, undefined);
  });

  it("parses Activity Description when present", () => {
    const { runs } = parseStravaCsv(
      csv('1,"Apr 13, 2026, 6:30:00 AM",Easy Run,Run,1325,1305,3476,,,36,"Knee felt stiff, cut it short"')
    );
    assert.equal(runs[0]!.description, "Knee felt stiff, cut it short");
  });

  it("leaves description undefined when the column is blank or missing entirely", () => {
    const { runs: blank } = parseStravaCsv(csv('1,"Apr 13, 2026, 6:30:00 AM",Easy Run,Run,1325,1305,3476,,,36,'));
    assert.equal(blank[0]!.description, undefined);

    // Older-format exports (and the HEADERS constant used throughout the
    // rest of this file) may not have the column at all.
    const oldFormatCsv = [
      "Activity ID,Activity Date,Activity Name,Activity Type,Elapsed Time,Moving Time,Distance,Max Heart Rate,Average Heart Rate,Elevation Gain",
      '1,"Apr 13, 2026, 6:30:00 AM",Easy Run,Run,1325,1305,3476,,,36',
    ].join("\n");
    const { runs: noColumn } = parseStravaCsv(oldFormatCsv);
    assert.equal(noColumn[0]!.description, undefined);
  });

  it("skips rows with an unparseable or missing Activity Date", () => {
    const { runs, skipped } = parseStravaCsv(csv("1,,Untitled Activity,Run,1800,1750,4800,,,"));
    assert.equal(runs.length, 0);
    assert.match(skipped[0]!.reason, /unparseable Activity Date/);
  });

  it("skips rows missing distance or moving time", () => {
    const { runs, skipped } = parseStravaCsv(
      csv('1,"Apr 13, 2026, 6:30:00 AM",Weird Row,Run,,,,,,')
    );
    assert.equal(runs.length, 0);
    assert.equal(skipped[0]!.reason, "missing distance or moving time");
  });

  it("keeps the runner's local calendar date for an evening run, not the UTC-shifted one (regression test)", () => {
    // This is the actual bug: an evening run in a negative-UTC-offset
    // timezone (e.g. Seattle, UTC-7/-8) used to come out dated the
    // *next* day, because the old code pulled the date via
    // `.toISOString()`, which converts through UTC before truncating to
    // YYYY-MM-DD. 7:30pm Pacific is 2:30am UTC the next calendar day.
    const originalTz = process.env.TZ;
    process.env.TZ = "America/Los_Angeles";
    try {
      const { runs } = parseStravaCsv(
        csv('1,"Oct 13, 2026, 7:30:00 PM",Evening Run,Run,1800,1750,8000,,,50')
      );
      assert.equal(runs.length, 1);
      assert.equal(runs[0]!.date, "2026-10-13", "should keep Oct 13, the runner's actual local date");
    } finally {
      if (originalTz === undefined) delete process.env.TZ;
      else process.env.TZ = originalTz;
    }
  });

  it("sorts normalized runs by date ascending", () => {
    const { runs } = parseStravaCsv(
      csv(
        '1,"Apr 20, 2026, 6:30:00 AM",Later Run,Run,1200,1150,3000,,,10',
        '2,"Apr 13, 2026, 6:30:00 AM",Earlier Run,Run,1200,1150,3000,,,10'
      )
    );
    assert.deepEqual(
      runs.map((r) => r.name),
      ["Earlier Run", "Later Run"]
    );
  });
});

describe("sample dataset", () => {
  const samplePath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../data/sample/activities.csv"
  );

  it("loads and normalizes without throwing, with the expected mix of runs and skips", () => {
    const { runs, skipped } = loadStravaCsvFile(samplePath);

    assert.ok(runs.length > 100, `expected >100 runs, got ${runs.length}`);
    assert.ok(skipped.length > 0, "expected at least one skipped row");

    // The sample intentionally includes non-running cross-training entries.
    assert.ok(
      skipped.some((s) => /Ride|Weight Training/.test(s.reason)),
      "expected at least one skipped Ride/Weight Training row"
    );
    // ...and one deliberately malformed row (blank Activity Date).
    assert.ok(
      skipped.some((s) => /unparseable Activity Date/.test(s.reason)),
      "expected the deliberately malformed row to be skipped"
    );

    // Every normalized run should have a sane, computable pace.
    for (const run of runs) {
      const pace = paceSecondsPerMile(run);
      assert.ok(pace !== undefined && pace > 0, `bad pace for run ${run.id}`);
      assert.match(formatPace(pace), /^\d+:\d{2}$/);
    }
  });
});
