require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const config = require('./config');
const logger = require('./utils/logger');
const { verifySignature } = require('./services/signature');
const { publishToRawEvents } = require('./services/kafka');
const { normalizePayload } = require('./services/normalizer');
const { trackEvent, isUserBlacklisted } = require('./services/db');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      service: 'webhook-service',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    },
  });
});

app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === config.facebook.webhookVerifyToken) {
    logger.info('Webhook verified successfully');
    return res.status(200).send(challenge);
  }

  logger.warn('Webhook verification failed', { mode, token });
  return res.status(403).send('Verification failed');
});

app.post('/webhook', async (req, res) => {
  const signature = req.headers['x-hub-signature-256'];

  const rawBody = JSON.stringify(req.body);

  if (config.nodeEnv === 'production') {
    if (!verifySignature(rawBody, signature, config.facebook.appSecret)) {
      logger.warn('Invalid webhook signature');
      return res.status(401).json({ success: false, error: 'Invalid signature' });
    }
  }

  const events = normalizePayload(req.body);

  if (events.length === 0) {
    return res.status(200).json({ success: true, message: 'No comment events to process' });
  }

  let processedCount = 0;
  let skippedCount = 0;

  for (const event of events) {
    try {
      if (event.sender_id) {
        const [blacklisted, rateInfo] = await Promise.all([
          isUserBlacklisted(event.sender_id),
          trackEvent(event.sender_id),
        ]);

        if (blacklisted) {
          logger.info('Skipping event from blacklisted user', { senderId: event.sender_id, eventId: event.event_id });
          skippedCount++;
          continue;
        }

        if (rateInfo.exceeded) {
          event.pending_review = true;
          logger.warn('Event flagged for pending review due to rate limit', {
            senderId: event.sender_id,
            eventId: event.event_id,
            count: rateInfo.count,
          });
        }
      }

      await publishToRawEvents(event);
      processedCount++;
    } catch (err) {
      logger.error('Failed to publish event to Kafka', { eventId: event.event_id, error: err.message });
    }
  }

  logger.info('Webhook processed', { processedCount, skippedCount, total: events.length });

  return res.status(200).json({
    success: true,
    data: {
      received: events.length,
      processed: processedCount,
      skipped: skippedCount,
    },
  });
});

app.use((err, req, res, next) => {
  logger.error('Unhandled error in webhook service', { error: err.message, stack: err.stack });
  return res.status(500).json({ success: false, error: 'Internal server error' });
});

async function startServer() {
  logger.info('Starting webhook-service...');
  logger.info(`Environment: ${config.nodeEnv}`);
  logger.info(`Kafka brokers: ${config.kafka.brokers.join(', ')}`);

  app.listen(config.port, () => {
    logger.info(`Webhook service running on port ${config.port}`);
    logger.info(`Webhook endpoint: http://localhost:${config.port}/webhook`);
    logger.info(`Health check: http://localhost:${config.port}/health`);
  });
}

async function shutdown() {
  logger.info('Shutting down webhook-service...');
  const { disconnect } = require('./services/kafka');
  const { close } = require('./services/db');
  await Promise.all([disconnect(), close()]);
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

startServer();

module.exports = app;
