import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import ComboPackageForm from "@/components/comboPackages/ComboPackageForm";
import { createComboPackage } from "../actions";
import { getProducts } from "@/lib/products";
import { getCurrentUser } from "@/lib/auth";

export default async function NewComboPackagePage() {
  const user = await getCurrentUser();

  if (user?.role !== "admin") {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="New Combo Package" />
        <EmptyState title="Owner/Admin only" description="Only Owner/Admin accounts can create combo packages." />
      </div>
    );
  }

  const products = await getProducts("all");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="New Combo Package" description="Set a fixed price and component list -- customers can't customise this later." />
      <ComboPackageForm action={createComboPackage} products={products} submitLabel="Create Package" />
    </div>
  );
}
