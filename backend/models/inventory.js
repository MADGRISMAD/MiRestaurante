/**
 * Inventario de ingredientes (insumos) y recetas.
 * El frontend tiene su espejo de unidades en `frontend/src/inventoryUnits.js` y de cálculo de precios en
 * `frontend/src/recipeMath.js`; `tests/inventory-parity.test.js` verifica que coincidan.
 */
const Joi = require('joi');

/** Unidades de medida de un ingrediente: clave → etiqueta en español. */
const UNITS = {
  pza: 'pieza',
  ml: 'ml',
  l: 'litro',
  g: 'gramo',
  kg: 'kilo',
  pump: 'pump',
  shot: 'shot',
  sobre: 'sobre',
  cdta: 'cucharadita',
};
const UNIT_KEYS = Object.keys(UNITS);

const MAX_RECIPE_LINES = 30;
const MAX_EXTRAS = 20;
const MAX_EXTRA_QTY = 20;

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
// Las existencias admiten decimales (0.5 l de leche); se redondea para no arrastrar basura de coma flotante.
const round3 = (n) => Math.round((Number(n) + Number.EPSILON) * 1000) / 1000;

const ingredientSchema = Joi.object({
  name: Joi.string().trim().min(1).max(60).required().messages({
    'any.required': 'El nombre es obligatorio',
    'string.empty': 'El nombre es obligatorio',
    'string.max': 'El nombre es demasiado largo (máximo 60 caracteres)',
  }),
  unit: Joi.string().valid(...UNIT_KEYS).required().messages({ 'any.only': 'Unidad inválida', 'any.required': 'La unidad es obligatoria' }),
  stock: Joi.number().min(0).max(1e9).default(0).messages({ 'number.min': 'La existencia inicial no puede ser negativa', 'number.base': 'La existencia debe ser un número' }),
  minStock: Joi.number().min(0).max(1e9).default(0).messages({ 'number.min': 'El mínimo no puede ser negativo', 'number.base': 'El mínimo debe ser un número' }),
}).options({ stripUnknown: true });

const ingredientUpdateSchema = Joi.object({
  name: ingredientSchema.extract('name').optional(),
  unit: ingredientSchema.extract('unit').optional(),
  minStock: ingredientSchema.extract('minStock').optional(),
}).options({ stripUnknown: true });

const STOCK_TYPES = ['restock', 'waste', 'adjust'];
const stockOpSchema = Joi.object({
  type: Joi.string().valid(...STOCK_TYPES).required().messages({ 'any.only': 'Tipo de movimiento inválido', 'any.required': 'Indica qué movimiento es' }),
  quantity: Joi.number().min(0).max(1e9).required().messages({ 'number.base': 'La cantidad debe ser un número', 'number.min': 'La cantidad no puede ser negativa', 'any.required': 'Indica la cantidad' }),
  note: Joi.string().trim().max(120).allow('').default(''),
}).options({ stripUnknown: true });

const recipeLineSchema = Joi.object({
  ingredientId: Joi.string().required(),
  quantity: Joi.number().greater(0).max(1e6).required(),
});
const extraLineSchema = Joi.object({
  ingredientId: Joi.string().required(),
  label: Joi.string().trim().max(40).allow('').default(''),
  amount: Joi.number().greater(0).max(1e6).required(),
  price: Joi.number().min(0).max(1e6).default(0),
  max: Joi.number().integer().min(1).max(MAX_EXTRA_QTY).default(5),
});

class RecipeError extends Error {}

/**
 * Valida y normaliza la receta y los extras de un platillo.
 * @param input { recipe?, extras? }
 * @param ingredientsById Map id → ingrediente ACTIVO del negocio (el cliente no puede mandar ids de otro negocio)
 */
function normalizeRecipe(input, ingredientsById) {
  const out = {};
  const check = (list, schema, max, what) => {
    if (!Array.isArray(list)) throw new RecipeError(`${what} inválida`);
    if (list.length > max) throw new RecipeError(`${what}: máximo ${max} ingredientes`);
    const seen = new Set();
    return list.map((raw) => {
      const { error, value } = schema.validate(raw, { stripUnknown: true });
      if (error) throw new RecipeError(`${what}: ${error.details[0].message}`);
      const ing = ingredientsById.get(String(value.ingredientId));
      if (!ing) throw new RecipeError(`${what}: un ingrediente no existe en tu inventario`);
      if (seen.has(String(ing.id))) throw new RecipeError(`${what}: "${ing.name}" está repetido`);
      seen.add(String(ing.id));
      return { ...value, ingredientId: String(ing.id), ingredient: ing };
    });
  };

  if (input.recipe !== undefined) {
    out.recipe = check(input.recipe, recipeLineSchema, MAX_RECIPE_LINES, 'Receta').map((l) => ({
      ingredientId: l.ingredientId,
      quantity: round3(l.quantity),
    }));
  }
  if (input.extras !== undefined) {
    out.extras = check(input.extras, extraLineSchema, MAX_EXTRAS, 'Extras').map((l) => ({
      ingredientId: l.ingredientId,
      // Si no se le puso nombre, se queda con el del ingrediente tal como estaba al guardar
      label: l.label || l.ingredient.name,
      amount: round3(l.amount),
      price: round2(l.price),
      max: l.max,
    }));
  }
  return out;
}

