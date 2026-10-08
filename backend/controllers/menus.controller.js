const Joi = require('joi');
const db = require('../database/mongodb');
const { normalizeRecipe, RecipeError } = require('../models/inventory');

async function listMenus(req, res) {
  try {
    return res.status(200).json(await db.GetMenus(req.tenantId));
  } catch (err) {
    console.error(err);
    return res.status(500).send(err.message || 'Error al listar menús');
  }
}

async function getMenu(req, res) {
  try {
    const menu = await db.GetMenuById(req.params.id, req.tenantId);
    if (!menu) return res.status(404).send('Menú no encontrado');
    return res.status(200).json(menu);
  } catch (err) {
    console.error(err);
    return res.status(500).send(err.message || 'Error al obtener menú');
  }
}

async function createMenu(req, res) {
  try {
    const { name, description } = req.body || {};
    if (!name) return res.status(400).send('name es requerido');
    const created = await db.CreateMenu({
      name,
      description: description || '',
      tenantId: req.tenantId,
    });
    return res.status(201).json(created);
  } catch (err) {
    console.error(err);
    return res.status(500).send(err.message || 'Error al crear menú');
  }
}

async function updateMenu(req, res) {
  try {
    const updated = await db.UpdateMenu(req.params.id, req.body || {}, req.tenantId);
    if (!updated) return res.status(404).send('Menú no encontrado');
    return res.status(200).json(updated);
  } catch (err) {
    console.error(err);
    return res.status(500).send(err.message || 'Error al actualizar menú');
  }
}

async function deleteMenu(req, res) {
  try {
    const result = await db.DeleteMenu(req.params.id, req.tenantId);
    if (!result || result.deletedCount === 0) {
      return res.status(404).send('Menú no encontrado');
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).send(err.message || 'Error al eliminar menú');
  }
}

async function listFoods(req, res) {
  try {
    return res.status(200).json(await db.GetFoods(req.tenantId));
  } catch (err) {
    console.error(err);
    return res.status(500).send(err.message || 'Error al listar platillos');
  }
}

async function getFood(req, res) {
  try {
    const food = await db.GetFoodById(req.params.id, req.tenantId);
    if (!food) return res.status(404).send('Platillo no encontrado');
    return res.status(200).json(food);
  } catch (err) {
    console.error(err);
    return res.status(500).send(err.message || 'Error al obtener platillo');
  }
}

const foodSchema = Joi.object({
  name: Joi.string().trim().min(1).max(80).required().messages({ 'any.required': 'El nombre es obligatorio', 'string.empty': 'El nombre es obligatorio', 'string.max': 'El nombre es demasiado largo (máximo 80 caracteres)' }),
  price: Joi.number().min(0).max(1e6).required().messages({ 'any.required': 'El precio es obligatorio', 'number.base': 'El precio debe ser un número', 'number.min': 'El precio no puede ser negativo' }),
  description: Joi.string().trim().max(300).allow('').default(''),
  imgUrl: Joi.string().trim().max(2000).allow('').default(''),
  menuId: Joi.string().required().messages({ 'any.required': 'Falta la categoría (menuId)' }),
}).options({ stripUnknown: true });

// Para editar: solo se tocan los campos que llegan (y nunca tenantId ni id).
const foodUpdateSchema = foodSchema.fork(['name', 'price', 'menuId'], (f) => f.optional()).options({ stripUnknown: true });

/** Ingredientes activos del negocio por id, para validar recetas y extras. */
async function ingredientsMap(tenantId) {
  return new Map((await db.GetIngredients(tenantId)).map((i) => [String(i.id), i]));
}

async function createFood(req, res) {
  try {
    const body = req.body || {};
    const { error, value } = foodSchema.validate(body);
    if (error) return res.status(400).send(error.details[0].message);
    if (!(await db.GetMenuById(value.menuId, req.tenantId))) {
      return res.status(400).send('La categoría no existe');
    }

    const extra = {};
    if (body.recipe !== undefined || body.extras !== undefined) {
      Object.assign(extra, normalizeRecipe({ recipe: body.recipe, extras: body.extras }, await ingredientsMap(req.tenantId)));
    }
    const created = await db.CreateFood({
      ...value,
      recipe: extra.recipe || [],
      extras: extra.extras || [],
      tenantId: req.tenantId,
    });
    return res.status(201).json(created);
  } catch (err) {
    if (err instanceof RecipeError) return res.status(400).send(err.message);
    console.error(err);
    return res.status(500).send(err.message || 'Error al crear platillo');
  }
}

async function updateFood(req, res) {
  try {
    const body = req.body || {};
    const { error, value } = foodUpdateSchema.validate(body);
    if (error) return res.status(400).send(error.details[0].message);
    if (value.menuId && !(await db.GetMenuById(value.menuId, req.tenantId))) {
      return res.status(400).send('La categoría no existe');
    }

    const patch = {};
    for (const key of ['name', 'price', 'description', 'imgUrl', 'menuId']) {
      if (body[key] !== undefined) patch[key] = value[key];
    }
    if (body.recipe !== undefined || body.extras !== undefined) {
      Object.assign(patch, normalizeRecipe({ recipe: body.recipe, extras: body.extras }, await ingredientsMap(req.tenantId)));
    }
    const updated = await db.UpdateFood(req.params.id, patch, req.tenantId);
    if (!updated) return res.status(404).send('Platillo no encontrado');
    return res.status(200).json(updated);
  } catch (err) {
    if (err instanceof RecipeError) return res.status(400).send(err.message);
    console.error(err);
    return res.status(500).send(err.message || 'Error al actualizar platillo');
  }
}

async function deleteFood(req, res) {
  try {
    const result = await db.DeleteFood(req.params.id, req.tenantId);
    if (!result || result.deletedCount === 0) {
      return res.status(404).send('Platillo no encontrado');
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).send(err.message || 'Error al eliminar platillo');
  }
}

module.exports = {
  listMenus,
  getMenu,
  createMenu,
  updateMenu,
  deleteMenu,
  listFoods,
  getFood,
  createFood,
  updateFood,
  deleteFood,
};
