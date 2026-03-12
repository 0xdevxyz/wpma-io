const { query, pool } = require('../config/database');
const axios = require('axios');

const PREMIUM_PLUGIN_SLUGS = new Set([
    'advanced-custom-fields-pro','acf-pro','gravityforms','gravity-forms',
    'wpml','sitepress-multilingual-cms','woocommerce-subscriptions',
    'woocommerce-memberships','woocommerce-bookings','woocommerce-product-bundles',
    'woocommerce-dynamic-pricing','woocommerce-checkout-add-ons',
    'yoast-seo-premium','wordpress-seo-premium','rankmath-pro',
    'wp-rocket','wp-smushit-pro','imagify','shortpixel-image-optimiser-pro',
    'elementor-pro','divi-builder','beaver-builder-plugin',
    'wpbakery-page-builder','js_composer','visual-composer',
    'wpforms-pro','ninja-forms-pro','caldera-forms-pro','formidable-pro',
    'wp-all-import-pro','wp-all-export-pro',
    'mainwp-child','managewp-worker',
    'wordfence-premium','ithemes-security-pro','sucuri-scanner-pro',
    'wpvivid-backuprestore-pro','updraftplus-premium','backupbuddy',
    'mailster','mailpoet-premium','newsletter-premium',
    'events-manager-pro','the-events-calendar-pro',
    'tablepress-pro','wp-table-manager',
    'wpml-string-translation','wpml-translation-management',
    'polylang-pro','translatepress-multilingual-pro',
    'borlabs-cookie','cookiebot','cookie-law-info-pro',
    'searchwp-premium','relevanssi-premium',
    'wp-migrate-db-pro','wp-sync-db-pro',
    'envato-market','themeforest',
    'meta-box-pro','mb-custom-post-type',
    'complyo-compliance','gdpr-cookie-consent-pro',
]);

const PREMIUM_THEME_SLUGS = new Set([
    'divi','extra','genesis','avada','betheme','bridge','salient',
    'x-theme','enfold','flatsome','woodmart','porto','shopkeeper',
    'thrive-theme-builder','generatepress-premium','astra-pro',
    'kadence-pro','oceanwp-premium',
]);

