import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { InstallationForm } from "@/components/installations/InstallationForm";
import { EmptyState } from "@/components/ui/EmptyState";
import { updateInstallation } from "@/app/dashboard/installations/actions";
import { getInstallation } from "@/lib/installations";
import { getBranches } from "@/lib/branches";
import { getProducts } from "@/lib/products";
import { getCurrentUser } from "@/lib/auth";

export default async function EditInstallationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();

  if (user?.role !== "admin") {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Edit Installation" description="Update this installation job." />
        <EmptyState
          title="Admins only"
          description="Editing installations is restricted to admin accounts."
        />
      </div>
    );
  }

  const { id } = await params;
  const [installation, branches, products] = await Promise.all([
    getInstallation(id),
    getBranches(),
    getProducts(),
  ]);

  if (!installation) notFound();

  const operationalBranches = branches.filter(
    (branch) => branch.id !== "all" && branch.status === "active",
  );
  const activeProducts = products
    .filter((product) => product.isActive)
    .map(({ id: productId, name, sku, sellingPrice }) => ({
      id: productId,
      name,
      sku,
      sellingPrice,
    }));
  const updateInstallationWithId = updateInstallation.bind(null, installation.id);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Edit Installation" description="Update this installation job." />
      <InstallationForm
        action={updateInstallationWithId}
        branches={operationalBranches}
        products={activeProducts}
        initialValues={installation}
        submitLabel="Save Changes"
      />
    </div>
  );
}
