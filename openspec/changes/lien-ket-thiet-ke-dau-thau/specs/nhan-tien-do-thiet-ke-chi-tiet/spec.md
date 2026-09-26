## ADDED Requirements

### Requirement: Cổng nhận tiến độ chi tiết ký HMAC
Route `POST /api/webhook/tien-do-thiet-ke-chi-tiet` SHALL kiểm chữ ký HMAC-SHA256 trên thân gốc bằng `WEBHOOK_SECRET_DT_PTK`, SHALL từ chối khi `x-webhook-timestamp` lệch quá 5 phút hoặc khác `timestamp` trong thân, SHALL từ chối khi `source_app` khác `"ptk"`, và SHALL bỏ qua (trả `deduped`) sự kiện có `event_id` đã xử lý. Chưa cấu hình secret SHALL trả 503.

#### Scenario: Chữ ký sai
- **WHEN** chữ ký không khớp
- **THEN** trả 401, không ghi gì

#### Scenario: Gửi lại sự kiện cũ
- **WHEN** cùng `event_id` đến lần thứ hai
- **THEN** trả `{ ok: true, deduped: true }`, không ghi lại

#### Scenario: Sửa timestamp ở header
- **WHEN** header timestamp mới nhưng `timestamp` trong thân là 1 giờ trước
- **THEN** trả 401

### Requirement: Lưu tiến độ theo mã dự án, ghi đè nguyên khối
Với sự kiện `tien_do.chia_se`, hệ thống SHALL chuẩn hoá `maDuAn`, SHALL từ chối (400) nếu mã không đạt luật mã phòng Đấu thầu, và SHALL ghi `tien_do_thiet_ke_chi_tiet/{docIdTuMa(maDuAn)}` bằng thao tác ghi đè không merge gồm `maDuAn`, `tenDuAn`, `viewMode`, `sharedByName`, `sharedAt`, `rows`, `nhanLuc`. Hệ thống SHALL NOT lưu email người phụ trách.

#### Scenario: Công việc bị xoá bên Thiết kế
- **WHEN** lần Share trước có 8 dòng, lần sau có 7 dòng
- **THEN** bên Đấu thầu chỉ còn 7 dòng

#### Scenario: Mã không thuộc phòng Đấu thầu
- **WHEN** `maDuAn` là `260039-HPCS`
- **THEN** trả 400, không ghi

### Requirement: Hiển thị bảng chi tiết công việc
Tab "Liên kết phòng ban", khối Tiến độ thiết kế SHALL có bảng chi tiết theo mã dự án với các cột: Tên công việc, Người thực hiện, Ngày bắt đầu, Ngày kết thúc, Tình trạng, Trễ hạn, Nội dung thay đổi; kèm dòng "Thiết kế chia sẻ lúc … bởi …". Bảng SHALL chỉ xem, và SHALL áp đúng luật lọc hiện có cho Chuyên viên (chỉ thấy mã thuộc gói mình được giao, ghép theo `projectId`).

#### Scenario: Chưa có chia sẻ
- **WHEN** mã dự án chưa từng được Thiết kế Share
- **THEN** hiện "Phòng Thiết kế chưa chia sẻ tiến độ cho mã này"

#### Scenario: Chuyên viên xem mã không được giao
- **WHEN** Chuyên viên không được giao gói nào mang mã đó
- **THEN** không thấy bảng của mã đó
