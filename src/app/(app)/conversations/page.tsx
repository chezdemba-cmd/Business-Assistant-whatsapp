import Link from "next/link";
import type { ConversationMode, ConversationStatus, Prisma } from "@prisma/client";
import { pageOrgContext } from "@/server/page-context";
import { prisma } from "@/server/db/client";
import { can } from "@/server/rbac/permissions";
import { conversationScopeWhere, canAssignConversations } from "@/server/whatsapp/scope";
import { getConnectionForOrg } from "@/server/whatsapp/connection-service";
import {
  CONVERSATION_MODE_LABEL,
  CONVERSATION_MODES,
} from "@/server/whatsapp/conversation-mode";
import { formatDateTime } from "@/lib/format";
import { Card, PageHeader, Badge, Avatar, EmptyState } from "@/components/ui";
import { ForbiddenPanel } from "@/components/ForbiddenPanel";
import { Pager } from "@/components/Pager";
import { ConversationFilters } from "@/components/whatsapp/ConversationFilters";

export const metadata = { title: "Conversations — FEREDRON" };

const PER_PAGE = 25;

export default async function ConversationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const ctx = await pageOrgContext();
  if (!can(ctx.role, "conversations.read")) {
    return <ForbiddenPanel role={ctx.role} requiredFor="les conversations" />;
  }
  const orgId = ctx.organization.id;
  const broad = canAssignConversations(ctx.role);
  const scope = conversationScopeWhere(ctx.role, ctx.user.id);
  const connection = await getConnectionForOrg(orgId);

  const header = (
    <PageHeader
      title="Conversations"
      subtitle="Fil WhatsApp par client. AUTO / HUMAIN / EN PAUSE — l'IA (Phase 6) ne répond pas encore."
    />
  );

  if (!connection || connection.status !== "CONNECTED") {
    return (
      <>
        {header}
        <EmptyState
          title="WhatsApp non connecté"
          message="Connectez le numéro WhatsApp Business de l'entreprise dans les paramètres pour recevoir et envoyer des messages."
          action={
            can(ctx.role, "settings.read") ? (
              <Link className="dj-btn dj-btn--primary" href="/settings">
                Ouvrir les paramètres
              </Link>
            ) : undefined
          }
        />
      </>
    );
  }

  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const q = (sp.q ?? "").trim();
  const modeParam = CONVERSATION_MODES.includes(sp.mode as ConversationMode)
    ? (sp.mode as ConversationMode)
    : undefined;
  const statusParam = (["OPEN", "CLOSED", "ARCHIVED"] as ConversationStatus[]).includes(
    sp.status as ConversationStatus,
  )
    ? (sp.status as ConversationStatus)
    : undefined;

  const where: Prisma.ConversationWhereInput = {
    organizationId: orgId,
    ...scope,
    ...(statusParam ? { status: statusParam } : { status: { not: "ARCHIVED" } }),
    ...(modeParam ? { mode: modeParam } : {}),
    ...(sp.unread === "1" ? { unreadCount: { gt: 0 } } : {}),
    ...(broad && sp.assigned === "me" ? { assignedToUserId: ctx.user.id } : {}),
    ...(broad && sp.assigned === "none" ? { assignedToUserId: null } : {}),
    ...(q
      ? {
          OR: [
            { externalWaId: { contains: q } },
            { customer: { displayName: { contains: q, mode: "insensitive" } } },
            { customer: { phone: { contains: q } } },
            { messages: { some: { body: { contains: q, mode: "insensitive" } } } },
          ],
        }
      : {}),
  };

  const [total, conversations] = await Promise.all([
    prisma.conversation.count({ where }),
    prisma.conversation.findMany({
      where,
      orderBy: { lastMessageAt: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      include: {
        customer: { select: { id: true, displayName: true, phone: true } },
        assignedTo: { select: { firstName: true, lastName: true } },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { body: true, direction: true, type: true, createdAt: true },
        },
      },
    }),
  ]);

  return (
    <>
      {header}
      <ConversationFilters canFilterAssignee={broad} />

      {total === 0 ? (
        <EmptyState
          title="Aucune conversation"
          message="Aucune conversation ne correspond à ces filtres. Les nouveaux messages WhatsApp apparaîtront ici."
        />
      ) : (
        <>
          <Card style={{ padding: 0, overflow: "hidden" }}>
            {conversations.map((c, i) => {
              const last = c.messages[0];
              const preview =
                last?.type === "TEXT" && last.body
                  ? last.body
                  : last
                    ? MEDIA_PREVIEW[last.type] ?? "Message"
                    : "Pas encore de message";
              const name = c.customer?.displayName ?? `+${c.externalWaId}`;
              return (
                <Link
                  key={c.id}
                  href={`/conversations/${c.id}`}
                  style={{
                    display: "flex",
                    gap: 12,
                    padding: "14px 16px",
                    borderTop: i === 0 ? "none" : "1px solid var(--border-soft)",
                    alignItems: "center",
                    color: "inherit",
                    textDecoration: "none",
                  }}
                >
                  <Avatar name={name} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 700 }}>{name}</span>
                      {c.unreadCount > 0 ? (
                        <span
                          className="tnum"
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            background: "var(--accent)",
                            color: "var(--on-accent)",
                            borderRadius: 999,
                            padding: "1px 7px",
                          }}
                        >
                          {c.unreadCount}
                        </span>
                      ) : null}
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        color: "var(--text-3)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {last?.direction === "OUTBOUND" ? "Vous : " : ""}
                      {preview}
                    </div>
                    {c.assignedTo ? (
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {c.assignedTo.firstName} {c.assignedTo.lastName}
                      </div>
                    ) : null}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                    <Badge variant={c.mode === "AUTO" ? "ok" : c.mode === "PAUSED" ? "default" : "accent"}>
                      {CONVERSATION_MODE_LABEL[c.mode]}
                    </Badge>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {formatDateTime(c.lastMessageAt)}
                    </span>
                  </div>
                </Link>
              );
            })}
          </Card>
          <Pager
            basePath="/conversations"
            searchParams={sp}
            page={page}
            total={total}
            perPage={PER_PAGE}
          />
        </>
      )}
    </>
  );
}

const MEDIA_PREVIEW: Record<string, string> = {
  IMAGE: "📷 Image",
  AUDIO: "🎙️ Audio",
  VIDEO: "🎬 Vidéo",
  DOCUMENT: "📄 Document",
  LOCATION: "📍 Position",
  CONTACT: "👤 Contact",
  INTERACTIVE: "Réponse",
  UNKNOWN: "Message",
};
