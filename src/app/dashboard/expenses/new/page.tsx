import { PageHeader } from "@/components/ui/PageHeader";
import { ExpenseForm } from "@/components/expenses/ExpenseForm";
import { createExpense } from "@/app/dashboard/expenses/actions";
import { getBranches } from "@/lib/branches";

export default async function NewExpensePage() {
  const branches = await getBranches();
  const operationalBranches = branches.filter(
    (branch) => branch.id !== "all" && branch.status === "active",
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Add Expense" description="Record a new operational expense." />
      <ExpenseForm
        action={createExpense}
        branches={operationalBranches}
        submitLabel="Add Expense"
      />
    </div>
  );
}
