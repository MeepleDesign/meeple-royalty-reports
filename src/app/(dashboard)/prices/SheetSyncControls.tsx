"use client";

import { useActionState, useState, useTransition } from "react";
import {
  pushPricesToSheet,
  pullPricesFromSheet,
  linkExistingPriceSheet,
  type SheetSyncResult,
  type LinkSheetResult,
} from "./sheet-actions";

const initialPullState: SheetSyncResult = { imported: 0, updated: 0, errors: [], url: null };
const initialLinkState: LinkSheetResult = { ok: false, message: "" };

export function SheetSyncControls({ current }: { current: { url: string; tabTitle: string } | null }) {
  const [pullState, pullAction, pullPending] = useActionState(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState requires this signature
    async (_prev: SheetSyncResult) => pullPricesFromSheet(),
    initialPullState
  );
  const [linkState, linkAction, linkPending] = useActionState(linkExistingPriceSheet, initialLinkState);
  const [pushUrl, setPushUrl] = useState<string | null>(null);
  const [pushError, setPushError] = useState<string | null>(null);
  const [pushPending, startPush] = useTransition();

  function handlePush() {
    setPushError(null);
    startPush(async () => {
      try {
        const { url } = await pushPricesToSheet();
        setPushUrl(url);
      } catch (err) {
        setPushError(err instanceof Error ? err.message : "Push failed");
      }
    });
  }

  const activeUrl = pushUrl ?? pullState.url ?? (linkState.ok ? linkState.url : null) ?? current?.url ?? null;
  const activeTab = (linkState.ok ? linkState.tabTitle : null) ?? current?.tabTitle ?? null;

  return (
    <div className="card space-y-3">
      <div className="font-medium text-sm text-neutral-700">Google Sheet</div>
      <p className="text-xs text-neutral-500">
        Push your prices to a Google Sheet to review/edit them there, then pull any changes back
        (new rows are created, rows with a Price ID are updated in place — nothing is auto-deleted).
        By default the app creates its own sheet, or you can link an existing one below.
      </p>

      {activeTab && <p className="text-xs text-neutral-500">Currently linked tab: &quot;{activeTab}&quot;</p>}

      <div className="flex items-center gap-3">
        <button type="button" onClick={handlePush} disabled={pushPending} className="btn-secondary disabled:opacity-40">
          {pushPending ? "Pushing…" : "Push to Google Sheet"}
        </button>
        <form action={pullAction}>
          <button type="submit" disabled={pullPending} className="btn-secondary disabled:opacity-40">
            {pullPending ? "Syncing…" : "Sync from Google Sheet"}
          </button>
        </form>
        {activeUrl && (
          <a href={activeUrl} target="_blank" className="text-sm text-neutral-600 hover:underline">
            Open sheet
          </a>
        )}
      </div>

      {pushError && <p className="text-sm text-red-600">{pushError}</p>}
      {pushUrl && !pushError && <p className="text-sm text-green-700">Pushed current prices to the sheet.</p>}

      {(pullState.imported > 0 || pullState.updated > 0) && (
        <p className="text-sm text-green-700">
          Synced from sheet: {pullState.imported} new, {pullState.updated} updated.
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

      <details className="pt-2 border-t border-neutral-100">
        <summary className="text-sm text-neutral-600 cursor-pointer">Link an existing Google Sheet instead</summary>
        <form action={linkAction} className="mt-3 space-y-2">
          <div className="space-y-1">
            <label className="text-xs text-neutral-500 block">
              Sheet URL (paste the link while viewing the tab you want — the tab is detected automatically)
            </label>
            <input name="sheet_url" placeholder="https://docs.google.com/spreadsheets/d/.../edit?gid=..." required className="input" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-neutral-500 block">Tab name (only needed if the URL doesn&apos;t pin one, or has several tabs)</label>
            <input name="tab_name" placeholder="e.g. Standard Price List" className="input" />
          </div>
          <button type="submit" disabled={linkPending} className="btn-secondary disabled:opacity-40">
            {linkPending ? "Linking…" : "Use this sheet"}
          </button>
          {linkState.message && (
            <p className={`text-sm ${linkState.ok ? "text-green-700" : "text-red-600"}`}>{linkState.message}</p>
          )}
        </form>
      </details>
    </div>
  );
}
