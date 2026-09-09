import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { StockAdjustmentForm } from "@/components/stock-movement/StockAdjustmentForm";
import { getProducts, getProductStockByBranch } from "@/lib/products";
import { getBranches } from "@/lib/branches";
import { getCurrentUser } from "@/lib/auth";

export default async function AdjustStockPage() {
  const user = await getCurrentUser();
  if (user?.role !== "admin") redirect("/dashboard/stock-movement");

  const [products, stockByBranch, branches] = await Promise.all([
    getProducts(),
    getProductStockByBranch(),
    getBranches(),
  ]);

  const activeProducts = products
    .filter((product) => product.isActive)
    .map(({ id, name, sku }) => ({ id, name, sku, stockByBranch: stockByBranch[id] ?? {} }));

  const operationalBranches = branches.filter(
    (branch) => branch.id !== "all" && branch.status === "active",
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Adjust Stock"
        description="Correct a product's recorded stock at a branch to match an actual physical count. Admin only."
      />
      <StockAdjustmentForm products={activeProducts} branches={operationalBranches} />
    </div>
  );
}
