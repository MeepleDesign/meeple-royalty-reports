"use client";

import { useActionState } from "react";
import { importPricesCsv, type ImportResult } from "./import-actions";

const initialState: ImportResult = { imported: 0, updated: 0, errors: [], detectedColumns: [], parseWarnings: [] };

export function ImportPricesForm() {
  const [state, formAction, pending] = useActionState(importPricesCsv, initialState);
  const attempted = state.imported > 0 || state.errors.length > 0 || state.detectedColumns.length > 0;

  return (
    <div className="card space-y-3">
      <div className="font-medium text-sm text-neutral-700">Bulk import from CSV</div>
      <p className="text-xs text-neutral-500">
        Columns (any order, flexible naming): <code>Product Type</code> (required, e.g. Poster),{" "}
        <code>Variant</code> (optional, e.g. 12x16), <code>Unit NET</code> (required, £),{" "}
        <code>Notes</code> (optional).
      </p>
      <form action={formAction} className="flex items-center gap-3">
        <input type="file" name="file" accept=".csv" required className="text-sm" />
        <button type="submit" disabled={pending} className="btn-secondary disabled:opacity-40">
          {pending ? "Importing…" : "Import"}
        </button>
      </form>

      {attempted && (
        <p className="text-xs text-neutral-500">
          Detected columns: {state.detectedColumns.length > 0 ? state.detectedColumns.join(", ") : "(none — see warnings below)"}
        </p>
      )}

      {state.parseWarnings.length > 0 && (
        <div className="text-sm text-amber-700 space-y-1">
          <ul className="list-disc list-inside">
            {state.parseWarnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {state.imported > 0 && (
        <p className="text-sm text-green-700">Imported {state.imported} price(s).</p>
      )}
      {state.errors.length > 0 && (
        <div className="text-sm text-red-600 space-y-1">
          <p>{state.errors.length} row(s) skipped:</p>
          <ul className="list-disc list-inside">
            {state.errors.map((e, i) => (
              <li key={i}>
                {e.row > 0 ? `Row ${e.row}: ` : ""}
                {e.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
