import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/current-user";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata = { title: "Nouveau mot de passe — Djeli" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  const { token } = await searchParams;
  if (!token) {
    return (
      <div className="dj-stack">
        <h2 style={{ fontSize: 31, margin: "0 0 6px" }}>Lien invalide</h2>
        <p style={{ margin: 0, color: "var(--text-3)", fontSize: 14 }}>
          Ce lien de réinitialisation est incomplet.{" "}
          <Link href="/forgot-password" style={{ fontWeight: 600 }}>
            Refaire une demande
          </Link>
          .
        </p>
      </div>
    );
  }

  return <ResetPasswordForm token={token} />;
}
