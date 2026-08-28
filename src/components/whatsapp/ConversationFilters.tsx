"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  CONVERSATION_MODES,
  CONVERSATION_MODE_LABEL,
} from "@/server/whatsapp/conversation-mode";
import { Input, Select } from "@/components/ui";

export function ConversationFilters({ canFilterAssignee }: { canFilterAssignee: boolean }) {
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
        gridTemplateColumns: canFilterAssignee
          ? "1.6fr 1fr 1fr 1fr"
          : "1.6fr 1fr 1fr",
        gap: 10,
        marginBottom: 18,
      }}
    >
      <Input
        defaultValue={params.get("q") ?? ""}
        placeholder="Client, téléphone ou message…"
        onChange={(e) => {
          const v = e.currentTarget.value;
          const w = window as unknown as { __djConvT?: number };
          window.clearTimeout(w.__djConvT);
          w.__djConvT = window.setTimeout(() => update({ q: v }), 350);
        }}
      />
      <Select
        defaultValue={params.get("mode") ?? ""}
        onChange={(e) => update({ mode: e.currentTarget.value })}
      >
        <option value="">Tous les modes</option>
        {CONVERSATION_MODES.map((m) => (
          <option key={m} value={m}>
            {CONVERSATION_MODE_LABEL[m]}
          </option>
        ))}
      </Select>
      <Select
        defaultValue={params.get("unread") ?? ""}
        onChange={(e) => update({ unread: e.currentTarget.value })}
      >
        <option value="">Lues et non lues</option>
        <option value="1">Non lues seulement</option>
      </Select>
      {canFilterAssignee ? (
        <Select
          defaultValue={params.get("assigned") ?? ""}
          onChange={(e) => update({ assigned: e.currentTarget.value })}
        >
          <option value="">Toutes assignations</option>
          <option value="me">Assignées à moi</option>
          <option value="none">Non assignées</option>
        </Select>
      ) : null}
    </form>
  );
}
