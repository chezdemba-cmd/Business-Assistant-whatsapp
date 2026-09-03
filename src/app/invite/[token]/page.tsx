import { prisma } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/current-user";
import { roleLabel, Card } from "@/components/ui";
import { AcceptInviteForm } from "./AcceptInviteForm";

export const metadata = { title: "Invitation — FEREDRON" };

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: { organization: { select: { name: true, status: true } } },
  });

  const user = await getCurrentUser();

  let problem: string | null = null;
  if (!invitation) problem = "Cette invitation n'existe pas.";
  else if (invitation.status === "ACCEPTED")
    problem = "Cette invitation a déjà été acceptée.";
  else if (invitation.status === "REVOKED")
    problem = "Cette invitation a été révoquée.";
  else if (
    invitation.status === "EXPIRED" ||
    invitation.expiresAt.getTime() < Date.now()
  )
    problem = "Cette invitation a expiré. Demandez-en une nouvelle.";
  else if (invitation.organization.status !== "ACTIVE")
    problem = "Cette entreprise n'est pas disponible.";

  return (
    <div style={{ maxWidth: 440, margin: "0 auto", padding: "80px 24px" }}>
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 999,
          background: "var(--accent)",
          color: "var(--on-accent)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-display)",
          fontSize: 21,
          marginBottom: 24,
        }}
      >
        D
      </div>

      {problem ? (
        <>
          <h1 style={{ fontSize: 28, margin: "0 0 10px" }}>Invitation indisponible</h1>
          <p style={{ color: "var(--text-2)" }}>{problem}</p>
          <a href="/login" className="dj-btn dj-btn--outline" style={{ marginTop: 16 }}>
            Aller à la connexion
          </a>
        </>
      ) : (
        <>
          <h1 style={{ fontSize: 28, margin: "0 0 8px" }}>
            Rejoindre {invitation!.organization.name}
          </h1>
          <p style={{ color: "var(--text-2)", margin: "0 0 24px" }}>
            Vous êtes invité comme <strong>{roleLabel(invitation!.role)}</strong>.
            {user
              ? ` Connecté en tant que ${user.firstName} ${user.lastName}.`
              : " Créez votre compte pour continuer."}
          </p>
          <Card>
            <AcceptInviteForm token={token} needsAccount={!user} />
          </Card>
        </>
      )}
    </div>
  );
}
