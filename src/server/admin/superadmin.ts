/**
 * Autorisation opérateur Djeli — PUR (§22). Un opérateur a le flag DB
 * `isSuperAdmin`, OU son e-mail figure dans `DJELI_SUPERADMIN_EMAILS`.
 */
export function parseAllowlist(raw: string | undefined | null): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isSuperAdminUser(
  user: { isSuperAdmin: boolean; email: string },
  allowlist: Set<string>,
): boolean {
  return user.isSuperAdmin || allowlist.has(user.email.toLowerCase());
}
