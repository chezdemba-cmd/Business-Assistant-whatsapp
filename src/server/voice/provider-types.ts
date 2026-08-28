/** Types du fournisseur speech-to-text — PURS (aucune dépendance serveur). */

export type VoiceTranscribeInput = {
  /** Octets audio bruts. */
  audio: Uint8Array;
  mimeType: string;
  /** Indice de langue attendu ("fr", "bm", "fr,bm"…) — le moteur reste libre. */
  languageHint?: string | null;
};

export type VoiceTranscribeResult = {
  text: string;
  /** Langue suggérée par le moteur ("fr" | "bm" | "mixed" | null). */
  detectedLanguage: string | null;
  confidence: number | null;
  durationMs: number | null;
  provider: string;
  model: string;
  /** Métadonnées limitées, jamais l'audio ni un secret. */
  metadata?: Record<string, string | number | boolean>;
};

export interface VoiceProvider {
  readonly name: string;
  readonly model: string;
  transcribe(input: VoiceTranscribeInput): Promise<VoiceTranscribeResult>;
}
