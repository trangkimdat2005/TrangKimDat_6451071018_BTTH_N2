# Bài 3: Phân tích cảm xúc bằng AI và tự động hóa

## 1. Tổng quan

Bài 3 tập trung vào hai trụ cột chính:

1. **AI Sentiment Analysis** - Phân tích cảm xúc bình luận bằng OpenAI GPT-4o-mini với heuristic fallback
2. **Automation Rule Engine** - Tự động hóa phản hồi dựa trên kết quả phân tích cảm xúc

Song song đó, bốn cơ chế resilience bắt buộc được triển khai đầy đủ: **Retry với exponential backoff**, **Circuit Breaker**, **Idempotent Kafka Consumer**, và **Dead Letter Queue với cảnh báo vận hành**.

## 2. Sơ đồ luồng xử lý

```
Facebook Comment
       |
       v
Webhook Service (3001)
       | Publish
       v
Kafka: facebook-events
       | Consume
       v
Core Service (3002)
  |-- Spam Detection (isSpam?)
  |-- AI Sentiment Analysis (tích cực / trung_lập / tiêu cực)
  |-- Rule Engine --> Xác định action
       | Publish command
       v
Kafka: facebook-commands
       | Consume
       v
Backend API (3000)
  |-- Idempotency check (command_id đã xử lý chưa?)
  |-- Gọi Facebook Graph API
       |
       +--- Thành công --> ACK
       |
       +--- Lỗi tạm thời (5xx, 429) --> Retry Service (3003)
       |                                   |
       |                           Exponential backoff: 1s, 2s, 4s, 8s, 16s
       |                           Circuit Breaker (backend-api)
       |                                   |
       |                           Thành công --> ACK
       |                           Thất bại sau 5 lần --> Dead Letter Queue
       |
       +--- Lỗi không thể khôi phục (invalid token) --> Dead Letter Queue
                                                        |
                                                        v
                                          Prometheus (9090) --> DeadLetterQueueNotEmpty
                                                        |
                                                        v
                                              Alertmanager (9093) --> Slack #alerts-critical
```

## 3. Phân tích cảm xúc (Sentiment Analysis)

### 3.1 Cơ chế hoạt động

Core Service sử dụng **OpenAI GPT-4o-mini** để phân tích bình luận. Kết quả trả về gồm:

- **Intent** (ý định): `hỏi_giá`, `hoi_thong_tin`, `khiếu_nại`, `khen`, `tương_tác_tích_cực`, `khác`
- **Sentiment** (cảm xúc): `tích_cực`, `tiêu cực`, `trung_lập`
- **Confidence** (độ tin cậy): 0.0 - 1.0
- **Source**: `ai` hoặc `heuristic_fallback`

### 3.2 Heuristic Fallback

Khi OpenAI API không khả dụng (không có API key, timeout, hoặc circuit breaker mở), hệ thống tự động chuyển sang phân tích heuristic:

| Pattern | Intent | Sentiment |
|---------|--------|-----------|
| `giá`, `bao nhiêu` | `hỏi_giá` | `trung_lập` |
| `size`, `màu`, `có sẵn` | `hoi_thong_tin` | `trung_lập` |
| `chưa nhận`, `hàng hỏng`, `tệ` | `khiếu_nại` | `tiêu cực` |
| `hay quá`, `tuyệt vời`, `đẹp` | `khen` | `tích cực` |
| `cảm ơn`, `love`, `great` | `tương_tác_tích_cực` | `tích cực` |

### 3.3 Circuit Breaker cho OpenAI (Core Service)

File: `core-service/src/services/circuitBreaker.js`

```
CLOSED --> Sau 5 lỗi liên tiếp --> OPEN
                                          |
                                    Chờ 30 giây
                                          |
OPEN --> Thử 1 request thành công --> HALF_OPEN
                                              |
                                    3 lần thành công --> CLOSED
                                    1 lần thất bại --> OPEN
```

**Điều kiện mở mạch**: Khi OpenAI liên tục trả lỗi (timeout, 5xx, rate limit), circuit breaker chuyển sang OPEN để tránh gọi liên tục vào dịch vụ đang lỗi. Khi mạch mở, mọi request AI được fallback ngay sang heuristic mà không cần chờ timeout.

## 4. Luật tự động hóa (Automation Rules)

File: `core-service/src/services/ruleEngine.js`

### 4.1 Bảng quyết định

