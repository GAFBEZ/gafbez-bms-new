import { Plus, Trash2 } from "lucide-react";
import type { InvoicePayment } from "@/types";
import { formatCurrency } from "@/lib/format";
import PrintValue from "@/components/quote-builder/PrintValue";
import NumberInput from "@/components/quote-builder/NumberInput";

interface PaymentRecordTableProps {
  payments: InvoicePayment[];
  onChange: (payments: InvoicePayment[]) => void;
}

const fieldClasses =
  "w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-brand-green focus:outline-none focus:ring-2 focus:ring-brand-green/30 print:hidden";

function newPayment(): InvoicePayment {
  return { id: crypto.randomUUID(), date: new Date().toISOString().slice(0, 10), amount: 0, method: "Cash", reference: "" };
}

function formatPrintDate(iso: string): string {
  if (!iso) return "--";
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * The one genuinely dynamic table on an invoice -- appendable/removable
 * because the document gets reopened over its life to log each payment
 * as it comes in (deposit today, balance weeks later), unlike the fixed
 * line-item categories above.
 */
export default function PaymentRecordTable({ payments, onChange }: PaymentRecordTableProps) {
  function updatePayment(id: string, patch: Partial<InvoicePayment>) {
    onChange(payments.map((payment) => (payment.id === id ? { ...payment, ...patch } : payment)));
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto rounded-xl border border-gray-200 print:overflow-visible print:rounded-none print:border-brand-green/40">
        <table className="w-full min-w-[560px] divide-y divide-gray-100 text-sm print:w-full print:min-w-0 print:table-fixed print:border-collapse print:divide-y-0 print:text-xs">
          <thead>
            <tr className="bg-amber-50 text-left text-xs font-bold uppercase tracking-wide text-brand-green">
              <th className="px-3 py-2 print:w-[20%] print:border print:border-brand-green/30 print:px-1.5 print:py-1">
                Payment Date
              </th>
              <th className="px-3 py-2 print:w-[25%] print:border print:border-brand-green/30 print:px-1.5 print:py-1">
                Amount Received
              </th>
              <th className="px-3 py-2 print:w-[20%] print:border print:border-brand-green/30 print:px-1.5 print:py-1">
                Method
              </th>
              <th className="px-3 py-2 print:w-[25%] print:border print:border-brand-green/30 print:px-1.5 print:py-1">
                Reference
              </th>
              <th className="w-10 px-3 py-2 print:hidden" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 print:divide-y-0">
            {payments.map((payment, index) => (
              <tr key={payment.id} className={`avoid-page-break ${index % 2 === 1 ? "bg-gray-50 print:bg-gray-50" : ""}`}>
                <td className="px-3 py-1.5 align-top print:border print:border-brand-green/20 print:px-1.5 print:py-0.5">
                  <input
                    type="date"
                    value={payment.date}
                    onChange={(e) => updatePayment(payment.id, { date: e.target.value })}
                    className={fieldClasses}
                  />
                  <PrintValue className="text-black">{formatPrintDate(payment.date)}</PrintValue>
                </td>
                <td className="px-3 py-1.5 align-top print:border print:border-brand-green/20 print:px-1.5 print:py-0.5">
                  <NumberInput
                    min={0}
                    value={payment.amount}
                    onChange={(amount) => updatePayment(payment.id, { amount })}
                    className={fieldClasses}
                  />
                  <PrintValue className="font-semibold text-black">{formatCurrency(payment.amount)}</PrintValue>
                </td>
                <td className="px-3 py-1.5 align-top print:border print:border-brand-green/20 print:px-1.5 print:py-0.5">
                  <select
                    value={payment.method}
                    onChange={(e) => updatePayment(payment.id, { method: e.target.value })}
                    className={fieldClasses}
                  >
                    <option value="Cash">Cash</option>
                    <option value="Transfer">Transfer</option>
                    <option value="Other">Other</option>
                  </select>
                  <PrintValue className="text-black">{payment.method}</PrintValue>
                </td>
                <td className="px-3 py-1.5 align-top print:border print:border-brand-green/20 print:px-1.5 print:py-0.5">
                  <input
                    type="text"
                    value={payment.reference}
                    onChange={(e) => updatePayment(payment.id, { reference: e.target.value })}
                    placeholder="Optional"
                    className={fieldClasses}
                  />
                  <PrintValue className="text-black">{payment.reference || "--"}</PrintValue>
                </td>
                <td className="px-3 py-1.5 align-top print:hidden">
                  <button
                    type="button"
                    onClick={() => onChange(payments.filter((p) => p.id !== payment.id))}
                    aria-label="Remove payment"
                    className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {payments.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-sm text-gray-500 print:hidden">
                  No payments logged yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={() => onChange([...payments, newPayment()])}
        className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-brand-green transition-colors hover:bg-green-50 print:hidden"
      >
        <Plus className="h-3.5 w-3.5" />
        Add Payment
      </button>
    </div>
  );
}
