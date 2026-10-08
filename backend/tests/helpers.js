// Base de datos falsa en memoria + app real de Express, para probar rutas sin MongoDB.
process.env.SECRET_KEY = 'test-secret';
process.env.VERCEL = '1'; // app.js no abre puerto
process.env.NODE_ENV = 'test';

const path = require('path');
const { ObjectId } = require('mongodb');

function createFakeDb() {
  const state = { settings: {}, cash: [], foods: [], orders: [], counters: {}, invites: [], sync: {}, users: [], waiters: [], tenants: [{ id: 't1', name: 'T1', billingStatus: 'active', plan: 'basic' }, { id: 't2', name: 'T2', billingStatus: 'active', plan: 'basic' }] };
  const pub = (u) => { const rest = { ...u }; delete rest.password; delete rest.resetToken; delete rest.resetExpires; return { ...rest, id: String(u._id) }; };
  const impl = {
    ensureConnection: async () => {},
    GetSyncVersions: async (tenantId) => ({ orders: 0, tables: 0, waitlist: 0, ...(state.sync[tenantId] || {}) }),
    GetTenantById: async (id) => state.tenants.find((t) => t.id === id) || null,
    FindUserByUsername: async (username, tenantId) => state.users.find((u) => u.username === username && (!tenantId || u.tenantId === tenantId)) || null,
    FindUserByEmail: async (email) => state.users.find((u) => u.email === email) || null,
    GetUsersByTenant: async (tenantId) => state.users.filter((u) => u.tenantId === tenantId).map(pub),
    GetUserByIdAndTenant: async (id, tenantId) => state.users.find((u) => String(u._id) === String(id) && u.tenantId === tenantId) || null,
    CountUsersByRole: async (tenantId, role) => state.users.filter((u) => u.tenantId === tenantId && u.role === role).length,
    CreateUser: async (doc) => { const _id = new ObjectId(); state.users.push({ ...doc, _id }); return { insertedId: _id }; },
    UpdateUserById: async (id, data) => { const u = state.users.find((x) => String(x._id) === String(id)); if (!u) return null; Object.assign(u, data); return u; },
    DeleteUserByIdAndTenant: async (id, tenantId) => { const n = state.users.length; state.users = state.users.filter((u) => !(String(u._id) === String(id) && u.tenantId === tenantId)); return { deletedCount: n - state.users.length }; },
    GetWaiterByCellphone: async (c, tenantId) => state.waiters.find((w) => w.cellphone === c && w.tenantId === tenantId) || null,
    AddWaiter: async (w) => { state.waiters.push(w); return { insertedId: new ObjectId() }; },
    // —— ajustes, caja, menú, pedidos e invitaciones (modo mostrador / café)
    GetSettings: async (t) => state.settings[t] || null,
    CreateSettings: async (d) => { state.settings[d.tenantId] = { ...d }; return state.settings[d.tenantId]; },
    UpdateSettings: async (d, t) => { state.settings[t] = { ...(state.settings[t] || {}), ...d }; return state.settings[t]; },
    CountUsersByTenant: async (t) => state.users.filter((u) => u.tenantId === t).length,
    GetOpenCashSession: async (t) => state.cash.find((c) => c.tenantId === t && c.status === 'open') || null,
    GetFoods: async (t) => state.foods.filter((f) => f.tenantId === t),
    GetOrderByClientRef: async (t, ref) => { const found = state.orders.find((o) => o.tenantId === t && o.clientRef === ref) || null; if (state.slowLookup) await new Promise((r) => setTimeout(r, 25)); return found; },

    NextCounter: async (t, key) => { const k = `${t}:${key}`; state.counters[k] = (state.counters[k] || 0) + 1; return state.counters[k]; },
    CreateOrder: async (d) => {
      // Igual que el índice único real: dos ventas con el mismo clientRef no pueden coexistir.
      if (d.clientRef && state.orders.some((o) => o.tenantId === d.tenantId && o.clientRef === d.clientRef)) { const e = new Error('E11000 duplicate key'); e.code = 11000; throw e; }
      const o = { ...d, id: String(new ObjectId()) }; state.orders.push(o); return o;
    },
    GetInvites: async (t) => state.invites.filter((i) => i.tenantId === t),
    CreateInvite: async (d) => { const i = { ...d, id: String(new ObjectId()) }; state.invites.push(i); return i; },
    GetInviteByToken: async (token) => state.invites.find((i) => i.token === token) || null,
    UpdateInvite: async (id, data, t) => { const i = state.invites.find((x) => x.id === id && x.tenantId === t); if (!i) return null; Object.assign(i, data); return i; },
    DeleteWaiter: async (c, tenantId) => { state.waiters = state.waiters.filter((w) => !(w.cellphone === c && w.tenantId === tenantId)); return {}; },
  };
  // Cualquier otra función de la base que se use por accidente falla de forma explícita.
  const db = new Proxy(impl, { get: (t, k) => (k in t ? t[k] : () => { throw new Error(`db.${String(k)} no está simulada en el test`); }) });
  return { db, state };
}

function loadApp() {
  const { db, state } = createFakeDb();
  const dbPath = require.resolve(path.join(__dirname, '..', 'database', 'mongodb.js'));
  require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: db };
  const app = require('../app');
  const { generateJWT } = require('../utils/jwt.utils');
  const tokenFor = (username, role, tenantId = 't1') => 'Bearer ' + generateJWT({ userId: username, userRole: role, tenantId });
  return { app, state, tokenFor };
}

async function startServer(app) {
  const server = require('http').createServer(app);
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, url, { token, body } = {}) => {
    const res = await fetch(base + url, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: token } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* texto plano */ }
    return { status: res.status, json, text };
  };
  return { call, base, close: () => new Promise((r) => server.close(r)) };
}

module.exports = { loadApp, startServer };
