# Comptes de test — STAGING / DÉMO

Organisation : **DJELI DEMO COMMERCE** (`isDemo = true`). Aucune donnée réelle.
Prix en FCFA **fictifs** (pas des prix officiels).

## Identifiants

| Rôle | E-mail | Mot de passe |
|---|---|---|
| OWNER (+ opérateur `/admin`) | `owner@demo.djeli.test` | `$DEMO_OWNER_PASSWORD` |
| ADMIN | `admin@demo.djeli.test` | `$DEMO_ADMIN_PASSWORD` |
| MANAGER | `manager@demo.djeli.test` | `$DEMO_MANAGER_PASSWORD` |
| SALES | `sales@demo.djeli.test` | `$DEMO_SALES_PASSWORD` |
| EMPLOYEE | `employee@demo.djeli.test` | `$DEMO_EMPLOYEE_PASSWORD` |

Si les variables `DEMO_*_PASSWORD` ne sont pas définies, le seed utilise le
fallback **`demo-djeli-staging`** (uniquement hors production).

## Ce que chaque rôle doit voir

| Domaine | OWNER | ADMIN | MANAGER | SALES | EMPLOYEE |
|---|---|---|---|---|---|
| Tableau de bord | ✅ complet | ✅ complet | ✅ complet | ✅ (son périmètre) | ✅ limité |
| Catalogue / stock | ✅ lecture+écriture | ✅ | ✅ | 👁 lecture | 👁 lecture |
| Clients | ✅ tous | ✅ tous | ✅ tous | ✅ **assignés uniquement** | 👁 lecture |
| Commandes | ✅ toutes | ✅ toutes | ✅ toutes | ✅ **créées / clients assignés** | 👁 lecture |
| Créances / paiements | ✅ | ✅ | ✅ | ✅ (son périmètre) | ❌ |
| Conversations / Djeli IA | ✅ | ✅ | ✅ | ✅ | 👁 conversations |
| Automatisations / Marketing | ✅ | ✅ | ✅ (gérer) / 👁 envoi | ❌ | ❌ |
| Recommandations | ✅ toutes | ✅ toutes | ✅ toutes | ✅ **son périmètre** | ✅ son périmètre |
| Membres & rôles / Paramètres / Offre | ✅ | ✅ | 👁 | ❌ | ❌ |
| Console opérateur `/admin` | ✅ (compte OWNER démo, `isSuperAdmin`) | ❌ | ❌ | ❌ | ❌ |

Clients assignés au commercial `sales@` : Boutique Kéné, Alimentation Sabali,
Restaurant Teriya, Boutique Djoliba, Boutique Yiriwa.

## Providers (staging)

`WHATSAPP_PROVIDER`, `AI_PROVIDER`, `VOICE_PROVIDER` peuvent être `mock` ou
réels. En `mock`, tous les parcours restent testables (réponses déterministes).
Le mode courant est visible sur `GET /api/health` (`providers`).
