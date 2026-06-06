require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const config = require('./config');
const logger = require('./utils/logger');
const { subscribeAndConsume, publishToRetry, publishToDeadLetter, disconnect } = require('./services/kafka');
const { insertDeadLetter, updateCommandStatus, close: closeDb } = require('./services/db');
const { getCircuitBreaker, getAllCircuitBreakerStates } = require('./services/circuitBreaker');
const { callBackendAPIWithCircuitBreaker } = require('./services/backendApiClient');
const { register, retryAttempts, retrySuccess, retryDeadLetter, retryDuration, currentBackoff } = require('./services/metrics');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({
    success: true,
    data: { status: 'healthy', service: 'retry-service', timestamp: new Date().toISOString(), uptime: process.uptime() },
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

app.get('/circuit-breakers', (req, res) => {
  const states = getAllCircuitBreakerStates();
  res.json({ success: true, data: states });
});

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function calculateBackoff(retryCount) {
  return Math.pow(2, retryCount) * 1000;
}

async function handleRetryMessage(message) {
  const startTime = Date.now();
  const retryCount = (message.retry_count || 0) + 1;
  const commandId = message.command_id || 'unknown';
  const eventId = message.event_id || 'unknown';

  retryAttempts.inc({ topic: config.kafka.commandsTopic });
  currentBackoff.set(calculateBackoff(retryCount) / 1000);

  logger.info('Processing retry message', { commandId, eventId, retryCount, maxRetries: config.retry.maxRetries });

  try {
    const result = await callBackendAPIWithCircuitBreaker(message);

    if (result.skipped) {
      await updateCommandStatus(commandId, 'completed');
      retrySuccess.inc({ topic: config.kafka.commandsTopic });
      logger.info('Retry: command was already processed (idempotent skip)', { commandId, eventId });
      return;
    }

    if (!result.success) {
      throw new Error(result.error || 'Unknown error from backend API');
    }

    await updateCommandStatus(commandId, 'completed');
    retrySuccess.inc({ topic: config.kafka.commandsTopic });
    logger.info('Retry succeeded', { commandId, eventId, retryCount, action: result.action });
  } catch (err) {
    const circuitBreaker = getCircuitBreaker('backend-api', config.retry.circuitBreakerThreshold, config.retry.circuitBreakerResetMs);
    const cbState = circuitBreaker.getState();

    logger.error('Retry failed', {
      commandId,
      eventId,
      retryCount,
      error: err.message,
      circuitState: cbState,
    });

    if (retryCount >= config.retry.maxRetries) {
      retryDeadLetter.inc();
      await updateCommandStatus(commandId, 'dead_letter', err.message);
      await insertDeadLetter(commandId, eventId, config.kafka.commandsTopic, message, err.message, retryCount);
      await publishToDeadLetter({ ...message, error: err.message, final_failure: true, retryCount });
      logger.warn('Message moved to dead letter queue after max retries', { commandId, retryCount });
    } else {
      const delay = calculateBackoff(retryCount);
      logger.info(`Scheduling retry ${retryCount + 1} in ${delay}ms`, { commandId });

      await sleep(delay);

      const updatedMessage = { ...message, retry_count: retryCount };
      await publishToRetry(updatedMessage);
    }
  } finally {
    retryDuration.observe((Date.now() - startTime) / 1000);
  }
}

async function startServer() {
  logger.info('Starting retry-service...');
  logger.info(`Kafka brokers: ${config.kafka.brokers.join(', ')}`);
  logger.info(`Max retries: ${config.retry.maxRetries}`);
  logger.info(`Circuit breaker threshold: ${config.retry.circuitBreakerThreshold}`);
  logger.info(`Circuit breaker reset timeout: ${config.retry.circuitBreakerResetMs}ms`);
  logger.info(`Backend API URL: ${process.env.BACKEND_API_URL || 'http://localhost:3000'}`);

  app.listen(config.port, () => {
    logger.info(`Retry service running on port ${config.port}`);
    logger.info(`Metrics: http://localhost:${config.port}/metrics`);
    logger.info(`Circuit breaker status: http://localhost:${config.port}/circuit-breakers`);
  });

  await subscribeAndConsume(config.kafka.retryTopic || 'facebook-retry', handleRetryMessage);
}

async function shutdown() {
  logger.info('Shutting down retry-service...');
  await disconnect();
  await closeDb();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

startServer().catch((err) => {
  logger.error('Failed to start retry-service', { error: err.message });
  process.exit(1);
});

module.exports = app;
