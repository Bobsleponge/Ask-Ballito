/**
 * Pick the right services vertical from the user ask.
 * Never default every service ask to plumbers/electricians.
 */

import { detectTradeKind, type TradeKind } from "./trade-query";
import { isAutoProtectionAsk } from "./auto-protection-intent";
import { isAutoPartsAsk } from "./auto-parts-intent";
import { isMusicInstrumentAsk } from "./music-intent";

const TRADE_VERTICAL: Partial<Record<TradeKind, string>> = {
  plumber: "plumbers",
  electrician: "electricians",
  locksmith: "locksmiths",
  handyman: "handyman",
  hvac: "hvac",
  fabricator: "fabrication",
  tow: "automotive",
};

const BEAUTY_RE =
  /\b(hair|salon|balayage|ombr[eé]|nails?|manicure|pedicure|beautician|spa|massage|barber|keratin)\b/i;

const FABRICATION_RE =
  /\b(weld(?:er|ing)?|fabricat(?:e|ion|or)s?|metalwork|metal\s*work|boilermaker|steel\s*work|custom\s*fab|trailer(\s*(repair|fab|fabrication|build|mod))?|panel\s*beat(?:er|ing)?)\b/i;

const AUTOMOTIVE_RE =
  /\b(mechanic|automotive|auto\s*(repair|service|body|parts?)|car\s*(repair|service|wash|batter(?:y|ies)|parts?)|tow(\s*truck)?|towing|tyre|tire|windscreen|roadside|ppf|paint\s*protection|car\s*wrap|vehicle\s*wrap|window\s*tint|ceramic\s*coat|auto\s*detail|car\s*detail|jump\s*start)\b/i;

const FITNESS_RE =
  /\b(gym|fitness|personal\s*train|pilates|yoga\s*studio|crossfit)\b/i;

const CLEANING_RE =
  /\b(cleaners?|cleaning\s*services?|house\s*clean|deep\s*clean|domestic\s*worker)\b/i;

const POOL_RE = /\b(pool\s*(clean|service|maintenance|repair)|swimming\s*pool)\b/i;

const LANDSCAPE_RE =
  /\b(landscap(?:e|er|ing)|garden(?:er|ing)|lawn\s*(care|mow)|tree\s*felling)\b/i;

const PEST_RE = /\b(pest\s*control|fumigat|termite|cockroach|rodent)\b/i;

const CONTRACTOR_RE =
  /\b(builder|building\s*contractor|renovation|painter|painting\s*contractor|tiler|carpenter)\b/i;

const PROPERTY_RE =
  /\b(estate\s*agent|real\s*estate|property\s*(agent|sales|letting|rental)|letting\s*agent)\b/i;

const SECURITY_RE =
  /\b(security\s*company|armed\s*response|alarm\s*system|cctv|security\s*guard)\b/i;

const TELECOM_RE =
  /\b(fibre|fiber|internet\s*provider|wifi\s*install|broadband|telecom)\b/i;

const MOVERS_RE =
  /\b(movers?|removals?|furniture\s*removal|relocation\s*company)\b/i;

const LEGAL_RE =
  /\b(attorney|lawyer|conveyanc|legal\s*advice|law\s*firm)\b/i;

const ACCOUNTANT_RE =
  /\b(accountants?|bookkeepers?|tax\s*(advisor|consultant|practitioner)|auditor)\b/i;

const MUSIC_RE =
  /\b(guitar|ukulele|violin|piano|drum(?:s|kit)?|restring(?:ing)?|music\s*(shop|store|lesson)|instrument\s*(repair|shop|store)|luthier|guitar\s*(shop|store|repair))\b/i;

const PHYSIO_RE =
  /\b(physio(?:therapy|therapist)?|chiropract(?:or|ic)|biokinetic(?:s|ist)?|sports\s*physio)\b/i;

const TRAVEL_RE =
  /\b(travel\s*agent|tour\s*operator|book\s*(a\s+)?(flight|holiday|tour)|holiday\s*package)\b/i;

const CAR_RENTAL_RE =
  /\b(car\s*(rental|hire)|rent\s*a\s*car|shuttle|airport\s*transfer|taxi\s*service)\b/i;

const ENTERTAINMENT_RE =
  /\b(cinema|movie\s*theatre|movies?|karting|go[- ]?kart|entertainment\s*centre|arcade)\b/i;

const CLOTHING_RE =
  /\b(clothing\s*store|fashion\s*boutique|where\s+(?:can|to)\s+(?:i|we)\s+buy\s+(?:clothes|clothing|dress|jeans))\b/i;

