const db = require('../database/mongodb');

function mapMesa(mesa) {
  if (!mesa) return null;
  return {
    ...mesa,
    id: mesa.id || String(mesa._id),
    capacidad: Number(mesa.capacidad),
    disponible: Boolean(mesa.disponible),
    posX: mesa.posX != null ? Number(mesa.posX) : null,
    posY: mesa.posY != null ? Number(mesa.posY) : null,
  };
}

/**
 * Campos de aviso al mesero cuando cambia la asignación de una mesa.
 * Se avisa cuando la mesa queda ocupada con un mesero nuevo (la hostess sienta
 * clientes o cambia de mesero). Si quien asigna es el propio mesero, no hay aviso.
 * Al liberar la mesa se limpia todo.
 */
function assignmentPatch(current, patch, { username, cellphone } = {}, now = new Date()) {
  if (patch.disponible === true) {
    return { asignadaEn: null, asignadaPor: null, avisoVisto: null, personas: null };
  }
  const out = {};
  const busy = patch.disponible === false || (patch.disponible === undefined && current.disponible === false);
  const waiter = patch.mesero !== undefined ? patch.mesero : current.mesero;
  const seated = patch.disponible === false && current.disponible !== false;
  const changedWaiter = Boolean(patch.mesero) && patch.mesero !== current.mesero;
  if (busy && waiter && (seated || changedWaiter)) {
    out.asignadaEn = now;
    out.asignadaPor = username || null;
    out.avisoVisto = Boolean(cellphone) && String(cellphone) === String(waiter);
  }
  if (patch.avisoVisto === true) out.avisoVisto = true;
  return out;
}

async function list(req, res) {
  try {
    const mesas = await db.Getmesas(req.tenantId);
    return res.status(200).json(mesas.map(mapMesa));
  } catch (err) {
    console.error(err);
    return res.status(500).send(err.message || 'Error al listar mesas');
  }
}

async function getById(req, res) {
  try {
    const mesa = await db.GetMesaById(req.params.id, req.tenantId);
    if (!mesa) return res.status(404).send('Mesa no encontrada');
    return res.status(200).json(mapMesa(mesa));
  } catch (err) {
    console.error(err);
    return res.status(500).send(err.message || 'Error al obtener mesa');
  }
}

async function create(req, res) {
  try {
    const body = req.body || {};
    const nombre = String(body.nombre || '').trim();
    const capacidad = Number(body.capacidad);
    if (!nombre || !capacidad) {
      return res.status(400).send('nombre y capacidad son requeridos');
    }

    const existing = await db.GetMesaById(nombre, req.tenantId);
    if (existing) {
      return res.status(400).send('Mesa ya existe');
    }

    const numero = body.numero ? Number(body.numero) : await db.GetNextMesaNumero(req.tenantId);
    const payload = {
      tenantId: req.tenantId,
      numero,
      nombre,
      capacidad,
      disponible: body.disponible !== undefined ? Boolean(body.disponible) : true,
      mesero: body.mesero || null,
      personaTitular: body.personaTitular || null,
      personas: body.personas != null ? Number(body.personas) : null,
      posX: body.posX != null ? Number(body.posX) : null,
      posY: body.posY != null ? Number(body.posY) : null,
    };

    const created = await db.AddMesa(payload);
    return res.status(201).json(mapMesa(created));
  } catch (err) {
    console.error(err);
    return res.status(500).send(err.message || 'Error al crear mesa');
  }
}

async function update(req, res) {
  try {
    const body = req.body || {};
    const patch = {
      disponible: body.disponible,
      personaTitular: body.personaTitular,
      mesero: body.mesero,
      nombre: body.nombre,
      capacidad: body.capacidad != null ? Number(body.capacidad) : undefined,
      personas: body.personas != null ? Number(body.personas) : undefined,
      avisoVisto: body.avisoVisto === true ? true : undefined,
      posX: body.posX != null ? Number(body.posX) : undefined,
      posY: body.posY != null ? Number(body.posY) : undefined,
    };
    Object.keys(patch).forEach((k) => patch[k] === undefined && delete patch[k]);

    const assigning = patch.disponible !== undefined || patch.mesero !== undefined || patch.avisoVisto;
    if (assigning) {
      const current = await db.GetMesaById(req.params.id, req.tenantId);
      if (!current) return res.status(404).send('Mesa no existe');
      const me = patch.mesero || patch.disponible === false
        ? await db.FindUserByUsername(req.user?.username, req.tenantId)
        : null;
      Object.assign(patch, assignmentPatch(current, patch, { username: req.user?.username, cellphone: me?.cellphone }));
    }

    const result = await db.UpdateStatusMesa(req.params.id, patch, req.tenantId);
    if (!result || result.matchedCount === 0) {
      return res.status(404).send('Mesa no existe');
    }
    const mesa = await db.GetMesaById(req.params.id, req.tenantId);
    return res.status(200).json(mapMesa(mesa));
  } catch (err) {
    console.error(err);
    return res.status(500).send(err.message || 'Error al actualizar mesa');
  }
}

async function remove(req, res) {
  try {
    const result = await db.DeleteMesa(req.params.id, req.tenantId);
    if (!result || result.deletedCount === 0) {
      return res.status(404).send('Mesa no existe');
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).send(err.message || 'Error al eliminar mesa');
  }
}

module.exports = { list, getById, create, update, remove, assignmentPatch };
