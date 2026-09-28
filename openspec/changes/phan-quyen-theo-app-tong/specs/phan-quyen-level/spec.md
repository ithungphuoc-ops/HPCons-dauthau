## ADDED Requirements

### Requirement: App Tổng là nguồn level duy nhất khi đăng nhập
Route SSO SHALL đặt `staff/{uid}.role` bằng `app_permissions/{uid}.dauthau` của App Tổng ở mỗi lần đăng nhập, kể cả khi hồ sơ đã có. Chức vụ SHALL đổi sang mặc định của level mới khi chức vụ cũ trống hoặc đúng bằng mặc định của level cũ, và SHALL giữ nguyên khi là chữ tự đặt khác mặc định. Chưa có quyền ở App Tổng SHALL trả 403.

#### Scenario: App Tổng cấp Level 1, app đang Level 4
- **WHEN** hồ sơ `staff` có `role` VIEWER, chức vụ "Ban giám đốc", App Tổng là BOOD
- **THEN** sau đăng nhập `role` là BOOD, chức vụ là "Trưởng phòng"

#### Scenario: Giữ chức vụ tự đặt
- **WHEN** hồ sơ có `role` BOOD, chức vụ "Phó phòng", App Tổng là BOOD
- **THEN** chức vụ vẫn là "Phó phòng"

### Requirement: Trưởng phòng đổi level trong app qua máy chủ
`POST /api/phan-quyen/level` SHALL xác thực bằng cookie phiên App Tổng (không có thì 401) và SHALL đọc sống level App Tổng của người gọi và người đích. Hệ thống SHALL chỉ cho người gọi là BOOD hoặc owner App Tổng; SHALL chặn tự sửa mình; SHALL chặn khi người đích chưa có quyền `dauthau` (404); SHALL chặn khi người đích là BOOD hoặc owner (403); SHALL chỉ nhận level mới MANAGER, STAFF hoặc VIEWER (400). Khi được phép, hệ thống SHALL ghi `app_permissions/{uid}.dauthau` ở App Tổng, cập nhật `staff/{uid}` role và chức vụ, và ghi một dòng nhật ký gồm người đổi, người được đổi, level cũ, level mới, thời điểm.

#### Scenario: BOOD nâng Level 3 lên Level 2
- **WHEN** người gọi BOOD đổi người đích STAFF sang MANAGER
- **THEN** App Tổng lưu MANAGER, hồ sơ staff đổi theo, nhật ký có một dòng

#### Scenario: Phong Level 1 trong app
- **WHEN** người gọi BOOD đặt level BOOD cho người khác
- **THEN** trả 400, không ghi gì

#### Scenario: Chuyên viên gọi route
- **WHEN** người gọi có level STAFF
- **THEN** trả 403

#### Scenario: Sửa người đang Level 1 hoặc owner
- **WHEN** người đích là BOOD hoặc owner App Tổng
- **THEN** trả 403 với lý do chỉ đổi ở App Tổng

### Requirement: Giao diện không tự đặt level
Hộp sửa nhân sự SHALL chỉ cho chọn Level 2, 3, 4 và SHALL khoá kèm lý do khi người xem không phải Trưởng phòng hoặc owner, khi là dòng của chính mình, hoặc khi người đích là Level 1 hoặc owner. Tạo nhân sự mới SHALL mang đúng level App Tổng của người được chọn và SHALL NOT tạo khi người đó chưa có quyền ở App Tổng.

#### Scenario: Mở ô level của Level 3
- **WHEN** Trưởng phòng mở hộp sửa của người Level 3
- **THEN** ô level có Level 2, 3, 4 và không có Level 1
