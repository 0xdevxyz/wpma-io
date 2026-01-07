/**
 * Staging & Cloning Routes
 * API-Endpunkte für Staging-Umgebungen, Site-Klonen und Migration
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const StagingService = require('../services/stagingService');

router.use(authenticateToken);

// ==========================================
// STAGING ENVIRONMENT ENDPOINTS
// ==========================================

/**
 * POST /api/v1/staging/:siteId/create
 * Erstellt eine neue Staging-Umgebung
 */
router.post('/:siteId/create', async (req, res) => {
    try {
        const { siteId } = req.params;
        const userId = req.user?.userId || req.user?.id;
        const options = req.body;

        const result = await StagingService.createStagingEnvironment(
            parseInt(siteId), 
            userId, 
            options
        );
        res.json(result);
    } catch (error) {
        console.error('Create staging error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/v1/staging
 * Holt alle Staging-Umgebungen des Users
 */
router.get('/', async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        const { siteId } = req.query;

        const result = await StagingService.getStagingEnvironments(
            userId, 
            siteId ? parseInt(siteId) : null
        );
        res.json(result);
    } catch (error) {
        console.error('Get staging environments error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * DELETE /api/v1/staging/:stagingId
 * Löscht eine Staging-Umgebung
 */
router.delete('/:stagingId', async (req, res) => {
    try {
        const { stagingId } = req.params;
        const userId = req.user?.userId || req.user?.id;

        const result = await StagingService.deleteStagingEnvironment(
            parseInt(stagingId), 
            userId
        );
        res.json(result);
    } catch (error) {
        console.error('Delete staging error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================
// PUSH / PULL ENDPOINTS
// ==========================================

/**
 * POST /api/v1/staging/:stagingId/push
 * Push: Staging → Live
 */
router.post('/:stagingId/push', async (req, res) => {
    try {
        const { stagingId } = req.params;
        const userId = req.user?.userId || req.user?.id;
        const options = req.body;

        const result = await StagingService.pushStagingToLive(
            parseInt(stagingId), 
            userId, 
            options
        );
        res.json(result);
    } catch (error) {
        console.error('Push staging to live error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/v1/staging/:stagingId/pull
 * Pull: Live → Staging
 */
router.post('/:stagingId/pull', async (req, res) => {
    try {
        const { stagingId } = req.params;
        const userId = req.user?.userId || req.user?.id;
        const options = req.body;

        const result = await StagingService.pullLiveToStaging(
            parseInt(stagingId), 
            userId, 
            options
        );
        res.json(result);
    } catch (error) {
        console.error('Pull live to staging error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/v1/staging/sync-job/:jobId
 * Holt den Status eines Sync-Jobs
 */
router.get('/sync-job/:jobId', async (req, res) => {
    try {
        const { jobId } = req.params;
        const userId = req.user?.userId || req.user?.id;

        const result = await StagingService.getSyncJobStatus(parseInt(jobId), userId);
        res.json(result);
    } catch (error) {
        console.error('Get sync job status error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================
// CLONE ENDPOINTS
// ==========================================

/**
 * POST /api/v1/staging/:siteId/clone
 * Klont eine Site auf eine neue Domain
 */
router.post('/:siteId/clone', async (req, res) => {
    try {
        const { siteId } = req.params;
        const userId = req.user?.userId || req.user?.id;
        const { targetDomain, includeUploads, useExistingBackup } = req.body;

        if (!targetDomain) {
            return res.status(400).json({
                success: false,
                error: 'Ziel-Domain erforderlich'
            });
        }

        const result = await StagingService.cloneSite(
            parseInt(siteId), 
            userId, 
            targetDomain,
            { includeUploads, useExistingBackup }
        );
        res.json(result);
    } catch (error) {
        console.error('Clone site error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/v1/staging/clone-job/:jobId
 * Holt den Status eines Clone-Jobs
 */
router.get('/clone-job/:jobId', async (req, res) => {
    try {
        const { jobId } = req.params;
        const userId = req.user?.userId || req.user?.id;

        const result = await StagingService.getCloneJobStatus(parseInt(jobId), userId);
        res.json(result);
    } catch (error) {
        console.error('Get clone job status error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================
// MIGRATION ENDPOINTS
// ==========================================

/**
 * POST /api/v1/staging/:siteId/migrate
 * Startet eine Site-Migration
 */
router.post('/:siteId/migrate', async (req, res) => {
    try {
        const { siteId } = req.params;
        const userId = req.user?.userId || req.user?.id;
        const migrationConfig = req.body;

        if (!migrationConfig.targetUrl) {
            return res.status(400).json({
                success: false,
                error: 'Ziel-URL erforderlich'
            });
        }

        const result = await StagingService.migrateSite(
            parseInt(siteId), 
            userId, 
            migrationConfig
        );
        res.json(result);
    } catch (error) {
        console.error('Migrate site error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/v1/staging/migration-job/:jobId
 * Holt den Status eines Migration-Jobs
 */
router.get('/migration-job/:jobId', async (req, res) => {
    try {
        const { jobId } = req.params;
        const userId = req.user?.userId || req.user?.id;

        const result = await StagingService.getMigrationJobStatus(parseInt(jobId), userId);
        res.json(result);
    } catch (error) {
        console.error('Get migration job status error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;

