"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/supabase/server-auth";
import { createServiceClient } from "@/lib/supabase/server";
import { quarterDateRange } from "@/lib/royalty/quarter";

export async function createQuarter(formData: FormData) {
  await requireOwner();
  const year = parseInt(String(formData.get("year")), 10);
  const quarter = parseInt(String(formData.get("quarter")), 10);
  const { start, end } = quarterDateRange(year, quarter);

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("royalty_runs")
    .insert({ year, quarter, start_date: start, end_date: end })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/");
  redirect(`/quarters/${data.id}`);
}
