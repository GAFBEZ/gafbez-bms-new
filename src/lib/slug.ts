/** Turns free text into a URL-safe slug: lowercase, alphanumeric runs
 * joined by single hyphens, no leading/trailing hyphen. E.g. "Cworth 15kW
 * Lithium Battery" -> "cworth-15kw-lithium-battery". */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
