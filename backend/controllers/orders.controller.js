const db = require('../database/mongodb');
const { normalizeOrder, orderStatuses, paymentMethods } = require('../models/order.model');

async function list(req, res) {
  try {
    return res.status(200).json(await db.GetOrders(req.tenantId));
  } catch (err) {
    console.error(err);
    return res.status(500).send(err.message || 'Error al listar pedidos');
  }
}

async function getById(req, res) {
  try {
    const order = await db.GetOrderById(req.params.id, req.tenantId);
    if (!order) return res.status(404).send('Pedido no encontrado');
    return res.status(200).json(order);
  } catch (err) {
    console.error(err);
    return res.status(500).send(err.message || 'Error al obtener pedido');
  }
}

async function create(req, res) {
  try {
    const body = req.body || {};
    if ((!body.items || !body.items.length) && Array.isArray(body.foods)) {
      body.items = body.foods.map((f) => ({
        foodId: f.food || f.foodId || f.id,
        name: f.name || 'Producto',
        price: Number(f.price || 0),
        quantity: Number(f.quantity || 1),
      }));
    }
    if (typeof body.modality === 'number') {
      body.modality = body.modality === 2 ? 'takeaway' : 'dine-in';
    }

    const payload = normalizeOrder(body);
    payload.tenantId = req.tenantId;
    if (!payload.items.length) {
      return res.status(400).send('El pedido necesita al menos un producto');
    }

    const created = await db.CreateOrder(payload);

    if (payload.tableId && payload.modality === 'dine-in') {
      try {
        await db.UpdateStatusMesa(
          payload.tableId,
          {
            disponible: false,
            personaTitular: body.personaTitular || payload.tableName,
          },
          req.tenantId
        );
      } catch (e) {
        console.warn('No se pudo ocupar la mesa:', e.message);
      }
    }

    return res.status(201).json(created);
  } catch (err) {
    console.error(err);
    return res.status(500).send(err.message || 'Error al crear pedido');
  }
}

async function updateStatus(req, res) {
  try {
    const status = req.body?.status;
    if (!orderStatuses.includes(status)) {
      return res.status(400).send('Estado inválido');
    }
    const updated = await db.UpdateOrder(
      req.params.id,
      { status, updatedAt: new Date() },
      req.tenantId
    );
    if (!updated) return res.status(404).send('Pedido no encontrado');
    return res.status(200).json(updated);
  } catch (err) {
    console.error(err);
    return res.status(500).send(err.message || 'Error al actualizar estado');
  }
}

async function pay(req, res) {
  try {
    const method = req.body?.paymentMethod || 'cash';
    if (!paymentMethods.includes(method)) {
      return res.status(400).send('Método de pago inválido');
    }

    const session = await db.GetOpenCashSession(req.tenantId);
    if (!session) {
      return res.status(400).send('Debes abrir la caja antes de cobrar');
    }

    const existing = await db.GetOrderById(req.params.id, req.tenantId);
    if (!existing) return res.status(404).send('Pedido no encontrado');
    if (existing.paymentStatus === 'paid') {
      return res.status(400).send('El pedido ya está cobrado');
    }

    const updated = await db.UpdateOrder(
      req.params.id,
      {
        paymentStatus: 'paid',
        paymentMethod: method,
        status: existing.status === 'cancelled' ? existing.status : 'served',
        paidAt: new Date(),
        updatedAt: new Date(),
        cashSessionId: session.id,
      },
      req.tenantId
    );

    if (existing.tableId) {
      try {
        await db.UpdateStatusMesa(
          existing.tableId,
          { disponible: true, personaTitular: null },
          req.tenantId
        );
      } catch (e) {
        console.warn('No se pudo liberar la mesa:', e.message);
      }
    }

    return res.status(200).json(updated);
  } catch (err) {
    console.error(err);
    return res.status(500).send(err.message || 'Error al cobrar pedido');
  }
}

module.exports = { list, getById, create, updateStatus, pay };
