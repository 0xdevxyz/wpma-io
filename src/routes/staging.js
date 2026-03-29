const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const stagingController = require('../controllers/stagingController');

router.use(authenticateToken);

router.post('/:siteId/create', stagingController.createStagingEnvironment.bind(stagingController));
router.get('/', stagingController.getStagingEnvironments.bind(stagingController));
router.delete('/:stagingId', stagingController.deleteStagingEnvironment.bind(stagingController));
router.post('/:stagingId/push', stagingController.pushStagingToLive.bind(stagingController));
router.post('/:stagingId/pull', stagingController.pullLiveToStaging.bind(stagingController));
router.get('/sync-job/:jobId', stagingController.getSyncJobStatus.bind(stagingController));
router.post('/:siteId/clone', stagingController.cloneSite.bind(stagingController));
router.get('/clone-job/:jobId', stagingController.getCloneJobStatus.bind(stagingController));
router.post('/:siteId/migrate', stagingController.migrateSite.bind(stagingController));
router.get('/migration-job/:jobId', stagingController.getMigrationJobStatus.bind(stagingController));

module.exports = router;
