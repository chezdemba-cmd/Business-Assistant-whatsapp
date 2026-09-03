/**
 * Machine à états du flux Voice mobile — PUR (§20, §21, §22). Testable sans DOM.
 *
 *   IDLE → RECORDING → UPLOADING → TRANSCRIBING → READY
 *                                              ↘ LOW_CONFIDENCE
 *   n'importe quel état actif → FAILED (erreur) ; CANCEL → IDLE
 */

export type VoiceState =
  | "IDLE"
  | "RECORDING"
  | "UPLOADING"
  | "TRANSCRIBING"
  | "READY"
  | "LOW_CONFIDENCE"
  | "FAILED";

export type VoiceEvent =
  | { type: "START" }
  | { type: "STOP" } // fin d'enregistrement → envoi
  | { type: "UPLOADED" }
  | { type: "TRANSCRIBED"; confidence: number; threshold: number }
  | { type: "CONFIRM" } // l'utilisateur valide le texte (LOW_CONFIDENCE → READY)
  | { type: "EDIT" } // l'utilisateur veut corriger (LOW_CONFIDENCE → READY, texte éditable)
  | { type: "ERROR" }
  | { type: "CANCEL" }
  | { type: "RESET" };

const ACTIVE: VoiceState[] = ["RECORDING", "UPLOADING", "TRANSCRIBING"];

export function voiceReducer(state: VoiceState, event: VoiceEvent): VoiceState {
  if (event.type === "RESET" || event.type === "CANCEL") return "IDLE";
  if (event.type === "ERROR") return "FAILED";

  switch (state) {
    case "IDLE":
    case "FAILED":
    case "READY":
      if (event.type === "START") return "RECORDING";
      return state;
    case "RECORDING":
      if (event.type === "STOP") return "UPLOADING";
      return state;
    case "UPLOADING":
      if (event.type === "UPLOADED") return "TRANSCRIBING";
      return state;
    case "TRANSCRIBING":
      if (event.type === "TRANSCRIBED") {
        return event.confidence < event.threshold ? "LOW_CONFIDENCE" : "READY";
      }
      return state;
    case "LOW_CONFIDENCE":
      if (event.type === "CONFIRM" || event.type === "EDIT") return "READY";
      if (event.type === "START") return "RECORDING";
      return state;
    default:
      return state;
  }
}

export function isBusy(state: VoiceState): boolean {
  return ACTIVE.includes(state);
}

export function voiceHint(state: VoiceState): string {
  switch (state) {
    case "IDLE":
      return "Appuyez pour parler à Djeli";
    case "RECORDING":
      return "Enregistrement… appuyez pour terminer";
    case "UPLOADING":
      return "Envoi…";
    case "TRANSCRIBING":
      return "Transcription en cours…";
    case "READY":
      return "Vérifiez le texte puis envoyez";
    case "LOW_CONFIDENCE":
      return "J'ai un doute — confirmez ou corrigez";
    case "FAILED":
      return "Échec — réessayez";
  }
}
