const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');
const { query } = require('../config/database');
const { ValidationError } = require('../utils/errors');

class SitesController {
    async createSite(req, res) {
        try {
            const { domain, site_url, site_name } = req.body;
            const { userId, planType } = req.user;
            
            // Validate input
            if (!domain || !site_url || !site_name) {
                throw new ValidationError('Domain, site URL, and site name are required');
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
            
            // Generate setup token (one-time use, expires in 1 hour)
            const setupToken = crypto.randomBytes(32).toString('hex');
            const tokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
            
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
                        s.last_check, s.wordpress_version, s.php_version, s.created_at
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
                createdAt: row.created_at
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
                    updatedAt: site.updated_at
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
            const site = await query(
                'SELECT id, user_id FROM sites WHERE id = $1 AND api_key = $2',
                [siteId, req.headers.authorization?.replace('Bearer ', '')]
            );
            
            if (site.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Site not found or invalid API key'
                });
            }
            
            // Calculate health score
            const healthScore = this.calculateHealthScore(healthData);
            
            // Update site
            await query(
                `UPDATE sites 
                 SET health_score = $1, 
                     wordpress_version = $2,
                     php_version = $3,
                     last_check = CURRENT_TIMESTAMP,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $4`,
                [
                    healthScore,
                    healthData.wordpress_version,
                    healthData.php_version,
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
            const { token } = req.body;
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
                console.log(`Token exchange failed: Token not found - IP: ${clientIp}`);
                return res.status(404).json({
                    success: false,
                    error: 'Invalid setup token'
                });
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
            const tokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
            
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
            
            // Plugin ZIP path
            const pluginPath = path.join(__dirname, '../../wpma-agent-plugin.zip');
            
            // Check if plugin file exists
            if (!fs.existsSync(pluginPath)) {
                console.error('Plugin file not found:', pluginPath);
                return res.status(500).json({
                    success: false,
                    error: 'Plugin file not available'
                });
            }
            
            // Log download
            console.log(`Plugin downloaded for site ${site.id} (${site.domain}) - IP: ${clientIp}`);
            
            // Send file
            res.download(pluginPath, 'wpma-agent.zip', (err) => {
                if (err) {
                    console.error('Plugin download error:', err);
                }
            });
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
            
            // Verify ownership
            const siteResult = await query(
                'SELECT id, domain, site_url FROM sites WHERE id = $1 AND user_id = $2 AND status = $3',
                [siteId, userId, 'active']
            );
            
            if (siteResult.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Site not found'
                });
            }
            
            const site = siteResult.rows[0];
            
            // Log health check request
            console.log(`Manual health check requested for site ${site.id} (${site.domain}) by user ${userId}`);
            
            // Update last_check timestamp
            await query(
                'UPDATE sites SET last_check = CURRENT_TIMESTAMP WHERE id = $1',
                [siteId]
            );
            
            // Emit real-time update
            if (req.io) {
                req.io.to(`user_${userId}`).emit('health_check_started', {
                    siteId: site.id,
                    timestamp: new Date()
                });
            }
            
            // In a real implementation, this would trigger the WordPress site to run checks
            // For now, we just acknowledge the request
            res.json({
                success: true,
                message: 'Health check initiated',
                data: {
                    siteId: site.id,
                    domain: site.domain,
                    timestamp: new Date()
                }
            });
        } catch (error) {
            console.error('Run health check error:', error);
            res.status(400).json({
                success: false,
                error: error.message || 'Failed to run health check'
            });
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
            url = normalizedUrl;
            
            // Extract domain (everything after https://)
            const domain = siteUrl.hostname.replace(/^www\./, '');
            
            console.log(`Fetching metadata for: ${url}`);
            
            // Fetch the website HTML
            let html;
            try {
                const response = await axios.get(url, {
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
                    siteUrl: url
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