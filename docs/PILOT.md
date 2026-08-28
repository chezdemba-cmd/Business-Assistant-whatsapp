# Pilote — 5 à 10 commerçants (§59-62)

## Outillage

- Flag `Organization.isPilot` (posé depuis `/admin/<org>`) → badge « Pilote »
  dans l'app, support renforcé, incidents techniques listés dans la console.
- `Organization.isDemo` → organisation de démonstration, **jamais** mélangée à
  la prod (ne compte pas dans les KPI d'activation « réelle » côté GTM).
- Console opérateur `/admin` : offre, statut d'abonnement, usage, statut
  WhatsApp, volumétrie, incidents. **Aucun accès** aux conversations, notes,
  messages.
- Support intégré : `/support` (ticket) + bouton « Donner mon avis » (feedback
  rapide catégorisé, avec la page d'origine).

## Checklist par commerce (§60)

- [ ] Organisation créée, `isPilot` activé
- [ ] Utilisateurs invités (rôles OWNER / MANAGER / SALES / EMPLOYEE)
- [ ] Produits saisis (≥ 10)
- [ ] Stock initialisé
- [ ] Clients importés / créés
- [ ] WhatsApp Business connecté (`docs/WHATSAPP-SETUP.md`)
- [ ] Commandes réelles créées, crédit + paiements testés
- [ ] Djeli IA essayée (assistant `/ai` + réponses AUTO)
- [ ] Djeli Voice testée (message vocal → transcription)
- [ ] Premier feedback recueilli

## KPI pilote (§61)

Source : `/admin/analytics` (`getActivationBreakdown`, `getPlatformUsage`) + audit.

| KPI | Définition |
|---|---|
| Activation | org avec produits + client + commande + WhatsApp connecté + IA utilisée (§46) |
| Commandes créées | `orders` par semaine |
| Conversations traitées | `conversations` + messages sortants |
| Taux de réponse IA | réponses AUTO / messages entrants éligibles |
| Handoff | `AI_HANDOFF` / total runs auto |
| Corrections Voice | `VOICE_TRANSCRIPTION_CORRECTED` / transcriptions |
| Recommandations suivies | recommandations `ACTIONED` / `ACTION_PREPARED` |
| Rétention hebdo | orgs actives semaine N ∩ semaine N+1 |
| Temps gagné estimé | qualitatif (feedback + entretiens) |

## Go-to-market (préparation, pas de site marketing)

- Grille tarifaire à dériver de `PLAN_DEFS` (STARTER / BUSINESS / PRO) — prix à
  fixer selon le marché (`priceMonthly` actuellement 0 = à définir).
- Les quotas d'usage réels sont configurables sans redéploiement
  (`Plan.limits` / `Subscription.limitOverrides`).
