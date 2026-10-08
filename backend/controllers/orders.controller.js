const db = require('../database/mongodb');
const { normalizeOrder, orderStatuses, paymentMethods } = require('../models/order.model');
const inv = require('../models/inventory');
const inventory = require('../services/inventory.service');

const round2 = (n) => Number(Number(n).toFixed(2));
const MAX_LINES = 50;
const MAX_QTY = 99;

// Día natural en la zona horaria del negocio (el turno del mostrador se reinicia cada día).
function dayKey(timezone) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone || 'America/Mexico_City',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

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

    try {
      const foodsById = new Map((await db.GetFoods(req.tenantId)).map((f) => [String(f.id), f]));
      await inventory.applySale({ tenantId: req.tenantId, order: created, foodsById, by: req.user?.username });
    } catch (e) {
      console.error('[inventory] pedido sin descontar:', e.message);
    }

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
    const existing = await db.GetOrderById(req.params.id, req.tenantId);
    if (!existing) return res.status(404).send('Pedido no encontrado');

    const patch = { status, updatedAt: new Date() };
    if (status === 'cancelled' && existing.status !== 'cancelled') {
      const restored = await inventory
        .restoreSale({ tenantId: req.tenantId, order: existing, by: req.user?.username })
        .catch((e) => { console.error('[inventory] no se devolvió el stock:', e.message); return false; });
      if (restored) patch.stockRestored = true;
    }
    const updated = await db.UpdateOrder(req.params.id, patch, req.tenantId);
    if (!updated) return res.status(404).send('Pedido no encontrado');
    return res.status(200).json(updated);
  } catch (err) {
    console.error(err);
    return res.status(500).send(err.message || 'Error al actualizar estado');
  }
}

/**
 * Venta de mostrador (café): pide, cobra y entrega en un solo paso, sin mesa ni cocina.
 * - Los precios salen del menú del negocio, no del cliente.
 * - Exige caja abierta y entra en el cierre de esa caja.
 * - `clientRef` evita ventas duplicadas por doble clic o reintento de red.
 */
async function counterSale(req, res) {
  try {
    const body = req.body || {};
    const method = body.paymentMethod || 'cash';
    if (!paymentMethods.includes(method)) return res.status(400).send('Método de pago inválido');

    const session = await db.GetOpenCashSession(req.tenantId);
    if (!session) return res.status(400).send('Abre la caja antes de vender');

    const clientRef = typeof body.clientRef === 'string' && body.clientRef ? body.clientRef.slice(0, 64) : null;
    if (clientRef) {
      const duplicate = await db.GetOrderByClientRef(req.tenantId, clientRef);
      if (duplicate) return res.status(200).json(duplicate);
    }

    const lines = Array.isArray(body.items) ? body.items : [];
    if (!lines.length) return res.status(400).send('Agrega al menos un producto');
    if (lines.length > MAX_LINES) return res.status(400).send('Demasiados productos en una venta');

    const foods = new Map((await db.GetFoods(req.tenantId)).map((f) => [String(f.id), f]));
    const items = [];
    for (const line of lines) {
      const quantity = Number(line.quantity);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QTY) {
        return res.status(400).send('Cantidad inválida');
      }
      const food = foods.get(String(line.foodId));
      if (!food) return res.status(400).send('Un producto ya no existe en el menú. Actualiza la pantalla.');
      // Los extras (pumps de sabor, azúcar…) se validan contra lo que el platillo ofrece y se cobran al
      // precio del menú; lo que mande el cliente solo dice cuántos de cada uno.
      const resolved = inv.resolveOptions(food, line.options);
      if (resolved.error) return res.status(400).send(resolved.error);
      items.push({
        foodId: food.id,
        name: food.name,
        price: inv.unitPriceWithExtras(food, resolved.options),
        basePrice: Number(food.price) || 0,
        options: resolved.options,
        quantity,
        notes: String(line.notes || '').trim().slice(0, 80),
      });
    }

    // normalizeOrder calcula subtotal, IVA y total; no hay costo de envío en mostrador.
    const payload = normalizeOrder({ items, modality: 'dine-in' });
    payload.items = items; // normalizeOrder solo conserva los campos básicos; aquí también van las opciones
    const customerName = String(body.customerName || '').trim().slice(0, 40);
    let received = null;
    if (method === 'cash') {
      received = body.amountReceived == null || body.amountReceived === '' ? payload.total : Number(body.amountReceived);
      if (!Number.isFinite(received) || received < payload.total) {
        return res.status(400).send('El efectivo recibido no cubre el total');
      }
    }

    const settings = await db.GetSettings(req.tenantId);
    const now = new Date();
    Object.assign(payload, {
      tenantId: req.tenantId,
      source: 'counter',
      modality: body.takeaway ? 'takeaway' : 'dine-in',
      tableId: null,
      customerName,
      tableName: customerName ? `Mostrador · ${customerName}` : 'Mostrador',
      status: 'served',
      paymentStatus: 'paid',
      paymentMethod: method,
      paidAt: now,
      cashSessionId: session.id,
      createdBy: req.user?.username || null,
      turno: await db.NextCounter(req.tenantId, `turno-${dayKey(settings?.timezone)}`),
      createdAt: now,
      updatedAt: now,
    });
    if (clientRef) payload.clientRef = clientRef;
    if (received != null) {
      payload.amountReceived = round2(received);
      payload.change = round2(received - payload.total);
    }

    try {
      const created = await db.CreateOrder(payload);
      // Descuenta el inventario; si algo falla ahí, la venta ya hecha no se pierde
      await inventory
        .applySale({ tenantId: req.tenantId, order: created, foodsById: foods, by: req.user?.username })
        .catch((e) => console.error('[inventory] venta sin descontar:', e.message));
      return res.status(201).json(created);
    } catch (err) {
      // Dos peticiones iguales a la vez: la segunda choca con el índice único y devuelve la primera.
      if (err?.code === 11000 && clientRef) {
        const existing = await db.GetOrderByClientRef(req.tenantId, clientRef);
        if (existing) return res.status(200).json(existing);
      }
      throw err;
    }
  } catch (err) {
    console.error(err);
    return res.status(500).send(err.message || 'Error al registrar la venta');
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

module.exports = { list, getById, create, updateStatus, pay, counterSale };
