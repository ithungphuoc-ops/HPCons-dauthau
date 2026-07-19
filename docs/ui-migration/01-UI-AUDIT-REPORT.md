# 01 — BÁO CÁO AUDIT GIAO DIỆN (HPCons Design System V1.0)

> App thực tế: **Vite + React 19 + TypeScript + Tailwind CSS v4** (không Next.js, không shadcn/ui).
> Toàn bộ giao diện tập trung trong **`src/App.tsx` (4040 dòng)** + 17 component trong `src/components/`.
> Bộ chuẩn đích: `docs/design-system/` (HPCons Design System V1.0).

## 1. Tổng quan UI hiện tại

- **Kiến trúc điều hướng**: SPA, không dùng router. Điều hướng bằng state `activeTab` (8 giá trị). Header + Sidebar + toàn bộ nội dung 8 tab + màn đăng nhập + wiring modal đều nằm **inline trong `App.tsx`** → file 4040 dòng, khó bảo trì.
- **Theme**: Dark Mode qua class `.dark` trên `<html>` (đúng hướng chuẩn). Token trong `src/index.css` **tối thiểu** (chỉ 2 shade tùy chỉnh + font). Chưa có token màu brand/semantic/spacing/radius/shadow.
- **Font**: đã khai báo Inter trong `@theme` (đúng chuẩn typography).
- **Mức tuân thủ chuẩn hiện tại**: **thấp** — vi phạm 3 luật lớn nhất của CLAUDE.md công ty: (a) màu thương hiệu, (b) chữ <12px, (c) hard-code/inline-style.

## 2. Danh sách 8 tab (thực tế, không phải 5)

| Tab (`activeTab`) | Nhãn hiển thị | Vai trò xem | Nơi render | Component chính |
|---|---|---|---|---|
| `DASHBOARD` | Bảng Chỉ Số | Tất cả (3 biến thể theo role) | App.tsx inline | `StatsDashboard`, `MyTasksPanel`, `StaffTaskResultPanel` |
| `PROJECTS` | Báo Cáo Tiến Độ | BOOD/MANAGER (STAFF không) | App.tsx inline (bảng lớn) | `ProjectForm`, `SubtaskHierarchy`, `SubtaskGantt`, `CdtRevisionModal` |
| `KANBAN` | Bảng Kanban | BOOD/MANAGER | App.tsx | `KanbanBoard` |
| `GANTT` | Biểu Đồ Gantt | BOOD/MANAGER | App.tsx | `GanttChart` |
| `STAFF` | Đội Ngũ & KPI / Nhân sự | BOOD (đầy đủ), MANAGER (tạo L3) | App.tsx inline (lưới thẻ) | `StaffEditModal` |
| `SCHEMA` | CSDL SQL DDL | BOOD | App.tsx | `SchemaExplorer` |
| `WORKFLOW` | Luồng Nghiệp Vụ | BOOD | App.tsx | `WorkflowViewer`, `TenderMindmap` |
| `HISTORY` | Nhật Ký Hoạt Động | Tất cả | App.tsx inline (danh sách log) | — |

Ngoài 8 tab: **màn Đăng nhập** (login), **Header**, **Sidebar**, **chuông thông báo**, **toast**, các **modal** (đổi mật khẩu, CĐT điều chỉnh, sửa nhân sự) — đều nằm trong `App.tsx`.

## 3. Vấn đề theo nhóm

### 3.1 Màu sắc — RỦI RO CAO
- **Chưa dùng màu thương hiệu HPCons** (`brand-primary #60BB46` xanh lá). Màu "primary" thực tế đang là **`blue`** (414 lượt) → **sai nhận diện thương hiệu**.
- Bảng màu Tailwind tản mát: `slate` 1987, `blue` 414, `emerald` 273, `rose` 258, `amber` 249, `indigo` 136, thêm `violet/cyan/teal/purple/red/orange`. Trạng thái & điểm nhấn dùng lẫn lộn (VD Kanban mỗi cột 1 màu khác nhau: indigo/violet/amber/blue...).
- Màn đăng nhập hard-code hex: `bg-[#121214]`, `bg-[#0e0e10]`, `bg-[#131316]`.
- → Cần: token brand/semantic; ánh xạ trạng thái → màu HPCons (`brand-primary` = hoàn thành/đã duyệt, `warning` = chờ duyệt, `danger` = trễ/rớt, `brand-accent` = link/thông tin).

