import { PageHeader } from "@/components/ui/PageHeader";
import { InstallationForm } from "@/components/installations/InstallationForm";
import { EmptyState } from "@/components/ui/EmptyState";
import { createInstallation } from "@/app/dashboard/installations/actions";
import { getBranches } from "@/lib/branches";
import { getProducts } from "@/lib/products";
import { getCurrentUser } from "@/lib/auth";

export default async function NewInstallationPage() {
  const user = await getCurrentUser();

  if (user?.role !== "admin") {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Add Installation" description="Record a new installation job." />
        <EmptyState
          title="Admins only"
          description="Adding installations is restricted to admin accounts."
        />
      </div>
    );
  }

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
