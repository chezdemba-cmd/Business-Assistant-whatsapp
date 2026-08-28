import "server-only";
import { prisma } from "@/server/db/client";

/**
 * Export des données principales du client (§29) — CSV ou JSON. Réservé au
 * OWNER. Portée : clients, produits, commandes (avec lignes), paiements.
 */

export type ExportFormat = "json" | "csv";

function csvCell(v: unknown): string {
  if (v == null) return "";
  const s = v instanceof Date ? v.toISOString() : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]!);
  const lines = [headers.join(",")];
  for (const r of rows) lines.push(headers.map((h) => csvCell(r[h])).join(","));
  return lines.join("\n");
}

export async function buildOrganizationExport(
  organizationId: string,
  format: ExportFormat,
): Promise<{ contentType: string; filename: string; body: string }> {
  const [customers, products, orders, payments] = await Promise.all([
    prisma.customer.findMany({
      where: { organizationId },
      select: {
        id: true, displayName: true, phone: true, email: true, customerType: true,
        city: true, area: true, status: true, marketingOptIn: true, createdAt: true,
      },
    }),
    prisma.product.findMany({
      where: { organizationId },
      select: {
        id: true, sku: true, name: true, unit: true, salePrice: true, purchasePrice: true,
        alertThreshold: true, status: true, createdAt: true,
      },
    }),
    prisma.order.findMany({
      where: { organizationId },
      select: {
        id: true, reference: true, status: true, paymentStatus: true, currency: true,
        totalAmount: true, amountPaid: true, dueDate: true, createdAt: true,
        customer: { select: { displayName: true } },
        items: { select: { productNameSnapshot: true, skuSnapshot: true, quantity: true, unitPrice: true, subtotal: true } },
      },
    }),
    prisma.payment.findMany({
      where: { organizationId },
      select: {
        id: true, amount: true, currency: true, method: true, status: true,
        paidAt: true, orderId: true, customerId: true,
      },
    }),
  ]);

  const ts = new Date().toISOString().slice(0, 10);

  if (format === "json") {
    return {
      contentType: "application/json",
      filename: `djeli-export-${ts}.json`,
      body: JSON.stringify({ exportedAt: new Date().toISOString(), customers, products, orders, payments }, null, 2),
    };
  }

  const flatOrders = orders.map((o) => ({
    id: o.id,
    reference: o.reference,
    customer: o.customer.displayName,
    status: o.status,
    paymentStatus: o.paymentStatus,
    currency: o.currency,
    totalAmount: o.totalAmount,
    amountPaid: o.amountPaid,
    dueDate: o.dueDate,
    itemCount: o.items.length,
    createdAt: o.createdAt,
  }));

  const body =
    `# customers\n${toCsv(customers as Record<string, unknown>[])}\n\n` +
    `# products\n${toCsv(products as Record<string, unknown>[])}\n\n` +
    `# orders\n${toCsv(flatOrders as Record<string, unknown>[])}\n\n` +
    `# payments\n${toCsv(payments as Record<string, unknown>[])}\n`;

  return { contentType: "text/csv", filename: `djeli-export-${ts}.csv`, body };
}
