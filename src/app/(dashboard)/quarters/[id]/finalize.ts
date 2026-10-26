"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/supabase/server-auth";
import { createServiceClient } from "@/lib/supabase/server";
import { getDriveClient, getSheetsClient } from "@/lib/google/auth";
import { ensurePublisherQuarterFolder } from "@/lib/google/folders";
import { createSpreadsheetWithTabs, writeValues, spreadsheetUrl } from "@/lib/google/sheets";
import { moveFileToFolder } from "@/lib/google/drive";
import { computePublisherBalance, type PublisherSettings } from "@/lib/royalty/engine";
import type { ResolvedRow } from "@/lib/mapping/resolve";
import { nextQuarter, quarterLabel } from "@/lib/royalty/quarter";

// Publisher-facing sheet — deliberately does NOT include the real NET
// total Meeple Design actually received (that stays internal to the
// Summary tab's royalty math and the Analytics page). "Item Total" here
// is looked up from the Standard Pricing table by product type + variant,
// not the actual sale amount, so marketplace discounts/fees never show.
const SALES_HEADERS = [
  "Date",
  "Sale Source",
  "Game",
  "Publisher",
  "Product",
  "Listing Description",
  "Variant",
  "Order No",
  "Ship To Country",
  "Units Sold",
  "Item Total",
  "Currency",
];

interface PublisherRow {
  name: string;
  royalty_rate: number;
  payment_basis: "quarterly" | "annual";
  annual_due_quarter: number;
  roll_forward: boolean;
  payout_threshold: number | null;
}

interface TransactionRow {
  source: string;
  sale_date: string;
  raw_title: string;
  raw_sku: string | null;
  game_name: string | null;
  publisher_id: string | null;
  product_type: string | null;
  listing_description: string;
  variant: string | null;
  units_sold: number;
  unit_net: number | null;
  total_net: number;
  order_no: string | null;
  ship_to_country: string | null;
  sale_source: string | null;
  royalty_applicable: boolean | null;
  mapping_id: string | null;
}

interface TransactionWithPublisher extends TransactionRow {
  publishers: PublisherRow;
}

function priceLookupKey(productType: string | null, variant: string | null): string {
  return `${(productType ?? "").trim().toLowerCase()}|${(variant ?? "").trim().toLowerCase()}`;
}

