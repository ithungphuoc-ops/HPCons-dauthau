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

### Requirement: Lưu tiến độ theo khoá dự án Thiết kế, ghi đè nguyên khối
Với sự kiện `tien_do.chia_se` (hợp đồng bản 2, sửa 26/09/2026 theo demo bản 02), hệ thống SHALL bắt buộc `khoaDuAn` khớp `^[A-Za-z0-9_-]{1,128}$` và không có dạng `__...__`, SHALL bắt buộc `tenDuAn` không rỗng, SHALL chuẩn hoá `maDuAn` (bỏ khoảng trắng, viết hoa) và SHALL chấp nhận `maDuAn` rỗng hoặc mã của bất kỳ phòng nào (SHALL NOT đòi luật mã phòng Đấu thầu). Hệ thống SHALL ghi `tien_do_thiet_ke_chi_tiet/{khoaDuAn}` bằng thao tác ghi đè không merge gồm `khoaDuAn`, `maDuAn`, `tenDuAn`, `viewMode`, `sharedByName`, `sharedAt`, `rows`, `nhanLuc`, SHALL bỏ qua bản có `sharedAt` cũ hơn bản đang lưu, và SHALL NOT lưu email người phụ trách.

#### Scenario: Công việc bị xoá bên Thiết kế
- **WHEN** lần Share trước có 8 dòng, lần sau có 7 dòng
- **THEN** bên Đấu thầu chỉ còn 7 dòng

#### Scenario: Dự án chưa gắn mã
- **WHEN** `maDuAn` là `""`, `khoaDuAn` và `tenDuAn` hợp lệ
- **THEN** nhận và lưu bình thường tại `tien_do_thiet_ke_chi_tiet/{khoaDuAn}`

#### Scenario: Mã của phòng khác
- **WHEN** `maDuAn` là `260039-HPCS`
- **THEN** nhận và lưu, không từ chối theo luật mã

#### Scenario: Khoá dự án sai dạng
- **WHEN** `khoaDuAn` là `../x` hoặc bị thiếu
- **THEN** trả 400, không ghi

#### Scenario: Thiếu tên dự án
- **WHEN** `tenDuAn` rỗng hoặc thiếu
- **THEN** trả 400, không ghi

### Requirement: Hiển thị kiểu trang Tiến độ kèm Gantt
Tab "Liên kết phòng ban", khung "Tiến độ thiết kế — Phòng Thiết kế" SHALL hiển thị mọi bản đã nhận theo kiểu trang Tiến độ bên App Thiết kế: gom theo dự án (dòng dự án gồm mã hoặc "—", tên dự án, số công việc và số trễ hạn, khoảng ngày, trạng thái tổng), bấm để mở/đóng từng công việc; các cột Mã dự án, Dự án, Tên công việc, Người thực hiện, Thời gian, Ngày bắt đầu, Ngày kết thúc, Tình trạng, Nội dung thay đổi và cột Gantt theo tuần (nhãn ngày đầu tuần, thanh màu theo người, vạch "Hôm nay"); chú thích "Màu theo người"; dòng "Thiết kế chia sẻ lúc … bởi …" lấy lần chia sẻ mới nhất; ô tìm theo mã, tên dự án, công việc. Khung SHALL chỉ xem, SHALL cuộn ngang trong khung trên màn hình hẹp mà không làm trang tràn ngang, và SHALL NOT còn khối chi tiết theo từng mã của bản 01.

#### Scenario: Chưa có chia sẻ
- **WHEN** App Thiết kế chưa từng Share
- **THEN** hiện "Phòng Thiết kế chưa chia sẻ tiến độ"

#### Scenario: Mở một dự án
- **WHEN** người dùng bấm vào dòng dự án
- **THEN** hiện các dòng công việc của dự án đó, dòng trễ hạn chữ đỏ

### Requirement: Quyền xem của Chuyên viên với bản không mã
`GET /api/tien-do-thiet-ke-chi-tiet` SHALL trả mọi bản cho vai trò khác STAFF. Với STAFF, hệ thống SHALL chỉ trả bản có `maDuAn` khác rỗng và thuộc tập mã gói được giao (ghép theo `projectId`), SHALL NOT trả bản chưa gắn mã, và SHALL trả kèm số bản bị ẩn để giao diện hiện câu nhắc.

#### Scenario: Chuyên viên và dự án chưa mã
- **WHEN** Chuyên viên mở khung, có một bản `maDuAn` rỗng
- **THEN** không thấy bản đó, thấy câu nhắc "Đang ẩn 1 dự án chưa có mã hoặc không thuộc gói của bạn"

#### Scenario: Trưởng phòng xem tất cả
- **WHEN** Trưởng phòng mở khung
- **THEN** thấy cả bản có mã và bản chưa mã
