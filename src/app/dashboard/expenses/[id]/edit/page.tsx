import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { ExpenseForm } from "@/components/expenses/ExpenseForm";
import { updateExpense } from "@/app/dashboard/expenses/actions";
import { getExpense } from "@/lib/expenses";
import { getBranches } from "@/lib/branches";

export default async function EditExpensePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [expense, branches] = await Promise.all([getExpense(id), getBranches()]);

  if (!expense) notFound();

  const operationalBranches = branches.filter(
    (branch) => branch.id !== "all" && branch.status === "active",
  );
  const updateExpenseWithId = updateExpense.bind(null, expense.id);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Edit Expense"
        description={`Update this ${expense.category} expense.`}
      />
      <ExpenseForm
        action={updateExpenseWithId}
        branches={operationalBranches}
        initialValues={expense}
        submitLabel="Save Changes"
      />
    </div>
  );
}
