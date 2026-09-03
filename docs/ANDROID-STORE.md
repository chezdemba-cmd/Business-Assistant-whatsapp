# Google Play — métadonnées (§70-74)

> À finaliser avant soumission. Aucune capture d'écran fausse n'est fournie —
> à produire depuis l'app réelle (§69).

## Fiche

| Champ | Valeur |
|---|---|
| Nom de l'application | **FEREDRON** |
| Package | `com.feredron.app` |
| Catégorie | Entreprise / Productivité |
| Description courte (≤ 80) | Gérez commandes, stock, clients et créances — et parlez à Djeli. |
| Description longue | Copilote commercial pour commerçants, grossistes et distributeurs d'Afrique de l'Ouest. Catalogue, stock, clients, commandes, créances et paiements ; conversations WhatsApp Business ; assistant Djeli IA et commande vocale (français, bambara, code-switching) ; recommandations proactives (stock faible, créances en retard, clients inactifs). Une seule app, sur votre téléphone. |
| Langue par défaut | Français |
| Pays cible | Mali, Sénégal, Côte d'Ivoire (extensible) |
| Site web | https://app.djeli.io |
| E-mail support | via la page Support de l'app |
| Politique de confidentialité (URL) | https://app.djeli.io/privacy (§73) |

## Captures d'écran nécessaires (§69) — téléphone, 1080×1920

1. Tableau de bord (« À surveiller aujourd'hui » + résumé du jour)
2. Djeli IA — écran d'accueil + suggestions
3. Djeli Voice — enregistrement / transcription
4. Nouvelle commande
5. Stock (badges OK / FAIBLE / RUPTURE)
6. Créances (tranches d'ancienneté)
7. Conversation WhatsApp

## Autorisations déclarées (§72 — Data safety)

| Permission | Usage | Moment |
|---|---|---|
| `RECORD_AUDIO` | Commande vocale Djeli (uniquement quand l'utilisateur parle, §51) | à l'usage |
| `CAMERA` | Photo de produit | à l'usage |
| `POST_NOTIFICATIONS` | Alertes (commande, créance, rupture, message) | à l'usage |
| `INTERNET` | L'app est connectée (source de vérité serveur) | — |

## Data safety (§71, §72)

| Donnée collectée | Finalité | Partagée ? | Chiffrée en transit | Suppression |
|---|---|---|---|---|
| Compte (nom, e-mail, téléphone) | Authentification | Non | Oui | Sur demande (§74) |
| Données d'entreprise (produits, stock, commandes) | Fourniture du service | Non | Oui | Export + suppression (Phase 8) |
| Données clients finaux (saisies par le commerçant) | Fourniture du service (le commerçant est responsable de traitement) | Non | Oui | Idem |
| Transcription vocale | Comprendre la requête ; l'audio **n'est pas conservé** | Sous-traitant STT uniquement | Oui | Transcription supprimable |
| Analytics d'usage | Amélioration produit — **sans PII** | Non | Oui | — |

**Suppression de compte** (§74) : réutilise la « demande de suppression
d'organisation » (Phase 8) — période de grâce puis purge/anonymisation.
URL de suppression à exposer : `https://app.djeli.io/settings` (section Données).

## Contenu / classification

- Public visé : professionnels (18+).
- Pas de contenu généré par les utilisateurs public, pas de publicité, pas
  d'achats intégrés dans l'app (facturation SaaS hors store — §18 Phase 8).
