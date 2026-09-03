import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth/current-user";
import { listMemberships } from "@/server/tenant/context";
import { CreateOrgForm } from "./CreateOrgForm";

export const metadata = { title: "Créer votre entreprise — FEREDRON" };

export default async function OnboardingPage() {
  const user = await requireUser();
  const memberships = await listMemberships(user.id);
  if (memberships.length > 0) redirect("/dashboard");
  return <CreateOrgForm />;
}
