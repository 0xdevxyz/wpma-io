const { query } = require('../config/database');
const fs = require('fs');
const path = require('path');

async function runMigration() {
    try {
        console.log('Starting migration: add_setup_token_to_sites...');
        
        const sqlFile = path.join(__dirname, 'add_setup_token_to_sites.sql');
        const sql = fs.readFileSync(sqlFile, 'utf8');
        
        // Split by semicolon and execute each statement
        const statements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('COMMENT'));
        
        for (const statement of statements) {
            console.log('Executing:', statement.substring(0, 50) + '...');
            await query(statement);
        }
        
        console.log('✅ Migration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

runMigration();

