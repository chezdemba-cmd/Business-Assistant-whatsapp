import type { Role } from "@prisma/client";
import { pageOrgContext } from "@/server/page-context";
import { prisma } from "@/server/db/client";
import { can, permissionsOf } from "@/server/rbac/permissions";
import { Card, PageHeader, roleLabel } from "@/components/ui";
import { ForbiddenPanel } from "@/components/ForbiddenPanel";
import { MembersTable, type MemberRowData } from "@/components/members/MembersTable";
import {
  InvitationsList,
  type InvitationRow,
} from "@/components/members/InvitationsList";
import { InviteMemberForm } from "@/components/InviteMemberForm";

export const metadata = { title: "Membres & rôles — FEREDRON" };

const ROLE_ORDER: Record<Role, number> = {
  OWNER: 0,
  ADMIN: 1,
  MANAGER: 2,
  SALES: 3,
  EMPLOYEE: 4,
};

const ROLE_DESC: Record<Role, string> = {
  OWNER:
    "Propriétaire de l'entreprise. Accès total, y compris facturation (à venir) et suppression de l'organisation. Un seul par entreprise.",
  ADMIN:
    "Gère l'équipe, les paramètres et les opérations. Ne peut ni supprimer l'organisation ni gérer la facturation.",
  MANAGER:
    "Commandes, stock, clients, relances et données opérationnelles. Consulte les paramètres.",
  SALES:
    "Répond aux conversations, crée des commandes, consulte ses clients et le catalogue.",
  EMPLOYEE: "Accès en lecture principalement, plus les tâches qui lui sont assignées.",
};

export default async function MembersPage() {
  const ctx = await pageOrgContext();
  const { organization, role, user } = ctx;

  if (!can(role, "members.read")) {
    return <ForbiddenPanel role={role} requiredFor="la gestion des membres" />;
  }

  const [members, invitations] = await Promise.all([
    prisma.organizationMember.findMany({
      where: { organizationId: organization.id },
      include: { user: true },
    }),
    prisma.invitation.findMany({
      where: { organizationId: organization.id, status: "PENDING" },
      include: { invitedBy: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const rows: MemberRowData[] = members
    .slice()
    .sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role])
    .map((m) => ({
      membershipId: m.id,
      name: `${m.user.firstName} ${m.user.lastName}`,
      phone: m.user.phone,
      email: m.user.email,
      role: m.role,
      status: m.status,
      isOwner: m.role === "OWNER",
      isSelf: m.userId === user.id,
    }));

  const inviteRows: InvitationRow[] = invitations.map((inv) => ({
    id: inv.id,
    phone: inv.phone,
    role: inv.role,
    createdAt: inv.createdAt.toLocaleDateString("fr-FR"),
    invitedBy: `${inv.invitedBy.firstName} ${inv.invitedBy.lastName}`,
  }));

  const canInvite = can(role, "members.invite");

  return (
    <>
      <PageHeader
        title="Membres & rôles"
        subtitle="Chaque membre appartient uniquement à cette organisation. Les permissions découlent du rôle."
      />

      <Card style={{ padding: 0, overflow: "hidden", marginBottom: 24 }}>
        <MembersTable
          organizationId={organization.id}
          members={rows}
          canUpdate={can(role, "members.update")}
          canRemove={can(role, "members.remove")}
        />
      </Card>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: canInvite ? "1fr 1fr" : "1fr",
          gap: 20,
          alignItems: "start",
          marginBottom: 32,
        }}
      >
        {canInvite ? (
          <Card>
            <h3 style={{ fontSize: 21, margin: "0 0 16px" }}>Inviter un membre</h3>
            <InviteMemberForm
              organizationId={organization.id}
              countryCode={organization.countryCode}
              compact
            />
          </Card>
        ) : null}
        <Card>
          <h3 style={{ fontSize: 21, margin: "0 0 16px" }}>Invitations en attente</h3>
          <InvitationsList
            organizationId={organization.id}
            invitations={inviteRows}
          />
        </Card>
      </div>

      <h3 style={{ fontSize: 23, margin: "0 0 16px" }}>
        Ce que chaque rôle peut faire
      </h3>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))",
          gap: 16,
        }}
      >
        {(Object.keys(ROLE_ORDER) as Role[]).map((r) => (
          <Card key={r} style={{ padding: 22 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.08em",
                color: "var(--warn-fg)",
                marginBottom: 10,
              }}
            >
              {r}
            </div>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 17,
                marginBottom: 8,
              }}
            >
              {roleLabel(r)}
            </div>
            <div
              style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.5 }}
            >
              {ROLE_DESC[r]}
            </div>
            <div
              style={{
                marginTop: 12,
                fontSize: 11,
                color: "var(--text-muted)",
              }}
            >
              {permissionsOf(r).length} permissions
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
