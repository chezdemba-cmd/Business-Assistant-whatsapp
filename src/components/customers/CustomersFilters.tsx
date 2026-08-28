"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CUSTOMER_TYPE_LABEL, CUSTOMER_TYPES } from "@/lib/labels";
import { Input, Select } from "@/components/ui";

export function CustomersFilters({
  members,
  showAssignee,
}: {
  members: Array<{ id: string; name: string }>;
  showAssignee: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const update = useCallback(
    (patch: Record<string, string>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v) next.set(k, v);
        else next.delete(k);
      }
      next.delete("page");
      router.replace(`${pathname}?${next.toString()}`);
    },
    [params, pathname, router],
  );

  return (
    <form
      onSubmit={(e) => e.preventDefault()}
      style={{
        display: "grid",
        gridTemplateColumns: showAssignee
          ? "1.6fr 1fr 1fr 1fr"
          : "1.6fr 1fr 1fr",
        gap: 12,
        marginBottom: 20,
      }}
    >
      <Input
        defaultValue={params.get("q") ?? ""}
        placeholder="Rechercher : nom, téléphone, boutique, zone…"
        onChange={(e) => {
          const v = e.currentTarget.value;
          const w = window as unknown as { __djCustT?: number };
          window.clearTimeout(w.__djCustT);
          w.__djCustT = window.setTimeout(() => update({ q: v }), 350);
        }}
      />
      <Select
        defaultValue={params.get("type") ?? ""}
        onChange={(e) => update({ type: e.currentTarget.value })}
      >
        <option value="">Tous les types</option>
        {CUSTOMER_TYPES.map((t) => (
          <option key={t} value={t}>
            {CUSTOMER_TYPE_LABEL[t]}
          </option>
        ))}
      </Select>
      <Select
        defaultValue={params.get("status") ?? ""}
        onChange={(e) => update({ status: e.currentTarget.value })}
      >
        <option value="">Actifs</option>
        <option value="ALL">Tous statuts</option>
        <option value="INACTIVE">Inactifs</option>
        <option value="ARCHIVED">Archivés</option>
      </Select>
      {showAssignee ? (
        <Select
          defaultValue={params.get("assignee") ?? ""}
          onChange={(e) => update({ assignee: e.currentTarget.value })}
        >
          <option value="">Tous commerciaux</option>
          <option value="NONE">Non assignés</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </Select>
      ) : null}
    </form>
  );
}
