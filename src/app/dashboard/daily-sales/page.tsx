import { Plus } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { SaleTable } from "@/components/sales/SaleTable";
import { getSales } from "@/lib/sales";
import { getBranches } from "@/lib/branches";
import { getActiveBranchId } from "@/lib/activeBranch";

export default async function DailySalesPage() {
  const activeBranchId = await getActiveBranchId();
  const [sales, branches] = await Promise.all([
    getSales(100, activeBranchId),
    getBranches(),
  ]);
  const saleList = sales ?? [];
  const activeBranchName = branches.find((b) => b.id === activeBranchId)?.name;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Daily Sales"
        description={
          activeBranchId === "all" || !activeBranchName
            ? "Record and review each branch's daily sales transactions."
            : `Showing sales for ${activeBranchName}. Switch branches from the selector above to see others.`
        }
        actions={
          <Link
            href="/dashboard/daily-sales/new"
            className="flex items-center gap-2 rounded-lg bg-brand-green px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-green-dark"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Record Sale
          </Link>
        }
      />
      <SaleTable sales={saleList} />
    </div>
  );
}
