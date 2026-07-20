import { Package, PiggyBank, Plus, TrendingUp, Wallet } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { ProductTable } from "@/components/inventory/ProductTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { getProducts } from "@/lib/products";
import { getBranches } from "@/lib/branches";
import { getActiveBranchId } from "@/lib/activeBranch";
import { getCurrentUser } from "@/lib/auth";
import { formatCurrency } from "@/lib/format";
import { DASHBOARD_PALETTE } from "@/lib/palette";

export default async function InventoryMasterPage() {
  const user = await getCurrentUser();

  if (user?.role !== "admin") {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Inventory Master"
          description="Manage product records, categories, pricing, and stock levels."
        />
        <EmptyState
          title="Admins only"
          description="Inventory Master (including cost price and margins) is restricted to admin accounts. Use Sales Catalogue to browse products and stock status, or Stock Movement to record stock in/out."
        />
      </div>
    );
  }

  const activeBranchId = await getActiveBranchId();
  const [products, branches] = await Promise.all([
    getProducts(activeBranchId),
    getBranches(),
  ]);
  const activeBranchName = branches.find((b) => b.id === activeBranchId)?.name;

  const totalCostValue = products.reduce((sum, p) => sum + p.costPrice * p.quantityInStock, 0);
  const totalSellingValue = products.reduce((sum, p) => sum + p.sellingPrice * p.quantityInStock, 0);
  const estimatedProfit = totalSellingValue - totalCostValue;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Inventory Master"
        description={
          activeBranchId === "all" || !activeBranchName
            ? "Manage product records, categories, pricing, and stock levels."
            : `Showing stock at ${activeBranchName}. Switch branches from the selector above to see others.`
        }
        actions={
          <Link
            href="/dashboard/inventory/new"
            className="flex items-center gap-2 rounded-lg bg-brand-green px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-green-dark"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add Product
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <DashboardCard
          label="Total Products"
          value={products.length.toLocaleString("en-NG")}
          helperText={activeBranchId === "all" || !activeBranchName ? "Across all branches" : activeBranchName}
          icon={Package}
          accent={DASHBOARD_PALETTE.tealDark}
        />
        <DashboardCard
          label="Total Cost Value"
          value={formatCurrency(totalCostValue)}
          helperText="Stock on hand, at cost price"
          icon={Wallet}
          accent={DASHBOARD_PALETTE.blue}
        />
        <DashboardCard
          label="Total Selling Value"
          value={formatCurrency(totalSellingValue)}
          helperText="Stock on hand, at selling price"
          icon={TrendingUp}
          accent={DASHBOARD_PALETTE.red}
        />
        <DashboardCard
          label="Estimated Profit"
          value={formatCurrency(estimatedProfit)}
          helperText="If all current stock sells at listed prices"
          icon={PiggyBank}
          accent={DASHBOARD_PALETTE.magentaDark}
        />
      </div>

      <ProductTable products={products} canDelete />
    </div>
  );
}
