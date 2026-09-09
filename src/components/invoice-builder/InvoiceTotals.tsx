import { formatCurrency } from "@/lib/format";
import { computeBalanceAmount, computeDepositAmount } from "@/lib/invoiceCalculations";
import PrintValue from "@/components/quote-builder/PrintValue";
import NumberInput from "@/components/quote-builder/NumberInput";

interface InvoiceTotalsProps {
  subtotal: number;
  vatPercent: number;
  onVatPercentChange: (value: number) => void;
  total: number;
  depositPercent: number;
  onDepositPercentChange: (value: number) => void;
}

const percentFieldClasses =
  "w-20 rounded-md border border-gray-300 bg-white px-2 py-1 text-right text-sm text-gray-900 focus:border-brand-green focus:outline-none focus:ring-2 focus:ring-brand-green/30 print:hidden";

export default function InvoiceTotals({
  subtotal,
  vatPercent,
  onVatPercentChange,
  total,
  depositPercent,
  onDepositPercentChange,
}: InvoiceTotalsProps) {
  const depositAmount = computeDepositAmount(total, depositPercent);
  const balanceAmount = computeBalanceAmount(total, depositPercent);
  const balancePercent = 100 - depositPercent;

  return (
    <div className="ml-auto flex w-full max-w-sm flex-col gap-1.5 text-sm avoid-page-break print:gap-0.5">
      <div className="flex items-center justify-between">
        <span className="text-black">Subtotal</span>
        <span className="font-semibold text-black">{formatCurrency(subtotal)}</span>
      </div>
      <div className="flex items-center justify-between">
        <label htmlFor="invoiceVatPercent" className="text-black">
          Tax / VAT (%)
        </label>
        <NumberInput
          id="invoiceVatPercent"
          min={0}
          value={vatPercent}
          onChange={onVatPercentChange}
          className={percentFieldClasses}
        />
        <PrintValue className="text-black">{vatPercent}%</PrintValue>
      </div>
      <div className="flex items-center justify-between rounded-lg border-2 border-brand-gold bg-amber-50 px-3 py-2 print:border print:bg-amber-50 print:py-0.5">
        <span className="font-bold uppercase tracking-wide text-brand-green">Total Invoice Amount</span>
        <span className="text-lg font-extrabold text-brand-green print:text-base">{formatCurrency(total)}</span>
      </div>
      <div className="flex items-center justify-between">
        <label htmlFor="depositPercent" className="text-black">
          Deposit Paid (%)
        </label>
        <NumberInput
          id="depositPercent"
          min={0}
          value={depositPercent}
          onChange={onDepositPercentChange}
          className={percentFieldClasses}
        />
        <PrintValue className="text-black">{depositPercent}%</PrintValue>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-black">{depositPercent}% Deposit Paid</span>
        <span className="font-semibold text-black">{formatCurrency(depositAmount)}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-black">{balancePercent}% Balance Due on Completion &amp; Handover</span>
        <span className="font-semibold text-black">{formatCurrency(balanceAmount)}</span>
      </div>
    </div>
  );
}
