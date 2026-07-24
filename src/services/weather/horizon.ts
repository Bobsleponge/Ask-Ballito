/**
 * Detect whether the user is planning beyond the next few hours
 * (e.g. "this weekend") so we fetch the right forecast horizon.
 */
export function detectWeatherHorizon(message: string): "near_term" | "weekend" {
  const text = message.trim();
  if (
    /\b(this\s+)?weekend\b/i.test(text) ||
    /\b(sat(urday)?|sun(day)?)\b/i.test(text) ||
    /\b(next\s+)?(sat|sun)\b/i.test(text)
  ) {
    return "weekend";
  }
  return "near_term";
}
