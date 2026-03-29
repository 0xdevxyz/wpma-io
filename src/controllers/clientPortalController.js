const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { logger } = require('../utils/logger');

function getUserId(req) {
    return req.user?.userId;
}

async function login(req, res) {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ success: false, error: 'E-Mail und Passwort erforderlich' });
        }

        const result = await query(
            `SELECT cpu.*, wlc.brand_name, wlc.logo_url, wlc.primary_color, wlc.favicon_url
             FROM client_portal_users cpu
             LEFT JOIN white_label_configs wlc ON wlc.user_id = cpu.agency_user_id
             WHERE cpu.email = $1 AND cpu.active = true`,
            [email.toLowerCase().trim()]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ success: false, error: 'Ungültige Anmeldedaten' });
        }

        const client = result.rows[0];
        const valid = await bcrypt.compare(password, client.password_hash);
        if (!valid) {
            return res.status(401).json({ success: false, error: 'Ungültige Anmeldedaten' });
        }

        await query('UPDATE client_portal_users SET last_login = now() WHERE id = $1', [client.id]);

        const token = jwt.sign(
            { type: 'client', clientId: client.id, agencyUserId: client.agency_user_id },
            process.env.JWT_SECRET || 'fallback-secret',
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            data: {
                token,
                client: {
                    id: client.id,
                    name: client.name,
                    email: client.email,
                },
                branding: {
                    brandName: client.brand_name || 'WPMA',
                    logoUrl: client.logo_url,
                    primaryColor: client.primary_color || '#3B82F6',
                    faviconUrl: client.favicon_url,
                }
            }
        });
    } catch (error) {
        logger.error('Client login error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

async function getMe(req, res) {
    try {
        const result = await query(
            `SELECT cpu.id, cpu.name, cpu.email, cpu.last_login,
                    wlc.brand_name, wlc.logo_url, wlc.primary_color, wlc.secondary_color,
                    wlc.favicon_url, wlc.support_email, wlc.support_url, wlc.footer_text
             FROM client_portal_users cpu
             LEFT JOIN white_label_configs wlc ON wlc.user_id = cpu.agency_user_id
             WHERE cpu.id = $1`,
            [req.clientId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Nicht gefunden' });
        }
        const row = result.rows[0];
        res.json({
            success: true,
            data: {
                id: row.id,
                name: row.name,
                email: row.email,
                lastLogin: row.last_login,
                branding: {
                    brandName: row.brand_name || 'WPMA',
                    logoUrl: row.logo_url,
                    primaryColor: row.primary_color || '#3B82F6',
                    secondaryColor: row.secondary_color || '#1E40AF',
                    faviconUrl: row.favicon_url,
                    supportEmail: row.support_email,
                    supportUrl: row.support_url,
                    footerText: row.footer_text,
                }
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}

async function getClientSites(req, res) {
    try {
        const result = await query(
            `SELECT s.id, s.domain, s.site_name, s.health_score, s.status,
                    s.last_check, s.wordpress_version, s.php_version,
                    s.uptime_status, s.uptime_percent, s.avg_response_ms,
                    s.last_plugin_connection
             FROM sites s
             JOIN client_portal_access cpa ON cpa.site_id = s.id
             WHERE cpa.client_id = $1 AND s.status = 'active'
             ORDER BY s.site_name`,
            [req.clientId]
        );
        res.json({
            success: true,
            data: result.rows.map(row => ({
                id: row.id,
                domain: row.domain,
                siteName: row.site_name,
                healthScore: row.health_score || 0,
                status: row.status,
                lastCheck: row.last_check,
                wordpressVersion: row.wordpress_version,
                phpVersion: row.php_version,
                uptimeStatus: row.uptime_status || 'unknown',
                uptimePercent: row.uptime_percent !== null ? parseFloat(row.uptime_percent) : null,
                avgResponseMs: row.avg_response_ms,
                isConnected: Boolean(row.last_plugin_connection),
            }))
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}

async function listClients(req, res) {
    try {
        const userId = getUserId(req);
        const result = await query(
            `SELECT cpu.id, cpu.name, cpu.email, cpu.active, cpu.notes, cpu.created_at, cpu.last_login,
                    COUNT(cpa.site_id) AS site_count
             FROM client_portal_users cpu
             LEFT JOIN client_portal_access cpa ON cpa.client_id = cpu.id
             WHERE cpu.agency_user_id = $1
             GROUP BY cpu.id
             ORDER BY cpu.created_at DESC`,
            [userId]
        );
        res.json({ success: true, data: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}

async function createClient(req, res) {
    try {
        const userId = getUserId(req);
        const { name, email, password, notes } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ success: false, error: 'Name, E-Mail und Passwort erforderlich' });
        }
        if (password.length < 8) {
            return res.status(400).json({ success: false, error: 'Passwort muss mindestens 8 Zeichen lang sein' });
        }

        const hash = await bcrypt.hash(password, 12);
        const result = await query(
            `INSERT INTO client_portal_users (agency_user_id, name, email, password_hash, notes)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (agency_user_id, email) DO NOTHING
             RETURNING id, name, email, active, created_at`,
            [userId, name.trim(), email.toLowerCase().trim(), hash, notes || null]
        );

        if (result.rows.length === 0) {
            return res.status(409).json({ success: false, error: 'E-Mail bereits vergeben' });
        }

        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}

async function updateClient(req, res) {
    try {
        const userId = getUserId(req);
        const { clientId } = req.params;
        const { name, email, password, notes, active } = req.body;

        const existing = await query(
            'SELECT id FROM client_portal_users WHERE id = $1 AND agency_user_id = $2',
            [clientId, userId]
        );
        if (existing.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Client nicht gefunden' });
        }

        const updates = [];
        const values = [];
        let idx = 1;

        if (name !== undefined) { updates.push(`name = $${idx++}`); values.push(name.trim()); }
        if (email !== undefined) { updates.push(`email = $${idx++}`); values.push(email.toLowerCase().trim()); }
        if (notes !== undefined) { updates.push(`notes = $${idx++}`); values.push(notes); }
        if (active !== undefined) { updates.push(`active = $${idx++}`); values.push(active); }
        if (password) {
            const hash = await bcrypt.hash(password, 12);
            updates.push(`password_hash = $${idx++}`);
            values.push(hash);
        }

        if (updates.length === 0) {
            return res.status(400).json({ success: false, error: 'Keine Änderungen' });
        }

        values.push(clientId);
        await query(`UPDATE client_portal_users SET ${updates.join(', ')} WHERE id = $${idx}`, values);

        res.json({ success: true, message: 'Client aktualisiert' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}

async function deleteClient(req, res) {
    try {
        const userId = getUserId(req);
        const { clientId } = req.params;
        await query(
            'DELETE FROM client_portal_users WHERE id = $1 AND agency_user_id = $2',
            [clientId, userId]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}

async function getClientSiteAssignments(req, res) {
    try {
        const userId = getUserId(req);
        const { clientId } = req.params;

        const access = await query(
            'SELECT id FROM client_portal_users WHERE id = $1 AND agency_user_id = $2',
            [clientId, userId]
        );
        if (access.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Client nicht gefunden' });
        }

        const result = await query(
            `SELECT s.id, s.domain, s.site_name, s.health_score,
                    (cpa.site_id IS NOT NULL) as assigned
             FROM sites s
             LEFT JOIN client_portal_access cpa ON cpa.site_id = s.id AND cpa.client_id = $1
             WHERE s.user_id = $2 AND s.status = 'active'
             ORDER BY s.site_name`,
            [clientId, userId]
        );
        res.json({ success: true, data: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}

async function assignSitesToClient(req, res) {
    try {
        const userId = getUserId(req);
        const { clientId } = req.params;
        const { siteIds } = req.body;

        const access = await query(
            'SELECT id FROM client_portal_users WHERE id = $1 AND agency_user_id = $2',
            [clientId, userId]
        );
        if (access.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Client nicht gefunden' });
        }

        const sitesCheck = await query(
            'SELECT id FROM sites WHERE id = ANY($1) AND user_id = $2',
            [siteIds, userId]
        );
        const validIds = sitesCheck.rows.map(r => r.id);

        await query('DELETE FROM client_portal_access WHERE client_id = $1', [clientId]);
        for (const siteId of validIds) {
            await query(
                'INSERT INTO client_portal_access (client_id, site_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                [clientId, siteId]
            );
        }

        res.json({ success: true, message: `${validIds.length} Sites zugewiesen` });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}

module.exports = {
    login,
    getMe,
    getClientSites,
    listClients,
    createClient,
    updateClient,
    deleteClient,
    getClientSiteAssignments,
    assignSitesToClient,
};
