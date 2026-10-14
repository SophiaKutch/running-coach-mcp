import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";

/**
 * Prompt arguments are always plain strings at the protocol level, so
 * numeric-feeling inputs like maxHeartRate are declared as strings here and
 * interpolated as text into the instruction -- the model (and the
 * weekly_summary/training_load tools it calls) parse them from there.
 */
export function registerPrompts(server: McpServer): void {
  server.registerPrompt(
    "weekly-review",
    {
      title: "Weekly Review",
      description: "Review the most recent week of training using the available tools.",
      argsSchema: z.object({
        maxHeartRate: z
          .string()
          .optional()
          .describe("Your max heart rate, if you want a heart-rate zone breakdown included."),
      }),
    },
    ({ maxHeartRate }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text:
              "Give me a review of my most recent week of training. Call weekly_summary for the most recent week" +
              (maxHeartRate ? ` with maxHeartRate=${maxHeartRate}` : "") +
              ", and training_load as of the same date. Cover: total mileage and run count, how pace compares to " +
              "recent weeks, the training load ratio and what it suggests, and anything that stands out. Keep it to " +
              "a few short paragraphs, and note that this isn't medical or coaching advice.",
          },
        },
      ],
    })
  );

  server.registerPrompt(
    "plan-next-4-weeks",
    {
      title: "Plan My Next 4 Weeks",
      description: "Draft a 4-week training plan grounded in recent training history.",
      argsSchema: z.object({
        goal: z.string().optional().describe("What you're training for, e.g. 'half marathon in 10 weeks'."),
        maxHeartRate: z.string().optional().describe("Your max heart rate, for training-load context."),
      }),
    },
    ({ goal, maxHeartRate }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text:
              "Help me plan my next 4 weeks of training" +
              (goal ? ` toward: ${goal}` : "") +
              ". First call weekly_summary for the last few weeks, training_load" +
              (maxHeartRate ? ` (maxHeartRate=${maxHeartRate})` : "") +
              ", and personal_records to understand where I'm starting from. Then propose a week-by-week mileage " +
              "and long-run progression, keeping weekly mileage increases modest (roughly 10% or less) and flagging " +
              "if the current training load is already elevated. Remind me this is a general plan, not personalized " +
              "coaching or medical advice.",
          },
        },
      ],
    })
  );
}
