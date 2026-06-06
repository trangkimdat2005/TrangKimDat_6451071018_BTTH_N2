const { Pool } = require('pg');
const config = require('../config');
const logger = require('../utils/logger');

let pool = null;

function getPool() {
  if (!pool) {
    pool = new Pool({
      host: config.database.host,
      port: config.database.port,
      database: config.database.name,
      user: config.database.user,
      password: config.database.password,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on('error', (err) => {
      logger.error('Unexpected database pool error', { error: err.message });
    });
  }
  return pool;
}

async function trackEvent(senderId) {
  const client = getPool();
  const windowStart = new Date(Date.now() - config.rateLimit.windowMs);

  try {
    const result = await client.query(
      `INSERT INTO rate_limit_tracking (sender_id, window_start, event_count)
       VALUES ($1, $2, 1)
       ON CONFLICT (sender_id, window_start)
       DO UPDATE SET event_count = rate_limit_tracking.event_count + 1
       RETURNING event_count`,
      [senderId, windowStart]
    );

    const count = result.rows[0].event_count;

    if (count > config.rateLimit.maxEvents) {
      logger.warn('Rate limit exceeded', { senderId, count, max: config.rateLimit.maxEvents });
    }

    return { count, exceeded: count > config.rateLimit.maxEvents };
  } catch (err) {
    logger.error('Failed to track rate limit', { error: err.message, senderId });
    return { count: 0, exceeded: false };
  }
}

async function isUserBlacklisted(senderId) {
  const client = getPool();

  try {
    const result = await client.query(
      'SELECT 1 FROM user_blacklist WHERE sender_id = $1 LIMIT 1',
      [senderId]
    );
    return result.rows.length > 0;
  } catch (err) {
    logger.error('Failed to check blacklist', { error: err.message, senderId });
    return false;
  }
}

async function close() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = { getPool, trackEvent, isUserBlacklisted, close };
