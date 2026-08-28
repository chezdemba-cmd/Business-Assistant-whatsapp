"use client";

import { useCallback, useRef, useState } from "react";
import { transcribeAppAudioAction } from "@/server/actions/voice.actions";

type State = "idle" | "recording" | "transcribing" | "error";

/**
 * Bouton micro pour `/ai` (et réutilisable ailleurs). Enregistre via
 * `MediaRecorder`, envoie l'audio au serveur pour transcription éphémère (aucun
 * stockage), puis remonte le texte au parent qui pré-remplit le champ.
 * Mobile-first : gros bouton, indicateur d'enregistrement, durée, annuler.
 */
export function MicButton({
  organizationId,
  onTranscribed,
  disabled,
}: {
  organizationId: string;
  onTranscribed: (text: string, language: string) => void;
  disabled?: boolean;
}) {
  const [state, setState] = useState<State>("idle");
  const [seconds, setSeconds] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelledRef = useRef(false);

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recRef.current = null;
    chunksRef.current = [];
    setSeconds(0);
  }, []);

  const start = useCallback(async () => {
    setMsg(null);
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      typeof MediaRecorder === "undefined"
    ) {
      setState("error");
      setMsg("Micro non disponible sur ce navigateur.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      cancelledRef.current = false;
      const rec = new MediaRecorder(stream);
      recRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        const blob = new Blob(chunksRef.current, {
          type: rec.mimeType || "audio/webm",
        });
        cleanup();
        if (cancelledRef.current || blob.size === 0) {
          setState("idle");
          return;
        }
        setState("transcribing");
        try {
          const fd = new FormData();
          fd.set("organizationId", organizationId);
          fd.set("audio", blob, "recording.webm");
          const res = await transcribeAppAudioAction(null, fd);
          if (res.ok && res.data.text) {
            onTranscribed(res.data.text, res.data.language);
            setState("idle");
          } else {
            setState("error");
            setMsg(res.ok ? "Aucun texte détecté." : res.error);
          }
        } catch {
          setState("error");
          setMsg("Échec de la transcription.");
        }
      };
      rec.start();
      setState("recording");
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      setState("error");
      setMsg("Autorisation micro refusée.");
    }
  }, [organizationId, onTranscribed, cleanup]);

  const stop = useCallback((cancel: boolean) => {
    cancelledRef.current = cancel;
    recRef.current?.stop();
  }, []);

  if (state === "recording") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          aria-hidden
          style={{
            width: 10,
            height: 10,
            borderRadius: 999,
            background: "var(--accent)",
            animation: "pulse 1s infinite",
          }}
        />
        <span className="tnum" style={{ fontSize: 13, minWidth: 34 }}>
          {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
        </span>
        <button
          type="button"
          className="dj-btn dj-btn--primary"
          style={{ height: 38 }}
          onClick={() => stop(false)}
        >
          Terminer
        </button>
        <button
          type="button"
          className="dj-btn dj-btn--ghost"
          style={{ height: 38 }}
          onClick={() => stop(true)}
        >
          Annuler
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <button
        type="button"
        className="dj-btn dj-btn--outline"
        style={{ height: 44, minWidth: 44, fontSize: 18, padding: "0 14px" }}
        onClick={start}
        disabled={disabled || state === "transcribing"}
        aria-label="Enregistrer un message vocal"
        title="Poser la question à la voix"
      >
        {state === "transcribing" ? "…" : "🎤"}
      </button>
      {msg ? <span className="dj-error">{msg}</span> : null}
    </div>
  );
}