const FOOTWEAR_RE =
  /\b(shoe\s*store|footwear|buy\s+(?:shoes|sneakers|boots)|sneaker\s*shop)\b/i;

const JEWELLERY_RE = /\b(jewell?ery|jeweller|buy\s+(?:a\s+)?(?:ring|necklace|watch))\b/i;

const INSURANCE_RE =
  /\b(insurance\s*(broker|agent|advisor)?|financial\s*advisor|wealth\s*manager|short[- ]?term\s*insurance)\b/i;

const DEALERSHIP_RE =
  /\b(car\s*dealership|vehicle\s*sales|buy\s*a\s*car|used\s*car\s*dealer|new\s*car\s*dealer)\b/i;

const SOLAR_RE =
  /\b(solar\s*(pv|panel|install)|inverter\s*install|backup\s*power\s*solar)\b/i;

const HOSPITAL_RE =
  /\b(hospital|emergency\s*room|ER\b|A\s*&\s*E|urgent\s*care|netcare|mediclinic)\b/i;

const DOCTOR_RE =
  /\b(doctor|doctors|gp\b|general\s*practi(?:ce|tioner)|physician|medical\s*(doctor|centre|center|clinic|care|attention)|family\s*(practice|doctor|gp)|clinic)\b/i;

const DENTIST_RE = /\b(dentist|dental|orthodont)\b/i;

const PHARMACY_RE = /\b(pharmac(?:y|ies)|chemist)\b/i;

const VET_RE =
  /\b(vet(?:erinar(?:y|ian))?|animal\s*(hospital|clinic)|pet\s*(emergency|hospital|clinic))\b/i;

const PHOTO_RE =
  /\b(photographer|photography\s*studio|photo\s*(shoot|session)|wedding\s*photographer)\b/i;

const EVENTS_RE =
  /\b(wedding\s*venue|conference\s*venue|function\s*venue|event\s*planner|wedding\s*planner)\b/i;

const GOLF_RE = /\b(golf\s*(club|course|lesson)|driving\s*range)\b/i;

const GARDEN_CENTRE_RE =
  /\b(garden\s*centre|garden\s*center|plant\s*nursery|nursery\s*plants)\b/i;

const BLINDS_RE =
  /\b(blinds|flooring|laminate|curtains?|carpet\s*fitting)\b/i;

const PAINT_RE = /\b(paint\s*shop|paint\s*supplier|decor\s*supplier|dulux|plascon)\b/i;

const APPLIANCE_RE =
  /\b(appliance\s*repair|washing\s*machine\s*repair|fridge\s*repair|oven\s*repair|dishwasher\s*repair)\b/i;

const AUTO_PARTS_RE =
  /\b(auto\s*parts|car\s*spares|car\s*batter(?:y|ies)|windscreen|car\s*glass|spare\s*parts)\b/i;

const TATTOO_RE = /\b(tattoo|piercing\s*studio|body\s*piercing)\b/i;

const PET_GROOM_RE =
  /\b(pet\s*groom|dog\s*groom|dog\s*walking|pet\s*sitter|grooming\s*parlour)\b/i;

const STORAGE_RE = /\b(self[- ]?storage|mini[- ]?storage|storage\s*unit)\b/i;

const SKIP_RE =
  /\b(skip\s*hire|waste\s*removal|rubbish\s*removal|mini\s*skip)\b/i;

const ARCHITECT_RE =
  /\b(architect|structural\s*engineer|draughts(?:man|person)|building\s*plans)\b/i;

const BOOKS_RE = /\b(bookstore|book\s*shop|exclusive\s*books|buy\s*books)\b/i;

const FUNERAL_RE = /\b(funeral\s*(home|service)|undertaker)\b/i;

const SHOE_REPAIR_RE =
  /\b(shoe\s*repair|cobbler|key\s*cutting|cut\s*keys)\b/i;

const EMPLOYMENT_RE =
  /\b(employment\s*agency|recruitment\s*agency|staffing\s*agency|job\s*agency)\b/i;

const DEBT_RE =
  /\b(debt\s*collect|collection\s*agency|credit\s*recovery)\b/i;

const FARM_RE =
  /\b(farm\s*supplies|agricultural\s*store|animal\s*feed\s*supplier)\b/i;

