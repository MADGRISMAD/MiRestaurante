/**
 * Fuente única de verdad de los roles del negocio.
 * El frontend tiene su espejo en `frontend/src/roles.js`; el test
 * `tests/roles.test.js` verifica que ambos listados no se desalineen.
 */

const ROLE_DEFS = [
  {
    id: 'admin',
    label: 'Administrador',
    description: 'Controla el negocio completo, de la carta a la facturación.',
    sees: ['Panel del día', 'Menú y precios', 'Equipo y roles', 'Ajustes y facturación'],
  },
  {
    id: 'waiter',
    label: 'Mesero',
    description: 'Todo lo que necesita para atender rápido, nada más.',
    sees: ['Mapa de mesas', 'Tomar pedidos', 'Platos listos'],
  },
  {
    id: 'kitchen',
    label: 'Cocina',
    description: 'Una cola clara de comandas por preparar, en orden.',
    sees: ['Comandas nuevas', 'Tiempo por pedido', 'Marcar listo'],
  },
  {
    id: 'cashier',
    label: 'Caja',
    description: 'Cuentas armadas al momento y un cierre sin sorpresas.',
    sees: ['Cobros', 'Impresión de cuentas', 'Cierre del día'],
  },
  {
    id: 'host',
    label: 'Anfitrión',
    description: 'La puerta en orden, incluso en hora pico.',
    sees: ['Lista de espera', 'Mesas libres', 'Asignar mesa'],
  },
];

/** Nombres antiguos que aún pueden venir en tokens, invitaciones o usuarios viejos. */
const LEGACY_ROLE_ALIASES = { hosstess: 'host' };

const TENANT_ROLES = ROLE_DEFS.map((r) => r.id);
const ROLES = [...TENANT_ROLES, 'platform_admin'];

function normalizeRole(role) {
  if (!role) return role;
  return LEGACY_ROLE_ALIASES[role] || role;
}

function isTenantRole(role) {
  return TENANT_ROLES.includes(normalizeRole(role));
}

module.exports = {
  ROLE_DEFS,
  ROLES,
  TENANT_ROLES,
  LEGACY_ROLE_ALIASES,
  normalizeRole,
  isTenantRole,
};
