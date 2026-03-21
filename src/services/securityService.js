const { query } = require('../config/database');
const axios = require('axios');

class SecurityService {
    constructor() {
        this.scansRetentionDays = 90;
    }

    async saveScanResults(siteId, scanData) {
        try {
            const threatsFound = this.calculateThreats(scanData);
            const securityScore = this.calculateSecurityScore(scanData);

            const result = await query(
                `INSERT INTO security_scans (
                    site_id, scan_type, status, scan_results, threats_found, scan_duration, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
                RETURNING *`,
                [
                    siteId,
                    scanData.scan_type || 'full',
                    'completed',
                    JSON.stringify({ ...scanData, security_score: securityScore }),
                    threatsFound,
                    scanData.scan_duration || 0
                ]
            );

            await this.updateSiteSecurityScore(siteId, securityScore);
            return { success: true, data: result.rows[0] };
        } catch (error) {
            console.error('Error saving scan results:', error);
            return { success: false, error: error.message };
        }
    }

    calculateThreats(scanData) {
        let threats = 0;
        if (!scanData.ssl_enabled) threats++;
        if (scanData.debug_mode) threats++;
        if (!scanData.file_edit_disabled) threats++;
        if (scanData.admin_username === 'admin') threats++;
        if (scanData.failed_logins > 10) threats++;
        if (scanData.outdated_plugins && scanData.outdated_plugins.length > 0) {
            threats += scanData.outdated_plugins.length;
        }
        return threats;
    }

    calculateSecurityScore(scanData) {
        let score = 100;
        if (!scanData.ssl_enabled) score -= 20;
        if (scanData.debug_mode) score -= 15;
        if (!scanData.file_edit_disabled) score -= 10;
        if (scanData.admin_username === 'admin') score -= 10;
        if (scanData.failed_logins > 10) score -= 15;
        if (scanData.outdated_plugins && scanData.outdated_plugins.length > 0) {
            score -= Math.min(scanData.outdated_plugins.length * 5, 20);
        }
        return Math.max(0, Math.min(100, score));
    }

    async updateSiteSecurityScore(siteId, securityScore) {
        try {
            const siteResult = await query('SELECT health_score FROM sites WHERE id = $1', [siteId]);
            if (siteResult.rows.length === 0) return;

            const currentHealth = siteResult.rows[0].health_score || 50;
            const newHealthScore = Math.round((securityScore + currentHealth) / 2);

            await query('UPDATE sites SET health_score = $1, updated_at = NOW() WHERE id = $2', 
                [newHealthScore, siteId]);
        } catch (error) {
            console.error('Error updating site security score:', error);
        }
    }

    async getLatestScan(siteId) {
        try {
            const result = await query(
                `SELECT * FROM security_scans WHERE site_id = $1 ORDER BY created_at DESC LIMIT 1`,
                [siteId]
            );

            if (result.rows.length === 0) {
                return { success: false, error: 'Keine Security-Scans verfügbar' };
            }

            // Konvertiere zu camelCase für Frontend
            const row = result.rows[0];
            const scanResults = typeof row.scan_results === 'string' 
                ? JSON.parse(row.scan_results) 
                : (row.scan_results || {});

            const data = {
                id: row.id,
                siteId: row.site_id,
                scanType: row.scan_type,
                status: row.status,
                securityScore: row.security_score || scanResults.security_score || 0,
                sslEnabled: row.ssl_valid ?? scanResults.ssl_enabled ?? false,
                debugMode: row.debug_mode ?? scanResults.debug_mode ?? false,
                failedLogins: scanResults.failed_logins || 0,
                threatsFound: row.threats_found || 0,
                outdatedPlugins: row.outdated_plugins || scanResults.outdated_plugins?.length || 0,
                outdatedThemes: row.outdated_themes || scanResults.outdated_themes?.length || 0,
                vulnerabilities: row.vulnerabilities || [],
                scanResults: scanResults,
                createdAt: row.created_at
            };

            return { success: true, data };
        } catch (error) {
            console.error('Error getting latest scan:', error);
            return { success: false, error: error.message };
        }
    }

    async getAllScans(siteId, limit = 10) {
        try {
            const result = await query(
                `SELECT * FROM security_scans WHERE site_id = $1 ORDER BY created_at DESC LIMIT $2`,
                [siteId, limit]
            );

            return { success: true, data: result.rows };
        } catch (error) {
            console.error('Error getting scans:', error);
            return { success: false, error: error.message };
        }
    }

