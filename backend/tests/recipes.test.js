// Platillos con receta y extras: validación y seguridad.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, startServer } = require('./helpers');

const { app, state, tokenFor } = loadApp();
let api;
test.before(async () => { api = await startServer(app); });
test.after(async () => { await api.close(); });

const admin = () => tokenFor('ana', 'admin');
const ing = (id, name, unit, tenantId = 't1', stock = 100) => ({ id, name, unit, stock, minStock: 0, tenantId });
const reset = () => {
  state.ingredients = [ing('i-esp', 'Espresso', 'shot'), ing('i-lec', 'Leche', 'ml'), ing('i-lav', 'Lavanda', 'pump'), ing('i-azu', 'Azúcar', 'sobre'), ing('i-otro', 'Del vecino', 'pza', 't2')];
  state.menus = [{ id: 'm1', tenantId: 't1', name: 'Bebidas' }, { id: 'm2', tenantId: 't2', name: 'Ajeno' }];
  state.foods = [];
};
const food = (over = {}) => ({ name: 'Latte', price: 50, menuId: 'm1', ...over });
const createFood = (body, token = admin()) => api.call('POST', '/foods', { token, body });
const updateFood = (id, body, token = admin()) => api.call('PUT', `/foods/${id}`, { token, body });
const latte = () => food({
  recipe: [{ ingredientId: 'i-esp', quantity: 1 }, { ingredientId: 'i-lec', quantity: 240 }],
  extras: [{ ingredientId: 'i-lav', label: 'Sabor lavanda', amount: 1, price: 5, max: 8 }, { ingredientId: 'i-azu', amount: 1, price: 0, max: 6 }],
});

test('crear un platillo con receta y extras: se guarda normalizado', async () => {
  reset();
  const r = await createFood(latte());
  assert.equal(r.status, 201, r.text);
  assert.deepEqual(r.json.recipe, [{ ingredientId: 'i-esp', quantity: 1 }, { ingredientId: 'i-lec', quantity: 240 }]);
  assert.deepEqual(r.json.extras.map((e) => [e.ingredientId, e.label, e.amount, e.price, e.max]), [
    ['i-lav', 'Sabor lavanda', 1, 5, 8],
    ['i-azu', 'Azúcar', 1, 0, 6], // sin nombre: se queda con el del ingrediente
  ]);
  assert.equal(r.json.tenantId, 't1');
});

test('un platillo sin receta sigue funcionando como antes', async () => {
  reset();
  const r = await createFood(food({ name: 'Pan dulce', price: 35 }));
  assert.equal(r.status, 201);
  assert.deepEqual([r.json.recipe, r.json.extras], [[], []]);
});

test('validaciones del platillo: nombre, precio, categoría', async () => {
  reset();
  for (const [body, re] of [
    [food({ name: '' }), /nombre/i],
    [food({ name: undefined }), /nombre/i],
    [food({ price: -1 }), /negativo/i],
    [food({ price: 'caro' }), /número/i],
    [food({ price: undefined }), /precio/i],
    [food({ menuId: undefined }), /categoría/i],
    [food({ menuId: 'no-existe' }), /categoría no existe/i],
    [food({ menuId: 'm2' }), /categoría no existe/i], // categoría de otro negocio
  ]) {
    const r = await createFood(body);
    assert.equal(r.status, 400, JSON.stringify(body));
    assert.match(r.text, re);
  }
  assert.equal(state.foods.length, 0);
});

