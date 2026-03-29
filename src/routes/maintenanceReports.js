const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const maintenanceReportsController = require('../controllers/maintenanceReportsController');

router.post('/maintenance/generate', authenticateToken, (req, res) => maintenanceReportsController.generateMaintenanceReport(req, res));
router.get('/maintenance/:siteId', authenticateToken, (req, res) => maintenanceReportsController.getMaintenanceReports(req, res));
router.get('/download/:filename', authenticateToken, (req, res) => maintenanceReportsController.downloadReport(req, res));
router.get('/scheduled', authenticateToken, (req, res) => maintenanceReportsController.getScheduledReports(req, res));
router.post('/schedule', authenticateToken, (req, res) => maintenanceReportsController.scheduleReport(req, res));
router.delete('/schedule/:siteId', authenticateToken, (req, res) => maintenanceReportsController.cancelSchedule(req, res));

module.exports = router;
