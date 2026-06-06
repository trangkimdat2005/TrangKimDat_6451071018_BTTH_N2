const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

function normalizeCommentEvent(entry) {
  const change = entry.changes && entry.changes[0];
  if (!change || change.field !== 'feed') return null;

  const value = change.value;
  if (!value || value.item !== 'comment') return null;

  return {
    event_id: uuidv4(),
    event_type: 'comment',
    comment_id: value.comment_id || null,
    post_id: value.post_id || value.link || null,
    sender_id: value.from?.id || null,
    sender_name: value.from?.name || 'Unknown',
    message: value.message || '',
    photo_url: value.photo || null,
    parent_id: value.parent_id || null,
    timestamp: new Date().toISOString(),
    page_id: entry.id || null,
    raw_payload: value,
    pending_review: false,
    idempotency_key: value.comment_id || null,
  };
}

function normalizeMessagingEvent(entry) {
  const messaging = entry.messaging && entry.messaging[0];
  if (!messaging) return null;

  return {
    event_id: uuidv4(),
    event_type: 'message',
    sender_id: messaging.sender?.id || null,
    sender_name: 'Unknown',
    recipient_id: messaging.recipient?.id || null,
    message: messaging.message?.text || '',
    message_id: messaging.message?.mid || null,
    timestamp: new Date((messaging.timestamp || Date.now()) / 1000).toISOString(),
    page_id: entry.id || null,
    raw_payload: messaging,
    pending_review: false,
    idempotency_key: messaging.message?.mid || null,
  };
}

function normalizePayload(body) {
  if (!body || !body.entry) {
    logger.warn('Invalid webhook payload - missing entry');
    return [];
  }

  const events = [];

  for (const entry of body.entry) {
    if (entry.changes) {
      for (const change of entry.changes) {
        if (change.field === 'feed') {
          const event = normalizeCommentEvent(entry);
          if (event) events.push(event);
        }
      }
    }

    if (entry.messaging) {
      const event = normalizeMessagingEvent(entry);
      if (event) events.push(event);
    }
  }

  logger.info('Normalized webhook payload', { eventCount: events.length });
  return events;
}

module.exports = { normalizePayload };
