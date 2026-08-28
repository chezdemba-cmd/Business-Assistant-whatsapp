import Link from "next/link";

/** Pagination classique préservant les autres paramètres de requête. */
export function Pager({
  basePath,
  searchParams,
  page,
  total,
  perPage,
}: {
  basePath: string;
  searchParams: Record<string, string | undefined>;
  page: number;
  total: number;
  perPage: number;
}) {
  const pageCount = Math.max(1, Math.ceil(total / perPage));
  if (pageCount <= 1) return null;

  const build = (p: number) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) {
      if (v && k !== "page") qs.set(k, v);
    }
    qs.set("page", String(p));
    return `${basePath}?${qs.toString()}`;
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        marginTop: 24,
      }}
    >
      <span style={{ fontSize: 13, color: "var(--text-3)" }}>
        Page {page} / {pageCount} · {total} résultat{total > 1 ? "s" : ""}
      </span>
      <div style={{ display: "flex", gap: 8 }}>
        {page > 1 ? (
          <Link className="dj-btn dj-btn--outline" style={{ height: 36, fontSize: 13 }} href={build(page - 1)}>
            Précédent
          </Link>
        ) : null}
        {page < pageCount ? (
          <Link className="dj-btn dj-btn--outline" style={{ height: 36, fontSize: 13 }} href={build(page + 1)}>
            Suivant
          </Link>
        ) : null}
      </div>
    </div>
  );
}
