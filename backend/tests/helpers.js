// Base de datos falsa en memoria + app real de Express, para probar rutas sin MongoDB.
process.env.SECRET_KEY = 'test-secret';
process.env.VERCEL = '1'; // app.js no abre puerto
process.env.NODE_ENV = 'test';

const path = require('path');
const { ObjectId } = require('mongodb');

function createFakeDb() {
  const state = { sync: {}, users: [], waiters: [], tenants: [{ id: 't1', name: 'T1', billingStatus: 'active', plan: 'basic' }, { id: 't2', name: 'T2', billingStatus: 'active', plan: 'basic' }] };
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
