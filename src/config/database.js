const { Pool } = require('pg');

// Debug: Environment-Variablen ausgeben
console.log('=== DATABASE DEBUG ===');
console.log('DATABASE_URL:', process.env.DATABASE_URL);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('All ENV vars starting with DB:', Object.keys(process.env).filter(key => key.includes('DB')));
console.log('=====================');

// Fallback-Konfiguration wenn DATABASE_URL nicht gesetzt ist
const databaseConfig = process.env.DATABASE_URL ? {
    connectionString: process.env.DATABASE_URL,
    ssl: false, // PostgreSQL unterstützt kein SSL, daher explizit deaktivieren
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
} : {
    user: 'wpma_user',
    host: 'shared-postgres',
    database: 'wpma_db',
    password: 'uvdSDE4g69tRg146zFE/082HnAz5ICVl5KKcVkNE3bU=',
    port: 5432,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
};

console.log('Using database config:', databaseConfig);

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
