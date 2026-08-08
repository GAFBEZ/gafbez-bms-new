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
