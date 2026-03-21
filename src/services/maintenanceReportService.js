/**
 * Automated Maintenance Report Service
 * Generiert automatische Wartungsprotokolle für Kunden
 */

const { query } = require('../config/database');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const aiService = require('./aiService');

class MaintenanceReportService {
    constructor() {
        this.reportDir = '/tmp/wpma-reports';
        this.ensureReportDir();
    }

    /**
     * Generiert vollständigen Wartungsbericht für einen Zeitraum
     */
    async generateMaintenanceReport(siteId, userId, options = {}) {
        try {
            const {
                startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 Tage
                endDate = new Date(),
                language = 'de',
                includeAiSummary = true,
                format = 'pdf' // pdf, json, html
            } = options;

            // 1. Sammle alle durchgeführten Tätigkeiten
            const activities = await this.collectActivities(siteId, startDate, endDate);

            // 2. Hole Site-Infos
            const siteInfo = await this.getSiteInfo(siteId);

            // 3. Berechne Statistiken
            const stats = await this.calculateStats(activities);

            // 4. KI-generierte Zusammenfassung (optional)
            let aiSummary = null;
            if (includeAiSummary) {
                aiSummary = await this.generateAiSummary(siteInfo, activities, stats);
            }

            // 5. Generiere Report im gewünschten Format
            const report = {
                siteInfo,
                period: { startDate, endDate },
                activities,
                stats,
                aiSummary,
                generatedAt: new Date()
            };

            switch (format) {
                case 'pdf':
                    return await this.generatePdfReport(report, userId);
                case 'html':
                    return await this.generateHtmlReport(report, userId);
                case 'json':
                    return { success: true, data: report };
                default:
                    return await this.generatePdfReport(report, userId);
            }

        } catch (error) {
            console.error('Generate maintenance report error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Sammelt alle Aktivitäten im Zeitraum
     */
    async collectActivities(siteId, startDate, endDate) {
        const activities = {
            backups: [],
            updates: [],
            securityScans: [],
            performanceOptimizations: [],
            selfHealing: [],
            stagingOperations: [],
            rollbacks: [],
            monitoring: []
        };

        // Backups
        const backupsResult = await query(
            `SELECT * FROM backups 
             WHERE site_id = $1 AND created_at BETWEEN $2 AND $3 
             ORDER BY created_at DESC`,
            [siteId, startDate, endDate]
        );
        activities.backups = backupsResult.rows.map(b => ({
            type: 'backup',
            action: `Backup erstellt (${b.backup_type})`,
            status: b.status,
            details: {
                backupType: b.backup_type,
                fileSize: this.formatBytes(b.file_size),
                provider: b.provider
            },
            timestamp: b.created_at,
            icon: '💾'
        }));

        // Updates
        const updatesResult = await query(
            `SELECT * FROM update_logs 
             WHERE site_id = $1 AND created_at BETWEEN $2 AND $3 
             ORDER BY created_at DESC`,
            [siteId, startDate, endDate]
        );
        activities.updates = updatesResult.rows.map(u => ({
            type: 'update',
            action: u.status === 'success' ? 'Updates erfolgreich durchgeführt' : 
                    u.status === 'rolled_back' ? 'Update zurückgerollt' : 'Update fehlgeschlagen',
            status: u.status,
            details: {
                updates: u.update_data ? (() => { try { return JSON.parse(u.update_data); } catch { return {}; } })() : {},
                wasRolledBack: !!u.rolled_back_at
            },
            timestamp: u.created_at,
            icon: u.status === 'success' ? '✅' : u.status === 'rolled_back' ? '🔄' : '❌'
        }));

        // Security Scans
        const scansResult = await query(
            `SELECT * FROM security_scans 
             WHERE site_id = $1 AND created_at BETWEEN $2 AND $3 
             ORDER BY created_at DESC`,
            [siteId, startDate, endDate]
        );
        activities.securityScans = scansResult.rows.map(s => ({
            type: 'security',
            action: 'Security-Scan durchgeführt',
            status: s.vulnerabilities_found > 0 ? 'warning' : 'success',
            details: {
                vulnerabilities: s.vulnerabilities_found,
                securityScore: s.security_score,
                issues: s.scan_results ? (() => { try { return JSON.parse(s.scan_results); } catch { return {}; } })() : {}
            },
            timestamp: s.created_at,
            icon: s.vulnerabilities_found > 0 ? '⚠️' : '🛡️'
        }));

        // Performance-Optimierungen
        const perfResult = await query(
            `SELECT * FROM performance_metrics 
             WHERE site_id = $1 AND created_at BETWEEN $2 AND $3 
             ORDER BY created_at DESC 
             LIMIT 10`,
            [siteId, startDate, endDate]
        );
        if (perfResult.rows.length > 0) {
            const avgLoadTime = perfResult.rows.reduce((sum, p) => sum + (p.load_time || 0), 0) / perfResult.rows.length;
            activities.performanceOptimizations.push({
                type: 'performance',
                action: 'Performance überwacht',
                status: 'success',
                details: {
                    avgLoadTime: avgLoadTime.toFixed(2) + 's',
                    measurements: perfResult.rows.length,
                    bestLoadTime: Math.min(...perfResult.rows.map(p => p.load_time || 999)).toFixed(2) + 's'
                },
                timestamp: perfResult.rows[0].created_at,
                icon: '⚡'
            });
        }

        // Self-Healing
        const healingResult = await query(
            `SELECT * FROM selfhealing_fixes 
             WHERE site_id = $1 AND created_at BETWEEN $2 AND $3 
             ORDER BY created_at DESC`,
            [siteId, startDate, endDate]
        );
        activities.selfHealing = healingResult.rows.map(h => ({
            type: 'selfhealing',
            action: h.status === 'applied' ? 'Problem automatisch behoben' : 'Problem erkannt',
            status: h.status,
            details: {
                description: h.description,
                fixType: h.fix_type,
                confidence: (h.confidence * 100).toFixed(0) + '%'
            },
            timestamp: h.created_at,
            icon: h.status === 'applied' ? '🔧' : '🔍'
        }));

        // Staging-Operationen
        const stagingResult = await query(
            `SELECT * FROM staging_environments 
             WHERE source_site_id = $1 AND created_at BETWEEN $2 AND $3 
             ORDER BY created_at DESC`,
            [siteId, startDate, endDate]
        );
        activities.stagingOperations = stagingResult.rows.map(s => ({
            type: 'staging',
            action: s.status === 'active' ? 'Staging-Umgebung erstellt' : 
                    s.status === 'deleted' ? 'Staging-Umgebung gelöscht' : 'Staging in Arbeit',
            status: s.status,
            details: {
                stagingUrl: s.staging_url,
                syncedAt: s.last_synced_at
            },
            timestamp: s.created_at,
            icon: '🔨'
        }));

        // Monitoring-Events
        const monitoringResult = await query(
            `SELECT * FROM activity_logs 
             WHERE site_id = $1 AND created_at BETWEEN $2 AND $3 
             ORDER BY created_at DESC 
             LIMIT 50`,
            [siteId, startDate, endDate]
        );
        activities.monitoring = monitoringResult.rows.map(m => ({
            type: 'monitoring',
            action: m.description,
            status: m.activity_type,
            details: {},
            timestamp: m.created_at,
            icon: '👁️'
        }));

        return activities;
    }

    /**
     * Berechnet Statistiken
     */
    async calculateStats(activities) {
        const allActivities = [
            ...activities.backups,
            ...activities.updates,
            ...activities.securityScans,
            ...activities.selfHealing,
            ...activities.stagingOperations
        ];

        const stats = {
            totalActivities: allActivities.length,
            byType: {
                backups: activities.backups.length,
                updates: activities.updates.length,
                securityScans: activities.securityScans.length,
                selfHealing: activities.selfHealing.length,
                stagingOperations: activities.stagingOperations.length
            },
            successRate: {
                updates: this.calculateSuccessRate(activities.updates),
                securityScans: this.calculateSuccessRate(activities.securityScans),
                selfHealing: this.calculateSuccessRate(activities.selfHealing)
            },
            highlights: {
                autoFixedIssues: activities.selfHealing.filter(h => h.status === 'applied').length,
                rolledBackUpdates: activities.updates.filter(u => u.details.wasRolledBack).length,
                vulnerabilitiesFound: activities.securityScans.reduce((sum, s) => sum + (s.details.vulnerabilities || 0), 0)
            },
            timeline: this.generateTimeline(allActivities)
        };

        return stats;
    }

    /**
     * Generiert KI-Zusammenfassung
     */
    async generateAiSummary(siteInfo, activities, stats) {
        try {
            const prompt = `
Erstelle eine professionelle, kundenfokussierte Zusammenfassung der durchgeführten Wartungsarbeiten:

Website: ${siteInfo.site_name}
Zeitraum: 30 Tage
Aktivitäten: ${stats.totalActivities}

Details:
- ${stats.byType.backups} Backups erstellt
- ${stats.byType.updates} Updates durchgeführt (${stats.successRate.updates}% erfolgreich)
- ${stats.byType.securityScans} Security-Scans
- ${stats.highlights.autoFixedIssues} Probleme automatisch behoben
- ${stats.highlights.rolledBackUpdates} Updates automatisch zurückgerollt

Schreibe in 3-4 Sätzen:
1. Was wurde gemacht
2. Was wurde automatisch verhindert/gefixt
3. Aktueller Status der Website
4. Empfehlung für nächsten Monat

Ton: Professionell aber verständlich, keine Tech-Begriffe.
            `;

            const response = await aiService.chat({
                prompt,
                model: 'gpt-4o',
                maxTokens: 300
            });

            return response.data?.content || 'Zusammenfassung konnte nicht generiert werden.';

        } catch (error) {
            console.error('Generate AI summary error:', error);
            return null;
        }
    }

    /**
     * Generiert PDF-Report
     */
    async generatePdfReport(report, userId) {
        const filename = `wartungsbericht_${report.siteInfo.domain}_${Date.now()}.pdf`;
        const filepath = path.join(this.reportDir, filename);

        const doc = new PDFDocument({
            size: 'A4',
            margin: 50,
            info: {
                Title: `Wartungsbericht - ${report.siteInfo.site_name}`,
                Author: 'WPMA.io',
                Subject: 'Automatisches Wartungsprotokoll'
            }
        });

        doc.pipe(fs.createWriteStream(filepath));

        // Header
        doc.fontSize(24).font('Helvetica-Bold').text('Wartungsbericht', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(14).font('Helvetica').text(report.siteInfo.site_name, { align: 'center' });
        doc.fontSize(10).text(report.siteInfo.site_url, { align: 'center' });
        doc.moveDown(1);

        // Zeitraum
        doc.fontSize(10).text(
            `Berichtszeitraum: ${this.formatDate(report.period.startDate)} - ${this.formatDate(report.period.endDate)}`,
            { align: 'center' }
        );
        doc.moveDown(2);

        // KI-Zusammenfassung
        if (report.aiSummary) {
            doc.fontSize(12).font('Helvetica-Bold').text('Zusammenfassung');
            doc.moveDown(0.5);
            doc.fontSize(10).font('Helvetica').text(report.aiSummary, {
                align: 'justify',
                lineGap: 5
            });
            doc.moveDown(2);
        }

        // Statistik-Übersicht
        doc.fontSize(12).font('Helvetica-Bold').text('Übersicht');
        doc.moveDown(0.5);
        
        const statsY = doc.y;
        this.drawStatBox(doc, 50, statsY, 'Gesamtaktivitäten', report.stats.totalActivities.toString());
        this.drawStatBox(doc, 200, statsY, 'Backups', report.stats.byType.backups.toString());
        this.drawStatBox(doc, 350, statsY, 'Updates', report.stats.byType.updates.toString());
        
        doc.moveDown(4);

        // Highlights
        doc.fontSize(12).font('Helvetica-Bold').text('Highlights');
        doc.moveDown(0.5);
        doc.fontSize(10).font('Helvetica');
        doc.list([
            `${report.stats.highlights.autoFixedIssues} Probleme automatisch behoben`,
            `${report.stats.highlights.rolledBackUpdates} fehlerhafte Updates automatisch zurückgerollt`,
            `${report.stats.highlights.vulnerabilitiesFound} Sicherheitsprobleme identifiziert und behoben`
        ]);
        doc.moveDown(2);

        // Detaillierte Aktivitäten
        doc.addPage();
        doc.fontSize(12).font('Helvetica-Bold').text('Durchgeführte Aktivitäten');
        doc.moveDown(1);

        // Alle Aktivitäten chronologisch
        const allActivities = [
            ...report.activities.backups,
            ...report.activities.updates,
            ...report.activities.securityScans,
            ...report.activities.selfHealing,
            ...report.activities.stagingOperations
        ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        allActivities.slice(0, 30).forEach((activity, index) => {
            if (index > 0 && index % 15 === 0) {
                doc.addPage();
            }

            doc.fontSize(10).font('Helvetica-Bold').text(
                `${activity.icon} ${this.formatDate(activity.timestamp)} - ${activity.action}`
            );
            
            if (activity.details && Object.keys(activity.details).length > 0) {
                doc.fontSize(8).font('Helvetica').fillColor('#666666');
                Object.entries(activity.details).forEach(([key, value]) => {
                    if (typeof value === 'string' || typeof value === 'number') {
                        doc.text(`  ${key}: ${value}`);
                    }
                });
                doc.fillColor('#000000');
            }
            
            doc.moveDown(0.5);
        });

        // Footer auf letzter Seite
        doc.addPage();
        doc.fontSize(10).font('Helvetica').text(
            'Dieser Bericht wurde automatisch von WPMA.io generiert.',
            { align: 'center' }
        );
        doc.text(
            `Generiert am: ${this.formatDate(report.generatedAt)}`,
            { align: 'center' }
        );

        doc.end();

        // Speichere Report-Metadaten in DB
        await this.saveReportMetadata(userId, report.siteInfo.id, filename, filepath);

        return {
            success: true,
            filename,
            filepath,
            downloadUrl: `/api/v1/reports/download/${filename}`
        };
    }

    /**
     * Generiert HTML-Report
     */
    async generateHtmlReport(report, userId) {
        const allActivities = [
            ...report.activities.backups,
            ...report.activities.updates,
            ...report.activities.securityScans,
            ...report.activities.selfHealing,
            ...report.activities.stagingOperations
        ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        const html = `
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Wartungsbericht - ${report.siteInfo.site_name}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 40px; background: #f5f5f5; }
        .container { max-width: 900px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        h1 { font-size: 32px; margin-bottom: 10px; }
        .subtitle { color: #666; font-size: 14px; margin-bottom: 30px; }
        .summary { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 30px 0; line-height: 1.6; }
        .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin: 30px 0; }
        .stat-box { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; }
        .stat-number { font-size: 36px; font-weight: bold; color: #0066cc; }
        .stat-label { color: #666; font-size: 14px; margin-top: 5px; }
        .highlights { margin: 30px 0; }
        .highlight-item { padding: 15px; background: #e7f5ff; border-left: 4px solid #0066cc; margin-bottom: 10px; }
        .activities { margin-top: 40px; }
        .activity { padding: 15px; border-left: 4px solid #ddd; margin-bottom: 10px; background: #fafafa; }
        .activity-header { display: flex; align-items: center; gap: 10px; font-weight: bold; }
        .activity-icon { font-size: 20px; }
        .activity-time { color: #666; font-size: 12px; }
        .activity-details { margin-top: 10px; font-size: 14px; color: #555; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Wartungsbericht</h1>
        <div class="subtitle">
            ${report.siteInfo.site_name}<br>
            ${report.siteInfo.site_url}<br>
            ${this.formatDate(report.period.startDate)} - ${this.formatDate(report.period.endDate)}
        </div>

        ${report.aiSummary ? `
        <div class="summary">
            <h2 style="margin-bottom: 15px;">Zusammenfassung</h2>
            <p>${report.aiSummary}</p>
        </div>
        ` : ''}

        <div class="stats">
            <div class="stat-box">
                <div class="stat-number">${report.stats.totalActivities}</div>
                <div class="stat-label">Gesamtaktivitäten</div>
            </div>
            <div class="stat-box">
                <div class="stat-number">${report.stats.byType.backups}</div>
                <div class="stat-label">Backups</div>
            </div>
            <div class="stat-box">
                <div class="stat-number">${report.stats.byType.updates}</div>
                <div class="stat-label">Updates</div>
            </div>
        </div>

        <div class="highlights">
            <h2 style="margin-bottom: 15px;">Highlights</h2>
            <div class="highlight-item">
                <strong>${report.stats.highlights.autoFixedIssues}</strong> Probleme automatisch behoben
            </div>
            <div class="highlight-item">
                <strong>${report.stats.highlights.rolledBackUpdates}</strong> fehlerhafte Updates automatisch zurückgerollt
            </div>
            <div class="highlight-item">
                <strong>${report.stats.highlights.vulnerabilitiesFound}</strong> Sicherheitsprobleme identifiziert
            </div>
        </div>

        <div class="activities">
            <h2 style="margin-bottom: 20px;">Durchgeführte Aktivitäten</h2>
            ${allActivities.slice(0, 30).map(activity => `
                <div class="activity">
                    <div class="activity-header">
                        <span class="activity-icon">${activity.icon}</span>
                        <span>${activity.action}</span>
                        <span class="activity-time" style="margin-left: auto;">${this.formatDate(activity.timestamp)}</span>
                    </div>
                    ${Object.keys(activity.details || {}).length > 0 ? `
                    <div class="activity-details">
                        ${Object.entries(activity.details).map(([key, value]) => 
                            typeof value === 'string' || typeof value === 'number' 
                                ? `${key}: ${value}<br>` 
                                : ''
                        ).join('')}
                    </div>
                    ` : ''}
                </div>
            `).join('')}
        </div>

        <div class="footer">
            Automatisch generiert von WPMA.io<br>
            ${this.formatDate(report.generatedAt)}
        </div>
    </div>
</body>
</html>
        `;

        const filename = `wartungsbericht_${report.siteInfo.domain}_${Date.now()}.html`;
        const filepath = path.join(this.reportDir, filename);

        fs.writeFileSync(filepath, html);

        await this.saveReportMetadata(userId, report.siteInfo.id, filename, filepath);

        return {
            success: true,
            filename,
            filepath,
            downloadUrl: `/api/v1/reports/download/${filename}`
        };
    }

    /**
     * Helper Functions
     */
    async getSiteInfo(siteId) {
        const result = await query('SELECT * FROM sites WHERE id = $1', [siteId]);
        return result.rows[0];
    }

    calculateSuccessRate(items) {
        if (items.length === 0) return 100;
        const successful = items.filter(i => i.status === 'success' || i.status === 'completed' || i.status === 'applied').length;
        return Math.round((successful / items.length) * 100);
    }

    generateTimeline(activities) {
        const timeline = {};
        activities.forEach(activity => {
            const date = new Date(activity.timestamp).toISOString().split('T')[0];
            timeline[date] = (timeline[date] || 0) + 1;
        });
        return timeline;
    }

    drawStatBox(doc, x, y, label, value) {
        doc.rect(x, y, 120, 60).stroke();
        doc.fontSize(24).font('Helvetica-Bold').text(value, x, y + 10, { width: 120, align: 'center' });
        doc.fontSize(10).font('Helvetica').text(label, x, y + 40, { width: 120, align: 'center' });
    }

    formatDate(date) {
        return new Date(date).toLocaleDateString('de-DE', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    formatBytes(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    async saveReportMetadata(userId, siteId, filename, filepath) {
        await query(
            `INSERT INTO maintenance_reports (user_id, site_id, filename, filepath, created_at)
             VALUES ($1, $2, $3, $4, NOW())`,
            [userId, siteId, filename, filepath]
        );
    }

    ensureReportDir() {
        if (!fs.existsSync(this.reportDir)) {
            fs.mkdirSync(this.reportDir, { recursive: true });
        }
    }
}

module.exports = new MaintenanceReportService();
