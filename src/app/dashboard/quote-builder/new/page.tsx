import { PageHeader } from "@/components/ui/PageHeader";
import { getAppSettings } from "@/lib/settings";
import { getQuoteBuilderCatalogue, buildQuoteBranding } from "@/lib/quoteBuilderData";
import QuoteBuilder from "@/components/quote-builder/QuoteBuilder";

export default async function NewQuoteBuilderPage() {
  const [appSettings, { catalogueOptions, savedItems, templates }] = await Promise.all([
    getAppSettings(),
    getQuoteBuilderCatalogue(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="print:hidden">
        <PageHeader
          title="Quote Builder"
          description="Build a GAFBEZ-branded quotation for a customer using current selling prices."
        />
      </div>

      <QuoteBuilder
        catalogueOptions={catalogueOptions}
        savedItems={savedItems}
        templates={templates}
        branding={buildQuoteBranding(appSettings)}
      />
    </div>
  );
}
