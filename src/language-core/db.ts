import "server-only";
import { prisma } from "@/server/db/client";

/**
 * Le Language Core partage physiquement l'instance PostgreSQL du monorepo,
 * mais N'ACCÈDE QU'À SES TABLES `language_*`. Aucune requête vers les tables
 * métier (orders, customers, payments…) — l'indépendance est architecturale.
 * Pour extraire le service dans son propre dépôt, seul ce fichier change.
 */
export const lcDb = prisma;
