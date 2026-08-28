import { LegalShell } from "../legal/LegalShell";

export const metadata = { title: "Traitement des données — Djeli" };

export default function DataProcessingPage() {
  return (
    <LegalShell title="Politique de traitement des données">
      <p>
        Ce document décrit, en termes opérationnels, comment Djeli traite les
        données pour le compte de l&apos;organisation cliente (le responsable de
        traitement). Il tiendra lieu d&apos;annexe « traitement des données » une
        fois revu juridiquement.
      </p>
      <h2>Rôles</h2>
      <ul>
        <li>Client : responsable de traitement pour ses données métier et ses clients finaux.</li>
        <li>Djeli : sous-traitant, agit sur instruction du client.</li>
      </ul>
      <h2>Catégories de données</h2>
      <p>
        Données de compte, données d&apos;entreprise, clients finaux, produits,
        commandes, paiements, messages WhatsApp, transcriptions vocales
        (l&apos;audio n&apos;est pas conservé).
      </p>
      <h2>Sous-traitants ultérieurs</h2>
      <p>
        Hébergeur et base de données ; Meta (WhatsApp Business Platform) ;
        fournisseur LLM ; fournisseur de transcription. Utilisation limitée à
        l&apos;exécution du service.
      </p>
      <h2>Mesures de sécurité</h2>
      <ul>
        <li>Chiffrement des jetons WhatsApp au repos.</li>
        <li>Isolation stricte entre organisations (multi-tenant).</li>
        <li>RBAC, journal d&apos;audit, révocation de sessions.</li>
        <li>En-têtes de sécurité, limitation de débit, sauvegardes quotidiennes.</li>
        <li>Journaux techniques sans PII ni secret.</li>
      </ul>
      <h2>Droits des personnes</h2>
      <p>
        Le client peut exporter et supprimer les données via l&apos;application.
        Les demandes des clients finaux sont relayées par le client.
      </p>
    </LegalShell>
  );
}
