import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser client, used only for the login screen (Supabase Auth).
 * All data reads/writes happen server-side via createServiceClient.
 */
export function createBrowserSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
