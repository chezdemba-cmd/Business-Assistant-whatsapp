import type {
  CustomerType,
  OrderPaymentStatus,
  OrderSource,
} from "@prisma/client";

export const CUSTOMER_TYPE_LABEL: Record<CustomerType, string> = {
  PARTICULIER: "Particulier",
  DETAILLANT: "Détaillant",
  GROSSISTE: "Grossiste",
  REVENDEUR: "Revendeur",
  ENTREPRISE: "Entreprise",
  AUTRE: "Autre",
};

export const CUSTOMER_TYPES = Object.keys(CUSTOMER_TYPE_LABEL) as CustomerType[];

export const PAYMENT_STATUS_LABEL: Record<OrderPaymentStatus, string> = {
  UNPAID: "Non payé",
  PARTIALLY_PAID: "Partiel",
  PAID: "Payé",
  CREDIT: "Crédit",
};

export const ORDER_SOURCE_LABEL: Record<OrderSource, string> = {
  MANUAL: "Manuel",
  WHATSAPP: "WhatsApp",
  AI: "Djeli IA",
  IMPORT: "Import",
};
