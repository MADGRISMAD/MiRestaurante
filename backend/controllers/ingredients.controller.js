const mongo = require('mongodb');
const db = require('../database/mongodb');
const inv = require('../models/inventory');

const publicIngredient = (i) => ({
  id: String(i.id),
  name: i.name,
  unit: i.unit,
  stock: i.stock,
  minStock: i.minStock,
  status: inv.stockStatus(i),
});

const badRequest = (res, error) => res.status(400).send(error.details?.[0]?.message || 'Datos inválidos');
const sameName = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

async function list(req, res) {
  try {
    const rows = await db.GetIngredients(req.tenantId);
    return res.status(200).json(rows.map(publicIngredient));
  } catch (err) {
    console.error(err);
    return res.status(500).send(err.message || 'Error al listar el inventario');
  }
}

async function create(req, res) {
  try {
    const { error, value } = inv.ingredientSchema.validate(req.body || {});
    if (error) return badRequest(res, error);

    const existing = await db.GetIngredients(req.tenantId);
    if (existing.some((i) => sameName(i.name, value.name))) {
      return res.status(400).send(`Ya tienes un ingrediente llamado "${value.name}"`);
    }

    const created = await db.CreateIngredient({
      tenantId: req.tenantId,
      name: value.name,
      unit: value.unit,
      stock: 0,
      minStock: inv.round3(value.minStock),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    // La existencia inicial entra como un movimiento más: así queda en el historial
    const withStock = value.stock > 0
      ? await db.AdjustStock(req.tenantId, created.id, inv.round3(value.stock), { type: 'restock', note: 'Existencia inicial', by: req.user?.username })
      : created;
    return res.status(201).json(publicIngredient(withStock));
  } catch (err) {
    console.error(err);
    return res.status(500).send(err.message || 'Error al crear el ingrediente');
  }
}

async function update(req, res) {
  try {
    const { error, value } = inv.ingredientUpdateSchema.validate(req.body || {});
    if (error) return badRequest(res, error);

    const current = await db.GetIngredientById(req.params.id, req.tenantId);
    if (!current) return res.status(404).send('Ingrediente no encontrado');

    if (value.name && !sameName(value.name, current.name)) {
      const others = (await db.GetIngredients(req.tenantId)).filter((i) => i.id !== current.id);
      if (others.some((i) => sameName(i.name, value.name))) {
        return res.status(400).send(`Ya tienes un ingrediente llamado "${value.name}"`);
      }
    }
    if (value.unit && value.unit !== current.unit) {
      const used = await db.CountFoodsUsingIngredient(current.id, req.tenantId);
      if (used) {
        return res.status(400).send(`No se puede cambiar la unidad: se usa en ${plural(used, 'producto', 'productos')} y sus cantidades cambiarían de significado.`);
      }
    }

    const patch = { ...value, updatedAt: new Date() };
    if (patch.minStock !== undefined) patch.minStock = inv.round3(patch.minStock);
    const updated = await db.UpdateIngredient(req.params.id, patch, req.tenantId);
    return res.status(200).json(publicIngredient(updated));
  } catch (err) {
    console.error(err);
    return res.status(500).send(err.message || 'Error al actualizar el ingrediente');
  }
}

async function remove(req, res) {
  try {
    const current = await db.GetIngredientById(req.params.id, req.tenantId);
    if (!current) return res.status(404).send('Ingrediente no encontrado');
    const used = await db.CountFoodsUsingIngredient(current.id, req.tenantId);
    if (used) {
      return res.status(400).send(`"${current.name}" se usa en ${plural(used, 'producto', 'productos')}. Quítalo de sus recetas y extras primero.`);
    }
    await db.DeleteIngredient(req.params.id, req.tenantId);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).send(err.message || 'Error al eliminar el ingrediente');
  }
}

/** Entrada de mercancía, merma o conteo físico. */
async function stockOp(req, res) {
  try {
    const { error, value } = inv.stockOpSchema.validate(req.body || {});
    if (error) return badRequest(res, error);
    if (value.type !== 'adjust' && !(value.quantity > 0)) {
      return res.status(400).send('La cantidad debe ser mayor que cero');
    }

    const current = await db.GetIngredientById(req.params.id, req.tenantId);
    if (!current) return res.status(404).send('Ingrediente no encontrado');

    const meta = { type: value.type, note: value.note, by: req.user?.username };
    const updated = value.type === 'adjust'
      ? await db.SetStock(req.tenantId, current.id, inv.round3(value.quantity), meta)
      : await db.AdjustStock(req.tenantId, current.id, (value.type === 'waste' ? -1 : 1) * inv.round3(value.quantity), meta);
    return res.status(200).json(publicIngredient(updated));
  } catch (err) {
    console.error(err);
    return res.status(500).send(err.message || 'Error al registrar el movimiento');
  }
}

async function movements(req, res) {
  try {
    const ingredientId = req.query.ingredientId ? String(req.query.ingredientId) : undefined;
    if (ingredientId && !mongo.ObjectId.isValid(ingredientId)) return res.status(400).send('Ingrediente inválido');
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    return res.status(200).json(await db.GetStockMovements(req.tenantId, { ingredientId, limit }));
  } catch (err) {
    console.error(err);
    return res.status(500).send(err.message || 'Error al listar los movimientos');
  }
}

module.exports = { list, create, update, remove, stockOp, movements };
