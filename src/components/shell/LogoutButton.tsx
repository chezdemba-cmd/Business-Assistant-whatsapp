"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { logoutAction } from "@/server/actions/auth.actions";

export function LogoutButton() {
  const router = useRouter();
  const [state, action] = useActionState(logoutAction, null);

  useEffect(() => {
    if (state?.ok) router.replace(state.data.redirectTo);
  }, [state, router]);

  return (
    <form action={action}>
      <button
        type="submit"
        className="dj-btn dj-btn--outline"
        style={{ height: 40, padding: "0 16px", fontSize: 13 }}
      >
        Se déconnecter
      </button>
    </form>
  );
}
