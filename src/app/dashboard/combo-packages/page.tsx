import { Plus } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import ComboPackageTable from "@/components/comboPackages/ComboPackageTable";
import { getComboPackages } from "@/lib/comboPackages";
import { getCurrentUser } from "@/lib/auth";

/** Section 5: Managers/salespeople may VIEW package definitions; only
 * Owner/Admin may create/edit (price, composition, everything). Unlike
 * Staff Management/Inventory Master, this page is intentionally NOT
 * admin-only at the route level -- combo_packages' own RLS already
 * allows any authenticated staff to read it. */
export default async function ComboPackagesPage() {
  const [packages, user] = await Promise.all([getComboPackages(), getCurrentUser()]);
  const canEdit = user?.role === "admin";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Combo Packages"
        description={
          canEdit
            ? "Create and manage fixed solar installation bundles sold on the website."
            : "Package definitions (view only -- price and composition changes are Owner/Admin only)."
        }
        actions={
          canEdit ? (
            <Link
              href="/dashboard/combo-packages/new"
              className="flex items-center gap-2 rounded-lg bg-brand-green px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-green-dark"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              New Package
            </Link>
          ) : undefined
        }
      />

      <ComboPackageTable packages={packages} canEdit={canEdit} />
    </div>
  );
}
