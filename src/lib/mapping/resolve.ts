import type { Source, StandardRow } from "../parsers/types";

export interface GameMapping {
  id: string;
  source: Source | "any";
  match_field: "title" | "sku";
  match_type: "exact" | "contains";
  match_pattern: string;
  game_name: string;
  publisher_id: string | null;
  royalty_applicable: boolean;
  product_type_override: string | null;
  priority: number;
}

export interface ResolvedRow extends StandardRow {
  gameName: string | null;
  publisherId: string | null;
  royaltyApplicable: boolean | null;
  mappingId: string | null;
  needsReview: boolean;
}

function matches(mapping: GameMapping, row: StandardRow): boolean {
  const field = mapping.match_field === "sku" ? row.rawSku : row.rawTitle;
  if (!field) return false;
  const pattern = mapping.match_pattern.toLowerCase();
  const value = field.toLowerCase();
  return mapping.match_type === "exact" ? value === pattern : value.includes(pattern);
}

/**
 * Resolves a parsed row to a game/publisher using the mapping table.
 * Mappings scoped to the row's own source are preferred over "any"-source
 * mappings; within a tier, higher `priority` wins, then longer (more
 * specific) match patterns win on ties.
 */
export function resolveMapping(row: StandardRow, mappings: GameMapping[]): ResolvedRow {
  const candidates = mappings
    .filter((m) => (m.source === row.source || m.source === "any") && matches(m, row))
    .sort((a, b) => {
      if (a.source !== b.source) return a.source === row.source ? -1 : 1;
      if (a.priority !== b.priority) return b.priority - a.priority;
      return b.match_pattern.length - a.match_pattern.length;
    });

  const best = candidates[0];
  if (!best) {
    return {
      ...row,
      gameName: null,
      publisherId: null,
      royaltyApplicable: null,
      mappingId: null,
      needsReview: true,
    };
  }

  return {
    ...row,
    gameName: best.game_name,
    publisherId: best.publisher_id,
    royaltyApplicable: best.royalty_applicable,
    productType: best.product_type_override || row.productType,
    mappingId: best.id,
    needsReview: false,
  };
}

export function resolveAll(rows: StandardRow[], mappings: GameMapping[]): ResolvedRow[] {
  return rows.map((row) => resolveMapping(row, mappings));
}