/**
 * Convierte lo que el cliente eligió ([{ingredientId, quantity}]) en opciones válidas y con precio,
 * usando SOLO lo que el platillo ofrece como extra. Nunca se confía en el precio que mande el cliente.
 * @returns { options, extraPrice } o { error }
 */
function resolveOptions(food, picks) {
  const offered = new Map((food.extras || []).map((e) => [String(e.ingredientId), e]));
  const totals = new Map();
  for (const p of Array.isArray(picks) ? picks : []) {
    const q = Number(p?.quantity);
    if (!Number.isFinite(q) || !Number.isInteger(q) || q < 0) return { error: 'Cantidad de extra inválida' };
    if (q === 0) continue;
    const id = String(p.ingredientId);
    if (!offered.has(id)) return { error: `"${food.name}" no ofrece uno de los extras elegidos` };
    totals.set(id, (totals.get(id) || 0) + q);
  }
  const options = [];
  let extraPrice = 0;
  for (const [id, quantity] of totals) {
    const e = offered.get(id);
    if (quantity > e.max) return { error: `Máximo ${e.max} de "${e.label}" por ${food.name}` };
    options.push({ ingredientId: id, label: e.label, quantity, unitPrice: round2(e.price), amount: e.amount });
    extraPrice += e.price * quantity;
  }
  return { options, extraPrice: round2(extraPrice) };
}

/** Precio de UNA unidad del platillo con sus extras. */
const unitPriceWithExtras = (food, options) =>
  round2(Number(food.price || 0) + options.reduce((s, o) => s + o.unitPrice * o.quantity, 0));

/**
 * Cuánto de cada ingrediente consume vender `quantity` unidades del platillo con esas opciones:
 * la receta base más, por cada extra, (cuántos extras) × (lo que consume cada uno).
 * @returns Map ingredientId → cantidad
 */
function consumptionOf(food, options, quantity) {
  const out = new Map();
  const add = (id, amount) => out.set(id, round3((out.get(id) || 0) + amount));
  for (const line of food.recipe || []) add(String(line.ingredientId), line.quantity * quantity);
  for (const o of options || []) add(String(o.ingredientId), o.quantity * o.amount * quantity);
  return out;
}

/**
 * Consumo total de un pedido, listo para guardarse como instantánea en el pedido
 * (así devolver el stock al cancelar no depende de cómo estén las recetas ese día).
 * @param items [{ foodId, quantity, options? }]
 * @param foodsById Map foodId → platillo
 * @returns [{ ingredientId, amount }]
 */
function stockLinesFor(items, foodsById) {
  const total = new Map();
  for (const item of items || []) {
    const food = foodsById.get(String(item.foodId));
    if (!food) continue;
    for (const [id, amount] of consumptionOf(food, item.options, Number(item.quantity) || 0)) {
      total.set(id, round3((total.get(id) || 0) + amount));
    }
  }
  return [...total].filter(([, amount]) => amount > 0).map(([ingredientId, amount]) => ({ ingredientId, amount }));
}

/** Estado de existencia de un ingrediente: 'out' (agotado o en negativo), 'low' (en o bajo el mínimo) u 'ok'. */
function stockStatus(ingredient) {
  const stock = Number(ingredient.stock) || 0;
  if (stock <= 0) return 'out';
  if (Number(ingredient.minStock) > 0 && stock <= Number(ingredient.minStock)) return 'low';
  return 'ok';
}

module.exports = {
  UNITS,
  UNIT_KEYS,
  STOCK_TYPES,
  MAX_RECIPE_LINES,
  MAX_EXTRAS,
  MAX_EXTRA_QTY,
  round2,
  round3,
  ingredientSchema,
  ingredientUpdateSchema,
  stockOpSchema,
  RecipeError,
  normalizeRecipe,
  resolveOptions,
  unitPriceWithExtras,
  consumptionOf,
  stockLinesFor,
  stockStatus,
};
