"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/supabase/server-auth";
import { createServiceClient } from "@/lib/supabase/server";
import { parseEtsyCsv } from "@/lib/parsers/etsy";
import { parseShopifyCsv } from "@/lib/parsers/shopify";
import { parseRedbubbleCsv } from "@/lib/parsers/redbubble";
import { resolveAll, type GameMapping } from "@/lib/mapping/resolve";
import type { Source, StandardRow } from "@/lib/parsers/types";

const PARSERS: Record<"etsy" | "shopify" | "redbubble", (csv: string) => { rows: StandardRow[] }> = {
  etsy: parseEtsyCsv,
  shopify: parseShopifyCsv,
  redbubble: parseRedbubbleCsv,
};

export async function uploadFiles(runId: string, source: "etsy" | "shopify" | "redbubble", formData: FormData) {
  await requireOwner();
  const supabase = createServiceClient();
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);

  if (files.length === 0) {
    throw new Error("No file selected");
  }

  const { data: mappings } = await supabase.from("game_mappings").select("*");

  for (const file of files) {
    const text = await file.text();
    const { rows } = PARSERS[source](text);
    const resolved = resolveAll(rows, (mappings ?? []) as GameMapping[]);

    const { data: upload, error: uploadError } = await supabase
      .from("uploads")
      .insert({ royalty_run_id: runId, source, filename: file.name, row_count: resolved.length })
      .select("id")
      .single();
    if (uploadError) throw new Error(uploadError.message);

    if (resolved.length > 0) {
      const { error: txError } = await supabase.from("transactions").insert(
        resolved.map((r) => ({
          royalty_run_id: runId,
          upload_id: upload.id,
          source: r.source,
          sale_date: r.saleDate,
          raw_title: r.rawTitle,
          raw_sku: r.rawSku ?? null,
          game_name: r.gameName,
          publisher_id: r.publisherId,
          product_type: r.productType ?? null,
          listing_description: r.listingDescription,
          variant: r.variant ?? null,
          units_sold: r.unitsSold,
          unit_net: r.unitNet,
          total_net: r.totalNet,
          royalty_applicable: r.royaltyApplicable,
          mapping_id: r.mappingId,
          needs_review: r.needsReview,
        }))
      );
      if (txError) throw new Error(txError.message);
    }
  }

  revalidatePath(`/quarters/${runId}`);
}

export async function addManualRow(runId: string, formData: FormData) {
  await requireOwner();
  const supabase = createServiceClient();

  const royaltyApplicable = formData.get("royalty_applicable") === "on";
  const unitsSold = parseFloat(String(formData.get("units_sold") || "1"));
  const totalNet = parseFloat(String(formData.get("total_net") || "0"));
  const publisherId = String(formData.get("publisher_id") || "") || null;

  const { error } = await supabase.from("transactions").insert({
    royalty_run_id: runId,
    source: "manual" as Source,
    sale_date: String(formData.get("sale_date")),
    raw_title: String(formData.get("listing_description") || ""),
    game_name: String(formData.get("game_name") || "") || null,
    publisher_id: publisherId,
    product_type: String(formData.get("product_type") || "") || null,
    listing_description: String(formData.get("listing_description") || ""),
    variant: String(formData.get("variant") || "") || null,
    units_sold: unitsSold,
    unit_net: unitsSold > 0 ? totalNet / unitsSold : totalNet,
    total_net: totalNet,
    royalty_applicable: royaltyApplicable,
    needs_review: !publisherId,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/quarters/${runId}`);
}

export async function deleteUpload(runId: string, uploadId: string) {
  await requireOwner();
  const supabase = createServiceClient();
  const { error } = await supabase.from("uploads").delete().eq("id", uploadId);
  if (error) throw new Error(error.message);
  revalidatePath(`/quarters/${runId}`);
}

export async function deleteTransaction(runId: string, transactionId: string) {
  await requireOwner();
  const supabase = createServiceClient();
  const { error } = await supabase.from("transactions").delete().eq("id", transactionId);
  if (error) throw new Error(error.message);
  revalidatePath(`/quarters/${runId}`);
}
