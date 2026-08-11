"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { CustomerTable } from "@/components/customers/CustomerTable";
import { WebsiteCustomerTable } from "@/components/websiteCustomers/WebsiteCustomerTable";
import type { Branch, Customer, WebsiteCustomer } from "@/types";

interface CustomerTabsProps {
  customers: Customer[];
  branches: Branch[];
  canDelete: boolean;
  activeBranchId: string;
  activeBranchName: string | undefined;
  websiteCustomers: WebsiteCustomer[];
}

type Tab = "manual" | "website";

/**
 * Two clearly separate data sources under one sidebar entry (folded in
 * here specifically to keep the sidebar compact, per the Owner's
 * request): "Customers" is public.customers, staff-entered wholesale/
 * walk-in contacts with a login-free balance ledger; "Website Customers"
 * is public.customer_profiles, self-registered website accounts,
 * read-only here (see WebsiteCustomerTable). Same tablist/tabpanel
 * pattern as ProductEditTabs.tsx (src/components/inventory/) for visual
 * consistency -- the only other tab switcher in this codebase.
 */
export function CustomerTabs({ customers, branches, canDelete, activeBranchId, activeBranchName, websiteCustomers }: CustomerTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>("manual");
  const manualTabId = useId();
  const websiteTabId = useId();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 dark:border-gray-800">
        <div role="tablist" aria-label="Customer lists" className="flex gap-1">
          <button
            type="button"
            role="tab"
            id={manualTabId}
            aria-selected={activeTab === "manual"}
            aria-controls="manual-customers-panel"
            onClick={() => setActiveTab("manual")}
            className={
              activeTab === "manual"
                ? "border-b-2 border-brand-green px-4 py-2.5 text-sm font-semibold text-brand-green dark:text-emerald-400"
                : "border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            }
          >
            Customers
          </button>
          <button
            type="button"
            role="tab"
            id={websiteTabId}
            aria-selected={activeTab === "website"}
            aria-controls="website-customers-panel"
            onClick={() => setActiveTab("website")}
            className={
              activeTab === "website"
                ? "border-b-2 border-brand-green px-4 py-2.5 text-sm font-semibold text-brand-green dark:text-emerald-400"
                : "border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            }
          >
            Website Customers
          </button>
        </div>

        {activeTab === "manual" && (
          <Link
            href="/dashboard/customers/new"
            className="mb-2 flex items-center gap-2 rounded-lg bg-brand-green px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-green-dark"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add Customer
          </Link>
        )}
      </div>

      <div id="manual-customers-panel" role="tabpanel" aria-labelledby={manualTabId} hidden={activeTab !== "manual"} className="flex flex-col gap-3">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {activeBranchId === "all" || !activeBranchName
            ? "Your own staff-entered contacts, contact details, and account balances."
            : `Showing customers for ${activeBranchName}. Switch branches from the selector above to see others.`}
        </p>
        <CustomerTable customers={customers} branches={branches} canDelete={canDelete} />
      </div>

      <div id="website-customers-panel" role="tabpanel" aria-labelledby={websiteTabId} hidden={activeTab !== "website"} className="flex flex-col gap-3">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Everyone who has registered an account on the website.{canDelete ? " Deactivate or delete an account from the Actions column." : ""}
        </p>
        <WebsiteCustomerTable customers={websiteCustomers} isAdmin={canDelete} />
      </div>
    </div>
  );
}
