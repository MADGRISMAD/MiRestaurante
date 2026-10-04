const crypto = require('crypto');

const orderStatuses = ['pending', 'preparing', 'ready', 'served', 'cancelled'];
const paymentMethods = ['cash', 'card', 'transfer', 'other'];

function normalizeOrder(body = {}) {
  const items = Array.isArray(body.items)
    ? body.items.map((item) => ({
        foodId: item.foodId || item.food || item.id || null,
        name: item.name || 'Producto',
        price: Number(item.price || 0),
        quantity: Number(item.quantity || 1),
        notes: item.notes || '',
      }))
    : [];

  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const taxRate = 0.08;
  const deliveryFee = body.modality === 'takeaway' ? Number(body.deliveryFee ?? 50) : 0;
  const tax = Number((subtotal * taxRate).toFixed(2));
  const total = Number((subtotal + tax + deliveryFee).toFixed(2));

  return {
    tableId: body.tableId || null,
    tableName: body.tableName || body.mesa || 'Sin mesa',
    items,
    modality: body.modality === 'takeaway' ? 'takeaway' : 'dine-in',
    status: orderStatuses.includes(body.status) ? body.status : 'pending',
    paymentStatus: body.paymentStatus === 'paid' ? 'paid' : 'unpaid',
    paymentMethod: paymentMethods.includes(body.paymentMethod) ? body.paymentMethod : null,
    subtotal,
    tax,
    deliveryFee,
    total,
    notes: body.notes || body.description || '',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

module.exports = {
  orderStatuses,
  paymentMethods,
  normalizeOrder,
  newToken: () => crypto.randomBytes(24).toString('hex'),
};
