"use client";

import { useEffect, useState } from "react";
import { mobileFlags } from "@/lib/flags";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const DISMISS_KEY = "feredron-install-dismissed";

/**
 * Enregistre le service worker et propose l'installation PWA (§27, §28).
 *  - Android/Chrome : bouton « Installer FEREDRON » (via `beforeinstallprompt`).
 *  - iOS/Safari : court guide « Partager → Sur l'écran d'accueil ».
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [dismissed, setDismissed] = useState(true);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (!mobileFlags.PWA || typeof window === "undefined") return;

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* SW indisponible (http non sécurisé hors localhost, etc.) — l'app fonctionne quand même */
      });
    }

    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) {
      setDismissed(true);
      return;
    }

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    window.addEventListener("beforeinstallprompt", onBIP);

    const ua = navigator.userAgent || "";
    const isIOS = /iP(hone|ad|od)/.test(ua) && /Safari/.test(ua) && !/CriOS|FxiOS/.test(ua);
    if (isIOS) setIosHint(true);

    return () => window.removeEventListener("beforeinstallprompt", onBIP);
  }, []);

  function close() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice.catch(() => undefined);
    setDeferred(null);
    close();
  }

  if (dismissed || (!deferred && !iosHint)) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 14px",
        background: "var(--card-alt)",
        borderBottom: "1px solid var(--border)",
        fontSize: 13,
      }}
    >
      <span style={{ flex: 1, color: "var(--text-2)" }}>
        {deferred
          ? "Installez FEREDRON sur votre téléphone pour un accès rapide."
          : "Sur iPhone : appuyez sur Partager puis « Sur l'écran d'accueil »."}
      </span>
      {deferred ? (
        <button
          type="button"
          onClick={install}
          className="dj-btn dj-btn--primary"
          style={{ height: 32, fontSize: 13, padding: "0 12px" }}
        >
          Installer FEREDRON
        </button>
      ) : null}
      <button
        type="button"
        onClick={close}
        aria-label="Fermer"
        className="dj-btn dj-btn--ghost"
        style={{ height: 32, fontSize: 16, padding: "0 8px" }}
      >
        ×
      </button>
    </div>
  );
}
