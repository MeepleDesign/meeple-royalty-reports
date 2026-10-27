"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/supabase/server-auth";
import { createServiceClient } from "@/lib/supabase/server";

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
