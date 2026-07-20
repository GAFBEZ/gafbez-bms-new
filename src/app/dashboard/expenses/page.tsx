import { Plus } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { DashboardSection } from "@/components/dashboard/DashboardSection";
import { ExpenseCategoryChart } from "@/components/expenses/ExpenseCategoryChart";
import { ExpenseTable } from "@/components/expenses/ExpenseTable";
import { getExpenses } from "@/lib/expenses";
import { getBranches } from "@/lib/branches";
import { getActiveBranchId } from "@/lib/activeBranch";
import { getCurrentUser } from "@/lib/auth";
import type { ExpenseCategorySummary } from "@/types";

export default async function ExpensesPage() {
  const activeBranchId = await getActiveBranchId();
  const [expenses, branches, user] = await Promise.all([
    getExpenses(activeBranchId),
    getBranches(),
    getCurrentUser(),
  ]);
  const activeBranchName = branches.find((b) => b.id === activeBranchId)?.name;
  const isAdmin = user?.role === "admin";

  const categoryTotals = new Map<string, ExpenseCategorySummary>();
  for (const expense of expenses) {
    const existing = categoryTotals.get(expense.category);
    if (existing) {
      existing.total += expense.amount;
    } else {
      categoryTotals.set(expense.category, { category: expense.category, total: expense.amount });
    }
  }
  const byCategory = Array.from(categoryTotals.values()).sort((a, b) => b.total - a.total);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Expenses"
        description={
          activeBranchId === "all" || !activeBranchName
            ? "Record and categorise operational expenses by branch."
            : `Showing expenses for ${activeBranchName}. Switch branches from the selector above to see others.`
        }
        actions={
          <Link
            href="/dashboard/expenses/new"
            className="flex items-center gap-2 rounded-lg bg-brand-green px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-green-dark"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add Expense
          </Link>
        }
      />
      <DashboardSection title="Expenses by Category">
        <ExpenseCategoryChart data={byCategory} />
      </DashboardSection>
      <ExpenseTable expenses={expenses} canDelete={isAdmin} />
    </div>
  );
}
