const { Kafka } = require('kafkajs');
const config = require('../config');
const logger = require('../utils/logger');

let kafka = null;
let producer = null;

async function getKafka() {
  if (!kafka) {
    kafka = new Kafka({
      clientId: config.kafka.clientId,
      brokers: config.kafka.brokers,
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
    producer = k.producer({
      allowAutoTopicCreation: true,
      transactionTimeout: 30000,
    });

    await producer.connect();
    logger.info('Kafka producer connected', { brokers: config.kafka.brokers });
  }
  return producer;
}

async function publishMessage(topic, message) {
  const prod = await getProducer();

  const result = await prod.send({
    topic,
    messages: [
      {
        key: message.event_id || message.command_id || null,
        value: JSON.stringify(message),
        headers: {
          source: 'webhook-service',
          timestamp: new Date().toISOString(),
        },
      },
    ],
  });

  logger.info('Message published to Kafka', { topic, partition: result[0].partition, offset: result[0].baseOffset });
  return result;
}

async function publishToRawEvents(event) {
  return publishMessage(config.kafka.rawEventsTopic, event);
}

async function disconnect() {
  if (producer) {
    await producer.disconnect();
    producer = null;
    kafka = null;
    logger.info('Kafka producer disconnected');
  }
}

module.exports = {
  getKafka,
  getProducer,
  publishMessage,
  publishToRawEvents,
  disconnect,
};
