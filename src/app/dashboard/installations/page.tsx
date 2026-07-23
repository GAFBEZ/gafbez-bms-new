import { Plus, ReceiptText, Wallet, TrendingUp, Percent } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { InstallationTable } from "@/components/installations/InstallationTable";
import { getInstallations, getInstallationSummary } from "@/lib/installations";
import { getBranches } from "@/lib/branches";
import { getActiveBranchId } from "@/lib/activeBranch";
import { getCurrentUser } from "@/lib/auth";
import { formatCurrency } from "@/lib/format";
import { DASHBOARD_PALETTE } from "@/lib/palette";

export default async function InstallationsPage() {
  const activeBranchId = await getActiveBranchId();
  const [installations, summary, branches, user] = await Promise.all([
    getInstallations(activeBranchId),
    getInstallationSummary(activeBranchId),
    getBranches(),
    getCurrentUser(),
  ]);
  const activeBranchName = branches.find((b) => b.id === activeBranchId)?.name;
  const isAdmin = user?.role === "admin";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Installation"
        description={
          activeBranchId === "all" || !activeBranchName
            ? "Track what customers were charged for installations vs. what the parts and labor cost."
            : `Showing installations for ${activeBranchName}. Switch branches from the selector above to see others.`
        }
        actions={
          <Link
            href="/dashboard/installations/new"
            className="flex items-center gap-2 rounded-lg bg-brand-green px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-green-dark"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add Installation
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <DashboardCard
          label="Total Amount Charged"
          value={formatCurrency(summary.totalCharged)}
          helperText={`${summary.count} installation${summary.count === 1 ? "" : "s"}`}
          icon={ReceiptText}
          accent={DASHBOARD_PALETTE.red}
        />
        <DashboardCard
          label="Total Amount Used"
          value={formatCurrency(summary.totalCost)}
          helperText="Parts, cable, accessories, labor"
          icon={Wallet}
          accent={DASHBOARD_PALETTE.magentaDark}
        />
        <DashboardCard
          label="Total Profit"
          value={formatCurrency(summary.totalProfit)}
          helperText="Charged minus cost"
          icon={TrendingUp}
          accent={DASHBOARD_PALETTE.amberDark}
        />
        <DashboardCard
          label="Profit Margin"
          value={`${summary.profitMarginPct.toFixed(1)}%`}
          helperText="Profit as % of amount charged"
          icon={Percent}
          accent={DASHBOARD_PALETTE.violet}
        />
      </div>

      <InstallationTable installations={installations} canDelete={isAdmin} />
    </div>
  );
}
