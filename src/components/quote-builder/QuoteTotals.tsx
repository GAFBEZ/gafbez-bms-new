import { formatCurrency } from "@/lib/format";
import PrintValue from "./PrintValue";
import NumberInput from "./NumberInput";

interface QuoteTotalsProps {
  subtotal: number;
  vatPercent: number;
  onVatPercentChange: (value: number) => void;
  grandTotal: number;
}

export default function QuoteTotals({ subtotal, vatPercent, onVatPercentChange, grandTotal }: QuoteTotalsProps) {
  return (
    <div className="ml-auto flex w-full max-w-xs flex-col gap-2 text-sm break-inside-avoid">
      <div className="flex items-center justify-between">
        <span className="text-gray-500">Subtotal</span>
        <span className="font-semibold text-gray-900">{formatCurrency(subtotal)}</span>
      </div>
      <div className="flex items-center justify-between">
        <label htmlFor="vatPercent" className="text-gray-500">
          VAT (%)
        </label>
        <NumberInput
          id="vatPercent"
          min={0}
          value={vatPercent}
          onChange={onVatPercentChange}
          className="w-20 rounded-md border border-gray-300 bg-white px-2 py-1 text-right text-sm text-gray-900 focus:border-brand-green focus:outline-none focus:ring-2 focus:ring-brand-green/30 print:hidden"
        />
        <PrintValue className="text-gray-900">{vatPercent}%</PrintValue>
      </div>
      <div className="flex items-center justify-between rounded-lg border-2 border-brand-gold bg-amber-50 px-3 py-2.5 print:border print:border-brand-gold print:bg-amber-50">
        <span className="font-bold uppercase tracking-wide text-brand-green">Grand Total</span>
        <span className="text-lg font-extrabold text-brand-green">{formatCurrency(grandTotal)}</span>
      </div>
    </div>
  );
}
