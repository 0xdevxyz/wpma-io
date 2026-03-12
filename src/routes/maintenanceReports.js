/**
 * Maintenance Reports API Routes
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { query } = require('../config/database');
const maintenanceReportService = require('../services/maintenanceReportService');
const fs = require('fs');
const path = require('path');

/**
 * POST /api/v1/reports/maintenance/generate
 * Generiert neuen Wartungsbericht
 */
router.post('/maintenance/generate', authenticateToken, async (req, res) => {
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
});

/**
 * GET /api/v1/reports/maintenance/:siteId
 * Holt alle Reports für eine Site
 */
router.get('/maintenance/:siteId', authenticateToken, async (req, res) => {
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
});

/**
 * GET /api/v1/reports/download/:filename
 * Download Report
 */
router.get('/download/:filename', authenticateToken, async (req, res) => {
    try {
        const { filename } = req.params;

        // Sicherheitscheck: Nur Dateien des Users
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

        // Setze passenden Content-Type
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
});

/**
 * POST /api/v1/reports/schedule
 * Aktiviert automatische monatliche Reports
 */
router.post('/schedule', authenticateToken, async (req, res) => {
    try {
        const { siteId, frequency, format, recipients } = req.body;

        if (!siteId) {
            return res.status(400).json({
                success: false,
                error: 'siteId ist erforderlich'
            });
        }

        // Speichere Schedule in DB
        await query(
            `INSERT INTO report_schedules (site_id, user_id, frequency, format, recipients, is_active)
             VALUES ($1, $2, $3, $4, $5, true)
             ON CONFLICT (site_id, user_id) 
             DO UPDATE SET frequency = $3, format = $4, recipients = $5, is_active = true, updated_at = NOW()`,
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
});

/**
 * DELETE /api/v1/reports/schedule/:siteId
 * Deaktiviert automatische Reports
 */
router.delete('/schedule/:siteId', authenticateToken, async (req, res) => {
    try {
        const { siteId } = req.params;

        await query(
            `UPDATE report_schedules 
             SET is_active = false 
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
});

module.exports = router;
