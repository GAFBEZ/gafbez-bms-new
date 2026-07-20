import { createClient } from "@/lib/supabase/server";
import type { Document } from "@/types";

export const DOCUMENTS_BUCKET = "documents";

interface DocumentRow {
  id: string;
  name: string;
  storage_path: string;
  branch_id: string | null;
  category: string | null;
  size_bytes: number | null;
  content_type: string | null;
  created_at: string;
  branches: { name: string } | null;
}

function mapRow(row: DocumentRow): Document {
  return {
    id: row.id,
    name: row.name,
    storagePath: row.storage_path,
    branchId: row.branch_id,
    branchName: row.branches?.name ?? null,
    category: row.category,
    sizeBytes: row.size_bytes,
    contentType: row.content_type,
    createdAt: row.created_at,
  };
}

/**
 * Pass a branchId to scope results to that branch. "all" (or omitted)
 * returns every document regardless of branch.
 */
export async function getDocuments(branchId?: string): Promise<Document[]> {
  const supabase = await createClient();
  let query = supabase
    .from("documents")
    .select(
      "id, name, storage_path, branch_id, category, size_bytes, content_type, created_at, branches(name)",
    )
    .order("created_at", { ascending: false });

  if (branchId && branchId !== "all") {
    query = query.eq("branch_id", branchId);
  }

  const { data, error } = await query;

  if (error || !data) {
    console.warn("Failed to load documents:", error?.message);
    return [];
  }

  return (data as unknown as DocumentRow[]).map(mapRow);
}

/** Short-lived signed URL for downloading a private-bucket file. */
export async function getDocumentDownloadUrl(storagePath: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(storagePath, 60);

  if (error || !data) {
    console.warn("Failed to create signed URL:", error?.message);
    return null;
  }

  return data.signedUrl;
}
