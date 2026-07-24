/**
 * True crises vs after-hours trades.
 * "Emergency plumber" / "24 hour electrician" must NOT trigger emergency contacts.
 * "Doctor open now" must NOT be treated as a trade / call-out ask.
 */

const TRUE_EMERGENCY_RE =
  /\b(ambulance|paramedic|heart\s*attack|stroke|unconscious|not\s*breathing|overdose|suicide|self[\s-]?harm|stabbing|gunshot|fire\s*brigade|house\s*(is\s*)?on\s*fire|break[\s-]?in|home\s*invasion|assault|bleeding\s*(heavily|out)|choking|drowning|police\s*(help|now|emergency)|call\s*(the\s*)?cops)\b/i;

const TRADE_SERVICE_RE =
  /\b(plumber|plumbing|electrician|electrical|locksmith|tow(\s*truck)?|towing|boiler|geyser|blocked\s*drain|burst\s*pipe|power\s*outage|no\s*power|keys?\s*locked|car\s*won'?t\s*start|flat\s*battery|tyre|tire\s*change|hvac|air[\s-]?con|generator|gate\s*motor|alarm\s*technician|handyman|weld(?:er|ing)?|fabricat(?:e|ion|or)|metalwork|trailer|panel\s*beat(?:er|ing)?|boilermaker)\b/i;

/** 24hr / 24 hour / 24/7 and similar shorthand. */
export const TWENTY_FOUR_HOUR_RE =
  /\b(24\s*\/?\s*7|24[\s-]?h(?:r|ours?)?s?|24\s*hours?)\b/i;

/** After-hours / call-out wording for trades — NOT bare "open now". */
const AFTER_HOURS_RE =
  /\b(after[\s-]?hours|emergency\s+(plumber|electrician|locksmith|tow)|urgent\s+(plumber|electrician|locksmith)|call[\s-]?out|tonight)\b/i;

/** Hours urgency that applies to medical and leisure as well as trades. */
const OPEN_NOW_RE = /\b(open\s*now|open\s*late|still\s*open)\b/i;

/** Human medical care (not veterinary). Includes common doctor typos. */
const HUMAN_MEDICAL_RE =
  /\b(doctor|doctors|docotor|docters?|doctars?|doc(?:tor)?s?|gp\b|general\s*practi(?:ce|tioner)|physician|medical\s*(doctor|centre|center|clinic|care|attention|help|emergency)|family\s*(practice|doctor|gp)|clinic|hospital|urgent\s*care|emergency\s*(room|medical|care|doctor)|A\s*&\s*E|\bER\b|netcare|mediclinic|paramedic|ambulance)\b/i;

/** Explicit pet / veterinary ask — must stay on vets, not human doctors. */
const PET_VET_RE =
  /\b(vet(?:erinar(?:y|ian))?|animal\s*(hospital|clinic|doctor)|pet\s*(emergency|hospital|clinic|doctor)|sick\s*(dog|cat|pet)|my\s*(dog|cat|pet))\b/i;

/** True when the message implies after-hours / 24hr / urgent call-out. */
export function isAfterHoursWording(message: string): boolean {
  const text = message.trim();
  if (!text) return false;
  return TWENTY_FOUR_HOUR_RE.test(text) || AFTER_HOURS_RE.test(text);
}

/** User asked for places that are open now / late (any vertical). */
export function isOpenNowWording(message: string): boolean {
  const text = message.trim();
  if (!text) return false;
  return (
    OPEN_NOW_RE.test(text) ||
    TWENTY_FOUR_HOUR_RE.test(text) ||
    AFTER_HOURS_RE.test(text)
  );
}

/** Human medical care ask (excludes explicit vet/pet wording). */
export function isHumanMedicalAsk(message: string): boolean {
  const text = message.trim();
  if (!text) return false;
  if (isPetVetAsk(text)) return false;
  return HUMAN_MEDICAL_RE.test(text);
}

export function isPetVetAsk(message: string): boolean {
  return PET_VET_RE.test(message.trim());
}

/**
 * Message is a trade / repair / tow ask.
 * After-hours wording alone ("open now") is NOT enough — that used to hijack
 * "doctor open now" into unfiltered emergency call-out search.
 */
export function isTradeOrAfterHoursServiceAsk(message: string): boolean {
  const text = message.trim();
  if (!text) return false;
  if (isHumanMedicalAsk(text)) return false;
  return TRADE_SERVICE_RE.test(text);
}

/** Only life/safety crises should keep emergency=true. */
export function isTrueSafetyEmergency(message: string): boolean {
  return TRUE_EMERGENCY_RE.test(message.trim());
}

/**
 * Clear false-positive emergency flags from the LLM planner.
 * Returns whether emergency should stay true.
 */
export function shouldTreatAsEmergency(
  message: string,
  flaggedEmergency: boolean | null,
): boolean {
  if (flaggedEmergency !== true) return false;
  if (isTradeOrAfterHoursServiceAsk(message) && !isTrueSafetyEmergency(message)) {
    return false;
  }
  // Urgent human medical ("doctor open now") is healthcare, not emergency contacts —
  // unless the text is a true life/safety crisis.
  if (isHumanMedicalAsk(message) && !isTrueSafetyEmergency(message)) {
    return false;
  }
  // If the model flagged emergency but the text has no crisis signal and looks
  // like a normal local lookup, prefer not overriding to emergency contacts.
  if (!isTrueSafetyEmergency(message) && isTradeOrAfterHoursServiceAsk(message)) {
    return false;
  }
  return flaggedEmergency === true;
}
