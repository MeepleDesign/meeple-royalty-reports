"use client";

import { useState, useTransition } from "react";
import { reapplyNormalisation } from "./actions";

export function ReapplyNormalisationButton({ runId }: { runId: string }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const { updated } = await reapplyNormalisation(runId);
            setResult(updated > 0 ? `Updated ${updated} row(s).` : "Nothing changed — already normalised.");
          })
        }
        className="btn-secondary disabled:opacity-40"
      >
        {pending ? "Re-applying…" : "Re-apply normalisation rules"}
      </button>
      {result && <span className="text-xs text-neutral-500">{result}</span>}
    </div>
  );
}
