import type { ReactNode, InputHTMLAttributes, SelectHTMLAttributes } from "react";
import type { Role } from "@prisma/client";

/* Composants sans état — sûrs en Server Components. Style repris de la maquette. */

export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div className="dj-card" style={style}>
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 24,
        marginBottom: subtitle ? 8 : 24,
        flexWrap: "wrap",
      }}
    >
      <div>
        <h1 className="dj-h1" style={{ margin: 0 }}>
          {title}
        </h1>
        {subtitle ? (
          <p style={{ margin: "8px 0 0", color: "var(--text-2)", maxWidth: 560 }}>
            {subtitle}
          </p>
        ) : null}
      </div>
      {actions ? <div style={{ display: "flex", gap: 10 }}>{actions}</div> : null}
    </div>
  );
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label className="dj-field-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && !error ? (
        <span style={{ fontSize: 12, color: "var(--text-3)" }}>{hint}</span>
      ) : null}
      {error ? <span className="dj-error">{error}</span> : null}
    </div>
  );
}

export function Input(
  props: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean },
) {
  const { invalid, className, ...rest } = props;
  return (
    <input
      className={`dj-input ${className ?? ""}`}
      aria-invalid={invalid ? "true" : undefined}
      {...rest}
    />
  );
}

export function Select(
  props: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean },
) {
  const { invalid, className, children, ...rest } = props;
  return (
    <select
      className={`dj-input ${className ?? ""}`}
      aria-invalid={invalid ? "true" : undefined}
      {...rest}
    >
      {children}
    </select>
  );
}

export function Alert({
  kind = "info",
  children,
}: {
  kind?: "info" | "error" | "ok";
  children: ReactNode;
}) {
  return <div className={`dj-alert dj-alert--${kind}`}>{children}</div>;
}

export function Badge({
  children,
  variant = "default",
}: {
  children: ReactNode;
  variant?: "default" | "accent" | "ok";
}) {
  const cls =
    variant === "accent"
      ? "dj-badge dj-badge--accent"
      : variant === "ok"
        ? "dj-badge dj-badge--ok"
        : "dj-badge";
  return <span className={cls}>{children}</span>;
}

const ROLE_LABEL: Record<Role, string> = {
  OWNER: "Propriétaire",
  ADMIN: "Administrateur",
  MANAGER: "Gérant",
  SALES: "Commercial",
  EMPLOYEE: "Employé",
};

export function roleLabel(role: Role): string {
  return ROLE_LABEL[role];
}

export function RoleBadge({ role }: { role: Role }) {
  return (
    <Badge variant={role === "OWNER" ? "accent" : role === "ADMIN" ? "ok" : "default"}>
      {role}
    </Badge>
  );
}

export function Avatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <div
      style={{
        width: 34,
        height: 34,
        borderRadius: 999,
        background: "var(--panel)",
        color: "var(--text-2)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 12,
        fontWeight: 700,
        flex: "none",
      }}
    >
      {initials || "?"}
    </div>
  );
}

export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <Card style={{ textAlign: "center", padding: "48px 32px" }}>
      <h3 style={{ fontSize: 23, margin: "0 0 8px" }}>{title}</h3>
      <p
        style={{
          margin: "0 auto 22px",
          maxWidth: 420,
          fontSize: 14,
          color: "var(--text-2)",
        }}
      >
        {message}
      </p>
      {action}
    </Card>
  );
}

export function StockStateBadge({
  state,
  label,
}: {
  state: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
  label: string;
}) {
  const variant =
    state === "OUT_OF_STOCK" ? "accent" : state === "LOW_STOCK" ? "default" : "ok";
  return <Badge variant={variant}>{label}</Badge>;
}

/** Placeholder photo produit — rayures diagonales de la maquette. */
export function ProductPhoto({
  url,
  alt,
  size = 120,
  radius = 18,
}: {
  url?: string | null;
  alt: string;
  size?: number | string;
  radius?: number;
}) {
  const common: React.CSSProperties = {
    width: typeof size === "number" ? size : size,
    height: typeof size === "number" ? size : size,
    borderRadius: radius,
    flex: "none",
    objectFit: "cover",
  };
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={alt} style={common} />;
  }
  return (
    <div
      aria-hidden
      style={{
        ...common,
        background:
          "repeating-linear-gradient(45deg,#eee7db 0 8px,#e5dccb 8px 16px)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        padding: 10,
      }}
    >
      <span
        className="mono"
        style={{
          fontSize: 10,
          color: "var(--text-3)",
          background: "var(--card)",
          padding: "3px 8px",
          borderRadius: 999,
        }}
      >
        photo produit
      </span>
    </div>
  );
}

export function MockBanner({ phase }: { phase: string }) {
  return (
    <div
      className="dj-alert dj-alert--info"
      style={{ marginBottom: 20, alignItems: "center" }}
    >
      <span>
        Écran de démonstration — données fictives. Ce module devient réel en{" "}
        <strong>{phase}</strong>.
      </span>
    </div>
  );
}
