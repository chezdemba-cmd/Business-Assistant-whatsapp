# Scénarios de test — STAGING

Environnement démo, aucune donnée réelle. Bannière « ENVIRONNEMENT DE
DÉMONSTRATION » visible en permanence.

---

## Parcours 1 — Cycle commerce complet (compte OWNER)

1. Se connecter avec `owner@demo.djeli.test`.
2. **Catalogue** → vérifier ~20 produits, catégories, prix FCFA.
3. **Stock** → repérer : produits en stock normal, **stock faible** (badge orange),
   **rupture** (badge rouge), produits avec **réservations** (disponible < physique).
4. **Clients** → créer un nouveau client (nom, téléphone, zone).
5. **Commandes → Nouvelle** → choisir ce client, ajouter 2 lignes, enregistrer.
6. Ouvrir la commande → **Confirmer**.
7. Retour **Stock** → vérifier que la quantité réservée a augmenté.
8. Commande → **Préparer** → **Livrer** (ou passer directement à Livrée).
9. Vérifier le mouvement de stock `SALE` sur les produits de la commande.
10. Si la commande est à crédit → **Créances** : la nouvelle créance apparaît.
11. Ouvrir la créance → **Enregistrer un paiement** partiel, puis le solde →
    statut passe à *Payée*.

**Attendu** : total commande = somme des lignes ; `montant payé` = somme des
paiements confirmés ; stock physique cohérent.

---

## Parcours 2 — Djeli IA (compte OWNER ou MANAGER)

Aller sur **Djeli IA** et poser, une par une :

- « Quels produits sont presque en rupture ? »
- « Qui me doit de l'argent ? »
- « Combien ai-je encaissé aujourd'hui ? »
- « Quelles commandes dois-je traiter ? »
- « Quels clients sont inactifs ? »

**Attendu** : les chiffres correspondent aux écrans Stock / Créances / Dashboard
(ils viennent des données démo, pas d'un texte inventé). En `AI_PROVIDER=mock`,
les réponses sont déterministes mais restent branchées sur les vraies données.

---

## Parcours 3 — Djeli Voice (compte OWNER)

1. Sur **Djeli IA**, cliquer le bouton **micro**.
2. Autoriser le micro, dicter une courte phrase, arrêter.
3. Vérifier : le **texte transcrit** s'affiche dans le champ, éditable.
4. Corriger si besoin, puis **Envoyer** → Djeli IA répond.
5. Si `VOICE_PROVIDER=mock` : la transcription est simulée — le parcours
   (enregistrement → texte → validation → réponse) reste testable.
6. Cas confiance faible : une transcription peu sûre déclenche une demande de
   clarification / un passage à un humain.

---

## Parcours 4 — Recommandations & assistant proactif (OWNER / MANAGER)

1. **Tableau de bord** → section **« À surveiller aujourd'hui »** + **Résumé du jour**.
2. Ouvrir **À surveiller** (`/recommendations`) et vérifier la présence de :
   - stock faible (Savon de Marseille, Savon liquide, Sucre 25 kg…)
   - rupture (Lait concentré, Huile 1 L)
   - créances en retard (> 30 / 60 / 90 jours)
   - échéance proche (Restaurant Sukabe, J-2)
   - client inactif (Mme Diallo, > 60 j sans commande)
   - commande bloquée (Restaurant Teriya, en préparation depuis 3 j)
   - commande à confirmer (Épicerie Nafama, en attente depuis > 2 h)
3. Sur une recommandation : **Préparer une relance** ou **Ouvrir** → vérifier
   la redirection vers l'écran de validation (rien n'est envoyé automatiquement).

---

## Parcours 5 — Rôles & périmètre

**Compte SALES** (`sales@demo.djeli.test`) :
- Clients : ne voit **que** ses clients assignés.
- Commandes : ne voit que celles qu'il a créées ou de ses clients.
- Recommandations : uniquement celles de son périmètre.
- Pas d'accès Automatisations / Marketing / Paramètres / `/admin`.

**Compte EMPLOYEE** (`employee@demo.djeli.test`) :
- Lecture catalogue / clients / commandes / conversations.
- Pas d'accès Créances, Paramètres, Automatisations, Marketing.

**Compte OWNER** : peut aussi ouvrir la **console opérateur** `/admin`
(organisations, abonnement, usage, statut WhatsApp — sans contenu privé).

---

## Feedback

Bouton **« Donner mon avis »** (en haut à droite, toutes les pages) → catégorie
(BUG / SUGGESTION / IA / VOICE / WHATSAPP / AUTRE) + message. Ou page **Support**
pour un ticket détaillé.

---

## TEST CHECKLIST

| Fonction | Testée ? | OK ? | Problème rencontré | Commentaire |
|---|---|---|---|---|
| Connexion (5 rôles) | | | | |
| Bannière démo visible | | | | |
| Dashboard OWNER utile dès la 1ʳᵉ connexion | | | | |
| Catalogue — liste, détail produit | | | | |
| Stock — normal / faible / rupture / réservé | | | | |
| Mouvements de stock (historique) | | | | |
| Clients — liste, détail, création | | | | |
| Commande — création | | | | |
| Commande — confirmer / préparer / livrer | | | | |
| Impact stock après livraison | | | | |
| Créances — liste + tranches d'ancienneté | | | | |
| Paiement partiel puis solde | | | | |
| Conversations WhatsApp (FR / BM / MIXED) | | | | |
| Brouillon de commande depuis WhatsApp | | | | |
| Djeli IA — 5 questions | | | | |
| Djeli Voice — micro → texte → envoi | | | | |
| Recommandations — 6 types visibles | | | | |
| Préparer une action depuis une reco | | | | |
| Résumé du jour | | | | |
| Rôle SALES — périmètre restreint | | | | |
| Rôle EMPLOYEE — permissions limitées | | | | |
| Offre & usage (`/billing`) | | | | |
| Console `/admin` (OWNER) | | | | |
| Bouton « Donner mon avis » | | | | |
| Mobile 375 px — login | | | | |
| Mobile 375 px — dashboard | | | | |
| Mobile 375 px — clients / détail | | | | |
| Mobile 375 px — catalogue / détail | | | | |
| Mobile 375 px — commandes | | | | |
| Mobile 375 px — créances | | | | |
| Mobile 375 px — conversations | | | | |
| Mobile 375 px — Djeli IA | | | | |
| Mobile 375 px — recommandations | | | | |

---

## Fiche testeur (à remplir, données minimales)

- Rôle / type de commerce représenté :
- Date du test :
- Scénarios terminés (1–5) :
- Blocages rencontrés :
- Note UX (1–5) :
- Fonction préférée :
- Fonction jugée inutile :
- Réutiliserait le produit ? (oui / non / peut-être) :

> Ne pas collecter de donnée personnelle non nécessaire.
