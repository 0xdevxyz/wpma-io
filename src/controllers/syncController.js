const axios = require('axios');
const { query } = require('../config/database');
const { logger } = require('../utils/logger');

async function pullSiteHealth(site) {
    const siteUrl = (site.site_url || '').replace(/\/$/, '');
    const apiKey  = site.api_key || '';

    try {
        const res = await axios.get(`${siteUrl}/wp-json/wpma/v1/health`, {
            headers: { 'X-WPMA-Key': apiKey, 'User-Agent': 'WPMA-Backend/1.0' },
            timeout: 15000,
            validateStatus: null,
        });

        if (res.status === 200 && res.data) {
            return { ok: true, data: res.data };
        }

        if (res.status === 403) {
        }
    } catch (_) {
    }

    try {
        const res = await axios.get(`${siteUrl}/wp-json/wpma/v1/status`, {
            headers: { 'User-Agent': 'WPMA-Backend/1.0' },
            timeout: 10000,
            validateStatus: null,
        });

        if (res.status === 200 && res.data?.status === 'ok') {
            const configured = res.data.api_key_set;
            return {
                ok: false,
                status: configured ? 'plugin_installed_not_configured' : 'plugin_installed_not_configured',
                data: res.data,
            };
        }
    } catch (_) {
    }

    return { ok: false, status: 'plugin_not_found' };
}

async function storeHealthData(siteId, health) {
    const totalUpdates = health.total_updates || 0;
    await query(
        `UPDATE sites
            SET health_score          = $1,
                wordpress_version     = $2,
                php_version           = $3,
                update_count          = $4,
                last_check            = CURRENT_TIMESTAMP,
                last_plugin_connection = COALESCE(last_plugin_connection, CURRENT_TIMESTAMP),
                updated_at            = CURRENT_TIMESTAMP
          WHERE id = $5`,
        [
            health.health_score ?? null,
            health.wordpress_version ?? null,
            health.php_version ?? null,
            totalUpdates,
            siteId,
        ]
    );
}

class SyncController {
    async syncSite(req, res) {
        try {
            const userId  = req.user?.userId;
            const { siteId } = req.params;

            const result = await query(
                'SELECT id, domain, site_url, api_key, last_plugin_connection FROM sites WHERE id = $1 AND user_id = $2 AND status = $3',
                [siteId, userId, 'active']
            );

            if (!result.rows.length) {
                return res.status(404).json({ success: false, error: 'Site nicht gefunden' });
            }

            const site   = result.rows[0];
            const pulled = await pullSiteHealth(site);

            if (pulled.ok) {
                await storeHealthData(siteId, pulled.data);
                logger.info('Site sync successful (pull)', { siteId, userId, domain: site.domain });

                return res.json({
                    success: true,
                    message: 'Sync erfolgreich — Daten vom Plugin abgerufen.',
                    data: {
                        siteId:    parseInt(siteId),
                        domain:    site.domain,
                        syncedAt:  new Date().toISOString(),
                        health:    pulled.data,
                    },
                });
            }

            if (pulled.status === 'plugin_installed_not_configured') {
                return res.status(400).json({
                    success: false,
                    error:   'plugin_installed_not_configured',
                    status:  'plugin_installed_not_configured',
                    message: 'Plugin ist installiert, aber der API-Key wurde noch nicht gespeichert.',
                });
            }

            return res.status(400).json({
                success: false,
                error:   'plugin_not_found',
                status:  'plugin_not_found',
                message: 'WPMA Plugin wurde auf dieser Site nicht gefunden. Bitte installieren und aktivieren.',
            });
        } catch (error) {
            logger.error('Sync error', { error: error.message });
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async syncAll(req, res) {
        try {
            const userId = req.user?.userId;

            const result = await query(
                'SELECT id, domain, site_url, api_key FROM sites WHERE user_id = $1 AND status = $2 AND last_plugin_connection IS NOT NULL',
                [userId, 'active']
            );

            const sites   = result.rows;
            const summary = { synced: 0, failed: 0, domains: [] };

            for (const site of sites) {
                const pulled = await pullSiteHealth(site);
                if (pulled.ok) {
                    await storeHealthData(site.id, pulled.data);
                    summary.synced++;
                    summary.domains.push(site.domain);
                } else {
                    summary.failed++;
                }
            }

            logger.info('Sync-all completed', { userId, ...summary });

            res.json({
                success: true,
                message: `${summary.synced} von ${sites.length} Sites erfolgreich synchronisiert.`,
                data:    summary,
            });
        } catch (error) {
            logger.error('Sync-all error', { error: error.message });
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async getSyncedData(req, res) {
        try {
            const userId  = req.user?.userId;
            const { siteId } = req.params;

            const result = await query(
                `SELECT id, domain, site_url, site_name, health_score, status,
                        last_check, wordpress_version, php_version,
                        last_plugin_connection, plugin_version, update_count
                 FROM sites WHERE id = $1 AND user_id = $2 AND status = $3`,
                [siteId, userId, 'active']
            );

            if (!result.rows.length) {
                return res.status(404).json({ success: false, error: 'Site nicht gefunden' });
            }

            res.json({ success: true, data: result.rows[0] });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
}

module.exports = new SyncController();
