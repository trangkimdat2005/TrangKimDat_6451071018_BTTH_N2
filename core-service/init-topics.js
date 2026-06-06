const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'topic-init',
  brokers: ['localhost:9092'],
});

const TOPICS = [
  { topic: 'facebook-events', partitions: 1 },
  { topic: 'facebook-commands', partitions: 1 },
  { topic: 'facebook-retry', partitions: 1 },
  { topic: 'facebook-dead-letter', partitions: 1 },
];

async function initTopics() {
  const admin = kafka.admin();
  await admin.connect();

  try {
    const existing = await admin.listTopics();
    console.log('Existing topics:', existing);

    for (const t of TOPICS) {
      if (!existing.includes(t.topic)) {
        await admin.createTopics({
          topics: [{ topic: t.topic, numPartitions: t.partitions }],
        });
        console.log(`Created topic: ${t.topic}`);
      } else {
        console.log(`Topic already exists: ${t.topic}`);
      }
    }

    const finalList = await admin.listTopics();
    console.log('\nFinal topics:', finalList);
  } finally {
    await admin.disconnect();
  }
}

initTopics().catch(console.error);
