# FEREDRON — Audit, GAP analysis et architecture cible

Date : 1 septembre 2026  
Statut : document de décision préalable au refactoring

## 1. Décision exécutive

Le repository actuel constitue une base solide pour FEREDRON. Une réécriture totale serait coûteuse et risquée sans créer de valeur produit proportionnelle.

La recommandation est de :

1. conserver le cœur métier existant (multi-tenant, catalogue, stock, CRM, commandes, paiements, IA, automatisations, marketing, sécurité et mobile) ;
2. effectuer un rebranding contrôlé de Djeli Business vers FEREDRON ;
3. repositionner l’UX autour du parcours de vente et de FEREDRON IA ;
4. introduire une couche générique de canaux avant toute intégration TikTok, Facebook ou Instagram ;
5. compléter les capacités manquantes : contenu commercial, livraisons opérationnelles, attribution/conversion multi-canal et paiement Mobile Money réel.

Le changement est donc une évolution d’architecture et d’expérience, pas un nouveau produit construit de zéro.

## 2. Sources auditées

- vision FEREDRON fournie par le porteur du projet ;
- routes et composants Next.js dans `src/app` et `src/components` ;
- services métier dans `src/server` ;
- schéma PostgreSQL/Prisma et ses 12 migrations ;
- 66 fichiers de tests, dont 293 tests actuellement passants ;
- configuration PWA et projets Capacitor Android/iOS ;
- visuels `feredron.png` et `logo Férédron.png`.

Repères de taille : 57 pages applicatives, 24 modules de Server Actions et 137 fichiers contenant encore la marque « Djeli ».

## 3. Architecture existante

### Socle technique

- Next.js 15 / React 19 / TypeScript ;
- PostgreSQL avec Prisma ;
- authentification JWT en cookie HTTP-only ;
- multi-tenant par organisation, RBAC et audit ;
- jobs, quotas, abonnements, garde-fous de production ;
- PWA et coquilles Capacitor Android/iOS ;
- providers abstraits pour IA, voix et WhatsApp.

### Domaines métier déjà implémentés

- catalogue, catégories, prix, SKU et stock ;
- clients, segmentation élémentaire, historique et affectation commerciale ;
- commandes, réservations, statuts et brouillons créés par l’IA ;
- paiements, crédits, créances et relances ;
- conversations WhatsApp avec modes automatique/humain/pause ;
- assistant interne texte et voix ;
- recommandations proactives et automatisations ;
- campagnes marketing avec consentement et validation humaine ;
- tableaux de bord opérationnels, notifications et support ;
- fondation linguistique FR/BM/MIXED.

### Contraintes structurantes observées

- `OrderSource` ne connaît que `MANUAL`, `WHATSAPP`, `AI`, `IMPORT` ;
- `MarketingChannel` ne connaît que `WHATSAPP` et `OTHER` ;
- les conversations et messages sont techniquement et lexicalement liés à WhatsApp ;
- les outils de l’assistant sont surtout orientés lecture, dettes, résumé quotidien et recherche produit ;
- seule la préparation d’une relance existe comme proposition d’écriture interne notable ;
- la livraison est représentée dans la commande, sans domaine logistique autonome ;
- les statistiques commerciales ne disposent pas encore d’un funnel multi-canal complet.

## 4. GAP analysis

