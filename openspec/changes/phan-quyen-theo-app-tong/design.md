## Context

Level app Đấu thầu: BOOD = Level 1 Trưởng phòng, MANAGER = Level 2, STAFF = Level 3, VIEWER = Level 4. App Tổng lưu ở `app_permissions/{uid}.dauthau` (project hpcons-portal), owner App Tổng là `users/{uid}.role === "owner"`. Hồ sơ nhân sự `staff/{uid}` ở project hpcons-dauthau, trình duyệt đồng bộ cả collection bằng `pushCollection`.

## Goals / Non-Goals

**Goals:** App Tổng là nguồn duy nhất; Trưởng phòng đổi Level 2/3/4 cho người khác trong app; luật kiểm ở máy chủ; có nhật ký.

**Non-Goals:** cấp/thu hồi quyền vào app (vẫn ở App Tổng); đổi Firestore rules production; sửa trang "Quản lý ứng dụng" của App Tổng.

## Decisions

- **Luật là hàm thuần** `quyetDinhDoiLevel` trong `src/lib/phanQuyenLevel.ts`, không import máy chủ, để kiểm bằng Node thuần và dùng chung cho giao diện (`lyDoKhoaLevel`).
- **Đọc sống trong transaction App Tổng**: route đọc `app_permissions` và `users` của người gọi và người đích bằng `tx.getAll`, không qua `unstable_cache` 30 giây của `fetchCentralRole`. Ghi `app_permissions/{uid}` (merge `dauthau`) và `activity_logs` trong cùng transaction, nên có người đổi đồng thời thì transaction chạy lại.
- **Hồ sơ staff cập nhật sau**, trong transaction riêng của project Đấu thầu (hai project không chung transaction). Lỗi ở bước này: App Tổng đã lưu, trả 500 kèm `daLuuAppTong`, hồ sơ tự khớp khi người đó đăng nhập lại.
- **Chức vụ** (`tinhChucVuMoi`): trống hoặc đúng mặc định của level cũ thì đổi sang mặc định của level mới; khác mặc định thì giữ.
- **Nhật ký**: ghi `activity_logs` của App Tổng cùng dạng với `account.hpcore.vn/api/activity` (appName "HPC Đấu Thầu", thêm `levelCu`, `levelMoi`); máy người đổi thêm dòng nhật ký cục bộ nhưng không gửi `reportActivity` lần nữa.
- **Tạo nhân sự mới**: danh bạ trả thêm `levelAppTong` (một truy vấn `in` trên `app_permissions.dauthau`); hồ sơ mới mang đúng level đó; người chưa có quyền ở App Tổng không thêm được.

## Risks / Trade-offs

- Rules Firestore ngoài repo: nếu rules cho phép, trình duyệt vẫn ghi được `staff.role` trực tiếp, gây lệch tạm thời tới lần đăng nhập kế tiếp của người đó (SSO ghi lại theo App Tổng).
- Owner đổi ở App Tổng: người đó thấy ở lần tải trang kế tiếp, chậm nhất khoảng 30 giây do cache.
