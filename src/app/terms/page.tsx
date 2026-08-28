import { LegalShell } from "../legal/LegalShell";

export const metadata = { title: "Conditions d'utilisation — Djeli" };

export default function TermsPage() {
  return (
    <LegalShell title="Conditions d'utilisation">
      <p>
        En utilisant Djeli, l&apos;organisation cliente accepte les présentes
        conditions (version pilote).
      </p>
      <h2>Service</h2>
      <p>
        Djeli est un assistant commercial : WhatsApp Business, IA, voix,
        catalogue, stock, CRM, créances, automatisations et marketing. Le
        service est fourni « en l&apos;état » pendant la phase pilote.
      </p>
      <h2>Responsabilités du client</h2>
      <ul>
        <li>Exactitude des données saisies.</li>
        <li>Respect des règles de WhatsApp / Meta et du consentement de ses clients.</li>
        <li>Ne pas envoyer de campagnes non sollicitées ; respecter les opt-out.</li>
        <li>Sécurité de ses identifiants.</li>
      </ul>
      <h2>Offres & essai</h2>
      <p>
        Un essai est proposé à l&apos;inscription. Les quotas d&apos;usage
        (IA, voix, messages, envois marketing) dépendent de l&apos;offre. Le
        dépassement bloque proprement le service concerné, sans coût surprise.
      </p>
      <h2>Disponibilité</h2>
      <p>
        Aucune garantie de disponibilité contractuelle pendant le pilote. Des
        sauvegardes quotidiennes de la base sont réalisées.
      </p>
      <h2>Résiliation</h2>
      <p>
        Le client peut demander la suppression de son organisation à tout
        moment (période de grâce puis purge/anonymisation).
      </p>
    </LegalShell>
  );
}
