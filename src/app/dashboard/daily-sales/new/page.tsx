import { PageHeader } from "@/components/ui/PageHeader";
import { SaleForm } from "@/components/sales/SaleForm";
import { getProducts, getProductStockByBranch } from "@/lib/products";
import { getCustomers } from "@/lib/customers";
import { getBranches, getBranch } from "@/lib/branches";
import { getActiveBranchId } from "@/lib/activeBranch";
import { getCurrentUser } from "@/lib/auth";

export default async function NewSalePage() {
  const [activeBranchId, user] = await Promise.all([getActiveBranchId(), getCurrentUser()]);
  const isAdmin = user?.role === "admin";
  const lockedBranchId = !isAdmin && user?.branchId ? user.branchId : null;

  const [products, stockByBranch, customers, branches, lockedBranch] = await Promise.all([
    getProducts(),
    getProductStockByBranch(),
    getCustomers(),
    getBranches(),
    lockedBranchId ? getBranch(lockedBranchId) : Promise.resolve(null),
  ]);

  const activeProducts = products
    .filter((product) => product.isActive)
    .map(({ id, name, sku, sellingPrice }) => ({
      id,
      name,
      sku,
      sellingPrice,
      stockByBranch: stockByBranch[id] ?? {},
    }));

  const operationalBranches = branches.filter(
    (branch) => branch.id !== "all" && branch.status === "active",
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Record Sale"
        description={
          lockedBranch
            ? `Record a sale for one or more products at ${lockedBranch.name}, your assigned branch.`
            : "Record a sale for one or more products."
        }
      />
      <SaleForm
        products={activeProducts}
        customers={customers}
        branches={operationalBranches}
        defaultBranchId={activeBranchId !== "all" ? activeBranchId : undefined}
        lockedBranch={lockedBranch ? { id: lockedBranch.id, name: lockedBranch.name } : null}
      />
    </div>
  );
}
