// Prueba la capa de datos REAL (database/mongodb.js) con un driver de MongoDB simulado en memoria:
// cada escritura que cambia lo que ven las pantallas debe subir el contador correcto, solo el de su negocio.
const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';

const realMongo = require('mongodb');

const valuesAt = (doc, path) => path.split('.').reduce((acc, key) => acc.flatMap((x) => (Array.isArray(x) ? x : [x]).map((y) => y?.[key])), [doc]).flat();
function matches(doc, filter = {}) {
  return Object.entries(filter).every(([k, cond]) => {
    if (k === '$or') return cond.some((f) => matches(doc, f));
    if (k.includes('.')) return valuesAt(doc, k).some((v) => String(v) === String(cond));
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
    async findOneAndUpdate(filter, update, opts = {}) {
      let doc = rows.find((d) => matches(d, filter));
      if (!doc && opts.upsert) { doc = { _id: filter._id }; rows.push(doc); }
      if (!doc) return null;
      const before = JSON.parse(JSON.stringify(doc));
      before._id = doc._id;
      applyUpdate(doc, update);
      return opts.returnDocument === 'before' ? before : { ...doc };
    },
    async createIndex() { return 'ok'; },
    find(filter) {
      let out = rows.filter((d) => matches(d, filter));
      const c = {
        sort: (spec) => { const [[k, dir]] = Object.entries(spec); out = [...out].sort((a, b) => (a[k] > b[k] ? 1 : a[k] < b[k] ? -1 : 0) * dir); return c; },
        limit: (n) => { out = out.slice(0, n); return c; },
        toArray: async () => out,
      };
      return c;
    },
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
  assert.deepEqual(await db.GetSyncVersions('nuevo'), { orders: 0, tables: 0, waitlist: 0, inventory: 0 });
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
  assert.deepEqual(await db.GetSyncVersions('t1'), { orders: 0, tables: 4, waitlist: 0, inventory: 0 });
  assert.deepEqual(await db.GetSyncVersions('t2'), { orders: 0, tables: 0, waitlist: 0, inventory: 0 }, 'otro negocio intacto');
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


// ——— Inventario (capa de datos real) ———
const ingredient = (over = {}) => ({ tenantId: 't1', name: 'Leche', unit: 'ml', stock: 0, minStock: 0, ...over });
const movements = () => store.stock_movements || [];

test('ingredientes: crear sube "inventory", se lista por nombre y solo el del negocio', async () => {
  await db.CreateIngredient(ingredient({ name: 'Zarzamora' }));
  await db.CreateIngredient(ingredient({ name: 'Azúcar' }));
  await db.CreateIngredient(ingredient({ name: 'Ajeno', tenantId: 't2' }));
  assert.equal(syncDoc('t1').inventory, 2);
  assert.equal(syncDoc('t2').inventory, 1);
  assert.deepEqual((await db.GetIngredients('t1')).map((i) => i.name), ['Azúcar', 'Zarzamora']);
  assert.deepEqual((await db.GetIngredients('t2')).map((i) => i.name), ['Ajeno']);
});

test('AdjustStock: suma o resta de forma atómica, deja su movimiento y sube "inventory"', async () => {
  const leche = await db.CreateIngredient(ingredient({ stock: 10 }));
  const antes = syncDoc('t1').inventory;
  const r = await db.AdjustStock('t1', leche.id, -4, { type: 'sale', orderId: 'o1', by: 'paco' });
  assert.equal(r.stock, 6);
  assert.equal(syncDoc('t1').inventory, antes + 1);
  assert.deepEqual(movements().map((m) => [m.type, m.delta, m.stockAfter, m.orderId, m.by, m.ingredientName, m.unit]), [['sale', -4, 6, 'o1', 'paco', 'Leche', 'ml']]);

  const negativo = await db.AdjustStock('t1', leche.id, -10, { type: 'sale' });
  assert.equal(negativo.stock, -4, 'puede quedar en negativo: una venta nunca se bloquea');
  assert.equal((await db.GetIngredientById(leche.id, 't1')).stock, -4);
});

test('AdjustStock: otro negocio o un id inválido no tocan nada ni dejan rastro', async () => {
  const leche = await db.CreateIngredient(ingredient({ stock: 10 }));
  const antes = { sync: syncDoc('t1').inventory, mov: movements().length };
  assert.equal(await db.AdjustStock('t2', leche.id, -5, { type: 'waste' }), null);
  assert.equal(await db.AdjustStock('t1', 'no-es-un-id', -5, { type: 'waste' }), null);
  assert.equal(await db.AdjustStock('t1', String(new realMongo.ObjectId()), -5, { type: 'waste' }), null);
  assert.equal((await db.GetIngredientById(leche.id, 't1')).stock, 10);
  assert.equal(movements().length, antes.mov);
  assert.equal(syncDoc('t1').inventory, antes.sync);
});

test('los decimales no acumulan basura de coma flotante', async () => {
  const x = await db.CreateIngredient(ingredient({ name: 'Crema', unit: 'l', stock: 0.1 }));
  const r = await db.AdjustStock('t1', x.id, 0.2, { type: 'restock' });
  assert.equal(r.stock, 0.3);
  assert.equal((await db.GetIngredients('t1')).find((i) => i.name === 'Crema').stock, 0.3);
  assert.equal(movements().at(-1).stockAfter, 0.3);
});

test('SetStock (conteo físico): fija la existencia y el movimiento guarda la diferencia real', async () => {
  const x = await db.CreateIngredient(ingredient({ name: 'Café', unit: 'g', stock: 500 }));
  const r = await db.SetStock('t1', x.id, 420, { by: 'ana', note: 'Conteo del lunes' });
  assert.equal(r.stock, 420);
  assert.equal((await db.GetIngredientById(x.id, 't1')).stock, 420);
  const m = movements().at(-1);
  assert.deepEqual([m.type, m.delta, m.stockAfter, m.note], ['adjust', -80, 420, 'Conteo del lunes']);
  assert.equal(await db.SetStock('t2', x.id, 1), null, 'otro negocio no puede contar este ingrediente');
  assert.equal((await db.GetIngredientById(x.id, 't1')).stock, 420);
});

test('UpdateIngredient: nunca cambia la existencia ni el negocio', async () => {
  const x = await db.CreateIngredient(ingredient({ name: 'Té', stock: 7 }));
  const r = await db.UpdateIngredient(x.id, { name: 'Té verde', stock: 9999, tenantId: 't2', minStock: 3 }, 't1');
  assert.deepEqual([r.name, r.stock, r.minStock], ['Té verde', 7, 3]);
  assert.equal(store.ingredients.find((i) => String(i._id) === x.id).tenantId, 't1');
  assert.equal(await db.UpdateIngredient(x.id, { name: 'Hack' }, 't2'), null);
});

test('DeleteIngredient: borra solo el propio y solo entonces sube "inventory"', async () => {
  const x = await db.CreateIngredient(ingredient({ name: 'Menta' }));
  const antes = syncDoc('t1').inventory;
  assert.equal((await db.DeleteIngredient(x.id, 't2')).deletedCount, 0);
  assert.equal(syncDoc('t1').inventory, antes);
  assert.equal(syncDoc('t2').inventory, undefined, 'intentar borrar sin éxito no cuenta como un cambio de nadie');
  assert.equal((await db.DeleteIngredient(x.id, 't1')).deletedCount, 1);
  assert.equal(syncDoc('t1').inventory, antes + 1);
});

test('CountFoodsUsingIngredient: cuenta receta y extras, una vez por platillo y solo del negocio', async () => {
  const id = 'ing-1';
  store.foods = [
    { tenantId: 't1', name: 'Latte', recipe: [{ ingredientId: id, quantity: 1 }], extras: [{ ingredientId: id, amount: 1 }] }, // en ambos: cuenta 1
    { tenantId: 't1', name: 'Mocha', recipe: [], extras: [{ ingredientId: id, amount: 1 }] },
    { tenantId: 't1', name: 'Té', recipe: [{ ingredientId: 'otro', quantity: 1 }], extras: [] },
    { tenantId: 't2', name: 'Ajeno', recipe: [{ ingredientId: id, quantity: 1 }], extras: [] },
  ];
  assert.equal(await db.CountFoodsUsingIngredient(id, 't1'), 2);
  assert.equal(await db.CountFoodsUsingIngredient(id, 't2'), 1);
  assert.equal(await db.CountFoodsUsingIngredient('nadie', 't1'), 0);
});

test('GetStockMovements: lo más reciente primero, por ingrediente, con tope y solo del negocio', async () => {
  const a = await db.CreateIngredient(ingredient({ name: 'A' }));
  const b = await db.CreateIngredient(ingredient({ name: 'B' }));
  const c = await db.CreateIngredient(ingredient({ name: 'C', tenantId: 't2' }));
  for (let i = 1; i <= 4; i++) { await db.AdjustStock('t1', a.id, i, { type: 'restock' }); await new Promise((r) => setTimeout(r, 2)); }
  await db.AdjustStock('t1', b.id, 1, { type: 'restock' });
  await db.AdjustStock('t2', c.id, 1, { type: 'restock' });
  const soloA = await db.GetStockMovements('t1', { ingredientId: a.id });
  assert.deepEqual(soloA.map((m) => m.delta), [4, 3, 2, 1], 'más reciente primero');
  assert.equal((await db.GetStockMovements('t1', { limit: 2 })).length, 2);
  assert.ok((await db.GetStockMovements('t1')).every((m) => m.tenantId === 't1'));
});

test('UpdateFood: un platillo nunca cambia de negocio', async () => {
  const f = await db.CreateFood({ name: 'Latte', price: 50, menuId: 'm', tenantId: 't1' });
  const r = await db.UpdateFood(f.id, { price: 60, tenantId: 't2' }, 't1');
  assert.equal(r.price, 60);
  assert.equal(store.foods.find((x) => String(x._id) === f.id).tenantId, 't1');
  assert.equal(await db.UpdateFood(f.id, { price: 1 }, 't2'), null);
});
