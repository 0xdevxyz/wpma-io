const emailEncryptionService = require('../services/emailEncryptionService');
const { ValidationError, AuthorizationError } = require('../utils/errors');

class EmailEncryptionController {
  // 🔐 Email verschlüsseln
  async encryptEmail(req, res) {
    try {
      const { from, to, subject, body, attachments, retentionDays } = req.body;
      const userId = req.user.id;

      // Validierung
      if (!from || !to || !subject || !body) {
        throw new ValidationError('Alle Pflichtfelder müssen ausgefüllt werden');
      }

      const emailData = {
        from,
        to,
        subject,
        body,
        attachments: attachments || []
      };

      const metadata = {
        retentionDays: retentionDays || 365,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        source: 'api'
      };

      const result = await emailEncryptionService.encryptEmail(emailData, userId, metadata);

      if (result.success) {
        res.status(201).json({
          success: true,
          message: result.message,
          emailId: result.emailId,
          data: {
            id: result.emailId,
            encryptedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + (retentionDays || 365) * 24 * 60 * 60 * 1000).toISOString()
          }
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error
        });
      }

    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({
          success: false,
          error: error.message
        });
      } else {
        console.error('Email-Verschlüsselung Controller Error:', error);
        res.status(500).json({
          success: false,
          error: 'Email-Verschlüsselung fehlgeschlagen'
        });
      }
    }
  }

  // 🔓 Email entschlüsseln
  async decryptEmail(req, res) {
    try {
      const { emailId } = req.params;
      const userId = req.user.id;
      const { accessReason } = req.body;

      if (!emailId) {
        throw new ValidationError('Email-ID ist erforderlich');
      }

      const result = await emailEncryptionService.decryptEmail(
        emailId, 
        userId, 
        accessReason || 'normal_access'
      );

      if (result.success) {
        res.json({
          success: true,
          data: {
            email: result.email,
            metadata: result.metadata
          }
        });
      } else {
        res.status(404).json({
          success: false,
          error: result.error
        });
      }

    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({
          success: false,
          error: error.message
        });
      } else {
        console.error('Email-Entschlüsselung Controller Error:', error);
        res.status(500).json({
          success: false,
          error: 'Email-Entschlüsselung fehlgeschlagen'
        });
      }
    }
  }

  // 🔄 Email wiederherstellen (Admin-only)
  async recoverEmail(req, res) {
    try {
      const { emailId } = req.params;
      const { recoveryScenario, adminCredentials } = req.body;

      // Admin-Berechtigung prüfen
      if (!req.user.isAdmin) {
        throw new AuthorizationError('Admin-Berechtigung erforderlich');
      }

      if (!emailId || !recoveryScenario || !adminCredentials) {
        throw new ValidationError('Email-ID, Recovery-Szenario und Admin-Berechtigung erforderlich');
      }

      const result = await emailEncryptionService.recoverEmail(
        emailId,
        recoveryScenario,
        adminCredentials
      );

      if (result.success) {
        res.json({
          success: true,
          data: {
            email: result.email,
            recoveryInfo: result.recoveryInfo
          }
        });
      } else {
        res.status(404).json({
          success: false,
          error: result.error
        });
      }

    } catch (error) {
      if (error instanceof ValidationError || error instanceof AuthorizationError) {
        res.status(400).json({
          success: false,
          error: error.message
        });
      } else {
        console.error('Email-Wiederherstellung Controller Error:', error);
        res.status(500).json({
          success: false,
          error: 'Email-Wiederherstellung fehlgeschlagen'
        });
      }
    }
  }

  // 🗂️ Batch-Wiederherstellung (Admin-only)
  async batchRecoverEmails(req, res) {
    try {
      const { userId, dateRange, recoveryScenario, adminCredentials } = req.body;

      // Admin-Berechtigung prüfen
      if (!req.user.isAdmin) {
        throw new AuthorizationError('Admin-Berechtigung erforderlich');
      }

      if (!userId || !dateRange || !recoveryScenario || !adminCredentials) {
        throw new ValidationError('Alle Parameter für Batch-Wiederherstellung erforderlich');
      }

      const result = await emailEncryptionService.batchRecoverEmails(
        userId,
        dateRange,
        recoveryScenario,
        adminCredentials
      );

      if (result.success) {
        res.json({
          success: true,
          data: {
            recoveredCount: result.recoveredCount,
            totalCount: result.totalCount,
            emails: result.emails,
            recoveryInfo: result.recoveryInfo
          }
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error
        });
      }

    } catch (error) {
      if (error instanceof ValidationError || error instanceof AuthorizationError) {
        res.status(400).json({
          success: false,
          error: error.message
        });
      } else {
        console.error('Batch-Wiederherstellung Controller Error:', error);
        res.status(500).json({
          success: false,
          error: 'Batch-Wiederherstellung fehlgeschlagen'
        });
      }
    }
  }

  // 🗑️ Email löschen (GDPR-konform)
  async deleteEmail(req, res) {
    try {
      const { emailId } = req.params;
      const userId = req.user.id;
      const { reason } = req.body;

      if (!emailId) {
        throw new ValidationError('Email-ID ist erforderlich');
      }

      const result = await emailEncryptionService.deleteEmail(
        emailId,
        userId,
        reason || 'user_request'
      );

      if (result.success) {
        res.json({
          success: true,
          message: result.message
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error
        });
      }

    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({
          success: false,
          error: error.message
        });
      } else {
        console.error('Email-Löschung Controller Error:', error);
        res.status(500).json({
          success: false,
          error: 'Email-Löschung fehlgeschlagen'
        });
      }
    }
  }

  // 📊 Verschlüsselungs-Statistiken
  async getEncryptionStats(req, res) {
    try {
      const userId = req.user.id;

      const stats = await emailEncryptionService.getEncryptionStats(userId);

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      console.error('Statistiken Controller Error:', error);
      res.status(500).json({
        success: false,
        error: 'Statistiken konnten nicht abgerufen werden'
      });
    }
  }

  // 🛡️ Sicherheits-Audit (Admin-only)
  async securityAudit(req, res) {
    try {
      // Admin-Berechtigung prüfen
      if (!req.user.isAdmin) {
        throw new AuthorizationError('Admin-Berechtigung erforderlich');
      }

      const audit = await emailEncryptionService.securityAudit();

      res.json({
        success: true,
        data: audit
      });

    } catch (error) {
      if (error instanceof AuthorizationError) {
        res.status(403).json({
          success: false,
          error: error.message
        });
      } else {
        console.error('Sicherheits-Audit Controller Error:', error);
        res.status(500).json({
          success: false,
          error: 'Sicherheits-Audit fehlgeschlagen'
        });
      }
    }
  }

  // 🔑 Recovery-Keys rotieren (Admin-only)
  async rotateRecoveryKeys(req, res) {
    try {
      // Admin-Berechtigung prüfen
      if (!req.user.isAdmin) {
        throw new AuthorizationError('Admin-Berechtigung erforderlich');
      }

      await emailEncryptionService.rotateRecoveryKeys();

      res.json({
        success: true,
        message: 'Recovery-Keys erfolgreich rotiert'
      });

    } catch (error) {
      if (error instanceof AuthorizationError) {
        res.status(403).json({
          success: false,
          error: error.message
        });
      } else {
        console.error('Recovery-Keys Rotation Controller Error:', error);
        res.status(500).json({
          success: false,
          error: 'Recovery-Keys Rotation fehlgeschlagen'
        });
      }
    }
  }

  // 📋 Email-Liste abrufen
  async listEmails(req, res) {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 20, status } = req.query;

      // Hier würde eine echte Implementierung stehen
      // Für jetzt geben wir Mock-Daten zurück
      const emails = [
        {
          id: 'email_1234567890_abc123',
          subject: 'Verschlüsselte Email',
          from: 'sender@example.com',
          to: 'recipient@example.com',
          encryptedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'active'
        }
      ];

      res.json({
        success: true,
        data: {
          emails,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: emails.length
          }
        }
      });

    } catch (error) {
      console.error('Email-Liste Controller Error:', error);
      res.status(500).json({
        success: false,
        error: 'Email-Liste konnte nicht abgerufen werden'
      });
    }
  }

  // 🔍 Audit-Logs abrufen (Admin-only)
  async getAuditLogs(req, res) {
    try {
      // Admin-Berechtigung prüfen
      if (!req.user.isAdmin) {
        throw new AuthorizationError('Admin-Berechtigung erforderlich');
      }

      const { userId, action, startDate, endDate, page = 1, limit = 50 } = req.query;

      // Hier würde eine echte Implementierung stehen
      const logs = [
        {
          id: 1,
          emailId: 'email_1234567890_abc123',
          userId: userId || 'user123',
          action: action || 'encrypt',
          timestamp: new Date().toISOString(),
          metadata: {
            ipAddress: '192.168.1.1',
            userAgent: 'Mozilla/5.0...'
          }
        }
      ];

      res.json({
        success: true,
        data: {
          logs,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: logs.length
          }
        }
      });

    } catch (error) {
      if (error instanceof AuthorizationError) {
        res.status(403).json({
          success: false,
          error: error.message
        });
      } else {
        console.error('Audit-Logs Controller Error:', error);
        res.status(500).json({
          success: false,
          error: 'Audit-Logs konnten nicht abgerufen werden'
        });
      }
    }
  }
}

module.exports = new EmailEncryptionController(); 