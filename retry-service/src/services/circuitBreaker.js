const logger = require('../utils/logger');

const STATES = {
  CLOSED: 0,
  HALF_OPEN: 1,
  OPEN: 2,
};

class CircuitBreaker {
  constructor(name, threshold = 10, resetTimeout = 30000) {
    this.name = name;
    this.threshold = threshold;
    this.resetTimeout = resetTimeout;
    this.state = STATES.CLOSED;
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.successCount = 0;
    this.successThreshold = 3;
  }

  getState() {
    if (this.state === STATES.OPEN) {
      const now = Date.now();
      if (now - this.lastFailureTime >= this.resetTimeout) {
        this.state = STATES.HALF_OPEN;
        this.successCount = 0;
        logger.info('Circuit breaker transitioning to HALF_OPEN', { name: this.name });
      }
    }
    return this.state;
  }

  isOpen() {
    return this.getState() === STATES.OPEN;
  }

  recordSuccess() {
    if (this.state === STATES.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.state = STATES.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
        logger.info('Circuit breaker CLOSED after successful recovery', { name: this.name });
      }
    } else if (this.state === STATES.CLOSED) {
      this.failureCount = Math.max(0, this.failureCount - 1);
    }
  }

  recordFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === STATES.HALF_OPEN) {
      this.state = STATES.OPEN;
      logger.warn('Circuit breaker OPENED from HALF_OPEN after failure', { name: this.name });
    } else if (this.state === STATES.CLOSED && this.failureCount >= this.threshold) {
      this.state = STATES.OPEN;
      logger.warn('Circuit breaker OPENED - threshold exceeded', { name: this.name, failureCount: this.failureCount });
    }
  }

  async execute(fn) {
    if (this.isOpen()) {
      throw new Error(`Circuit breaker is OPEN for ${this.name}`);
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (err) {
      this.recordFailure();
      throw err;
    }
  }
}

const circuitBreakers = new Map();

function getCircuitBreaker(name, threshold = 10, resetTimeout = 30000) {
  if (!circuitBreakers.has(name)) {
    circuitBreakers.set(name, new CircuitBreaker(name, threshold, resetTimeout));
  }
  return circuitBreakers.get(name);
}

function getAllCircuitBreakerStates() {
  const states = {};
  for (const [name, cb] of circuitBreakers) {
    states[name] = cb.getState();
  }
  return states;
}

module.exports = { CircuitBreaker, getCircuitBreaker, getAllCircuitBreakerStates, STATES };
