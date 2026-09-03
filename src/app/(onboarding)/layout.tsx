import type { ReactNode } from "react";

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "64px 24px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 40,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 999,
            background: "var(--accent)",
            color: "var(--on-accent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-display)",
            fontSize: 16,
          }}
        >
          D
        </div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 16 }}>FEREDRON</div>
      </div>
      {children}
    </div>
  );
}
