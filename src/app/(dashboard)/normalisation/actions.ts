"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/supabase/server-auth";
import { createServiceClient } from "@/lib/supabase/server";

function parseForm(formData: FormData) {
  return {
    raw_field: String(formData.get("raw_field") || "product_type"),
    match_type: String(formData.get("match_type") || "exact"),
    raw_pattern: String(formData.get("raw_pattern") || "").trim(),
    canonical_value: String(formData.get("canonical_value") || "").trim(),
    priority: parseInt(String(formData.get("priority") || "0"), 10),
    notes: String(formData.get("notes") || "").trim() || null,
  };
}

export async function createNormalisation(formData: FormData) {
  await requireOwner();
  const supabase = createServiceClient();
  const values = parseForm(formData);

  if (!values.raw_pattern || !values.canonical_value) {
    throw new Error("Raw pattern and canonical value are required");
  }

  const { error } = await supabase.from("product_normalizations").insert(values);
  if (error) throw new Error(error.message);

  revalidatePath("/normalisation");
  redirect("/normalisation");
}

export async function updateNormalisation(id: string, formData: FormData) {
  await requireOwner();
  const supabase = createServiceClient();
  const values = parseForm(formData);

  if (!values.raw_pattern || !values.canonical_value) {
    throw new Error("Raw pattern and canonical value are required");
  }

  const { error } = await supabase.from("product_normalizations").update(values).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/normalisation");
  redirect("/normalisation");
}

export async function deleteNormalisation(id: string) {
  await requireOwner();
  const supabase = createServiceClient();
  const { error } = await supabase.from("product_normalizations").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/normalisation");
}