    async analyzeSecurityIssues(siteId) {
        try {
            const scanResult = await this.getLatestScan(siteId);
            if (!scanResult.success) return scanResult;

            const scan = scanResult.data;
            const scanData = typeof scan.scan_results === 'string' 
                ? JSON.parse(scan.scan_results) 
                : scan.scan_results;

            const vulnerabilities = [];

            if (!scanData.ssl_enabled) {
                vulnerabilities.push({
                    severity: 'high', category: 'ssl',
                    title: 'Keine SSL/HTTPS Verschlüsselung',
                    description: 'Die Website verwendet kein SSL-Zertifikat.',
                    recommendation: 'Installieren Sie ein SSL-Zertifikat (z.B. Let\'s Encrypt).',
                    fixable: true
                });
            }

            if (scanData.debug_mode) {
                vulnerabilities.push({
                    severity: 'medium', category: 'configuration',
                    title: 'Debug-Modus aktiviert',
                    description: 'WP_DEBUG ist aktiviert und kann Informationen preisgeben.',
                    recommendation: 'Deaktivieren Sie WP_DEBUG in der wp-config.php.',
                    fixable: true
                });
            }

            if (!scanData.file_edit_disabled) {
                vulnerabilities.push({
                    severity: 'medium', category: 'configuration',
                    title: 'Theme/Plugin-Bearbeitung aktiviert',
                    description: 'Bearbeiten im Admin ist aktiviert.',
                    recommendation: 'Fügen Sie "define(\'DISALLOW_FILE_EDIT\', true);" zur wp-config.php hinzu.',
                    fixable: true
                });
            }

            if (scanData.admin_username === 'admin') {
                vulnerabilities.push({
                    severity: 'medium', category: 'users',
                    title: 'Standard-Admin-Username verwendet',
                    description: 'Der Username "admin" macht Brute-Force-Angriffe einfacher.',
                    recommendation: 'Erstellen Sie einen neuen Admin-User und löschen Sie "admin".',
                    fixable: false
                });
            }

            if (scanData.outdated_plugins && scanData.outdated_plugins.length > 0) {
                scanData.outdated_plugins.forEach(plugin => {
                    vulnerabilities.push({
                        severity: 'medium', category: 'updates',
                        title: `Veraltetes Plugin: ${plugin.name}`,
                        description: `Version ${plugin.current_version} ist veraltet.`,
                        recommendation: `Aktualisieren Sie ${plugin.name}.`,
                        fixable: true
                    });
                });
            }

            return {
                success: true,
                data: {
                    vulnerabilities,
                    security_score: scanData.security_score || this.calculateSecurityScore(scanData),
                    threats_count: vulnerabilities.length,
                    last_scan: scan.created_at
                }
            };
        } catch (error) {
            console.error('Error analyzing security issues:', error);
            return { success: false, error: error.message };
        }
    }

    async performScan(siteId) {
        try {
            const startTime = Date.now();
            const siteResult = await query('SELECT * FROM sites WHERE id = $1', [siteId]);

            if (siteResult.rows.length === 0) {
                return { success: false, error: 'Site nicht gefunden' };
            }

            const site = siteResult.rows[0];
            const baseUrl = site.site_url || `https://${site.domain}`;

            // Run all checks in parallel
            const [sslCheck, headerCheck, exposureCheck, xmlrpcCheck] = await Promise.all([
                this.checkSSL(baseUrl),
                this.checkSecurityHeaders(baseUrl),
                this.checkExposedFiles(baseUrl),
                this.checkXmlRpc(baseUrl),
            ]);

            const vulnerabilities = [];

            if (!sslCheck.enabled) {
                vulnerabilities.push({
                    severity: 'high', category: 'ssl',
                    title: 'Kein SSL/HTTPS',
                    description: 'Die Website überträgt Daten unverschlüsselt.',
                    recommendation: 'SSL-Zertifikat installieren (z.B. Let\'s Encrypt).'
                });
            }

            // Security header issues
            const REQUIRED_HEADERS = {
                'strict-transport-security': { severity: 'medium', title: 'HSTS fehlt', recommendation: 'Header: Strict-Transport-Security: max-age=31536000; includeSubDomains' },
                'x-content-type-options': { severity: 'low', title: 'X-Content-Type-Options fehlt', recommendation: 'Header setzen: X-Content-Type-Options: nosniff' },
                'x-frame-options': { severity: 'medium', title: 'X-Frame-Options fehlt (Clickjacking)', recommendation: 'Header setzen: X-Frame-Options: SAMEORIGIN' },
                'x-xss-protection': { severity: 'low', title: 'X-XSS-Protection fehlt', recommendation: 'Header setzen: X-XSS-Protection: 1; mode=block' },
                'content-security-policy': { severity: 'low', title: 'Content-Security-Policy fehlt', recommendation: 'CSP-Header konfigurieren.' },
                'referrer-policy': { severity: 'info', title: 'Referrer-Policy fehlt', recommendation: 'Header setzen: Referrer-Policy: no-referrer-when-downgrade' },
            };
            for (const [header, meta] of Object.entries(REQUIRED_HEADERS)) {
                if (!headerCheck.headers[header]) {
                    vulnerabilities.push({
                        severity: meta.severity, category: 'headers',
                        title: meta.title,
                        description: `Der HTTP-Header "${header}" ist nicht gesetzt.`,
                        recommendation: meta.recommendation
                    });
                }
            }

            if (exposureCheck.readmeExposed) {
                vulnerabilities.push({
                    severity: 'low', category: 'exposure',
                    title: 'readme.html öffentlich zugänglich',
                    description: 'Die readme.html verrät die WordPress-Version.',
                    recommendation: 'readme.html und license.txt löschen oder über .htaccess sperren.'
                });
            }
            if (exposureCheck.licenseExposed) {
                vulnerabilities.push({
                    severity: 'info', category: 'exposure',
                    title: 'license.txt öffentlich zugänglich',
                    description: 'Gibt Informationen über die WP-Installation preis.',
                    recommendation: 'license.txt über .htaccess sperren.'
                });
            }

            if (xmlrpcCheck.accessible) {
                vulnerabilities.push({
                    severity: 'medium', category: 'configuration',
                    title: 'XML-RPC aktiviert',
                    description: 'xmlrpc.php ist öffentlich erreichbar und kann für Brute-Force-Angriffe missbraucht werden.',
                    recommendation: 'XML-RPC deaktivieren sofern nicht benötigt: add_filter("xmlrpc_enabled", "__return_false").'
                });
            }

            const score = this.calculateScoreFromVulns({ vulnerabilities, ssl_enabled: sslCheck.enabled });

            const scanData = {
                scan_type: 'deep',
                ssl_enabled: sslCheck.enabled,
                ssl_valid: sslCheck.valid,
                security_score: score,
                security_headers: headerCheck.headers,
                vulnerabilities,
                xmlrpc_accessible: xmlrpcCheck.accessible,
                readme_exposed: exposureCheck.readmeExposed,
                license_exposed: exposureCheck.licenseExposed,
                wp_version_status: site.wordpress_version ? 'detected' : 'unknown',
                scan_duration: Date.now() - startTime
            };

            return await this.saveScanResults(siteId, scanData);
        } catch (error) {
            console.error('Error performing scan:', error);
            return { success: false, error: error.message };
        }
    }

