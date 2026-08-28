import { LegalShell } from "../legal/LegalShell";

export const metadata = { title: "Confidentialité — Djeli" };

export default function PrivacyPage() {
  return (
    <LegalShell title="Politique de confidentialité">
      <p>
        Djeli traite les données que le commerçant saisit ou reçoit via WhatsApp
        pour rendre le service : clients, produits, stock, commandes, créances,
        paiements, conversations et transcriptions vocales.
      </p>
      <h2>Ce que nous collectons</h2>
      <ul>
        <li>Compte : nom, e-mail, téléphone.</li>
        <li>Entreprise : raison sociale, pays, devise, fuseau.</li>
        <li>Données métier saisies par l&apos;utilisateur.</li>
        <li>Messages WhatsApp entrants/sortants de l&apos;organisation.</li>
        <li>Journaux techniques (sans contenu de message ni secret).</li>
      </ul>
      <h2>Fournisseurs</h2>
      <p>
        Hébergement, base de données, API WhatsApp Business (Meta), fournisseur de
        modèle de langage et fournisseur de transcription — utilisés uniquement
        pour exécuter le service. Les clés d&apos;API ne sont jamais exposées.
      </p>
      <h2>Conservation & suppression</h2>
      <p>
        Les données sont conservées tant que le compte est actif. Le
        propriétaire peut exporter ses données et demander la suppression de
        l&apos;organisation (période de grâce de 14 jours avant purge).
      </p>
      <h2>Djeli Language Core</h2>
      <p>
        Les corrections linguistiques privées ne deviennent jamais une
        connaissance partagée sans anonymisation et validation humaine. Aucun
        transfert automatique entre organisations.
      </p>
      <h2>Contact</h2>
      <p>Via la page Support de l&apos;application.</p>
    </LegalShell>
  );
}
