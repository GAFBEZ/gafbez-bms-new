import { Plus } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { CustomerTable } from "@/components/customers/CustomerTable";
import { getCustomers } from "@/lib/customers";
import { getBranches } from "@/lib/branches";
import { getActiveBranchId } from "@/lib/activeBranch";
import { getCurrentUser } from "@/lib/auth";

export default async function CustomersPage() {
  const activeBranchId = await getActiveBranchId();
  const [customers, branches, user] = await Promise.all([
    getCustomers(activeBranchId),
    getBranches(),
    getCurrentUser(),
  ]);
  const operationalBranches = branches.filter((branch) => branch.id !== "all");
  const activeBranchName = branches.find((b) => b.id === activeBranchId)?.name;
  const isAdmin = user?.role === "admin";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Customers"
        description={
          activeBranchId === "all" || !activeBranchName
            ? "Maintain customer records, contact details, and account balances."
            : `Showing customers for ${activeBranchName}. Switch branches from the selector above to see others.`
        }
        actions={
          <Link
            href="/dashboard/customers/new"
            className="flex items-center gap-2 rounded-lg bg-brand-green px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-green-dark"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add Customer
          </Link>
        }
      />
      <CustomerTable customers={customers} branches={operationalBranches} canDelete={isAdmin} />
    </div>
  );
}
