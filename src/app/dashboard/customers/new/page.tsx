import { PageHeader } from "@/components/ui/PageHeader";
import { CustomerForm } from "@/components/customers/CustomerForm";
import { createCustomer } from "@/app/dashboard/customers/actions";
import { getBranches } from "@/lib/branches";
import { getCurrentUser } from "@/lib/auth";

export default async function NewCustomerPage() {
  const [branches, user] = await Promise.all([getBranches(), getCurrentUser()]);
  const operationalBranches = branches.filter(
    (branch) => branch.id !== "all" && branch.status === "active",
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Add Customer"
        description="Create a new customer record."
      />
      <CustomerForm
        action={createCustomer}
        branches={operationalBranches}
        submitLabel="Add Customer"
        isAdmin={user?.role === "admin"}
      />
    </div>
  );
}
