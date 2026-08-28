import Link from "next/link";

export default function NotFound() {
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
      <h1 style={{ fontSize: 32 }}>Page introuvable</h1>
      <p style={{ color: "var(--text-2)" }}>
        Le lien que vous avez suivi n&apos;existe pas ou plus.
      </p>
      <Link href="/" className="dj-btn dj-btn--primary">
        Retour à l&apos;accueil
      </Link>
    </div>
  );
}
