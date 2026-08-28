"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { markNotificationsReadAction } from "@/server/actions/automations.actions";
import { Card } from "@/components/ui";

export type NotifRow = {
  id: string;
  type: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
};

const TYPE_LABEL: Record<string, string> = {
  RECOMMENDATION: "Recommandation",
  ORDER: "Commande",
  DEBT: "Créance",
  STOCK: "Stock",
  SYSTEM: "Système",
};

export function NotificationsList({ rows }: { rows: NotifRow[] }) {
  const router = useRouter();
  const [state, markAll] = useActionState(markNotificationsReadAction, null);

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  const unread = rows.filter((r) => !r.read).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {unread > 0 ? (
        <form action={markAll}>
          <button type="submit" className="dj-btn dj-btn--outline" style={{ height: 32, fontSize: 13 }}>
            Tout marquer comme lu ({unread})
          </button>
        </form>
      ) : null}

      {rows.length === 0 ? (
        <Card style={{ textAlign: "center", padding: "36px 24px" }}>
          <p style={{ margin: 0, color: "var(--text-2)", fontSize: 14 }}>
            Aucune notification pour le moment.
          </p>
        </Card>
      ) : (
        rows.map((n) => (
          <Card
            key={n.id}
            style={{
              padding: "14px 16px",
              borderLeft: n.read ? "3px solid transparent" : "3px solid var(--accent)",
            }}
          >
            <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
              <span className="dj-badge" style={{ flex: "none" }}>{TYPE_LABEL[n.type] ?? n.type}</span>
              <span style={{ fontSize: 14, fontWeight: 700 }}>{n.title}</span>
              <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-muted)" }}>
                {new Date(n.createdAt).toLocaleString("fr-FR")}
              </span>
            </div>
            <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 6, lineHeight: 1.5 }}>
              {n.body}
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
