/**
 * Precio de un platillo con sus extras, igual que lo calcula el servidor (`backend/models/inventory.js`).
 * El servidor es quien manda; esto solo muestra el mismo número mientras se arma la bebida.
 * `tests/inventory-parity.test.js` verifica que ambos coincidan.
 */
export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/** Extras que ofrece un platillo (siempre una lista). */
export const extrasOf = (food) => (Array.isArray(food?.extras) ? food.extras : []);

/**
 * @param food platillo con `price` y `extras`
 * @param picks { [ingredientId]: cantidad } (o lista de { ingredientId, quantity })
 * @returns { options, unitPrice } con las opciones ya ligadas a lo que ofrece el platillo; ignora lo que no ofrece
 */
export function priceWithExtras(food, picks) {
  const list = Array.isArray(picks)
    ? picks
    : Object.entries(picks || {}).map(([ingredientId, quantity]) => ({ ingredientId, quantity }));
  const offered = new Map(extrasOf(food).map((e) => [String(e.ingredientId), e]));
  const options = [];
  for (const p of list) {
    const e = offered.get(String(p.ingredientId));
    const quantity = Math.min(Number(p.quantity) || 0, e?.max ?? 0);
    if (!e || quantity <= 0) continue;
    options.push({ ingredientId: String(e.ingredientId), label: e.label, quantity, unitPrice: round2(e.price), amount: e.amount });
  }
  const extra = options.reduce((s, o) => s + o.unitPrice * o.quantity, 0);
  return { options, unitPrice: round2(Number(food?.price || 0) + extra) };
}

/** Misma bebida con los mismos extras y nota: se junta en una sola línea de la cuenta. */
export const lineKey = (foodId, options, notes) =>
  JSON.stringify([
    String(foodId),
    [...options].sort((a, b) => (a.ingredientId > b.ingredientId ? 1 : -1)).map((o) => [o.ingredientId, o.quantity]),
    String(notes || "").trim(),
  ]);

/** Ingredientes de la receta base que están agotados (para avisar, nunca para bloquear la venta). */
export function missingIngredients(food, ingredientsById) {
  return (food?.recipe || [])
    .map((l) => ingredientsById.get(String(l.ingredientId)))
    .filter((i) => i && Number(i.stock) <= 0)
    .map((i) => i.name);
}

const round3 = (n) => Math.round((Number(n) + Number.EPSILON) * 1000) / 1000;

/**
 * Lo que consume vender `quantity` unidades con esas opciones: la receta base más, por cada extra,
 * (cuántos) × (lo que consume cada uno). Igual que `consumptionOf` del servidor.
 * @returns Map ingredientId → cantidad
 */
export function consumptionFor(food, options, quantity = 1) {
  const out = new Map();
  const add = (id, amount) => out.set(id, round3((out.get(id) || 0) + amount));
  for (const line of food?.recipe || []) add(String(line.ingredientId), line.quantity * quantity);
  for (const o of options || []) add(String(o.ingredientId), o.quantity * o.amount * quantity);
  return out;
}
