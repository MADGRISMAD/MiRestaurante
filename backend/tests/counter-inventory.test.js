// Ventas con extras y descuento de inventario (mostrador y salón), y devolución al cancelar.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, startServer } = require('./helpers');

const { app, state, tokenFor } = loadApp();
let api;
test.before(async () => { api = await startServer(app); });
test.after(async () => { await api.close(); });

const cashier = () => tokenFor('paco', 'cashier');
const admin = () => tokenFor('ana', 'admin');
const ing = (id, name, unit, stock) => ({ id, name, unit, stock, minStock: 0, tenantId: 't1' });

// La bebida del ejemplo: un latte con 5 pumps de lavanda y 3 de azúcar.
const LATTE = {
  id: 'f-latte', tenantId: 't1', name: 'Latte', price: 50,
  recipe: [{ ingredientId: 'i-esp', quantity: 1 }, { ingredientId: 'i-lec', quantity: 240 }, { ingredientId: 'i-vaso', quantity: 1 }],
  extras: [
    { ingredientId: 'i-lav', label: 'Sabor lavanda', amount: 1, price: 5, max: 8 },
    { ingredientId: 'i-azu', label: 'Azúcar', amount: 1, price: 0, max: 6 },
    { ingredientId: 'i-esp', label: 'Shot extra', amount: 1, price: 15, max: 3 },
  ],
};
const stock = () => Object.fromEntries(state.ingredients.map((i) => [i.id, i.stock]));
const reset = () => {
  state.settings.t1 = { businessType: 'cafe', timezone: 'America/Tijuana' };
  state.cash = [{ id: 'c1', tenantId: 't1', status: 'open' }];
  state.orders = []; state.movements = []; state.failAdjust = new Set();
  state.ingredients = [ing('i-esp', 'Espresso', 'shot', 100), ing('i-lec', 'Leche', 'ml', 5000), ing('i-vaso', 'Vasos', 'pza', 50), ing('i-lav', 'Lavanda', 'pump', 200), ing('i-azu', 'Azúcar', 'sobre', 100)];
  state.foods = [{ ...LATTE, recipe: LATTE.recipe.map((l) => ({ ...l })), extras: LATTE.extras.map((e) => ({ ...e })) }, { id: 'f-pan', tenantId: 't1', name: 'Pan dulce', price: 35, recipe: [], extras: [] }];
};
const sale = (items, over = {}, token = cashier()) => api.call('POST', '/orders/counter', { token, body: { items, paymentMethod: 'card', ...over } });
const latteConExtras = (quantity = 1, over = {}) => ({ foodId: 'f-latte', quantity, options: [{ ingredientId: 'i-lav', quantity: 5 }, { ingredientId: 'i-azu', quantity: 3 }], notes: 'descafeinado', ...over });

test('el latte del ejemplo: 5 pumps de lavanda, 3 de azúcar y nota "descafeinado" — cobra y descuenta exacto', async () => {
  reset();
  const r = await sale([latteConExtras(2)]);
  assert.equal(r.status, 201, r.text);
  const item = r.json.items[0];
  // 50 base + 5 pumps × $5 + 3 azúcar × $0 = $75 por latte; 2 lattes = $150; IVA 8 % = $12
  assert.equal(item.basePrice, 50);
  assert.equal(item.price, 75);
  assert.equal(item.quantity, 2);
  assert.equal(item.notes, 'descafeinado');
  assert.deepEqual(item.options.map((o) => [o.label, o.quantity, o.unitPrice]), [['Sabor lavanda', 5, 5], ['Azúcar', 3, 0]]);
  assert.equal(r.json.subtotal, 150);
  assert.equal(r.json.tax, 12);
  assert.equal(r.json.total, 162);

  // 2 lattes: 2 shots, 480 ml, 2 vasos + 10 pumps de lavanda + 6 sobres de azúcar
  assert.deepEqual(stock(), { 'i-esp': 98, 'i-lec': 4520, 'i-vaso': 48, 'i-lav': 190, 'i-azu': 94 });
  const sold = state.movements.filter((m) => m.type === 'sale');
  assert.equal(sold.length, 5, 'un movimiento por ingrediente');
  assert.ok(sold.every((m) => m.orderId === r.json.id && m.by === 'paco'));
  const order = state.orders[0];
  assert.equal(order.stockApplied, true);
  assert.equal(order.stockLines.length, 5, 'queda la instantánea de lo descontado');
});

