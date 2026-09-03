import { pageOrgContext } from "@/server/page-context";
import { PageHeader } from "@/components/ui";
import { listNotifications } from "@/server/notifications/notification-service";
import {
  NotificationsList,
  type NotifRow,
} from "@/components/notifications/NotificationsList";

export const metadata = { title: "Notifications — FEREDRON" };

export default async function NotificationsPage() {
  const ctx = await pageOrgContext();
  const list = await listNotifications(ctx.organization.id, ctx.role, ctx.user.id, {
    take: 60,
  });
  const rows: NotifRow[] = list.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    createdAt: n.createdAt.toISOString(),
    read: n.readAt != null,
  }));

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle="Les alertes importantes de votre activité — stock, créances, commandes, recommandations."
      />
      <NotificationsList rows={rows} />
    </>
  );
}
