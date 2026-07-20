"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { AlertCircle, Upload } from "lucide-react";
import {
  uploadDocument,
  type DocumentFormState,
} from "@/app/dashboard/documents/actions";
import type { Branch } from "@/types";

interface UploadDocumentFormProps {
  branches: Branch[];
}

const initialState: DocumentFormState = { error: null };

export function UploadDocumentForm({ branches }: UploadDocumentFormProps) {
  const [state, formAction, isPending] = useActionState(uploadDocument, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const fileId = useId();
  const branchFieldId = useId();
  const categoryId = useId();

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-4 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm sm:flex-row sm:items-end sm:flex-wrap"
    >
      <div className="flex-1 sm:min-w-[220px]">
        <label htmlFor={fileId} className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
          File
        </label>
        <input
          id={fileId}
          name="file"
          type="file"
          required
          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 file:mr-3 file:rounded-md file:border-0 file:bg-brand-green-soft file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-brand-green focus:border-brand-green focus:outline-none focus:ring-2 focus:ring-brand-green/30"
        />
      </div>

      <div className="sm:w-56">
        <label htmlFor={branchFieldId} className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
          Branch <span className="font-normal text-gray-400 dark:text-gray-500">(optional)</span>
        </label>
        <select
          id={branchFieldId}
          name="branchId"
          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-brand-green focus:outline-none focus:ring-2 focus:ring-brand-green/30"
        >
          <option value="">General (no branch)</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>
      </div>

      <div className="sm:w-48">
        <label htmlFor={categoryId} className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
          Category <span className="font-normal text-gray-400 dark:text-gray-500">(optional)</span>
        </label>
        <input
          id={categoryId}
          name="category"
          placeholder="Invoice, Contract…"
          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-brand-green focus:outline-none focus:ring-2 focus:ring-brand-green/30"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="flex items-center gap-2 rounded-lg bg-brand-green px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-green-dark focus:outline-none focus:ring-2 focus:ring-brand-green/40 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Upload className="h-4 w-4" aria-hidden="true" />
        {isPending ? "Uploading…" : "Upload"}
      </button>

      {state.error && (
        <p
          className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-950/40 px-3 py-2 text-xs text-red-700 dark:text-red-400 sm:basis-full"
          role="alert"
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {state.error}
        </p>
      )}
    </form>
  );
}
