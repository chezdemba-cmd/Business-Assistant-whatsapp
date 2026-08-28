/**
 * Anonymisation des données destinées à un corpus partagé — PUR.
 *
 * Retire au mieux : e-mails, numéros de téléphone (E.164 / locaux), références
 * de commande (CMD-xxxx), longues suites de chiffres, montants d'argent.
 * Sans NER : la détection de noms propres reste limitée — documenté. Une
 * donnée qui ne peut pas être anonymisée sûrement NE DOIT PAS partir en
 * corpus partagé (rester en scope ORGANIZATION).
 */

const RULES: Array<[RegExp, string]> = [
  [/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/gi, "[email]"],
  [/\bCMD-\d{2,}\b/gi, "[ref]"],
  [/\+?\d[\d\s().-]{7,}\d/g, "[tel]"],
  [/\b\d[\d\s]{3,}(?:fcfa|f\b|xof|cfa)\b/gi, "[montant]"],
  [/\b\d{4,}\b/g, "[num]"],
];

export type SanitizeResult = {
  text: string;
  /** true si au moins un masquage a été appliqué. */
  redacted: boolean;
  /** true si le texte semble encore contenir un identifiant risqué. */
  residualRisk: boolean;
};

export function sanitizeLearningData(input: string): SanitizeResult {
  let text = input ?? "";
  let redacted = false;
  for (const [re, repl] of RULES) {
    const next = text.replace(re, () => {
      redacted = true;
      return repl;
    });
    text = next;
  }
  text = text.replace(/\s+/g, " ").trim();
  // Heuristique de risque résiduel : suite de 3+ chiffres restante.
  const residualRisk = /\d{3,}/.test(text);
  return { text, redacted, residualRisk };
}
