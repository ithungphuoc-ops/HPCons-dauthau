## Why

Sếp cấp "Phòng Đấu Thầu" Level 1 ở App Tổng nhưng vào app Đấu thầu vẫn là Level 4. Nguyên nhân: từ 17/08/2026 route SSO giữ nguyên `role` của hồ sơ `staff/{uid}` đã có, không đọc lại App Tổng, nên quyền hai nơi lệch nhau. Sếp duyệt demo `tong-quan-demo/HPCons-DauThau/phan-quyen-theo-app-tong-2026-09-28/index.html` ngày 28/09/2026: App Tổng là nơi giữ quyền duy nhất, Trưởng phòng vẫn nâng/hạ level dưới cấp trong app nhưng thay đổi ghi thẳng về App Tổng.

## What Changes

- Route SSO `app/api/auth/hpcore-session`: `role` luôn lấy từ App Tổng (`app_permissions/{uid}.dauthau`) ở mỗi lần đăng nhập. Chức vụ mặc định đi theo level, chức vụ tự đặt được giữ. Đảo quyết định 17/08/2026.
- Route máy chủ mới `POST /api/phan-quyen/level`: Trưởng phòng (hoặc owner App Tổng) đổi level người khác trong Level 2/3/4; kiểm luật ở máy chủ bằng dữ liệu đọc sống; ghi App Tổng, hồ sơ `staff` và nhật ký `activity_logs` của App Tổng. `GET` trả danh sách owner để giao diện khoá ô.
- "Đội ngũ & KPI": ô level trong hộp sửa nhân sự gọi route mới, chỉ có Level 2/3/4, khoá kèm lý do; tạo nhân sự mới lấy đúng level App Tổng; khôi phục sao lưu không đổi level.

## Capabilities

### New Capabilities
- `phan-quyen-level`: App Tổng là nguồn level duy nhất; luật Trưởng phòng đổi level trong app; ghi nhật ký.

### Modified Capabilities

## Impact

- `app/api/auth/hpcore-session/route.ts`, `app/api/phan-quyen/level/route.ts` (mới), `app/api/staff-directory/route.ts`, `src/lib/phanQuyenLevel.ts` (mới), `src/components/StaffEditModal.tsx`, `src/components/StaffDirectoryPicker.tsx`, `src/App.tsx`.
- Ghi vào project App Tổng (hpcons-portal): `app_permissions/{uid}.dauthau`, `activity_logs`.
- Firestore rules không nằm trong repo: trình duyệt vẫn có thể ghi `staff.role` trực tiếp nếu rules cho phép; lần đăng nhập kế tiếp sẽ trả về level App Tổng.
