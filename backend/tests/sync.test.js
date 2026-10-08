const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, startServer } = require('./helpers');

const { app, state, tokenFor } = loadApp();
let api;
test.before(async () => { api = await startServer(app); });
test.after(async () => { await api.close(); });

test('GET /sync exige sesión', async () => {
  assert.equal((await api.call('GET', '/sync')).status, 401);
});

test('devuelve los contadores del negocio, sin caché, para cualquier rol', async () => {
  state.sync.t1 = { orders: 7, tables: 3 };
  for (const role of ['admin', 'waiter', 'kitchen', 'cashier', 'host']) {
    const r = await api.call('GET', '/sync', { token: tokenFor('x', role) });
    assert.equal(r.status, 200, role);
    assert.deepEqual(r.json.v, { orders: 7, tables: 3, waitlist: 0, inventory: 0 }, role);
    assert.equal(typeof r.json.t, 'number');
  }
  const raw = await fetch(`${api.base}/sync`, { headers: { Authorization: tokenFor('x', 'waiter') } });
  assert.equal(raw.headers.get('cache-control'), 'no-store');
});

test('cada negocio ve solo sus contadores', async () => {
  state.sync.t1 = { orders: 7 };
  state.sync.t2 = { orders: 99, waitlist: 4 };
  const t1 = await api.call('GET', '/sync', { token: tokenFor('x', 'admin', 't1') });
  const t2 = await api.call('GET', '/sync', { token: tokenFor('y', 'admin', 't2') });
  assert.equal(t1.json.v.orders, 7);
  assert.equal(t2.json.v.orders, 99);
  assert.equal(t1.json.v.waitlist, 0);
});

test('un negocio sin cambios todavía devuelve ceros', async () => {
  delete state.sync.t1;
  const r = await api.call('GET', '/sync', { token: tokenFor('x', 'admin') });
  assert.deepEqual(r.json.v, { orders: 0, tables: 0, waitlist: 0, inventory: 0 });
});

test('el sondeo sigue respondiendo aunque la suscripción esté vencida (solo son contadores)', async () => {
  state.tenants.find((t) => t.id === 't1').billingStatus = 'suspended';
  assert.equal((await api.call('GET', '/sync', { token: tokenFor('x', 'admin') })).status, 200);
  state.tenants.find((t) => t.id === 't1').billingStatus = 'active';
});

test('la plataforma (sin negocio) no revienta', async () => {
  const { generateJWT } = require('../utils/jwt.utils');
  const token = 'Bearer ' + generateJWT({ userId: 'root', userRole: 'platform_admin' });
  const r = await api.call('GET', '/sync', { token });
  assert.equal(r.status, 200);
  assert.deepEqual(r.json.v, { orders: 0, tables: 0, waitlist: 0, inventory: 0 });
});
