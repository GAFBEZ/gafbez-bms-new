"use client";

import { useActionState, useId, useState } from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import type { Branch, Installation, Product } from "@/types";
import type { InstallationFormState } from "@/app/dashboard/installations/actions";

interface InstallationFormProps {
  action: (
    prevState: InstallationFormState,
    formData: FormData,
  ) => Promise<InstallationFormState>;
  branches: Branch[];
  products: Pick<Product, "id" | "name" | "sku" | "sellingPrice">[];
  initialValues?: Installation;
  submitLabel: string;
}

interface ProductLine {
  productId: string;
  price: string;
  qty: string;
}

const initialState: InstallationFormState = { error: null };

const inputClasses =
  "w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-brand-green focus:outline-none focus:ring-2 focus:ring-brand-green/30";
const labelClasses = "mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300";
const subLabelClasses = "mb-1 block text-xs text-gray-500 dark:text-gray-400";

function todayISODate(): string {
  return new Date().toISOString().slice(0, 10);
}

function toNumber(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function lineFrom(productId: string | null, price: number, qty: number): ProductLine {
  return { productId: productId ?? "", price: String(price), qty: String(qty) };
}

interface ProductLineFieldProps {
  title: string;
  namePrefix: string;
  line: ProductLine;
  onChange: (line: ProductLine) => void;
  products: Pick<Product, "id" | "name" | "sku" | "sellingPrice">[];
}

function ProductLineField({ title, namePrefix, line, onChange, products }: ProductLineFieldProps) {
  function handleProductChange(productId: string) {
    const product = products.find((p) => p.id === productId);
    onChange({
      productId,
      price: product ? String(product.sellingPrice) : line.price,
      qty: line.qty,
    });
  }

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
      <p className={labelClasses}>{title}</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[2fr_1fr_1fr]">
        <div>
          <label className={subLabelClasses}>Product</label>
          <select
            name={`${namePrefix}ProductId`}
            value={line.productId}
            onChange={(event) => handleProductChange(event.target.value)}
            className={inputClasses}
          >
            <option value="">Not used for this job</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} ({product.sku})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={subLabelClasses}>Price (₦)</label>
          <input
            name={`${namePrefix}Price`}
            type="number"
            min="0"
            step="0.01"
            value={line.price}
            onChange={(event) => onChange({ ...line, price: event.target.value })}
            className={inputClasses}
          />
        </div>
        <div>
          <label className={subLabelClasses}>Units</label>
          <input
            name={`${namePrefix}Qty`}
            type="number"
            min="0"
            step="1"
            value={line.qty}
            onChange={(event) => onChange({ ...line, qty: event.target.value })}
            className={inputClasses}
          />
        </div>
      </div>
    </div>
  );
}

