// El frontend muestra el precio y el consumo mientras se arma una bebida; el servidor es quien manda.
// Estos tests verifican que ambos cálculos den EXACTAMENTE lo mismo, y que las unidades coincidan.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');
const inv = require('../models/inventory');

const load = (file) => import(pathToFileURL(path.join(__dirname, '..', '..', 'frontend', 'src', file)).href);

test('las unidades del frontend y del backend son las mismas, con las mismas etiquetas', async () => {
  const front = await load('inventoryUnits.js');
  assert.deepEqual(Object.keys(front.UNITS), inv.UNIT_KEYS);
  assert.deepEqual(front.UNITS, inv.UNITS);
  for (const key of inv.UNIT_KEYS) assert.ok(front.unitShort(key), `falta abreviatura de ${key}`);
});

test('formato de cantidades: sin ceros de sobra y con miles', async () => {
  const f = await load('inventoryUnits.js');
  assert.equal(f.formatQty(1250), '1,250');
  assert.equal(f.formatQty(0.5), '0.5');
  assert.equal(f.formatQty(0.30000000000000004), '0.3');
  assert.equal(f.formatQty(-3), '-3');
  assert.equal(f.qtyWithUnit(5, 'pump'), '5 pump');
  assert.equal(f.formatQty('basura'), '0');
});

// Generador pseudoaleatorio con semilla: el mismo resultado en cada corrida
function rng(seed) { let s = seed; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; }

function randomFood(rand, i) {
  const n = (k) => Math.floor(rand() * k);
  const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
  const extras = ids.slice(0, 1 + n(5)).map((id) => ({
    ingredientId: id,
    label: `Extra ${id}`,
    amount: [0.5, 1, 2, 7.25][n(4)],
    price: [0, 3, 5, 12.5, 7.99][n(5)],
    max: 1 + n(8),
  }));
  const recipe = ids.slice(2, 2 + n(4)).map((id) => ({ ingredientId: id, quantity: [1, 240, 0.25, 33.3][n(4)] }));
  return { id: `f${i}`, name: `Producto ${i}`, price: [0, 35, 50, 49.99, 120.5][n(5)], recipe, extras };
}

test('precio con extras: frontend y backend coinciden en 300 casos aleatorios', async () => {
  const front = await load('recipeMath.js');
  const rand = rng(12345);
  for (let i = 0; i < 300; i++) {
    const food = randomFood(rand, i);
    // picks válidos: cantidad entre 0 y el máximo de cada extra (el servidor rechaza lo demás)
    const picks = food.extras.map((e) => ({ ingredientId: e.ingredientId, quantity: Math.floor(rand() * (e.max + 1)) }));
    const server = inv.resolveOptions(food, picks);
    assert.equal(server.error, undefined, `caso ${i}: ${server.error}`);
    const client = front.priceWithExtras(food, picks);
    assert.equal(client.unitPrice, inv.unitPriceWithExtras(food, server.options), `precio distinto en el caso ${i}`);
    assert.deepEqual(client.options.map((o) => [o.ingredientId, o.quantity, o.unitPrice, o.amount]), server.options.map((o) => [o.ingredientId, o.quantity, o.unitPrice, o.amount]), `opciones distintas en el caso ${i}`);
  }
});

test('consumo de inventario: frontend y backend coinciden en 300 casos aleatorios', async () => {
  const front = await load('recipeMath.js');
  const rand = rng(777);
  for (let i = 0; i < 300; i++) {
    const food = randomFood(rand, i);
    const picks = food.extras.map((e) => ({ ingredientId: e.ingredientId, quantity: Math.floor(rand() * (e.max + 1)) }));
    const quantity = 1 + Math.floor(rand() * 5);
    const { options } = inv.resolveOptions(food, picks);
    const server = [...inv.consumptionOf(food, options, quantity)].sort();
    const client = [...front.consumptionFor(food, options, quantity)].sort();
    assert.deepEqual(client, server, `consumo distinto en el caso ${i}`);
  }
});

test('el ejemplo del latte da lo mismo en los dos lados', async () => {
  const front = await load('recipeMath.js');
  const latte = {
    price: 50,
    recipe: [{ ingredientId: 'esp', quantity: 1 }, { ingredientId: 'lec', quantity: 240 }],
    extras: [{ ingredientId: 'lav', label: 'Lavanda', amount: 1, price: 5, max: 8 }, { ingredientId: 'azu', label: 'Azúcar', amount: 1, price: 0, max: 6 }],
  };
  const picks = [{ ingredientId: 'lav', quantity: 5 }, { ingredientId: 'azu', quantity: 3 }];
  assert.equal(front.priceWithExtras(latte, picks).unitPrice, 75);
  assert.equal(inv.unitPriceWithExtras(latte, inv.resolveOptions(latte, picks).options), 75);
});

test('el cliente ignora lo que el platillo no ofrece y respeta el máximo (el servidor, en cambio, lo rechaza)', async () => {
  const front = await load('recipeMath.js');
  const food = { price: 10, extras: [{ ingredientId: 'a', label: 'A', amount: 1, price: 2, max: 3 }] };
  assert.equal(front.priceWithExtras(food, { a: 99 }).options[0].quantity, 3, 'topa en el máximo');
  assert.deepEqual(front.priceWithExtras(food, { zzz: 2 }).options, [], 'ignora extras que no existen');
  assert.deepEqual(front.priceWithExtras(food, { a: 0 }).options, []);
  assert.equal(front.priceWithExtras({ price: 10 }, { a: 1 }).unitPrice, 10, 'un platillo sin extras queda en su precio');
  assert.ok(inv.resolveOptions(food, [{ ingredientId: 'a', quantity: 99 }]).error, 'el servidor sí lo rechaza');
});

test('la clave de línea junta lo igual y separa lo distinto, sin importar el orden de los extras', async () => {
  const f = await load('recipeMath.js');
  const o1 = [{ ingredientId: 'a', quantity: 2 }, { ingredientId: 'b', quantity: 1 }];
  const o2 = [{ ingredientId: 'b', quantity: 1 }, { ingredientId: 'a', quantity: 2 }];
  assert.equal(f.lineKey('x', o1, 'sin azúcar'), f.lineKey('x', o2, ' sin azúcar '));
  assert.notEqual(f.lineKey('x', o1, ''), f.lineKey('x', [{ ingredientId: 'a', quantity: 3 }, o1[1]], ''));
  assert.notEqual(f.lineKey('x', o1, ''), f.lineKey('y', o1, ''));
  assert.notEqual(f.lineKey('x', [], ''), f.lineKey('x', [], 'descafeinado'));
});

test('ingredientes agotados de la receta base: se avisa cuáles, nunca se bloquea', async () => {
  const f = await load('recipeMath.js');
  const byId = new Map([['leche', { id: 'leche', name: 'Leche', stock: 0 }], ['cafe', { id: 'cafe', name: 'Café', stock: 5 }], ['vaso', { id: 'vaso', name: 'Vasos', stock: -2 }]]);
  const food = { recipe: [{ ingredientId: 'leche' }, { ingredientId: 'cafe' }, { ingredientId: 'vaso' }, { ingredientId: 'desconocido' }] };
  assert.deepEqual(f.missingIngredients(food, byId), ['Leche', 'Vasos']);
  assert.deepEqual(f.missingIngredients({ recipe: [] }, byId), []);
  assert.deepEqual(f.missingIngredients({}, byId), []);
});
