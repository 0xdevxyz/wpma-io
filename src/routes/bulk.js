/**
 * Bulk Actions Routes
 * API-Endpunkte für Massenaktionen auf mehreren Sites
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const BulkActionsService = require('../services/bulkActionsService');
const Joi = require('joi');

// Alle Routes benötigen Auth
router.use(authenticateToken);

// Validation Schemas
const bulkUpdateSchema = Joi.object({
    siteIds: Joi.array().items(Joi.number()).min(1).required(),
    updatePlugins: Joi.boolean().default(true),
    updateThemes: Joi.boolean().default(true),
    updateCore: Joi.boolean().default(false),
    createBackup: Joi.boolean().default(true),
    forceUpdate: Joi.boolean().default(false)
});

const bulkBackupSchema = Joi.object({
    siteIds: Joi.array().items(Joi.number()).min(1).required(),
    backupType: Joi.string().valid('full', 'database', 'files').default('full'),
    provider: Joi.string().valid('idrive_e2', 'aws', 'local').default('idrive_e2')
});

const bulkPluginSchema = Joi.object({
    siteIds: Joi.array().items(Joi.number()).min(1).required(),
    pluginSlug: Joi.string().required()
});

// Hilfsfunktion für Validation
const validate = (schema) => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                error: error.details[0].message
            });
        }
        req.body = value;
        next();
    };
};

// ==========================================
// BULK UPDATE ENDPOINTS
// ==========================================

/**
 * POST /api/v1/bulk/updates
 * Startet Bulk-Update für mehrere Sites
 */
router.post('/updates', validate(bulkUpdateSchema), async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        const { siteIds, updatePlugins, updateThemes, updateCore, createBackup, forceUpdate } = req.body;

        const result = await BulkActionsService.bulkUpdate(userId, siteIds, {
            updatePlugins,
            updateThemes,
            updateCore,
            createBackup,
            forceUpdate
        });

        res.json(result);
    } catch (error) {
        console.error('Bulk update error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/v1/bulk/updates/summary
 * Holt Übersicht aller verfügbaren Updates
 */
router.get('/updates/summary', async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        const result = await BulkActionsService.getUpdatesSummary(userId);
        res.json(result);
    } catch (error) {
        console.error('Get updates summary error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================
// BULK BACKUP ENDPOINTS
// ==========================================

/**
 * POST /api/v1/bulk/backups
 * Startet Bulk-Backup für mehrere Sites
 */
router.post('/backups', validate(bulkBackupSchema), async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        const { siteIds, backupType, provider } = req.body;

        const result = await BulkActionsService.bulkBackup(userId, siteIds, {
            backupType,
            provider
        });

        res.json(result);
    } catch (error) {
        console.error('Bulk backup error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================
// BULK PLUGIN MANAGEMENT
// ==========================================

/**
 * POST /api/v1/bulk/plugins/install
 * Installiert ein Plugin auf mehreren Sites
 */
router.post('/plugins/install', validate(bulkPluginSchema), async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        const { siteIds, pluginSlug } = req.body;

        const result = await BulkActionsService.bulkInstallPlugin(userId, siteIds, pluginSlug);
        res.json(result);
    } catch (error) {
        console.error('Bulk install plugin error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/v1/bulk/plugins/deactivate
 * Deaktiviert ein Plugin auf mehreren Sites
 */
router.post('/plugins/deactivate', validate(bulkPluginSchema), async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        const { siteIds, pluginSlug } = req.body;

        const result = await BulkActionsService.bulkDeactivatePlugin(userId, siteIds, pluginSlug);
        res.json(result);
    } catch (error) {
        console.error('Bulk deactivate plugin error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================
// BULK SECURITY
// ==========================================

/**
 * POST /api/v1/bulk/security/scan
 * Startet Security-Scan auf mehreren Sites
 */
router.post('/security/scan', async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        const { siteIds } = req.body;

        if (!siteIds || siteIds.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Mindestens eine Site erforderlich'
            });
        }

        const result = await BulkActionsService.bulkSecurityScan(userId, siteIds);
        res.json(result);
    } catch (error) {
        console.error('Bulk security scan error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================
// JOB MANAGEMENT
// ==========================================

/**
 * GET /api/v1/bulk/jobs
 * Holt alle Jobs des Users
 */
router.get('/jobs', async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        const limit = parseInt(req.query.limit) || 20;

        const result = await BulkActionsService.getUserJobs(userId, limit);
        res.json(result);
    } catch (error) {
        console.error('Get jobs error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/v1/bulk/jobs/:jobId
 * Holt Status eines bestimmten Jobs
 */
router.get('/jobs/:jobId', async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        const { jobId } = req.params;

        const result = await BulkActionsService.getJobStatus(jobId, userId);
        res.json(result);
    } catch (error) {
        console.error('Get job status error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * DELETE /api/v1/bulk/jobs/:jobId
 * Bricht einen laufenden Job ab
 */
router.delete('/jobs/:jobId', async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        const { jobId } = req.params;

        const result = await BulkActionsService.cancelJob(jobId, userId);
        res.json(result);
    } catch (error) {
        console.error('Cancel job error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;

