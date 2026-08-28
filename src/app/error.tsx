"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[djeli] render error", error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: 24,
        textAlign: "center",
      }}
    >
      <h1 style={{ fontSize: 30 }}>Une erreur est survenue</h1>
      <p style={{ color: "var(--text-2)", maxWidth: 420 }}>
        Réessayez dans un instant. Si le problème persiste, contactez le support.
      </p>
      <button className="dj-btn dj-btn--primary" onClick={reset}>
        Réessayer
      </button>
    </div>
  );
}
