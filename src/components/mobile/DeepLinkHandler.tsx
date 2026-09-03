"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { parseDeepLink } from "@/lib/deep-links";

/**
 * Ouverture par deep link dans le shell natif (§40, §41). Sur le web pur, ce
 * composant ne fait rien (l'API `@capacitor/app` est absente). Aucune
 * navigation arbitraire : seuls les chemins internes validés par
 * `parseDeepLink` sont suivis.
 */
export function DeepLinkHandler() {
  const router = useRouter();

  useEffect(() => {
    const w = window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } };
    if (!w.Capacitor?.isNativePlatform?.()) return;

    let cleanup: (() => void) | undefined;
    (async () => {
      try {
        const mod = (await import(
          /* webpackIgnore: true */ "@capacitor/app" as string
        )) as { App: { addListener: (e: string, cb: (d: { url: string }) => void) => Promise<{ remove: () => void }> } };
        const sub = await mod.App.addListener("appUrlOpen", (data) => {
          const parsed = parseDeepLink(data.url);
          if (parsed) router.push(parsed.path);
        });
        cleanup = () => sub.remove();
      } catch {
        /* @capacitor/app non disponible — ignore */
      }
    })();

    return () => cleanup?.();
  }, [router]);

  return null;
}
