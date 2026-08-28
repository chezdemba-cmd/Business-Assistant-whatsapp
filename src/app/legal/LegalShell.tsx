import type { ReactNode } from "react";
import Link from "next/link";

/** Coquille commune des pages légales (placeholder juridique — §31). */
export function LegalShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "48px 24px" }}>
      <nav style={{ display: "flex", gap: 16, fontSize: 13, marginBottom: 28 }}>
        <Link href="/">Accueil</Link>
        <Link href="/privacy">Confidentialité</Link>
        <Link href="/terms">Conditions</Link>
        <Link href="/data-processing">Traitement des données</Link>
      </nav>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 32, margin: "0 0 8px" }}>{title}</h1>
      <p style={{ fontSize: 13, color: "var(--text-3)", margin: "0 0 28px" }}>
        Document de travail — version pilote. À faire valider juridiquement avant
        commercialisation générale.
      </p>
      <div style={{ fontSize: 15, lineHeight: 1.7, color: "var(--text-2)" }}>{children}</div>
    </div>
  );
}
