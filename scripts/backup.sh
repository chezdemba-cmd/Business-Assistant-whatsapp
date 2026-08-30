#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Sauvegarde PostgreSQL de Djeli's Business Assistant (§28).
#
#   DATABASE_URL=postgres://…  ./scripts/backup.sh [dossier_cible]
#
# À planifier une fois par jour (cron / tâche plateforme). Produit un dump
# `custom` compressé, applique la rétention, et sort en code ≠ 0 en cas d'échec
# (pour que l'ordonnanceur alerte).
#
# Rétention (jours) : configurable via BACKUP_RETENTION_DAYS (défaut 30).
# ─────────────────────────────────────────────────────────────
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL requis}"
DEST="${1:-${BACKUP_DIR:-./backups}}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
STAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
FILE="${DEST}/djeli-${STAMP}.dump"

mkdir -p "$DEST"

echo "[backup] dump → ${FILE}"
pg_dump --format=custom --no-owner --no-privileges --dbname "$DATABASE_URL" --file "$FILE"

# Vérifie que le dump est lisible (liste la table des matières).
pg_restore --list "$FILE" > /dev/null
SIZE="$(wc -c < "$FILE")"
if [ "$SIZE" -lt 1024 ]; then
  echo "[backup] ÉCHEC : dump suspicieusement petit (${SIZE} octets)" >&2
  exit 1
fi
echo "[backup] OK — ${SIZE} octets, table des matières valide."

# Rétention : supprime les dumps plus vieux que RETENTION_DAYS.
find "$DEST" -name 'djeli-*.dump' -type f -mtime "+${RETENTION_DAYS}" -print -delete || true

echo "[backup] terminé $(date -u +%FT%TZ)"
