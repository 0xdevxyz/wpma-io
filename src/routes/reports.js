/**
 * Client Reports Routes
 * API-Endpunkte für Report-Generierung und -Verwaltung
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const ClientReportsService = require('../services/clientReportsService');
const path = require('path');
const fs = require('fs');

// Alle Routes benötigen Auth
router.use(authenticateToken);

/**
 * POST /api/v1/reports/generate/:siteId
 * Generiert einen Report für eine Site
 */
router.post('/generate/:siteId', async (req, res) => {
    try {
        const { siteId } = req.params;
        const userId = req.user?.userId || req.user?.id;
        const options = req.body || {};

        const result = await ClientReportsService.generateSiteReport(
            parseInt(siteId), 
            userId, 
            options
        );

        res.json(result);
    } catch (error) {
        console.error('Generate report error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/v1/reports/generate-multi
 * Generiert einen Multi-Site Report
 */
router.post('/generate-multi', async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        const { siteIds, format, period, whiteLabelConfig } = req.body;

        if (!siteIds || siteIds.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Mindestens eine Site erforderlich'
            });
        }

        const result = await ClientReportsService.generateMultiSiteReport(
            userId,
            siteIds,
            { format, period, whiteLabelConfig }
        );

        res.json(result);
    } catch (error) {
        console.error('Generate multi-site report error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/v1/reports
 * Holt alle Reports des Users
 */
router.get('/', async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        const limit = parseInt(req.query.limit) || 20;

        const result = await ClientReportsService.getUserReports(userId, limit);
        res.json(result);
    } catch (error) {
        console.error('Get reports error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/v1/reports/download/:reportId
 * Lädt einen Report herunter
 */
router.get('/download/:reportId', async (req, res) => {
    try {
        const { reportId } = req.params;
        const userId = req.user?.userId || req.user?.id;

        // Hole Report aus DB
        const { query } = require('../config/database');
        const result = await query(
            `SELECT * FROM client_reports WHERE id = $1 AND user_id = $2`,
            [reportId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Report nicht gefunden'
            });
        }

        const report = result.rows[0];

        if (!fs.existsSync(report.file_path)) {
            return res.status(404).json({
                success: false,
                error: 'Report-Datei nicht gefunden'
            });
        }

        const filename = path.basename(report.file_path);
        const contentType = report.file_format === 'pdf' 
            ? 'application/pdf' 
            : 'text/html';

        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        
        const fileStream = fs.createReadStream(report.file_path);
        fileStream.pipe(res);
    } catch (error) {
        console.error('Download report error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/v1/reports/schedule/:siteId
 * Plant einen wiederkehrenden Report
 */
router.post('/schedule/:siteId', async (req, res) => {
    try {
        const { siteId } = req.params;
        const userId = req.user?.userId || req.user?.id;
        const { frequency, email, format } = req.body;

        const result = await ClientReportsService.scheduleReport(
            userId,
            parseInt(siteId),
            { frequency, email, format }
        );

        res.json(result);
    } catch (error) {
        console.error('Schedule report error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/v1/reports/scheduled
 * Holt alle geplanten Reports
 */
router.get('/scheduled', async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        const { query } = require('../config/database');

        const result = await query(
            `SELECT sr.*, s.domain 
             FROM scheduled_reports sr
             JOIN sites s ON sr.site_id = s.id
             WHERE sr.user_id = $1 AND sr.is_active = true
             ORDER BY sr.created_at DESC`,
            [userId]
        );

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Get scheduled reports error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * DELETE /api/v1/reports/scheduled/:scheduleId
 * Löscht einen geplanten Report
 */
router.delete('/scheduled/:scheduleId', async (req, res) => {
    try {
        const { scheduleId } = req.params;
        const userId = req.user?.userId || req.user?.id;
        const { query } = require('../config/database');

        await query(
            `UPDATE scheduled_reports SET is_active = false 
             WHERE id = $1 AND user_id = $2`,
            [scheduleId, userId]
        );

        res.json({ success: true, message: 'Geplanter Report deaktiviert' });
    } catch (error) {
        console.error('Delete scheduled report error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;

