const facebookService = require('./facebook');
const db = require('../db');
const logger = require('../utils/logger');
const { commandsReceived, commandsProcessed, commandsFailed, commandProcessingDuration } = require('./metrics');

async function isCommandProcessed(commandId) {
  try {
    const result = await db.query(
      'SELECT 1 FROM idempotency_keys WHERE command_id = $1 LIMIT 1',
      [commandId]
    );
    return result.rows.length > 0;
  } catch (err) {
    logger.error('Failed to check idempotency', { commandId, error: err.message });
    return false;
  }
}

async function markCommandProcessed(commandId) {
  try {
    await db.query(
      'INSERT INTO idempotency_keys (command_id, status) VALUES ($1, $2) ON CONFLICT (command_id) DO NOTHING',
      [commandId, 'processed']
    );
  } catch (err) {
    logger.error('Failed to mark command processed', { commandId, error: err.message });
  }
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
  } catch (err) {
    logger.error('Failed to update event tracking', { eventId, error: err.message });
  }
}

async function logCommand(command, status, errorMessage = null) {
  try {
    await db.query(
      `INSERT INTO command_logs (command_id, event_id, action, payload, status, error_message)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (command_id) DO UPDATE SET status = $5, error_message = $6, updated_at = CURRENT_TIMESTAMP`,
      [command.command_id, command.event_id, command.action, JSON.stringify(command), status, errorMessage]
    );
  } catch (err) {
    logger.error('Failed to log command', { commandId: command.command_id, error: err.message });
  }
}

async function moveToDeadLetter(command, errorMessage, retryCount) {
  try {
    const { publishToDeadLetter } = require('./kafka');

    await logCommand(command, 'dead_letter', errorMessage);
    await db.query(
      `INSERT INTO dead_letter_events (event_id, command_id, original_topic, payload, error_message, retry_count)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        command.event_id,
        command.command_id,
        'facebook-commands',
        JSON.stringify(command),
        errorMessage,
        retryCount,
      ]
    );

    await publishToDeadLetter({
      ...command,
      error: errorMessage,
      final_failure: true,
      retry_count: retryCount,
      source_topic: 'facebook-commands',
    });
  } catch (err) {
    logger.error('Failed to move command to dead letter queue', {
      commandId: command.command_id,
      error: err.message,
    });
  }
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

async function handleCommand(command) {
  const startTime = Date.now();
  const { command_id, action, comment_id, post_id, reply_message, event_id, retry_count = 0 } = command;

  commandsReceived.inc({ action });

  try {
    const alreadyProcessed = await isCommandProcessed(command_id);
    if (alreadyProcessed) {
      logger.info('Command already processed, skipping', { commandId: command_id });
      return;
    }

    await logCommand(command, 'processing');

    switch (action) {
      case 'auto_reply': {
        if (!reply_message) throw new Error('No reply message for auto_reply action');
        if (!post_id) throw new Error('No post_id for auto_reply action');

        await facebookService.facebookRequest('POST', `${post_id}/comments`, { message: reply_message });
        await markCommandProcessed(command_id);
        await logCommand(command, 'completed');
        await updateEventTrackingStatus(event_id, {
          status: 'replied',
          action_taken: action,
          reply_message,
          processed_at: new Date().toISOString(),
        });

        commandsProcessed.inc({ action });
        logger.info('Auto reply sent successfully', { commandId: command_id, postId: post_id });
        break;
      }

      case 'hide_comment': {
        if (!comment_id) throw new Error('No comment_id for hide_comment action');

        await facebookService.hideComment(comment_id);
        await markCommandProcessed(command_id);
        await logCommand(command, 'completed');
        await updateEventTrackingStatus(event_id, {
          status: 'processed',
          action_taken: action,
          processed_at: new Date().toISOString(),
        });

        commandsProcessed.inc({ action });
        logger.info('Comment hidden successfully', { commandId: command_id, commentId: comment_id });
        break;
      }

      case 'flag_admin': {
        await markCommandProcessed(command_id);
        await logCommand(command, 'completed');
        await updateEventTrackingStatus(event_id, {
          status: 'processed',
          action_taken: action,
          processed_at: new Date().toISOString(),
        });

        commandsProcessed.inc({ action });
        logger.info('Event flagged for admin attention', { commandId: command_id, eventId: event_id });
        break;
      }

      case 'pending_review': {
        await markCommandProcessed(command_id);
        await logCommand(command, 'completed');
        await updateEventTrackingStatus(event_id, {
          status: 'pending_review',
          action_taken: action,
        });

        commandsProcessed.inc({ action });
        logger.info('Event marked for pending review', { commandId: command_id, eventId: event_id });
        break;
      }

      case 'blacklist_user': {
        if (command.sender_id) {
          await db.query(
            `INSERT INTO user_blacklist (sender_id, sender_name, reason)
             VALUES ($1, $2, $3)
             ON CONFLICT (sender_id) DO NOTHING`,
            [command.sender_id, command.sender_name, 'Repeat spam - automated blacklist']
          );
        }

        await markCommandProcessed(command_id);
        await logCommand(command, 'completed');
        await updateEventTrackingStatus(event_id, {
          status: 'processed',
          action_taken: action,
          processed_at: new Date().toISOString(),
        });

        commandsProcessed.inc({ action });
        logger.info('User blacklisted', { commandId: command_id, senderId: command.sender_id });
        break;
      }

      default:
        logger.warn('Unknown command action', { commandId: command_id, action });
        await logCommand(command, 'skipped', `Unknown action: ${action}`);
        commandsProcessed.inc({ action: 'unknown' });
    }
  } catch (err) {
    commandProcessingDuration.observe({ action }, (Date.now() - startTime) / 1000);
    commandsFailed.inc({ action, error_type: err.name || 'unknown' });
    logger.error('Command execution failed', { commandId: command_id, action, error: err.message });

    const shouldRetry = isRetryableError(err);

    await logCommand(command, shouldRetry ? 'retrying' : 'failed', err.message);
    await updateEventTrackingStatus(event_id, {
      status: 'failed',
      error_message: err.message,
      retry_count,
    });

    if (shouldRetry) {
      const { publishToRetry } = require('./kafka');
      await publishToRetry({ ...command, retry_count: retry_count + 1 });
      logger.info('Command re-queued for retry', { commandId: command_id, retryCount: retry_count + 1 });
    } else {
      await moveToDeadLetter(command, err.message, retry_count);
      logger.warn('Non-retryable error moved to dead letter queue', { commandId: command_id, error: err.message });
    }
    return;
  }

  commandProcessingDuration.observe({ action }, (Date.now() - startTime) / 1000);
}

module.exports = { handleCommand, isCommandProcessed, markCommandProcessed };
