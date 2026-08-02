/**
 * Seed knowledge cards for common Ballito discovery asks.
 * Served deterministically when KNOWLEDGE_CARDS is enabled; refreshed by cron.
 */

export interface KnowledgeCardSeed {
  slug: string;
  title: string;
  queryClass: "DISCOVERY" | "BUSINESS_SEARCH" | "PLACE_SEARCH";
  matchPatterns: string[];
  searchQueries: string[];
  workflow:
    | "restaurants"
    | "activities"
    | "property"
    | "services"
    | "healthcare"
    | "accommodation"
    | "general";
  bodyTemplate: string;
  verticalHint?: string;
}

export const KNOWLEDGE_CARD_SEEDS: readonly KnowledgeCardSeed[] = [
  {
    slug: "best-breakfast",
    title: "Best breakfast in Ballito",
    queryClass: "DISCOVERY",
    matchPatterns: [
      "best breakfast",
      "breakfast near me",
      "breakfast in ballito",
      "where for breakfast",
    ],
    searchQueries: ["best breakfast Ballito", "breakfast cafe Ballito"],
    workflow: "restaurants",
    verticalHint: "cafes",
    bodyTemplate:
      "If you're after a proper Ballito breakfast, these are the spots locals keep recommending",
  },
  {
    slug: "best-beaches",
    title: "Best beaches near Ballito",
    queryClass: "DISCOVERY",
    matchPatterns: [
      "best beaches",
      "best beach",
      "beaches in ballito",
      "beach day",
      "which beach",
    ],
    searchQueries: [
      "Willard Beach Ballito",
      "Compensation Beach",
      "best beaches Ballito",
    ],
    workflow: "activities",
    verticalHint: "attractions",
    bodyTemplate:
      "For a beach day around Ballito, these are the stretches worth knowing — always check conditions and lifeguards",
  },
  {
    slug: "family-activities",
    title: "Family activities in Ballito",
    queryClass: "DISCOVERY",
    matchPatterns: [
      "family activities",
      "kids activities",
      "kid-friendly",
      "things to do with kids",
      "family friendly activities",
    ],
    searchQueries: [
      "family activities Ballito",
      "kids activities Ballito",
      "kid friendly Ballito",
    ],
    workflow: "activities",
    verticalHint: "attractions",
    bodyTemplate:
      "Looking for something the whole family will enjoy? These Ballito picks are a great start",
  },
  {
    slug: "coffee-shops",
    title: "Coffee shops in Ballito",
    queryClass: "DISCOVERY",
    matchPatterns: [
      "best coffee",
      "coffee shops",
      "cafe to work",
      "specialty coffee",
      "coffee near me",
    ],
    searchQueries: ["best coffee shops Ballito", "cafe wifi Ballito"],
    workflow: "restaurants",
    verticalHint: "cafes",
    bodyTemplate:
      "Need a good coffee in Ballito? These cafés are worth the stop",
  },
  {
    slug: "rainy-day",
    title: "Rainy day activities in Ballito",
    queryClass: "DISCOVERY",
    matchPatterns: [
      "rainy day",
      "indoor activities",
      "when it rains",
      "wet weather",
      "things to do indoors",
    ],
    searchQueries: [
      "indoor activities Ballito",
      "shopping Ballito",
      "cafes Ballito",
    ],
    workflow: "activities",
    verticalHint: "attractions",
    bodyTemplate:
      "When the weather turns, these covered Ballito options still make for a good day out",
  },
  {
    slug: "romantic-restaurants",
    title: "Romantic restaurants in Ballito",
    queryClass: "DISCOVERY",
    matchPatterns: [
      "romantic restaurant",
      "romantic dinner",
      "date night",
      "anniversary dinner",
    ],
    searchQueries: [
      "romantic restaurants Ballito",
      "date night Ballito",
      "fine dining Ballito",
    ],
    workflow: "restaurants",
    verticalHint: "restaurants",
    bodyTemplate:
      "Planning a date night? These Ballito restaurants set a lovely scene",
  },
  {
    slug: "dog-friendly",
    title: "Dog-friendly venues in Ballito",
    queryClass: "DISCOVERY",
    matchPatterns: [
      "dog friendly",
      "dog-friendly",
      "pet friendly",
      "bring my dog",
      "pets welcome",
    ],
    searchQueries: [
      "dog friendly Ballito",
      "pet friendly restaurants Ballito",
      "pet friendly cafes Ballito",
    ],
    workflow: "restaurants",
    verticalHint: "restaurants",
    bodyTemplate:
      "Bringing the dog along? These Ballito spots are usually pet-friendly — still worth confirming when you arrive",
  },
] as const;

export function matchKnowledgeCardSeed(
  message: string,
): KnowledgeCardSeed | null {
  const key = message.toLowerCase().replace(/[?!.,']/g, "").trim();
  for (const card of KNOWLEDGE_CARD_SEEDS) {
    for (const pattern of card.matchPatterns) {
      if (key.includes(pattern)) return card;
    }
  }
  return null;
}
