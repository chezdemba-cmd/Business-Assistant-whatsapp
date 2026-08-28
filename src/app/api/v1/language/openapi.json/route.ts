import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Schéma OpenAPI minimal de la Djeli Language API v1. */
const SPEC = {
  openapi: "3.0.3",
  info: {
    title: "Djeli Language API",
    version: "1.0.0",
    description:
      "Brique linguistique réutilisable (BM / FR / MIXED). Auth : Bearer <clientId>.<secret>.",
  },
  servers: [{ url: "/api/v1/language" }],
  components: {
    securitySchemes: { bearer: { type: "http", scheme: "bearer" } },
  },
  security: [{ bearer: [] }],
  paths: {
    "/resolve": {
      post: {
        summary: "Résoudre une expression (priorité ORG → DOMAIN → GLOBAL)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["text"],
                properties: {
                  text: { type: "string" },
                  language: { type: "string", enum: ["BM", "FR", "MIXED", "OTHER"] },
                  domain: { type: "string" },
                  organizationId: { type: "string" },
                  context: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "ResolveResult" }, "401": { description: "Auth" }, "403": { description: "Permission" } },
      },
    },
    "/search": { post: { summary: "Recherche plein-texte", responses: { "200": { description: "OK" } } } },
    "/entries": {
      get: { summary: "Lister les entrées", responses: { "200": { description: "OK" } } },
      post: { summary: "Créer une entrée (SUGGESTED)", responses: { "201": { description: "Créée" } } },
    },
    "/entries/{id}": {
      get: { summary: "Détail d'une entrée", responses: { "200": { description: "OK" } } },
      patch: { summary: "Modifier une entrée", responses: { "200": { description: "OK" } } },
    },
    "/entries/{id}/validate": { post: { summary: "Valider (permission language.validate)", responses: { "200": { description: "OK" } } } },
    "/entries/{id}/reject": { post: { summary: "Rejeter", responses: { "200": { description: "OK" } } } },
    "/domains": { get: { summary: "Domaines actifs", responses: { "200": { description: "OK" } } } },
    "/exports": { get: { summary: "Export JSON/JSONL/CSV (GLOBAL+DOMAIN VALIDATED, sans PII)", responses: { "200": { description: "OK" } } } },
    "/learning/candidates": { get: { summary: "Lister les candidats du Learning Loop (language.read)", responses: { "200": { description: "OK" } } } },
    "/learning/candidates/{id}": { get: { summary: "Détail d'un candidat + preuves anonymisées", responses: { "200": { description: "OK" } } } },
    "/learning/candidates/{id}/approve": { post: { summary: "Approuver (language.review)", responses: { "200": { description: "OK" } } } },
    "/learning/candidates/{id}/reject": { post: { summary: "Rejeter (language.review)", responses: { "200": { description: "OK" } } } },
    "/learning/candidates/{id}/promote": { post: { summary: "Promouvoir → LanguageEntry SUGGESTED (jamais VALIDATED, language.review)", responses: { "200": { description: "OK" } } } },
    "/learning/recompute": { post: { summary: "Recalculer les candidats (idempotent, language.review)", responses: { "200": { description: "OK" } } } },
    "/learning/stats": { get: { summary: "Métriques Learning Loop", responses: { "200": { description: "OK" } } } },
  },
};

export function GET() {
  return NextResponse.json(SPEC);
}
