"use client";

import { useState, useTransition } from "react";
import type { InstallerApplication } from "@/types";
import { formatDate } from "@/lib/format";
import {
  approveInstallerApplication,
  rejectInstallerApplication,
  tempApproveInstallerApplication,
} from "@/app/dashboard/installer-applications/actions";

interface InstallerApplicationRowProps {
  application: InstallerApplication;
  /** Owner/Admin -- can give/finalize a permanent approve or reject. */
  canFinalApprove: boolean;
  /** Owner/Admin, or a staff member with profiles.can_temp_approve_installers
   * -- can only grant the provisional temp-approve on a pending
   * application (see 0042_installer_temp_approval.sql). Admins already
   * see the full Approve/Reject actions instead, so this only changes
   * what a non-admin trusted staff member sees. */
  canTempApprove: boolean;
}

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-brand-gold-soft text-amber-700 dark:text-amber-400",
  temp_approved: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400",
  approved: "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400",
  rejected: "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "pending",
  temp_approved: "temp approved",
  approved: "approved",
  rejected: "rejected",
};

const TEMP_APPROVAL_WINDOW_MS = 72 * 60 * 60 * 1000;

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

export default function InstallerApplicationRow({ application, canFinalApprove, canTempApprove }: InstallerApplicationRowProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  // Lazy initializer -- runs once at mount, the sanctioned way to capture
  // a non-deterministic value like Date.now() without violating React's
  // render-purity rule (calling Date.now() directly in the render body
  // is flagged). A staff member reloading the page after 72h have passed
  // will still see the correct expired state on that fresh render.
  const [now] = useState(() => Date.now());

  function run(action: () => Promise<{ error: string | null }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      setError(result.error);
    });
  }

  const isPendingReview = application.installerStatus === "pending";
  const isTempApproved = application.installerStatus === "temp_approved";
  const isTempApprovalExpired =
    isTempApproved && application.installerTempApprovedAt !== null && now - new Date(application.installerTempApprovedAt).getTime() > TEMP_APPROVAL_WINDOW_MS;

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
        <div className="flex flex-col gap-1">
          <span className={`w-fit rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${STATUS_STYLES[application.installerStatus]}`}>
            {STATUS_LABELS[application.installerStatus]}
          </span>
          {isTempApproved && isTempApprovalExpired && (
            <span className="text-[11px] text-amber-700 dark:text-amber-400">Expired -- retail pricing resumed, needs final review</span>
          )}
          {application.installerTempApprovedByName && (
            <span className="text-[11px] text-gray-500 dark:text-gray-400">
              Temp-approved by {application.installerTempApprovedByName}
              {application.installerTempApprovedAt ? ` on ${formatDate(application.installerTempApprovedAt)}` : ""}
            </span>
          )}
          {application.installerReviewedByName && application.installerStatus !== "pending" && application.installerStatus !== "temp_approved" && (
            <span className="text-[11px] text-gray-500 dark:text-gray-400">
              {application.installerStatus === "approved" ? "Approved" : "Rejected"} by {application.installerReviewedByName}
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{formatDate(application.createdAt)}</td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-2">
          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

          {isPendingReview && !rejecting && canFinalApprove && (
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

          {isPendingReview && !canFinalApprove && canTempApprove && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => run(() => tempApproveInstallerApplication(application.id))}
              className="w-fit rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
            >
              Temp-Approve
            </button>
          )}

          {isTempApproved && !rejecting && canFinalApprove && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={isPending}
                onClick={() => run(() => approveInstallerApplication(application.id))}
                className="rounded-lg bg-brand-green px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
              >
                Finalize Approval
              </button>
              <button type="button" onClick={() => setRejecting(true)} className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-600">
                Reject
              </button>
            </div>
          )}

          {isTempApproved && !canFinalApprove && (
            <p className="text-xs text-gray-500 dark:text-gray-400">Awaiting Owner/Admin final review.</p>
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
