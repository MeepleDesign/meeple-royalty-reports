"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/supabase/server-auth";
import { createServiceClient } from "@/lib/supabase/server";
import { getSetting, setSetting } from "@/lib/settings";
import { getSheetsClient, getDriveClient } from "@/lib/google/auth";
import { createSpreadsheetWithTabs, writeValues, clearValues, readValues, spreadsheetUrl } from "@/lib/google/sheets";
import { moveFileToFolder } from "@/lib/google/drive";
import { processPriceRow, type PriceRowImportResult } from "@/lib/pricing/row-import";

const SHEET_ID_KEY = "prices_sheet_id";
const SHEET_TAB_KEY = "prices_sheet_tab";
const DEFAULT_TAB_TITLE = "Prices";
const HEADERS = ["Price ID", "Product Type", "Variant", "Unit NET", "Notes"];

async function getSheetConfig(
  supabase: ReturnType<typeof createServiceClient>
): Promise<{ spreadsheetId: string; tabTitle: string }> {
  const existingId = await getSetting(supabase, SHEET_ID_KEY);
  if (existingId) {
    const tabTitle = (await getSetting(supabase, SHEET_TAB_KEY)) ?? DEFAULT_TAB_TITLE;
    return { spreadsheetId: existingId, tabTitle };
  }

  const sheets = getSheetsClient();
  const spreadsheetId = await createSpreadsheetWithTabs(sheets, "Meeple Design - Standard Pricing", [DEFAULT_TAB_TITLE]);

  const rootId = process.env.ROYALTY_ROOT_FOLDER_ID;
  if (rootId) {
    const drive = getDriveClient();
    await moveFileToFolder(drive, spreadsheetId, rootId);
  }

  await setSetting(supabase, SHEET_ID_KEY, spreadsheetId);
  await setSetting(supabase, SHEET_TAB_KEY, DEFAULT_TAB_TITLE);
  return { spreadsheetId, tabTitle: DEFAULT_TAB_TITLE };
}

export async function getCurrentPriceSheetLink(): Promise<{ url: string; tabTitle: string } | null> {
  await requireOwner();
  const supabase = createServiceClient();
  const spreadsheetId = await getSetting(supabase, SHEET_ID_KEY);
  if (!spreadsheetId) return null;
  const tabTitle = (await getSetting(supabase, SHEET_TAB_KEY)) ?? DEFAULT_TAB_TITLE;
  return { url: spreadsheetUrl(spreadsheetId), tabTitle };
}

export interface LinkSheetResult {
  ok: boolean;
  message: string;
  tabTitle?: string;
  url?: string;
}

export async function linkExistingPriceSheet(_prev: LinkSheetResult | null, formData: FormData): Promise<LinkSheetResult> {
  await requireOwner();
  const supabase = createServiceClient();

  const url = String(formData.get("sheet_url") || "").trim();
  const manualTab = String(formData.get("tab_name") || "").trim();

  const idMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (!idMatch) {
    return { ok: false, message: "That doesn't look like a Google Sheets URL (couldn't find the spreadsheet ID)." };
  }
  const spreadsheetId = idMatch[1];
  const gidMatch = url.match(/gid=(\d+)/);
  const gid = gidMatch ? parseInt(gidMatch[1], 10) : null;

  const sheets = getSheetsClient();
  let tabTitle: string;
  try {
    const { data } = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties" });
    const tabs = data.sheets ?? [];
    if (manualTab) {
      const match = tabs.find((t) => t.properties?.title === manualTab);
      if (!match) {
        return {
          ok: false,
          message: `No tab called "${manualTab}" found. Tabs in this sheet: ${tabs.map((t) => t.properties?.title).join(", ")}`,
        };
      }
      tabTitle = manualTab;
    } else if (gid !== null) {
      const match = tabs.find((t) => t.properties?.sheetId === gid);
      if (!match?.properties?.title) {
        return { ok: false, message: "Couldn't find a tab matching that URL's gid — paste the tab name manually instead." };
      }
      tabTitle = match.properties.title;
    } else {
      if (tabs.length !== 1 || !tabs[0].properties?.title) {
        return {
          ok: false,
          message: `This sheet has multiple tabs and the URL didn't specify one — tell me the tab name. Tabs: ${tabs.map((t) => t.properties?.title).join(", ")}`,
        };
      }
      tabTitle = tabs[0].properties.title;
    }
  } catch (err) {
    return { ok: false, message: `Couldn't open that sheet: ${err instanceof Error ? err.message : String(err)}` };
  }

  await setSetting(supabase, SHEET_ID_KEY, spreadsheetId);
  await setSetting(supabase, SHEET_TAB_KEY, tabTitle);

  revalidatePath("/prices");
  return { ok: true, message: `Linked tab "${tabTitle}".`, tabTitle, url: spreadsheetUrl(spreadsheetId) };
}

export async function pushPricesToSheet(): Promise<{ url: string }> {
  await requireOwner();
  const supabase = createServiceClient();
  const sheets = getSheetsClient();

  const { spreadsheetId, tabTitle } = await getSheetConfig(supabase);

  const { data: prices, error } = await supabase
    .from("product_prices")
    .select("*")
    .order("product_type")
    .order("variant");
  if (error) throw new Error(error.message);

  const rows = (prices ?? []).map((p) => [p.id, p.product_type, p.variant ?? "", Number(p.unit_net), p.notes ?? ""]);

  await clearValues(sheets, spreadsheetId, tabTitle);
  await writeValues(sheets, spreadsheetId, tabTitle, [HEADERS, ...rows]);

  return { url: spreadsheetUrl(spreadsheetId) };
}

export interface SheetSyncResult extends PriceRowImportResult {
  url: string | null;
}

export async function pullPricesFromSheet(): Promise<SheetSyncResult> {
  await requireOwner();
  const supabase = createServiceClient();
  const sheets = getSheetsClient();

  const spreadsheetId = await getSetting(supabase, SHEET_ID_KEY);
  if (!spreadsheetId) {
    return {
      imported: 0,
      updated: 0,
      errors: [{ row: 0, message: "No prices sheet linked yet — push to create one, or link an existing sheet first." }],
      url: null,
    };
  }
  const tabTitle = (await getSetting(supabase, SHEET_TAB_KEY)) ?? DEFAULT_TAB_TITLE;

  let values: string[][];
  try {
    values = await readValues(sheets, spreadsheetId, tabTitle);
  } catch (err) {
    return {
      imported: 0,
      updated: 0,
      errors: [{ row: 0, message: `Couldn't read tab "${tabTitle}": ${err instanceof Error ? err.message : String(err)}` }],
      url: spreadsheetUrl(spreadsheetId),
    };
  }

  const [headerRow, ...dataRows] = values;
  if (!headerRow) {
    return { imported: 0, updated: 0, errors: [{ row: 0, message: "Sheet tab is empty." }], url: spreadsheetUrl(spreadsheetId) };
  }

  const result: PriceRowImportResult = { imported: 0, updated: 0, errors: [] };

  for (const [index, rawRow] of dataRows.entries()) {
    const row: Record<string, string> = {};
    headerRow.forEach((header, i) => {
      row[header] = rawRow[i] ?? "";
    });
    if (Object.values(row).every((v) => !v?.trim())) continue;

    const existingId = row["Price ID"]?.trim() || undefined;
    await processPriceRow(supabase, row, index + 2, result, existingId);
  }

  revalidatePath("/prices");
  return { ...result, url: spreadsheetUrl(spreadsheetId) };
}
