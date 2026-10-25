"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/supabase/server-auth";
import { createServiceClient } from "@/lib/supabase/server";

const FIELDS = ["sale_date", "title", "sku", "variant", "product_type", "units_sold", "total_net", "status"] as const;

export async function saveSourceMapping(source: "etsy" | "shopify" | "redbubble", formData: FormData) {
  await requireOwner();
  const supabase = createServiceClient();

  const toUpsert: { source: string; standard_field: string; source_column: string }[] = [];
  const toDelete: string[] = [];

  for (const field of FIELDS) {
    const value = String(formData.get(field) || "").trim();
    if (value) {
      toUpsert.push({ source, standard_field: field, source_column: value });
    } else {
      toDelete.push(field);
    }
  }

  if (toUpsert.length > 0) {
    const { error } = await supabase
      .from("source_field_mappings")
      .upsert(toUpsert, { onConflict: "source,standard_field" });
    if (error) throw new Error(error.message);
  }

  if (toDelete.length > 0) {
    const { error } = await supabase
      .from("source_field_mappings")
      .delete()
      .eq("source", source)
      .in("standard_field", toDelete);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/sources");
}
