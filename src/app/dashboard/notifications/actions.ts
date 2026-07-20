"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface NotificationFormState {
  error: string | null;
  /** Only true immediately after a successful submit — lets the form know
   * to reset itself, distinct from the initial (also error: null) state. */
  success?: boolean;
}

export async function createNotification(
  _prevState: NotificationFormState,
  formData: FormData,
): Promise<NotificationFormState> {
  const message = String(formData.get("message") ?? "").trim();
  const type = String(formData.get("type") ?? "info");

  if (!message) {
    return { error: "Enter a message to post." };
  }
  if (!["info", "warning", "success"].includes(type)) {
    return { error: "Invalid notification type." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("notifications").insert({ message, type });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard/notifications");
  revalidatePath("/dashboard");
  return { error: null, success: true };
}

export async function markNotificationRead(id: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("notifications").update({ is_read: true }).eq("id", id);
  revalidatePath("/dashboard/notifications");
  revalidatePath("/dashboard");
}
