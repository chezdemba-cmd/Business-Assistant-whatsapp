/**
 * Détection de langue vocale — PUR. Combine la suggestion du moteur et des
 * heuristiques légères. NE construit PAS le futur « Djeli Language Core » :
 * juste assez pour router FR / BM / MIXED / UNKNOWN.
 */

export type VoiceLang = "FR" | "BM" | "MIXED" | "UNKNOWN";

const BAMBARA_MARKERS = [
  "aw ni",
  "i ni ce",
  "i ni sogoma",
  "n b'a fɛ",
  "n bɛ",
  "n be",
  "ne bɛ",
  "sugu",
  "sɔngɔ",
  "songo",
  "wari",
  "joli",
  "sukaro",
  "malo",
  "tulu",
  "a ka",
  "ka di",
  "i ni baara",
  "ɛntɛrɛ",
];

const FRENCH_MARKERS = [
  "bonjour",
  "merci",
  "combien",
  "je veux",
  "vous avez",
  "il me faut",
  "prix",
  "livraison",
  "commande",
  "sac",
  "carton",
  "s'il vous plaît",
  "svp",
  "ajoute",
  "mets-moi",
  "mettez-moi",
];

function hasAny(text: string, markers: string[]): boolean {
  return markers.some((m) => text.includes(m));
}

function normalizeProviderLang(raw: string | null | undefined): VoiceLang | null {
  if (!raw) return null;
  const v = raw.toLowerCase().trim();
  if (v === "mixed" || v.includes("+") || v.includes(",")) return "MIXED";
  if (v === "bm" || v.startsWith("bam")) return "BM";
  if (v.startsWith("fr")) return "FR";
  return null;
}

export function detectVoiceLanguage(input: {
  text: string;
  providerLanguage?: string | null;
}): { language: VoiceLang; mixed: boolean } {
  const text = (input.text ?? "").toLowerCase();
  const bm = hasAny(text, BAMBARA_MARKERS);
  const fr = hasAny(text, FRENCH_MARKERS);

  if (bm && fr) return { language: "MIXED", mixed: true };

  const provider = normalizeProviderLang(input.providerLanguage);
  if (provider === "MIXED") return { language: "MIXED", mixed: true };

  if (bm) return { language: "BM", mixed: false };
  if (fr) return { language: "FR", mixed: false };

  if (provider === "FR" || provider === "BM") {
    return { language: provider, mixed: false };
  }
  return { language: "UNKNOWN", mixed: false };
}

/** Normalisation DOUCE pour traitement machine — l'original reste la vérité. */
export function normalizeVoiceText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?])/g, "$1")
    .trim();
}
