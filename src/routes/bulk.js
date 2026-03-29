const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const bulkController = require('../controllers/bulkController');
const Joi = require('joi');

router.use(authenticateToken);

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

router.post('/updates', validate(bulkUpdateSchema), bulkController.bulkUpdate.bind(bulkController));
router.get('/updates/summary', bulkController.getUpdatesSummary.bind(bulkController));
router.post('/backups', validate(bulkBackupSchema), bulkController.bulkBackup.bind(bulkController));
router.post('/plugins/install', validate(bulkPluginSchema), bulkController.bulkInstallPlugin.bind(bulkController));
router.post('/plugins/deactivate', validate(bulkPluginSchema), bulkController.bulkDeactivatePlugin.bind(bulkController));
router.post('/security/scan', bulkController.bulkSecurityScan.bind(bulkController));
router.get('/jobs', bulkController.getJobs.bind(bulkController));
router.get('/jobs/:jobId', bulkController.getJobStatus.bind(bulkController));
router.delete('/jobs/:jobId', bulkController.cancelJob.bind(bulkController));

module.exports = router;
