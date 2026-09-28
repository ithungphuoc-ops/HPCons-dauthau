## 1. Luật và route

- [x] 1.1 `src/lib/phanQuyenLevel.ts`: hàm thuần `quyetDinhDoiLevel`, `tinhChucVuMoi`, `lyDoKhoaLevel`
- [x] 1.2 `hpcore-session`: `role` luôn bằng App Tổng, chức vụ theo `tinhChucVuMoi`
- [x] 1.3 `POST/GET /api/phan-quyen/level`: đọc sống, transaction, ghi App Tổng, staff và `activity_logs`
- [x] 1.4 `staff-directory`: trả `levelAppTong`

## 2. Giao diện

- [x] 2.1 `StaffEditModal`: ô level gọi route mới, chỉ Level 2/3/4, khoá kèm lý do; tạo mới theo level App Tổng
- [x] 2.2 `App.tsx`: `handleSaveStaff` không tự đặt role, tải danh sách owner, nhật ký cục bộ, khôi phục sao lưu giữ level, nhãn Level 4

## 3. Kiểm

- [x] 3.1 `npx tsc --noEmit`, `npm run build`
- [x] 3.2 Script kiểm hàm luật thuần (không ghi Firestore thật)
- [x] 3.3 `next start` cục bộ: route mới trả 401 khi không có cookie
- [ ] 3.4 Sếp kiểm bằng tài khoản thật: Trưởng phòng đổi level, trang "Quản lý ứng dụng" App Tổng hiện đúng
