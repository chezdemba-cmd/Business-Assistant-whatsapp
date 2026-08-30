# Sauvegardes & restauration (§28)

> Une sauvegarde non restaurable ne compte pas.

## Politique

- **Fréquence** : sauvegarde complète quotidienne de la base PostgreSQL +
  journalisation WAL / PITR si le fournisseur le propose.
- **Rétention** : 7 sauvegardes quotidiennes + 4 hebdomadaires + 3 mensuelles.
- **Chiffrement** : au repos (fournisseur) ; accès restreint.
- **Emplacement** : région distincte de la base primaire si possible.

## Sauvegarde automatique (fourni : `scripts/backup.sh`)

```bash
DATABASE_URL=postgres://…  BACKUP_DIR=/var/backups/djeli \
  BACKUP_RETENTION_DAYS=30  ./scripts/backup.sh
```

Le script : produit un dump `--format=custom`, **vérifie qu'il est lisible**
(`pg_restore --list`), applique la rétention, et **sort en code ≠ 0** en cas
d'échec (pour que l'ordonnanceur alerte).

À planifier **une fois par jour** :

- **cron** : `15 2 * * * cd /app && DATABASE_URL=… ./scripts/backup.sh /var/backups/djeli >> /var/log/djeli-backup.log 2>&1`
- **conteneur** : `docker run --rm -e DATABASE_URL=… -v djeli_backups:/backups <image> ./scripts/backup.sh /backups`
- **fournisseur managé** : activer les sauvegardes automatiques + PITR ; ce
  script reste utile comme copie hors-plateforme (région distincte).

Envoyer les dumps vers un stockage objet chiffré, région ≠ base primaire.

## Test de restauration (à faire chaque mois — À RÉALISER au moins une fois avant prod)

1. Provisionner une base vide `djeli_restore`.
2. `pg_restore --clean --if-exists --no-owner --no-privileges --dbname "$RESTORE_URL" djeli-YYYY-MM-DDThh-mm-ssZ.dump`
3. `DATABASE_URL=$RESTORE_URL npx prisma migrate status` → *up to date*.
4. Lancer l'app contre `djeli_restore`, vérifier `/api/readiness` = `200`.
5. Contrôles de cohérence : quelques commandes (total = somme des lignes),
   `amountPaid` = Σ paiements CONFIRMED, comptes d'organisations.
6. Consigner la date, le fichier testé et le résultat (RPO/RTO observés).

## Ce qui n'est PAS dans la base

- Fichiers audio WhatsApp : **non conservés** (téléchargés, transcrits, jetés).
- Secrets : dans le gestionnaire de secrets de la plateforme, pas dans la base.
