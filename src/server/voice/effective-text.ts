/**
 * effectiveText = correctedText ?? originalText — PUR.
 * C'est ce texte qui est envoyé à Djeli IA. `originalText` n'est jamais écrasé.
 */
export function effectiveTextOf(input: {
  originalText: string;
  correctedText: string | null | undefined;
}): string {
  return input.correctedText != null && input.correctedText !== ""
    ? input.correctedText
    : input.originalText;
}
