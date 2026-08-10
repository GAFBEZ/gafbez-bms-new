import { PageHeader } from "@/components/ui/PageHeader";
import { CustomerTabs } from "@/components/customers/CustomerTabs";
import { getCustomers } from "@/lib/customers";
import { getWebsiteCustomers } from "@/lib/websiteCustomers";
import { getBranches } from "@/lib/branches";
import { getActiveBranchId } from "@/lib/activeBranch";
import { getCurrentUser } from "@/lib/auth";

export default async function CustomersPage() {
  const activeBranchId = await getActiveBranchId();
  const [customers, websiteCustomers, branches, user] = await Promise.all([
    getCustomers(activeBranchId),
    getWebsiteCustomers(),
    getBranches(),
    getCurrentUser(),
  ]);
  const operationalBranches = branches.filter((branch) => branch.id !== "all");
  const activeBranchName = branches.find((b) => b.id === activeBranchId)?.name;
  const isAdmin = user?.role === "admin";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Customers" description="Your own staff-entered contacts, and everyone who has registered on the website." />
      <CustomerTabs
        customers={customers}
        branches={operationalBranches}
        canDelete={isAdmin}
        activeBranchId={activeBranchId}
        activeBranchName={activeBranchName}
        websiteCustomers={websiteCustomers}
      />
    </div>
  );
}
