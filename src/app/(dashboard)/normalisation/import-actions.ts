"use server";

import Papa from "papaparse";
import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/supabase/server-auth";
import { createServiceClient } from "@/lib/supabase/server";
import { processNormalisationRow, type NormalisationRowImportResult } from "@/lib/pricing/normalisation-row-import";

export interface ImportResult extends NormalisationRowImportResult {
  detectedColumns: string[];
  parseWarnings: string[];
}

export async function importNormalisationCsv(_prev: ImportResult | null, formData: FormData): Promise<ImportResult> {
  await requireOwner();
  const supabase = createServiceClient();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { imported: 0, updated: 0, errors: [{ row: 0, message: "No file selected" }], detectedColumns: [], parseWarnings: [] };
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

  const result: NormalisationRowImportResult = { imported: 0, updated: 0, errors: [] };
  for (const [index, row] of parsed.data.entries()) {
    await processNormalisationRow(supabase, row, index + 2, result);
  }

  revalidatePath("/normalisation");
  return { ...result, detectedColumns, parseWarnings };
}
