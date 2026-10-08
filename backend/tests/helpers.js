// Base de datos falsa en memoria + app real de Express, para probar rutas sin MongoDB.
process.env.SECRET_KEY = 'test-secret';
process.env.VERCEL = '1'; // app.js no abre puerto
process.env.NODE_ENV = 'test';

const path = require('path');
const { ObjectId } = require('mongodb');

function createFakeDb() {
  const state = { ingredients: [], movements: [], menus: [], failAdjust: new Set(), settings: {}, cash: [], foods: [], orders: [], counters: {}, invites: [], sync: {}, users: [], waiters: [], tenants: [{ id: 't1', name: 'T1', billingStatus: 'active', plan: 'basic' }, { id: 't2', name: 'T2', billingStatus: 'active', plan: 'basic' }] };
  const pub = (u) => { const rest = { ...u }; delete rest.password; delete rest.resetToken; delete rest.resetExpires; return { ...rest, id: String(u._id) }; };
  const impl = {
    ensureConnection: async () => {},
    GetSyncVersions: async (tenantId) => ({ orders: 0, tables: 0, waitlist: 0, inventory: 0, ...(state.sync[tenantId] || {}) }),
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
    GetFoodById: async (id, t) => state.foods.find((f) => f.id === id && f.tenantId === t) || null,
    GetMenuById: async (id, t) => state.menus.find((m) => m.id === id && m.tenantId === t) || null,
    CreateFood: async (d) => { const f = { ...d, id: String(new ObjectId()) }; state.foods.push(f); return f; },
    UpdateFood: async (id, patch, t) => { const f = state.foods.find((x) => x.id === id && x.tenantId === t); if (!f) return null; const clean = { ...patch }; delete clean.id; delete clean._id; delete clean.tenantId; Object.assign(f, clean); return f; },
    GetOrderById: async (id, t) => state.orders.find((o) => o.id === id && o.tenantId === t) || null,
    UpdateOrder: async (id, patch, t) => { const o = state.orders.find((x) => x.id === id && x.tenantId === t); if (!o) return null; Object.assign(o, patch); return o; },
    // —— inventario (misma semántica que database/mongodb.js)
    GetIngredients: async (t) => state.ingredients.filter((i) => i.tenantId === t).sort((a, b) => a.name.localeCompare(b.name)),
    GetIngredientById: async (id, t) => state.ingredients.find((i) => i.id === id && i.tenantId === t) || null,
    CreateIngredient: async (d) => { const i = { ...d, id: String(new ObjectId()) }; state.ingredients.push(i); return i; },
    UpdateIngredient: async (id, patch, t) => { const i = state.ingredients.find((x) => x.id === id && x.tenantId === t); if (!i) return null; const clean = { ...patch }; delete clean.id; delete clean.tenantId; delete clean.stock; Object.assign(i, clean); return i; },
    DeleteIngredient: async (id, t) => { const n = state.ingredients.length; state.ingredients = state.ingredients.filter((i) => !(i.id === id && i.tenantId === t)); return { deletedCount: n - state.ingredients.length }; },
    CountFoodsUsingIngredient: async (id, t) => state.foods.filter((f) => f.tenantId === t && ((f.recipe || []).some((l) => l.ingredientId === String(id)) || (f.extras || []).some((l) => l.ingredientId === String(id)))).length,
    AdjustStock: async (t, id, delta, meta = {}) => {
      if (state.failAdjust.has(String(id))) throw new Error('fallo simulado de inventario');
      const i = state.ingredients.find((x) => x.id === String(id) && x.tenantId === t); if (!i) return null;
      i.stock = Math.round((i.stock + delta + Number.EPSILON) * 1000) / 1000;
      state.movements.push({ id: String(state.movements.length + 1), tenantId: t, ingredientId: i.id, ingredientName: i.name, unit: i.unit, type: meta.type, delta, stockAfter: i.stock, orderId: meta.orderId || null, note: meta.note || '', by: meta.by || null, at: new Date(Date.now() + state.movements.length) });
      state.sync[t] = { ...(state.sync[t] || {}), inventory: ((state.sync[t] || {}).inventory || 0) + 1 };
      return i;
    },
    SetStock: async (t, id, counted, meta = {}) => {
      const i = state.ingredients.find((x) => x.id === String(id) && x.tenantId === t); if (!i) return null;
      const before = i.stock; i.stock = counted;
      state.movements.push({ id: String(state.movements.length + 1), tenantId: t, ingredientId: i.id, ingredientName: i.name, unit: i.unit, type: 'adjust', delta: Math.round((counted - before) * 1000) / 1000, stockAfter: counted, orderId: null, note: meta.note || '', by: meta.by || null, at: new Date(Date.now() + state.movements.length) });
      return i;
    },
    GetStockMovements: async (t, { ingredientId, limit = 50 } = {}) => state.movements.filter((m) => m.tenantId === t && (!ingredientId || m.ingredientId === ingredientId)).sort((a, b) => b.at - a.at).slice(0, limit),
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
