# 04 — BÁO CÁO KHÔNG NHẤT QUÁN GIỮA CÁC TAB

> So sánh 8 tab thực tế. Ký hiệu: ✅ có/đạt · ⚠️ có nhưng lệch chuẩn · ❌ thiếu.

## 1. Bảng so sánh tổng hợp

| Tiêu chí | DASHBOARD | PROJECTS | KANBAN | GANTT | STAFF | SCHEMA | WORKFLOW | HISTORY | Chuẩn đích |
|---|---|---|---|---|---|---|---|---|---|
| **PageHeader** (title+subtitle) | ⚠️ tự dựng | ⚠️ tự dựng | ⚠️ trong KanbanBoard | ⚠️ trong GanttChart | ⚠️ tự dựng | ⚠️ | ⚠️ | ⚠️ | `PageHeader` dùng chung |
| **Toolbar/Filter** | ⚠️ segmented tự viết | ⚠️ nhiều filter rời | ⚠️ lọc ngày riêng | ❌ | ⚠️ | ❌ | ❌ | ⚠️ | `FilterBar` chung |
| **SearchBox** | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | `SearchBox` chung |
| **Button** | bg-blue/indigo tùy | nhiều màu | mũi tên/nút nhỏ | — | bg-blue | — | — | — | `Button` variant |
| **Card** | ⚠️ nhiều kiểu | ⚠️ | thẻ Kanban riêng | — | thẻ nhân sự riêng | panel riêng | panel riêng | dòng log riêng | `Card` chung |
| **Badge/Status** | emerald/blue/rose | badge trạng thái | 7 màu cột | — | Level badge | — | — | action badge | `StatusBadge` map token |
| **Table** | — | ⚠️ bảng lớn tự viết | — | lưới gantt | lưới thẻ | bảng schema | — | danh sách | thống nhất kiểu bảng |
| **Dialog/Modal** | ChangePwd | CdtRevision/Form | — | — | StaffEdit | — | — | — | `Dialog` chung |
| **Spacing** | p-5/p-4 lẫn | p-5/p-3 lẫn | p-1.5 dày | — | p-5 | — | — | p-3 | thang 8px (đệm thẻ 16) |
| **Chữ** | 9–11px nhiều | 9–11px nhiều | 7–10px rất dày | 8–10px | 9–11px | 11px | 10px | 9–11px | ≥12px (Kanban/Gantt ≥12) |
| **Empty state** | ✅ có icon+chữ | ⚠️ | ⚠️ "— Trống —" | — | — | — | — | ✅ | `EmptyState` chung |
| **Loading state** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | `LoadingState` chung |
| **Error state** | ❌ | ⚠️ toast | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | `ErrorState` chung |
| **Responsive** | ⚠️ grid md/lg | ⚠️ bảng nhiều cột | ⚠️ 7 cột ép ngang | ⚠️ | ⚠️ grid thẻ | ⚠️ | ⚠️ | ✅ | tablet chuẩn |

## 2. Bất nhất nổi bật (ưu tiên xử lý)

1. **Màu "primary" không thống nhất**: DASHBOARD/STAFF dùng `blue-600`, nút "CÔNG VIỆC MỚI" dùng `indigo-600`, hoàn thành dùng `emerald`. → Không có 1 primary. **Chuẩn: `brand-primary #60BB46`** cho hành động chính & hoàn thành/đã duyệt.

2. **Trạng thái hồ sơ**: cùng ý nghĩa nhưng màu khác nhau giữa Kanban (cột) ↔ Dashboard (badge) ↔ bảng PROJECTS. → Cần **1 hàm map `trangThai`/`tinhTrangDuAn` → StatusBadge token** dùng chung mọi nơi.

3. **Bộ lọc "Đang làm / Đã xong / Tất cả"**: lặp JSX ở MyTasksPanel, panel Dự án, khu Tổng hợp (Dashboard). → Tách `SegmentedFilter`.

4. **Tiêu đề tab**: mỗi tab một kiểu (icon + text uppercase tracking khác nhau, cỡ khác nhau). → `PageHeader`/`SectionHeader`.

5. **Mật độ chữ**: Kanban/Gantt siêu dày (7–10px) vs SCHEMA/WORKFLOW thoáng hơn. → Nâng nền chữ + thống nhất caption 12px.

6. **Không có Loading state ở bất kỳ tab nào** — dữ liệu Firestore realtime nên hiện tại "nhảy" thẳng; nên có skeleton/spinner khi chờ auth/snapshot đầu.

## 3. Điểm ĐÃ nhất quán (giữ nguyên)
- Dark mode class `.dark` — nhất quán toàn app.
- Font Inter — nhất quán.
- Quy ước "không thanh cuộn ngang" — đã áp ở vài nơi (`overflow-x-hidden`), cần phủ hết.
- Icon Lucide — nhất quán (giữ; chỉ tránh dùng emoji làm icon chức năng chính theo luật).
