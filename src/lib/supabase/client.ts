import { createBrowserClient } from "@supabase/ssr";
import { AUTH_COOKIE_DOMAIN } from "./env";

/**
 * Supabase client for use in Client Components (browser).
 * Create a fresh instance per call site rather than a module-level singleton.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookieOptions: { domain: AUTH_COOKIE_DOMAIN } },
  );
}
