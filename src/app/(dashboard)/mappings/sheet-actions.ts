"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/supabase/server-auth";
import { createServiceClient } from "@/lib/supabase/server";
import { getSetting, setSetting } from "@/lib/settings";
import { getSheetsClient, getDriveClient } from "@/lib/google/auth";
import { createSpreadsheetWithTabs, writeValues, clearValues, readValues, spreadsheetUrl } from "@/lib/google/sheets";
import { moveFileToFolder } from "@/lib/google/drive";
import { processMappingRow, type RowImportResult } from "@/lib/mapping/row-import";

const SETTING_KEY = "mappings_sheet_id";
const TAB_TITLE = "Mappings";
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

async function getOrCreateSheetId(supabase: ReturnType<typeof createServiceClient>): Promise<string> {
  const existing = await getSetting(supabase, SETTING_KEY);
  if (existing) return existing;

  const sheets = getSheetsClient();
  const spreadsheetId = await createSpreadsheetWithTabs(sheets, "Meeple Design - Board Game Publisher Mappings", [
    TAB_TITLE,
  ]);

  const rootId = process.env.ROYALTY_ROOT_FOLDER_ID;
  if (rootId) {
    const drive = getDriveClient();
    await moveFileToFolder(drive, spreadsheetId, rootId);
  }

  await setSetting(supabase, SETTING_KEY, spreadsheetId);
  return spreadsheetId;
}

export async function pushMappingsToSheet(): Promise<{ url: string }> {
  await requireOwner();
  const supabase = createServiceClient();
  const sheets = getSheetsClient();

  const spreadsheetId = await getOrCreateSheetId(supabase);

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

  await clearValues(sheets, spreadsheetId, TAB_TITLE);
  await writeValues(sheets, spreadsheetId, TAB_TITLE, [HEADERS, ...rows]);

  return { url: spreadsheetUrl(spreadsheetId) };
}

export interface SheetSyncResult extends RowImportResult {
  url: string | null;
}

export async function pullMappingsFromSheet(): Promise<SheetSyncResult> {
  await requireOwner();
  const supabase = createServiceClient();
  const sheets = getSheetsClient();

  const spreadsheetId = await getSetting(supabase, SETTING_KEY);
  if (!spreadsheetId) {
    return {
      imported: 0,
      updated: 0,
      errors: [{ row: 0, message: "No mappings sheet exists yet — push to create one first." }],
      createdPublishers: [],
      url: null,
    };
  }

  const values = await readValues(sheets, spreadsheetId, TAB_TITLE);
  const [headerRow, ...dataRows] = values;
  if (!headerRow) {
    return {
      imported: 0,
      updated: 0,
      errors: [{ row: 0, message: "Sheet is empty." }],
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
