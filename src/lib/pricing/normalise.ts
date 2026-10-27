export interface NormalisationRule {
  raw_field: "product_type" | "variant";
  match_type: "exact" | "contains";
  raw_pattern: string;
  canonical_value: string;
  priority: number;
}

function normaliseText(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * Maps a raw product type / variant string (e.g. Redbubble's "Premium
 * T-Shirt") to the canonical name used in Standard Pricing (e.g.
 * "T-Shirt"), via user-defined rules. Falls back to the original value
 * untouched when no rule matches, so this never produces blanks on its
 * own — it only ever makes a match more likely.
 */
export function applyNormalisation(
  field: "product_type" | "variant",
  value: string | undefined,
  rules: NormalisationRule[]
): string | undefined {
  if (!value) return value;
  const candidates = rules
    .filter((r) => r.raw_field === field)
    .filter((r) => {
      const v = normaliseText(value);
      const p = normaliseText(r.raw_pattern);
      return r.match_type === "exact" ? v === p : v.includes(p);
    })
    .sort((a, b) => b.priority - a.priority || b.raw_pattern.length - a.raw_pattern.length);
  return candidates[0]?.canonical_value ?? value;
}

export function normaliseProductFields(
  productType: string | undefined,
  variant: string | undefined,
  rules: NormalisationRule[]
): { productType: string | undefined; variant: string | undefined } {
  return {
    productType: applyNormalisation("product_type", productType, rules),
    variant: applyNormalisation("variant", variant, rules),
  };
}
