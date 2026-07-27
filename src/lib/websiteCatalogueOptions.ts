/**
 * Editable suggestions for the Website Details tab's Category/Brand
 * fields -- NOT database enums. `products.category` has always been free
 * text (see 0003_products.sql) and `products.brand` (0028_website_catalogue.sql)
 * is the same: both are plain `text` columns with no CHECK-constrained
 * value list, so any string is accepted. These arrays only drive the
 * `<datalist>` suggestions in the UI (see ProductWebsiteDetailsForm) --
 * admins can always type something not on the list.
 */

export const WEBSITE_CATEGORY_SUGGESTIONS = [
  "Solar Panels",
  "Inverters",
  "Lithium Batteries",
  "Accessories",
] as const;

export const INVERTER_BRAND_SUGGESTIONS = [
  "Felicity",
  "Cworth",
  "Firman",
  "Deye",
  "Growatt",
  "Must",
  "LVTopsun",
] as const;

export const LITHIUM_BATTERY_BRAND_SUGGESTIONS = [
  "Felicity",
  "Cworth",
  "Firman",
  "Deye",
  "Growatt",
  "Must",
  "LVTopsun",
  "Deriy",
] as const;

export const SOLAR_PANEL_BRAND_SUGGESTIONS = ["Cworth", "JA Solar", "Jinko", "Longi"] as const;

/** Union of every brand suggestion across categories, de-duplicated, for
 * when the selected category doesn't match one of the three lists above
 * (e.g. "Accessories") -- still gives the admin a reasonable starting list
 * instead of an empty datalist. */
export const ALL_BRAND_SUGGESTIONS = Array.from(
  new Set([
    ...INVERTER_BRAND_SUGGESTIONS,
    ...LITHIUM_BATTERY_BRAND_SUGGESTIONS,
    ...SOLAR_PANEL_BRAND_SUGGESTIONS,
  ]),
).sort();

/** Picks the most relevant brand suggestion list for a given (free-text)
 * category value. Falls back to the full union for anything that doesn't
 * match a known category string. */
export function brandSuggestionsForCategory(category: string): readonly string[] {
  const normalized = category.trim().toLowerCase();
  if (normalized.includes("inverter")) return INVERTER_BRAND_SUGGESTIONS;
  if (normalized.includes("batter")) return LITHIUM_BATTERY_BRAND_SUGGESTIONS;
  if (normalized.includes("panel") || normalized.includes("solar")) {
    return SOLAR_PANEL_BRAND_SUGGESTIONS;
  }
  return ALL_BRAND_SUGGESTIONS;
}

/** Starter key/value pairs for the Specification Editor, seeded by
 * category so a fresh product doesn't start from a totally blank list.
 * Purely a UI convenience -- specifications is still free-form JSON, admins
 * can add, rename, or remove any row. */
export const SPECIFICATION_TEMPLATES: Record<string, string[]> = {
  Inverters: [
    "Rated capacity",
    "Power factor",
    "Maximum PV input",
    "Maximum PV voltage",
    "MPPT voltage range",
    "Number of MPPTs",
    "Maximum current per MPPT",
    "Parallel support",
    "Maximum parallel units",
  ],
  "Lithium Batteries": [
    "Energy capacity",
    "Nominal voltage",
    "Depth of discharge",
    "Cycle life",
    "Communication type",
    "Warranty",
  ],
  "Solar Panels": [
    "Rated wattage",
    "Open-circuit voltage",
    "Maximum-power voltage",
    "Short-circuit current",
    "Maximum-power current",
    "Dimensions",
    "Warranty",
  ],
};

export function specificationTemplateForCategory(category: string): string[] {
  const normalized = category.trim().toLowerCase();
  const match = Object.keys(SPECIFICATION_TEMPLATES).find((key) =>
    normalized.includes(key.toLowerCase().replace(/s$/, "")),
  );
  return match ? SPECIFICATION_TEMPLATES[match] : [];
}
