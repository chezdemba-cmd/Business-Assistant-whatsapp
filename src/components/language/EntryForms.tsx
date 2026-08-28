"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  createLanguageEntryAction,
  updateLanguageEntryAction,
  validateLanguageEntryAction,
  rejectLanguageEntryAction,
  archiveLanguageEntryAction,
  addVariantAction,
  addTranslationAction,
  addIntentAction,
  createDomainAction,
  importLanguageAction,
  exportLanguageAction,
} from "@/server/actions/language-admin.actions";
import { Field, Input, Select } from "@/components/ui";
import { SubmitButton, Feedback } from "@/components/form";

const LANGS = ["FR", "BM", "MIXED", "OTHER"] as const;

export function CreateEntryForm({ domains }: { domains: string[] }) {
  const router = useRouter();
  const [state, action] = useActionState(createLanguageEntryAction, null);
  useEffect(() => {
    if (state?.ok) router.push(`/language/entries/${state.data.id}`);
  }, [state, router]);
  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <Field label="Texte canonique" htmlFor="ce-c">
        <Input id="ce-c" name="canonicalText" required />
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <Field label="Langue" htmlFor="ce-l">
          <Select id="ce-l" name="language" defaultValue="BM">
            {LANGS.map((l) => <option key={l} value={l}>{l}</option>)}
          </Select>
        </Field>
        <Field label="Scope" htmlFor="ce-s">
          <Select id="ce-s" name="scope" defaultValue="GLOBAL">
            <option value="GLOBAL">GLOBAL</option>
            <option value="DOMAIN">DOMAIN</option>
            <option value="ORGANIZATION">ORGANIZATION</option>
          </Select>
        </Field>
        <Field label="Domaine (si DOMAIN)" htmlFor="ce-d">
          <Select id="ce-d" name="domainCode" defaultValue="">
            <option value="">—</option>
            {domains.map((d) => <option key={d} value={d}>{d}</option>)}
          </Select>
        </Field>
      </div>
      <Field label="organizationId (si ORGANIZATION)" htmlFor="ce-o">
        <Input id="ce-o" name="organizationId" placeholder="cuid…" />
      </Field>
      <Field label="Sens / meaning" htmlFor="ce-m">
        <Input id="ce-m" name="meaning" />
      </Field>
      <Field label="Traduction française" htmlFor="ce-f">
        <Input id="ce-f" name="frenchTranslation" />
      </Field>
      <Feedback state={state} />
      <SubmitButton>Créer (SUGGESTED)</SubmitButton>
    </form>
  );
}

export function EntryMetaForm({
  entryId,
  canonicalText,
  meaning,
  frenchTranslation,
}: {
  entryId: string;
  canonicalText: string;
  meaning: string;
  frenchTranslation: string;
}) {
  const router = useRouter();
  const [state, action] = useActionState(updateLanguageEntryAction, null);
  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);
  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <input type="hidden" name="entryId" value={entryId} />
      <Field label="Texte canonique" htmlFor="em-c">
        <Input id="em-c" name="canonicalText" defaultValue={canonicalText} />
      </Field>
      <Field label="Sens" htmlFor="em-m">
        <Input id="em-m" name="meaning" defaultValue={meaning} />
      </Field>
      <Field label="Traduction française" htmlFor="em-f">
        <Input id="em-f" name="frenchTranslation" defaultValue={frenchTranslation} />
      </Field>
      <Feedback state={state} />
      <SubmitButton variant="outline">Enregistrer</SubmitButton>
    </form>
  );
}

function OneShot({
  action,
  hidden,
  children,
  confirm,
}: {
  action: typeof validateLanguageEntryAction;
  hidden: Record<string, string>;
  children: React.ReactNode;
  confirm?: string;
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
      style={{ display: "inline" }}
    >
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <SubmitButton variant="outline">{children}</SubmitButton>
      {state && !state.ok ? <span className="dj-error"> {state.error}</span> : null}
    </form>
  );
}

export function EntryStatusActions({ entryId, status }: { entryId: string; status: string }) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {status !== "VALIDATED" && status !== "REJECTED" && status !== "ARCHIVED" ? (
        <OneShot action={validateLanguageEntryAction} hidden={{ entryId }}>Valider</OneShot>
      ) : null}
      {status !== "REJECTED" && status !== "ARCHIVED" ? (
        <OneShot action={rejectLanguageEntryAction} hidden={{ entryId }} confirm="Rejeter cette entrée ?">Rejeter</OneShot>
      ) : null}
      {status !== "ARCHIVED" ? (
        <OneShot action={archiveLanguageEntryAction} hidden={{ entryId }} confirm="Archiver cette entrée ?">Archiver</OneShot>
      ) : null}
    </div>
  );
}

export function AddVariantForm({ entryId }: { entryId: string }) {
  const router = useRouter();
  const [state, action] = useActionState(addVariantAction, null);
  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);
  return (
    <form action={action} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
      <input type="hidden" name="entryId" value={entryId} />
      <Input name="text" placeholder="variante…" required style={{ maxWidth: 220 }} />
      <Select name="variantType" defaultValue="SPELLING" style={{ maxWidth: 160 }}>
        {["SPELLING", "PRONUNCIATION", "COLLOQUIAL", "CODE_SWITCH", "ABBREVIATION", "SYNONYM", "OTHER"].map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </Select>
      <SubmitButton variant="outline">+ Variante</SubmitButton>
      {state && !state.ok ? <span className="dj-error">{state.error}</span> : null}
    </form>
  );
}

