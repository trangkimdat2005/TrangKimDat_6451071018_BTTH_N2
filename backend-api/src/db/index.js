const { Pool } = require('pg');
const config = require('../config');
const logger = require('../utils/logger');

const pool = new Pool({
  host: config.database.host,
  port: config.database.port,
  database: config.database.name,
  user: config.database.user,
  password: config.database.password,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  logger.error('Unexpected error on idle client', err);
});

async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  logger.debug(`Executed query`, { text: text.substring(0, 100), duration, rows: res.rowCount });
  return res;
}

async function getClient() {
  return pool.connect();
}

async function runMigrations() {
  const fs = require('fs');
  const path = require('path');

  const migrationPath = path.join(__dirname, 'migrations', 'init.sql');

  if (!fs.existsSync(migrationPath)) {
    logger.warn('Migration file not found, skipping...');
    return;
  }

  const sql = fs.readFileSync(migrationPath, 'utf8');
  const statements = sql.split(';').filter(s => s.trim() !== '');

  const client = await pool.connect();
  try {
    for (const statement of statements) {
      if (statement.trim()) {
        await client.query(statement);
      }
    }
    logger.info('Database migrations completed successfully');
  } catch (err) {
    logger.error('Migration failed', { error: err.message });
    throw err;
  } finally {
    client.release();
  }
}

async function testConnection() {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    logger.info('Database connection established successfully');
    return true;
  } catch (err) {
    logger.error('Database connection failed', { error: err.message });
    return false;
  }
}

async function close() {
  await pool.end();
}

module.exports = {
  query,
  getClient,
  runMigrations,
  testConnection,
  close,
  pool,
};
