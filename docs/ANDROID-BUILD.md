# Build Android (Capacitor)

> **Non exécuté dans l'environnement de dev actuel** (pas d'Android SDK). Cette
> procédure a été validée sur le papier ; les fichiers `capacitor.config.ts`,
> les icônes et les scripts npm sont en place.

## Prérequis

- Node 22, JDK 17, **Android Studio** (SDK Platform 34, Build-Tools, Platform-Tools).
- Variables : `ANDROID_HOME`, `JAVA_HOME`.

## Étape 1 — Installer Capacitor (une fois)

```bash
npm install --save-dev @capacitor/core @capacitor/cli @capacitor/android
npm install --save-dev @capacitor/app @capacitor/splash-screen \
  @capacitor/status-bar @capacitor/push-notifications
```

`capacitor.config.ts` est déjà présent (mode *remote hosted*, `appId =
com.feredron.app`). Renseigner l'URL cible :

```bash
# staging
export CAP_SERVER_URL=https://staging.djeli.app
# ou production : export CAP_SERVER_URL=https://app.djeli.io
```

## Étape 2 — Ajouter la plateforme Android

```bash
npm run build                 # génère /public + .next
npx cap add android           # crée le dossier android/ (à committer)
npm run mobile:icons          # icônes (ou : npx @capacitor/assets generate --android)
npx cap sync android          # copie la config + les plugins
```

## Étape 3 — Configurer

- `android/app/src/main/AndroidManifest.xml` :
  - permissions **au moment de l'usage** (§49) : `RECORD_AUDIO`, `CAMERA`,
    `POST_NOTIFICATIONS` (Android 13+).
  - deep links (§40) : `intent-filter` `scheme="djeli"` +, si App Links,
    `scheme="https" host="app.djeli.io"`.
- `android/app/build.gradle` : `applicationId "com.feredron.app"`,
  `versionName` = `APP_VERSION`, `versionCode` = `BUILD_NUMBER`.
- `strings.xml` : `app_name` = « FEREDRON » (nom court store, §44).
- Splash / thème : `#1A1333` (déjà dans `capacitor.config.ts`).

## Étape 4 — Builds

```bash
# Debug APK (pilote interne, §87)
cd android && ./gradlew assembleDebug
# → android/app/build/outputs/apk/debug/app-debug.apk

# Release AAB (Play Store, §47)
./gradlew bundleRelease
# → android/app/build/outputs/bundle/release/app-release.aab
```

Signature release : keystore hors dépôt (`~/.gradle/gradle.properties` ou CI
secrets). **Ne jamais committer de keystore** (`.gitignore` couvre `*.keystore`).

## Étape 5 — Test appareil (§78)

`npx cap run android` (appareil branché, débogage USB) → tester :
micro, caméra (photo produit), **bouton retour** (§79), deep link
(`adb shell am start -a android.intent.action.VIEW -d "djeli://order/xxx"`),
notifications, reprise après arrière-plan, réseau lent (Android Studio →
Network throttling → Slow 3G).

## CI (§89)

```bash
npm ci && npm run build && npx cap sync android
cd android && ./gradlew assembleDebug
```
Publier l'APK debug comme artefact ; **pas** de publication Play Store
automatique tant que le pilote n'est pas validé.
