import { siteConfig } from "@/config/site";

export function getAboutContent(cityName: string) {
  return {
    brand: siteConfig.name,
    headline: `Your local life,\nanswered.`,
    support: `The AI concierge for ${cityName} — restaurants, services, weekends, and the plans that take more than one search.`,
    heroCtaPrimary: "Ask something",
    heroCtaSecondary: "For businesses",
    howItWorks: {
      title: "A conversation, not a directory",
      support: "Say what you need. We figure out the rest.",
      steps: [
        {
          title: "Ask like a local",
          body: `Sushi tonight, a pharmacy now, or a full proposal plan in ${cityName} — no filters to fight.`,
        },
        {
          title: "We read the intent",
          body: "Quick tip, service find, or multi-stop plan — then we search real places nearby.",
        },
        {
          title: "Leave with a plan",
          body: "Open listings, compare options, and follow a checklist when the ask is bigger than one spot.",
        },
      ],
    },
    capabilities: {
      title: "Built for the asks that matter",
      support: `Everyday finds and the complicated ones — celebrations, errands, and life admin in ${cityName}.`,
      items: [
        {
          title: "Occasions",
          body: "Proposals, birthdays, anniversaries — venues, florists, cake, dinner, and the rest in one plan.",
          example: `Help me plan a proposal in ${cityName}`,
        },
        {
          title: "Multi-stop plans",
          body: "One ask, several moving pieces — grouped recommendations instead of ten open tabs.",
          example: "Plan a romantic evening with dinner and a view",
        },
        {
          title: "What’s on",
          body: "Weekend ideas and local events that match your mood, kids, or the weather.",
          example: "Fun things to do this weekend",
        },
        {
          title: "Services",
          body: "Pharmacies, clinics, trades, property — when the ask isn’t leisure at all.",
          example: "Nearest pharmacy open now",
        },
      ],
    },
    forLocals: {
      title: `Made for ${cityName}`,
      support:
        "Whether you live here or you’re just visiting — eat, explore, and organise the moments that matter.",
      points: [
        "Eat, coffee, beaches, and family plans",
        "Celebrate end-to-end — not just pick a venue",
        "Find services when you need them",
        "See what’s on without feed-scrolling",
      ],
    },
    forBusinesses: {
      title: "Show up when people decide",
      support:
        "Locals ask in natural language for dinners, photographers, florists, parties, and services. Claim your listing and meet that moment of intent.",
      points: [
        "Appear in recommendations and occasion plans",
        "Keep your listing accurate",
        "Highlight menus, offerings, and specials",
      ],
      cta: "Claim your business",
    },
    tryAsking: {
      title: "Try asking",
      support: "Tap one — we’ll open the concierge with that question.",
      prompts: [
        `Help me plan a proposal in ${cityName}`,
        "Kid-friendly birthday ideas with a cake and activities",
        "Best restaurants with a view for anniversary dinner",
        "Fun things to do this weekend",
        "Where can I get my car serviced?",
        `Nearest pharmacy in ${cityName}`,
      ],
    },
    closing: {
      title: `Ready for ${cityName}?`,
      support: "Skip the tab-hopping. Start a conversation.",
      cta: "Open Ask Ballito",
    },
  } as const;
}

export type AboutContent = ReturnType<typeof getAboutContent>;
