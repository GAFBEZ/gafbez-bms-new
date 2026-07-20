"use client";

import { useActionState, useId } from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import type { Branch, StaffMember } from "@/types";
import type { StaffFormState } from "@/app/dashboard/staff-management/actions";

interface StaffFormProps {
  action: (
    prevState: StaffFormState,
    formData: FormData,
  ) => Promise<StaffFormState>;
  branches: Branch[];
  member: StaffMember;
  isSelf: boolean;
}

const initialState: StaffFormState = { error: null };

const inputClasses =
  "w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-brand-green focus:outline-none focus:ring-2 focus:ring-brand-green/30";
const labelClasses = "mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300";

export function StaffForm({ action, branches, member, isSelf }: StaffFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  const nameId = useId();
  const roleId = useId();
  const branchFieldId = useId();
  const activeId = useId();

  return (
    <form
      action={formAction}
      className="flex flex-col gap-5 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm"
    >
      <div>
        <p className={labelClasses}>Email</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">{member.email ?? "—"}</p>
        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
          Email and password are managed in the Supabase Dashboard, not here.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor={nameId} className={labelClasses}>
            Full name
          </label>
          <input
            id={nameId}
            name="fullName"
            defaultValue={member.fullName ?? ""}
            placeholder="e.g. Amina Bello"
            className={inputClasses}
          />
        </div>

        <div>
          <label htmlFor={branchFieldId} className={labelClasses}>
            Branch <span className="font-normal text-gray-400 dark:text-gray-500">(optional)</span>
          </label>
          <select
            id={branchFieldId}
            name="branchId"
            defaultValue={member.branchId ?? ""}
            className={inputClasses}
          >
            <option value="">No specific branch</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor={roleId} className={labelClasses}>
            Role
          </label>
          <select
            id={roleId}
            name="role"
            defaultValue={member.role}
            className={inputClasses}
          >
            <option value="staff">Staff</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        <div className="flex items-end">
          <label htmlFor={activeId} className="flex items-center gap-2 pb-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              id={activeId}
              name="isActive"
              type="checkbox"
              defaultChecked={member.isActive}
              className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-brand-green dark:text-emerald-400 focus:ring-brand-green/30"
            />
            Active (can sign in)
          </label>
        </div>
      </div>

      {isSelf && (
        <p className="text-xs text-gray-400 dark:text-gray-500">
          You can&apos;t remove your own admin access or deactivate yourself here — the save will be rejected. Have another admin make that change if needed.
        </p>
      )}

      {state.error && (
        <p
          className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-950/40 px-3 py-2 text-xs text-red-700 dark:text-red-400"
          role="alert"
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-brand-green px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-green-dark focus:outline-none focus:ring-2 focus:ring-brand-green/40 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Saving…" : "Save changes"}
        </button>
        <Link
          href="/dashboard/staff-management"
          className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
