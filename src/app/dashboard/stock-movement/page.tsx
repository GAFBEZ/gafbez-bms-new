import { Plus, ArrowLeftRight } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { StockMovementTable } from "@/components/stock-movement/StockMovementTable";
import { getStockMovements } from "@/lib/stockMovements";
import { getBranches } from "@/lib/branches";
import { getActiveBranchId } from "@/lib/activeBranch";
import { getCurrentUser } from "@/lib/auth";

export default async function StockMovementPage() {
  const [activeBranchId, user] = await Promise.all([getActiveBranchId(), getCurrentUser()]);
  const canTransfer = user?.role === "admin" || Boolean(user?.isBranchManager);
  const [movements, branches] = await Promise.all([
    getStockMovements(100, activeBranchId),
    getBranches(),
  ]);
  const movementList = movements ?? [];
  const activeBranchName = branches.find((b) => b.id === activeBranchId)?.name;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Stock Movement"
        description={
          activeBranchId === "all" || !activeBranchName
            ? "Track stock received and issued across branches."
            : `Showing movements for ${activeBranchName}. Switch branches from the selector above to see others.`
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canTransfer && (
              <Link
                href="/dashboard/stock-movement/transfer"
                className="flex items-center gap-2 rounded-lg bg-brand-green px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-green-dark"
              >
                <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
                Transfer Stock
              </Link>
            )}
            <Link
              href="/dashboard/stock-movement/new"
              className="flex items-center gap-2 rounded-lg bg-brand-green px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-green-dark"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Record Movement
            </Link>
          </div>
        }
      />
      <StockMovementTable movements={movementList} />
    </div>
  );
}
