import { requireUser } from "@/server/auth/current-user";
import { getOrgContext } from "@/server/tenant/context";
import { Card, PageHeader, RoleBadge } from "@/components/ui";
import {
  ProfileForm,
  PasswordForm,
  RevokeSessionsForm,
} from "@/components/profile/ProfileForms";

export const metadata = { title: "Mon profil — FEREDRON" };

export default async function ProfilePage() {
  const user = await requireUser();
  const ctx = await getOrgContext(user);

  return (
    <>
      <PageHeader
        title="Mon profil"
        subtitle="Vos informations personnelles et votre accès."
      />
      <div style={{ maxWidth: 700, display: "flex", flexDirection: "column", gap: 20 }}>
        <Card>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 20,
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 23,
              }}
            >
              {user.firstName} {user.lastName}
            </div>
            {ctx ? <RoleBadge role={ctx.role} /> : null}
            {ctx ? (
              <span style={{ fontSize: 12, color: "var(--text-3)" }}>
                {ctx.organization.name}
              </span>
            ) : null}
          </div>
          <ProfileForm
            firstName={user.firstName}
            lastName={user.lastName}
            email={user.email}
            phone={user.phone ?? ""}
            locale={user.locale}
          />
        </Card>

        <Card>
          <h3 style={{ fontSize: 21, margin: "0 0 16px" }}>Mot de passe</h3>
          <PasswordForm />
        </Card>

        <Card>
          <h3 style={{ fontSize: 21, margin: "0 0 16px" }}>Sécurité des sessions</h3>
          <RevokeSessionsForm />
        </Card>
      </div>
    </>
  );
}
