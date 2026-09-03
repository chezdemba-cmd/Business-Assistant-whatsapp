import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/current-user";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata = { title: "Nouveau mot de passe — FEREDRON" };

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");
  const { token } = await params;
  return <ResetPasswordForm token={token} />;
}
