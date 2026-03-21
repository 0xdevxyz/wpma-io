const { Pool } = require('pg');

// Sicherheitscheck: DATABASE_URL ist erforderlich
if (!process.env.DATABASE_URL) {
    console.error('❌ FATAL: DATABASE_URL environment variable is required');
    console.error('Please set DATABASE_URL in your environment or .env file');
    process.exit(1);
}

// Debug-Ausgabe nur in Development (ohne sensible Daten)
if (process.env.NODE_ENV === 'development') {
    console.log('=== DATABASE DEBUG ===');
    console.log('DATABASE_URL:', process.env.DATABASE_URL ? '[SET]' : '[NOT SET]');
    console.log('NODE_ENV:', process.env.NODE_ENV);
    console.log('=====================');
}

// Sichere Konfiguration - nur über Environment-Variable
const databaseConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
    max: parseInt(process.env.DATABASE_POOL_MAX || '20', 10),
    idleTimeoutMillis: parseInt(process.env.DATABASE_IDLE_TIMEOUT || '30000', 10),
    connectionTimeoutMillis: parseInt(process.env.DATABASE_CONNECT_TIMEOUT || '5000', 10),
};

// Keine sensiblen Daten loggen!
console.log('Database pool configured with max connections:', databaseConfig.max);

const pool = new Pool(databaseConfig);

// Test database connection
const testConnection = async () => {
    try {
        const client = await pool.connect();
        console.log('Database connected successfully');
        await client.query('SELECT NOW()');
        client.release();
    } catch (error) {
        console.error('Database connection failed:', error);
        throw error;
    }
};

