import { PageHeader } from "@/components/ui/PageHeader";
import { StockMovementForm } from "@/components/stock-movement/StockMovementForm";
import { getProducts } from "@/lib/products";
import { getBranches, getBranch } from "@/lib/branches";
import { getCurrentUser } from "@/lib/auth";

export default async function NewStockMovementPage() {
  const user = await getCurrentUser();
  const isAdmin = user?.role === "admin";
  const lockedBranchId = !isAdmin && user?.branchId ? user.branchId : null;

  const [products, branches, lockedBranch] = await Promise.all([
    getProducts(),
    getBranches(),
    lockedBranchId ? getBranch(lockedBranchId) : Promise.resolve(null),
  ]);

  const activeProducts = products
    .filter((product) => product.isActive)
    .map(({ id, name, sku }) => ({ id, name, sku }));

  const operationalBranches = branches.filter(
    (branch) => branch.id !== "all" && branch.status === "active",
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Record Movement"
        description={
          lockedBranch
            ? `Log stock received or issued for a product at ${lockedBranch.name}, your assigned branch.`
            : "Log stock received or issued for a product at a branch."
        }
      />
      <StockMovementForm
        products={activeProducts}
        branches={operationalBranches}
        lockedBranch={lockedBranch ? { id: lockedBranch.id, name: lockedBranch.name } : null}
      />
    </div>
  );
}
