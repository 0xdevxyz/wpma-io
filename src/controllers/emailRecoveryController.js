const emailEncryptionService = require('../services/emailEncryptionService');
const rateLimit = require('express-rate-limit');
const db = require('../config/database');

// Rate Limiting für sensible Operationen
const recoveryRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 Stunde
  max: 3, // Max 3 Versuche pro Stunde
  message: { error: 'Too many recovery attempts, try again later' }
});

class EmailRecoveryController {
  async getUserEmails(req, res) {
    try {
      const { context, limit = 50 } = req.query;
      const userId = req.user.id;
      
      const emails = await emailEncryptionService.retrieveUserEmails(
        userId,
        context,
        Math.min(limit, 100)
      );
      
      res.json({
        success: true,
        data: emails,
        total: emails.length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async exportEmails(req, res) {
    try {
      const { password } = req.body;
      const userId = req.user.id;
      
      if (!password) {
        return res.status(400).json({
          success: false,
          error: 'Password required for email export'
        });
      }
      
      const exportResult = await emailEncryptionService.exportUserEmailsForRecovery(
        userId,
        password
      );
      
      res.json({
        success: true,
        data: exportResult,
        message: 'Email export created successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async importEmails(req, res) {
    try {
      const { export_id, password, target_user_id } = req.body;
      
      if (!export_id || !password) {
        return res.status(400).json({
          success: false,
          error: 'Export ID and password required'
        });
      }
      
      const importResult = await emailEncryptionService.importRecoveryEmails(
        export_id,
        password,
        target_user_id
      );
      
      res.json({
        success: true,
        data: importResult,
        message: 'Emails imported successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async downloadRecoveryFile(req, res) {
    try {
      const { export_id } = req.params;
      const userId = req.user.id;
      
      // Überprüfen ob Export dem User gehört
      const query = `
        SELECT encrypted_data, iv, auth_tag, expires_at, downloaded
        FROM email_recovery_exports
        WHERE id = $1 AND user_id = $2
      `;
      
      const result = await db.query(query, [export_id, userId]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Recovery export not found'
        });
      }
      
      const exportData = result.rows[0];
      
      if (new Date() > exportData.expires_at) {
        return res.status(410).json({
          success: false,
          error: 'Recovery export has expired'
        });
      }
      
      // Recovery-Datei als Download bereitstellen
      const recoveryPackage = {
        export_id: export_id,
        encrypted_data: exportData.encrypted_data,
        iv: exportData.iv,
        auth_tag: exportData.auth_tag,
        instructions: {
          en: 'Use WPMA recovery tool or API to import these emails',
          de: 'Verwenden Sie das WPMA Recovery-Tool oder API um diese Emails zu importieren'
        }
      };
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=wpma-email-recovery-${export_id}.json`);
      res.send(JSON.stringify(recoveryPackage, null, 2));
      
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async getRecoveryStatus(req, res) {
    try {
      const userId = req.user.id;
      
      // Aktive Recovery-Exports abrufen
      const query = `
        SELECT id, created_at, expires_at, downloaded
        FROM email_recovery_exports
        WHERE user_id = $1 AND expires_at > NOW()
        ORDER BY created_at DESC
      `;
      
      const result = await db.query(query, [userId]);
      
      // Email-Statistiken abrufen
      const statsQuery = `
        SELECT 
          COUNT(*) as total_emails,
          COUNT(*) FILTER (WHERE context = 'notification') as notification_emails,
          COUNT(*) FILTER (WHERE context = 'alert') as alert_emails,
          COUNT(*) FILTER (WHERE context = 'recovered') as recovered_emails
        FROM encrypted_emails
        WHERE user_id = $1 AND expires_at > NOW()
      `;
      
      const statsResult = await db.query(statsQuery, [userId]);
      
      res.json({
        success: true,
        data: {
          active_exports: result.rows,
          email_stats: statsResult.rows[0]
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = new EmailRecoveryController(); 