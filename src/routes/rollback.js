const express = require('express');
const router = express.Router();
const rollbackController = require('../controllers/rollbackController');
const { authenticateWordPressAPI } = require('../middleware/auth');

router.post('/notify', authenticateWordPressAPI, rollbackController.notify.bind(rollbackController));
router.post('/health-alert', authenticateWordPressAPI, rollbackController.healthAlert.bind(rollbackController));

module.exports = router;
