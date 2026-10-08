const router = require('express').Router();
const orders = require('../controllers/orders.controller');
const { requireAuth, requireActiveSubscription, requireRoles } = require('../middleware/auth.middleware');

router.get(
  '/',
  requireAuth, requireActiveSubscription,
  requireRoles('admin', 'cashier', 'waiter', 'kitchen', 'host'),
  orders.list
);
router.get(
  '/:id',
  requireAuth, requireActiveSubscription,
  requireRoles('admin', 'cashier', 'waiter', 'kitchen', 'host'),
  orders.getById
);
router.post('/', requireAuth, requireActiveSubscription, requireRoles('admin', 'cashier', 'waiter'), orders.create);
// Venta de mostrador (café): pide + cobra en un paso
router.post('/counter', requireAuth, requireActiveSubscription, requireRoles('admin', 'cashier'), orders.counterSale);
router.put(
  '/:id/status',
  requireAuth, requireActiveSubscription,
  requireRoles('admin', 'cashier', 'kitchen', 'waiter'),
  orders.updateStatus
);
router.put('/:id/pay', requireAuth, requireActiveSubscription, requireRoles('admin', 'cashier'), orders.pay);

module.exports = router;
