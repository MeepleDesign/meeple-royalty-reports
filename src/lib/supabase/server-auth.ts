import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Auth-aware server client for use in Server Components / Server Actions
 * (reads the session cookie). Use createServiceClient() instead for actual
 * table reads/writes.
 */
export async function createServerAuthClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // called from a Server Component with no response to write to; middleware refreshes it instead.
          }
        },
      },
    }
  );
}

export async function requireOwner() {
  const supabase = await createServerAuthClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user || data.user.email !== process.env.APP_OWNER_EMAIL) {
    throw new Error("Not authorized");
  }
  return data.user;
}