| Comment mẫu | Sentiment | Intent | Action | Reply |
|---|---|---|---|---|
| "Shop hỗ trợ rất nhanh" | `tích cực` | - | `auto_reply` | "Cảm ơn bạn đã ủng hộ shop!..." |
| "Mình chờ quá lâu" | `tiêu cực` | - | `auto_reply` + `flag_admin` | "Rất xin lỗi vì trải nghiệm chưa tốt..." |
| "Sản phẩm tạm ổn" | `trung_lập` | - | `auto_reply` | "Chào bạn! Cảm ơn bạn đã bình luận..." |
| "Giá bao nhiêu vậy?" | `trung_lập` | `hỏi_giá` | `auto_reply` | Thông tin giá sản phẩm |
| "Quảng cáo lặp nhiều lần" | Spam | - | `hide_comment` | - |
| "Link bit.ly/abcxyz" | Spam | - | `hide_comment` + `pending_review` | - |

### 4.2 Giải thích quyết định

**Tích cực → Cảm ơn**: Người dùng hài lòng → củng cố mối quan hệ bằng lời cảm ơn, khuyến khích quay lại.

**Tiêu cực → Xin lỗi + Flag admin**:
- Xin lỗi để giữ uy tín, giảm thiểu thiệt hại danh tiếng
- Flag admin để can thiệp thủ công khi cần (có thể inbox riêng, hoàn tiền, v.v.)
- Priority cao để xử lý trước

**Trung lập → Phản hồi thông tin**: Câu hỏi trung tính → cung cấp thông tin khách quan, không quá cảm xúc.

**Spam → Ẩn bình luận**: Nội dung quảng cáo lặp, link lạ → không phù hợp với cộng đồng → ẩn để giữ chất lượng bình luận.

## 5. Cơ chế Retry với Exponential Backoff

File: `retry-service/src/index.js`

### 5.1 Chiến lược Retry

```
Lần retry 1: chờ 1 giây    (2^1 * 1000ms)
Lần retry 2: chờ 2 giây    (2^2 * 1000ms)
Lần retry 3: chờ 4 giây    (2^3 * 1000ms)
Lần retry 4: chờ 8 giây    (2^4 * 1000ms)
Lần retry 5: chờ 16 giây   (2^5 * 1000ms)

Sau 5 lần thất bại --> Dead Letter Queue
```

### 5.2 Phân biệt lỗi có thể retry và không thể retry

| Loại lỗi | Retry? | Lý do |
|---|---|---|
| Timeout mạng | ✅ Có | Lỗi tạm thời, có thể thành công lần sau |
| HTTP 500 (Facebook lỗi server) | ✅ Có | Server bên kia có vấn đề, thử lại |
| HTTP 429 (Rate limit) | ✅ Có | Quá tải, chờ rồi thử lại |
| Error subcode 613 (App rate limit) | ✅ Có | Facebook rate limit, thử lại sau |
| Invalid token (subcode 190) | ❌ Không | Lỗi cấu hình, retry vô hạn không giải quyết được |
| HTTP 400 (Bad request) | ❌ Không | Request sai, không thể sửa bằng retry |

### 5.3 Retry Service pipeline

1. **Consume** message từ `facebook-retry` topic
2. **Kiểm tra circuit breaker** (backend-api): nếu OPEN → vẫn re-queue sau backoff
3. **Gọi Backend API** qua `/api/internal/execute` (circuit breaker bảo vệ)
4. **Thành công** → đánh dấu command completed, acknowledge
5. **Thất bại**:
   - Chưa đạt max retries → chờ backoff → publish lại `facebook-retry`
   - Đạt max retries → insert `dead_letter_events`, publish `facebook-dead-letter`

## 6. Mẫu thiết kế Circuit Breaker

Hai vị trí áp dụng circuit breaker:

### 6.1 Retry Service - bảo vệ Backend API

File: `retry-service/src/services/circuitBreaker.js`, `retry-service/src/services/backendApiClient.js`

- **Tên**: `backend-api`
- **Ngưỡng**: 10 lỗi liên tiếp → OPEN
- **Reset timeout**: 30 giây
- **Half-open success threshold**: 3 lần thành công

```
CLOSED (bình thường)
  └── 10 lỗi liên tiếp --> OPEN (ngừng gọi)
                              └── 30s trôi qua --> HALF_OPEN (thử 1 request)
                                                        ├── Thành công --> CLOSED
                                                        └── Thất bại --> OPEN
```

