"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { TabButton } from "@/components/ui/TabButton";
import { CatalogueGrid } from "@/components/sales-catalogue/CatalogueGrid";
import ComboPackageTable from "@/components/comboPackages/ComboPackageTable";
import type { ComboPackage, Product } from "@/types";

interface CatalogueTabsProps {
  products: Omit<Product, "costPrice" | "supplier" | "website">[];
  activeBranchId: string;
  activeBranchName: string | undefined;
  packages: ComboPackage[];
  canEditPackages: boolean;
}

type Tab = "catalogue" | "combo";

/**
 * "Sales Catalogue" (individual products, read-only) and "Combo
 * Packages" (fixed bundles, everyone views/admin edits) folded into one
 * sidebar item -- both are "what can we sell" catalogue views rather
 * than operational pages. Same tablist/tabpanel pattern as CustomerTabs.
 * Combo Packages' own /new and /[id] edit routes are untouched -- only
 * the list view moved here.
 */
export function CatalogueTabs({ products, activeBranchId, activeBranchName, packages, canEditPackages }: CatalogueTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>("catalogue");
  const catalogueTabId = useId();
  const comboTabId = useId();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Catalogue views" className="flex gap-2">
          <TabButton id={catalogueTabId} isActive={activeTab === "catalogue"} ariaControls="sales-catalogue-panel" onClick={() => setActiveTab("catalogue")}>
            Sales Catalogue
          </TabButton>
          <TabButton id={comboTabId} isActive={activeTab === "combo"} ariaControls="combo-packages-panel" onClick={() => setActiveTab("combo")}>
            Combo Packages
          </TabButton>
        </div>

        {activeTab === "combo" && canEditPackages && (
          <Link
            href="/dashboard/combo-packages/new"
            className="mb-2 flex items-center gap-2 rounded-lg bg-brand-green px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-green-dark"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            New Package
          </Link>
        )}
      </div>

      <div id="sales-catalogue-panel" role="tabpanel" aria-labelledby={catalogueTabId} hidden={activeTab !== "catalogue"} className="flex flex-col gap-3">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {activeBranchId === "all" || !activeBranchName
            ? "Browse active products available for sale, with selling price and stock status at a glance."
            : `Showing stock status at ${activeBranchName}. Switch branches from the selector above to see others.`}
        </p>
        <CatalogueGrid products={products} />
      </div>

      <div id="combo-packages-panel" role="tabpanel" aria-labelledby={comboTabId} hidden={activeTab !== "combo"} className="flex flex-col gap-3">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {canEditPackages ? "Create and manage fixed solar installation bundles sold on the website." : "Package definitions (view only -- price and composition changes are Owner/Admin only)."}
        </p>
        <ComboPackageTable packages={packages} canEdit={canEditPackages} />
      </div>
    </div>
  );
}
