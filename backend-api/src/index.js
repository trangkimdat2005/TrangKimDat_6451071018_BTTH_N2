require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const config = require('./config');
const db = require('./db');
const routes = require('./routes');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const logger = require('./utils/logger');
const kafkaService = require('./services/kafka');
const { handleCommand } = require('./services/commandHandler');
const { register: metricsRegister } = require('./services/metrics');

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
      service: 'backend-api',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    },
  });
});

app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', metricsRegister.contentType);
    res.end(await metricsRegister.metrics());
  } catch (err) {
    res.status(500).end(err.message);
  }
});

app.use('/api', routes);

app.use(notFoundHandler);
app.use(errorHandler);

async function startKafkaConsumer() {
  const kafkaEnabled = process.env.KAFKA_ENABLED !== 'false';
  if (!kafkaEnabled) {
    logger.info('Kafka consumer is disabled (KAFKA_ENABLED=false)');
    return;
  }

  try {
    const topic = config.kafka?.commandsTopic || 'facebook-commands';
    await kafkaService.subscribeAndConsume(topic, handleCommand);
    logger.info('Kafka command consumer started', { topic });
  } catch (err) {
    logger.error('Failed to start Kafka consumer', { error: err.message });
  }
}

async function startServer() {
  logger.info('Starting backend-api service...');
  logger.info(`Environment: ${config.nodeEnv}`);
  logger.info(`Facebook Graph API version: ${config.facebook.graphApiVersion}`);

  const dbConnected = await db.testConnection();
  if (!dbConnected) {
    logger.error('Failed to connect to database. Exiting...');
    process.exit(1);
  }

  try {
    await db.runMigrations();
  } catch (err) {
    logger.error('Failed to run database migrations', { error: err.message });
    process.exit(1);
  }

  await startKafkaConsumer();

  app.listen(config.port, () => {
    logger.info(`Backend API server running on port ${config.port}`);
    logger.info(`Health check: http://localhost:${config.port}/health`);
    logger.info(`API endpoints: http://localhost:${config.port}/api`);
  });
}

async function shutdown() {
  logger.info('SIGTERM/SIGINT received. Shutting down gracefully...');
  await kafkaService.disconnect();
  await db.close();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception', { error: err.message, stack: err.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason: String(reason) });
  process.exit(1);
});

startServer();

module.exports = app;

