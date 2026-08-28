/** Détection de langue légère — PUR. FR / BM (bambara) / AUTO (indéterminé). */

export type AiLanguage = "FR" | "BM" | "AUTO";

const BAMBARA_MARKERS = [
  "aw ni",
  "i ni ",
  "i ni ce",
  "i ni sogoma",
  "n b'a fɛ",
  "n bɛ",
  "sugu",
  "musa",
  "aw sango",
  "ɛntɛrɛ",
  "sɔngɔ",
  "joli",
  "wari",
];

const FRENCH_MARKERS = [
  "bonjour",
  "merci",
  "combien",
  "je veux",
  "vous avez",
  "prix",
  "livraison",
  "commande",
  "sac",
  "svp",
  "s'il vous plaît",
];

export function detectLanguage(text: string): AiLanguage {
  const t = text.toLowerCase();
  const bm = BAMBARA_MARKERS.some((m) => t.includes(m));
  const fr = FRENCH_MARKERS.some((m) => t.includes(m));
  if (bm && !fr) return "BM";
  if (fr && !bm) return "FR";
  if (bm && fr) return "FR"; // par prudence on répond en français
  return "AUTO";
}

export function normalizeLanguage(v: unknown): AiLanguage {
  return v === "FR" || v === "BM" || v === "AUTO" ? v : "AUTO";
}
