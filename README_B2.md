# Bài 2: Xử lý thời gian thực với Webhook và Kafka

## Tổng quan

Bài 2 xây dựng hệ thống xử lý thời gian thực gồm 4 service chính và hạ tầng Kafka/Prometheus/Alertmanager.

## Kiến trúc

```
Facebook Webhook --> Webhook Service (3001) --> Kafka --> Core Service (3002) --> Kafka --> Backend API (3000) --> Facebook Graph API
                                                                    |                         |
                                                                Kafka                  Facebook API
                                                                    |                         |
                                                              Retry Service (3003) <--------+
                                                                    |
                                                              Dead Letter Queue
                                                                    |
                                                              Prometheus (9090) --> Alertmanager (9093) --> Slack
```

## Danh sách services và ports

| Service | Port | Mô tả |
|---------|------|--------|
| Backend API | 3000 | Gọi Facebook Graph API, Kafka consumer cho commands |
| Webhook Service | 3001 | Nhận webhook Facebook, verify HMAC, publish Kafka |
| Core Service | 3002 | Spam/AI analysis, rule engine, publish commands |
| Retry Service | 3003 | Exponential backoff retry, circuit breaker, dead letter |

## Infrastructure (Docker)

| Service | Port | Mô tả |
|---------|------|--------|
| Kafka Broker | 9092 | Message broker |
| Kafka UI | 8080 | Giao diện quản lý Kafka |
| Kafka JMX Exporter | 9308 | Kafka metrics for Prometheus |
| Prometheus | 9090 | Metrics collection |
| Alertmanager | 9093 | Alert routing |

## Kafka Topics

| Topic | Mô tả |
|-------|--------|
| `facebook-events` | Raw events từ webhook (Webhook -> Core) |
| `facebook-commands` | Commands cần thực thi (Core -> Backend API) |
| `facebook-retry` | Failed commands cần retry (Backend API -> Retry Service) |
| `facebook-dead-letter` | Messages đã fail sau N lần retry |

## Cách chạy

### 1. Chạy Infrastructure (Kafka, Prometheus, Alertmanager)

```bash
# Tạo network trước
docker network create kafka-network

# Chạy toàn bộ infrastructure
docker compose up -d

# Kiểm tra trạng thái
docker compose ps
```

### 2. Chạy Webhook Service

```bash
cd webhook-service
cp .env.example .env
# Chỉnh sửa .env với thông tin của bạn:
# - FACEBOOK_APP_SECRET
# - FACEBOOK_WEBHOOK_VERIFY_TOKEN
# - KAFKA_BROKERS (localhost:9092)
# - DATABASE_HOST (nếu PostgreSQL chạy trong Docker)
npm install
npm start
```

### 3. Chạy Core Service

```bash
cd core-service
cp .env.example .env
# Chỉnh sửa .env với thông tin của bạn:
# - KAFKA_BROKERS (localhost:9092)
# - DATABASE_HOST (nếu PostgreSQL chạy trong Docker)
# - OPENAI_API_KEY (nếu có - để trống sẽ dùng heuristic fallback)
npm install
npm start
```

### 4. Chạy Backend API

```bash
cd backend-api
# Backend API đã có .env, chỉ cần thêm Kafka config:
# KAFKA_BROKERS=localhost:9092
npm install
npm start
```

### 5. Chạy Retry Service

```bash
cd retry-service
cp .env.example .env
# Chỉnh sửa .env:
# - KAFKA_BROKERS (localhost:9092)
# - DATABASE_HOST (nếu cần)
npm install
npm start
```

## Cách cấu hình Webhook trên Facebook Developer

1. Mở [Facebook Developer Console](https://developers.facebook.com)
2. Chọn ứng dụng của bạn
3. Webhooks > Webhooks settings
4. Callback URL: `https://your-domain.com/webhook` (hoặc `http://localhost:3001/webhook` cho dev với ngrok)
5. Verify Token: giá trị bạn đặt trong `FACEBOOK_WEBHOOK_VERIFY_TOKEN`
6. Subscribe fields: chọn `page`, `feed` (cho comment events)

## Cách test với ngrok (local dev)

```bash
# Cài đặt ngrok
ngrok http 3001

# Lấy URL từ ngrok (ví dụ: https://abc123.ngrok.io)
# Dùng URL này làm Callback URL trong Facebook Developer Console

# Verify webhook sẽ tự động xử lý (GET /webhook)
# Comment events sẽ được nhận (POST /webhook)
```

## Database Tables mới (Bài 2)

- `event_tracking` - Theo dõi trạng thái từng event (received -> processed -> replied/failed)
- `rate_limit_tracking` - Theo dõi số events theo từng user trong cửa sổ thời gian
- `user_blacklist` - Danh sách người dùng bị block nội bộ
- `dead_letter_events` - Các message đã fail sau khi retry hết
- `spam_history` - Lịch sử spam để phát hiện repeat offender
- `command_logs` - Audit log cho các commands

## Cơ chế chính

### Spam Detection (Core Service)
- URL patterns (bit.ly, tinyurl, etc.)
- Suspicious keywords (scam, hack, free money, etc.)
- Excessive punctuation/caps lock
- Repeated content

### AI Intent/Sentiment Analysis
- Sử dụng OpenAI API (GPT-4o-mini) nếu có `OPENAI_API_KEY`
- Fallback sang heuristic analysis nếu không có API key
- Intent: hỏi_giá, hoi_thong_tin, khiếu_nại, khen, tương_tác_tích_cực, khác
- Sentiment: tích_cực, tiêu_cực, trung_lập

### Retry Logic (Retry Service)
- Exponential backoff: 1s, 2s, 4s, 8s, 16s
- Max 5 retries
- Circuit breaker: mở sau 10 lỗi liên tiếp, reset sau 30s
- Dead letter queue sau khi hết retries

### Rate Limiting (Webhook Service)
- Mặc định: 20 events/user/phút
- Vượt quá -> flag `pending_review`, không automation

## Monitoring

- Prometheus: http://localhost:9090
- Kafka UI: http://localhost:8080
- Alertmanager: http://localhost:9093
- Metrics endpoint mỗi service: `/metrics`
