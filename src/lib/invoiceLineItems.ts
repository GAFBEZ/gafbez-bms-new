import type { InvoiceLineItem, QuoteSystemType } from "@/types";

/** Fixed category rows an invoice starts from -- unlike the Quote
 * Builder's free-form line items, these ids are stable slots (not
 * per-row random uuids), since there's always exactly one of each. Solar
 * Panels is the only row that depends on system type; "other" is the
 * one catch-all row for anything uncategorized, with its own editable
 * label instead of a fixed one. */
export const FIXED_LINE_ITEM_LABELS: Record<string, string> = {
  solar_panels: "Solar Panels",
  inverter: "Inverter",
  battery: "Battery",
  support_structure: "Support Structure",
  cable: "Cable",
  accessories: "Accessories",
  logistics_installation: "Logistics & Installation",
};

const FIXED_ORDER = [
  "solar_panels",
  "inverter",
  "battery",
  "support_structure",
  "cable",
  "accessories",
  "logistics_installation",
  "other",
];

function idsForSystemType(systemType: QuoteSystemType): string[] {
  return systemType === "inverter_only" ? FIXED_ORDER.filter((id) => id !== "solar_panels") : FIXED_ORDER;
}

function defaultLineItem(id: string): InvoiceLineItem {
  return {
    id,
    label: id === "other" ? "" : FIXED_LINE_ITEM_LABELS[id],
    description: "",
    productId: null,
    quantity: 0,
    unitPrice: 0,
  };
}

export function createDefaultLineItems(systemType: QuoteSystemType): InvoiceLineItem[] {
  return idsForSystemType(systemType).map(defaultLineItem);
}

/** Called when the System Type toggle changes on an in-progress invoice
 * -- adds/removes the Solar Panels row while preserving whatever's
 * already been entered on every other row, rather than resetting the
 * whole table back to blank. */
export function reconcileLineItemsForSystemType(
  items: InvoiceLineItem[],
  systemType: QuoteSystemType,
): InvoiceLineItem[] {
  const wantedIds = idsForSystemType(systemType);
  const byId = new Map(items.map((item) => [item.id, item]));

  return wantedIds.map((id) => byId.get(id) ?? defaultLineItem(id));
}
