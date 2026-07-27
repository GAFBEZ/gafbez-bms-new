"use client";

import { useId } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { ProductSpecification } from "@/types";

interface SpecificationEditorProps {
  rows: ProductSpecification[];
  onChange: (rows: ProductSpecification[]) => void;
  suggestions?: readonly string[];
}

const inputClasses =
  "w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-brand-green focus:outline-none focus:ring-2 focus:ring-brand-green/30";

/**
 * Reusable key/value editor for products.specifications (a free-form JSON
 * object). Deliberately not tied to one product category's fields -- the
 * same component renders an inverter's, a battery's, or a panel's spec
 * sheet, since the shape only ever comes from the `rows` prop, never from
 * hardcoded fields here. See websiteCatalogueOptions.ts for the
 * category-specific starter labels used to seed `rows` on first open.
 */
export function SpecificationEditor({ rows, onChange, suggestions }: SpecificationEditorProps) {
  const datalistId = useId();

  function updateRow(index: number, patch: Partial<ProductSpecification>) {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeRow(index: number) {
    onChange(rows.filter((_, i) => i !== index));
  }

  function addRow() {
    onChange([...rows, { key: "", value: "" }]);
  }

  return (
    <div className="flex flex-col gap-2.5">
      {suggestions && suggestions.length > 0 && (
        <datalist id={datalistId}>
          {suggestions.map((label) => (
            <option key={label} value={label} />
          ))}
        </datalist>
      )}

      {rows.length === 0 && (
        <p className="text-xs text-gray-400 dark:text-gray-500">
          No specifications yet. Add a row for each spec you want shown on the product page (e.g.
          &ldquo;Rated capacity&rdquo; → &ldquo;5.5kVA&rdquo;).
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {rows.map((row, index) => (
          <li key={index} className="flex items-center gap-2">
            <label className="sr-only" htmlFor={`spec-key-${index}`}>
              Specification label
            </label>
            <input
              id={`spec-key-${index}`}
              value={row.key}
              onChange={(e) => updateRow(index, { key: e.target.value })}
              placeholder="Label, e.g. Rated capacity"
              list={suggestions ? datalistId : undefined}
              className={`${inputClasses} flex-1`}
            />
            <label className="sr-only" htmlFor={`spec-value-${index}`}>
              Specification value
            </label>
            <input
              id={`spec-value-${index}`}
              value={row.value}
              onChange={(e) => updateRow(index, { value: e.target.value })}
              placeholder="Value, e.g. 5.5kVA"
              className={`${inputClasses} flex-1`}
            />
            <button
              type="button"
              onClick={() => removeRow(index)}
              aria-label={`Remove ${row.key || "this"} specification`}
              className="shrink-0 rounded-md p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-200 dark:text-gray-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={addRow}
        className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-brand-green hover:text-brand-green dark:border-gray-600 dark:text-gray-400 dark:hover:border-emerald-400 dark:hover:text-emerald-400"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        Add specification
      </button>
    </div>
  );
}

/** rows <-> the JSON object stored in products.specifications. Skips rows
 * with an empty label (a half-filled row shouldn't produce a "" key in the
 * saved JSON) but keeps duplicate labels as-is -- last one wins, same as
 * any JS object literal, rather than silently dropping one and surprising
 * whoever typed it. */
export function specificationRowsToRecord(rows: ProductSpecification[]): Record<string, string> {
  const record: Record<string, string> = {};
  for (const row of rows) {
    const key = row.key.trim();
    if (!key) continue;
    record[key] = row.value;
  }
  return record;
}

export function recordToSpecificationRows(record: Record<string, string>): ProductSpecification[] {
  return Object.entries(record).map(([key, value]) => ({ key, value }));
}
