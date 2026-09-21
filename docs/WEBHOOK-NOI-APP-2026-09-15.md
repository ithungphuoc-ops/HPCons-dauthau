# Nối App Đấu thầu với App Thông tin dự án & App Thiết kế (webhook)

**Ngày:** 15/09/2026 · **Người yêu cầu:** chị Ngô Trâm (Phòng Đấu thầu) — theo đề nghị của IT
**Trạng thái:** code đã sẵn sàng, chờ IT khai biến môi trường và cho hai app kia đẩy sang.

---

## 1. Thứ tự liên kết (chị Trâm chốt)

```
App Thông tin dự án ──(webhook 1)──► App Đấu thầu
   đổ MÃ DỰ ÁN + thông tin dự án            │
   (chủ đầu tư, địa chỉ, quốc tịch,         │  ghép nhau bằng MÃ DỰ ÁN
    hình thức xây dựng, hồ sơ phát thầu,    │
    diện tích đất)                          ▼
App Thiết kế ────────(webhook 2)──► App Đấu thầu
   đổ TIẾN ĐỘ THIẾT KẾ theo từng mã dự án
```

Bấm vào mã dự án trong app đấu thầu thì xổ ra tiến độ thiết kế của đúng mã đó.
**Mã dự án là khoá ghép duy nhất** — bản ghi không có mã sẽ bị bỏ qua, app **không tự chế mã**
(chế ra là ghép nhầm hồ sơ của hai dự án khác nhau).

---

## 2. IT cần làm gì

### 2.1. Khai 2 biến môi trường

```
DU_AN_TONG_WEBHOOK_SECRET="<chuỗi ngẫu nhiên>"
THIET_KE_WEBHOOK_SECRET="<chuỗi ngẫu nhiên khác>"
```

Sinh secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Mỗi app một secret **riêng**, không dùng chung — lộ một cái thì chỉ phải khoá một cái.

> **Chưa khai secret thì webhook trả HTTP 503 và từ chối mọi request.** Đây là cố ý: một cửa nhận
> mở toang trong lúc chờ cấu hình là chỗ để người ngoài ghi đè danh mục dự án của công ty.

### 2.2. Đưa 2 địa chỉ này cho hai app kia

| App | Địa chỉ | Secret dùng |
|---|---|---|
| App Thông tin dự án | `POST https://<app-dau-thau>/api/webhook/du-an-tong` | `DU_AN_TONG_WEBHOOK_SECRET` |
| App Thiết kế | `POST https://<app-dau-thau>/api/webhook/tien-do-thiet-ke` | `THIET_KE_WEBHOOK_SECRET` |

Header mỗi lần đẩy:

```
Authorization: Bearer <secret>
Content-Type: application/json
```

(Dùng `X-Webhook-Secret: <secret>` cũng được — app này nhận cả hai kiểu, để hai app kia khỏi
phải sửa code sẵn có của họ.)

### 2.3. Kiểm tra đã cắm đúng địa chỉ chưa

`GET` chính hai địa chỉ trên (không cần secret, không lộ dữ liệu):

```json
{ "ok": true, "webhook": "tien-do-thiet-ke", "daCauHinhSecret": true }
```

`daCauHinhSecret: false` nghĩa là chưa khai biến môi trường.

---

## 3. Mẫu payload

### 3.1. App Thông tin dự án → `/api/webhook/du-an-tong`

```json
{
  "items": [
    {
      "maDuAn": "250142-HPCS",
      "tenDuAn": "Nhà máy ABC - Giai đoạn 1",
      "chuDauTu": "Công ty TNHH ABC",
      "diaChi": "KCN Sóng Thần, Bình Dương",
      "quocTich": "Nhật Bản",
      "hinhThucXayDung": "Xây mới",
      "hoSoPhatThau": "CĐT phát thầu",
      "dienTichDat": 12000
    }
  ]
}
```

### 3.2. App Thiết kế → `/api/webhook/tien-do-thiet-ke`

Đúng các cột bảng báo cáo bên App Thiết kế, **trừ "Vị trí lưu file"** (chị Trâm bỏ cột này,
app đấu thầu không lưu):

```json
{
  "items": [
    {
      "maDuAn": "250142-HPCS",
      "tenDuAn": "Nhà máy ABC - Giai đoạn 1",
      "namTaiChinh": "2026-2027",
      "loaiDuAn": "Nhà máy",
      "tinhTrang": "Đang thực hiện",
      "ngayLap": "2026-08-03",
      "ngayHoanThanh": "2026-10-15",
      "soTask": 24,
      "nguoiThucHien": "Nguyễn Văn A",
      "treHan": 0,
      "hangMuc": [
        {
          "ten": "Kiến trúc",
          "loaiDuAn": "Nhà máy",
          "tinhTrang": "Hoàn thành",
          "ngayLap": "2026-08-03",
          "ngayHoanThanh": "2026-09-10",
          "soTask": 8,
          "soTaskXong": 8,
          "nguoiThucHien": "Trần B",
          "treHan": 0
        }
      ]
    }
  ]
}
```

Gửi **một dự án lẻ** (không bọc trong `items`) cũng nhận. Ngày chấp nhận cả `yyyy-mm-dd`,
`dd/mm/yyyy` và chuỗi ISO.

