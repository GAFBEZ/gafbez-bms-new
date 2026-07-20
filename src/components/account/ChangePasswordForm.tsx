"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import {
  changePassword,
  type AccountFormState,
} from "@/app/dashboard/account/actions";

const initialState: AccountFormState = { error: null };

const inputClasses =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-green focus:outline-none focus:ring-2 focus:ring-brand-green/30 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100";
const labelClasses = "mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300";

export function ChangePasswordForm() {
  const [state, formAction, isPending] = useActionState(changePassword, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  const currentId = useId();
  const newId = useId();
  const confirmId = useId();

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <div>
        <label htmlFor={currentId} className={labelClasses}>
          Current password
        </label>
        <input
          id={currentId}
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          className={inputClasses}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={newId} className={labelClasses}>
            New password
          </label>
          <input
            id={newId}
            name="newPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            className={inputClasses}
          />
        </div>

        <div>
          <label htmlFor={confirmId} className={labelClasses}>
            Confirm new password
          </label>
          <input
            id={confirmId}
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            className={inputClasses}
          />
        </div>
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-500">At least 8 characters.</p>

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
          Password updated.
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-fit rounded-lg bg-brand-green px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-green-dark focus:outline-none focus:ring-2 focus:ring-brand-green/40 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}
