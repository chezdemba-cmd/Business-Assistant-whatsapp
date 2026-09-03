import Link from "next/link";
import { pageOrgContext } from "@/server/page-context";
import { PageHeader, Card } from "@/components/ui";
import { mobileMoreItems } from "@/lib/mobile-nav";

export const metadata = { title: "Menu — FEREDRON" };

const MENU_PRESENTATION: Record<string, { icon: string; group: "sell" | "grow" | "account" }> = {
  customers: { icon: "👥", group: "sell" },
  catalog: { icon: "🏷️", group: "sell" },
  stock: { icon: "📦", group: "sell" },
  debts: { icon: "💰", group: "sell" },
  reminders: { icon: "🔔", group: "sell" },
  recos: { icon: "💡", group: "grow" },
  marketing: { icon: "📣", group: "grow" },
  automations: { icon: "⚙️", group: "grow" },
  notifications: { icon: "🔔", group: "grow" },
  profile: { icon: "👤", group: "account" },
  members: { icon: "👥", group: "account" },
  settings: { icon: "⚙️", group: "account" },
  billing: { icon: "💳", group: "account" },
  support: { icon: "❓", group: "account" },
  language: { icon: "🌍", group: "account" },
};

const MENU_GROUPS = [
  { key: "sell", label: "Vendre" },
  { key: "grow", label: "Développer" },
  { key: "account", label: "Compte" },
] as const;

/** Feuille « Plus » de la navigation mobile (§4). Redondant avec la sidebar desktop. */
export default async function MenuPage() {
  const ctx = await pageOrgContext();
  const items = mobileMoreItems(ctx.role);

  return (
    <>
      <PageHeader title="Menu" subtitle={`${ctx.organization.name} · ${ctx.user.firstName}`} />
      <div className="mobile-menu-groups">
        {MENU_GROUPS.map((group) => {
          const groupItems = items.filter(
            (item) => (MENU_PRESENTATION[item.key]?.group ?? "account") === group.key,
          );
          if (groupItems.length === 0) return null;
          return (
            <section key={group.key} aria-labelledby={`menu-${group.key}`}>
              <h2 id={`menu-${group.key}`} className="mobile-menu-title">{group.label}</h2>
              <div className="mobile-menu-card">
                <Card style={{ padding: 6 }}>
                  {groupItems.map((item) => (
                    <Link key={item.key} href={item.href} className="mobile-menu-link">
                      <span className="mobile-menu-icon" aria-hidden>
                        {MENU_PRESENTATION[item.key]?.icon ?? "•"}
                      </span>
                      <span>{item.label}</span>
                      <span className="mobile-menu-arrow" aria-hidden>›</span>
                    </Link>
                  ))}
                </Card>
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
