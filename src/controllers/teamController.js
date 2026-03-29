const TeamService = require('../services/teamService');

class TeamController {
    async getUserTeam(req, res) {
        try {
            const userId = req.user?.userId;
            const result = await TeamService.getUserTeam(userId);
            res.json(result);
        } catch (error) {
            console.error('Get team error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    getRoles(req, res) {
        res.json({
            success: true,
            data: TeamService.getAvailableRoles()
        });
    }

    async getTeamMembers(req, res) {
        try {
            const { teamId } = req.params;
            const userId = req.user?.userId;

            const result = await TeamService.getTeamMembers(parseInt(teamId), userId);
            res.json(result);
        } catch (error) {
            console.error('Get team members error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async inviteTeamMember(req, res) {
        try {
            const { teamId } = req.params;
            const userId = req.user?.userId;
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
    }

    async acceptInvite(req, res) {
        try {
            const userId = req.user?.userId;
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
    }

    async updateMemberRole(req, res) {
        try {
            const { teamId, memberId } = req.params;
            const userId = req.user?.userId;
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
    }

    async assignSites(req, res) {
        try {
            const { teamId, memberId } = req.params;
            const userId = req.user?.userId;
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
    }

    async removeMember(req, res) {
        try {
            const { teamId, memberId } = req.params;
            const userId = req.user?.userId;

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
    }

    async getPendingInvites(req, res) {
        try {
            const { teamId } = req.params;
            const userId = req.user?.userId;

            const result = await TeamService.getPendingInvites(parseInt(teamId), userId);
            res.json(result);
        } catch (error) {
            console.error('Get invites error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async revokeInvite(req, res) {
        try {
            const { teamId, inviteId } = req.params;
            const userId = req.user?.userId;

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
    }

    async getAuditLog(req, res) {
        try {
            const { teamId } = req.params;
            const userId = req.user?.userId;
            const limit = parseInt(req.query.limit) || 50;

            const result = await TeamService.getAuditLog(parseInt(teamId), userId, limit);
            res.json(result);
        } catch (error) {
            console.error('Get audit log error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async checkAccess(req, res) {
        try {
            const { siteId } = req.params;
            const userId = req.user?.userId;
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
    }
}

module.exports = new TeamController();
