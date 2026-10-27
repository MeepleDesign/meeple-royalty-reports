"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/supabase/server-auth";
import { createServiceClient } from "@/lib/supabase/server";
import { parseSourceCsv, type FieldMapping } from "@/lib/parsers/generic";
import { resolveAll, type GameMapping } from "@/lib/mapping/resolve";
import {
  normalizeProductFields,
  type NormalizationRule,
} from "@/lib/pricing/normalize";
import type { Source } from "@/lib/parsers/types";

export async function uploadFiles(
  runId: string,
  source: "etsy" | "shopify" | "redbubble",
  formData: FormData,
) {
  await requireOwner();
  const supabase = createServiceClient();
  const files = formData
    .getAll("files")
    .filter((f): f is File => f instanceof File && f.size > 0);
  let unresolvedThisUpload = 0;

  if (files.length === 0) {
    throw new Error("No file selected");
  }

  const [{ data: mappings }, { data: fieldRows }, { data: normalizations }] =
    await Promise.all([
      supabase.from("game_mappings").select("*"),
      supabase
        .from("source_field_mappings")
        .select("standard_field, source_column")
        .eq("source", source),
      supabase.from("product_normalizations").select("*"),
    ]);
  const normRules = (normalizations ?? []) as NormalizationRule[];

  if (!fieldRows || fieldRows.length === 0) {
    throw new Error(
      `No column mapping configured for ${source} yet — set one up on the Sources page first.`,
    );
  }
  const fieldMapping = Object.fromEntries(
    fieldRows.map((r) => [r.standard_field, r.source_column]),
  ) as unknown as FieldMapping;
  if (
    !fieldMapping.sale_date ||
    !fieldMapping.title ||
    !fieldMapping.units_sold ||
    !fieldMapping.total_net
  ) {
    throw new Error(
      `Column mapping for ${source} is incomplete (date/title/units/total are required) — finish it on the Sources page.`,
    );
  }

  for (const file of files) {
    const text = await file.text();
    const { rows } = parseSourceCsv(source, text, fieldMapping);
    const resolved = resolveAll(rows, (mappings ?? []) as GameMapping[]);
    unresolvedThisUpload += resolved.filter((r) => r.needsReview).length;

    const { data: upload, error: uploadError } = await supabase
      .from("uploads")
      .insert({
        royalty_run_id: runId,
        source,
        filename: file.name,
        row_count: resolved.length,
      })
      .select("id")
      .single();
    if (uploadError) throw new Error(uploadError.message);

    if (resolved.length > 0) {
      const { error: txError } = await supabase.from("transactions").insert(
        resolved.map((r) => {
          const normalized = normalizeProductFields(
            r.productType,
            r.variant,
            normRules,
          );
          return {
            royalty_run_id: runId,
            upload_id: upload.id,
            source: r.source,
            sale_date: r.saleDate,
            raw_title: r.rawTitle,
            raw_sku: r.rawSku ?? null,
            game_name: r.gameName,
            publisher_id: r.publisherId,
            product_type: normalized.productType ?? null,
            listing_description: r.listingDescription,
            variant: normalized.variant ?? null,
            units_sold: r.unitsSold,
            unit_net: r.unitNet,
            total_net: r.totalNet,
            order_no: r.orderNo ?? null,
            ship_to_country: r.shipToCountry ?? null,
            sale_source: r.saleSource,
            royalty_applicable: r.royaltyApplicable,
            mapping_id: r.mappingId,
            needs_review: r.needsReview,
          };
        }),
      );
      if (txError) throw new Error(txError.message);
    }
  }

  revalidatePath(`/quarters/${runId}`);

  // Stop and force the unmatched rows to be resolved right away, rather
  // than silently leaving them for later — the review screen is the
  // "pause and ask for the missing details" step.
  if (unresolvedThisUpload > 0) {
    redirect(`/quarters/${runId}/review`);
  }
}

/**
 * Re-applies the current normalization rules to this quarter's already
 * uploaded transactions — so adding/editing a rule after uploading still
 * takes effect without re-uploading the file. Only rows whose normalized
 * value actually differs get written.
 */
export async function reapplyNormalization(runId: string) {
  await requireOwner();
  const supabase = createServiceClient();

  const [{ data: txRows }, { data: normalizations }] = await Promise.all([
    supabase
      .from("transactions")
      .select("id, product_type, variant")
      .eq("royalty_run_id", runId),
    supabase.from("product_normalizations").select("*"),
  ]);
  const normRules = (normalizations ?? []) as NormalizationRule[];

  let updated = 0;
  for (const row of txRows ?? []) {
    const normalized = normalizeProductFields(
      row.product_type ?? undefined,
      row.variant ?? undefined,
      normRules,
    );
    if (normalized.productType === row.product_type && normalized.variant === row.variant) continue;

    const { error } = await supabase
      .from("transactions")
      .update({ product_type: normalized.productType ?? null, variant: normalized.variant ?? null })
      .eq("id", row.id);
    if (error) throw new Error(error.message);
    updated += 1;
  }

  revalidatePath(`/quarters/${runId}`);
  return { updated };
}

export async function addManualRow(runId: string, formData: FormData) {
  await requireOwner();
  const supabase = createServiceClient();

  const royaltyApplicable = formData.get("royalty_applicable") === "on";
  const unitsSold = parseFloat(String(formData.get("units_sold") || "1"));
  const totalNet = parseFloat(String(formData.get("total_net") || "0"));
  const publisherId = String(formData.get("publisher_id") || "") || null;
  const saleSource =
    String(formData.get("sale_source") || "").trim() || "Manual";

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
    order_no: String(formData.get("order_no") || "").trim() || null,
    ship_to_country:
      String(formData.get("ship_to_country") || "").trim() || null,
    sale_source: saleSource,
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
  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", transactionId);
  if (error) throw new Error(error.message);
  revalidatePath(`/quarters/${runId}`);
}
