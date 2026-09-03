import Link from "next/link";
import { notFound } from "next/navigation";
import { pageOrgContext } from "@/server/page-context";
import { can } from "@/server/rbac/permissions";
import { getCandidate, candidateOrganizationHashes } from "@/language-core/learning/queries";
import { lcDb } from "@/language-core/db";
import { formatDateTime } from "@/lib/format";
import { Card, PageHeader, Badge } from "@/components/ui";
import { ForbiddenPanel } from "@/components/ForbiddenPanel";
import {
  CandidateDecisions,
  EditCandidateForm,
  ReplayPanel,
} from "@/components/language/LearningForms";

export const metadata = { title: "Candidat linguistique — FEREDRON" };

type Factor = { label: string; contribution: number };

export default async function LearningCandidateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await pageOrgContext();
  if (!can(ctx.role, "language.review")) {
    return <ForbiddenPanel role={ctx.role} requiredFor="le Learning Loop" />;
  }

  const c = await getCandidate(id);
  if (!c) notFound();
  const orgHashes = await candidateOrganizationHashes(c.id);
  const conflictEntry = c.conflictEntryId
    ? await lcDb.languageEntry.findUnique({
        where: { id: c.conflictEntryId },
        select: { canonicalText: true, meaning: true, status: true },
      })
    : null;

  const summary = (c.evidenceSummary ?? {}) as {
    factors?: Factor[];
    scopeReason?: string;
    requiresStrongReview?: boolean;
  };

  return (
    <>
      <Link href="/language/learning" style={{ fontSize: 13, color: "var(--text-3)" }}>← Learning Loop</Link>
      <PageHeader
        title={c.canonicalText}
        subtitle={`${c.candidateType} · ${c.language} · scope proposé : ${c.scopeSuggestion}${c.domainCode ? ` (${c.domainCode})` : ""}${!c.shareable ? " · non partageable (reste privé)" : ""}`}
        actions={<Badge variant={c.status === "PROMOTED" ? "ok" : c.status === "CONFLICT" ? "accent" : "default"}>{c.status}</Badge>}
      />

      {c.status === "CONFLICT" ? (
        <div className="dj-alert dj-alert--error" style={{ marginBottom: 16 }}>
          <span>
            <strong>Conflit détecté</strong> avec une entrée existante
            {conflictEntry ? ` : « ${conflictEntry.canonicalText} » (${conflictEntry.status})${conflictEntry.meaning ? ` — ${conflictEntry.meaning}` : ""}` : ""}.
            Aucune promotion automatique — revue manuelle requise (§40, §58).
          </span>
        </div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card>
            <h3 style={{ fontSize: 16, margin: "0 0 10px" }}>Pourquoi ce candidat ?</h3>
            <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 3 }}>
              <div>• {c.occurrenceCount} occurrence(s), {c.correctionCount} correction(s)</div>
              <div>• {c.organizationCount} organisation(s) distincte(s), {c.sourceCount} source(s)</div>
              <div>• première apparition : {formatDateTime(c.firstSeenAt)}</div>
              <div>• dernière apparition : {formatDateTime(c.lastSeenAt)}{c.stale ? " (stale)" : ""}</div>
              {c.originalPattern ? <div>• forme d&apos;origine : « {c.originalPattern} »</div> : null}
            </div>
            <div style={{ marginTop: 10, fontSize: 12, color: "var(--text-2)" }}>
              <strong>Score {c.confidenceScore.toFixed(3)}</strong>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 4 }}>
                {(summary.factors ?? []).map((f, i) => (
                  <div key={i}>+{f.contribution.toFixed(3)} — {f.label}</div>
                ))}
              </div>
            </div>
            {summary.scopeReason ? (
              <p style={{ fontSize: 12, color: "var(--text-3)", marginTop: 8 }}>
                Scope proposé : {summary.scopeReason}
                {summary.requiresStrongReview ? " Validation humaine renforcée requise avant VALIDATED." : ""}
              </p>
            ) : null}
          </Card>

          <Card>
            <h3 style={{ fontSize: 16, margin: "0 0 10px" }}>Modifier puis approuver</h3>
            <EditCandidateForm
              candidateId={c.id}
              canonicalText={c.canonicalText}
              proposedMeaning={c.proposedMeaning ?? ""}
              proposedIntentCode={c.proposedIntentCode ?? ""}
            />
          </Card>

          <Card>
            <h3 style={{ fontSize: 16, margin: "0 0 10px" }}>Simuler l&apos;impact (replay)</h3>
            <ReplayPanel candidateId={c.id} />
          </Card>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card>
            <h3 style={{ fontSize: 16, margin: "0 0 10px" }}>Décision</h3>
            <CandidateDecisions candidateId={c.id} status={c.status} />
            {c.promotedEntryId ? (
              <p style={{ fontSize: 12, marginTop: 8 }}>
                Promu → <Link href={`/language/entries/${c.promotedEntryId}`}>entrée SUGGESTED</Link> (validation finale séparée).
              </p>
            ) : null}
            {c.reviewedByRef ? (
              <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 6 }}>
                Revu par {c.reviewedByRef} le {c.reviewedAt ? formatDateTime(c.reviewedAt) : "—"}
              </p>
            ) : null}
          </Card>

          <Card>
            <h3 style={{ fontSize: 16, margin: "0 0 10px" }}>Preuves (anonymisées)</h3>
            <div style={{ fontSize: 12, color: "var(--text-2)" }}>
              <div>{c.evidence.filter((e) => e.correctionId).length} correction(s)</div>
              <div>{c.evidence.filter((e) => e.observationId).length} observation(s)</div>
              <div>{orgHashes.length} organisation(s) — hash uniquement :</div>
              <div style={{ fontFamily: "monospace", fontSize: 10, wordBreak: "break-all", marginTop: 4 }}>
                {orgHashes.slice(0, 8).join(", ") || "—"}
              </div>
            </div>
          </Card>

          <Card>
            <h3 style={{ fontSize: 16, margin: "0 0 10px" }}>Historique</h3>
            {c.reviews.map((r) => (
              <div key={r.id} style={{ fontSize: 12, padding: "2px 0" }}>
                {r.action} — {r.actorRef} · {formatDateTime(r.createdAt)}
                {r.note ? ` · ${r.note}` : ""}
              </div>
            ))}
            {c.reviews.length === 0 ? <span style={{ fontSize: 12, color: "var(--text-3)" }}>Aucune décision.</span> : null}
          </Card>
        </div>
      </div>
    </>
  );
}