| Capacité FEREDRON | Existant | Décision | Priorité |
|---|---|---|---|
| Assistant commercial IA | Assistant texte/voix, outils de lecture, brouillons de commande, propositions confirmables | Conserver et étendre vers plans commerciaux, contenu et orchestration multi-action | P0 |
| Catalogue intelligent | Produits, catégories, prix, SKU, stock | Conserver ; ajouter variantes riches, médias, promotions et disponibilité par canal | P0/P1 |
| WhatsApp | Connexion Meta, webhook, messages, fenêtre 24 h, campagnes | Conserver comme premier adaptateur de canal | P0 |
| Conversations commerciales | Solide mais WhatsApp-spécifique | Généraliser `Conversation`/`Message` autour d’un `ChannelAccount` | P0 |
| Commandes | Cycle complet, stock, brouillons IA, paiements | Conserver ; ajouter attribution canal/campagne/conversation | P0 |
| CRM | Clients, historique, types, affectation et consentement | Conserver ; ajouter préférences, intérêts produits et segments calculés | P0/P1 |
| Relances automatiques | Dettes, inactivité, campagnes et recommandations | Conserver ; unifier sous des « playbooks commerciaux » confirmables | P0 |
| Contenu commercial | Génération de texte marketing limitée | Ajouter studio texte + visuel + déclinaisons par canal + calendrier | P0/P1 |
| Multi-canal | Anticipation faible (`OTHER`) | Créer une vraie couche canal avant les connecteurs sociaux | P0 architecture, P2 connecteurs |
| Paiements africains | Modèle paiement robuste, providers génériques, mode manuel | Ajouter adaptateurs Orange Money/Moov Money et webhooks idempotents | P1 |
| Livraison | Adresse, frais, date souhaitée et statut de commande | Ajouter expédition, livreur, tracking, preuve et événements | P1 |
| Analytics vente | Dashboard opérationnel et résumé quotidien | Ajouter funnel prospect→vente, conversion par canal/campagne et recommandations | P1 |
| Conseiller quotidien | Détecteurs et recommandations déjà solides | Recentrer l’accueil sur « quoi vendre, à qui, à quel prix, où » | P0 |
| Mobile | PWA + Android/iOS Capacitor | Conserver ; terminer hébergement HTTPS et tests appareils | P0 |
| Identité FEREDRON | Marque Djeli omniprésente | Rebranding transversal, migration contrôlée des identifiants techniques | P0 |

## 5. Ce qu’il faut conserver, adapter, supprimer ou ajouter

### Conserver

- schéma organisation/utilisateur/membre et RBAC ;
- audit, isolation tenant et sécurité des sessions ;
- catalogue, stock, CRM, commandes, paiements et créances ;
- services WhatsApp comme premier connecteur ;
- pipeline IA/voix, confirmations humaines et garde-fous ;
- moteur de recommandations, campagnes, jobs et quotas ;
- PWA, navigation mobile et Capacitor ;
- Language Core, en le maintenant comme module interne indépendant de la marque commerciale.

### Renommer

- produit visible : Djeli Business → FEREDRON ;
- Djeli IA → FEREDRON IA ;
- libellés « Pilotage » → « Vendre » ou regroupement orienté tâches ;
- « À surveiller » → « Opportunités » ;
- `com.djeli.business` → nouvel identifiant validé avant publication store ;
- métadonnées PWA, textes légaux, e-mails, seeds, support et documentation.

Les noms de tables, migrations historiques et identifiants d’audit ne doivent pas être renommés aveuglément. Les migrations historiques restent immuables ; les compatibilités externes doivent être versionnées.

### Adapter

- accueil : passer d’un tableau de gestion à un briefing commercial quotidien ;
- navigation : rendre FEREDRON IA persistante et prioritaire ;
- conversations : retirer les hypothèses WhatsApp du modèle central ;
- marketing : séparer contenu, audience, publication et mesure ;
- commandes : enregistrer origine, campagne et parcours de conversion ;
- recommandations : produire une action préparée claire, confirmable en un geste.

### Supprimer ou masquer

- mentions de phases techniques dans l’interface client ;
- Language Core de la navigation des commerçants ordinaires ;
- jargon ERP et doublons de navigation (`Stock`/`Mouvements`, `Créances`/`Relances`) au premier niveau ;
- promesses de canaux non encore connectés dans les écrans transactionnels.

### Ajouter

- comptes et adaptateurs de canal génériques ;
- studio de contenu commercial ;
- promotions et offres structurées ;
- playbooks commerciaux ;
- domaine livraison ;
- attribution et funnel de conversion ;
- onboarding orienté « première vente assistée » ;
- observabilité des connecteurs et consentements propres à chaque canal.

