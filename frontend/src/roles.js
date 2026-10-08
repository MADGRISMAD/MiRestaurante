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

/**
 * Modo de servicio. Un café opera como MOSTRADOR (se pide, se cobra y se entrega en un solo paso: sin
 * mesas, cocina, mesero ni anfitrión) y con un equipo de hasta 2 personas. El resto de negocios usan
 * el flujo de salón. Espejo de `backend/models/venueMode.js`.
 */
export const COUNTER_BUSINESS_TYPES = ["cafe"];
export const COUNTER_MAX_USERS = 2;
export const COUNTER_ROLES = ["admin", "cashier"];

let modeProvider = () => "table";
/** main.ts registra aquí de dónde leer el tipo de negocio (evita un import circular con venueStore). */
export function setModeProvider(fn) {
  modeProvider = fn;
}
export const modeForBusinessType = (type) => (COUNTER_BUSINESS_TYPES.includes(type) ? "counter" : "table");
export const currentMode = () => modeForBusinessType(modeProvider());
export const isCounterMode = () => currentMode() === "counter";

/** Qué ve cada rol en un café (reemplaza a `sees`/`description` en modo mostrador). */
export const COUNTER_ROLE_COPY = {
  admin: {
    description: "Atiende y además controla el negocio: menú, equipo, caja y facturación.",
    sees: ["Mostrador (vender y cobrar)", "Resumen del día", "Menú y productos", "Equipo, ajustes y facturación"],
  },
  cashier: {
    description: "Vende y cobra en el mostrador, y lleva la caja del día.",
    sees: ["Mostrador (vender y cobrar)", "Caja y cierre del día", "Impresión de tickets"],
  },
};

const BOTH = ["table", "counter"];

/**
 * Una fila por pantalla: nombre de ruta, path, etiqueta, roles con acceso y modos en que existe.
 * `counterRoles` (opcional) reemplaza a `roles` en modo mostrador.
 */
export const SCREENS = [
  { name: "dashboard", path: "/dashboard", label: "Resumen", roles: ["admin"], modes: BOTH },
  // Solo café: venta rápida de mostrador
  { name: "counter", path: "/counter", label: "Mostrador", roles: ["admin", "cashier"], modes: ["counter"] },
  // Solo salón: mesas, cocina, lista de espera y meseros
  { name: "main", path: "/main", label: "Mesas", roles: ["admin", "host", "waiter", "cashier"], modes: ["table"] },
  { name: "kitchen", path: "/kitchen", label: "Cocina", roles: ["admin", "kitchen", "cashier", "waiter"], modes: ["table"] },
  { name: "waitlist", path: "/waitlist", label: "Lista de espera", roles: ["admin", "host"], modes: ["table"] },
  { name: "staff", path: "/staff", label: "Meseros", roles: ["admin"], modes: ["table"] },
  // En salón se toma el pedido aquí; en café solo el administrador edita los productos
  { name: "menu", path: "/menu", label: "Pedido", roles: ["admin", "waiter", "cashier"], counterRoles: ["admin"], modes: BOTH },
  { name: "orders", path: "/orders", label: "Caja", roles: ["admin", "cashier"], modes: BOTH },
  { name: "team", path: "/team", label: "Equipo y roles", roles: ["admin"], modes: BOTH },
  { name: "billing", path: "/billing", label: "Facturación y planes", roles: ["admin", "cashier"], modes: BOTH },
  { name: "settings", path: "/settings", label: "Configuración", roles: ["admin"], modes: BOTH },
  { name: "setup", path: "/setup", label: "Configuración inicial", roles: ["admin"], modes: BOTH },
  { name: "printOrder", path: "/print/order/:id", label: "Cuenta", roles: ["admin", "cashier", "waiter", "kitchen"], modes: BOTH },
  { name: "printCash", path: "/print/cash/:id", label: "Cierre de caja", roles: ["admin", "cashier"], modes: BOTH },
  { name: "platform", path: "/platform", label: "Plataforma", roles: ["platform_admin"], modes: BOTH },
];

export const roleLabel = Object.fromEntries(
  [...ROLE_DEFS, PLATFORM_ROLE].map((r) => [r.id, r.label])
);

export const roleHome = Object.fromEntries(
  [...ROLE_DEFS, PLATFORM_ROLE].map((r) => [r.id, r.home])
);

export const routeRoles = Object.fromEntries(SCREENS.map((s) => [s.name, s.roles]));

/** Roles de una pantalla en un modo (counterRoles reemplaza a roles en modo mostrador). */
export function rolesFor(screen, mode = "table") {
  return mode === "counter" && screen.counterRoles ? screen.counterRoles : screen.roles;
}

/** Roles con acceso a una pantalla en cualquier modo (para meta.roles de las rutas). */
export function screenRoles(name) {
  const s = SCREENS.find((x) => x.name === name);
  return s ? [...new Set([...s.roles, ...(s.counterRoles || [])])] : [];
}

/** ¿Puede este rol entrar a esta pantalla en este modo? Una pantalla desconocida no se restringe. */
export function canAccessScreen(name, role, mode = "table") {
  const s = SCREENS.find((x) => x.name === name);
  if (!s) return true;
  return s.modes.includes(mode) && rolesFor(s, mode).includes(normalizeRole(role));
}

/** Pantalla de inicio de un rol. En modo mostrador todos entran directo a vender. */
export function homeForRole(role, mode = "table") {
  const r = normalizeRole(role);
  if (r === "platform_admin") return roleHome[r];
  if (mode === "counter") return "counter";
  return roleHome[r] || "main";
}

/** Pantallas a las que puede entrar un rol en un modo (útil para menús y para documentar). */
export function screensForRole(role, mode = "table") {
  return SCREENS.filter((s) => canAccessScreen(s.name, role, mode));
}