    async checkSecurityHeaders(siteUrl) {
        try {
            const resp = await axios.head(siteUrl, { timeout: 8000, validateStatus: () => true });
            const h = {};
            const TRACKED = ['strict-transport-security','x-content-type-options','x-frame-options','x-xss-protection','content-security-policy','referrer-policy'];
            for (const name of TRACKED) {
                h[name] = resp.headers[name] || null;
            }
            return { headers: h };
        } catch {
            return { headers: {} };
        }
    }

    async checkExposedFiles(baseUrl) {
        const base = baseUrl.replace(/\/$/, '');
        const [readme, license] = await Promise.all([
            axios.head(`${base}/readme.html`, { timeout: 5000, validateStatus: () => true }).then(r => r.status === 200).catch(() => false),
            axios.head(`${base}/license.txt`, { timeout: 5000, validateStatus: () => true }).then(r => r.status === 200).catch(() => false),
        ]);
        return { readmeExposed: readme, licenseExposed: license };
    }

    async checkXmlRpc(baseUrl) {
        const base = baseUrl.replace(/\/$/, '');
        try {
            const resp = await axios.get(`${base}/xmlrpc.php`, { timeout: 5000, validateStatus: () => true });
            return { accessible: resp.status < 404 };
        } catch {
            return { accessible: false };
        }
    }

    async checkSSL(siteUrl) {
        try {
            const url = new URL(siteUrl);
            return { enabled: url.protocol === 'https:', valid: true };
        } catch (error) {
            return { enabled: false, valid: false };
        }
    }

    calculateScoreFromVulns({ vulnerabilities = [], ssl_enabled = true }) {
        let score = 100;
        if (!ssl_enabled) score -= 25;
        for (const v of vulnerabilities) {
            if (v.severity === 'critical') score -= 20;
            else if (v.severity === 'high') score -= 15;
            else if (v.severity === 'medium') score -= 8;
            else if (v.severity === 'low') score -= 3;
            else if (v.severity === 'info') score -= 1;
        }
        return Math.max(0, score);
    }

    async cleanupOldScans() {
        try {
            // Sichere parametrisierte Query - verhindert SQL-Injection
            const result = await query(
                `DELETE FROM security_scans WHERE created_at < NOW() - MAKE_INTERVAL(days => $1)`,
                [this.scansRetentionDays]
            );
            console.log(`Cleaned up ${result.rowCount} old security scans`);
            return { success: true, deleted: result.rowCount };
        } catch (error) {
            console.error('Error cleaning up scans:', error);
            return { success: false, error: error.message };
        }
    }

    async getStatistics(siteId) {
        try {
            const result = await query(
                `SELECT 
                    COUNT(*) as total_scans,
                    AVG(threats_found) as avg_threats,
                    MAX(threats_found) as max_threats
                FROM security_scans 
                WHERE site_id = $1 
                AND created_at >= NOW() - INTERVAL '30 days'`,
                [siteId]
            );

            return { success: true, data: result.rows[0] };
        } catch (error) {
            console.error('Error getting statistics:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = new SecurityService();