### 6.2 Core Service - bảo vệ OpenAI API

File: `core-service/src/services/circuitBreaker.js`, `core-service/src/services/aiAnalyzer.js`

- **Tên**: `openai-api`
- **Ngưỡng**: 5 lỗi liên tiếp → OPEN
- **Reset timeout**: 30 giây
- **Half-open success threshold**: 3 lần thành công

Khi OpenAI circuit breaker OPEN: AI analyzer fallback ngay sang heuristic mà không chờ request thất bại, đảm bảo hệ thống vẫn hoạt động.

## 7. Kafka Consumer có tính Idempotent

### 7.1 Backend API - tránh gửi reply trùng

File: `backend-api/src/services/commandHandler.js`

Mỗi command có `command_id` duy nhất (UUID v4 được tạo ở Core Service).

```
1. Nhận command từ Kafka
2. Kiểm tra: SELECT 1 FROM idempotency_keys WHERE command_id = $1
3. Nếu đã tồn tại --> skip, acknowledge
4. Nếu chưa tồn tại --> xử lý --> INSERT idempotency_keys
5. Acknowledge message
```

**Đảm bảo**: Dù Kafka consumer xử lý cùng message 2 lần (do rebalance, restart), command chỉ được thực thi một lần.

### 7.2 Retry Service - skip nếu đã xử lý

File: `retry-service/src/services/backendApiClient.js`, `backend-api/src/routes/internal.js`

Retry Service gọi Backend API endpoint `/api/internal/execute`. Endpoint này kiểm tra idempotency key trước khi thực thi. Nếu `command_id` đã được xử lý trước đó (ví dụ: thành công ở lần retry trước khi message bị duplicate), Backend API trả `{ skipped: true }` và Retry Service đánh dấu thành công mà không gửi lại reply.

### 7.3 Kafka Consumer Group

- `webhook-service` → `webhook-group` (chỉ produce, không consume)
- `core-service` → `core-service-group` (consume `facebook-events`, produce `facebook-commands`)
- `backend-api` → `backend-api-group` (consume `facebook-commands`, produce `facebook-retry`)
- `retry-service` → `retry-service-group` (consume `facebook-retry`, produce `facebook-dead-letter`)

## 8. Dead Letter Queue và Cảnh báo vận hành

### 8.1 Khi nào message vào Dead Letter Queue

Message được chuyển vào `facebook-dead-letter` topic khi:

1. Retry Service đã thử 5 lần (max retries) mà vẫn thất bại
2. Lỗi không thể khôi phục (invalid token) được phát hiện ngay từ Backend API
3. Circuit breaker mở liên tục khiến retry không thể thực hiện

### 8.2 Lưu trữ Dead Letter Event

File: `retry-service/src/services/db.js`

```sql
INSERT INTO dead_letter_events
  (event_id, command_id, original_topic, payload, error_message, retry_count)
VALUES ($1, $2, $3, $4, $5, $6)
```

### 8.3 Prometheus Alert

File: `prometheus/alert_rules.yml`

```yaml
- alert: DeadLetterQueueNotEmpty
  expr: kafka_topic_partition_current_offset{topic="facebook-dead-letter"} > 0
  for: 1m
  labels:
    severity: critical
  annotations:
    summary: "Dead Letter Queue has messages"
    description: "Topic facebook-dead-letter has {{ $value }} messages"
```

Alert kích hoạt khi DLQ có bất kỳ message nào và duy trì trong 1 phút.

### 8.4 Alertmanager Slack Notification

File: `alertmanager/alertmanager.yml`

- Route `DeadLetterQueueNotEmpty` → channel `#alerts-critical` (màu đỏ)
- Route alert severity `warning` → channel `#alerts`
- Route alert severity `critical` → channel `#alerts-critical` (có emoji cảnh báo)

```
Alertmanager nhận alert
    └── Prometheus phát hiện DLQ offset > 0 (1 phút liên tục)
            └── Alertmanager gửi Slack #alerts-critical
                    └── "@channel: CRITICAL - Dead Letter Queue has 5 messages"
```

## 9. Cấu hình environment

### Core Service (.env)

