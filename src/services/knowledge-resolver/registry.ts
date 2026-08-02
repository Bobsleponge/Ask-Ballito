import { emergencyPlugin } from "./plugins/emergency.plugin";
import { faqPlugin } from "./plugins/faq.plugin";
import { weatherPlugin } from "./plugins/weather.plugin";
import { knowledgeCardPlugin } from "./plugins/knowledge-card.plugin";
import type { KnowledgeResolverPlugin } from "./types";

/**
 * Fixed order: cheapest structured facts first, discovery cards last.
 * Add future plugins here — do not change conversation.service.
 */
export const KNOWLEDGE_RESOLVER_PLUGINS: KnowledgeResolverPlugin[] = [
  emergencyPlugin,
  faqPlugin,
  weatherPlugin,
  knowledgeCardPlugin,
];
