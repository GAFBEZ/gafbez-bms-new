import "server-only";
import { getProducts } from "@/lib/products";
import { getSavedItems, getQuoteTemplates } from "@/lib/quotes";
import type { AppSettings } from "@/lib/settings";
import type { LineItemCatalogueOption } from "@/components/quote-builder/LineItemsTable";
import type { QuoteBranding } from "@/components/quote-builder/BusinessHeader";
import type { QuoteTemplate, SavedQuoteItem } from "@/types";

/** Shared by every page that renders <QuoteBuilder> (new/[id]/
 * [id]/print-preview) so the catalogue-option mapping and branding shape
 * aren't triplicated across them -- same pattern as
 * lib/invoiceBuilderData.ts. */
export async function getQuoteBuilderCatalogue(): Promise<{
  catalogueOptions: LineItemCatalogueOption[];
  savedItems: SavedQuoteItem[];
  templates: QuoteTemplate[];
}> {
  const [products, savedItems, templates] = await Promise.all([getProducts(), getSavedItems(), getQuoteTemplates()]);

  // Staff already have full read access to selling_price -- no markup, no
  // eligibility RPC, unlike the installer builder on the public website
  // whose client is locked out of the real products table entirely.
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

  return { catalogueOptions, savedItems, templates };
}

export function buildQuoteBranding(
  appSettings: AppSettings,
): QuoteBranding & { paymentDetails: string | null; termsAndWarranty: string | null; footerDetails: string | null } {
  return {
    logoUrl: appSettings.logoUrl,
    businessName: appSettings.businessName,
    tagline: appSettings.quoteTagline,
    servicesLine: appSettings.quoteServicesLine,
    phone: appSettings.businessPhone,
    email: appSettings.businessEmail,
    paymentDetails: appSettings.quotePaymentDetails,
    termsAndWarranty: appSettings.quoteTermsAndWarranty,
    footerDetails: appSettings.quoteFooterDetails,
  };
}
