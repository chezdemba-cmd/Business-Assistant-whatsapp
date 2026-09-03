import type { Role } from "@prisma/client";
import { can, type Permission } from "../server/rbac/permissions.ts";

/**
 * Configuration de la navigation mobile — PUR (§4). Bottom-nav à 5 entrées
 * maximum ; « FEREDRON » est l'action centrale (§5). « Plus » ouvre le reste.
 */

export type MobileNavItem = {
  key: string;
  label: string;
  href: string;
  /** true pour l'entrée centrale mise en avant (FEREDRON). */
  primary?: boolean;
  permission?: Permission;
  /** correspondance de route active (préfixe). */
  match: string[];
};

const PRIMARY: MobileNavItem[] = [
  { key: "home", label: "Accueil", href: "/dashboard", match: ["/dashboard"] },
  { key: "conversations", label: "Discussions", href: "/conversations", permission: "conversations.read", match: ["/conversations"] },
  { key: "feredron", label: "FEREDRON", href: "/ai", permission: "ai.use", primary: true, match: ["/ai"] },
  { key: "orders", label: "Commandes", href: "/orders", permission: "orders.read", match: ["/orders"] },
  { key: "more", label: "Plus", href: "/menu", match: ["/menu"] },
];

/** Entrées de la feuille « Plus » (tout ce qui n'est pas dans la bottom-nav). */
const MORE: MobileNavItem[] = [
  { key: "stock", label: "Stock", href: "/stock", permission: "stock.read", match: ["/stock"] },
  { key: "debts", label: "Créances", href: "/debts", permission: "debts.read", match: ["/debts"] },
  { key: "reminders", label: "Relances", href: "/reminders", permission: "debts.read", match: ["/reminders"] },
  { key: "customers", label: "Clients", href: "/customers", permission: "customers.read", match: ["/customers"] },
  { key: "recos", label: "Opportunités", href: "/recommendations", permission: "recommendations.read", match: ["/recommendations"] },
  { key: "marketing", label: "Marketing", href: "/marketing", permission: "marketing.read", match: ["/marketing"] },
  { key: "catalog", label: "Produits", href: "/catalog", permission: "catalog.read", match: ["/catalog"] },
  { key: "automations", label: "Automatisations", href: "/automations", permission: "automations.read", match: ["/automations"] },
  { key: "notifications", label: "Notifications", href: "/notifications", match: ["/notifications"] },
  { key: "billing", label: "Offre & usage", href: "/billing", permission: "settings.read", match: ["/billing"] },
  { key: "members", label: "Membres & rôles", href: "/members", permission: "members.read", match: ["/members"] },
  { key: "settings", label: "Paramètres", href: "/settings", permission: "settings.read", match: ["/settings"] },
  { key: "language", label: "Language Core", href: "/language", permission: "language.admin", match: ["/language"] },
  { key: "support", label: "Support", href: "/support", match: ["/support"] },
  { key: "profile", label: "Mon profil", href: "/profile", match: ["/profile"] },
];

function allowed(items: MobileNavItem[], role: Role): MobileNavItem[] {
  return items.filter((i) => !i.permission || can(role, i.permission));
}

export function mobileBottomNav(role: Role): MobileNavItem[] {
  const items = allowed(PRIMARY, role);
  // Toujours garder Accueil + FEREDRON + Plus ; compléter à 5 max.
  return items.slice(0, 5);
}

export function mobileMoreItems(role: Role): MobileNavItem[] {
  return allowed(MORE, role);
}

/** L'entrée est-elle active pour le chemin courant ? */
export function isNavActive(item: MobileNavItem, pathname: string): boolean {
  return item.match.some((m) => pathname === m || pathname.startsWith(`${m}/`));
}
