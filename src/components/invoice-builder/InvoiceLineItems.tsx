import type { InvoiceLineItem, QuoteSystemType, SavedQuoteItem } from "@/types";
import type { LineItemCatalogueOption } from "@/components/quote-builder/LineItemsTable";
import { formatCurrency } from "@/lib/format";
import { computeLineAmount } from "@/lib/invoiceCalculations";
import PrintValue from "@/components/quote-builder/PrintValue";
import NumberInput from "@/components/quote-builder/NumberInput";

interface InvoiceLineItemsProps {
  items: InvoiceLineItem[];
  onChange: (items: InvoiceLineItem[]) => void;
  catalogueOptions: LineItemCatalogueOption[];
  savedItems: SavedQuoteItem[];
  systemType: QuoteSystemType;
}

const CUSTOM_OPTION_VALUE = "__custom__";
const PRODUCT_PREFIX = "product:";
const SAVED_PREFIX = "saved:";

const fieldClasses =
  "w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-brand-green focus:outline-none focus:ring-2 focus:ring-brand-green/30 print:hidden";

/**
 * Fixed category rows (Solar Panels/Inverter/Battery/Support Structure/
 * Cable/Accessories/Logistics & Installation/Other) rather than the
 * Quote Builder's free-form add/remove list -- matches the paper invoice
 * template this is based on, where every category has exactly one line.
 * Which rows exist (Solar Panels present or not) is decided by
 * lib/invoiceLineItems.ts based on system type, not by this component.
 *
 * The Item/Description picker itself is a direct port of the Quote
 * Builder's LineItemsTable (same catalogue/saved-item dropdown, same
 * PRODUCT_PREFIX/SAVED_PREFIX convention) so both documents work the
 * same way -- the only difference is rows here are fixed slots instead
 * of a free add/remove list, so there's no per-row delete/save button.
 */
export default function InvoiceLineItems({ items, onChange, catalogueOptions, savedItems, systemType }: InvoiceLineItemsProps) {
  const visibleOptions =
    systemType === "inverter_only"
      ? catalogueOptions.filter((option) => option.bonusCategory !== "solar_panel")
      : catalogueOptions;

  function updateItem(id: string, patch: Partial<InvoiceLineItem>) {
    onChange(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function handleSelect(id: string, value: string) {
    if (value === CUSTOM_OPTION_VALUE) {
      // Unlike the Quote Builder's free-form rows, these are fixed
      // category slots with a sensible default name ("Inverter", etc.)
      // -- switching back to "Custom item..." only clears the product
      // link, it doesn't wipe out that default or whatever's been typed.
      updateItem(id, { productId: null });
      return;
    }
    if (value.startsWith(PRODUCT_PREFIX)) {
      const product = visibleOptions.find((option) => option.id === value.slice(PRODUCT_PREFIX.length));
      if (!product) return;
      updateItem(id, {
        productId: product.id,
        label: product.name,
        description: product.shortDescription ?? "",
        unitPrice: product.sellPrice,
      });
      return;
    }
    if (value.startsWith(SAVED_PREFIX)) {
      const saved = savedItems.find((option) => option.id === value.slice(SAVED_PREFIX.length));
      if (!saved) return;
      updateItem(id, { productId: null, label: saved.name, description: saved.description ?? "", unitPrice: saved.rate });
    }
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 print:overflow-visible print:rounded-none print:border-brand-green/40">
      <table className="w-full min-w-[720px] divide-y divide-gray-100 text-sm print:w-full print:min-w-0 print:table-fixed print:border-collapse print:divide-y-0 print:text-xs">
        <thead>
          <tr className="bg-amber-50 text-left text-xs font-bold uppercase tracking-wide text-brand-green">
            <th className="w-10 px-3 py-2 print:w-[5%] print:border print:border-brand-green/30 print:px-1.5 print:py-1">S/N</th>
            <th className="px-3 py-2 print:w-[20%] print:border print:border-brand-green/30 print:px-1.5 print:py-1">Item</th>
            <th className="px-3 py-2 print:w-[40%] print:border print:border-brand-green/30 print:px-1.5 print:py-1">Description</th>
            <th className="w-20 px-3 py-2 print:w-[8%] print:border print:border-brand-green/30 print:px-1.5 print:py-1">Qty</th>
            <th className="w-28 px-3 py-2 print:w-[12%] print:border print:border-brand-green/30 print:px-1.5 print:py-1">
              Unit Price
            </th>
            <th className="w-28 px-3 py-2 print:w-[15%] print:border print:border-brand-green/30 print:px-1.5 print:py-1">
              Amount
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 print:divide-y-0">
          {items.map((item, index) => (
            <tr key={item.id} className={`avoid-page-break ${index % 2 === 1 ? "bg-gray-50 print:bg-gray-50" : ""}`}>
              <td className="px-3 py-1.5 align-top font-semibold text-black print:border print:border-brand-green/20 print:px-1.5 print:py-0.5">
                {index + 1}
              </td>
              <td className="px-3 py-1.5 align-top print:border print:border-brand-green/20 print:px-1.5 print:py-0.5">
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
                  value={item.label}
                  onChange={(e) => updateItem(item.id, { label: e.target.value })}
                  placeholder={item.id === "other" ? "Other (specify)" : "Item name"}
                  className={fieldClasses}
                />
                <PrintValue className="font-semibold text-brand-green print:leading-tight">{item.label || "--"}</PrintValue>
              </td>
              <td className="px-3 py-1.5 align-top print:border print:border-brand-green/20 print:px-1.5 print:py-0.5">
                <textarea
                  value={item.description}
                  onChange={(e) => updateItem(item.id, { description: e.target.value })}
                  placeholder="Description"
                  rows={2}
                  className={`${fieldClasses} resize-none`}
                />
                <PrintValue className="text-black print:leading-tight">{item.description || "--"}</PrintValue>
              </td>
              <td className="px-3 py-1.5 align-top print:border print:border-brand-green/20 print:px-1.5 print:py-0.5">
                <NumberInput
                  min={0}
                  value={item.quantity}
                  onChange={(quantity) => updateItem(item.id, { quantity })}
                  className={fieldClasses}
                />
                <PrintValue className="text-black">{item.quantity || "--"}</PrintValue>
              </td>
              <td className="px-3 py-1.5 align-top print:border print:border-brand-green/20 print:px-1.5 print:py-0.5">
                <NumberInput
                  min={0}
                  value={item.unitPrice}
                  onChange={(unitPrice) => updateItem(item.id, { unitPrice })}
                  className={fieldClasses}
                />
                <PrintValue className="text-black">{item.unitPrice ? formatCurrency(item.unitPrice) : "--"}</PrintValue>
              </td>
              <td className="whitespace-nowrap px-3 py-1.5 align-top font-bold text-brand-green print:border print:border-brand-green/20 print:px-1.5 print:py-0.5">
                {formatCurrency(computeLineAmount(item))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
