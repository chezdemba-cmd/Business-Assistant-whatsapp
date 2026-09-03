/**
 * Loader Node minimal pour exécuter directement des scripts TypeScript qui
 * importent du code applicatif (`node prisma/seed.ts`, `prisma/seed-staging.ts`,
 * `scripts/demo-reset.ts`).
 *
 *   node --import ./scripts/register-paths.mjs <script.ts>
 *
 * Il gère ce que Node ESM ne fait pas nativement :
 *   - alias TypeScript `@/*`            → `./src/*`
 *   - imports relatifs sans extension   → `.ts` / `.tsx` / `/index.ts`
 *   - `server-only` / `client-only`     → module vide
 *
 * Aucune dépendance. Le type-stripping natif de Node gère les fichiers `.ts`.
 */
import { register } from "node:module";
import { resolve as resolvePath } from "node:path";

const SRC = resolvePath(process.cwd(), "src");

const hooksSource = `
  const SRC = ${JSON.stringify(SRC)};
  const { pathToFileURL, fileURLToPath } = await import("node:url");
  const { existsSync, statSync } = await import("node:fs");
  const { resolve: resolvePath, dirname } = await import("node:path");

  const EXT = ["", ".ts", ".tsx", ".mts", ".cts", ".js", ".mjs", ".cjs"];

  function probe(basePath) {
    for (const e of EXT) {
      const c = basePath + e;
      try { if (existsSync(c) && statSync(c).isFile()) return pathToFileURL(c).href; } catch {}
    }
    for (const e of [".ts", ".tsx", ".js"]) {
      const c = resolvePath(basePath, "index" + e);
      try { if (existsSync(c) && statSync(c).isFile()) return pathToFileURL(c).href; } catch {}
    }
    return null;
  }

  export async function resolve(specifier, context, nextResolve) {
    if (specifier === "server-only" || specifier === "client-only") {
      return { url: "data:text/javascript,export{}", shortCircuit: true };
    }

    // Stubs inertes des modules de contexte Next pour exécuter du code serveur
    // hors requête (tests, scripts). Aucune donnée réelle n'y transite.
    if (specifier === "next/headers") {
      const src =
        "export function cookies(){return{get(){return undefined},getAll(){return[]},set(){},delete(){},has(){return false}}}" +
        "export function headers(){return new Headers()}" +
        "export function draftMode(){return{isEnabled:false,enable(){},disable(){}}}";
      return { url: "data:text/javascript," + encodeURIComponent(src), shortCircuit: true };
    }
    if (specifier === "next/navigation") {
      const src =
        "export function redirect(u){const e=new Error('NEXT_REDIRECT');e.digest='NEXT_REDIRECT;'+u;throw e}" +
        "export function permanentRedirect(u){return redirect(u)}" +
        "export function notFound(){const e=new Error('NEXT_NOT_FOUND');e.digest='NEXT_HTTP_ERROR_FALLBACK;404';throw e}" +
        "export function forbidden(){const e=new Error('NEXT_FORBIDDEN');e.digest='NEXT_HTTP_ERROR_FALLBACK;403';throw e}";
      return { url: "data:text/javascript," + encodeURIComponent(src), shortCircuit: true };
    }

    if (specifier.startsWith("@/")) {
      const url = probe(resolvePath(SRC, specifier.slice(2)));
      if (url) return { url, shortCircuit: true };
    }

    if (specifier.startsWith("./") || specifier.startsWith("../")) {
      try {
        return await nextResolve(specifier, context);
      } catch (err) {
        const parent = context.parentURL && context.parentURL.startsWith("file:")
          ? dirname(fileURLToPath(context.parentURL))
          : process.cwd();
        const url = probe(resolvePath(parent, specifier));
        if (url) return { url, shortCircuit: true };
        throw err;
      }
    }

    return nextResolve(specifier, context);
  }
`;

register(`data:text/javascript,${encodeURIComponent(hooksSource)}`, import.meta.url);
