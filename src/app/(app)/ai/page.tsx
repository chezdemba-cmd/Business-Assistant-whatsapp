import { pageOrgContext } from "@/server/page-context";
import { can } from "@/server/rbac/permissions";
import { PageHeader } from "@/components/ui";
import { ForbiddenPanel } from "@/components/ForbiddenPanel";
import { Assistant } from "@/components/ai/Assistant";
import { getProactiveDigest } from "@/server/automations/proactive";

export const metadata = { title: "Djeli IA — Djeli" };

export default async function AiPage() {
  const ctx = await pageOrgContext();
  if (!can(ctx.role, "ai.use")) {
    return <ForbiddenPanel role={ctx.role} requiredFor="Djeli IA" />;
  }

  const proactive = can(ctx.role, "recommendations.read")
    ? await getProactiveDigest(ctx.organization.id, ctx.role, ctx.user.id)
    : null;

  return (
    <>
      <PageHeader
        title="Djeli IA"
        subtitle="Interrogez vos données réelles. Les actions restent sous votre contrôle."
      />
      <Assistant
        organizationId={ctx.organization.id}
        proactive={
          proactive
            ? { headline: proactive.headline, items: proactive.items.map((i) => ({ label: i.label, href: i.href })) }
            : null
        }
      />
    </>
  );
}
