const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const linksController = require('../controllers/linksController');

const router = express.Router();

router.post('/:siteId/scan', authenticateToken, (req, res) => linksController.startScan(req, res));
router.get('/:siteId/latest', authenticateToken, (req, res) => linksController.getLatest(req, res));
router.get('/:siteId/history', authenticateToken, (req, res) => linksController.getHistory(req, res));

module.exports = router;
