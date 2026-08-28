"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  recomputeCandidatesAction,
  approveCandidateAction,
  rejectCandidateAction,
  ignoreCandidateAction,
  editCandidateAction,
  promoteCandidateAction,
  replayCandidateAction,
  exportLearningDatasetAction,
} from "@/server/actions/language-learning.actions";
import { Field, Input, Select } from "@/components/ui";
import { SubmitButton } from "@/components/form";
import type { ActionResult } from "@/lib/result";

type AnyAction = (
  prev: ActionResult<Record<string, unknown>> | null,
  fd: FormData,
) => Promise<ActionResult<Record<string, unknown>>>;

export function RecomputeButton() {
  const router = useRouter();
  const [state, action] = useActionState(recomputeCandidatesAction, null);
  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);
  return (
    <form action={action} style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
      <SubmitButton variant="outline">Recalculer les candidats</SubmitButton>
      {state?.ok ? (
        <span style={{ fontSize: 12, color: "var(--ok-fg)" }}>
          +{state.data.created} · maj {state.data.updated} · conflits {state.data.conflicts}
        </span>
      ) : state && !state.ok ? (
        <span className="dj-error">{state.error}</span>
      ) : null}
    </form>
  );
}

function Decision({
  action,
  candidateId,
  label,
  confirm,
  extraField,
}: {
  action: AnyAction;
  candidateId: string;
  label: string;
  confirm?: string;
  extraField?: { name: string; placeholder: string };
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(action, null);
  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
      style={{ display: "inline-flex", gap: 6, alignItems: "center" }}
    >
      <input type="hidden" name="candidateId" value={candidateId} />
      {extraField ? (
        <Input name={extraField.name} placeholder={extraField.placeholder} style={{ maxWidth: 200, height: 34 }} />
      ) : null}
      <SubmitButton variant="outline">{label}</SubmitButton>
      {state && !state.ok ? <span className="dj-error">{state.error}</span> : null}
    </form>
  );
}

export function CandidateDecisions({ candidateId, status }: { candidateId: string; status: string }) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {status !== "PROMOTED" && status !== "REJECTED" && status !== "CONFLICT" ? (
        <Decision action={approveCandidateAction as unknown as AnyAction} candidateId={candidateId} label="Approuver" />
      ) : null}
      {status === "APPROVED" ? (
        <Decision
          action={promoteCandidateAction as unknown as AnyAction}
          candidateId={candidateId}
          label="Promouvoir → SUGGESTED"
          confirm="Créer une connaissance SUGGESTED (jamais VALIDATED) à partir de ce candidat ?"
        />
      ) : null}
      {status !== "PROMOTED" && status !== "REJECTED" ? (
        <Decision
          action={rejectCandidateAction as unknown as AnyAction}
          candidateId={candidateId}
          label="Rejeter"
          extraField={{ name: "reason", placeholder: "motif (optionnel)" }}
        />
      ) : null}
      {status !== "PROMOTED" && status !== "IGNORED" ? (
        <Decision action={ignoreCandidateAction as unknown as AnyAction} candidateId={candidateId} label="Ignorer" />
      ) : null}
    </div>
  );
}

export function EditCandidateForm({
  candidateId,
  canonicalText,
  proposedMeaning,
  proposedIntentCode,
}: {
  candidateId: string;
  canonicalText: string;
  proposedMeaning: string;
  proposedIntentCode: string;
}) {
  const router = useRouter();
  const [state, action] = useActionState(editCandidateAction, null);
  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);
  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <input type="hidden" name="candidateId" value={candidateId} />
      <Field label="Forme canonique proposée" htmlFor="ec-c">
        <Input id="ec-c" name="canonicalText" defaultValue={canonicalText} />
      </Field>
      <Field label="Sens proposé" htmlFor="ec-m">
        <Input id="ec-m" name="proposedMeaning" defaultValue={proposedMeaning} />
      </Field>
      <Field label="Intent proposé (optionnel)" htmlFor="ec-i">
        <Input id="ec-i" name="proposedIntentCode" defaultValue={proposedIntentCode} />
      </Field>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
        <Input name="proposedTranslation" placeholder="traduction (optionnel)" style={{ maxWidth: 220 }} />
        <Select name="proposedTranslationLang" defaultValue="FR" style={{ maxWidth: 90 }}>
          <option value="FR">FR</option>
          <option value="BM">BM</option>
        </Select>
      </div>
      <SubmitButton variant="outline">Enregistrer la proposition</SubmitButton>
      {state && !state.ok ? <span className="dj-error">{state.error}</span> : null}
    </form>
  );
}

export function ReplayPanel({ candidateId }: { candidateId: string }) {
  const [state, action] = useActionState(replayCandidateAction, null);
  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <input type="hidden" name="candidateId" value={candidateId} />
      <textarea
        name="samples"
        rows={4}
        className="dj-input"
        style={{ height: "auto", fontSize: 12 }}
        placeholder={"Une phrase par ligne à tester…\nvous avez du sucre ?\nje veux six sacs"}
      />
      <SubmitButton variant="outline">Simuler l&apos;impact</SubmitButton>
      {state?.ok ? (
        <div style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 4 }}>
          {state.data.results.map((r, i) => (
            <div key={i} style={{ borderBottom: "1px solid var(--border-soft)", paddingBottom: 3 }}>
              « {r.sample} » — actuel : {r.currentMatch ? `match (${r.currentCanonical})` : "aucun"} → avec candidat :{" "}
              <strong>{r.wouldMatchCandidate ? "match" : "aucun"}</strong>
            </div>
          ))}
          {state.data.results.length === 0 ? <span style={{ color: "var(--text-3)" }}>Aucun échantillon.</span> : null}
        </div>
      ) : state && !state.ok ? (
        <span className="dj-error">{state.error}</span>
      ) : null}
    </form>
  );
}

export function LearningDatasetExport() {
  const [state, action] = useActionState(exportLearningDatasetAction, null);
  const [, setTick] = useState(0);
  useEffect(() => setTick((t) => t + 1), [state]);
  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Select name="format" defaultValue="jsonl" style={{ maxWidth: 120 }}>
          <option value="jsonl">JSONL</option>
          <option value="csv">CSV</option>
        </Select>
        <Select name="language" defaultValue="" style={{ maxWidth: 120 }}>
          <option value="">toutes langues</option>
          <option value="FR">FR</option>
          <option value="BM">BM</option>
          <option value="MIXED">MIXED</option>
        </Select>
        <label style={{ fontSize: 12, display: "flex", gap: 4, alignItems: "center" }}>
          <input type="checkbox" name="includeSplit" value="1" /> split TRAIN/VAL/TEST
        </label>
        <SubmitButton variant="outline">Générer (APPROVED + PROMOTED, shareable)</SubmitButton>
      </div>
      {state?.ok ? (
        <div className="dj-alert dj-alert--ok">
          {state.data.count} ligne(s) — sans PII.
          <button
            type="button"
            className="dj-btn dj-btn--ghost"
            style={{ marginLeft: 8, height: 28, fontSize: 12 }}
            onClick={() => {
              const blob = new Blob([state.data.body], { type: state.data.contentType });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "djeli-learning-dataset";
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Télécharger
          </button>
        </div>
      ) : state && !state.ok ? (
        <div className="dj-alert dj-alert--error">{state.error}</div>
      ) : null}
    </form>
  );
}
