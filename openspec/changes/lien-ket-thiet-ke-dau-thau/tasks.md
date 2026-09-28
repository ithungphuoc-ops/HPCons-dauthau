## 1. Nền tảng dùng chung

- [x] 1.1 `src/lib/maPhongBan.ts`: hàm thuần `chuanHoaMaDuAn` + `laMaPhongDauThau` theo luật `^\d{2}10[A-Z0-9]{2}-HPCS(-.*)?$`; kèm bộ ca kiểm (đạt/không đạt trong design.md)
- [x] 1.2 `src/lib/webhookHmac.ts`: `createEvent`, `signWebhookEvent`, `verifyWebhookSignature` chép nguyên theo App Thiết kế + kiểm header timestamp khớp `body.timestamp`
- [x] 1.3 Khai `WEBHOOK_SECRET_DT_PTK`, `THIET_KE_WEBHOOK_URL` vào `.env.example` (không có giá trị)

## 2. Chiều 2 — gửi dự án sang Thiết kế

- [x] 2.1 Route `POST /api/lien-ket/thiet-ke/dong-bo`: kiểm đăng nhập (dùng đúng cơ chế sẵn có của app: cookie phiên App Tổng + quyền `dauthau`, thay cho "ID token"), đọc `projects` bằng Admin SDK, lọc DU_AN + luật mã, dựng 3 trường + `location` dự phòng
- [x] 2.2 Dấu vân tay + collection `lien_ket_thiet_ke/{docId}`; chỉ gửi khi đổi; lỗi thì không cập nhật dấu
- [x] 2.3 Trả tổng kết `{ daGui, boQua, loi, chuaCauHinh }`
- [x] 2.4 `src/App.tsx`: gọi route sau `pushCollection('projects')` thành công, gom nhịp 5 giây, lỗi chỉ ghi console
- [x] 2.5 Nút "Đồng bộ lại sang Thiết kế" (chỉ BOOD) trong tab Liên kết phòng ban, hiện tổng kết

## 3. Chiều 1 — nhận tiến độ chi tiết

- [x] 3.1 Route `POST /api/webhook/tien-do-thiet-ke-chi-tiet`: HMAC, 5 phút, `source_app = "ptk"`, chống trùng qua `processed_events/{event_id}`
- [x] 3.2 Kiểm luật mã, ghi đè `tien_do_thiet_ke_chi_tiet/{docIdTuMa(maDuAn)}`, bỏ email
- [x] 3.3 `GET` cùng địa chỉ trả `daCauHinhSecret` cho IT kiểm (giống route cũ)
- [x] 3.4 Route `GET /api/tien-do-thiet-ke-chi-tiet` cho giao diện (đòi đăng nhập có quyền `dauthau`)
- [x] 3.5 `TienDoThietKePanel.tsx`: bảng chi tiết theo mã, dòng "chia sẻ lúc … bởi …", áp luật lọc Chuyên viên

## 4. Kiểm và bàn giao

- [x] 4.1 Kiểm cục bộ: chữ ký sai → 401; gửi trùng → deduped; timestamp lệch → 401; mã `260039-HPCS` → 400 — đã chạy thật trên `next start` cục bộ: 401 chữ ký sai / timestamp lệch / header≠thân / source_app sai, 400 mã `260039-HPCS`. RIÊNG ca "gửi trùng → deduped" CHƯA chạy thật (cần ghi Firestore; `.env.local` trỏ project thật) — logic nằm trong transaction ở route, kiểm lại ở 4.5
- [x] 4.2 `npm run build` + lint sạch
- [ ] 4.3 Chờ App Thiết kế deploy cổng nhận đã sửa, rồi mới đặt biến môi trường production
- [ ] 4.4 Kiểm thật: bấm "Đồng bộ lại" → dự án `2610xx` hiện trên trang Phòng ban bên Thiết kế; `260039-HPCS`, `2026.01` không hiện
- [ ] 4.5 Kiểm thật: Thiết kế gắn mã + bấm Share → bảng chi tiết hiện bên này

## 5. Bản 02 — nguyên trang Tiến độ sang Đấu thầu (sửa 26/09/2026 theo demo bản 02 Sếp duyệt)

- [x] 5.1 Cổng nhận: bỏ luật mã `YY10xx`; bắt buộc `khoaDuAn` (regex, chặn `__...__`) + `tenDuAn`; `maDuAn` cho phép rỗng; doc ID = `khoaDuAn`; giữ HMAC/5 phút/header=thân/`ptk`/chống trùng/chặn bản cũ/ghi đè/bỏ email/giới hạn dòng
- [x] 5.2 `tienDoThietKeChiTietTypes.ts`: thêm `khoaDuAn` + `LUAT_KHOA_DU_AN`
- [x] 5.3 `GET /api/tien-do-thiet-ke-chi-tiet`: vai trò khác STAFF xem hết; STAFF chỉ bản có mã thuộc gói được giao; trả `soBiAn`; bỏ bản kiểu bản 01
- [x] 5.4 `TienDoThietKePanel.tsx`: khung kiểu trang Tiến độ + Gantt tuần + vạch Hôm nay + màu theo người + tìm kiếm + câu nhắc Chuyên viên; bỏ khối chi tiết theo mã và bảng tóm tắt `/api/tien-do-thiet-ke`; bỏ prop `dsMaDuAn` ở `App.tsx`; dữ liệu mẫu Bản thử theo hợp đồng bản 2
- [x] 5.5 Kiểm cục bộ `next start`: 400 `khoaDuAn` sai (`../x`), 400 thiếu `tenDuAn`, 401 các ca chữ ký; ảnh 1280px/375px, trang không tràn ngang ở 375px; `tsc` + `build`
- [ ] 5.6 App Thiết kế đổi bên gửi theo hợp đồng bản 2 (thêm `khoaDuAn`, gửi cả dự án chưa mã) — phía repo Thiết kế
- [ ] 5.7 Kiểm thật sau deploy: Share bên Thiết kế → khung hiện đủ dự án + Gantt; Chuyên viên không thấy dự án chưa mã
