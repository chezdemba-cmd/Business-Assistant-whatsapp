import type { ProductUnit } from "@prisma/client";

export const PRODUCT_UNITS = [
  "UNIT",
  "SAC",
  "CARTON",
  "PAQUET",
  "BIDON",
  "LITRE",
  "KG",
  "BOITE",
  "BOUTEILLE",
  "LOT",
  "PALETTE",
  "ROULEAU",
  "OTHER",
] as const satisfies readonly ProductUnit[];

const LABELS: Record<ProductUnit, string> = {
  UNIT: "Unité",
  SAC: "Sac",
  CARTON: "Carton",
  PAQUET: "Paquet",
  BIDON: "Bidon",
  LITRE: "Litre",
  KG: "Kg",
  BOITE: "Boîte",
  BOUTEILLE: "Bouteille",
  LOT: "Lot",
  PALETTE: "Palette",
  ROULEAU: "Rouleau",
  OTHER: "Autre",
};

export function productUnitLabel(unit: ProductUnit, custom?: string | null): string {
  if (unit === "OTHER") return custom?.trim() || "Autre";
  return LABELS[unit];
}
