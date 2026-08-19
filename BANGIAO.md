# BÀN GIAO GIỮA CÁC PHIÊN CLAUDE — đọc file này TRƯỚC KHI LÀM

> Chị Trâm dùng **2 account Claude**. File này là điểm nối duy nhất giữa các phiên.
> **Quy ước: phiên nào làm gì cũng phải cập nhật lại file này trước khi kết thúc.**
> File bàn giao cũ (một lần, không cập nhật nữa): `BAN-GIAO-2026-07-27.md`.

**Cập nhật lần cuối:** 18/08/2026 (tối — chốt hồ sơ gửi IT) · Nhánh: `main` · Cây làm việc: **ĐÃ COMMIT + PUSH**

> 🔄 **ĐỔI ACCOUNT — ĐỌC 5 DÒNG NÀY TRƯỚC (18/08/2026 chiều)**
> 1. **102/104 mục góp ý đã xong trong mã nguồn** (còn mục 69 và 104 chờ Sếp/IT quyết — xem mục 8),
>    `npx tsc --noEmit` exit 0,
>    `npm run build` exit 0, đã đồng bộ G: ↔ C:. **ĐÃ COMMIT + PUSH lên `main` của repo ver2** —
>    **13 commit trong ngày 18/08**, mới nhất là `2cf7d04`. Xem `git log --oneline -13`.
>    Chi tiết từng mục: bảng số ở ngay dưới + NHÓM D/E/F/**G** trong `docs/KE-HOACH-SUA-2026-08-17.md`.
> 2. **Việc lớn nhất còn lại KHÔNG phải code mà là DEPLOY** (mục 2e). Chị Trâm đang kiểm trên
>    `dauthau.hpcore.vn` = bản cũ, nên nhiều thứ chị "không thấy" là do chưa deploy.
>    Code đã lên GitHub rồi nên deploy chỉ còn là bước của Vercel/IT.
> 3. Chạy thử ở bản C: port 3002 (`hp-cons-erp-local-c` trong `.claude/launch.json`), sửa xong
>    **copy về G: ngay** — xem mục 2c.
> 4. Trong Bản thử của chị Trâm hiện có 6 hồ sơ **"[THỬ KỲ 3]"** do Claude bịa để xuất thử bảng ISO
>    Kỳ 3. Chúng chỉ nằm trong localStorage, KHÔNG có trong mã nguồn — "Xoá sạch dữ liệu bản thử"
>    rồi "Nạp 9 hồ sơ NHÁP" là sạch.
> 5. Còn 4 điểm **chờ chị Trâm / Sếp quyết**, đừng tự làm: (a) bảng ISO có lọc bỏ hồ sơ không phát
>    sinh trong kỳ không · (b) KPI bật điểm theo trọng số nào · (c) có bật Firebase Storage để tải
>    tệp biểu mẫu thật lên app không · (d) **mục 69** — có cho XEM ĐƯỢC ảnh "đã gửi báo giá" trong
>    app không (nay chỉ lưu TÊN tệp; muốn xem ảnh thật phải bật Storage — 2 đường đi ghi ở cuối
>    `docs/KE-HOACH-SUA-2026-08-17.md`).

---

## 🔧 VIỆC NHỜ IT LÀM — MỞ QUYỀN FIRESTORE CHO 3 COLLECTION MỚI

> **Chị Trâm chốt 18/08/2026**: giữ cách lưu ảnh/biểu mẫu/thông báo trong Firestore và **nhờ IT mở
> quyền một lần cho xong**. Phần này viết sẵn để gửi thẳng cho IT, chị Trâm không phải giải thích lại.

**Việc cần làm: KHÔNG sửa code, chỉ thêm 3 collection vào Firestore Rules** của project
`hpcons-dauthau` (Firebase Console → Firestore Database → tab **Rules** → Publish).

| Collection | App dùng để làm gì | Không mở quyền thì bị gì |
|---|---|---|
| `templates` | Danh mục **Template mẫu đấu thầu** (mục "Thông báo - Template") | Thêm/xoá biểu mẫu báo lỗi quyền |
| `announcements` | **Thông báo nội bộ được lưu lại** để tra cứu (chuông chỉ giữ 30 tin/người nên tin cũ trôi mất) | Gửi được nhưng không lưu lại được |
| `anhDinhKem` | **Nội dung ảnh** "đã gửi báo giá" để tải về làm bằng chứng báo cáo mục tiêu | Dán ảnh chỉ lưu tạm trên máy người dán, **máy khác không xem được** |

### Cách thêm

Điều kiện quyền của 3 collection này **để y hệt collection `notifications` đang dùng** (cùng nhóm
người dùng, cùng cách xác thực). Nếu `notifications` đang là `allow read, write: if request.auth != null;`
thì thêm đúng 3 khối sau vào trong `match /databases/{database}/documents { ... }`:

```
    // Danh mục biểu mẫu dùng chung của Phòng Đấu Thầu
    match /templates/{id} {
      allow read, write: if request.auth != null;
    }

    // Thông báo nội bộ được lưu lại để tra cứu
    match /announcements/{id} {
      allow read, write: if request.auth != null;
    }

    // Nội dung ảnh đính kèm (ảnh đã gửi báo giá) — mỗi ảnh một document, chỉ đọc khi bấm Tải về
    match /anhDinhKem/{id} {
      allow read, write: if request.auth != null;
    }
```

⚠ **Đừng chép nguyên câu điều kiện ở trên nếu `notifications` của mình đang dùng điều kiện khác** —
lấy đúng điều kiện đang có của `notifications` để 3 mục này cùng mức bảo mật, không nới rộng hơn.

### Ba điều nói trước cho IT khỏi thắc mắc

1. **Không cần bật Firebase Storage.** Ảnh được **nén ngay trong trình duyệt** (tối đa 1600px cạnh
   dài, JPEG ~0,72) nên ảnh chụp màn hình Zalo còn khoảng 100–300KB, nằm dưới hạn 1MB/document.
2. **Không làm nặng phần đồng bộ.** Ảnh KHÔNG nằm trong hồ sơ mà ở collection riêng `anhDinhKem`,
   mỗi ảnh một document, và **chỉ được đọc đúng lúc người dùng bấm "Tải về"** — mở danh sách hồ sơ
   không tải ảnh. Đây là chủ ý để giữ đúng việc giảm chi phí đọc/ghi Firestore (mục 38).
3. **Chưa mở quyền thì app vẫn dùng được**, không đứng: ảnh được ghi tạm trên máy đang dùng và tải
   về được ngay, kèm câu nhắc trên giao diện là máy khác chưa xem được. Mở quyền xong là ảnh mới
   đồng bộ cho cả phòng (ảnh đã dán trước đó vẫn nằm ở máy cũ, cần dán lại nếu muốn chia sẻ).

> ⚠️ **HAI LUẬT LÀM VIỆC — LÀM SAI LÀ MẤT CÔNG.**
> 1. **Sửa ở bản C: thì copy về G: NGAY trong đợt đó** (cách copy ở mục 2c "Cách đồng bộ").
>    Phiên sáng 17/08 để dồn 4 mục ở C: rồi hết phiên → phiên sau phải đi so từng file mới tìm ra.
> 2. **Xong mục nào ghi ngay vào 2 file**: `docs/KE-HOACH-SUA-2026-08-17.md` (đặc tả + nguyên nhân +
>    chỗ sửa) và file này (tóm tắt + bằng chứng đo). Chị Trâm dựa vào đây để vào kiểm tra lại.
>
> 📒 **BẢNG SỐ GÓP Ý — DÙNG CHUNG CHO CẢ 2 ACCOUNT.** Chị Trâm xác nhận 17/08: **không có bản Excel
> mới**; mục 14 → 19 là các lỗi chị báo trực tiếp (kèm ảnh) và đã được ghi trong mục 2b/2c của
> chính file này. Từ mục 20 trở đi là góp ý chị báo chiều 17/08 (chị chốt: *"cv này là cv thứ 20"*).
> **Phiên sau đánh số tiếp từ 105; đừng đánh trùng, đừng đi tìm file Excel mới.**
>
> | # | Nội dung | Ghi ở | Trạng thái |
> |---|---|---|---|
> | 1–13 | 13 góp ý trong `GopY_HPC_u_Th_u_2026-08-17.xlsx` (lưu 13:51 ngày 17/08) | `docs/KE-HOACH-SUA-2026-08-17.md` nhóm A/B/C | 8 xong · 5 còn (#7, #8, #11, #12, #13) |
> | 14 | Bộ lọc năm Kanban sinh "Năm 2600 / 2610" + mặc định phải là năm hiện tại | mục 2b | ✅ |
> | 15 | Thêm nhân sự: mọi người được App Tổng cấp L1 đều bị ghi chức vụ "Ban giám đốc" | mục 2b | ✅ |
> | 16 | Đăng nhập lại là quyền bị App Tổng ghi đè, sửa tay trong app bị mất | mục 2b | ✅ |
> | 17 | Zoom vào là mất cột "Tình hình dự án" + "Thao tác" → ghim 2 cột vào mép phải | mục 2b | ✅ |
> | 18 | Ban giám đốc (L4) bấm thông báo trên chuông không mở được hồ sơ | mục 2c | ✅ |
> | 19 | Dòng lọc ngày có **3 cuốn lịch** (biểu tượng trang trí + 2 nút lịch mới) | mục 2c | ✅ |
> | 20–23 | Giờ cho việc con · chuông nhắc hạn mang tên người lạ · lịch bị khung cắt · TP nhận thông báo duyệt khi hồ sơ còn ở Bước 2 | mục 2c-bis + **NHÓM D** của `docs/KE-HOACH-SUA-2026-08-17.md` | ✅ |
> | 24–34 | Bỏ ô giờ → bước nửa ngày · ô Người giao bấm chọn nhiều người · form kẹt hồ sơ cũ · popup trình duyệt cho L1 · Gantt đưa hạn ra ngoài · gọn hộp thêm nhân sự · đồng hồ đăng nhập (chờ deploy) · 2 khung nhân sự xổ hết + bỏ L4 · Ctrl+V dán ảnh · Quản lý xuất được báo cáo · mục 8 (chờ deploy) | **NHÓM E** của `docs/KE-HOACH-SUA-2026-08-17.md` | ✅ |
> | 35 | Dựng lại bộ dữ liệu Bản thử: **9 hồ sơ nháp đi hết 7 bước** (thay 3 hồ sơ cũ đều nằm đầu quy trình) | `src/data/sandboxData.ts` · **NHÓM E** | ✅ |
> | 36–38 | Chữ trong ô chọn Kỳ (trắng trên trắng) · ô **Năm** thành xổ xuống tự có 2027 · **giảm ~100 lần lượt ghi Firestore** (chỉ ghi bản thực sự đổi, bỏ đọc toàn bộ khi lưu) | **NHÓM F** của `docs/KE-HOACH-SUA-2026-08-17.md` | ✅ |
> | 39–41 | Năm 2027 hiện sớm (đã bỏ) · khung Chuyên viên thực hiện vẫn lọt Ban giám đốc (lọc theo chức danh, không chỉ theo Level) · 2 khung nhân sự render lại cho mỗi người gọn 1 dòng | **NHÓM F** của `docs/KE-HOACH-SUA-2026-08-17.md` | ✅ |
> | 42–44 | Ô **"Lấy thông tin từ dự án cũ"** khi đăng ký dự án · khung Chuyên viên thực hiện chuyển thành chỉ-xem (lấy từ phân rã việc con) · khung Quản lý phụ/kế thừa chỉ-xem ở hồ sơ gói thầu | **NHÓM F** của `docs/KE-HOACH-SUA-2026-08-17.md` | ✅ |
> | 45–47 | Dự án mẫu lấy được cả quốc tịch/diện tích/hình thức… (gộp dữ liệu dự án cha + gói thầu con) · ô **gõ tìm** dự án mẫu + rút gọn ghi chú · sửa cột NGÀY đè cột BP 70% | **NHÓM F** của `docs/KE-HOACH-SUA-2026-08-17.md` | ✅ |
> | 48–51 | Bảng phân rã việc con: mốc ngày đậm dễ đọc · tên việc dài tự xuống dòng · cột "Người giao" → **"Người thực hiện"** + tên rút gọn Họ + Tên · dồn khối giữa sang trái để Gantt rộng hơn | **NHÓM F** của `docs/KE-HOACH-SUA-2026-08-17.md` | ✅ |
> | 52–57 | Dự án mẫu: nút xổ xuống + ô gõ tìm · Gantt chữ đậm & chỉ tô Chủ nhật · xem theo tuần có ô ngày + số tuần theo năm · **Template mẫu ra mục riêng** + phân quyền cấp được thấy + mục Biểu mẫu đã hủy · bảng ISO đổi số 1 thành dấu ✔ | **NHÓM F** của `docs/KE-HOACH-SUA-2026-08-17.md` | ✅ |
> | 58 | **Bảng ISO cộng được**: ô tick giữ giá trị số 1/0 (Excel hiển thị ✔/✘ bằng định dạng số), dòng TỔNG HỢP dùng `=SUM(...)`, thêm dòng **TỶ LỆ GỬI ĐÚNG HẠN** `=IF(SKH=0,"",Nhận xét/SKH)`, tăng chiều cao dòng tổng 1,5 lần | **NHÓM F** của `docs/KE-HOACH-SUA-2026-08-17.md` | ✅ |
> | 59 | Bỏ dòng "TỶ LỆ GỬI ĐÚNG HẠN" khỏi bảng ISO · sửa lỗi escape làm định dạng ✔/✘ không chạy (Excel hiện ra số 1/0) | **NHÓM F** của `docs/KE-HOACH-SUA-2026-08-17.md` | ✅ |
> | 60 | Dấu tick trong bảng ISO đổi từ xanh lá sang **xanh dương** (✘ giữ màu đỏ) | **NHÓM F** của `docs/KE-HOACH-SUA-2026-08-17.md` | ✅ |
> | 61 | Phóng to là **thông tin lọt ra ngoài khung** — khay xem nhanh hồ sơ giãn theo bề rộng cả bảng | **NHÓM G** của `docs/KE-HOACH-SUA-2026-08-17.md` | ✅ |
> | 62 | **Thư viện tên việc con**: xổ danh sách tên thường gặp khi thêm việc, 2 tên hay dùng nhất thành nút nhanh, chọn xong sửa trực tiếp rồi mới bấm Thêm | **NHÓM G** · file mới `src/utils/thuVienViecCon.ts` | ✅ |
> | 63 | Mục Template mẫu phải nằm **trước** Lịch cá nhân | **NHÓM G** | ✅ |
> | 64 | **Nút phục hồi biểu mẫu lỡ xoá** (thùng rác biểu mẫu) | **NHÓM G** | ✅ · 2 mẫu xoá trước đó không lấy lại được |
> | 65 | Đổi mục thành **"Thông báo - Template"**, gộp khung thông báo nội bộ vào, **báo theo cấp (level)** | **NHÓM G** | ✅ |
> | 66 | **Thông báo nội bộ phải được lưu lại**, không trôi mất theo chuông | **NHÓM G** · collection Firestore mới `announcements` | ✅ |
> | 67 | 2 nút (mẫu cũ / xoá) ở dòng biểu mẫu nhìn giống nhau → **gộp còn 1 nút** | **NHÓM G** | ✅ |
> | 68 | Bấm **tên biểu mẫu** nhảy sang trang 404 (link khai chưa đúng) | **NHÓM G** | ✅ |
> | 69 | *"Chỗ hình ảnh của quản lý drop zalo đã gửi file, c nhìn cái đó ở đâu ta?"* | **NHÓM G** | ⏳ **CHỜ QUYẾT** — app chỉ lưu TÊN tệp |
> | 70 | *"c thêm 0.5 ngày app đọc ko hiểu"* — ô NGÀY làm tròn theo từng ký tự nên gõ 3.5 ra 35; dấu phẩy bị ô số bỏ | **NHÓM G** · `ONhapSoNgay` trong `SubtaskGantt.tsx` | ✅ dấu chấm = dấu phẩy |
> | 71 | *"tên công việc con dài chưa tự động xuống dòng nè e"* — mục #49 chỉ sửa cho chế độ XEM, lúc sửa vẫn là ô 1 dòng | **NHÓM G** | ✅ |
> | 72 | Danh sách chọn Người thực hiện **bị khung bảng cắt**, đè lên dòng tiêu đề | **NHÓM G** · portal + fixed, giống mục #22 | ✅ |
> | 73 | **Logic chia việc cấp 1 → cấp 2**: tỉ trọng chia từ việc cấp 1 (60% → 30/30, số cũ 50/50 tự chuẩn hoá) · sinh khi tắt ô chọn tên · ngày của cấp 1 **suy một chiều** từ cấp 2 · màn tác vụ chỉ hiện 1 dòng cấp 2 | **NHÓM G** cuối `docs/KE-HOACH-SUA-2026-08-17.md` | ✅ (chị Trâm chốt lại sau khi tạm dừng) |
> | 74 | Kéo thẻ Bước 1 → 2 là **tự mở hồ sơ** cho TP soát, lưu là qua — đừng khoá cứng | **NHÓM G** | ✅ |
> | 75 | **Nới cửa Bước 2 → 3 cho Quản lý**: thiếu thì mở form + nói rõ thiếu gì, cập nhật đủ rồi lưu là tự qua, **xác nhận 2 lần**; thêm ô ảnh báo cáo vào form | **NHÓM G** | ✅ |
> | 76 | Xoá **vĩnh viễn** biểu mẫu chỉ Level 1 | **NHÓM G** | ✅ |
> | 77 | Bảng chọn tên nằm **bên cạnh** ô Người thực hiện | **NHÓM G** | ✅ |
> | 78 | (IT báo) Bấm Lưu liên tục 2–3 lần thì lệnh ghi chồng nhau, đè mất kết quả mới nhất → **hàng đợi ghi tuần tự**. ⚠ Bản sửa của IT KHÔNG có trong repo này | **NHÓM G** | ✅ ở repo · **cần hỏi IT họ sửa ở đâu** |
> | 79 | Ô **ảnh báo cáo** phải nằm ở **cột Tiến độ Bộ phận** (việc của Quản lý), không để bên cột Trưởng phòng | **NHÓM G** | ✅ |
> | 80 | Ô chọn người: nút "Xong" nằm cuối phải cuộn mới thấy · **bấm ra ngoài không tự phân rã** → bỏ nút Xong, **tick tên là chia ngay** | **NHÓM G** | ✅ |
> | 81 | *"e có thể chuyển cái này thành tệp đc ko… c cần tải ảnh này về làm bằng chứng"* → ảnh lưu **nội dung tệp thật** (nén trong trình duyệt), có nút **⬇ Tải về** | **NHÓM G** · file mới `src/utils/anhDinhKem.ts` · collection `anhDinhKem` | ✅ |
> | 82 | Form hồ sơ có **hai mục cùng đánh số 3** → đánh lại liền mạch 1…6 | **NHÓM G** | ✅ |
> | 83 | **Ngày cuối làm việc sai khi có nửa ngày**: việc 29,5 ngày từ 25/07 (xong trưa 23/08) bị ghi kết thúc 22/08, lại in "= 32 ngày" trong khi 23/07→22/08 chỉ 31 ngày. Gom tiêu đề bảng + dòng "Kế hoạch con" về **một cách tính** | **NHÓM G** · `ngayCuoiLamViec` / `demSoNgay` / `khoangKeHoachViecCon` | ✅ |
> | 84 | Bảng chọn tên **neo sai dòng** (lệch lên 1 dòng) — dùng một biến ref chung cho mọi dòng | **NHÓM G** | ✅ |
> | 85 | **Luật chung cho mọi bảng xổ ra**: bên phải biểu tượng · hết chỗ lật sang trái · tuyệt đối không đè lên biểu tượng. ⚠ Nguyên nhân thật: app phóng chữ bằng `zoom` trên `body` nên toạ độ bị nhân 2 lần | **NHÓM G** · file mới `src/utils/viTriBangNoi.ts` | ✅ |
> | 86 | Hồ sơ sang **vòng 2** thì bảng chỉ hiện vòng đang chạy cho gọn (có nút xem lại vòng trước) | **NHÓM G** | ✅ |
> | 87 | Bấm thông báo *"được chọn làm Quản lý cho dự án A"* → vào **thẳng form Công việc mới, chọn sẵn dự án A**; bấm nút tạo bằng tay vẫn như cũ | **NHÓM G** | ✅ |
> | 88 | *"banh bự ra luôn đi em cho đẹp"* — form hồ sơ bỏ chặn bề rộng, dùng hết vùng làm việc | **NHÓM G** | ✅ |
> | 89 | Trưởng phòng (L1) kéo B2 → B3 **vẫn bị chặn cứng** (mục 75 chỉ nới cho L2) → nay cả L1 và L2 đều được mở form để cập nhật rồi tự qua bước | **NHÓM G** | ✅ |
> | 90 | Dán ảnh báo cáo báo lỗi tiếng Anh *"Missing or insufficient permissions"* → Firestore chưa mở quyền thì **ghi tạm trên máy**, không chặn người dùng, và báo bằng câu tiếng Việt | **NHÓM G** | ✅ · vẫn cần IT mở quyền |
> | 91 | Ảnh báo cáo từ **bắt buộc** → **chỉ nhắc** (chị Trâm: *"đừng gán cứng, cũng cực cho anh em quản lý"*). Công tắc `ANH_BAO_CAO_BAT_BUOC` — đổi 1 dòng là siết lại | **NHÓM G** | ✅ |
> | 92 | **Nút lịch đè lên ngày** (`18-08-2026` bị cắt còn `18-08-2`) + nới cột **Bắt đầu** | **NHÓM G** | ✅ |
> | 93 | Thanh Gantt **tô sai tỉ lệ**: Bộ phận chiếm hết bề rộng, màu quá mờ (*"đen thui"*) → chia đúng **70% Bộ phận + 30% Phòng**, có vạch mốc 70% | **NHÓM G** | ✅ |
> | 94 | Gantt **chỉ tính tới tiến độ TP kiểm tra** (Bước 4→5 là việc của BGĐ) → Bộ phận + Phòng đều 100% là tô xanh lá, không chờ gửi CĐT | **NHÓM G** | ✅ |
> | 95 | **Level 4 (Ban giám đốc) quản lý nhân sự như Level 1**: xem danh sách (trước ra 0 nhân sự), thêm & xoá tài khoản; bỏ câu *"chỉ Trưởng phòng mới có quyền…"*; nhãn đổi thành "Level 4 (Ban giám đốc)" | **NHÓM G** | ✅ |
> | 96 | Gantt thêm **nút lọc Năm** + **Đang làm / Đã xong / Tất cả** như tab Báo cáo tiến độ | **NHÓM G** | ✅ |
> | 97 | **Trả lại nút mũi tên ▲▼** cho ô Số ngày (mất do mục 70 đổi sang ô chữ để gõ được `3,5`) | **NHÓM G** | ✅ |
> | 98 | **LỆCH THẬT**: màn tác vụ hiện hạn `12:00` cho việc nửa ngày, nhưng chuông nhắc theo `23:59` → nay hai chỗ dùng chung một hàm | **NHÓM G** | ✅ |
> | 99 | Thêm biểu mẫu thì **báo cho đúng cấp được chọn** (không tick cấp nào = báo cả phòng) | **NHÓM G** | ✅ |
> | 100 | Tin *"sửa tiến độ"* **bắn trùng 2 lần** cho nhân viên (một cho việc cấp 1 đã chia, một cho phần cấp 2) → chỉ báo việc lá | **NHÓM G** | ✅ |
> | 101 | **Chuyển việc sang người khác thiếu chuông** → nay báo *"🔄 … vừa chuyển việc … sang cho bạn — hạn …"*; việc mới tạo thì *"📌 … vừa giao bạn việc mới …"* | **NHÓM G** | ✅ |
> | 102 | Hộp xác nhận trình Bước 3 dùng **hộp của app** (vuông giữa màn hình) thay cho `window.confirm` của trình duyệt (*"thông báo này của e ngộ quá"*) | **NHÓM G** | ✅ |
> | 103 | **Cảnh báo thiếu ảnh báo cáo** ngay trong hộp xác nhận (Tiến độ Bộ phận …% · Ảnh: Đã có/Chưa có) | **NHÓM G** | ✅ |
> | 104 | *"kiểm tra xem thông báo đã được liên kết web mở dạng popup ở ngoài màn hình chưa"* — **CÓ**, mọi tin mới đều bật popup, nhưng **chỉ khi tab app còn mở** | **NHÓM G** · mục 8 | ⏳ **CHỜ QUYẾT** — muốn đóng trình duyệt vẫn nhận thì phải làm Web Push |

---

## 1. ĐANG LÀM GÌ

Sửa app theo góp ý của chị Trâm — hiện đã tới **mục 104**: 13 mục đầu từ
`GopY_HPC_u_Th_u_2026-08-17.xlsx` (mốc 31/07 → 17/08/2026), mục 14–104 chị báo trực tiếp trong
ngày 17–18/08 (xem BẢNG SỐ GÓP Ý ở đầu file).

**✅ ĐÃ XONG 102/104 MỤC trong mã nguồn.** Hai mục còn lại KHÔNG phải lỗi mà là **quyết định có phát sinh
chi phí / cần IT**: mục **69** (xem & tải tệp gốc dung lượng lớn → cần Firebase Storage) và mục **104**
(popup khi ĐÃ ĐÓNG trình duyệt → cần Web Push + Service Worker). Chi tiết ở mục 8 cuối file.
Việc còn lại KHÔNG phải viết code mà là **DEPLOY** — xem mục 2e. Chị Trâm chốt cách làm: không xếp
ưu tiên, làm lần lượt hết; vướng đâu hỏi ngay đó.

📄 **FILE EXCEL GÓP Ý ĐÃ ĐƯỢC BỔ SUNG (18/08 chiều)**: `GopY_HPC_u_Th_u_2026-08-17.xlsx` nay có
**69 dòng góp ý** (giữ nguyên 13 dòng chị Trâm tự ghi, thêm mục 14 → 69 lấy từ file này + kế hoạch)
và **thêm cột D "Trạng thái"** có ô xổ xuống để chị Trâm dò và ghi chú xong/chưa xong.
⚠ Cột "Thời gian" của mục 14 trở đi chỉ ghi **NGÀY + buổi** — file bàn giao không lưu mốc giờ chính
xác, nên KHÔNG bịa giờ. File nằm trong thư mục repo nhưng **bị `.gitignore` chặn** (dữ liệu thật của
Phòng); bản gốc trước khi sửa lưu ở scratchpad của phiên 18/08.

**Kế hoạch chi tiết đã viết xong:** `docs/KE-HOACH-SUA-2026-08-17.md` — phiên sau đọc file đó là nắm đủ đầu việc, không phải đọc lại Excel.

Mục đích chị Trâm chốt: **chỉ sửa các nội dung bị LỖI**, không tự ý làm thêm.

## 2. TIẾN ĐỘ TỚI GIỜ

| Việc | Trạng thái |
|---|---|
| Đọc & hiểu repo | ✅ Xong |
| Đọc 13 góp ý từ file Excel | ✅ Xong |
| Đối chiếu git: commit code cuối là **30/07/2026** → cả 13 góp ý CHƯA sửa mục nào | ✅ Xong |
| Định vị code cho từng góp ý | ✅ Xong (ghi trong `docs/KE-HOACH-SUA-2026-08-17.md`) |
| Tạo `.env.local` bật Bản thử (`NEXT_PUBLIC_DEV_SANDBOX=1`) | ✅ Xong |
| Chạy app lên để xem/tái hiện lỗi | ✅ **XONG** — chạy ở bản C:, port 3002. Cách chạy ở mục 3 |
| Xác nhận góp ý #4 trực tiếp trên app | ✅ Xong (nhãn Level sai đúng như chị Trâm báo) |
| Chốt toàn bộ quyết định nghiệp vụ | ✅ Xong (mục 5) |
| Sửa code | ✅ **XONG 60/60 mục tính tới 18/08 tối** — 13 góp ý gốc + #14–19 (lỗi phát sinh) + #20–23 (NHÓM D) + #24–35 (NHÓM E) + #36–60 (NHÓM F). `tsc` sạch, đã thử trên app |

## 2b. ĐÃ SỬA XONG & KIỂM CHỨNG (17/08/2026)

Sửa ở bản C:, đã đồng bộ về repo v3 trên G: (chị Trâm yêu cầu: sửa gì cũng lưu vào bản v3).
`npx tsc --noEmit` sạch (exit 0) sau mỗi đợt.

| Mục | Nội dung | Bằng chứng kiểm chứng |
|---|---|---|
| **A1 / góp ý #5** | Đồng hồ về giờ Việt Nam. Thêm `nowVN()` + `namHienTaiVN()` vào `src/utils/dateVN.ts` (cố định `Asia/Ho_Chi_Minh`, KHÔNG lấy giờ máy). Sửa 2 đồng hồ: trang đăng nhập (trước in `getUTCHours` + chữ "UTC", nay in giờ VN + "GMT+7") và header (trước lấy giờ máy) | Header hiện `Thứ Hai, 17-08-2026 · 14:50` đúng giờ VN; chuỗi "UTC" đã biến mất khỏi trang |
| **A6 / góp ý #10** | Hai biên trống khi zoom. **Nguyên nhân thật**: khung bọc dùng `max-w-7xl` = 80rem, mà nút zoom chữ (A-/A+) đổi cỡ rem → ở 85% chỉ còn ~1088px trong khi màn hình 1600px. Bỏ chặn ở `<main>`, footer, header trang đăng nhập | Đo ở 70% / 85% / 100% / 120%: vùng làm việc đều giữ **1349px**, lề chỉ 15px padding, `max-width: none` |
| **A3 / góp ý #3** | Gantt lệch 1 ngày. **Nguyên nhân thật**: `GanttChart.tsx` lấy `new Date('2026-07-25')` = 00:00 ngày 25/7 làm mốc KẾT THÚC → thanh dừng ở đầu ngày hạn, chỉ phủ hết 24/7. Thêm `mocHetNgay()` vào `utils/dateVN.ts` (+1 ngày) và áp cho `projEndGoc`, `projEndHienTai`, `actualWidth`, `isNear` | Đo DOM: mép phải thanh = **1159px** = đúng mép phải ô ngày 25/7 (ô 1112→1159). Trước sửa thanh dừng ở 1112 |
| **Góp ý #14** (lỗi phát sinh) | Bộ lọc năm Kanban sinh "Năm 2600" / "Năm 2610". **Nguyên nhân**: `projectYear` cắt 4 chữ số đầu của mã dự án, mà mã Phòng dùng kiểu `YYMMNN` → `260002` ra `2600`, `261006` ra `2610`. Sửa: lấy năm từ `ngayBatDau`, chỉ nhận tiền tố mã khi đúng dạng `YYYY.` có dấu chấm, chặn năm ngoài 2000–2100. **KÈM**: mặc định lọc = năm hiện tại, tự đổi theo lịch (chị Trâm yêu cầu) | Chạy thử regex trên 5 mã thật: cách cũ ra 2600/2610, cách mới trả về đúng. Ô lọc hiện chỉ còn "Năm 2026" và đang được chọn sẵn |
| **B1 / góp ý #4** | Đổi nhãn Level: L1 = Trưởng phòng/Phó phòng · L2 = Quản lý · L3 = Nhân viên · L4 = Ban giám đốc. Sửa **7 chỗ**: `chucVuToRole` (App.tsx — 'Ban giám đốc' nay mặc định VIEWER thay vì BOOD), `VIEWER_TABS`, màn chọn vai trò Bản thử, thanh L1–L4, `AppLauncher.tsx` (trước THIẾU HẲN nhãn VIEWER), `app/api/roles/route.ts` (App Tổng đọc để dựng dropdown), `StaffEditModal.tsx`, mẫu xuất báo cáo (App.tsx:3071), `sandboxData.ts` | Tooltip đọc được: "Trưởng phòng / Phó phòng", "Nhân viên", "Ban giám đốc — chỉ xem" |
| **B1b — L4 xem hết** | `VIEWER_TABS` mở từ 4 → 8 mục (thêm GANTT, CALENDAR, HISTORY, STAFF). Sidebar trước đây dùng điều kiện `role !== 'VIEWER'` CỨNG ở 3 chỗ, không đọc VIEWER_TABS → đã đổi để chỉ có MỘT nguồn duy nhất | Đăng nhập L4: hiện **8/9 tab**, chỉ thiếu SYSTEM (cố ý). Không còn nút thao tác nào (nút "XÓA" thấy lúc đầu chỉ là "Xóa bộ lọc") |
| **Góp ý #15** — lỗi thêm nhân sự (kèm ảnh) | Mọi người được App Tổng cấp quyền L1 đều bị ghi chức vụ **"Ban giám đốc"** — cả chị Trâm (Trưởng phòng) và tài khoản IT. Nguyên nhân: `CHUC_VU_BY_ROLE.BOOD = "Ban giám đốc"` trong `app/api/auth/hpcore-session/route.ts`. Đã đổi BOOD → "Trưởng phòng", VIEWER → "Ban giám đốc" | — |
| **Góp ý #16** · B2 (một phần) — hết bị App Tổng ghi đè | Cùng file trên: trước đây MỖI LẦN đăng nhập đều ghi đè `role` + `chucVu` bằng giá trị App Tổng, nên sửa tay trong "Đội ngũ & KPI" xong đăng nhập lại là mất. Nay: hồ sơ ĐÃ CÓ thì giữ nguyên giá trị của app đấu thầu; hồ sơ MỚI mới lấy giá trị App Tổng làm mức khởi đầu. App Tổng vẫn quyết ĐƯỢC VÀO HAY KHÔNG (403 nếu chưa phân quyền). **Giải xong điểm "CÒN TREO" của `BAN-GIAO-2026-07-27.md`** | — |
| **Góp ý #17** — zoom mất cột thông tin | Chị Trâm báo: zoom vào là cột "Tình hình dự án" + "Thao tác" bị đẩy ra ngoài khung. Đã GHIM 2 cột đó vào mép phải (`md:sticky md:right-0` / `md:right-24`) theo đúng chuẩn `docs/design-system/10-data-display/tables.md` — *"Cuộn ngang. Cố định cột chính."* Ô ghim có nền đục đổi theo trạng thái dòng (biến `nenOGhim`) để dòng đang mở rộng không bị hở | Đo ở cửa sổ 850px: bảng cần cuộn 197px, cột "Thao Tác" vẫn lệch **0–1px** so mép phải cả khi chưa cuộn và khi cuộn hết |

**KHÔNG đụng tới** (đã kiểm và thấy vốn đã đúng, đừng "sửa" lại):
- `src/components/ui/TimelineProgress.tsx` — đã xử lý hết-ngày từ 29/07 (dòng 43 `moc(endDate, true)`).
- `src/components/SubtaskGantt.tsx` — dùng mốc cuối kiểu loại-trừ, có `lastWorkDay` riêng (dòng 108).

## 2c. PHIÊN CHIỀU 17/08 — ĐÃ ĐỒNG BỘ 4 MỤC PHIÊN TRƯỚC LÀM DỞ + KIỂM CHỨNG LẠI

Phiên trước đã viết code 4 mục dưới đây ở bản C: nhưng **chỉ nằm ở C:**, chưa copy về G: và chưa
ghi vào file bàn giao. Phiên chiều đã: so từng file C: ↔ G:, copy 2 file lệch
(`src/App.tsx`, `src/components/DateInput.tsx`, kiểm lại kích thước byte khớp nhau), chạy
`npx tsc --noEmit` ở C: → **exit 0**, rồi thử lại trên app đang chạy (port 3002, Bản thử, đăng nhập L1).

| Mục | Nội dung | Bằng chứng kiểm chứng |
|---|---|---|
| **A5 / góp ý #9** | L1 xem được cả việc đã xong. Nguyên nhân thật: dữ liệu L1 vốn thấy hết, cái chặn tầm nhìn là **bộ lọc mặc định `ACTIVE`** áp cho mọi vai trò. Thêm `macDinhLocTrangThai(role)` trong `src/App.tsx`: **L1 + L4 mặc định `ALL`**, L2/L3 giữ `ACTIVE`; đổi người đăng nhập thì đặt lại theo vai trò mới (ref `vaiTroDaApLocMacDinh`, không đặt lại mỗi lần render) | Đăng nhập L1 vào tab Báo Cáo Tiến Độ: nút đang chọn là **"Tất cả (3)"** (trước là "Đang làm") — đo bằng class `shadow-sm` của cụm `StatusFilterPills` |
| **A2 / góp ý #1** | Bấm tin thứ 2 trên chuông vẫn kẹt ở hồ sơ 1. Nguyên nhân thật: `expandedProjectId` ĐÃ đổi đúng nhưng **trang không tự cuộn**, thêm nữa form sửa đang mở thì che kín danh sách. Sửa `moHoSo`: thêm `setShowForm(false)` + ghi `hoSoCanCuonToi` rồi cuộn ở effect sau khi danh sách render lại (`id="hang-ho-so-<id>"` trên từng hàng) | Hàng hồ sơ nay có `id` để cuộn tới; đã bấm chuyển qua lại giữa 2 tin trên app |
| **Góp ý #18** · A2b — chuông của L4 | `onOpen` của chuông trước đây chỉ xét đúng `role === 'MANAGER'`, nên **Ban giám đốc (L4) bấm thông báo không đi đâu cả** (L4 giờ đã xem được tab Hồ sơ). Đã đổi: L3 về Dashboard, các vai còn lại mở hồ sơ | — |
| **A4 / góp ý #2** | Quản lý lỡ bấm "Lưu dự án" thì không xem/sửa được việc con vừa tạo. `handleUpdateTasks` trước đây chặn SẠCH khi hồ sơ chờ TP duyệt. Nay **tách hai loại**: so cây việc con trước/sau, chỉ chặn khi đụng nhóm trường tiến độ (`isCompleted`, `staffProgress`, `managerProgress`, `ketQuaCongViec`, `taiLieuDinhKem`, `kpi`, `overdueReason`, `completedAt`); còn sửa kế hoạch thì **cho Quản lý ĐANG PHỤ TRÁCH hồ sơ đó** làm. Đúng quyết định mục 5.4 | `tsc` sạch; logic chặn/mở đọc lại khớp quyết định |
| **C1 / góp ý #6** | Thêm lịch chọn ngày. `DateInput.tsx` từ 66 → 210 dòng: giữ nguyên ô text DD-MM-YYYY (không dùng ô ngày native vì máy Anh–Mỹ hiện MM/DD/YYYY), thêm nút mở **lịch tháng** kèm "Hôm nay" / "Xoá ngày" | Bấm nút lịch ở bộ lọc Kanban: popup hiện **"Tháng 8 2026"**, đủ lưới ngày + 2 nút phụ (đã chụp ảnh) |
| **Góp ý #19** — dòng lọc ngày có 3 cuốn lịch | Dòng lọc ngày có **3 cuốn lịch**: mỗi `DateInput` nay tự có nút lịch, mà `KanbanBoard.tsx` và `GanttChart.tsx` còn giữ biểu tượng lịch trang trí đứng đầu ô lọc từ trước. Đã bỏ biểu tượng trang trí ở 2 file đó (kèm bỏ import `Calendar` không dùng nữa ở KanbanBoard). Giữ nguyên biểu tượng của **nhãn** "📅 Khoảng ngày:" trong `App.tsx` vì nó gắn với chữ, không phải nút chọn ngày | Đo lại ô lọc Kanban sau khi sửa: đúng **2 `<svg>` / 2 `<button>`** (trước là 3 svg). `npx tsc --noEmit` exit 0 |

## 2c-bis. GÓP Ý MỚI MỤC 20 → 23 (chị Trâm báo trực tiếp chiều 17/08) — ĐÃ LÀM XONG CẢ 4

Đặc tả + nguyên nhân + chỗ sửa của từng mục ghi ở **NHÓM D trong `docs/KE-HOACH-SUA-2026-08-17.md`**.
Tóm tắt để nắm nhanh:

| Mục | Nội dung | Trạng thái |
|---|---|---|
| **#20** | Việc con tính tới GIỜ — 2 ô tùy chọn (giờ bắt đầu + giờ hết hạn), bỏ trống = trọn ngày 00:00:00 → 23:59:59. Chỉ việc con, hồ sơ vẫn theo ngày. Thêm `TimeInput.tsx`, 5 hàm giờ trong `dateVN.ts`, cột "Giờ" ở bảng việc con, trễ hạn so theo phút, nhắc hạn theo giờ thật | ✅ Xong, `tsc` sạch, đã thử trên app |
| **#21** | Tin nhắc hạn mang ảnh + tên người không liên quan → `pushNotify` thêm `laTinHeThong`, tin nhắc hạn để trống `actorId` → hiện "Hệ thống nhắc" | ✅ Xong |
| **#22** | Lịch chọn ngày bị khung cắt → đưa lịch ra `<body>` bằng portal + `position: fixed`, tự lật lên/kéo vào, cuộn thì tính lại | ✅ Xong |
| **#23** | TP nhận thông báo duyệt khi hồ sơ còn ở Bước 2 → `tpPendingItems` bắt buộc thẻ đã ở Bước 3 trở lên | ✅ Xong (nửa sau = ảnh báo cáo, thuộc góp ý #12, chưa làm) |

**Chị Trâm chốt cách làm tiếp**: không xếp ưu tiên, **làm lần lượt hết**; vướng đâu hỏi ngay đó;
xong mục nào ghi ngay vào 2 file (`docs/KE-HOACH-SUA-2026-08-17.md` + file này) rồi chị vào kiểm tra lại.

## 2c-ter. NHÓM C — 5 MỤC CUỐI CỦA DANH SÁCH 13, ĐÃ LÀM XONG HẾT (chiều 17/08)

Chị Trâm chốt *"làm hết 1 lượt luôn, đừng ngưng hỏi nữa"* → làm liền #11 → #12 → #7 → #8 → #13.
`tsc` exit 0 sau từng mục, thử trên app port 3002. Đặc tả đầy đủ ở **NHÓM C trong
`docs/KE-HOACH-SUA-2026-08-17.md`**; đây là bảng tóm tắt + bằng chứng.

| Mục | Làm gì | Bằng chứng |
|---|---|---|
| **#11** | Ô khai tay "📤 Đã gửi CĐT trước khi dùng app" trong form hồ sơ. Con số này chỉ CỘNG LÚC HIỂN THỊ, **không đụng `lan` của `guiCDTLogs`** (lan đang khớp VÒNG — đổi là lệch báo cáo theo vòng). File mới `src/utils/guiCDT.ts` dùng chung cho 4 chỗ đếm | Khai 2 + app ghi 1 → thẻ Kanban hiện "📤 Gửi CĐT 3 lần", nhật ký ghi "Gửi CĐT lần 3" |
| **#12** | Kéo thẻ 2 → 3 mà chưa có ảnh báo cáo đã gửi báo giá → bật hộp `AnhBaoCaoModal` (chặn cả L1 lẫn L2). Lưu ảnh xong **thẻ tự sang Bước 3**. Ảnh hiện lại trên thẻ hồ sơ cho TP xem trước khi duyệt | Cửa chặn nằm trong `handleKanbanMove`; `tsc` sạch |
| **#7** | Nút 👥 ở cột Người giao → tick nhiều người → tách thành các việc con cấp dưới, **tỉ trọng chia đều**, ngày/giờ/vòng kế thừa. Chia lại lần nữa KHÔNG mất tiến độ người đã làm; có nút "Gộp lại 1 người" | Chia 1 việc cho 4 người trên app: cột hiện "👥 4 người", 4 dòng thụt lề "↳ … — <tên>", tỉ trọng 25 mỗi người |
| **#8** | 2 mục mới trên Lịch cá nhân: **Thông báo nội bộ** (chọn từng người hoặc toàn phòng, đi qua chuông sẵn có) và **Template mẫu đấu thầu** (danh mục biểu mẫu dùng chung, đồng bộ cloud qua collection `templates`) | Mở tab Lịch cá nhân thấy 2 khung; panel thông báo có 2 lựa chọn người nhận + ô nội dung |
| **#13** | Nút **"Bảng thống kê ISO"** + ô chọn Kỳ/Năm (chỉ L1). Dựng đúng mẫu sheet 3: 4 tầng tiêu đề, mỗi tháng 6 cột con, nhóm Phân tích thầu, **merge ô khi 1 hồ sơ gửi nhiều lần trong tháng**, dòng TỔNG HỢP. Kỳ 1=4-7 · Kỳ 2=8-11 · Kỳ 3=12,1,2,3. **ĐÃ LÀM LẠI LẦN 2** — xem ô dưới | Bấm xuất với 3 hồ sơ nháp → toast "Kỳ 2/2026: 2 hồ sơ, 2 dòng" (hồ sơ hạng mục *Cải tạo* bị loại đúng quy tắc) |

### #13 — bản đầu bị trả lại, đã làm lại theo file mẫu (đọc kỹ trước khi sửa tiếp)

Chị Trâm trả lại bản đầu: *"chưa đúng format, và rất xấu"*, và **để file mẫu ngay trong thư mục repo**:
`PHONG DAU THAU - MUC TIEU NAM 2026 - KY 1 - ver2.xlsx` (8MB — **ĐỪNG COMMIT**, chỉ để đối chiếu;
nên thêm vào `.gitignore` nếu commit repo).

Claude đã đọc trực tiếp **sheet 3** bằng `openpyxl` và dựng lại theo số đo thật: 38 cột · 4 tầng tiêu
đề (gộp dọc/ngang đúng như mẫu) · **Times New Roman** 11 (tiêu đề 20) · căn giữa + wrap · ô tiêu đề
nền **#2F5597** chữ trắng đậm · viền ngoài đậm / trong mảnh · bề rộng cột theo mẫu · dòng TỔNG HỢP
cộng **cả SKH và cột Nhận xét** từng tháng (bản đầu thiếu phần Nhận xét).

⚠️ **ĐỪNG ĐỔI LẠI THÀNH .xlsx**: thư viện `xlsx` (SheetJS community) trong app **không ghi được định
dạng** — xuất .xlsx là mất sạch viền/màu/font, đúng cái làm bản đầu "rất xấu". Nay xuất **HTML-Excel
(.xls)** giống 2 báo cáo sẵn có của app ("Xuất Excel", "Báo cáo Chiến lược"), Excel mở bình thường.
Muốn .xlsx thật có định dạng thì phải thêm gói `xlsx-js-style` → cần Sếp/IT đồng ý.

🔧 **VIỆC PHẢI LÀM TRÊN FIREBASE CONSOLE TRƯỚC KHI LÊN PRODUCTION (do #8 và #66)**: app nay đọc/ghi
thêm **BA** collection — **`templates`** (danh mục biểu mẫu), **`announcements`** (thông báo nội bộ được
lưu lại, mục 66) và **`anhDinhKem`** (nội dung ảnh báo cáo đã gửi báo giá, mục 81 — mỗi ảnh một
document, chỉ đọc khi người dùng bấm Tải về). Rules của project `hpcons-dauthau` hiện chỉ mở cho
`projects` / `staff` / `notifications` / `authAllow` thì mục Template mẫu sẽ **báo lỗi quyền** khi lên
thật (Bản thử không ảnh hưởng vì không đọc/ghi Firestore). Nhờ IT thêm `templates` vào rules với
cùng điều kiện như `notifications`. Repo KHÔNG chứa file rules — rules đặt trực tiếp trên Console.

⚠️ **Điểm #8 phải nói rõ với chị Trâm**: mục Template mẫu lưu **ĐƯỜNG LINK tệp**, không tải file lên
app — app chưa dùng Firebase Storage và 1 document Firestore tối đa 1MB (file Excel biểu mẫu vượt xa).
Muốn tải tệp trực tiếp thì phải bật Firebase Storage (Sếp/IT quyết, có phát sinh chi phí lưu trữ).
**Đây là giới hạn kiến trúc, không phải làm thiếu.**

📌 Ba việc còn tuỳ Sếp quyết (không phải bug): tải tệp biểu mẫu lên app (cần Storage) · KPI vẫn để
trống điểm (chờ trọng số) · ô nhập giá trị báo giá vẫn chưa mở.

### Cách đồng bộ C: → G: (làm ngay sau mỗi đợt sửa, đừng để dồn)
Copy `src/` + `app/` từ `C:\Users\ADMIN\Documents\GitHub\App-bao-cao-tien-do-du-an-ver2`
sang repo v3 trên G:, rồi **so lại kích thước byte từng file** (Google Drive từng tạo ra file 0 byte):

```powershell
Copy-Item -LiteralPath "$src\$f" -Destination "$dst\$f" -Force
(Get-Item -LiteralPath "$src\$f").Length -eq (Get-Item -LiteralPath "$dst\$f").Length
```

Phiên sáng có script `<scratchpad>/dong-bo-ve-v3.ps1`, nhưng scratchpad riêng theo từng phiên nên
phiên sau có thể không còn — copy tay như trên là đủ.
⚠️ **TUYỆT ĐỐI KHÔNG đồng bộ `src/data/staff_predemo_backup.json`** — file này chứa **mật khẩu dạng
thô** (đã nằm trong `.gitignore`). Phiên sáng lỡ copy 1 lần ngày 17/08 rồi xoá ngay khỏi G:.

## 2d. TRANG TỔNG QUAN APP (chị Trâm đặt riêng, không nằm trong 13 góp ý)

Chị Trâm yêu cầu "trang review" để trình bày app cho cấp trên / IT. Đã làm và publish:
**https://claude.ai/code/artifact/3b4de625-7318-40f3-aacd-125bc573ac6c**
Nguồn: `<scratchpad>/tong-quan-app.html` (7 mục: app giải quyết gì · quy trình 7 bước có 2 cửa chặn ·
bảng 4 cấp quyền · 9 màn hình · luật riêng của phòng · kiến trúc & triển khai · trạng thái hiện tại).
Nội dung đã cập nhật theo nhãn Level MỚI (L4 = Ban giám đốc, xem 8/9 tab). **Sửa app xong nhớ sửa
trang này cho khớp** — publish lại cùng đường dẫn file là giữ nguyên link.

## 2e. ⚠️ VIỆC QUAN TRỌNG NHẤT CÒN LẠI: DEPLOY

Chị Trâm đang kiểm tra trên **https://dauthau.hpcore.vn — bản đã deploy từ trước 17/08**, nên hai
lần chị báo "lỗi đồng hồ UTC ở màn hình đăng nhập" và "mục 8 không hề thấy làm" đều là **do bản
deploy cũ**, không phải lỗi còn tồn trong mã nguồn. Toàn bộ 34 mục đã sửa mới nằm ở mã nguồn (G:) +
bản chạy thử (C:, port 3002).

**Trước khi chị nghiệm thu, phải:**
1. Deploy lại lên Vercel (hoặc nhờ IT deploy) — `git push` nhánh production.
2. Nhờ IT mở quyền Firestore cho collection **`templates`** (mục 8 — Template mẫu), cùng điều kiện
   như `notifications`, nếu không mục đó báo lỗi quyền trên bản thật.
3. Kiểm checklist 4 mục ở `HUONG-DAN-CHO-IT.md` (config trỏ `hpcons-dauthau`, tắt cờ dev/demo,
   `npm run lint`, `npm run build`).

## 3. ✅ ĐÃ GỠ ĐƯỢC CHỖ TẮC — CÁCH CHẠY APP (đọc mục này trước, đừng loay hoay với G: nữa)

**Chị Trâm chỉ ra ngày 17/08: có sẵn một bản clone LOCAL trên ổ C: và nó CHẠY ĐƯỢC.**

```
C:\Users\ADMIN\Documents\GitHub\App-bao-cao-tien-do-du-an-ver2
```

- `node_modules` ở đó **sạch hoàn toàn** (mẫu 5.000 file → **0 file rỗng**), `next/dist/bin/next` = 13.452 byte.
- Cùng repo, nhánh `main`, cây làm việc sạch, remote `ksngotram14-collab/App-bao-cao-tien-do-du-an-ver2`.
- HEAD ở C: là `40fbe93` (30/07), G: là `14eef6d` (05/08) → **C: chậm hơn 1 commit**, mà commit đó
  chỉ sửa 2 file `.bat`, không ảnh hưởng app.

**Quy trình làm việc chốt với chị Trâm**: **chạy & thử ở bản C:**, còn **mã nguồn cuối cùng đưa về
repo ver3 trên G:** (đây là ý chị Trâm: *"đưa mã về trang app bao cao tien do v3"*).

**Cách chạy** (đã thêm cấu hình sẵn vào `.claude/launch.json` của repo G:):
- Tên cấu hình: **`hp-cons-erp-local-c`** → port **3002** (port 3000 bị dev server việc khác chiếm,
  3001 dành cho cấu hình preview cũ).
- Đã đổi `.env.local` của bản C: sang **Bản thử thuần**: `NEXT_PUBLIC_DEV_SANDBOX=1` +
  `NEXT_PUBLIC_DEV_CLOUD_TEST=0`. Giá trị cũ được ghi lại trong phần chú thích của chính file đó.
- **✅ Đã chạy thành công 17/08**: Next.js 15.5.20, Ready 6.9s, compiled 1840 modules, không lỗi console,
  vào đúng màn "Bản thử — Chọn vai trò để vào thử" với đủ 4 level.

⚠️ **BẪY AN TOÀN ĐÃ DỌN — đừng bật lại**: `.env.local` của bản C: trước đó đặt
`NEXT_PUBLIC_DEV_CLOUD_TEST=1` (chế độ GHI THẬT lên Firestore), trong khi `src/lib/firebase.ts` của
bản đó trỏ `projectId: 'hpcons-dauthau'` = **PROJECT THẬT của Phòng**. Khoá 3 lớp ở `App.tsx:112`
(bắt buộc projectId phải KHÁC project thật) đã chặn nên dữ liệu Phòng không bị đụng.
**Đừng bật lại thử-cloud khi `firebase.ts` còn trỏ project thật.**

### ✅ Đã xác nhận TRỰC TIẾP TRÊN APP (không còn là giả thuyết)

**Góp ý #4** — màn chọn vai trò của Bản thử đang hiện:
```
Trưởng phòng / Ban giám đốc (Level 1)   ← SAI: BGĐ bị gộp vào L1, phải là "Trưởng phòng / Phó phòng"
Quản lý (Level 2)                        ← đúng
Chuyên viên (Level 3)                    ← đúng
Khách - chỉ xem (Level 4)                ← SAI: phải là "Ban giám đốc (Level 4)"
```
Ngoài `AppLauncher.tsx:21–24`, **màn chọn vai trò của Bản thử cũng có nhãn riêng phải sửa**
(quanh `src/App.tsx:3366` — khối chỉ chạy khi `DEV_CHON_VAI_TRO`).

## 3b. LỊCH SỬ CHỖ TẮC TRÊN Ổ G: (để không thử lại những cách đã thất bại)

1. **`node_modules` HỎNG HOÀN TOÀN — `npm install` báo exit 0 nhưng kết quả rỗng.**
   Đã đo cụ thể ngày 17/08/2026: **34.913 file trong `node_modules` bị 0 byte**, trong đó có
   `node_modules\next\dist\bin\next` (0 byte) → shim `node_modules\.bin\next.cmd` bị sinh sai
   (thiếu hẳn `node` ở đầu vì npm không đọc được shebang của file rỗng) → `npm run dev` chết.
   **BÀI HỌC: đừng tin `exit 0` của npm trên ổ này. Luôn đếm lại file 0 byte sau khi cài:**
   ```powershell
   (Get-ChildItem node_modules -Recurse -File | Where-Object { $_.Length -eq 0 } | Measure-Object).Count
   ```
2. **Nguyên nhân: ổ `G:` là Google Drive File Stream** (`GoogleDriveFS.exe` 129.0.1.0), **giả lập
   filesystem FAT32**. Mọi lệnh ghi đều qua driver ảo của Drive, nên hàng chục nghìn file nhỏ của
   `node_modules` bị `TAR_ENTRY_ERROR ... write / EBADF` — tạo được file nhưng không ghi được nội dung.
   FAT32 giả lập cũng không có hardlink/symlink, càng làm npm dễ vỡ.
   - Claude đề xuất copy repo sang ổ local (vd `C:\dev\hpcons-dauthau`) → **chị Trâm TỪ CHỐI (17/08)**.
     Phiên sau đừng đề xuất lại chuyện copy cả repo.
   - Claude đề xuất chỉ dời riêng `node_modules` sang C: bằng junction → chị Trâm chưa chọn.
   - Chị Trâm chốt thử **TẠM DỪNG ĐỒNG BỘ Google Drive rồi cài lại** (17/08).
     **❌ ĐÃ THỬ — THẤT BẠI.** Chị Trâm đã pause Drive, Claude xóa sạch `node_modules` và cài lại:
     lỗi `TAR_ENTRY_ERROR ... write` xuất hiện y như cũ, đo mẫu 3.000 file đầu thì
     **2.980 file vẫn 0 byte**. Đã dừng lệnh cài giữa đường vì chắc chắn ra kết quả rỗng.
     → **KẾT LUẬN: pause Drive KHÔNG phải cách gỡ. Phiên sau đừng thử lại cách này.**
   - Phương án chưa thử, Claude đánh giá là cách duy nhất còn giữ nguyên repo trên Drive:
     **junction riêng cho `node_modules`** (`node_modules` trên G: thực chất trỏ về một thư mục ở C:).
     `node_modules` đã nằm trong `.gitignore` nên không ảnh hưởng repo.
     **Đã đề xuất với chị Trâm 17/08 — chị Trâm CHƯA quyết, đang chờ.**
     Ba lựa chọn đã đưa ra: (a) junction riêng `node_modules`, (b) copy cả repo sang C:,
     (c) không chạy app, sửa code "chạy khô" và chị Trâm tự test.
3. **Port 3000 đang bị dev server việc khác chiếm** (`carol-dev`). Dùng cấu hình `hp-cons-erp-preview`
   (port 3001) trong `.claude/launch.json`.

## 4. LƯU Ý AN TOÀN — ĐỌC KỸ

- **Bản thử (`NEXT_PUBLIC_DEV_SANDBOX=1`) KHÔNG đọc/ghi Firestore** (`src/App.tsx:1069`) → dữ liệu thật
  của Phòng không bị đụng. Luôn chạy ở chế độ này khi thử. **Chị Trâm yêu cầu KHÔNG mở luồng đăng nhập trực tuyến.**
- `.env.local` nằm trong `.gitignore` — không lên git. File này trên máy hiện chỉ có 1 cờ sandbox,
  **không có khoá thật** (khác với máy cũ mô tả trong `BAN-GIAO-2026-07-27.md`).
- Trước khi bàn giao production: `NEXT_PUBLIC_DEV_SANDBOX` phải về `0`, và
  `grep -n "projectId" src/lib/firebase.ts` phải là `hpcons-dauthau`.
- Rủi ro bảo trì lớn nhất của repo: **`src/App.tsx` nặng 439 KB trong một file duy nhất**
  (kèm `ProjectForm.tsx` 115 KB, `MyTasksPanel.tsx` / `SubtaskHierarchy.tsx` ~49 KB).
  Sửa ở đây phải đọc kỹ ngữ cảnh, đừng sửa mù.

## 5. QUYẾT ĐỊNH CHỊ TRÂM ĐÃ CHỐT NGÀY 17/08/2026 (không phải hỏi lại)

1. **L4 = Ban giám đốc, thay cho chữ "Khách mời"** — tính năng KHÔNG đổi: giữ cơ chế chỉ-xem của
   role `VIEWER`, nhưng **cho xem HẾT**, chỉ không cho thao tác.
2. **Ban giám đốc muốn thao tác thì gán L1** — L1 được thêm/xóa/sửa **TẤT CẢ dự án**, kể cả dự án
   của TP và Quản lý không liên quan tới mình. L1 = quyền cao nhất, không giới hạn "dự án của mình".
3. **Phân quyền đi HƯỚNG 2**: *"App đấu thầu giữ bảng quyền riêng, App Tổng chỉ lo đăng nhập."*
   → Gỡ cơ chế App Tổng ghi đè role. Nguồn quyền duy nhất = bảng nhân sự trong Firestore của app này.
   Việc này **giải luôn điểm "CÒN TREO"** trong `BAN-GIAO-2026-07-27.md`.
   Rủi ro đã báo chị Trâm và chị Trâm chấp nhận: quyền ở 2 app có thể lệch nhau.
4. **Góp ý #2**: Quản lý **được xem + sửa kế hoạch việc con của chính mình** khi còn chờ TP duyệt,
   nhưng **vẫn bị khoá cập nhật % tiến độ**.
5. **Góp ý #13 đã có mẫu**: sheet **3** (`Bang thong ke du an - Ky 1`) của file
   `D:\OneDrive\Tender\04.SystemImprovement\10.Muc tieu ISO\BAO CAO NAM 2026 - KY 1\PHONG DAU THAU - MUC TIEU NAM 2026 - KY 1 - ver2.xlsx`.
   Chị Trâm xác nhận đúng sheet 3 (không phải sheet 2 = "Ví dụ minh họa" của phòng HC-NS).
   **Đặc tả đầy đủ đã viết ở mục "C6 CHI TIẾT" trong `docs/KE-HOACH-SUA-2026-08-17.md`** — phiên sau
   đọc mục đó là đủ, không cần mở lại file Excel.

## 5b. ĐÃ ĐÓNG — 4 trường bảng #13 cần thì app ĐÃ CÓ ĐỦ

Claude ban đầu tưởng app thiếu 4 trường; chị Trâm chỉ ra là **đã có sẵn hết** (kèm ảnh form dự án),
Claude kiểm chứng lại trong code đúng như vậy. Bản đồ trường:

| Cột bảng #13 | Trường app | Code |
|---|---|---|
| Vị trí dự án | `diaChi` ("ĐỊA CHỈ CÔNG TRÌNH") | `src/types.ts:120` |
| Hình thức đấu thầu cạnh tranh | `hinhThucDauThau` (`Chỉ định thầu` / `Đấu thầu cạnh tranh`) | `src/types.ts:121` |
| Hình thức báo giá | `hangMuc` (ô "Phân loại hạng mục", 6 giá trị) | `src/types.ts:62` · `ProjectForm.tsx:1180` |
| Tiến độ cam kết | `hanHenCDT` ("🤝 Thời hạn hẹn CĐT") | `src/types.ts:104` · `ProjectForm.tsx:1307` |

→ **KHÔNG phải thêm ô nhập nào.** C6 nhẹ hơn dự tính: chỉ là đọc dữ liệu có sẵn + trình bày lại.

**✅ Quy tắc lọc `hangMuc` cũng đã chốt (17/08)**: **loại `Cải tạo` và `Báo giá phát sinh`** khỏi bảng #13;
`Báo giá chi tiết`, `Khái toán`, `VE`, `Lập hồ sơ thầu` thì được xét. Cột "Hình thức báo giá" **in
nguyên tên `hangMuc` như app đang lưu**, không gộp/đổi tên/viết tắt.
Quy tắc này khớp với sheet 1 file ISO ("không kể các gói thầu có hình thức cải tạo, sửa chữa,
các gói phát sinh") → không mâu thuẫn.

## 6. FILE ĐÃ TẠO / ĐÃ SỬA — CHƯA COMMIT (tính tới hết ngày 18/08/2026)

**File mới trong đợt 17–18/08:**
- `docs/KE-HOACH-SUA-2026-08-17.md` — đặc tả toàn bộ góp ý, nhóm A/B/C (mục 1–13) + **NHÓM D** (20–23)
  + **NHÓM E** (24–35) + **NHÓM F** (36–60), có nguyên nhân & chỗ sửa từng mục.
- `BANGIAO.md` — chính file này.
- `src/utils/guiCDT.ts` — đếm số lần gửi CĐT (khai tay + app tự ghi) · mục #11.
- `src/utils/bangThongKeISO.ts` — dựng bảng thống kê dự án theo mẫu ISO · mục #13, 56, 58, 59, 60.
- `src/components/AnhBaoCaoModal.tsx` — hộp đính kèm ảnh đã gửi báo giá (cửa Bước 2 → 3) · mục #12, 32.
- `src/components/ThongBaoNoiBoPanel.tsx` — thông báo nội bộ trên Lịch cá nhân · mục #8.
- `src/components/TemplateMauPanel.tsx` — danh mục biểu mẫu dùng chung · mục #8, 55.
- `.env.local` — không lên git.

> `src/components/TimeInput.tsx` từng được tạo cho ô giờ ở mục #20, nhưng mục #24 đã bỏ ô giờ
> (chuyển sang bước nửa ngày) nên file này **đã xoá** — không còn chỗ nào dùng.

**File đã sửa** (đều đã đồng bộ C: ↔ G:, `npx tsc --noEmit` exit 0):
`src/App.tsx` · `src/types.ts` · `src/lib/firebase.ts` · `src/utils/dateVN.ts` ·
`src/data/sandboxData.ts` · `src/components/ProjectForm.tsx` · `SubtaskGantt.tsx` · `GanttChart.tsx` ·
`MyTasksPanel.tsx` · `KanbanBoard.tsx` · `DateInput.tsx` · `StaffEditModal.tsx` · `PhongProgressModal.tsx` ·
`AppLauncher.tsx` · `app/globals.css` · `app/api/auth/hpcore-session/route.ts` · `app/api/roles/route.ts`
(xem đầy đủ bằng `git status`).

⚠️ **CHƯA COMMIT bất cứ thứ gì** — chị Trâm chưa yêu cầu. Phiên sau muốn commit thì hỏi chị trước;
repo trên G: **không có `node_modules` chạy được**, mọi lệnh npm/tsc phải chạy ở bản C:.

## 7. TRẠNG THÁI CUỐI PHIÊN 18/08/2026 (tối)

- **60/60 mục góp ý đã xong trong mã nguồn.**
- `npx tsc --noEmit` ở bản C: → **exit 0**.
- **G: và C: khớp hoàn toàn** (đã so kích thước từng file `.ts/.tsx/.css` trong `src/` và `app/`).
- Dev server bản thử đang chạy ở **port 3002** (cấu hình `hp-cons-erp-local-c`).
- Chưa commit, chưa deploy.

---

## 8. HAI VIỆC CHỜ QUYẾT (không phải lỗi — có phát sinh chi phí / cần IT)

Chị Trâm đóng hồ sơ gửi IT ngày 18/08/2026. Ngoài **việc mở quyền Firestore cho 3 collection** ở đầu
file (bắt buộc, không làm là app báo lỗi quyền), còn **hai việc phải quyết mới làm được**:

### 8.1 · Mục 69 — Xem & tải TỆP GỐC dung lượng lớn (cần Firebase Storage)

Hiện app **đã tải về được ảnh chụp màn hình** (mục 81): ảnh được nén trong trình duyệt còn 100–300KB,
lưu ở collection `anhDinhKem`, bấm là tải về. Nhưng **tệp gốc lớn** (ảnh không nén, PDF hồ sơ, file
Excel biểu mẫu) thì KHÔNG lưu được — một document Firestore tối đa **1MB**.

| Cách | Cần gì | Chi phí |
|---|---|---|
| **Bật Firebase Storage** | IT bật dịch vụ + viết rules | Phát sinh phí lưu trữ & băng thông theo dung lượng |
| **Giữ như hiện tại** | Không cần gì | Ảnh chụp màn hình tải được; tệp gốc lớn thì dán **đường link** OneDrive/SharePoint (như mục Template mẫu) |

Claude **không tự chọn** — đây là quyết định có phát sinh chi phí.

### 8.2 · Mục 104 — Popup thông báo khi ĐÃ ĐÓNG trình duyệt (cần Web Push)

Chị Trâm hỏi 18/08: *"kiểm tra xem thông báo đã được liên kết web mở dạng popup ở ngoài màn hình
chưa em ơi, để biết mà vô coi, chứ im im ko biết j cả."*

**Đã kiểm — trả lời: CÓ, nhưng có giới hạn.**

- **Đang có**: mọi tin mới vào chuông của người đang đăng nhập đều bật **popup ngoài màn hình**
  (nhiều tin cùng lúc thì gộp 1 popup). Cần bấm nút **"🔔 Bật thông báo trình duyệt"** một lần để
  cấp quyền — trên `dauthau.hpcore.vn` nút này hiện **"✓ Đã bật thông báo"** là đã cấp xong.
  Code: `App.tsx` — effect "Popup trình duyệt cho thông báo MỚI nhận được".
- **GIỚI HẠN THẬT**: popup chạy bằng JavaScript **của trang**, nên chỉ hoạt động **khi tab app còn
  mở** (ẩn sau cửa sổ khác vẫn được). **Đóng hẳn trình duyệt là không có popup.**
- Muốn "đóng máy vẫn nhận như Zalo" thì phải làm **Web Push + Service Worker** — app hiện **chưa có**
  (đã kiểm: không có service worker, không có manifest, không có `pushManager`). Việc này cần:
  1. thêm service worker + manifest vào app (phần việc của Claude, làm được);
  2. **IT bật Firebase Cloud Messaging** cho project và cấp khoá VAPID (phần việc của IT);
  3. mỗi người bấm cho phép thông báo một lần.

👉 **Khuyến nghị tạm thời, không tốn gì**: nhắc anh em **để tab app mở** trong giờ làm là nhận đủ popup.
