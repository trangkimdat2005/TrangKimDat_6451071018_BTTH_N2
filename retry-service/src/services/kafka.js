const { Kafka } = require('kafkajs');
const config = require('../config');
const logger = require('../utils/logger');

let kafka = null;
let producer = null;
let consumer = null;

async function getKafka() {
  if (!kafka) {
    kafka = new Kafka({
      clientId: config.kafka.clientId,
      brokers: config.kafka.brokers,
      retry: {
        initialRetryTime: 100,
        retries: 3,
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
    logger.info('Kafka producer connected', { brokers: config.kafka.brokers });
  }
  return producer;
}

async function getConsumer() {
  if (!consumer) {
    const k = await getKafka();
    consumer = k.consumer({ groupId: config.kafka.consumerGroup, sessionTimeout: 30000 });
    await consumer.connect();
    logger.info('Kafka consumer connected', { groupId: config.kafka.consumerGroup });
  }
  return consumer;
}

async function publishMessage(topic, message, key = null) {
  const prod = await getProducer();
  const result = await prod.send({
    topic,
    messages: [{
      key: key || null,
      value: JSON.stringify(message),
      headers: {
        source: config.kafka.clientId,
        timestamp: new Date().toISOString(),
      },
    }],
  });
  logger.info('Message published', { topic, key, offset: result[0].baseOffset });
  return result;
}

async function publishToRetry(message) {
  return publishMessage(config.kafka.retryTopic, message, message.command_id);
}

async function publishToDeadLetter(message) {
  return publishMessage(config.kafka.deadLetterTopic, message, message.command_id);
}

async function publishToCommands(message) {
  return publishMessage(config.kafka.commandsTopic, message, message.command_id);
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
        logger.error('Error processing message', { topic, key, error: err.message });
      }
    },
  });

  logger.info('Consumer subscribed and running', { topic, groupId: config.kafka.consumerGroup });
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
  logger.info('Kafka disconnected');
}

module.exports = {
  getKafka,
  getProducer,
  getConsumer,
  publishMessage,
  publishToRetry,
  publishToDeadLetter,
  publishToCommands,
  subscribeAndConsume,
  disconnect,
};
