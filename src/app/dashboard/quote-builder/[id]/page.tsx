import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { getAppSettings } from "@/lib/settings";
import { getQuote } from "@/lib/quotes";
import { getQuoteBuilderCatalogue, buildQuoteBranding } from "@/lib/quoteBuilderData";
import QuoteBuilder from "@/components/quote-builder/QuoteBuilder";

/** Reopen a saved quote to edit -- distinct from [id]/print-preview,
 * which is an internal-only render target for the PDF route rather than
 * a page staff navigate to directly. Mirrors the Invoice Builder's
 * identical [id]/page.tsx. */
export default async function EditQuoteBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [quote, appSettings, { catalogueOptions, savedItems, templates }] = await Promise.all([
    getQuote(id),
    getAppSettings(),
    getQuoteBuilderCatalogue(),
  ]);
  if (!quote) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="print:hidden">
        <PageHeader
          title={quote.customerName ? `Quote — ${quote.customerName}` : "Quote Builder"}
          description="Update this quote, or use it as the starting point for the next one."
        />
      </div>

      <QuoteBuilder
        catalogueOptions={catalogueOptions}
        savedItems={savedItems}
        templates={templates}
        branding={buildQuoteBranding(appSettings)}
        initialQuote={quote}
      />
    </div>
  );
}
