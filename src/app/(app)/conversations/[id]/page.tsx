import Link from "next/link";
import { notFound } from "next/navigation";
import { pageOrgContext } from "@/server/page-context";
import { prisma } from "@/server/db/client";
import { can } from "@/server/rbac/permissions";
import {
  canAccessConversation,
  canAssignConversations,
} from "@/server/whatsapp/scope";
import {
  CONVERSATION_MODE_LABEL,
  CONVERSATION_STATUS_LABEL,
} from "@/server/whatsapp/conversation-mode";
import {
  isCustomerServiceWindowOpen,
  serviceWindowRemainingMs,
} from "@/server/whatsapp/service-window";
import { formatDateTime } from "@/lib/format";
import { Card, PageHeader, Badge } from "@/components/ui";
import { Composer } from "@/components/whatsapp/Composer";
import {
  ConversationModeControls,
  AssignControl,
} from "@/components/whatsapp/ConversationControls";
import { MarkReadOnView } from "@/components/whatsapp/MarkReadOnView";
import { getActiveDraftForConversation } from "@/server/ai/order-draft-service";
import { OrderDraftCard } from "@/components/ai/OrderDraftCard";
import { VoiceMessage } from "@/components/voice/VoiceMessage";

export const metadata = { title: "Conversation — FEREDRON" };

const PAGE_SIZE = 30;

const MEDIA_LABEL: Record<string, string> = {
  IMAGE: "📷 Image reçue",
  AUDIO: "🎙️ Message audio",
  VIDEO: "🎬 Vidéo reçue",
  DOCUMENT: "📄 Document reçu",
  LOCATION: "📍 Position partagée",
  CONTACT: "👤 Contact partagé",
  INTERACTIVE: "Réponse rapide",
  UNKNOWN: "Message reçu",
};

