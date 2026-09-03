# Matrice de QA mobile (§97)

Statut : `PASS` / `FAIL` / `N/T` (non testé — attend appareil/URL HTTPS).
Les tests unitaires purs (deep links, allowlist, nav, voice states, flags,
network) sont **verts en CI** (`npm test`). Les colonnes ci-dessous couvrent le
rendu et l'intégration appareil.

## Appareils cibles (§3, §75)

| Device | OS | Largeur | Priorité |
|---|---|---|---|
| Petit Android (ex. Galaxy A0x) | Android 12+ | 360 px | ⬤ pilote |
| Android moyen (ex. Redmi Note) | Android 13+ | 393 px | ⬤ pilote |
| Android récent (Pixel 8) | Android 14 | 412 px | ⬤ pilote |
| iPhone SE | iOS 16+ | 375 px | ○ |
| iPhone 13/14/15 | iOS 17 | 390 px | ○ |
| iPhone 15 Pro Max | iOS 17 | 430 px | ○ |
| Tablette 10" | — | 800 px+ | ○ |

## Grille

| Device | OS | Largeur | Test | Résultat | Issue |
|---|---|---|---|---|---|
| — | — | 360 | login lisible, champs 44px, pas de zoom focus | N/T | |
| — | — | 360 | bottom-nav visible, 5 entrées, Djeli central | N/T | |
| — | — | 360 | dashboard : quick actions + « À surveiller » + résumé | N/T | |
| — | — | 375 | commandes en **cartes** (pas de scroll horizontal) | N/T | |
| — | — | 375 | clients en cartes + recherche accessible | N/T | |
| — | — | 375 | stock : badges OK/FAIBLE/RUPTURE, dispo lisible | N/T | |
| — | — | 375 | créances : cartes + tranches + « Préparer une relance » | N/T | |
| — | — | 375 | fiche client : boutons Appeler / WhatsApp / Itinéraire | N/T | |
| — | — | 390 | nouvelle commande : flux utilisable au pouce | N/T | |
| — | — | 390 | conversations : bulles, input, scroll | N/T | |
| — | — | 390 | Djeli IA : accueil + suggestions + micro | N/T | |
| — | — | 390 | Voice : idle→recording→transcription→texte→envoi | N/T | |
| — | — | 390 | Voice faible confiance : « J'ai compris : … Oui / Modifier » | N/T | |
| — | — | 430 | recommandations : carte URGENT → liste | N/T | |
| — | — | any | mode avion → « Connexion perdue » ; retour → « rétablie » | N/T | |
| — | — | any | réseau Slow 3G : skeletons, pas d'écran blanc | N/T | |
| Android | 12+ | — | permission micro demandée à l'usage + texte d'explication | N/T | |
| Android | 12+ | — | photo produit : capture + compression + aperçu | N/T | |
| Android | 12+ | — | bouton retour = historique WebView, ne quitte pas l'app | N/T | |
| Android | 12+ | — | deep link `djeli://order/<id>` ouvre la commande | N/T | |
| Android | 13+ | — | notification push → tap → entité concernée | N/T | |
| Android | any | — | reprise après arrière-plan : données rafraîchies | N/T | |
| iOS | 16+ | — | « Sur l'écran d'accueil » → standalone | N/T | |
| iOS | 16+ | — | micro / caméra : prompt système + description | N/T | |
| iOS | 17 | — | deep link `djeli://` + Universal Link | N/T | |
| any | — | — | session expirée → retour /login propre | N/T | |
| any | — | — | XSS / deep link invalide / URL externe bloquée en WebView | N/T | |
| any | — | — | Lighthouse PWA : installable + SW + manifest | N/T | |

## Analytics à instrumenter (§85)

`mobile sessions`, `PWA installs` (`appinstalled`), `voice usage`,
`orders created (source=pwa)`, `crashes` (error boundary + Sentry) — **sans PII**.
Le `start_url` porte `?source=pwa` et les raccourcis `?source=pwa-shortcut` pour
la ventilation.
