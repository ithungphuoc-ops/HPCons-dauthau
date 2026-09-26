## Context

Hai app độc lập, hai Firebase project (`hpcons-dauthau`, `hpcons-thietke`), không app nào đọc thẳng database của app kia — chỉ trao đổi qua HTTP webhook. App Thiết kế đã chạy thật cơ chế webhook HMAC với Phòng Kinh doanh từ 17/07/2026 (`/api/webhooks/incoming`, pattern đã test ở `webhook-link-test/`). App Đấu thầu hiện chỉ có cổng nhận Bearer (15/09/2026) và **chưa gửi gì ra ngoài**.

Đặc điểm của app này ảnh hưởng thiết kế:
- Trình duyệt ghi cả collection `projects` qua `pushCollection` (`src/App.tsx:1951`) — không có một route máy chủ "lưu dự án" để móc vào.
- Mã dự án ô 1 (`projectId`) **nhập tay**, có nhiều kiểu (`261008-HPCS`, `260039-HPCS`, `2026.01`). `maHoSo()` ghép thêm `maNoiBo` — chuỗi ghép KHÔNG dùng để nối.
- Tiến độ thiết kế tóm tắt đã có collection `tien_do_thiet_ke` + panel chỉ xem.

## Goals / Non-Goals

**Goals:**
- Gửi 3 trường (mã, tên, vị trí) của dự án phòng Đấu thầu sang trang "Phòng ban" của App Thiết kế, để Trưởng nhóm Thiết kế chọn mã khi tạo dự án.
- Nhận đủ tiến độ Gantt mà Thiết kế bấm Share, hiển thị theo mã dự án.

**Non-Goals:**
- Không gửi công việc con (`CONG_VIEC`), giá, nhân sự, tài liệu, trạng thái thầu.
- Không xoá bên Thiết kế khi dự án đổi mã ra khỏi dạng `YY10xx` hoặc bị xoá bên này (Sếp chốt giữ nguyên, an toàn hơn).
- Không đổi/xoá cổng Bearer cũ `/api/webhook/tien-do-thiet-ke`.
- Không chuyển mã dự án sang do "App Thông tin dự án" cấp — ngoài phạm vi.

## HỢP ĐỒNG DỮ LIỆU CHUNG (giống hệt bản trong change cùng tên ở repo HPCons-Design)

**Phong bì + chữ ký** — đúng `webhook-envelope.ts` / `webhook-receiver.ts` của App Thiết kế:
```ts
type WebhookEvent<T> = { event_id: string; event_type: string; source_app: string; timestamp: string; data: T }
// Header: x-webhook-signature = hex(HMAC-SHA256(secret, rawBody))
//         x-webhook-timestamp = event.timestamp   (bên nhận BẮT BUỘC so khớp với body.timestamp)
// Lệch quá 5 phút → 401. event_id đã xử lý → trả { ok:true, deduped:true }.
```
**Một secret cho cặp app, dùng cả hai chiều:** `WEBHOOK_SECRET_DT_PTK`. Bên nhận **gắn secret với nguồn** — ký bằng secret này thì `source_app` phải đúng giá trị của cặp, sai → 401.

**Luật mã phòng Đấu thầu** (hàm thuần, hai bên cùng một biểu thức):
```
chuẩn hoá: bỏ mọi khoảng trắng, viết HOA
khớp:      ^\d{2}10[A-Z0-9]{2}-HPCS(-.*)?$
ví dụ đạt: 261008-HPCS · 2610AB-HPCS · 271001-HPCS · 261008-HPCS-BG-JYL
không đạt: 260039-HPCS (phòng 00) · 2026.01 · 261008HPCS · 26100-HPCS
```

**Chiều 2 — `du_an.cap_nhat`, `source_app = "dau_thau"`** (Đấu thầu → `https://tk.hpcore.vn/api/webhooks/incoming`):
```ts
data: {
  externalId: string    // ID tài liệu Firestore của bản ghi DU_AN bên này — KHÔNG BAO GIỜ đổi, là khoá upsert
  projectCode: string   // mã ô 1 đã chuẩn hoá, vd "261008-HPCS" — chỉ để hiển thị/ghép
  projectName: string   // tenDuAn
  location: string      // diaChi; trống thì ghép "khuCongNghiep, tinhThanh" (bỏ phần rỗng)
}
```
**Chiều 1 — `tien_do.chia_se`, `source_app = "ptk"`** (Thiết kế → `https://dauthau.hpcore.vn/api/webhook/tien-do-thiet-ke-chi-tiet`), **mỗi dự án một sự kiện**:
```ts
data: {
  maDuAn: string        // projectCode bên Thiết kế, đã qua luật mã phòng Đấu thầu
  tenDuAn: string
  viewMode: 'planned' | 'actual' | 'combined'
  sharedByName: string
  sharedAt: string      // ISO
  rows: Array<{ id; title; assigneeName; status; startDate; endDate; overdue: boolean; changeNote; source: 'planned'|'actual' }>
}
```

