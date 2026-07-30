# HP-CONS ERP — Báo cáo Tiến độ Phòng Đấu Thầu

Ứng dụng nội bộ quản lý & báo cáo tiến độ hồ sơ đấu thầu (Kanban 7 bước, KPI, dashboard).
Đăng nhập qua SSO của App Tổng (account.hpcore.vn), dữ liệu đồng bộ realtime qua Firebase.

Hướng dẫn triển khai đầy đủ (biến môi trường, build, bàn giao): xem [HUONG-DAN-CHO-IT.md](HUONG-DAN-CHO-IT.md).
Design system dùng chung của HPCons: xem [docs/design-system/](docs/design-system/).

## Công nghệ

- **Next.js 15** (App Router) + React 19 + TypeScript + Tailwind CSS v4.
- **Firebase**: Auth (đăng nhập) + Firestore (đồng bộ dữ liệu realtime giữa các máy) — project riêng `hpcons-dauthau`.
- **API routes** (`app/api/`): cầu nối SSO với App Tổng, lọc/nhập dự án.
- **Electron** (tùy chọn): đóng gói bản desktop Windows chạy độc lập.

## Chạy thử (development)

**Yêu cầu:** Node.js LTS.

```bash
npm install
npm run dev        # → http://localhost:3000
```

Cần cấu hình `.env.local` trước khi chạy — xem mẫu ở [.env.example](.env.example) và
chi tiết từng biến trong [HUONG-DAN-CHO-IT.md](HUONG-DAN-CHO-IT.md).

Muốn thử app mà chưa cấu hình SSO/Firebase: đặt `NEXT_PUBLIC_DEV_SANDBOX=1` trong `.env.local`
để vào thẳng "Bản thử" (màn chọn vai trò, dữ liệu chỉ lưu trong trình duyệt). **Không bật biến
này trên môi trường production.**
