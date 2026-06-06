require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3003,
  nodeEnv: process.env.NODE_ENV || 'development',

  kafka: {
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
    clientId: process.env.KAFKA_CLIENT_ID || 'retry-service',
    retryTopic: process.env.KAFKA_RETRY_TOPIC || 'facebook-retry',
    deadLetterTopic: process.env.KAFKA_DEAD_LETTER_TOPIC || 'facebook-dead-letter',
    commandsTopic: process.env.KAFKA_COMMANDS_TOPIC || 'facebook-commands',
    consumerGroup: process.env.KAFKA_CONSUMER_GROUP || 'retry-service-group',
  },

  retry: {
    maxRetries: parseInt(process.env.MAX_RETRIES, 10) || 5,
    circuitBreakerThreshold: parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD, 10) || 10,
    circuitBreakerResetMs: parseInt(process.env.CIRCUIT_BREAKER_RESET_MS, 10) || 30000,
  },

  database: {
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT, 10) || 5432,
    name: process.env.DATABASE_NAME || 'fb_api_db',
    user: process.env.DATABASE_USER || 'fb_api_user',
    password: process.env.DATABASE_PASSWORD || 'fb_api_password',
  },

  backendApi: {
    url: process.env.BACKEND_API_URL || 'http://localhost:3000',
    internalApiKey: process.env.INTERNAL_API_KEY || 'retry-service-internal-key-2024',
  },
};
