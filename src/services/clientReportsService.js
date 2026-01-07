/**
 * Client Reports Service
 * Generiert automatische PDF/HTML-Reports für Kunden
 */

const { query } = require('../config/database');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

class ClientReportsService {
    constructor() {
        this.reportsDir = process.env.REPORTS_DIR || '/tmp/reports';
        this.ensureReportsDir();
    }

    ensureReportsDir() {
        if (!fs.existsSync(this.reportsDir)) {
            fs.mkdirSync(this.reportsDir, { recursive: true });
        }
    }

    /**
     * Generiert einen vollständigen Site-Report
     */
    async generateSiteReport(siteId, userId, options = {}) {
        try {
            const {
                format = 'pdf',
                period = '30d',
                includeUptime = true,
                includeSecurity = true,
                includePerformance = true,
                includeUpdates = true,
                includeBackups = true,
                whiteLabelConfig = null
            } = options;

            // Prüfe Zugriff
            const siteResult = await query(
                'SELECT * FROM sites WHERE id = $1 AND user_id = $2',
                [siteId, userId]
            );

            if (siteResult.rows.length === 0) {
                return { success: false, error: 'Site nicht gefunden' };
            }

            const site = siteResult.rows[0];
            const periodDays = this.parsePeriod(period);
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - periodDays);

            // Sammle Report-Daten
            const reportData = {
                site,
                period: { days: periodDays, startDate, endDate: new Date() },
                generatedAt: new Date(),
                sections: {}
            };

            if (includeUptime) {
                reportData.sections.uptime = await this.getUptimeData(siteId, startDate);
            }

            if (includeSecurity) {
                reportData.sections.security = await this.getSecurityData(siteId, startDate);
            }

            if (includePerformance) {
                reportData.sections.performance = await this.getPerformanceData(siteId, startDate);
            }

            if (includeUpdates) {
                reportData.sections.updates = await this.getUpdatesData(siteId, startDate);
            }

            if (includeBackups) {
                reportData.sections.backups = await this.getBackupsData(siteId, startDate);
            }

            // Generiere Report im gewünschten Format
            let reportFile;
            if (format === 'pdf') {
                reportFile = await this.generatePDFReport(reportData, whiteLabelConfig);
            } else {
                reportFile = await this.generateHTMLReport(reportData, whiteLabelConfig);
            }

            // Speichere Report in DB
            const reportRecord = await query(
                `INSERT INTO client_reports 
                 (site_id, user_id, report_type, period_days, file_path, file_format, generated_at)
                 VALUES ($1, $2, 'site_report', $3, $4, $5, CURRENT_TIMESTAMP)
                 RETURNING id`,
                [siteId, userId, periodDays, reportFile.path, format]
            );

            return {
                success: true,
                data: {
                    reportId: reportRecord.rows[0].id,
                    format,
                    path: reportFile.path,
                    size: reportFile.size,
                    summary: this.generateReportSummary(reportData)
                }
            };
        } catch (error) {
            console.error('Generate site report error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Generiert einen Multi-Site Report
     */
    async generateMultiSiteReport(userId, siteIds, options = {}) {
        try {
            const {
                format = 'pdf',
                period = '30d',
                whiteLabelConfig = null
            } = options;

            // Validiere Zugriff auf alle Sites
            const sitesResult = await query(
                `SELECT * FROM sites WHERE id = ANY($1) AND user_id = $2`,
                [siteIds, userId]
            );

            if (sitesResult.rows.length === 0) {
                return { success: false, error: 'Keine Sites gefunden' };
            }

            const periodDays = this.parsePeriod(period);
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - periodDays);

            // Sammle Daten für alle Sites
            const sitesData = [];
            for (const site of sitesResult.rows) {
                const siteReport = {
                    site,
                    uptime: await this.getUptimeData(site.id, startDate),
                    security: await this.getSecurityData(site.id, startDate),
                    performance: await this.getPerformanceData(site.id, startDate)
                };
                sitesData.push(siteReport);
            }

            const reportData = {
                type: 'multi_site',
                userId,
                sites: sitesData,
                totalSites: sitesData.length,
                period: { days: periodDays, startDate, endDate: new Date() },
                generatedAt: new Date()
            };

            // Generiere Report
            let reportFile;
            if (format === 'pdf') {
                reportFile = await this.generateMultiSitePDF(reportData, whiteLabelConfig);
            } else {
                reportFile = await this.generateMultiSiteHTML(reportData, whiteLabelConfig);
            }

            return {
                success: true,
                data: {
                    format,
                    path: reportFile.path,
                    size: reportFile.size,
                    totalSites: sitesData.length
                }
            };
        } catch (error) {
            console.error('Generate multi-site report error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Holt Uptime-Daten für den Report
     */
    async getUptimeData(siteId, startDate) {
        try {
            const result = await query(
                `SELECT 
                    COUNT(*) as total_checks,
                    SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END) as up_count,
                    AVG(response_time) as avg_response_time,
                    MIN(response_time) as min_response_time,
                    MAX(response_time) as max_response_time
                 FROM uptime_checks 
                 WHERE site_id = $1 AND checked_at >= $2`,
                [siteId, startDate]
            );

            const data = result.rows[0];
            const uptimePercentage = data.total_checks > 0 
                ? ((data.up_count / data.total_checks) * 100).toFixed(2)
                : 100;

            // Hole Downtime-Ereignisse
            const downtimeResult = await query(
                `SELECT checked_at, status_code, error_message
                 FROM uptime_checks 
                 WHERE site_id = $1 AND checked_at >= $2 AND status = 'down'
                 ORDER BY checked_at DESC
                 LIMIT 10`,
                [siteId, startDate]
            );

            return {
                uptimePercentage: parseFloat(uptimePercentage),
                totalChecks: parseInt(data.total_checks) || 0,
                avgResponseTime: Math.round(data.avg_response_time) || 0,
                minResponseTime: Math.round(data.min_response_time) || 0,
                maxResponseTime: Math.round(data.max_response_time) || 0,
                downtimeEvents: downtimeResult.rows
            };
        } catch (error) {
            console.error('Get uptime data error:', error);
            return {
                uptimePercentage: 100,
                totalChecks: 0,
                avgResponseTime: 0,
                downtimeEvents: []
            };
        }
    }

    /**
     * Holt Security-Daten für den Report
     */
    async getSecurityData(siteId, startDate) {
        try {
            // Letzter Security Scan
            const lastScanResult = await query(
                `SELECT * FROM security_scans 
                 WHERE site_id = $1 
                 ORDER BY created_at DESC LIMIT 1`,
                [siteId]
            );

            // Scan-Verlauf
            const scanHistoryResult = await query(
                `SELECT created_at, security_score, issues_found
                 FROM security_scans 
                 WHERE site_id = $1 AND created_at >= $2
                 ORDER BY created_at DESC`,
                [siteId, startDate]
            );

            const lastScan = lastScanResult.rows[0] || null;

            return {
                currentScore: lastScan?.security_score || 0,
                lastScanDate: lastScan?.created_at || null,
                issuesFound: lastScan?.issues_found || 0,
                scanHistory: scanHistoryResult.rows.map(s => ({
                    date: s.created_at,
                    score: s.security_score,
                    issues: s.issues_found
                })),
                totalScans: scanHistoryResult.rows.length
            };
        } catch (error) {
            console.error('Get security data error:', error);
            return {
                currentScore: 0,
                lastScanDate: null,
                issuesFound: 0,
                scanHistory: [],
                totalScans: 0
            };
        }
    }

    /**
     * Holt Performance-Daten für den Report
     */
    async getPerformanceData(siteId, startDate) {
        try {
            const result = await query(
                `SELECT 
                    AVG(page_load_time) as avg_load_time,
                    AVG(ttfb) as avg_ttfb,
                    AVG(performance_score) as avg_score,
                    MIN(page_load_time) as best_load_time,
                    MAX(page_load_time) as worst_load_time
                 FROM performance_metrics 
                 WHERE site_id = $1 AND created_at >= $2`,
                [siteId, startDate]
            );

            const data = result.rows[0];

            // Verlauf für Chart
            const historyResult = await query(
                `SELECT 
                    DATE(created_at) as date,
                    AVG(page_load_time) as load_time,
                    AVG(performance_score) as score
                 FROM performance_metrics 
                 WHERE site_id = $1 AND created_at >= $2
                 GROUP BY DATE(created_at)
                 ORDER BY date DESC`,
                [siteId, startDate]
            );

            return {
                avgLoadTime: Math.round(data.avg_load_time) || 0,
                avgTTFB: Math.round(data.avg_ttfb) || 0,
                avgScore: Math.round(data.avg_score) || 0,
                bestLoadTime: Math.round(data.best_load_time) || 0,
                worstLoadTime: Math.round(data.worst_load_time) || 0,
                history: historyResult.rows
            };
        } catch (error) {
            console.error('Get performance data error:', error);
            return {
                avgLoadTime: 0,
                avgTTFB: 0,
                avgScore: 0,
                history: []
            };
        }
    }

    /**
     * Holt Update-Daten für den Report
     */
    async getUpdatesData(siteId, startDate) {
        try {
            const result = await query(
                `SELECT * FROM update_logs 
                 WHERE site_id = $1 AND created_at >= $2
                 ORDER BY created_at DESC`,
                [siteId, startDate]
            );

            const updates = result.rows;
            const successful = updates.filter(u => u.status === 'success').length;
            const failed = updates.filter(u => u.status === 'failed').length;
            const rolledBack = updates.filter(u => u.status === 'rolled_back').length;

            return {
                totalUpdates: updates.length,
                successful,
                failed,
                rolledBack,
                recentUpdates: updates.slice(0, 10).map(u => ({
                    date: u.created_at,
                    status: u.status,
                    data: u.update_data ? JSON.parse(u.update_data) : null
                }))
            };
        } catch (error) {
            console.error('Get updates data error:', error);
            return {
                totalUpdates: 0,
                successful: 0,
                failed: 0,
                rolledBack: 0,
                recentUpdates: []
            };
        }
    }

    /**
     * Holt Backup-Daten für den Report
     */
    async getBackupsData(siteId, startDate) {
        try {
            const result = await query(
                `SELECT * FROM backups 
                 WHERE site_id = $1 AND created_at >= $2
                 ORDER BY created_at DESC`,
                [siteId, startDate]
            );

            const backups = result.rows;
            const successful = backups.filter(b => b.status === 'completed').length;
            const totalSize = backups.reduce((sum, b) => sum + (b.file_size || 0), 0);

            return {
                totalBackups: backups.length,
                successful,
                failed: backups.filter(b => b.status === 'failed').length,
                totalSize,
                totalSizeFormatted: this.formatBytes(totalSize),
                recentBackups: backups.slice(0, 5).map(b => ({
                    date: b.created_at,
                    type: b.backup_type,
                    status: b.status,
                    size: this.formatBytes(b.file_size)
                }))
            };
        } catch (error) {
            console.error('Get backups data error:', error);
            return {
                totalBackups: 0,
                successful: 0,
                failed: 0,
                totalSize: 0,
                recentBackups: []
            };
        }
    }

    /**
     * Generiert PDF-Report
     */
    async generatePDFReport(reportData, whiteLabelConfig = null) {
        return new Promise((resolve, reject) => {
            const doc = new PDFDocument({ margin: 50 });
            const filename = `report_${reportData.site.domain}_${Date.now()}.pdf`;
            const filepath = path.join(this.reportsDir, filename);
            const writeStream = fs.createWriteStream(filepath);

            doc.pipe(writeStream);

            // Header
            const brandName = whiteLabelConfig?.brandName || 'WPMA.io';
            const brandColor = whiteLabelConfig?.primaryColor || '#6366f1';

            doc.fontSize(24).fillColor(brandColor).text(brandName, { align: 'center' });
            doc.moveDown();
            doc.fontSize(18).fillColor('#333').text('Website Performance Report', { align: 'center' });
            doc.moveDown();
            doc.fontSize(12).fillColor('#666').text(`${reportData.site.domain}`, { align: 'center' });
            doc.fontSize(10).text(`Zeitraum: ${reportData.period.days} Tage | Erstellt: ${new Date().toLocaleDateString('de-DE')}`, { align: 'center' });

            doc.moveDown(2);

            // Health Score
            doc.fontSize(14).fillColor('#333').text('Gesamtbewertung');
            doc.moveDown(0.5);
            doc.fontSize(36).fillColor(brandColor).text(`${reportData.site.health_score || 0}%`, { align: 'left' });
            doc.fontSize(10).fillColor('#666').text('Health Score');

            doc.moveDown(2);

            // Uptime Section
            if (reportData.sections.uptime) {
                doc.fontSize(14).fillColor('#333').text('📊 Uptime Monitoring');
                doc.moveDown(0.5);
                doc.fontSize(11).fillColor('#666');
                doc.text(`Verfügbarkeit: ${reportData.sections.uptime.uptimePercentage}%`);
                doc.text(`Durchschnittliche Antwortzeit: ${reportData.sections.uptime.avgResponseTime}ms`);
                doc.text(`Anzahl Prüfungen: ${reportData.sections.uptime.totalChecks}`);
                doc.moveDown();
            }

            // Security Section
            if (reportData.sections.security) {
                doc.fontSize(14).fillColor('#333').text('🔒 Sicherheit');
                doc.moveDown(0.5);
                doc.fontSize(11).fillColor('#666');
                doc.text(`Security Score: ${reportData.sections.security.currentScore}%`);
                doc.text(`Gefundene Probleme: ${reportData.sections.security.issuesFound}`);
                doc.text(`Durchgeführte Scans: ${reportData.sections.security.totalScans}`);
                doc.moveDown();
            }

            // Performance Section
            if (reportData.sections.performance) {
                doc.fontSize(14).fillColor('#333').text('⚡ Performance');
                doc.moveDown(0.5);
                doc.fontSize(11).fillColor('#666');
                doc.text(`Durchschn. Ladezeit: ${reportData.sections.performance.avgLoadTime}ms`);
                doc.text(`Performance Score: ${reportData.sections.performance.avgScore}%`);
                doc.text(`TTFB: ${reportData.sections.performance.avgTTFB}ms`);
                doc.moveDown();
            }

            // Backups Section
            if (reportData.sections.backups) {
                doc.fontSize(14).fillColor('#333').text('💾 Backups');
                doc.moveDown(0.5);
                doc.fontSize(11).fillColor('#666');
                doc.text(`Erfolgreiche Backups: ${reportData.sections.backups.successful}`);
                doc.text(`Gesamtgröße: ${reportData.sections.backups.totalSizeFormatted}`);
                doc.moveDown();
            }

            // Updates Section
            if (reportData.sections.updates) {
                doc.fontSize(14).fillColor('#333').text('🔄 Updates');
                doc.moveDown(0.5);
                doc.fontSize(11).fillColor('#666');
                doc.text(`Durchgeführte Updates: ${reportData.sections.updates.totalUpdates}`);
                doc.text(`Erfolgreich: ${reportData.sections.updates.successful}`);
                doc.text(`Fehlgeschlagen: ${reportData.sections.updates.failed}`);
            }

            // Footer
            doc.moveDown(3);
            doc.fontSize(9).fillColor('#999').text(
                `Dieser Report wurde automatisch von ${brandName} generiert.`,
                { align: 'center' }
            );

            doc.end();

            writeStream.on('finish', () => {
                const stats = fs.statSync(filepath);
                resolve({
                    path: filepath,
                    size: stats.size,
                    filename
                });
            });

            writeStream.on('error', reject);
        });
    }

    /**
     * Generiert HTML-Report
     */
    async generateHTMLReport(reportData, whiteLabelConfig = null) {
        const brandName = whiteLabelConfig?.brandName || 'WPMA.io';
        const brandColor = whiteLabelConfig?.primaryColor || '#6366f1';
        const logoUrl = whiteLabelConfig?.logoUrl || '';

        const html = `
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Website Report - ${reportData.site.domain}</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; color: #333; }
        .container { max-width: 800px; margin: 0 auto; padding: 40px 20px; }
        .header { text-align: center; margin-bottom: 40px; }
        .header h1 { color: ${brandColor}; font-size: 28px; margin-bottom: 10px; }
        .header p { color: #666; }
        .card { background: white; border-radius: 12px; padding: 24px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
        .card h2 { font-size: 18px; margin-bottom: 16px; color: #333; }
        .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 20px; }
        .stat { text-align: center; }
        .stat-value { font-size: 32px; font-weight: bold; color: ${brandColor}; }
        .stat-label { font-size: 12px; color: #666; }
        .health-score { font-size: 64px; font-weight: bold; color: ${brandColor}; }
        .footer { text-align: center; margin-top: 40px; color: #999; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            ${logoUrl ? `<img src="${logoUrl}" alt="${brandName}" height="40" />` : `<h1>${brandName}</h1>`}
            <h2>Website Performance Report</h2>
            <p>${reportData.site.domain}</p>
            <p>Zeitraum: ${reportData.period.days} Tage | Erstellt: ${new Date().toLocaleDateString('de-DE')}</p>
        </div>

        <div class="card" style="text-align: center;">
            <div class="health-score">${reportData.site.health_score || 0}%</div>
            <p>Gesamt Health Score</p>
        </div>

        ${reportData.sections.uptime ? `
        <div class="card">
            <h2>📊 Uptime Monitoring</h2>
            <div class="stat-grid">
                <div class="stat">
                    <div class="stat-value">${reportData.sections.uptime.uptimePercentage}%</div>
                    <div class="stat-label">Verfügbarkeit</div>
                </div>
                <div class="stat">
                    <div class="stat-value">${reportData.sections.uptime.avgResponseTime}ms</div>
                    <div class="stat-label">Ø Antwortzeit</div>
                </div>
                <div class="stat">
                    <div class="stat-value">${reportData.sections.uptime.totalChecks}</div>
                    <div class="stat-label">Prüfungen</div>
                </div>
            </div>
        </div>
        ` : ''}

        ${reportData.sections.security ? `
        <div class="card">
            <h2>🔒 Sicherheit</h2>
            <div class="stat-grid">
                <div class="stat">
                    <div class="stat-value">${reportData.sections.security.currentScore}%</div>
                    <div class="stat-label">Security Score</div>
                </div>
                <div class="stat">
                    <div class="stat-value">${reportData.sections.security.issuesFound}</div>
                    <div class="stat-label">Gefundene Probleme</div>
                </div>
                <div class="stat">
                    <div class="stat-value">${reportData.sections.security.totalScans}</div>
                    <div class="stat-label">Scans durchgeführt</div>
                </div>
            </div>
        </div>
        ` : ''}

        ${reportData.sections.performance ? `
        <div class="card">
            <h2>⚡ Performance</h2>
            <div class="stat-grid">
                <div class="stat">
                    <div class="stat-value">${reportData.sections.performance.avgLoadTime}ms</div>
                    <div class="stat-label">Ø Ladezeit</div>
                </div>
                <div class="stat">
                    <div class="stat-value">${reportData.sections.performance.avgScore}%</div>
                    <div class="stat-label">Performance Score</div>
                </div>
                <div class="stat">
                    <div class="stat-value">${reportData.sections.performance.avgTTFB}ms</div>
                    <div class="stat-label">TTFB</div>
                </div>
            </div>
        </div>
        ` : ''}

        ${reportData.sections.backups ? `
        <div class="card">
            <h2>💾 Backups</h2>
            <div class="stat-grid">
                <div class="stat">
                    <div class="stat-value">${reportData.sections.backups.successful}</div>
                    <div class="stat-label">Erfolgreiche Backups</div>
                </div>
                <div class="stat">
                    <div class="stat-value">${reportData.sections.backups.totalSizeFormatted}</div>
                    <div class="stat-label">Gesamtgröße</div>
                </div>
            </div>
        </div>
        ` : ''}

        ${reportData.sections.updates ? `
        <div class="card">
            <h2>🔄 Updates</h2>
            <div class="stat-grid">
                <div class="stat">
                    <div class="stat-value">${reportData.sections.updates.totalUpdates}</div>
                    <div class="stat-label">Gesamt</div>
                </div>
                <div class="stat">
                    <div class="stat-value">${reportData.sections.updates.successful}</div>
                    <div class="stat-label">Erfolgreich</div>
                </div>
                <div class="stat">
                    <div class="stat-value">${reportData.sections.updates.failed}</div>
                    <div class="stat-label">Fehlgeschlagen</div>
                </div>
            </div>
        </div>
        ` : ''}

        <div class="footer">
            <p>Dieser Report wurde automatisch von ${brandName} generiert.</p>
        </div>
    </div>
</body>
</html>
        `.trim();

        const filename = `report_${reportData.site.domain}_${Date.now()}.html`;
        const filepath = path.join(this.reportsDir, filename);
        
        fs.writeFileSync(filepath, html);
        const stats = fs.statSync(filepath);

        return {
            path: filepath,
            size: stats.size,
            filename,
            html
        };
    }

    /**
     * Generiert Multi-Site PDF Report
     */
    async generateMultiSitePDF(reportData, whiteLabelConfig = null) {
        // Vereinfachte Version - in Production würde hier ein vollständiger Multi-Site Report erstellt
        return this.generatePDFReport({
            site: { domain: 'Multi-Site Report', health_score: 0 },
            period: reportData.period,
            generatedAt: reportData.generatedAt,
            sections: {}
        }, whiteLabelConfig);
    }

    /**
     * Generiert Multi-Site HTML Report
     */
    async generateMultiSiteHTML(reportData, whiteLabelConfig = null) {
        const brandName = whiteLabelConfig?.brandName || 'WPMA.io';
        
        let sitesHtml = reportData.sites.map(s => `
            <div class="card">
                <h3>${s.site.domain}</h3>
                <div class="stat-grid">
                    <div class="stat">
                        <div class="stat-value">${s.uptime.uptimePercentage}%</div>
                        <div class="stat-label">Uptime</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value">${s.security.currentScore}%</div>
                        <div class="stat-label">Security</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value">${s.performance.avgLoadTime}ms</div>
                        <div class="stat-label">Ladezeit</div>
                    </div>
                </div>
            </div>
        `).join('');

        const html = `
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <title>Multi-Site Report - ${brandName}</title>
    <style>
        body { font-family: sans-serif; background: #f5f5f5; padding: 40px; }
        .container { max-width: 900px; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 40px; }
        .card { background: white; padding: 20px; margin-bottom: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .stat-grid { display: flex; gap: 30px; }
        .stat-value { font-size: 24px; font-weight: bold; color: #6366f1; }
        .stat-label { font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${brandName} - Multi-Site Report</h1>
            <p>${reportData.totalSites} Sites | ${reportData.period.days} Tage</p>
        </div>
        ${sitesHtml}
    </div>
</body>
</html>
        `.trim();

        const filename = `multi_site_report_${Date.now()}.html`;
        const filepath = path.join(this.reportsDir, filename);
        
        fs.writeFileSync(filepath, html);
        const stats = fs.statSync(filepath);

        return { path: filepath, size: stats.size, filename };
    }

    /**
     * Plant einen wiederkehrenden Report
     */
    async scheduleReport(userId, siteId, schedule, options = {}) {
        try {
            const { frequency = 'monthly', email = null, format = 'pdf' } = options;

            await query(
                `INSERT INTO scheduled_reports 
                 (user_id, site_id, frequency, send_email, email_to, format, options, is_active)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, true)
                 ON CONFLICT (user_id, site_id) 
                 DO UPDATE SET frequency = $3, send_email = $4, email_to = $5, format = $6, 
                              options = $7, is_active = true, updated_at = CURRENT_TIMESTAMP`,
                [userId, siteId, frequency, !!email, email, format, JSON.stringify(options)]
            );

            return {
                success: true,
                message: `Report geplant: ${frequency}`
            };
        } catch (error) {
            console.error('Schedule report error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Holt alle Reports eines Users
     */
    async getUserReports(userId, limit = 20) {
        try {
            const result = await query(
                `SELECT cr.*, s.domain 
                 FROM client_reports cr
                 JOIN sites s ON cr.site_id = s.id
                 WHERE cr.user_id = $1
                 ORDER BY cr.generated_at DESC
                 LIMIT $2`,
                [userId, limit]
            );

            return {
                success: true,
                data: result.rows
            };
        } catch (error) {
            console.error('Get user reports error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Hilfsfunktionen
     */
    parsePeriod(period) {
        const match = period.match(/^(\d+)(d|w|m)$/);
        if (!match) return 30;

        const value = parseInt(match[1]);
        const unit = match[2];

        switch (unit) {
            case 'd': return value;
            case 'w': return value * 7;
            case 'm': return value * 30;
            default: return 30;
        }
    }

    formatBytes(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    generateReportSummary(reportData) {
        const summary = [];
        
        if (reportData.sections.uptime) {
            summary.push(`Uptime: ${reportData.sections.uptime.uptimePercentage}%`);
        }
        if (reportData.sections.security) {
            summary.push(`Security: ${reportData.sections.security.currentScore}%`);
        }
        if (reportData.sections.performance) {
            summary.push(`Performance: ${reportData.sections.performance.avgScore}%`);
        }

        return summary.join(' | ');
    }
}

module.exports = new ClientReportsService();

