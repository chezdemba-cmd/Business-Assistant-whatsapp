import Link from "next/link";
import { pageOrgContext } from "@/server/page-context";
import { can } from "@/server/rbac/permissions";
import { lcDb } from "@/language-core/db";
import { formatDateTime } from "@/lib/format";
import { Card, PageHeader, Badge } from "@/components/ui";
import { ForbiddenPanel } from "@/components/ForbiddenPanel";

export const metadata = { title: "Applications Language API — FEREDRON" };

export default async function LanguageApplicationsPage() {
  const ctx = await pageOrgContext();
  if (!can(ctx.role, "language.admin")) {
    return <ForbiddenPanel role={ctx.role} requiredFor="FEREDRON Language Core" />;
  }
  const apps = await lcDb.languageApplication.findMany({
    orderBy: { code: "asc" },
    include: { clients: { orderBy: { createdAt: "asc" } } },
  });

  return (
    <>
      <Link href="/language" style={{ fontSize: 13, color: "var(--text-3)" }}>← Language Core</Link>
      <PageHeader
        title="Applications & clients API"
        subtitle="Auth : Authorization: Bearer <clientId>.<secret>. Le secret n'est stocké que haché."
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {apps.map((a) => (
          <Card key={a.id}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <strong className="mono">{a.code}</strong>
              <span>{a.name}</span>
              <Badge variant={a.status === "ACTIVE" ? "ok" : "default"}>{a.status}</Badge>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 4 }}>
              scopes : {a.allowedScopes.join(", ") || "—"} · domaines : {a.allowedDomains.join(", ") || "tous"}
            </div>
            <div style={{ marginTop: 8 }}>
              {a.clients.map((c) => (
                <div key={c.id} style={{ fontSize: 12, padding: "4px 0", borderTop: "1px solid var(--border-soft)" }}>
                  <span className="mono">{c.clientId}</span> · {c.name} · <Badge>{c.status}</Badge>
                  {" · perms : "}{c.permissions.join(", ") || "—"}
                  {c.lastUsedAt ? ` · vu ${formatDateTime(c.lastUsedAt)}` : ""}
                </div>
              ))}
            </div>
          </Card>
        ))}
        {apps.length === 0 ? <Card><p style={{ margin: 0, color: "var(--text-3)" }}>Aucune application (voir le seed).</p></Card> : null}
      </div>
      <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 12 }}>
        Provisionnement d&apos;un nouveau client : `provisionClient()` (script / seed) — jamais de secret en clair en base.
      </p>
    </>
  );
}
