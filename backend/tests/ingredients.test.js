// Inventario: ingredientes, existencias y movimientos.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, startServer } = require('./helpers');

const { app, state, tokenFor } = loadApp();
let api;
test.before(async () => { api = await startServer(app); });
test.after(async () => { await api.close(); });

const admin = () => tokenFor('ana', 'admin');
const cashier = () => tokenFor('paco', 'cashier');
const create = (body, token = admin()) => api.call('POST', '/ingredients', { token, body });
const reset = () => { state.ingredients = []; state.movements = []; state.foods = []; };
const stockOf = (id) => state.ingredients.find((i) => i.id === id).stock;

test('quién puede ver y quién puede cambiar el inventario', async () => {
  reset();
  assert.equal((await api.call('GET', '/ingredients')).status, 401);
  for (const role of ['waiter', 'kitchen', 'host']) {
    assert.equal((await api.call('GET', '/ingredients', { token: tokenFor('x', role) })).status, 403, role);
  }
  assert.equal((await api.call('GET', '/ingredients', { token: cashier() })).status, 200, 'la caja puede ver qué falta');

  const leche = (await create({ name: 'Leche', unit: 'ml', stock: 1000 })).json;
  for (const [method, path, body] of [
    ['POST', '/ingredients', { name: 'X', unit: 'pza' }],
    ['PUT', `/ingredients/${leche.id}`, { name: 'Y' }],
    ['DELETE', `/ingredients/${leche.id}`],
    ['POST', `/ingredients/${leche.id}/stock`, { type: 'restock', quantity: 1 }],
    ['GET', '/ingredients/movements'],
  ]) {
    assert.equal((await api.call(method, path, { token: cashier(), body })).status, 403, `la caja no puede ${method} ${path}`);
  }
  assert.equal(state.ingredients.length, 1, 'nada cambió');
});

test('crear: existencia inicial con su movimiento, y valores por defecto', async () => {
  reset();
  const r = await create({ name: '  Leche entera ', unit: 'ml', stock: 5000, minStock: 1000 });
  assert.equal(r.status, 201, r.text);
  assert.deepEqual({ ...r.json }, { id: r.json.id, name: 'Leche entera', unit: 'ml', stock: 5000, minStock: 1000, status: 'ok' });
  assert.equal(state.movements.length, 1);
  assert.equal(state.movements[0].type, 'restock');
  assert.equal(state.movements[0].note, 'Existencia inicial');
  assert.equal(state.movements[0].by, 'ana');

  const sinStock = await create({ name: 'Vasos', unit: 'pza' });
  assert.equal(sinStock.status, 201);
  assert.equal(sinStock.json.stock, 0);
  assert.equal(sinStock.json.status, 'out', 'sin existencia = agotado');
  assert.equal(state.movements.length, 1, 'sin existencia inicial no hay movimiento');
});

test('crear: validaciones y nombre repetido (sin importar mayúsculas)', async () => {
  reset();
  for (const [body, re] of [
    [{ unit: 'ml' }, /nombre/i],
    [{ name: '   ', unit: 'ml' }, /nombre/i],
    [{ name: 'X'.repeat(61), unit: 'ml' }, /largo/i],
    [{ name: 'Leche' }, /unidad/i],
    [{ name: 'Leche', unit: 'galones' }, /unidad/i],
    [{ name: 'Leche', unit: 'ml', stock: -1 }, /negativa/i],
    [{ name: 'Leche', unit: 'ml', minStock: -5 }, /negativo/i],
    [{ name: 'Leche', unit: 'ml', stock: 'mucho' }, /número/i],
  ]) {
    const r = await create(body);
    assert.equal(r.status, 400, JSON.stringify(body));
    assert.match(r.text, re);
  }
  assert.equal(state.ingredients.length, 0);

  assert.equal((await create({ name: 'Leche', unit: 'ml' })).status, 201);
  const dup = await create({ name: ' LECHE ', unit: 'l' });
  assert.equal(dup.status, 400);
  assert.match(dup.text, /Ya tienes/);
  assert.equal(state.ingredients.length, 1);
});

