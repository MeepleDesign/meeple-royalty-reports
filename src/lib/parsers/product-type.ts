/**
 * Etsy and Shopify titles embed the product type in free text (e.g.
 * "...Minimalist Board Game Art Poster", "...Unisex T-Shirt"). Redbubble
 * gives product type directly in its own "Product" column instead.
 *
 * This is a best-effort keyword guess for Etsy/Shopify. A mapping rule's
 * `product_type_override` always wins when set, so a miss here is a
 * cosmetic annoyance, not a data-correctness problem.
 */
const KEYWORDS: Array<[RegExp, string]> = [
  [/hoodie/i, "Hoodie"],
  [/t-?shirt/i, "T-Shirt"],
  [/\bmug\b/i, "Mug"],
  [/coaster/i, "Coaster"],
  [/sticker/i, "Sticker"],
  [/poster/i, "Poster"],
  [/\bprint\b/i, "Print"],
  [/tote/i, "Tote Bag"],
  [/notebook|journal/i, "Notebook"],
  [/puzzle/i, "Puzzle"],
  [/pin\b/i, "Pin"],
];

export function inferProductType(title: string): string | undefined {
  for (const [pattern, label] of KEYWORDS) {
    if (pattern.test(title)) return label;
  }
  return undefined;
}
