import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { AUTH_COOKIE_DOMAIN } from "./env";

/**
 * Supabase client for use in Server Components, Server Actions, and Route
 * Handlers. Always create a new instance per request rather than reusing one
 * across requests.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookieOptions: { domain: AUTH_COOKIE_DOMAIN },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // setAll was called from a Server Component that can't write
            // cookies. Safe to ignore once session-refresh proxy exists
            // (added in the authentication stage).
          }
        },
      },
    },
  );
}
