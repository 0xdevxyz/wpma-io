/**
 * Team Management Service
 * Ermöglicht mehrere Teammitglieder mit unterschiedlichen Rollen
 */

const { query } = require('../config/database');
const crypto = require('crypto');

// Definierte Rollen und ihre Berechtigungen
const ROLES = {
    owner: {
        name: 'Owner',
        description: 'Vollzugriff auf alle Funktionen inkl. Abrechnung',
        permissions: ['*']
    },
    admin: {
        name: 'Admin',
        description: 'Vollzugriff außer Abrechnung und Teamverwaltung',
        permissions: [
            'sites:*', 
            'backups:*', 
            'security:*', 
            'performance:*', 
            'reports:*',
            'updates:*',
            'bulk:*'
        ]
    },
    developer: {
        name: 'Developer',
        description: 'Site-Verwaltung, Updates, Backups',
        permissions: [
            'sites:read', 'sites:update',
            'backups:*',
            'updates:*',
            'security:read',
            'performance:read',
            'bulk:updates', 'bulk:backups'
        ]
    },
    support: {
        name: 'Support',
        description: 'Lesezugriff und Basis-Support-Aktionen',
        permissions: [
            'sites:read',
            'backups:read', 'backups:restore',
            'security:read',
            'performance:read',
            'reports:read'
        ]
    },
    client: {
        name: 'Client',
        description: 'Nur Lesezugriff auf zugewiesene Sites',
        permissions: [
            'sites:read',
            'backups:read',
            'security:read',
            'performance:read',
            'reports:read'
        ]
    }
};

