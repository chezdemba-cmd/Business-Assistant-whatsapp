"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@prisma/client";
import { can, type Permission } from "@/server/rbac/permissions";

type NavItem = {
  href: string;
  label: string;
  permission?: Permission;
  phase?: string;
  exact?: boolean;
};

const PILOTAGE: NavItem[] = [
  { href: "/dashboard", label: "Tableau de bord" },
  { href: "/catalog", label: "Catalogue", permission: "catalog.read" },
  { href: "/stock", label: "Stock", permission: "stock.read", exact: true },
  { href: "/stock/movements", label: "Mouvements", permission: "stock.read" },
  { href: "/customers", label: "Clients", permission: "customers.read" },
  { href: "/orders", label: "Commandes", permission: "orders.read" },
  { href: "/debts", label: "Créances", permission: "debts.read" },
  { href: "/reminders", label: "Relances", permission: "debts.read" },
  {
    href: "/conversations",
    label: "Conversations",
    permission: "conversations.read",
  },
  { href: "/ai", label: "Djeli IA", permission: "ai.use" },
  {
    href: "/recommendations",
    label: "À surveiller",
    permission: "recommendations.read",
  },
  { href: "/marketing", label: "Marketing", permission: "marketing.read" },
];

const ENTREPRISE: NavItem[] = [
  { href: "/automations", label: "Automatisations", permission: "automations.read" },
  { href: "/notifications", label: "Notifications" },
  { href: "/members", label: "Membres & rôles", permission: "members.read" },
  { href: "/settings", label: "Paramètres", permission: "settings.read" },
  { href: "/billing", label: "Offre & usage", permission: "settings.read" },
  { href: "/language", label: "Language Core", permission: "language.admin" },
  { href: "/support", label: "Support" },
  { href: "/profile", label: "Mon profil" },
];

function NavLink({ item, role }: { item: NavItem; role: Role }) {
  const pathname = usePathname();
  if (item.permission && !can(role, item.permission)) return null;
  const active = item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(`${item.href}/`);
  return (
    <Link className="app-nav-link" href={item.href} data-active={active}>
      <span>{item.label}</span>
      {item.phase ? (
        <span
          style={{
            marginLeft: "auto",
            fontSize: 10,
            fontWeight: 700,
            color: "var(--text-muted)",
            background: "var(--card-alt)",
            padding: "2px 7px",
            borderRadius: 999,
          }}
        >
          {item.phase}
        </span>
      ) : null}
    </Link>
  );
}

export function Sidebar({
  role,
  organizationName,
  countryCode,
  currency,
}: {
  role: Role;
  organizationName: string;
  countryCode: string;
  currency: string;
}) {
  return (
    <aside className="app-sidebar">
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 8px" }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 999,
            background: "var(--accent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--on-accent)",
            fontFamily: "var(--font-display)",
            fontSize: 17,
            flex: "none",
          }}
        >
          D
        </div>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 15,
              lineHeight: 1.1,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {organizationName}
          </div>
          <div
            style={{
              fontSize: 11,
              color: "var(--text-3)",
              fontWeight: 600,
              letterSpacing: "0.04em",
            }}
          >
            {countryCode} · {currency}
          </div>
        </div>
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <div className="app-nav-section">PILOTAGE</div>
        {PILOTAGE.map((item) => (
          <NavLink key={item.href} item={item} role={role} />
        ))}
        <div className="app-nav-section" style={{ paddingTop: 16 }}>
          ENTREPRISE
        </div>
        {ENTREPRISE.map((item) => (
          <NavLink key={item.href} item={item} role={role} />
        ))}
      </nav>

      <div
        className="app-sidebar-footer"
        style={{
          marginTop: "auto",
          background: "var(--ok-bg)",
          borderRadius: 20,
          padding: 16,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 14,
            color: "#3d472b",
            marginBottom: 4,
          }}
        >
          Phase 7 — Assistant proactif
        </div>
        <div style={{ fontSize: 12, color: "var(--ok-fg)", lineHeight: 1.45 }}>
          Détection du stock, des créances, des commandes et des clients ;
          recommandations et campagnes préparées. Aucun envoi sans votre
          validation.
        </div>
      </div>
    </aside>
  );
}
