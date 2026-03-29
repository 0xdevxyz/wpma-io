const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const reportsController = require('../controllers/reportsController');

router.use(authenticateToken);

router.post('/generate/:siteId', (req, res) => reportsController.generateSiteReport(req, res));
router.post('/generate-multi', (req, res) => reportsController.generateMultiSiteReport(req, res));
router.get('/', (req, res) => reportsController.getUserReports(req, res));
router.get('/download/:reportId', (req, res) => reportsController.downloadReport(req, res));
router.post('/schedule/:siteId', (req, res) => reportsController.scheduleReport(req, res));
router.get('/scheduled', (req, res) => reportsController.getScheduledReports(req, res));
router.delete('/scheduled/:scheduleId', (req, res) => reportsController.deleteScheduledReport(req, res));

module.exports = router;
