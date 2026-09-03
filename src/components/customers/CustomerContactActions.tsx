"use client";

/**
 * Actions terrain rapides sur une fiche client (§61-64). N'envoie AUCUN message
 * automatique : « WhatsApp » ouvre juste la conversation manuelle (la logique
 * Business API reste côté serveur pour l'automatisation).
 */
export function CustomerContactActions({
  phone,
  address,
  area,
  city,
}: {
  phone: string | null;
  address: string | null;
  area: string | null;
  city: string | null;
}) {
  const waNumber = phone ? phone.replace(/[^\d]/g, "") : null;
  const mapsQuery = [address, area, city].filter(Boolean).join(", ");

  const btn: React.CSSProperties = {
    flex: "1 1 30%",
    minWidth: 96,
    minHeight: 44,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    fontSize: 13,
    textDecoration: "none",
  };

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
      {phone ? (
        <a href={`tel:${phone}`} className="dj-btn dj-btn--outline" style={btn}>
          📞 Appeler
        </a>
      ) : null}
      {waNumber ? (
        <a
          href={`https://wa.me/${waNumber}`}
          target="_blank"
          rel="noopener noreferrer"
          className="dj-btn dj-btn--outline"
          style={btn}
        >
          💬 WhatsApp
        </a>
      ) : null}
      {mapsQuery ? (
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="dj-btn dj-btn--outline"
          style={btn}
        >
          📍 Itinéraire
        </a>
      ) : null}
    </div>
  );
}
