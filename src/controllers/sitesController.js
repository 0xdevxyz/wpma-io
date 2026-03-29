const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');
const AdmZip = require('adm-zip');
const { query } = require('../config/database');
const { ValidationError } = require('../utils/errors');

class SitesController {
    async createSite(req, res) {
        try {
            // Frontend sendet snake_case; Controller-intern normalisieren
            const domain = req.body.domain;
            const site_url = req.body.site_url || req.body.siteUrl;
            const site_name = req.body.site_name || req.body.siteName || domain;
            const { userId, planType } = req.user;

            if (!domain || !site_url) {
                throw new ValidationError('Domain und Site-URL sind erforderlich');
            }
            
            // Check site limit based on plan
            const siteCount = await query(
                'SELECT COUNT(*) FROM sites WHERE user_id = $1 AND status = $2',
                [userId, 'active']
            );
            
            const currentCount = parseInt(siteCount.rows[0].count);
            const maxSites = planType === 'basic' ? 1 : 25;
            
            if (currentCount >= maxSites) {
                throw new ValidationError(`Site limit reached for ${planType} plan`);
            }
            
            // Check if domain already exists
            const existingSite = await query(
                'SELECT id FROM sites WHERE domain = $1 AND status = $2',
                [domain, 'active']
            );
            
            if (existingSite.rows.length > 0) {
                throw new ValidationError('Domain already exists');
            }
            
            // Generate unique API key
            const apiKey = uuidv4();
            
            // Generate setup token (one-time use, expires in 24 hours)
            const setupToken = crypto.randomBytes(32).toString('hex');
            const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
            
            // Create site
            const result = await query(
                `INSERT INTO sites (user_id, domain, site_url, site_name, api_key, status, setup_token, setup_token_expires_at, setup_token_used)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                 RETURNING id, domain, site_url, site_name, api_key, status, setup_token, setup_token_expires_at, created_at`,
                [userId, domain, site_url, site_name, apiKey, 'active', setupToken, tokenExpiresAt, false]
            );
            
            const site = result.rows[0];
            
            // Log token generation
            console.log(`Setup token generated for site ${site.id} by user ${userId}`);
            
            res.status(201).json({
                success: true,
                message: 'Site created successfully',
                data: {
                    id: site.id,
                    domain: site.domain,
                    siteUrl: site.site_url,
                    siteName: site.site_name,
                    setupToken: site.setup_token,
                    setupTokenExpiresAt: site.setup_token_expires_at,
                    status: site.status,
                    createdAt: site.created_at
                }
            });
        } catch (error) {
            console.error('Create site error:', error);
            res.status(400).json({
                success: false,
                error: error.message || 'Failed to create site'
            });
        }
    }
    
    async getSites(req, res) {
        try {
            const { userId } = req.user;
            
            const result = await query(
                `SELECT s.id, s.domain, s.site_url, s.site_name, s.health_score, s.status,
                        s.last_check, s.wordpress_version, s.php_version, s.created_at,
                        s.last_plugin_connection, s.plugin_version, s.setup_token,
                        s.setup_token_expires_at, s.setup_token_used,
                        s.uptime_status, s.uptime_percent, s.avg_response_ms,
                        s.plugins_updates, s.themes_updates, s.core_update_available
                 FROM sites s
                 WHERE s.user_id = $1 AND s.status = $2
                 ORDER BY s.created_at DESC`,
                [userId, 'active']
            );

            const sites = result.rows.map(row => ({
                id: row.id,
                domain: row.domain,
                siteUrl: row.site_url,
                siteName: row.site_name,
                healthScore: row.health_score || 0,
                status: row.status,
                lastCheck: row.last_check,
                wordpressVersion: row.wordpress_version,
                phpVersion: row.php_version,
                createdAt: row.created_at,
                // Plugin-Verbindungsstatus
                isConnected: Boolean(row.last_plugin_connection),
                lastPluginConnection: row.last_plugin_connection,
                pluginVersion: row.plugin_version,
                setupToken: row.setup_token,
                setupTokenExpired: row.setup_token_expires_at ? new Date() > new Date(row.setup_token_expires_at) : true,
                setupTokenUsed: row.setup_token_used,
                uptimeStatus: row.uptime_status || 'unknown',
                uptimePercent: row.uptime_percent !== null ? parseFloat(row.uptime_percent) : null,
                avgResponseMs: row.avg_response_ms || null,
                pluginsUpdates: row.plugins_updates || 0,
                themesUpdates: row.themes_updates || 0,
                coreUpdateAvailable: Boolean(row.core_update_available),
            }));
            
            res.json({
                success: true,
                data: sites
            });
        } catch (error) {
            console.error('Get sites error:', error);
            res.status(400).json({
                success: false,
                error: error.message || 'Failed to get sites'
            });
        }
    }
    
