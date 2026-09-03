import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/brand";

/**
 * Manifest PWA (§27). Servi sur /manifest.webmanifest. `display: standalone`
 * pour un rendu type application ; `start_url` sur le tableau de bord.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${BRAND.name} — ${BRAND.tagline}`,
    short_name: BRAND.name,
    description: BRAND.description,
    id: "/",
    start_url: "/dashboard?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: BRAND.colors.navy,
    theme_color: BRAND.colors.green,
    lang: "fr",
    dir: "ltr",
    categories: ["business", "productivity", "finance"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Parler à FEREDRON", url: "/ai?source=pwa-shortcut", short_name: "FEREDRON IA" },
      { name: "Nouvelle commande", url: "/orders/new?source=pwa-shortcut", short_name: "Commande" },
      { name: "Créances", url: "/debts?source=pwa-shortcut", short_name: "Créances" },
    ],
  };
}
