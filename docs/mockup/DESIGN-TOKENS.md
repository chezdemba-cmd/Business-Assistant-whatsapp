# Source de vérité visuelle — Djeli's Business Assistant

Le fichier `Djeli Business Assistant vb.html` (fourni séparément) reste **la** référence
visuelle. Ce document en extrait les tokens pour que le code reste fidèle sans redesign.

## Palette

| Rôle | Hex |
|------|-----|
| Fond application | `#f5ead8` |
| Fond panneau / sidebar | `#ebddc5` |
| Fond carte | `#f9f4ed` |
| Fond carte alt / hover ligne | `#eee7db` |
| Bordure | `#dcd3c4` |
| Bordure douce | `#eee7db` |
| Texte principal | `#201e1d` |
| Texte secondaire | `#645c50` |
| Texte tertiaire / muted | `#82796a` |
| Texte placeholder | `#a19786` |
| Accent (primaire) | `#c67139` |
| Accent hover | `#b2622d` |
| Accent active / lien | `#8c491a` |
| Accent sur fond clair (lien) | `#8c491a` |
| Texte sur accent | `#fff2eb` |
| Succès fond | `#f0fae1` |
| Succès texte | `#56633f` |
| Vert secondaire (avatars, toggles) | `#7a8a5e` / `#f0fae1` |
| Alerte fond | `#fff2eb` |
| Alerte bordure | `#f0c9ae` |
| Alerte texte | `#8c491a` |
| Noir UI (toast, barre) | `#201e1d` / `#474238` |

## Typographie

- Titres / chiffres clés : **Caprasimo** (400), serif display. Fallback `Georgia, serif`.
- Texte courant / UI : **Figtree** (400/500/600/700). Fallback `system-ui, sans-serif`.
- Chiffres : `font-variant-numeric: tabular-nums`.
- Monospace (SKU, refs, tokens) : `ui-monospace, monospace`.

## Formes

- Rayons : boutons/inputs/pills `999px` ; cartes `24–32px` ; petites cartes `16–22px`.
- Hauteur champ desktop `46px`, mobile `48–52px`.
- Ombre carte : `0 3px 10px rgba(46,43,37,0.16)`.
- Ombre modale : `0 24px 60px rgba(46,43,37,0.32)`.

## Écrans (inventaire)

Fondation (rendus réels en Phase 1) : `login`, `register`, `onboarding`,
`onboarding/team`, `dashboard`, `members`, `settings`, `invite/[token]`, `forbidden`,
`profile`.

Métier (conservés en mock jusqu'aux phases suivantes) : `customers`, `customer`,
`catalog`, `product`, `productForm`, `stock`, `stockOverview`, `debts`, `campaign`,
`orders`, `orderDetail`, `newOrder`, `conversations`, `thread`, `ai`, `search`.

## Navigation

- Desktop : sidebar 252px — sections `PILOTAGE` (Dashboard, Clients, Catalogue,
  Commandes, Conversations, Djeli IA) et `ENTREPRISE` (Membres & rôles, Paramètres,
  Stock, Créances).
- Mobile : bottom-tab (Bord, Chats, Ventes, Clients, Djeli, Plus).
- Topbar : recherche, cloche, chip profil (avatar initiales + nom + rôle).

## Règles métier visibles dans la maquette

- Devise `XOF` (FCFA), montants **entiers** (`31 500 FCFA`, jamais `,00`).
- Indicatif téléphonique par défaut `+223`, numéros normalisés E.164.
- Pays par défaut `Mali`, non verrouillé.
- 5 rôles : `OWNER`, `ADMIN`, `MANAGER`, `SALES`, `EMPLOYEE`.
- Invitations envoyées « sur WhatsApp » → en Phase 1, lien d'invitation.
- Chaque changement sensible est historisé avec auteur + horodatage (audit log).
