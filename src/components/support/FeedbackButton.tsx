"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { submitFeedbackAction } from "@/server/actions/support.actions";

const CATEGORIES = [
  ["SUGGESTION", "Suggestion"],
  ["BUG", "Bug"],
  ["AI", "Djeli IA"],
  ["VOICE", "Djeli Voice"],
  ["WHATSAPP", "WhatsApp"],
  ["OTHER", "Autre"],
] as const;

export function FeedbackButton() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(submitFeedbackAction, null);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) {
      ref.current?.reset();
      const t = setTimeout(() => setOpen(false), 1200);
      return () => clearTimeout(t);
    }
  }, [state]);

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="dj-btn dj-btn--ghost"
        style={{ height: 34, fontSize: 13, padding: "0 12px" }}
      >
        Donner mon avis
      </button>
      {open ? (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 8px)",
            width: 320,
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 14,
            padding: 14,
            boxShadow: "0 12px 32px rgba(0,0,0,0.12)",
            zIndex: 50,
          }}
        >
          <form ref={ref} action={action} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input type="hidden" name="path" value={pathname} />
            <div style={{ fontSize: 13, fontWeight: 700 }}>Votre retour</div>
            <select name="category" className="dj-input" defaultValue="SUGGESTION">
              {CATEGORIES.map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            <textarea
              name="message"
              required
              rows={4}
              maxLength={2000}
              className="dj-input"
              placeholder="Ce qui marche, ce qui coince, ce qui manque…"
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" className="dj-btn dj-btn--ghost" onClick={() => setOpen(false)}>
                Fermer
              </button>
              <button type="submit" className="dj-btn dj-btn--primary">Envoyer</button>
            </div>
            {state?.ok ? (
              <div style={{ fontSize: 12, color: "var(--ok-fg)" }}>Merci pour votre retour !</div>
            ) : null}
            {state && !state.ok ? (
              <div className="dj-error" style={{ fontSize: 12 }}>{state.error}</div>
            ) : null}
          </form>
        </div>
      ) : null}
    </div>
  );
}