export function AddTranslationForm({ entryId }: { entryId: string }) {
  const router = useRouter();
  const [state, action] = useActionState(addTranslationAction, null);
  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);
  return (
    <form action={action} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
      <input type="hidden" name="entryId" value={entryId} />
      <Select name="language" defaultValue="FR" style={{ maxWidth: 120 }}>
        {LANGS.map((l) => <option key={l} value={l}>{l}</option>)}
      </Select>
      <Input name="text" placeholder="traduction…" required style={{ maxWidth: 240 }} />
      <SubmitButton variant="outline">+ Traduction</SubmitButton>
      {state && !state.ok ? <span className="dj-error">{state.error}</span> : null}
    </form>
  );
}

export function AddIntentForm({ entryId, domains }: { entryId: string; domains: string[] }) {
  const router = useRouter();
  const [state, action] = useActionState(addIntentAction, null);
  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);
  return (
    <form action={action} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
      <input type="hidden" name="entryId" value={entryId} />
      <Input name="intentCode" placeholder="ORDER_REQUEST…" required style={{ maxWidth: 220 }} />
      <Select name="domainCode" defaultValue="" style={{ maxWidth: 150 }}>
        <option value="">—</option>
        {domains.map((d) => <option key={d} value={d}>{d}</option>)}
      </Select>
      <SubmitButton variant="outline">+ Intent</SubmitButton>
      {state && !state.ok ? <span className="dj-error">{state.error}</span> : null}
    </form>
  );
}

export function CreateDomainForm() {
  const router = useRouter();
  const [state, action] = useActionState(createDomainAction, null);
  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);
  return (
    <form action={action} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
      <Input name="code" placeholder="code (ex: health)" required style={{ maxWidth: 180 }} />
      <Input name="name" placeholder="Nom" style={{ maxWidth: 220 }} />
      <SubmitButton variant="outline">+ Domaine</SubmitButton>
      {state && !state.ok ? <span className="dj-error">{state.error}</span> : null}
    </form>
  );
}

export function ImportForm({ domains }: { domains: string[] }) {
  const [state, action] = useActionState(importLanguageAction, null);
  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Select name="scope" defaultValue="DOMAIN" style={{ maxWidth: 140 }}>
          <option value="DOMAIN">DOMAIN</option>
          <option value="GLOBAL">GLOBAL</option>
        </Select>
        <Input name="datasetName" placeholder="nom du dataset" style={{ maxWidth: 200 }} />
        <Input name="license" placeholder="licence (obligatoire)" required style={{ maxWidth: 220 }} />
      </div>
      <textarea
        name="rows"
        rows={6}
        className="dj-input"
        style={{ height: "auto", fontFamily: "var(--font-mono, monospace)", fontSize: 12 }}
        placeholder='[{"canonicalText":"...","language":"BM","meaning":"...","domainCode":"commerce"}]'
        defaultValue=""
      />
      <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>
        Domaines connus : {domains.join(", ") || "—"}. Import → statut SUGGESTED (jamais VALIDATED).
      </p>
      {state ? (
        state.ok ? (
          <div className="dj-alert dj-alert--ok">
            {state.data.created} créées, {state.data.skipped} ignorées.
          </div>
        ) : (
          <div className="dj-alert dj-alert--error">{state.error}</div>
        )
      ) : null}
      <SubmitButton>Importer</SubmitButton>
    </form>
  );
}

export function ExportPanel() {
  const [state, action] = useActionState(exportLanguageAction, null);
  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Select name="format" defaultValue="jsonl" style={{ maxWidth: 130 }}>
          <option value="json">JSON</option>
          <option value="jsonl">JSONL</option>
          <option value="csv">CSV</option>
        </Select>
        <Select name="language" defaultValue="" style={{ maxWidth: 120 }}>
          <option value="">toutes langues</option>
          {LANGS.map((l) => <option key={l} value={l}>{l}</option>)}
        </Select>
        <SubmitButton variant="outline">Générer (GLOBAL + DOMAIN, VALIDATED)</SubmitButton>
      </div>
      {state?.ok ? (
        <>
          <div className="dj-alert dj-alert--ok">
            {state.data.count} enregistrement(s) — sans PII.
            <button
              type="button"
              className="dj-btn dj-btn--ghost"
              style={{ marginLeft: 8, height: 28, fontSize: 12 }}
              onClick={() => {
                const blob = new Blob([state.data.body], { type: state.data.contentType });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "djeli-language-export";
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              Télécharger
            </button>
          </div>
          <textarea
            readOnly
            rows={8}
            className="dj-input"
            style={{ height: "auto", fontFamily: "monospace", fontSize: 11 }}
            value={state.data.body.slice(0, 4000)}
          />
        </>
      ) : state && !state.ok ? (
        <div className="dj-alert dj-alert--error">{state.error}</div>
      ) : null}
    </form>
  );
}
