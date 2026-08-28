"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  toggleAutomationRuleAction,
  updateAutomationRuleConfigAction,
} from "@/server/actions/automations.actions";

export type RuleRow = {
  id: string;
  type: string;
  name: string;
  description: string;
  enabled: boolean;
  schedule: string | null;
  config: Record<string, number>;
  lastRunAt: string | null;
  lastRunStatus: string | null;
};

const CONFIG_LABELS: Record<string, string> = {
  cooldownHours: "Refroidissement (h)",
  minDaysOverdue: "Retard min. (jours)",
  daysBefore: "Jours avant échéance",
  thresholdDays: "Inactivité (jours)",
  hours: "Délai (heures)",
  overdueFactor: "Facteur de dépassement",
};

export function RuleControls({ rule }: { rule: RuleRow }) {
  const router = useRouter();
  const [toggleState, toggle] = useActionState(toggleAutomationRuleAction, null);
  const [cfgState, saveCfg] = useActionState(updateAutomationRuleConfigAction, null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (toggleState?.ok || cfgState?.ok) router.refresh();
  }, [toggleState, cfgState, router]);

  const configKeys = Object.keys(rule.config);

  return (
    <div
      style={{
        border: "1px solid var(--border-soft)",
        borderRadius: 14,
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{rule.name}</div>
          <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 3 }}>
            {rule.description}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
            {rule.schedule ? `Rythme : ${rule.schedule}. ` : ""}
            {rule.lastRunAt
              ? `Dernière analyse : ${new Date(rule.lastRunAt).toLocaleString("fr-FR")} (${rule.lastRunStatus ?? "?"})`
              : "Jamais analysée."}
          </div>
        </div>
        <form action={toggle}>
          <input type="hidden" name="ruleId" value={rule.id} />
          <input type="hidden" name="enabled" value={rule.enabled ? "0" : "1"} />
          <button
            type="submit"
            className={`dj-btn ${rule.enabled ? "dj-btn--outline" : "dj-btn--primary"}`}
            style={{ height: 32, fontSize: 13, padding: "0 14px" }}
          >
            {rule.enabled ? "Désactiver" : "Activer"}
          </button>
        </form>
        {configKeys.length > 0 ? (
          <button
            type="button"
            className="dj-btn dj-btn--ghost"
            style={{ height: 32, fontSize: 13, padding: "0 12px" }}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "Fermer" : "Réglages"}
          </button>
        ) : null}
      </div>

      {open && configKeys.length > 0 ? (
        <form
          action={saveCfg}
          style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end", marginTop: 4 }}
        >
          <input type="hidden" name="ruleId" value={rule.id} />
          {configKeys.map((k) => (
            <label key={k} style={{ fontSize: 12, color: "var(--text-3)" }}>
              <div style={{ marginBottom: 4 }}>{CONFIG_LABELS[k] ?? k}</div>
              <input
                name={k}
                type="number"
                step="any"
                defaultValue={rule.config[k]}
                className="dj-input"
                style={{ width: 130 }}
              />
            </label>
          ))}
          <button type="submit" className="dj-btn dj-btn--outline" style={{ height: 34, fontSize: 13 }}>
            Enregistrer
          </button>
          {cfgState && !cfgState.ok ? (
            <span className="dj-error" style={{ fontSize: 12 }}>{cfgState.error}</span>
          ) : null}
        </form>
      ) : null}

      {toggleState && !toggleState.ok ? (
        <span className="dj-error" style={{ fontSize: 12 }}>{toggleState.error}</span>
      ) : null}
    </div>
  );
}
