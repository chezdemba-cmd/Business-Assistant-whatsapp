# Build iOS (Capacitor)

> **Nécessite macOS + Xcode** — non réalisable dans l'environnement de dev
> actuel. Procédure documentée ; config, icônes et scripts en place.

## Prérequis

- macOS, **Xcode 15+**, CocoaPods (`sudo gem install cocoapods`).
- Compte Apple Developer (pour signature + TestFlight, §88).

## Étape 1 — Installer Capacitor iOS

```bash
npm install --save-dev @capacitor/core @capacitor/cli @capacitor/ios
npm install --save-dev @capacitor/app @capacitor/splash-screen \
  @capacitor/status-bar @capacitor/push-notifications
export CAP_SERVER_URL=https://staging.djeli.app   # ou production
```

## Étape 2 — Ajouter la plateforme

```bash
npm run build
npx cap add ios                 # crée ios/ (à committer)
npm run mobile:icons
npx cap sync ios
npx cap open ios                # ouvre Xcode
```

## Étape 3 — Configurer dans Xcode

- **Bundle Identifier** : `com.feredron.app` (§45).
- **Display Name** : « FEREDRON » (§44). Version = `APP_VERSION`,
  Build = `BUILD_NUMBER` (§46).
- **Info.plist** — descriptions de permission (affichées à la demande, §49-50) :
  - `NSMicrophoneUsageDescription` :
    « Djeli utilise le micro uniquement lorsque vous lui parlez. »
  - `NSCameraUsageDescription` :
    « Djeli utilise l'appareil photo pour ajouter une photo à un produit. »
  - `NSPhotoLibraryAddUsageDescription` (si enregistrement d'image).
- **Capabilities** : Push Notifications, Background Modes → *Remote notifications*
  (si `NEXT_PUBLIC_PUSH_NOTIFICATIONS=1`).
- **Associated Domains** (deep links §40) : `applinks:app.djeli.io` +, dans le
  code, gérer le scheme `djeli://` (`CFBundleURLTypes`).
- **App Transport Security** : HTTPS only (l'app est en `server.url` HTTPS).
  `limitsNavigationsToAppBoundDomains = YES` (déjà dans `capacitor.config.ts`).
- Splash : `#1A1333` (LaunchScreen).

## Étape 4 — Build & TestFlight (§88)

1. Xcode → *Any iOS Device* → Product → Archive.
2. Organizer → Distribute App → App Store Connect → Upload.
3. App Store Connect → TestFlight → ajouter les testeurs internes (5 iPhone :
   SE/petit, 13/14/15, Pro Max — §75).
4. Ne **pas** soumettre à la revue App Store tant que le pilote n'est pas validé.

## Étape 5 — Tests appareil (§75, §76, §77)

Safari iOS + app installée : micro, caméra, retour geste, deep link
(`xcrun simctl openurl booted "djeli://customer/xxx"`), notifications, reprise,
session expirée, réseau lent (Réglages → Développeur → Network Link Conditioner
→ 3G).
