import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadStravaCsvFile } from "./strava.js";
import type { NormalizeResult, Run } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Path to the anonymized sample export checked into the repo. */
export const SAMPLE_DATA_PATH = path.join(__dirname, "../../data/sample/activities.csv");

/**
 * Loads normalized runs for the server/analysis layer to use.
 *
 * Defaults to the bundled anonymized sample so the project runs out of the
 * box with no setup. Pass your own Strava `activities.csv` export path to
 * use your real training data instead — see README.md for how to get one.
 */
export function loadRuns(csvPath: string = SAMPLE_DATA_PATH): Run[] {
  const result: NormalizeResult = loadStravaCsvFile(csvPath);
  if (result.skipped.length > 0) {
    // Surfacing this on stderr (not stdout) matters once this is wired into
    // the MCP server in Phase 3, which talks MCP over stdout.
    console.error(
      `[data] skipped ${result.skipped.length} row(s) from ${path.basename(csvPath)}:`
    );
    for (const s of result.skipped) {
      console.error(`  - ${s.ref}: ${s.reason}`);
    }
  }
  return result.runs;
}
