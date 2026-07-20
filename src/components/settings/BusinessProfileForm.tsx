"use client";

import { useActionState, useId } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import {
  updateBusinessProfile,
  type SettingsFormState,
} from "@/app/dashboard/settings/actions";

interface BusinessProfileFormProps {
  businessName: string;
  businessAddress: string | null;
  businessPhone: string | null;
  businessEmail: string | null;
}

const initialState: SettingsFormState = { error: null };

const inputClasses =
  "w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-brand-green focus:outline-none focus:ring-2 focus:ring-brand-green/30";
const labelClasses = "mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300";

export function BusinessProfileForm({
  businessName,
  businessAddress,
  businessPhone,
  businessEmail,
}: BusinessProfileFormProps) {
  const [state, formAction, isPending] = useActionState(updateBusinessProfile, initialState);

  const nameId = useId();
  const addressId = useId();
  const phoneId = useId();
  const emailId = useId();

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={nameId} className={labelClasses}>
            Business name
          </label>
          <input
            id={nameId}
            name="businessName"
            required
            defaultValue={businessName}
            className={inputClasses}
          />
        </div>

        <div>
          <label htmlFor={phoneId} className={labelClasses}>
            Phone <span className="font-normal text-gray-400 dark:text-gray-500">(optional)</span>
          </label>
          <input
            id={phoneId}
            name="businessPhone"
            type="tel"
            defaultValue={businessPhone ?? ""}
            className={inputClasses}
          />
        </div>

        <div>
          <label htmlFor={emailId} className={labelClasses}>
            Contact email <span className="font-normal text-gray-400 dark:text-gray-500">(optional)</span>
          </label>
          <input
            id={emailId}
            name="businessEmail"
            type="email"
            defaultValue={businessEmail ?? ""}
            className={inputClasses}
          />
        </div>

        <div>
          <label htmlFor={addressId} className={labelClasses}>
            Address <span className="font-normal text-gray-400 dark:text-gray-500">(optional)</span>
          </label>
          <input
            id={addressId}
            name="businessAddress"
            defaultValue={businessAddress ?? ""}
            className={inputClasses}
          />
        </div>
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-500">
        Shown on the login page and the browser tab title — visible to
        anyone before they sign in, same as a storefront sign.
      </p>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-brand-green px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-green-dark focus:outline-none focus:ring-2 focus:ring-brand-green/40 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Saving…" : "Save"}
        </button>

        {state.error && (
          <p
            className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-950/40 px-3 py-2 text-xs text-red-700 dark:text-red-400"
            role="alert"
          >
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {state.error}
          </p>
        )}

        {state.success && !state.error && (
          <p className="flex items-start gap-2 rounded-lg bg-green-50 dark:bg-green-950/40 px-3 py-2 text-xs text-green-700 dark:text-green-400">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Saved.
          </p>
        )}
      </div>
    </form>
  );
}
