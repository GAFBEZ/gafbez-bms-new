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

/** These links are free-text from the signup form (an untrusted
 * customer), rendered here as a clickable href for an admin -- reject
 * anything that isn't a plain http(s) URL so a `javascript:` value can't
 * be used to attack the staff member reviewing the application. */
function toSafeHttpUrl(value: string): string | null {
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const parsed = new URL(withScheme);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

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

  const profileLinks = [
    { label: "TikTok", url: application.tiktokUrl },
    { label: "Instagram", url: application.instagramUrl },
    { label: "Website", url: application.websiteUrl },
    { label: "Google", url: application.googleProfileUrl },
  ]
    .filter((link): link is { label: string; url: string } => Boolean(link.url))
    .map((link) => ({ ...link, safeUrl: toSafeHttpUrl(link.url) }));

  return (
    <tr>
      <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{application.fullName}</td>
      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{application.businessName ?? "—"}</td>
      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{application.email}</td>
      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{application.phone ?? "—"}</td>
      <td className="px-4 py-3">
        {profileLinks.length === 0 ? (
          <span className="text-gray-400 dark:text-gray-500">—</span>
        ) : (
          <div className="flex flex-col gap-0.5">
            {profileLinks.map((link) =>
              link.safeUrl ? (
                <a
                  key={link.label}
                  href={link.safeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-brand-green underline underline-offset-2 hover:text-brand-green-dark"
                >
                  {link.label}
                </a>
              ) : (
                <span key={link.label} className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  {link.label}: {link.url}
                </span>
              ),
            )}
          </div>
        )}
      </td>
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
