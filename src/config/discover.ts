/**
 * Curated discover content for the city homepage hero + rail.
 * APIs fall back to these seeds when live data is thin.
 */

export type DiscoverIconId =
  | "utensils"
  | "waves"
  | "users"
  | "coffee"
  | "home"
  | "cross"
  | "sparkles"
  | "calendar"
  | "map"
  | "briefcase"
  | "cloud"
  | "bookmark"
  | "bell";

export interface SuggestionCard {
  id: string;
  title: string;
  subtitle?: string;
  prompt: string;
  icon: DiscoverIconId;
}

export interface DiscoverCategory {
  id: string;
  label: string;
  prompt: string;
  icon: DiscoverIconId;
}

export interface SeedTrendingItem {
  query: string;
}

export const SUGGESTION_CARDS: readonly SuggestionCard[] = [
  {
    id: "breakfast",
    title: "Best breakfast near me",
    subtitle: "Cafés & morning spots",
    prompt: "Best breakfast near me in Ballito",
    icon: "utensils",
  },
  {
    id: "weekend",
    title: "Things to do this weekend",
    subtitle: "Local plans & outings",
    prompt: "Fun things to do this weekend in Ballito",
    icon: "waves",
  },
  {
    id: "kids",
    title: "Activities for kids",
    subtitle: "Family-friendly ideas",
    prompt: "Kid-friendly activities in Ballito",
    icon: "users",
  },
  {
    id: "coffee",
    title: "Best coffee shops",
    subtitle: "Work-friendly & specialty",
    prompt: "Best coffee shops to work from in Ballito",
    icon: "coffee",
  },
  {
    id: "property",
    title: "Property for sale",
    subtitle: "Homes & agents",
    prompt: "Property for sale in Ballito",
    icon: "home",
  },
  {
    id: "pharmacy",
    title: "Nearest pharmacy",
    subtitle: "Open now if possible",
    prompt: "Nearest pharmacy in Ballito",
    icon: "cross",
  },
  {
    id: "proposal",
    title: "Plan a proposal",
    subtitle: "Ring, florist, photographer & more",
    prompt: "Help me plan a proposal in Ballito",
    icon: "sparkles",
  },
] as const;

export const DISCOVER_CATEGORIES: readonly DiscoverCategory[] = [
  {
    id: "eat",
    label: "Eat",
    prompt: "Best restaurants in Ballito right now",
    icon: "utensils",
  },
  {
    id: "beach",
    label: "Beach",
    prompt: "Best beaches and beach clubs in Ballito",
    icon: "waves",
  },
  {
    id: "kids",
    label: "Kids",
    prompt: "Family-friendly activities for kids in Ballito",
    icon: "users",
  },
  {
    id: "coffee",
    label: "Coffee",
    prompt: "Best coffee shops in Ballito",
    icon: "coffee",
  },
  {
    id: "property",
    label: "Property",
    prompt: "Estate agents and property for sale in Ballito",
    icon: "home",
  },
  {
    id: "health",
    label: "Health",
    prompt: "Pharmacies, clinics, and health services in Ballito",
    icon: "cross",
  },
] as const;

export const SEED_TRENDING: readonly SeedTrendingItem[] = [
  { query: "Best coffee shops to work from" },
  { query: "Family-friendly restaurants with a view" },
  { query: "Fun things to do this weekend" },
  { query: "Sushi places open now" },
  { query: "Romantic dinner spots for date night" },
  { query: "Help me plan a proposal in Ballito" },
  { query: "Where can I get my car serviced?" },
] as const;

/** Legacy flat prompts for command menu compatibility. */
export const SUGGESTION_PROMPTS = [
  ...SUGGESTION_CARDS.map((c) => c.prompt),
  ...SEED_TRENDING.map((t) => t.query),
] as const;

export interface FutureNavItem {
  id: string;
  label: string;
  icon: DiscoverIconId;
  comingSoon?: boolean;
}

export const FUTURE_NAV_ITEMS: readonly FutureNavItem[] = [
  { id: "saved", label: "Saved places", icon: "bookmark", comingSoon: true },
  { id: "jobs", label: "Jobs", icon: "briefcase", comingSoon: true },
  { id: "weather", label: "Weather", icon: "cloud", comingSoon: true },
  {
    id: "notifications",
    label: "Notifications",
    icon: "bell",
    comingSoon: true,
  },
] as const;
