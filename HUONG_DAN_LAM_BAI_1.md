# Hướng dẫn từng bước thực hiện Bài 1

## Mục tiêu của Bài 1

Xây dựng `backend-api` để làm trung gian giữa hệ thống và Facebook Graph API, đồng thời có xác thực JWT cho admin, kết nối PostgreSQL, ghi log request/response và hỗ trợ retry khi Facebook lỗi tạm thời.

---

## Cách trình bày vào Word

- Mỗi bước dưới đây có thể đưa vào một mục nhỏ trong báo cáo Word.
- Chỉ cần chụp **các bước quan trọng** như: cấu trúc thư mục, file cấu hình, code chính, chạy database, chạy server, test API, kết quả trả về.
- Khi chụp hình, nên chụp rõ **tên file**, **đoạn code chính**, **terminal chạy thành công**, **Postman hoặc trình duyệt test API**.

---

## Bước 1. Đọc yêu cầu và xác định phạm vi bài làm

### Việc thực hiện

- Đọc đề Bài 1 để xác định đúng phạm vi.
- Xác định rằng trong bài này chỉ tập trung vào service `backend-api`.
- Liệt kê các chức năng cần có:
  - Express server
  - Kết nối PostgreSQL
  - Gọi Facebook Graph API
  - JWT authentication cho admin
  - Các route `posts`, `comments`, `auth`
  - Ghi log request/response
  - Error handler và retry logic

### Hình minh chứng nên chụp

- Ảnh đề bài hoặc file kế hoạch của Bài 1.
- Ảnh danh sách các chức năng cần làm.

---

## Bước 2. Tạo cấu trúc thư mục cho `backend-api`

### Việc thực hiện

Tạo các thư mục và file theo cấu trúc sau:

```text
backend-api/
├── src/
│   ├── index.js
│   ├── config/
│   │   └── index.js
│   ├── routes/
│   │   ├── index.js
│   │   ├── posts.js
│   │   ├── comments.js
│   │   └── auth.js
│   ├── services/
│   │   └── facebook.js
│   ├── middleware/
│   │   ├── auth.js
│   │   └── errorHandler.js
│   ├── utils/
│   │   └── logger.js
│   └── db/
│       ├── index.js
│       └── migrations/
│           └── init.sql
├── .env.example
├── package.json
└── README.md
```

### Giải thích

Đây là bước chuẩn bị nền tảng để source code được tổ chức rõ ràng, dễ quản lý và dễ mở rộng.

### Hình minh chứng nên chụp

- Ảnh cây thư mục `backend-api` trong VS Code.

---

## Bước 3. Khởi tạo `package.json` và cài dependencies

### Việc thực hiện

Khởi tạo dự án Node.js và cài các thư viện cần thiết:

- `express`
- `axios`
- `dotenv`
- `cors`
- `helmet`
- `jsonwebtoken`
- `express-validator`
- `pg`
- `winston`
- `nodemon`

### Mục đích

- `express`: xây dựng API server
- `axios`: gọi Facebook Graph API
- `dotenv`: đọc biến môi trường
- `pg`: kết nối PostgreSQL
- `jsonwebtoken`: cấp và xác thực JWT
- `winston`: ghi log hệ thống

### Hình minh chứng nên chụp

- Ảnh file `package.json`
- Ảnh terminal sau khi chạy `npm install`

---

## Bước 4. Khai báo biến môi trường

### Việc thực hiện

Tạo file `.env.example` để mô tả các biến cấu hình cần dùng:

