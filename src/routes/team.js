/**
 * Team Management Routes
 * API-Endpunkte für Team- und Mitgliederverwaltung
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const TeamService = require('../services/teamService');

router.use(authenticateToken);

/**
 * GET /api/v1/team
 * Holt das Team des aktuellen Users
 */
router.get('/', async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        const result = await TeamService.getUserTeam(userId);
        res.json(result);
    } catch (error) {
        console.error('Get team error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/v1/team/roles
 * Holt verfügbare Rollen
 */
router.get('/roles', async (req, res) => {
    res.json({
        success: true,
        data: TeamService.getAvailableRoles()
    });
});

/**
 * GET /api/v1/team/:teamId/members
 * Holt alle Teammitglieder
 */
router.get('/:teamId/members', async (req, res) => {
    try {
        const { teamId } = req.params;
        const userId = req.user?.userId || req.user?.id;
        
        const result = await TeamService.getTeamMembers(parseInt(teamId), userId);
        res.json(result);
    } catch (error) {
        console.error('Get team members error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/v1/team/:teamId/invite
 * Lädt ein neues Teammitglied ein
 */
router.post('/:teamId/invite', async (req, res) => {
    try {
        const { teamId } = req.params;
        const userId = req.user?.userId || req.user?.id;
        const { email, role, assignedSites } = req.body;

        if (!email || !role) {
            return res.status(400).json({
                success: false,
                error: 'E-Mail und Rolle sind erforderlich'
            });
        }

        const result = await TeamService.inviteTeamMember(
            parseInt(teamId),
            userId,
            email,
            role,
            assignedSites || []
        );

        res.json(result);
    } catch (error) {
        console.error('Invite member error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/v1/team/accept-invite
 * Akzeptiert eine Team-Einladung
 */
router.post('/accept-invite', async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({
                success: false,
                error: 'Einladungstoken erforderlich'
            });
        }

        const result = await TeamService.acceptInvite(token, userId);
        res.json(result);
    } catch (error) {
        console.error('Accept invite error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * PUT /api/v1/team/:teamId/members/:memberId/role
 * Ändert die Rolle eines Teammitglieds
 */
router.put('/:teamId/members/:memberId/role', async (req, res) => {
    try {
        const { teamId, memberId } = req.params;
        const userId = req.user?.userId || req.user?.id;
        const { role } = req.body;

        if (!role) {
            return res.status(400).json({
                success: false,
                error: 'Neue Rolle erforderlich'
            });
        }

        const result = await TeamService.updateMemberRole(
            parseInt(teamId),
            userId,
            parseInt(memberId),
            role
        );

        res.json(result);
    } catch (error) {
        console.error('Update member role error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * PUT /api/v1/team/:teamId/members/:memberId/sites
 * Weist einem Mitglied Sites zu
 */
router.put('/:teamId/members/:memberId/sites', async (req, res) => {
    try {
        const { teamId, memberId } = req.params;
        const userId = req.user?.userId || req.user?.id;
        const { siteIds } = req.body;

        const result = await TeamService.assignSites(
            parseInt(teamId),
            userId,
            parseInt(memberId),
            siteIds || []
        );

        res.json(result);
    } catch (error) {
        console.error('Assign sites error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * DELETE /api/v1/team/:teamId/members/:memberId
 * Entfernt ein Teammitglied
 */
router.delete('/:teamId/members/:memberId', async (req, res) => {
    try {
        const { teamId, memberId } = req.params;
        const userId = req.user?.userId || req.user?.id;

        const result = await TeamService.removeMember(
            parseInt(teamId),
            userId,
            parseInt(memberId)
        );

        res.json(result);
    } catch (error) {
        console.error('Remove member error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/v1/team/:teamId/invites
 * Holt ausstehende Einladungen
 */
router.get('/:teamId/invites', async (req, res) => {
    try {
        const { teamId } = req.params;
        const userId = req.user?.userId || req.user?.id;

        const result = await TeamService.getPendingInvites(parseInt(teamId), userId);
        res.json(result);
    } catch (error) {
        console.error('Get invites error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * DELETE /api/v1/team/:teamId/invites/:inviteId
 * Widerruft eine Einladung
 */
router.delete('/:teamId/invites/:inviteId', async (req, res) => {
    try {
        const { teamId, inviteId } = req.params;
        const userId = req.user?.userId || req.user?.id;

        const result = await TeamService.revokeInvite(
            parseInt(teamId),
            userId,
            parseInt(inviteId)
        );

        res.json(result);
    } catch (error) {
        console.error('Revoke invite error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/v1/team/:teamId/audit-log
 * Holt das Audit Log
 */
router.get('/:teamId/audit-log', async (req, res) => {
    try {
        const { teamId } = req.params;
        const userId = req.user?.userId || req.user?.id;
        const limit = parseInt(req.query.limit) || 50;

        const result = await TeamService.getAuditLog(parseInt(teamId), userId, limit);
        res.json(result);
    } catch (error) {
        console.error('Get audit log error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/v1/team/check-access/:siteId
 * Prüft ob User Zugriff auf eine Site hat
 */
router.get('/check-access/:siteId', async (req, res) => {
    try {
        const { siteId } = req.params;
        const userId = req.user?.userId || req.user?.id;
        const { permission } = req.query;

        if (permission) {
            const hasPermission = await TeamService.hasPermission(userId, parseInt(siteId), permission);
            return res.json({ success: true, hasPermission });
        }

        const access = await TeamService.hasAccessToSite(userId, parseInt(siteId));
        res.json({ success: true, ...access });
    } catch (error) {
        console.error('Check access error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;

