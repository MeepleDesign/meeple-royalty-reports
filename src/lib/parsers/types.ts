export type Source = "etsy" | "shopify" | "redbubble" | "manual";

/**
 * Output of a per-source parser, before game/publisher resolution.
 *
 * `totalNet` is each platform's best "amount Meeple Design actually
 * receives before royalty is deducted" figure — Shopify's "Net sales"
 * (after discounts/returns, before Shopify fees), Etsy's "Item Total"
 * (after item-level discounts, before Etsy fees), Redbubble's
 * "Artist Margin" (already net of Redbubble's own cut — that IS what
 * we receive). Royalty is then calculated as totalNet x rate.
 */
export interface StandardRow {
  source: Source;
  saleDate: string; // ISO yyyy-mm-dd
  rawTitle: string; // listing title / item name / "Work" — used for game mapping
  rawSku?: string;
  productType?: string;
  listingDescription: string; // human-readable, usually same as rawTitle
  variant?: string;
  unitsSold: number;
  unitNet: number;
  totalNet: number;
}

export interface ParseWarning {
  rowNumber: number;
  message: string;
}

export interface ParseResult {
  rows: StandardRow[];
  warnings: ParseWarning[];
  skippedRows: number; // e.g. Shopify's zero-sales / shipping-only padding rows
}
