export interface NormalizationRule {
  raw_field: "product_type" | "variant";
  match_type: "exact" | "contains";
  raw_pattern: string;
  canonical_value: string;
  priority: number;
}

function normalizeText(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * Maps a raw product type / variant string (e.g. Redbubble's "Premium
 * T-Shirt") to the canonical name used in Standard Pricing (e.g.
 * "T-Shirt"), via user-defined rules. Falls back to the original value
 * untouched when no rule matches, so this never produces blanks on its
 * own — it only ever makes a match more likely.
 */
export function applyNormalization(
  field: "product_type" | "variant",
  value: string | undefined,
  rules: NormalizationRule[]
): string | undefined {
  if (!value) return value;
  const candidates = rules
    .filter((r) => r.raw_field === field)
    .filter((r) => {
      const v = normalizeText(value);
      const p = normalizeText(r.raw_pattern);
      return r.match_type === "exact" ? v === p : v.includes(p);
    })
    .sort((a, b) => b.priority - a.priority || b.raw_pattern.length - a.raw_pattern.length);
  return candidates[0]?.canonical_value ?? value;
}

export function normalizeProductFields(
  productType: string | undefined,
  variant: string | undefined,
  rules: NormalizationRule[]
): { productType: string | undefined; variant: string | undefined } {
  return {
    productType: applyNormalization("product_type", productType, rules),
    variant: applyNormalization("variant", variant, rules),
  };
}
