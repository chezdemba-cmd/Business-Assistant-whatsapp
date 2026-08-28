"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  exportOrganizationDataAction,
  requestOrgDeletionAction,
  cancelOrgDeletionAction,
} from "@/server/actions/org.actions";

export function OrgDataControls({
  canDelete,
  deletion,
}: {
  canDelete: boolean;
  deletion: { status: string; purgeAfter: string } | null;
}) {
  const router = useRouter();
  const [exportState, doExport] = useActionState(exportOrganizationDataAction, null);
  const [reqState, requestDeletion] = useActionState(requestOrgDeletionAction, null);
  const [cancelState, cancelDeletion] = useActionState(cancelOrgDeletionAction, null);

  useEffect(() => {
    if (exportState?.ok) {
      const blob = new Blob([exportState.data.body], { type: exportState.data.contentType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = exportState.data.filename;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [exportState]);

  useEffect(() => {
    if (reqState?.ok || cancelState?.ok) router.refresh();
  }, [reqState, cancelState, router]);

  const pending = deletion && ["REQUESTED", "GRACE_PERIOD"].includes(deletion.status);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <h4 style={{ fontSize: 15, margin: "0 0 6px" }}>Exporter mes données</h4>
        <p style={{ fontSize: 13, color: "var(--text-2)", margin: "0 0 10px" }}>
          Clients, produits, commandes et paiements de l&apos;entreprise.
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <form action={doExport}>
            <input type="hidden" name="format" value="csv" />
            <button type="submit" className="dj-btn dj-btn--outline">Export CSV</button>
          </form>
          <form action={doExport}>
            <input type="hidden" name="format" value="json" />
            <button type="submit" className="dj-btn dj-btn--outline">Export JSON</button>
          </form>
        </div>
        {exportState && !exportState.ok ? (
          <div className="dj-alert dj-alert--error" style={{ marginTop: 8 }}>{exportState.error}</div>
        ) : null}
      </div>

      {canDelete ? (
        <div style={{ borderTop: "1px solid var(--border-soft)", paddingTop: 16 }}>
          <h4 style={{ fontSize: 15, margin: "0 0 6px", color: "var(--err-fg, #a12020)" }}>
            Supprimer l&apos;entreprise
          </h4>
          {pending ? (
            <>
              <p style={{ fontSize: 13, color: "var(--text-2)", margin: "0 0 10px" }}>
                Suppression demandée. Vos données seront purgées après le{" "}
                {new Date(deletion!.purgeAfter).toLocaleDateString("fr-FR")}. Vous
                pouvez encore annuler ou exporter d&apos;ici là.
              </p>
              <form action={cancelDeletion}>
                <button type="submit" className="dj-btn dj-btn--outline">Annuler la suppression</button>
              </form>
            </>
          ) : (
            <>
              <p style={{ fontSize: 13, color: "var(--text-2)", margin: "0 0 10px" }}>
                Déclenche une période de grâce de 14 jours avant purge. Aucune
                suppression immédiate.
              </p>
              <form
                action={requestDeletion}
                onSubmit={(e) => {
                  if (!confirm("Demander la suppression de l'entreprise ? (période de grâce de 14 jours)")) {
                    e.preventDefault();
                  }
                }}
                style={{ display: "flex", gap: 8 }}
              >
                <input name="reason" placeholder="Motif (facultatif)" className="dj-input" style={{ maxWidth: 260 }} />
                <button type="submit" className="dj-btn dj-btn--ghost">Demander la suppression</button>
              </form>
            </>
          )}
          {(reqState && !reqState.ok) || (cancelState && !cancelState.ok) ? (
            <div className="dj-alert dj-alert--error" style={{ marginTop: 8 }}>
              {(reqState && !reqState.ok && reqState.error) || (cancelState && !cancelState.ok && cancelState.error)}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
