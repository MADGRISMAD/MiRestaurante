const router = require('express').Router();
const ingredients = require('../controllers/ingredients.controller');
const { requireAuth, requireActiveSubscription, requireRoles } = require('../middleware/auth.middleware');

// Ver el inventario: quien vende (para saber qué falta). Cambiarlo: solo el administrador.
const base = [requireAuth, requireActiveSubscription];
const read = requireRoles('admin', 'cashier');
const write = requireRoles('admin');

router.get('/', ...base, read, ingredients.list);
router.get('/movements', ...base, write, ingredients.movements);
router.post('/', ...base, write, ingredients.create);
router.put('/:id', ...base, write, ingredients.update);
router.delete('/:id', ...base, write, ingredients.remove);
router.post('/:id/stock', ...base, write, ingredients.stockOp);

module.exports = router;