```env
PORT=3002
KAFKA_BROKERS=localhost:9092
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
CIRCUIT_BREAKER_THRESHOLD=5
CIRCUIT_BREAKER_RESET_MS=30000

# Sentiment-specific auto-replies (tùy chỉnh được)
AUTO_REPLY_TICH_CUC=Cảm ơn bạn đã ủng hộ shop!
AUTO_REPLY_TIEU_CUC=Rất xin lỗi vì trải nghiệm chưa tốt...
AUTO_REPLY_TRUNG_TINH=Chào bạn! Cảm ơn bạn đã bình luận...
```

### Retry Service (.env)

```env
PORT=3003
KAFKA_BROKERS=localhost:9092
MAX_RETRIES=5
CIRCUIT_BREAKER_THRESHOLD=10
CIRCUIT_BREAKER_RESET_MS=30000
BACKEND_API_URL=http://localhost:3000
INTERNAL_API_KEY=retry-service-internal-key-2024
```

### Backend API (.env)

```env
PORT=3000
KAFKA_BROKERS=localhost:9092
FACEBOOK_PAGE_ACCESS_TOKEN=...
INTERNAL_API_KEY=retry-service-internal-key-2024
```

## 10. Giám sát và Debug

### Metrics endpoints

| Service | Endpoint | Metrics quan trọng |
|---|---|---|
| Core Service | `http://localhost:3002/metrics` | `events_processed_total`, `ai_analysis_duration_seconds`, `circuit_breaker_state` |
| Backend API | `http://localhost:3000/metrics` | `commands_processed_total`, `commands_failed_total` |
| Retry Service | `http://localhost:3003/metrics` | `retry_attempts_total`, `retry_dead_letter_total`, `circuit_breaker_state`, `retry_current_backoff_seconds` |
| Retry Service | `http://localhost:3003/circuit-breakers` | Trạng thái JSON của tất cả circuit breakers |

### Cách kiểm tra từng cơ chế

**1. Kiểm tra Retry (Exponential Backoff)**

```bash
# Tắt tạm Facebook API hoặc trả lỗi 500
# Kiểm tra logs:
curl http://localhost:3003/metrics | grep retry_current_backoff
# Sẽ thấy backoff tăng dần: 1, 2, 4, 8, 16
```

**2. Kiểm tra Circuit Breaker**

```bash
curl http://localhost:3003/circuit-breakers
# {"backend-api": 0} --> CLOSED
# {"backend-api": 2} --> OPEN
# {"backend-api": 1} --> HALF_OPEN

# Hoặc qua Prometheus:
curl http://localhost:9090/api/v1/query?query=circuit_breaker_state
```

**3. Kiểm tra Idempotent Consumer**

```bash
# Gửi cùng command 2 lần vào Kafka
# Kiểm tra logs: "Command already processed, skipping"
# Hoặc kiểm tra DB:
psql -h localhost -U fb_api_user -d fb_api_db \
  -c "SELECT * FROM idempotency_keys WHERE command_id = '<id>';"
```

**4. Kiểm tra Dead Letter Queue**

```bash
# Xem messages trong DLQ topic
# Qua Kafka UI: http://localhost:8080 > Topics > facebook-dead-letter

# Kiểm tra Prometheus alert
curl http://localhost:9090/api/v1/query?query=DeadLetterQueueNotEmpty

# Kiểm tra Alertmanager
curl http://localhost:9093/api/v1/alerts
```

## 11. Minh chứng 4 cơ chế bắt buộc

| Cơ chế | File | Kịch bản kiểm chứng |
|---|---|---|
| **Retry + Backoff** | `retry-service/src/index.js` (lines 46-96) | Gọi Facebook API bị timeout → Retry 1s → timeout → Retry 2s → ... → 5 lần → DLQ |
| **Circuit Breaker** | `retry-service/src/services/circuitBreaker.js` + `core-service/src/services/circuitBreaker.js` | Facebook API trả lỗi 10 lần liên tiếp → breaker OPEN → không gọi nữa → 30s → half-open → thử lại |
| **Idempotent Consumer** | `backend-api/src/services/commandHandler.js` (lines 83-87) | Cùng `command_id` được consume 2 lần → lần 2 skip vì đã có trong DB |
| **Dead Letter Queue + Alert** | `retry-service/src/index.js` (lines 79-84) + `prometheus/alert_rules.yml` + `alertmanager/alertmanager.yml` | Message thất bại 5 lần → vào DLQ → Prometheus phát hiện → Alertmanager gửi Slack trong 1 phút |
