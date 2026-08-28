import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/current-user";
import { listMemberships } from "@/server/tenant/context";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const memberships = await listMemberships(user.id);
  redirect(memberships.length > 0 ? "/dashboard" : "/onboarding");
}
