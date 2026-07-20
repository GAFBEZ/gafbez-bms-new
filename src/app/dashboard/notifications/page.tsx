import { PageHeader } from "@/components/ui/PageHeader";
import { PostNotificationForm } from "@/components/notifications/PostNotificationForm";
import { NotificationList } from "@/components/notifications/NotificationList";
import { getNotifications } from "@/lib/notifications";

export default async function NotificationsPage() {
  const notifications = await getNotifications();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Notifications"
        description="A shared notice board for the team — post updates, and mark them read once seen."
      />
      <PostNotificationForm />
      <NotificationList notifications={notifications ?? []} />
    </div>
  );
}
