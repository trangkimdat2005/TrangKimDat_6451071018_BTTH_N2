require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

  facebook: {
    appId: process.env.FACEBOOK_APP_ID,
    appSecret: process.env.FACEBOOK_APP_SECRET,
    pageAccessToken: process.env.FACEBOOK_PAGE_ACCESS_TOKEN,
    graphApiVersion: process.env.FACEBOOK_GRAPH_API_VERSION || 'v18.0',
    baseUrl: `https://graph.facebook.com/${process.env.FACEBOOK_GRAPH_API_VERSION || 'v18.0'}`,
  },

  database: {
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT, 10) || 5432,
    name: process.env.DATABASE_NAME || 'fb_api_db',
    user: process.env.DATABASE_USER || 'fb_api_user',
    password: process.env.DATABASE_PASSWORD || 'fb_api_password',
  },

  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },

  admin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'admin123',
  },

  kafka: {
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
    clientId: process.env.KAFKA_CLIENT_ID || 'backend-api',
    commandsTopic: process.env.KAFKA_COMMANDS_TOPIC || 'facebook-commands',
    retryTopic: process.env.KAFKA_RETRY_TOPIC || 'facebook-retry',
    deadLetterTopic: process.env.KAFKA_DEAD_LETTER_TOPIC || 'facebook-dead-letter',
    consumerGroup: process.env.KAFKA_CONSUMER_GROUP || 'backend-api-group',
    enabled: process.env.KAFKA_ENABLED !== 'false',
  },
};
