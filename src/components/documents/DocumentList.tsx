"use client";

import { useState, useTransition } from "react";
import { Download, FileText, Loader2, Trash2 } from "lucide-react";
import {
  deleteDocument,
  requestDownloadUrl,
} from "@/app/dashboard/documents/actions";
import { EmptyState } from "@/components/ui/EmptyState";
import { DateTimeCell } from "@/components/ui/DateTimeCell";
import { formatFileSize } from "@/lib/format";
import type { Document } from "@/types";

interface DocumentListProps {
  documents: Document[];
  canDelete: boolean;
}

function DownloadButton({ storagePath, name }: { storagePath: string; name: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const url = await requestDownloadUrl(storagePath);
      if (!url) {
        setError("Couldn't generate a download link. Try again.");
        return;
      }
      window.open(url, "_blank", "noopener,noreferrer");
    });
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        aria-label={`Download ${name}`}
        className="rounded-md p-1.5 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-green/30 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <Download className="h-4 w-4" aria-hidden="true" />
        )}
      </button>
      {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
    </div>
  );
}

function DeleteButton({ id, storagePath, name }: { id: string; storagePath: string; name: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!window.confirm(`Delete "${name}"? This can't be undone.`)) return;
    startTransition(() => {
      deleteDocument(id, storagePath);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      aria-label={`Delete ${name}`}
      className="rounded-md p-1.5 text-gray-400 dark:text-gray-500 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600 dark:hover:text-red-400 focus:outline-none focus:ring-2 focus:ring-red-200 dark:focus:ring-red-900 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Trash2 className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

export function DocumentList({ documents, canDelete }: DocumentListProps) {
  if (documents.length === 0) {
    return (
      <EmptyState
        title="No documents yet"
        description="Upload your first document, or switch branches above if you're expecting to see some here."
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-gray-100 dark:border-gray-800 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
            <th scope="col" className="px-4 py-3 font-medium">
              Document
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Branch
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Size
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Uploaded
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {documents.map((doc) => (
            <tr key={doc.id} className="align-top">
              <td className="px-4 py-3">
                <div className="flex items-start gap-2.5">
                  <FileText
                    className="mt-0.5 h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{doc.name}</p>
                    {doc.category && (
                      <p className="text-xs text-gray-400 dark:text-gray-500">{doc.category}</p>
                    )}
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{doc.branchName ?? "General"}</td>
              <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{formatFileSize(doc.sizeBytes)}</td>
              <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                <DateTimeCell value={doc.createdAt} />
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1">
                  <DownloadButton storagePath={doc.storagePath} name={doc.name} />
                  {canDelete && (
                    <DeleteButton id={doc.id} storagePath={doc.storagePath} name={doc.name} />
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
