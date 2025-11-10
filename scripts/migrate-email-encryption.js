const db = require('../src/config/database');

async function createEmailEncryptionTables() {
  try {
    console.log('Creating email encryption tables...');

    // User-Table erweitern
    await db.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS email_salt VARCHAR(128);
    `);

    // Verschlüsselte Emails
    await db.query(`
      CREATE TABLE IF NOT EXISTS encrypted_emails (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        context VARCHAR(50) NOT NULL, -- 'notification', 'alert', 'report', 'recovered'
        encrypted_data TEXT NOT NULL,
        iv VARCHAR(32) NOT NULL,
        auth_tag VARCHAR(32) NOT NULL,
        encryption_version VARCHAR(10) DEFAULT '1.0',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL
      );
    `);

    // Email-Recovery-Exports
    await db.query(`
      CREATE TABLE IF NOT EXISTS email_recovery_exports (
        id UUID PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        encrypted_data TEXT NOT NULL,
        iv VARCHAR(32) NOT NULL,
        auth_tag VARCHAR(32) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        downloaded BOOLEAN DEFAULT false
      );
    `);

    // Email-Audit-Logs
    await db.query(`
      CREATE TABLE IF NOT EXISTS email_audit_logs (
        id SERIAL PRIMARY KEY,
        email_id INTEGER REFERENCES encrypted_emails(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        action VARCHAR(50) NOT NULL, -- 'encrypt', 'decrypt', 'export', 'import', 'delete'
        metadata JSONB,
        ip_address INET,
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Email-Recovery-Logs
    await db.query(`
      CREATE TABLE IF NOT EXISTS email_recovery_logs (
        id SERIAL PRIMARY KEY,
        email_id INTEGER REFERENCES encrypted_emails(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        recovery_scenario VARCHAR(50) NOT NULL, -- 'emergency', 'legal', 'migration', 'system'
        admin_user VARCHAR(100),
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Email-Verschlüsselungs-Statistiken
    await db.query(`
      CREATE TABLE IF NOT EXISTS email_encryption_stats (
        id SERIAL PRIMARY KEY,
        cleanup_date TIMESTAMP NOT NULL,
        emails_deleted INTEGER DEFAULT 0,
        exports_deleted INTEGER DEFAULT 0,
        total_emails INTEGER DEFAULT 0,
        total_exports INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Monatliche Email-Verschlüsselungs-Statistiken
    await db.query(`
      CREATE TABLE IF NOT EXISTS email_encryption_monthly_stats (
        id SERIAL PRIMARY KEY,
        month INTEGER NOT NULL,
        year INTEGER NOT NULL,
        total_emails INTEGER DEFAULT 0,
        total_exports INTEGER DEFAULT 0,
        encryption_operations INTEGER DEFAULT 0,
        decryption_operations INTEGER DEFAULT 0,
        recovery_operations INTEGER DEFAULT 0,
        cleanup_operations INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(month, year)
      );
    `);

    // Recovery-Keys für verschiedene Szenarien
    await db.query(`
      CREATE TABLE IF NOT EXISTS recovery_keys (
        id SERIAL PRIMARY KEY,
        scenario VARCHAR(50) UNIQUE NOT NULL, -- 'emergency_access', 'legal_compliance', 'data_migration', 'system_recovery'
        encrypted_key TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_rotated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT true
      );
    `);

    // Email-Verschlüsselungs-Einstellungen
    await db.query(`
      CREATE TABLE IF NOT EXISTS email_encryption_settings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        auto_encrypt BOOLEAN DEFAULT true,
        retention_days INTEGER DEFAULT 365,
        backup_enabled BOOLEAN DEFAULT true,
        audit_logging BOOLEAN DEFAULT true,
        recovery_enabled BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id)
      );
    `);

    // Indexes für Performance
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_encrypted_emails_user_id ON encrypted_emails(user_id);
      CREATE INDEX IF NOT EXISTS idx_encrypted_emails_context ON encrypted_emails(context);
      CREATE INDEX IF NOT EXISTS idx_encrypted_emails_expires_at ON encrypted_emails(expires_at);
      CREATE INDEX IF NOT EXISTS idx_encrypted_emails_created_at ON encrypted_emails(created_at);
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_email_recovery_exports_user_id ON email_recovery_exports(user_id);
      CREATE INDEX IF NOT EXISTS idx_email_recovery_exports_expires_at ON email_recovery_exports(expires_at);
      CREATE INDEX IF NOT EXISTS idx_email_recovery_exports_downloaded ON email_recovery_exports(downloaded);
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_email_audit_logs_user_id ON email_audit_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_email_audit_logs_action ON email_audit_logs(action);
      CREATE INDEX IF NOT EXISTS idx_email_audit_logs_created_at ON email_audit_logs(created_at);
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_email_recovery_logs_user_id ON email_recovery_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_email_recovery_logs_scenario ON email_recovery_logs(recovery_scenario);
      CREATE INDEX IF NOT EXISTS idx_email_recovery_logs_created_at ON email_recovery_logs(created_at);
    `);

    // Recovery-Keys initialisieren
    await initializeRecoveryKeys();

    console.log('✅ Email encryption tables created successfully');
  } catch (error) {
    console.error('❌ Error creating email encryption tables:', error);
    throw error;
  }
}

async function initializeRecoveryKeys() {
  try {
    const scenarios = [
      {
        scenario: 'emergency_access',
        description: 'Emergency access for critical situations'
      },
      {
        scenario: 'legal_compliance',
        description: 'Legal compliance and regulatory requirements'
      },
      {
        scenario: 'data_migration',
        description: 'Data migration and system transfers'
      },
      {
        scenario: 'system_recovery',
        description: 'System recovery and disaster scenarios'
      },
      {
        scenario: 'audit_trail',
        description: 'Audit trail and compliance verification'
      }
    ];

    for (const { scenario, description } of scenarios) {
      await db.query(`
        INSERT INTO recovery_keys (scenario, description, encrypted_key)
        VALUES ($1, $2, $3)
        ON CONFLICT (scenario) DO NOTHING
      `, [scenario, description, 'placeholder_key_will_be_generated']);
    }

    console.log('✅ Recovery keys initialized');
  } catch (error) {
    console.error('❌ Error initializing recovery keys:', error);
  }
}

async function dropEmailEncryptionTables() {
  try {
    console.log('Dropping email encryption tables...');

    // Tabellen in umgekehrter Reihenfolge löschen (wegen Foreign Keys)
    const tables = [
      'email_encryption_monthly_stats',
      'email_encryption_stats',
      'email_recovery_logs',
      'email_audit_logs',
      'email_recovery_exports',
      'encrypted_emails',
      'email_encryption_settings',
      'recovery_keys'
    ];

    for (const table of tables) {
      await db.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
    }

    // User-Table Spalte entfernen
    await db.query(`
      ALTER TABLE users DROP COLUMN IF EXISTS email_salt;
    `);

    console.log('✅ Email encryption tables dropped successfully');
  } catch (error) {
    console.error('❌ Error dropping email encryption tables:', error);
    throw error;
  }
}

async function resetEmailEncryptionData() {
  try {
    console.log('Resetting email encryption data...');

    // Alle Daten löschen, aber Tabellen behalten
    await db.query('DELETE FROM email_encryption_monthly_stats');
    await db.query('DELETE FROM email_encryption_stats');
    await db.query('DELETE FROM email_recovery_logs');
    await db.query('DELETE FROM email_audit_logs');
    await db.query('DELETE FROM email_recovery_exports');
    await db.query('DELETE FROM encrypted_emails');
    await db.query('DELETE FROM email_encryption_settings');
    await db.query('DELETE FROM recovery_keys');

    // Recovery-Keys neu initialisieren
    await initializeRecoveryKeys();

    console.log('✅ Email encryption data reset successfully');
  } catch (error) {
    console.error('❌ Error resetting email encryption data:', error);
    throw error;
  }
}

async function checkEmailEncryptionTables() {
  try {
    console.log('Checking email encryption tables...');

    const tables = [
      'encrypted_emails',
      'email_recovery_exports',
      'email_audit_logs',
      'email_recovery_logs',
      'email_encryption_stats',
      'email_encryption_monthly_stats',
      'recovery_keys',
      'email_encryption_settings'
    ];

    const results = {};
    
    for (const table of tables) {
      const result = await db.query(`SELECT COUNT(*) as count FROM ${table}`);
      results[table] = parseInt(result.rows[0].count);
    }

    // User-Table Spalte prüfen
    const userResult = await db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'email_salt'
    `);
    
    results.email_salt_column = userResult.rows.length > 0;

    console.log('📊 Email encryption tables status:');
    console.table(results);

    return results;
  } catch (error) {
    console.error('❌ Error checking email encryption tables:', error);
    throw error;
  }
}

// CLI-Befehle
const command = process.argv[2];

switch (command) {
  case 'create':
    createEmailEncryptionTables()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
    break;

  case 'drop':
    dropEmailEncryptionTables()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
    break;

  case 'reset':
    resetEmailEncryptionData()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
    break;

  case 'check':
    checkEmailEncryptionTables()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
    break;

  default:
    console.log(`
📧 Email Encryption Database Migration Tool

Verwendung:
  node scripts/migrate-email-encryption.js <command>

Befehle:
  create  - Erstellt alle Email-Verschlüsselungs-Tabellen
  drop    - Löscht alle Email-Verschlüsselungs-Tabellen
  reset   - Setzt alle Email-Verschlüsselungs-Daten zurück
  check   - Prüft Status aller Email-Verschlüsselungs-Tabellen

Beispiele:
  node scripts/migrate-email-encryption.js create
  node scripts/migrate-email-encryption.js check
  node scripts/migrate-email-encryption.js reset
    `);
    process.exit(0);
} 