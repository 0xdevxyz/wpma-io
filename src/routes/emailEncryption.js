const express = require('express');
const router = express.Router();
const emailEncryptionController = require('../controllers/emailEncryptionController');
const { authenticateToken } = require('../middleware/auth');

// 🔐 Email-Verschlüsselung Routes

// Email verschlüsseln
router.post('/encrypt', authenticateToken, emailEncryptionController.encryptEmail);

// Email entschlüsseln
router.get('/decrypt/:emailId', authenticateToken, emailEncryptionController.decryptEmail);

// Email-Liste abrufen
router.get('/list', authenticateToken, emailEncryptionController.listEmails);

// Verschlüsselungs-Statistiken
router.get('/stats', authenticateToken, emailEncryptionController.getEncryptionStats);

// Email löschen (GDPR-konform)
router.delete('/:emailId', authenticateToken, emailEncryptionController.deleteEmail);

// 🔄 Recovery Routes (Admin-only)

// Einzelne Email wiederherstellen
router.post('/recover/:emailId', authenticateToken, emailEncryptionController.recoverEmail);

// Batch-Wiederherstellung
router.post('/batch-recover', authenticateToken, emailEncryptionController.batchRecoverEmails);

// 🛡️ Admin Routes

// Sicherheits-Audit
router.get('/security-audit', authenticateToken, emailEncryptionController.securityAudit);

// Recovery-Keys rotieren
router.post('/rotate-keys', authenticateToken, emailEncryptionController.rotateRecoveryKeys);

// Audit-Logs abrufen
router.get('/audit-logs', authenticateToken, emailEncryptionController.getAuditLogs);

module.exports = router; 