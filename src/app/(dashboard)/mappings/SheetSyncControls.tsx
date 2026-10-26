"use client";

import { useActionState, useState, useTransition } from "react";
import { pushMappingsToSheet, pullMappingsFromSheet, type SheetSyncResult } from "./sheet-actions";

const initialPullState: SheetSyncResult = { imported: 0, updated: 0, errors: [], createdPublishers: [], url: null };

export function SheetSyncControls() {
  const [pullState, pullAction, pullPending] = useActionState(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState requires this signature
    async (_prev: SheetSyncResult) => pullMappingsFromSheet(),
    initialPullState
  );
  const [pushUrl, setPushUrl] = useState<string | null>(null);
  const [pushError, setPushError] = useState<string | null>(null);
  const [pushPending, startPush] = useTransition();

  function handlePush() {
    setPushError(null);
    startPush(async () => {
      try {
        const { url } = await pushMappingsToSheet();
        setPushUrl(url);
      } catch (err) {
        setPushError(err instanceof Error ? err.message : "Push failed");
      }
    });
  }

  return (
    <div className="card space-y-3">
      <div className="font-medium text-sm text-neutral-700">Google Sheet</div>
      <p className="text-xs text-neutral-500">
        Push your mappings to a Google Sheet to review/edit them there, then pull any changes back
        (new rows are created, rows with a Mapping ID are updated in place — nothing is auto-deleted).
      </p>
      <div className="flex items-center gap-3">
        <button type="button" onClick={handlePush} disabled={pushPending} className="btn-secondary disabled:opacity-40">
          {pushPending ? "Pushing…" : "Push to Google Sheet"}
        </button>
        <form action={pullAction}>
          <button type="submit" disabled={pullPending} className="btn-secondary disabled:opacity-40">
            {pullPending ? "Syncing…" : "Sync from Google Sheet"}
          </button>
        </form>
        {(pushUrl || pullState.url) && (
          <a href={pushUrl ?? pullState.url ?? undefined} target="_blank" className="text-sm text-neutral-600 hover:underline">
            Open sheet
          </a>
        )}
      </div>

      {pushError && <p className="text-sm text-red-600">{pushError}</p>}
      {pushUrl && !pushError && <p className="text-sm text-green-700">Pushed current mappings to the sheet.</p>}

      {(pullState.imported > 0 || pullState.updated > 0) && (
        <p className="text-sm text-green-700">
          Synced from sheet: {pullState.imported} new, {pullState.updated} updated.
        </p>
      )}
      {pullState.createdPublishers.length > 0 && (
        <p className="text-sm text-blue-700">
          Created {pullState.createdPublishers.length} new publisher(s): {pullState.createdPublishers.join(", ")}
        </p>
      )}
      {pullState.errors.length > 0 && (
        <div className="text-sm text-red-600 space-y-1">
          <p>{pullState.errors.length} row(s) skipped:</p>
          <ul className="list-disc list-inside">
            {pullState.errors.map((e, i) => (
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
