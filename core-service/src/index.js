require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const config = require('./config');
const logger = require('./utils/logger');
const { subscribeAndConsume, publishCommand, disconnect } = require('./services/kafka');
const { insertEventTracking, updateEventTracking, getRecentSpamCount, addToSpamHistory, addToBlacklist, logCommand } = require('./services/db');
const { detectSpam } = require('./services/spamDetector');
const { analyzeWithAI } = require('./services/aiAnalyzer');
const { decideAction } = require('./services/ruleEngine');
const { register, eventsReceived, eventsProcessed, eventsFailed, aiAnalysisDuration, spamDetectionDuration, kafkaPublishDuration, rateLimitTriggered } = require('./services/metrics');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({
    success: true,
    data: { status: 'healthy', service: 'core-service', timestamp: new Date().toISOString(), uptime: process.uptime() },
  });
});

app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).end(err.message);
  }
});

async function handleEvent(event) {
  const startTime = Date.now();
  const eventType = event.event_type || 'comment';

  try {
    eventsReceived.inc({ event_type: eventType });
    await insertEventTracking(event);

    if (event.pending_review) {
      rateLimitTriggered.inc();
    }

    const spamStart = Date.now();
    const spamResult = detectSpam(event);
    spamDetectionDuration.observe((Date.now() - spamStart) / 1000);

    let repeatSpamCount = 0;
    if (spamResult.isSpam && event.sender_id) {
      repeatSpamCount = await getRecentSpamCount(event.sender_id, 24);
      await addToSpamHistory(event.sender_id, event.comment_id, spamResult.reasons.join(', '));
    }

    let analysisResult = { intent: 'khác', sentiment: 'trung_lập', confidence: 0.5, source: 'none' };
    if (!spamResult.isSpam || spamResult.score < 0.6) {
      const aiStart = Date.now();
      analysisResult = await analyzeWithAI(event);
      aiAnalysisDuration.observe((Date.now() - aiStart) / 1000);
    }

    await updateEventTracking(event.event_id, {
      status: 'processed',
      intent: analysisResult.intent,
      sentiment: analysisResult.sentiment,
      spam_score: spamResult.score,
      spam_reason: spamResult.reasons.join(', '),
    });

    const decision = decideAction(event, analysisResult, spamResult, repeatSpamCount);

    const commands = decision.additionalCommands
      ? [decision.command, ...decision.additionalCommands]
      : [decision.command];

    for (const cmd of commands) {
      await logCommand(cmd);

      const kafkaStart = Date.now();
      await publishCommand(cmd);
      kafkaPublishDuration.observe((Date.now() - kafkaStart) / 1000);

      eventsProcessed.inc({ event_type: eventType, action: cmd.action });

      if (cmd.action === 'blacklist_user' && event.sender_id) {
        await addToBlacklist(event.sender_id, event.sender_name, `Repeat spam: ${spamResult.reasons.join(', ')}`);
      }

      if (cmd.action === 'pending_review') {
        await updateEventTracking(event.event_id, {
          status: 'pending_review',
          action_taken: cmd.action,
        });
      }
    }

    const processingTime = Date.now() - startTime;
    logger.info('Event processed', {
      eventId: event.event_id,
      action: decision.command.action,
      intent: analysisResult.intent,
      sentiment: analysisResult.sentiment,
      spamScore: spamResult.score,
      processingTimeMs: processingTime,
    });
  } catch (err) {
    eventsFailed.inc({ event_type: eventType, error_type: err.name || 'unknown' });
    logger.error('Failed to process event', { eventId: event.event_id, error: err.message, stack: err.stack });
    await updateEventTracking(event.event_id, { status: 'failed', error_message: err.message });
  }
}

async function startServer() {
  logger.info('Starting core-service...');
  logger.info(`Kafka brokers: ${config.kafka.brokers.join(', ')}`);
  logger.info(`OpenAI model: ${config.openai.model}`);

  app.listen(config.port, () => {
    logger.info(`Core service running on port ${config.port}`);
    logger.info(`Metrics: http://localhost:${config.port}/metrics`);
  });

  await subscribeAndConsume(config.kafka.rawEventsTopic, handleEvent);
}

async function shutdown() {
  logger.info('Shutting down core-service...');
  await disconnect();
  const { close } = require('./services/db');
  await close();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

startServer().catch((err) => {
  logger.error('Failed to start core-service', { error: err.message });
  process.exit(1);
});

module.exports = app;
