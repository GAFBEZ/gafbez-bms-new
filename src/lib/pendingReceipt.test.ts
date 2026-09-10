import { describe, expect, it } from "vitest";
import { buildInvoiceLineItemsFromSaleItems, type PendingReceiptItem } from "./pendingReceipt";

function item(overrides: Partial<PendingReceiptItem> = {}): PendingReceiptItem {
  return { name: "Widget", category: "Misc", quantity: 1, unitPrice: 1000, ...overrides };
}

describe("buildInvoiceLineItemsFromSaleItems", () => {
  it("matches a product's category to the right fixed row", () => {
    const rows = buildInvoiceLineItemsFromSaleItems(
      [item({ name: "200Ah Battery", category: "Batteries", quantity: 2, unitPrice: 150000 })],
      "full_system",
    );

    const batteryRow = rows.find((row) => row.id === "battery")!;
    expect(batteryRow.description).toBe("200Ah Battery");
    expect(batteryRow.quantity).toBe(2);
    expect(batteryRow.unitPrice).toBe(150000);
  });

  it("falls back to the 'other' row for an unrecognized category, using the item name as the label", () => {
    const rows = buildInvoiceLineItemsFromSaleItems(
      [item({ name: "Extension Socket", category: "Random Stuff" })],
      "full_system",
    );

    const otherRow = rows.find((row) => row.id === "other")!;
    expect(otherRow.label).toBe("Extension Socket");
    expect(otherRow.description).toBe("Extension Socket");
  });

  it("combines multiple items landing on the same row while keeping the subtotal accurate", () => {
    const rows = buildInvoiceLineItemsFromSaleItems(
      [
        item({ name: "Cable A", category: "Cables", quantity: 2, unitPrice: 500 }),
        item({ name: "Cable B", category: "Cable", quantity: 1, unitPrice: 1200 }),
      ],
      "full_system",
    );

    const cableRow = rows.find((row) => row.id === "cable")!;
    expect(cableRow.quantity).toBe(1);
    expect(cableRow.unitPrice).toBe(2 * 500 + 1 * 1200);
    expect(cableRow.description).toContain("Cable A");
    expect(cableRow.description).toContain("Cable B");
  });

  it("never targets the solar_panels row for an inverter-only invoice", () => {
    const rows = buildInvoiceLineItemsFromSaleItems(
      [item({ name: "Mono Panel 400W", category: "Solar Panels" })],
      "inverter_only",
    );

    expect(rows.some((row) => row.id === "solar_panels")).toBe(false);
    const otherRow = rows.find((row) => row.id === "other")!;
    expect(otherRow.label).toBe("Mono Panel 400W");
  });

  it("leaves unmatched rows untouched", () => {
    const rows = buildInvoiceLineItemsFromSaleItems(
      [item({ name: "200Ah Battery", category: "Batteries" })],
      "full_system",
    );

    const inverterRow = rows.find((row) => row.id === "inverter")!;
    expect(inverterRow.quantity).toBe(0);
    expect(inverterRow.description).toBe("");
  });
});
