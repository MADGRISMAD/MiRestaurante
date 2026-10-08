/**
 * Descuento y devolución de inventario ligados a un pedido.
 * Al vender se guarda en el pedido una instantánea de lo descontado (`stockLines`): así devolverlo al
 * cancelar no depende de cómo estén las recetas ese día. Un error aquí nunca debe impedir la venta.
 */
const db = require('../database/mongodb');
const { stockLinesFor } = require('../models/inventory');

/** Descuenta lo que consume el pedido. @returns las líneas descontadas ([] si nada tiene receta). */
async function applySale({ tenantId, order, foodsById, by }) {
  const lines = stockLinesFor(order.items, foodsById);
  if (!lines.length) return [];
  for (const line of lines) {
    try {
      await db.AdjustStock(tenantId, line.ingredientId, -line.amount, { type: 'sale', orderId: order.id, by });
    } catch (err) {
      console.error('[inventory] no se pudo descontar un ingrediente:', err.message);
    }
  }
  await db.UpdateOrder(order.id, { stockApplied: true, stockLines: lines }, tenantId);
  return lines;
}

/** Devuelve al inventario lo que descontó el pedido, una sola vez. @returns true si devolvió algo. */
async function restoreSale({ tenantId, order, by }) {
  if (!order.stockApplied || order.stockRestored || !Array.isArray(order.stockLines)) return false;
  for (const line of order.stockLines) {
    try {
      await db.AdjustStock(tenantId, line.ingredientId, line.amount, { type: 'return', orderId: order.id, by, note: 'Pedido cancelado' });
    } catch (err) {
      console.error('[inventory] no se pudo devolver un ingrediente:', err.message);
    }
  }
  return true;
}

module.exports = { applySale, restoreSale };
