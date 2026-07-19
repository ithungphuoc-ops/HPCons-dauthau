# UI Migration Progress — HPCons Design System V1.0

## Tổng trạng thái

| Phase | Trạng thái |
|---|---|
| 1. Audit | ✅ **XONG** (6 báo cáo) |
| 2. Foundation & Token | ✅ token thương hiệu + **dải màu 50→950** (brand-primary & brand-accent) trong `index.css` |
| — Màu: nút hành động chính → `brand-primary` | ✅ 9 nút |
| 3. App Shell | ✅ sidebar nav-base `#4B4F55` (cả 2 chế độ), tab active → `brand-accent`, chữ sáng, số hồ sơ → `brand-primary` |
| 4. UI Primitives | ✅ theo phạm vi thu hẹp: không dựng bộ ui/ mới; token hóa tại chỗ (xem 07-FINAL-REPORT §2) |
| 5. Shared components | ✅ gom trùng lặp thật: `StatusFilterPills` (3 bản copy); empty-state na ná giữ nguyên (xem 07-FINAL-REPORT §4) |
| 6. Tab HISTORY | ✅ icon/search/badge → brand-accent; badge nhóm hành động → danger/primary/accent/warning/muted; dark mode dùng accent-300 |
| 7. Tab SCHEMA + WORKFLOW | ✅ blue/indigo/emerald/amber → brand token; bỏ hex cứng `#0e0e10`→slate-900; verify ảnh 2 tab; **TenderMindmap** (mindmap 5 bước trong Workflow) → token 2026-07-14 |
| 8. Tab STAFF | ✅ banner accent-900+warning; badge KPI ngưỡng primary/accent/danger; level accent/warning/slate; nút Xóa danger, Đổi ảnh primary, Sửa accent; bar đúng hạn primary/accent/warning |
| 9. Tab KANBAN | ✅ 7 bước → accent(400/500/600)/warning/primary/danger, giữ bước 1 muted; badge %/nút ✓✗/lock/filter → token |
| 10. Tab GANTT | ✅ bars/legend/critical-path/mốc → brand token; bỏ hex cứng `#0e0e10`/`#121214` → slate-900 |
| 11. Tab PROJECTS | ✅ khối danh sách/bảng/hàng mở rộng (App.tsx 2843-3594): 66 dòng map 1:1 sang token; nút gradient Báo cáo Chiến lược → accent phẳng. **ProjectForm + modal: xem Phase 13** |
| 12. Tab DASHBOARD | ✅ khối App (2600-2842) + StatsDashboard.tsx: ~90 chỗ → token; donut 4 mảnh accent/primary/warning/danger; legend "đúng hạn" sửa về primary (xanh lá); 3 hero card gradient → dải accent; huy chương #1/#3 → warning; bỏ hex `#0e0e10` tâm donut |
| 13. Login + phụ trợ | ✅ 712 chỗ / 10 file (login, topbar/bell/toast, ProjectForm, 3 modal, MyTasksPanel, StaffTaskResultPanel, SubtaskGantt/Hierarchy, FileDropZone) → token qua bộ quy tắc map tổng quát; badge ERP v1.4 xử lý luôn |
| 14. Responsive tablet | ✅ sidebar thu gọn 72px: tablet mặc định thu, desktop mặc định mở, nút toggle + nhớ localStorage; chữ nút sr-only giữ a11y. Mobile Card List → đợt 2 (chị chốt) |
| 15. Cleanup + Validation | ✅ 7 hex login + 1 StatsDashboard → slate; 5 class chết shadow-3xs gỡ bỏ; quét toàn cục: 0 palette cũ / 0 hex / 0 class chết; tsc + build sạch |

## Nguyên tắc phạm vi (2026-07-13, chị chốt)
> **CHỈ chỉnh những gì luật công ty (`design-system/CLAUDE.md`) quy định rõ. Không tự thêm chuẩn riêng.**

