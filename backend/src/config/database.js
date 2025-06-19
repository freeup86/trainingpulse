const { Pool } = require('pg');
const logger = require('../utils/logger');

let pool;

const dbConfig = {
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/trainingpulse',
  max: parseInt(process.env.DATABASE_POOL_SIZE) || 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  ssl: process.env.DATABASE_URL?.includes('sslmode=require') ? { 
    rejectUnauthorized: false,
    sslmode: 'require'
  } : false
};

async function connectDB() {
  try {
    pool = new Pool(dbConfig);
    
    // Test the connection
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    logger.info('Database connection test successful:', result.rows[0]);
    client.release();
    
    // Set up connection event handlers
    pool.on('error', (err) => {
      logger.error('Unexpected error on idle client:', err);
    });
    
    pool.on('connect', () => {
      logger.debug('New database client connected');
    });
    
    pool.on('remove', () => {
      logger.debug('Database client removed from pool');
    });
    
    return pool;
  } catch (error) {
    logger.error('Failed to connect to database:', error);
    throw error;
  }
}

async function query(text, params) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    
    if (process.env.LOG_LEVEL === 'debug') {
      logger.debug('Executed query:', {
        text,
        duration: `${duration}ms`,
        rows: result.rowCount
      });
    }
    
    return result;
  } catch (error) {
    logger.error('Database query error:', {
      text,
      params,
      error: error.message
    });
    throw error;
  }
}

async function getClient() {
  if (!pool) {
    throw new Error('Database not connected. Call connectDB() first.');
  }
  return await pool.connect();
}

async function transaction(callback) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function closeDB() {
  if (pool) {
    await pool.end();
    logger.info('Database connection pool closed');
  }
}

// Helper function to safely parameterize queries
function buildWhereClause(filters = {}) {
  const conditions = [];
  const values = [];
  let paramCount = 1;
  
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      if (Array.isArray(value)) {
        // Handle IN clauses
        const placeholders = value.map(() => `$${paramCount++}`).join(',');
        conditions.push(`${key} IN (${placeholders})`);
        values.push(...value);
      } else if (typeof value === 'string' && value.includes('%')) {
        // Handle LIKE clauses
        conditions.push(`${key} ILIKE $${paramCount++}`);
        values.push(value);
      } else {
        // Handle equality
        conditions.push(`${key} = $${paramCount++}`);
        values.push(value);
      }
    }
  });
  
  return {
    where: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    values
  };
}

// Helper function for pagination
function buildPaginationClause(page = 1, limit = 20) {
  const offset = (page - 1) * limit;
  return {
    limit: Math.min(limit, 100), // Max 100 items per page
    offset: Math.max(offset, 0)
  };
}

// Helper function for sorting
function buildOrderClause(sort = 'created_at', order = 'DESC') {
  const allowedOrders = ['ASC', 'DESC'];
  const safeOrder = allowedOrders.includes(order.toUpperCase()) ? order.toUpperCase() : 'DESC';
  
  // Sanitize sort column (should be validated against allowed columns in actual usage)
  const safeSort = sort.replace(/[^a-zA-Z0-9_]/g, '');
  
  return `ORDER BY ${safeSort} ${safeOrder}`;
}

module.exports = {
  connectDB,
  query,
  getClient,
  transaction,
  closeDB,
  buildWhereClause,
  buildPaginationClause,
  buildOrderClause,
  pool: () => pool
};