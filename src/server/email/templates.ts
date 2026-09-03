import { BRAND } from "@/lib/brand";

/** Échappement HTML minimal pour les valeurs interpolées dans les gabarits. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildPasswordResetEmail(input: {
  firstName: string;
  resetUrl: string;
  ttlMinutes: number;
}): { subject: string; html: string; text: string } {
  const name = esc(input.firstName || "");
  const url = esc(input.resetUrl);
  const mins = input.ttlMinutes;
  const brand = esc(BRAND.name);

  const subject = `${BRAND.name} — réinitialisation de votre mot de passe`;

  const text = [
    `Bonjour ${input.firstName || ""},`.trim(),
    "",
    `Vous avez demandé à réinitialiser votre mot de passe ${BRAND.name}.`,
    `Ouvrez ce lien (valable ${mins} minutes) :`,
    input.resetUrl,
    "",
    "Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail : votre mot de passe reste inchangé.",
  ].join("\n");

  const html = `<!doctype html><html><body style="font-family:system-ui,Segoe UI,Roboto,sans-serif;color:#0f172a;line-height:1.5">
  <p>Bonjour ${name},</p>
  <p>Vous avez demandé à réinitialiser votre mot de passe <strong>${brand}</strong>.</p>
  <p><a href="${url}" style="display:inline-block;background:#03172D;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Choisir un nouveau mot de passe</a></p>
  <p style="color:#475569;font-size:13px">Ou copiez ce lien (valable ${mins} minutes) :<br><span style="word-break:break-all">${url}</span></p>
  <p style="color:#475569;font-size:13px">Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail : votre mot de passe reste inchangé.</p>
  </body></html>`;

  return { subject, html, text };
}
