/**
 * Fuente única de verdad de roles y pantallas del frontend.
 * Espejo de `backend/models/roles.js` (el test `backend/tests/roles.test.js`
 * verifica que ids y etiquetas coincidan).
 *
 * Para agregar una pantalla: añade una fila a SCREENS con los roles que pueden
 * entrar. La navegación, los guards de ruta y la pantalla de inicio salen de aquí.
 */

export const ROLE_DEFS = [
  {
    id: "admin",
    label: "Administrador",
    description: "Controla el negocio completo, de la carta a la facturación.",
    sees: ["Panel del día", "Menú y precios", "Equipo y roles", "Ajustes y facturación"],
    home: "main",
  },
  {
    id: "waiter",
    label: "Mesero",
    description: "Todo lo que necesita para atender rápido, nada más.",
    sees: ["Mapa de mesas", "Tomar pedidos", "Platos listos"],
    home: "main",
  },
  {
    id: "kitchen",
    label: "Cocina",
    description: "Una cola clara de comandas por preparar, en orden.",
    sees: ["Comandas nuevas", "Tiempo por pedido", "Marcar listo"],
    home: "kitchen",
  },
  {
    id: "cashier",
    label: "Caja",
    description: "Cuentas armadas al momento y un cierre sin sorpresas.",
    sees: ["Cobros", "Impresión de cuentas", "Cierre del día"],
    home: "orders",
  },
  {
    id: "host",
    label: "Anfitrión",
    description: "La puerta en orden, incluso en hora pico.",
    sees: ["Lista de espera", "Mesas libres", "Asignar mesa"],
    home: "waitlist",
  },
];

const PLATFORM_ROLE = { id: "platform_admin", label: "Plataforma", home: "platform" };

/** Nombres antiguos que pueden seguir en sesiones guardadas o datos viejos. */
export const LEGACY_ROLE_ALIASES = { hosstess: "host" };

export function normalizeRole(role) {
  if (!role) return role;
  return LEGACY_ROLE_ALIASES[role] || role;
}

/** Una fila por pantalla: nombre de ruta, path, etiqueta y roles con acceso. */
export const SCREENS = [
  { name: "dashboard", path: "/dashboard", label: "Resumen", roles: ["admin"] },
  { name: "main", path: "/main", label: "Mesas", roles: ["admin", "host", "waiter", "cashier"] },
  { name: "menu", path: "/menu", label: "Pedido", roles: ["admin", "waiter", "cashier"] },
  { name: "kitchen", path: "/kitchen", label: "Cocina", roles: ["admin", "kitchen", "cashier", "waiter"] },
  { name: "orders", path: "/orders", label: "Caja", roles: ["admin", "cashier"] },
  { name: "waitlist", path: "/waitlist", label: "Lista de espera", roles: ["admin", "host"] },
  { name: "staff", path: "/staff", label: "Meseros", roles: ["admin"] },
  { name: "team", path: "/team", label: "Equipo y roles", roles: ["admin"] },
  { name: "billing", path: "/billing", label: "Facturación y planes", roles: ["admin", "cashier"] },
  { name: "settings", path: "/settings", label: "Configuración", roles: ["admin"] },
  { name: "setup", path: "/setup", label: "Configuración inicial", roles: ["admin"] },
  { name: "printOrder", path: "/print/order/:id", label: "Cuenta", roles: ["admin", "cashier", "waiter", "kitchen"] },
  { name: "printCash", path: "/print/cash/:id", label: "Cierre de caja", roles: ["admin", "cashier"] },
  { name: "platform", path: "/platform", label: "Plataforma", roles: ["platform_admin"] },
];

export const roleLabel = Object.fromEntries(
  [...ROLE_DEFS, PLATFORM_ROLE].map((r) => [r.id, r.label])
);

export const roleHome = Object.fromEntries(
  [...ROLE_DEFS, PLATFORM_ROLE].map((r) => [r.id, r.home])
);

export const routeRoles = Object.fromEntries(SCREENS.map((s) => [s.name, s.roles]));

/** Roles con acceso a una pantalla (para meta.roles de las rutas). */
export function screenRoles(name) {
  return routeRoles[name] || [];
}

export function homeForRole(role) {
  return roleHome[normalizeRole(role)] || "main";
}

/** Pantallas a las que puede entrar un rol (útil para menús y para documentar). */
export function screensForRole(role) {
  const r = normalizeRole(role);
  return SCREENS.filter((s) => s.roles.includes(r));
}
