const BulkActionsService = require('../services/bulkActionsService');

class BulkController {
    async bulkUpdate(req, res) {
        try {
            const userId = req.user?.userId;
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
    }

    async getUpdatesSummary(req, res) {
        try {
            const userId = req.user?.userId;
            const result = await BulkActionsService.getUpdatesSummary(userId);
            res.json(result);
        } catch (error) {
            console.error('Get updates summary error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async bulkBackup(req, res) {
        try {
            const userId = req.user?.userId;
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
    }

    async bulkInstallPlugin(req, res) {
        try {
            const userId = req.user?.userId;
            const { siteIds, pluginSlug } = req.body;

            const result = await BulkActionsService.bulkInstallPlugin(userId, siteIds, pluginSlug);
            res.json(result);
        } catch (error) {
            console.error('Bulk install plugin error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async bulkDeactivatePlugin(req, res) {
        try {
            const userId = req.user?.userId;
            const { siteIds, pluginSlug } = req.body;

            const result = await BulkActionsService.bulkDeactivatePlugin(userId, siteIds, pluginSlug);
            res.json(result);
        } catch (error) {
            console.error('Bulk deactivate plugin error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async bulkSecurityScan(req, res) {
        try {
            const userId = req.user?.userId;
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
    }

    async getJobs(req, res) {
        try {
            const userId = req.user?.userId;
            const limit = parseInt(req.query.limit) || 20;

            const result = await BulkActionsService.getUserJobs(userId, limit);
            res.json(result);
        } catch (error) {
            console.error('Get jobs error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async getJobStatus(req, res) {
        try {
            const userId = req.user?.userId;
            const { jobId } = req.params;

            const result = await BulkActionsService.getJobStatus(jobId, userId);
            res.json(result);
        } catch (error) {
            console.error('Get job status error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async cancelJob(req, res) {
        try {
            const userId = req.user?.userId;
            const { jobId } = req.params;

            const result = await BulkActionsService.cancelJob(jobId, userId);
            res.json(result);
        } catch (error) {
            console.error('Cancel job error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
}

module.exports = new BulkController();
