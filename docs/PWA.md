# PWA — installation & fonctionnement

## Ce qui est en place (§27)

| Élément | Détail |
|---|---|
| Manifest | `src/app/manifest.ts` → `/manifest.webmanifest` — `display: standalone`, `start_url: /dashboard?source=pwa`, `theme_color / background_color: #1A1333`, 3 raccourcis (Djeli, Nouvelle commande, Créances) |
| Icônes | `public/icons/icon-{192,512}.png`, `maskable-512.png`, `icon.svg`, `public/apple-touch-icon.png` — générées par `npm run mobile:icons` depuis le branding |
| Service worker | `public/sw.js` (`djeli-sw-v1`) enregistré par `InstallPrompt` si `NEXT_PUBLIC_PWA_ENABLED` ≠ 0 |
| Viewport | `viewport-fit=cover`, `theme-color`, `apple-mobile-web-app-*` dans `src/app/layout.tsx` |
| Offline | route `/offline` pré-cachée, servie par le SW si le réseau est absent (§29) |
| Install | Android/Chrome : bouton « Installer Djeli » (`beforeinstallprompt`). iOS/Safari : bandeau « Partager → Sur l'écran d'accueil » |

## Stratégie de cache (§29, §56)

- **Pré-cache** : `/offline` + icônes + manifest (coquille de secours).
- **Navigations** : réseau d'abord ; hors ligne → dernière page vue, sinon `/offline`.
- **Assets `/_next/static/*` et `/icons/*`** : cache d'abord (immuables).
- **JAMAIS interceptés** : `/api/*`, `/login`, `/register`, `/invite`, `/_next/data/*`.
- **Aucune donnée métier mise en cache** : les actions exigent le réseau ;
  l'idempotence serveur (`externalMessageId`, `@@unique`, `SELECT … FOR UPDATE`)
  couvre les retours de connexion et les retries (§31).

## Web Push (§32, §33)

`public/sw.js` implémente déjà `push` + `notificationclick` (ouvre `data.url`,
un chemin interne). Pour activer :

1. Générer une paire VAPID, exposer `NEXT_PUBLIC_VAPID_PUBLIC_KEY`.
2. Ajouter un endpoint serveur d'abonnement (`PushSubscription` → table) + un
   envoi (`web-push`) déclenché par les événements métier (nouvelle commande,
   créance importante, rupture, message WhatsApp, reco critique).
3. `NEXT_PUBLIC_PUSH_NOTIFICATIONS=1`.

Types de notifications prévus : `order`, `debt`, `stock`, `whatsapp`,
`recommendation` — chacun avec un deep link (`toDeepLink(kind, id)`).

## Tester la PWA (§77)

1. `APP_ENV=staging npm run build && npm run start` derrière **HTTPS**
   (le SW ne s'enregistre pas en http hors `localhost`).
2. Chrome Android : menu ⋮ → « Installer l'application » → lancer depuis l'icône
   → vérifier le mode standalone (pas de barre d'URL), la navigation, la
   bottom-nav, le micro, la reconnexion (mode avion → message hors ligne →
   réactiver).
3. iOS Safari : Partager → « Sur l'écran d'accueil » → lancer → idem.
4. Lighthouse (onglet PWA) : installable, manifest valide, SW actif.

## Désinstaller / réinitialiser le SW

Chrome DevTools → Application → Service Workers → *Unregister* + *Clear site
data*. (Cf. l'incident « Djeli's Ticket » : un ancien SS sur la même origine
peut masquer l'app — utiliser une origine/port dédié en dev.)
