# README - Đề tài Facebook Page Management System

## Tên đề tài

Hệ thống quản lý bài viết và bình luận Facebook Page thông qua Facebook Graph API.

## Thành viên nhóm

| MSSV | Họ và tên |
|------|-----------|
| 6451071018 | Trần Thị Kim Trang |

## Mô tả chức năng hệ thống

Hệ thống gồm backend API và frontend dashboard, cho phép quản trị viên quản lý nội dung Facebook Page thông qua một lớp trung gian an toàn.

### Chức năng chính

- Đăng nhập quản trị viên bằng JWT.
- Lấy danh sách bài viết từ Facebook Page.
- Tạo bài viết mới lên Facebook Page.
- Lọc bài viết theo khoảng thời gian.
- Xem danh sách bình luận của từng bài viết.
- Ẩn bình luận trên bài viết.
- Xóa bình luận khỏi bài viết.
- Ghi log API và theo dõi trạng thái hệ thống.
- Kiểm tra sức khỏe dịch vụ qua endpoint `GET /health`.

## Hướng dẫn chạy project

### 1. Yêu cầu hệ thống

- Node.js >= 18
- Docker Desktop hoặc PostgreSQL 14+
- Python 3 hoặc một static server để chạy frontend

### 2. Khởi động cơ sở dữ liệu

Trong thư mục `backend-api`:

```bash
docker compose up -d
```

Nếu không dùng Docker, tạo database PostgreSQL và cấu hình lại file `.env` trong `backend-api`.

### 3. Cấu hình môi trường

Tạo hoặc cập nhật file `backend-api/.env` với các biến chính:

```env
PORT=3000
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=fb_api_db
DATABASE_USER=fb_api_user
DATABASE_PASSWORD=fb_api_password
JWT_SECRET=your_jwt_secret
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
FACEBOOK_PAGE_ACCESS_TOKEN=your_page_access_token
```

### 4. Chạy backend

```bash
cd backend-api
npm install
npm run dev
```

Backend mặc định chạy tại `http://localhost:3000`.

### 5. Chạy frontend

Trong thư mục `frontend`:

```bash
python -m http.server 8080
```

Frontend mặc định chạy tại `http://localhost:8080`.

### 6. Tài khoản đăng nhập mặc định

- Username: `admin`
- Password: `admin123`

## Link Swagger UI

Dự án hiện **chưa cấu hình Swagger UI**.

Nếu bổ sung Swagger sau này, link dự kiến sẽ là:

- `http://localhost:3000/api-docs`

## Ghi chú

Một số API chính để kiểm thử bằng Postman:

- `POST /api/auth/login`
- `GET /api/posts`
- `POST /api/posts`
- `GET /api/comments/:postId`
- `POST /api/comments/:postId/hide`
- `DELETE /api/comments/:commentId`
