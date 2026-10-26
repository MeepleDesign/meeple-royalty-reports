import type { SupabaseClient } from "@supabase/supabase-js";

export async function getSetting(supabase: SupabaseClient, key: string): Promise<string | null> {
  const { data } = await supabase.from("app_settings").select("value").eq("key", key).maybeSingle();
  return data?.value ?? null;
}

export async function setSetting(supabase: SupabaseClient, key: string, value: string): Promise<void> {
  await supabase.from("app_settings").upsert({ key, value, updated_at: new Date().toISOString() });
}
