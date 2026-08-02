/**
 * Deterministic pattern banks for the query classifier.
 * Order within each bank matters: first match wins for that class.
 */

export interface ClassPattern {
  id: string;
  re: RegExp;
  confidence: number;
  workflow?:
    | "restaurants"
    | "activities"
    | "property"
    | "services"
    | "healthcare"
    | "accommodation"
    | "relocation"
    | "special_occasion"
    | "general"
    | "emergency";
  queries?: string[];
  businessTypes?: string[];
  cuisines?: string[];
}

export const FACT_PATTERNS: ClassPattern[] = [
  {
    id: "fact_what_is",
    re: /\b(what is ask ballito|how does (this|ask ballito) work|who (are|made) you|what can you (do|help))\b/i,
    confidence: 0.95,
    workflow: "general",
  },
  {
    id: "fact_hours_meta",
    re: /\b(what (are|is) your (hours|name)|are you (a bot|ai|human))\b/i,
    confidence: 0.9,
    workflow: "general",
  },
];

export const LIVE_PATTERNS: ClassPattern[] = [
  {
    id: "live_weather",
    re: /\b(weather|forecast|will it rain|temperature|how hot|how cold|rain(ing)? today|sunny today)\b/i,
    confidence: 0.92,
    workflow: "activities",
    queries: ["indoor activities Ballito", "cafes Ballito"],
    businessTypes: ["attraction", "cafe"],
  },
  {
    id: "live_open_now_generic",
    re: /\b(what('?s| is) open (now|tonight|late)|places open now)\b/i,
    confidence: 0.88,
    workflow: "restaurants",
    queries: ["restaurants open now Ballito", "cafes open now Ballito"],
    businessTypes: ["restaurant", "cafe"],
  },
];

export const EVENT_PATTERNS: ClassPattern[] = [
  {
    id: "event_search",
    re: /\b(events? (this|tonight|today|weekend|in ballito)|what('?s| is) (on|happening)|live music (tonight|this weekend)|markets?( this| tonight| in ballito)?|festival)\b/i,
    confidence: 0.9,
    workflow: "activities",
    queries: ["events Ballito", "live music Ballito", "markets Ballito"],
    businessTypes: ["event", "attraction"],
  },
];

export const PLANNING_PATTERNS: ClassPattern[] = [
  {
    id: "plan_itinerary",
    re: /\b(plan (a |my |our )?(day|weekend|trip|itinerary|proposal|party|celebration)|itinerary|schedule (a|my|our)|help me plan)\b/i,
    confidence: 0.93,
    workflow: "special_occasion",
  },
  {
    id: "plan_weekend",
    re: /\b(things to do (this|the) weekend|weekend (plans?|ideas?|getaway))\b/i,
    confidence: 0.88,
    workflow: "activities",
    queries: ["weekend activities Ballito", "things to do Ballito"],
    businessTypes: ["attraction"],
  },
];

export const COMPARISON_PATTERNS: ClassPattern[] = [
  {
    id: "compare",
    re: /\b(compare|versus|\bvs\.?\b|which is better|difference between|pros and cons)\b/i,
    confidence: 0.9,
    workflow: "general",
  },
];

export const DISCOVERY_PATTERNS: ClassPattern[] = [
  {
    id: "disc_breakfast",
    re: /\b(best )?breakfast\b/i,
    confidence: 0.92,
    workflow: "restaurants",
    queries: ["best breakfast Ballito", "breakfast cafe Ballito"],
    businessTypes: ["cafe", "restaurant"],
    cuisines: ["breakfast"],
  },
  {
    id: "disc_beaches",
    re: /\b(best )?beaches?\b|\bbeach (day|spots?|recommendations?)\b/i,
    confidence: 0.93,
    workflow: "activities",
    queries: ["best beaches Ballito", "Willard Beach", "Compensation Beach"],
    businessTypes: ["beach", "attraction"],
  },
  {
    id: "disc_family",
    re: /\b(family(-|\s)?friendly|kids?|children|toddler)\b.*\b(activit|things to do|outings?|fun)\b|\b(activit|things to do).*\b(kids?|family|children)\b|\bfamily activities\b/i,
    confidence: 0.91,
    workflow: "activities",
    queries: ["family activities Ballito", "kids activities Ballito"],
    businessTypes: ["attraction"],
  },
  {
    id: "disc_coffee",
    re: /\b(best )?coffee( shops?)?\b|\bcafe(s)? (to work|with wifi|specialty)\b/i,
    confidence: 0.92,
    workflow: "restaurants",
    queries: ["best coffee shops Ballito", "cafe wifi Ballito"],
    businessTypes: ["cafe"],
  },
  {
    id: "disc_rainy",
    re: /\b(rainy day|indoor activities|when it rains|wet weather)\b/i,
    confidence: 0.91,
    workflow: "activities",
    queries: ["indoor activities Ballito", "rainy day Ballito"],
    businessTypes: ["attraction", "shopping"],
  },
  {
    id: "disc_romantic",
    re: /\b(romantic (dinner|restaurant|restaurants|spot)|date night|anniversary dinner)\b/i,
    confidence: 0.92,
    workflow: "restaurants",
    queries: ["romantic restaurants Ballito", "date night Ballito"],
    businessTypes: ["restaurant"],
  },
  {
    id: "disc_dog",
    re: /\b(dog(-|\s)?friendly|pets? (allowed|welcome)|bring (my|the) dog)\b/i,
    confidence: 0.91,
    workflow: "restaurants",
    queries: ["dog friendly Ballito", "pet friendly restaurants Ballito"],
    businessTypes: ["restaurant", "cafe"],
  },
];

export const PLACE_PATTERNS: ClassPattern[] = [
  {
    id: "place_near",
    re: /\b(near|closest|nearest|around)\b.+\b(beach|mall|ballito junction|willard|compensation|zimbali|salt rock)\b/i,
    confidence: 0.88,
    workflow: "restaurants",
    queries: ["places near me Ballito"],
  },
  {
    id: "place_hotel",
    re: /\b(hotel|airbnb|accommodation|place to stay|self[- ]catering|bnb|guest house)\b/i,
    confidence: 0.9,
    workflow: "accommodation",
    queries: ["hotels Ballito", "accommodation Ballito"],
    businessTypes: ["lodging", "hotel"],
  },
  {
    id: "place_property",
    re: /\b(property (for sale|to rent)|houses? (for sale|to rent)|estate agents?|buy(ing)? (a )?(house|home|apartment))\b/i,
    confidence: 0.91,
    workflow: "property",
    queries: ["property for sale Ballito", "estate agents Ballito"],
    businessTypes: ["real_estate_agency"],
  },
];

export const BUSINESS_PATTERNS: ClassPattern[] = [
  {
    id: "biz_restaurant",
    re: /\b(restaurant|dinner|lunch|brunch|sushi|pizza|steak|seafood|burger|thai|indian|italian|mexican|tapas|fine dining|where (to|can i) eat|ramen|poke|vegan|halal|wings|ribs|tacos|gelato|smoothie|craft beer|braai|peri\s*peri)\b/i,
    confidence: 0.9,
    workflow: "restaurants",
    queries: ["restaurants Ballito"],
    businessTypes: ["restaurant"],
  },
  {
    id: "biz_cafe",
    re: /\b(cafe|café|bakery|brunch spot|\bcoffee\b)\b/i,
    confidence: 0.9,
    workflow: "restaurants",
    queries: ["cafes Ballito", "coffee Ballito"],
    businessTypes: ["cafe"],
  },
  {
    id: "biz_bar",
    re: /\b(bar|cocktails?|drinks|pub|sunset drinks|wine bar|rooftop)\b/i,
    confidence: 0.9,
    workflow: "restaurants",
    queries: ["bars Ballito", "cocktails Ballito"],
    businessTypes: ["bar"],
  },
  {
    id: "biz_healthcare",
    re: /\b(doctor|gp|dentist|pharmacy|hospital|clinic|physio|optometrist|medical)\b/i,
    confidence: 0.92,
    workflow: "healthcare",
    queries: ["doctors Ballito"],
    businessTypes: ["doctor"],
  },
  {
    id: "biz_vet",
    re: /\b(vet|veterinary|animal hospital|pet emergency)\b/i,
    confidence: 0.93,
    workflow: "healthcare",
    queries: ["veterinary Ballito", "emergency vet Ballito"],
    businessTypes: ["veterinary_care"],
  },
  {
    id: "biz_trade",
    re: /\b(plumber|electrician|locksmith|tow(ing)?|handyman|geyser|burst pipe|blocked drain|panel\s*beat|tyre|car\s*wash|gate\s*motor|alarm\s*technician)\b/i,
    confidence: 0.94,
    workflow: "services",
    queries: ["plumber Ballito"],
    businessTypes: ["plumber"],
  },
  {
    id: "biz_beauty",
    re: /\b(hair(cut| salon)?|nails?|gel nails|balayage|beauty|spa|massage|barber)\b/i,
    confidence: 0.91,
    workflow: "services",
    queries: ["hair salon Ballito", "nail salon Ballito"],
    businessTypes: ["beauty_salon", "hair_care"],
  },
  {
    id: "biz_local_service",
    re: /\b(cleaning|laundry|dry\s*cleaning|pet\s*grooming|dog\s*walker|photographer|florist|catering|\bdj\b|wedding\s*planner|removals?|storage|courier|printing)\b/i,
    confidence: 0.88,
    workflow: "services",
    queries: ["services Ballito"],
    businessTypes: ["store"],
  },
  {
    id: "biz_shopping",
    re: /\b(buy|where (to|can i) (get|buy|find)|shop for|store for)\b/i,
    confidence: 0.86,
    workflow: "services",
    queries: ["shops Ballito"],
    businessTypes: ["store"],
  },
  {
    id: "biz_activity",
    re: /\b(activities|things to do|attraction|surf|paddle|kayak|golf|gym|yoga|hike|padel|tennis|hiking|cycling|boat|fishing|diving|cinema|bowling|escape\s*room|trampoline|whale)\b/i,
    confidence: 0.88,
    workflow: "activities",
    queries: ["activities Ballito"],
    businessTypes: ["attraction"],
  },
  {
    id: "biz_near_place",
    re: /\b(near|closest|nearest|around)\b.+\b(ballito|salt rock|zimbali|beach|mall|junction)\b/i,
    confidence: 0.86,
    workflow: "restaurants",
    queries: ["places near Ballito"],
  },
  {
    id: "biz_best_of",
    re: /\b(best|top|recommend(ed)?|good)\b.+\b(in ballito|near me|around here)\b/i,
    confidence: 0.85,
    workflow: "general",
    queries: ["best places Ballito"],
  },
];

export const CONVERSATION_PATTERNS: ClassPattern[] = [
  {
    id: "conv_greeting",
    re: /^(hi|hello|hey|good (morning|afternoon|evening)|thanks|thank you|ok|okay|cool|cheers)[\s!.]*$/i,
    confidence: 0.95,
    workflow: "general",
  },
  {
    id: "conv_followup",
    re: /^(more|another|something else|what else|any others?|show me more)[\s!.?]*$/i,
    confidence: 0.85,
    workflow: "general",
  },
];

/** Exact discover-card prompts → high-confidence discovery. */
export const DISCOVER_PROMPT_EXACT: Array<{
  prompt: string;
  patternId: string;
  workflow: ClassPattern["workflow"];
  queries: string[];
  businessTypes: string[];
}> = [
  {
    prompt: "best breakfast near me in ballito",
    patternId: "discover_card_breakfast",
    workflow: "restaurants",
    queries: ["best breakfast Ballito", "breakfast cafe Ballito"],
    businessTypes: ["cafe", "restaurant"],
  },
  {
    prompt: "fun things to do this weekend in ballito",
    patternId: "discover_card_weekend",
    workflow: "activities",
    queries: ["weekend activities Ballito", "things to do Ballito"],
    businessTypes: ["attraction"],
  },
  {
    prompt: "kid-friendly activities in ballito",
    patternId: "discover_card_kids",
    workflow: "activities",
    queries: ["kids activities Ballito", "family activities Ballito"],
    businessTypes: ["attraction"],
  },
  {
    prompt: "best coffee shops to work from in ballito",
    patternId: "discover_card_coffee",
    workflow: "restaurants",
    queries: ["best coffee shops Ballito", "cafe wifi Ballito"],
    businessTypes: ["cafe"],
  },
  {
    prompt: "property for sale in ballito",
    patternId: "discover_card_property",
    workflow: "property",
    queries: ["property for sale Ballito", "estate agents Ballito"],
    businessTypes: ["real_estate_agency"],
  },
  {
    prompt: "nearest pharmacy in ballito",
    patternId: "discover_card_pharmacy",
    workflow: "healthcare",
    queries: ["pharmacy Ballito", "chemist Ballito"],
    businessTypes: ["pharmacy"],
  },
  {
    prompt: "help me plan a proposal in ballito",
    patternId: "discover_card_proposal",
    workflow: "special_occasion",
    queries: ["proposal Ballito", "romantic restaurants Ballito"],
    businessTypes: ["restaurant", "florist"],
  },
];
