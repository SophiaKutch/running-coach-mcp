import * as z from "zod/v4";

/**
 * Zod input schemas for each tool. Kept in their own file (rather than
 * inlined in tools.ts) so the shape of each tool's arguments is easy to
 * scan in one place -- useful both for readers and for the Phase 4 evals,
 * which will need to know exactly what each tool accepts.
 */

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected an ISO date like 2026-04-13")
  .describe("yyyy-mm-dd");

export const RunTypeSchema = z.enum(["run", "trail_run", "treadmill_run", "race"]);

export const GetRecentRunsInput = z.object({
  limit: z
    .number()
    .int()
    .positive()
    .max(50)
    .optional()
    .describe("How many recent runs to return. Defaults to 10, capped at 50."),
});

export const FindRunsInput = z.object({
  startDate: isoDate.optional().describe("Only runs on or after this date."),
  endDate: isoDate.optional().describe("Only runs on or before this date."),
  minDistanceMiles: z.number().positive().optional(),
  maxDistanceMiles: z.number().positive().optional(),
  minPaceSecondsPerMile: z
    .number()
    .positive()
    .optional()
    .describe("Only runs with pace slower-or-equal to this many seconds per mile."),
  maxPaceSecondsPerMile: z
    .number()
    .positive()
    .optional()
    .describe("Only runs with pace faster-or-equal to this many seconds per mile."),
  type: RunTypeSchema.optional().describe("Restrict to one activity type."),
});

export const WeeklySummaryInput = z.object({
  weekStart: isoDate
    .optional()
    .describe("Any date within the week to summarize. Defaults to the most recent week with runs."),
  maxHeartRate: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Your max heart rate. If given, includes a heart-rate zone breakdown for the week."),
});

export const ComparePeriodsInput = z.object({
  periodAStart: isoDate.optional(),
  periodAEnd: isoDate.optional(),
  periodBStart: isoDate.optional(),
  periodBEnd: isoDate.optional(),
  windowDays: z
    .number()
    .int()
    .positive()
    .max(365)
    .optional()
    .describe(
      "Shortcut when explicit period dates aren't given: compares the last N days to the N days before that. Defaults to 28."
    ),
});

export const TrainingLoadInput = z.object({
  asOfDate: isoDate.optional().describe("Evaluate load as of this date. Defaults to the most recent run."),
});

export const PersonalRecordsInput = z.object({});

export const SearchRunNotesInput = z.object({
  query: z
    .string()
    .min(1)
    .describe("What to search for, in plain language, e.g. 'when did my knee bother me' or 'runs with the club'."),
  limit: z
    .number()
    .int()
    .positive()
    .max(20)
    .optional()
    .describe("How many matching runs to return. Defaults to 5."),
});