test('un shot extra suma al shot de la receta base (mismo ingrediente)', async () => {
  reset();
  const r = await sale([{ foodId: 'f-latte', quantity: 1, options: [{ ingredientId: 'i-esp', quantity: 2 }] }]);
  assert.equal(r.status, 201, r.text);
  assert.equal(r.json.items[0].price, 80, '50 + 2 × $15');
  assert.equal(stock()['i-esp'], 97, '1 de la receta + 2 extra');
});

test('el cliente nunca decide el precio ni lo que ofrece el platillo', async () => {
  reset();
  const antes = JSON.stringify(stock());
  const intentos = [
    [{ foodId: 'f-latte', quantity: 1, price: 1, options: [{ ingredientId: 'i-lav', quantity: 1, unitPrice: 0, price: 0 }] }, 201],
    [{ foodId: 'f-latte', quantity: 1, options: [{ ingredientId: 'i-leche-inexistente', quantity: 1 }] }, 400],
    [{ foodId: 'f-latte', quantity: 1, options: [{ ingredientId: 'i-lec', quantity: 1 }] }, 400], // la leche existe, pero no es un extra del latte
    [{ foodId: 'f-latte', quantity: 1, options: [{ ingredientId: 'i-lav', quantity: 9 }] }, 400], // máx. 8
    [{ foodId: 'f-latte', quantity: 1, options: [{ ingredientId: 'i-lav', quantity: 5 }, { ingredientId: 'i-lav', quantity: 4 }] }, 400], // se suman: 9 > 8
    [{ foodId: 'f-latte', quantity: 1, options: [{ ingredientId: 'i-lav', quantity: -1 }] }, 400],
    [{ foodId: 'f-latte', quantity: 1, options: [{ ingredientId: 'i-lav', quantity: 1.5 }] }, 400],
    [{ foodId: 'f-latte', quantity: 1, options: [{ ingredientId: 'i-lav', quantity: 'muchos' }] }, 400],
    [{ foodId: 'f-pan', quantity: 1, options: [{ ingredientId: 'i-lav', quantity: 1 }] }, 400], // el pan no ofrece extras
  ];
  for (const [item, status] of intentos) {
    const r = await sale([item]);
    assert.equal(r.status, status, JSON.stringify(item));
    if (status === 201) {
      assert.equal(r.json.items[0].price, 55, 'el precio sale del menú: 50 + 1 × $5, no lo que mandó el cliente');
      assert.equal(r.json.items[0].options[0].unitPrice, 5);
    }
  }
  assert.equal(state.orders.length, 1, 'solo se guardó la válida');
  const despues = stock();
  assert.equal(despues['i-lav'], 199, 'y solo se descontó esa');
  assert.notEqual(JSON.stringify(despues), antes);
});

test('una cantidad de extra en cero se ignora; sin extras es el precio base', async () => {
  reset();
  const r = await sale([{ foodId: 'f-latte', quantity: 1, options: [{ ingredientId: 'i-lav', quantity: 0 }] }]);
  assert.equal(r.status, 201);
  assert.deepEqual(r.json.items[0].options, []);
  assert.equal(r.json.items[0].price, 50);
  assert.equal(stock()['i-lav'], 200, 'no se descontó lavanda');
});

test('un platillo sin receta se vende sin tocar el inventario', async () => {
  reset();
  const antes = JSON.stringify(stock());
  const r = await sale([{ foodId: 'f-pan', quantity: 3 }]);
  assert.equal(r.status, 201);
  assert.equal(JSON.stringify(stock()), antes);
  assert.equal(state.movements.length, 0);
  assert.equal(state.orders[0].stockApplied, undefined);
});

