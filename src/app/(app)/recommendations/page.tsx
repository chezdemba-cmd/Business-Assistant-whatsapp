import Link from "next/link";
import { pageOrgContext } from "@/server/page-context";
import { can } from "@/server/rbac/permissions";
import { PageHeader, Card } from "@/components/ui";
import { ForbiddenPanel } from "@/components/ForbiddenPanel";
import {
  listRecommendations,
  markRecommendationsViewed,
} from "@/server/automations/recommendation-service";
import { getLatestDailySummary } from "@/server/automations/proactive";
import {
  RecommendationsPanel,
  type RecoRow,
} from "@/components/automations/RecommendationsPanel";

export const metadata = { title: "À surveiller — Djeli" };

type SP = { [k: string]: string | string[] | undefined };

export default async function RecommendationsPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const ctx = await pageOrgContext();
  if (!can(ctx.role, "recommendations.read")) {
    return <ForbiddenPanel role={ctx.role} requiredFor="les recommandations" />;
  }
  const sp = await searchParams;
  const showDismissed = sp.view === "dismissed";

  const list = await listRecommendations(
    ctx.organization.id,
    ctx.role,
    ctx.user.id,
    { status: showDismissed ? "DISMISSED" : "OPEN" },
    200,
  );
  const daily = await getLatestDailySummary(ctx.organization.id);

  // Marque VUES les recommandations affichées (NEW → VIEWED).
  await markRecommendationsViewed(
    ctx.organization.id,
    list.filter((r) => r.status === "NEW").map((r) => r.id),
  );

  const rows: RecoRow[] = list
    .filter((r) => r.type !== "DAILY_SUMMARY")
    .map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      description: r.description,
      priority: r.priority,
      status: r.status,
      actionType: r.actionType,
      detectedAt: r.detectedAt.toISOString(),
    }));

  return (
    <>
      <PageHeader
        title="À surveiller aujourd'hui"
        subtitle="Les points détectés par Djeli dans votre activité. Chaque recommandation propose une action à préparer — jamais exécutée sans vous."
      />

      {daily && !showDismissed ? (
        <Card style={{ marginBottom: 16, background: "var(--card-alt)" }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-3)", marginBottom: 6 }}>
            Résumé du jour
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.55 }}>{daily.description}</div>
        </Card>
      ) : null}

      <div style={{ display: "flex", gap: 8, marginBottom: 14, fontSize: 13 }}>
        <Link
          href="/recommendations"
          className="dj-badge"
          style={{ fontWeight: showDismissed ? 400 : 700 }}
        >
          Actives
        </Link>
        <Link
          href="/recommendations?view=dismissed"
          className="dj-badge"
          style={{ fontWeight: showDismissed ? 700 : 400 }}
        >
          Ignorées
        </Link>
      </div>

      <RecommendationsPanel rows={rows} />
    </>
  );
}
