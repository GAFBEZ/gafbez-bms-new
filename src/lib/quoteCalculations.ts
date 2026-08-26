import type { BonusCategory, QuoteLineItem } from "@/types";

/** Rounds to the nearest whole Naira -- quotes never show kobo, matching
 * formatCurrency's maximumFractionDigits: 0 elsewhere in this app. */
function round(amount: number): number {
  return Math.round(amount);
}

export function computeLineAmount(item: Pick<QuoteLineItem, "quantity" | "rate">): number {
  return round(item.quantity * item.rate);
}

export function computeSubtotal(items: QuoteLineItem[]): number {
  return items.reduce((sum, item) => sum + computeLineAmount(item), 0);
}

export function computeGrandTotal(subtotal: number, vatPercent: number): number {
  return round(subtotal * (1 + vatPercent / 100));
}

/** Best-effort: the products table has no structured "capacity" field, so
 * a line item's kVA/kW/kWh rating only exists embedded in its product
 * name (e.g. "5kVA Inverter", "5kWh Lithium Battery"). This pulls the
 * first such number out of the name/description. The result is always
 * shown as an editable starting point in the Load Calculator, never
 * locked -- a name that doesn't parse just contributes nothing rather
 * than guessing wrong. */
function extractCapacity(text: string): number | null {
  const match = text.match(/(\d+(?:\.\d+)?)\s*k(?:va|wh|w)\b/i);
  return match ? Number(match[1]) : null;
}

function inferCategoryFromName(name: string): BonusCategory | null {
  const lower = name.toLowerCase();
  if (lower.includes("inverter")) return "inverter";
  if (lower.includes("batter")) return "battery";
  if (lower.includes("panel") || lower.includes("solar")) return "solar_panel";
  return null;
}

export interface LoadCalcAutoFillResult {
  inverterSizeKva: number | null;
  batteryCapacityKwh: number | null;
  solarArrayKw: number | null;
}

export function autoFillLoadCalcFromLineItems(
  items: QuoteLineItem[],
  catalogueBonusCategoryById: Map<string, BonusCategory | null>,
): LoadCalcAutoFillResult {
  let inverterKva = 0;
  let batteryKwh = 0;
  let solarKw = 0;

  for (const item of items) {
    const capacity = extractCapacity(item.name) ?? extractCapacity(item.description);
    if (capacity === null) continue;

    const category = (item.productId ? catalogueBonusCategoryById.get(item.productId) : null) ?? inferCategoryFromName(item.name);

    if (category === "inverter") inverterKva += capacity * item.quantity;
    else if (category === "battery") batteryKwh += capacity * item.quantity;
    else if (category === "solar_panel") solarKw += capacity * item.quantity;
  }

  return {
    inverterSizeKva: inverterKva || null,
    batteryCapacityKwh: batteryKwh || null,
    solarArrayKw: solarKw || null,
  };
}
