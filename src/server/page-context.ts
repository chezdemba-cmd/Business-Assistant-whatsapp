import "server-only";
import { requireUser } from "@/server/auth/current-user";
import { requireOrgContext, type OrgContext } from "@/server/tenant/context";

/** Contexte standard d'une page authentifiée liée à une organisation. */
export async function pageOrgContext(): Promise<OrgContext> {
  const user = await requireUser();
  return requireOrgContext(user);
}
