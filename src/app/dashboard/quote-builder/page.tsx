import Link from "next/link";
import { Receipt } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { getProducts } from "@/lib/products";
import { getAppSettings } from "@/lib/settings";
import { getQuoteTemplates, getSavedItems } from "@/lib/quotes";
import QuoteBuilder from "@/components/quote-builder/QuoteBuilder";
import type { LineItemCatalogueOption } from "@/components/quote-builder/LineItemsTable";

export default async function QuoteBuilderPage() {
  const [products, appSettings, savedItems, templates] = await Promise.all([
    getProducts(),
    getAppSettings(),
    getSavedItems(),
    getQuoteTemplates(),
  ]);

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

  return (
    <div className="flex flex-col gap-6">
      <div className="print:hidden">
        <PageHeader
          title="Quote Builder"
          description="Build a GAFBEZ-branded quotation for a customer using current selling prices."
          actions={
            <Link
              href="/dashboard/invoice-builder"
              className="flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <Receipt className="h-4 w-4" aria-hidden="true" />
              Create Invoice / Receipt
            </Link>
          }
        />
      </div>

      <QuoteBuilder
        catalogueOptions={catalogueOptions}
        savedItems={savedItems}
        templates={templates}
        branding={{
          logoUrl: appSettings.logoUrl,
          businessName: appSettings.businessName,
          tagline: appSettings.quoteTagline,
          servicesLine: appSettings.quoteServicesLine,
          phone: appSettings.businessPhone,
          email: appSettings.businessEmail,
          paymentDetails: appSettings.quotePaymentDetails,
          termsAndWarranty: appSettings.quoteTermsAndWarranty,
          footerDetails: appSettings.quoteFooterDetails,
        }}
      />
    </div>
  );
}
