// A cart shared as a link: luqta://cart?add=rice*2,milk*1. The person who opens it sees the products and adds them
// to their own cart with one tap; nothing is added without that tap. The link is untrusted input, so it is read
// strictly: known-shaped ids only, whole quantities from 1 to 99, at most 40 lines. Pure, for the node tests.

export const MAX_SHARED_LINES = 40;
export const MAX_SHARED_QUANTITY = 99;
const ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

/** "rice*2,milk*1" from cart lines; lines that could not be read back are left out. */
export function encodeSharedCart(items: Record<string, number>): string {
  return Object.entries(items)
    .filter(([id, quantity]) => ID.test(id) && Number.isInteger(quantity) && quantity >= 1)
    .slice(0, MAX_SHARED_LINES)
    .map(([id, quantity]) => `${id}*${Math.min(quantity, MAX_SHARED_QUANTITY)}`)
    .join(",");
}

/** The cart in a link, as { id: quantity }. Anything malformed is skipped; repeated ids are added up (capped). */
export function parseSharedCart(raw: unknown): Record<string, number> {
  const text = Array.isArray(raw) ? raw[0] : raw;
  if (typeof text !== "string" || !text || text.length > 4000) return {};
  const items: Record<string, number> = {};
  for (const part of text.split(",").slice(0, MAX_SHARED_LINES)) {
    const match = /^([^*]+)\*(\d{1,2})$/.exec(part.trim());
    if (!match || !ID.test(match[1])) continue;
    const quantity = Number(match[2]);
    if (quantity < 1) continue;
    items[match[1]] = Math.min(MAX_SHARED_QUANTITY, (items[match[1]] || 0) + quantity);
  }
  return items;
}

/** The link that opens the shared cart in the app. */
export function sharedCartLink(items: Record<string, number>): string | null {
  const encoded = encodeSharedCart(items);
  return encoded ? `luqta://cart?add=${encodeURIComponent(encoded)}` : null;
}
