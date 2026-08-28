/** Types du fournisseur LLM — PURS (aucune dépendance serveur). */

export type AiMessage = { role: "system" | "user" | "assistant"; content: string };

export type AiGenerateResult = {
  /** Objet JSON brut renvoyé par le modèle (validé ensuite par Zod). */
  raw: unknown;
  inputTokens: number | null;
  outputTokens: number | null;
};

export interface AiProvider {
  readonly name: string;
  readonly model: string;
  generateStructured(input: {
    system: string;
    messages: AiMessage[];
  }): Promise<AiGenerateResult>;
}
