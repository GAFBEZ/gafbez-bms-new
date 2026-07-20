"use client";

import { useActionState, useId } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import {
  updateOwnProfile,
  type AccountFormState,
} from "@/app/dashboard/account/actions";

interface AccountProfileFormProps {
  fullName: string | null;
  email: string | null;
  role: string;
  branchName: string | null;
}

const initialState: AccountFormState = { error: null };

export function AccountProfileForm({
  fullName,
  email,
  role,
  branchName,
}: AccountProfileFormProps) {
  const [state, formAction, isPending] = useActionState(updateOwnProfile, initialState);
  const nameId = useId();

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor={nameId}
            className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Full name
          </label>
          <input
            id={nameId}
            name="fullName"
            required
            defaultValue={fullName ?? ""}
            placeholder="Your name"
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-green focus:outline-none focus:ring-2 focus:ring-brand-green/30 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
          />
        </div>

        <div>
          <p className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Email
          </p>
          <p className="py-2 text-sm text-gray-500 dark:text-gray-400">{email ?? "—"}</p>
        </div>

        <div>
          <p className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Role
          </p>
          <p className="py-2 text-sm text-gray-500 dark:text-gray-400 capitalize">{role}</p>
        </div>

        <div>
          <p className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Branch
          </p>
          <p className="py-2 text-sm text-gray-500 dark:text-gray-400">{branchName ?? "—"}</p>
        </div>
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-500">
        Email, role, and branch are managed by an admin (Staff Management),
        not here.
      </p>

      {state.error && (
        <p
          className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-400"
          role="alert"
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {state.error}
        </p>
      )}

      {state.success && !state.error && (
        <p className="flex items-start gap-2 rounded-lg bg-green-50 px-3 py-2 text-xs text-green-700 dark:bg-green-950/40 dark:text-green-400">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Saved.
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-fit rounded-lg bg-brand-green px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-green-dark focus:outline-none focus:ring-2 focus:ring-brand-green/40 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
