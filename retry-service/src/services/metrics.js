const client = require('prom-client');

const register = new client.Registry();

register.setDefaultLabels({
  service: process.env.SERVICE_NAME || 'retry-service',
});

client.collectDefaultMetrics({ register });

const retryAttempts = new client.Counter({
  name: 'retry_attempts_total',
  help: 'Total number of retry attempts',
  labelNames: ['topic'],
  registers: [register],
});

const retrySuccess = new client.Counter({
  name: 'retry_success_total',
  help: 'Total number of successful retries',
  labelNames: ['topic'],
  registers: [register],
});

const retryDeadLetter = new client.Counter({
  name: 'retry_dead_letter_total',
  help: 'Total number of messages moved to dead letter queue',
  registers: [register],
});

const retryDuration = new client.Histogram({
  name: 'retry_duration_seconds',
  help: 'Duration of retry processing in seconds',
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [register],
});

const circuitBreakerState = new client.Gauge({
  name: 'circuit_breaker_state',
  help: 'Circuit breaker state (0=closed, 1=half_open, 2=open)',
  labelNames: ['service'],
  registers: [register],
});

const currentBackoff = new client.Gauge({
  name: 'retry_current_backoff_seconds',
  help: 'Current backoff delay in seconds',
  registers: [register],
});

function updateCircuitBreakerMetrics() {
  const states = require('./circuitBreaker').getAllCircuitBreakerStates();
  for (const [name, state] of Object.entries(states)) {
    circuitBreakerState.labels(name).set(state);
  }
}

setInterval(updateCircuitBreakerMetrics, 10000);

module.exports = {
  register,
  retryAttempts,
  retrySuccess,
  retryDeadLetter,
  retryDuration,
  circuitBreakerState,
  currentBackoff,
  updateCircuitBreakerMetrics,
};
