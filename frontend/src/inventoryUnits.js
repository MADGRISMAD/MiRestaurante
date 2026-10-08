/**
 * Unidades de medida de los ingredientes. Espejo de `UNITS` en `backend/models/inventory.js`
 * (`tests/inventory-parity.test.js` verifica que coincidan).
 */
export const UNITS = {
  pza: "pieza",
  ml: "ml",
  l: "litro",
  g: "gramo",
  kg: "kilo",
  pump: "pump",
  shot: "shot",
  sobre: "sobre",
  cdta: "cucharadita",
};

export const UNIT_OPTIONS = Object.entries(UNITS).map(([key, label]) => ({ key, label }));

/** Abreviatura corta para ponerla junto a un número: "240 ml", "5 pump", "3 sobre". */
const SHORT = { pza: "pza", ml: "ml", l: "l", g: "g", kg: "kg", pump: "pump", shot: "shot", sobre: "sobre", cdta: "cdta" };
export const unitShort = (key) => SHORT[key] || key || "";

/** 1250 → "1,250"; 0.5 → "0.5"; sin ceros de sobra. */
export function formatQty(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "0";
  return v.toLocaleString("es-MX", { maximumFractionDigits: 3 });
}

export const qtyWithUnit = (n, unit) => `${formatQty(n)} ${unitShort(unit)}`.trim();

export const STOCK_STATUS_LABEL = { ok: "Bien", low: "Por agotarse", out: "Agotado" };

export const MOVEMENT_LABEL = {
  restock: "Entrada",
  waste: "Merma",
  adjust: "Conteo",
  sale: "Venta",
  return: "Devolución",
};
