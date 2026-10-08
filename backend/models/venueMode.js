/**
 * Modo de servicio del negocio. Un café opera como MOSTRADOR: se pide, se cobra y se entrega en un
 * solo paso, sin mesas, cocina, mesero ni anfitrión, y con un equipo de hasta 2 personas.
 * El resto de los tipos de negocio usan el flujo de salón (mesas → cocina → caja).
 *
 * El frontend tiene su espejo en `frontend/src/roles.js`; `tests/roles.test.js` verifica que coincidan.
 */
const { TENANT_ROLES, ROLE_DEFS } = require('./roles');

const COUNTER_BUSINESS_TYPES = ['cafe'];
const COUNTER_MAX_USERS = 2;
const COUNTER_ROLES = ['admin', 'cashier'];

function modeOf(settings) {
  return COUNTER_BUSINESS_TYPES.includes(settings?.businessType) ? 'counter' : 'table';
}

/** Límites del negocio según su modo: { mode, maxUsers (null = sin tope), allowedRoles }. */
function limitsFor(settings) {
  const mode = modeOf(settings);
  if (mode === 'counter') return { mode, maxUsers: COUNTER_MAX_USERS, allowedRoles: COUNTER_ROLES };
  return { mode, maxUsers: null, allowedRoles: TENANT_ROLES };
}

const roleName = (id) => ROLE_DEFS.find((r) => r.id === id)?.label || id;

/** Mensaje de error si agregar esta cuenta rompe los límites del negocio; null si cabe. */
function memberLimitError(limits, role, currentCount) {
  if (!limits.allowedRoles.includes(role)) {
    return `En modo Café solo hay ${limits.allowedRoles.map(roleName).join(' y ')}.`;
  }
  if (limits.maxUsers != null && currentCount >= limits.maxUsers) {
    return `El modo Café incluye hasta ${limits.maxUsers} personas. Elimina una cuenta para agregar otra.`;
  }
  return null;
}

/** Mensaje de error si el equipo actual no cabe en el modo (p. ej. al cambiar a Café); null si cabe. */
function teamFitError(limits, users) {
  const wrong = [...new Set(users.map((u) => u.role).filter((r) => !limits.allowedRoles.includes(r)))];
  if (wrong.length) {
    return `Para usar el modo Café primero elimina o cambia las cuentas con rol ${wrong.map(roleName).join(', ')}.`;
  }
  if (limits.maxUsers != null && users.length > limits.maxUsers) {
    return `El modo Café incluye hasta ${limits.maxUsers} personas y tienes ${users.length} cuentas. Elimina las que sobran.`;
  }
  return null;
}

module.exports = {
  COUNTER_BUSINESS_TYPES,
  COUNTER_MAX_USERS,
  COUNTER_ROLES,
  modeOf,
  limitsFor,
  memberLimitError,
  teamFitError,
};
