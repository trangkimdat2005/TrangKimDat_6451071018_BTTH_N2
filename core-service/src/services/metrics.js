const client = require('prom-client');

const register = new client.Registry();

register.setDefaultLabels({
  service: process.env.SERVICE_NAME || 'core-service',
});

client.collectDefaultMetrics({ register });

const eventsReceived = new client.Counter({
  name: 'events_received_total',
  help: 'Total number of events received',
  labelNames: ['event_type'],
  registers: [register],
});

const eventsProcessed = new client.Counter({
  name: 'events_processed_total',
  help: 'Total number of events processed',
  labelNames: ['event_type', 'action'],
  registers: [register],
});

const eventsFailed = new client.Counter({
  name: 'events_failed_total',
  help: 'Total number of events that failed processing',
  labelNames: ['event_type', 'error_type'],
  registers: [register],
});

const aiAnalysisDuration = new client.Histogram({
  name: 'ai_analysis_duration_seconds',
  help: 'Duration of AI analysis in seconds',
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

const spamDetectionDuration = new client.Histogram({
  name: 'spam_detection_duration_seconds',
  help: 'Duration of spam detection in seconds',
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1],
  registers: [register],
});

const kafkaPublishDuration = new client.Histogram({
  name: 'kafka_publish_duration_seconds',
  help: 'Duration of publishing to Kafka in seconds',
  buckets: [0.01, 0.05, 0.1, 0.5, 1],
  registers: [register],
});

const intentDistribution = new client.Gauge({
  name: 'intent_distribution',
  help: 'Current distribution of intents',
  labelNames: ['intent'],
  registers: [register],
});

const sentimentDistribution = new client.Gauge({
  name: 'sentiment_distribution',
  help: 'Current distribution of sentiments',
  labelNames: ['sentiment'],
  registers: [register],
});

const rateLimitTriggered = new client.Counter({
  name: 'rate_limit_triggered_total',
  help: 'Total number of rate limit triggers',
  registers: [register],
});

const pendingReviewQueue = new client.Gauge({
  name: 'pending_review_queue_size',
  help: 'Number of events pending manual review',
  registers: [register],
});

const circuitBreakerState = new client.Gauge({
  name: 'circuit_breaker_state',
  help: 'Circuit breaker state (0=closed, 1=half_open, 2=open)',
  labelNames: ['service'],
  registers: [register],
});

function updateCircuitBreakerMetrics() {
  try {
    const { getAllCircuitBreakerStates } = require('./circuitBreaker');
    const states = getAllCircuitBreakerStates();
    for (const [name, state] of Object.entries(states)) {
      circuitBreakerState.labels(name).set(state);
    }
  } catch {}
}

setInterval(updateCircuitBreakerMetrics, 10000);

module.exports = {
  register,
  eventsReceived,
  eventsProcessed,
  eventsFailed,
  aiAnalysisDuration,
  spamDetectionDuration,
  kafkaPublishDuration,
  intentDistribution,
  sentimentDistribution,
  rateLimitTriggered,
  pendingReviewQueue,
  circuitBreakerState,
  updateCircuitBreakerMetrics,
};
