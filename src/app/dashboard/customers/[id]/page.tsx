import { notFound } from "next/navigation";
import Link from "next/link";
import { Banknote, CircleDollarSign, Pencil, Receipt, Wallet } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { SaleTable } from "@/components/sales/SaleTable";
import { getCustomer } from "@/lib/customers";
import { getSales } from "@/lib/sales";
import { getBranches } from "@/lib/branches";
import { formatCurrency } from "@/lib/format";
import { DASHBOARD_PALETTE } from "@/lib/palette";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = await getCustomer(id);

  if (!customer) notFound();

  const [sales, branches] = await Promise.all([getSales(500, undefined, id), getBranches()]);
  const salesRows = sales ?? [];
  const branchName = branches.find((b) => b.id === customer.branchId)?.name ?? null;

  const totalSpent = salesRows.reduce((sum, sale) => sum + sale.totalAmount, 0);
  const purchaseCount = salesRows.length;
  const averagePurchase = purchaseCount > 0 ? totalSpent / purchaseCount : 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={customer.name}
        description={branchName ?? "No branch assigned"}
        actions={
          <Link
            href={`/dashboard/customers/${customer.id}/edit`}
            className="flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
            Edit
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <DashboardCard
          label="Total Spent"
          value={formatCurrency(totalSpent)}
          helperText="Lifetime, all purchases"
          icon={Wallet}
          accent={DASHBOARD_PALETTE.violet}
        />
        <DashboardCard
          label="Purchases"
          value={purchaseCount.toLocaleString("en-NG")}
          helperText="Total transactions"
          icon={Receipt}
          accent={DASHBOARD_PALETTE.orange}
        />
        <DashboardCard
          label="Average Purchase"
          value={formatCurrency(averagePurchase)}
          helperText="Per transaction"
          icon={Banknote}
          accent={DASHBOARD_PALETTE.blue}
        />
        <DashboardCard
          label="Outstanding Balance"
          value={formatCurrency(customer.outstandingBalance)}
          helperText="Unpaid invoices"
          icon={CircleDollarSign}
          accent={DASHBOARD_PALETTE.red}
        />
      </div>

      <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Contact details</h2>
        <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Phone
            </dt>
            <dd className="mt-0.5 text-sm text-gray-700 dark:text-gray-300">{customer.phone ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Email
            </dt>
            <dd className="mt-0.5 text-sm text-gray-700 dark:text-gray-300">{customer.email ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Address
            </dt>
            <dd className="mt-0.5 text-sm text-gray-700 dark:text-gray-300">{customer.address ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Notes
            </dt>
            <dd className="mt-0.5 text-sm text-gray-700 dark:text-gray-300">{customer.notes ?? "—"}</dd>
          </div>
        </dl>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
          Purchase history
        </h2>
        <SaleTable sales={salesRows} />
      </div>
    </div>
  );
}
