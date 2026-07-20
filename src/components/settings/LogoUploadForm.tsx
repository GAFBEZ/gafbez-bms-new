"use client";

import { useActionState, useId, useTransition } from "react";
import Image from "next/image";
import { AlertCircle, CheckCircle2, ImageIcon } from "lucide-react";
import {
  updateLogo,
  removeLogo,
  type SettingsFormState,
} from "@/app/dashboard/settings/actions";

interface LogoUploadFormProps {
  logoUrl: string | null;
}

const initialState: SettingsFormState = { error: null };

export function LogoUploadForm({ logoUrl }: LogoUploadFormProps) {
  const [state, formAction, isPending] = useActionState(updateLogo, initialState);
  const [isRemoving, startRemoveTransition] = useTransition();
  const fileId = useId();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          {logoUrl ? (
            <Image
              src={logoUrl}
              alt="Current logo"
              width={64}
              height={64}
              className="h-full w-full object-contain p-1"
            />
          ) : (
            <ImageIcon className="h-6 w-6 text-gray-300 dark:text-gray-600" aria-hidden="true" />
          )}
        </span>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {logoUrl ? "Custom logo in use." : "Using the default mark — no custom logo uploaded."}
        </div>
      </div>

      <form action={formAction} className="flex flex-wrap items-center gap-3">
        <label htmlFor={fileId} className="sr-only">
          Logo file
        </label>
        <input
          id={fileId}
          name="logo"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          required
          className="text-sm text-gray-600 dark:text-gray-400 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-green-soft file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-green dark:file:text-emerald-400 hover:file:bg-brand-green-soft/80"
        />

        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-brand-green px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-green-dark focus:outline-none focus:ring-2 focus:ring-brand-green/40 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Uploading…" : "Upload"}
        </button>

        {logoUrl && (
          <button
            type="button"
            disabled={isRemoving}
            onClick={() => startRemoveTransition(() => removeLogo())}
            className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRemoving ? "Removing…" : "Remove"}
          </button>
        )}
      </form>

      <p className="text-xs text-gray-400 dark:text-gray-500">
        PNG, JPEG, WebP, or SVG, up to 2MB. Shown on the login page, the
        sidebar, and the mobile navigation drawer.
      </p>

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
  );
}
