import { McpServer } from "@modelcontextprotocol/server";
import type { Run } from "../data/types.js";
import { formatPace } from "../data/derived.js";
import {
  addDays,
  comparePeriods,
  findRuns,
  getRecentRuns,
  getWeekEnd,
  getWeekStart,
  heartRateZones,
  longRunProgression,
  paceTrends,
  personalRecords,
  trainingLoad,
  weeklyMileage,
} from "../analysis/index.js";
import {
  formatComparePeriods,
  formatHeartRateZones,
  formatLongRunWeek,
  formatPersonalRecords,
  formatRunsList,
  formatTrainingLoad,
  formatWeeklyMileage,
} from "./formatting.js";
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
      const weeks = weeklyMileage(runs);
      if (weeks.length === 0) {
        return { content: [{ type: "text", text: "No runs in the training log." }] };
      }

      const targetWeekStart = weekStart ? getWeekStart(weekStart) : weeks[weeks.length - 1]!.weekStart;
      const mileageWeek = weeks.find((w) => w.weekStart === targetWeekStart);
      if (!mileageWeek) {
        return {
          content: [{ type: "text", text: `No runs found for the week of ${targetWeekStart}.` }],
          isError: true,
        };
      }

      const lines = [formatWeeklyMileage(mileageWeek)];

      const paceWeek = paceTrends(runs).weeks.find((w) => w.weekStart === targetWeekStart);
      if (paceWeek?.averagePaceSecondsPerMile !== undefined) {
        lines.push(`Average pace: ${formatPace(paceWeek.averagePaceSecondsPerMile)}/mi`);
      }

      const longRunWeek = longRunProgression(runs).find((w) => w.weekStart === targetWeekStart);
      if (longRunWeek) {
        lines.push(formatLongRunWeek(longRunWeek));
      }

      if (maxHeartRate !== undefined) {
        const weekRuns = findRuns(runs, { startDate: targetWeekStart, endDate: getWeekEnd(targetWeekStart) });
        lines.push(formatHeartRateZones(heartRateZones(weekRuns, maxHeartRate)));
      }

      return { content: [{ type: "text", text: lines.join("\n") }] };
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
    async ({ periodAStart, periodAEnd, periodBStart, periodBEnd, windowDays }) => {
      let rangeA: { start: string; end: string };
      let rangeB: { start: string; end: string };

      if (periodAStart && periodAEnd && periodBStart && periodBEnd) {
        rangeA = { start: periodAStart, end: periodAEnd };
        rangeB = { start: periodBStart, end: periodBEnd };
      } else {
        const latest = getRecentRuns(runs, 1)[0]?.date;
        if (!latest) {
          return { content: [{ type: "text", text: "No runs in the training log." }] };
        }
        const days = windowDays ?? 28;
        rangeA = { start: addDays(latest, -(days - 1)), end: latest };
        rangeB = { start: addDays(latest, -(2 * days - 1)), end: addDays(latest, -days) };
      }

      const result = comparePeriods(runs, rangeA, rangeB);
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
