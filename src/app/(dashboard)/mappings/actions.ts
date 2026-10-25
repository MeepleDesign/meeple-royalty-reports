"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/supabase/server-auth";
import { createServiceClient } from "@/lib/supabase/server";

function parseMappingForm(formData: FormData) {
  return {
    source: String(formData.get("source") || "any"),
    match_field: String(formData.get("match_field") || "title"),
    match_type: String(formData.get("match_type") || "contains"),
    match_pattern: String(formData.get("match_pattern") || "").trim(),
    game_name: String(formData.get("game_name") || "").trim(),
    publisher_id: String(formData.get("publisher_id") || "") || null,
    royalty_applicable: formData.get("royalty_applicable") === "on",
    product_type_override: String(formData.get("product_type_override") || "").trim() || null,
    priority: parseInt(String(formData.get("priority") || "0"), 10),
    notes: String(formData.get("notes") || "").trim() || null,
  };
}

export async function createMapping(formData: FormData) {
  await requireOwner();
  const supabase = createServiceClient();
  const values = parseMappingForm(formData);

  if (!values.match_pattern || !values.game_name) {
    throw new Error("Match pattern and game name are required");
  }

  const { error } = await supabase.from("game_mappings").insert(values);
  if (error) throw new Error(error.message);

  revalidatePath("/mappings");
  redirect("/mappings");
}

export async function updateMapping(mappingId: string, formData: FormData) {
  await requireOwner();
  const supabase = createServiceClient();
  const values = parseMappingForm(formData);

  if (!values.match_pattern || !values.game_name) {
    throw new Error("Match pattern and game name are required");
  }

  const { error } = await supabase.from("game_mappings").update(values).eq("id", mappingId);
  if (error) throw new Error(error.message);

  revalidatePath("/mappings");
  redirect("/mappings");
}

export async function deleteMapping(mappingId: string) {
  await requireOwner();
  const supabase = createServiceClient();
  const { error } = await supabase.from("game_mappings").delete().eq("id", mappingId);
  if (error) throw new Error(error.message);
  revalidatePath("/mappings");
}
