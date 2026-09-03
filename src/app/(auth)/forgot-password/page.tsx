import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/current-user";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const metadata = { title: "Mot de passe oublié — FEREDRON" };

export default async function ForgotPasswordPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");
  return <ForgotPasswordForm />;
}
