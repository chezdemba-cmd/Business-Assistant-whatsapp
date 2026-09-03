# Architecture mobile — Phase 9

## Principe (§1)

Un seul backend, une seule source de vérité : l'app **Next.js existante**.
Le mobile ne duplique **aucune** logique métier.

```
Backend Djeli (Next API / Server Actions / Prisma / Postgres)
        │
        ├── Web responsive (mobile-first)
        ├── PWA installable (manifest + service worker)
        └── Shell natif Capacitor (Android / iOS) → WebView → même app hébergée
```

## Décision : Capacitor (§34, §P)

| Option | Verdict |
|---|---|
| **A. Capacitor** | ✅ **Retenu.** Enrobe l'app web existante. Zéro réécriture UI. Accès natif (caméra, micro, push, deep links) via plugins. Mises à jour instantanées (mode *remote*). Session/cookies identiques au web. |
| B. React Native / Expo | ❌ Imposerait de réécrire toute l'UI (18 écrans, formulaires, tables) en composants natifs + une couche API dédiée. Coût disproportionné pour un pilote. |
| C. PWA seule | ⚠️ Bon socle (fait dans cette phase) mais : pas de présence stores, push iOS limité, pas de deep links `djeli://`, install iOS peu découvrable. La PWA reste le **socle** ; Capacitor ajoute la couche stores. |

Le projet est un **Next App Router** : Capacitor s'y intègre sans friction.

## Stratégie d'URL (§37)

**Remote hosted** (`server.url` dans `capacitor.config.ts`), pas d'assets bundlés :

- **Pour** : correctifs sans re-soumission store ; une seule build web à maintenir ;
  cookies de session HttpOnly partagés avec le web ; CSP/headers identiques.
- **Contre** : nécessite une connexion au premier lancement (cohérent avec §29 —
  les actions métier exigent le réseau de toute façon).
- **Sécurité** : `server.allowNavigation` limité à l'hôte de l'app ;
  `limitsNavigationsToAppBoundDomains` (iOS). Toute autre URL → navigateur
  système via l'allowlist `src/lib/native-allowlist.ts` (§83).

`webDir: "public"` sert de fallback minimal si `server.url` est vide (build local).

## Auth en WebView (§38, §39)

- Les cookies de session (`dj_session`, JWT HS256 HttpOnly) fonctionnent en
  WebView **remote** comme dans un navigateur : rien à changer.
- **Cookies `Secure`** : posés seulement si `NODE_ENV=production`. En prod
  l'app est en HTTPS → OK. En dev sur IP LAN (`http://192.168.x.x`), utiliser
  `APP_ENV=staging` (cookies non `Secure`) — voir §92.
- Pas de token mobile dédié pour l'instant (pas nécessaire en mode remote). Si
  un jour requis : stockage **Keychain (iOS) / Keystore (Android)** via
  `@capacitor/preferences` chiffré ou `capacitor-secure-storage-plugin` —
  **jamais** un simple `localStorage` pour un secret.

## Session expirée / resume (§80, §81)

- Session expirée → `getCurrentUser` renvoie null → redirection `/login`
  (déjà géré, écran non cassé).
- Retour d'arrière-plan : la WebView recharge la route courante ; les données
  server-rendered sont refetchées. Pas de cache métier persistant (§56 : seuls
  la coquille et les assets immuables sont mis en cache).

## Composants Phase 9

| Fichier | Rôle |
|---|---|
| `src/app/manifest.ts` | Manifest PWA (route Next) |
| `public/sw.js` | Service worker : shell + `/offline` + network-first + Web Push |
| `src/components/mobile/InstallPrompt.tsx` | Enregistre le SW + invite install (Android) / guide iOS |
| `src/components/mobile/NetworkBanner.tsx` | Bandeau connexion perdue/rétablie (`src/lib/network-state.ts`) |
| `src/components/mobile/DeepLinkHandler.tsx` | `appUrlOpen` natif → `parseDeepLink` → route interne |
| `src/components/mobile/QuickActions.tsx` | Actions rapides d'accueil (§9) |
| `src/components/shell/MobileNav.tsx` | Bottom-nav (`src/lib/mobile-nav.ts`) |
| `src/app/(app)/menu/page.tsx` | Feuille « Plus » |
| `src/lib/deep-links.ts` | Parse/format `djeli://…` — pur, testé |
| `src/lib/native-allowlist.ts` | Classe une URL : webview / navigateur / bloqué — pur, testé |
| `src/lib/voice-states.ts` | Machine à états Voice — pur, testé |
| `src/lib/flags.ts` | Feature flags mobile — pur, testé |
| `capacitor.config.ts` | Config Capacitor (type local, aucun import) |
| `scripts/gen-icons.mjs` | Génère les icônes PNG/SVG depuis le branding |

## Ce qui n'est PAS fait (§99)

Nouveau backend, base mobile locale, synchronisation offline complète, GPS
livraison temps réel, Mobile Money, refonte desktop, nouveau système IA.
