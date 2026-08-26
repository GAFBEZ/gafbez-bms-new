"use client";

import { useActionState, useId } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import {
  updateQuoteBranding,
  type SettingsFormState,
} from "@/app/dashboard/settings/actions";

interface QuoteBrandingFormProps {
  quoteTagline: string | null;
  quoteServicesLine: string | null;
  quotePaymentDetails: string | null;
  quoteTermsAndWarranty: string | null;
  quoteFooterDetails: string | null;
}

const initialState: SettingsFormState = { error: null };

const inputClasses =
  "w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-brand-green focus:outline-none focus:ring-2 focus:ring-brand-green/30";
const labelClasses = "mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300";

export function QuoteBrandingForm({
  quoteTagline,
  quoteServicesLine,
  quotePaymentDetails,
  quoteTermsAndWarranty,
  quoteFooterDetails,
}: QuoteBrandingFormProps) {
  const [state, formAction, isPending] = useActionState(updateQuoteBranding, initialState);

  const taglineId = useId();
  const servicesId = useId();
  const paymentId = useId();
  const termsId = useId();
  const footerId = useId();

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={taglineId} className={labelClasses}>
            Tagline <span className="font-normal text-gray-400 dark:text-gray-500">(optional)</span>
          </label>
          <input
            id={taglineId}
            name="quoteTagline"
            defaultValue={quoteTagline ?? ""}
            placeholder="e.g. Reliable Power, Every Day"
            className={inputClasses}
          />
        </div>

        <div>
          <label htmlFor={servicesId} className={labelClasses}>
            Services line <span className="font-normal text-gray-400 dark:text-gray-500">(optional)</span>
          </label>
          <input
            id={servicesId}
            name="quoteServicesLine"
            defaultValue={quoteServicesLine ?? ""}
            placeholder="e.g. Solar, Inverters & Batteries — Sales, Installation & Maintenance"
            className={inputClasses}
          />
        </div>
      </div>

      <div>
        <label htmlFor={paymentId} className={labelClasses}>
          Payment details
        </label>
        <textarea
          id={paymentId}
          name="quotePaymentDetails"
          rows={3}
          defaultValue={quotePaymentDetails ?? ""}
          placeholder="Bank name, account name, account number…"
          className={`${inputClasses} resize-none`}
        />
      </div>

      <div>
        <label htmlFor={termsId} className={labelClasses}>
          Terms & warranty
        </label>
        <textarea
          id={termsId}
          name="quoteTermsAndWarranty"
          rows={5}
          defaultValue={quoteTermsAndWarranty ?? ""}
          placeholder="Warranty coverage, support terms…"
          className={`${inputClasses} resize-none`}
        />
      </div>

      <div>
        <label htmlFor={footerId} className={labelClasses}>
          Footer details <span className="font-normal text-gray-400 dark:text-gray-500">(optional)</span>
        </label>
        <textarea
          id={footerId}
          name="quoteFooterDetails"
          rows={2}
          defaultValue={quoteFooterDetails ?? ""}
          placeholder="Extra footer content: address, website, registration number…"
          className={`${inputClasses} resize-none`}
        />
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-500">
        Shown on every quote built with the staff Quote Builder, alongside the business name/address/phone/email/logo above.
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
