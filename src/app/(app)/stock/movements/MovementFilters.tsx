"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  MOVEMENT_TYPES,
  MOVEMENT_TYPE_LABEL,
} from "@/server/stock/movement-rules";
import { Select, Input } from "@/components/ui";

export function MovementFilters({
  products,
}: {
  products: Array<{ id: string; name: string; sku: string }>;
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
        gridTemplateColumns: "1.4fr 1fr 1fr 1fr",
        gap: 12,
        marginBottom: 20,
      }}
    >
      <Select
        defaultValue={params.get("product") ?? ""}
        onChange={(e) => update({ product: e.currentTarget.value })}
      >
        <option value="">Tous les produits</option>
        {products.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} — {p.sku}
          </option>
        ))}
      </Select>
      <Select
        defaultValue={params.get("type") ?? ""}
        onChange={(e) => update({ type: e.currentTarget.value })}
      >
        <option value="">Tous les types</option>
        {MOVEMENT_TYPES.map((t) => (
          <option key={t} value={t}>
            {MOVEMENT_TYPE_LABEL[t]}
          </option>
        ))}
      </Select>
      <Input
        type="date"
        defaultValue={params.get("from") ?? ""}
        onChange={(e) => update({ from: e.currentTarget.value })}
        aria-label="Depuis"
      />
      <Input
        type="date"
        defaultValue={params.get("to") ?? ""}
        onChange={(e) => update({ to: e.currentTarget.value })}
        aria-label="Jusqu'au"
      />
    </form>
  );
}