class TeamService {
    /**
     * Erstellt ein neues Team (passiert automatisch bei User-Erstellung)
     */
    async createTeam(ownerId, teamName) {
        try {
            const result = await query(
                `INSERT INTO teams (name, owner_id) VALUES ($1, $2) RETURNING id`,
                [teamName, ownerId]
            );

            const teamId = result.rows[0].id;

            // Owner automatisch als Teammitglied hinzufügen
            await query(
                `INSERT INTO team_members (team_id, user_id, role, status) 
                 VALUES ($1, $2, 'owner', 'active')`,
                [teamId, ownerId]
            );

            return {
                success: true,
                data: { teamId }
            };
        } catch (error) {
            console.error('Create team error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Lädt ein Teammitglied ein
     */
    async inviteTeamMember(teamId, inviterId, email, role, assignedSites = []) {
        try {
            // Prüfe ob Einlader berechtigt ist
            const inviterRole = await this.getMemberRole(teamId, inviterId);
            if (!this.canInvite(inviterRole, role)) {
                return { 
                    success: false, 
                    error: 'Keine Berechtigung, Mitglieder mit dieser Rolle einzuladen' 
                };
            }

            // Prüfe ob Email bereits im Team
            const existingResult = await query(
                `SELECT tm.id FROM team_members tm
                 JOIN users u ON tm.user_id = u.id
                 WHERE tm.team_id = $1 AND u.email = $2`,
                [teamId, email]
            );

            if (existingResult.rows.length > 0) {
                return { success: false, error: 'Benutzer ist bereits Teammitglied' };
            }

            // Generiere Einladungstoken
            const inviteToken = crypto.randomBytes(32).toString('hex');
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 7);

            // Speichere Einladung
            const result = await query(
                `INSERT INTO team_invites 
                 (team_id, email, role, invite_token, invited_by, expires_at, assigned_sites)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 RETURNING id`,
                [teamId, email, role, inviteToken, inviterId, expiresAt, JSON.stringify(assignedSites)]
            );

            // TODO: E-Mail senden
            console.log(`Team invite email should be sent to ${email} with token ${inviteToken}`);

            return {
                success: true,
                data: {
                    inviteId: result.rows[0].id,
                    inviteToken,
                    expiresAt,
                    inviteUrl: `${process.env.FRONTEND_URL}/accept-invite?token=${inviteToken}`
                }
            };
        } catch (error) {
            console.error('Invite team member error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Akzeptiert eine Team-Einladung
     */
    async acceptInvite(inviteToken, userId) {
        try {
            // Hole Einladung
            const inviteResult = await query(
                `SELECT * FROM team_invites 
                 WHERE invite_token = $1 AND status = 'pending' AND expires_at > NOW()`,
                [inviteToken]
            );

            if (inviteResult.rows.length === 0) {
                return { success: false, error: 'Einladung nicht gefunden oder abgelaufen' };
            }

            const invite = inviteResult.rows[0];

            // Prüfe ob User-Email mit Einladung übereinstimmt
            const userResult = await query('SELECT email FROM users WHERE id = $1', [userId]);
            if (userResult.rows.length === 0 || userResult.rows[0].email !== invite.email) {
                return { success: false, error: 'E-Mail stimmt nicht mit Einladung überein' };
            }

            // Füge User zum Team hinzu
            await query(
                `INSERT INTO team_members (team_id, user_id, role, status, assigned_sites)
                 VALUES ($1, $2, $3, 'active', $4)`,
                [invite.team_id, userId, invite.role, invite.assigned_sites]
            );

            // Markiere Einladung als akzeptiert
            await query(
                `UPDATE team_invites SET status = 'accepted', accepted_at = NOW() WHERE id = $1`,
                [invite.id]
            );

            // Log Aktivität
            await this.logActivity(invite.team_id, userId, 'member_joined', {
                role: invite.role,
                invitedBy: invite.invited_by
            });

            return {
                success: true,
                data: {
                    teamId: invite.team_id,
                    role: invite.role,
                    message: 'Einladung erfolgreich akzeptiert'
                }
            };
        } catch (error) {
            console.error('Accept invite error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Holt alle Teammitglieder
     */
    async getTeamMembers(teamId, requesterId) {
        try {
            // Prüfe Zugriff
            const requesterRole = await this.getMemberRole(teamId, requesterId);
            if (!requesterRole) {
                return { success: false, error: 'Kein Zugriff auf dieses Team' };
            }

            const result = await query(
                `SELECT tm.id, tm.role, tm.status, tm.assigned_sites, tm.created_at,
                        u.id as user_id, u.name, u.email
                 FROM team_members tm
                 JOIN users u ON tm.user_id = u.id
                 WHERE tm.team_id = $1
                 ORDER BY tm.created_at ASC`,
                [teamId]
            );

            return {
                success: true,
                data: result.rows.map(row => ({
                    id: row.id,
                    userId: row.user_id,
                    name: row.name,
                    email: row.email,
                    role: row.role,
                    roleName: ROLES[row.role]?.name || row.role,
                    status: row.status,
                    assignedSites: row.assigned_sites ? JSON.parse(row.assigned_sites) : [],
                    joinedAt: row.created_at
                }))
            };
        } catch (error) {
            console.error('Get team members error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Aktualisiert die Rolle eines Teammitglieds
     */
    async updateMemberRole(teamId, requesterId, memberId, newRole) {
        try {
            // Prüfe ob Requester berechtigt ist
            const requesterRole = await this.getMemberRole(teamId, requesterId);
            if (!this.canManageRole(requesterRole, newRole)) {
                return { success: false, error: 'Keine Berechtigung für diese Aktion' };
            }

            // Prüfe ob Member existiert
            const memberResult = await query(
                `SELECT * FROM team_members WHERE id = $1 AND team_id = $2`,
                [memberId, teamId]
            );

            if (memberResult.rows.length === 0) {
                return { success: false, error: 'Teammitglied nicht gefunden' };
            }

            // Owner kann nicht geändert werden
            if (memberResult.rows[0].role === 'owner') {
                return { success: false, error: 'Owner-Rolle kann nicht geändert werden' };
            }

            await query(
                `UPDATE team_members SET role = $1, updated_at = NOW() WHERE id = $2`,
                [newRole, memberId]
            );

            await this.logActivity(teamId, requesterId, 'role_changed', {
                memberId,
                oldRole: memberResult.rows[0].role,
                newRole
            });

            return {
                success: true,
                message: `Rolle erfolgreich auf ${ROLES[newRole]?.name || newRole} geändert`
            };
        } catch (error) {
            console.error('Update member role error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Entfernt ein Teammitglied
     */
    async removeMember(teamId, requesterId, memberId) {
        try {
            const requesterRole = await this.getMemberRole(teamId, requesterId);
            if (!['owner', 'admin'].includes(requesterRole)) {
                return { success: false, error: 'Keine Berechtigung für diese Aktion' };
            }

            const memberResult = await query(
                `SELECT * FROM team_members WHERE id = $1 AND team_id = $2`,
                [memberId, teamId]
            );

            if (memberResult.rows.length === 0) {
                return { success: false, error: 'Teammitglied nicht gefunden' };
            }

            if (memberResult.rows[0].role === 'owner') {
                return { success: false, error: 'Owner kann nicht entfernt werden' };
            }

            await query(`DELETE FROM team_members WHERE id = $1`, [memberId]);

            await this.logActivity(teamId, requesterId, 'member_removed', {
                memberId,
                removedUserId: memberResult.rows[0].user_id
            });

            return { success: true, message: 'Teammitglied entfernt' };
        } catch (error) {
            console.error('Remove member error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Weist einem Mitglied bestimmte Sites zu
     */
    async assignSites(teamId, requesterId, memberId, siteIds) {
        try {
            const requesterRole = await this.getMemberRole(teamId, requesterId);
            if (!['owner', 'admin'].includes(requesterRole)) {
                return { success: false, error: 'Keine Berechtigung für diese Aktion' };
            }

            await query(
                `UPDATE team_members SET assigned_sites = $1, updated_at = NOW() 
                 WHERE id = $2 AND team_id = $3`,
                [JSON.stringify(siteIds), memberId, teamId]
            );

            return { success: true, message: 'Sites zugewiesen' };
        } catch (error) {
            console.error('Assign sites error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Prüft ob ein User Zugriff auf eine Site hat
     */
    async hasAccessToSite(userId, siteId) {
        try {
            // Prüfe ob User Owner der Site ist
            const ownerResult = await query(
                'SELECT id FROM sites WHERE id = $1 AND user_id = $2',
                [siteId, userId]
            );

            if (ownerResult.rows.length > 0) {
                return { hasAccess: true, role: 'owner' };
            }

            // Prüfe Teammitgliedschaft
            const teamResult = await query(
                `SELECT tm.role, tm.assigned_sites
                 FROM team_members tm
                 JOIN teams t ON tm.team_id = t.id
                 JOIN sites s ON s.user_id = t.owner_id
                 WHERE tm.user_id = $1 AND s.id = $2 AND tm.status = 'active'`,
                [userId, siteId]
            );

            if (teamResult.rows.length === 0) {
                return { hasAccess: false };
            }

            const member = teamResult.rows[0];
            
            // Owner und Admin haben Zugriff auf alle Sites
            if (['owner', 'admin'].includes(member.role)) {
                return { hasAccess: true, role: member.role };
            }

            // Andere Rollen: Prüfe assigned_sites
            const assignedSites = member.assigned_sites 
                ? JSON.parse(member.assigned_sites) 
                : [];

            if (assignedSites.length === 0 || assignedSites.includes(siteId)) {
                return { hasAccess: true, role: member.role };
            }

            return { hasAccess: false };
        } catch (error) {
            console.error('Has access to site error:', error);
            return { hasAccess: false };
        }
    }

    /**
     * Prüft ob User eine bestimmte Aktion ausführen darf
     */
    async hasPermission(userId, siteId, permission) {
        try {
            const access = await this.hasAccessToSite(userId, siteId);
            
            if (!access.hasAccess) {
                return false;
            }

            const rolePermissions = ROLES[access.role]?.permissions || [];

            // Wildcard-Check
            if (rolePermissions.includes('*')) {
                return true;
            }

            // Exakte Übereinstimmung
            if (rolePermissions.includes(permission)) {
                return true;
            }

            // Wildcard für Ressource (z.B. 'sites:*')
            const [resource, action] = permission.split(':');
            if (rolePermissions.includes(`${resource}:*`)) {
                return true;
            }

            return false;
        } catch (error) {
            console.error('Has permission error:', error);
            return false;
        }
    }

    /**
     * Holt das Team eines Users
     */
    async getUserTeam(userId) {
        try {
            const result = await query(
                `SELECT t.*, tm.role 
                 FROM teams t
                 JOIN team_members tm ON t.id = tm.team_id
                 WHERE tm.user_id = $1 AND tm.status = 'active'
                 LIMIT 1`,
                [userId]
            );

            if (result.rows.length === 0) {
                return { success: true, data: null };
            }

            const team = result.rows[0];

            return {
                success: true,
                data: {
                    id: team.id,
                    name: team.name,
                    ownerId: team.owner_id,
                    userRole: team.role,
                    createdAt: team.created_at
                }
            };
        } catch (error) {
            console.error('Get user team error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Holt ausstehende Einladungen
     */
    async getPendingInvites(teamId, requesterId) {
        try {
            const requesterRole = await this.getMemberRole(teamId, requesterId);
            if (!['owner', 'admin'].includes(requesterRole)) {
                return { success: false, error: 'Keine Berechtigung' };
            }

            const result = await query(
                `SELECT ti.*, u.name as invited_by_name
                 FROM team_invites ti
                 LEFT JOIN users u ON ti.invited_by = u.id
                 WHERE ti.team_id = $1 AND ti.status = 'pending' AND ti.expires_at > NOW()
                 ORDER BY ti.created_at DESC`,
                [teamId]
            );

            return {
                success: true,
                data: result.rows
            };
        } catch (error) {
            console.error('Get pending invites error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Widerruft eine Einladung
     */
    async revokeInvite(teamId, requesterId, inviteId) {
        try {
            const requesterRole = await this.getMemberRole(teamId, requesterId);
            if (!['owner', 'admin'].includes(requesterRole)) {
                return { success: false, error: 'Keine Berechtigung' };
            }

            await query(
                `UPDATE team_invites SET status = 'revoked' 
                 WHERE id = $1 AND team_id = $2`,
                [inviteId, teamId]
            );

            return { success: true, message: 'Einladung widerrufen' };
        } catch (error) {
            console.error('Revoke invite error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Holt Audit Log
     */
    async getAuditLog(teamId, requesterId, limit = 50) {
        try {
            const requesterRole = await this.getMemberRole(teamId, requesterId);
            if (!['owner', 'admin'].includes(requesterRole)) {
                return { success: false, error: 'Keine Berechtigung' };
            }

            const result = await query(
                `SELECT tal.*, u.name as user_name, u.email as user_email
                 FROM team_activity_log tal
                 LEFT JOIN users u ON tal.user_id = u.id
                 WHERE tal.team_id = $1
                 ORDER BY tal.created_at DESC
                 LIMIT $2`,
                [teamId, limit]
            );

            return {
                success: true,
                data: result.rows
            };
        } catch (error) {
            console.error('Get audit log error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Hilfsfunktionen
     */
    async getMemberRole(teamId, userId) {
        const result = await query(
            `SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2 AND status = 'active'`,
            [teamId, userId]
        );
        return result.rows.length > 0 ? result.rows[0].role : null;
    }

    canInvite(inviterRole, targetRole) {
        const hierarchy = ['owner', 'admin', 'developer', 'support', 'client'];
        const inviterIndex = hierarchy.indexOf(inviterRole);
        const targetIndex = hierarchy.indexOf(targetRole);
        
        // Kann nur Rollen unter der eigenen einladen
        return inviterIndex !== -1 && targetIndex > inviterIndex;
    }

    canManageRole(requesterRole, targetRole) {
        return ['owner', 'admin'].includes(requesterRole) && targetRole !== 'owner';
    }

    async logActivity(teamId, userId, action, details = {}) {
        try {
            await query(
                `INSERT INTO team_activity_log (team_id, user_id, action, details)
                 VALUES ($1, $2, $3, $4)`,
                [teamId, userId, action, JSON.stringify(details)]
            );
        } catch (error) {
            console.error('Log activity error:', error);
        }
    }

    /**
     * Gibt verfügbare Rollen zurück
     */
    getAvailableRoles() {
        return Object.entries(ROLES).map(([key, value]) => ({
            id: key,
            name: value.name,
            description: value.description
        }));
    }
}

module.exports = new TeamService();