test('una venta mezclada descuenta cada cosa y suma lo que comparten', async () => {
  reset();
  await sale([latteConExtras(1), { foodId: 'f-latte', quantity: 1 }, { foodId: 'f-pan', quantity: 2 }]);
  // 2 lattes en total (1 con extras y 1 sin): 2 shots, 480 ml, 2 vasos; lavanda 5, azúcar 3
  assert.deepEqual(stock(), { 'i-esp': 98, 'i-lec': 4520, 'i-vaso': 48, 'i-lav': 195, 'i-azu': 97 });
});

test('una venta nunca se bloquea por falta de stock: la existencia queda en negativo', async () => {
  reset();
  state.ingredients.find((i) => i.id === 'i-lav').stock = 2;
  const r = await sale([latteConExtras(1)]);
  assert.equal(r.status, 201, 'se vende igual');
  assert.equal(stock()['i-lav'], -3);
  const listed = (await api.call('GET', '/ingredients', { token: cashier() })).json;
  assert.equal(listed.find((i) => i.id === 'i-lav').status, 'out', 'y queda marcado como agotado');
});

test('un reintento con el mismo clientRef NO vuelve a descontar', async () => {
  reset();
  const first = await sale([latteConExtras(1)], { clientRef: 'v-1' });
  const stockTras1 = JSON.stringify(stock());
  const retry = await sale([latteConExtras(1)], { clientRef: 'v-1' });
  assert.equal(first.status, 201);
  assert.equal(retry.status, 200);
  assert.equal(JSON.stringify(stock()), stockTras1, 'el inventario no se movió otra vez');
  assert.equal(state.movements.filter((m) => m.type === 'sale').length, 5);
});

test('dos peticiones realmente simultáneas descuentan una sola vez', async () => {
  reset();
  state.slowLookup = true;
  try {
    const [a, b] = await Promise.all([sale([latteConExtras(1)], { clientRef: 'c-1' }), sale([latteConExtras(1)], { clientRef: 'c-1' })]);
    assert.deepEqual([a.status, b.status].sort(), [200, 201]);
  } finally { state.slowLookup = false; }
  assert.equal(state.orders.length, 1);
  assert.equal(stock()['i-lav'], 195, 'solo se descontó una vez');
  assert.equal(stock()['i-vaso'], 49);
});

test('si falla el inventario de un ingrediente, la venta se registra y los demás se descuentan', async () => {
  reset();
  state.failAdjust.add('i-lec');
  const original = console.error; console.error = () => {};
  try {
    const r = await sale([latteConExtras(1)]);
    assert.equal(r.status, 201, 'la venta no se pierde');
  } finally { console.error = original; }
  assert.equal(stock()['i-lec'], 5000, 'la leche no se pudo descontar');
  assert.equal(stock()['i-esp'], 99, 'pero lo demás sí');
  assert.equal(stock()['i-lav'], 195);
});

test('cancelar devuelve exactamente lo descontado, una sola vez', async () => {
  reset();
  const antes = JSON.stringify(stock());
  const r = await sale([latteConExtras(2)]);
  assert.notEqual(JSON.stringify(stock()), antes);

  const cancel = () => api.call('PUT', `/orders/${r.json.id}/status`, { token: admin(), body: { status: 'cancelled' } });
  const c1 = await cancel();
  assert.equal(c1.status, 200, c1.text);
  assert.equal(JSON.stringify(stock()), antes, 'todo vuelve como estaba');
  assert.equal(c1.json.stockRestored, true);
  const devueltos = state.movements.filter((m) => m.type === 'return');
  assert.equal(devueltos.length, 5);
  assert.ok(devueltos.every((m) => m.orderId === r.json.id && m.note === 'Pedido cancelado'));

  const c2 = await cancel();
  assert.equal(c2.status, 200);
  assert.equal(JSON.stringify(stock()), antes, 'cancelar otra vez no devuelve de más');
  assert.equal(state.movements.filter((m) => m.type === 'return').length, 5);
});

