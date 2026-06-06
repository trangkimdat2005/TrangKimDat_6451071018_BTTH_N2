const express = require('express');
const router = express.Router();

const facebookService = require('../services/facebook');
const db = require('../db');
const logger = require('../utils/logger');

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'retry-service-internal-key-2024';

function internalAuth(req, res, next) {
  const apiKey = req.headers['x-internal-api-key'];
  if (!apiKey || apiKey !== INTERNAL_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized: invalid internal API key' });
  }
  next();
}

router.use(internalAuth);

async function isCommandProcessed(commandId) {
  try {
    const result = await db.query(
      'SELECT 1 FROM idempotency_keys WHERE command_id = $1 LIMIT 1',
      [commandId]
    );
    return result.rows.length > 0;
  } catch {
    return false;
  }
}

async function markCommandProcessed(commandId) {
  try {
    await db.query(
      'INSERT INTO idempotency_keys (command_id, status) VALUES ($1, $2) ON CONFLICT (command_id) DO NOTHING',
      [commandId, 'processed']
    );
  } catch {}
}

async function logCommand(command, status, errorMessage = null) {
  try {
    await db.query(
      `INSERT INTO command_logs (command_id, event_id, action, payload, status, error_message)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (command_id) DO UPDATE SET status = $5, error_message = $6, updated_at = CURRENT_TIMESTAMP`,
      [command.command_id, command.event_id, command.action, JSON.stringify(command), status, errorMessage]
    );
  } catch {}
}

async function updateEventTrackingStatus(eventId, data) {
  try {
    const fields = ['status = $2'];
    const values = [eventId, data.status];
    let idx = 3;

    if (data.action_taken) { fields.push(`action_taken = $${idx}`); values.push(data.action_taken); idx++; }
    if (data.reply_message) { fields.push(`reply_message = $${idx}`); values.push(data.reply_message); idx++; }
    if (data.error_message) { fields.push(`error_message = $${idx}`); values.push(data.error_message); idx++; }
    if (data.processed_at) { fields.push(`processed_at = $${idx}`); values.push(data.processed_at); idx++; }
    if (data.retry_count !== undefined) { fields.push(`retry_count = $${idx}`); values.push(data.retry_count); idx++; }

    await db.query(
      `INSERT INTO event_tracking (event_id, ${fields.map(f => f.split(' = ')[0]).join(', ')})
       VALUES ($1, ${fields.map((_, i) => `$${i + 2}`).join(', ')})
       ON CONFLICT (event_id) DO UPDATE SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP`,
      values
    );
  } catch {}
}

function isRetryableError(error) {
  if (!error.response) return true;
  const status = error.response.status;
  const fbErrorCode = error.response.data?.error?.error_subcode || error.response.data?.error?.code;
  if (status >= 500) return true;
  if (status === 429) return true;
  if (fbErrorCode === 613) return true;
  return false;
}

router.post('/execute', async (req, res) => {
  const { command } = req.body;

  if (!command || !command.action) {
    return res.status(400).json({ error: 'Missing command or command.action' });
  }

  const {
    command_id,
    action,
    comment_id,
    post_id,
    reply_message,
    event_id,
    sender_id,
    sender_name,
  } = command;

  try {
    const alreadyProcessed = await isCommandProcessed(command_id);
    if (alreadyProcessed) {
      logger.info('[Internal] Command already processed, skipping', { commandId: command_id });
      return res.json({ success: true, skipped: true, reason: 'already_processed' });
    }

    await logCommand(command, 'processing');

    switch (action) {
      case 'auto_reply': {
        if (!reply_message) throw new Error('No reply message for auto_reply action');
        if (!post_id) throw new Error('No post_id for auto_reply action');

        const result = await facebookService.facebookRequest(
          'POST',
          `${post_id}/comments`,
          { message: reply_message }
        );

        await markCommandProcessed(command_id);
        await logCommand(command, 'completed');
        await updateEventTrackingStatus(event_id, {
          status: 'replied',
          action_taken: action,
          reply_message,
          processed_at: new Date().toISOString(),
        });

        logger.info('[Internal] Auto reply sent via retry', { commandId: command_id, postId: post_id });
        return res.json({ success: true, action, result });
      }

      case 'hide_comment': {
        if (!comment_id) throw new Error('No comment_id for hide_comment action');

        const result = await facebookService.hideComment(comment_id);

        await markCommandProcessed(command_id);
        await logCommand(command, 'completed');
        await updateEventTrackingStatus(event_id, {
          status: 'processed',
          action_taken: action,
          processed_at: new Date().toISOString(),
        });

        logger.info('[Internal] Comment hidden via retry', { commandId: command_id, commentId: comment_id });
        return res.json({ success: true, action, result });
      }

      case 'flag_admin': {
        await markCommandProcessed(command_id);
        await logCommand(command, 'completed');
        await updateEventTrackingStatus(event_id, {
          status: 'processed',
          action_taken: action,
          processed_at: new Date().toISOString(),
        });

        logger.info('[Internal] Flag admin via retry', { commandId: command_id, eventId: event_id });
        return res.json({ success: true, action });
      }

      case 'pending_review': {
        await markCommandProcessed(command_id);
        await logCommand(command, 'completed');
        await updateEventTrackingStatus(event_id, {
          status: 'pending_review',
          action_taken: action,
        });

        logger.info('[Internal] Pending review via retry', { commandId: command_id, eventId: event_id });
        return res.json({ success: true, action });
      }

      case 'blacklist_user': {
        if (sender_id) {
          await db.query(
            `INSERT INTO user_blacklist (sender_id, sender_name, reason)
             VALUES ($1, $2, $3)
             ON CONFLICT (sender_id) DO NOTHING`,
            [sender_id, sender_name, 'Repeat spam - automated blacklist']
          );
        }

        await markCommandProcessed(command_id);
        await logCommand(command, 'completed');
        await updateEventTrackingStatus(event_id, {
          status: 'processed',
          action_taken: action,
          processed_at: new Date().toISOString(),
        });

        logger.info('[Internal] User blacklisted via retry', { commandId: command_id, senderId: sender_id });
        return res.json({ success: true, action });
      }

      default:
        logger.warn('[Internal] Unknown action', { commandId: command_id, action });
        await logCommand(command, 'skipped', `Unknown action: ${action}`);
        return res.json({ success: false, error: `Unknown action: ${action}` });
    }
  } catch (err) {
    await logCommand(command, 'failed', err.message);
    await updateEventTrackingStatus(event_id, {
      status: 'failed',
      error_message: err.message,
    });

    const retryable = isRetryableError(err);

    logger.error('[Internal] Command execution failed', {
      commandId: command_id,
      action,
      error: err.message,
      retryable,
    });

    return res.status(500).json({
      success: false,
      error: err.message,
      retryable,
      status: err.status || 500,
    });
  }
});

module.exports = router;
