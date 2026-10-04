const db = require('../database/mongodb');

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

async function createFood(req, res) {
  try {
    const { name, price, description, imgUrl, menuId } = req.body || {};
    if (!name || price == null || !menuId) {
      return res.status(400).send('name, price y menuId son requeridos');
    }
    const created = await db.CreateFood({
      name,
      price: Number(price),
      description: description || '',
      imgUrl: imgUrl || '',
      menuId: String(menuId),
      tenantId: req.tenantId,
    });
    return res.status(201).json(created);
  } catch (err) {
    console.error(err);
    return res.status(500).send(err.message || 'Error al crear platillo');
  }
}

async function updateFood(req, res) {
  try {
    const updated = await db.UpdateFood(req.params.id, req.body || {}, req.tenantId);
    if (!updated) return res.status(404).send('Platillo no encontrado');
    return res.status(200).json(updated);
  } catch (err) {
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
