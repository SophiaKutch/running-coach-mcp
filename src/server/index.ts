import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { loadRuns, SAMPLE_DATA_PATH } from "../data/loadRuns.js";
import { registerTools } from "./tools.js";
import { registerResources } from "./resources.js";
import { registerPrompts } from "./prompts.js";
import { buildNoteIndex } from "../rag/noteIndex.js";

/**
 * Point this at your own Strava export (see README.md) instead of the
 * bundled sample data:
 *   RUNNING_COACH_DATA_PATH=data/private/activities.csv npx tsx src/server/index.ts
 */
const dataPath = process.env.RUNNING_COACH_DATA_PATH ?? SAMPLE_DATA_PATH;

async function main(): Promise<void> {
  const runs = loadRuns(dataPath);

  // Building the note index means loading the local embedding model and
  // embedding every run note that isn't already cached from a previous
  // run (see src/rag/noteIndex.ts) -- on a cold cache with a real export
  // this is the slow part of startup, so it's worth a status line of its
  // own rather than leaving the server looking hung.
  console.error("Building semantic search index over run notes (first run may download a local model)...");
  const noteIndex = await buildNoteIndex(runs);
  console.error(`Indexed ${noteIndex.length} run note(s) for search_run_notes.`);

  function createServer(): McpServer {
    const server = new McpServer({ name: "running-coach", version: "0.1.0" });
    registerTools(server, runs, noteIndex);
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
}

main().catch((err) => {
  console.error("Fatal error starting running-coach MCP server:", err);
  process.exit(1);
});
