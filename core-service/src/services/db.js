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

async function updateEventTracking(eventId, data) {
  const client = getPool();
  const fields = ['status = $2'];
  const values = [eventId, data.status];
  let paramIndex = 3;

  const optionalFields = [
    'intent', 'sentiment', 'spam_score', 'spam_reason',
    'action_taken', 'reply_message', 'error_message', 'pending_review',
    'processed_at',
  ];

  for (const field of optionalFields) {
    if (data[field] !== undefined) {
      fields.push(`${field} = $${paramIndex}`);
      values.push(data[field]);
      paramIndex++;
    }
  }

  try {
    await client.query(
      `INSERT INTO event_tracking (event_id, ${fields.map(f => f.split(' = ')[0]).join(', ')})
       VALUES ($1, ${fields.map((_, i) => `$${i + 2}`).join(', ')})
       ON CONFLICT (event_id) DO UPDATE SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP`,
      values
    );
  } catch (err) {
    logger.error('Failed to update event tracking', { eventId, error: err.message });
  }
}

async function insertEventTracking(event) {
  const client = getPool();
  try {
    await client.query(
      `INSERT INTO event_tracking (event_id, comment_id, post_id, sender_id, sender_name, message, status, pending_review)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (event_id) DO NOTHING`,
      [
        event.event_id,
        event.comment_id || null,
        event.post_id || null,
        event.sender_id || null,
        event.sender_name || null,
        event.message || null,
        'received',
        event.pending_review || false,
      ]
    );
  } catch (err) {
    logger.error('Failed to insert event tracking', { eventId: event.event_id, error: err.message });
  }
}

async function getRecentSpamCount(senderId, hoursAgo = 24) {
  const client = getPool();
  try {
    const result = await client.query(
      `SELECT COUNT(*) as count FROM spam_history
       WHERE sender_id = $1 AND created_at > NOW() - INTERVAL '${hoursAgo} hours'`,
      [senderId]
    );
    return parseInt(result.rows[0].count, 10);
  } catch (err) {
    logger.error('Failed to get recent spam count', { senderId, error: err.message });
    return 0;
  }
}

async function addToSpamHistory(senderId, commentId, reason) {
  const client = getPool();
  try {
    await client.query(
      `INSERT INTO spam_history (sender_id, comment_id, spam_reason)
       VALUES ($1, $2, $3)`,
      [senderId, commentId, reason]
    );
  } catch (err) {
    logger.error('Failed to add spam history', { senderId, error: err.message });
  }
}

async function addToBlacklist(senderId, senderName, reason) {
  const client = getPool();
  try {
    await client.query(
      `INSERT INTO user_blacklist (sender_id, sender_name, reason)
       VALUES ($1, $2, $3)
       ON CONFLICT (sender_id) DO UPDATE SET reason = $3, created_at = CURRENT_TIMESTAMP`,
      [senderId, senderName, reason]
    );
    logger.info('User added to blacklist', { senderId, reason });
  } catch (err) {
    logger.error('Failed to add to blacklist', { senderId, error: err.message });
  }
}

async function logCommand(command) {
  const client = getPool();
  try {
    await client.query(
      `INSERT INTO command_logs (command_id, event_id, action, payload, status)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (command_id) DO NOTHING`,
      [command.command_id, command.event_id, command.action, JSON.stringify(command), 'pending']
    );
  } catch (err) {
    logger.error('Failed to log command', { commandId: command.command_id, error: err.message });
  }
}

async function close() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = {
  getPool,
  updateEventTracking,
  insertEventTracking,
  getRecentSpamCount,
  addToSpamHistory,
  addToBlacklist,
  logCommand,
  close,
};
