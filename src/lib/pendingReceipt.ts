import type { InvoiceLineItem, QuoteSystemType } from "@/types";
import { createDefaultLineItems } from "./invoiceLineItems";

const STORAGE_KEY = "gafbez:pendingReceipt";

export interface PendingReceiptItem {
  name: string;
  category: string;
  quantity: number;
  unitPrice: number;
}

export interface PendingReceiptData {
  customerName: string;
  items: PendingReceiptItem[];
}

/** Handoff from Daily Sales' "Record Sale" form to the Invoice/Receipt
 * Builder's "new" page -- Daily Sales stashes the just-recorded sale's
 * customer name and line items here right before submitting, and the
 * Invoice Builder reads + clears it on mount if it's starting blank. Kept
 * in sessionStorage (not a URL param or server round-trip) since the two
 * features have entirely separate data models and this is a one-time,
 * this-tab-only convenience rather than persisted state. */
export function savePendingReceipt(data: PendingReceiptData): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // sessionStorage can throw in rare browser configurations (private
    // mode quirks, storage disabled) -- losing the prefill isn't fatal.
  }
}

export function peekPendingReceipt(): PendingReceiptData | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PendingReceiptData) : null;
  } catch {
    return null;
  }
}

export function clearPendingReceipt(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

const SLOT_KEYWORDS: Record<string, string[]> = {
  solar_panels: ["solar panel", "panel"],
  inverter: ["inverter"],
  battery: ["battery", "batteries"],
  support_structure: ["structure", "mounting", "bracket", "stand"],
  cable: ["cable", "wire"],
  accessories: ["accessor"],
  logistics_installation: ["installation", "logistics", "labour", "labor"],
};

function matchSlotId(category: string, availableIds: Set<string>): string {
  const normalized = category.toLowerCase();
  for (const [slotId, keywords] of Object.entries(SLOT_KEYWORDS)) {
    if (availableIds.has(slotId) && keywords.some((keyword) => normalized.includes(keyword))) {
      return slotId;
    }
  }
  return "other";
}

/** Turns an arbitrary Daily Sales cart into the Invoice Builder's fixed
 * category rows: each item is matched to a row by keyword-matching its
 * product category (falling back to the catch-all "other" row), so a
 * typical sale (panels/inverter/battery/cable/etc.) lands in the right
 * place automatically. When more than one item lands on the same row,
 * they're combined into a single description rather than lost -- this
 * format has exactly one row per category, not a repeatable list, so a
 * two-battery-brand sale still totals correctly even though the detail
 * is now text instead of two separate rows. */
export function buildInvoiceLineItemsFromSaleItems(
  items: PendingReceiptItem[],
  systemType: QuoteSystemType,
): InvoiceLineItem[] {
  const base = createDefaultLineItems(systemType);
  const availableIds = new Set(base.map((row) => row.id));
  const bySlot = new Map<string, PendingReceiptItem[]>();

  for (const item of items) {
    const slotId = matchSlotId(item.category, availableIds);
    const bucket = bySlot.get(slotId) ?? [];
    bucket.push(item);
    bySlot.set(slotId, bucket);
  }

  return base.map((row) => {
    const bucket = bySlot.get(row.id);
    if (!bucket || bucket.length === 0) return row;

    if (bucket.length === 1) {
      const [item] = bucket;
      return {
        ...row,
        label: row.id === "other" ? item.name : row.label,
        description: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      };
    }

    const combinedSubtotal = bucket.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    return {
      ...row,
      label: row.id === "other" ? "Other items" : row.label,
      description: bucket.map((item) => `${item.quantity} x ${item.name}`).join("; "),
      quantity: 1,
      unitPrice: combinedSubtotal,
    };
  });
}
