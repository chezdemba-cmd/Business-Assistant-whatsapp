"use client";

import { useEffect, useReducer } from "react";
import {
  initialNetState,
  netBanner,
  netReducer,
} from "@/lib/network-state";

/** Bandeau « Connexion perdue / rétablie » (§30). Purement informatif. */
export function NetworkBanner() {
  const [state, dispatch] = useReducer(netReducer, initialNetState);

  useEffect(() => {
    const probe = async () => {
      try {
        const response = await fetch("/api/health", { cache: "no-store" });
        dispatch(response.ok ? "ONLINE" : "OFFLINE");
      } catch {
        dispatch("OFFLINE");
      }
    };
    if (typeof navigator !== "undefined" && navigator.onLine === false) void probe();
    const on = () => dispatch("ONLINE");
    // Une WebView reliée par USB peut accéder au serveur même si Android
    // déclare le téléphone hors ligne : vérifier avant d'afficher l'alerte.
    const off = () => void probe();
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    if (state.phase === "reconnected") {
      const t = setTimeout(() => dispatch("DISMISS"), 3000);
      return () => clearTimeout(t);
    }
  }, [state.phase]);

  const b = netBanner(state);
  if (!b) return null;

  return (
    <div
      role="status"
      style={{
        background: b.tone === "error" ? "var(--err-bg, #fde8e8)" : "var(--ok-bg)",
        color: b.tone === "error" ? "var(--err-fg, #a12020)" : "var(--ok-fg)",
        fontSize: 12,
        fontWeight: 700,
        textAlign: "center",
        padding: "6px 12px",
        borderBottom: "1px solid var(--border)",
      }}
    >
      {b.text}
    </div>
  );
}
