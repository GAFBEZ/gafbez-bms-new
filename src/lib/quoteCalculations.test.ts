import { describe, expect, it } from "vitest";
import { autoFillLoadCalcFromLineItems, computeGrandTotal, computeLineAmount, computeSubtotal } from "./quoteCalculations";
import type { QuoteLineItem } from "@/types";

function makeItem(overrides: Partial<QuoteLineItem> = {}): QuoteLineItem {
  return {
    id: crypto.randomUUID(),
    productId: null,
    name: "",
    description: "",
    quantity: 1,
    rate: 0,
    ...overrides,
  };
}

describe("computeLineAmount", () => {
  it("multiplies quantity by rate", () => {
    expect(computeLineAmount({ quantity: 3, rate: 50000 })).toBe(150000);
  });
});

describe("computeSubtotal", () => {
  it("sums the amount of every line item", () => {
    const items = [makeItem({ quantity: 2, rate: 1000 }), makeItem({ quantity: 1, rate: 2500 })];
    expect(computeSubtotal(items)).toBe(4500);
  });

  it("returns 0 for an empty quote", () => {
    expect(computeSubtotal([])).toBe(0);
  });
});

describe("computeGrandTotal", () => {
  it("applies VAT on top of the subtotal", () => {
    expect(computeGrandTotal(100000, 7.5)).toBe(107500);
  });

  it("returns the subtotal unchanged at 0% VAT", () => {
    expect(computeGrandTotal(100000, 0)).toBe(100000);
  });
});

describe("autoFillLoadCalcFromLineItems", () => {
  it("sums inverter kVA across matching line items", () => {
    const items = [makeItem({ name: "5kVA Inverter", quantity: 2 })];
    const result = autoFillLoadCalcFromLineItems(items, new Map());
    expect(result.inverterSizeKva).toBe(10);
  });

  it("sums battery kWh across matching line items", () => {
    const items = [makeItem({ name: "5kWh Lithium Battery", quantity: 3 })];
    const result = autoFillLoadCalcFromLineItems(items, new Map());
    expect(result.batteryCapacityKwh).toBe(15);
  });

  it("prefers the catalogue's known bonus_category over name-guessing", () => {
    const items = [makeItem({ productId: "prod-1", name: "5kWh Unit X" })];
    const catalogue = new Map<string, "solar_panel" | "inverter" | "battery" | null>([["prod-1", "battery"]]);
    const result = autoFillLoadCalcFromLineItems(items, catalogue);
    expect(result.batteryCapacityKwh).toBe(5);
  });

  it("returns all nulls when nothing parses", () => {
    const items = [makeItem({ name: "Installation & Commissioning" })];
    const result = autoFillLoadCalcFromLineItems(items, new Map());
    expect(result).toEqual({ inverterSizeKva: null, batteryCapacityKwh: null, solarArrayKw: null });
  });
});