test('cada negocio ve y toca solo lo suyo', async () => {
  reset();
  const mio = (await create({ name: 'Leche', unit: 'ml', stock: 100 })).json;
  const ajeno = tokenFor('z', 'admin', 't2');
  const suyo = (await create({ name: 'Leche', unit: 'ml', stock: 7 }, ajeno)).json;
  assert.equal(suyo.stock, 7, 'el mismo nombre en otro negocio sí se puede');

  assert.deepEqual((await api.call('GET', '/ingredients', { token: ajeno })).json.map((i) => i.id), [suyo.id]);
  assert.equal((await api.call('PUT', `/ingredients/${mio.id}`, { token: ajeno, body: { name: 'Hack' } })).status, 404);
  assert.equal((await api.call('DELETE', `/ingredients/${mio.id}`, { token: ajeno })).status, 404);
  assert.equal((await api.call('POST', `/ingredients/${mio.id}/stock`, { token: ajeno, body: { type: 'waste', quantity: 50 } })).status, 404);
  assert.equal(stockOf(mio.id), 100, 'no se tocó');
  assert.equal(state.ingredients.find((i) => i.id === mio.id).name, 'Leche');
});

test('estado de existencia: ok, por agotarse y agotado (incluye negativos)', async () => {
  reset();
  const mk = async (name, stock, minStock) => (await create({ name, unit: 'pza', stock, minStock })).json;
  await mk('Bien', 100, 10);
  await mk('En el mínimo', 10, 10);
  await mk('Bajo', 4, 10);
  await mk('Sin mínimo', 1, 0);
  const cero = await mk('Cero', 0, 10);
  state.ingredients.find((i) => i.id === cero.id).stock = -3; // se vendió sin tener
  const byName = Object.fromEntries((await api.call('GET', '/ingredients', { token: admin() })).json.map((i) => [i.name, i.status]));
  assert.deepEqual(byName, { Bien: 'ok', 'En el mínimo': 'low', Bajo: 'low', 'Sin mínimo': 'ok', Cero: 'out' });
});

test('entrada, merma y conteo: suman, restan, fijan y dejan registro', async () => {
  reset();
  const leche = (await create({ name: 'Leche', unit: 'l', stock: 10 })).json;
  const op = (body) => api.call('POST', `/ingredients/${leche.id}/stock`, { token: admin(), body });

  assert.equal((await op({ type: 'restock', quantity: 5, note: 'Compra del lunes' })).json.stock, 15);
  assert.equal((await op({ type: 'waste', quantity: 2, note: 'Se echó a perder' })).json.stock, 13);
  const conteo = await op({ type: 'adjust', quantity: 12 });
  assert.equal(conteo.json.stock, 12);

  const mov = state.movements.map((m) => [m.type, m.delta, m.stockAfter]);
  assert.deepEqual(mov, [['restock', 10, 10], ['restock', 5, 15], ['waste', -2, 13], ['adjust', -1, 12]], 'el conteo registra la diferencia real');
  assert.equal(state.movements[1].note, 'Compra del lunes');

  const listed = (await api.call('GET', `/ingredients/movements?ingredientId=${leche.id}`, { token: admin() })).json;
  assert.equal(listed[0].type, 'adjust', 'lo más reciente primero');
  assert.equal(listed.length, 4);
});

test('movimientos inválidos no cambian nada', async () => {
  reset();
  const leche = (await create({ name: 'Leche', unit: 'l', stock: 10 })).json;
  const before = state.movements.length;
  for (const body of [
    { type: 'restock', quantity: 0 },
    { type: 'waste', quantity: 0 },
    { type: 'restock', quantity: -4 },
    { type: 'robo', quantity: 1 },
    { type: 'restock' },
    { type: 'restock', quantity: 'x' },
    { quantity: 3 },
  ]) {
    const r = await api.call('POST', `/ingredients/${leche.id}/stock`, { token: admin(), body });
    assert.equal(r.status, 400, JSON.stringify(body));
  }
  assert.equal(stockOf(leche.id), 10);
  assert.equal(state.movements.length, before);
  assert.equal((await api.call('POST', '/ingredients/no-existe/stock', { token: admin(), body: { type: 'restock', quantity: 1 } })).status, 404);
  const conteoCero = await api.call('POST', `/ingredients/${leche.id}/stock`, { token: admin(), body: { type: 'adjust', quantity: 0 } });
  assert.equal(conteoCero.status, 200, 'contar cero es válido (se acabó)');
  assert.equal(conteoCero.json.status, 'out');
});

test('los decimales no arrastran basura de coma flotante', async () => {
  reset();
  const x = (await create({ name: 'Crema', unit: 'l', stock: 0.1 })).json;
  const r = await api.call('POST', `/ingredients/${x.id}/stock`, { token: admin(), body: { type: 'restock', quantity: 0.2 } });
  assert.equal(r.json.stock, 0.3, 'no 0.30000000000000004');
});

