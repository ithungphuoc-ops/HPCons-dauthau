# KẾ HOẠCH SỬA APP — theo file `GopY_HPC_u_Th_u_2026-08-17.xlsx`

Nguồn: 13 góp ý của chị Trâm, mốc thời gian 31/07/2026 → 17/08/2026.
Đối chiếu git: **commit code cuối cùng là 30/07/2026** (`14eef6d` ngày 05/08 chỉ sửa 2 file `.bat`).
→ **Cả 13 mục đều CHƯA được sửa trong code.**

---

## 0. RÀO CẢN TRƯỚC KHI CODE ĐƯỢC (phải xử lý đầu tiên)

| # | Vấn đề | Cách xử lý đề xuất |
|---|---|---|
| 0.1 | `node_modules` thiếu hẳn gói `next` → `npm run dev` báo `'next' is not recognized`, không chạy được app | Phải `npm install` |
| 0.2 | Repo nằm trên `G:\My Drive\...` (Google Drive). `npm install` đang báo hàng loạt `TAR_ENTRY_ERROR ... write / EBADF` — Google Drive không chịu được vài chục nghìn file nhỏ của `node_modules` | **Copy repo sang ổ cứng local** (vd `C:\dev\hpcons-dauthau`) để chạy dev; Google Drive chỉ giữ bản lưu trữ. Đây là cách bền, không phải cách chữa cháy |
| 0.3 | Port 3000 đang bị dev server của việc khác chiếm (`carol-dev`) | Chạy app này ở port khác (đã có cấu hình `hp-cons-erp-preview` → port 3001) |
| 0.4 | Máy này chưa có `.env.local` | Đã tạo với `NEXT_PUBLIC_DEV_SANDBOX=1` (Bản thử: bỏ SSO, KHÔNG đọc/ghi Firestore → dữ liệu thật của Phòng không bị đụng) |

---

## NHÓM A — LỖI THỰC SỰ (ưu tiên 1, đúng mục đích "chỉ sửa nội dung bị lỗi")

### A1. Góp ý #5 — Đồng hồ hiển thị giờ UTC thay vì giờ Việt Nam
- **Vị trí**: `src/App.tsx:854–864` (dùng `getUTCHours/getUTCMinutes/getUTCSeconds`, in chuỗi `"... UTC"`), hiển thị ở `src/App.tsx:3515–3518`.
- **Nguyên nhân**: đã xác định rõ trong code — đồng hồ được viết CỐ Ý theo UTC (comment ghi "Đồng hồ UTC hiển thị ở góc trang đăng nhập").
- **Cách sửa**: đổi sang giờ Việt Nam cố định `Asia/Ho_Chi_Minh` (không lấy giờ máy — máy cài sai múi giờ là hiện sai), bỏ hậu tố "UTC".
- **Mức độ**: nhỏ. Chắc chắn sửa được.

### A2. Góp ý #1 — Chuông thông báo: xem tin 1 xong, bấm tin 2 thì không chuyển, vẫn kẹt ở dự án 1
- **Vị trí**: `src/App.tsx:2306–2311` (hàm `moHoSo`), `4147–4153` (nhánh Quản lý), `4263` (nhánh Trưởng phòng).
- **Giả thuyết** (chưa chạy được app nên **chưa xác nhận**): `moHoSo` chỉ `setExpandedProjectId(projId)` mà **không đóng khung đang mở của hồ sơ trước** — nhánh Quản lý ở dòng 4149 thiếu `setShowForm(false)` (nhánh Nhân viên dòng 4152 thì có).
- **Việc cần làm**: chạy Bản thử, tái hiện đúng thao tác của Sếp, chốt nguyên nhân rồi sửa. Nếu đúng giả thuyết thì là sửa nhỏ.

### A3. Góp ý #3 — Gantt lệch 1 ngày: hạn 19/8 mà thanh chỉ vẽ tới hết 18/8
- **Vị trí**: `src/components/GanttChart.tsx`, `src/components/SubtaskGantt.tsx`, `src/components/ui/TimelineProgress.tsx`.
- **Bối cảnh**: commit `ea3d3f6` (30/07) đã sửa "hạn tính tới hết ngày" cho phần **cảnh báo trễ hạn**, nhưng phần **vẽ thanh Gantt** chưa theo cùng quy ước.
- **Cách sửa**: thống nhất một quy ước duy nhất trong toàn app — hạn = **hết ngày đó (23:59:59)**, nên thanh Gantt phải phủ **trọn cả ngày hạn**. Rà cả 3 file trên cho khớp.
- **Mức độ**: vừa (phải rà nhiều chỗ để không sửa được chỗ này lệch chỗ khác).

### A4. Góp ý #2 — Quản lý lỡ bấm "Lưu dự án" khi đang tạo việc con → không xem lại và không sửa được trước khi cấp trên duyệt
- **Vị trí**: `src/App.tsx:2334` (`hoSoChoTPDuyet(...)` chặn khi chưa được TP duyệt), `src/components/SubtaskHierarchy.tsx`, `src/components/ProjectForm.tsx`.
- **Nguyên nhân**: đây là **hệ quả của quy tắc "chờ TP duyệt thì khoá"** đã chốt ngày 27/07 — khoá đang chặn luôn cả việc Quản lý XEM và SỬA kế hoạch của chính mình.
- **✅ CHỊ TRÂM ĐÃ CHỐT 17/08/2026** — quy tắc mới:
  > "Quản lý **được xem + sửa kế hoạch việc con của chính mình** khi còn chờ TP duyệt,
  > nhưng **vẫn bị khoá cập nhật % tiến độ**."
- **Cách sửa**: tách điều kiện chặn ở `src/App.tsx:2334` làm hai loại — chặn **cập nhật % tiến độ**
  (giữ nguyên) và chặn **sửa kế hoạch** (mở ra cho chính Quản lý phụ trách hồ sơ đó).
- **Mức độ**: vừa. Đã có quyết định, làm được ngay.

### A5. Góp ý #9 — Level 1 chưa xem được công việc đã xong khi việc đang ở giữa TP và Quản lý
- **Vị trí**: bộ lọc `projStatusFilter` (`ACTIVE`/`DONE`) trong `src/App.tsx`, phần lọc theo quyền.
- **Cách sửa**: cho Level 1 xem **toàn bộ**, kể cả lịch sử việc đã xong, không phụ thuộc trạng thái bộ lọc.
- **Mức độ**: nhỏ–vừa.

### A6. Góp ý #10 — Hai biên phần mềm trống nhiều, zoom ra/vào không tự fit
- **Vị trí**: `app/globals.css` + các `max-w-*` bọc ngoài trong `src/App.tsx`.
- **Cách sửa**: nới khung chứa cho co giãn theo màn hình. Có bộ quy tắc sẵn để làm đúng chuẩn: `docs/design-system/07-responsive/responsive-rules.md`.
- **Mức độ**: vừa. Thuộc loại "sửa xong phải xem mắt", em sẽ chụp ảnh trước/sau cho Sếp so.

---

## NHÓM B — ĐỔI NHÃN & QUYỀN — ✅ **CHỊ TRÂM ĐÃ CHỐT 17/08/2026**

### B1. Góp ý #4a — Đổi lại cách trình bày tên Level
Thang Level chốt: **L1 = Trưởng phòng + Phó phòng · L2 = Quản lý · L3 = Nhân viên · L4 = Ban giám đốc**

**✅ Chốt B1.1 — L4 = Ban giám đốc, THAY cho chữ "Khách mời":**
> "L4 = Ban giám đốc, thay cho chữ Khách mời, còn tính năng thì không thay đổi gì cả,
> **cho xem hết, chỉ là không cho thao tác** thôi."

→ Nghĩa là: **giữ nguyên cơ chế chỉ-xem của role `VIEWER` hiện tại**, chỉ (a) đổi nhãn thành
"Ban giám đốc", và (b) **mở phạm vi xem ra TOÀN BỘ** (hiện `VIEWER` bị giới hạn).

**✅ Chốt B1.2 — Ban giám đốc muốn thao tác thì gán L1:**
> "Nếu thêm Ban giám đốc ở **L1** thì người đó được quyền **thêm/xóa/sửa TẤT CẢ dự án**,
> kể cả dự án mà TP và Quản lý làm không liên quan đến BGĐ."

→ Vậy Ban giám đốc có **2 cách gán**, tuỳ nhu cầu: **L4** (xem hết, không thao tác) hoặc
**L1** (toàn quyền trên mọi dự án). L1 = quyền cao nhất, không giới hạn theo "dự án của mình".

**Hiện trạng code cần sửa:**
- `src/components/AppLauncher.tsx:21–24`: `BOOD` đang mang nhãn `'Ban Giám đốc / Trưởng phòng (Level 1)'`
  → phải bỏ "Ban Giám đốc" khỏi nhãn L1, đổi thành "Trưởng phòng / Phó phòng (Level 1)".
- `src/types.ts:147`: 4 role `BOOD | MANAGER | STAFF | VIEWER` → **giữ nguyên 4 role**,
  chỉ đổi **nhãn** của `VIEWER` thành "Ban giám đốc (Level 4)".
- `src/types.ts:138`: danh sách `chucVu` đã có sẵn cả `'Ban giám đốc'`, `'Trưởng phòng'`, `'Phó phòng'`
  → đủ dùng, không cần thêm chức vụ mới.
- Hằng `CHUC_VU_KHONG_TINH_NHAN_SU` (trong `src/App.tsx`) hiện **loại Ban giám đốc + Khách mời ra khỏi
  danh sách nhân sự** và loại khỏi ô chọn người giao việc → **giữ nguyên hành vi này** (BGĐ không phải
  nhân sự thực thi), nhưng phải rà lại để BGĐ vẫn **xem được hết**.
- Rà mọi chỗ lọc dữ liệu theo role để `VIEWER` xem được toàn bộ dự án (kể cả việc đã xong), nhưng
  **mọi nút thao tác đều bị chặn**.

### B2. Góp ý #4b — "Level 1 có quyền thêm người vào app, lấy danh sách từ App Tổng hoặc email"

**✅ Chốt: đi HƯỚNG 2** — *"App đấu thầu giữ bảng quyền riêng, App Tổng chỉ lo đăng nhập."*

Nghĩa là **gỡ bỏ cơ chế App Tổng ghi đè quyền** — việc này giải luôn điểm "CÒN TREO" trong
`BAN-GIAO-2026-07-27.md`. Cụ thể phải làm:

1. Ở luồng SSO (`app/api/auth/hpcore-session/route.ts`, `app/api/roles/route.ts`, `src/lib/hpcore.ts`):
   App Tổng chỉ còn dùng để **xác thực danh tính** (email/tên là ai), **KHÔNG lấy role từ App Tổng nữa**.
2. Role/quyền đọc từ **bảng nhân sự của app đấu thầu** (Firestore `staff`) — đây là nguồn quyền duy nhất.
3. Người đăng nhập lần đầu mà **chưa có trong bảng nhân sự** → vào trạng thái "chưa được cấp quyền",
   L1 phải thêm mới dùng được (khớp đúng ý "L1 có quyền thêm người vào app").
4. Màn "Đội ngũ & KPI" thêm chức năng **L1 thêm người**: nhập email, hoặc chọn từ danh sách App Tổng
   (đọc qua API sẵn có), rồi gán Level + chức vụ + quản lý phụ trách.
5. **Rà lại logic tự-đăng-xuất-khi-đổi-quyền** (mục 16 của `BAN-GIAO-2026-07-27.md`) cho khớp nguồn
   quyền mới — hiện nó đang theo Firestore nên có thể vẫn đúng, nhưng phải kiểm.

⚠️ **Rủi ro cần Sếp biết**: sau thay đổi này, quyền ở App Tổng và ở app đấu thầu **có thể lệch nhau**
(một người là Quản lý ở App Tổng nhưng là Nhân viên ở app đấu thầu). Đây là **hệ quả tất yếu** của
hướng 2, không phải lỗi. Bù lại app đấu thầu tự chủ hoàn toàn về phân quyền.

---

## NHÓM C — TÍNH NĂNG MỚI (không phải lỗi — cần Sếp xếp thứ tự ưu tiên)

| # | Góp ý | Vị trí / Hiện trạng | Khối lượng |
|---|---|---|---|
| C1 | **#6** Thêm lịch khi chọn ngày, đỡ gõ tay | `src/components/DateInput.tsx` — hiện **chỉ là ô text tự parse**, chưa có lịch. Lý do code không dùng lịch native đã ghi rõ ở đầu file: ô ngày native hiện MM/DD/YYYY trên máy Anh–Mỹ. Nên phải **tự dựng lịch nhỏ**, giữ định dạng DD-MM-YYYY | Vừa |
| C2 | **#11** Khai thủ công số lần đã gửi CĐT (vì gói thầu đang dang dở khi app mới dựng) | Nhật ký gửi CĐT đã có sẵn (`src/types.ts:88`), chỉ cần thêm ô khai **số lần khởi điểm** | Nhỏ–vừa |
| C3 | **#12** Bắt buộc nhập hình ảnh báo cáo đã gửi báo giá khi kéo Bước 2 → Bước 3 | Đã có sẵn `src/components/FileDropZone.tsx` + `src/utils/attachments.ts` | Vừa |
| C4 | **#7** 1 việc con **nhiều người làm**, phân bổ qua công việc của từng thành viên, tỷ trọng chia đều | ⚠️ **Động vào mô hình dữ liệu**: hiện mỗi việc con gán **1 người**. Đổi thành nhiều người thì kéo theo tiến độ, tỷ trọng, KPI, báo cáo Excel, sao lưu/khôi phục | **Lớn nhất trong 13 mục** |
| C5 | **#8** Trên Lịch cá nhân thêm 2 mục: (1) Thông báo nội bộ có chọn người nhận, (2) Template mẫu đấu thầu để up file Excel/biểu mẫu | ⚠️ **Rào cản kỹ thuật**: app hiện **chưa dùng Firebase Storage**, mà 1 doc Firestore tối đa 1MB → file Excel dễ vượt. Phần "Thông báo nội bộ" thì làm được ngay | Lớn (phần Template) |
| C6 | **#13** Nâng cấp mẫu bảng báo cáo chiến lược | ✅ **Đã có mẫu** (Sếp gửi 17/08) — đặc tả đầy đủ ở mục **C6 chi tiết** ngay dưới | Lớn |

---

## C6 CHI TIẾT — MẪU BẢNG BÁO CÁO CHIẾN LƯỢC (góp ý #13)

