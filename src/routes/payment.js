const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authenticateToken } = require('../middleware/auth');

router.post('/webhook', paymentController.webhook.bind(paymentController));
router.post('/subscribe', authenticateToken, paymentController.subscribe.bind(paymentController));
router.post('/cancel', authenticateToken, paymentController.cancel.bind(paymentController));
router.put('/update', authenticateToken, paymentController.update.bind(paymentController));
router.get('/status', authenticateToken, paymentController.status.bind(paymentController));

module.exports = router;