const initializeDatabase = async () => {
    await testConnection();
    
    // Run migrations
    try {
        console.log('Running database migrations...');

        // Migration 001: Initial schema (users, sites)
        try {
            const fs = require('fs');
            const path = require('path');
            const initFile = path.join(__dirname, '../migrations/001_initial_schema.sql');
            if (fs.existsSync(initFile)) {
                const sql = fs.readFileSync(initFile, 'utf8');
                const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0 && !s.startsWith('--'));
                for (const stmt of statements) {
                    await pool.query(stmt);
                }
                console.log('✅ Migration 001 (initial schema) completed');
            }
        } catch (m001Error) {
            console.error('Migration 001 warning:', m001Error.message);
        }

        // Migration: Add setup token columns
        await pool.query(`
            ALTER TABLE sites 
            ADD COLUMN IF NOT EXISTS setup_token VARCHAR(64),
            ADD COLUMN IF NOT EXISTS setup_token_expires_at TIMESTAMP,
            ADD COLUMN IF NOT EXISTS setup_token_used BOOLEAN DEFAULT false,
            ADD COLUMN IF NOT EXISTS last_plugin_connection TIMESTAMP,
            ADD COLUMN IF NOT EXISTS plugin_version VARCHAR(20)
        `);
        
        // Create index for faster token lookups
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_sites_setup_token 
            ON sites(setup_token) WHERE setup_token IS NOT NULL
        `);
        
        console.log('✅ Database migrations completed successfully');

        // Migration 002: Fehlende Tabellen
        try {
            const fs = require('fs');
            const path = require('path');
            const migrationFile = path.join(__dirname, '../migrations/002_missing_tables.sql');
            if (fs.existsSync(migrationFile)) {
                const sql = fs.readFileSync(migrationFile, 'utf8');
                const statements = sql
                    .split(';')
                    .map(s => s.trim())
                    .filter(s => s.length > 0 && !s.startsWith('--'));
                for (const stmt of statements) {
                    await pool.query(stmt);
                }
                console.log('✅ Migration 002 (missing tables) completed');
            }
        } catch (m002Error) {
            console.error('Migration 002 warning:', m002Error.message);
        }

        // Migration 003: Content Publishing Hub
        try {
            const fs = require('fs');
            const path = require('path');
            const migrationFile = path.join(__dirname, '../migrations/003_content_hub.sql');
            if (fs.existsSync(migrationFile)) {
                const sql = fs.readFileSync(migrationFile, 'utf8');
                // Strip comment-only lines first to avoid filtering out valid statements
                const stripped = sql.replace(/^--[^\n]*\n/gm, '');
                const statements = stripped
                    .split(';')
                    .map(s => s.trim())
                    .filter(s => s.length > 0 && !s.startsWith('--'));
                for (const stmt of statements) {
                    await pool.query(stmt);
                }
                console.log('✅ Migration 003 (content hub) completed');
            }
        } catch (m003Error) {
            console.error('Migration 003 warning:', m003Error.message);
        }

        // Migration 004: Autonomer KI-Agent + Revenue Intelligence
        try {
            const fs = require('fs');
            const path = require('path');
            const migrationFile = path.join(__dirname, '../migrations/004_agent_revenue.sql');
            if (fs.existsSync(migrationFile)) {
                const sql = fs.readFileSync(migrationFile, 'utf8');
                const stripped = sql.replace(/^--[^\n]*\n/gm, '');
                const statements = stripped
                    .split(';')
                    .map(s => s.trim())
                    .filter(s => s.length > 0 && !s.startsWith('--'));
                for (const stmt of statements) {
                    await pool.query(stmt);
                }
                console.log('✅ Migration 004 (agent + revenue) completed');
            }
        } catch (m004Error) {
            console.error('Migration 004 warning:', m004Error.message);
        }

        // Migration 005: Fehlende Core-Tabellen
        try {
            const fs = require('fs');
            const path = require('path');
            const migrationFile = path.join(__dirname, '../migrations/005_missing_core_tables.sql');
            if (fs.existsSync(migrationFile)) {
                const sql = fs.readFileSync(migrationFile, 'utf8');
                const stripped = sql.replace(/^--[^\n]*\n/gm, '');
                const statements = stripped.split(';').map(s => s.trim()).filter(s => s.length > 0 && !s.startsWith('--'));
                for (const stmt of statements) { await pool.query(stmt); }
                console.log('✅ Migration 005 (missing core tables) completed');
            }
        } catch (m005Error) {
            console.error('Migration 005 warning:', m005Error.message);
        }

        // Migration 006: Onboarding Flow + Telegram
        try {
            const fs = require('fs');
            const path = require('path');
            const migrationFile = path.join(__dirname, '../migrations/006_onboarding.sql');
            if (fs.existsSync(migrationFile)) {
                const sql = fs.readFileSync(migrationFile, 'utf8');
                const stripped = sql.replace(/^--[^\n]*\n/gm, '');
                const statements = stripped.split(';').map(s => s.trim()).filter(s => s.length > 0 && !s.startsWith('--'));
                for (const stmt of statements) { await pool.query(stmt); }
                console.log('✅ Migration 006 (onboarding + telegram) completed');
            }
        } catch (m006Error) {
            console.error('Migration 006 warning:', m006Error.message);
        }

        // Migration 007: SSL-Zertifikat-Monitoring
        try {
            const fs = require('fs');
            const path = require('path');
            const migrationFile = path.join(__dirname, '../migrations/007_ssl_certs.sql');
            if (fs.existsSync(migrationFile)) {
                const sql = fs.readFileSync(migrationFile, 'utf8');
                const stripped = sql.replace(/^--[^\n]*\n/gm, '');
                const statements = stripped.split(';').map(s => s.trim()).filter(s => s.length > 0 && !s.startsWith('--'));
                for (const stmt of statements) { await pool.query(stmt); }
                console.log('✅ Migration 007 (ssl_certs) completed');
            }
        } catch (m007Error) {
            console.error('Migration 007 warning:', m007Error.message);
        }

        // Cleanup: Fix existing deleted sites to avoid unique constraint issues
        try {
            const deletedSites = await pool.query(
                `SELECT id, domain FROM sites WHERE status = 'deleted' AND domain NOT LIKE '%_DELETED_%'`
            );
            
            if (deletedSites.rows.length > 0) {
                console.log(`Found ${deletedSites.rows.length} deleted sites without timestamp suffix, fixing...`);
                
                for (const site of deletedSites.rows) {
                    const timestamp = Date.now();
                    const newDomain = `${site.domain}_DELETED_${timestamp}`;
                    await pool.query(
                        'UPDATE sites SET domain = $1 WHERE id = $2',
                        [newDomain, site.id]
                    );
                }
                
                console.log('✅ Deleted sites cleanup completed');
            }
        } catch (cleanupError) {
            console.error('Cleanup warning:', cleanupError.message);
        }
    } catch (error) {
        console.error('Migration warning:', error.message);
        // Don't fail startup if migrations have issues
    }
};

module.exports = {
    pool,
    initializeDatabase,
    query: (text, params) => pool.query(text, params),
};
