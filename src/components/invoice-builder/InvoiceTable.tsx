import Link from "next/link";
import { Pencil, Download } from "lucide-react";
import { DeleteInvoiceButton } from "@/components/invoice-builder/DeleteInvoiceButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency, formatDate } from "@/lib/format";
import { computeAmountReceived } from "@/lib/invoiceCalculations";
import type { Invoice } from "@/types";

interface InvoiceTableProps {
  invoices: Invoice[];
}

function invoiceLabel(invoice: Invoice): string {
  return invoice.clientName || invoice.invoiceNumber || "Untitled invoice";
}

export function InvoiceTable({ invoices }: InvoiceTableProps) {
  if (invoices.length === 0) {
    return (
      <EmptyState
        title="No invoices saved yet"
        description="Create your first invoice/receipt to start tracking deposits and balance payments."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-3 sm:hidden">
        {invoices.map((invoice) => {
          const received = computeAmountReceived(invoice.payments);
          return (
            <li
              key={invoice.id}
              className="rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium text-gray-900 dark:text-gray-100">{invoiceLabel(invoice)}</p>
                  {invoice.invoiceNumber && invoice.clientName && (
                    <p className="truncate text-xs text-gray-400 dark:text-gray-500">{invoice.invoiceNumber}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Link
                    href={`/dashboard/invoice-builder/${invoice.id}`}
                    aria-label={`Open invoice: ${invoiceLabel(invoice)}`}
                    className="rounded-md p-1.5 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-green/30"
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                  </Link>
                  <DeleteInvoiceButton id={invoice.id} label={invoiceLabel(invoice)} />
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 dark:border-gray-800 pt-3 text-sm">
                <div>
                  <p className="font-medium text-gray-700 dark:text-gray-300">{formatCurrency(invoice.total)}</p>
                  <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                    {formatCurrency(received)} received
                  </p>
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {formatDate(`${invoice.invoiceDate}T00:00:00`)}
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="hidden overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm sm:block">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
              <th scope="col" className="px-4 py-3 font-medium">
                Client / Invoice No.
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Date
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Total
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Received
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Balance
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {invoices.map((invoice) => {
              const received = computeAmountReceived(invoice.payments);
              return (
                <tr key={invoice.id} className="align-top">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 dark:text-gray-100">{invoiceLabel(invoice)}</p>
                    {invoice.invoiceNumber && invoice.clientName && (
                      <p className="text-xs text-gray-400 dark:text-gray-500">{invoice.invoiceNumber}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                    {formatDate(`${invoice.invoiceDate}T00:00:00`)}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">
                    {formatCurrency(invoice.total)}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{formatCurrency(received)}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                    {formatCurrency(invoice.total - received)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <a
                        href={`/api/invoice-builder/pdf?id=${invoice.id}`}
                        aria-label={`Download PDF: ${invoiceLabel(invoice)}`}
                        title="Download PDF"
                        className="rounded-md p-1.5 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-green/30"
                      >
                        <Download className="h-4 w-4" aria-hidden="true" />
                      </a>
                      <Link
                        href={`/dashboard/invoice-builder/${invoice.id}`}
                        aria-label={`Open invoice: ${invoiceLabel(invoice)}`}
                        title="Open / edit"
                        className="rounded-md p-1.5 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-green/30"
                      >
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                      </Link>
                      <DeleteInvoiceButton id={invoice.id} label={invoiceLabel(invoice)} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
