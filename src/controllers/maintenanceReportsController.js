const { query } = require('../config/database');
const maintenanceReportService = require('../services/maintenanceReportService');
const fs = require('fs');
const path = require('path');

class MaintenanceReportsController {
    async generateMaintenanceReport(req, res) {
        try {
            const { siteId, startDate, endDate, format, includeAiSummary } = req.body;

            if (!siteId) {
                return res.status(400).json({
                    success: false,
                    error: 'siteId ist erforderlich'
                });
            }

            const result = await maintenanceReportService.generateMaintenanceReport(
                siteId,
                req.user.userId,
                {
                    startDate: startDate ? new Date(startDate) : undefined,
                    endDate: endDate ? new Date(endDate) : undefined,
                    format: format || 'pdf',
                    includeAiSummary: includeAiSummary !== false
                }
            );

            res.json(result);
        } catch (error) {
            console.error('Generate maintenance report error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    async getMaintenanceReports(req, res) {
        try {
            const { siteId } = req.params;

            const result = await query(
                `SELECT * FROM maintenance_reports 
                 WHERE site_id = $1 AND user_id = $2 
                 ORDER BY created_at DESC 
                 LIMIT 20`,
                [siteId, req.user.userId]
            );

            res.json({
                success: true,
                data: result.rows
            });
        } catch (error) {
            console.error('Get maintenance reports error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    async downloadReport(req, res) {
        try {
            const { filename } = req.params;

            const reportResult = await query(
                `SELECT * FROM maintenance_reports 
                 WHERE filename = $1 AND user_id = $2`,
                [filename, req.user.userId]
            );

            if (reportResult.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Report nicht gefunden'
                });
            }

            const report = reportResult.rows[0];
            const filepath = report.filepath;

            if (!fs.existsSync(filepath)) {
                return res.status(404).json({
                    success: false,
                    error: 'Datei nicht gefunden'
                });
            }

            const ext = path.extname(filename).toLowerCase();
            const contentType = ext === '.pdf' ? 'application/pdf' :
                              ext === '.html' ? 'text/html' :
                              'application/json';

            res.setHeader('Content-Type', contentType);
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.sendFile(filepath);
        } catch (error) {
            console.error('Download report error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    async getScheduledReports(req, res) {
        try {
            const result = await query(
                `SELECT sr.*, s.site_name, s.domain
                 FROM scheduled_reports sr
                 LEFT JOIN sites s ON s.id = sr.site_id
                 WHERE sr.user_id = $1 AND sr.active = true
                 ORDER BY sr.created_at DESC`,
                [req.user.userId]
            );
            res.json({ success: true, data: result.rows });
        } catch (error) {
            console.error('Get scheduled reports error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async scheduleReport(req, res) {
        try {
            const { siteId, frequency, format, recipients } = req.body;

            if (!siteId) {
                return res.status(400).json({
                    success: false,
                    error: 'siteId ist erforderlich'
                });
            }

            await query(
                `INSERT INTO scheduled_reports (site_id, user_id, frequency, format, recipients, active)
                 VALUES ($1, $2, $3, $4, $5, true)
                 ON CONFLICT (site_id, user_id) 
                 DO UPDATE SET frequency = $3, format = $4, recipients = $5, active = true, updated_at = NOW()`,
                [siteId, req.user.userId, frequency || 'monthly', format || 'pdf', JSON.stringify(recipients || [])]
            );

            res.json({
                success: true,
                message: 'Automatische Reports aktiviert'
            });
        } catch (error) {
            console.error('Schedule reports error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    async cancelSchedule(req, res) {
        try {
            const { siteId } = req.params;

            await query(
                `UPDATE scheduled_reports 
                 SET active = false 
                 WHERE site_id = $1 AND user_id = $2`,
                [siteId, req.user.userId]
            );

            res.json({
                success: true,
                message: 'Automatische Reports deaktiviert'
            });
        } catch (error) {
            console.error('Cancel schedule error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
}

module.exports = new MaintenanceReportsController();
