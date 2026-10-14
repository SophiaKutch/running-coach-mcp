import { McpServer } from "@modelcontextprotocol/server";
import type { Run } from "../data/types.js";
import { weeklyMileage } from "../analysis/index.js";
import { formatWeeklyMileageTable, toRunView } from "./formatting.js";

/**
 * Two resources exposing the training log as context: the full normalized
 * log as JSON (for a model that wants to compute something these tools
 * don't already cover) and a quick markdown weekly-mileage table (cheap to
 * read without a tool round-trip, good for orienting at the start of a
 * conversation).
 */
export function registerResources(server: McpServer, runs: Run[]): void {
  server.registerResource(
    "training-log",
    "training-log://all",
    {
      title: "Full Training Log",
      description: "Every normalized run in the training log, as JSON.",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(runs.map(toRunView), null, 2),
        },
      ],
    })
  );

  server.registerResource(
    "training-log-weekly-summary",
    "training-log://weekly-summary",
    {
      title: "Weekly Mileage Summary",
      description: "A markdown table of weekly mileage across the whole training log.",
      mimeType: "text/markdown",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "text/markdown",
          text: formatWeeklyMileageTable(weeklyMileage(runs)),
        },
      ],
    })
  );
}
