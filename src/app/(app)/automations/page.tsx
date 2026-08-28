import { pageOrgContext } from "@/server/page-context";
import { can } from "@/server/rbac/permissions";
import { PageHeader, Card } from "@/components/ui";
import { ForbiddenPanel } from "@/components/ForbiddenPanel";
import { listAutomationRules } from "@/server/automations/automation-service";
import { effectiveRuleConfig } from "@/server/automations/rules";
import { RuleControls, type RuleRow } from "@/components/automations/RuleControls";
import { RunAutomationsButton } from "@/components/automations/RunAutomationsButton";

export const metadata = { title: "Automatisations — Djeli" };

export default async function AutomationsPage() {
  const ctx = await pageOrgContext();
  if (!can(ctx.role, "automations.read")) {
    return <ForbiddenPanel role={ctx.role} requiredFor="les automatisations" />;
  }
  const canManage = can(ctx.role, "automations.manage");
  const rules = await listAutomationRules(ctx.organization.id);

  const rows: RuleRow[] = rules.map((r) => {
    const cfg = effectiveRuleConfig(r.type, r.config);
    const numeric: Record<string, number> = {};
    for (const [k, v] of Object.entries(cfg)) if (typeof v === "number") numeric[k] = v;
    return {
      id: r.id,
      type: r.type,
      name: r.name,
      description: r.description ?? "",
      enabled: r.enabled,
      schedule: r.schedule,
      config: numeric,
      lastRunAt: r.lastRunAt ? r.lastRunAt.toISOString() : null,
      lastRunStatus: r.runs[0]?.status ?? null,
    };
  });

  return (
    <>
      <PageHeader
        title="Automatisations"
        subtitle="Djeli surveille votre activité et propose des recommandations. Rien n'est envoyé automatiquement : vous gardez la main."
        actions={canManage ? <RunAutomationsButton /> : undefined}
      />

      <Card style={{ marginBottom: 16 }}>
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-2)", lineHeight: 1.55 }}>
          Chaque règle <strong>détecte</strong> un type de situation (stock faible,
          créance en retard, commande bloquée…) et crée une recommandation. Aucune
          règle n&apos;envoie de message ni ne modifie vos données sans votre
          validation.
        </p>
      </Card>

      {!canManage ? (
        <Card style={{ marginBottom: 16 }}>
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-3)" }}>
            Lecture seule — seuls les gérants, administrateurs et le propriétaire
            peuvent activer/désactiver une règle.
          </p>
        </Card>
      ) : null}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {canManage ? (
          rows.map((r) => <RuleControls key={r.id} rule={r} />)
        ) : (
          rows.map((r) => (
            <div
              key={r.id}
              style={{
                border: "1px solid var(--border-soft)",
                borderRadius: 14,
                padding: "14px 16px",
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 700 }}>
                {r.name} — {r.enabled ? "activée" : "désactivée"}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 3 }}>
                {r.description}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
