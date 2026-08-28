"use client";

import { useActionState } from "react";
import {
  createSupportTicketAction,
} from "@/server/actions/support.actions";
import { Card } from "@/components/ui";
import { SubmitButton, Feedback } from "@/components/form";

const TYPES = [
  ["QUESTION", "Question"],
  ["BUG", "Bug / problème"],
  ["WHATSAPP", "WhatsApp"],
  ["AI", "Djeli IA"],
  ["VOICE", "Djeli Voice"],
  ["BILLING", "Offre / facturation"],
  ["OTHER", "Autre"],
] as const;

export function SupportTicketForm({ email }: { email: string }) {
  const [state, action] = useActionState(createSupportTicketAction, null);
  return (
    <Card>
      <form action={action} style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 560 }}>
        <Feedback state={state} successMessage="Votre demande a bien été envoyée. Nous revenons vers vous." />
        <label style={lbl}>
          Type
          <select name="type" className="dj-input" defaultValue="QUESTION">
            {TYPES.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </label>
        <label style={lbl}>
          Sujet
          <input name="subject" required maxLength={160} className="dj-input" placeholder="Résumé en une phrase" />
        </label>
        <label style={lbl}>
          Description
          <textarea name="body" required rows={5} maxLength={4000} className="dj-input" placeholder="Décrivez ce qu'il s'est passé, l'écran concerné, l'heure approximative…" />
        </label>
        <label style={lbl}>
          E-mail de contact
          <input name="contactEmail" type="email" defaultValue={email} className="dj-input" />
        </label>
        <div><SubmitButton>Envoyer la demande</SubmitButton></div>
      </form>
    </Card>
  );
}

const lbl: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 600 };