test('recetas inválidas se rechazan completas y no guardan nada', async () => {
  reset();
  const dupl = { ingredientId: 'i-lec', quantity: 1 };
  for (const [over, re] of [
    [{ recipe: [{ ingredientId: 'i-lec', quantity: 0 }] }, /Receta/],
    [{ recipe: [{ ingredientId: 'i-lec', quantity: -5 }] }, /Receta/],
    [{ recipe: [{ ingredientId: 'i-lec', quantity: 'x' }] }, /Receta/],
    [{ recipe: [{ ingredientId: 'no-existe', quantity: 1 }] }, /no existe en tu inventario/],
    [{ recipe: [{ ingredientId: 'i-otro', quantity: 1 }] }, /no existe en tu inventario/], // ingrediente de OTRO negocio
    [{ recipe: [dupl, dupl] }, /repetido/],
    [{ recipe: 'leche' }, /inválida/],
    [{ recipe: Array.from({ length: 31 }, (_, i) => ({ ingredientId: `x${i}`, quantity: 1 })) }, /máximo 30/],
    [{ extras: [{ ingredientId: 'i-lav', amount: 0, price: 1 }] }, /Extras/],
    [{ extras: [{ ingredientId: 'i-lav', amount: 1, price: -2 }] }, /Extras/],
    [{ extras: [{ ingredientId: 'i-lav', amount: 1, max: 0 }] }, /Extras/],
    [{ extras: [{ ingredientId: 'i-lav', amount: 1, max: 21 }] }, /Extras/],
    [{ extras: [{ ingredientId: 'i-otro', amount: 1 }] }, /no existe en tu inventario/],
    [{ extras: [{ ingredientId: 'i-lav', amount: 1 }, { ingredientId: 'i-lav', amount: 2 }] }, /repetido/],
    [{ extras: Array.from({ length: 21 }, (_, i) => ({ ingredientId: `x${i}`, amount: 1 })) }, /máximo 20/],
  ]) {
    const r = await createFood(food(over));
    assert.equal(r.status, 400, JSON.stringify(over).slice(0, 80));
    assert.match(r.text, re, JSON.stringify(over).slice(0, 80));
  }
  assert.equal(state.foods.length, 0);
});

test('un mismo ingrediente puede estar en la receta y también ser extra (shot extra de espresso)', async () => {
  reset();
  const r = await createFood(food({ recipe: [{ ingredientId: 'i-esp', quantity: 1 }], extras: [{ ingredientId: 'i-esp', label: 'Shot extra', amount: 1, price: 15, max: 3 }] }));
  assert.equal(r.status, 201, r.text);
});

test('editar: solo cambia lo que llega; la receta se reemplaza solo si viene', async () => {
  reset();
  const { json: f } = await createFood(latte());
  const soloPrecio = await updateFood(f.id, { price: 55 });
  assert.equal(soloPrecio.status, 200, soloPrecio.text);
  assert.equal(soloPrecio.json.price, 55);
  assert.equal(soloPrecio.json.name, 'Latte');
  assert.equal(soloPrecio.json.recipe.length, 2, 'la receta se conserva');
  assert.equal(soloPrecio.json.extras.length, 2);

  const nueva = await updateFood(f.id, { recipe: [{ ingredientId: 'i-esp', quantity: 2 }] });
  assert.deepEqual(nueva.json.recipe, [{ ingredientId: 'i-esp', quantity: 2 }]);
  assert.equal(nueva.json.extras.length, 2, 'los extras no se tocan si no vienen');

  const vaciar = await updateFood(f.id, { recipe: [], extras: [] });
  assert.deepEqual([vaciar.json.recipe, vaciar.json.extras], [[], []], 'mandar listas vacías las quita');
});

test('editar con datos inválidos no cambia el platillo', async () => {
  reset();
  const { json: f } = await createFood(latte());
  for (const body of [{ price: -3 }, { name: '' }, { menuId: 'm2' }, { recipe: [{ ingredientId: 'i-otro', quantity: 1 }] }]) {
    assert.equal((await updateFood(f.id, body)).status, 400, JSON.stringify(body));
  }
  const now = state.foods[0];
  assert.deepEqual([now.name, now.price, now.menuId, now.recipe.length], ['Latte', 50, 'm1', 2]);
});

test('seguridad: editar no deja cambiar el negocio ni inventar campos', async () => {
  reset();
  const { json: f } = await createFood(latte());
  const r = await updateFood(f.id, { tenantId: 't2', id: 'otro', _id: 'otro', isAdmin: true, price: 60 });
  assert.equal(r.status, 200);
  const stored = state.foods[0];
  assert.equal(stored.tenantId, 't1', 'el platillo no se mueve a otro negocio');
  assert.equal(stored.id, f.id);
  assert.equal(stored.isAdmin, undefined, 'campos desconocidos se descartan');
  assert.equal(stored.price, 60);
});

test('seguridad: no se edita un platillo de otro negocio', async () => {
  reset();
  const { json: f } = await createFood(latte());
  const r = await updateFood(f.id, { price: 1 }, tokenFor('z', 'admin', 't2'));
  assert.equal(r.status, 404);
  assert.equal(state.foods[0].price, 50);
});

test('solo el administrador crea y edita platillos', async () => {
  reset();
  for (const role of ['cashier', 'waiter', 'kitchen', 'host']) {
    assert.equal((await createFood(latte(), tokenFor('x', role))).status, 403, role);
  }
  assert.equal(state.foods.length, 0);
});
