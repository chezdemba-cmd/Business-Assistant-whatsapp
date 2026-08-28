import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/current-user";
import { RegisterForm } from "./RegisterForm";

export const metadata = { title: "Créer un compte — Djeli" };

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect("/onboarding");
  return <RegisterForm />;
}
