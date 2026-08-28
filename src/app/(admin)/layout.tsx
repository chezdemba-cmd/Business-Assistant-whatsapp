import type { ReactNode } from "react";
import Link from "next/link";
import { requireSuperAdminPage } from "@/server/admin/guard";

export const metadata = { title: "Console Djeli" };

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireSuperAdminPage();
  return (
    <div className="dj-page" style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          marginBottom: 28,
          paddingBottom: 16,
          borderBottom: "1px solid var(--border)",
        }}
      >
        <strong style={{ fontFamily: "var(--font-display)", fontSize: 20 }}>Console Djeli</strong>
        <nav style={{ display: "flex", gap: 14, fontSize: 14 }}>
          <Link href="/admin">Organisations</Link>
          <Link href="/admin/analytics">Analytics</Link>
        </nav>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-3)" }}>
          {user.email} · opérateur
        </span>
        <Link href="/dashboard" style={{ fontSize: 13 }}>
          ← Retour à l&apos;app
        </Link>
      </header>
      <div
        style={{
          fontSize: 12,
          color: "var(--text-muted)",
          marginBottom: 20,
        }}
      >
        Vue opérateur : abonnements, usage et statut. Aucun accès au contenu
        privé des organisations (conversations, notes, messages).
      </div>
      {children}
    </div>
  );
}
