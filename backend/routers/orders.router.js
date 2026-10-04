const router = require('express').Router();
const orders = require('../controllers/orders.controller');
const { requireAuth, requireActiveSubscription, requireRoles } = require('../middleware/auth.middleware');

router.get(
  '/',
  requireAuth, requireActiveSubscription,
  requireRoles('admin', 'cashier', 'waiter', 'kitchen', 'hosstess'),
  orders.list
);
router.get(
  '/:id',
  requireAuth, requireActiveSubscription,
  requireRoles('admin', 'cashier', 'waiter', 'kitchen', 'hosstess'),
  orders.getById
);
router.post('/', requireAuth, requireActiveSubscription, requireRoles('admin', 'cashier', 'waiter'), orders.create);
router.put(
  '/:id/status',
  requireAuth, requireActiveSubscription,
  requireRoles('admin', 'cashier', 'kitchen', 'waiter'),
  orders.updateStatus
);
router.put('/:id/pay', requireAuth, requireActiveSubscription, requireRoles('admin', 'cashier'), orders.pay);

module.exports = router;
