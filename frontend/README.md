# Frontend Dashboard - Facebook Page Management System

## Tên đề tài

Giao diện quản trị hệ thống quản lý bài viết và bình luận Facebook Page.

## Thành viên nhóm

| MSSV | Họ và tên |
|------|-----------|
| 6451071018 | Trần Thị Kim Trang |

## Mô tả chức năng hệ thống

`frontend` là dashboard dành cho quản trị viên, dùng để đăng nhập và thao tác với backend API nhằm quản lý nội dung Facebook Page.

### Chức năng chính

- Đăng nhập bằng tài khoản admin.
- Hiển thị danh sách bài viết từ backend.
- Tạo bài viết mới.
- Lọc bài viết theo ngày.
- Xem bình luận của từng bài viết.
- Ẩn bình luận.
- Xóa bình luận.

## Hướng dẫn chạy project

Frontend không cần build.

### Chạy bằng Python

```bash
python -m http.server 8080
```

### Hoặc chạy bằng Node.js

```bash
npx serve .
```

Sau khi chạy, truy cập:

- `http://localhost:8080`

Tài khoản đăng nhập mặc định:

- Username: `admin`
- Password: `admin123`

Lưu ý: backend cần chạy trước tại `http://localhost:3000` để frontend hoạt động đầy đủ.

## Link Swagger UI

Frontend không chứa Swagger UI.

Swagger UI của backend, nếu được cấu hình, sẽ nằm tại:

- `http://localhost:3000/api-docs`
