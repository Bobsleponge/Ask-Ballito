import { getCity } from "@/config/cities";
import { conversationService } from "@/services/ai/conversation.service";

async function main() {
  const city = getCity("ballito")!;
  const result = await conversationService.complete({
    city,
    message: "Anywhere nice for breakfast?",
    history: [
      { role: "user", content: "I'm staying in Salt Rock." },
      { role: "assistant", content: "Enjoy Salt Rock!" },
    ],
  });

  console.log("Workflow:", result.workflowId);
  console.log("Location ref:", result.plan.locationRef);
  console.log("Sticky used:", result.plan.diagnostics.stickyEntitiesUsed);
  console.log("Rules:", result.plan.diagnostics.rulesApplied);
  console.log(
    "Top:",
    result.businesses.slice(0, 4).map((b) => `${b.name} (${b.score})`),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
