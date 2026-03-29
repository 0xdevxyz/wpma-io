const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const teamController = require('../controllers/teamController');

router.use(authenticateToken);

router.get('/', teamController.getUserTeam.bind(teamController));
router.get('/roles', teamController.getRoles.bind(teamController));
router.get('/check-access/:siteId', teamController.checkAccess.bind(teamController));
router.get('/:teamId/members', teamController.getTeamMembers.bind(teamController));
router.get('/:teamId/invites', teamController.getPendingInvites.bind(teamController));
router.get('/:teamId/audit-log', teamController.getAuditLog.bind(teamController));

router.post('/:teamId/invite', teamController.inviteTeamMember.bind(teamController));
router.post('/accept-invite', teamController.acceptInvite.bind(teamController));

router.put('/:teamId/members/:memberId/role', teamController.updateMemberRole.bind(teamController));
router.put('/:teamId/members/:memberId/sites', teamController.assignSites.bind(teamController));

router.delete('/:teamId/members/:memberId', teamController.removeMember.bind(teamController));
router.delete('/:teamId/invites/:inviteId', teamController.revokeInvite.bind(teamController));

module.exports = router;
