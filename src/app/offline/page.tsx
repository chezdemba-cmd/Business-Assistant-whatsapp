export const metadata = { title: "Hors ligne — FEREDRON" };

/** Page de secours servie par le service worker quand le réseau est absent (§29). */
export default function OfflinePage() {
  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "var(--bg)",
      }}
    >
      <div style={{ maxWidth: 380, textAlign: "center" }}>
        <div
          aria-hidden
          style={{
            width: 56,
            height: 56,
            borderRadius: 999,
            background: "var(--card-alt)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 26,
            margin: "0 auto 20px",
          }}
        >
          📡
        </div>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 26, margin: "0 0 10px" }}>
          Vous êtes hors ligne
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-2)", lineHeight: 1.6, margin: "0 0 22px" }}>
          FEREDRON a besoin d&apos;une connexion pour afficher vos données et
          enregistrer vos actions. Reconnectez-vous puis réessayez.
        </p>
        <a href="/dashboard" className="dj-btn dj-btn--primary">
          Réessayer
        </a>
      </div>
    </div>
  );
}
