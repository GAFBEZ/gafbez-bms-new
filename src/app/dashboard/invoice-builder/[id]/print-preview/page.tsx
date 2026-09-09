import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getProducts } from "@/lib/products";
import { getAppSettings } from "@/lib/settings";
import { getSavedItems } from "@/lib/quotes";
import { getInvoice } from "@/lib/invoices";
import InvoiceBuilder from "@/components/invoice-builder/InvoiceBuilder";
import type { LineItemCatalogueOption } from "@/components/quote-builder/LineItemsTable";

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

  const [invoice, products, appSettings, savedItems] = await Promise.all([
    getInvoice(id),
    getProducts(),
    getAppSettings(),
    getSavedItems(),
  ]);
  if (!invoice) notFound();

  const catalogueOptions: LineItemCatalogueOption[] = products
    .filter((product) => product.isActive)
    .map((product) => ({
      id: product.id,
      name: product.name,
      bonusCategory: product.bonusCategory,
      unit: product.unit,
      shortDescription: product.website.shortDescription,
      sellPrice: product.sellingPrice,
    }));

  return (
    <InvoiceBuilder
      branding={{
        logoUrl: appSettings.logoUrl,
        businessName: appSettings.businessName,
        tagline: appSettings.quoteTagline,
        servicesLine: appSettings.quoteServicesLine,
        phone: appSettings.businessPhone,
        email: appSettings.businessEmail,
        invoicePaymentTerms: appSettings.invoicePaymentTerms,
        footerDetails: appSettings.quoteFooterDetails,
      }}
      catalogueOptions={catalogueOptions}
      savedItems={savedItems}
      initialInvoice={invoice}
    />
  );
}
