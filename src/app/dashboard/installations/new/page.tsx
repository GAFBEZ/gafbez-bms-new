import { PageHeader } from "@/components/ui/PageHeader";
import { InstallationForm } from "@/components/installations/InstallationForm";
import { createInstallation } from "@/app/dashboard/installations/actions";
import { getBranches } from "@/lib/branches";
import { getProducts } from "@/lib/products";

export default async function NewInstallationPage() {
  const [branches, products] = await Promise.all([getBranches(), getProducts()]);

  const operationalBranches = branches.filter(
    (branch) => branch.id !== "all" && branch.status === "active",
  );
  const activeProducts = products
    .filter((product) => product.isActive)
    .map(({ id, name, sku, sellingPrice }) => ({ id, name, sku, sellingPrice }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Add Installation" description="Record a new installation job." />
      <InstallationForm
        action={createInstallation}
        branches={operationalBranches}
        products={activeProducts}
        submitLabel="Add Installation"
      />
    </div>
  );
}
