const express = require('express');
const router = express.Router();
const emailRecoveryController = require('../controllers/emailRecoveryController');
const { authenticateToken } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

// Rate Limiting für sensible Operationen
const recoveryRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 Stunde
  max: 3, // Max 3 Versuche pro Stunde
  message: { error: 'Too many recovery attempts, try again later' }
});

// Gespeicherte Emails abrufen
router.get('/emails', authenticateToken, emailRecoveryController.getUserEmails);

// Email-Export erstellen
router.post('/export', authenticateToken, recoveryRateLimit, emailRecoveryController.exportEmails);

// Email-Import
router.post('/import', authenticateToken, recoveryRateLimit, emailRecoveryController.importEmails);

// Recovery-Datei download
router.get('/download/:export_id', authenticateToken, emailRecoveryController.downloadRecoveryFile);

// Recovery-Status
router.get('/status', authenticateToken, emailRecoveryController.getRecoveryStatus);

module.exports = router; 