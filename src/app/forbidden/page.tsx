import { ForbiddenPanel } from "@/components/ForbiddenPanel";

export const metadata = { title: "Accès non autorisé — Djeli" };

export default function ForbiddenPage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center" }}>
      <div style={{ width: "100%" }}>
        <ForbiddenPanel />
      </div>
    </div>
  );
}
