"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, Eye, Pencil, Search } from "lucide-react";
import { DeleteCustomerButton } from "@/components/customers/DeleteCustomerButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency } from "@/lib/format";
import { downloadCsv } from "@/lib/csv";
import type { Branch, Customer } from "@/types";

interface CustomerTableProps {
  customers: Customer[];
  branches: Branch[];
  canDelete: boolean;
}

export function CustomerTable({ customers, branches, canDelete }: CustomerTableProps) {
  const [query, setQuery] = useState("");

  const branchNameById = useMemo(
    () => new Map(branches.map((branch) => [branch.id, branch.name])),
    [branches],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (customer) =>
        customer.name.toLowerCase().includes(q) ||
        (customer.phone ?? "").toLowerCase().includes(q) ||
        (customer.email ?? "").toLowerCase().includes(q),
    );
  }, [customers, query]);

  function handleExport() {
    downloadCsv(
      `customers-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Name", "Phone", "Email", "Address", "Branch", "Outstanding Balance"],
      filtered.map((customer) => [
        customer.name,
        customer.phone ?? "",
        customer.email ?? "",
        customer.address ?? "",
        customer.branchId ? (branchNameById.get(customer.branchId) ?? "") : "",
        customer.outstandingBalance,
      ]),
    );
  }

  if (customers.length === 0) {
    return (
      <EmptyState
        title="No customers yet"
        description="Add your first customer to start building the customer list."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500"
            aria-hidden="true"
          />
          <label htmlFor="customer-search" className="sr-only">
            Search customers
          </label>
          <input
            id="customer-search"
            type="search"
            placeholder="Search by name, phone, or email…"
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
        <EmptyState
          title="No matching customers"
          description="Try a different search term."
        />
      ) : (
        <>
          <ul className="flex flex-col gap-3 sm:hidden">
            {filtered.map((customer) => {
              const hasBalance = customer.outstandingBalance > 0;
              return (
                <li
                  key={customer.id}
                  className="rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-gray-900 dark:text-gray-100">
                        {customer.name}
                      </p>
                      {customer.address && (
                        <p className="truncate text-xs text-gray-400 dark:text-gray-500">
                          {customer.address}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Link
                        href={`/dashboard/customers/${customer.id}`}
                        aria-label={`View ${customer.name}`}
                        className="rounded-md p-1.5 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-green/30"
                      >
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      </Link>
                      <Link
                        href={`/dashboard/customers/${customer.id}/edit`}
                        aria-label={`Edit ${customer.name}`}
                        className="rounded-md p-1.5 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-green/30"
                      >
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                      </Link>
                      {canDelete && (
                        <DeleteCustomerButton id={customer.id} customerName={customer.name} />
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 dark:border-gray-800 pt-3 text-sm">
                    <div className="text-gray-600 dark:text-gray-400">
                      {customer.phone && <p>{customer.phone}</p>}
                      {customer.email && (
                        <p className="text-xs text-gray-400 dark:text-gray-500">{customer.email}</p>
                      )}
                      {!customer.phone && !customer.email && "—"}
                      <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                        {customer.branchId ? (branchNameById.get(customer.branchId) ?? "—") : "—"}
                      </p>
                    </div>
                    <span
                      className={
                        hasBalance
                          ? "rounded-full bg-red-50 dark:bg-red-950/40 px-2.5 py-0.5 text-xs font-medium text-red-600 dark:text-red-400"
                          : "text-gray-600 dark:text-gray-400"
                      }
                    >
                      {formatCurrency(customer.outstandingBalance)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="hidden overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm sm:block">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                <th scope="col" className="px-4 py-3 font-medium">
                  Customer
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Contact
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Branch
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Outstanding Balance
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filtered.map((customer) => {
                const hasBalance = customer.outstandingBalance > 0;
                return (
                  <tr key={customer.id} className="align-top">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 dark:text-gray-100">{customer.name}</p>
                      {customer.address && (
                        <p className="text-xs text-gray-400 dark:text-gray-500">{customer.address}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {customer.phone && <p>{customer.phone}</p>}
                      {customer.email && (
                        <p className="text-xs text-gray-400 dark:text-gray-500">{customer.email}</p>
                      )}
                      {!customer.phone && !customer.email && "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {customer.branchId
                        ? (branchNameById.get(customer.branchId) ?? "—")
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          hasBalance
                            ? "rounded-full bg-red-50 dark:bg-red-950/40 px-2.5 py-0.5 text-xs font-medium text-red-600 dark:text-red-400"
                            : "text-gray-600 dark:text-gray-400"
                        }
                      >
                        {formatCurrency(customer.outstandingBalance)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Link
                          href={`/dashboard/customers/${customer.id}`}
                          aria-label={`View ${customer.name}`}
                          className="rounded-md p-1.5 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-green/30"
                        >
                          <Eye className="h-4 w-4" aria-hidden="true" />
                        </Link>
                        <Link
                          href={`/dashboard/customers/${customer.id}/edit`}
                          aria-label={`Edit ${customer.name}`}
                          className="rounded-md p-1.5 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-green/30"
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </Link>
                        {canDelete && (
                          <DeleteCustomerButton id={customer.id} customerName={customer.name} />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </>
      )}
    </div>
  );
}
