import { createClient } from "@supabase/supabase-js";

// Service-role client for server-only, cross-user operations (currently
// just: looking up a trader's email by id for the weekly digest cron,
// since Drizzle's `authUsers` reference intentionally only maps the `id`
// column — see the comment in lib/db/schema.ts on why that table's DDL is
// never touched by our migrations). Never import this from anything that
// runs in the browser.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY is not set");
  }
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
