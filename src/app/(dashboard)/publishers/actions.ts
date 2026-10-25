"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/supabase/server-auth";
import { createServiceClient } from "@/lib/supabase/server";

function parsePublisherForm(formData: FormData) {
  const paymentBasis = String(formData.get("payment_basis") || "quarterly");
  const rollForward = formData.get("roll_forward") === "on";
  const thresholdRaw = String(formData.get("payout_threshold") || "").trim();

  return {
    name: String(formData.get("name") || "").trim(),
    royalty_rate: parseFloat(String(formData.get("royalty_rate") || "10")) / 100,
    payment_basis: paymentBasis,
    annual_due_quarter: parseInt(String(formData.get("annual_due_quarter") || "4"), 10),
    roll_forward: rollForward,
    payout_threshold: rollForward && thresholdRaw ? parseFloat(thresholdRaw) : null,
    contact_email: String(formData.get("contact_email") || "").trim() || null,
    email_template: String(formData.get("email_template") || "").trim() || null,
    notes: String(formData.get("notes") || "").trim() || null,
  };
}

export async function createPublisher(formData: FormData) {
  await requireOwner();
  const supabase = createServiceClient();
  const values = parsePublisherForm(formData);

  if (!values.name) throw new Error("Publisher name is required");

  const { error } = await supabase.from("publishers").insert(values);
  if (error) throw new Error(error.message);

  revalidatePath("/publishers");
  redirect("/publishers");
}

export async function updatePublisher(publisherId: string, formData: FormData) {
  await requireOwner();
  const supabase = createServiceClient();
  const values = parsePublisherForm(formData);

  if (!values.name) throw new Error("Publisher name is required");

  const { error } = await supabase.from("publishers").update(values).eq("id", publisherId);
  if (error) throw new Error(error.message);

  revalidatePath("/publishers");
  redirect("/publishers");
}

export async function deletePublisher(publisherId: string) {
  await requireOwner();
  const supabase = createServiceClient();
  const { error } = await supabase.from("publishers").delete().eq("id", publisherId);
  if (error) throw new Error(error.message);
  revalidatePath("/publishers");
}
