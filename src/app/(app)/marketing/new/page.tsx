import { pageOrgContext } from "@/server/page-context";
import { can } from "@/server/rbac/permissions";
import { PageHeader } from "@/components/ui";
import { ForbiddenPanel } from "@/components/ForbiddenPanel";
import { CampaignForm } from "@/components/marketing/CampaignForm";

export const metadata = { title: "Nouvelle campagne — FEREDRON" };

export default async function NewCampaignPage() {
  const ctx = await pageOrgContext();
  if (!can(ctx.role, "marketing.manage")) {
    return <ForbiddenPanel role={ctx.role} requiredFor="la création de campagnes" />;
  }
  return (
    <>
      <PageHeader
        title="Nouvelle campagne"
        subtitle="Étape 1/3 — définissez l'objectif, l'audience et le message. Vous validerez l'audience puis l'envoi."
      />
      <CampaignForm />
    </>
  );
}
