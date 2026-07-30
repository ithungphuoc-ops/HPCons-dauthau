# 05 — BẢN ĐỒ MIGRATION GIAO DIỆN

> Ánh xạ từ UI hiện tại → chuẩn HPCons + component đích + rủi ro + phase.
> Rủi ro: 🟢 thấp · 🟡 trung bình · 🔴 cao.

## 1. Foundation & Token

| UI hiện tại | File | Chuẩn đích | Component/Token đích | Rủi ro | Phase |
|---|---|---|---|---|---|
| `@theme` tối thiểu (2 shade) | src/index.css | Token brand/semantic/surface | `--color-hp-*` + thang chữ/spacing | 🟢 | 2 |
| Hex login `#121214`... | App.tsx | Surface token | `--hp-surface-*` | 🟢 | 2 |
| 391 chữ <12px | toàn src | Thang chữ ≥12px | `text-caption/xs/sm/base` | 🟡 (nhiều chỗ) | 2→6 |

## 2. Layout / App Shell

| UI hiện tại | File | Chuẩn đích | Component đích | Rủi ro | Phase |
|---|---|---|---|---|---|
| Header inline | App.tsx (~1774+) | Topbar 60px, token nav | `AppShell/Topbar` | 🟡 | 3 |
| Sidebar inline | App.tsx (~1958+) | Sidebar 260/72px, `nav-base #4B4F55` | `AppShell/Sidebar` | 🟡 giữ active + phân quyền tab | 3 |
| Mỗi tab tự dựng tiêu đề | toàn App.tsx | PageHeader chung | `PageHeader/PageContainer` | 🟡 | 3→6 |

## 3. UI Primitives

| UI hiện tại | Nơi | Component đích | Rủi ro | Phase |
|---|---|---|---|---|
| `<button className="bg-blue/indigo...">` (~100+) | khắp nơi | `ui/Button` (primary/accent/outline/ghost/danger) | 🟢 | 4 |
| span badge nhiều màu | khắp nơi | `ui/Badge` + `StatusBadge` | 🟢 | 4 |
| `<div bg-white rounded-xl border>` | khắp nơi | `ui/Card` | 🟢 | 4 |
| ô input/select/textarea | ProjectForm/StaffEditModal | `ui/Input,Select,Textarea` (nhãn ngoài) | 🟡 (form nghiệp vụ) | 4 |
| modal `fixed inset-0` | các modal | `ui/Dialog,ConfirmDialog` | 🟡 | 4 |
| "Không có..." rải rác | nhiều | `ui/EmptyState,LoadingState,ErrorState` | 🟢 | 4 |
| `DateInput`, `FileDropZone` | có sẵn | dời vào `ui/`, giữ hành vi (kéo-thả) | 🟢 | 4 |

## 4. Shared components

| UI hiện tại | Nơi | Component đích | Rủi ro | Phase |
|---|---|---|---|---|
| Bộ lọc segmented lặp | MyTasksPanel/Dashboard/PROJECTS | `shared/SegmentedFilter` | 🟢 | 5 |
| Thanh tìm + lọc | PROJECTS/STAFF/DASHBOARD | `shared/FilterBar,SearchBox` | 🟡 | 5 |
| map trạng thái→màu (lặp) | Kanban/Dashboard/PROJECTS | `shared/StatusBadge` (1 nguồn) | 🟡 giữ đúng nhãn | 5 |

## 5. Theo từng tab (giữ 100% nghiệp vụ)

| Tab | File chính | Việc UI | Rủi ro | Phase |
|---|---|---|---|---|
| HISTORY | App.tsx (khối log) | Card/Badge/PageHeader, chữ ≥12 | 🟢 | 6 |
| SCHEMA | SchemaExplorer.tsx | token hóa bảng schema | 🟢 | 7 |
| WORKFLOW | WorkflowViewer + TenderMindmap | token hóa | 🟢 | 7 |
| STAFF | App.tsx (lưới) + StaffEditModal | Card thẻ nhân sự + Dialog form | 🟡 giữ phân quyền L1/L2 | 8 |
| KANBAN | KanbanBoard.tsx | 7 cột → StatusBadge token; **giữ kéo-thả** | 🟡 | 9 |
| GANTT | GanttChart.tsx | token màu bar; **giữ style động** | 🟡 | 10 |
| PROJECTS | App.tsx (bảng) + ProjectForm + SubtaskHierarchy/Gantt + CdtRevisionModal | Table/Form/Dialog chuẩn; **giữ mọi logic tiến độ/duyệt/phân quyền** | 🔴 | 11 |
| DASHBOARD | App.tsx + StatsDashboard + MyTasksPanel + StaffTaskResultPanel | Card/StatTile/SegmentedFilter; 3 biến thể role | 🔴 | 12 |

## 6. Phụ trợ + hoàn thiện

| UI | Component đích | Rủi ro | Phase |
|---|---|---|---|
| Màn Đăng nhập | token hóa hex, Button/Input chuẩn | 🟡 (giữ luồng Firebase Auth) | 13 |
| Chuông thông báo / toast / modal đổi mật khẩu | Dialog/Toast chuẩn | 🟡 | 13 |
| Responsive tablet (768/1280) | sidebar thu, bảng ẩn cột | 🟡 | 14 |
| Cleanup (class chết, hard-code sót) + checklist | `20-quality/ui-checklist.md` | 🟢 | 15 |

## 7. Vùng CẤM đụng (nghiệp vụ/dữ liệu)
`server.ts` · `src/lib/firebase.ts` · `src/utils/{taskTree,dateVN,attachments}.ts` · `src/types.ts` · `src/data/*` · logic tiến độ/KPI/duyệt/phân quyền · hành vi kéo-thả (KanbanBoard, FileDropZone) · route/điều hướng `activeTab`.
