"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/supabase/server-auth";
import { createServiceClient } from "@/lib/supabase/server";

export async function createPublisherQuick(name: string): Promise<{ id: string; name: string }> {
  await requireOwner();
  const supabase = createServiceClient();

  const trimmed = name.trim();
  if (!trimmed) throw new Error("Publisher name is required");

  const { data, error } = await supabase
    .from("publishers")
    .insert({ name: trimmed })
    .select("id, name")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/publishers");
  return data;
}
