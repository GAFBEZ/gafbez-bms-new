import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getAppSettings } from "@/lib/settings";
import { getInvoice } from "@/lib/invoices";
import { getInvoiceBuilderCatalogue, buildInvoiceBranding } from "@/lib/invoiceBuilderData";
import InvoiceBuilder from "@/components/invoice-builder/InvoiceBuilder";

export const metadata = {
  robots: { index: false, follow: false },
};

/**
 * Not a page staff ever navigate to directly -- this is what
 * /api/invoice-builder/pdf's headless Chromium loads (with the original
 * request's session cookie forwarded) to turn a saved invoice into a
 * PDF. Mirrors the Quote Builder's identical print-preview page.
 */
export default async function InvoiceBuilderPrintPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const [invoice, appSettings, { catalogueOptions, savedItems }] = await Promise.all([
    getInvoice(id),
    getAppSettings(),
    getInvoiceBuilderCatalogue(),
  ]);
  if (!invoice) notFound();

  return (
    <InvoiceBuilder
      branding={buildInvoiceBranding(appSettings)}
      catalogueOptions={catalogueOptions}
      savedItems={savedItems}
      initialInvoice={invoice}
    />
  );
}
