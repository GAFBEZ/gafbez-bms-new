"use client";

import { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { WebsiteCustomerActions } from "@/components/websiteCustomers/WebsiteCustomerActions";
import { formatDate } from "@/lib/format";
import { downloadCsv } from "@/lib/csv";
import type { WebsiteCustomer } from "@/types";

interface WebsiteCustomerTableProps {
  customers: WebsiteCustomer[];
  isAdmin: boolean;
}

const INSTALLER_STATUS_STYLES: Record<string, string> = {
  pending: "bg-brand-gold-soft text-amber-700 dark:text-amber-400",
  temp_approved: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400",
  approved: "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400",
  rejected: "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400",
};

const INSTALLER_STATUS_LABELS: Record<string, string> = {
  pending: "installer, pending",
  temp_approved: "installer, temp approved",
  approved: "installer, approved",
  rejected: "installer, rejected",
};

export function WebsiteCustomerTable({ customers, isAdmin }: WebsiteCustomerTableProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (customer) =>
        customer.fullName.toLowerCase().includes(q) ||
        customer.email.toLowerCase().includes(q) ||
        (customer.phone ?? "").toLowerCase().includes(q) ||
        (customer.businessName ?? "").toLowerCase().includes(q),
    );
  }, [customers, query]);

  function handleExport() {
    downloadCsv(
      `website-customers-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Name", "Email", "Phone", "Business Name", "Installer Status", "Email Verified", "Active", "Joined"],
      filtered.map((customer) => [
        customer.fullName,
        customer.email,
        customer.phone ?? "",
        customer.businessName ?? "",
        customer.installerStatus,
        customer.emailVerified ? "Yes" : "No",
        customer.isActive ? "Yes" : "No",
        customer.createdAt,
      ]),
    );
  }

  if (customers.length === 0) {
    return <EmptyState title="No website customers yet" description="Accounts created via the website's Register page will appear here." />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" aria-hidden="true" />
          <label htmlFor="website-customer-search" className="sr-only">
            Search website customers
          </label>
          <input
            id="website-customer-search"
            type="search"
            placeholder="Search by name, email, phone, or business…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 py-2 pl-10 pr-3 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-brand-green focus:outline-none focus:ring-2 focus:ring-brand-green/30"
          />
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={filtered.length === 0}
          className="flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 sm:self-start"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          Export CSV
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No matching customers" description="Try a different search term." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                <th scope="col" className="px-4 py-3 font-medium">
                  Customer
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Contact
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Status
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Joined
                </th>
                {isAdmin && (
                  <th scope="col" className="px-4 py-3 font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filtered.map((customer) => (
                <tr key={customer.id} className="align-top">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 dark:text-gray-100">{customer.fullName}</p>
                    {customer.businessName && <p className="text-xs text-gray-400 dark:text-gray-500">{customer.businessName}</p>}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                    <p>{customer.email}</p>
                    {customer.phone && <p className="text-xs text-gray-400 dark:text-gray-500">{customer.phone}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      {!customer.isActive && (
                        <span className="w-fit rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:text-gray-400">
                          deactivated
                        </span>
                      )}
                      {!customer.emailVerified && (
                        <span className="w-fit rounded-full bg-brand-gold-soft px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                          email unverified
                        </span>
                      )}
                      {customer.installerStatus !== "none" && (
                        <span className={`w-fit rounded-full px-2 py-0.5 text-[11px] font-medium ${INSTALLER_STATUS_STYLES[customer.installerStatus]}`}>
                          {INSTALLER_STATUS_LABELS[customer.installerStatus]}
                        </span>
                      )}
                      {customer.isActive && customer.emailVerified && customer.installerStatus === "none" && (
                        <span className="text-xs text-gray-400 dark:text-gray-500">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{formatDate(customer.createdAt)}</td>
                  {isAdmin && (
                    <td className="px-4 py-3">
                      <WebsiteCustomerActions customerId={customer.id} customerName={customer.fullName} isActive={customer.isActive} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
