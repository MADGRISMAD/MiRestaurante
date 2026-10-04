const router = require('express').Router();
const multer = require('multer');
const upload = multer();
const settingsController = require('../controllers/settings.controller');
const { requireAuth, requireActiveSubscription, requireRoles } = require('../middleware/auth.middleware');

// Lectura permitida aunque el trial haya vencido (banner / billing)
router.get('/', requireAuth, upload.none(), settingsController.GetSettings);
router.post(
  '/',
  requireAuth,
  requireActiveSubscription,
  requireRoles('admin'),
  upload.none(),
  settingsController.SaveSettings
);
router.put(
  '/',
  requireAuth,
  requireActiveSubscription,
  requireRoles('admin'),
  upload.none(),
  settingsController.SaveSettings
);

module.exports = router;
