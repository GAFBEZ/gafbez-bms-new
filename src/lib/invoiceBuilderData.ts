import "server-only";
import { getProducts } from "@/lib/products";
import { getSavedItems } from "@/lib/quotes";
import type { AppSettings } from "@/lib/settings";
import type { LineItemCatalogueOption } from "@/components/quote-builder/LineItemsTable";
import type { QuoteBranding } from "@/components/quote-builder/BusinessHeader";
import type { SavedQuoteItem } from "@/types";

/** Shared by every page that renders <InvoiceBuilder> (new/[id]/
 * [id]/print-preview) so the catalogue-option mapping and branding shape
 * aren't triplicated across them. */
export async function getInvoiceBuilderCatalogue(): Promise<{
  catalogueOptions: LineItemCatalogueOption[];
  savedItems: SavedQuoteItem[];
}> {
  const [products, savedItems] = await Promise.all([getProducts(), getSavedItems()]);

  // Same staff-facing catalogue mapping as the Quote Builder page --
  // staff already have full read access to selling_price.
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

  return { catalogueOptions, savedItems };
}

export function buildInvoiceBranding(
  appSettings: AppSettings,
): QuoteBranding & { invoicePaymentTerms: string | null; footerDetails: string | null } {
  return {
    logoUrl: appSettings.logoUrl,
    businessName: appSettings.businessName,
    tagline: appSettings.quoteTagline,
    servicesLine: appSettings.quoteServicesLine,
    phone: appSettings.businessPhone,
    email: appSettings.businessEmail,
    invoicePaymentTerms: appSettings.invoicePaymentTerms,
    footerDetails: appSettings.quoteFooterDetails,
  };
}