### Được chỉnh (có căn cứ luật)
- Màu thương hiệu: chính `#60BB46`, nhấn `#0969A7`, nav `#4B4F55`; không màu mới ngoài token (luật 2–5).
- Không khoảng cách tùy ý ngoài thang chuẩn (luật 6).
- Không inline style (luật 7) — *ngoại lệ kỹ thuật*: giá trị động theo dữ liệu (thanh %, bar Gantt) vì không thay được bằng class tĩnh → sẽ hỏi chị trước khi đụng.
- Không lặp component đã có (luật 8) — chỉ gom chỗ **trùng lặp thật**.
- Mobile: không ép bảng nhiều cột → Card List; chạm ≥44px (luật 9–10).
- Trạng thái phải có cả màu + chữ (luật 11).
- Không chữ <12px cho **nội dung quan trọng**; không emoji làm icon chính; không bóng đổ mạnh; không ẩn nhãn field chỉ dùng placeholder.

### KHÔNG chỉnh (em tự thêm, luật không có → loại bỏ)
- ❌ Nâng toàn bộ chữ lên 14px/caption 12px → luật chỉ cấm <12px cho *nội dung quan trọng*; chữ phụ mật độ cao (Kanban/Gantt) nhỏ hơn vẫn giữ.
- ❌ Thêm Loading state ở mọi tab.
- ❌ Gom PageHeader/AppShell/SectionHeader cho "đồng bộ" (chỉ gom khi trùng lặp thật).
- ❌ Áp cứng thang H1/H2/H3 lên tiêu đề đang có (bảng chữ là tham chiếu).

## Nhật ký thay đổi

### Phase 1 — Audit (2026-07-13)
- **File tạo**: `docs/ui-migration/01-UI-AUDIT-REPORT.md`, `02-COMPONENT-INVENTORY.md`, `03-DESIGN-TOKEN-AUDIT.md`, `04-UI-INCONSISTENCY-REPORT.md`, `05-UI-MIGRATION-MAP.md` (kèm `06-UI-MIGRATION-PLAN.md` có sẵn).
- **Nội dung**: xác định 8 tab thực tế; kiểm kê 17 component + danh sách primitive/shared cần tạo; đo hard-code (**467 arbitrary values, 391 chữ <12px**); bảng màu tản mát (slate 1987 / blue 414 / emerald 273 / rose 258 / amber 249...); ma trận bất nhất 8 tab; bản đồ migration theo phase.
- **Lý do**: bắt buộc trước khi refactor (Phase 1 của prompt chuẩn hóa).
- **Rủi ro**: 0 (chỉ tạo tài liệu, chưa đụng source).
- **Kiểm tra đã chạy**: `git branch` (đang trên `ui-hpcons`), quét grep hard-code/màu/inline-style.
- **Kết quả**: đạt — audit đầy đủ, không phát hiện mâu thuẫn nghiêm trọng trong tài liệu chuẩn.

### Phase 3 — App Shell: nav active state (2026-07-13)
- **File**: `src/App.tsx` — 8 nút sidebar nav.
- **Nội dung**: chuỗi active `border-blue-500 text-blue-600 bg-blue-50 dark:text-blue-400...` → `border-brand-accent text-brand-accent bg-brand-accent/10 dark:text-white dark:bg-brand-accent/15...` (điều hướng active dùng brand-accent theo docs 08-navigation; dark mode giữ chữ trắng cho dễ đọc — accessibility).
- **Rủi ro**: thấp (thay đồng loạt 1 chuỗi giống hệt, dễ hoàn tác).
- **Kiểm tra**: tsc sạch; build sạch; grep dist CSS xác nhận `border-brand-accent`/`text-brand-accent` sinh đúng `var(--color-brand-accent)` = #0969A7.
- **Chưa verify bằng ảnh**: sidebar chỉ hiện sau đăng nhập (cần mật khẩu của chị) → nhờ chị mắt thường kiểm sau khi đăng nhập.

