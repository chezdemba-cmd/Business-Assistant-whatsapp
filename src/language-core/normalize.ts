/**
 * Normalisation DOUCE — PUR. Djeli Language Core.
 *
 * Politique documentée :
 *  - minuscule (casse) ;
 *  - apostrophes typographiques → simple ' ;
 *  - espaces multiples → un seul ; trim ;
 *  - ponctuation de bord retirée (.,;:!?…«»"), ponctuation interne conservée ;
 *  - LES DIACRITIQUES SONT CONSERVÉS : on ne détruit JAMAIS les particularités
 *    du bambara (ɛ ɔ ɲ ŋ, tons) ni les accents français. Le texte original est
 *    toujours stocké à part (`canonicalText` / `originalText`).
 */

const EDGE_PUNCT = /^[\s.,;:!?…«»"'()[\]{}\-–—]+|[\s.,;:!?…«»"'()[\]{}\-–—]+$/g;

export function normalizeText(input: string): string {
  return (input ?? "")
    .replace(/[‘’ʼ′]/g, "'")
    .replace(/[“”]/g, '"')
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(EDGE_PUNCT, "")
    .trim();
}

/** Deux textes désignent-ils la même forme normalisée ? */
export function sameNormalized(a: string, b: string): boolean {
  return normalizeText(a) === normalizeText(b) && normalizeText(a).length > 0;
}
