import { PageHeader } from "@/components/ui/PageHeader";
import { getProducts } from "@/lib/products";
import { getAppSettings } from "@/lib/settings";
import { getSavedItems } from "@/lib/quotes";
import InvoiceBuilder from "@/components/invoice-builder/InvoiceBuilder";
import type { LineItemCatalogueOption } from "@/components/quote-builder/LineItemsTable";

export default async function InvoiceBuilderPage() {
  const [products, appSettings, savedItems] = await Promise.all([getProducts(), getAppSettings(), getSavedItems()]);

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

  return (
    <div className="flex flex-col gap-6">
      <div className="print:hidden">
        <PageHeader
          title="Invoice / Receipt Builder"
          description="Build a GAFBEZ-branded invoice/receipt for a customer, and log deposit/balance payments as they come in."
        />
      </div>

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
      />
    </div>
  );
}
