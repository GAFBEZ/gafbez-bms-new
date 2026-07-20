import { createClient } from "@/lib/supabase/server";
import type { Notification } from "@/types";

interface NotificationRow {
  id: string;
  type: Notification["type"];
  message: string;
  is_read: boolean;
  created_at: string;
}

function mapRow(row: NotificationRow): Notification {
  return {
    id: row.id,
    type: row.type,
    message: row.message,
    isRead: row.is_read,
    createdAt: row.created_at,
  };
}

/**
 * Returns null if the query fails (e.g. migration not run yet), so callers
 * can distinguish "couldn't load" from "loaded, zero rows."
 */
export async function getNotifications(limit = 100): Promise<Notification[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, message, is_read, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) {
    console.warn("Failed to load notifications:", error?.message);
    return null;
  }

  return (data as NotificationRow[]).map(mapRow);
}

export async function getUnreadNotificationCount(): Promise<number | null> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("is_read", false);

  if (error || count === null) {
    console.warn("Failed to load unread notification count:", error?.message);
    return null;
  }

  return count;
}
