"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/supabase/server-auth";
import { createServiceClient } from "@/lib/supabase/server";

function parsePriceForm(formData: FormData) {
  return {
    product_type: String(formData.get("product_type") || "").trim(),
    variant: String(formData.get("variant") || "").trim() || null,
    unit_net: parseFloat(String(formData.get("unit_net") || "0")),
    notes: String(formData.get("notes") || "").trim() || null,
  };
}

export async function createPrice(formData: FormData) {
  await requireOwner();
  const supabase = createServiceClient();
  const values = parsePriceForm(formData);

  if (!values.product_type) throw new Error("Product type is required");

  const { error } = await supabase.from("product_prices").insert(values);
  if (error) throw new Error(error.message);

  revalidatePath("/prices");
  redirect("/prices");
}

export async function updatePrice(priceId: string, formData: FormData) {
  await requireOwner();
  const supabase = createServiceClient();
  const values = parsePriceForm(formData);

  if (!values.product_type) throw new Error("Product type is required");

  const { error } = await supabase.from("product_prices").update(values).eq("id", priceId);
  if (error) throw new Error(error.message);

  revalidatePath("/prices");
  redirect("/prices");
}

export async function deletePrice(priceId: string) {
  await requireOwner();
  const supabase = createServiceClient();
  const { error } = await supabase.from("product_prices").delete().eq("id", priceId);
  if (error) throw new Error(error.message);
  revalidatePath("/prices");
}
