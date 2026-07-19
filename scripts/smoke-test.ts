/**
 * End-to-end smoke test for Planner v2 orchestration.
 *
 * Usage:
 *   npm run smoke -- "where can I get great coffee with my laptop?"
 */
import { getCity } from "@/config/cities";
import { conversationService } from "@/services/ai/conversation.service";

async function main() {
  const message =
    process.argv.slice(2).join(" ") ||
    "Where can I get a great family dinner with an ocean view?";

  const city = getCity("ballito")!;
  console.log(`> ${message}\n`);

  const { plan, workflowId, businesses, llmInvoked, clarification, text } =
    await conversationService.complete({
      city,
      message,
    });

  console.log("Workflow:", workflowId);
  console.log("Response mode:", plan.responseMode);
  console.log("LLM invoked:", llmInvoked);
  console.log("Clarification:", clarification);
  console.log("Goal:", plan.goal);
  console.log(
    "Execution:",
    plan.executionPlan.map((s) => `${s.capability}:${s.id}`),
  );
  console.log("Location ref:", plan.locationRef);
  console.log("Rules:", plan.diagnostics.rulesApplied);
  console.log(
    "\nRanked businesses:",
    businesses.map((b) => `${b.name} (score ${b.score ?? 0})`),
  );
  console.log("\nAnswer:\n", text);
}

main().catch((err) => {
  console.error("Smoke test failed:", err);
  process.exit(1);
});
