"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/supabase/server-auth";
import { createServiceClient } from "@/lib/supabase/server";
import { reapplyNormalisation } from "../actions";

async function upsertNormalisationRule(
  supabase: ReturnType<typeof createServiceClient>,
  rawField: "product_type" | "variant",
  rawPattern: string,
  canonicalValue: string
) {
  const { data: existing } = await supabase
    .from("product_normalizations")
    .select("id")
    .eq("raw_field", rawField)
    .eq("match_type", "exact")
    .ilike("raw_pattern", rawPattern)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("product_normalizations")
      .update({ canonical_value: canonicalValue })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("product_normalizations").insert({
      raw_field: rawField,
      match_type: "exact",
      raw_pattern: rawPattern,
      canonical_value: canonicalValue,
      priority: 0,
    });
    if (error) throw new Error(error.message);
  }
}

/**
 * "This is actually the same as <existing priced product>" — instead of adding
 * a duplicate price, creates normalisation rule(s) mapping the gap's raw
 * product type/variant to an already-priced canonical one, then re-applies
 * normalisation to this quarter immediately so the gap disappears without a
 * re-upload.
 */
export async function mapGapToExistingProduct(runId: string, formData: FormData) {
  await requireOwner();
  const supabase = createServiceClient();

  const rawProductType = String(formData.get("raw_product_type") || "").trim();
  const rawVariant = String(formData.get("raw_variant") || "").trim();
  const canonical = String(formData.get("canonical") || "");
  const [canonicalProductType, canonicalVariant] = canonical.split("||");

  if (!rawProductType || !canonicalProductType) {
    throw new Error("Pick an existing product to map this to");
  }

  if (rawProductType.toLowerCase() !== canonicalProductType.trim().toLowerCase()) {
    await upsertNormalisationRule(supabase, "product_type", rawProductType, canonicalProductType.trim());
  }
  if (rawVariant && rawVariant.toLowerCase() !== (canonicalVariant ?? "").trim().toLowerCase()) {
    await upsertNormalisationRule(supabase, "variant", rawVariant, (canonicalVariant ?? "").trim());
  }

  await reapplyNormalisation(runId);

  revalidatePath(`/quarters/${runId}/pricing-review`);
  revalidatePath(`/quarters/${runId}`);
  revalidatePath("/normalisation");
}

export async function addMissingPrice(runId: string, formData: FormData) {
  await requireOwner();
  const supabase = createServiceClient();

  const productType = String(formData.get("product_type") || "").trim();
  const variant = String(formData.get("variant") || "").trim() || null;
  const unitNet = parseFloat(String(formData.get("unit_net") || ""));

  if (!productType || Number.isNaN(unitNet)) {
    throw new Error("Product type and a valid unit NET price are required");
  }

  const { error } = await supabase.from("product_prices").insert({ product_type: productType, variant, unit_net: unitNet });
  if (error) throw new Error(error.message);

  revalidatePath(`/quarters/${runId}/pricing-review`);
  revalidatePath(`/quarters/${runId}`);
  revalidatePath("/prices");
}
