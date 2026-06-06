const { Kafka } = require('kafkajs');
const config = require('../config');
const logger = require('../utils/logger');

let kafka = null;
let producer = null;
let consumer = null;

async function getKafka() {
  if (!kafka) {
    kafka = new Kafka({
      clientId: config.kafka?.clientId || 'backend-api',
      brokers: config.kafka?.brokers || ['localhost:9092'],
      retry: {
        initialRetryTime: 300,
        retries: 8,
      },
    });
  }
  return kafka;
}

async function getProducer() {
  if (!producer) {
    const k = await getKafka();
    producer = k.producer({ allowAutoTopicCreation: true });
    await producer.connect();
    logger.info('Backend API Kafka producer connected');
  }
  return producer;
}

async function getConsumer() {
  if (!consumer) {
    const k = await getKafka();
    consumer = k.consumer({
      groupId: config.kafka?.consumerGroup || 'backend-api-group',
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
    });
    await consumer.connect();
    logger.info('Backend API Kafka consumer connected', { groupId: config.kafka?.consumerGroup });
  }
  return consumer;
}

async function publishToRetry(message) {
  const prod = await getProducer();
  return prod.send({
    topic: config.kafka?.retryTopic || 'facebook-retry',
    messages: [{
      key: message.command_id || null,
      value: JSON.stringify(message),
      headers: {
        source: 'backend-api',
        timestamp: new Date().toISOString(),
      },
    }],
  });
}

async function publishToDeadLetter(message) {
  const prod = await getProducer();
  return prod.send({
    topic: config.kafka?.deadLetterTopic || 'facebook-dead-letter',
    messages: [{
      key: message.command_id || null,
      value: JSON.stringify(message),
      headers: {
        source: 'backend-api',
        timestamp: new Date().toISOString(),
      },
    }],
  });
}

async function subscribeAndConsume(topic, handler) {
  const cons = await getConsumer();
  await cons.subscribe({ topic, fromBeginning: false });

  await cons.run({
    eachMessage: async ({ topic, partition, message }) => {
      const key = message.key?.toString() || 'unknown';
      try {
        const payload = JSON.parse(message.value.toString());
        await handler(payload, { topic, partition, offset: message.offset });
      } catch (err) {
        logger.error('Error processing Kafka message', { topic, key, error: err.message });
      }
    },
  });

  logger.info('Backend API consumer subscribed', { topic });
}

async function disconnect() {
  if (producer) {
    await producer.disconnect();
    producer = null;
  }
  if (consumer) {
    await consumer.disconnect();
    consumer = null;
  }
  kafka = null;
}

module.exports = { getKafka, getProducer, publishToRetry, publishToDeadLetter, subscribeAndConsume, disconnect };
