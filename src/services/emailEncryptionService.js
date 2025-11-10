const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const fs = require('fs').promises;
const path = require('path');
const AWS = require('aws-sdk');
const db = require('../config/database');

class EmailEncryptionService {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.keyLength = 32;
    this.ivLength = 16;
    this.saltLength = 64;
    this.tagLength = 16;
    this.iterations = 100000;
    
    // AWS S3 für Backup konfigurieren
    if (process.env.AWS_ACCESS_KEY_ID) {
      this.s3 = new AWS.S3({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION || 'eu-central-1'
      });
    }
  }

  // Master-Key aus Environment + User-spezifischem Salt generieren
  generateMasterKey(userSalt) {
    const masterSecret = process.env.EMAIL_MASTER_SECRET;
    if (!masterSecret) {
      throw new Error('EMAIL_MASTER_SECRET not configured');
    }
    
    return crypto.pbkdf2Sync(
      masterSecret + userSalt,
      process.env.EMAIL_ENCRYPTION_SALT || 'wpma-email-salt',
      this.iterations,
      this.keyLength,
      'sha512'
    );
  }

  // Email verschlüsseln
  encryptEmail(emailData, userId) {
    try {
      const userSalt = this.getUserSalt(userId);
      const masterKey = this.generateMasterKey(userSalt);
      
      // Zufälligen IV generieren
      const iv = crypto.randomBytes(this.ivLength);
      
      // Cipher erstellen
      const cipher = crypto.createCipher(this.algorithm, masterKey, { iv });
      
      // Email-Daten serialisieren
      const emailJson = JSON.stringify({
        to: emailData.to,
        from: emailData.from,
        subject: emailData.subject,
        body: emailData.body,
        attachments: emailData.attachments || [],
        headers: emailData.headers || {},
        timestamp: new Date().toISOString(),
        message_id: emailData.message_id
      });
      
      // Verschlüsseln
      let encrypted = cipher.update(emailJson, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Auth-Tag abrufen
      const authTag = cipher.getAuthTag();
      
      return {
        encrypted_data: encrypted,
        iv: iv.toString('hex'),
        auth_tag: authTag.toString('hex'),
        encryption_version: '1.0'
      };
    } catch (error) {
      console.error('Email encryption failed:', error);
      throw new Error('Email encryption failed');
    }
  }

  // Email entschlüsseln
  decryptEmail(encryptedEmail, userId) {
    try {
      const userSalt = this.getUserSalt(userId);
      const masterKey = this.generateMasterKey(userSalt);
      
      // IV und Auth-Tag aus Hex konvertieren
      const iv = Buffer.from(encryptedEmail.iv, 'hex');
      const authTag = Buffer.from(encryptedEmail.auth_tag, 'hex');
      
      // Decipher erstellen
      const decipher = crypto.createDecipher(this.algorithm, masterKey, { iv });
      decipher.setAuthTag(authTag);
      
      // Entschlüsseln
      let decrypted = decipher.update(encryptedEmail.encrypted_data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return JSON.parse(decrypted);
    } catch (error) {
      console.error('Email decryption failed:', error);
      throw new Error('Email decryption failed');
    }
  }

  // User-Salt generieren/abrufen
  async getUserSalt(userId) {
    const query = 'SELECT email_salt FROM users WHERE id = $1';
    const result = await db.query(query, [userId]);
    
    if (result.rows.length === 0) {
      throw new Error('User not found');
    }
    
    let salt = result.rows[0].email_salt;
    
    // Salt generieren wenn noch nicht vorhanden
    if (!salt) {
      salt = crypto.randomBytes(this.saltLength).toString('hex');
      await db.query(
        'UPDATE users SET email_salt = $1 WHERE id = $2',
        [salt, userId]
      );
    }
    
    return salt;
  }

  // Email sicher speichern
  async storeEncryptedEmail(userId, emailData, context = 'notification') {
    try {
      const encryptedEmail = this.encryptEmail(emailData, userId);
      
      const query = `
        INSERT INTO encrypted_emails (
          user_id, context, encrypted_data, iv, auth_tag, encryption_version, created_at, expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `;
      
      // Ablaufzeit: 1 Jahr für wichtige Benachrichtigungen
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      
      const result = await db.query(query, [
        userId,
        context,
        encryptedEmail.encrypted_data,
        encryptedEmail.iv,
        encryptedEmail.auth_tag,
        encryptedEmail.encryption_version,
        new Date(),
        expiresAt
      ]);
      
      return result.rows[0].id;
    } catch (error) {
      console.error('Email storage failed:', error);
      throw new Error('Email storage failed');
    }
  }

  // Gespeicherte Emails abrufen
  async retrieveUserEmails(userId, context = null, limit = 100) {
    try {
      let query = `
        SELECT id, context, encrypted_data, iv, auth_tag, encryption_version, created_at
        FROM encrypted_emails
        WHERE user_id = $1 AND expires_at > NOW()
      `;
      let params = [userId];
      
      if (context) {
        query += ' AND context = $2';
        params.push(context);
      }
      
      query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1);
      params.push(limit);
      
      const result = await db.query(query, params);
      
      // Emails entschlüsseln
      const decryptedEmails = [];
      for (const row of result.rows) {
        try {
          const decryptedEmail = this.decryptEmail({
            encrypted_data: row.encrypted_data,
            iv: row.iv,
            auth_tag: row.auth_tag
          }, userId);
          
          decryptedEmails.push({
            id: row.id,
            context: row.context,
            created_at: row.created_at,
            ...decryptedEmail
          });
        } catch (decryptError) {
          console.error(`Failed to decrypt email ${row.id}:`, decryptError);
        }
      }
      
      return decryptedEmails;
    } catch (error) {
      console.error('Email retrieval failed:', error);
      throw new Error('Email retrieval failed');
    }
  }

  // Email-Recovery-Export
  async exportUserEmailsForRecovery(userId, password) {
    try {
      // Benutzer-Passwort verifizieren
      const user = await this.getUserById(userId);
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      
      if (!isValidPassword) {
        throw new Error('Invalid password for email export');
      }
      
      // Alle Emails abrufen
      const emails = await this.retrieveUserEmails(userId, null, 1000);
      
      // Recovery-Package erstellen
      const recoveryData = {
        user_id: userId,
        user_email: user.email,
        export_date: new Date().toISOString(),
        total_emails: emails.length,
        emails: emails.map(email => ({
          id: email.id,
          context: email.context,
          to: email.to,
          from: email.from,
          subject: email.subject,
          body: email.body,
          timestamp: email.timestamp,
          created_at: email.created_at
        }))
      };
      
      // Recovery-Package verschlüsseln (mit User-Passwort)
      const recoveryKey = crypto.pbkdf2Sync(
        password,
        user.email + process.env.RECOVERY_SALT,
        this.iterations,
        this.keyLength,
        'sha512'
      );
      
      const recoveryIv = crypto.randomBytes(this.ivLength);
      const recoveryCipher = crypto.createCipher(this.algorithm, recoveryKey, { iv: recoveryIv });
      
      let encryptedRecovery = recoveryCipher.update(JSON.stringify(recoveryData), 'utf8', 'hex');
      encryptedRecovery += recoveryCipher.final('hex');
      const recoveryAuthTag = recoveryCipher.getAuthTag();
      
      // Recovery-Export speichern
      const exportId = crypto.randomUUID();
      const query = `
        INSERT INTO email_recovery_exports (
          id, user_id, encrypted_data, iv, auth_tag, created_at, expires_at, downloaded
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `;
      
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 Tage gültig
      
      await db.query(query, [
        exportId,
        userId,
        encryptedRecovery,
        recoveryIv.toString('hex'),
        recoveryAuthTag.toString('hex'),
        new Date(),
        expiresAt,
        false
      ]);
      
      return {
        export_id: exportId,
        expires_at: expiresAt,
        email_count: emails.length
      };
    } catch (error) {
      console.error('Email export failed:', error);
      throw new Error('Email export failed');
    }
  }

  // Recovery-Import
  async importRecoveryEmails(exportId, password, newUserId = null) {
    try {
      const query = `
        SELECT user_id, encrypted_data, iv, auth_tag, expires_at, downloaded
        FROM email_recovery_exports
        WHERE id = $1
      `;
      
      const result = await db.query(query, [exportId]);
      if (result.rows.length === 0) {
        throw new Error('Recovery export not found');
      }
      
      const exportData = result.rows[0];
      if (new Date() > exportData.expires_at) {
        throw new Error('Recovery export has expired');
      }
      
      // Recovery-Daten entschlüsseln
      const originalUser = await this.getUserById(exportData.user_id);
      const recoveryKey = crypto.pbkdf2Sync(
        password,
        originalUser.email + process.env.RECOVERY_SALT,
        this.iterations,
        this.keyLength,
        'sha512'
      );
      
      const recoveryIv = Buffer.from(exportData.iv, 'hex');
      const recoveryAuthTag = Buffer.from(exportData.auth_tag, 'hex');
      
      const recoveryDecipher = crypto.createDecipher(this.algorithm, recoveryKey, { iv: recoveryIv });
      recoveryDecipher.setAuthTag(recoveryAuthTag);
      
      let decryptedRecovery = recoveryDecipher.update(exportData.encrypted_data, 'hex', 'utf8');
      decryptedRecovery += recoveryDecipher.final('utf8');
      
      const recoveryData = JSON.parse(decryptedRecovery);
      
      // Emails in neuen Account importieren (oder in ursprünglichen Account)
      const targetUserId = newUserId || exportData.user_id;
      let importedCount = 0;
      
      for (const email of recoveryData.emails) {
        try {
          await this.storeEncryptedEmail(targetUserId, {
            to: email.to,
            from: email.from,
            subject: `[RECOVERED] ${email.subject}`,
            body: email.body,
            message_id: email.id
          }, 'recovered');
          
          importedCount++;
        } catch (importError) {
          console.error(`Failed to import email ${email.id}:`, importError);
        }
      }
      
      // Export als heruntergeladen markieren
      await db.query(
        'UPDATE email_recovery_exports SET downloaded = true WHERE id = $1',
        [exportId]
      );
      
      return {
        imported_count: importedCount,
        total_emails: recoveryData.emails.length,
        target_user_id: targetUserId
      };
    } catch (error) {
      console.error('Email import failed:', error);
      throw new Error('Email import failed');
    }
  }

  // Automatische Bereinigung abgelaufener Emails
  async cleanupExpiredEmails() {
    try {
      const query = 'DELETE FROM encrypted_emails WHERE expires_at < NOW()';
      const result = await db.query(query);
      
      console.log(`Cleaned up ${result.rowCount} expired emails`);
      return result.rowCount;
    } catch (error) {
      console.error('Email cleanup failed:', error);
    }
  }

  // Hilfsmethoden
  async getUserById(userId) {
    const query = 'SELECT id, email, password_hash FROM users WHERE id = $1';
    const result = await db.query(query, [userId]);
    
    if (result.rows.length === 0) {
      throw new Error('User not found');
    }
    
    return result.rows[0];
  }

  // S3 Backup-Funktionen
  async backupToS3(userId, emailData) {
    if (!this.s3) {
      console.warn('S3 not configured for email backup');
      return;
    }
    
    try {
      const backupKey = `email-backups/${userId}/${Date.now()}.json`;
      await this.s3.putObject({
        Bucket: process.env.EMAIL_BACKUP_BUCKET,
        Key: backupKey,
        Body: JSON.stringify(emailData),
        ContentType: 'application/json'
      }).promise();
      
      console.log(`Email backup saved to S3: ${backupKey}`);
    } catch (error) {
      console.error('S3 backup failed:', error);
    }
  }

  async restoreFromS3(backupKey) {
    if (!this.s3) {
      throw new Error('S3 not configured');
    }
    
    try {
      const result = await this.s3.getObject({
        Bucket: process.env.EMAIL_BACKUP_BUCKET,
        Key: backupKey
      }).promise();
      
      return JSON.parse(result.Body.toString());
    } catch (error) {
      console.error('S3 restore failed:', error);
      throw error;
    }
  }
}

module.exports = new EmailEncryptionService(); 