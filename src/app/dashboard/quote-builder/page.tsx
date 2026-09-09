import Link from "next/link";
import { Plus } from "lucide-react";
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
          <Link
            href="/dashboard/quote-builder/new"
            className="flex items-center gap-2 rounded-lg bg-brand-green px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-green-dark"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            New Quote
          </Link>
        }
      />

      <QuoteTable quotes={quotes} />
    </div>
  );
}