### 3.3. Tên trường bên kia khác thì sao?

**Không phải sửa giao diện.** Mỗi app có đúng MỘT hàm ánh xạ:

| App | File cần sửa | Hàm |
|---|---|---|
| Thông tin dự án | `src/lib/duAnTong.ts` | `chuanHoaDuAnTong()` |
| Thiết kế | `src/lib/tienDoThietKe.ts` | `chuanHoaDuAn()` |

Mỗi trường đã nhận sẵn nhiều tên gọi (`maDuAn` / `projectCode` / `projectId` / `code`...), nên
nhiều khả năng không phải sửa gì.

---

## 4. Hành vi khi nhận

- **Upsert theo mã dự án** — đẩy lại bao nhiêu lần cũng không sinh bản trùng.
- **Không xoá** dự án vắng mặt trong lần đẩy đó. Một lần đẩy thiếu (lọc sai, đẩy từng phần) sẽ
  không thổi bay cả danh mục.
- Riêng **danh sách hạng mục thiết kế ghi đè nguyên khối**: hạng mục bị xoá bên App Thiết kế phải
  biến mất bên này, nếu merge từng phần tử thì hạng mục cũ nằm lại vĩnh viễn.
- Bản ghi thiếu mã dự án bị bỏ qua và **đếm vào `boQua`** trong phản hồi, để bên kia biết mà sửa
  chứ không im lặng nuốt mất.
- Tối đa **500 dự án mỗi lần đẩy** (vượt thì trả HTTP 413, chia nhỏ ra).

Phản hồi khi thành công:

```json
{ "ok": true, "daNhan": 12, "boQua": 0, "capNhatLuc": "2026-09-15T08:30:00.000Z" }
```

| Mã lỗi | Nghĩa |
|---|---|
| 401 | Sai hoặc thiếu secret |
| 400 | Body không phải JSON, hoặc không bản ghi nào có mã dự án |
| 413 | Quá 500 dự án một lần |
| 503 | App đấu thầu chưa khai biến secret |

---

## 5. Người dùng thấy gì

**Tab "Liên kết phòng ban"** (Trưởng phòng + Quản lý, ẩn với chuyên viên) có bảng
**Tiến độ thiết kế** với các cột:

> STT · **Mã dự án** · Dự án / Hạng mục · Loại dự án · Tình trạng dự án · Lập dự án · Hoàn thành ·
> Số task · Người thực hiện · Trễ hạn

Bấm vào dòng dự án thì xổ các hạng mục con. Có lọc theo năm tài chính và ô tìm kiếm (tìm được cả
theo tên hạng mục).

Bảng này **chỉ xem, không sửa** — tiến độ thiết kế do Phòng Thiết kế làm chủ; Phòng Đấu thầu sửa
vào là hai bên lệch số ngay.

Chưa nối app thì bảng hiện dòng nhắc **"Chưa nhận được tiến độ thiết kế"** kèm lý do, chứ không
để màn hình trống không ai hiểu vì sao.

---

## 6. Đường kéo dự phòng (tuỳ chọn)

Nếu muốn app đấu thầu tự đi lấy thay vì chờ đẩy, khai thêm:

```
DU_AN_TONG_API_URL / DU_AN_TONG_API_KEY
THIET_KE_API_URL   / THIET_KE_API_KEY
```

Đường kéo **chỉ chạy khi webhook chưa từng đẩy lần nào** — để ngày đầu nối app không phải ngồi
chờ lần đẩy kế tiếp. Đã có dữ liệu webhook thì luôn ưu tiên dữ liệu webhook. Timeout 8 giây, app
kia chết cũng không làm treo màn hình bên này.

---

## 7. File liên quan

| File | Vai trò |
|---|---|
| `src/lib/webhookAuth.ts` | Xác thực secret (so sánh timing-safe), dùng chung 2 webhook |
| `src/lib/duAnTong.ts` | Kiểu dữ liệu + ánh xạ tên trường — App Thông tin dự án |
| `src/lib/tienDoThietKe.ts` | Kiểu dữ liệu + ánh xạ tên trường — App Thiết kế |
| `src/lib/tienDoThietKeTypes.ts` | Kiểu dữ liệu dùng chung cho giao diện (không `server-only`) |
| `app/api/webhook/du-an-tong/route.ts` | Cửa nhận 1 |
| `app/api/webhook/tien-do-thiet-ke/route.ts` | Cửa nhận 2 |
| `app/api/du-an-tong/route.ts` | Đọc ra cho ô chọn mã dự án trong form |
| `app/api/tien-do-thiet-ke/route.ts` | Đọc ra cho bảng tiến độ thiết kế |
| `src/components/TienDoThietKePanel.tsx` | Bảng tiến độ thiết kế |

Hai đường đọc ra đều đòi **phiên App Tổng + quyền vào app đấu thầu** (`app_permissions/{uid}.dauthau`),
đúng cơ chế đã vá cho `/api/staff-directory` ngày 27/08/2026. Danh mục dự án và tiến độ thiết kế
là thông tin nội bộ, không để lộ cho bất kỳ ai chỉ cần có phiên hpcore hợp lệ.
