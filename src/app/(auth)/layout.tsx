import Link from "next/link";
import type { ReactNode } from "react";
import { getEnv } from "@/lib/env";

/** Écran d'authentification : panneau pitch à gauche, formulaire à droite (cf. maquette). */
export default function AuthLayout({ children }: { children: ReactNode }) {
  const demoMode = getEnv().APP_ENV === "staging";
  return (
    <div className="auth-grid">
      {demoMode ? (
        <div
          style={{
            gridColumn: "1 / -1",
            background: "var(--warn-bg)",
            color: "var(--warn-fg)",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.04em",
            textAlign: "center",
            padding: "6px 12px",
          }}
        >
          ENVIRONNEMENT DE DÉMONSTRATION — aucune donnée réelle
        </div>
      ) : null}
      <aside className="auth-aside">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="auth-logo">D</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 19 }}>
            Djeli
          </div>
        </div>
        <div style={{ maxWidth: 460 }}>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 48,
              lineHeight: 1.06,
              margin: "0 0 20px",
            }}
          >
            Votre commerce, piloté depuis WhatsApp.
          </h1>
          <p style={{ margin: "0 0 28px", fontSize: 17, color: "var(--text-2)" }}>
            Catalogue, clients, commandes, stock et relances — au même endroit,
            pour les commerçants et distributeurs d&apos;Afrique de l&apos;Ouest.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <span className="dj-badge dj-badge--ok">Multi-boutique</span>
            <span className="dj-badge dj-badge--accent">FCFA (XOF)</span>
            <span className="dj-badge">Hors ligne toléré</span>
          </div>
        </div>
        <div style={{ fontSize: 13, color: "var(--text-3)" }}>
          Bamako · Abidjan · Dakar
        </div>
      </aside>

      <main className="auth-main">
        <div style={{ width: "100%", maxWidth: 380 }}>{children}</div>
      </main>

      <nav className="auth-switch">
        <Link href="/login">Se connecter</Link>
        <span aria-hidden>·</span>
        <Link href="/register">Créer mon entreprise</Link>
      </nav>
    </div>
  );
}
