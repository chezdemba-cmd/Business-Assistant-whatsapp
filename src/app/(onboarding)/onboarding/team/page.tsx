import { requireUser } from "@/server/auth/current-user";
import { requireOrgContext } from "@/server/tenant/context";
import { requirePermission } from "@/server/rbac/guard";
import { Card } from "@/components/ui";
import { InviteMemberForm } from "@/components/InviteMemberForm";
import { FinishOnboarding } from "./FinishOnboarding";

export const metadata = { title: "Inviter votre équipe — Djeli" };

export default async function OnboardingTeamPage() {
  const user = await requireUser();
  const ctx = await requireOrgContext(user);
  requirePermission(ctx.role, "members.invite");

  return (
    <>
      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 38,
          lineHeight: 1.08,
          margin: "0 0 8px",
        }}
      >
        Invitez votre équipe
      </h1>
      <p style={{ margin: "0 0 32px", color: "var(--text-2)", maxWidth: 500 }}>
        Chacun reçoit un lien d&apos;invitation. Vous pourrez modifier les rôles à
        tout moment, ou passer cette étape et le faire plus tard.
      </p>

      <Card style={{ marginBottom: 20 }}>
        <InviteMemberForm
          organizationId={ctx.organization.id}
          countryCode={ctx.organization.countryCode}
        />
      </Card>

      <FinishOnboarding />
    </>
  );
}
