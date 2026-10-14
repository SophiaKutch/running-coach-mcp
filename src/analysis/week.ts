import type { Run } from "../data/types.js";

/**
 * Returns the Monday (ISO 8601 week start) for the week containing `dateStr`.
 * `dateStr` is a plain "yyyy-mm-dd" date (as produced by the data layer), so
 * we anchor it at UTC midnight rather than parsing in the local timezone —
 * otherwise a run logged late at night could shift to the wrong calendar
 * day depending on where this code runs.
 */
export function getWeekStart(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const day = d.getUTCDay(); // 0 = Sunday ... 6 = Saturday
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diffToMonday);
  return d.toISOString().slice(0, 10);
}

/** The Sunday that ends the week starting on `weekStart`. */
export function getWeekEnd(weekStart: string): string {
  const d = new Date(`${weekStart}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 6);
  return d.toISOString().slice(0, 10);
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Inclusive day-count difference: daysBetween("2026-01-01", "2026-01-03") === 2. */
export function daysBetween(fromDateStr: string, toDateStr: string): number {
  const from = new Date(`${fromDateStr}T00:00:00Z`).getTime();
  const to = new Date(`${toDateStr}T00:00:00Z`).getTime();
  return Math.round((to - from) / 86_400_000);
}

/**
 * Groups runs into Monday-start weeks and returns them in chronological
 * order. Weeks with no runs are omitted — callers that need a continuous
 * timeline (e.g. a chart with no gaps) should fill those in themselves.
 */
export function groupByWeek(runs: Run[]): Map<string, Run[]> {
  const weeks = new Map<string, Run[]>();
  for (const run of runs) {
    const weekStart = getWeekStart(run.date);
    const bucket = weeks.get(weekStart);
    if (bucket) {
      bucket.push(run);
    } else {
      weeks.set(weekStart, [run]);
    }
  }
  return new Map([...weeks.entries()].sort(([a], [b]) => a.localeCompare(b)));
}
