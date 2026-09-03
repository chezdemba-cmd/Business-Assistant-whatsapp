import { NextResponse, type NextRequest } from "next/server";
import { parseDeepLink } from "@/lib/deep-links";

export const dynamic = "force-dynamic";

/**
 * Passerelle de deep link web (§40) :  /link?to=djeli://order/123  → 302 vers le
 * chemin interne sûr. Cible inconnue → /dashboard. Ne suit JAMAIS une URL
 * externe. Utile pour les liens de notification e-mail / push web.
 */
export function GET(request: NextRequest) {
  const to = request.nextUrl.searchParams.get("to") ?? "";
  const parsed = parseDeepLink(to);
  const dest = parsed?.path ?? "/dashboard";
  return NextResponse.redirect(new URL(dest, request.url));
}
