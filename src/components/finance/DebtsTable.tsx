"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createReminderCampaignAction } from "@/server/actions/reminders.actions";
import { AGING_BUCKET_LABEL, type AgingBucket } from "@/server/finance/payment-rules";
import { formatAmount, formatDate } from "@/lib/format";
import { Badge } from "@/components/ui";

export type DebtTableRow = {
  orderId: string;
  reference: string;
  customerId: string;
  customerName: string;
  currency: string;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  dueDate: string | null;
  daysOverdue: number;
  isOverdue: boolean;
  bucket: AgingBucket;
};

const TH: React.CSSProperties = {
  textAlign: "left",
  padding: "14px 16px",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.08em",
  color: "var(--text-2)",
  textTransform: "uppercase",
};

export function DebtsTable({
  organizationId,
  rows,
  canWrite,
}: {
  organizationId: string;
  rows: DebtTableRow[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [state, formAction] = useActionState(createReminderCampaignAction, null);

  useEffect(() => {
    if (state?.ok) router.push(`/reminders/${state.data.campaignId}`);
  }, [state, router]);

  const allIds = useMemo(() => rows.map((r) => r.orderId), [rows]);
  const allChecked = selected.size > 0 && selected.size === rows.length;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected((prev) => (prev.size === rows.length ? new Set() : new Set(allIds)));

  return (
    <>
      {canWrite ? (
        <form
          action={formAction}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 12,
            minHeight: 40,
          }}
        >
          <input type="hidden" name="organizationId" value={organizationId} />
          <input
            type="hidden"
            name="orderIds"
            value={JSON.stringify([...selected])}
          />
          <button
            type="submit"
            className="dj-btn dj-btn--primary"
            style={{ height: 38, fontSize: 13 }}
            disabled={selected.size === 0}
          >
            Préparer une relance ({selected.size})
          </button>
          {state && !state.ok ? (
            <span className="dj-error">{state.error}</span>
          ) : (
            <span style={{ fontSize: 12, color: "var(--text-3)" }}>
              Sélectionnez des créances puis préparez la campagne (envoi simulé).
            </span>
          )}
        </form>
      ) : null}

      <div className="dj-card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: "var(--panel)" }}>
                {canWrite ? (
                  <th style={{ ...TH, width: 40 }}>
                    <input
                      type="checkbox"
                      checked={allChecked}
                      onChange={toggleAll}
                      aria-label="Tout sélectionner"
                    />
                  </th>
                ) : null}
                {["Client", "Commande", "Montant", "Payé", "Solde", "Échéance", "Retard", "Tranche"].map(
                  (h) => (
                    <th key={h} style={TH}>
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.orderId} style={{ borderTop: "1px solid var(--border-soft)" }}>
                  {canWrite ? (
                    <td style={{ padding: "13px 16px" }}>
                      <input
                        type="checkbox"
                        checked={selected.has(r.orderId)}
                        onChange={() => toggle(r.orderId)}
                        aria-label={`Sélectionner ${r.reference}`}
                      />
                    </td>
                  ) : null}
                  <td style={{ padding: "13px 16px" }}>
                    <Link href={`/customers/${r.customerId}`} style={{ fontWeight: 700 }}>
                      {r.customerName}
                    </Link>
                  </td>
                  <td style={{ padding: "13px 16px" }}>
                    <Link href={`/orders/${r.orderId}`} className="mono">
                      {r.reference}
                    </Link>
                  </td>
                  <td className="tnum" style={{ padding: "13px 16px" }}>
                    {formatAmount(r.totalAmount, r.currency)}
                  </td>
                  <td className="tnum" style={{ padding: "13px 16px", color: "var(--text-2)" }}>
                    {formatAmount(r.amountPaid, r.currency)}
                  </td>
                  <td
                    className="tnum"
                    style={{ padding: "13px 16px", fontWeight: 700 }}
                  >
                    {formatAmount(r.balanceDue, r.currency)}
                  </td>
                  <td style={{ padding: "13px 16px", color: "var(--text-3)", fontSize: 13 }}>
                    {r.dueDate ? formatDate(r.dueDate) : "—"}
                  </td>
                  <td style={{ padding: "13px 16px" }}>
                    {r.isOverdue ? (
                      <Badge variant="accent">{r.daysOverdue} j</Badge>
                    ) : (
                      <span style={{ fontSize: 13, color: "var(--text-3)" }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: "13px 16px" }}>
                    <Badge variant={r.bucket === "NOT_DUE" ? "ok" : "default"}>
                      {AGING_BUCKET_LABEL[r.bucket]}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
