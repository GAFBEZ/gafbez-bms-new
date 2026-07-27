"use client";

import Link from "next/link";
import { Pencil } from "lucide-react";
import type { ComboPackage } from "@/types";
import { formatCurrency } from "@/lib/format";
import { toggleComboPackageStatus } from "@/app/dashboard/combo-packages/actions";

interface ComboPackageTableProps {
  packages: ComboPackage[];
  canEdit: boolean;
}

function ToggleBadge({ id, field, value, label, canEdit }: { id: string; field: "is_active" | "is_visible_on_website" | "is_featured"; value: boolean; label: string; canEdit: boolean }) {
  return (
    <button
      type="button"
      disabled={!canEdit}
      onClick={() => toggleComboPackageStatus(id, field, value)}
      className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide transition-colors ${
        value ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300" : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
      } ${canEdit ? "cursor-pointer" : "cursor-default opacity-70"}`}
    >
      {label}
    </button>
  );
}

/** canEdit gates the toggle buttons and Edit link only -- the underlying
 * RPCs re-check is_admin() themselves regardless, this is just avoiding a
 * dead click for Managers/salespeople who can view but not change. */
export default function ComboPackageTable({ packages, canEdit }: ComboPackageTableProps) {
  if (packages.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">No combo packages yet.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
      <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-800 text-sm">
        <thead>
          <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            <th className="px-4 py-3">Package</th>
            <th className="px-4 py-3">Price</th>
            <th className="px-4 py-3">Capacity</th>
            <th className="px-4 py-3">Active</th>
            <th className="px-4 py-3">Visible</th>
            <th className="px-4 py-3">Featured</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {packages.map((pkg) => (
            <tr key={pkg.id}>
              <td className="px-4 py-3">
                <p className="font-medium text-gray-900 dark:text-gray-100">{pkg.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{pkg.packageCode}</p>
              </td>
              <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{formatCurrency(pkg.finalPrice)}</td>
              <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{pkg.systemCapacityText ?? "—"}</td>
              <td className="px-4 py-3">
                <ToggleBadge id={pkg.id} field="is_active" value={pkg.isActive} label={pkg.isActive ? "Active" : "Inactive"} canEdit={canEdit} />
              </td>
              <td className="px-4 py-3">
                <ToggleBadge id={pkg.id} field="is_visible_on_website" value={pkg.isVisibleOnWebsite} label={pkg.isVisibleOnWebsite ? "Visible" : "Hidden"} canEdit={canEdit} />
              </td>
              <td className="px-4 py-3">
                <ToggleBadge id={pkg.id} field="is_featured" value={pkg.isFeatured} label={pkg.isFeatured ? "Featured" : "—"} canEdit={canEdit} />
              </td>
              <td className="px-4 py-3 text-right">
                {canEdit && (
                  <Link href={`/dashboard/combo-packages/${pkg.id}`} className="inline-flex items-center gap-1 text-brand-green dark:text-emerald-400">
                    <Pencil className="h-4 w-4" /> Edit
                  </Link>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
