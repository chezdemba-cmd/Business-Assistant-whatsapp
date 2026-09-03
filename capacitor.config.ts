/**
 * Configuration Capacitor (§34, §35, §37).
 *
 * Choix : **Capacitor** (shell natif autour du web Next existant) — voir
 * docs/MOBILE-ARCHITECTURE.md pour la justification vs React Native / PWA seule.
 *
 * Stratégie d'URL (§37) : **remote hosted** — la WebView charge l'app déployée
 * (STAGING_API_URL / PRODUCTION_API_URL) plutôt que des assets bundlés. Avantages :
 * mises à jour instantanées sans repasser par les stores, une seule source de
 * vérité, cookies de session identiques au web. `server.url` est renseigné au
 * build via l'environnement.
 *
 * Le type est défini localement pour que `tsc` passe même si `@capacitor/cli`
 * n'est pas encore installé (voir docs/ANDROID-BUILD.md étape 1).
 */
type CapacitorConfig = {
  appId: string;
  appName: string;
  webDir: string;
  server?: {
    url?: string;
    cleartext?: boolean;
    androidScheme?: string;
    allowNavigation?: string[];
  };
  android?: Record<string, unknown>;
  ios?: Record<string, unknown>;
  plugins?: Record<string, unknown>;
};

const APP_ID = process.env.MOBILE_APP_ID || "com.feredron.app";
const APP_NAME = "FEREDRON";

/** URL de l'app hébergée que la WebView doit charger. */
const REMOTE_URL =
  process.env.CAP_SERVER_URL ||
  process.env.PRODUCTION_API_URL ||
  process.env.STAGING_API_URL ||
  ""; // vide → build local (assets `webDir`)

const config: CapacitorConfig = {
  appId: APP_ID,
  appName: APP_NAME,
  // Capacitor exige un index.html local même en mode remote. Cette coquille
  // affiche une erreur explicite si aucune URL HTTPS n'a été fournie au build.
  webDir: "native-shell",
  server: REMOTE_URL
    ? {
        url: REMOTE_URL,
        cleartext: REMOTE_URL.startsWith("http://"),
        androidScheme: "https",
        // Allowlist WebView (§83) : uniquement l'origine de l'app.
        allowNavigation: [new URL(REMOTE_URL).host],
      }
    : { androidScheme: "https" },
  android: {
    // Le bouton retour Android suit l'historique de la WebView (§79).
    allowMixedContent: false,
  },
  ios: {
    contentInset: "always",
    limitsNavigationsToAppBoundDomains: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: "#03172D",
      showSpinner: false,
    },
    // @capacitor/push-notifications : activé si NEXT_PUBLIC_PUSH_NOTIFICATIONS=1
    PushNotifications: { presentationOptions: ["badge", "sound", "alert"] },
  },
};

export default config;
