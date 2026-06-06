const client = require('prom-client');

const register = new client.Registry();

register.setDefaultLabels({
  service: 'backend-api',
});

client.collectDefaultMetrics({ register });

const commandsReceived = new client.Counter({
  name: 'commands_received_total',
  help: 'Total commands received from Kafka',
  labelNames: ['action'],
  registers: [register],
});

const commandsProcessed = new client.Counter({
  name: 'commands_processed_total',
  help: 'Total commands successfully processed',
  labelNames: ['action'],
  registers: [register],
});

const commandsFailed = new client.Counter({
  name: 'commands_failed_total',
  help: 'Total commands that failed',
  labelNames: ['action', 'error_type'],
  registers: [register],
});

const commandsRetried = new client.Counter({
  name: 'commands_retried_total',
  help: 'Total commands re-queued for retry',
  labelNames: ['action'],
  registers: [register],
});

const facebookApiDuration = new client.Histogram({
  name: 'facebook_api_duration_seconds',
  help: 'Duration of Facebook API calls in seconds',
  labelNames: ['method', 'endpoint', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

const commandProcessingDuration = new client.Histogram({
  name: 'command_processing_duration_seconds',
  help: 'Duration of command processing in seconds',
  labelNames: ['action'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 5],
  registers: [register],
});

module.exports = {
  register,
  commandsReceived,
  commandsProcessed,
  commandsFailed,
  commandsRetried,
  facebookApiDuration,
  commandProcessingDuration,
};
