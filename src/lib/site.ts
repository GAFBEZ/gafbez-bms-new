import { headers } from "next/headers";

/**
 * Origin of the public website, used to build the redirect link in
 * password-reset emails sent from this app's own /login page -- the
 * "choose a new password" page only exists on the website
 * (src/app/reset-password), not duplicated here. Defaults to the known
 * production domain so this works without any env var set, mirroring the
 * website repo's own getStaffAppUrl() fallback pattern. Override with
 * NEXT_PUBLIC_WEBSITE_URL for a staging/preview deploy that should link
 * back to its own preview website instead.
 */
export function getWebsiteUrl(): string {
  return process.env.NEXT_PUBLIC_WEBSITE_URL ?? "https://www.gafbezenergies.com";
}

/**
 * Origin of this app itself (not the public website -- see
 * getWebsiteUrl() above), derived from the incoming request so it works
 * for both local dev and prod without any env var set. Used by the
 * Quote Builder's PDF route (src/app/api/quote-builder/pdf) to build the
 * internal print-preview URL its headless Chromium instance navigates
 * to. Mirrors the public website repo's own getSiteOrigin() -- the first
 * and only place in this app that calls itself over HTTP.
 */
export async function getAppOrigin(): Promise<string> {
  const headersList = await headers();
  const host = headersList.get("x-forwarded-host") ?? headersList.get("host");
  if (!host) return "https://gafbez-bms-new.vercel.app";
  const proto = headersList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