## Decisions

**1. Gửi từ máy chủ, không tin dữ liệu trình duyệt.** Route `POST /api/lien-ket/thiet-ke/dong-bo` (đòi ID token đăng nhập app này) **tự đọc `projects` bằng Admin SDK**, không nhận danh sách dự án từ client. Lý do: secret không được xuống trình duyệt, và client có thể gửi dữ liệu cũ/sai.

**2. Chỉ gửi cái thật sự đổi — dấu vân tay.** Với mỗi DU_AN đạt luật mã, tính băm của `{projectCode, projectName, location}`; so với `lien_ket_thiet_ke/{docId}.dauVanTay`; chỉ gửi khi khác, gửi xong mới ghi dấu mới + `trangThai/loi/guiLuc`. Nhờ vậy gọi route bao nhiêu lần cũng không bắn lặp, tránh lặp lại sự cố vòng lặp ghi của app khác.

**3. Kích hoạt:** (a) trình duyệt gọi route sau khi `pushCollection('projects')` thành công, **gom nhịp 5 giây**; (b) nút "Đồng bộ lại sang Thiết kế" (chỉ BOOD) — gửi lại mọi dự án đang lỗi hoặc chưa gửi. Không làm cron: bấm tay đủ cho vài chục dự án/năm.

**4. Chỉ DU_AN, khoá = ID tài liệu.** Không dùng mã làm khoá vì mã gõ tay (bài học PKD 17/07/2026: đổi mã → bên Thiết kế đẻ dòng trùng). Hồ sơ cũ không có `loaiBanGhi` được coi là CONG_VIEC → không gửi.

**5. Cổng nhận chi tiết là route MỚI, không sửa route Bearer cũ.** Route cũ có thể đang được ai đó dùng; hai cơ chế xác thực trên cùng một địa chỉ dễ nhầm. Lưu `tien_do_thiet_ke_chi_tiet/{docIdTuMa(maDuAn)}` bằng `set` **không merge** (dòng đã xoá bên Thiết kế phải biến mất bên này — cùng lý do route cũ đã ghi).

**6. Không lưu email người phụ trách** — chỉ tên. Phòng Đấu thầu không cần email để theo dõi.

## Risks / Trade-offs

- **[Rủi ro] Thiết kế chưa gắn mã cho dự án đang chạy** (ví dụ "26-JYULONG-GD3" cột Mã dự án đang "—") → Share không có gì để gửi. Giảm thiểu: chiều 2 làm trước; bên Thiết kế trả thông báo rõ "chưa dự án nào gắn mã Đấu thầu".
- **[Rủi ro] Hạn mức Firestore** khi route đọc toàn bộ `projects` mỗi lần gọi → gom nhịp 5 giây + chỉ đọc 1 lần/lượt; số dự án nhỏ (hàng chục).
- **[Đánh đổi] Không tự xoá bên Thiết kế** → trang Phòng ban có thể còn dự án đã đổi mã. Chấp nhận theo chỉ đạo.
- **[Rủi ro] Hai phiên cùng làm repo này** (bàn giao IT 19/09) → làm trên nhánh riêng + PR, kiểm `master` trước khi push.

## Migration Plan

1. Deploy bên **Thiết kế** trước (cổng nhận đã sửa) — bên nhận sẵn sàng trước bên gửi.
2. Sinh secret mạnh, đặt `WEBHOOK_SECRET_DT_PTK` ở Vercel **cả hai app** + `THIET_KE_WEBHOOK_URL` ở app này; deploy.
3. Trưởng phòng bấm "Đồng bộ lại sang Thiết kế" một lần để nạp các dự án đang có.
4. Kiểm: dự án `2610xx` hiện trên trang Phòng ban bên Thiết kế; `260039-HPCS`, `2026.01` không hiện.
5. Thiết kế gắn mã → bấm Share → bảng chi tiết hiện bên này.
6. Lùi: gỡ `THIET_KE_WEBHOOK_URL` → route gửi thành "chưa cấu hình", không lỗi nghiệp vụ nào.

## Open Questions

- Vị trí: `diaChi` trống thì ghép KCN + tỉnh — Sếp có muốn luôn ghép cả ba không?
- Hồ sơ cũ chỉ có CONG_VIEC mang mã `2610xx` mà không có DU_AN cha → hiện không gửi. Có cần xử lý không?