export function InstallationForm({
  action,
  branches,
  products,
  initialValues,
  submitLabel,
}: InstallationFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  const [totalCharged, setTotalCharged] = useState(String(initialValues?.totalCharged ?? ""));
  const [inverter, setInverter] = useState<ProductLine>(
    lineFrom(
      initialValues?.inverterProductId ?? null,
      initialValues?.inverterPrice ?? 0,
      initialValues?.inverterQty ?? 1,
    ),
  );
  const [solarPanel, setSolarPanel] = useState<ProductLine>(
    lineFrom(
      initialValues?.solarPanelProductId ?? null,
      initialValues?.solarPanelPrice ?? 0,
      initialValues?.solarPanelQty ?? 1,
    ),
  );
  const [battery, setBattery] = useState<ProductLine>(
    lineFrom(
      initialValues?.batteryProductId ?? null,
      initialValues?.batteryPrice ?? 0,
      initialValues?.batteryQty ?? 1,
    ),
  );
  const [cableAmount, setCableAmount] = useState(String(initialValues?.cableAmount ?? "0"));
  const [accessoriesAmount, setAccessoriesAmount] = useState(
    String(initialValues?.accessoriesAmount ?? "0"),
  );
  const [installationAmount, setInstallationAmount] = useState(
    String(initialValues?.installationAmount ?? "0"),
  );

  const branchFieldId = useId();
  const dateId = useId();
  const totalChargedId = useId();
  const cableId = useId();
  const accessoriesId = useId();
  const installationId = useId();

  const costTotal =
    toNumber(inverter.price) * toNumber(inverter.qty) +
    toNumber(solarPanel.price) * toNumber(solarPanel.qty) +
    toNumber(battery.price) * toNumber(battery.qty) +
    toNumber(cableAmount) +
    toNumber(accessoriesAmount) +
    toNumber(installationAmount);
  const profit = toNumber(totalCharged) - costTotal;

  return (
    <form
      action={formAction}
      className="flex flex-col gap-5 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm"
    >
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor={branchFieldId} className={labelClasses}>
            Branch
          </label>
          <select
            id={branchFieldId}
            name="branchId"
            required
            defaultValue={initialValues?.branchId ?? ""}
            className={inputClasses}
          >
            <option value="">Select a branch…</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor={dateId} className={labelClasses}>
            Date
          </label>
          <input
            id={dateId}
            name="installationDate"
            type="date"
            required
            defaultValue={initialValues?.installationDate ?? todayISODate()}
            className={inputClasses}
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor={totalChargedId} className={labelClasses}>
            Total amount charged to customer (₦)
          </label>
          <input
            id={totalChargedId}
            name="totalCharged"
            type="number"
            min="0"
            step="0.01"
            required
            value={totalCharged}
            onChange={(event) => setTotalCharged(event.target.value)}
            className={inputClasses}
          />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <ProductLineField
          title="Inverter"
          namePrefix="inverter"
          line={inverter}
          onChange={setInverter}
          products={products}
        />
        <ProductLineField
          title="Solar panels"
          namePrefix="solarPanel"
          line={solarPanel}
          onChange={setSolarPanel}
          products={products}
        />
        <ProductLineField
          title="Battery"
          namePrefix="battery"
          line={battery}
          onChange={setBattery}
          products={products}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div>
          <label htmlFor={cableId} className={labelClasses}>
            Cable (₦)
          </label>
          <input
            id={cableId}
            name="cableAmount"
            type="number"
            min="0"
            step="0.01"
            value={cableAmount}
            onChange={(event) => setCableAmount(event.target.value)}
            className={inputClasses}
          />
        </div>
        <div>
          <label htmlFor={accessoriesId} className={labelClasses}>
            Accessories (₦)
          </label>
          <input
            id={accessoriesId}
            name="accessoriesAmount"
            type="number"
            min="0"
            step="0.01"
            value={accessoriesAmount}
            onChange={(event) => setAccessoriesAmount(event.target.value)}
            className={inputClasses}
          />
        </div>
        <div>
          <label htmlFor={installationId} className={labelClasses}>
            Installation / labor (₦)
          </label>
          <input
            id={installationId}
            name="installationAmount"
            type="number"
            min="0"
            step="0.01"
            value={installationAmount}
            onChange={(event) => setInstallationAmount(event.target.value)}
            className={inputClasses}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-gray-100 dark:border-gray-800 pt-4 text-sm sm:flex-row sm:items-center sm:justify-end sm:gap-6">
        <p className="text-gray-500 dark:text-gray-400">
          Cost: <span className="font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(costTotal)}</span>
        </p>
        <p className={profit < 0 ? "text-red-600 dark:text-red-400" : "text-gray-500 dark:text-gray-400"}>
          Profit:{" "}
          <span className="font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(profit)}</span>
        </p>
      </div>

      {state.error && (
        <p
          className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-950/40 px-3 py-2 text-xs text-red-700 dark:text-red-400"
          role="alert"
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-brand-green px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-green-dark focus:outline-none focus:ring-2 focus:ring-brand-green/40 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Saving…" : submitLabel}
        </button>
        <Link
          href="/dashboard/installations"
          className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
