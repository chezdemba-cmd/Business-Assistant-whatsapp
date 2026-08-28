# Sauvegardes & restauration (§28)

> Une sauvegarde non restaurable ne compte pas.

## Politique

- **Fréquence** : sauvegarde complète quotidienne de la base PostgreSQL +
  journalisation WAL / PITR si le fournisseur le propose.
- **Rétention** : 7 sauvegardes quotidiennes + 4 hebdomadaires + 3 mensuelles.
- **Chiffrement** : au repos (fournisseur) ; accès restreint.
- **Emplacement** : région distincte de la base primaire si possible.

## Sauvegarde manuelle (hors fournisseur managé)

```bash
pg_dump --format=custom --no-owner --dbname "$DATABASE_URL" \
  --file "djeli-$(date +%F).dump"
```

## Test de restauration (à faire chaque mois)

1. Provisionner une base vide `djeli_restore`.
2. `pg_restore --clean --if-exists --no-owner --dbname "$RESTORE_URL" djeli-YYYY-MM-DD.dump`
3. `DATABASE_URL=$RESTORE_URL npx prisma migrate status` → *up to date*.
4. Lancer l'app contre `djeli_restore`, vérifier `/api/readiness` = `200`.
5. Contrôles de cohérence : quelques commandes (total = somme des lignes),
   `amountPaid` = Σ paiements CONFIRMED, comptes d'organisations.
6. Consigner la date et le résultat du test.

## Ce qui n'est PAS dans la base

- Fichiers audio WhatsApp : **non conservés** (téléchargés, transcrits, jetés).
- Secrets : dans le gestionnaire de secrets de la plateforme, pas dans la base.
