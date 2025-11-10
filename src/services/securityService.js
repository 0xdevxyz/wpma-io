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

            return { success: true, data: result.rows[0] };
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
            const sslCheck = await this.checkSSL(site.site_url);

            const scanData = {
                scan_type: 'automated',
                ssl_enabled: sslCheck.enabled,
                ssl_valid: sslCheck.valid,
                scan_duration: Date.now() - startTime
            };

            return await this.saveScanResults(siteId, scanData);
        } catch (error) {
            console.error('Error performing scan:', error);
            return { success: false, error: error.message };
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

    async cleanupOldScans() {
        try {
            const result = await query(
                `DELETE FROM security_scans WHERE created_at < NOW() - INTERVAL '${this.scansRetentionDays} days'`
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

