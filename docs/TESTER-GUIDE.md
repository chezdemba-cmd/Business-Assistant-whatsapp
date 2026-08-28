# Djeli — Guide du testeur (2 min de lecture)

Merci de tester **Djeli**, l'assistant commercial WhatsApp + IA pour les
commerçants et distributeurs.

> **Ceci est une DÉMO.** Aucune donnée réelle, aucun vrai message n'est envoyé.
> Une bannière « ENVIRONNEMENT DE DÉMONSTRATION » est affichée en permanence.

## 1. Ouvrir l'application

**URL :** `https://<votre-url-staging>` *(ex. `https://staging.djeli.app`)*

Ouvrez-la dans Chrome ou Safari, sur **ordinateur** et sur **smartphone**.

## 2. Se connecter

| Rôle | E-mail | Mot de passe |
|---|---|---|
| Patron (voit tout) | `owner@demo.djeli.test` | *(fourni séparément)* |
| Commercial (périmètre limité) | `sales@demo.djeli.test` | *(fourni séparément)* |

Les 3 autres rôles (`admin@`, `manager@`, `employee@demo.djeli.test`) sont dans
`docs/TEST-ACCOUNTS.md`.

## 3. Cinq choses à tester

1. **Tableau de bord** — regardez « À surveiller aujourd'hui » et le « Résumé du jour ».
2. **Une commande de A à Z** — Clients → créer un client → Commandes → nouvelle
   commande → confirmer → livrer → Créances → enregistrer un paiement.
3. **Djeli IA** — page « Djeli IA », posez : *« Qui me doit de l'argent ? »*,
   *« Quels produits sont presque en rupture ? »*, *« Combien ai-je encaissé
   aujourd'hui ? »*.
4. **La voix** — sur « Djeli IA », bouton micro : dictez une phrase, vérifiez le
   texte, corrigez, envoyez.
5. **Le rôle commercial** — reconnectez-vous avec `sales@…` : vous ne devez voir
   que vos clients et vos commandes.

## 4. Sur smartphone

Testez au moins : connexion, tableau de bord, clients, une fiche client,
catalogue, une fiche produit, commandes, créances, conversations, Djeli IA,
recommandations. Signalez tout ce qui déborde de l'écran ou est illisible.

## 5. Signaler un problème

- Bouton **« Donner mon avis »** en haut à droite (toutes les pages) : choisissez
  la catégorie (BUG / SUGGESTION / IA / VOICE / WHATSAPP / AUTRE) et décrivez.
- Ou la page **Support** pour une demande détaillée.
- Merci de préciser : l'écran, ce que vous attendiez, ce qui s'est passé,
  ordinateur ou téléphone, l'heure approximative.

*Détail des scénarios : `docs/TEST-SCENARIOS.md`.*
