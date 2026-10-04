// Prueba la capa de datos REAL (database/mongodb.js) con un driver de MongoDB simulado en memoria:
// cada escritura que cambia lo que ven las pantallas debe subir el contador correcto, solo el de su negocio.
const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';

const realMongo = require('mongodb');

function matches(doc, filter = {}) {
  return Object.entries(filter).every(([k, cond]) => {
    const v = doc[k];
    if (cond && typeof cond === 'object' && !(cond instanceof realMongo.ObjectId) && !(cond instanceof Date)) {
      if ('$exists' in cond) return (v !== undefined) === cond.$exists;
      if ('$in' in cond) return cond.$in.map(String).includes(String(v));
      return false;
    }
    return String(v) === String(cond);
  });
}
function applyUpdate(doc, update) {
  for (const [k, val] of Object.entries(update.$set || {})) doc[k] = val;
  for (const [k, val] of Object.entries(update.$inc || {})) doc[k] = (doc[k] || 0) + val;
}

const store = {};
const failing = new Set();
function collection(name) {
  const rows = (store[name] = store[name] || []);
  return {
    async insertOne(doc) { if (failing.has(name)) throw new Error('fallo simulado'); const _id = doc._id || new realMongo.ObjectId(); rows.push({ ...doc, _id }); return { insertedId: _id }; },
    async findOne(filter) { return rows.find((d) => matches(d, filter)) || null; },
    async countDocuments(filter) { return rows.filter((d) => matches(d, filter)).length; },
    async updateOne(filter, update, opts = {}) {
      if (failing.has(name)) throw new Error('fallo simulado');
      let doc = rows.find((d) => matches(d, filter));
      if (!doc && opts.upsert) { doc = { _id: filter._id }; rows.push(doc); }
      if (!doc) return { matchedCount: 0, modifiedCount: 0 };
      applyUpdate(doc, update);
      return { matchedCount: 1, modifiedCount: 1 };
    },
    async updateMany(filter, update) { const hit = rows.filter((d) => matches(d, filter)); hit.forEach((d) => applyUpdate(d, update)); return { matchedCount: hit.length, modifiedCount: hit.length }; },
    async deleteOne(filter) { const i = rows.findIndex((d) => matches(d, filter)); if (i >= 0) rows.splice(i, 1); return { deletedCount: i >= 0 ? 1 : 0 }; },
    find(filter) { let out = rows.filter((d) => matches(d, filter)); const c = { sort: () => c, limit: () => c, toArray: async () => out }; return c; },
  };
}
class FakeClient { async connect() {} db() { return { collection }; } }

const mongoPath = require.resolve('mongodb');
require.cache[mongoPath] = { id: mongoPath, filename: mongoPath, loaded: true, exports: { ...realMongo, MongoClient: FakeClient } };
const db = require('../database/mongodb');

const syncDoc = (t) => (store.sync || []).find((d) => d._id === t) || {};
const reset = () => { for (const k of Object.keys(store)) delete store[k]; failing.clear(); };

test.before(async () => { await db.ensureConnection(); });
test.beforeEach(reset);

test('GetSyncVersions devuelve ceros si el negocio no tiene cambios', async () => {
  assert.deepEqual(await db.GetSyncVersions('nuevo'), { orders: 0, tables: 0, waitlist: 0 });
});

test('mesas: crear, cambiar, borrar y cerrar suben "tables" solo del negocio', async () => {
  const mesa = await db.AddMesa({ numero: 1, nombre: 'Mesa 1', tenantId: 't1' });
  assert.equal(syncDoc('t1').tables, 1);
  await db.UpdateStatusMesa(mesa.id, { disponible: false }, 't1');
  assert.equal(syncDoc('t1').tables, 2);
  await db.CloseMesas('t1');
  assert.equal(syncDoc('t1').tables, 3);
  await db.DeleteMesa(mesa.id, 't1');
  assert.equal(syncDoc('t1').tables, 4);
  assert.deepEqual(await db.GetSyncVersions('t1'), { orders: 0, tables: 4, waitlist: 0 });
  assert.deepEqual(await db.GetSyncVersions('t2'), { orders: 0, tables: 0, waitlist: 0 }, 'otro negocio intacto');
});

test('mesas: una operación que no encuentra nada no genera un cambio falso', async () => {
  await db.AddMesa({ numero: 1, nombre: 'Mesa 1', tenantId: 't1' });
  const antes = syncDoc('t1').tables;
  await db.UpdateStatusMesa(String(new realMongo.ObjectId()), { disponible: false }, 't1');
  await db.UpdateStatusMesa('99', { disponible: false }, 't1');
  await db.DeleteMesa('99', 't1');
  assert.equal(syncDoc('t1').tables, antes);
});

test('no se puede tocar la mesa de otro negocio ni subir su contador', async () => {
  const mesa = await db.AddMesa({ numero: 1, nombre: 'Mesa 1', tenantId: 't1' });
  await db.UpdateStatusMesa(mesa.id, { disponible: false }, 't2');
  await db.DeleteMesa(mesa.id, 't2');
  assert.equal(syncDoc('t2').tables, undefined);
  assert.equal(syncDoc('t1').tables, 1);
});

test('lista de espera: agregar y quitar suben "waitlist"; quitar a alguien inexistente no', async () => {
  await db.AddWaitList({ nombre: 'Ana', telefono: '555', tenantId: 't1' });
  assert.equal(syncDoc('t1').waitlist, 1);
  await db.DeleteWaitList('000', 't1');
  assert.equal(syncDoc('t1').waitlist, 1);
  await db.DeleteWaitList('555', 't1');
  assert.equal(syncDoc('t1').waitlist, 2);
});

test('pedidos: crear y actualizar suben "orders"', async () => {
  const o = await db.CreateOrder({ tenantId: 't1', status: 'pending', items: [] });
  assert.equal(syncDoc('t1').orders, 1);
  await db.UpdateOrder(o.id, { status: 'ready' }, 't1');
  assert.equal(syncDoc('t1').orders, 2);
  assert.equal(syncDoc('t1').tables, undefined, 'no toca otros canales');
});

test('caja: abrir y cerrar sesión suben "orders" (la pantalla de caja vive de ese canal)', async () => {
  const s = await db.CreateCashSession({ tenantId: 't1', status: 'open' });
  assert.equal(syncDoc('t1').orders, 1);
  await db.UpdateCashSession(s.id, { status: 'closed' }, 't1');
  assert.equal(syncDoc('t1').orders, 2);
});

test('los contadores de cada negocio son independientes', async () => {
  await db.CreateOrder({ tenantId: 't1', items: [] });
  await db.CreateOrder({ tenantId: 't1', items: [] });
  await db.CreateOrder({ tenantId: 't2', items: [] });
  assert.equal((await db.GetSyncVersions('t1')).orders, 2);
  assert.equal((await db.GetSyncVersions('t2')).orders, 1);
});

test('si no se puede registrar el cambio, la operación original igual se completa', async () => {
  failing.add('sync');
  const original = console.error; console.error = () => {};
  try {
    const mesa = await db.AddMesa({ numero: 1, nombre: 'Mesa 1', tenantId: 't1' });
    assert.ok(mesa.id, 'la mesa se creó aunque falló el contador');
    const o = await db.CreateOrder({ tenantId: 't1', items: [] });
    assert.ok(o.id);
  } finally { console.error = original; }
});

test('sin negocio no hay contador que subir', async () => {
  await db.touchSync(undefined, 'orders');
  await db.touchSync(null, 'tables');
  assert.equal((store.sync || []).length, 0);
});
