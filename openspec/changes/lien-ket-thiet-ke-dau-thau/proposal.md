## Why

Phòng Đấu thầu và Phòng Thiết kế đang làm cùng một dự án trên hai app riêng (dauthau.hpcore.vn / tk.hpcore.vn, hai Firebase project khác nhau) nhưng không nhìn thấy dữ liệu của nhau. Mỗi app đã làm sẵn một nửa đường nối (15/09/2026 bên này làm cổng nhận tiến độ, bên Thiết kế làm nút "Share sang Đấu thầu") nhưng hai nửa **không khớp**: khác cách xác thực (Bearer vs HMAC), khác hình dạng dữ liệu (tóm tắt theo dự án vs từng dòng Gantt). Và chiều Đấu thầu → Thiết kế chưa có gì. Sếp chốt phạm vi 26/09/2026.

Change này là **nửa phía App Đấu thầu**. Nửa phía App Thiết kế nằm ở change cùng tên trong repo `HPCons-Design`. Hai change dùng chung một hợp đồng dữ liệu (xem `design.md`).

## What Changes

- **Chiều 2 — Đấu thầu gửi dự án sang Thiết kế (MỚI):** app bắt đầu gửi đi dữ liệu lần đầu tiên. Chỉ gửi bản ghi **Dự án** (`loaiBanGhi = DU_AN`) có mã ô 1 dạng **`YY10xx-HPCS`** (YY = năm, `10` = mã phòng Đấu thầu, `xx` = 2 ký tự số hoặc chữ), và **chỉ 3 trường**: mã dự án, tên dự án, vị trí. Tự gửi sau khi dữ liệu dự án được lưu (chỉ gửi dự án thật sự đổi) + nút "Đồng bộ lại sang Thiết kế" cho Trưởng phòng.
- **Chiều 1 — nhận tiến độ đầy đủ từ Thiết kế (MỚI):** cổng nhận mới, xác thực HMAC cùng kiểu với App Thiết kế, nhận đủ các dòng công việc của trang Tiến độ (tên công việc, người thực hiện, ngày bắt đầu, ngày kết thúc, tình trạng, trễ hạn, nội dung thay đổi) cho từng mã dự án. Chỉ đến khi Trưởng nhóm Thiết kế bấm "Share sang Đấu thầu".
- **Hiển thị:** tab "Liên kết phòng ban" → khối Tiến độ thiết kế thêm bảng **chi tiết công việc** theo mã dự án, chỉ xem.
- **Giữ nguyên:** cổng nhận tóm tắt cũ `/api/webhook/tien-do-thiet-ke` (Bearer) và cổng `/api/webhook/du-an-tong` — không xoá, không đổi hành vi.

## Capabilities

### New Capabilities
- `gui-du-an-sang-thiet-ke`: lọc dự án theo mã phòng Đấu thầu, dựng sự kiện ký HMAC, gửi sang App Thiết kế khi dữ liệu đổi, ghi trạng thái gửi, nút đồng bộ lại.
- `nhan-tien-do-thiet-ke-chi-tiet`: cổng nhận tiến độ đầy đủ ký HMAC, lưu theo mã dự án, hiển thị bảng chi tiết trong tab Liên kết phòng ban.

### Modified Capabilities
<!-- Chưa có spec nào trong openspec/specs/ — repo vừa khởi tạo OpenSpec 26/09/2026. -->

## Impact

- **Mã mới:** `src/lib/webhookHmac.ts` (ký/kiểm HMAC, chép theo `webhook-receiver.ts` + `webhook-envelope.ts` của App Thiết kế), `src/lib/maPhongBan.ts` (luật lọc `YY10xx-HPCS`), `app/api/lien-ket/thiet-ke/dong-bo/route.ts` (gửi đi), `app/api/webhook/tien-do-thiet-ke-chi-tiet/route.ts` (nhận), `app/api/tien-do-thiet-ke-chi-tiet/route.ts` (UI đọc).
- **Sửa:** `src/App.tsx` (gọi đồng bộ sau khi đẩy `projects` thành công), `TienDoThietKePanel.tsx` (bảng chi tiết).
- **Firestore (project `hpcons-dauthau`):** 2 collection mới, chỉ Admin SDK ghi: `lien_ket_thiet_ke/{projectDocId}` (dấu vân tay + trạng thái lần gửi), `tien_do_thiet_ke_chi_tiet/{maDuAn}`.
- **Biến môi trường mới (Vercel):** `WEBHOOK_SECRET_DT_PTK` (dùng chung với App Thiết kế, cả hai chiều), `THIET_KE_WEBHOOK_URL=https://tk.hpcore.vn/api/webhooks/incoming`.
- **Phụ thuộc change bên App Thiết kế:** bên đó phải deploy cổng nhận đã sửa (nhận `externalId` dạng chuỗi, gắn secret với nguồn) TRƯỚC khi bên này bật gửi.