test('reabrir un pedido cancelado y cancelarlo otra vez NO devuelve el stock dos veces', async () => {
  reset();
  const antes = JSON.stringify(stock());
  const r = await sale([latteConExtras(1)]);
  const set = (status) => api.call('PUT', `/orders/${r.json.id}/status`, { token: admin(), body: { status } });
  await set('cancelled');
  assert.equal(JSON.stringify(stock()), antes);
  await set('served');     // alguien lo reabre
  await set('cancelled');  // y lo cancela otra vez
  assert.equal(JSON.stringify(stock()), antes, 'el inventario no creció de más');
  assert.equal(state.movements.filter((m) => m.type === 'return').length, 5);
});

test('cambiar la receta después de vender no altera lo que se devuelve al cancelar', async () => {
  reset();
  const r = await sale([{ foodId: 'f-latte', quantity: 1 }]);
  assert.equal(stock()['i-lec'], 4760);
  // El administrador cambia la receta: ahora el latte lleva 300 ml en vez de 240
  const edit = await api.call('PUT', '/foods/f-latte', { token: admin(), body: { recipe: [{ ingredientId: 'i-lec', quantity: 300 }] } });
  assert.equal(edit.status, 200, edit.text);
  await api.call('PUT', `/orders/${r.json.id}/status`, { token: admin(), body: { status: 'cancelled' } });
  assert.equal(stock()['i-lec'], 5000, 'devuelve los 240 que se descontaron, no los 300 de hoy');
});

test('otros cambios de estado no devuelven stock', async () => {
  reset();
  const r = await sale([latteConExtras(1)]);
  const despues = JSON.stringify(stock());
  for (const status of ['preparing', 'ready', 'served']) {
    await api.call('PUT', `/orders/${r.json.id}/status`, { token: admin(), body: { status } });
  }
  assert.equal(JSON.stringify(stock()), despues);
  assert.equal(state.movements.filter((m) => m.type === 'return').length, 0);
});

test('cancelar un pedido sin receta no inventa movimientos', async () => {
  reset();
  const r = await sale([{ foodId: 'f-pan', quantity: 1 }]);
  const c = await api.call('PUT', `/orders/${r.json.id}/status`, { token: admin(), body: { status: 'cancelled' } });
  assert.equal(c.status, 200);
  assert.equal(state.movements.length, 0);
});

test('pedidos de salón: descuentan la receta base al crearse y la devuelven al cancelar', async () => {
  reset();
  state.settings.t1 = { businessType: 'restaurant' };
  const waiter = tokenFor('marta', 'waiter');
  const r = await api.call('POST', '/orders', { token: waiter, body: { tableName: 'Mesa 3', items: [{ foodId: 'f-latte', name: 'Latte', price: 50, quantity: 2 }, { foodId: 'f-pan', name: 'Pan dulce', price: 35, quantity: 1 }] } });
  assert.equal(r.status, 201, r.text);
  assert.deepEqual(stock(), { 'i-esp': 98, 'i-lec': 4520, 'i-vaso': 48, 'i-lav': 200, 'i-azu': 100 }, 'solo la receta base (el salón aún no arma extras)');
  const c = await api.call('PUT', `/orders/${r.json.id}/status`, { token: waiter, body: { status: 'cancelled' } });
  assert.equal(c.status, 200, c.text);
  assert.deepEqual(stock(), { 'i-esp': 100, 'i-lec': 5000, 'i-vaso': 50, 'i-lav': 200, 'i-azu': 100 });
});

test('un platillo borrado no impide vender ni rompe el descuento de los demás', async () => {
  reset();
  state.settings.t1 = { businessType: 'restaurant' };
  const waiter = tokenFor('marta', 'waiter');
  const r = await api.call('POST', '/orders', { token: waiter, body: { tableName: 'Mesa 1', items: [{ foodId: 'ya-no-existe', name: 'Viejo', price: 10, quantity: 1 }, { foodId: 'f-latte', name: 'Latte', price: 50, quantity: 1 }] } });
  assert.equal(r.status, 201);
  assert.equal(stock()['i-esp'], 99);
});