export async function finalizeQuarter(runId: string) {
  await requireOwner();
  const supabase = createServiceClient();

  const { data: run, error: runError } = await supabase
    .from("royalty_runs")
    .select("*")
    .eq("id", runId)
    .single();
  if (runError || !run) throw new Error(runError?.message ?? "Quarter not found");

  const { count: reviewCount } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("royalty_run_id", runId)
    .eq("needs_review", true);
  if ((reviewCount ?? 0) > 0) {
    throw new Error(`${reviewCount} row(s) still need review before you can finalize this quarter.`);
  }

  const [{ data: txRowsRaw, error: txError }, { data: prices }] = await Promise.all([
    supabase.from("transactions").select("*, publishers(*)").eq("royalty_run_id", runId).not("publisher_id", "is", null),
    supabase.from("product_prices").select("product_type, variant, unit_net"),
  ]);
  if (txError) throw new Error(txError.message);
  const txRows = (txRowsRaw ?? []) as TransactionWithPublisher[];

  const priceByKey = new Map((prices ?? []).map((p) => [priceLookupKey(p.product_type, p.variant), Number(p.unit_net)]));

  const byPublisher = new Map<string, TransactionWithPublisher[]>();
  for (const row of txRows) {
    if (!row.publisher_id) continue; // excluded by the query above; narrows the type here too
    const list = byPublisher.get(row.publisher_id) ?? [];
    list.push(row);
    byPublisher.set(row.publisher_id, list);
  }

  const drive = getDriveClient();
  const sheets = getSheetsClient();
  const label = quarterLabel(run.year, run.quarter);
  const { year: nextYear, quarter: nextQ } = nextQuarter(run.year, run.quarter);

  for (const [publisherId, rows] of byPublisher) {
    const publisher = rows[0].publishers;
    const settings: PublisherSettings = {
      id: publisherId,
      royaltyRate: publisher.royalty_rate,
      paymentBasis: publisher.payment_basis,
      annualDueQuarter: publisher.annual_due_quarter,
      rollForward: publisher.roll_forward,
      payoutThreshold: publisher.payout_threshold,
    };

    const carriedIn = await getCarriedInBalance(supabase, publisherId, run.year, run.quarter);
    const resolvedRows = rows.map(toResolvedRow);
    const balance = computePublisherBalance(settings, { year: run.year, quarter: run.quarter }, resolvedRows, carriedIn);

    const spreadsheetId = await createSpreadsheetWithTabs(
      sheets,
      `${publisher.name} - ${label} Royalty Report`,
      ["Sales", "Summary"]
    );

    const sortedRows = [...rows].sort((a, b) => a.sale_date.localeCompare(b.sale_date));
    const salesData = sortedRows.map((r) => {
      const unitPrice = priceByKey.get(priceLookupKey(r.product_type, r.variant));
      const itemTotal = unitPrice !== undefined ? unitPrice * Number(r.units_sold) : "";
      return [
        r.sale_date,
        r.sale_source ?? r.source,
        r.game_name ?? "",
        publisher.name,
        r.product_type ?? "",
        r.listing_description,
        r.variant ?? "",
        r.order_no ?? "",
        r.ship_to_country ?? "",
        Number(r.units_sold),
        itemTotal,
        "GBP",
      ];
    });
    await writeValues(sheets, spreadsheetId, "Sales", [SALES_HEADERS, ...salesData]);

    await writeValues(sheets, spreadsheetId, "Summary", [
      ["Publisher", publisher.name],
      ["Quarter", label],
      ["Units sold", balance.unitsSold],
      ["Gross revenue (£)", balance.grossRevenue],
      ["Royalty rate", `${(balance.royaltyRate * 100).toFixed(1)}%`],
      ["Royalty accrued this quarter (£)", balance.royaltyAccrued],
      ["Carried in from previous period (£)", balance.carriedIn],
      ["Carried out to next period (£)", balance.carriedOut],
      ["Amount payable now (£)", balance.amountPayable],
      ["Status", balance.status],
    ]);

    const folderId = await ensurePublisherQuarterFolder(
      drive,
      supabase,
      publisherId,
      publisher.name,
      run.year,
      run.quarter
    );
    await moveFileToFolder(drive, spreadsheetId, folderId);

    await supabase.from("publisher_balances").upsert(
      {
        publisher_id: publisherId,
        royalty_run_id: runId,
        gross_revenue: balance.grossRevenue,
        units_sold: balance.unitsSold,
        royalty_rate: balance.royaltyRate,
        royalty_accrued: balance.royaltyAccrued,
        carried_in: balance.carriedIn,
        carried_out: balance.carriedOut,
        amount_payable: balance.amountPayable,
        status: balance.status,
        sheet_url: spreadsheetUrl(spreadsheetId),
        sheet_file_id: spreadsheetId,
      },
      { onConflict: "publisher_id,royalty_run_id" }
    );

    // Pre-provision next period's folder for this publisher (creates the
    // next year's folder too, as a side effect, when rolling from Q4).
    await ensurePublisherQuarterFolder(drive, supabase, publisherId, publisher.name, nextYear, nextQ);
  }

  await supabase
    .from("royalty_runs")
    .update({ status: "finalized", finalized_at: new Date().toISOString() })
    .eq("id", runId);

  revalidatePath(`/quarters/${runId}`);
  revalidatePath("/");
}

async function getCarriedInBalance(
  supabase: ReturnType<typeof createServiceClient>,
  publisherId: string,
  year: number,
  quarter: number
): Promise<number> {
  // Fetched and filtered in JS rather than as a cross-table query filter —
  // this publisher has at most a few years of quarterly balances, so it's
  // cheap, and it sidesteps relying on exact query-builder foreign-table
  // filter syntax for something money-critical.
  const { data } = await supabase
    .from("publisher_balances")
    .select("carried_out, royalty_runs!inner(year, quarter)")
    .eq("publisher_id", publisherId);

  const periodKey = year * 4 + quarter;
  const prior = (data ?? [])
    .map((row) => {
      const run = Array.isArray(row.royalty_runs) ? row.royalty_runs[0] : row.royalty_runs;
      return { carriedOut: row.carried_out as number, key: run.year * 4 + run.quarter };
    })
    .filter((row) => row.key < periodKey)
    .sort((a, b) => b.key - a.key);

  return prior[0]?.carriedOut ?? 0;
}

function toResolvedRow(row: TransactionRow): ResolvedRow {
  return {
    source: row.source as ResolvedRow["source"],
    saleDate: row.sale_date,
    rawTitle: row.raw_title,
    rawSku: row.raw_sku ?? undefined,
    productType: row.product_type ?? undefined,
    listingDescription: row.listing_description,
    variant: row.variant ?? undefined,
    unitsSold: Number(row.units_sold),
    unitNet: Number(row.unit_net ?? 0),
    totalNet: Number(row.total_net),
    saleSource: row.sale_source ?? row.source,
    gameName: row.game_name,
    publisherId: row.publisher_id,
    royaltyApplicable: row.royalty_applicable,
    mappingId: row.mapping_id,
    needsReview: false,
  };
}
