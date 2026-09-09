import Link from "next/link";
import { Plus, Receipt } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { QuoteTable } from "@/components/quote-builder/QuoteTable";
import { getQuotes } from "@/lib/quotes";

export default async function QuoteBuilderListPage() {
  const quotes = await getQuotes();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Quote Builder"
        description="Saved quotes -- reopen one to edit, or start a new one."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/dashboard/invoice-builder/new"
              className="flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <Receipt className="h-4 w-4" aria-hidden="true" />
              Create Invoice / Receipt
            </Link>
            <Link
              href="/dashboard/quote-builder/new"
              className="flex items-center gap-2 rounded-lg bg-brand-green px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-green-dark"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              New Quote
            </Link>
          </div>
        }
      />

      <QuoteTable quotes={quotes} />
    </div>
  );
}
