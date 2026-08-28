"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ORDER_STATUS_LABEL, ORDER_STATUSES } from "@/server/orders/order-status";
import { PAYMENT_STATUS_LABEL, ORDER_SOURCE_LABEL } from "@/lib/labels";
import { Input, Select } from "@/components/ui";

export function OrdersFilters() {
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
        gridTemplateColumns: "1.4fr 1fr 1fr 1fr 1fr",
        gap: 10,
        marginBottom: 20,
      }}
    >
      <Input
        defaultValue={params.get("q") ?? ""}
        placeholder="Référence ou client…"
        onChange={(e) => {
          const v = e.currentTarget.value;
          const w = window as unknown as { __djOrdT?: number };
          window.clearTimeout(w.__djOrdT);
          w.__djOrdT = window.setTimeout(() => update({ q: v }), 350);
        }}
      />
      <Select
        defaultValue={params.get("status") ?? ""}
        onChange={(e) => update({ status: e.currentTarget.value })}
      >
        <option value="">Vue Kanban</option>
        {ORDER_STATUSES.map((s) => (
          <option key={s} value={s}>
            {ORDER_STATUS_LABEL[s]}
          </option>
        ))}
      </Select>
      <Select
        defaultValue={params.get("payment") ?? ""}
        onChange={(e) => update({ payment: e.currentTarget.value })}
      >
        <option value="">Tous paiements</option>
        {Object.entries(PAYMENT_STATUS_LABEL).map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </Select>
      <Select
        defaultValue={params.get("source") ?? ""}
        onChange={(e) => update({ source: e.currentTarget.value })}
      >
        <option value="">Toutes sources</option>
        {Object.entries(ORDER_SOURCE_LABEL).map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </Select>
      <Input
        type="date"
        defaultValue={params.get("from") ?? ""}
        onChange={(e) => update({ from: e.currentTarget.value })}
        aria-label="Depuis"
      />
    </form>
  );
}
