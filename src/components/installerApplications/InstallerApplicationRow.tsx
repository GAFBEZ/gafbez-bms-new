"use client";

import { useState, useTransition } from "react";
import type { InstallerApplication } from "@/types";
import { formatDate } from "@/lib/format";
import { approveInstallerApplication, rejectInstallerApplication } from "@/app/dashboard/installer-applications/actions";

interface InstallerApplicationRowProps {
  application: InstallerApplication;
}

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-brand-gold-soft text-amber-700 dark:text-amber-400",
  approved: "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400",
  rejected: "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400",
};

export default function InstallerApplicationRow({ application }: InstallerApplicationRowProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  function run(action: () => Promise<{ error: string | null }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      setError(result.error);
    });
  }

  const canReview = application.installerStatus === "pending";

  return (
    <tr>
      <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{application.fullName}</td>
      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{application.businessName ?? "—"}</td>
      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{application.email}</td>
      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{application.phone ?? "—"}</td>
      <td className="px-4 py-3">
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${STATUS_STYLES[application.installerStatus]}`}>
          {application.installerStatus}
        </span>
      </td>
      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{formatDate(application.createdAt)}</td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-2">
          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

          {canReview && !rejecting && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={isPending}
                onClick={() => run(() => approveInstallerApplication(application.id))}
                className="rounded-lg bg-brand-green px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
              >
                Approve
              </button>
              <button type="button" onClick={() => setRejecting(true)} className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-600">
                Reject
              </button>
            </div>
          )}

          {rejecting && (
            <div className="flex flex-col gap-1.5">
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Rejection reason"
                className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1 text-xs"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => run(() => rejectInstallerApplication(application.id, reason))}
                  className="rounded-lg bg-red-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
                >
                  Confirm Reject
                </button>
                <button type="button" onClick={() => setRejecting(false)} className="text-xs text-gray-500 dark:text-gray-400">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {application.installerStatus === "rejected" && application.installerRejectionReason && (
            <p className="text-xs text-gray-500 dark:text-gray-400">{application.installerRejectionReason}</p>
          )}
        </div>
      </td>
    </tr>
  );
}