function corpusFrom(
  message: string,
  draft?: {
    draftQueries?: string[];
    entities?: { businessTypes?: string[] };
  },
): string {
  return [
    message,
    ...(draft?.draftQueries ?? []),
    ...(draft?.entities?.businessTypes ?? []),
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Vertical hint for the services workflow, or null = no hard vertical filter.
 * Null is intentional for generic asks so one trade cannot dominate.
 */
export function resolveServicesVerticalHint(
  message: string,
  draft?: {
    draftQueries?: string[];
    entities?: { businessTypes?: string[] };
  },
): string | null {
  const corpus = corpusFrom(message, draft);
  if (!corpus.trim()) return null;

  // Dedicated intents win before broad automotive/beauty patterns.
  if (isAutoProtectionAsk(message) || isAutoProtectionAsk(corpus)) {
    return "automotive";
  }
  if (isAutoPartsAsk(message) || isAutoPartsAsk(corpus)) {
    return "auto-parts";
  }
  if (isMusicInstrumentAsk(message) || isMusicInstrumentAsk(corpus)) {
    return "music-instruments";
  }

  if (BEAUTY_RE.test(corpus)) return "spas";
  if (FABRICATION_RE.test(corpus)) return "fabrication";
  if (AUTOMOTIVE_RE.test(corpus)) return "automotive";
  if (FITNESS_RE.test(corpus)) return "fitness";
  if (CLEANING_RE.test(corpus)) return "cleaning";
  if (POOL_RE.test(corpus)) return "pool-services";
  if (LANDSCAPE_RE.test(corpus)) return "landscaping";
  if (PEST_RE.test(corpus)) return "pest-control";
  if (CONTRACTOR_RE.test(corpus)) return "contractors";
  if (PROPERTY_RE.test(corpus)) return "property";
  if (SECURITY_RE.test(corpus)) return "security";
  if (TELECOM_RE.test(corpus)) return "telecom";
  if (MOVERS_RE.test(corpus)) return "movers";
  if (LEGAL_RE.test(corpus)) return "legal";
  if (ACCOUNTANT_RE.test(corpus)) return "accountants";
  if (MUSIC_RE.test(corpus)) return "music-instruments";
  if (PHYSIO_RE.test(corpus)) return "physio";
  if (TRAVEL_RE.test(corpus)) return "travel";
  if (CAR_RENTAL_RE.test(corpus)) return "car-rental";
  if (ENTERTAINMENT_RE.test(corpus)) return "entertainment";
  if (CLOTHING_RE.test(corpus)) return "clothing";
  if (FOOTWEAR_RE.test(corpus)) return "footwear";
  if (JEWELLERY_RE.test(corpus)) return "jewellery";
  if (INSURANCE_RE.test(corpus)) return "insurance";
  if (DEALERSHIP_RE.test(corpus)) return "car-dealerships";
  if (SOLAR_RE.test(corpus)) return "solar";
  if (VET_RE.test(corpus)) return "vets";
  if (DENTIST_RE.test(corpus)) return "dentists";
  if (PHARMACY_RE.test(corpus)) return "pharmacies";
  if (HOSPITAL_RE.test(corpus)) return "hospitals";
  if (DOCTOR_RE.test(corpus)) return "doctors";
  if (PHOTO_RE.test(corpus)) return "photography";
  if (EVENTS_RE.test(corpus)) return "events";
  if (GOLF_RE.test(corpus)) return "golf";
  if (GARDEN_CENTRE_RE.test(corpus)) return "garden-centres";
  if (BLINDS_RE.test(corpus)) return "blinds-flooring";
  if (PAINT_RE.test(corpus)) return "paint";
  if (APPLIANCE_RE.test(corpus)) return "appliance-repair";
  if (AUTO_PARTS_RE.test(corpus)) return "auto-parts";
  if (TATTOO_RE.test(corpus)) return "tattoo";
  if (PET_GROOM_RE.test(corpus)) return "pet-grooming";
  if (STORAGE_RE.test(corpus)) return "storage";
  if (SKIP_RE.test(corpus)) return "skip-hire";
  if (ARCHITECT_RE.test(corpus)) return "architects";
  if (BOOKS_RE.test(corpus)) return "books";
  if (FUNERAL_RE.test(corpus)) return "funeral";
  if (SHOE_REPAIR_RE.test(corpus)) return "shoe-repair";
  if (EMPLOYMENT_RE.test(corpus)) return "employment";
  if (DEBT_RE.test(corpus)) return "debt-collection";
  if (FARM_RE.test(corpus)) return "farm-supplies";

  const kind = detectTradeKind(corpus);
  if (kind) return TRADE_VERTICAL[kind] ?? null;

  return null;
}
