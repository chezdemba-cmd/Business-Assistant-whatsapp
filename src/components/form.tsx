"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { ActionResult } from "@/lib/result";

export function SubmitButton({
  children,
  variant = "primary",
  style,
}: {
  children: ReactNode;
  variant?: "primary" | "outline";
  style?: React.CSSProperties;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={`dj-btn dj-btn--${variant}`}
      disabled={pending}
      style={style}
    >
      {pending ? "…" : children}
    </button>
  );
}

/** Affiche l'erreur globale / le succès d'une Server Action. */
export function Feedback({
  state,
  successMessage,
}: {
  state: ActionResult<unknown> | null;
  successMessage?: string;
}) {
  if (!state) return null;
  if (state.ok) {
    return successMessage ? (
      <div className="dj-alert dj-alert--ok">{successMessage}</div>
    ) : null;
  }
  return (
    <div className="dj-alert dj-alert--error" role="alert">
      <span>{state.error}</span>
    </div>
  );
}

/** Renvoie le message d'erreur d'un champ donné, s'il existe. */
export function fieldError(
  state: ActionResult<unknown> | null,
  name: string,
): string | undefined {
  if (!state || state.ok) return undefined;
  return state.fieldErrors?.[name];
}