## 6. Architecture fonctionnelle cible

Navigation bureau recommandée :

1. **Accueil** — briefing, opportunités, actions du jour ;
2. **FEREDRON IA** — conversation et plans commerciaux ;
3. **Ventes** — vue agrégée du funnel et actions rapides ;
4. **Conversations** ;
5. **Commandes** ;
6. **Produits** — catalogue, stock, promotions ;
7. **Clients** ;
8. **Marketing** — contenu, audiences, campagnes, calendrier ;
9. **Livraisons** ;
10. **Paiements** ;
11. **Statistiques** ;
12. **Paramètres**.

Navigation mobile recommandée (5 entrées maximum) :

- Accueil ;
- Conversations ;
- FEREDRON IA (action centrale) ;
- Commandes ;
- Plus.

« Plus » contient Produits, Clients, Marketing, Livraisons, Paiements, Statistiques et Paramètres selon les permissions.

## 7. Architecture technique cible

### Couche canal

Introduire progressivement :

- `ChannelType`: `WHATSAPP`, `INSTAGRAM`, `FACEBOOK`, `TIKTOK`, `WEB` ;
- `ChannelAccount`: connexion d’une organisation à un canal ;
- `ExternalContact`: identité d’un client sur un canal ;
- `ChannelConversation` et `ChannelMessage` ou généralisation compatible des modèles existants ;
- interface `SalesChannelAdapter` pour recevoir, répondre, publier, synchroniser un catalogue et lire les statuts selon les capacités du canal ;
- matrice de capacités, car tous les canaux ne permettent pas les mêmes actions.

WhatsApp devient un adaptateur de cette couche. Il ne faut pas dupliquer tout le CRM ou les commandes par réseau.

### Orchestration commerciale IA

Conserver le principe sûr :

`DETECT → RECOMMEND → PREPARE → CONFIRM → EXECUTE → MEASURE`

Ajouter des propositions typées : promotion, segment, texte, visuel, publication, relance, brouillon de commande et plan de vente. Toute action externe ou financière reste confirmée, auditée et idempotente.

### Attribution

Ajouter aux événements de vente :

- canal d’origine ;
- conversation et message déclencheurs ;
- campagne/publication ;
- recommandation FEREDRON ;
- timestamps des étapes du funnel.

Sans cette couche, FEREDRON ne pourra pas apprendre quel canal, contenu ou conseil génère réellement des ventes.

## 8. Principes UX/UI

- une action principale par écran ;
- langage commercial simple, sans jargon technique ;
- cartes courtes : opportunité, raison, gain attendu, action ;
- confirmation en une étape pour les actions préparées ;
- entrée vocale visible et accessible ;
- états réseau et erreurs compréhensibles ;
- formulaires longs découpés en étapes ;
- détails avancés relégués dans « Plus » ou des panneaux secondaires ;
- accessibilité : contraste, tailles tactiles ≥ 44 px, libellés textuels avec les icônes.

### Direction visuelle

La palette proposée est cohérente avec le positionnement : bleu nuit pour la confiance, vert pour la vente/croissance et jaune comme accent d’action. Le logo fourni doit être décliné avant intégration :

- version horizontale ;
- symbole seul ;
- fond transparent ;
- versions fond clair/foncé ;
- SVG maître ;
- icônes 192, 512, maskable et Apple Touch ;
- vérification de lisibilité à 32 px.

Le visuel fourni ne doit pas servir directement d’icône de production tant que ses marges, son fond et sa lisibilité en petite taille ne sont pas normalisés.

## 9. Roadmap recommandée

### Phase 0 — Décisions et protection du socle (1 semaine)

- valider orthographe officielle `FEREDRON` vs `FÉRÉDRON` et disponibilité juridique/domaines/stores ;
- figer palette, logo maître, identifiant d’application et ton éditorial ;
- cartographier les contrats externes portant `DJELI` ;
- ajouter tests de non-régression de marque, navigation et migrations.

Critère de sortie : nomenclature et règles de migration approuvées.

