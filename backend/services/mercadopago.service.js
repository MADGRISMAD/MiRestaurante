/**
 * Mercado Pago Preapproval (suscripciones) — con fallback mock sin token.
 */
const MP_API = 'https://api.mercadopago.com';

function hasMpConfig() {
  return Boolean(process.env.MP_ACCESS_TOKEN);
}

function planPrice(plan) {
  if (plan === 'pro') {
    return Number(process.env.MP_PLAN_PRO_PRICE || 1499);
  }
  return Number(process.env.MP_PLAN_BASIC_PRICE || 799);
}

function planLabel(plan) {
  return plan === 'pro' ? 'MiRestaurante Pro' : 'MiRestaurante Básico';
}

function listPlans() {
  const currency = process.env.MP_CURRENCY || 'MXN';
  return [
    {
      id: 'basic',
      name: 'Básico',
      price: planPrice('basic'),
      currency,
      description: '1 local, mesas, cocina, caja e impresión',
    },
    {
      id: 'pro',
      name: 'Pro',
      price: planPrice('pro'),
      currency,
      description: 'Todo lo básico + prioridad de soporte y reportes próximos',
    },
  ];
}

async function createPreapproval({ plan, tenantId, payerEmail, externalReference }) {
  const appUrl = (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '');
  const apiUrl = (process.env.API_PUBLIC_URL || `http://localhost:${process.env.PORT || 8081}`).replace(
    /\/$/,
    ''
  );
  const amount = planPrice(plan);
  const currency = process.env.MP_CURRENCY || 'MXN';

  if (!hasMpConfig()) {
    return {
      mock: true,
      id: `mock_${tenantId}_${plan}_${Date.now()}`,
      init_point: `${appUrl}/billing?mock=1&plan=${plan}`,
      sandbox_init_point: `${appUrl}/billing?mock=1&plan=${plan}`,
      status: 'pending',
    };
  }

  const body = {
    reason: planLabel(plan),
    external_reference: externalReference || `${tenantId}:${plan}`,
    payer_email: payerEmail,
    auto_recurring: {
      frequency: 1,
      frequency_type: 'months',
      transaction_amount: amount,
      currency_id: currency,
    },
    back_url: `${appUrl}/billing?mp=return`,
    status: 'pending',
    notification_url: `${apiUrl}/billing/webhook`,
  };

  const res = await fetch(`${MP_API}/preapproval`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.message || data.error || `Mercado Pago error ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.details = data;
    throw err;
  }

  return data;
}

async function getPreapproval(id) {
  if (!hasMpConfig() || String(id).startsWith('mock_')) {
    return { id, status: 'authorized' };
  }
  const res = await fetch(`${MP_API}/preapproval/${id}`, {
    headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || 'No se pudo leer preapproval');
    err.status = res.status;
    throw err;
  }
  return data;
}

function mapMpStatusToBilling(mpStatus) {
  const s = String(mpStatus || '').toLowerCase();
  if (s === 'authorized' || s === 'active') return 'active';
  if (s === 'paused') return 'past_due';
  if (s === 'cancelled' || s === 'canceled') return 'suspended';
  return null;
}

module.exports = {
  hasMpConfig,
  planPrice,
  planLabel,
  listPlans,
  createPreapproval,
  getPreapproval,
  mapMpStatusToBilling,
};
