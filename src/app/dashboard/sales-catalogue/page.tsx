import { PageHeader } from "@/components/ui/PageHeader";
import { CatalogueTabs } from "@/components/sales-catalogue/CatalogueTabs";
import { getProducts } from "@/lib/products";
import { getBranches } from "@/lib/branches";
import { getActiveBranchId } from "@/lib/activeBranch";
import { getComboPackages } from "@/lib/comboPackages";
import { getCurrentUser } from "@/lib/auth";

export default async function SalesCataloguePage() {
  const activeBranchId = await getActiveBranchId();
  const [products, branches, packages, user] = await Promise.all([
    getProducts(activeBranchId),
    getBranches(),
    getComboPackages(),
    getCurrentUser(),
  ]);
  // Strips costPrice before it ever reaches the client -- this tab never
  // renders it (quoting/reference only, not the admin CRUD view), so
  // there's no reason for it to be present in the page's data at all,
  // inspectable or not.
  const activeProducts = products
    .filter((product) => product.isActive)
    .map(
      ({
        id,
        sku,
        name,
        category,
        unit,
        sellingPrice,
        quantityInStock,
        specialOrderQuantity,
        reorderLevel,
        isActive,
        createdAt,
        updatedAt,
      }) => ({
        id,
        sku,
        name,
        category,
        unit,
        sellingPrice,
        quantityInStock,
        specialOrderQuantity,
        reorderLevel,
        isActive,
        createdAt,
        updatedAt,
      }),
    );
  const activeBranchName = branches.find((b) => b.id === activeBranchId)?.name;
  const canEditPackages = user?.role === "admin";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Sales Catalogue" description="What's available to sell -- individual products and fixed combo packages." />
      <CatalogueTabs
        products={activeProducts}
        activeBranchId={activeBranchId}
        activeBranchName={activeBranchName}
        packages={packages}
        canEditPackages={canEditPackages}
      />
    </div>
  );
}
