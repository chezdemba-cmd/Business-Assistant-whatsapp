import type { ReactNode } from "react";
import Link from "next/link";
import type { Organization, Role, User } from "@prisma/client";
import { roleLabel, Avatar } from "@/components/ui";
import { Sidebar } from "./Sidebar";
import { LogoutButton } from "./LogoutButton";
import { FeedbackButton } from "@/components/support/FeedbackButton";

type SubBadge = {
  planName: string;
  status: string;
  daysLeftInTrial: number | null;
  isTrialExpired: boolean;
};

export function AppShell({
  user,
  organization,
  role,
  subscription,
  isPilot,
  demoMode,
  children,
}: {
  user: User;
  organization: Organization;
  role: Role;
  subscription?: SubBadge;
  isPilot?: boolean;
  demoMode?: boolean;
  children: ReactNode;
}) {
  const fullName = `${user.firstName} ${user.lastName}`;
  const trialBanner =
    subscription?.status === "TRIAL" && !subscription.isTrialExpired
      ? `Essai ${subscription.planName} — ${subscription.daysLeftInTrial ?? 0} jour(s) restant(s)`
      : subscription?.status === "TRIAL" && subscription.isTrialExpired
        ? `Votre essai est terminé — choisissez une offre`
        : subscription?.status === "PAST_DUE"
          ? `Paiement en attente — l'accès reste ouvert pour l'instant`
          : subscription?.status === "SUSPENDED"
            ? `Compte suspendu — contactez le support`
            : null;
  return (
    <div className="app-shell">
      <Sidebar
        role={role}
        organizationName={organization.name}
        countryCode={organization.countryCode}
        currency={organization.currency}
      />
      <div className="app-main">
        {demoMode ? (
          <div
            style={{
              background: "var(--warn-bg)",
              color: "var(--warn-fg)",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.04em",
              textAlign: "center",
              padding: "6px 12px",
              borderBottom: "1px solid var(--border)",
            }}
          >
            ENVIRONNEMENT DE DÉMONSTRATION — aucune donnée réelle
          </div>
        ) : null}
        <header className="app-topbar">
          <div
            style={{
              flex: 1,
              maxWidth: 380,
              height: 40,
              display: "flex",
              alignItems: "center",
              padding: "0 16px",
              border: "1px solid var(--border)",
              borderRadius: 999,
              background: "var(--card)",
              color: "var(--text-muted)",
              fontSize: 14,
            }}
          >
            Rechercher — disponible en Phase 2
          </div>
          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            {isPilot ? (
              <span className="dj-badge" style={{ fontWeight: 700 }}>Pilote</span>
            ) : null}
            {trialBanner ? (
              <Link
                href="/billing"
                className="dj-badge"
                style={{ fontWeight: 600, color: "var(--text-2)" }}
              >
                {trialBanner}
              </Link>
            ) : null}
            <FeedbackButton />
            <Link href="/profile" className="app-profile-chip">
              <Avatar name={fullName} />
              <div style={{ lineHeight: 1.15 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{fullName}</div>
                <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                  {roleLabel(role)}
                </div>
              </div>
            </Link>
            <LogoutButton />
          </div>
        </header>
        <div className="dj-page">{children}</div>
      </div>
    </div>
  );
}
