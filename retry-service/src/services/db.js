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
      logger.error('Database pool error', { error: err.message });
    });
  }
  return pool;
}

async function insertDeadLetter(commandId, eventId, originalTopic, payload, errorMessage, retryCount) {
  const client = getPool();
  try {
    await client.query(
      `INSERT INTO dead_letter_events (event_id, command_id, original_topic, payload, error_message, retry_count)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [eventId, commandId, originalTopic, JSON.stringify(payload), errorMessage, retryCount]
    );
    logger.warn('Message moved to dead letter queue', { commandId, eventId, retryCount });
  } catch (err) {
    logger.error('Failed to insert dead letter event', { commandId, error: err.message });
  }
}

async function updateCommandStatus(commandId, status, errorMessage = null) {
  const client = getPool();
  try {
    await client.query(
      `UPDATE command_logs SET status = $2, error_message = $3, updated_at = CURRENT_TIMESTAMP WHERE command_id = $1`,
      [commandId, status, errorMessage]
    );
  } catch (err) {
    logger.error('Failed to update command status', { commandId, error: err.message });
  }
}

async function close() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = { getPool, insertDeadLetter, updateCommandStatus, close };
