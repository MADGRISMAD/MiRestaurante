const router = require('express').Router();
const team = require('../controllers/team.controller');
const { requireAuth, requireActiveSubscription, requireRoles, requireFreshRole } = require('../middleware/auth.middleware');

// Solo el administrador gestiona al equipo y sus roles. requireFreshRole vuelve a leer
// el rol en la base de datos, para que un admin degradado o eliminado pierda el acceso
// de inmediato y no cuando expire su token.
const adminOnly = [requireAuth, requireActiveSubscription, requireRoles('admin'), requireFreshRole('admin')];

router.get('/', ...adminOnly, team.list);
router.post('/', ...adminOnly, team.create);
router.put('/:id/role', ...adminOnly, team.changeRole);
router.put('/:id/password', ...adminOnly, team.resetPassword);
router.delete('/:id', ...adminOnly, team.remove);

module.exports = router;
