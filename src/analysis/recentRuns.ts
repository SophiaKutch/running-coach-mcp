import type { Run } from "../data/types.js";

/**
 * The most recent `limit` runs, newest first. Ties on the same date keep
 * their original relative order (Array.prototype.sort is stable), which in
 * practice means the order they appeared in the source export.
 */
export function getRecentRuns(runs: Run[], limit = 10): Run[] {
  return [...runs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
}
