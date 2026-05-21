import { createClient as createSbClient } from "@supabase/supabase-js";

// Server-only client that uses the service role. Bypasses RLS — never expose to the browser.
// Use sparingly, only when an authenticated server action genuinely needs elevated access
// (e.g. bootstrap, soft-delete of admin-only data).
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createSbClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
