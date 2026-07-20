"use client";

import { useTransition } from "react";
import { AlertTriangle, Check, Info, TrendingUp } from "lucide-react";
import { markNotificationRead } from "@/app/dashboard/notifications/actions";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Notification } from "@/types";

interface NotificationListProps {
  notifications: Notification[];
}

const iconByType = {
  info: Info,
  warning: AlertTriangle,
  success: TrendingUp,
} as const;

function MarkReadButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() => startTransition(() => markNotificationRead(id))}
      disabled={isPending}
      className="flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-300 dark:border-gray-600 px-2.5 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-green/30 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Check className="h-3.5 w-3.5" aria-hidden="true" />
      Mark read
    </button>
  );
}

export function NotificationList({ notifications }: NotificationListProps) {
  if (notifications.length === 0) {
    return (
      <EmptyState
        title="No notifications yet"
        description="Posted notifications will show up here."
      />
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {notifications.map((notification) => {
        const Icon = iconByType[notification.type];
        return (
          <li
            key={notification.id}
            className={`flex items-start gap-3 rounded-xl border p-4 shadow-sm ${
              notification.isRead
                ? "border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900"
                : "border-brand-gold/30 bg-brand-gold-soft"
            }`}
          >
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-green-soft text-brand-green dark:text-emerald-400">
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="flex-1">
              <p className="text-sm text-gray-800 dark:text-gray-200">{notification.message}</p>
              <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                {new Date(notification.createdAt).toLocaleString("en-NG", {
                  day: "numeric",
                  month: "short",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </p>
            </div>
            {!notification.isRead && <MarkReadButton id={notification.id} />}
          </li>
        );
      })}
    </ul>
  );
}
