"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface ExpenseFormState {
  error: string | null;
}

interface ParsedExpenseForm {
  branchId: string;
  category: string;
  description: string | null;
  amount: number;
  expenseDate: string;
}

function parseExpenseForm(formData: FormData): ParsedExpenseForm | null {
  const branchId = String(formData.get("branchId") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const amount = Number(formData.get("amount"));
  const expenseDate = String(formData.get("expenseDate") ?? "").trim();

  if (!branchId || !category || !expenseDate) return null;
  if (!Number.isFinite(amount) || amount < 0) return null;

  return {
    branchId,
    category,
    description: description || null,
    amount,
    expenseDate,
  };
}

export async function createExpense(
  _prevState: ExpenseFormState,
  formData: FormData,
): Promise<ExpenseFormState> {
  const parsed = parseExpenseForm(formData);
  if (!parsed) {
    return {
      error: "Fill in branch, category, and date, and make sure the amount is zero or greater.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("expenses").insert({
    branch_id: parsed.branchId,
    category: parsed.category,
    description: parsed.description,
    amount: parsed.amount,
    expense_date: parsed.expenseDate,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard/expenses");
  revalidatePath("/dashboard");
  redirect("/dashboard/expenses");
}

export async function updateExpense(
  id: string,
  _prevState: ExpenseFormState,
  formData: FormData,
): Promise<ExpenseFormState> {
  const parsed = parseExpenseForm(formData);
  if (!parsed) {
    return {
      error: "Fill in branch, category, and date, and make sure the amount is zero or greater.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("expenses")
    .update({
      branch_id: parsed.branchId,
      category: parsed.category,
      description: parsed.description,
      amount: parsed.amount,
      expense_date: parsed.expenseDate,
    })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard/expenses");
  revalidatePath("/dashboard");
  redirect("/dashboard/expenses");
}

export async function deleteExpense(id: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("expenses").delete().eq("id", id);
  revalidatePath("/dashboard/expenses");
  revalidatePath("/dashboard");
}
