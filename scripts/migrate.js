const { pool } = require('../src/config/database');

const createTables = async () => {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // Users table
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                first_name VARCHAR(100) NOT NULL,
                last_name VARCHAR(100) NOT NULL,
                plan_type VARCHAR(20) DEFAULT 'basic',
                last_login TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Sites table
        await client.query(`
            CREATE TABLE IF NOT EXISTS sites (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                domain VARCHAR(255) UNIQUE NOT NULL,
                site_url VARCHAR(500) NOT NULL,
                site_name VARCHAR(255) NOT NULL,
                api_key VARCHAR(255) UNIQUE NOT NULL,
                health_score INTEGER DEFAULT 0,
                status VARCHAR(20) DEFAULT 'active',
                wordpress_version VARCHAR(20),
                php_version VARCHAR(20),
                last_check TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Security scans table
        await client.query(`
            CREATE TABLE IF NOT EXISTS security_scans (
                id SERIAL PRIMARY KEY,
                site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE,
                scan_type VARCHAR(50) NOT NULL,
                status VARCHAR(20) DEFAULT 'pending',
                scan_results JSONB,
                threats_found INTEGER DEFAULT 0,
                scan_duration INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Backups table
        await client.query(`
            CREATE TABLE IF NOT EXISTS backups (
                id SERIAL PRIMARY KEY,
                site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE,
                backup_type VARCHAR(20) NOT NULL,
                status VARCHAR(20) DEFAULT 'pending',
                file_size BIGINT,
                s3_url VARCHAR(500),
                error_message TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP
            )
        `);
        
        // Performance metrics table
        await client.query(`
            CREATE TABLE IF NOT EXISTS performance_metrics (
                id SERIAL PRIMARY KEY,
                site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE,
                page_load_time DECIMAL(10,3),
                core_web_vitals JSONB,
                database_queries INTEGER,
                database_size BIGINT,
                cache_hit_ratio DECIMAL(5,2),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // AI insights table
        await client.query(`
            CREATE TABLE IF NOT EXISTS ai_insights (
                id SERIAL PRIMARY KEY,
                site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE,
                insight_type VARCHAR(50) NOT NULL,
                priority VARCHAR(20) DEFAULT 'medium',
                title VARCHAR(255) NOT NULL,
                description TEXT,
                action_required BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Activity logs table
        await client.query(`
            CREATE TABLE IF NOT EXISTS activity_logs (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                site_id INTEGER REFERENCES sites(id) ON DELETE SET NULL,
                activity_type VARCHAR(50) NOT NULL,
                description TEXT,
                metadata JSONB,
                ip_address VARCHAR(45),
                user_agent TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Create indexes
        await client.query('CREATE INDEX IF NOT EXISTS idx_sites_user_id ON sites(user_id)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_sites_domain ON sites(domain)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_security_scans_site_id ON security_scans(site_id)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_backups_site_id ON backups(site_id)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_performance_metrics_site_id ON performance_metrics(site_id)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_ai_insights_site_id ON ai_insights(site_id)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_activity_logs_site_id ON activity_logs(site_id)');
        
        await client.query('COMMIT');
        console.log('Database tables created successfully');
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Migration failed:', error);
        throw error;
    } finally {
        client.release();
    }
};

const runMigration = async () => {
    try {
        await createTables();
        console.log('Migration completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
};

if (require.main === module) {
    runMigration();
}

module.exports = { createTables }; 