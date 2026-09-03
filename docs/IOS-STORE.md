# App Store — métadonnées (§70-74)

> À finaliser avant soumission. Captures à produire depuis l'app réelle (§69).

## Fiche App Store Connect

| Champ | Valeur |
|---|---|
| Nom | **FEREDRON** |
| Sous-titre (≤ 30) | Commerce, WhatsApp & Djeli IA |
| Bundle ID | `com.feredron.app` |
| Catégorie primaire | Business |
| Catégorie secondaire | Productivity |
| Description | Copilote commercial pour commerçants, grossistes et distributeurs : catalogue, stock, clients, commandes, créances et paiements ; conversations WhatsApp Business ; assistant Djeli IA et commande vocale (français / bambara / mixte) ; recommandations proactives. |
| Mots-clés | commerce, grossiste, stock, créances, whatsapp, assistant, vocal, bambara |
| URL marketing | https://app.djeli.io |
| URL support | https://app.djeli.io/support |
| Politique de confidentialité | https://app.djeli.io/privacy (§73 — obligatoire) |
| Âge | 4+ (outil professionnel, pas de contenu sensible) |

## Captures nécessaires (§69)

6,7" (iPhone 15 Pro Max) **et** 6,5" : mêmes 7 écrans que Play
(dashboard, Djeli IA, Voice, nouvelle commande, stock, créances, WhatsApp).

## App Privacy (Nutrition Label, §71)

| Type de données | Lié à l'identité ? | Utilisé pour le suivi ? | Finalité |
|---|---|---|---|
| Coordonnées (nom, e-mail, téléphone) | Oui | Non | Fonctionnalité de l'app |
| Contenu utilisateur (données métier + clients saisis) | Oui | Non | Fonctionnalité de l'app |
| Audio (voix) | Non — **audio non stocké**, transcription éphémère | Non | Fonctionnalité de l'app |
| Données d'utilisation | Non | Non | Analytics (sans PII) |
| Diagnostics (crash) | Non | Non | Amélioration de l'app |

Aucune donnée n'est utilisée pour le **suivi publicitaire**.

## Permissions (Info.plist — affichées à la demande, §49-50)

- `NSMicrophoneUsageDescription` : « Djeli utilise le micro uniquement lorsque
  vous lui parlez. »
- `NSCameraUsageDescription` : « Djeli utilise l'appareil photo pour ajouter une
  photo à un produit. »
- `NSPhotoLibraryAddUsageDescription` (si sauvegarde d'image).

## Suppression de compte (§74)

Apple exige un moyen de supprimer le compte depuis l'app : lien vers
`Réglages → Données de l'entreprise → Demander la suppression` (réutilise le
mécanisme Phase 8, période de grâce + purge).

## Notes pour la revue

- L'app charge une application web hébergée (Capacitor, mode *remote*) — normal
  pour un outil métier connecté ; toutes les fonctions sont accessibles avec le
  compte de démonstration fourni dans les notes de revue.
- Compte de test à fournir : `owner@demo.djeli.test` (+ mot de passe dans les
  notes de revue, jamais dans la fiche publique).