export default async function ConversationThreadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await pageOrgContext();
  if (!can(ctx.role, "conversations.read")) notFound();

  const conversation = await prisma.conversation.findFirst({
    where: { id, organizationId: ctx.organization.id },
    include: {
      customer: {
        select: {
          id: true,
          displayName: true,
          phone: true,
          area: true,
          assignedToUserId: true,
        },
      },
      assignedTo: { select: { firstName: true, lastName: true } },
      whatsappConnection: { select: { displayPhoneNumber: true, status: true } },
    },
  });
  if (!conversation) notFound();
  if (!canAccessConversation(ctx.role, ctx.user.id, conversation)) notFound();

  const canWrite = can(ctx.role, "conversations.write");
  const broad = canAssignConversations(ctx.role);

  const before = sp.before ? new Date(sp.before) : null;
  const messages = await prisma.message.findMany({
    where: {
      conversationId: conversation.id,
      ...(before && !Number.isNaN(before.getTime())
        ? { createdAt: { lt: before } }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE + 1,
    include: {
      sentBy: { select: { firstName: true, lastName: true } },
      voiceTranscription: {
        select: {
          status: true,
          effectiveText: true,
          originalText: true,
          correctedText: true,
          detectedLanguage: true,
          confidence: true,
          errorCode: true,
        },
      },
    },
  });
  const hasOlder = messages.length > PAGE_SIZE;
  const shown = (hasOlder ? messages.slice(0, PAGE_SIZE) : messages).reverse();
  const oldest = shown[0];

  const members = broad
    ? await prisma.organizationMember.findMany({
        where: { organizationId: ctx.organization.id, status: "ACTIVE" },
        include: { user: { select: { firstName: true, lastName: true } } },
      })
    : [];

  const [activeDraft, lastAiRun] = await Promise.all([
    getActiveDraftForConversation(ctx.organization.id, conversation.id),
    prisma.aiRun.findFirst({
      where: { organizationId: ctx.organization.id, conversationId: conversation.id },
      orderBy: { createdAt: "desc" },
      select: { status: true, handoffReason: true, createdAt: true },
    }),
  ]);
  const showHandoff =
    conversation.mode === "HUMAN" &&
    lastAiRun?.status === "HANDOFF" &&
    Boolean(lastAiRun.handoffReason);
  const convertedDraft =
    !activeDraft
      ? await prisma.orderDraft.findFirst({
          where: {
            organizationId: ctx.organization.id,
            conversationId: conversation.id,
            status: "CONVERTED",
          },
          orderBy: { createdAt: "desc" },
          include: { items: true },
        })
      : null;
  const draftForCard = activeDraft ?? convertedDraft;

  const windowOpen = isCustomerServiceWindowOpen(conversation.lastInboundAt);
  const remainingH = Math.floor(
    serviceWindowRemainingMs(conversation.lastInboundAt) / 3_600_000,
  );
  const name = conversation.customer?.displayName ?? `+${conversation.externalWaId}`;

  return (
    <>
      {conversation.unreadCount > 0 ? (
        <MarkReadOnView
          organizationId={ctx.organization.id}
          conversationId={conversation.id}
          unreadCount={conversation.unreadCount}
        />
      ) : null}

      <Link
        href="/conversations"
        style={{ fontSize: 13, color: "var(--text-3)", display: "inline-block", marginBottom: 12 }}
      >
        ← Conversations
      </Link>

      <PageHeader
        title={name}
        subtitle={`${conversation.customer?.phone ?? `+${conversation.externalWaId}`}${
          conversation.customer?.area ? ` · ${conversation.customer.area}` : ""
        } · ${CONVERSATION_STATUS_LABEL[conversation.status]}`}
        actions={
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <Badge variant={conversation.mode === "AUTO" ? "ok" : conversation.mode === "PAUSED" ? "default" : "accent"}>
              {CONVERSATION_MODE_LABEL[conversation.mode]}
            </Badge>
            {conversation.customer ? (
              <Link
                className="dj-btn dj-btn--outline"
                style={{ height: 34, fontSize: 12 }}
                href={`/customers/${conversation.customer.id}`}
              >
                Fiche client
              </Link>
            ) : null}
          </div>
        }
      />

      {showHandoff ? (
        <div
          className="dj-alert dj-alert--info"
          style={{ marginBottom: 16, alignItems: "flex-start" }}
        >
          <span>
            <strong>Intervention humaine requise</strong> — {lastAiRun!.handoffReason}
          </span>
        </div>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0,1fr) 280px",
          gap: 20,
          alignItems: "start",
        }}
      >
        <Card style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column", minHeight: 420 }}>
          <div style={{ flex: 1, padding: "16px 16px 8px", display: "flex", flexDirection: "column", gap: 10 }}>
            {hasOlder && oldest ? (
              <Link
                href={`/conversations/${conversation.id}?before=${encodeURIComponent(oldest.createdAt.toISOString())}`}
                style={{ alignSelf: "center", fontSize: 12, color: "var(--accent-active)" }}
              >
                Voir les messages plus anciens
              </Link>
            ) : null}

            {shown.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--text-3)", textAlign: "center", margin: "24px 0" }}>
                Aucun message pour l&apos;instant.
              </p>
            ) : (
              shown.map((m) => {
                const out = m.direction === "OUTBOUND";
                return (
                  <div
                    key={m.id}
                    style={{
                      alignSelf: out ? "flex-end" : "flex-start",
                      maxWidth: "78%",
                      background: out ? "var(--accent)" : "var(--card-alt)",
                      color: out ? "var(--on-accent)" : "inherit",
                      borderRadius: 16,
                      padding: "9px 13px",
                    }}
                  >
                    {m.generatedByAi ? (
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: "0.04em",
                          textTransform: "uppercase",
                          marginBottom: 3,
                          opacity: 0.85,
                        }}
                      >
                        FEREDRON IA
                      </div>
                    ) : null}
                    {m.type === "AUDIO" ? (
                      <VoiceMessage
                        organizationId={ctx.organization.id}
                        messageId={m.id}
                        outbound={out}
                        canEdit={canWrite}
                        transcription={
                          m.voiceTranscription
                            ? {
                                status: m.voiceTranscription.status,
                                effectiveText: m.voiceTranscription.effectiveText,
                                originalText: m.voiceTranscription.originalText,
                                correctedText: m.voiceTranscription.correctedText,
                                detectedLanguage: m.voiceTranscription.detectedLanguage,
                                confidence: m.voiceTranscription.confidence,
                                errorCode: m.voiceTranscription.errorCode,
                              }
                            : null
                        }
                      />
                    ) : (
                      <div style={{ fontSize: 14, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                        {m.type === "TEXT" && m.body
                          ? m.body
                          : MEDIA_LABEL[m.type] ?? "Message"}
                        {m.mediaCaption ? `\n${m.mediaCaption}` : ""}
                      </div>
                    )}
                    <div
                      style={{
                        fontSize: 10,
                        marginTop: 4,
                        opacity: 0.75,
                        display: "flex",
                        gap: 6,
                        justifyContent: out ? "flex-end" : "flex-start",
                      }}
                    >
                      <span>{formatDateTime(m.providerTimestamp ?? m.createdAt)}</span>
                      {out ? (
                        <span>
                          {m.status === "FAILED"
                            ? "échec"
                            : m.status === "READ"
                              ? "lu"
                              : m.status === "DELIVERED"
                                ? "remis"
                                : m.status === "SENT"
                                  ? "envoyé"
                                  : "en file"}
                        </span>
                      ) : null}
                    </div>
                    {out && m.status === "FAILED" && m.errorMessage ? (
                      <div style={{ fontSize: 10, marginTop: 2, color: "var(--warn-bg)" }}>
                        {m.errorMessage}
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>

          {canWrite ? (
            <Composer
              organizationId={ctx.organization.id}
              conversationId={conversation.id}
              windowOpen={windowOpen}
            />
          ) : (
            <div
              style={{
                borderTop: "1px solid var(--border)",
                padding: "12px 16px",
                fontSize: 12,
                color: "var(--text-3)",
              }}
            >
              Lecture seule — votre rôle ne permet pas de répondre.
            </div>
          )}
        </Card>

        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          {draftForCard ? (
            <OrderDraftCard
              organizationId={ctx.organization.id}
              canApprove={can(ctx.role, "orders.write")}
              draft={{
                id: draftForCard.id,
                status: draftForCard.status,
                currency: draftForCard.currency,
                totalAmount: draftForCard.totalAmount,
                convertedOrderId: draftForCard.convertedOrderId,
                items: draftForCard.items.map((it) => ({
                  productNameSnapshot: it.productNameSnapshot,
                  quantity: it.quantity,
                  unitPrice: it.unitPrice,
                  subtotal: it.subtotal,
                })),
              }}
            />
          ) : null}

          {canWrite ? (
            <Card>
              <h3 style={{ fontSize: 16, margin: "0 0 12px" }}>Mode</h3>
              <ConversationModeControls
                organizationId={ctx.organization.id}
                conversationId={conversation.id}
                mode={conversation.mode}
              />
            </Card>
          ) : null}

          {broad ? (
            <Card>
              <h3 style={{ fontSize: 16, margin: "0 0 12px" }}>Assignation</h3>
              <AssignControl
                organizationId={ctx.organization.id}
                conversationId={conversation.id}
                assignedToUserId={conversation.assignedToUserId}
                members={members.map((m) => ({
                  id: m.userId,
                  name: `${m.user.firstName} ${m.user.lastName}`,
                }))}
              />
            </Card>
          ) : conversation.assignedTo ? (
            <Card>
              <h3 style={{ fontSize: 16, margin: "0 0 8px" }}>Assignée à</h3>
              <p style={{ margin: 0, fontSize: 13 }}>
                {conversation.assignedTo.firstName} {conversation.assignedTo.lastName}
              </p>
            </Card>
          ) : null}

          <Card>
            <h3 style={{ fontSize: 16, margin: "0 0 8px" }}>Fenêtre de service</h3>
            <p style={{ margin: 0, fontSize: 13, color: windowOpen ? "var(--ok-fg)" : "var(--warn-fg)" }}>
              {windowOpen
                ? `Ouverte — environ ${remainingH} h restantes pour répondre en texte libre.`
                : "Fermée. Un modèle WhatsApp approuvé sera nécessaire (Phase suivante)."}
            </p>
            <p style={{ margin: "8px 0 0", fontSize: 11, color: "var(--text-muted)" }}>
              Numéro : {conversation.whatsappConnection.displayPhoneNumber ?? "—"}
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
