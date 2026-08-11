import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * The one Supabase client in this project that uses the service_role key
 * -- it bypasses Row Level Security entirely and can call the Auth Admin
 * API (auth.admin.*), which no regular authenticated client can. Used
 * ONLY for admin-triggered account deletion (see websiteCustomerActions.ts)
 * -- deleting a customer_profiles row requires deleting the underlying
 * auth.users row for it to cascade (0029_customer_accounts_and_cart.sql),
 * and that's a platform-level operation, not something a Postgres RPC
 * can do on its own.
 *
 * `import "server-only"` makes it a build error to ever import this
 * module from a Client Component. `SUPABASE_SERVICE_ROLE_KEY` has no
 * `NEXT_PUBLIC_` counterpart on purpose -- never expose it client-side.
 */
export function hasServiceRoleConfig(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function createServiceRoleClient() {
  if (!hasServiceRoleConfig()) {
    throw new Error("Supabase service role is not configured: set SUPABASE_SERVICE_ROLE_KEY.");
  }
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}
