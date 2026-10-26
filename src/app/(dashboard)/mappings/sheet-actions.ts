"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/supabase/server-auth";
import { createServiceClient } from "@/lib/supabase/server";
import { getSetting, setSetting } from "@/lib/settings";
import { getSheetsClient, getDriveClient } from "@/lib/google/auth";
import { createSpreadsheetWithTabs, writeValues, clearValues, readValues, spreadsheetUrl } from "@/lib/google/sheets";
import { moveFileToFolder } from "@/lib/google/drive";
import { processMappingRow, type RowImportResult } from "@/lib/mapping/row-import";

const SHEET_ID_KEY = "mappings_sheet_id";
const SHEET_TAB_KEY = "mappings_sheet_tab";
const DEFAULT_TAB_TITLE = "Mappings";
const HEADERS = [
  "Mapping ID",
  "Match Field",
  "Match Type",
  "Match Pattern",
  "Game Name",
  "Publisher Name",
  "Royalty Applicable",
  "Product Type Override",
  "Priority",
  "Notes",
];

async function getSheetConfig(
  supabase: ReturnType<typeof createServiceClient>
): Promise<{ spreadsheetId: string; tabTitle: string }> {
  const existingId = await getSetting(supabase, SHEET_ID_KEY);
  if (existingId) {
    const tabTitle = (await getSetting(supabase, SHEET_TAB_KEY)) ?? DEFAULT_TAB_TITLE;
    return { spreadsheetId: existingId, tabTitle };
  }

  const sheets = getSheetsClient();
  const spreadsheetId = await createSpreadsheetWithTabs(sheets, "Meeple Design - Board Game Publisher Mappings", [
    DEFAULT_TAB_TITLE,
  ]);

  const rootId = process.env.ROYALTY_ROOT_FOLDER_ID;
  if (rootId) {
    const drive = getDriveClient();
    await moveFileToFolder(drive, spreadsheetId, rootId);
  }

  await setSetting(supabase, SHEET_ID_KEY, spreadsheetId);
  await setSetting(supabase, SHEET_TAB_KEY, DEFAULT_TAB_TITLE);
  return { spreadsheetId, tabTitle: DEFAULT_TAB_TITLE };
}

export async function getCurrentSheetLink(): Promise<{ url: string; tabTitle: string } | null> {
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

/**
 * Links an existing Google Sheet (and, if the URL includes ?gid=, the
 * specific tab) as the one push/pull operate on from now on, replacing
 * the app's auto-created sheet.
 */
export async function linkExistingSheet(_prev: LinkSheetResult | null, formData: FormData): Promise<LinkSheetResult> {
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

  revalidatePath("/mappings");
  return { ok: true, message: `Linked tab "${tabTitle}".`, tabTitle, url: spreadsheetUrl(spreadsheetId) };
}

export async function pushMappingsToSheet(): Promise<{ url: string }> {
  await requireOwner();
  const supabase = createServiceClient();
  const sheets = getSheetsClient();

  const { spreadsheetId, tabTitle } = await getSheetConfig(supabase);

  const { data: mappings, error } = await supabase
    .from("game_mappings")
    .select("*, publishers(name)")
    .order("game_name");
  if (error) throw new Error(error.message);

  const rows = (mappings ?? []).map((m) => [
    m.id,
    m.match_field,
    m.match_type,
    m.match_pattern,
    m.game_name,
    m.publishers?.name ?? "",
    m.royalty_applicable ? "Yes" : "No",
    m.product_type_override ?? "",
    m.priority,
    m.notes ?? "",
  ]);

  await clearValues(sheets, spreadsheetId, tabTitle);
  await writeValues(sheets, spreadsheetId, tabTitle, [HEADERS, ...rows]);

  return { url: spreadsheetUrl(spreadsheetId) };
}

export interface SheetSyncResult extends RowImportResult {
  url: string | null;
}

export async function pullMappingsFromSheet(): Promise<SheetSyncResult> {
  await requireOwner();
  const supabase = createServiceClient();
  const sheets = getSheetsClient();

  const spreadsheetId = await getSetting(supabase, SHEET_ID_KEY);
  if (!spreadsheetId) {
    return {
      imported: 0,
      updated: 0,
      errors: [{ row: 0, message: "No mappings sheet linked yet — push to create one, or link an existing sheet first." }],
      createdPublishers: [],
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
      createdPublishers: [],
      url: spreadsheetUrl(spreadsheetId),
    };
  }

  const [headerRow, ...dataRows] = values;
  if (!headerRow) {
    return {
      imported: 0,
      updated: 0,
      errors: [{ row: 0, message: "Sheet tab is empty." }],
      createdPublishers: [],
      url: spreadsheetUrl(spreadsheetId),
    };
  }

  const { data: publishers } = await supabase.from("publishers").select("id, name");
  const publisherByName = new Map((publishers ?? []).map((p) => [p.name.trim().toLowerCase(), p.id]));

  const result: RowImportResult = { imported: 0, updated: 0, errors: [], createdPublishers: [] };

  for (const [index, rawRow] of dataRows.entries()) {
    const row: Record<string, string> = {};
    headerRow.forEach((header, i) => {
      row[header] = rawRow[i] ?? "";
    });
    if (Object.values(row).every((v) => !v?.trim())) continue; // skip blank rows

    const existingId = row["Mapping ID"]?.trim() || undefined;
    await processMappingRow(supabase, row, index + 2, publisherByName, result, existingId);
  }

  revalidatePath("/mappings");
  revalidatePath("/publishers");
  return { ...result, url: spreadsheetUrl(spreadsheetId) };
}
