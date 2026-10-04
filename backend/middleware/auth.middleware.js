const { verifyToken } = require('../utils/jwt.utils');
const {
  ROLES,
  TENANT_ROLES,
  isSubscriptionActive,
} = require('../models/tenant.model');
const { normalizeRole } = require('../models/roles');
const db = require('../database/mongodb');

function requireAuth(req, res, next) {
  const payload = verifyToken(req.headers.authorization || '');
  if (!payload || !payload.userId) {
    return res.status(401).send('No autorizado');
  }

  const role = normalizeRole(payload.userRole);
  const isPlatform = role === 'platform_admin';

  if (!isPlatform && !payload.tenantId) {
    return res.status(401).send('No autorizado');
  }

  req.user = {
    username: payload.userId,
    role,
    tenantId: payload.tenantId || null,
  };
  req.tenantId = payload.tenantId || null;
  return next();
}

function requireRoles(...allowed) {
  const list = allowed.length ? allowed : TENANT_ROLES;
  return (req, res, next) => {
    if (!req.user?.role || !list.includes(req.user.role)) {
      return res.status(403).send('Sin permiso para esta acción');
    }
    return next();
  };
}

/**
 * Como requireRoles, pero confirma el rol ACTUAL en la base de datos.
 * El rol del token vale hasta 24 h: sin esto, a quien se le baja el rol o se
 * elimina seguiría teniendo permisos con su token anterior. Úsalo en acciones
 * sensibles (gestión del equipo).
 */
function requireFreshRole(...allowed) {
  return async (req, res, next) => {
    try {
      const user = await db.FindUserByUsername(req.user?.username, req.tenantId);
      const current = normalizeRole(user?.role);
      if (!user || !allowed.includes(current)) {
        return res.status(403).send('Sin permiso para esta acción');
      }
      req.user.role = current;
      return next();
    } catch (err) {
      console.error(err);
      return res.status(500).send(err.message || 'Error al verificar permisos');
    }
  };
}

async function requireActiveSubscription(req, res, next) {
  try {
    if (req.user?.role === 'platform_admin') return next();
    if (!req.tenantId) {
      return res.status(403).json({
        code: 'SUBSCRIPTION_REQUIRED',
        message: 'Suscripción requerida',
      });
    }

    const tenant = await db.GetTenantById(req.tenantId);
    if (!tenant) {
      return res.status(403).json({
        code: 'SUBSCRIPTION_REQUIRED',
        message: 'Negocio no encontrado',
      });
    }

    if (!isSubscriptionActive(tenant)) {
      return res.status(403).json({
        code: 'SUBSCRIPTION_REQUIRED',
        message: 'Tu prueba o suscripción no está activa. Ve a Facturación.',
        billingStatus: tenant.billingStatus,
        trialEndsAt: tenant.trialEndsAt,
        plan: tenant.plan,
      });
    }

    req.tenant = tenant;
    return next();
  } catch (err) {
    console.error(err);
    return res.status(500).send(err.message || 'Error de suscripción');
  }
}

module.exports = {
  requireAuth,
  requireRoles,
  requireFreshRole,
  requireActiveSubscription,
  ROLES,
  TENANT_ROLES,
};
