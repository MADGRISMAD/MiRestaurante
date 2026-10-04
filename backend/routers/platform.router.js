const router = require('express').Router();
const platform = require('../controllers/platform.controller');
const { requireAuth, requireRoles } = require('../middleware/auth.middleware');

const adminOnly = [requireAuth, requireRoles('platform_admin')];

router.get('/tenants', ...adminOnly, platform.listTenants);
router.post('/tenants/:id/suspend', ...adminOnly, platform.suspend);
router.post('/tenants/:id/reactivate', ...adminOnly, platform.reactivate);
router.patch('/tenants/:id/plan', ...adminOnly, platform.setPlan);

module.exports = router;
