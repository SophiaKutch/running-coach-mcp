import { writeFileSync, mkdirSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { questions } from "./questions.js";
import { toolsCoverExpected } from "./grading.js";

/**
 * The grounding check: for each question in questions.ts, this actually
 * asks Claude (via the real Anthropic API) the question with this
 * project's own MCP server's tools available, records which tools it
 * called, and grades the final answer against ground truth computed
 * directly from the data (see questions.ts and its groundtruth test).
 *
 * This file could not be run or tested in the sandbox this project was
 * built in -- no network access, so no way to install @anthropic-ai/sdk or
 * @modelcontextprotocol/client, let alone call the live API. It's written
 * carefully against both SDKs' current docs, but it is genuinely
 * unverified until you run it. See README.md.
 *
 * Requires:
 *   ANTHROPIC_API_KEY  - your API key (this script calls the real API and
 *                        will use a small amount of API credit per run)
 *   ANTHROPIC_MODEL    - a current model id (e.g. from docs.claude.com) --
 *                        deliberately not defaulted here, since a model id
 *                        hardcoded today is likely to be stale by the time
 *                        you're reading this
 *
 * Usage:
 *   ANTHROPIC_API_KEY=... ANTHROPIC_MODEL=... npm run eval
 *   RUNNING_COACH_DATA_PATH=data/private/activities.csv ANTHROPIC_API_KEY=... ANTHROPIC_MODEL=... npm run eval
 */

const MAX_TOOL_ROUNDS = 6;
const MAX_TOKENS = 1024;

interface QuestionResult {
  id: string;
  question: string;
  expectedTools: string[];
  calledTools: string[];
  toolsOk: boolean;
  answerOk: boolean;
  pass: boolean;
  expectedlyHard: boolean;
  finalAnswer: string;
  rationale: string;
}

async function main(): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY is not set. This script calls the real Anthropic API and needs your key.");
    process.exit(1);
  }
  const model = process.env.ANTHROPIC_MODEL;
  if (!model) {
    console.error(
      "ANTHROPIC_MODEL is not set. Pick a current model id (see docs.claude.com) and set it, e.g.:\n" +
        "  ANTHROPIC_MODEL=claude-sonnet-4-5 npm run eval\n" +
        "(not defaulted in code -- a hardcoded model id here would likely be stale by the time you read this)."
    );
    process.exit(1);
  }

  const anthropic = new Anthropic({ apiKey });
  const client = new Client({ name: "running-coach-evals", version: "0.1.0" });
  const transport = new StdioClientTransport({
    command: "npx",
    args: ["tsx", "src/server/index.ts"],
    env: { ...process.env },
  });

  const results: QuestionResult[] = [];

  try {
    await client.connect(transport);
    const { tools } = await client.listTools();
    const anthropicTools = tools.map((t) => ({
      name: t.name,
      description: t.description ?? "",
      input_schema: t.inputSchema as Anthropic.Tool.InputSchema,
    }));

    for (const q of questions) {
      console.error(`Running: ${q.id}`);
      const result = await runQuestion(anthropic, client, model, anthropicTools, q);
      results.push(result);
    }
  } finally {
    await client.close();
  }

  printReport(results);
  writeReport(results);

  const hardFailures = results.filter((r) => !r.pass && !r.expectedlyHard);
  process.exit(hardFailures.length > 0 ? 1 : 0);
}

/**
 * The Anthropic SDK's own nested type names (for a tool-use content block,
 * a message param, a tool-result block, ...) couldn't be checked against
 * the installed package from this project's sandbox, so the loop below
 * deliberately uses plain, loosely-typed objects instead of guessing at
 * exact exported type names that might not compile. The runtime shapes
 * (content blocks with a `type` field, tool_use blocks with id/name/input,
 * tool_result blocks with tool_use_id/content) are the stable, documented
 * Messages API wire format this is built against.
 */
async function runQuestion(
  anthropic: Anthropic,
  client: Client,
  model: string,
  tools: { name: string; description: string; input_schema: unknown }[],
  question: (typeof questions)[number]
): Promise<QuestionResult> {
  const calledTools: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messages: any[] = [{ role: "user", content: question.question }];

  let finalAnswer = "";

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await anthropic.messages.create({
      model,
      max_tokens: MAX_TOKENS,
      tools: tools as never,
      messages,
    });

    const content: { type: string; text?: string; id?: string; name?: string; input?: unknown }[] = response.content;
    const toolUseBlocks = content.filter((b) => b.type === "tool_use");

    if (toolUseBlocks.length === 0 || response.stop_reason !== "tool_use") {
      finalAnswer = content
        .filter((b) => b.type === "text")
        .map((b) => b.text ?? "")
        .join("\n");
      break;
    }

    messages.push({ role: "assistant", content: response.content });

    const toolResults: { type: "tool_result"; tool_use_id: string; content: string; is_error: boolean }[] = [];
    for (const block of toolUseBlocks) {
      calledTools.push(block.name!);
      const callResult = await client.callTool({ name: block.name!, arguments: block.input as Record<string, unknown> });
      const text = (callResult.content as { type: string; text?: string }[])
        .filter((c) => c.type === "text")
        .map((c) => c.text ?? "")
        .join("\n");
      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id!,
        content: text,
        is_error: callResult.isError === true,
      });
    }
    messages.push({ role: "user", content: toolResults });
  }

  const toolsOk = toolsCoverExpected(calledTools, question.expectedTools);
  const answerOk = question.checkAnswer(finalAnswer);

  return {
    id: question.id,
    question: question.question,
    expectedTools: question.expectedTools,
    calledTools: [...new Set(calledTools)],
    toolsOk,
    answerOk,
    pass: toolsOk && answerOk,
    expectedlyHard: question.expectedlyHard === true,
    finalAnswer,
    rationale: question.rationale,
  };
}

function printReport(results: QuestionResult[]): void {
  console.log("\n=== Grounding check results ===\n");
  for (const r of results) {
    const marker = r.pass ? "PASS" : r.expectedlyHard ? "FAIL (expected-hard)" : "FAIL";
    console.log(`[${marker}] ${r.id}`);
    if (!r.pass) {
      console.log(`  question: ${r.question}`);
      console.log(`  expected tools: ${r.expectedTools.join(", ")} | called: ${r.calledTools.join(", ") || "(none)"}`);
      console.log(`  rationale: ${r.rationale}`);
      console.log(`  final answer: ${r.finalAnswer.slice(0, 300)}`);
    }
  }
  const pass = results.filter((r) => r.pass).length;
  const hardFails = results.filter((r) => !r.pass && r.expectedlyHard).length;
  const realFails = results.filter((r) => !r.pass && !r.expectedlyHard).length;
  console.log(`\n${pass}/${results.length} passed (${hardFails} expected-hard failure(s), ${realFails} other failure(s))\n`);
}

function writeReport(results: QuestionResult[]): void {
  mkdirSync("eval-results", { recursive: true });
  const lines = [
    "# Grounding check results",
    "",
    `Run at ${new Date().toISOString()}`,
    "",
    "| Question | Pass | Tools Expected | Tools Called |",
    "|---|---|---|---|",
    ...results.map(
      (r) =>
        `| ${r.id} | ${r.pass ? "✅" : r.expectedlyHard ? "⚠️ (expected-hard)" : "❌"} | ${r.expectedTools.join(", ")} | ${r.calledTools.join(", ") || "(none)"} |`
    ),
  ];
  writeFileSync("eval-results/latest.md", lines.join("\n") + "\n");
  console.error("Wrote eval-results/latest.md");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
