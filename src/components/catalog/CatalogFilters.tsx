"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input, Select } from "@/components/ui";

export function CatalogFilters({
  categories,
}: {
  categories: Array<{ id: string; name: string }>;
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
        gridTemplateColumns: "1fr 200px 200px",
        gap: 12,
        marginBottom: 20,
      }}
    >
      <Input
        name="q"
        defaultValue={params.get("q") ?? ""}
        placeholder="Rechercher : nom, SKU, code-barres, fournisseur…"
        onChange={(e) => {
          const v = e.currentTarget.value;
          window.clearTimeout(
            (window as unknown as { __djSearchT?: number }).__djSearchT,
          );
          (window as unknown as { __djSearchT?: number }).__djSearchT =
            window.setTimeout(() => update({ q: v }), 350);
        }}
      />
      <Select
        defaultValue={params.get("category") ?? ""}
        onChange={(e) => update({ category: e.currentTarget.value })}
      >
        <option value="">Toutes catégories</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>
      <Select
        defaultValue={params.get("state") ?? ""}
        onChange={(e) => update({ state: e.currentTarget.value })}
      >
        <option value="">Tous les états</option>
        <option value="IN_STOCK">En stock</option>
        <option value="LOW_STOCK">Stock faible</option>
        <option value="OUT_OF_STOCK">Rupture</option>
        <option value="ARCHIVED">Archivés</option>
      </Select>
    </form>
  );
}
