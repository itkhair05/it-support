# 🎧 HelpDesk IT — Hệ thống Hỗ trợ Kỹ thuật Nội bộ

Ứng dụng fullstack quản lý yêu cầu hỗ trợ IT nội bộ: nhân viên gửi ticket, bộ phận IT tiếp nhận xử lý theo SLA, admin điều hành toàn hệ thống — với chat realtime, thông báo cá nhân và phân quyền thực thi trên server.

| | |
| --- | --- |
| **Frontend** | React 18 · Vite 5 · Lucide Icons |
| **Backend** | Go 1.22 · `net/http` (chuẩn, không framework) |
| **Database** | SQLite (`modernc.org/sqlite` — thuần Go, không cần cài C compiler) |
| **Realtime** | WebSocket (`gorilla/websocket`) |
| **Auth** | JWT HS256 (72h) · bcrypt |

> Dự án viết cho mục đích portfolio: **phân quyền thật trên từng API** chứ không chỉ ẩn/hiện nút trên giao diện, toàn bộ query SQL đều parameterized.

---

## ✨ Tính năng

### Cho nhân viên (Employee)
- Đăng ký tài khoản (mặc định role employee), tạo ticket kèm file đính kèm
- Theo dõi vòng đời ticket của **chính mình** — request ticket của người khác trả về 404
- Chat realtime trên ticket, reply theo luồng, **@mention** đồng nghiệp
- Nhận thông báo khi IT phản hồi / đổi trạng thái
- **Đánh giá ★ 1–5 sao** kèm nhận xét sau khi ticket hoàn thành
- Hủy ticket khi còn ở trạng thái mở
- Xuất CSV danh sách ticket, in phiếu yêu cầu

### Cho bộ phận IT (IT Support)
- Xem hàng chờ toàn hệ thống, lọc theo trạng thái / ưu tiên / danh mục
- Nhận ticket cho mình (claim) hoặc gán cho chuyên viên khác
- Cập nhật trạng thái xử lý theo đúng quy trình
- Quản lý **tài sản IT** (gán thiết bị, theo dõi sửa chữa / thanh lý)

### Cho quản trị (Admin)
- Tạo tài khoản với mọi vai trò, khóa / mở khóa (không thể tự khóa chính mình)
- **Reset mật khẩu** — hệ thống sinh mật khẩu tạm ngẫu nhiên 10 ký tự, hiển thị một lần
- Quản lý phòng ban, xem thống kê toàn hệ thống

---

## 🔄 Vòng đời Ticket & SLA

```
open → assigned → in_progress → waiting → resolved → closed
  └──────────────────────────────────→ rejected
```

Hạn xử lý (SLA deadline) tự tính theo mức ưu tiên lúc tạo ticket:

| Ưu tiên | Hạn xử lý |
| --- | --- |
| 🚨 Khẩn cấp | 4 giờ |
| Cao | 24 giờ |
| Trung bình | 48 giờ |
| Thấp | 72 giờ |

Quá hạn → badge đỏ **QUÁ HẠN SLA** trên danh sách và chi tiết ticket.

---

## 🚀 Chạy dự án

**Yêu cầu:** Go 1.22+ · Node.js 18+ · npm 9+

### 1. Backend (port 8080)

```bash
cd server
go mod tidy
go run main.go
```

Lần đầu chạy, SQLite tự tạo `server/helpdesk.db`, seed 6 phòng ban, 8 danh mục và tài khoản admin. Các lần nâng cấp schema sau chạy an toàn qua `ALTER TABLE` migration (không mất dữ liệu).

### 2. Frontend (port 5173)

```bash
cd client
npm install
npm run dev
```

Mở `http://localhost:5173`. Vite proxy sẵn `/api`, `/ws`, `/uploads` sang backend.

---

## 🔐 Cấu hình bắt buộc trước khi dùng thật

Đặt biến môi trường `JWT_SECRET` — secret dùng để ký JWT. Xem mẫu trong `.env.example`:

```bash
# Windows PowerShell
$env:JWT_SECRET = "chuoi-dai-ngau-nhien-it-nhat-32-ky-tu"

# macOS / Linux
export JWT_SECRET="chuoi-dai-ngau-nhien-it-nhat-32-ky-tu"
```

> Không đặt biến này thì server dùng fallback chỉ dành cho dev local. **Công khai repo mà dùng fallback = ai cũng giả mạo được token**, nên luôn đặt secret riêng khi chạy demo / deploy.

