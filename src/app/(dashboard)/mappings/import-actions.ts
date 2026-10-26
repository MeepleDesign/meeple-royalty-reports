"use server";

import Papa from "papaparse";
import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/supabase/server-auth";
import { createServiceClient } from "@/lib/supabase/server";
import { processMappingRow, type RowImportResult } from "@/lib/mapping/row-import";

export interface ImportResult extends RowImportResult {
  detectedColumns: string[];
  parseWarnings: string[];
}

export async function importMappingsCsv(_prev: ImportResult | null, formData: FormData): Promise<ImportResult> {
  await requireOwner();
  const supabase = createServiceClient();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return {
      imported: 0,
      updated: 0,
      errors: [{ row: 0, message: "No file selected" }],
      detectedColumns: [],
      parseWarnings: [],
      createdPublishers: [],
    };
  }

  const text = await file.text();
  const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });

  const detectedColumns = parsed.meta.fields ?? [];
  const parseWarnings = parsed.errors.map((e) => `Row ${e.row != null ? e.row + 2 : "?"}: ${e.message}`);
  if (detectedColumns.length <= 1) {
    parseWarnings.unshift(
      `Only detected ${detectedColumns.length} column — if your file uses semicolons or tabs instead of commas, re-save it as a standard comma-separated CSV.`
    );
  }

  const { data: publishers } = await supabase.from("publishers").select("id, name");
  const publisherByName = new Map((publishers ?? []).map((p) => [p.name.trim().toLowerCase(), p.id]));

  const result: RowImportResult = { imported: 0, updated: 0, errors: [], createdPublishers: [] };

  for (const [index, row] of parsed.data.entries()) {
    await processMappingRow(supabase, row, index + 2, publisherByName, result);
  }

  revalidatePath("/mappings");
  revalidatePath("/publishers");
  return { ...result, detectedColumns, parseWarnings };
}
