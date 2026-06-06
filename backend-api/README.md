# Backend API - Facebook Page Management System

## Tên đề tài

Backend API quản lý bài viết và bình luận Facebook Page thông qua Facebook Graph API.

## Thành viên nhóm

| MSSV | Họ và tên |
|------|-----------|
| 6451071018 | Trần Thị Kim Trang |

## Mô tả chức năng hệ thống

`backend-api` là lớp trung gian giữa frontend quản trị và Facebook Graph API, đồng thời kết nối PostgreSQL để lưu dữ liệu, log và thông tin phục vụ xác thực.

### Chức năng chính

- Cung cấp API đăng nhập quản trị viên bằng JWT.
- Cung cấp API lấy danh sách bài viết.
- Cung cấp API tạo bài viết mới.
- Cung cấp API lọc bài viết theo thời gian.
- Cung cấp API lấy danh sách bình luận theo bài viết.
- Cung cấp API ẩn bình luận.
- Cung cấp API xóa bình luận.
- Kết nối PostgreSQL để lưu log và dữ liệu hệ thống.
- Hỗ trợ health check và metrics.

## Hướng dẫn chạy project

### 1. Cài đặt dependencies

```bash
npm install
```

### 2. Cấu hình môi trường

Tạo file `.env` trong thư mục `backend-api` và khai báo:

```env
PORT=3000
NODE_ENV=development
FACEBOOK_APP_ID=your_app_id
FACEBOOK_APP_SECRET=your_app_secret
FACEBOOK_PAGE_ACCESS_TOKEN=your_page_access_token
FACEBOOK_GRAPH_API_VERSION=v18.0
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=fb_api_db
DATABASE_USER=fb_api_user
DATABASE_PASSWORD=fb_api_password
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=24h
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
```

### 3. Chạy PostgreSQL bằng Docker

```bash
docker compose up -d
```

### 4. Chạy backend ở môi trường phát triển

```bash
npm run dev
```

### 5. Chạy backend ở môi trường production

```bash
npm start
```

Sau khi chạy thành công, backend thường có các địa chỉ:

- `http://localhost:3000`
- `http://localhost:3000/health`
- `http://localhost:3000/api`

## Link Swagger UI

Dự án hiện **chưa cấu hình Swagger UI**.

Nếu được bổ sung, link truy cập dự kiến là:

- `http://localhost:3000/api-docs`
