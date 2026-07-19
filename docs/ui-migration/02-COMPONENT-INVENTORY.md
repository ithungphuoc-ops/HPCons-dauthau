# 02 — KIỂM KÊ COMPONENT (Component Inventory)

> Phân loại: **UI primitive** (nút/ô/thẻ cơ bản) · **shared** (dùng chung nhiều tab) · **layout** · **feature** (gắn nghiệp vụ 1 tab) · **page-specific** (khối inline trong App.tsx).
> Trạng thái hiện tại: **KHÔNG có** `src/components/ui/` và `src/components/shared/`. Mọi primitive đang viết cứng rải rác.

## A. Component đang tồn tại (file thực)

| Component | File | Loại | Dùng tại | Trùng lặp | Đề xuất |
|---|---|---|---|---|---|
| `App` (root) | src/App.tsx (4040d) | layout + page-specific | Toàn app | — | Tách Header/Sidebar/từng-tab-body ra dần; giữ điều hướng |
| `StatsDashboard` | StatsDashboard.tsx (659) | feature | DASHBOARD | — | Chuẩn hóa Card/StatTile/Badge theo token |
| `ProjectForm` | ProjectForm.tsx (1421) | feature | PROJECTS | Input/Select/Textarea nội bộ lặp | Dùng FormField/Input/Select chuẩn |
| `SubtaskHierarchy` | SubtaskHierarchy.tsx (924) | feature | PROJECTS | — | Chuẩn hóa Button/Badge/Table |
| `SubtaskGantt` | SubtaskGantt.tsx (274) | feature | PROJECTS | — | Giữ logic ngày/gantt; token hóa màu bar |
| `GanttChart` | GanttChart.tsx (470) | feature | GANTT | inline style (10) hợp lệ (bar động) | Token hóa màu; giữ style động |
| `KanbanBoard` | KanbanBoard.tsx (314) | feature | KANBAN | mỗi cột 1 màu tùy ý | Ánh xạ 7 bước → token trạng thái |
| `StaffEditModal` | StaffEditModal.tsx (427) | feature (modal) | STAFF | Input/Select lặp | Dùng Dialog/FormField chuẩn |
| `StaffTaskResultPanel` | StaffTaskResultPanel.tsx (157) | feature | DASHBOARD (staff) | Textarea/Button lặp | Dùng primitive chuẩn |
| `MyTasksPanel` | MyTasksPanel.tsx (286) | feature | DASHBOARD | bộ lọc segmented lặp | Tách `SegmentedFilter` shared |
| `TenderMindmap` | TenderMindmap.tsx (304) | feature | WORKFLOW | — | Token hóa |
| `WorkflowViewer` | WorkflowViewer.tsx (166) | feature | WORKFLOW | — | Token hóa |
| `SchemaExplorer` | SchemaExplorer.tsx (227) | feature | SCHEMA | — | Token hóa |
| `CdtRevisionModal` | CdtRevisionModal.tsx (135) | feature (modal) | PROJECTS | Dialog lặp | Dùng ConfirmDialog/Dialog chuẩn |
| `ChangePasswordModal` | ChangePasswordModal.tsx (192) | feature (modal) | Toàn app | Dialog + upload ảnh lặp | Dùng Dialog + FileDropZone |
| `DateInput` | DateInput.tsx (66) | **UI primitive** ✅ | Nhiều nơi | — | Giữ; đưa vào `ui/` |
| `FileDropZone` | FileDropZone.tsx (86) | **UI primitive** ✅ | Đính kèm tệp | — | Giữ; đưa vào `ui/` (kéo-thả — KHÔNG đổi hành vi) |
| `HpConsLogo` | HpConsLogo.tsx (53) | layout | Header/Sidebar/Login | — | Giữ |

## B. Component CẦN TẠO (chưa có — hiện viết cứng inline)

### UI primitives → `src/components/ui/`
| Component | Thay cho | Ưu tiên |
|---|---|---|
| `Button` (5 variant: primary/accent/outline/ghost/danger) | ~100+ `<button className="bg-blue-600...">` rải rác | Cao |
| `Badge` / `StatusBadge` | span trạng thái nhiều màu tùy ý | Cao |
| `Card` | `<div className="bg-white dark:bg-slate-900 rounded-xl border...">` lặp khắp nơi | Cao |
| `Input` / `Select` / `Textarea` (nhãn ngoài ô) | ô nhập trong ProjectForm/StaffEditModal | Cao |
| `Dialog` / `ConfirmDialog` | modal viết tay (fixed inset-0 backdrop) | Trung bình |
| `EmptyState` / `LoadingState` / `ErrorState` | "Không có dữ liệu..." rải rác | Trung bình |
| `SegmentedFilter` | bộ lọc Đang làm/Đã xong/Tất cả (≥3 nơi) | Trung bình |

### Shared / layout → `src/components/shared/`
| Component | Thay cho | Ưu tiên |
|---|---|---|
| `PageHeader` (title + subtitle + actions) | mỗi tab tự dựng tiêu đề | Cao |
| `SectionHeader` | tiêu đề khối trong tab | Trung bình |
| `FilterBar` / `SearchBox` | thanh lọc + tìm kiếm ở PROJECTS/STAFF/DASHBOARD | Trung bình |
| `AppShell` (Header + Sidebar + Container) | khối inline đầu App.tsx | Cao (làm ở Phase 3) |

## C. Ghi chú an toàn
- `DateInput`, `FileDropZone`, `HpConsLogo` đã là primitive tốt — **giữ nguyên hành vi**, chỉ dời thư mục + token hóa màu nếu cần.
- `FileDropZone` chứa **kéo-thả** (drag & drop) — theo luật cấm đổi hành vi kéo-thả đang tồn tại → chỉ đổi lớp trình bày.
- Các file `firebase.ts`, `taskTree.ts`, `dateVN.ts`, `attachments.ts`, `types.ts`, `data/*`, `server.ts` = **nghiệp vụ/dữ liệu → KHÔNG đụng**.
