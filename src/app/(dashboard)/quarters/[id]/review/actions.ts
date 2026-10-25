"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/supabase/server-auth";
import { createServiceClient } from "@/lib/supabase/server";
import { matchesPattern } from "@/lib/mapping/resolve";

export async function resolveReviewRow(runId: string, transactionId: string, formData: FormData) {
  await requireOwner();
  const supabase = createServiceClient();

  const { data: tx, error: txFetchError } = await supabase
    .from("transactions")
    .select("*")
    .eq("id", transactionId)
    .single();
  if (txFetchError || !tx) throw new Error(txFetchError?.message ?? "Transaction not found");

  const gameName = String(formData.get("game_name") || "").trim();
  const publisherId = String(formData.get("publisher_id") || "") || null;
  const royaltyApplicable = formData.get("royalty_applicable") === "on";
  const saveAsRule = formData.get("save_as_rule") === "on";
  const matchField = (String(formData.get("match_field") || "title") as "title" | "sku");
  const matchType = (String(formData.get("match_type") || "contains") as "exact" | "contains");
  const matchPattern = String(formData.get("match_pattern") || "").trim();

  if (!gameName || !publisherId) {
    throw new Error("Game name and publisher are required");
  }

  let mappingId: string | null = null;

  if (saveAsRule) {
    if (!matchPattern) throw new Error("Match pattern is required to save a rule");
    const { data: mapping, error: mappingError } = await supabase
      .from("game_mappings")
      .insert({
        source: tx.source,
        match_field: matchField,
        match_type: matchType,
        match_pattern: matchPattern,
        game_name: gameName,
        publisher_id: publisherId,
        royalty_applicable: royaltyApplicable,
      })
      .select("id")
      .single();
    if (mappingError) throw new Error(mappingError.message);
    mappingId = mapping.id;
  }

  const { error: updateError } = await supabase
    .from("transactions")
    .update({
      game_name: gameName,
      publisher_id: publisherId,
      royalty_applicable: royaltyApplicable,
      mapping_id: mappingId,
      needs_review: false,
    })
    .eq("id", transactionId);
  if (updateError) throw new Error(updateError.message);

  if (saveAsRule) {
    // Apply the new rule to every other still-unreviewed row in this run
    // that it also matches, so one review action can clear several rows.
    const { data: otherUnreviewed } = await supabase
      .from("transactions")
      .select("id, raw_title, raw_sku, source")
      .eq("royalty_run_id", runId)
      .eq("needs_review", true)
      .eq("source", tx.source)
      .neq("id", transactionId);

    const matchingIds = (otherUnreviewed ?? [])
      .filter((row) =>
        matchesPattern(matchField, matchType, matchPattern, {
          rawTitle: row.raw_title,
          rawSku: row.raw_sku,
        })
      )
      .map((row) => row.id);

    if (matchingIds.length > 0) {
      const { error: bulkError } = await supabase
        .from("transactions")
        .update({
          game_name: gameName,
          publisher_id: publisherId,
          royalty_applicable: royaltyApplicable,
          mapping_id: mappingId,
          needs_review: false,
        })
        .in("id", matchingIds);
      if (bulkError) throw new Error(bulkError.message);
    }
  }

  revalidatePath(`/quarters/${runId}/review`);
  revalidatePath(`/quarters/${runId}`);
}
