import { PageHeader } from "@/components/ui/PageHeader";
import { ProductForm } from "@/components/inventory/ProductForm";
import { EmptyState } from "@/components/ui/EmptyState";
import { createProduct } from "@/app/dashboard/inventory/actions";
import { getAppSettings } from "@/lib/settings";
import { getBranches } from "@/lib/branches";
import { getCurrentUser } from "@/lib/auth";

export default async function NewProductPage() {
  const user = await getCurrentUser();

  if (user?.role !== "admin") {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Add Product"
          description="Create a new product record in the inventory catalog."
        />
        <EmptyState
          title="Admins only"
          description="Adding products is restricted to admin accounts."
        />
      </div>
    );
  }

  const [settings, branches] = await Promise.all([getAppSettings(), getBranches()]);

  const operationalBranches = branches.filter(
    (branch) => branch.id !== "all" && branch.status === "active",
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Add Product"
        description="Create a new product record in the inventory catalog."
      />
      <ProductForm
        action={createProduct}
        submitLabel="Add Product"
        defaultReorderLevel={settings.defaultReorderLevel}
        branches={operationalBranches}
      />
    </div>
  );
}
