import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { getAppSettings } from "@/lib/settings";
import { getInvoice } from "@/lib/invoices";
import { getInvoiceBuilderCatalogue, buildInvoiceBranding } from "@/lib/invoiceBuilderData";
import InvoiceBuilder from "@/components/invoice-builder/InvoiceBuilder";

/** Reopen a saved invoice -- e.g. to log the balance payment once it
 * comes in, weeks after the deposit was recorded. Distinct from
 * [id]/print-preview, which is an internal-only render target for the
 * PDF route rather than a page staff navigate to directly. */
export default async function EditInvoiceBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [invoice, appSettings, { catalogueOptions, savedItems }] = await Promise.all([
    getInvoice(id),
    getAppSettings(),
    getInvoiceBuilderCatalogue(),
  ]);
  if (!invoice) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="print:hidden">
        <PageHeader
          title={invoice.clientName ? `Invoice — ${invoice.clientName}` : "Invoice / Receipt Builder"}
          description="Update this invoice/receipt, or log a new payment as it comes in."
        />
      </div>

      <InvoiceBuilder
        branding={buildInvoiceBranding(appSettings)}
        catalogueOptions={catalogueOptions}
        savedItems={savedItems}
        initialInvoice={invoice}
      />
    </div>
  );
}
