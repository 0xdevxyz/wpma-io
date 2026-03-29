'use strict';

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const agentController = require('../controllers/agentController');

router.get('/tasks', authenticateToken, agentController.getTasks.bind(agentController));
router.get('/stats', authenticateToken, agentController.getStats.bind(agentController));
router.get('/tasks/:id', authenticateToken, agentController.getTask.bind(agentController));
router.post('/tasks/:id/approve', authenticateToken, agentController.approveTask.bind(agentController));
router.post('/tasks/:id/reject', authenticateToken, agentController.rejectTask.bind(agentController));
router.post('/scan/:siteId', authenticateToken, agentController.scanSite.bind(agentController));
router.get('/settings', authenticateToken, agentController.getSettings.bind(agentController));
router.put('/settings', authenticateToken, agentController.saveSettings.bind(agentController));
router.post('/scan-all', authenticateToken, agentController.scanAllSites.bind(agentController));

module.exports = router;