### Phase 1 — Rebranding + UX commerciale MVP (2 à 3 semaines)

- remplacer la marque visible et les assets ;
- nouvelle navigation bureau/mobile ;
- accueil « actions de vente du jour » ;
- FEREDRON IA accessible partout ;
- masquer les surfaces techniques ;
- onboarding orienté première vente ;
- terminer PWA HTTPS et APK Android de test.

Critère de sortie : un commerçant comprend en moins d’une minute quoi faire pour vendre.

### Phase 2 — Assistant vendeur et contenu (3 à 5 semaines)

- plans commerciaux confirmables ;
- promotions structurées ;
- génération de textes et briefs visuels ;
- segments/intérêts clients ;
- playbooks de relance ;
- mesure des actions FEREDRON.

Critère de sortie : le scénario « vendre 20 ensembles Bazin cette semaine » produit un plan complet, vérifiable et exécutable après confirmation.

### Phase 3 — Fondation multi-canal (3 à 5 semaines)

- modèles `ChannelAccount`/identités externes ;
- interface d’adaptateur et matrice de capacités ;
- migration compatible de WhatsApp ;
- attribution conversation→commande→vente ;
- canal Web comme deuxième implémentation de référence.

Critère de sortie : le cœur métier ne contient plus de dépendance obligatoire à WhatsApp.

### Phase 4 — Paiement et livraison (3 à 6 semaines)

- premier provider Mobile Money réel ;
- webhooks de paiement idempotents ;
- expéditions, livreurs, tracking et preuve ;
- notifications transactionnelles.

Critère de sortie : commande, paiement et livraison sont suivis jusqu’à confirmation.

### Phase 5 — Connecteurs sociaux progressifs

- sélectionner un canal selon accès API réel et valeur pilote ;
- commencer par publication/catalogue ou messagerie selon les capacités officielles ;
- ajouter Instagram/Facebook/TikTok un par un ;
- ne jamais simuler une automatisation interdite par une plateforme.

Critère de sortie : chaque connecteur a consentement, observabilité, retries, attribution et procédure de déconnexion.

## 10. KPI de validation

### North Star proposée

**Nombre de ventes attribuées à une action assistée par FEREDRON par commerce actif et par semaine.**

### Drivers

- commerces ayant terminé la première vente assistée ;
- opportunités FEREDRON consultées puis confirmées ;
- conversations transformées en commandes ;
- campagnes/publications ayant généré une conversation ou commande ;
- délai médian conversation→commande ;
- réachat client à 30/60/90 jours.

### Garde-fous

- taux d’échec d’envoi et de connecteur ;
- désinscriptions et plaintes ;
- actions IA annulées ou corrigées ;
- commandes/paiements dupliqués ;
- temps de réponse et disponibilité ;
- incidents de confidentialité ou d’isolation tenant.

## 11. Risques et décisions à ne pas contourner

1. **Marque** : valider juridiquement le nom et son orthographe avant les stores.
2. **APIs sociales** : leurs possibilités et politiques changent ; valider chaque connecteur sur documentation officielle avant engagement produit.
3. **Automatisation** : conserver confirmation humaine, consentement et audit pour les actions externes.
4. **Complexité UX** : ne pas exposer les 57 pages actuelles au même niveau de navigation.
5. **Migration** : ne pas renommer directement les migrations historiques ni casser les webhooks/URLs existants.
6. **Mesure** : construire l’attribution avant de prétendre optimiser les ventes multi-canal.

## 12. Prochaine tranche recommandée

Commencer par la Phase 0 puis la Phase 1, sans modifier encore les modèles multi-canaux. La première tranche de code doit couvrir :

1. registre central de marque ;
2. assets FEREDRON normalisés ;
3. métadonnées web/PWA/Capacitor ;
4. navigation cible ;
5. accueil commercial ;
6. renommage visible de l’assistant ;
7. tests de marque et de navigation.

Après validation visuelle et fonctionnelle de cette tranche, démarrer la migration de canal derrière des interfaces compatibles.
