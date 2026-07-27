import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import ComboPackageForm from "@/components/comboPackages/ComboPackageForm";
import { updateComboPackage } from "../actions";
import { getComboPackage, getComboPackageProfit } from "@/lib/comboPackages";
import { getProducts } from "@/lib/products";
import { getCurrentUser } from "@/lib/auth";
import { formatCurrency } from "@/lib/format";

interface EditComboPackagePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditComboPackagePage({ params }: EditComboPackagePageProps) {
  const { id } = await params;
  const user = await getCurrentUser();

  if (user?.role !== "admin") {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Edit Combo Package" />
        <EmptyState title="Owner/Admin only" description="Only Owner/Admin accounts can edit combo packages." />
      </div>
    );
  }

  const [pkg, products, profit] = await Promise.all([getComboPackage(id), getProducts("all"), getComboPackageProfit(id)]);
  if (!pkg) notFound();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`Edit ${pkg.name}`} description="Owner-only: package price, composition, and profit." />

      {profit && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">Final Price</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(profit.finalPrice)}</p>
          </div>
          <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">Component Cost</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(profit.componentCost)}</p>
          </div>
          <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">Estimated Profit</p>
            <p className="text-lg font-semibold text-emerald-700 dark:text-emerald-400">{formatCurrency(profit.estimatedProfit)}</p>
          </div>
        </div>
      )}

      <ComboPackageForm action={updateComboPackage.bind(null, id)} products={products} initialValues={pkg} submitLabel="Save Changes" />
    </div>
  );
}
