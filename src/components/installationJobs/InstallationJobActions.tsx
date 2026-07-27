"use client";

import { useActionState } from "react";
import type { ComboPackage, InstallationJob } from "@/types";
import {
  scheduleInspection,
  recordInspectionResult,
  scheduleInstallation,
  startInstallation,
  completeInstallation,
  type InstallationJobActionState,
} from "@/app/dashboard/installation-jobs/actions";

const initial: InstallationJobActionState = { error: null };
const inputClasses =
  "w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-brand-green focus:outline-none";

function ErrorText({ error }: { error: string | null }) {
  if (!error) return null;
  return <p className="text-sm text-red-600 dark:text-red-400">{error}</p>;
}

interface InstallationJobActionsProps {
  job: InstallationJob;
  higherCapacityPackages: ComboPackage[];
}

/** Only rendered by the detail page when can_act_on_installation would
 * allow it (Owner, that branch's Manager, or an opted-in salesperson) --
 * the RPCs themselves re-check this regardless, so a stale render here is
 * harmless, just rejected server-side with a clear error. */
export default function InstallationJobActions({ job, higherCapacityPackages }: InstallationJobActionsProps) {
  const [inspectionState, inspectionAction, inspectionPending] = useActionState(scheduleInspection.bind(null, job.id), initial);
  const [resultState, resultAction, resultPending] = useActionState(recordInspectionResult.bind(null, job.id), initial);
  const [installState, installAction, installPending] = useActionState(scheduleInstallation.bind(null, job.id), initial);

  if (job.status === "site_inspection_required" || job.status === "inspection_scheduled") {
    return (
      <div className="flex flex-col gap-6">
        <form action={inspectionAction} className="flex flex-col gap-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Schedule Site Inspection</h3>
          <label className="text-xs text-gray-500 dark:text-gray-400">Scheduled Date &amp; Time</label>
          <input type="datetime-local" name="scheduledAt" required className={inputClasses} defaultValue={job.inspectionScheduledAt?.slice(0, 16)} />
          <label className="text-xs text-gray-500 dark:text-gray-400">Customer Address</label>
          <input type="text" name="customerAddress" className={inputClasses} defaultValue={job.customerAddress ?? ""} />
          <ErrorText error={inspectionState.error} />
          <button type="submit" disabled={inspectionPending} className="self-start rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {inspectionPending ? "Saving…" : "Schedule Inspection"}
          </button>
        </form>

        <form action={resultAction} className="flex flex-col gap-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Record Inspection Result</h3>
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-1.5">
              <input type="radio" name="result" value="suitable" required /> Suitable
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" name="result" value="unsuitable" required /> Unsuitable
            </label>
          </div>
          <label className="text-xs text-gray-500 dark:text-gray-400">Notes (required if unsuitable)</label>
          <textarea name="notes" rows={2} className={inputClasses} />
          {higherCapacityPackages.length > 0 && (
            <>
              <label className="text-xs text-gray-500 dark:text-gray-400">Recommend a higher-capacity package (only if unsuitable)</label>
              <select name="recommendedPackageId" className={inputClasses} defaultValue="">
                <option value="">No recommendation</option>
                {higherCapacityPackages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </>
          )}
          <ErrorText error={resultState.error} />
          <button type="submit" disabled={resultPending} className="self-start rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {resultPending ? "Saving…" : "Record Result"}
          </button>
        </form>
      </div>
    );
  }

  if (job.status === "package_suitable") {
    return (
      <form action={installAction} className="flex flex-col gap-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">Schedule Installation</h3>
        <label className="text-xs text-gray-500 dark:text-gray-400">Scheduled Date &amp; Time</label>
        <input type="datetime-local" name="scheduledAt" required className={inputClasses} />
        <ErrorText error={installState.error} />
        <button type="submit" disabled={installPending} className="self-start rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {installPending ? "Saving…" : "Schedule Installation"}
        </button>
      </form>
    );
  }

  if (job.status === "installation_scheduled") {
    return (
      <form action={() => startInstallation(job.id)}>
        <button type="submit" className="rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white">
          Start Installation
        </button>
      </form>
    );
  }

  if (job.status === "installation_in_progress") {
    return (
      <form action={() => completeInstallation(job.id)}>
        <button type="submit" className="rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white">
          Mark Installation Completed
        </button>
      </form>
    );
  }

  if (job.status === "awaiting_customer_decision") {
    return <p className="text-sm text-gray-500 dark:text-gray-400">Waiting on the customer&apos;s decision (refund, store credit, or upgrade).</p>;
  }

  return null;
}
