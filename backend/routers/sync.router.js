const router = require('express').Router();
const db = require('../database/mongodb');
const { requireAuth } = require('../middleware/auth.middleware');

// Contadores de cambios del negocio, para que las pantallas recarguen solo cuando algo cambió.
// Se consulta cada ~2 s desde cada dispositivo, así que es a propósito la ruta más barata:
// una sola lectura y sin comprobar la suscripción (los datos reales sí la comprueban).
router.get('/', requireAuth, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const v = req.tenantId
      ? await db.GetSyncVersions(req.tenantId)
      : { orders: 0, tables: 0, waitlist: 0, inventory: 0 };
    return res.status(200).json({ v, t: Date.now() });
  } catch (err) {
    console.error(err);
    return res.status(500).send('Error de sincronización');
  }
});

module.exports = router;
