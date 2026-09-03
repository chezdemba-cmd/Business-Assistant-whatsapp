import Link from "next/link";
import type { Role } from "@prisma/client";
import { can } from "@/server/rbac/permissions";

/**
 * Actions rapides d'accueil (§9). Grandes zones tactiles, priorité mobile.
 * Filtrées par permission ; masquées si aucune n'est disponible.
 */
export function QuickActions({ role }: { role: Role }) {
  const items: Array<{ href: string; label: string; icon: string }> = [];
  if (can(role, "orders.write")) items.push({ href: "/orders/new", label: "Nouvelle commande", icon: "🧾" });
  if (can(role, "customers.write")) items.push({ href: "/customers/new", label: "Nouveau client", icon: "👤" });
  if (can(role, "stock.write")) items.push({ href: "/stock/new", label: "Ajouter du stock", icon: "📦" });
  if (can(role, "debts.write")) items.push({ href: "/debts", label: "Encaisser", icon: "💰" });
  if (items.length === 0) return null;

  return (
    <div
      className="quick-actions"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))",
        gap: 10,
        marginBottom: 24,
      }}
    >
      {items.map((it) => (
        <Link
          key={it.href}
          href={it.href}
          className="dj-card"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            minHeight: 84,
            padding: 14,
            textDecoration: "none",
            color: "inherit",
            textAlign: "center",
          }}
        >
          <span aria-hidden style={{ fontSize: 22 }}>{it.icon}</span>
          <span style={{ fontSize: 13, fontWeight: 700 }}>{it.label}</span>
        </Link>
      ))}
    </div>
  );
}
