# Các bước trọng tâm thực hiện Bài 1

## Mục tiêu
Xây dựng `backend-api` để kết nối với Facebook Graph API, xác thực admin bằng JWT, kết nối PostgreSQL và cung cấp các API quản lý bài viết, bình luận.

---

## Bước 1. Tạo ứng dụng trên Facebook for Developers

- Truy cập Facebook for Developers và tạo app.
- Thêm các thông tin cần thiết để lấy `App ID`, `App Secret` và `Page Access Token`.
- Cấu hình quyền phù hợp để backend có thể gọi Facebook Graph API.
- Mục đích: chuẩn bị thông tin kết nối giữa hệ thống và Facebook.

**Hình nên chụp:** giao diện Facebook Developers, phần App ID, App Secret, access token hoặc màn hình cấu hình app.

---

## Bước 2. Tạo cấu trúc project `backend-api`

- Tạo các thư mục chính: `routes`, `services`, `middleware`, `db`, `config`, `utils`.
- Mục đích: tổ chức source code rõ ràng, dễ phát triển.

**Hình nên chụp:** cây thư mục `backend-api`.

---

## Bước 3. Cài thư viện cần thiết

- Khởi tạo `package.json`.
- Cài các thư viện chính: `express`, `axios`, `dotenv`, `pg`, `jsonwebtoken`, `winston`, `cors`, `helmet`, `nodemon`.
- Mục đích: tạo nền tảng cho backend server, database, auth và logging.

**Hình nên chụp:** file `package.json` hoặc terminal `npm install`.

---

## Bước 4. Khai báo biến môi trường

- Tạo file `.env` hoặc `.env.example`.
- Cấu hình các biến: `PORT`, `DATABASE_*`, `JWT_SECRET`, `FACEBOOK_PAGE_ACCESS_TOKEN`.
- Mục đích: tách cấu hình khỏi source code.

**Hình nên chụp:** file `.env` hoặc `.env.example`.

---

## Bước 5. Tạo và kết nối PostgreSQL

- Dùng Docker để chạy PostgreSQL.
- Tạo các bảng cần thiết như: `api_logs`, `comments`, `admin_users`, `idempotency_keys`.
- Mục đích: lưu dữ liệu và log khi gọi Facebook API.

**Hình nên chụp:** `docker-compose.yml`, terminal `docker compose up -d`, hoặc danh sách bảng trong database.

---

## Bước 6. Xây dựng service gọi Facebook Graph API

- Tạo file service để gọi API Facebook bằng `axios`.
- Xử lý access token, request/response và retry khi lỗi tạm thời.
- Mục đích: backend làm trung gian giữa hệ thống và Facebook.

**Hình nên chụp:** file `src/services/facebook.js`.

---

## Bước 7. Xây dựng JWT authentication

- Tạo route `POST /api/auth/login` để admin đăng nhập và nhận token.
- Tạo middleware `auth.js` để kiểm tra token ở các API quản trị.
- Mục đích: bảo vệ các chức năng quản lý.

**Hình nên chụp:** file `src/routes/auth.js`, file `src/middleware/auth.js`, Postman login thành công.

---

## Bước 8. Tạo các API chính

- `GET /api/posts`: lấy danh sách bài viết.
- `POST /api/posts`: đăng bài viết mới.
- `GET /api/comments/:postId`: lấy danh sách bình luận.
- Mục đích: cung cấp chức năng quản lý Page qua backend.

**Hình nên chụp:** file route `posts.js`, `comments.js`, và kết quả test Postman.

---

## Bước 9. Hoàn thiện file khởi động server

- Tạo `src/index.js` để khởi tạo Express app.
- Kết nối database, mount routes, bật middleware `cors`, `helmet`, JSON parser, error handler.
- Mục đích: ghép toàn bộ hệ thống backend thành một ứng dụng hoàn chỉnh.

**Hình nên chụp:** file `src/index.js`, terminal chạy server thành công.

---

## Bước 10. Chạy và kiểm thử hệ thống

- Chạy database và backend.
- Test các API bằng Postman:
  - `POST /api/auth/login`
  - `GET /api/posts`
  - `GET /api/comments/:postId`
- Kiểm tra log hoặc dữ liệu lưu trong PostgreSQL.

**Hình nên chụp:** terminal `npm run dev`, Postman test thành công, bảng `api_logs` trong database.

---

## Danh sách hình quan trọng nhất

Nếu chỉ chụp các hình quan trọng, bạn nên lấy:

1. Facebook for Developers
2. Cây thư mục `backend-api`
3. File `package.json`
4. File `.env` hoặc `.env.example`
5. File `docker-compose.yml`
6. File `src/services/facebook.js`
7. File `src/middleware/auth.js`
8. File `src/index.js`
9. Terminal chạy database
10. Terminal chạy backend
11. Postman login thành công
12. Postman lấy danh sách bài viết hoặc bình luận
13. Bảng `api_logs` trong PostgreSQL

---

## Kết luận ngắn

Bài 1 tập trung xây dựng `backend-api` để kết nối hệ thống với Facebook Graph API. Kết quả đạt được là backend có thể xác thực admin bằng JWT, kết nối PostgreSQL, cung cấp các API quản lý bài viết và bình luận, đồng thời ghi log toàn bộ quá trình xử lý.