import { McpServer } from "@modelcontextprotocol/server";
import type { Run } from "../data/types.js";
import { comparePeriods, findRuns, getRecentRuns, personalRecords, trainingLoad } from "../analysis/index.js";
import { formatComparePeriods, formatPersonalRecords, formatRunsList, formatTrainingLoad } from "./formatting.js";
import { buildWeeklySummary } from "./weeklySummary.js";
import { resolvePeriodRanges } from "./comparePeriodsHelper.js";
import {
  ComparePeriodsInput,
  FindRunsInput,
  GetRecentRunsInput,
  PersonalRecordsInput,
  TrainingLoadInput,
  WeeklySummaryInput,
} from "./schemas.js";

/** Don't dump an unbounded number of matches back to the model in one tool result. */
const MAX_RUNS_SHOWN = 50;

/**
 * Registers the six tools this server exposes. Every handler is a thin
 * wrapper: validate/default the input, call into `src/analysis` (pure,
 * already unit tested), then hand the result to `src/server/formatting`
 * (also pure, also unit tested) to turn into text. The only untested code
 * path here is the MCP wiring itself -- see README.md for why.
 */
export function registerTools(server: McpServer, runs: Run[]): void {
  server.registerTool(
    "get_recent_runs",
    {
      title: "Get Recent Runs",
      description: "Returns the most recent runs from the training log, newest first.",
      inputSchema: GetRecentRunsInput,
    },
    async ({ limit }) => {
      const recent = getRecentRuns(runs, limit ?? 10);
      return { content: [{ type: "text", text: formatRunsList(recent) }] };
    }
  );

  server.registerTool(
    "find_runs",
    {
      title: "Find Runs",
      description:
        "Filters the training log by any combination of date range, distance range, pace range, and activity type.",
      inputSchema: FindRunsInput,
    },
    async (filter) => {
      const matches = findRuns(runs, filter);
      const shown = matches.slice(0, MAX_RUNS_SHOWN);
      let text = formatRunsList(shown);
      if (matches.length > MAX_RUNS_SHOWN) {
        text += `\n...and ${matches.length - MAX_RUNS_SHOWN} more match(es) not shown.`;
      }
      return { content: [{ type: "text", text }] };
    }
  );

  server.registerTool(
    "weekly_summary",
    {
      title: "Weekly Summary",
      description:
        "Summarizes one week of training: mileage, average pace, the week's longest run, and (optionally) a heart-rate zone breakdown.",
      inputSchema: WeeklySummaryInput,
    },
    async ({ weekStart, maxHeartRate }) => {
      const { text, isError } = buildWeeklySummary(runs, { weekStart, maxHeartRate });
      return isError ? { content: [{ type: "text", text }], isError: true } : { content: [{ type: "text", text }] };
    }
  );

  server.registerTool(
    "compare_periods",
    {
      title: "Compare Periods",
      description:
        "Compares training volume and pace between two date ranges. Give explicit start/end dates for both periods, " +
        "or just windowDays to compare the last N days against the N days before that.",
      inputSchema: ComparePeriodsInput,
    },
    async (input) => {
      const ranges = resolvePeriodRanges(runs, input);
      if (!ranges) {
        return { content: [{ type: "text", text: "No runs in the training log." }] };
      }
      const result = comparePeriods(runs, ranges.rangeA, ranges.rangeB);
      return { content: [{ type: "text", text: formatComparePeriods(result) }] };
    }
  );

  server.registerTool(
    "training_load",
    {
      title: "Training Load",
      description:
        "Reports the acute:chronic training load ratio (last 7 days vs. a 28-day baseline) and what it suggests. " +
        "This is a general training heuristic, not personalized medical or coaching advice.",
      inputSchema: TrainingLoadInput,
    },
    async ({ asOfDate }) => {
      const result = trainingLoad(runs, asOfDate);
      return { content: [{ type: "text", text: formatTrainingLoad(result) }] };
    }
  );

  server.registerTool(
    "personal_records",
    {
      title: "Personal Records",
      description:
        "Reports personal records from the training log: longest run, fastest sustained pace, best efforts at " +
        "5K/10K/half marathon/marathon distances, and the highest-mileage week.",
      inputSchema: PersonalRecordsInput,
    },
    async () => {
      const result = personalRecords(runs);
      return { content: [{ type: "text", text: formatPersonalRecords(result) }] };
    }
  );
}