**Nguồn mẫu**: `D:\OneDrive\Tender\04.SystemImprovement\10.Muc tieu ISO\BAO CAO NAM 2026 - KY 1\PHONG DAU THAU - MUC TIEU NAM 2026 - KY 1 - ver2.xlsx`
→ **sheet 3: `Bang thong ke du an - Ky 1`** (chị Trâm xác nhận đúng sheet 3 ngày 17/08/2026).
Tiêu đề bảng: **"BẢNG THỐNG KÊ DỰ ÁN ĐẤU THẦU - KỲ 1 - NĂM 2026"**.

**Vì sao bảng này quan trọng**: nó chính là **hồ sơ/bằng chứng ISO** mà sheet 1 (`Năm 2026 - Rev5`)
yêu cầu cho mục tiêu số 1 và số 3 của Phòng Đấu Thầu:
> "1. Bảng thống kê dự án đấu thầu (trong đó có liệt kê: tên dự án, tên CĐT, địa chỉ, hình thức báo giá,
> tiến độ cam kết với BGĐ, tiến độ thực tế thực hiện, hình thức đấu thầu, tình trạng dự án)"

Nên app xuất được đúng bảng này thì Phòng **khỏi phải làm tay báo cáo ISO mỗi kỳ**.

### Cấu trúc bảng — 3 tầng tiêu đề (dòng 2, 3, 4 trong file gốc)

**Nhóm cột định danh dự án:**

| Cột | Tên | Nguồn dữ liệu trong app |
|---|---|---|
| 1 | STT | tự đánh số |
| 2 | Mã dự án | có sẵn (vd `260001-HPCS-BG-VER01`) |
| 3 | Dự án | có sẵn |
| 4 | Chủ đầu tư | có sẵn |

**Nhóm "Số kế hoạch thực hiện dự án"** (diễn giải lần gửi / số báo giá gửi trong tháng)
→ chia theo **TỪNG THÁNG của kỳ** (Kỳ 1 = tháng 4, 5, 6, 7), **mỗi tháng có 6 cột con**:

| Cột con | Tên | Ghi chú |
|---|---|---|
| a | Diễn giải | vd "Gửi lần 1", "Gửi khái toán lần 2", "Gửi chi tiết lần 7" |
| b | Số kế hoạch (SKH) | đếm = 1 mỗi lần gửi |
| c | Ngày gửi kế hoạch | dạng `DD.MM.YYYY` |
| d | Tiến độ cam kết | ngày cam kết với BGĐ |
| e | Tiến độ thực hiện | ngày gửi thực tế |
| f | Nhận xét | **1 = đúng/sớm hạn · 0 = trễ hạn**. Đối chiếu dữ liệu mẫu: cam kết 16.04 – thực hiện 16.04 → `1`; cam kết 22.07 – thực hiện 23.07 → `0`; cam kết 05.07 – thực hiện 06.07 → `0` |

**Nhóm "Phân tích thầu"** — 5 cột, đánh dấu `1` vào đúng một cột:
`Chờ KQ` · `Ngưng triển khai` · `Thua` · `Thắng` · `Tiếp cận CĐT`

**Nhóm cột phân loại cuối bảng:**

| Cột | Tên | Giá trị mẫu |
|---|---|---|
| — | Hình thức báo giá | `Khái toán` / `Chi tiết` / hoặc mô tả nhiều vòng: "Lần 1-2: khái toán ⏎ Lần 3 trở đi: chi tiết" |
| — | Hình thức đấu thầu cạnh tranh | `1` hoặc để trống |
| — | Gói thầu đã có kết quả gói thầu | `1` hoặc để trống |
| — | Thống kê dự án có đề xuất tối ưu chi phí cho CĐT | `1` hoặc để trống |
| — | Vị trí dự án | địa chỉ đầy đủ (KCN, xã, tỉnh) |

**Dòng cuối "TỔNG HỢP"**: cộng số lần gửi theo từng tháng + cộng từng cột của nhóm Phân tích thầu.
Trong file mẫu: tháng 4 = 3, tháng 5 = 4, tháng 6 = 2, tháng 7 = 10 · Chờ KQ = 10, Ngưng = 1,
Thua = 0, Thắng = 1, Tiếp cận CĐT = 0 · đấu thầu cạnh tranh = 8, đã có KQ = 1, có tối ưu chi phí = 1.

### Điểm khó về mặt kỹ thuật (cần xử lý đúng, dễ làm sai)

1. **Một dự án chiếm NHIỀU DÒNG** khi trong cùng một tháng gửi nhiều lần. Ví dụ trong file mẫu:
   dự án 1 (CHIEN YI) có "Gửi lần 2" ở dòng chính và "Gửi lần 3" ở **dòng phụ** của tháng 5;
   dự án 8 (PROFIT FOREST) có "Gửi lần 2" ở dòng phụ tháng 7. Code xuất Excel phải **merge ô** cho các
   cột định danh và trải các lần gửi ra nhiều dòng — đây là chỗ dễ làm sai nhất.
2. **Dữ liệu nguồn đã có sẵn trong app**: nhật ký gửi CĐT (`src/types.ts:88`) + cột
   "Chi Tiết Theo Vòng (Số Lần Gửi CĐT)" đã làm ở commit `80edea3` (mục 20 của `BAN-GIAO-2026-07-27.md`).
   Nên đây là **đổi cách trình bày + gom nhóm theo tháng**, không phải thu thập dữ liệu mới.
3. **✅ ĐỦ 4 TRƯỜNG — KHÔNG PHẢI THÊM GÌ.** Chị Trâm chỉ ra ngày 17/08 (kèm ảnh màn hình form dự án),
   Claude đã kiểm chứng lại trong code. Bản đồ trường:

   | Cột trong bảng #13 | Trường trong app | Vị trí code |
   |---|---|---|
   | Vị trí dự án | `diaChi` — "ĐỊA CHỈ CÔNG TRÌNH" | `src/types.ts:120` |
   | Hình thức đấu thầu cạnh tranh | `hinhThucDauThau`: `'Chỉ định thầu' \| 'Đấu thầu cạnh tranh'` | `src/types.ts:121` |
   | Hình thức báo giá (khái toán / chi tiết) | `hangMuc` — ô "Phân loại hạng mục": `'Báo giá chi tiết' \| 'Khái toán' \| 'Báo giá phát sinh' \| 'Cải tạo' \| 'VE' \| 'Lập hồ sơ thầu'` | `src/types.ts:62`, ô nhập ở `src/components/ProjectForm.tsx:1180–1189` |
   | Tiến độ cam kết | `hanHenCDT` — "🤝 Thời hạn hẹn CĐT (nếu có)" | `src/types.ts:104`, ô nhập ở `src/components/ProjectForm.tsx:1307` |

   → Vậy C6 chỉ còn là việc **đọc dữ liệu có sẵn và trình bày lại theo đúng mẫu**, nhẹ hơn dự tính ban đầu.

4. **✅ QUY TẮC LỌC `hangMuc` — chị Trâm chốt 17/08/2026:**
   > "Dự án thuộc mục **cải tạo + phát sinh thì KHÔNG xét**. Còn lại được xét.
   > Cứ điền **đúng tên hồ sơ đọc được trên app** thôi."

   | `hangMuc` | Có vào bảng #13? |
   |---|---|
   | `Báo giá chi tiết` | ✅ Có |
   | `Khái toán` | ✅ Có |
   | `VE` | ✅ Có |
   | `Lập hồ sơ thầu` | ✅ Có |
   | `Cải tạo` | ❌ **LOẠI** |
   | `Báo giá phát sinh` | ❌ **LOẠI** |

   Cột "Hình thức báo giá" trên bảng: **in nguyên tên `hangMuc` như app đang lưu**, KHÔNG tự gộp,
   KHÔNG đổi tên, KHÔNG viết tắt.

   ✔️ **Quy tắc này khớp với sheet 1 của chính file ISO** — mục tiêu 1 và 3 của Phòng Đấu Thầu đều
   ghi phạm vi áp dụng: *"không kể các gói thầu có hình thức cải tạo, sửa chữa, các gói phát sinh"*.
   Nên bộ lọc trên bảng thống kê và phạm vi mục tiêu ISO là một, không mâu thuẫn.
4. **Kỳ báo cáo lệch năm dương lịch**: Kỳ 1 = tháng 4,5,6,7 · Kỳ 2 = tháng 8,9,10,11 ·
   Kỳ 3 = tháng 12,1,2,3. Nên bộ chọn kỳ phải theo đúng 3 kỳ này, **không** theo quý thường.

---

---

## ✅ NHÓM C — ĐÃ LÀM XONG CẢ 5 MỤC (chiều 17/08/2026)

Chị Trâm chốt: *"em làm hết 1 lượt luôn, đừng ngưng hỏi nữa"* → làm liên tục #11 → #12 → #7 → #8 → #13.
`npx tsc --noEmit` exit 0 sau từng mục; thử trên app đang chạy (port 3002, Bản thử, đăng nhập L1).

### C2 / góp ý #11 — Khai tay số lần đã gửi CĐT ✅

- **Cách làm**: KHÔNG đụng trường `lan` của `guiCDTLogs` (đang dùng để khớp VÒNG làm việc, đổi là
  lệch hết báo cáo theo vòng). Thêm `Project.soLanGuiCDTTruocApp` và chỉ CỘNG LÚC HIỂN THỊ.
- **File**: `src/utils/guiCDT.ts` (MỚI — `soLanGuiTruocApp`, `tongSoLanGuiCDT`, `nhanLanGui`,
  `lanGuiKeTiep`), `types.ts`, `ProjectForm.tsx` (ô nhập "📤 Đã gửi CĐT trước khi dùng app" ngay dưới
  ô hẹn CĐT), và 4 chỗ đếm: thẻ hồ sơ, thẻ Kanban, `PhongProgressModal`, hộp hỏi mở vòng mới.
- **Kiểm chứng**: nhập 2 → thẻ Kanban hiện "📤 Gửi CĐT 3 lần" khi app đã ghi 1 lần; nhật ký ghi
  "Gửi CĐT lần 3" cho bản ghi `lan = 1`.

### C3 / góp ý #12 — Bắt buộc ảnh báo cáo đã gửi báo giá mới cho qua Bước 3 ✅

- **File**: `src/components/AnhBaoCaoModal.tsx` (MỚI), `types.ts`
  (`anhBaoCaoGuiBaoGia`, `ghiChuGuiBaoGia`), `App.tsx` (cửa chặn trong `handleKanbanMove` +
  hiển thị danh sách ảnh trên thẻ hồ sơ).
- **Cách chạy**: kéo thẻ 2 → 3 mà chưa có ảnh → hộp đính kèm bật lên (chặn cả Quản lý lẫn Trưởng
  phòng, vì đây là cửa quy trình). Đính kèm xong bấm lưu là **thẻ tự sang Bước 3**, không phải kéo
  lại — cùng cách làm với hộp nhập tiến độ Phòng ở cửa 3 → 4.
- ⚠ App chỉ lưu **TÊN tệp** (đúng quy ước `utils/attachments.ts`), ảnh gốc vẫn ở thư mục của phòng.
  Có thêm ô ghi chú "gửi cho ai, gửi bằng đường nào".
- **Liên quan**: đây là nửa sau của góp ý #23.

### C4 / góp ý #7 — Một việc con nhiều người làm, tỉ trọng chia đều ✅

- **Cách làm**: nút 👥 ở cột "Người giao" của bảng phân rã → tick những người cùng làm → app tách
  việc đó thành **các việc con cấp dưới, mỗi người một việc, tỉ trọng chia đều** (phần dư dồn cho
  người đầu để tổng đúng 100%). Ngày/giờ/vòng kế thừa từ việc cha. Tiến độ việc cha tự cộng lại
  (`getTaskProgress` trong `utils/taskTree` đã tính theo tỉ trọng con — không phải sửa).
- **Không mất dữ liệu**: chia lại lần nữa thì người đã có việc riêng **giữ nguyên việc + tiến độ**,
  chỉ cập nhật tỉ trọng. Có nút "Gộp lại 1 người" khi chia sai.
- **File**: `src/components/SubtaskGantt.tsx` (bảng chọn người + `chiaDeuChoNhieuNguoi` /
  `boChiaViec`; bảng nay dựng dòng theo dạng cha–con, phần của thành viên hiện thụt lề với dấu ↳).
- **Kiểm chứng trên app**: chia 1 việc cho 4 người → cột Người giao hiện "👥 4 người", 4 dòng thụt
  lề mang tên "Bóc tách khối lượng phần thô — <tên>", tỉ trọng 25/25/25/25.

### C5 / góp ý #8 — Thông báo nội bộ + Template mẫu (trên Lịch cá nhân) ✅

