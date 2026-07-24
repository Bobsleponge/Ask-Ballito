/**
 * Pick the right healthcare vertical from the user ask.
 * Never leave human medical asks on the broad "healthcare" family that used
 * to include vets — and never confuse doctor asks with veterinary care.
 */

const DENTIST_RE = /\b(dentist|dental|orthodont|teeth|tooth)\b/i;
const PHARMACY_RE = /\b(pharmac(?:y|ies)|chemist|dispensary|prescription)\b/i;
const OPTOMETRIST_RE =
  /\b(optometr|optician|eye\s*(test|exam|care)|glasses|contact\s*lenses)\b/i;
const PHYSIO_RE =
  /\b(physio(?:therapy|therapist)?|chiropract(?:or|ic)|biokinetic(?:s|ist)?)\b/i;
const HOSPITAL_RE =
  /\b(hospital|emergency\s*(room|care|medical|doctor)|urgent\s*care|A\s*&\s*E|\bER\b|netcare|mediclinic|trauma)\b/i;
const DOCTOR_RE =
  /\b(doctor|doctors|docotor|docters?|doctars?|doc(?:tor)?s?|gp\b|general\s*practi(?:ce|tioner)|physician|medical\s*(doctor|centre|center|clinic|care|attention|help)|family\s*(practice|doctor|gp)|clinic)\b/i;
const VET_RE =
  /\b(vet(?:erinar(?:y|ian))?|animal\s*(hospital|clinic|doctor)|pet\s*(emergency|hospital|clinic|doctor)|sick\s*(dog|cat|pet)|my\s*(dog|cat|pet))\b/i;

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
 * Exact vertical for healthcare workflow.
 * Defaults to "doctors" for ambiguous human medical asks.
 */
export function resolveHealthcareVerticalHint(
  message: string,
  draft?: {
    draftQueries?: string[];
    entities?: { businessTypes?: string[] };
  },
): string {
  const corpus = corpusFrom(message, draft);
  if (!corpus.trim()) return "doctors";

  if (VET_RE.test(corpus)) return "vets";
  if (DENTIST_RE.test(corpus)) return "dentists";
  if (PHARMACY_RE.test(corpus)) return "pharmacies";
  if (OPTOMETRIST_RE.test(corpus)) return "optometrists";
  if (PHYSIO_RE.test(corpus)) return "physio";
  if (HOSPITAL_RE.test(corpus)) return "hospitals";
  if (DOCTOR_RE.test(corpus)) return "doctors";

  return "doctors";
}
