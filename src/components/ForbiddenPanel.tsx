import Link from "next/link";
import type { Role } from "@prisma/client";
import { roleLabel } from "@/components/ui";

export function ForbiddenPanel({
  role,
  requiredFor = "cette page",
}: {
  role?: Role;
  requiredFor?: string;
}) {
  return (
    <div style={{ padding: "48px 0", display: "flex", justifyContent: "center" }}>
      <div style={{ maxWidth: 460, textAlign: "center" }}>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 999,
            background: "var(--card-alt)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 22px",
            fontSize: 22,
          }}
          aria-hidden
        >
          🔒
        </div>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 30,
            lineHeight: 1.12,
            margin: "0 0 10px",
          }}
        >
          Accès non autorisé
        </h1>
        <p
          style={{
            margin: "0 0 24px",
            fontSize: 15,
            color: "var(--text-2)",
            lineHeight: 1.55,
          }}
        >
          Votre rôle{role ? ` (${roleLabel(role)})` : ""} ne permet pas d&apos;accéder
          à {requiredFor}. Demandez à un administrateur ou au propriétaire de
          l&apos;entreprise de modifier vos permissions.
        </p>
        <Link href="/dashboard" className="dj-btn dj-btn--primary">
          Retour au tableau de bord
        </Link>
      </div>
    </div>
  );
}