### Phase 2/3 tiếp — dải màu + sidebar nav-base (2026-07-13, chị chốt 2 hướng)
- **Chị duyệt**: (1) tạo dải màu thương hiệu rồi map dần theo từng tab; (2) đổi nền sidebar sang nav-base.
- **index.css**: thêm dải `--color-brand-primary-50..950` và `--color-brand-accent-50..950` (tint/shade sinh từ 2 màu gốc, core=500). Chưa dùng ở component nào → Tailwind sẽ sinh utility khi map từng tab.
- **App.tsx sidebar**: nền `bg-nav-base` (#4B4F55) cả 2 chế độ; chữ sáng (slate-100/300); brand box + footer dùng overlay `bg-black/15 border-white/10`; logo luôn bản sáng; active tab `border-brand-accent text-white bg-brand-accent/25`; inactive `text-slate-300 hover:bg-white/10`; số hồ sơ `text-brand-primary`.
- **Kiểm tra**: tsc sạch; build sạch; CSS runtime xác nhận aside=#4B4F55, active border=#0969A7, số=#60BB46. **Đã chụp ảnh** (app còn đăng nhập sẵn) — sidebar hiển thị đúng.

### Phase 6 — Tab HISTORY (Nhật Ký) — TAB MẪU (2026-07-13)
- **File**: `src/App.tsx` (khối `activeTab === 'HISTORY'`).
- **Nội dung**: icon tiêu đề + focus ring search + badge đếm → `brand-accent`; hàm `actionStyle` map 6 nhóm hành động sang token: xóa/lỗi=`brand-danger`, đăng ký/mới=`brand-primary`, đăng nhập & nhập/xuất/sao lưu=`brand-accent`, đăng xuất=`brand-muted`, mặc định(cập nhật)=`brand-warning`. Nền tint dùng opacity `/10`.
- **PATTERN CHUẨN rút ra (áp cho các tab sau)**:
  - Nền chip/badge = `bg-brand-<x>/10` (opacity, không cần dark:).
  - Chữ danger/warning/primary/muted đọc tốt trên nền tối → dùng token gốc.
  - Chữ **accent** (#0969A7 tối) trên nền tối PHẢI thêm `dark:text-brand-accent-300` (#5ea3cf).
- **Kiểm tra**: tsc + build sạch; **ảnh + CSS runtime** xác nhận badge đếm=#5ea3cf, badge action=#FFA726, đúng token.

### Phase 7 — Tab SCHEMA + WORKFLOW (2026-07-13)
- **SchemaExplorer.tsx**: icon header/table/FK/field-name → brand-accent (dark:accent-300); bảng đang chọn `bg-brand-accent`; badge fields `bg-brand-accent-700`; PK key + badge → brand-warning; FK badge → brand-accent; "đặc điểm thiết kế" icon+bullets → brand-primary; nút copied → brand-primary; **bỏ hex cứng `dark:bg-[#0e0e10]` → `dark:bg-slate-900`** (đồng bộ card khác).
- **WorkflowViewer.tsx**: icon bước (1,2,5=accent / 3=warning / 4=primary); header+badge BPM+label BƯỚC+engine header → brand-accent; node active `bg-brand-accent`; hộp "hành động tự động" → brand-primary.
- **Kiểm tra**: tsc + build sạch; grep xác nhận 0 màu tản mát còn sót; ảnh 2 tab đúng chuẩn.
- **Còn nhỏ (chưa làm)**: badge "ERP v1.4" trong sidebar còn dùng amber-500 → gộp vào cleanup cuối.

### Phase 8 — Tab STAFF (Nhân sự) (2026-07-13)
- **File**: `src/App.tsx` (khối `activeTab === 'STAFF'`).
- **Map**: banner `bg-brand-accent-900` + tiêu đề `text-brand-warning`; badge KPI theo ngưỡng ≥90=primary / 80-89=accent(dark:accent-300) / <80=danger; badge Level 1=accent, 2=warning, 3=slate; thanh đúng hạn primary/accent/warning; nút Xóa=danger, Đổi ảnh=primary, Chỉnh sửa=accent; ô khóa quyền → brand-warning.
- **Kiểm tra**: tsc + build sạch; ảnh + CSS (sau hard-reload) xác nhận badge 85=accent-300 #5ea3cf.
- **Ghi nhớ kỹ thuật**: dev server HMR đôi khi chưa áp class mới → **luôn force-reload trước khi đo CSS**.

### Phase 9 — Tab KANBAN (2026-07-13)
- **File**: `src/components/KanbanBoard.tsx`.
- **7 cột bước** (indigo/violet/amber/blue/emerald/rose → token): bước 1 = `brand-muted` (khởi đầu trung tính); 2 = `accent-400`; 3 = `accent-600`; 4 = `warning`; 5 = `accent`; 6 = `primary`; 7 = `danger`. Ba bước accent dùng sắc độ 400/500/600 để vẫn phân biệt được. Badge = `bg-brand-<x>/10 text-brand-<x>` (accent thêm `dark:text-brand-accent-300`).
- **Còn lại**: icon header/lịch + focus ring + badge đếm hồ sơ + hover thẻ + badge % (trễ=danger/thường=accent) + dragover ring → accent; lock → warning; nút ← → hover → accent; nút ✓ Trúng → primary, ✗ Rớt → danger.
- **Kiểm tra**: tsc + build sạch; grep 0 màu tản mát/0 hex còn lại.

### Phase 10 — Tab GANTT (Biểu Đồ Gantt) (2026-07-13)
- **File**: `src/components/GanttChart.tsx`.
- **Map màu** (theo pattern tab mẫu): xanh lá `emerald` → `brand-primary` (đã hoàn thành, tiến độ Phòng, mốc "Đóng hồ sơ"); xanh dương `blue` → `brand-accent` (đang thực hiện, icon lịch, nút Ngày/Tuần active, tiến độ Bộ phận); cam `amber` → `brand-warning` (cận hạn ≤5 ngày, cuối tuần, thanh dời hạn, chỉ báo trễ); đỏ `rose`/`red` → `brand-danger` (đường găng, quá hạn). Thanh Gantt trạng thái: viền + nền tint `/10`, fill `/20–30`.
  - Chữ trên thanh: hoàn thành `text-brand-primary-900 dark:text-brand-primary-100`; mặc định `text-brand-accent-950 dark:text-brand-accent-100`; trễ/cận hạn dùng token gốc `brand-danger`/`brand-warning` (font-extrabold để đọc rõ). Trạng thái vẫn có **cả màu + chữ** (badge ĐƯỜNG GĂNG / QUÁ HẠN + nhãn "Hạn:") → đúng luật 11.
- **Bỏ hex cứng** `dark:bg-[#0e0e10]` (khung ngoài) và `dark:bg-[#121214]` (3 chỗ cột trái sticky) → `dark:bg-slate-900` cho đồng bộ card khác (như Phase 7). Thêm `dark:bg-slate-800` cho 2 ô % Bộ phận/Phòng (trước thiếu dark → trắng trên nền tối). Ngày lọc hiển thị `fmtDateVN` thay ISO thô.
- **Kiểm tra**: `tsc` sạch; `npm run build` sạch (2113 modules); grep xác nhận **0 màu tản mát / 0 hex** còn trong file; grep dist CSS xác nhận utility token sinh đúng (`brand-danger`, `brand-warning`, `brand-primary-900`, `brand-accent-950`, `brand-accent-100`=#c9e0f0…).
- **Chưa verify bằng ảnh**: phiên đăng nhập đã hết, không tự đăng nhập Firebase production → nhờ chị mở tab Gantt (sau đăng nhập) xem mắt thường.

### Phase 11 — Tab PROJECTS (Báo Cáo Tiến Độ) (2026-07-14)
- **Phạm vi**: khối `activeTab === 'PROJECTS'` trong App.tsx (dòng 2843–3594) — filter/pill lọc nhanh, nút xuất Excel/JSON/Import, danh sách Dự án cha, bảng công việc, hàng mở rộng (delay logs, phân rã, thảo luận). ProjectForm/modal thuộc Phase 13.
- **Cách làm**: sed giới hạn dải dòng, map ~70 biến thể class 1:1 (blue/indigo→accent, emerald→primary, rose→danger, amber→warning), thứ tự chuỗi dài→ngắn tránh lem substring; 66 dòng đổi, không thêm/bớt dòng. Nút "Báo cáo Chiến lược" bỏ gradient indigo→blue, dùng `bg-brand-accent` phẳng. Dropzone import Excel: cả cặp classList.add/remove trong JS được map đồng bộ.
- **Kiểm tra**: tsc + build sạch; **0 màu tản mát còn trong khối**; CSS build sinh đủ utility (`bg-brand-accent\/5`×4, `hover:bg-brand-primary-hover`, color-mix 5–50%).
- **Chưa verify ảnh**: phiên đăng nhập hết hạn → nhờ chị đăng nhập xem tab Báo Cáo Tiến Độ bằng mắt.
- **Sự cố sáng 2026-07-14 (đã xử lý)**: OneDrive sync chéo 2 máy tạo staged-revert giả cho KanbanBoard/GanttChart/progress → đã xác minh staged = bản cũ nguyên vẹn (0 diff so c25f8a0) rồi gỡ bỏ, giữ nguyên 2 commit tối qua. **Khuyến nghị: tránh để 2 máy cùng mở worktree này qua OneDrive; làm xong nên push lên GitHub làm nguồn chuẩn.**

### Phase 12 — Tab DASHBOARD (Bảng Chỉ Số) (2026-07-14)
- **Phạm vi**: khối `activeTab === 'DASHBOARD'` App.tsx (2600–2842) + toàn bộ `StatsDashboard.tsx` (3 biến thể theo role).
- **Map**: range-sed App block + whole-file sed StatsDashboard theo bảng chuẩn. Chỉnh tay ngữ nghĩa: donut & legend "Đã hoàn thành đúng hạn" indigo→**brand-primary** (hoàn thành = xanh lá, không phải accent); 3 hero-card gradient blue/indigo → `from-brand-accent-500 via-600 to-800`; huy chương xếp hạng #1 `bg-brand-warning text-slate-900`, #3 `bg-brand-warning/70`; hộp hướng dẫn chuyên viên → `from-brand-accent-800 to-950`; bỏ hex `dark:bg-[#0e0e10]` tâm donut → slate-900.
- **Kiểm tra**: tsc + build sạch; 0 màu tản mát cả 2 vùng; **ảnh light-mode** (chị đăng nhập lại): KPI 100đ=primary/85đ=accent đúng ngưỡng, huy chương token, chip hạn thầu primary.

### Phase 13 — Login + phụ trợ (2026-07-14)
- **Phạm vi**: toàn bộ phần còn lại có màu — App.tsx (login screen, topbar, chuông, toast, modal xóa/nghỉ việc), ProjectForm.tsx, SubtaskHierarchy, StaffEditModal, SubtaskGantt, MyTasksPanel, StaffTaskResultPanel, ChangePasswordModal, CdtRevisionModal, FileDropZone.
- **Cách làm**: script Python `map_colors.py` (scratchpad) áp bộ quy tắc tổng quát đúc kết từ Phase 6-12: blue/indigo/purple/teal→accent, emerald/green→primary, rose/red→danger, amber/orange→warning; bg 50→/10, 100→/15, ≥900→/10-15; border 100→/15, 200→/25, 300→/40, 400→/50; dark:text scaled→-300; shade 500/600→base, còn lại giữ số theo dải; hover đặc biệt (bg-emerald-700→primary-hover, amber/rose 500-700→/85); accent-blue-600 (checkbox)→accent-brand-accent. **712 phép thay trên 10 file.**
- **Kiểm tra**: tsc + build sạch; grep toàn src = 0 class palette cũ (chỉ 1 comment); ảnh dark-mode STAFF dashboard + panel Kết Quả Công Việc (FileDropZone xanh lá) đúng token.
- **Ghi chú**: badge "ERP v1.4" (mục cleanup) đã token hóa trong đợt này. Màn login chưa chụp ảnh (đang giữ phiên đăng nhập của chị) — chị đăng xuất xem sau.

### Phase 15 — Cleanup + Validation (2026-07-14)
- **Hex cứng cuối cùng**: màn login `bg-[#070708]`→slate-950, `bg-[#121214]`/`bg-[#0E0E10]`/`bg-[#131316]`→slate-900; StatsDashboard `dark:bg-[#0e0e10]`→slate-900. **Toàn src = 0 hex trong class.**
- **Class chết**: `shadow-3xs` (không phải class Tailwind v4, không sinh CSS) gỡ khỏi 5 chỗ — không đổi giao diện.
- **Quét nghiệm thu toàn cục**: 0 class palette cũ / 0 hex / 0 class chết; tsc + build sạch.
- **Theo checklist 20-quality**: màu qua token ✓, trạng thái màu+chữ ✓, không inline-style mới ✓ (inline động giữ theo ngoại lệ đã chốt), không bóng đổ mạnh ✓.

### Phase 14 — Sidebar thu gọn (2026-07-14, chị chốt phương án 1)
- **App.tsx**: state `sidebarCollapsed` (mặc định: tablet 768-1279 = thu, desktop = mở; nhớ `ui_sidebar_collapsed` trong localStorage); nút toggle ChevronLeft/Right đầu sidebar (title + aria-label); aside `md:w-18` (72px) ↔ `md:w-64` + class `sidebar-collapsed`.
- **index.css**: khối media md+ — ẩn brand/nhãn/footer; nút nav căn giữa icon; **chữ nút để dạng sr-only** (giấu mắt nhưng giữ accessible name — luật icon-button phải có tên).
- **Mobile (<768)**: giữ nguyên dải nav ngang hiện tại (Card List đợt 2 theo quyết định của chị).
- **Kiểm tra**: tsc + build sạch; đo runtime tablet 768: mặc định thu 72px ✓, toggle mở 256px ✓, thu lại ✓, localStorage nhớ ✓; desktop: mặc định mở ✓. Ảnh tablet chụp OK.

### Sự cố Phase 13 & bản vá (2026-07-14)
- **Lỗi**: script map làm rơi tiền tố utility → 712 chỗ thành class vô nghĩa (`brand-warning/20` thay vì `bg-brand-warning/20`). tsc/build/grep "palette cũ" đều không bắt được.
- **Vá** (commit 2ea2d5f): khôi phục 10 file về 3cc4388, chạy lại script đã sửa, áp lại cleanup; thêm phép kiểm mới "class brand- thiếu tiền tố" vào bộ nghiệm thu (5 điểm); đo runtime badge ERP v1.4 = #FFA726 ✓.
- **Bài học**: khi thay class hàng loạt phải kiểm cả CHIỀU DƯƠNG (class mới render ra màu thật ở runtime), không chỉ chiều âm (hết class cũ).

### Chốt sổ đợt 1 (2026-07-14)
- **②** Gom `StatusFilterPills` (commit 93daa32). **③** focus-visible toàn cục + aria-label 3 ô tìm kiếm (commit 927842e). **①** Báo cáo tổng kết `07-FINAL-REPORT.md` theo mục X của prompt.
- Đối chiếu prompt gốc: các mục còn lại đều thuộc nhóm "chị đã loại khỏi phạm vi" / "đợt 2" / "khác stack" — chi tiết trong 07-FINAL-REPORT §6.

## ĐỢT 2 (2026-07-14 chiều — sau khi khôi phục sự cố OneDrive lần 2)

> Sự cố OneDrive lần 2: máy nhà đè working tree bằng file cũ 13/07 → đã khôi phục về `7f69dc7`
> từ chính kho git (15 file, có backup .patch). Chị đã tắt đồng bộ OneDrive máy nhà.

### Phase A — Nền dark-mode chuẩn (commit `d967b18`)
- **index.css**: thêm token `dark-bg #0F1720 / dark-surface #121C26 / dark-card #18232E / dark-elevated #1E2B36` theo `03-theme/dark-mode.md`.
- **Map 287 utility** `dark:bg-slate-950/900/850/800` → token (script giữ tiền tố + opacity); màn login (luôn tối) 7 dòng bare → token. Giữ có chủ đích: toast light-mode, header bảng công việc, panel SQL, scrim modal.
- **Bắt được lỗi cũ**: 2 nút topbar bị inline style `#2563eb`/`#4f46e5` đè token (luật 7) → gỡ; thêm phép kiểm "inline style màu" vào bộ nghiệm thu (nay 5 điểm + inline).
- **Kiểm**: tsc + build sạch; đo runtime đúng 3 tầng; `dark-surface` chưa dùng (để dành topbar/bề mặt phụ).

### Phase B — Focus-trap dialog (commit `27e0285`)
- **Hook chung `src/utils/useModalA11y.ts`**: Esc đóng (tùy chọn), khóa Tab, khóa cuộn nền, trả focus khi đóng; tham số `active` cho dialog render có điều kiện.
- **Áp 4 dialog**: CdtRevisionModal, ChangePasswordModal (Esc TẮT khi bắt buộc đổi mật khẩu lần đầu), StaffEditModal, modal cảnh báo CĐT trong ProjectForm + role/aria-modal/aria-labelledby.
- **ProjectForm là màn hình trong trang** (không phải overlay) → không trap. Xác nhận xóa dùng `window.confirm` trình duyệt → tự có a11y.
- **Kiểm runtime**: 30×Tab không thoát dialog; Esc đóng + trả focus về nút "CHỈNH SỬA".

### Phase C — Mobile <768px (commit `e5dbed3` + `f7526e0` + `b8e0fbb`)
- **C1 Bottom nav**: bar 64px nav-base, tối đa 5 mục = 4 tab chính + "Thêm" (bottom sheet chứa tab còn lại theo vai trò; STAFF 2 tab hiện thẳng); badge số hồ sơ; sheet dùng useModalA11y; bỏ dải nav ngang cũ (aside `hidden md:flex`); main `pb-24 md:pb-6`.
- **C3 Dialog mobile**: 3 modal form gần toàn màn hình (h-full, rounded-none, form flex-1 cuộn); cảnh báo CĐT thành bottom sheet.
- **C2 Bảng → Card List (luật 9)**: bảng công việc + SchemaExplorer dùng **reflow CSS cùng DOM** (`block md:table-cell`, thead ẩn, chạm cả hàng mở drawer) — không nhân đôi logic; delay-log ProjectForm (7 cột) dựng Card List riêng `md:hidden`; SubtaskGantt = ngoại lệ chart → cuộn ngang khung riêng (min-w 640); bảng lỗi import Excel giữ cuộn (thao tác desktop).
- **C4 Vùng chạm (luật 10)**: nút thao tác bảng + nút sheet + nút xóa card list = `min-w/h-[44px]` (44px là giá trị luật định, chịu được cỡ chữ 85-95% người dùng chỉnh).

### Phase D — Nghiệm thu đợt 2
- **5 viewport**: 375 / 430 / 768 / 1024×1280 / 1536 — không tràn ngang trang ở mọi khổ (kể cả mở drawer + gantt con); bottom nav chỉ hiện <768; bảng đầy đủ từ md+.
- **Quét toàn cục**: 0 palette cũ · 0 hex trong class · 0 brand thiếu tiền tố · 0 inline màu.
- **tsc + build sạch** sau từng phase; console không lỗi.

## ĐỢT 3 (2026-07-14 tối — theo demo Hybrid Layout công ty + ghi chú trực tiếp của chị)

### Header & App Shell desktop
- **Sidebar tràn full chiều cao**: chuyển `<header>`/`<footer>` vào cột phải cạnh `<aside>` (script Node giữ nguyên nội dung khối, không reindent). Cụm điều khiển `ml-auto` dính sát góc phải, thẳng hàng mép nội dung (đo 1233px = 1233px).
- **Header chỉ chứa thông tin phụ** (08-navigation/header.md): bỏ chữ "HỆ THỐNG QUẢN LÝ DỰ ÁN THẦU"; thêm chip **ngày giờ thực** (Thứ X, DD-MM-YYYY • HH:MM, state `localNow` dùng chung interval đồng hồ UTC login); bỏ cụm nút cỡ chữ A−/A+ (GIỮ Ctrl+lăn chuột); bỏ nút + hàm Reset CSDL; footer bỏ dòng ngày tĩnh "Giờ giả lập".

### Header mobile <768px (chị chốt qua 3 vòng ghi chú)
- Logo trái **104px** (w-26 h-26 = đúng mép trên/dưới 2 hàng, đo 12→116 khớp từng px); hàng công tắc [gạt dark mode | + xanh lá (Dự án) | + xanh dương (Công việc) | chuông] đồng bộ **44px**; thanh user w-full thẳng mép trái với ô dark mode (132=132): avatar (ảnh `data:` hoặc initials) + tên tắt `getInitials()` + đổi mk + logout. Kỹ thuật: wrapper `md:contents` để desktop vẫn 1 hàng phẳng. Bài học: KHÔNG dùng chuỗi `h-full`/`aspect-square` cho logo (nổ layout) — dùng cỡ cố định theo thang.

### Kanban & Tiến Độ mobile
- **Kanban**: dòng lọc thời gian xuống hàng riêng full-width (`order-last sm:order-none`); cột `w-40 shrink-0` + container `flex overflow-x-auto md:grid md:grid-cols-7` → vuốt ngang xem 7 bước, chữ đọc được; desktop giữ lưới 7 cột.
- **Tab Tiến Độ**: 3 select lọc (Trạng thái/Hạng mục/Nhân sự) `w-full sm:w-auto` → mobile dài bằng nhau.

### Gỡ chức năng nguy hiểm (chị yêu cầu — cả mobile & desktop)
- Xóa nút **JSON** (xuất thô) + `handleExportJSON`; xóa nút **Phục hồi Gốc (Rollback)** + `handleRollbackRestore` (API `/api/projects/rollback` phía server GIỮ nguyên — khôi phục khẩn cấp vẫn chạy tay được).

### Kiểm tra đợt 3
- tsc + build sạch sau từng cụm; console 0 lỗi; đo runtime các mốc thẳng hàng; chụp nghiệm thu 375px + 1280px từng thay đổi; desktop xác nhận không đổi sau mỗi chỉnh mobile.

### Mâu thuẫn demo ↔ tài liệu chuẩn (chờ chị hỏi công ty)
| Demo Hybrid Layout | Tài liệu chuẩn | Mình đang theo |
|---|---|---|
| Nền dark `#1e2329`, card `#262c33` | `03-theme/dark-mode.md`: `#0F1720` / `#18232E` | Tài liệu chuẩn |
| Menu active xanh lá (bản dark) / xanh dương (bản light) | `08-navigation`: accent | Accent (xanh dương) |

## Vấn đề chưa xử lý

| Vấn đề | Mức độ | Lý do chưa xử lý | Đề xuất |
|---|---|---|---|
| Chữ <12px ở Kanban/Gantt (mật độ cao) | Thấp | Không phải nội dung "quan trọng" → luật cho phép | **Giữ nguyên** |
| Inline style động (Gantt bars, thanh %) | Thấp | Giá trị động theo dữ liệu | Giữ; hỏi chị trước nếu cần đụng |
| Thiếu Loading state | — | Luật không bắt buộc | **Không làm** (đã loại khỏi phạm vi) |
| Token `dark-surface` #121C26 chưa dùng | — | Chưa có bề mặt phụ cần phân tầng | Dùng khi tách topbar/khu vực |
| Bảng lỗi import Excel giữ cuộn ngang trên mobile | Thấp | Tính năng import Excel thao tác trên desktop | Giữ |
