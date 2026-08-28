"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createCategoryAction } from "@/server/actions/catalog.actions";
import { SubmitButton, fieldError } from "@/components/form";
import { Input } from "@/components/ui";

export function CategoryQuickAdd({ organizationId }: { organizationId: string }) {
  const router = useRouter();
  const [state, action] = useActionState(createCategoryAction, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  return (
    <form
      ref={formRef}
      action={action}
      style={{ display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}
    >
      <input type="hidden" name="organizationId" value={organizationId} />
      <div style={{ flex: 1, minWidth: 180 }}>
        <Input name="name" placeholder="Nouvelle catégorie (Riz, Huile…)" required />
        {fieldError(state, "name") ? (
          <div className="dj-error" style={{ marginTop: 4 }}>
            {fieldError(state, "name")}
          </div>
        ) : null}
        {state && !state.ok && !fieldError(state, "name") ? (
          <div className="dj-error" style={{ marginTop: 4 }}>
            {state.error}
          </div>
        ) : null}
      </div>
      <SubmitButton variant="outline">Ajouter</SubmitButton>
    </form>
  );
}
