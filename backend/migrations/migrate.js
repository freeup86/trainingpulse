const fs = require('fs').promises;
const path = require('path');
const { Pool } = require('pg');
// Load environment variables based on NODE_ENV
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env';
require('dotenv').config({ path: envFile });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('sslmode=require') ? { rejectUnauthorized: false } : false
});

async function createMigrationsTable() {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  
  await pool.query(createTableQuery);
  console.log('Migrations table ready');
}

async function getExecutedMigrations() {
  const result = await pool.query('SELECT filename FROM migrations ORDER BY id');
  return result.rows.map(row => row.filename);
}

async function getMigrationFiles() {
  const migrationsDir = __dirname;
  const files = await fs.readdir(migrationsDir);
  
  return files
    .filter(file => file.endsWith('.sql') && /^\d{3}_/.test(file))
    .sort();
}

async function executeMigration(filename) {
  const filePath = path.join(__dirname, filename);
  const sql = await fs.readFile(filePath, 'utf8');
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Execute the migration
    await client.query(sql);
    
    // Record the migration
    await client.query(
      'INSERT INTO migrations (filename) VALUES ($1)',
      [filename]
    );
    
    await client.query('COMMIT');
    console.log(`✓ Executed migration: ${filename}`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function runMigrations() {
  try {
    console.log('Starting database migrations...');
    
    await createMigrationsTable();
    
    const executedMigrations = await getExecutedMigrations();
    const migrationFiles = await getMigrationFiles();
    
    const pendingMigrations = migrationFiles.filter(
      file => !executedMigrations.includes(file)
    );
    
    if (pendingMigrations.length === 0) {
      console.log('✓ No pending migrations');
      return;
    }
    
    console.log(`Found ${pendingMigrations.length} pending migrations`);
    
    for (const migration of pendingMigrations) {
      await executeMigration(migration);
    }
    
    console.log('✓ All migrations completed successfully');
    
  } catch (error) {
    console.error('Migration failed:', error);
    // Only exit if running as standalone script
    if (require.main === module) {
      process.exit(1);
    } else {
      throw error;
    }
  } finally {
    // Only close pool if running as standalone script
    if (require.main === module) {
      await pool.end();
    }
  }
}

if (require.main === module) {
  runMigrations();
}

module.exports = { runMigrations };