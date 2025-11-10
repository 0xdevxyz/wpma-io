const emailEncryptionService = require('./emailEncryptionService');
const nodemailer = require('nodemailer');

class EmailArchiveService {
  constructor() {
    // Email-Transporter konfigurieren
    this.emailTransporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  // Alle ausgehenden WPMA-Emails automatisch verschlüsselt speichern
  async archiveOutgoingEmail(userId, emailData) {
    try {
      await emailEncryptionService.storeEncryptedEmail(userId, {
        to: emailData.to,
        from: emailData.from || 'noreply@wpma.io',
        subject: emailData.subject,
        body: emailData.html || emailData.text,
        message_id: emailData.messageId,
        headers: emailData.headers
      }, 'notification');
      
      console.log(`Email archived for user ${userId}`);
    } catch (error) {
      console.error('Email archiving failed:', error);
    }
  }

  // Integration in bestehende Email-Services
  async sendAndArchiveEmail(userId, emailData) {
    try {
      // Email senden
      const result = await this.emailTransporter.sendMail(emailData);
      
      // Email archivieren
      await this.archiveOutgoingEmail(userId, emailData);
      
      return result;
    } catch (error) {
      console.error('Send and archive failed:', error);
      throw error;
    }
  }

  // Automatische Archivierung für verschiedene Email-Typen
  async archiveNotificationEmail(userId, notificationData) {
    const emailData = {
      to: notificationData.recipient,
      from: 'notifications@wpma.io',
      subject: notificationData.subject,
      body: notificationData.message,
      message_id: `notification_${Date.now()}_${userId}`,
      headers: {
        'X-WPMA-Type': 'notification',
        'X-WPMA-User-ID': userId.toString()
      }
    };

    return this.archiveOutgoingEmail(userId, emailData);
  }

  async archiveAlertEmail(userId, alertData) {
    const emailData = {
      to: alertData.recipient,
      from: 'alerts@wpma.io',
      subject: `[ALERT] ${alertData.subject}`,
      body: alertData.message,
      message_id: `alert_${Date.now()}_${userId}`,
      headers: {
        'X-WPMA-Type': 'alert',
        'X-WPMA-Severity': alertData.severity || 'medium',
        'X-WPMA-User-ID': userId.toString()
      }
    };

    return this.archiveOutgoingEmail(userId, emailData);
  }

  async archiveReportEmail(userId, reportData) {
    const emailData = {
      to: reportData.recipient,
      from: 'reports@wpma.io',
      subject: `[REPORT] ${reportData.subject}`,
      body: reportData.content,
      message_id: `report_${Date.now()}_${userId}`,
      headers: {
        'X-WPMA-Type': 'report',
        'X-WPMA-Report-Type': reportData.type || 'general',
        'X-WPMA-User-ID': userId.toString()
      }
    };

    return this.archiveOutgoingEmail(userId, emailData);
  }

  // Batch-Archivierung für mehrere Emails
  async archiveBatchEmails(userId, emailsData) {
    const archivePromises = emailsData.map(emailData => 
      this.archiveOutgoingEmail(userId, emailData)
    );

    try {
      await Promise.all(archivePromises);
      console.log(`Archived ${emailsData.length} emails for user ${userId}`);
    } catch (error) {
      console.error('Batch archiving failed:', error);
      throw error;
    }
  }

  // Archivierung mit Metadaten
  async archiveEmailWithMetadata(userId, emailData, metadata = {}) {
    const enrichedEmailData = {
      ...emailData,
      headers: {
        ...emailData.headers,
        'X-WPMA-Metadata': JSON.stringify(metadata),
        'X-WPMA-Archived-At': new Date().toISOString()
      }
    };

    return this.archiveOutgoingEmail(userId, enrichedEmailData);
  }

  // Archivierung für verschiedene Kontexte
  async archiveEmailForContext(userId, emailData, context = 'general') {
    const contextEmailData = {
      ...emailData,
      headers: {
        ...emailData.headers,
        'X-WPMA-Context': context,
        'X-WPMA-User-ID': userId.toString()
      }
    };

    return emailEncryptionService.storeEncryptedEmail(userId, contextEmailData, context);
  }
}

module.exports = new EmailArchiveService(); 