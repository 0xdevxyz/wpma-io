const StagingService = require('../services/stagingService');

class StagingController {
    async createStagingEnvironment(req, res) {
        try {
            const { siteId } = req.params;
            const userId = req.user?.userId;
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
    }

    async getStagingEnvironments(req, res) {
        try {
            const userId = req.user?.userId;
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
    }

    async deleteStagingEnvironment(req, res) {
        try {
            const { stagingId } = req.params;
            const userId = req.user?.userId;

            const result = await StagingService.deleteStagingEnvironment(
                parseInt(stagingId),
                userId
            );
            res.json(result);
        } catch (error) {
            console.error('Delete staging error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async pushStagingToLive(req, res) {
        try {
            const { stagingId } = req.params;
            const userId = req.user?.userId;
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
    }

    async pullLiveToStaging(req, res) {
        try {
            const { stagingId } = req.params;
            const userId = req.user?.userId;
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
    }

    async getSyncJobStatus(req, res) {
        try {
            const { jobId } = req.params;
            const userId = req.user?.userId;

            const result = await StagingService.getSyncJobStatus(parseInt(jobId), userId);
            res.json(result);
        } catch (error) {
            console.error('Get sync job status error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async cloneSite(req, res) {
        try {
            const { siteId } = req.params;
            const userId = req.user?.userId;
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
    }

    async getCloneJobStatus(req, res) {
        try {
            const { jobId } = req.params;
            const userId = req.user?.userId;

            const result = await StagingService.getCloneJobStatus(parseInt(jobId), userId);
            res.json(result);
        } catch (error) {
            console.error('Get clone job status error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async migrateSite(req, res) {
        try {
            const { siteId } = req.params;
            const userId = req.user?.userId;
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
    }

    async getMigrationJobStatus(req, res) {
        try {
            const { jobId } = req.params;
            const userId = req.user?.userId;

            const result = await StagingService.getMigrationJobStatus(parseInt(jobId), userId);
            res.json(result);
        } catch (error) {
            console.error('Get migration job status error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
}

module.exports = new StagingController();
