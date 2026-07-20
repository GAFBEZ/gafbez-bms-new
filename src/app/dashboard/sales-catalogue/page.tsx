import { PageHeader } from "@/components/ui/PageHeader";
import { CatalogueGrid } from "@/components/sales-catalogue/CatalogueGrid";
import { getProducts } from "@/lib/products";
import { getBranches } from "@/lib/branches";
import { getActiveBranchId } from "@/lib/activeBranch";

export default async function SalesCataloguePage() {
  const activeBranchId = await getActiveBranchId();
  const [products, branches] = await Promise.all([getProducts(activeBranchId), getBranches()]);
  // Strips costPrice before it ever reaches the client -- this page never
  // renders it (quoting/reference only, not the admin CRUD view), so
  // there's no reason for it to be present in the page's data at all,
  // inspectable or not.
  const activeProducts = products
    .filter((product) => product.isActive)
    .map(({ id, sku, name, category, unit, sellingPrice, quantityInStock, reorderLevel, isActive, createdAt, updatedAt }) => ({
      id,
      sku,
      name,
      category,
      unit,
      sellingPrice,
      quantityInStock,
      reorderLevel,
      isActive,
      createdAt,
      updatedAt,
    }));
  const activeBranchName = branches.find((b) => b.id === activeBranchId)?.name;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Sales Catalogue"
        description={
          activeBranchId === "all" || !activeBranchName
            ? "Browse active products available for sale, with selling price and stock status at a glance."
            : `Showing stock status at ${activeBranchName}. Switch branches from the selector above to see others.`
        }
      />
      <CatalogueGrid products={activeProducts} />
    </div>
  );
}
