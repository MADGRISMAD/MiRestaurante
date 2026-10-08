// Venta de mostrador (café): pide + cobra + entrega en un paso, sin mesa ni cocina.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, startServer } = require('./helpers');

const { app, state, tokenFor } = loadApp();
let api;
test.before(async () => { api = await startServer(app); });
test.after(async () => { await api.close(); });

state.foods.push(
  { id: 'f-latte', name: 'Latte', price: 40, tenantId: 't1' },
  { id: 'f-pan', name: 'Pan dulce', price: 35, tenantId: 't1' },
  { id: 'f-otro', name: 'Del vecino', price: 10, tenantId: 't2' },
);
state.settings.t1 = { businessType: 'cafe', timezone: 'America/Tijuana' };
const cashier = () => tokenFor('paco', 'cashier');
const sale = (over = {}, token = cashier()) =>
  api.call('POST', '/orders/counter', { token, body: { items: [{ foodId: 'f-latte', quantity: 2 }, { foodId: 'f-pan', quantity: 1 }], paymentMethod: 'card', ...over } });
const openCash = (tenantId = 't1') => state.cash.push({ id: `c-${tenantId}`, tenantId, status: 'open' });

test('solo admin y caja pueden vender; sin sesión no', async () => {
  assert.equal((await api.call('POST', '/orders/counter', { body: {} })).status, 401);
  for (const role of ['waiter', 'kitchen', 'host']) {
    assert.equal((await sale({}, tokenFor('x', role))).status, 403, role);
  }
});

test('con la caja cerrada no se vende', async () => {
  const r = await sale();
  assert.equal(r.status, 400);
  assert.match(r.text, /caja/i);
  assert.equal(state.orders.length, 0);
});

test('una venta en tarjeta queda cobrada y entregada, sin mesa ni cocina', async () => {
  openCash();
  const r = await sale({ customerName: ' Ana ' });
  assert.equal(r.status, 201, r.text);
  const o = r.json;
  assert.equal(o.status, 'served', 'nunca pasa por cocina');
  assert.equal(o.paymentStatus, 'paid');
  assert.equal(o.paymentMethod, 'card');
  assert.equal(o.source, 'counter');
  assert.equal(o.tableId, null);
  assert.equal(o.tableName, 'Mostrador · Ana');
  assert.equal(o.cashSessionId, 'c-t1', 'entra en el cierre de la caja abierta');
  assert.equal(o.createdBy, 'paco');
  assert.equal(o.turno, 1);
  assert.ok(o.paidAt);
  // 2 × 40 + 35 = 115; IVA 8 % = 9.20; sin costo de envío
  assert.equal(o.subtotal, 115);
  assert.equal(o.tax, 9.2);
  assert.equal(o.deliveryFee, 0);
  assert.equal(o.total, 124.2);
  assert.equal(o.change, undefined, 'en tarjeta no hay cambio');
});

test('los precios salen del menú: lo que mande el cliente se ignora', async () => {
  const r = await sale({ items: [{ foodId: 'f-latte', quantity: 1, price: 1, name: 'Gratis' }] });
  assert.equal(r.status, 201);
  assert.equal(r.json.items[0].price, 40);
  assert.equal(r.json.items[0].name, 'Latte');
  assert.equal(r.json.subtotal, 40);
});

test('efectivo: calcula el cambio, acepta exacto y rechaza si no alcanza', async () => {
  const exacto = await sale({ paymentMethod: 'cash', items: [{ foodId: 'f-latte', quantity: 1 }] });
  assert.equal(exacto.status, 201);
  assert.equal(exacto.json.amountReceived, 43.2);
  assert.equal(exacto.json.change, 0);

  const cambio = await sale({ paymentMethod: 'cash', amountReceived: 100, items: [{ foodId: 'f-latte', quantity: 1 }] });
  assert.equal(cambio.json.change, 56.8);

  const corto = await sale({ paymentMethod: 'cash', amountReceived: 20, items: [{ foodId: 'f-latte', quantity: 1 }] });
  assert.equal(corto.status, 400);
  assert.match(corto.text, /no cubre/i);
  const basura = await sale({ paymentMethod: 'cash', amountReceived: 'mucho' });
  assert.equal(basura.status, 400);
});

