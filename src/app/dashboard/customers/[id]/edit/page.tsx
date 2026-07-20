import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { CustomerForm } from "@/components/customers/CustomerForm";
import { updateCustomer } from "@/app/dashboard/customers/actions";
import { getCustomer } from "@/lib/customers";
import { getBranches } from "@/lib/branches";

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [customer, branches] = await Promise.all([getCustomer(id), getBranches()]);

  if (!customer) notFound();

  const operationalBranches = branches.filter(
    (branch) => branch.id !== "all" && branch.status === "active",
  );
  const updateCustomerWithId = updateCustomer.bind(null, customer.id);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Edit Customer"
        description={`Update details for ${customer.name}.`}
      />
      <CustomerForm
        action={updateCustomerWithId}
        branches={operationalBranches}
        initialValues={customer}
        submitLabel="Save Changes"
      />
    </div>
  );
}
