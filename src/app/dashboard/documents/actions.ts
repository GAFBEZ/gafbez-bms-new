"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DOCUMENTS_BUCKET, getDocumentDownloadUrl } from "@/lib/documents";
import { getCurrentUser } from "@/lib/auth";

export interface DocumentFormState {
  error: string | null;
  success?: boolean;
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function uploadDocument(
  _prevState: DocumentFormState,
  formData: FormData,
): Promise<DocumentFormState> {
  const file = formData.get("file");
  const branchId = String(formData.get("branchId") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();

  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a file to upload." };
  }

  const supabase = await createClient();
  const storagePath = `${branchId || "general"}/${crypto.randomUUID()}-${sanitizeFileName(file.name)}`;

  const { error: uploadError } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(storagePath, file, { contentType: file.type || undefined });

  if (uploadError) {
    return { error: uploadError.message };
  }

  const user = await getCurrentUser();

  const { error: insertError } = await supabase.from("documents").insert({
    name: file.name,
    storage_path: storagePath,
    branch_id: branchId || null,
    category: category || null,
    size_bytes: file.size,
    content_type: file.type || null,
    uploaded_by: user?.id ?? null,
  });

  if (insertError) {
    // Metadata row failed after a successful upload -- clean up the
    // orphaned storage object rather than leaving an untracked file.
    await supabase.storage.from(DOCUMENTS_BUCKET).remove([storagePath]);
    return { error: insertError.message };
  }

  revalidatePath("/dashboard/documents");
  return { error: null, success: true };
}

export async function deleteDocument(id: string, storagePath: string): Promise<void> {
  const supabase = await createClient();
  await supabase.storage.from(DOCUMENTS_BUCKET).remove([storagePath]);
  await supabase.from("documents").delete().eq("id", id);
  revalidatePath("/dashboard/documents");
}

export async function requestDownloadUrl(storagePath: string): Promise<string | null> {
  return getDocumentDownloadUrl(storagePath);
}
