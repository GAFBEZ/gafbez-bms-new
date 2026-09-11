"use client";

import { useActionState, useId, useState } from "react";
import { AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";
import type { PasswordResetState } from "@/app/dashboard/staff-management/actions";

interface StaffPasswordResetFormProps {
  action: (prevState: PasswordResetState, formData: FormData) => Promise<PasswordResetState>;
  memberLabel: string;
}

const initialState: PasswordResetState = { error: null, success: false };

/** Client-side only -- the admin sees/copies this before it's ever sent,
 * since it needs to be relayed to the staff member out of band. */
function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint32Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => chars[byte % chars.length]).join("");
}

/**
 * Sets a staff member's password directly, for when they've lost access
 * to their email and can't use the normal "forgot password" link. A
 * separate <form> from StaffForm above (HTML forbids nesting them), and
 * deliberately its own action rather than folded into updateStaffMember
 * -- profile fields save silently on every edit, but a password change
 * needs its own explicit button and its own success/error feedback.
 */
export function StaffPasswordResetForm({ action, memberLabel }: StaffPasswordResetFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [password, setPassword] = useState("");
  const fieldId = useId();

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm">
      <div>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Reset Password</h2>
        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
          Sets {memberLabel}&apos;s password directly -- use this when they&apos;ve lost access to their email and
          can&apos;t use the normal &quot;forgot password&quot; link. Share the new password with them yourself.
        </p>
      </div>

      <form action={formAction} className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor={fieldId} className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              New password
            </label>
            <input
              id={fieldId}
              name="newPassword"
              type="text"
              autoComplete="off"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-brand-green focus:outline-none focus:ring-2 focus:ring-brand-green/30"
            />
          </div>
          <button
            type="button"
            onClick={() => setPassword(generatePassword())}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Generate
          </button>
        </div>

        {state.error && (
          <p
            className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-950/40 px-3 py-2 text-xs text-red-700 dark:text-red-400"
            role="alert"
          >
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {state.error}
          </p>
        )}
        {state.success && (
          <p className="flex items-start gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Password reset. Share the new password with {memberLabel} directly -- they can sign in with it right
            away.
          </p>
        )}

        <div>
          <button
            type="submit"
            disabled={isPending || password.length < 8}
            className="rounded-lg border border-brand-green px-4 py-2.5 text-sm font-semibold text-brand-green transition-colors hover:bg-brand-green/10 focus:outline-none focus:ring-2 focus:ring-brand-green/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Resetting…" : "Reset Password"}
          </button>
        </div>
      </form>
    </div>
  );
}
