require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3002,
  nodeEnv: process.env.NODE_ENV || 'development',

  kafka: {
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
    clientId: process.env.KAFKA_CLIENT_ID || 'core-service',
    rawEventsTopic: process.env.KAFKA_RAW_EVENTS_TOPIC || 'facebook-events',
    commandsTopic: process.env.KAFKA_COMMANDS_TOPIC || 'facebook-commands',
    consumerGroup: process.env.KAFKA_CONSUMER_GROUP || 'core-service-group',
  },

  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  },

  database: {
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT, 10) || 5432,
    name: process.env.DATABASE_NAME || 'fb_api_db',
    user: process.env.DATABASE_USER || 'fb_api_user',
    password: process.env.DATABASE_PASSWORD || 'fb_api_password',
  },

  circuitBreaker: {
    openai: {
      threshold: parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD, 10) || 5,
      resetTimeoutMs: parseInt(process.env.CIRCUIT_BREAKER_RESET_MS, 10) || 30000,
    },
  },

  autoReply: {
    gia: process.env.AUTO_REPLY_GIA || 'Cam on ban da quan tam! Don gia san pham la XXX VND. Lien he page de biet them chi tiet.',
    camOn: process.env.AUTO_REPLY_CAM_ON || 'Cam on ban da dong hanh cung chung toi! Rat vui khi ban thich san pham.',
    khen: process.env.AUTO_REPLY_KHEN || 'Tur on cam on! Chung toi rat vui khi nhan duoc phan hoi tich cuc cua ban.',
    khac: process.env.AUTO_REPLY_KHAC || 'Chao ban! Cam on ban da binh luan. Chung toi se phan hoi som nhat co the.',

    // Sentiment-specific auto-replies (Bai 3)
    tichCuc: process.env.AUTO_REPLY_TICH_CUC || 'Cam on ban da dong hanh cung shop! Rat vui khi ban hau long, chung toi se con giu chat dang quay lai.',
    tieuCuc: process.env.AUTO_REPLY_TIEU_CUC || 'Rat xin loi vi trai nghiem chua tot. Ben minh se kiem tra va phan hoi lai som nhat co the. Cam on ban da phan hoi!',
    trungTinh: process.env.AUTO_REPLY_TRUNG_TINH || 'Chao ban! Cam on ban da binh luan. Chung toi se tra loi trong thoi gian som nhat.',
  },
};
