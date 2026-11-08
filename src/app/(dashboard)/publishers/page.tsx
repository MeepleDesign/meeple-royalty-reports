import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { ImportPublishersForm } from "./ImportPublishersForm";
import { SheetSyncControls } from "./SheetSyncControls";
import { getCurrentPublisherSheetLink } from "./sheet-actions";
import { PublisherTable } from "./PublisherTable";

export default async function PublishersPage() {
  const supabase = createServiceClient();
  const currentSheet = await getCurrentPublisherSheetLink();
  const { data: publishers, error } = await supabase
    .from("publishers")
    .select("id, name, royalty_rate, payment_basis, annual_due_quarter, roll_forward, payout_threshold, pays_royalties")
    .order("name");

  if (error) throw new Error(error.message);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900">Publishers</h1>
        <Link href="/publishers/new" className="btn-primary">
          New publisher
        </Link>
      </div>

      <ImportPublishersForm />
      <SheetSyncControls current={currentSheet} />

      <p className="text-sm text-neutral-500">
        Edit rates, basis, roll-forward or the royalty flag directly below, then save all changes
        at once. Use &quot;More…&quot; to edit contact email, the email template or notes for one
        publisher.
      </p>

      <PublisherTable
        initialPublishers={(publishers ?? []).map((p) => ({
          ...p,
          royalty_rate: Number(p.royalty_rate),
          payout_threshold: p.payout_threshold === null ? null : Number(p.payout_threshold),
        }))}
      />
    </div>
  );
}
