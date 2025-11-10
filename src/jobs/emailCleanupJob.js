const cron = require('node-cron');
const emailEncryptionService = require('../services/emailEncryptionService');
const db = require('../config/database');

// Täglich um 2:00 Uhr morgens ausführen
cron.schedule('0 2 * * *', async () => {
  console.log('Starting email cleanup job...');
  
  try {
    // Abgelaufene Emails bereinigen
    const deletedCount = await emailEncryptionService.cleanupExpiredEmails();
    
    // Abgelaufene Recovery-Exports bereinigen
    const exportQuery = 'DELETE FROM email_recovery_exports WHERE expires_at < NOW()';
    const exportResult = await db.query(exportQuery);
    
    console.log(`Email cleanup completed: ${deletedCount} emails, ${exportResult.rowCount} exports deleted`);
    
    // Cleanup-Statistiken loggen
    await logCleanupStats(deletedCount, exportResult.rowCount);
    
  } catch (error) {
    console.error('Email cleanup failed:', error);
    
    // Fehler-Alert senden
    await sendCleanupErrorAlert(error);
  }
});

// Wöchentliche Deep-Cleanup (Sonntags um 3:00 Uhr)
cron.schedule('0 3 * * 0', async () => {
  console.log('Starting weekly deep email cleanup...');
  
  try {
    // Alte Audit-Logs bereinigen (älter als 1 Jahr)
    const auditQuery = 'DELETE FROM email_audit_logs WHERE created_at < NOW() - INTERVAL \'1 year\'';
    const auditResult = await db.query(auditQuery);
    
    // Alte Recovery-Logs bereinigen (älter als 6 Monate)
    const recoveryQuery = 'DELETE FROM email_recovery_logs WHERE created_at < NOW() - INTERVAL \'6 months\'';
    const recoveryResult = await db.query(recoveryQuery);
    
    // Datenbank-Optimierung
    await db.query('VACUUM ANALYZE encrypted_emails');
    await db.query('VACUUM ANALYZE email_recovery_exports');
    
    console.log(`Weekly cleanup completed: ${auditResult.rowCount} audit logs, ${recoveryResult.rowCount} recovery logs`);
    
  } catch (error) {
    console.error('Weekly cleanup failed:', error);
  }
});

// Monatliche Statistiken (1. des Monats um 4:00 Uhr)
cron.schedule('0 4 1 * *', async () => {
  console.log('Generating monthly email encryption statistics...');
  
  try {
    const stats = await generateMonthlyStats();
    console.log('Monthly stats generated:', stats);
    
    // Statistiken in Datenbank speichern
    await saveMonthlyStats(stats);
    
  } catch (error) {
    console.error('Monthly stats generation failed:', error);
  }
});

// Hilfsfunktionen
async function logCleanupStats(emailCount, exportCount) {
  try {
    const query = `
      INSERT INTO email_encryption_stats (
        cleanup_date, emails_deleted, exports_deleted, total_emails, total_exports
      ) VALUES ($1, $2, $3, $4, $5)
    `;
    
    // Aktuelle Statistiken abrufen
    const totalEmailsQuery = 'SELECT COUNT(*) as count FROM encrypted_emails WHERE expires_at > NOW()';
    const totalExportsQuery = 'SELECT COUNT(*) as count FROM email_recovery_exports WHERE expires_at > NOW()';
    
    const [totalEmails, totalExports] = await Promise.all([
      db.query(totalEmailsQuery),
      db.query(totalExportsQuery)
    ]);
    
    await db.query(query, [
      new Date(),
      emailCount,
      exportCount,
      totalEmails.rows[0].count,
      totalExports.rows[0].count
    ]);
    
  } catch (error) {
    console.error('Failed to log cleanup stats:', error);
  }
}

async function sendCleanupErrorAlert(error) {
  try {
    // Hier würde eine echte Alert-Funktion implementiert
    console.error('CLEANUP ERROR ALERT:', {
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack
    });
    
    // Optional: Email-Alert an Admin senden
    if (process.env.ADMIN_EMAIL) {
      // Email-Service verwenden um Alert zu senden
    }
    
  } catch (alertError) {
    console.error('Failed to send cleanup error alert:', alertError);
  }
}

async function generateMonthlyStats() {
  try {
    const stats = {
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
      total_emails: 0,
      total_exports: 0,
      encryption_operations: 0,
      decryption_operations: 0,
      recovery_operations: 0,
      cleanup_operations: 0
    };
    
    // Statistiken aus verschiedenen Tabellen sammeln
    const queries = [
      'SELECT COUNT(*) as count FROM encrypted_emails WHERE expires_at > NOW()',
      'SELECT COUNT(*) as count FROM email_recovery_exports WHERE expires_at > NOW()',
      'SELECT COUNT(*) as count FROM email_audit_logs WHERE created_at >= NOW() - INTERVAL \'1 month\'',
      'SELECT COUNT(*) as count FROM email_recovery_logs WHERE created_at >= NOW() - INTERVAL \'1 month\''
    ];
    
    const results = await Promise.all(queries.map(query => db.query(query)));
    
    stats.total_emails = results[0].rows[0].count;
    stats.total_exports = results[1].rows[0].count;
    stats.encryption_operations = results[2].rows[0].count;
    stats.recovery_operations = results[3].rows[0].count;
    
    return stats;
    
  } catch (error) {
    console.error('Failed to generate monthly stats:', error);
    return {};
  }
}

async function saveMonthlyStats(stats) {
  try {
    const query = `
      INSERT INTO email_encryption_monthly_stats (
        month, year, total_emails, total_exports, encryption_operations, 
        decryption_operations, recovery_operations, cleanup_operations, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `;
    
    await db.query(query, [
      stats.month,
      stats.year,
      stats.total_emails,
      stats.total_exports,
      stats.encryption_operations,
      stats.decryption_operations,
      stats.recovery_operations,
      stats.cleanup_operations,
      new Date()
    ]);
    
  } catch (error) {
    console.error('Failed to save monthly stats:', error);
  }
}

// Export für manuelle Ausführung
module.exports = {
  runCleanup: async () => {
    console.log('Manual email cleanup triggered...');
    try {
      const deletedCount = await emailEncryptionService.cleanupExpiredEmails();
      const exportQuery = 'DELETE FROM email_recovery_exports WHERE expires_at < NOW()';
      const exportResult = await db.query(exportQuery);
      
      console.log(`Manual cleanup completed: ${deletedCount} emails, ${exportResult.rowCount} exports deleted`);
      return { emailsDeleted: deletedCount, exportsDeleted: exportResult.rowCount };
    } catch (error) {
      console.error('Manual cleanup failed:', error);
      throw error;
    }
  },
  
  generateStats: generateMonthlyStats,
  saveStats: saveMonthlyStats
}; 