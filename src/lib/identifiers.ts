import {
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";

/**
 * Helpers d'identifiants.
 *  - Téléphone : normalisation vers E.164 via libphonenumber-js.
 *    Le numéro n'est JAMAIS une clé technique (cf. modèle User : id = cuid).
 *  - Slug d'organisation.
 *
 * Marchés visés : Mali, Côte d'Ivoire, Sénégal, Burkina Faso, Guinée, France,
 * et tout autre pays pris en charge par libphonenumber-js.
 */

const DEFAULT_COUNTRY: CountryCode = "ML";

function coerceCountry(countryCode: string | undefined): CountryCode {
  return (countryCode?.toUpperCase() as CountryCode | undefined) ?? DEFAULT_COUNTRY;
}

/**
 * Renvoie le numéro au format E.164 (`+22376010203`) s'il est VALIDE,
 * sinon `null`. `defaultCountry` sert d'indicatif pour les numéros saisis
 * en format national (sans `+`).
 */
export function toE164OrNull(
  raw: string,
  defaultCountry: string = DEFAULT_COUNTRY,
): string | null {
  const value = raw.trim();
  if (!value) return null;
  const parsed = parsePhoneNumberFromString(
    value,
    value.startsWith("+") ? undefined : coerceCountry(defaultCountry),
  );
  return parsed && parsed.isValid() ? parsed.number : null;
}

/**
 * Normalisation tolérante utilisée là où l'on veut stocker un E.164 sans
 * bloquer la saisie : renvoie l'E.164 si valide, sinon un repli « best effort »
 * (`+<indicatif><chiffres>`). Ne jette jamais.
 */
export function normalizePhone(
  raw: string,
  countryCode: string = DEFAULT_COUNTRY,
): string {
  const e164 = toE164OrNull(raw, countryCode);
  if (e164) return e164;

  const cleaned = raw.replace(/[^\d+]/g, "");
  if (cleaned.startsWith("+")) return cleaned;
  if (cleaned.startsWith("00")) return `+${cleaned.slice(2)}`;
  const cc = callingCodeFor(countryCode);
  return `+${cc}${cleaned.replace(/^0+/, "")}`;
}

export function isValidPhone(
  raw: string,
  defaultCountry: string = DEFAULT_COUNTRY,
): boolean {
  return toE164OrNull(raw, defaultCountry) !== null;
}

export function isValidE164(value: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(value);
}

const CALLING_CODES: Record<string, string> = {
  ML: "223",
  CI: "225",
  SN: "221",
  BF: "226",
  GN: "224",
  GH: "233",
  NE: "227",
  TG: "228",
  BJ: "229",
  FR: "33",
};

export function callingCodeFor(countryCode: string): string {
  return CALLING_CODES[countryCode.toUpperCase()] ?? "223";
}

/** Supprime les diacritiques via décomposition Unicode + suppression des marques. */
function stripDiacritics(input: string): string {
  return input.normalize("NFD").replace(/\p{M}/gu, "");
}

export function slugify(input: string): string {
  const base = stripDiacritics(input.toLowerCase())
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base || "entreprise";
}

/** Suffixe court aléatoire pour désambiguïser un slug. */
export function shortId(length = 6): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)] ?? "0";
  }
  return out;
}
