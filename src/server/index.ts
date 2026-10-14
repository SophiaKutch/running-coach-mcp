import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { loadRuns, SAMPLE_DATA_PATH } from "../data/loadRuns.js";
import { registerTools } from "./tools.js";
import { registerResources } from "./resources.js";
import { registerPrompts } from "./prompts.js";

/**
 * Point this at your own Strava export (see README.md) instead of the
 * bundled sample data:
 *   RUNNING_COACH_DATA_PATH=data/private/activities.csv npx tsx src/server/index.ts
 */
const dataPath = process.env.RUNNING_COACH_DATA_PATH ?? SAMPLE_DATA_PATH;

function createServer(): McpServer {
  const runs = loadRuns(dataPath);
  const server = new McpServer({ name: "running-coach", version: "0.1.0" });
  registerTools(server, runs);
  registerResources(server, runs);
  registerPrompts(server);
  return server;
}

const handle = serveStdio(createServer);

// stdout carries JSON-RPC messages for the MCP connection -- all
// human-readable logging has to go to stderr instead.
console.error(`running-coach MCP server listening on stdio (data: ${dataPath})`);

process.on("SIGINT", () => {
  void handle.close();
  process.exit(0);
});
