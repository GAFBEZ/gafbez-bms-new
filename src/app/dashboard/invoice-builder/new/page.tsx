import { PageHeader } from "@/components/ui/PageHeader";
import { getAppSettings } from "@/lib/settings";
import { getInvoiceBuilderCatalogue, buildInvoiceBranding } from "@/lib/invoiceBuilderData";
import InvoiceBuilder from "@/components/invoice-builder/InvoiceBuilder";

export default async function NewInvoiceBuilderPage() {
  const [appSettings, { catalogueOptions, savedItems }] = await Promise.all([
    getAppSettings(),
    getInvoiceBuilderCatalogue(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="print:hidden">
        <PageHeader
          title="Invoice / Receipt Builder"
          description="Build a GAFBEZ-branded invoice/receipt for a customer, and log deposit/balance payments as they come in."
        />
      </div>

      <InvoiceBuilder
        branding={buildInvoiceBranding(appSettings)}
        catalogueOptions={catalogueOptions}
        savedItems={savedItems}
      />
    </div>
  );
}
