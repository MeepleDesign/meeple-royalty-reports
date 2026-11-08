"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/supabase/server-auth";
import { createServiceClient } from "@/lib/supabase/server";

export interface BulkPublisherUpdate {
  id: string;
  name: string;
  royalty_rate: number; // fraction, e.g. 0.1 for 10%
  payment_basis: "quarterly" | "annual";
  annual_due_quarter: number;
  roll_forward: boolean;
  payout_threshold: number | null;
  pays_royalties: boolean;
}

export interface BulkUpdateResult {
  updated: number;
  errors: { id: string; message: string }[];
}

export async function bulkUpdatePublishers(updates: BulkPublisherUpdate[]): Promise<BulkUpdateResult> {
  await requireOwner();
  const supabase = createServiceClient();
  const result: BulkUpdateResult = { updated: 0, errors: [] };

  for (const u of updates) {
    const name = u.name.trim();
    if (!name) {
      result.errors.push({ id: u.id, message: "Name is required" });
      continue;
    }
    if (Number.isNaN(u.royalty_rate)) {
      result.errors.push({ id: u.id, message: "Royalty rate isn't a number" });
      continue;
    }

    const { error } = await supabase
      .from("publishers")
      .update({
        name,
        royalty_rate: u.royalty_rate,
        payment_basis: u.payment_basis,
        annual_due_quarter: u.annual_due_quarter,
        roll_forward: u.roll_forward,
        payout_threshold: u.roll_forward ? u.payout_threshold : null,
        pays_royalties: u.pays_royalties,
      })
      .eq("id", u.id);

    if (error) {
      result.errors.push({ id: u.id, message: error.message });
      continue;
    }
    result.updated += 1;
  }

  revalidatePath("/publishers");
  return result;
}