- **Thông báo nội bộ** (`src/components/ThongBaoNoiBoPanel.tsx` MỚI): gõ nội dung, chọn **toàn bộ
  nhân sự** hoặc **tick từng người**, gửi qua đúng hệ thống chuông có sẵn (`pushNotify` với
  `luonBao = true` để không bị bộ lọc "hồ sơ từ bước 3 trở đi" chặn). Tin nội bộ do NGƯỜI gửi nên
  vẫn gắn tên người gửi (khác tin nhắc hạn của hệ thống — góp ý #21). Quyền: L1 + L2.
- **Template mẫu** (`src/components/TemplateMauPanel.tsx` MỚI + `TenderTemplate` trong `types.ts` +
  collection cloud `templates` trong `App.tsx`): danh mục biểu mẫu dùng chung — tên + **đường link**
  + ghi chú phiên bản, đồng bộ cloud nên cả phòng thấy cùng một danh mục. L1/L2 thêm/xoá, nhân viên
  chỉ xem & bấm link.
- ⚠ **VÌ SAO LƯU LINK CHỨ KHÔNG TẢI FILE LÊN**: app chưa dùng Firebase Storage, mà 1 document
  Firestore tối đa 1MB — file Excel biểu mẫu vượt xa mức đó. Muốn tải tệp trực tiếp vào app thì phải
  bật Firebase Storage (cần Sếp/IT quyết + thêm chi phí lưu trữ). Ghi rõ để phiên sau không tưởng là
  làm thiếu.

### C6 / góp ý #13 — Bảng thống kê dự án đấu thầu (hồ sơ ISO) ✅

- **File**: `src/utils/bangThongKeISO.ts` (MỚI) + nút **"Bảng thống kê ISO"** kèm ô chọn Kỳ/Năm ở
  hàng nút xuất báo cáo (chỉ Trưởng phòng).
- **Dựng đúng mẫu sheet 3**: 3 tầng tiêu đề · mỗi tháng của kỳ 6 cột con (Diễn giải · SKH · Ngày gửi
  kế hoạch · Tiến độ cam kết · Tiến độ thực hiện · Nhận xét) · nhóm **Phân tích thầu** 5 cột
  (Chờ KQ · Ngưng triển khai · Thua · Thắng · Tiếp cận CĐT) · 5 cột phân loại cuối · dòng **TỔNG HỢP**.
  Một hồ sơ gửi nhiều lần trong cùng tháng thì **trải ra nhiều dòng và merge ô định danh** — đúng chỗ
  đã cảnh báo là dễ làm sai nhất.
- **Kỳ lệch năm dương lịch**: Kỳ 1 = 4,5,6,7 · Kỳ 2 = 8,9,10,11 · Kỳ 3 = 12,1,2,3 (tháng 12 lấy của
  năm trước). Mặc định chọn đúng kỳ đang chạy theo tháng hiện tại (giờ VN).
- **Quy tắc đã cài**: loại hạng mục `Cải tạo` + `Báo giá phát sinh`; cột "Hình thức báo giá" in
  nguyên tên `hangMuc`; `Nhận xét` = 1 khi ngày gửi ≤ tiến độ cam kết (`hanHenCDT`, thiếu thì lấy
  hạn hiện tại), = 0 khi trễ; "Đề xuất tối ưu chi phí cho CĐT" = hạng mục **VE**; "Đã có kết quả
  gói thầu" = tình trạng Đã trúng / Rớt thầu; "Đấu thầu cạnh tranh" = `hinhThucDauThau`.
- **Kiểm chứng trên app**: bấm xuất với dữ liệu 3 hồ sơ nháp → toast *"Đã xuất bảng thống kê ISO —
  Kỳ 2/2026: 2 hồ sơ, 2 dòng"* (hồ sơ hạng mục `Cải tạo` bị loại đúng như quy tắc).

#### ⚠ ĐÃ LÀM LẠI LẦN 2 — bản đầu bị chị Trâm trả lại: *"chưa đúng format, và rất xấu"*

Chị Trâm gửi kèm file mẫu vào ngay thư mục repo:
`PHONG DAU THAU - MUC TIEU NAM 2026 - KY 1 - ver2.xlsx` (8MB, **KHÔNG commit** — chỉ để đối chiếu).
Claude đã **đọc trực tiếp sheet 3 bằng openpyxl** rồi dựng lại đúng theo số đo thật:

| Đo được từ mẫu | Đã cài |
|---|---|
| 38 cột: A STT · B Mã dự án · C Dự án · D Chủ đầu tư · E–AB 4 tháng × 6 cột · AC–AG Phân tích thầu · AH–AL 5 cột cuối | ✅ đúng 38 cột |
| R1 tiêu đề gộp A1:AL1 · R2 nhóm · R3 tên tháng (gộp 6 cột) · R4 tên 6 cột con · STT/Mã/Dự án/CĐT + 5 cột cuối gộp dọc R2:R4 · 5 cột Phân tích thầu gộp dọc R3:R4 | ✅ đúng 4 tầng, rowspan/colspan khớp (đo lại: hàng 2 = 38 ô, hàng 3 = 29, hàng 4 = 24) |
| Font **Times New Roman** 11 (tiêu đề 20), căn giữa ngang + dọc, wrap | ✅ |
| Ô tiêu đề: nền **theme Accent1 Darker 25% = #2F5597**, chữ trắng đậm | ✅ (đo computed style: `rgb(47,85,151)` + trắng + 700) |
| Viền ngoài đậm, viền trong mảnh; bề rộng cột & chiều cao dòng theo mẫu | ✅ |
| Dòng TỔNG HỢP: cộng SKH **và** cột Nhận xét của từng tháng (mẫu: F=3, J=3, X=10, AB=7) + cộng 5 cột phân tích + 3 cột cuối | ✅ (bản đầu thiếu phần cộng Nhận xét) |
| Diễn giải ghi theo hạng mục: "Gửi khái toán lần 2", "Gửi chi tiết lần 7" | ✅ suy từ `hangMuc` |

**VÌ SAO ĐỔI SANG HTML-EXCEL (.xls) — đừng "sửa lại" thành .xlsx:** thư viện `xlsx` (SheetJS
community) đang có trong app **không ghi được định dạng** — xuất .xlsx là mất sạch viền/màu/font,
đúng cái làm bản đầu "rất xấu". App đã có 2 báo cáo khác ("Xuất Excel", "Báo cáo Chiến lược") dùng
cách HTML-Excel này và Excel mở bình thường. Muốn .xlsx thật CÓ định dạng thì phải thêm gói
`xlsx-js-style` — cần Sếp/IT đồng ý (thêm dependency, phải build lại trên Vercel).

📌 **Còn tuỳ Sếp quyết, KHÔNG phải bug**: (a) tải tệp biểu mẫu trực tiếp vào app → cần Firebase
Storage; (b) KPI vẫn để trống điểm (chờ trọng số); (c) ô nhập giá trị báo giá vẫn chưa mở.

---

## NHÓM E — GÓP Ý ĐỢT CHIỀU-TỐI 17/08/2026 (mục 24 → 34)

Chị Trâm gửi một loạt ảnh chụp màn hình kèm ghi chú. Tất cả đã sửa xong trong cùng phiên,
`npx tsc --noEmit` exit 0, thử lại trên app (port 3002, Bản thử, L1).

| # | Chị Trâm yêu cầu | Đã làm |
|---|---|---|
| **24** | *"Khỏi thêm giờ đi, tính theo 3 ngày hoặc 3,5 ngày, không có số khác, nhỏ nhất là nửa ngày cho gọn"* → **BỎ HẲN cột Giờ** vừa làm ở #20 | `SubtaskGantt.tsx`: xoá cột Giờ + ô `TimeInput`; ô **Ngày** đổi thành `step 0.5 / min 0.5`, gõ số lẻ khác bị kéo về bội số 0,5 (`lamTronNuaNgay`). Việc 3,5 ngày = hết **12:00 trưa** ngày cuối (`MyTasksPanel.taskHanMoc`), việc tròn ngày vẫn hết 23:59:59. Thanh Gantt tự vẽ ngắn đúng nửa ô ngày |
| **25** | *"Không cần nút con người, chỉ cần bấm vô và click được 2 tên, click nhầm thì click lại là tắt"* + lỗi *"chọn 2 người nhưng bấm lưu không thấy gì, chỉ Quân thấy việc"* | Bỏ nút 👥 và bảng chọn riêng. Bấm thẳng ô **Người giao** là xổ danh sách: bấm tên = chọn, bấm lại = bỏ. **Chọn từ 2 người là app TỰ chia việc** (tỉ trọng chia đều) — không còn cảnh tick xong quên bấm "Chia đều" nên lưu ra rỗng. Việc cha giữ đủ `assignedStaffIds` → RBAC gom `thucHienIds` đủ người, ai cũng thấy việc |
| **26** | *"Bấm dự án Nhà máy dệt BD xong bấm qua Kho vận Long Thành thì kẹt lại ở dự án 1"* (danh sách Chờ Trưởng phòng xử lý) | `ProjectForm` nạp mọi ô bằng `useState(project?…)` — chỉ chạy 1 lần lúc gắn vào cây, nên đổi hồ sơ mà form không nạp lại. Đã thêm `key={editingProject?.id}` để React dựng lại form theo đúng hồ sơ vừa bấm |
| **27** | *"Level 1 chưa được bật thông báo popup trình duyệt khi có thay đổi"* | Nguyên nhân: hồ sơ Quản lý vừa lập chỉ chạy vào **danh sách tính sẵn** "Chờ Trưởng phòng xử lý", không sinh tin nên không có popup. Nay Quản lý lập/sửa kế hoạch đang chờ duyệt là **bắn tin thẳng cho mọi Trưởng phòng** → chuông đỏ + popup đè lên ứng dụng khác (nếu đã bấm "🔔 Bật thông báo trình duyệt") |
| **28** | *"Đưa cái hạn qua bên này, bên kia chỉ để 2 thanh màu; dự án 1 ngày thì chữ biến mất, hạn ngắn nhìn rất khó"* | `GanttChart.tsx`: bỏ chữ trên thanh; **HẠN chuyển sang cột trái** (kèm "Hẹn CĐT" nếu có, đỏ khi trễ / xanh khi xong). Thanh chỉ còn 2 dải màu (Bộ phận + Phòng), rê chuột vẫn xem đủ chi tiết |
| **29** | *"Đừng ghi như vậy thiếu chuyên nghiệp, chỉ cần gán Level 4 - Ban giám đốc là xong"* | `StaffEditModal.tsx`: bỏ nguyên khối giải thích 4 Level; nhãn rút còn **"Level 4 - Ban giám đốc"** |
| **30** | *"Lỗi đồng hồ ở màn hình đăng nhập"* (ảnh hiện `10:49:51 UTC`) | Code đã sửa từ đợt sáng: đồng hồ lấy giờ Việt Nam cố định và in **"GMT+7"** (`src/App.tsx` – `nowVN`). Ảnh chị chụp là **bản đang chạy trên dauthau.hpcore.vn — chưa deploy bản mới**. Không phải lỗi còn tồn, chỉ cần deploy |
| **31** | *"Xổ toàn bộ nhân sự xuống để chọn, đừng cuộn nhìn xấu"* + *"rule: không hiện tên Level 4 trong cột chuyên viên thực hiện"* | `ProjectForm.tsx`: 2 khung "Quản lý phụ / kế thừa" và "Chuyên viên thực hiện" bỏ `max-h + overflow-y`, xổ hết và xếp 2–3 cột; khung Chuyên viên **lọc bỏ Level 4** |
| **32** | *"Thêm trường cho phép Ctrl+V hình ảnh vào khung"* (hộp ảnh đã gửi báo giá) | `AnhBaoCaoModal.tsx`: bắt sự kiện `paste`, chụp màn hình rồi **Ctrl+V** là ảnh vào danh sách ngay, tự đặt tên theo ngày-giờ dán, có dòng xác nhận "✓ Đã nhận ảnh dán từ clipboard" |
| **33** | *"Quản lý được xuất báo cáo chiến lược như TP"* | Nút **Bảng thống kê dự án** mở cho cả **Quản lý (L2)** — phạm vi là hồ sơ họ phụ trách (RBAC đã lọc sẵn) |
| **34** | *"Mục 8 này không hề thấy em làm"* | Đã làm xong từ đợt trước (2 khung trên **Lịch cá nhân**: Thông báo nội bộ + Template mẫu). Chị không thấy vì đang xem **bản deploy cũ trên dauthau.hpcore.vn**. Xem được ngay trên bản chạy thử; lên thật thì phải deploy + nhờ IT mở quyền Firestore cho collection `templates` |

| **35** | *"Cách em nạp 3 dự án nháp rất nháp, không có logic"* → dựng lại bộ dữ liệu thử theo 9 tình huống chị liệt kê | `src/data/sandboxData.ts` viết lại `duAnNhap()`: **5 dự án cha + 9 công việc** trải đủ 7 bước — (1) Bước 1 chờ TP duyệt · (2) Bước 2 đang làm 45% · (3) Bước 3 Bộ phận 100% + đã có ảnh đã gửi báo giá · (4) Bước 4 Phòng duyệt 100%, trình BGĐ · (5) Bước 5 đã gửi CĐT (có nhật ký gửi) · (6) Trúng thầu · (7) Rớt thầu · (8) Bước 1 chờ phân rã **vòng 2** sau khi CĐT yêu cầu sửa · (9) Bước 1 đã **dời hạn 7 ngày**, Quản lý kéo về chờ phân rã lại. Nút đổi tên thành **"Nạp 9 hồ sơ NHÁP (đủ 7 bước quy trình)"**. Kiểm chứng: nạp xong đọc lại localStorage đúng 9 hồ sơ với `kanbanStep` 1→7, tiến độ/ảnh/vòng/dời hạn khớp từng tình huống |

⚠️ **NHẮC LẠI CHO PHIÊN SAU**: mục 30 và 34 cho thấy chị Trâm đang kiểm tra trên **dauthau.hpcore.vn
(bản đã deploy từ trước)**, còn mọi thay đổi từ 17/08 mới chỉ nằm ở mã nguồn + bản chạy thử. Trước
khi chị nghiệm thu, phải **deploy lại** (Vercel) thì các mục mới hiện ra.

---

## NHÓM D — GÓP Ý MỚI, CHỊ TRÂM BÁO TRỰC TIẾP CHIỀU 17/08/2026 (mục 20 trở đi)

Chị Trâm chốt cách làm: **không xếp thứ tự ưu tiên, làm lần lượt hết**; vướng chỗ nào hỏi ngay chỗ đó;
làm xong mục nào thì ghi vào file này + `BANGIAO.md` để phiên/account sau nắm được.

### 20. Việc con tính tới GIỜ — ✅ ĐÃ LÀM (17/08 chiều)

**Yêu cầu (nguyên văn)**: *"Tiến độ công việc con được quyền tính giờ, nếu không nhập giờ chỉ nhập
ngày thì tính tiến độ trọn ngày."*

**Chị Trâm chốt cách nhập**: hai ô giờ TÙY CHỌN — **giờ bắt đầu + giờ hết hạn**; bỏ trống thì mặc
định **00:00:00 → 23:59:59** (trừ 1 khắc ra, đúng như chị mô tả). **Chỉ áp cho VIỆC CON** — hạn Phòng
và hạn nộp CĐT của hồ sơ vẫn tính theo ngày như cũ.

Đã làm:

| Chỗ sửa | Nội dung |
|---|---|
| `src/types.ts` | `ProjectTask` thêm `gioBatDau?`, `gioHan?` (dạng `'HH:MM'`, bỏ trống = trọn ngày) |
| `src/utils/dateVN.ts` | `chuanHoaGio` (nhận "14:00" · "14" · "14h" · "1400" · "8.30"), `mocBatDauViec`, `mocHanViec` (không có giờ → 23:59:59), `fmtHanViecVN`, `nhanKhoangGioViec` |
| `src/components/TimeInput.tsx` (MỚI) | Ô nhập giờ 24h dùng chung. Không dùng `<input type="time">` native vì máy Anh–Mỹ hiện "02:00 PM" — cùng lý do đã ghi ở `DateInput.tsx` |
| `src/components/SubtaskGantt.tsx` | Thêm cột **Giờ** (`08:00 → 14:00`) cạnh cột Ngày; thanh Gantt vẽ theo mốc ms nên tự ngắn đúng phần giờ |
| `src/components/MyTasksPanel.tsx` | `taskHanMoc` / `taskHanText`; trễ hạn so theo **mốc ms** (hạn 14:00 thì 14:01 là trễ ngay trong ngày); hạn in ra báo cáo kèm giờ |
| `src/App.tsx` | Nhắc hạn việc con: mốc "đến hạn hôm nay" nhắc **trước giờ hạn 2 tiếng** nếu có giờ (trước đây cứng 13h30 — hạn 10:00 thì nhắc xong đã trễ); câu nhắc ghi đúng giờ hạn thay vì luôn ghi 23:59 |

Kiểm chứng trên app: gõ `8` → tự thành `08:00`, gõ `1400` → `14:00`; việc con để trống giờ hiện
tooltip "trọn ngày (00:00 → 23:59)". `npx tsc --noEmit` exit 0.

### 21. Tin nhắc hạn mang tên người không liên quan — ✅ ĐÃ SỬA (17/08 chiều)

**Chị Trâm báo (kèm ảnh)**: chuông hiện tin nhắc hạn việc con nhưng đầu dòng là ảnh + tên người
**không được gán việc con đó** (minh thuan phan, Hưng Phước IT…), nhìn như họ giao/làm việc đó.

**Nguyên nhân**: `pushNotify` gán `actorId = người đang đăng nhập` cho MỌI tin. Tin nhắc hạn do bộ
đếm thời gian tự bắn, nên nó lấy tên người tình cờ đang mở app lúc đồng hồ chạy tới mốc nhắc — mỗi
phiên/mỗi lần đổi vai trò trong Bản thử lại đóng một cái tên khác.

**Đã sửa**: `pushNotify` thêm tham số `laTinHeThong`; tin nhắc hạn việc con truyền `true` → `actorId`
để trống → `NotificationFeed` hiện biểu tượng chuông + nhãn **"Hệ thống nhắc"** (khung này vốn đã
làm sẵn từ 30/07, chỉ là không bao giờ chạy tới vì tin nào cũng bị gán người).
Kèm theo: `notifySelf` nhận thêm `projId` để bấm vào tin nhắc hạn mở đúng hồ sơ (trước bấm không đi đâu).

⚠️ Tin CŨ đã lưu vẫn còn tên người — dữ liệu đã ghi rồi. Muốn sạch thì bấm "Xoá tất cả" trên chuông.

### 22. Lịch chọn ngày bị khung cắt, không bấm được — ✅ ĐÃ SỬA (17/08 chiều)

**Chị Trâm báo (kèm ảnh)**: mở lịch trong bảng phân rã việc con thì cuốn lịch bị cắt trong khung,
không bấm chọn ngày được. *"Nên để lịch đè ra ngoài."*

**Nguyên nhân**: lịch là `<div absolute>` nằm trong ô nhập, mà ô nhập ở trong bảng có cuộn ngang /
khung giới hạn chiều cao → bị `overflow` cắt.

**Đã sửa** (`DateInput.tsx`): lịch đưa ra `<body>` bằng **portal** + `position: fixed`, định vị theo
`getBoundingClientRect()` của ô nhập; không đủ chỗ dưới thì **lật lên trên**, sát mép phải thì kéo
vào trong; cuộn/đổi cỡ cửa sổ thì tính lại vị trí; bấm-ra-ngoài xét cả vùng lịch (vì lịch đã ra khỏi
cây DOM của ô nhập). `z-[100]` để nổi trên cả hộp thoại (modal đang z-50).
Kiểm chứng: lịch là con trực tiếp của `<body>`, khung nằm trọn trong tầm nhìn.

### 23. TP nhận thông báo phê duyệt khi hồ sơ chưa qua Bước 3 — ✅ ĐÃ SỬA (17/08 chiều)

**Chị Trâm báo (kèm ảnh)**: *"Xong các việc con, Quản lý chưa kéo dự án từ Bước 2 qua Bước 3, chưa
đưa hình ảnh báo cáo lên, thì TP chưa được nhận thông báo phê duyệt. Còn giờ nhận rồi mà hồ sơ chưa
qua Bước 3 là lỗi."*

**Nguyên nhân**: khối "CHỜ DUYỆT TIẾN ĐỘ PHÒNG" trên chuông (`tpPendingItems` trong `src/App.tsx`)
chỉ xét `tienDoBoPhan >= 100`, không xét thẻ đang ở bước nào.

**Đã sửa**: thêm điều kiện `deriveKanbanStep(p) >= KANBAN_L1_ONLY_FROM` (Bước 3). Hành động **TRÌNH**
của Quản lý mới gọi Trưởng phòng vào việc, không phải con số 100%.

📌 **Còn nửa sau của góp ý này = góp ý #12 (mục C3)**: bắt buộc đính kèm **ảnh báo cáo đã gửi báo giá**
mới cho kéo Bước 2 → Bước 3. Chưa làm, nằm trong danh sách còn lại.

---

## THỨ TỰ EM ĐỀ XUẤT

1. **Xử lý rào cản 0.1–0.3** (copy repo sang ổ local, `npm install`, chạy Bản thử ở port 3001) — không có bước này thì không sửa và không kiểm chứng được gì.
2. **Nhóm A, làm từ dễ chắc ăn tới khó**: A1 (đồng hồ) → A5 (L1 xem việc đã xong) → A2 (chuông) → A3 (Gantt) → A6 (biên/zoom) → A4 (chờ Sếp chốt quy tắc).
3. **Nhóm B**: chỉ code sau khi Sếp trả lời 2 câu hỏi ở B1 và B2.
4. **Nhóm C**: theo thứ tự Sếp xếp. Em đề xuất C2 → C3 → C1 → C5(phần thông báo nội bộ) → C4, và C6 khi có mẫu.

## CÂU HỎI — TRẠNG THÁI

✅ **Đã được chị Trâm chốt hết ngày 17/08/2026**: B1 (nhãn Level + quyền BGĐ), B2 (hướng 2 —
app đấu thầu giữ bảng quyền riêng), A4 (quy tắc Quản lý sửa kế hoạch khi chờ duyệt),
C6 (mẫu bảng #13 — sheet 3). Chi tiết ghi trong từng mục ở trên.

✅ **Câu về "4 trường còn thiếu" đã đóng**: chị Trâm chỉ ra là app **đã có đủ cả 4**
(`diaChi`, `hinhThucDauThau`, `hangMuc`, `hanHenCDT`) — bản đồ trường ghi ở mục C6 chi tiết điểm 3.
Claude đã kiểm chứng lại trong code. **Không phải thêm ô nhập nào.**

⏳ **Còn 1 điểm nhỏ, hỏi khi làm tới C6**: `hangMuc` có 6 giá trị nhưng cột "Hình thức báo giá"
của mẫu chỉ có Khái toán/Chi tiết → 4 giá trị còn lại (`Báo giá phát sinh`, `Cải tạo`, `VE`,
`Lập hồ sơ thầu`) hiện lên bảng thế nào?

⛔ **Chặn kỹ thuật**: `node_modules` rỗng 34.913 file. Chị Trâm đã tạm dừng Google Drive lúc 17/08,
Claude đang xóa `node_modules` và cài lại — **phải đếm lại số file 0 byte để kiểm chứng**, đừng tin `exit 0`.

---

## NHÓM F — GÓP Ý NGÀY 18/08/2026 (mục 36 → 38)

| # | Chị Trâm nêu | Đã làm |
|---|---|---|
| **36** | *"Không nhìn thấy, cho chữ màu xám đi"* — danh sách xổ của ô chọn **Kỳ** là chữ trắng trên nền trắng | Danh sách xổ của `<select>` do TRÌNH DUYỆT vẽ, không ăn màu nền của app: ô để `bg-transparent` thì nền ra trắng mà chữ vẫn trắng. Đã đặt màu cho `<option>` ngay tại ô Kỳ **và** thêm luật chung trong `app/globals.css` (`select option` sáng: chữ slate-700/nền trắng · `.dark select option`: chữ slate-300 `#cbd5e1` / nền `#16202e`) để mọi ô chọn khác khỏi dính lại. Đo lại computed style: chữ `rgb(203,213,225)` trên nền `rgb(22,32,46)` |
| **37** | *"Chỗ này cho luôn cái xổ xuống, năm nào chọn năm đó; năm nay 2026, qua năm sau phải có 2027"* | Ô **Năm** của bảng thống kê đổi từ gõ tay sang **ô xổ xuống**. Danh sách dựng động: từ 2026 đến **năm hiện tại + 1** (nên 2027 tự hiện, sang 2027 thì có 2028 — không phải sửa code), cộng thêm mọi năm đang có trong dữ liệu để hồ sơ cũ vẫn xuất được. Đo trên app: danh sách ra `2027 · 2026`, đang chọn `2026` |
| **38** | *"Đo đếm việc ghi dữ liệu sao rồi, mỗi thao tác/đăng nhập có đọc lại toàn bộ dữ liệu không — phòng mấy chục người vào một lần thì vượt ngưỡng, trắng màn hình và tốn tiền"* | **Lo đúng chỗ — app đang ghi rất phí, đã sửa.** Xem phân tích + cách sửa ngay dưới |

### 38 chi tiết — CHI PHÍ ĐỌC/GHI FIRESTORE

**Cách app ghi TRƯỚC KHI SỬA** (`pushCollection` trong `src/lib/firebase.ts`):
1. `getDocs(collection)` — **đọc TOÀN BỘ** collection mỗi lần lưu, chỉ để biết doc nào cần xoá.
2. `batch.set()` cho **MỌI bản ghi**, kể cả bản không hề đổi.

→ Với 100 hồ sơ trên cloud, **một** thao tác nhỏ (tick xong 1 việc con) = **100 lượt đọc + 100 lượt
ghi**. Nặng hơn nữa: 100 doc vừa bị ghi lại đó bắn qua `onSnapshot` tới **mọi máy đang mở** — 30
người đang mở app là thêm **3.000 lượt đọc**. Tổng ~3.200 lượt cho một cái tick.
Hạn mức miễn phí của Firestore là 20.000 ghi + 50.000 đọc/ngày → **chỉ ~200 lần lưu là hết ghi
trong ngày**, đúng như chị lo: hết hạn mức thì máy nào mở sau sẽ không đọc được dữ liệu (màn hình
trắng) và nếu bật trả tiền thì hoá đơn phình theo.

**Đã sửa**: app giữ sẵn một bản sao (id → nội dung) của những gì cloud đang có, cập nhật liên tục từ
chính `onSnapshot`, nên lúc lưu chỉ so để biết bản nào đổi:
- Bản ghi **không đổi → bỏ qua**, 0 lượt ghi.
- Bản ghi **mới/đã sửa → ghi đúng bản đó**; bản **bị xoá → xoá đúng bản đó**.
- **Bỏ hẳn `getDocs` khi lưu** → 0 lượt đọc thừa.
- So sánh dùng chuỗi **sắp xếp khoá** (`chuoiOnDinh`), tránh cảnh cùng nội dung mà khác thứ tự khoá
  lại tưởng "đã đổi" rồi ghi thừa.

→ Cũng thao tác đó, sau khi sửa: **1 lượt ghi** (+ mỗi máy đang mở nhận đúng 1 doc). Khoảng
**100 lần nhẹ hơn**; hạn mức miễn phí đủ cho ~20.000 lần lưu/ngày thay vì ~200.

⚠️ **Đây là tính toán từ mã nguồn, chưa đo trên Firestore thật** — Bản thử không đọc/ghi cloud nên
không đếm được số thật. Sau khi deploy, vào Firebase Console → Firestore → Usage là thấy số thực tế.

**Phần còn lại chưa tối ưu (chưa cần, nhưng nên biết)**: mỗi máy khi mở app vẫn tải một lượt toàn bộ
`projects` / `staff` / `notifications` / `templates` (đây là cách `onSnapshot` hoạt động). Với 100 hồ
sơ × 30 người = ~3.000 lượt đọc mỗi sáng — vẫn nằm trong hạn mức miễn phí. Khi hồ sơ lên vài trăm
thì bước tiếp theo là **lọc theo năm/trạng thái ngay ở truy vấn** thay vì tải hết, việc này cần Sếp
quyết vì đổi cách app đọc dữ liệu.

### Mục 39 → 41 (chị Trâm nhắc thêm trong sáng 18/08)

| # | Chị Trâm nêu | Đã làm |
|---|---|---|
| **39** | *"Chưa tới năm 2027 mà sao lại hiện rồi"* | Danh sách năm em để tới **năm hiện tại + 1** nên 2027 hiện sớm. Đã sửa: chỉ tới **đúng năm hiện tại** (2026), sang 01/01/2027 thì 2027 tự có. Vẫn cộng thêm năm nào đang có trong dữ liệu để hồ sơ lên lịch sang năm vẫn xuất được. Đo trên app: danh sách còn đúng `2026` |
| **40** | Khung *"Chuyên viên thực hiện"* vẫn lọt tên Ban giám đốc dù luật là không hiện Level 4 | Lọc theo Level chưa đủ: tài khoản chức danh **"Ban giám đốc" đang mang quyền Level 1** nên vẫn lọt. Đã lọc theo đúng luật nhân sự sẵn có của app — bỏ Level 4 **và** bỏ các chức danh trong `CHUC_VU_KHONG_TINH_NHAN_SU` (Ban giám đốc · Quản trị hệ thống · Khách) **và** người đã nghỉ. Đo lại: khung còn **7 người** (Trưởng phòng · Quản lý · 5 chuyên viên), không còn Ban giám đốc / Quản trị viên |
| **41** | *"Format chưa đẹp, em render lại"* — tên nhân sự bị bẻ làm 2 dòng, chức vụ dồn sang phải | Mỗi người gọn **một dòng**: `min-w-0` + `truncate` (tên dài thì cắt bằng "…" chứ không xuống dòng), chức vụ đứng sát sau tên, ô tick và ảnh không co. Rê chuột hiện đủ "Tên — Chức vụ". Áp cho **cả hai khung** (Quản lý phụ / kế thừa và Chuyên viên thực hiện). Đo lại: mọi dòng cao đều nhau 24–26px (trước có dòng 40px+ vì bị bẻ đôi) |

### Mục 42 → 44 (chiều 18/08)

| # | Chị Trâm nêu | Đã làm |
|---|---|---|
| **42** | *"Nhiều dự án có nhiều gói thầu, hoặc triển khai GĐ2 — thêm giúp chị 1 trường dự án mẫu, có nút xổ xuống, chọn bằng tên dự án rồi lấy được các trường của dự án cũ, sau đó chị sửa lại tên gói thầu, mã dự án"* | Form **Đăng ký dự án** có thêm ô **"📋 Lấy thông tin từ dự án cũ"** (chỉ hiện khi tạo mới). Chọn dự án trong danh sách `mã · tên` là tự điền: Chủ đầu tư · địa chỉ · quốc tịch · KCN · tỉnh/thành · loại công trình · hình thức xây dựng · giai đoạn · diện tích · mức ưu tiên · hồ sơ phát thầu · hình thức đấu thầu · tình trạng · mô tả · quản lý chính + quản lý phụ. **CỐ Ý KHÔNG chép**: mã dự án, tên, ngày tháng, tiến độ, việc con, nhật ký — chép sang là hồ sơ mới mang số liệu sai. Có nút "Bỏ chọn" để nhập lại từ đầu. Kiểm chứng: chọn mẫu "2026.85 · Nhà máy Texlot GĐ1" → CĐT và địa chỉ tự điền, mã vẫn giữ mã mới `2026.86` |
| **43** | *"Mục này em hiện tên thôi không cho chọn, vì sẽ lấy từ thông tin phân rã cv con bên dưới"* (khung Chuyên viên thực hiện) | Bỏ ô tick, đổi thành **danh sách tên chỉ-xem** (ảnh + tên) lấy đúng từ người được giao việc con. Đúng với cách app vốn đang lưu: lúc bấm Lưu, `thucHienIds` được tổng hợp lại từ cây việc con (`taskAssignees`) nên danh sách tick tay trước đây **vốn đã bị ghi đè** — để ô tick chỉ khiến người dùng tưởng mình gán được. Chưa giao ai thì hiện câu nhắc "giao người ở bảng Phân rã công việc bên dưới" |
| **44** | *"Quản lý kế thừa này của bên khởi tạo gói thầu đặt nên ở đây không có được chọn, vẫn chỉ là trường hiện tên cho quản lý thấy chứ em nhỉ?"* | Đúng vậy. Tại **hồ sơ gói thầu**, khung "Quản lý phụ / kế thừa" nay là **chỉ-xem** (nhãn ghi rõ *"do bên khởi tạo dự án đặt — chỉ xem"*), chưa đặt ai thì ghi "Dự án này chưa đặt quản lý phụ / kế thừa". Vẫn **tick được ở hồ sơ DỰ ÁN** — đúng chỗ khởi tạo. Kiểm chứng: mở form gói thầu, cả mục 1 còn **0 ô tick** |

### Mục 45 → 47 (chiều 18/08, sau khi chị Trâm dùng thử ô "Dự án mẫu")

| # | Chị Trâm nêu | Đã làm |
|---|---|---|
| **45** | *"Khi chọn dự án, chị cũng muốn truy xuất được các nội dung trong ô khoanh đỏ nữa"* (quốc tịch CĐT · hình thức xây dựng · hồ sơ mời thầu · diện tích · hình thức đấu thầu · quản lý chính) | Code vốn đã chép các trường đó — **trống là do DỮ LIỆU**: hồ sơ DỰ ÁN CHA chỉ khai tên + CĐT + địa chỉ, mấy trường kia nằm ở GÓI THẦU CON. Đã xử lý 2 lớp: (a) App gộp sẵn thông tin mẫu của mỗi dự án = dự án cha + **gói thầu con mới nhất** (ô nào cha trống thì lấy của con) rồi truyền vào form; (b) bộ 9 hồ sơ nháp khai đủ các trường này để thử được ngay. Kiểm chứng: chọn mẫu "2026.85 · Texlot GĐ1" → quốc tịch `Đài Loan` · diện tích `32000` · hình thức xây dựng `Xây mới` · hồ sơ mời thầu `CĐT phát thầu` · hình thức đấu thầu `Đấu thầu cạnh tranh` · quản lý chính `Phan Thành Quốc`, mã dự án vẫn giữ mã mới `2026.86` |
| **46** | *"Chỗ chọn dự án mẫu cho chị thêm chỗ gõ tên cho dễ tìm giữa hàng trăm dự án"* + *"xóa bớt cách em ghi chú"* | Đổi ô xổ xuống thành **ô gõ tìm**: gõ tên / mã / tên CĐT là lọc ngay (danh sách tối đa 40 dòng, mới nhất lên đầu), bấm một dòng là lấy thông tin và hiện thẻ xác nhận "✓ đã lấy thông tin" kèm nút Bỏ chọn. Ghi chú rút còn **một dòng**. Kiểm chứng: gõ "texlot" → lọc đúng 3 dòng khớp |
| **47** | *"Bị chồng nè em"* — cột **NGÀY** đè lên cột **BP 70%** ở bảng phân rã | Do mục 24: ô số ngày nhập được "3,5" nên em nới ô nhập lên `w-14` mà **quên nới cột** (`w-12` = 48px) → tràn sang cột bên. Đã nới cột Ngày `w-16`, hai cột BP/TP `w-14`, bảng tối thiểu `680px`. |

### Đã chạy thử lại (không chỉ đọc code) trong đợt này

| Việc | Kết quả đo trên app |
|---|---|
| Cửa **ảnh báo giá** khi kéo Bước 2 → 3 (mục 12) | Dựng hồ sơ ở Bước 2 với Bộ phận 100% và chưa có ảnh → bấm mũi tên tiến: hiện toast *"Cần đính kèm ẢNH BÁO CÁO ĐÃ GỬI BÁO GIÁ trước khi trình Phòng duyệt (Bước 3)"* và bật hộp đính kèm, có dòng chặn "Chưa có ảnh nào" + nhắc Ctrl+V. Thẻ KHÔNG qua bước 3 |
| Chia việc con cho nhiều người rồi **bấm Lưu** (mục 7 / 25) | Sau khi lưu, dữ liệu ghi ra `thucHienIds` gồm đủ cả 2 người và việc con tách 50/50 đúng tên từng người |
| Ô **Dự án mẫu** (mục 42/45/46) | Gõ tìm → chọn → 8 trường thông tin chung tự điền, mã/tên/ngày vẫn trống |
| Ô chọn **Kỳ / Năm** (mục 36/37/39) | Chữ trong danh sách xổ đọc được (xám trên nền tối); danh sách năm chỉ có `2026` |
| Hai khung nhân sự ở form gói thầu (mục 43/44) | Cả mục 1 còn **0 ô tick**; hiện đúng câu "tự lấy từ phân rã công việc con" và "do bên khởi tạo dự án đặt" |

### Mục 48 → 51 (bảng phân rã việc con — chị Trâm chỉ trên ảnh, chiều 18/08)

| # | Chị Trâm nêu | Đã làm | Đo lại trên app |
|---|---|---|---|
| **48** | *"Làm cho đậm lên dễ đọc hơn"* — mốc ngày trên trục Gantt quá mờ | Mốc ngày từ `8px` xám nhạt → **`10px`, đậm 900**, màu chữ chính (slate-600 / slate-200 ở nền tối) | `font-size 10px · weight 900 · màu sáng` |
| **49** | *"Nếu tên này dài em cho xuống dòng, chứ đừng mất chữ"* | Ô nhập không xuống dòng được nên khi **chỉ xem** đổi sang chữ thường có `whitespace-normal break-words` → tên dài tự xuống dòng, không cắt. Lúc **đang sửa** vẫn là ô nhập (kèm tooltip đầy đủ) | Chế độ xem hiện đủ tên, không còn "…" |
| **50** | *"NGƯỜI GIAO ⇒ đổi thành NGƯỜI THỰC HIỆN; tên hiển thị 2 chữ: HỌ + TÊN, bỏ chữ lót"* | Đổi nhãn cột; thêm `tenHoVaTen()` — "Nguyễn Cảnh Hồng Quân" → **"Nguyễn Quân"**, "Nguyễn Xuân Thi" → **"Nguyễn Thi"**. Giữ họ để hai người trùng tên riêng vẫn phân biệt được | Tiêu đề cột = "Người thực hiện"; ô hiện `Nguyễn Thi`, `Nguyễn Quân` |
| **51** | *"Khối khoanh đỏ move qua tí để không có khoảng trống giữa tên người giao và thời gian bắt đầu, lúc đó có thêm khoảng trống để thể hiện biểu đồ Gantt"* | Nới cột tên việc `24% → 26%`, thu cột Người thực hiện `15% → 11%` (tên nay ngắn nên không cần rộng) và cột Bắt đầu `w-28 → w-24` → khối giữa dồn sang trái, phần dư trả hết cho biểu đồ Gantt | Bảng không còn khoảng hở giữa 2 cột |

### Mục 52 → 57 (chiều–tối 18/08)

| # | Chị Trâm nêu | Đã làm | Đo lại |
|---|---|---|---|
| **52** | Ô "Dự án mẫu" *"không show ra như dị, chỉ cần cho chị nút xổ xuống và thêm chỗ gõ tên"* | Danh sách **gập lại**, chỉ còn 1 nút xổ xuống. Bấm mới bung bảng có **ô gõ tìm** (tên / mã / CĐT) + danh sách; chọn xong tự gập và hiện tên dự án đã chọn | Lúc đầu gập ✓ · mở ra có ô tìm ✓ · gõ "phuc sinh" lọc đúng ✓ · chọn xong gập lại và điền CĐT + quốc tịch ✓ |
| **53** | Biểu đồ Gantt: *"màu chữ mờ nhạt quá, đọc không rõ"* + *"chỉ tô cam màu Chủ nhật thôi, thứ 7 công ty vẫn làm"* | Tên thứ + ngày đổi sang **in đậm, màu chữ chính**; chỉ **Chủ nhật** mới tô cam, T7 để bình thường | Đo: chỉ ô CN có `bg-brand-warning`, T7 1/8 không tô |
| **54** | *"Nếu bấm xem theo tuần thì bên dưới tuần vẫn có mục ngày tháng"* + *"Tuần 1 tính từ đầu năm, không phải tính từ tuần có dự án bắt đầu"* | Cột tuần hiện **"Tuần {số tuần trong năm}" (chuẩn ISO, tuần bắt đầu từ Thứ Hai)** + khoảng ngày + **hàng ô ngày** của tuần đó bên dưới. Lưới Gantt kéo mốc đầu về Thứ Hai và làm tròn số ngày theo tuần để cột tuần khớp lịch | Đo: `Tuần 30 · 20/7 → 26/7 · 20 21 22 23 24 25 26`, ô đầu lưới là `T2 20/7` |
| **55** | *"Template mẫu đưa ra ngoài này, hèn gì chị tìm không thấy"* · *"cho chị mục các level nào được thấy"* · *"mẫu nào cũ thì bấm mẫu cũ, tự gạch bỏ hoặc chuyển mục biểu mẫu đã hủy"* | (a) Template mẫu tách khỏi Lịch cá nhân, thành **mục riêng trên thanh tác vụ** (mọi cấp vào được, kể cả L3/L4). (b) Mỗi biểu mẫu chọn **cấp được thấy** (L1/L2/L3/L4; không chọn = mọi cấp), người không thuộc cấp đó không thấy biểu mẫu. (c) Nút **"Mẫu cũ"** chuyển biểu mẫu xuống mục **"Biểu mẫu đã hủy"** — tên bị gạch ngang, có nút dùng lại; vẫn giữ nút xoá hẳn | Đo: thêm mẫu chọn L1+L2 → nhãn `👁 L1 Trưởng phòng · L2 Quản lý`; bấm Mẫu cũ → xuất hiện mục "Biểu mẫu đã hủy" |
| **56** | Bảng thống kê ISO: *"hiển thị số 1 ở các ô nhận xét, phân tích thầu, hình thức đấu thầu cạnh tranh, gói thầu đã có kết quả, thống kê có đề xuất tối ưu chi phí — chọn symbol, nó sẽ hiện dấu tick; số 0 là loại không tính"* | Các ô đó đổi từ số sang **✔ (xanh)**; ô Nhận xét khi gửi **trễ hạn** hiện **✘ (đỏ cam)**; không thuộc diện thì để trống. **Dòng TỔNG HỢP giữ nguyên SỐ** để cộng được, đúng như file mẫu | Xuất thử với 9 hồ sơ nháp: **22 dấu ✔ · 1 dấu ✘**, dòng TỔNG HỢP vẫn ra số |
| **57** | (kèm theo #55) Nhân viên L3 và Ban giám đốc L4 phải vào được mục Template | Thêm `TEMPLATES` vào danh sách tab của L4 và mở cho L3 | Bấm mục Template mẫu ở thanh tác vụ vào được |

### Mục 58 — Bảng ISO phải CỘNG ĐƯỢC (chị Trâm chốt 18/08/2026, quan trọng)

> *"Chỗ xuất bảng em cho công thức nhé, bên dưới là mục tổng cộng. Sở dĩ chị cho dấu tick = 1, còn
> dấu chéo = 0 chính là để SUM xuống đó em, do tính tiến độ hoàn thành dựa trên tiến độ hoàn thành
> đúng kế hoạch / tổng tiến độ."*

Mục 56 mới đổi hiển thị thành ✔/✘ nhưng ghi thẳng ký tự vào ô → **cộng không được**. Đã sửa lại cho
đúng ý: **ô vẫn là SỐ 1 / 0**, Excel chỉ *hiển thị* thành ✔ / ✘ bằng **định dạng số**
`[Green]"✔";;[Red]"✘"` (Excel cũ không đọc được định dạng thì hiện 1 / 0 — cộng vẫn đúng).

Kèm theo:
- **Dòng TỔNG HỢP dùng công thức thật** `=SUM(F5:F20)`… cho mọi cột số (SKH và Nhận xét của từng
  tháng · 5 cột Phân tích thầu · đấu thầu cạnh tranh · đã có kết quả · có đề xuất tối ưu). Chị sửa
  tay ô nào thì tổng tự chạy lại, không phải sửa số ở dưới.
- **Thêm dòng "TỶ LỆ GỬI ĐÚNG HẠN"** ngay dưới TỔNG HỢP: `=IF(SKH=0,"",Nhận xét/SKH)`, định dạng %.
  Đây chính là "tiến độ hoàn thành đúng kế hoạch / tổng" mà chị cần.
- **Chiều cao dòng TỔNG HỢP tăng 1,5 lần** (34px) cho dễ nhìn; dòng tỷ lệ 30px.

Đo lại trên bản xuất Kỳ 3: **20 công thức** (`=SUM(F5:F20)`, `=SUM(J5:J20)`… và
`=IF(F21=0,"",J21/F21)`), có định dạng tick, có dòng TỶ LỆ.

### Đã xuất thử KỲ 3 theo yêu cầu (18/08)

Bịa 6 hồ sơ có ngày gửi rơi vào tháng 12/2025 → 3/2026 rồi xuất: tiêu đề **KỲ 3 - NĂM 2026**, 4 cột
tháng ra đúng **12/2025 · 1/2026 · 2/2026 · 3/2026** (tháng 12 tự lấy năm trước). Kiểm được đủ các
tình huống: 1 hồ sơ gửi **2 lần trong cùng tháng 12** (trải 2 dòng, merge ô định danh, lần 1 ✔ lần 2 ✘),
1 hồ sơ **Thắng**, 1 hồ sơ **Thua**, 1 hồ sơ hạng mục **VE** (tự đánh dấu cột đề xuất tối ưu chi phí),
1 hồ sơ **Ngưng triển khai**, 1 hồ sơ chưa gửi → **Tiếp cận CĐT**.
⚠️ 6 hồ sơ "[THỬ KỲ 3]" chỉ nằm trong localStorage của Bản thử trên máy chị Trâm, **không có trong
mã nguồn**; bấm "Xoá sạch dữ liệu bản thử" rồi "Nạp 9 hồ sơ NHÁP" là sạch.

📌 **Một điểm chờ chị Trâm chốt**: hồ sơ KHÔNG có lần gửi nào trong kỳ vẫn được liệt kê (cột tháng để
trống) — đúng như file mẫu ISO. Nếu Phòng muốn **chỉ liệt kê hồ sơ có phát sinh trong kỳ** thì sửa
`hoSoVaoBangISO` để lọc thêm; đây là quy tắc nghiệp vụ nên KHÔNG tự đổi.

### Mục 59 — Sửa tiếp bảng ISO (chị Trâm, tối 18/08)

| Chị Trâm nêu | Đã làm |
|---|---|
| *"Bỏ e"* — dòng **TỶ LỆ GỬI ĐÚNG HẠN** | Đã bỏ khỏi bản xuất. Dòng TỔNG HỢP giữ nguyên công thức `=SUM(...)` (16 công thức), chị tự lập tỷ lệ trong Excel nếu cần |
| *"Format không ra được chữ tick hoặc chấm than"* | **Lỗi escape trong mã**: chuỗi định dạng nằm trong template literal của JS nên phải viết `\0022` (nháy kép) và `\;` (chấm phẩy); bản trước viết thiếu một dấu gạch → chuỗi ra `[Green]2✔2BB[Red]2✘2`, Excel không hiểu nên hiện số 1/0. Đã viết lại đúng: `mso-number-format:"[Green]2✔2\;\;[Red]2✘2"` |

⚠️ **Cho phiên sau**: nếu Excel của Phòng VẪN hiện 1 / 0 thay vì ✔ / ✘ thì **đừng đổi ô thành chữ**
(mất khả năng SUM — đúng cái chị Trâm cần nhất). Hai đường đi đúng: (a) giữ số + để chị Trâm định
dạng ô một lần trong Excel, hoặc (b) thêm gói `xlsx-js-style` để ghi .xlsx thật có định dạng.

### Mục 60 — Dấu tick đổi sang XANH DƯƠNG (chị Trâm, tối 18/08)

*"Đổi màu hộ mình tick xanh lá thành xanh dương cho dễ nhìn."* → định dạng số của ô tick đổi
`[Green]` → `[Blue]`: **✔ xanh dương · ✘ đỏ**. Ô vẫn là số 1/0, 16 công thức `=SUM(...)` giữ nguyên.
Đã kiểm trong bản xuất: `mso-number-format:"[Blue]…✔…;;[Red]…✘…"`.

---

## NHÓM G — GÓP Ý CHIỀU 18/08/2026 (mục 61 → 69)

Chị Trâm dùng thử trên bản chạy thử (port 3002) và báo trực tiếp. Tất cả đã sửa xong trong cùng
phiên, `npx tsc --noEmit` exit 0, đo lại trên app, đã commit + push lên `main` của repo ver2.

| # | Chị Trâm nêu | Nguyên nhân thật | Đã làm | Đo lại trên app |
|---|---|---|---|---|
| **61** | *"Phóng to vẫn có lỗi bị mất đi thông tin này, e co lại nhé, và ko đc để thông tin nào lọt ra ngoài khi ctrl và cuộn"* | Khay "xem nhanh hồ sơ" nằm trong `<td colSpan={9}>` của bảng Báo cáo tiến độ, nên bề rộng ăn theo **BỀ RỘNG CẢ BẢNG** (1206px CSS) chứ không theo vùng đang thấy (607px). Phóng to chữ là bảng rộng gần gấp đôi vùng thấy → nửa khay bị đẩy ra ngoài, phải cuộn ngang mới thấy | `App.tsx`: đo bề rộng vùng đang thấy của khung cuộn bằng **ResizeObserver** (`rongVungXemBang`), đặt vào biến CSS `--rong-vung-xem`; thêm luật `.drawer-vung-xem` trong `app/globals.css` — `position: sticky; left: 0; width: var(--rong-vung-xem)` (chỉ từ 768px, dưới đó bảng đã reflow thành thẻ) | Cỡ chữ **140%**: khay rộng đúng **869px** = clientWidth khung cuộn, mép phải khay = mép phải khung (1626px), **0 phần tử lọt ra ngoài**. Cuộn hết sang phải (scrollLeft 338px): khay vẫn đứng ở mép trái, vẫn 0 phần tử lọt |
| **62** | *"Công việc con mỗi dự án các bạn tạo e đưa thành thư viện, rồi mỗi lần các bạn bấm khởi tạo công việc, thì e cho gợi ý lên đó tên 2 công việc con thường xuyên xuất hiện nhất, sau khi các bạn bấm vô thêm công việc mới thì xổ ra danh sách tên thường xuất hiện cho các bạn chọn, rồi sửa trực tiếp các tên đó trên thanh công cụ luôn, sau đó mới bấm thêm công việc"* | — (tính năng mới) | File mới `src/utils/thuVienViecCon.ts`: đếm tên việc con của **mọi hồ sơ**, gộp không phân biệt hoa/thường + khoảng trắng, hiện lại cách viết phổ biến nhất, bỏ việc do app tự tách cho từng người (tên dạng `Tên — Người`). `App.tsx` dựng thư viện bằng `useMemo` rồi truyền xuống **cả 3 chỗ** có bảng phân rã (form hồ sơ, hộp kéo về/dời tiến độ, xem nhanh). `SubtaskGantt.tsx`: bấm "Thêm việc con" là mở thanh **và xổ luôn thư viện** — 2 tên hay gặp nhất thành nút bấm nhanh (kèm số lần), nút "Thư viện tên việc (n)" mở danh sách đầy đủ có ô gõ tìm; chọn tên nào thì tên đó vào ô nhập để **sửa trực tiếp** rồi mới bấm Thêm | Thư viện đọc ra **16 tên** từ 9 hồ sơ nháp; bấm "Bóc tách khối lượng phần mở rộng" → ô nhập nhận đúng tên, danh sách tự gập lại; 2 nút gợi ý nhanh vẫn còn |
| **63** | *"Template mẫu lên trc lịch cá nhân"* | — | Chuyển nút `btn-nav-templates` lên **trước** `btn-nav-calendar` trong thanh tác vụ | Thứ tự: … Biểu Đồ Gantt → **Thông báo - Template** → Lịch cá nhân → Nhật Ký Hoạt Động |
| **64** | *"c mới xóa 2 biểu mẫu thì ko thấy nằm ở đâu trong thùng rác nữa"* → *"cho c nút phục hồi biểu mẫu lỡ xóa đi"* | Nút 🗑 cũ gọi `onDelete` → `setTemplates(prev => prev.filter(...))` = **xoá thẳng khỏi dữ liệu**, không có bản lưu nào | `types.ts` thêm `daXoa` / `ngayXoa` / `nguoiXoa`. Nút 🗑 nay chỉ **bỏ vào thùng rác**; `TemplateMauPanel` có mục **"Thùng rác biểu mẫu (n)"** với nút **↩ Phục hồi**; **xoá vĩnh viễn** là nút riêng trong thùng rác, có `window.confirm`. Sửa luôn lỗi sort mục biểu mẫu cũ (so `b.ngayHuy` với chính `b.ngayHuy`) | Xoá biểu mẫu "hihi" → localStorage `daXoa: true, nguoiXoa: "Ngô Nữ Quỳnh Trâm"`, mục Thùng rác (1) hiện ra; bấm Phục hồi → `daXoa: false`, đếm biểu mẫu về **1**, mục Thùng rác biến mất. ⚠ **2 biểu mẫu chị xoá TRƯỚC khi có tính năng này thì không lấy lại được** |
| **65** | *"với nút này thay thành Thông báo - Template với, có nội dung j cần thông báo cho cả phòng thì báo trên này luôn, khi c chọn level nào đc thấy là nó báo cho các level đó luôn"* | — | Đổi nhãn mục thành **"Thông báo - Template"** (biểu tượng `Megaphone`); **chuyển khung Thông báo nội bộ** từ tab Lịch cá nhân sang tab này; thêm cách chọn người nhận thứ 3 — **Theo cấp (level)**: tick L1/L2/L3/L4, nhãn hiện sẵn số người mỗi cấp, cấp không có ai thì nút tự tắt | Gửi thử tin chọn **L3** → đúng **5 người nhận** (`targetIds` S004…S008), bản ghi lưu `kieuNhan: "theoCap", capNhan: ["STAFF"]` |
| **66** | *"thông báo nội bộ cũng rất quan trọng, sẽ đc lưu lại, chứ phải chỉ là 1 cái thông báo rồi trôi đi đâu nhé"* | Trước đó tin chỉ đi qua `pushNotify` → nằm trong `notifications`, mà chuông **chỉ giữ 30 tin/người** nên tin cũ bị đẩy ra khỏi danh sách | `types.ts` thêm `ThongBaoNoiBo`; `App.tsx` thêm state `thongBaoNoiBo` + localStorage `erp_thongbao_noibo` + đồng bộ collection Firestore mới **`announcements`** (cùng cách làm với `templates`). Panel liệt kê **"Thông báo đã lưu (n)"**: nội dung, người gửi, giờ-ngày, gửi cho ai. L1/L2 xem hết + xoá được (có hỏi lại); cấp khác chỉ đọc tin mình đã nhận | Mục "THÔNG BÁO ĐÃ LƯU (2)" hiện đúng 2 tin kèm `Phan Thành Quốc · 11:37 18-08-2026 · gửi cho L3 Nhân viên — 5 người` |
| **67** | *"2 cái này có khác nhau j đâu, làm 1 nút thôi"* (2 nút 📦 đánh dấu mẫu cũ và 🗑 xoá ở mỗi dòng biểu mẫu) | Hai nút hai khái niệm gần nhau ("mẫu cũ" vs "xoá") nhưng biểu tượng nhìn như nhau | Bỏ hẳn nút 📦. Mỗi dòng chỉ còn **một nút 🗑** → thùng rác. Biểu mẫu đã mang cờ `daHuy` của bản trước cũng **gom vào cùng thùng rác** để không còn 2 mục na ná nhau; nút Phục hồi xoá cả 2 cờ | Dòng biểu mẫu đếm được đúng **1 nút** (title: "Xoá biểu mẫu — vào thùng rác, phục hồi lại được") |
| **68** | *"cái chữ tên đó mỗi lần c click vô nó chuyển đi đâu vậy e?"* — kèm ảnh trình duyệt ở `localhost:3002/k,jklk` báo **404** | Tên biểu mẫu là `<a href={t.link}>`. Chị khai link là `k,jklk` (không phải URL) nên trình duyệt hiểu là **đường dẫn trong app** → 404 | Thêm `linkMoDuoc()` nhận 4 dạng thật dùng ở phòng (`https://`, `http://`, `www.`, `\máy-chủ\…`, `D:\…`). Link **không hợp lệ thì KHÔNG render thành liên kết** mà để chữ thường + cảnh báo in rõ link đang khai; mỗi dòng biểu mẫu **in luôn đường link** để biết bấm vào đi đâu; ô nhập link **cảnh báo ngay lúc gõ** và nút "Thêm biểu mẫu" chỉ bật khi link mở được | Dòng "hihi" hiện: *"Link chưa đúng: “k,jklk” — sửa lại thành https://… hoặc \máy-chủ	hư-mục mới mở được"*, tên không còn bấm được |
| **69** | *"Chỗ hình ảnh của quản lý drop zalo đã gửi file, c nhìn cái đó ở đâu ta?"* | **KHÔNG PHẢI LỖI — là giới hạn kiến trúc.** `AnhBaoCaoModal` và mọi ô đính kèm khác của app **chỉ lưu TÊN TỆP** (`utils/attachments.ts`), không lưu nội dung ảnh, vì app chưa dùng Firebase Storage và 1 document Firestore tối đa 1MB | Chưa làm gì — **chờ chị Trâm / Sếp quyết**. Chỗ xem hiện tại: tab **Báo Cáo Tiến Độ** → bấm ▼ đầu dòng hồ sơ → khối **"Kết quả kiểm tra & tiến độ cấp Phòng"** → dòng **"Ảnh báo cáo đã gửi báo giá (n)"** — chỉ liệt kê **tên tệp**, không mở được ảnh | — |

### Mục 69 — hai đường đi nếu muốn XEM ĐƯỢC ảnh thật (cần Sếp/IT quyết)

1. **Bật Firebase Storage** — cách đúng chuẩn: tải ảnh thật lên, app lưu đường dẫn Storage rồi hiện
   ảnh. Phát sinh chi phí lưu trữ + băng thông, và cần IT mở dịch vụ + viết rules.
2. **Nhúng ảnh nén vào Firestore (base64)** — không cần dịch vụ mới, nhưng **1 document tối đa 1MB**
   nên phải nén mạnh (ảnh chụp Zalo ~700KB là chạm ngưỡng), và mỗi lần đọc hồ sơ là tải cả ảnh →
   tốn lượt đọc/băng thông, đi ngược mục 38 (giảm chi phí Firestore).

Claude **không tự chọn** — đây là quyết định có phát sinh chi phí.

### Mục 70 → 72 (bảng phân rã việc con — chị Trâm dùng thử chiều 18/08)

| # | Chị Trâm nêu | Nguyên nhân thật | Đã làm | Đo lại trên app |
|---|---|---|---|---|
| **70** | *"c thêm 0.5 ngày app đọc ko hiểu"* | Ô NGÀY gọi `lamTronNuaNgay` **ngay trong `onChange`** = làm tròn theo TỪNG KÝ TỰ vừa gõ. Gõ "3.5": sau ký tự "3" ô đã chốt thành 3, gõ tiếp "5" thành "35" → ra **35 ngày**. Gõ kiểu Việt Nam "3,5" thì `<input type="number">` coi dấu phẩy là không hợp lệ, trả chuỗi rỗng → tụt về 0,5 | Tách thành `ONhapSoNgay`: trong lúc gõ **giữ nguyên chữ người dùng nhập** (ô `type="text" inputMode="decimal"` nên "3," hay "3." đều hiện được), chỉ chuẩn hoá về bội số 0,5 khi **rời ô hoặc Enter**. Chị Trâm chốt *"cứ khai dùng chung dấu chấm và dấu phẩy như nhau"* → cả `3.5` và `3,5` đều ra 3,5. Mũi tên ↑/↓ vẫn nhảy 0,5 | `0.5`→**0,5** · `0,5`→**0,5** · `3,5`→**3,5** · `3.5`→**3,5** · `2,5`→**2,5** · `4`→**4** · `3.2`→**3** · `3.8`→**4** · `0`→**0,5** · `7`→**7** |
| **71** | *"tên công việc con dài chưa tự động xuống dòng nè e"* | Mục #49 chỉ sửa cho chế độ **XEM**; lúc **đang sửa** vẫn là `<input>` — thẻ input không bao giờ xuống dòng được nên tên dài bị cắt | Ô sửa đổi sang `AutoGrowTextarea` (`minRows={1}`): tên dài tự xuống dòng và ô tự cao thêm. **Enter = xong** (rời ô), không thêm dòng mới, vì đây là tên việc chứ không phải đoạn văn | Gõ tên 105 ký tự: ô cao từ **34px → 65px**, `scrollHeight == clientHeight` (không cắt chữ), hiện đủ 3 dòng |
| **72** | *"lỗi hiển thị nữa nè e"* — kèm ảnh: danh sách chọn Người thực hiện **đè lên dòng tiêu đề bảng, bị cắt mất phần trên** và sinh thêm thanh cuộn | Danh sách là `absolute` nằm TRONG ô bảng, mà bảng việc con có `overflow-x-auto` và thẻ bọc ngoài có `overflow-hidden` → phần tràn ra ngoài khung bị **CẮT**. Cùng đúng loại lỗi với lịch chọn ngày (mục #22) | Chữa cùng cách mục #22: đưa danh sách ra `<body>` bằng **portal** + `position: fixed`, tự **lật lên** khi không đủ chỗ dưới và **kéo vào** khi sát mép phải, cuộn/đổi cỡ cửa sổ thì tính lại toạ độ (bắt `scroll` ở pha capture để nhận cả cuộn ngang của bảng). Thêm **bấm ra ngoài là đóng** (loại trừ chính hộp danh sách và ô vừa bấm) | Danh sách nay là con của `<body>`, `position: fixed`, `z-index 70`; hộp 208×288px nằm **trọn trong tầm nhìn**; **không còn tổ tiên nào có overflow** để cắt |

### Mục 73 → 78 (chiều 18/08/2026) — chị Trâm đã chốt lại logic việc con

> Chị Trâm dừng mục 73 một lúc để suy nghĩ, sau đó **chốt lại đầy đủ** (nguyên văn):
> *"nếu 1 cv con cấp 1 giao cho 2ng, thì 2 công việc con nhỏ cấp 2 đó phải lấy tỷ lệ lớn (60%) chia
> cho tỷ lệ nhỏ (mỗi cv con cấp 2 30%), hoặc nếu người nhập muốn sửa 35%-25% trong tỷ lệ nhỏ cũng đc,
> tùy họ, còn lúc e tự sinh ra thì e phải chia đều, và sinh ngay lúc người ta vừa bấm cho 2 người hoặc
> 3 người và tắt trường chọn tên là e sinh ngay. Còn bên màn hình hiển thị của ng giao việc thì e phải
> hiểu là chỉ hiển thị 1 công việc con cấp 2 thôi nhé em. Về thời hạn thì thời hạn bắt đầu của cv con
> cấp 1 sẽ là thời hạn bắt đầu nhỏ nhất của cv con cấp 2, còn ngày thực hiện sẽ lấy ngày kết thúc muộn
> nhất của cv con cấp 2, và trừ đi ngày bắt đầu nhỏ nhất của cv con cấp 2 để tính, không suy ngược lại
> nha em, chỉ suy 1 chiều."*

| # | Yêu cầu | Nguyên nhân / chỗ sửa | Đo lại trên app |
|---|---|---|---|
| **73a** | Tỉ trọng phần cấp 2 chia **từ tỉ trọng việc cấp 1** | `SubtaskGantt.datNguoiLam` đang chia từ 100 (`Math.floor(100 / danh.length)`) nên cha 60% mà con ra 50/50. Nay chia từ `t.weight`, phần dư chia lần lượt 1% cho các phần đầu | Cha **60** → hai phần **30 / 30** |
| **73a-bis** | Dữ liệu đã chia **trước** bản sửa vẫn mang số cũ (chị Trâm báo: *"hình như bản deploy chưa chỉnh cái này thì phải"* — ảnh cha 34% mà con 50/50) | Thêm `chuanHoaTiTrongCon`: giữ nguyên **tỉ lệ** giữa các phần, chỉ co/giãn cho tổng khớp tỉ trọng cha. Chạy khi mở bảng (chế độ sửa) và sau mỗi lần đổi → số cũ tự sửa, mà người dùng đặt 35–25 thì vẫn giữ đúng ý | Đặt cha **34** → hai phần tự về **17 / 17** |
| **73b** | Sinh phần cấp 2 **ngay khi tắt ô chọn tên**, chia đều | Trước đây mỗi lần tick một tên là sinh/chia lại ngay → tick 3 lần là chia 3 lần. Nay tick chỉ đổi **bản nháp** (`nguoiDangTick`), đóng ô (bấm Xong / bấm ra ngoài) mới áp dụng một lần | Tick 2 tên: bảng vẫn 2 dòng; bấm **Xong** mới ra 4 dòng. Câu nhắc trong ô ghi trước: *"Bấm Xong là chia 60% của việc này thành 2 phần ≈ 30% mỗi người"* |
| **73c** | Thời hạn **suy một chiều** cấp 2 → cấp 1 | `rows` tính các phần cấp 2 trước rồi suy việc cấp 1: bắt đầu = **min** ngày bắt đầu của cấp 2, số ngày = **max** ngày kết thúc − min ngày bắt đầu. Ghi luôn vào dữ liệu qua `dongBoNgayChaTuCon` để các màn khác (hạn nhân sự, mốc kết thúc dự án, Gantt lớn) đọc cùng một số. **Khoá** 2 ô Bắt đầu / Ngày của việc cấp 1 — cho gõ 2 chiều thì sửa bên nào cũng đè bên kia | Con 2 đổi thành **5 ngày** → cha thành **5 ngày**. Con 2 đổi ngày bắt đầu **21-08** (con 1 vẫn 18-08, 3 ngày) → cha **18-08 · 8 ngày**. Hai ô của cha hiện `(khoá)` |
| **73d** | Màn hình người được giao việc chỉ hiện **một** việc con cấp 2 | `MyTasksPanel` duyệt cả cây và khớp `assignedStaffIds`; việc cấp 1 giữ đủ danh sách người (để RBAC không cắt tầm nhìn) nên mỗi người khớp **cả cấp 1 lẫn phần cấp 2 của mình** → 2 dòng, tỉ trọng đọc lên lệch (60% và 30%). Nay việc đã chia thì bỏ qua dòng cấp 1 | Bộ 9 hồ sơ nháp chưa có việc nào chia nên danh sách không đổi; kiểm bằng dữ liệu: hàm chỉ ẩn dòng **đã chia** |
| **74** | *"Trâm có thể kéo bước 1 qua bước 2, trước khi hiện qua bước 2 thì hiện bảng box lên cho xem lại, điền đầy đủ xong bấm lưu là xong"* · *"đừng khóa cứng là bấm chạy qua báo cáo tiến độ rồi mới đc qua bước 2"* | `handleKanbanMove` trước đây chỉ hiện một câu nhắc rồi `return`. Nay với Trưởng phòng: mở luôn form hồ sơ đó; bấm "Lưu Hồ Sơ" là cờ chờ-duyệt được xoá và thẻ **tự sang Bước 2** (`reapprovedNow` / `tpLuuTaiBuoc1`). Sửa cả tooltip của nút mũi tên | Bấm mũi tên ở thẻ Bước 1: form mở, toast *"Mở hồ sơ để Trưởng phòng soát lại kế hoạch…"*, tooltip đổi thành *"Bấm để mở hồ sơ soát lại kế hoạch…"* |
| **75** | *"Quản lý level 2 ko bị khóa phải nhập tiến độ cv của mình… thì mở trường dự án lên cho quản lý + thông báo cần hoàn thành cv con + chụp ảnh màn hình đã báo cáo, sau khi quản lý cập nhật đầy đủ và bấm lưu dự án thì tự động qua bước 3… sẽ xác nhận 2 lần"* | Thêm cờ `choQuaBuoc3`: Quản lý kéo 2 → 3 mà thiếu thì mở form + nói rõ thiếu gì (không chặn cứng). Lưu xong nếu đã đủ thì hỏi lại *"Chắc chắn lưu chỉnh sửa…"* rồi mới sang Bước 3 — **xác nhận 2 lần** (bấm Lưu + câu hỏi). Bấm Huỷ thì **vẫn lưu** phần đã sửa, chỉ không sang bước. **Kèm theo**: thêm ô **Ảnh báo cáo đã gửi báo giá** vào form (kéo-thả · bấm chọn · **Ctrl+V dán ảnh**) — trước đây ô này chỉ có trong hộp riêng nên Quản lý được mở form mà không có chỗ bổ sung ảnh → kẹt vòng lặp | Kéo 2→3: toast *"Còn thiếu: tiến độ công việc con mới 45% (cần đủ 100%) · chưa có ảnh báo cáo đã gửi báo giá"*, form mở. Dán ảnh bằng Ctrl+V → nhận `anh-da-gui-bao-gia-20260818-144138.png`; tick việc con → tiến độ Bộ phận **100%**; bấm Lưu → hộp hỏi *"Chắc chắn lưu chỉnh sửa và trình hồ sơ … sang Bước 3?"* → OK → `kanbanStep = 3` |
| **76** | *"Biểu mẫu chỉ có level 1 mới đc xóa vĩnh viễn"* | Nút 🗑 xoá vĩnh viễn trong thùng rác nay chỉ hiện khi `vaiTro === 'BOOD'`; Quản lý vẫn thêm biểu mẫu và bỏ vào thùng rác được (hai việc đó còn lấy lại được) | Câu chú thích trong thùng rác cũng đổi theo cấp đang xem |
| **77** | *"render lại cho cái bảng chọn tên nằm bên cạnh nút chọn người giao việc"* | `tinhViTriChon` trước đây đặt bảng **dưới** ô nên che mất các dòng bên dưới và nhìn rời rạc. Nay đặt **sát phải** ô, mép trên thẳng với ô; hết chỗ bên phải thì lật sang trái; vẫn kẹp trong tầm nhìn | — |
| **78** | Lỗi IT báo đã sửa ở bản chạy trên App Tổng: bấm "Lưu hồ sơ" liên tục 2–3 lần thì lệnh ghi chồng nhau, lệnh mang dữ liệu cũ ghi xong sau sẽ **đè mất kết quả mới nhất**, kể cả bước Kanban vừa chuyển | **Bản sửa của IT KHÔNG có trong repo này** (chỉ 1 nhánh `main`, không có commit của người khác) → deploy từ repo sẽ làm mất bản sửa đó. Nên làm lại ở đây: `pushCollection` nay xếp **hàng đợi tuần tự theo từng collection**, lệnh sau chờ lệnh trước xong hẳn nên tính phần chênh lệch trên bản sao đã cập nhật; một lệnh lỗi không làm nghẽn hàng đợi | Mô phỏng đúng kịch bản (3 lần bấm cách 20ms, mạng trả về không đều): **bản cũ tái hiện đúng lỗi** (cloud giữ bước 2 thay vì 4), **bản mới giữ đúng bước 4**, chạy lại 5 lần đều đúng |

⚠️ **NHẮC IT**: nhờ IT cho biết bản sửa của họ nằm ở repo/nhánh nào. Nếu họ sửa ngoài repo này thì
hai bên phải hợp nhất, không thì deploy lần sau sẽ đè qua đè lại.

### Mục 79 → 81 (chiều 18/08/2026)

| # | Chị Trâm nêu | Nguyên nhân thật / chỗ sửa | Đo lại trên app |
|---|---|---|---|
| **79** | *"vị trí ảnh báo cáo là của quản lý, thì phải nằm bên cột tiến độ bộ phận em ơi"* | Em đặt ô ảnh dưới cột **Tiến độ Phòng phê duyệt** — cột đó là phần của Trưởng phòng. Đã chuyển sang cột **Tiến độ Bộ phận** và đổi màu cho khớp cột | — |
| **80** | *"việc bấm chọn chữ xong lại nằm ở cuối, làm c bấm ra ngoài thì ko tự phân rã, sau khi bấm tick 2 tên là bên ngoài chủ động luôn e, ko cần bấm xong"* | **Lỗi thật, không chỉ là bất tiện**: hàm bắt sự kiện "bấm ra ngoài" nằm trong `useEffect` chỉ phụ thuộc `chiaViecId`, nên nó **giữ bản nháp của lúc mới mở** (giá trị cũ) → bấm ra ngoài là áp danh sách cũ, không chia gì. Đã **bỏ hẳn bản nháp**: tick tên nào là `datNguoiLam` chạy ngay tên đó, ô vẫn mở để tick tiếp người thứ 3; bấm ra ngoài chỉ để đóng. Nút đóng đổi thành dấu **✕ ở ĐẦU** danh sách | Tick tên là bảng ra thêm dòng cấp 2 ngay, không cần bấm gì thêm |
| **81** | *"e có thể chuyển cái này thành tệp đc ko. sau c cần c tải về, vì khi c báo cáo mục tiêu c cần tải ảnh này về làm bằng chứng á e"* | Mọi ô đính kèm của app **chỉ lưu TÊN tệp** (`utils/attachments.ts`) nên không có gì để tải. File mới `src/utils/anhDinhKem.ts`: **nén ảnh ngay trong trình duyệt** (tối đa 1600px cạnh dài, JPEG ~0,72; quá hạn thì nén mạnh hơn 2 vòng) rồi lưu **nội dung tệp** vào collection riêng **`anhDinhKem`** — mỗi ảnh một document. Hồ sơ vẫn chỉ giữ tên tệp nên **mở danh sách hồ sơ không phải tải ảnh** (giữ đúng mục 38); ảnh chỉ được đọc đúng lúc bấm **⬇ Tải về**. Thêm 3 hàm ghi/đọc/xoá **một document lẻ** vào `src/lib/firebase.ts` (pushCollection gửi cả mảng nên không dùng được cho ảnh). Nút ⬇ Tải về có ở **cả form và khay xem nhanh** | Dán ảnh PNG 900×500 → lưu thành **JPEG 12KB**, `laAnhThat = true`, mã `NHAP-01__anh-da-gui-bao-gia-…`; bấm Tải về → tạo đúng tệp blob tên `anh-da-gui-bao-gia-20260818-150835.png`. Ảnh khai từ trước (chỉ có tên) hiện đúng cảnh báo "không tải về được" |

### Mục 81 — hai giới hạn phải nói trước

1. **Một document Firestore tối đa 1MB.** Ảnh nén xong quá 900KB thì app từ chối kèm câu nhắc chụp
   lại gọn hơn. Ảnh chụp màn hình Zalo thường chỉ 100–300KB nên đủ dùng; **tệp gốc nặng** (PDF hồ sơ,
   ảnh không nén) thì vẫn phải **bật Firebase Storage** — đây chính là mục 69 còn chờ Sếp quyết.
2. **Ảnh đính kèm TỪ TRƯỚC bản này chỉ có tên**, không có nội dung → không tải về được. Muốn có bằng
   chứng thì mở hồ sơ và **dán lại ảnh** một lần.

🔧 **VIỆC CHO IT (thêm vào danh sách)**: mở quyền Firestore cho collection **`anhDinhKem`**, cùng điều
kiện với `notifications`. Chưa mở thì trên bản thật việc thêm / tải ảnh sẽ báo lỗi quyền.

### Mục 82 (chiều 18/08/2026)

| # | Chị Trâm nêu | Đã làm | Đo lại |
|---|---|---|---|
| **82** | Ảnh khoanh đỏ 2 chỗ: *"3. Thiết lập tiến độ gốc"* và *"3. Sơ đồ phân rã công việc"* **cùng mang số 3**, các mục sau lệch theo | Đánh lại liền mạch trong `ProjectForm.tsx`: **1** Nhân sự / Thông tin chung · **2** Bản chất hạng mục · **3** Thiết lập tiến độ gốc · **4** Sơ đồ phân rã công việc · **5** Lịch sử dời tiến độ · **6** Đóng gói thầu & KPI | Đọc lại trên app: đúng 6 mục theo thứ tự 1→6, không còn trùng số |

### Mục 83 → 89 (chiều–tối 18/08/2026)

| # | Chị Trâm nêu | Nguyên nhân thật / chỗ sửa | Đo lại |
|---|---|---|---|
| **83** | *"lỗi phải ko e"* — bảng ghi `23/07 → 22/08` mà lại `= 32 ngày` | Mốc kết thúc trong app là mốc **loại trừ**: tròn ngày thì mốc = 00:00 ngày kế tiếp, **nửa ngày** thì mốc = **12:00 trưa** ngày cuối. Bản cũ lấy "mốc − 1 ngày" cho mọi trường hợp → việc 29,5 ngày từ 25/07 (xong trưa 23/08) bị ghi kết thúc **22/08**. Thêm `ngayCuoiLamViec()` + `demSoNgay()` (đếm cả hai đầu) và `khoangKeHoachViecCon()` — **một nguồn duy nhất** cho tiêu đề bảng và dòng "Kế hoạch con" (trước đây hai chỗ tính bằng hai đoạn code khác nhau; dòng dưới không xét việc cấp 2, không có luật nửa ngày) | Script kiểm: tròn ngày 3d → 18/08→20/08 = 3 ngày (**không đổi số cũ**) · nửa ngày 3,5d → 18/08→21/08 = 4 ngày · ca của chị Trâm → **23/07 → 23/08 = 32 ngày** |
| **84** | Bảng chọn tên **nhảy** không đúng dòng | Bản trước gắn `ref={chiaViecId === task.id ? oNguoiLam : undefined}` — **một biến ref cho mọi dòng**. Đổi dòng đang mở thì React gắn ref dòng mới rồi mới tháo ref dòng cũ, nên lúc đo toạ độ biến ref còn trỏ **dòng cũ**. Nay giữ **đúng phần tử vừa bấm** | Đo trước khi sửa: bảng ở top **583** trong khi nút vừa bấm ở top **669** |
| **85** | *"cứ bấm vô biểu tượng thì trường dữ liệu xổ ra kế bên tay phải luôn cho nó gọn, trường hợp biểu tượng nằm ở góc cùng bên phải thì xổ qua bên trái, nhưng tuyệt nhiên e đừng đè lên biểu tượng"* | File mới `src/utils/viTriBangNoi.ts` — **một nguồn duy nhất**, áp cho lịch chọn ngày (neo vào **nút lịch** thay vì cả ô nhập) và danh sách chọn người. ⚠ **Nguyên nhân thật khiến bảng vẫn đè**: app phóng chữ bằng `zoom` trên `<body>`; bảng nổi nằm ở `<body>` nên `getBoundingClientRect()` trả px **thật** (đã nhân mức phóng) còn `style.left` mình đặt **bị nhân thêm lần nữa** — ở 95%, tính 671px thì màn hình vẽ ở **637px**, lùi 34px và đè lên biểu tượng. Nay tính theo px thật rồi **chia lại cho mức phóng** | Đo đúng con số: 671 × 0,95 = **637** |
| **86** | *"nếu đã tới bước lũy kế vòng 2 thì chỉ hiện tiến độ gant chỗ vòng 2 thôi cho nó gọn"* | Bảng chỉ dựng dòng cho **vòng đang chạy**; việc vòng trước **không mất** — có nút **"Xem vòng trước (n)"**. Tỉ trọng lũy kế và tiến độ không đổi (chỉ là hiển thị) | Tiêu đề bảng thêm nhãn `· Vòng 2/2` |
| **87** | *"khi quản lý nhận đc thông báo đc chọn làm quản lý dự án A, lúc click vô e thẳng tới trường công việc mới + chọn đúng tên dự án đó sẵn cho họ tạo luôn, còn thao tác thủ công bấm nút tạo công việc sau đó chọn dự án vẫn giữ nguyên"* | `onOpen` của chuông nhận ra tin "được chọn làm Quản lý" gắn với bản ghi **DỰ ÁN** → mở form `ADD_WORK` + prop mới `duAnChonSan`. Tin gắn với **công việc** vẫn mở hồ sơ như cũ; bấm nút "CÔNG VIỆC MỚI" bằng tay thì xoá cờ nên form để trống | Bấm tin → mở đúng form "Tạo Công Việc Con", ô **"Chọn dự án cha"** đã điền sẵn `2026.81 [NHÁP] Nhà máy dệt Bình Dương` |
| **88** | *"banh bự ra luôn đi em cho đẹp"* | Form bỏ `max-w-4xl` (896px) + căn giữa → dùng **hết bề rộng** vùng làm việc; các khối 2–4 cột bên trong tự giãn theo | — |
| **89** | *"sao quản lý nắm từ b2 qua b3 còn bị kẹt thông báo mà ko tự chuyển đi qua trường cập nhật kqua và hình ảnh e"* (lúc đó chị đang đăng nhập **Level 1**) | Mục 75 em chỉ nới cho `MANAGER` nên **L1 vẫn gặp chặn cứng** — vô lý vì L1 quyền cao hơn. Nay điều kiện là `MANAGER hoặc BOOD` | Cần chị kiểm lại trên app: L1 kéo B2 → B3 phải mở form kèm câu "Còn thiếu: …" |

### Mục 90 → 104 (chiều–tối 18/08/2026)

| # | Chị Trâm nêu | Nguyên nhân thật / chỗ sửa |
|---|---|---|
| **90** | *"click vô đây ko thả ảnh vô đc"* — kèm ảnh câu lỗi gốc `Missing or insufficient permissions.` | Ô thả ảnh KHÔNG hỏng. Collection `anhDinhKem` là collection mới, Firestore chưa mở quyền → `luuAnh()` ném lỗi TRƯỚC khi tên ảnh vào danh sách. Nay ghi tạm trên máy + câu nhắc tiếng Việt; `docAnh` ưu tiên bản trên máy |
| **91** | *"đừng gán cứng, cũng cực cho anh em quản lý"* · *"sợ IT ko mở"* | Thêm công tắc `ANH_BAO_CAO_BAT_BUOC = false` ở đầu `App.tsx`: thiếu ảnh vẫn cho sang Bước 3, chỉ hiện câu nhắc. Đổi 1 dòng thành `true` là siết lại. Cửa tiến độ Bộ phận 100% GIỮ NGUYÊN |
| **92** | *"nút chọn lịch đang đè lên ngày"* · *"mở rộng cột bắt đầu ra em"* | `DateInput` là inline-flex gồm ô nhập + nút lịch; chỗ truyền `w-full` thì ô nhập chiếm 100% span, nút tràn ra đè lên chữ. Nay ô nhập `flex-1 min-w-0`, cột Bắt đầu `w-24 → w-36`. Đo: cột 151px, ô hiện đủ `18-08-2026`, nút không đè |
| **93** | *"bộ phận đc 100% rồi mà cái này còn đen thui chưa kẻ 70%"* | Bản cũ tô theo `tienDoBoPhan` chiếm HẾT bề rộng + màu chỉ `/20` (gần như không thấy trên nền tối). Nay dải 1 = Bộ phận tối đa 70%, dải 2 = Phòng từ mốc 70% tối đa 30%, vạch mốc 70%, dải đáy = tổng |
| **94** | *"từ bước 4 qua 5 là chuyện của BGĐ… tô biểu đồ gant tính đến tiến độ TP ktra thôi"* | Gantt tô xanh khi Bộ phận + Phòng đều 100%. **Cố ý KHÔNG đổi `trangThai`** vì KPI / thống kê "đã xong" / cột "gói thầu đã có kết quả" của bảng ISO đọc theo đó |
| **95** | *"Level4 cho xem danh sách nhân sự, cho xóa và thêm nhân sự như level 1"* · *"ghi vậy level1 bị chửi chết"* | `kpiStaff` lọc "chỉ thấy mình" cho L4 mà tài khoản L4 lại bị loại khỏi danh sách → ra **0 nhân sự**. Thêm `quanLyDuocNhanSu(role)` = BOOD hoặc VIEWER, mở 6 chỗ gác quyền trong thẻ nhân sự. Đo: L4 thấy 9 nhân sự, có nút thêm + 9 nút xoá |
| **96** | *"thêm nút sort năm và nút sort dự án đã xong / đang làm / tất cả"* | Gantt trước đây cứng: không đặt khoảng ngày thì chỉ hiện đang chạy & trễ. Nay có ô chọn Năm + 3 nút trạng thái có số đếm. "Đã xong" tính theo đúng cách Gantt tô màu (mục 94) nên khớp mắt nhìn — đã ghi rõ ở chú giải |
| **97** | *"sao nút mũi tên lên xuống số ngày mất tiêu òi e"* | Mục 70 đổi ô sang `type=text` để gõ được `3,5` → mất cặp mũi tên của trình duyệt. Nay tự vẽ ▲▼ nhảy 0,5; cột Ngày `w-16 → w-20` |
| **98** | *"hạn thông báo của nhân sự khi họ nhận đc tiến độ có lẻ 0.5 ngày em tính như thế nào"* | Cách tính: ngày hạn = ngày bắt đầu + **làm tròn LÊN** số ngày − 1; giờ hạn = **12:00** nếu lẻ nửa ngày, **23:59** nếu tròn ngày. **LỆCH THẬT**: ô `gioHan` đã bỏ ở mục 24 nên chỗ nhắc hạn rơi về 23:59 cho mọi việc, trong khi màn tác vụ hiện 12:00. Nay xuất `laNuaNgayViec` dùng chung |
| **99** | *"khi thêm template mới thì báo cho những người đc chọn"* | `pushNotify` tới nhân sự thuộc cấp đã tick; không tick = cả phòng. Toast và Nhật ký ghi rõ đã báo bao nhiêu người |
| **100** | *"sao nhân viên lại đc nhận thông báo này"* — 2 tin trùng cùng lúc 16:33 | Tin *"sửa tiến độ"* là luật chị Trâm chốt 27/07 (báo người bị sửa). Nhưng việc cấp 1 đã chia vẫn giữ đủ `assignedStaffIds` nên vòng quét báo CẢ HAI cấp cho cùng một người. Nay chỉ báo **việc lá** |
| **101** | *"thêm cơ chế thông báo cho nhân sự mới tiếp nhận công việc… trên tag cv có hiện nhưng thiếu chuông"* | So người được giao TỪNG VIỆC LÁ trước/sau khi lưu: đổi người → *"🔄 … chuyển việc … sang cho bạn"*, việc mới → *"📌 … giao bạn việc mới"*. ⚠ Bản đầu em đặt trong nhánh `else if (old)` mà TP lưu hồ sơ lại đi nhánh `approvedNow` → tin không bao giờ bắn; đã đưa ra ngoài |
| **102** | *"thông báo này của e ngộ quá, hiện thông báo dạng ô vuông giữa màn hình, định dạng mẫu như cái thông báo kéo về"* | Bỏ `window.confirm` (hộp trình duyệt, hiện cả tên miền `…vercel.app cho biết`). Nay hộp của app giữa màn hình; hồ sơ **đã lưu trước** khi hộp mở nên bấm "Để sau" không mất công nhập |
| **103** | *"c ko thấy e cảnh báo là chưa có ảnh báo cáo"* | Từ mục 91 ảnh chỉ còn nhắc, mà luồng lưu → qua Bước 3 không nói gì về ảnh. Nay hộp xác nhận hiện bảng: Tiến độ Bộ phận …% · Ảnh "Đã có/Chưa có", thiếu thì có khối cảnh báo cam |
| **104** | *"kiểm tra xem thông báo đã được liên kết web mở dạng popup ở ngoài màn hình chưa"* | **CÓ** — mọi tin mới đều bật popup (gộp khi nhiều tin), cần bấm "Bật thông báo trình duyệt" một lần. **GIỚI HẠN**: chỉ chạy khi tab app còn mở; đóng hẳn trình duyệt thì phải làm **Web Push + Service Worker** (app chưa có) → xem mục 8.2 của `BANGIAO.md` |

### Kiểm tra thêm (không phải sửa)

- *"Quản lý được xuất báo cáo chiến lược nhưng chỉ các dự án em ấy tham gia"* — **ĐÃ ĐÚNG SẴN**: bảng
  thống kê dùng `workItems` lọc từ `rbacProjects`, mà Quản lý chỉ thấy hồ sơ mình quản lý hoặc tham gia.
  Đo trên dữ liệu thử: S004 chỉ thấy **2** công việc. Riêng S003 thấy 10/10 vì trong bộ nháp chính anh
  ấy là quản lý của cả 10 hồ sơ — không phải lỗ hổng phạm vi.
