const { query } = require('../config/database');
const axios = require('axios');

class PluginsController {
    async getPlugins(req, res) {
        try {
            const { siteId } = req.params;

            const siteCheck = await query(
                'SELECT id FROM sites WHERE id = $1 AND user_id = $2',
                [siteId, req.user.userId]
            );

            if (siteCheck.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Site nicht gefunden' });
            }

            const result = await query(
                `SELECT name, slug, version, active, update_available, update_version as new_version, author, description, is_premium
                 FROM site_plugins WHERE site_id = $1 ORDER BY active DESC, name ASC`,
                [siteId]
            );

            res.json({ success: true, data: result.rows });

        } catch (error) {
            console.error('Get plugins error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async installPlugin(req, res) {
        try {
            const { siteId } = req.params;
            const { slug, activate } = req.body;

            const siteResult = await query(
                'SELECT site_url, api_key FROM sites WHERE id = $1 AND user_id = $2',
                [siteId, req.user.userId]
            );

            if (siteResult.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Site nicht gefunden'
                });
            }

            const site = siteResult.rows[0];

            const wpResponse = await axios.post(
                `${site.site_url}/wp-json/wpma/v1/plugins/install`,
                { slug, activate },
                {
                    headers: {
                        'X-WPMA-API-Key': site.api_key
                    },
                    timeout: 30000
                }
            );

            res.json({
                success: true,
                message: `Plugin ${slug} erfolgreich installiert`,
                data: wpResponse.data
            });

        } catch (error) {
            console.error('Install plugin error:', error);
            res.status(500).json({
                success: false,
                error: error.response?.data?.message || error.message
            });
        }
    }

    async updatePlugin(req, res) {
        try {
            const { siteId, pluginSlug } = req.params;

            const siteResult = await query(
                'SELECT site_url, api_key FROM sites WHERE id = $1 AND user_id = $2',
                [siteId, req.user.userId]
            );

            if (siteResult.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Site nicht gefunden'
                });
            }

            const site = siteResult.rows[0];

            const wpResponse = await axios.put(
                `${site.site_url}/wp-json/wpma/v1/plugins/${pluginSlug}`,
                {},
                {
                    headers: {
                        'X-WPMA-API-Key': site.api_key
                    },
                    timeout: 30000
                }
            );

            res.json({
                success: true,
                message: `Plugin ${pluginSlug} erfolgreich aktualisiert`,
                data: wpResponse.data
            });

        } catch (error) {
            console.error('Update plugin error:', error);
            res.status(500).json({
                success: false,
                error: error.response?.data?.message || error.message
            });
        }
    }

    async togglePlugin(req, res) {
        try {
            const { siteId, pluginSlug } = req.params;
            const { active } = req.body;

            const siteResult = await query(
                'SELECT site_url, api_key FROM sites WHERE id = $1 AND user_id = $2',
                [siteId, req.user.userId]
            );

            if (siteResult.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Site nicht gefunden'
                });
            }

            const site = siteResult.rows[0];

            const wpResponse = await axios.post(
                `${site.site_url}/wp-json/wpma/v1/plugins/${pluginSlug}/${active ? 'activate' : 'deactivate'}`,
                {},
                {
                    headers: {
                        'X-WPMA-API-Key': site.api_key
                    },
                    timeout: 10000
                }
            );

            res.json({
                success: true,
                message: `Plugin ${pluginSlug} ${active ? 'aktiviert' : 'deaktiviert'}`,
                data: wpResponse.data
            });

        } catch (error) {
            console.error('Toggle plugin error:', error);
            res.status(500).json({
                success: false,
                error: error.response?.data?.message || error.message
            });
        }
    }

    async deletePlugin(req, res) {
        try {
            const { siteId, pluginSlug } = req.params;

            const siteResult = await query(
                'SELECT site_url, api_key FROM sites WHERE id = $1 AND user_id = $2',
                [siteId, req.user.userId]
            );

            if (siteResult.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Site nicht gefunden'
                });
            }

            const site = siteResult.rows[0];

            const wpResponse = await axios.delete(
                `${site.site_url}/wp-json/wpma/v1/plugins/${pluginSlug}`,
                {
                    headers: {
                        'X-WPMA-API-Key': site.api_key
                    },
                    timeout: 10000
                }
            );

            res.json({
                success: true,
                message: `Plugin ${pluginSlug} erfolgreich gelöscht`,
                data: wpResponse.data
            });

        } catch (error) {
            console.error('Delete plugin error:', error);
            res.status(500).json({
                success: false,
                error: error.response?.data?.message || error.message
            });
        }
    }
}

module.exports = new PluginsController();