⚠️ **Tài khoản admin seed:** `admin@company.com` / `12345` — đổi mật khẩu **ngay sau lần đăng nhập đầu tiên** (Trang cá nhân → Đổi mật khẩu) nếu repo của bạn public.

---

## 🛡️ Bảo mật (thực thi trên server)

- **Phân quyền trung tâm:** mọi API ticket qua `canAccessTicket` — employee chỉ chạm được ticket của mình; response 404 thay vì 403 để không lộ sự tồn tại của ticket
- **File đính kèm cần đăng nhập:** `/uploads/*` yêu cầu JWT (header hoặc query param), chặn directory listing
- **Upload được kiểm soát:** whitelist đuôi file (PDF/DOCX/XLSX/PNG/JPG/ZIP), tên file làm sạch + unique, giới hạn cứng 20MB
- **Mật khẩu:** bcrypt, không bao giờ trả về JSON; reset sinh mật khẩu ngẫu nhiên bằng `crypto/rand`
- **Email ẩn với employee:** danh sách user phục vụ @mention nhưng chỉ IT/admin thấy email
- **SQL 100% parameterized** — chống SQL injection
- **CORS + WebSocket origin** giới hạn đúng origin của frontend
- **JWT:** xác thực signing method HS256, hết hạn 72h
- **Race-safe WebSocket hub:** client nghẽn được gỡ đúng luồng qua write lock

---

## 📡 API

| Method | Endpoint | Quyền | Mô tả |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | công khai | Đăng nhập |
| POST | `/api/auth/register` | công khai | Đăng ký (luôn role employee) |
| GET/POST | `/api/tickets` | đăng nhập | Danh sách (scoped theo role) / tạo ticket |
| GET | `/api/tickets/:id` | liên quan | Chi tiết ticket + đính kèm |
| POST | `/api/tickets/:id/status` | theo role | Đổi trạng thái |
| POST | `/api/tickets/:id/assign` | IT/Admin | Gán người xử lý |
| POST | `/api/tickets/:id/rate` | reporter | Đánh giá ★ 1–5 |
| GET/POST | `/api/tickets/:id/comments` | liên quan | Bình luận / @mention |
| POST | `/api/tickets/:id/attachments` | liên quan | Upload ≤ 20MB |
| GET | `/api/tickets/:id/logs` | liên quan | Audit log |
| GET | `/api/stats` | đăng nhập | Thống kê dashboard theo role |
| GET | `/api/users` | đăng nhập | Danh sách user (email ẩn với employee) |
| POST | `/api/admin/users` | admin | Tạo user |
| POST | `/api/admin/users/:id/reset-password` | admin | Reset → mật khẩu ngẫu nhiên |
| POST | `/api/admin/users/:id/toggle-status` | admin | Khóa/mở khóa |
| CRUD | `/api/departments` · `/api/assets` · `/api/notifications` | admin / IT | Quản lý phòng ban, tài sản, thông báo |
| WS | `/ws?token=...` | đăng nhập | Realtime events |

---

## 📁 Cấu trúc dự án

```
IT_Support/
├── server/                     # Go backend
│   ├── main.go                # Routes + CORS + uploads
│   ├── db/db.go               # Schema, migration, seed
│   ├── middleware/auth.go     # JWT verify + RequireRole
│   ├── handlers/
│   │   ├── access.go          # Trung tâm phân quyền ticket
│   │   ├── auth.go            # Login/register/profile
│   │   ├── tickets.go         # Vòng đời + SLA + rating
│   │   ├── comments.go        # Bình luận + @mention
│   │   ├── attachments.go     # Upload file
│   │   ├── users.go           # Quản lý user (admin)
│   │   ├── assets.go          # Tài sản IT
│   │   └── stats.go           # Dashboard
│   ├── ws/hub.go              # WebSocket hub race-safe
│   └── models/                # Struct + JSON tags
└── client/                     # React frontend
    ├── src/services/api.js    # Fetch wrapper + JWT header
    ├── src/context/           # Auth + Notification (WS)
    ├── src/components/        # Sidebar, Navbar, Modal, Badge
    └── src/pages/             # Login, Dashboard, Tickets,
                                # Users, Assets, Departments, Profile
```

---

## Tác giả

Được xây dựng bởi [Dương Thế Khải](https://github.com/itkhair05).