test('validaciones: método, carrito vacío, cantidades y productos que no existen o son de otro negocio', async () => {
  const before = state.orders.length;
  assert.equal((await sale({ paymentMethod: 'bitcoin' })).status, 400);
  assert.equal((await sale({ items: [] })).status, 400);
  assert.equal((await sale({ items: undefined })).status, 400);
  for (const quantity of [0, -1, 1.5, 100, 'x']) {
    assert.equal((await sale({ items: [{ foodId: 'f-latte', quantity }] })).status, 400, `cantidad ${quantity}`);
  }
  assert.equal((await sale({ items: [{ foodId: 'no-existe', quantity: 1 }] })).status, 400);
  assert.equal((await sale({ items: [{ foodId: 'f-otro', quantity: 1 }] })).status, 400, 'producto de otro negocio');
  assert.equal((await sale({ items: Array.from({ length: 51 }, () => ({ foodId: 'f-latte', quantity: 1 })) })).status, 400);
  assert.equal(state.orders.length, before, 'ninguna venta inválida se guarda');
});

test('el turno sube de uno en uno y cada negocio lleva el suyo', async () => {
  const antes = state.orders.filter((o) => o.tenantId === 't1').length;
  const a = await sale();
  const b = await sale();
  assert.equal(b.json.turno, a.json.turno + 1);
  assert.equal(a.json.turno, antes + 1);

  state.settings.t2 = { businessType: 'cafe' };
  openCash('t2');
  const otro = await api.call('POST', '/orders/counter', {
    token: tokenFor('z', 'cashier', 't2'),
    body: { items: [{ foodId: 'f-otro', quantity: 1 }], paymentMethod: 'card' },
  });
  assert.equal(otro.status, 201, otro.text);
  assert.equal(otro.json.turno, 1, 'el otro negocio empieza en 1');
  assert.equal(otro.json.tenantId, 't2');
});

test('doble clic o reintento con el mismo clientRef no duplica la venta ni gasta turno', async () => {
  const antes = state.orders.length;
  const body = { clientRef: 'venta-123', customerName: 'Luis' };
  const primera = await sale(body);
  const repetida = await sale(body);
  assert.equal(primera.status, 201);
  assert.equal(repetida.status, 200, 'misma venta, no una nueva');
  assert.equal(repetida.json.id, primera.json.id);
  assert.equal(repetida.json.turno, primera.json.turno);
  assert.equal(state.orders.length, antes + 1);
  const siguiente = await sale();
  assert.equal(siguiente.json.turno, primera.json.turno + 1, 'el reintento no dejó un hueco en los turnos');
});

test('dos peticiones realmente simultáneas con el mismo clientRef dejan una sola venta', async () => {
  const antes = state.orders.length;
  state.slowLookup = true; // las dos pasan la revisión previa antes de que alguna guarde
  try {
    const [a, b] = await Promise.all([sale({ clientRef: 'carrera-1' }), sale({ clientRef: 'carrera-1' })]);
    assert.deepEqual([a.status, b.status].sort(), [200, 201], 'la perdedora recibe la venta ya guardada, no un error');
    assert.equal(a.json.id, b.json.id);
  } finally { state.slowLookup = false; }
  assert.equal(state.orders.length, antes + 1);
});

test('el mismo clientRef en otro negocio es otra venta', async () => {
  state.settings.t2 = { businessType: 'cafe' };
  const r = await api.call('POST', '/orders/counter', {
    token: tokenFor('z', 'cashier', 't2'),
    body: { clientRef: 'venta-123', items: [{ foodId: 'f-otro', quantity: 1 }], paymentMethod: 'card' },
  });
  assert.equal(r.status, 201);
});

test('una suscripción vencida bloquea las ventas', async () => {
  state.tenants.find((t) => t.id === 't1').billingStatus = 'suspended';
  assert.equal((await sale()).status, 403);
  state.tenants.find((t) => t.id === 't1').billingStatus = 'active';
});

test('para llevar es solo una etiqueta: no cobra envío', async () => {
  const r = await sale({ takeaway: true, items: [{ foodId: 'f-latte', quantity: 1 }] });
  assert.equal(r.json.modality, 'takeaway');
  assert.equal(r.json.deliveryFee, 0);
  assert.equal(r.json.total, 43.2);
});
