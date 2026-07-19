export const siteConfig = {
  name: "Ask Ballito",
  shortName: "Ask Ballito",
  description:
    "Your AI concierge for local businesses, recommendations, and things to do — starting in Ballito and expanding across South Africa.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  tagline: "Ask anything. Discover local.",
} as const;

export type SiteConfig = typeof siteConfig;
