import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { TransferStockForm } from "@/components/stock-movement/TransferStockForm";
import { getProducts } from "@/lib/products";
import { getBranches } from "@/lib/branches";
import { getCurrentUser } from "@/lib/auth";

export default async function TransferStockPage() {
  const user = await getCurrentUser();
  const canEdit = user?.role === "admin" || Boolean(user?.isBranchManager);

  if (!canEdit) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Transfer Stock" />
        <EmptyState
          title="Owner/Manager only"
          description="Only the Owner or a branch Manager can transfer stock between branches."
        />
      </div>
    );
  }

  const [products, branches] = await Promise.all([getProducts(), getBranches()]);

  const activeProducts = products
    .filter((product) => product.isActive)
    .map(({ id, name, sku }) => ({ id, name, sku }));

  const operationalBranches = branches.filter(
    (branch) => branch.id !== "all" && branch.status === "active",
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Transfer Stock"
        description="Move stock for a product from one branch to another in a single, atomic transfer."
      />
      <TransferStockForm products={activeProducts} branches={operationalBranches} />
    </div>
  );
}
