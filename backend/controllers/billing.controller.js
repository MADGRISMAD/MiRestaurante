const db = require('../database/mongodb');
const mp = require('../services/mercadopago.service');
const { PLANS, isSubscriptionActive, trialEndsFrom } = require('../models/tenant.model');

function daysLeft(trialEndsAt) {
  if (!trialEndsAt) return 0;
  const ms = new Date(trialEndsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

async function getPlans(req, res) {
  return res.status(200).json({ plans: mp.listPlans(), mock: !mp.hasMpConfig() });
}

async function getStatus(req, res) {
  try {
    const tenant = await db.GetTenantById(req.tenantId);
    if (!tenant) return res.status(404).send('Tenant no encontrado');
    return res.status(200).json({
      plan: tenant.plan || 'basic',
      billingStatus: tenant.billingStatus || 'trialing',
      trialEndsAt: tenant.trialEndsAt || null,
      trialDaysLeft: daysLeft(tenant.trialEndsAt),
      currentPeriodEnd: tenant.currentPeriodEnd || null,
      active: isSubscriptionActive(tenant),
      mpConfigured: mp.hasMpConfig(),
      mpPreapprovalId: tenant.mpPreapprovalId || null,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).send(err.message || 'Error al leer facturación');
  }
}

async function checkout(req, res) {
  try {
    const plan = String(req.body?.plan || 'basic');
    if (!PLANS.includes(plan)) {
      return res.status(400).send('plan debe ser basic o pro');
    }

    const tenant = await db.GetTenantById(req.tenantId);
    if (!tenant) return res.status(404).send('Tenant no encontrado');

    const payerEmail =
      String(req.body?.email || '').trim() ||
      tenant.mpPayerEmail ||
      null;

    // Resolve admin email if needed
    let email = payerEmail;
    if (!email) {
      const user = await db.FindUserByUsername(req.user.username);
      email = user?.email || null;
    }
    if (!email) {
      return res.status(400).send('Email de cobro requerido');
    }

    const preapproval = await mp.createPreapproval({
      plan,
      tenantId: req.tenantId,
      payerEmail: email,
      externalReference: `${req.tenantId}:${plan}`,
    });

    await db.UpdateTenant(req.tenantId, {
      plan,
      mpPreapprovalId: preapproval.id || null,
      mpPayerEmail: email,
    });

    return res.status(200).json({
      mock: Boolean(preapproval.mock),
      preapprovalId: preapproval.id,
      init_point: preapproval.init_point || preapproval.sandbox_init_point,
      sandbox_init_point: preapproval.sandbox_init_point || preapproval.init_point,
    });
  } catch (err) {
    console.error(err);
    return res.status(err.status || 500).send(err.message || 'Error al crear checkout');
  }
}

/** Solo desarrollo: activar plan sin Mercado Pago */
async function devActivate(req, res) {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(404).send('Not found');
    }
    const plan = String(req.body?.plan || 'basic');
    if (!PLANS.includes(plan)) {
      return res.status(400).send('plan debe ser basic o pro');
    }
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const updated = await db.UpdateTenant(req.tenantId, {
      plan,
      billingStatus: 'active',
      currentPeriodEnd: periodEnd,
      suspendedAt: null,
      suspendedReason: null,
      mpPreapprovalId: req.body?.preapprovalId || `mock_dev_${Date.now()}`,
    });

    return res.status(200).json({
      ok: true,
      plan: updated.plan,
      billingStatus: updated.billingStatus,
      currentPeriodEnd: updated.currentPeriodEnd,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).send(err.message || 'Error al activar');
  }
}

async function webhook(req, res) {
  try {
    const body = req.body || {};
    const query = req.query || {};

    // MP puede mandar ?topic=subscription_preapproval&id=...
    const topic = body.type || body.topic || query.topic || query.type;
    const dataId =
      body.data?.id ||
      body.id ||
      query.id ||
      query['data.id'] ||
      null;

    if (dataId && String(topic || '').includes('preapproval')) {
      const pre = await mp.getPreapproval(dataId);
      const billingStatus = mp.mapMpStatusToBilling(pre.status);
      let tenant =
        (await db.GetTenantByMpPreapprovalId(dataId)) ||
        null;

      if (!tenant && pre.external_reference) {
        const tenantId = String(pre.external_reference).split(':')[0];
        tenant = await db.GetTenantById(tenantId);
      }

      if (tenant && billingStatus) {
        const patch = {
          billingStatus,
          mpPreapprovalId: String(dataId),
        };
        if (billingStatus === 'active') {
          const periodEnd = new Date();
          periodEnd.setMonth(periodEnd.getMonth() + 1);
          patch.currentPeriodEnd = periodEnd;
          patch.suspendedAt = null;
          patch.suspendedReason = null;
          if (pre.external_reference) {
            const plan = String(pre.external_reference).split(':')[1];
            if (PLANS.includes(plan)) patch.plan = plan;
          }
        }
        if (billingStatus === 'suspended') {
          patch.suspendedAt = new Date();
          patch.suspendedReason = 'mercado_pago';
        }
        await db.UpdateTenant(tenant.id, patch);
      }
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('MP webhook error:', err.message);
    // Siempre 200 para que MP no reintente agresivo en errores de parseo
    return res.status(200).json({ ok: false });
  }
}

module.exports = {
  getPlans,
  getStatus,
  checkout,
  devActivate,
  webhook,
  daysLeft,
  trialEndsFrom,
};
