import { Plus, Save, Trash2 } from "lucide-react";
import type { QuoteLineItem, QuoteSystemType, SavedQuoteItem } from "@/types";
import { formatCurrency } from "@/lib/format";
import { computeLineAmount } from "@/lib/quoteCalculations";
import PrintValue from "./PrintValue";
import NumberInput from "./NumberInput";

export interface LineItemCatalogueOption {
  id: string;
  name: string;
  bonusCategory: "solar_panel" | "inverter" | "battery" | null;
  unit: string;
  shortDescription: string | null;
  sellPrice: number;
}

interface LineItemsTableProps {
  items: QuoteLineItem[];
  onChange: (items: QuoteLineItem[]) => void;
  catalogueOptions: LineItemCatalogueOption[];
  savedItems: SavedQuoteItem[];
  onSaveItem: (item: { name: string; description: string; rate: number }) => void;
  /** True while any save (quote or item) is in flight -- disables every
   * row's Save button so a rapid double-click can't fire the save twice
   * before the first request's result comes back. */
  saving: boolean;
  systemType: QuoteSystemType;
}

const CUSTOM_OPTION_VALUE = "__custom__";
const PRODUCT_PREFIX = "product:";
const SAVED_PREFIX = "saved:";

const fieldClasses =
  "w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-brand-green focus:outline-none focus:ring-2 focus:ring-brand-green/30 print:hidden";

function newLineItem(): QuoteLineItem {
  return {
    id: crypto.randomUUID(),
    productId: null,
    name: "",
    description: "",
    quantity: 1,
    rate: 0,
  };
}

export default function LineItemsTable({
  items,
  onChange,
  catalogueOptions,
  savedItems,
  onSaveItem,
  saving,
  systemType,
}: LineItemsTableProps) {
  const visibleOptions =
    systemType === "inverter_only"
      ? catalogueOptions.filter((option) => option.bonusCategory !== "solar_panel")
      : catalogueOptions;

  function updateItem(id: string, patch: Partial<QuoteLineItem>) {
    onChange(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function handleSelect(id: string, value: string) {
    if (value === CUSTOM_OPTION_VALUE) {
      updateItem(id, { productId: null, name: "", description: "" });
      return;
    }
    if (value.startsWith(PRODUCT_PREFIX)) {
      const product = visibleOptions.find((option) => option.id === value.slice(PRODUCT_PREFIX.length));
      if (!product) return;
      updateItem(id, {
        productId: product.id,
        name: product.name,
        description: product.shortDescription ?? "",
        rate: product.sellPrice,
      });
      return;
    }
    if (value.startsWith(SAVED_PREFIX)) {
      const saved = savedItems.find((option) => option.id === value.slice(SAVED_PREFIX.length));
      if (!saved) return;
      updateItem(id, { productId: null, name: saved.name, description: saved.description ?? "", rate: saved.rate });
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-xl border border-gray-200 print:overflow-visible print:rounded-none print:border-brand-green/40">
        <table className="min-w-full divide-y divide-gray-100 text-sm print:w-full print:table-fixed print:border-collapse print:divide-y-0 print:text-xs">
          <thead>
            <tr className="bg-amber-50 text-left text-xs font-bold uppercase tracking-wide text-brand-green">
              <th className="px-3 py-2.5 print:border print:border-brand-green/30 print:px-1.5 print:py-1">Item</th>
              <th className="px-3 py-2.5 print:border print:border-brand-green/30 print:px-1.5 print:py-1">Description</th>
              <th className="w-20 px-3 py-2.5 print:w-14 print:border print:border-brand-green/30 print:px-1.5 print:py-1">Qty</th>
              <th className="w-32 px-3 py-2.5 print:w-24 print:border print:border-brand-green/30 print:px-1.5 print:py-1">Rate</th>
              <th className="w-32 px-3 py-2.5 print:w-28 print:border print:border-brand-green/30 print:px-1.5 print:py-1">Amount</th>
              <th className="w-16 px-3 py-2.5 print:hidden" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 print:divide-y-0">
            {items.map((item, index) => (
              <tr
                key={item.id}
                className={`break-inside-avoid ${index % 2 === 1 ? "bg-gray-50 print:bg-gray-50" : ""}`}
              >
                <td className="px-3 py-2 align-top print:border print:border-brand-green/20 print:px-1.5 print:py-1">
                  <select
                    value={item.productId ? `${PRODUCT_PREFIX}${item.productId}` : CUSTOM_OPTION_VALUE}
                    onChange={(e) => handleSelect(item.id, e.target.value)}
                    className={`${fieldClasses} mb-1.5`}
                  >
                    <option value={CUSTOM_OPTION_VALUE}>Custom item…</option>
                    {savedItems.length > 0 && (
                      <optgroup label="Your Saved Items">
                        {savedItems.map((option) => (
                          <option key={option.id} value={`${SAVED_PREFIX}${option.id}`}>
                            {option.name}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    <optgroup label="Catalogue Products">
                      {visibleOptions.map((option) => (
                        <option key={option.id} value={`${PRODUCT_PREFIX}${option.id}`}>
                          {option.name}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => updateItem(item.id, { name: e.target.value })}
                    placeholder="Item name"
                    className={fieldClasses}
                  />
                  <PrintValue className="font-semibold text-brand-green">{item.name || "--"}</PrintValue>
                </td>
                <td className="px-3 py-2 align-top print:border print:border-brand-green/20 print:px-1.5 print:py-1">
                  <textarea
                    value={item.description}
                    onChange={(e) => updateItem(item.id, { description: e.target.value })}
                    placeholder="Description"
                    rows={2}
                    className={`${fieldClasses} resize-none`}
                  />
                  <PrintValue className="text-black">{item.description || "--"}</PrintValue>
                </td>
                <td className="px-3 py-2 align-top print:border print:border-brand-green/20 print:px-1.5 print:py-1">
                  <NumberInput
                    min={0}
                    value={item.quantity}
                    onChange={(quantity) => updateItem(item.id, { quantity })}
                    className={fieldClasses}
                  />
                  <PrintValue className="text-black">{item.quantity}</PrintValue>
                </td>
                <td className="px-3 py-2 align-top print:border print:border-brand-green/20 print:px-1.5 print:py-1">
                  <NumberInput
                    min={0}
                    value={item.rate}
                    onChange={(rate) => updateItem(item.id, { rate })}
                    className={fieldClasses}
                  />
                  <PrintValue className="text-black">{formatCurrency(item.rate)}</PrintValue>
                </td>
                <td className="whitespace-nowrap px-3 py-2 align-top font-bold text-brand-green print:border print:border-brand-green/20 print:px-1.5 print:py-1">
                  {formatCurrency(computeLineAmount(item))}
                </td>
                <td className="px-3 py-2 align-top print:hidden">
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => onSaveItem({ name: item.name, description: item.description, rate: item.rate })}
                      disabled={!item.name.trim() || saving}
                      aria-label="Save this item for future quotes"
                      title="Save for future quotes"
                      className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-green-50 hover:text-brand-green disabled:pointer-events-none disabled:opacity-30"
                    >
                      <Save className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onChange(items.filter((i) => i.id !== item.id))}
                      aria-label="Remove line"
                      className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-sm text-gray-500 print:hidden">
                  No items yet -- add your first line below.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={() => onChange([...items, newLineItem()])}
        className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-gray-300 px-3.5 py-2 text-sm font-semibold text-brand-green transition-colors hover:bg-green-50 print:hidden"
      >
        <Plus className="h-4 w-4" />
        Add Line
      </button>
    </div>
  );
}
