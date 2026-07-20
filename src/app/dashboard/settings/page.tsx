import { PageHeader } from "@/components/ui/PageHeader";
import { ThemeToggle } from "@/components/settings/ThemeToggle";
import { InventoryDefaultsForm } from "@/components/settings/InventoryDefaultsForm";
import { BusinessProfileForm } from "@/components/settings/BusinessProfileForm";
import { LogoUploadForm } from "@/components/settings/LogoUploadForm";
import { BranchList } from "@/components/settings/BranchList";
import { getThemePreference } from "@/lib/theme";
import { getAppSettings } from "@/lib/settings";
import { getBranches } from "@/lib/branches";
import { getCurrentUser } from "@/lib/auth";

export default async function SettingsPage() {
  const [themePreference, appSettings, branches, user] = await Promise.all([
    getThemePreference(),
    getAppSettings(),
    getBranches(),
    getCurrentUser(),
  ]);
  const isAdmin = user?.role === "admin";
  const operationalBranches = branches.filter((branch) => branch.id !== "all");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Settings"
        description="Personal preferences and system-wide defaults."
      />

      <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Appearance</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Choose how the app looks on this device. This is a personal
          preference — it isn&apos;t shared with other staff or synced across
          your other devices.
        </p>
        <div className="mt-4">
          <ThemeToggle initialPreference={themePreference} />
        </div>
      </section>

      {isAdmin && (
        <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Business Profile
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Company name and contact details. Admin-only.
          </p>
          <div className="mt-4">
            <BusinessProfileForm
              businessName={appSettings.businessName}
              businessAddress={appSettings.businessAddress}
              businessPhone={appSettings.businessPhone}
              businessEmail={appSettings.businessEmail}
            />
          </div>
          <div className="mt-6 border-t border-gray-100 dark:border-gray-800 pt-5">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Logo</h3>
            <div className="mt-3">
              <LogoUploadForm logoUrl={appSettings.logoUrl} />
            </div>
          </div>
        </section>
      )}

      {isAdmin && (
        <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Inventory Defaults
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            System-wide default used across Inventory Master. Admin-only.
          </p>
          <div className="mt-4">
            <InventoryDefaultsForm defaultReorderLevel={appSettings.defaultReorderLevel} />
          </div>
        </section>
      )}

      {isAdmin && (
        <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Branches</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Add branches or rename/activate existing ones. Admin-only.
            Branches can&apos;t be deleted once created, since sales, stock
            movements, and other records reference them — retire one by
            setting it to Coming Soon instead.
          </p>
          <div className="mt-4">
            <BranchList branches={operationalBranches} />
          </div>
        </section>
      )}
    </div>
  );
}