- `PORT`
- `NODE_ENV`
- `FACEBOOK_APP_ID`
- `FACEBOOK_APP_SECRET`
- `FACEBOOK_PAGE_ACCESS_TOKEN`
- `FACEBOOK_GRAPH_API_VERSION`
- `DATABASE_HOST`
- `DATABASE_PORT`
- `DATABASE_NAME`
- `DATABASE_USER`
- `DATABASE_PASSWORD`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`

Sau đó tạo file `.env` thật để chạy chương trình.

### Mục đích

Tách thông tin cấu hình ra khỏi source code để dễ thay đổi và an toàn hơn.

### Hình minh chứng nên chụp

- Ảnh file `.env.example`
- Ảnh file `.env` nhưng nên che token hoặc thông tin nhạy cảm nếu cần.

---

## Bước 5. Cấu hình module `config`

### Việc thực hiện

Tạo file `src/config/index.js` để:

- đọc biến môi trường bằng `dotenv`
- gom các cấu hình của server, database, Facebook, JWT vào một nơi

### Mục đích

Giúp toàn bộ hệ thống lấy cấu hình thống nhất, tránh lặp code ở nhiều file.

### Hình minh chứng nên chụp

- Ảnh file `src/config/index.js`

---

## Bước 6. Tạo database PostgreSQL bằng Docker

### Việc thực hiện

Tạo file `docker-compose.yml` để chạy PostgreSQL container.

Cấu hình gồm:

- image `postgres:16`
- tên database
- username
- password
- port `5432`
- volume để lưu dữ liệu

Sau đó chạy:

```bash
docker compose up -d
```

### Mục đích

Cung cấp cơ sở dữ liệu để lưu log API, bình luận, idempotency key và tài khoản admin.

### Hình minh chứng nên chụp

- Ảnh file `docker-compose.yml`
- Ảnh terminal chạy `docker compose up -d` thành công
- Nếu có Docker Desktop, chụp ảnh container PostgreSQL đang chạy

---

## Bước 7. Viết file migration SQL

### Việc thực hiện

Tạo file `src/db/migrations/init.sql` để tạo các bảng:

- `idempotency_keys`
- `comments`
- `admin_users`
- `api_logs`

### Mục đích

- `idempotency_keys`: tránh xử lý lệnh trùng lặp
- `comments`: lưu metadata bình luận
- `admin_users`: lưu tài khoản admin
- `api_logs`: ghi toàn bộ request/response với Facebook

### Hình minh chứng nên chụp

- Ảnh file `init.sql`
- Nếu có pgAdmin hoặc công cụ DB, chụp danh sách bảng sau khi migration chạy xong

---

## Bước 8. Kết nối database trong `src/db/index.js`

### Việc thực hiện

- Tạo kết nối PostgreSQL bằng thư viện `pg`
- Viết hàm khởi tạo database
- Tự động đọc và chạy file migration `init.sql` khi server khởi động

### Mục đích

Đảm bảo database sẵn sàng mỗi khi backend được chạy.

### Hình minh chứng nên chụp

- Ảnh file `src/db/index.js`
- Ảnh terminal hiển thị kết nối DB thành công hoặc migration chạy thành công

---

## Bước 9. Tạo logger hệ thống

### Việc thực hiện

Tạo file `src/utils/logger.js` dùng `winston` để ghi log.

Log cần hỗ trợ:

- thông tin server khởi động
- lỗi kết nối database
- lỗi khi gọi Facebook API

- thông tin request/response quan trọng

### Mục đích

Giúp theo dõi hệ thống khi chạy và hỗ trợ debug khi có lỗi.

### Hình minh chứng nên chụp

- Ảnh file `logger.js`
- Ảnh terminal có log khi server chạy

---

## Bước 10. Xây dựng service gọi Facebook Graph API

### Việc thực hiện

Tạo file `src/services/facebook.js` để:

- dùng `axios` gọi Facebook Graph API
- gắn `access token`
- hỗ trợ gọi các endpoint của Facebook
- ghi log request/response vào bảng `api_logs`
- xử lý lỗi token hết hạn, rate limit, lỗi server
- retry với exponential backoff khi gặp lỗi tạm thời

### Mục đích

Đây là thành phần cốt lõi của Bài 1 vì backend đóng vai trò proxy trung gian giữa hệ thống và Facebook.

### Hình minh chứng nên chụp

- Ảnh file `facebook.js`
- Ảnh đoạn code retry hoặc xử lý lỗi

---

## Bước 11. Tạo middleware xác thực JWT

### Việc thực hiện

Tạo file `src/middleware/auth.js` để:

- kiểm tra token gửi lên từ header `Authorization`
- xác thực JWT
- gắn thông tin user vào request
- tạo middleware `adminOnly` để chỉ admin mới được gọi API quản trị
- cho phép public với các route như `/auth/login` hoặc `/health`

### Mục đích

Đảm bảo chỉ người quản trị mới có thể thao tác với backend quản trị.

### Hình minh chứng nên chụp

- Ảnh file `auth.js`
- Ảnh test API khi thiếu token và khi có token hợp lệ

---

## Bước 12. Tạo middleware xử lý lỗi tổng quát

### Việc thực hiện

Tạo file `src/middleware/errorHandler.js` để chuẩn hóa mọi lỗi trả về theo một cấu trúc thống nhất.

Ví dụ response lỗi:

```json
{
  "success": false,
  "error": {
    "code": "TOKEN_EXPIRED",
    "message": "Facebook token has expired",
    "statusCode": 401
  }
}
```

### Mục đích

Giúp frontend và người kiểm thử dễ đọc lỗi, dễ debug và có chuẩn response thống nhất.

### Hình minh chứng nên chụp

- Ảnh file `errorHandler.js`
- Ảnh Postman trả lỗi đúng định dạng JSON

---

## Bước 13. Tạo route đăng nhập admin

### Việc thực hiện

Tạo file `src/routes/auth.js` với endpoint:

- `POST /api/auth/login`

Chức năng:

- nhận `username` và `password`
- so sánh với thông tin admin trong cấu hình hoặc database
- nếu đúng thì trả về JWT token

### Mục đích

Cung cấp cách đăng nhập cho dashboard admin để lấy token sử dụng các API khác.

### Hình minh chứng nên chụp

- Ảnh file `auth.js`
- Ảnh Postman gọi `POST /api/auth/login` thành công và nhận token

---

## Bước 14. Tạo route lấy danh sách bài viết và đăng bài viết mới

### Việc thực hiện

Tạo file `src/routes/posts.js` với 2 endpoint:

- `GET /api/posts`
- `POST /api/posts`

Chức năng:

- `GET /api/posts`: lấy danh sách bài viết từ Facebook Page thông qua backend
- `POST /api/posts`: gửi bài viết mới lên Facebook Page

### Mục đích

Cung cấp API quản trị để xem và tạo bài viết mà không gọi trực tiếp Facebook từ frontend.

### Hình minh chứng nên chụp

- Ảnh file `posts.js`
- Ảnh Postman test `GET /api/posts`
- Ảnh Postman test `POST /api/posts`

---

## Bước 15. Tạo route lấy danh sách bình luận

### Việc thực hiện

Tạo file `src/routes/comments.js` với endpoint:

- `GET /api/comments/:postId`

Chức năng:

- nhận `postId`
- gọi Facebook Graph API lấy comment của bài viết tương ứng
- trả danh sách bình luận cho admin

### Mục đích

Cho phép dashboard quản lý bình luận thông qua backend.

### Hình minh chứng nên chụp

- Ảnh file `comments.js`
- Ảnh Postman test `GET /api/comments/:postId`

---

## Bước 16. Gộp routes trong `src/routes/index.js`

### Việc thực hiện

Tạo file tổng để gắn các route:

- `auth`
- `posts`
- `comments`

### Mục đích

Giúp tổ chức route gọn gàng và dễ mount vào Express app.

### Hình minh chứng nên chụp

- Ảnh file `src/routes/index.js`

---

## Bước 17. Tạo file khởi động server `src/index.js`

### Việc thực hiện

Trong file này cần:

- khởi tạo Express app
- dùng `helmet`
- dùng `cors`
- bật JSON parser
- kết nối database
- mount routes
- tạo endpoint `/health`
- dùng global error handler
- chạy server ở port cấu hình

### Mục đích

Đây là file trung tâm để ghép toàn bộ thành phần của Bài 1 thành một backend hoàn chỉnh.

### Hình minh chứng nên chụp

- Ảnh file `src/index.js`
- Ảnh terminal khi server khởi động thành công

---

## Bước 18. Chạy backend và kiểm tra hoạt động

### Việc thực hiện

Chạy lần lượt:

```bash
cd backend-api
npm install
npm run dev
```

Kiểm tra:

- server chạy đúng port
- database kết nối thành công
- migration chạy thành công
- không có lỗi cú pháp

### Hình minh chứng nên chụp

- Ảnh terminal chạy `npm run dev`
- Ảnh log `server is running` hoặc `database connected`

---

## Bước 19. Test API bằng Postman

### Việc thực hiện

Test các endpoint theo thứ tự:

1. `GET /health`
2. `POST /api/auth/login`
3. `GET /api/posts`
4. `POST /api/posts`
5. `GET /api/comments/:postId`

Sau khi login thành công:

- copy JWT token
- thêm vào header:

```text
Authorization: Bearer <token>
```

### Mục đích

Kiểm tra toàn bộ chức năng backend trước khi kết luận bài đã hoàn thành.

### Hình minh chứng nên chụp

- Ảnh Postman test `/health`
- Ảnh login thành công nhận token
- Ảnh gọi `GET /api/posts` thành công
- Ảnh gọi `GET /api/comments/:postId` thành công
- Có thể chụp thêm lỗi 401 nếu không truyền token để chứng minh middleware auth hoạt động

---

## Bước 20. Kiểm tra log và dữ liệu trong PostgreSQL

### Việc thực hiện

Sau khi test API:

- kiểm tra bảng `api_logs`
- kiểm tra bảng `comments` nếu có lưu dữ liệu
- kiểm tra bảng `idempotency_keys` nếu có xử lý lệnh

### Mục đích

Chứng minh backend không chỉ trả response mà còn lưu vết hoạt động vào database.

### Hình minh chứng nên chụp

- Ảnh dữ liệu trong bảng `api_logs`
- Ảnh dữ liệu bảng `comments` hoặc các bảng liên quan

---

## Bước 21. Đánh giá kết quả đạt được

### Nội dung có thể viết vào Word

Sau khi hoàn thành Bài 1, hệ thống backend-api đã đạt được các kết quả sau:

- Xây dựng thành công Express backend server
- Kết nối được PostgreSQL bằng Docker
- Tạo và sử dụng các bảng dữ liệu cần thiết
- Tích hợp Facebook Graph API thông qua service riêng
- Có cơ chế đăng nhập admin bằng JWT
- Các API `posts`, `comments`, `auth` hoạt động
- Có middleware kiểm tra quyền truy cập
- Có cơ chế ghi log request/response
- Có chuẩn hóa lỗi trả về
- Có retry khi gặp lỗi Facebook tạm thời

### Hình minh chứng nên chụp

- Ảnh tổng hợp terminal chạy server
- Ảnh Postman test thành công
- Ảnh database có dữ liệu log

---

## Danh sách hình minh chứng quan trọng nhất

Nếu bạn chỉ muốn chụp **ít nhưng đủ ý**, hãy ưu tiên các hình sau:

1. Cây thư mục `backend-api`
2. File `package.json`
3. File `.env.example` hoặc `.env`
4. File `docker-compose.yml`
5. File `src/db/migrations/init.sql`
6. File `src/services/facebook.js`
7. File `src/middleware/auth.js`
8. File `src/index.js`
9. Terminal chạy `docker compose up -d`
10. Terminal chạy `npm run dev`
11. Postman test `POST /api/auth/login`
12. Postman test `GET /api/posts`
13. Postman test `GET /api/comments/:postId`
14. Bảng `api_logs` trong PostgreSQL

---

## Gợi ý cách viết kết luận ngắn trong Word

Bài 1 tập trung xây dựng service `backend-api` để kết nối hệ thống với Facebook Graph API. Trong quá trình thực hiện, em đã thiết kế cấu trúc thư mục rõ ràng, cấu hình môi trường, kết nối PostgreSQL, xây dựng các route quản trị, triển khai xác thực JWT, chuẩn hóa xử lý lỗi và ghi log toàn bộ quá trình gọi Facebook API. Kết quả cho thấy backend hoạt động đúng chức năng, hỗ trợ quản trị bài viết và bình luận, đồng thời tạo nền tảng cho các bài tiếp theo của hệ thống chatbot automation.