    async getSite(req, res) {
        try {
            const { siteId } = req.params;
            const { userId } = req.user;
            
            const result = await query(
                'SELECT * FROM sites WHERE id = $1 AND user_id = $2 AND status = $3',
                [siteId, userId, 'active']
            );
            
            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Site not found'
                });
            }
            
            const site = result.rows[0];
            
            res.json({
                success: true,
                data: {
                    id: site.id,
                    domain: site.domain,
                    siteUrl: site.site_url,
                    siteName: site.site_name,
                    healthScore: site.health_score || 0,
                    status: site.status,
                    lastCheck: site.last_check,
                    wordpressVersion: site.wordpress_version,
                    phpVersion: site.php_version,
                    createdAt: site.created_at,
                    updatedAt: site.updated_at,
                    isConnected: Boolean(site.last_plugin_connection),
                    lastPluginConnection: site.last_plugin_connection,
                    pluginVersion: site.plugin_version,
                    setupTokenUsed: site.setup_token_used,
                }
            });
        } catch (error) {
            console.error('Get site error:', error);
            res.status(400).json({
                success: false,
                error: error.message || 'Failed to get site'
            });
        }
    }
    
    async updateSiteHealth(req, res) {
        try {
            const { siteId } = req.params;
            const healthData = req.body;
            
            // Validate site ownership via API key
            const incomingKey = req.headers.authorization?.replace('Bearer ', '');
            let site = await query(
                'SELECT id, user_id FROM sites WHERE id = $1 AND api_key = $2',
                [siteId, incomingKey]
            );

            // Key-Mismatch: Plugin hat alten Key → DB-Key auf Plugin-Key aktualisieren
            // (geschieht nur wenn siteId stimmt und der Key nicht leer ist)
            if (site.rows.length === 0 && incomingKey) {
                const bySiteId = await query(
                    'SELECT id, user_id FROM sites WHERE id = $1 AND status = $2',
                    [siteId, 'active']
                );
                if (bySiteId.rows.length > 0) {
                    await query('UPDATE sites SET api_key = $1 WHERE id = $2', [incomingKey, siteId]);
                    console.log(`[KeySync] Key für Site ${siteId} aus Plugin-Request übernommen`);
                    site = bySiteId;
                }
            }

            if (site.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Site not found or invalid API key'
                });
            }
            
            // Calculate health score
            const healthScore = this.calculateHealthScore(healthData);

            // Update site
            const pluginCount = Array.isArray(healthData.active_plugins)
                ? healthData.active_plugins.length
                : (healthData.plugin_count ?? null);

            const pluginsUpdates = Array.isArray(healthData.active_plugins)
                ? healthData.active_plugins.filter(p => p.update_available).length
                : (healthData.plugins_updates ?? null);

            const themesUpdates = healthData.themes_updates ?? null;
            const coreUpdateAvailable = healthData.wp_update_available ?? healthData.core_update_available ?? null;

            await query(
                `UPDATE sites
                 SET health_score = $1,
                     wordpress_version = $2,
                     php_version = $3,
                     plugin_count = COALESCE($4, plugin_count),
                     plugins_updates = COALESCE($5, plugins_updates),
                     themes_updates = COALESCE($6, themes_updates),
                     core_update_available = COALESCE($7, core_update_available),
                     last_check = CURRENT_TIMESTAMP,
                     last_plugin_connection = COALESCE(last_plugin_connection, CURRENT_TIMESTAMP),
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $8`,
                [
                    healthScore,
                    healthData.wordpress_version,
                    healthData.php_version,
                    pluginCount,
                    pluginsUpdates,
                    themesUpdates,
                    coreUpdateAvailable,
                    siteId
                ]
            );
            
            // Emit real-time update
            req.io.to(`user_${site.rows[0].user_id}`).emit('site_updated', {
                siteId,
                healthScore,
                lastCheck: new Date()
            });
            
            res.json({
                success: true,
                message: 'Site health updated successfully',
                data: {
                    healthScore,
                    lastCheck: new Date()
                }
            });
        } catch (error) {
            console.error('Update site health error:', error);
            res.status(400).json({
                success: false,
                error: error.message || 'Failed to update site health'
            });
        }
    }
    
    calculateHealthScore(healthData) {
        let score = 100;
        
        // WordPress version check (20 points)
        if (!healthData.security_status?.wp_version_current) {
            score -= 20;
        }
        
        // SSL check (15 points)
        if (!healthData.security_status?.ssl_enabled) {
            score -= 15;
        }
        
        // Performance check (30 points)
        if (healthData.performance_metrics?.page_load_time > 3) {
            score -= 30;
        } else if (healthData.performance_metrics?.page_load_time > 2) {
            score -= 15;
        }
        
        // Security checks (35 points)
        if (healthData.security_status?.debug_mode) {
            score -= 10;
        }
        if (healthData.security_status?.admin_username === 'admin') {
            score -= 10;
        }
        if (healthData.security_status?.failed_logins_24h > 10) {
            score -= 15;
        }
        
        return Math.max(0, Math.min(100, score));
    }
    
    async deleteSite(req, res) {
        try {
            const { siteId } = req.params;
            const { userId } = req.user;
            
            // Verify ownership
            const site = await query(
                'SELECT id, domain FROM sites WHERE id = $1 AND user_id = $2',
                [siteId, userId]
            );
            
            if (site.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Site not found'
                });
            }
            
            // Soft delete - append timestamp to domain to avoid unique constraint issues
            const timestamp = Date.now();
            const deletedDomain = `${site.rows[0].domain}_DELETED_${timestamp}`;
            
            await query(
                `UPDATE sites 
                 SET status = $1, 
                     domain = $2,
                     updated_at = CURRENT_TIMESTAMP 
                 WHERE id = $3`,
                ['deleted', deletedDomain, siteId]
            );
            
            console.log(`Site ${siteId} soft deleted, domain changed from ${site.rows[0].domain} to ${deletedDomain}`);
            
            res.json({
                success: true,
                message: 'Site deleted successfully'
            });
        } catch (error) {
            console.error('Delete site error:', error);
            res.status(400).json({
                success: false,
                error: error.message || 'Failed to delete site'
            });
        }
    }
    
    async exchangeSetupToken(req, res) {
        try {
            const { token, domain } = req.body;
            const clientIp = req.ip || req.connection.remoteAddress;

            if (!token) {
                throw new ValidationError('Setup token is required');
            }

            // Find site by token
            const result = await query(
                `SELECT id, user_id, domain, site_name, api_key, setup_token_expires_at, setup_token_used
                 FROM sites
                 WHERE setup_token = $1 AND status = $2`,
                [token, 'active']
            );

            if (result.rows.length === 0) {
                logger.warn(`Token exchange failed: Token not found - IP: ${clientIp}`);
                return res.status(404).json({
                    success: false,
                    error: 'Invalid setup token'
                });
            }

            // Ownership check: verify the requesting domain matches the registered site domain
            if (domain) {
                const normalise = d => d.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();
                const requestedDomain = normalise(domain);
                const registeredDomain = normalise(result.rows[0].domain);
                if (requestedDomain !== registeredDomain) {
                    logger.warn(`Token exchange failed: Domain mismatch (got ${requestedDomain}, expected ${registeredDomain}) - IP: ${clientIp}`);
                    return res.status(403).json({
                        success: false,
                        error: 'Domain mismatch: token does not belong to this site'
                    });
                }
            }
            
            const site = result.rows[0];
            
            // Check if token already used
            if (site.setup_token_used) {
                console.log(`Token exchange failed: Token already used for site ${site.id} - IP: ${clientIp}`);
                return res.status(400).json({
                    success: false,
                    error: 'Setup token has already been used'
                });
            }
            
            // Check if token expired
            if (new Date() > new Date(site.setup_token_expires_at)) {
                console.log(`Token exchange failed: Token expired for site ${site.id} - IP: ${clientIp}`);
                return res.status(400).json({
                    success: false,
                    error: 'Setup token has expired'
                });
            }
            
            // Mark token as used and update last plugin connection
            await query(
                `UPDATE sites 
                 SET setup_token_used = true, 
                     last_plugin_connection = CURRENT_TIMESTAMP,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $1`,
                [site.id]
            );
            
            // Log successful exchange
            console.log(`✅ Token exchanged successfully for site ${site.id} (${site.domain}) - IP: ${clientIp}`);
            
            res.json({
                success: true,
                message: 'Setup token exchanged successfully',
                data: {
                    siteId: site.id,
                    siteName: site.site_name,
                    domain: site.domain,
                    apiKey: site.api_key
                }
            });
        } catch (error) {
            console.error('Token exchange error:', error);
            res.status(400).json({
                success: false,
                error: error.message || 'Failed to exchange setup token'
            });
        }
    }
    
    async autoConnect(req, res) {
        try {
            const { site_url, site_name, plugin_version } = req.body;
            const clientIp = req.ip || req.connection.remoteAddress;

            if (!site_url) {
                return res.status(400).json({ success: false, error: 'site_url is required' });
            }

            // Normalize domain: strip protocol, www., trailing slash, paths
            const normaliseDomain = (u) => u
                .replace(/^https?:\/\//, '')
                .replace(/^www\./, '')
                .replace(/\/.*$/, '')
                .toLowerCase();
            const requestedDomain = normaliseDomain(site_url);

            const domainExpr = `LOWER(REGEXP_REPLACE(SPLIT_PART(REGEXP_REPLACE(domain, '^https?://', '', 'i'), '/', 1), '^www\\.', '', 'i'))`;

            // 1. Erstverbindung: unbenutzer Token + nicht verbunden
            let result = await query(
                `SELECT id, user_id, domain, site_name, api_key, last_plugin_connection
                 FROM sites
                 WHERE ${domainExpr} = $1
                   AND status = 'active'
                   AND setup_token_used = false
                   AND setup_token_expires_at > NOW()
                   AND last_plugin_connection IS NULL`,
                [requestedDomain]
            );

            // 2. Key-Sync: Site bereits verbunden → trotzdem api_key zurückgeben (tägl. Re-Sync)
            if (result.rows.length === 0) {
                result = await query(
                    `SELECT id, user_id, domain, site_name, api_key, last_plugin_connection
                     FROM sites
                     WHERE ${domainExpr} = $1 AND status = 'active'`,
                    [requestedDomain]
                );
            }

            if (result.rows.length === 0) {
                logger.warn(`Auto-connect failed: no site for domain ${requestedDomain} - IP: ${clientIp}`);
                return res.status(404).json({
                    success: false,
                    error: 'No matching site found. Please add this site in your WPMA dashboard first.'
                });
            }

            const site = result.rows[0];
            const isFirstConnect = !site.last_plugin_connection;

            await query(
                `UPDATE sites
                 SET setup_token_used = true,
                     last_plugin_connection = COALESCE(last_plugin_connection, CURRENT_TIMESTAMP),
                     plugin_version = $1,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $2`,
                [plugin_version || null, site.id]
            );

            console.log(`✅ Auto-connect${isFirstConnect ? ' (first)' : ' (key-sync)'} for site ${site.id} (${site.domain}) - IP: ${clientIp}`);

            // Onboarding-Flow nur bei Erstverbindung starten
            if (isFirstConnect) {
                const { runOnboardingFlow } = require('../services/onboardingService');
                runOnboardingFlow(site.id, site.user_id).catch(err =>
                    console.error(`[Onboarding] Flow failed for site ${site.id}:`, err.message)
                );
            }

            res.json({
                success: true,
                message: 'Site connected successfully',
                data: {
                    siteId: site.id,
                    siteName: site.site_name,
                    domain: site.domain,
                    apiKey: site.api_key
                }
            });
        } catch (error) {
            console.error('Auto-connect error:', error);
            res.status(400).json({
                success: false,
                error: error.message || 'Auto-connect failed'
            });
        }
    }

    async regenerateSetupToken(req, res) {
        try {
            const { siteId } = req.params;
            const { userId } = req.user;
            
            // Verify ownership
            const siteResult = await query(
                'SELECT id, domain, last_plugin_connection FROM sites WHERE id = $1 AND user_id = $2 AND status = $3',
                [siteId, userId, 'active']
            );
            
            if (siteResult.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Site not found'
                });
            }
            
            const site = siteResult.rows[0];
            
            // Generate new token
            const setupToken = crypto.randomBytes(32).toString('hex');
            const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
            
            // Update site with new token
            await query(
                `UPDATE sites 
                 SET setup_token = $1,
                     setup_token_expires_at = $2,
                     setup_token_used = false,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $3`,
                [setupToken, tokenExpiresAt, siteId]
            );
            
            console.log(`Setup token regenerated for site ${siteId} by user ${userId}`);
            
            res.json({
                success: true,
                message: 'Setup token regenerated successfully',
                data: {
                    setupToken,
                    setupTokenExpiresAt: tokenExpiresAt
                }
            });
        } catch (error) {
            console.error('Regenerate token error:', error);
            res.status(400).json({
                success: false,
                error: error.message || 'Failed to regenerate setup token'
            });
        }
    }
    
    async downloadPlugin(req, res) {
        try {
            const { token } = req.params;
            const clientIp = req.ip || req.connection.remoteAddress;
            
            if (!token) {
                throw new ValidationError('Setup token is required');
            }
            
            // Verify token exists and is not expired (but don't mark as used)
            const result = await query(
                `SELECT id, domain, setup_token_expires_at, setup_token_used 
                 FROM sites 
                 WHERE setup_token = $1 AND status = $2`,
                [token, 'active']
            );
            
            if (result.rows.length === 0) {
                console.log(`Plugin download failed: Invalid token - IP: ${clientIp}`);
                return res.status(404).json({
                    success: false,
                    error: 'Invalid setup token'
                });
            }
            
            const site = result.rows[0];
            
            // Check if token expired
            if (new Date() > new Date(site.setup_token_expires_at)) {
                console.log(`Plugin download failed: Token expired for site ${site.id} - IP: ${clientIp}`);
                return res.status(400).json({
                    success: false,
                    error: 'Setup token has expired. Please regenerate a new token.'
                });
            }
            
            // Plugin ZIP path — dynamisch, nimmt neueste Version
            const rootDir = path.join(__dirname, '../..');
            const pluginFiles = fs.readdirSync(rootDir)
                .filter(f => /^wpma-agent.*\.zip$/.test(f))
                .sort()
                .reverse();
            const pluginPath = pluginFiles.length > 0 ? path.join(rootDir, pluginFiles[0]) : null;

            // Check if plugin file exists
            if (!pluginPath || !fs.existsSync(pluginPath)) {
                console.error('Plugin file not found in:', rootDir);
                return res.status(500).json({
                    success: false,
                    error: 'Plugin file not available'
                });
            }
            
            // Fetch full site data for pre-configuration
            const siteData = await query(
                'SELECT id, domain, api_key FROM sites WHERE setup_token = $1',
                [token]
            );
            const { id: siteId, domain, api_key: apiKey } = siteData.rows[0];

            // Patch wpma-agent.php inside the ZIP with pre-configured credentials
            const zip = new AdmZip(pluginPath);
            const entry = zip.getEntry('wpma-agent/wpma-agent.php');
            if (entry) {
                let src = entry.getData().toString('utf8');
                const inject = [
                    `\ndefine('WPMA_PRECONFIGURED_API_KEY', '${apiKey}');`,
                    `define('WPMA_PRECONFIGURED_SITE_ID', ${siteId});`,
                    `define('WPMA_SETUP_TOKEN', '${token}');`,  // einmaliger sync-token
                ].join('\n') + '\n';
                src = src.replace(
                    /define\('WPMA_API_URL'[^)]+\);/,
                    (m) => m + inject
                );
                zip.updateFile('wpma-agent/wpma-agent.php', Buffer.from(src, 'utf8'));
            }

            const patchedZip = zip.toBuffer();

            console.log(`Plugin downloaded for site ${siteId} (${domain}) - IP: ${clientIp}`);

            res.set({
                'Content-Type': 'application/zip',
                'Content-Disposition': 'attachment; filename="wpma-agent.zip"',
                'Content-Length': patchedZip.length,
            });
            res.send(patchedZip);
        } catch (error) {
            console.error('Download plugin error:', error);
            res.status(400).json({
                success: false,
                error: error.message || 'Failed to download plugin'
            });
        }
    }
    
    async runHealthCheck(req, res) {
        try {
            const { siteId } = req.params;
            const { userId } = req.user;

            const siteResult = await query(
                `SELECT id, domain, site_url, last_plugin_connection,
                        health_score, plugins_updates, themes_updates, core_update_available,
                        wordpress_version, php_version
                 FROM sites WHERE id = $1 AND user_id = $2 AND status = $3`,
                [siteId, userId, 'active']
            );

            if (siteResult.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Site not found' });
            }

            const site = siteResult.rows[0];

            if (!site.last_plugin_connection) {
                return res.status(400).json({
                    success: false,
                    error: 'plugin_not_connected',
                    message: 'WPMA Plugin ist nicht installiert.',
                });
            }

            await query('UPDATE sites SET last_check = CURRENT_TIMESTAMP WHERE id = $1', [siteId]);

            // Detect issues for immediate feedback
            const issues = [];
            if ((site.health_score || 0) < 70) {
                issues.push({ type: 'health', message: `Health Score niedrig: ${site.health_score || 0}%`, severity: site.health_score < 40 ? 'critical' : 'warning' });
            }
            const totalUpdates = (site.plugins_updates || 0) + (site.themes_updates || 0) + (site.core_update_available ? 1 : 0);
            if (totalUpdates > 0) {
                issues.push({ type: 'updates', message: `${totalUpdates} Update${totalUpdates > 1 ? 's' : ''} ausstehend`, severity: site.core_update_available ? 'warning' : 'info' });
            }
            if (site.php_version && parseFloat(site.php_version) < 8.0) {
                issues.push({ type: 'php', message: `PHP ${site.php_version} veraltet (empfohlen: 8.0+)`, severity: 'warning' });
            }

            // Trigger agent scan async (non-blocking)
            try {
                const { detectIssues, createTask } = require('../services/agentService');
                detectIssues(siteId).then(async (agentIssues) => {
                    for (const issue of agentIssues) {
                        await createTask(siteId, userId, issue).catch(() => {});
                    }
                }).catch(() => {});
            } catch (_) {}

            res.json({
                success: true,
                message: issues.length > 0 ? `${issues.length} Problem${issues.length > 1 ? 'e' : ''} gefunden` : 'Alles in Ordnung',
                data: {
                    siteId: site.id,
                    domain: site.domain,
                    healthScore: site.health_score || 0,
                    issues,
                    totalUpdates,
                    timestamp: new Date(),
                }
            });
        } catch (error) {
            console.error('Run health check error:', error);
            res.status(400).json({ success: false, error: error.message || 'Failed to run health check' });
        }
    }
    
    async verifyPlugin(req, res) {
        try {
            const { siteId } = req.params;
            const userId = req.user?.userId;

            const siteResult = await query(
                'SELECT id, domain, site_url, api_key, setup_token, last_plugin_connection, onboarding_status FROM sites WHERE id = $1 AND user_id = $2 AND status = $3',
                [siteId, userId, 'active']
            );

            if (siteResult.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Site not found' });
            }

            const site    = siteResult.rows[0];
            const siteUrl = (site.site_url || '').replace(/\/$/, '');

            let statusData = null;
            try {
                const response = await axios.get(`${siteUrl}/wp-json/wpma/v1/status`, {
                    headers: { 'User-Agent': 'WPMA-Backend/1.0' },
                    timeout: 10000,
                    validateStatus: null,
                });
                if (response.status === 200 && response.data?.status === 'ok') {
                    statusData = response.data;
                }
            } catch (_) {
                // unreachable / network error
            }

            if (!statusData) {
                return res.status(200).json({
                    success: true,
                    data: {
                        pluginStatus:  'not_found',
                        message:       'WPMA Plugin not found on this site. Please install and activate the plugin.',
                        isConnected:   false,
                    },
                });
            }

            if (!statusData.api_key_set) {
                return res.status(200).json({
                    success: true,
                    data: {
                        pluginStatus: 'installed_not_configured',
                        message:      'Plugin is installed but the API key has not been stored yet. Please download and install the pre-configured plugin ZIP.',
                        isConnected:  false,
                        pluginVersion: statusData.version,
                    },
                });
            }

            // Key-Sync: Korrekten API-Key per setup_token ins Plugin pushen
            // (löst Key-Mismatch nach Re-Install ohne erneutes ZIP-Herunterladen)
            if (site.setup_token) {
                try {
                    await axios.post(
                        `${siteUrl}/wp-json/wpma/v1/key-sync`,
                        { setup_token: site.setup_token, api_key: site.api_key, site_id: site.id },
                        { headers: { 'Content-Type': 'application/json' }, timeout: 8000 }
                    );
                    console.log(`[KeySync] Key via key-sync für Site ${site.id} gesetzt`);
                } catch (e) {
                    // key-sync schlägt fehl wenn Plugin alten Code hat → ignorieren
                    console.log(`[KeySync] key-sync nicht verfügbar für Site ${site.id}: ${e.message}`);
                }
            }

            // Plugin installed and API key set — mark as connected
            const wasAlreadyConnected = Boolean(site.last_plugin_connection);
            await query(
                `UPDATE sites
                    SET last_plugin_connection = COALESCE(last_plugin_connection, CURRENT_TIMESTAMP),
                        setup_token_used       = true,
                        plugin_version         = $1,
                        updated_at             = CURRENT_TIMESTAMP
                  WHERE id = $2`,
                [statusData.version || null, site.id]
            );

            // Onboarding-Flow starten wenn: erste Verbindung ODER Status noch 'pending'
            const needsOnboarding = !wasAlreadyConnected || !site.onboarding_status || site.onboarding_status === 'pending';
            if (needsOnboarding) {
                const { runOnboardingFlow } = require('../services/onboardingService');
                runOnboardingFlow(site.id, userId).catch(err =>
                    console.error(`[Onboarding] Flow failed for site ${site.id}:`, err.message)
                );
            }

            return res.json({
                success: true,
                data: {
                    pluginStatus:  'connected',
                    message:       'Plugin is installed and configured.',
                    isConnected:   true,
                    pluginVersion: statusData.version,
                    apiKeySet:     true,
                },
            });
        } catch (error) {
            console.error('verifyPlugin error:', error);
            res.status(500).json({ success: false, error: error.message || 'Failed to verify plugin' });
        }
    }

    async fetchSiteMetadata(req, res) {
        try {
            const { url } = req.body;
            
            if (!url) {
                throw new ValidationError('URL is required');
            }
            
            // Normalize URL - add https:// if protocol is missing
            let normalizedUrl = url.trim();
            if (!normalizedUrl.match(/^https?:\/\//i)) {
                normalizedUrl = 'https://' + normalizedUrl;
            }
            
            // Validate URL format
            let siteUrl;
            try {
                siteUrl = new URL(normalizedUrl);
            } catch (e) {
                throw new ValidationError('Invalid URL format');
            }
            
            // Use normalized URL for all further operations
            const resolvedUrl = normalizedUrl;
            
            // Extract domain (everything after https://)
            const domain = siteUrl.hostname.replace(/^www\./, '');
            
            console.log(`Fetching metadata for: ${resolvedUrl}`);

            // Fetch the website HTML
            let html;
            try {
                const response = await axios.get(resolvedUrl, {
                    timeout: 10000,
                    headers: {
                        'User-Agent': 'WPMA.io Bot/1.0 (Site Registration)',
                        'Accept': 'text/html,application/xhtml+xml'
                    },
                    maxRedirects: 5,
                    validateStatus: (status) => status < 400
                });
                html = response.data;
            } catch (error) {
                console.error('Error fetching URL:', error.message);
                throw new ValidationError('Could not fetch website. Please check if the URL is accessible.');
            }
            
            // Parse HTML
            const $ = cheerio.load(html);
            
            // Try to extract site title from various sources
            let siteName = '';
            
            // 1. Try <title> tag
            siteName = $('title').text().trim();
            
            // 2. Try Open Graph title
            if (!siteName) {
                siteName = $('meta[property="og:title"]').attr('content') || '';
            }
            
            // 3. Try Twitter title
            if (!siteName) {
                siteName = $('meta[name="twitter:title"]').attr('content') || '';
            }
            
            // 4. Try <h1> tag
            if (!siteName) {
                siteName = $('h1').first().text().trim();
            }
            
            // 5. Fallback to domain
            if (!siteName) {
                siteName = domain;
            }
            
            // Clean up the title (remove common suffixes)
            siteName = siteName
                .replace(/\s*[-–|]\s*.+$/, '') // Remove everything after -, –, or |
                .trim();
            
            // Limit length
            if (siteName.length > 100) {
                siteName = siteName.substring(0, 100) + '...';
            }
            
            console.log(`✅ Metadata fetched - Domain: ${domain}, Title: ${siteName}`);
            
            res.json({
                success: true,
                data: {
                    domain: domain,
                    siteName: siteName,
                    siteUrl: resolvedUrl
                }
            });
        } catch (error) {
            console.error('Fetch site metadata error:', error);
            res.status(400).json({
                success: false,
                error: error.message || 'Failed to fetch site metadata'
            });
        }
    }
}

module.exports = new SitesController(); 