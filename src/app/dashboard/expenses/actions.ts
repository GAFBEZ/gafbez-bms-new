"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";

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

  // Branch-locked for non-admins, same policy as record_sale/
  // record_stock_movement/record_return -- a staff member with an
  // assigned branch can only record an expense at that branch, not one
  // they pick from the dropdown. Backed up by RLS (0071) in case this
  // action is ever bypassed.
  const user = await getCurrentUser();
  if (user?.role !== "admin" && user?.branchId && user.branchId !== parsed.branchId) {
    return { error: "You can only record expenses at your assigned branch." };
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

  const user = await getCurrentUser();
  const supabase = await createClient();

  // Same branch-lock as createExpense, checked against both the
  // submitted branch AND the expense's current branch -- a staff member
  // can't reassign an expense to their branch from elsewhere, or edit
  // one that isn't at their branch to begin with.
  if (user?.role !== "admin" && user?.branchId) {
    if (parsed.branchId !== user.branchId) {
      return { error: "You can only record expenses at your assigned branch." };
    }
    const { data: existing } = await supabase.from("expenses").select("branch_id").eq("id", id).maybeSingle();
    if (existing && existing.branch_id !== user.branchId) {
      return { error: "You can only edit expenses recorded at your assigned branch." };
    }
  }

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

// Deleting an expense is admin-only in the UI (ExpenseTable's canDelete
// prop) -- this backs that up in the action itself in case RLS is ever
// misconfigured, rather than trusting the UI gate alone to keep a
// non-admin from calling this action directly.
export async function deleteExpense(id: string): Promise<void> {
  const user = await getCurrentUser();
  if (user?.role !== "admin") {
    console.warn(`[deleteExpense] blocked non-admin delete attempt by user ${user?.id ?? "unknown"}`);
    return;
  }

  const supabase = await createClient();
  await supabase.from("expenses").delete().eq("id", id);
  revalidatePath("/dashboard/expenses");
  revalidatePath("/dashboard");
}
