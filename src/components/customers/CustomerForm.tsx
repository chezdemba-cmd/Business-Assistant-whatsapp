"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { CustomerType } from "@prisma/client";
import {
  createCustomerAction,
  updateCustomerAction,
} from "@/server/actions/customers.actions";
import { CUSTOMER_TYPE_LABEL, CUSTOMER_TYPES } from "@/lib/labels";
import { SubmitButton, Feedback, fieldError } from "@/components/form";
import { Field, Input, Select } from "@/components/ui";

export type CustomerFormData = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  businessName: string | null;
  phone: string | null;
  email: string | null;
  customerType: CustomerType | null;
  address: string | null;
  city: string | null;
  area: string | null;
  notes: string | null;
  assignedToUserId: string | null;
};

export function CustomerForm({
  organizationId,
  members,
  mode,
  customer,
}: {
  organizationId: string;
  members: Array<{ id: string; name: string }>;
  mode: "create" | "edit";
  customer?: CustomerFormData;
}) {
  const router = useRouter();
  const action = mode === "create" ? createCustomerAction : updateCustomerAction;
  const [state, formAction] = useActionState(action, null);

  useEffect(() => {
    if (state?.ok) router.push(`/customers/${state.data.id}`);
  }, [state, router]);

  return (
    <form action={formAction} className="dj-stack" style={{ maxWidth: 720 }}>
      <Feedback state={state} />
      <input type="hidden" name="organizationId" value={organizationId} />
      {mode === "edit" && customer ? (
        <input type="hidden" name="customerId" value={customer.id} />
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label="Prénom" htmlFor="c-first" error={fieldError(state, "firstName")}>
          <Input id="c-first" name="firstName" defaultValue={customer?.firstName ?? ""} />
        </Field>
        <Field label="Nom" htmlFor="c-last" error={fieldError(state, "lastName")}>
          <Input id="c-last" name="lastName" defaultValue={customer?.lastName ?? ""} />
        </Field>
      </div>

      <Field
        label="Nom de la boutique"
        htmlFor="c-biz"
        error={fieldError(state, "businessName")}
        hint="Au moins un nom ou une boutique."
      >
        <Input id="c-biz" name="businessName" defaultValue={customer?.businessName ?? ""} />
      </Field>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field
          label="Téléphone WhatsApp"
          htmlFor="c-phone"
          error={fieldError(state, "phone")}
          hint="Unique par entreprise. Normalisé en E.164."
        >
          <Input id="c-phone" name="phone" type="tel" defaultValue={customer?.phone ?? ""} />
        </Field>
        <Field label="Email" htmlFor="c-email" error={fieldError(state, "email")}>
          <Input id="c-email" name="email" type="email" defaultValue={customer?.email ?? ""} />
        </Field>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label="Type" htmlFor="c-type">
          <Select id="c-type" name="customerType" defaultValue={customer?.customerType ?? ""}>
            <option value="">Non précisé</option>
            {CUSTOMER_TYPES.map((t) => (
              <option key={t} value={t}>
                {CUSTOMER_TYPE_LABEL[t]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Commercial assigné" htmlFor="c-assignee">
          <Select
            id="c-assignee"
            name="assignedToUserId"
            defaultValue={customer?.assignedToUserId ?? ""}
          >
            <option value="">Aucun</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label="Zone / quartier" htmlFor="c-area" error={fieldError(state, "area")}>
          <Input id="c-area" name="area" defaultValue={customer?.area ?? ""} placeholder="Magnambougou" />
        </Field>
        <Field label="Ville" htmlFor="c-city" error={fieldError(state, "city")}>
          <Input id="c-city" name="city" defaultValue={customer?.city ?? ""} />
        </Field>
      </div>

      <Field label="Adresse" htmlFor="c-addr" error={fieldError(state, "address")}>
        <Input id="c-addr" name="address" defaultValue={customer?.address ?? ""} />
      </Field>

      <Field label="Notes" htmlFor="c-notes" error={fieldError(state, "notes")}>
        <textarea
          id="c-notes"
          name="notes"
          className="dj-input"
          rows={3}
          style={{ height: "auto", padding: "12px 18px", resize: "vertical" }}
          defaultValue={customer?.notes ?? ""}
        />
      </Field>

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <SubmitButton>{mode === "create" ? "Créer le client" : "Enregistrer"}</SubmitButton>
        <a
          href={mode === "edit" && customer ? `/customers/${customer.id}` : "/customers"}
          style={{ fontSize: 14, color: "var(--text-3)" }}
        >
          Annuler
        </a>
      </div>
    </form>
  );
}