test('la merma puede dejar la existencia en negativo y se marca agotado', async () => {
  reset();
  const x = (await create({ name: 'Pan', unit: 'pza', stock: 2 })).json;
  const r = await api.call('POST', `/ingredients/${x.id}/stock`, { token: admin(), body: { type: 'waste', quantity: 5 } });
  assert.equal(r.json.stock, -3);
  assert.equal(r.json.status, 'out');
});

test('editar: renombrar, mínimo, nombre repetido; la existencia no se cambia por aquí', async () => {
  reset();
  const a = (await create({ name: 'Leche', unit: 'ml', stock: 100 })).json;
  const b = (await create({ name: 'Azúcar', unit: 'sobre', stock: 50 })).json;
  const put = (id, body) => api.call('PUT', `/ingredients/${id}`, { token: admin(), body });

  const ok = await put(a.id, { name: 'Leche entera', minStock: 20, stock: 99999, tenantId: 't2' });
  assert.equal(ok.status, 200, ok.text);
  assert.equal(ok.json.name, 'Leche entera');
  assert.equal(ok.json.minStock, 20);
  assert.equal(ok.json.stock, 100, 'la existencia solo cambia con movimientos');
  assert.equal(state.ingredients.find((i) => i.id === a.id).tenantId, 't1');

  assert.equal((await put(b.id, { name: 'leche ENTERA' })).status, 400, 'nombre repetido');
  assert.equal((await put(a.id, { name: 'Leche entera' })).status, 200, 'dejar su propio nombre no es repetido');
  assert.equal((await put(a.id, { unit: 'galones' })).status, 400);
  assert.equal((await put('no-existe', { name: 'X' })).status, 404);
});

test('no se puede cambiar la unidad ni borrar un ingrediente que está en una receta o es un extra', async () => {
  reset();
  const leche = (await create({ name: 'Leche', unit: 'ml', stock: 100 })).json;
  const lavanda = (await create({ name: 'Lavanda', unit: 'pump', stock: 100 })).json;
  const libre = (await create({ name: 'Servilletas', unit: 'pza', stock: 100 })).json;
  state.foods.push({ id: 'f1', tenantId: 't1', name: 'Latte', recipe: [{ ingredientId: leche.id, quantity: 240 }], extras: [{ ingredientId: lavanda.id, label: 'Lavanda', amount: 1, price: 5, max: 8 }] });

  for (const ing of [leche, lavanda]) {
    const unit = await api.call('PUT', `/ingredients/${ing.id}`, { token: admin(), body: { unit: 'pza' } });
    assert.equal(unit.status, 400, `cambiar unidad de ${ing.name}`);
    assert.match(unit.text, /se usa en 1 producto/);
    const del = await api.call('DELETE', `/ingredients/${ing.id}`, { token: admin() });
    assert.equal(del.status, 400, `borrar ${ing.name}`);
    assert.match(del.text, /se usa en 1 producto/);
  }
  assert.equal(state.ingredients.length, 3);
  assert.equal((await api.call('PUT', `/ingredients/${libre.id}`, { token: admin(), body: { unit: 'kg' } })).status, 200, 'sin uso sí se puede');
  assert.equal((await api.call('DELETE', `/ingredients/${libre.id}`, { token: admin() })).status, 200);
  assert.equal(state.ingredients.length, 2);
});

test('el historial de movimientos: más reciente primero, por ingrediente y con tope', async () => {
  reset();
  const a = (await create({ name: 'A', unit: 'pza', stock: 1 })).json;
  const b = (await create({ name: 'B', unit: 'pza', stock: 1 })).json;
  for (let i = 0; i < 5; i++) await api.call('POST', `/ingredients/${a.id}/stock`, { token: admin(), body: { type: 'restock', quantity: 1 } });
  const all = (await api.call('GET', '/ingredients/movements?limit=3', { token: admin() })).json;
  assert.equal(all.length, 3);
  const soloB = (await api.call('GET', `/ingredients/movements?ingredientId=${b.id}`, { token: admin() })).json;
  assert.ok(soloB.every((m) => m.ingredientId === b.id));
  assert.equal((await api.call('GET', '/ingredients/movements?ingredientId=zzz', { token: admin() })).status, 400);
  const otro = (await api.call('GET', '/ingredients/movements', { token: tokenFor('z', 'admin', 't2') })).json;
  assert.deepEqual(otro, [], 'otro negocio no ve estos movimientos');
});

test('una suscripción vencida bloquea el inventario', async () => {
  state.tenants.find((t) => t.id === 't1').billingStatus = 'suspended';
  assert.equal((await api.call('GET', '/ingredients', { token: admin() })).status, 403);
  state.tenants.find((t) => t.id === 't1').billingStatus = 'active';
});
