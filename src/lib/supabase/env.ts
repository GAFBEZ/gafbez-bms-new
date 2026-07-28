/**
 * Root domain the auth session cookie should be scoped to (e.g.
 * ".gafbezenergies.com"), so a staff account that signs in on the sibling
 * public website is already recognised here on a staff.<domain>
 * subdomain, without a second login. Unset in every environment today
 * (including this project's current *.vercel.app URL, where a shared
 * cookie domain wouldn't work anyway since vercel.app is a public suffix).
 * Leaving it unset is a safe no-op: @supabase/ssr falls back to a plain
 * host-only cookie, identical to today's behaviour. The website repo has
 * the exact same env var, and both must be set to the same value for
 * cross-subdomain sign-in to work once a real domain exists.
 */
export const AUTH_COOKIE_DOMAIN = process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN || undefined;
