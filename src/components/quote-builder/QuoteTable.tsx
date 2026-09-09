import Link from "next/link";
import { Pencil, Download } from "lucide-react";
import { DeleteQuoteButton } from "@/components/quote-builder/DeleteQuoteButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Quote } from "@/types";

interface QuoteTableProps {
  quotes: Quote[];
}

function quoteLabel(quote: Quote): string {
  return quote.customerName || quote.quoteNumber || "Untitled quote";
}

function systemTypeLabel(quote: Quote): string {
  return quote.systemType === "full_system" ? "Complete Solar System" : "Inverter & Battery Only";
}

export function QuoteTable({ quotes }: QuoteTableProps) {
  if (quotes.length === 0) {
    return (
      <EmptyState
        title="No quotes saved yet"
        description="Create your first quote to start tracking customer pricing."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-3 sm:hidden">
        {quotes.map((quote) => (
          <li
            key={quote.id}
            className="rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium text-gray-900 dark:text-gray-100">{quoteLabel(quote)}</p>
                <p className="truncate text-xs text-gray-400 dark:text-gray-500">{systemTypeLabel(quote)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Link
                  href={`/dashboard/quote-builder/${quote.id}`}
                  aria-label={`Open quote: ${quoteLabel(quote)}`}
                  className="rounded-md p-1.5 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-green/30"
                >
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                </Link>
                <DeleteQuoteButton id={quote.id} label={quoteLabel(quote)} />
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 dark:border-gray-800 pt-3 text-sm">
              <p className="font-medium text-gray-700 dark:text-gray-300">{formatCurrency(quote.grandTotal)}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">{formatDate(`${quote.quoteDate}T00:00:00`)}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm sm:block">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
              <th scope="col" className="px-4 py-3 font-medium">
                Customer / Quote No.
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                System Type
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Date
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Grand Total
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {quotes.map((quote) => (
              <tr key={quote.id} className="align-top">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900 dark:text-gray-100">{quoteLabel(quote)}</p>
                  {quote.quoteNumber && quote.customerName && (
                    <p className="text-xs text-gray-400 dark:text-gray-500">{quote.quoteNumber}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{systemTypeLabel(quote)}</td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                  {formatDate(`${quote.quoteDate}T00:00:00`)}
                </td>
                <td className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">
                  {formatCurrency(quote.grandTotal)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <a
                      href={`/api/quote-builder/pdf?id=${quote.id}`}
                      aria-label={`Download PDF: ${quoteLabel(quote)}`}
                      title="Download PDF"
                      className="rounded-md p-1.5 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-green/30"
                    >
                      <Download className="h-4 w-4" aria-hidden="true" />
                    </a>
                    <Link
                      href={`/dashboard/quote-builder/${quote.id}`}
                      aria-label={`Open quote: ${quoteLabel(quote)}`}
                      title="Open / edit"
                      className="rounded-md p-1.5 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-green/30"
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </Link>
                    <DeleteQuoteButton id={quote.id} label={quoteLabel(quote)} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
