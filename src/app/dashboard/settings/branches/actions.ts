"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface BranchFormState {
  error: string | null;
}

interface ParsedBranchForm {
  name: string;
  status: "active" | "coming_soon";
}

function parseBranchForm(formData: FormData): ParsedBranchForm | null {
  const name = String(formData.get("name") ?? "").trim();
  const status = String(formData.get("status") ?? "");

  if (!name) return null;
  if (status !== "active" && status !== "coming_soon") return null;

  return { name, status };
}

/** Turns "GAFBEZ Energies Kano Branch" into "gafbez-energies-kano-branch". */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function createBranch(
  _prevState: BranchFormState,
  formData: FormData,
): Promise<BranchFormState> {
  const parsed = parseBranchForm(formData);
  if (!parsed) {
    return { error: "Enter a branch name and choose a status." };
  }

  const id = slugify(parsed.name);
  if (!id) {
    return { error: "That name doesn't produce a usable branch ID — try including a letter or number." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("branches").insert({
    id,
    name: parsed.name,
    status: parsed.status,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "A branch with a matching ID already exists — try a more distinct name." };
    }
    return { error: error.message };
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard", "layout");
  redirect("/dashboard/settings");
}

export async function updateBranch(
  id: string,
  _prevState: BranchFormState,
  formData: FormData,
): Promise<BranchFormState> {
  const parsed = parseBranchForm(formData);
  if (!parsed) {
    return { error: "Enter a branch name and choose a status." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("branches")
    .update({ name: parsed.name, status: parsed.status })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard", "layout");
  redirect("/dashboard/settings");
}
