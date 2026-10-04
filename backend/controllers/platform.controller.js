const db = require('../database/mongodb');
const { PLANS, trialEndsFrom } = require('../models/tenant.model');

async function listTenants(req, res) {
  try {
    const tenants = await db.ListTenants();
    const enriched = await Promise.all(
      tenants.map(async (t) => {
        const usersCount = await db.CountUsersByTenant(t.id);
        return {
          id: t.id,
          name: t.name,
          plan: t.plan || 'basic',
          billingStatus: t.billingStatus || 'trialing',
          trialEndsAt: t.trialEndsAt || null,
          currentPeriodEnd: t.currentPeriodEnd || null,
          suspendedAt: t.suspendedAt || null,
          suspendedReason: t.suspendedReason || null,
          createdAt: t.createdAt || null,
          usersCount,
        };
      })
    );
    return res.status(200).json(enriched);
  } catch (err) {
    console.error(err);
    return res.status(500).send(err.message || 'Error al listar tenants');
  }
}

async function suspend(req, res) {
  try {
    const reason = String(req.body?.reason || 'manual').slice(0, 200);
    const updated = await db.UpdateTenant(req.params.id, {
      billingStatus: 'suspended',
      suspendedAt: new Date(),
      suspendedReason: reason,
    });
    if (!updated) return res.status(404).send('Tenant no encontrado');
    return res.status(200).json(updated);
  } catch (err) {
    console.error(err);
    return res.status(500).send(err.message || 'Error al suspender');
  }
}

async function reactivate(req, res) {
  try {
    const mode = String(req.body?.mode || 'active'); // active | trial
    const patch = {
      suspendedAt: null,
      suspendedReason: null,
    };
    if (mode === 'trial') {
      patch.billingStatus = 'trialing';
      patch.trialEndsAt = trialEndsFrom(new Date());
    } else {
      patch.billingStatus = 'active';
      const periodEnd = new Date();
      periodEnd.setMonth(periodEnd.getMonth() + 1);
      patch.currentPeriodEnd = periodEnd;
    }
    const updated = await db.UpdateTenant(req.params.id, patch);
    if (!updated) return res.status(404).send('Tenant no encontrado');
    return res.status(200).json(updated);
  } catch (err) {
    console.error(err);
    return res.status(500).send(err.message || 'Error al reactivar');
  }
}

async function setPlan(req, res) {
  try {
    const plan = String(req.body?.plan || '');
    if (!PLANS.includes(plan)) {
      return res.status(400).send('plan debe ser basic o pro');
    }
    const updated = await db.UpdateTenant(req.params.id, { plan });
    if (!updated) return res.status(404).send('Tenant no encontrado');
    return res.status(200).json(updated);
  } catch (err) {
    console.error(err);
    return res.status(500).send(err.message || 'Error al cambiar plan');
  }
}

module.exports = { listTenants, suspend, reactivate, setPlan };