### 3.2 Typography — RỦI RO CAO
- **391 lượt chữ < 12px** (184× `text-[10px]`, 102× `text-[9px]`, 66× `text-[11px]`, 19× `text-[8px]`, 2× `text-[7px]`) → **vi phạm trực tiếp luật "không chữ <12px cho nội dung quan trọng"**.
- Font Inter đã đạt chuẩn. Thiếu thang H1/H2/H3/Body/Caption nhất quán — tiêu đề dùng `text-xs/text-sm` tùy chỗ.
- → Cần: nâng nền chữ (body 14px, caption 12px). Riêng Kanban/Gantt (mật độ cao) xin duyệt tối thiểu 12px.

### 3.3 Spacing — RỦI RO TRUNG BÌNH
- Nhiều đệm/khoảng cách nhỏ tùy ý (`p-1.5`, `gap-0.5`, `py-0.2`...) không theo thang 8px. Lề nội dung, đệm thẻ chưa thống nhất giữa các tab.
- → Cần: chuẩn hóa lề ngoài 24px (PC), đệm thẻ 16px, khoảng cách khu vực 24px.

### 3.4 Layout — RỦI RO CAO
- **Không có App Shell / PageHeader / PageContainer dùng chung**. Header & Sidebar viết cứng 1 lần trong App.tsx (chấp nhận được vì SPA 1 file), nhưng **mỗi tab tự dựng khung tiêu đề + toolbar riêng** → không nhất quán.
- Không có `src/components/ui/` (UI primitive) và `src/components/shared/` (shared component). Mọi Button/Input/Card/Badge/Table đều viết tay lặp lại.

### 3.5 Responsive — RỦI RO TRUNG BÌNH
- Có `md:`/`lg:` rải rác nhưng **thiết kế xoay quanh desktop**. Bảng "Báo Cáo Tiến Độ" nhiều cột chưa có chiến lược ẩn cột/scroll ngang chuẩn trên tablet.
- Mobile chưa có Card List thay bảng (đúng plan: mobile để đợt 2).

### 3.6 Accessibility — RỦI RO TRUNG BÌNH
- Nhiều nút icon thiếu `aria-label`; một số vùng click là `div` có `onClick` (VD thẻ dự án, hàng danh sách) thay vì `button`.
- Trạng thái thể hiện chủ yếu bằng màu — một số nơi có kèm chữ (đạt), một số chỉ màu (chưa đạt luật "trạng thái phải có cả màu và chữ").
- Chữ <12px cũng là vấn đề tương phản/đọc được.

### 3.7 Component duplication — RỦI RO CAO
- Button/Badge/Input/Card/EmptyState... viết lặp trong nhiều file với class khác nhau → **không có nguồn chuẩn duy nhất**.
- Bộ lọc trạng thái "Đang làm/Đã xong/Tất cả" xuất hiện ở ≥3 nơi (MyTasksPanel, panel dự án, tổng hợp) với JSX gần giống → nên tách `SegmentedFilter`.

## 4. Mức độ rủi ro tổng thể

| Hạng mục | Rủi ro refactor | Ghi chú |
|---|---|---|
| Token màu/chữ (Foundation) | Thấp | Chỉ thêm token, chưa đổi component |
| App Shell (Header/Sidebar) | Trung bình | Nằm trong App.tsx, đổi cần cẩn thận trạng thái active/phân quyền |
| UI primitives mới | Thấp | Thêm mới, chưa thay chỗ dùng |
| Tab HISTORY/SCHEMA/WORKFLOW | Thấp | Tĩnh, ít nghiệp vụ |
| Tab STAFF/KANBAN/GANTT | Trung bình | Có tương tác (kéo thả, KPI) — **giữ nguyên logic** |
| Tab PROJECTS/DASHBOARD | **Cao** | Bảng lớn + form + modal + phân quyền phức tạp nhất → làm cuối |

## 5. Đề xuất thứ tự migration

Theo `06-UI-MIGRATION-PLAN.md`: Foundation → App Shell → UI primitives → Shared components → HISTORY → SCHEMA/WORKFLOW → STAFF → KANBAN → GANTT → PROJECTS → DASHBOARD → Login/phụ trợ → Responsive tablet → Cleanup.

**Nguyên tắc bất biến**: không đổi nghiệp vụ, Firestore, phân quyền, route/điều hướng, hành vi kéo-thả (Kanban, FileDropZone), logic tiến độ/KPI. Chỉ đụng lớp trình bày.
