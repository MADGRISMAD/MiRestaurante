/** Etiquetas de UI en español (valores internos del API se mantienen en inglés). */

export const orderStatusLabel = {
  pending: "Pendiente",
  preparing: "Preparando",
  ready: "Listo",
  served: "Servido",
  cancelled: "Cancelado",
};

export const paymentStatusLabel = {
  unpaid: "Sin pagar",
  paid: "Pagado",
};

export const modalityLabel = {
  "dine-in": "En salón",
  takeaway: "Para llevar",
};

export const roleLabel = {
  admin: "Admin",
  hosstess: "Hostess",
  waiter: "Mesero",
  kitchen: "Cocina",
  cashier: "Caja",
  platform_admin: "Platform",
};

export const inviteStatusLabel = {
  pending: "Pendiente",
  accepted: "Aceptada",
  revoked: "Revocada",
  expired: "Expirada",
};

export function labelOf(map, key, fallback = key) {
  if (!key) return fallback || "";
  return map[key] || fallback || String(key);
}
