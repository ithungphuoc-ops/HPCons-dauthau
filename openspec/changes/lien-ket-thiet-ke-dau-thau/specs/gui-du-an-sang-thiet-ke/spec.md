## ADDED Requirements

### Requirement: Luật mã phòng Đấu thầu
Hệ thống SHALL coi một dự án là "của phòng Đấu thầu" khi và chỉ khi mã ô 1 (`projectId`), sau khi bỏ mọi khoảng trắng và viết HOA, khớp biểu thức `^\d{2}10[A-Z0-9]{2}-HPCS(-.*)?$` (2 số năm bất kỳ, mã phòng `10`, 2 ký tự số hoặc chữ). Luật SHALL nằm ở một hàm thuần duy nhất, dùng chung cho mọi nơi lọc.

#### Scenario: Mã đúng dạng năm 2026
- **WHEN** `projectId` là `261008-HPCS`
- **THEN** dự án đạt luật mã

#### Scenario: Năm khác vẫn đạt
- **WHEN** `projectId` là `271001-HPCS`
- **THEN** dự án đạt luật mã, không cần sửa mã nguồn theo năm

#### Scenario: Phần xx là chữ, gõ thường, có khoảng trắng
- **WHEN** `projectId` là ` 2610ab-hpcs `
- **THEN** mã được chuẩn hoá thành `2610AB-HPCS` và đạt luật mã

#### Scenario: Mã phòng khác hoặc kiểu cũ
- **WHEN** `projectId` là `260039-HPCS` hoặc `2026.01`
- **THEN** dự án không đạt luật mã và không được gửi đi

### Requirement: Chỉ gửi bản ghi Dự án với ba trường
Hệ thống SHALL chỉ gửi các bản ghi có `loaiBanGhi = "DU_AN"` đạt luật mã, và payload SHALL chỉ gồm `externalId` (ID tài liệu Firestore), `projectCode` (mã ô 1 đã chuẩn hoá), `projectName` (`tenDuAn`), `location`. `location` SHALL là `diaChi`; nếu `diaChi` trống thì ghép `khuCongNghiep`, `tinhThanh`, bỏ phần rỗng. Hệ thống SHALL NOT gửi công việc con, giá trị báo giá, nhân sự hay bất kỳ trường nào khác.

#### Scenario: Công việc con không được gửi
- **WHEN** một bản ghi `CONG_VIEC` có `projectId` `261008-HPCS`
- **THEN** bản ghi đó không được gửi

#### Scenario: Vị trí dự phòng
- **WHEN** DU_AN có `diaChi` trống, `khuCongNghiep` "KCN Chơn Thành", `tinhThanh` "Bình Phước"
- **THEN** `location` gửi đi là "KCN Chơn Thành, Bình Phước"

### Requirement: Gửi từ máy chủ, ký HMAC, chỉ khi dữ liệu đổi
Route `POST /api/lien-ket/thiet-ke/dong-bo` SHALL đòi ID token đăng nhập app, SHALL tự đọc `projects` bằng Admin SDK (không nhận danh sách dự án từ trình duyệt), và với mỗi dự án đạt luật SHALL chỉ gửi sự kiện `du_an.cap_nhat` (`source_app = "dau_thau"`) khi dấu vân tay của ba trường khác lần gửi thành công trước. Sự kiện SHALL ký HMAC-SHA256 bằng `WEBHOOK_SECRET_DT_PTK` theo đúng phong bì App Thiết kế đang dùng. Kết quả mỗi dự án SHALL được ghi vào `lien_ket_thiet_ke/{projectDocId}` (`dauVanTay`, `trangThai`, `loi`, `guiLuc`).

#### Scenario: Lưu lại không đổi gì
- **WHEN** route được gọi hai lần liền mà ba trường không đổi
- **THEN** lần thứ hai không gửi sự kiện nào

#### Scenario: App Thiết kế trả lỗi
- **WHEN** App Thiết kế trả HTTP khác 2xx
- **THEN** `trangThai` ghi `loi`, dấu vân tay KHÔNG được cập nhật, để lần gọi sau gửi lại

#### Scenario: Chưa cấu hình
- **WHEN** thiếu `THIET_KE_WEBHOOK_URL` hoặc `WEBHOOK_SECRET_DT_PTK`
- **THEN** route trả `chua_cau_hinh`, không gửi gì, không làm hỏng việc lưu dự án

#### Scenario: Chưa đăng nhập
- **WHEN** gọi route không có ID token hợp lệ
- **THEN** trả 401

### Requirement: Kích hoạt đồng bộ
Trình duyệt SHALL gọi route đồng bộ sau khi đẩy `projects` lên Firestore thành công, gom nhịp tối thiểu 5 giây. Tab "Liên kết phòng ban" SHALL có nút "Đồng bộ lại sang Thiết kế" chỉ hiện với vai trò `BOOD`, hiển thị số dự án đã gửi, bỏ qua, lỗi.

#### Scenario: Sửa nhiều dự án liên tiếp
- **WHEN** người dùng lưu 3 lần trong 5 giây
- **THEN** route đồng bộ chỉ được gọi một lần

#### Scenario: Nhân viên không thấy nút
- **WHEN** người dùng có vai trò `STAFF`
- **THEN** nút "Đồng bộ lại sang Thiết kế" không hiện
