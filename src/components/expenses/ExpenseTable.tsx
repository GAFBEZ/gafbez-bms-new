"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, Pencil } from "lucide-react";
import { DeleteExpenseButton } from "@/components/expenses/DeleteExpenseButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency, formatDate } from "@/lib/format";
import { downloadCsv } from "@/lib/csv";
import type { Expense } from "@/types";

interface ExpenseTableProps {
  expenses: Expense[];
  canDelete: boolean;
}

export function ExpenseTable({ expenses, canDelete }: ExpenseTableProps) {
  const [categoryFilter, setCategoryFilter] = useState("all");

  const categories = useMemo(
    () => Array.from(new Set(expenses.map((e) => e.category))).sort(),
    [expenses],
  );

  const filtered = useMemo(() => {
    if (categoryFilter === "all") return expenses;
    return expenses.filter((expense) => expense.category === categoryFilter);
  }, [expenses, categoryFilter]);

  const total = filtered.reduce((sum, expense) => sum + expense.amount, 0);

  function handleExport() {
    downloadCsv(
      `expenses-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Category", "Description", "Branch", "Amount", "Date", "Recorded by"],
      filtered.map((expense) => [
        expense.category,
        expense.description ?? "",
        expense.branchName,
        expense.amount,
        formatDate(`${expense.expenseDate}T00:00:00`),
        expense.recordedBy ?? "",
      ]),
    );
  }

  if (expenses.length === 0) {
    return (
      <EmptyState
        title="No expenses recorded yet"
        description="Add your first expense to start tracking operational costs, or switch branches above if you're expecting to see some here."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <label htmlFor="category-filter" className="sr-only">
            Filter by category
          </label>
          <select
            id="category-filter"
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            className="cursor-pointer rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 py-2 pl-3 pr-8 text-sm font-medium text-gray-700 dark:text-gray-300 focus:border-brand-green focus:outline-none focus:ring-2 focus:ring-brand-green/30"
          >
            <option value="all">All categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Total: <span className="font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(total)}</span>
          </p>
          <button
            type="button"
            onClick={handleExport}
            disabled={filtered.length === 0}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Export CSV
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No matching expenses" description="Try a different category filter." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                <th scope="col" className="px-4 py-3 font-medium">
                  Category
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Branch
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Amount
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Date
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Recorded by
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filtered.map((expense) => (
                <tr key={expense.id} className="align-top">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 dark:text-gray-100">{expense.category}</p>
                    {expense.description && (
                      <p className="text-xs text-gray-400 dark:text-gray-500">{expense.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{expense.branchName}</td>
                  <td className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">
                    {formatCurrency(expense.amount)}
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                    {formatDate(`${expense.expenseDate}T00:00:00`)}
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                    {expense.recordedBy ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Link
                        href={`/dashboard/expenses/${expense.id}/edit`}
                        aria-label={`Edit expense: ${expense.category}`}
                        className="rounded-md p-1.5 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-green/30"
                      >
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                      </Link>
                      {canDelete && (
                        <DeleteExpenseButton id={expense.id} label={expense.category} />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
