/**
 * Detect "where can I buy X" / product purchase asks so we route to electronics
 * (or other specialist retail) instead of leisure vibe browsing.
 */

const BUY_INTENT_RE =
  /\b(buy|purchase|looking\s+for|need|want|where\s+(?:can|to|do)\s+(?:i|we)\s+(?:get|buy|find|shop)|shop\s+for|get\s+(?:me\s+)?a|stock(?:ing)?|sell(?:s|ing)?)\b/i;

const PRODUCT_NOUN_RE =
  /\b((?:gaming\s+)?(?:mouse|keyboard|headset|headphones?)|laptop|notebook|chromebook|desktop|pc\b|computer|monitor|gpu|graphics\s+card|motherboard|ram\b|ssd\b|hard\s+drive|charger|power\s+bank|phone|cellphone|cell\s+phone|smartphone|iphone|android|tablet|ipad|airpods|earbuds|speaker|tv\b|television|console|playstation|xbox|nintendo|switch\b|controller|webcam|router|modem|printer|ink\s+cartridge|usb\s+(?:cable|stick|drive)|memory\s+card|sd\s+card|camera|drone|smartwatch|fitbit|kindle|e[- ]?reader)\b/i;

const ELECTRONICS_SHOP_RE =
  /\b(electronics?\s+store|computer\s+shop|phone\s+shop|tech\s+store|gadget\s+shop|hifi|hi[- ]?fi|incredible\s+connection|matrix(?:\s+warehouse)?|hifi\s+corp|\bgame\b)\b/i;

/** Explicit product phrases even without a buy verb (e.g. "gaming mouse Ballito"). */
const BARE_PRODUCT_ASK_RE =
  /\b(?:gaming\s+mouse|gaming\s+keyboard|gaming\s+headset|wireless\s+mouse|mechanical\s+keyboard)\b/i;

/** Known Ballito / SA electronics retailers — seed search so recall isn't embedding-only. */
export const BALLITO_ELECTRONICS_BRANDS = [
  "Incredible Connection",
  "Matrix Warehouse",
  "Game",
  "HiFi Corp",
] as const;

export function isProductPurchaseAsk(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (ELECTRONICS_SHOP_RE.test(t)) return true;
  if (BARE_PRODUCT_ASK_RE.test(t)) return true;
  if (BUY_INTENT_RE.test(t) && PRODUCT_NOUN_RE.test(t)) return true;
  if (
    PRODUCT_NOUN_RE.test(t) &&
    /\b(shop|store|mall|retailer|outlet|stock)\b/i.test(t)
  ) {
    return true;
  }
  return false;
}

/** Short label for titles, grounding, and empty messages. */
export function extractProductLabel(text: string): string {
  const bare = text.match(BARE_PRODUCT_ASK_RE);
  if (bare?.[0]) return bare[0].toLowerCase().replace(/\s+/g, " ").trim();

  const product = text.match(PRODUCT_NOUN_RE);
  if (product?.[0]) {
    return product[0].toLowerCase().replace(/\s+/g, " ").trim();
  }

  if (ELECTRONICS_SHOP_RE.test(text)) return "electronics";

  return "that product";
}

export function productSearchQueries(
  productLabel: string,
  cityName: string,
): string[] {
  const label = productLabel === "that product" ? "electronics" : productLabel;
  const city = cityName.trim() || "Ballito";
  const brandQueries = BALLITO_ELECTRONICS_BRANDS.map(
    (brand) => `${brand} ${city}`,
  );
  return [
    ...brandQueries,
    `${label} ${city}`,
    `buy ${label} ${city}`,
    `electronics store ${city}`,
    `computer shop ${city}`,
    `phone shop ${city}`,
  ];
}

export function productEmptyMessage(productLabel: string): string {
  const label =
    productLabel === "that product" ? "what you're looking for" : productLabel;
  return `I couldn't find a dedicated shop in Ballito's directory that clearly sells ${label}. Try Incredible Connection, Matrix Warehouse, or Game at the shopping centres — or ask for a phone or computer shop if that helps.`;
}
