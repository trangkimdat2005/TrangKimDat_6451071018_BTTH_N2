require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',

  kafka: {
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
    clientId: process.env.KAFKA_CLIENT_ID || 'webhook-service',
    rawEventsTopic: process.env.KAFKA_RAW_EVENTS_TOPIC || 'facebook-events',
    consumerGroup: process.env.KAFKA_CONSUMER_GROUP || 'webhook-service-group',
  },

  facebook: {
    appId: process.env.FACEBOOK_APP_ID,
    appSecret: process.env.FACEBOOK_APP_SECRET,
    webhookVerifyToken: process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN || 'verify_token',
  },

  database: {
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT, 10) || 5432,
    name: process.env.DATABASE_NAME || 'fb_api_db',
    user: process.env.DATABASE_USER || 'fb_api_user',
    password: process.env.DATABASE_PASSWORD || 'fb_api_password',
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60000,
    maxEvents: parseInt(process.env.RATE_LIMIT_MAX_EVENTS, 10) || 20,
  },
};
