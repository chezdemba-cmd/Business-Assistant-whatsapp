"use client";

import { useEffect, useRef } from "react";
import { markConversationReadAction } from "@/server/actions/whatsapp.actions";

/** Marque la conversation comme lue à l'ouverture du fil (unreadCount → 0). */
export function MarkReadOnView({
  organizationId,
  conversationId,
  unreadCount,
}: {
  organizationId: string;
  conversationId: string;
  unreadCount: number;
}) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current || unreadCount <= 0) return;
    done.current = true;
    const fd = new FormData();
    fd.set("organizationId", organizationId);
    fd.set("conversationId", conversationId);
    void markConversationReadAction(null, fd);
  }, [organizationId, conversationId, unreadCount]);
  return null;
}
