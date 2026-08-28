"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AGING_BUCKET_LABEL, AGING_BUCKETS } from "@/server/finance/payment-rules";
import { Input, Select } from "@/components/ui";

export function DebtsFilters() {
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
        gap: 10,
        marginBottom: 20,
      }}
    >
      <Input
        defaultValue={params.get("q") ?? ""}
        placeholder="Client ou référence…"
        onChange={(e) => {
          const v = e.currentTarget.value;
          const w = window as unknown as { __djDebtT?: number };
          window.clearTimeout(w.__djDebtT);
          w.__djDebtT = window.setTimeout(() => update({ q: v }), 350);
        }}
      />
      <Select
        defaultValue={params.get("overdue") ?? ""}
        onChange={(e) => update({ overdue: e.currentTarget.value })}
      >
        <option value="">Toutes les créances</option>
        <option value="1">En retard seulement</option>
      </Select>
      <Select
        defaultValue={params.get("bucket") ?? ""}
        onChange={(e) => update({ bucket: e.currentTarget.value })}
      >
        <option value="">Toutes les tranches</option>
        {AGING_BUCKETS.map((b) => (
          <option key={b} value={b}>
            {AGING_BUCKET_LABEL[b]}
          </option>
        ))}
      </Select>
      <Input
        inputMode="numeric"
        defaultValue={params.get("min") ?? ""}
        placeholder="Solde min."
        onChange={(e) => {
          const v = e.currentTarget.value.replace(/\D/g, "");
          const w = window as unknown as { __djDebtM?: number };
          window.clearTimeout(w.__djDebtM);
          w.__djDebtM = window.setTimeout(() => update({ min: v }), 350);
        }}
      />
    </form>
  );
}
