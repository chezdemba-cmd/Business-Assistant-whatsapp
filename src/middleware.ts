import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth-constants";

/**
 * Garde légère : présence du cookie de session pour les zones authentifiées.
 * La vraie autorisation (validité du JWT, appartenance, permissions) est
 * contrôlée côté serveur dans les pages et les Server Actions.
 */
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/members",
  "/settings",
  "/profile",
  "/onboarding",
  "/catalog",
  "/stock",
  "/customers",
  "/orders",
  "/debts",
  "/reminders",
  "/conversations",
  "/ai",
  "/language",
  "/admin",
  "/automations",
  "/marketing",
  "/support",
  "/billing",
  "/recommendations",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const needsAuth = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  if (!needsAuth) return NextResponse.next();

  const hasSession = request.cookies.has(SESSION_COOKIE_NAME);
  if (hasSession) return NextResponse.next();

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/members/:path*",
    "/settings/:path*",
    "/profile/:path*",
    "/onboarding/:path*",
    "/catalog/:path*",
    "/stock/:path*",
    "/customers/:path*",
    "/orders/:path*",
    "/debts/:path*",
    "/reminders/:path*",
    "/conversations/:path*",
    "/ai/:path*",
    "/language/:path*",
    "/admin/:path*",
    "/automations/:path*",
    "/marketing/:path*",
    "/support/:path*",
    "/billing/:path*",
    "/recommendations/:path*",
  ],
};
