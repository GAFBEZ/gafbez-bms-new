"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { AlertCircle } from "lucide-react";
import {
  createNotification,
  type NotificationFormState,
} from "@/app/dashboard/notifications/actions";

const initialState: NotificationFormState = { error: null };

export function PostNotificationForm() {
  const [state, formAction, isPending] = useActionState(createNotification, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const messageId = useId();
  const typeId = useId();

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm sm:flex-row sm:items-end"
    >
      <div className="flex-1">
        <label htmlFor={messageId} className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
          Post a notification
        </label>
        <input
          id={messageId}
          name="message"
          required
          placeholder="e.g. Stocktake scheduled for Abuja branch on Friday"
          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-brand-green focus:outline-none focus:ring-2 focus:ring-brand-green/30"
        />
      </div>

      <div className="sm:w-40">
        <label htmlFor={typeId} className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
          Type
        </label>
        <select
          id={typeId}
          name="type"
          defaultValue="info"
          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-brand-green focus:outline-none focus:ring-2 focus:ring-brand-green/30"
        >
          <option value="info">Info</option>
          <option value="warning">Warning</option>
          <option value="success">Success</option>
        </select>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-brand-green px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-green-dark focus:outline-none focus:ring-2 focus:ring-brand-green/40 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Posting…" : "Post"}
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