function detectPremiumPlugin(plugin) {
    const slug = (plugin.slug || '').toLowerCase().replace(/\//g, '-');
    const name = (plugin.name || '').toLowerCase();
    if (PREMIUM_PLUGIN_SLUGS.has(slug)) return true;
    if (name.includes('(premium)') || name.includes('pro)') ||
        name.includes(' pro') || name.endsWith(' pro') ||
        name.includes('premium') || name.includes(' plus')) return true;
    if (slug.endsWith('-pro') || slug.includes('-premium') ||
        slug.endsWith('-plus')) return true;
    return false;
}

function detectPremiumTheme(theme) {
    const slug = (theme.slug || '').toLowerCase();
    const name = (theme.name || '').toLowerCase();
    if (PREMIUM_THEME_SLUGS.has(slug)) return true;
    if (name.includes('premium') || name.includes('(pro)') ||
        name.endsWith(' pro') || name.includes(' plus')) return true;
    return false;
}

class WPSyncService {
    async syncSite(siteId) {
        try {
            const siteResult = await query(
                'SELECT * FROM sites WHERE id = $1',
                [siteId]
            );

            if (siteResult.rows.length === 0) {
                return { success: false, error: 'Site nicht gefunden' };
            }

            const site = siteResult.rows[0];

            const results = await Promise.allSettled([
                this.syncPlugins(site),
                this.syncThemes(site),
                this.syncCoreUpdates(site),
                this.syncStats(site),
                this.syncSecurity(site)
            ]);

            const errors = results
                .filter(r => r.status === 'rejected')
                .map(r => r.reason);

            await query(
                'UPDATE sites SET last_sync_at = NOW() WHERE id = $1',
                [siteId]
            );

            return {
                success: errors.length === 0,
                data: {
                    plugins: results[0].status === 'fulfilled' ? results[0].value : null,
                    themes: results[1].status === 'fulfilled' ? results[1].value : null,
                    core: results[2].status === 'fulfilled' ? results[2].value : null,
                    stats: results[3].status === 'fulfilled' ? results[3].value : null,
                    security: results[4].status === 'fulfilled' ? results[4].value : null
                },
                errors: errors.length > 0 ? errors : undefined
            };

        } catch (error) {
            console.error('Sync error:', error);
            return { success: false, error: error.message };
        }
    }

    async syncPlugins(site) {
        try {
            const response = await axios.get(
                `${site.site_url}/wp-json/wpma/v1/plugins`,
                {
                    headers: { 'X-WPMA-API-Key': site.api_key, 'User-Agent': 'WPMA-Platform/1.0' },
                    timeout: 10000
                }
            );

            const pluginsRaw = response.data?.data || response.data;
            const plugins = Array.isArray(pluginsRaw) ? pluginsRaw : [];

            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                await client.query('DELETE FROM site_plugins WHERE site_id = $1', [site.id]);
                for (const plugin of plugins) {
                    const isActive = plugin.status === 'active' || plugin.is_active === true;
                    await client.query(
                        `INSERT INTO site_plugins
                        (site_id, name, slug, version, active, update_available, update_version, author, description, is_premium)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                        [
                            site.id,
                            plugin.name,
                            plugin.slug,
                            plugin.version,
                            isActive,
                            plugin.update_available || false,
                            plugin.new_version || plugin.update_version || null,
                            plugin.author || null,
                            plugin.description || null,
                            detectPremiumPlugin(plugin)
                        ]
                    );
                }
                await client.query('COMMIT');
            } catch (txErr) {
                await client.query('ROLLBACK');
                throw txErr;
            } finally {
                client.release();
            }

            const activeCount = plugins.filter(p => p.status === 'active' || p.is_active === true).length;
            const updatesCount = plugins.filter(p => p.update_available).length;

            await query(
                `UPDATE sites SET plugins_total = $1, plugins_active = $2, plugins_updates = $3 WHERE id = $4`,
                [plugins.length, activeCount, updatesCount, site.id]
            );

            return { total: plugins.length, active: activeCount, updates_available: updatesCount };

        } catch (error) {
            console.error('Sync plugins error:', error);
            throw error;
        }
    }

    async syncThemes(site) {
        try {
            const response = await axios.get(
                `${site.site_url}/wp-json/wpma/v1/themes`,
                {
                    headers: { 'X-WPMA-API-Key': site.api_key, 'User-Agent': 'WPMA-Platform/1.0' },
                    timeout: 10000
                }
            );

            const themesRaw = response.data?.data || response.data;
            const themes = Array.isArray(themesRaw) ? themesRaw : [];

            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                await client.query('DELETE FROM site_themes WHERE site_id = $1', [site.id]);
                for (const theme of themes) {
                    const isActive = theme.status === 'active' || theme.is_active === true;
                    await client.query(
                        `INSERT INTO site_themes
                        (site_id, name, slug, version, active, update_available, update_version, author, description, is_premium)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                        [
                            site.id,
                            theme.name,
                            theme.slug,
                            theme.version,
                            isActive,
                            theme.update_available || false,
                            theme.new_version || theme.update_version || null,
                            theme.author || null,
                            theme.description || null,
                            detectPremiumTheme(theme)
                        ]
                    );
                }
                await client.query('COMMIT');
            } catch (txErr) {
                await client.query('ROLLBACK');
                throw txErr;
            } finally {
                client.release();
            }

            const updatesCount = themes.filter(t => t.update_available).length;

            await query(
                `UPDATE sites SET themes_total = $1, themes_updates = $2 WHERE id = $3`,
                [themes.length, updatesCount, site.id]
            );

            return { total: themes.length, updates_available: updatesCount };

        } catch (error) {
            console.error('Sync themes error:', error);
            throw error;
        }
    }

    async syncCoreUpdates(site) {
        try {
            const response = await axios.get(
                `${site.site_url}/wp-json/wpma/v1/core-update`,
                {
                    headers: { 'X-WPMA-API-Key': site.api_key, 'User-Agent': 'WPMA-Platform/1.0' },
                    timeout: 10000
                }
            );

            const coreData = response.data?.data || response.data;

            await query(
                `UPDATE sites SET 
                    wordpress_version = $1,
                    php_version = $2,
                    core_update_available = $3,
                    core_update_version = $4
                WHERE id = $5`,
                [
                    coreData.current_version,
                    coreData.php_version,
                    coreData.update_available || false,
                    coreData.update_version || null,
                    site.id
                ]
            );

            return {
                current_version: coreData.current_version,
                update_available: coreData.update_available || false,
                update_version: coreData.update_version || null
            };

        } catch (error) {
            console.error('Sync core error:', error);
            throw error;
        }
    }

    async syncStats(site) {
        try {
            const response = await axios.get(
                `${site.site_url}/wp-json/wpma/v1/stats`,
                {
                    headers: { 'X-WPMA-API-Key': site.api_key, 'User-Agent': 'WPMA-Platform/1.0' },
                    timeout: 10000
                }
            );

            const stats = response.data?.data || response.data;

            const existingStats = await query('SELECT id FROM site_stats WHERE site_id = $1', [site.id]);
            if (existingStats.rows.length > 0) {
                await query(
                    `UPDATE site_stats SET
                        posts_count = $1,
                        pages_count = $2,
                        comments_count = $3,
                        users_count = $4,
                        updated_at = NOW()
                    WHERE site_id = $5`,
                    [stats.posts || 0, stats.pages || 0, stats.comments || 0, stats.users || 0, site.id]
                );
            } else {
                await query(
                    `INSERT INTO site_stats (site_id, posts_count, pages_count, comments_count, users_count)
                    VALUES ($1, $2, $3, $4, $5)`,
                    [site.id, stats.posts || 0, stats.pages || 0, stats.comments || 0, stats.users || 0]
                );
            }

            return stats;

        } catch (error) {
            console.error('Sync stats error:', error);
            throw error;
        }
    }

    async syncSecurity(site) {
        try {
            const response = await axios.get(
                `${site.site_url}/wp-json/wpma/v1/security-check`,
                {
                    headers: { 'X-WPMA-API-Key': site.api_key, 'User-Agent': 'WPMA-Platform/1.0' },
                    timeout: 10000
                }
            );

            const secRaw = response.data?.data || response.data;

            // ssl_enabled: aus URL ableiten wenn Plugin kein Feld liefert
            const sslFromUrl = site.site_url?.startsWith('https://');
            const sslEnabled = secRaw.ssl_enabled !== undefined ? secRaw.ssl_enabled : sslFromUrl;

            const score = secRaw.score || secRaw.security_score || 0;
            const issues = secRaw.issues || secRaw.security_issues || [];

            await query(
                `UPDATE sites SET 
                    ssl_enabled = $1,
                    security_score = $2,
                    security_issues = $3
                WHERE id = $4`,
                [
                    sslEnabled,
                    score,
                    JSON.stringify(issues),
                    site.id
                ]
            );

            return { ssl_enabled: sslEnabled, score, issues };

        } catch (error) {
            console.error('Sync security error:', error);
            throw error;
        }
    }

    async syncAllSites() {
        try {
            const sitesResult = await query(
                'SELECT id FROM sites WHERE status = $1', ['active']
            );

            const sites = sitesResult.rows;

            console.log(`Starting sync for ${sites.length} sites...`);

            const results = await Promise.allSettled(
                sites.map(site => this.syncSite(site.id))
            );

            const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
            const failed = results.length - successful;

            console.log(`Sync completed: ${successful} successful, ${failed} failed`);

            return {
                success: true,
                data: {
                    total: sites.length,
                    successful,
                    failed
                }
            };

        } catch (error) {
            console.error('Sync all sites error:', error);
            return { success: false, error: error.message };
        }
    }

    async getSyncedData(siteId) {
        try {
            const [site, plugins, themes, stats] = await Promise.all([
                query('SELECT * FROM sites WHERE id = $1', [siteId]),
                query('SELECT * FROM site_plugins WHERE site_id = $1', [siteId]),
                query('SELECT * FROM site_themes WHERE site_id = $1', [siteId]),
                query('SELECT * FROM site_stats WHERE site_id = $1', [siteId])
            ]);

            if (site.rows.length === 0) {
                return { success: false, error: 'Site nicht gefunden' };
            }

            return {
                success: true,
                data: {
                    site: site.rows[0],
                    plugins: plugins.rows,
                    themes: themes.rows,
                    stats: stats.rows[0] || null
                }
            };

        } catch (error) {
            console.error('Get synced data error:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = new WPSyncService();
