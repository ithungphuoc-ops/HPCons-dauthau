# Quy định định dạng dữ liệu — HP Cons

**Nguồn:** thông báo nội bộ của công ty ngày 19/08/2026 (chị Nguyễn Thị Hồng Nhung gửi @All).
**Áp vào app Đấu thầu:** 16/09/2026, theo chỉ đạo của chị Ngô Trâm ("điều chỉnh theo quy định công ty").

---

## 1. Ba quy định

| Loại | Đúng | Sai |
|---|---|---|
| **Ngày tháng** | `15/09/2026` (dd/mm/yyyy) | ~~`15-09-2026`~~ |
| **Số** | `123,000,000 đ` · `15,065.234`<br>(`,` ngăn hàng nghìn, `.` ngăn thập phân) | ~~`123.000.000`~~ · ~~`15065,234`~~ |
| **Nối trường** | `260001-HPCS-HDXD-001 \| CÔNG TRÌNH CHIEN YI` | ~~`260001-HPCS-HDXD-001 - CÔNG TRÌNH CHIEN YI`~~ |

Dấu `-` vẫn dùng **bên trong** phần mã (`260001-HPCS-HDXD-001`); dấu `|` chỉ để ngăn **mã với tên**.

---

## 2. Sửa ở đâu trong code

Ba quy định gom vào **ba hàm dùng chung**. Đổi định dạng thì sửa đúng ba chỗ này, cả app đổi theo —
đừng nối chuỗi hay gọi `toLocaleString` ở từng màn hình.

| Quy định | Hàm | File |
|---|---|---|
| Ngày tháng | `fmtDateVN()` · `fmtDateTimeVN()` | `src/utils/dateVN.ts` |
| Số | `dinhDangSo()` · `dinhDangTien()` | `src/lib/utils.ts` |
| Nối trường | `nhanHoSo()` (mã \| tên) · `maHoSo()` (ghép hai ô mã) | `src/lib/utils.ts` |

Ô nhập ngày (`src/components/DateInput.tsx`) hiển thị `dd/mm/yyyy`, nhưng khi NHẬP vẫn nhận cả
`-` và `.` — quy định áp cho hiển thị, chặn cách gõ quen tay chỉ làm người dùng khó chịu.

### ⚠ Không dùng `toLocaleString('vi-VN')` cho số

Locale Việt Nam cho ra `123.000.000` và `15065,234` — **ngược hẳn** quy định. `dinhDangSo()` ghim
cứng `en-US` để mọi máy, mọi trình duyệt ra một kiểu; để theo locale của máy thì cùng một hồ sơ mở
ở hai máy sẽ hiện hai kiểu số khác nhau.

---

## 3. Trả lời câu hỏi của Phòng

> "Định dạng mỗi app mỗi khác thì có bị lỗi xung đột hay không?"

**Không xung đột về dữ liệu.** App này lưu Firestore: ngày lưu dạng ISO `YYYY-MM-DD`, số lưu kiểu
số — định dạng chỉ là chuyện **hiển thị lúc đọc ra**. Hai app hiện hai kiểu vẫn cùng một dữ liệu.

**Chỉ sai khi trao đổi dữ liệu dạng CHUỖI**, và đó là ba chỗ cần canh:

1. **File Excel xuất/nhập** — `15/09/2026` mà máy bên kia đọc theo chuẩn Mỹ sẽ hiểu thành 9/15, và
   `123,000,000` có thể bị đọc thành `123.000000`. Xuất file cho hệ thống khác thì để ngày dạng ISO.
2. **Webhook giữa các app** (`/api/webhook/du-an-tong`, `/api/webhook/tien-do-thiet-ke`) — hàm
   `layNgay()` trong `src/lib/tienDoThietKe.ts` đã nhận cả `dd/mm/yyyy`, `yyyy-mm-dd` và ISO rồi
   quy về ISO, nên app bạn gửi kiểu nào cũng đọc được.
3. **Ghép hồ sơ theo mã dự án** — mã phải khớp từng ký tự. Bên nào thêm/bớt dấu cách quanh dấu `|`
   hoặc `-` là ghép trượt. App này chuẩn hoá mã trước khi so (xem `maHienThi`).

**Khuyến nghị cho IT:** giữa các app luôn truyền ngày dạng **ISO `YYYY-MM-DD`** và số dạng **số
thuần** (không có dấu phân cách). Định dạng theo quy định công ty chỉ áp ở lớp hiển thị. Như vậy
đổi quy định hiển thị sau này cũng không phải sửa lại dữ liệu đã lưu.
