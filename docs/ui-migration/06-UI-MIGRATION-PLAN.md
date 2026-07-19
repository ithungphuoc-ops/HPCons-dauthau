# 06 — KẾ HOẠCH MIGRATION GIAO DIỆN (HPCons Design System V1.0)

> App thực tế: **Vite + React 19 + TypeScript + Tailwind CSS v4** (không shadcn/ui, không Next.js).
> Bộ chuẩn nguồn: `docs/design-system/` (HPCons Design System V1.0).
> Nguyên tắc tối thượng: **KHÔNG đổi nghiệp vụ, dữ liệu, Firestore schema, route, phân quyền.**
> Mỗi phase xong: chạy `npx tsc --noEmit` + `npm run build`, mở preview cho chị duyệt rồi mới sang phase kế.

## Điều chỉnh so với prompt gốc

| Prompt gốc giả định | Thực tế app | Cách xử lý |
|---|---|---|
| Next.js 15 + App Router | Vite SPA, điều hướng bằng state `activeTab` | Bỏ qua các phần App Router; giữ điều hướng hiện tại |
| shadcn/ui + components.json | Component tự viết | Tự dựng UI primitives theo spec HPCons, không cài shadcn |
| 5 tab | 8 tab (DASHBOARD, PROJECTS, KANBAN, GANTT, STAFF, SCHEMA, WORKFLOW, HISTORY) | Migration map theo 8 tab thực tế |
| tailwind.config.ts | Tailwind v4 — config qua `@theme` trong `src/index.css` | Token HPCons đưa vào `@theme` |
| TanStack Table / RHF / Zod | Bảng + form tự viết | KHÔNG cài thêm thư viện (đúng luật "không cài library không cần thiết") |

## Các phase

| # | Phase | Nội dung chính | Điều kiện xong |
|---|---|---|---|
| 1 | **Audit** (đang làm) | 6 báo cáo trong `docs/ui-migration/` | Chị duyệt báo cáo |
| 2 | **Foundation & Token** | Đưa token `--hp-*` vào `@theme` src/index.css: màu brand/semantic/nền dark, font, radius, breakpoint. Chưa đổi component nào. | tsc + build sạch; giao diện chưa đổi |
| 3 | **App Shell** | Sidebar (`nav-base #4B4F55`, mở 260px/thu 72px), Topbar 60px, page container lề 24px, footer — trong App.tsx | Preview duyệt |
| 4 | **UI Primitives** | Dựng `src/components/ui/`: Button (5 variants HPCons, cao 40-44px), Badge (màu+chữ), Card (radius 12, viền thay bóng), Input/Select/Textarea (nhãn ngoài ô), EmptyState/LoadingState/ErrorState | tsc + build sạch |
| 5 | **Shared components** | PageHeader, SectionHeader, FilterBar, StatusBadge (map trangThai/tinhTrangDuAn → màu HPCons), ConfirmDialog | Preview duyệt |
| 6 | **Tab HISTORY** (dễ nhất) | Nhật Ký Hoạt Động | Preview duyệt từng tab |
| 7 | **Tab SCHEMA + WORKFLOW** | 2 tab tĩnh chỉ BOOD | ↑ |
| 8 | **Tab STAFF** | Đội Ngũ & KPI | ↑ |
| 9 | **Tab KANBAN** | Bảng Kanban 7 bước | ↑ |
| 10 | **Tab GANTT** | Biểu đồ Gantt | ↑ |
| 11 | **Tab PROJECTS** | Báo Cáo Tiến Độ (bảng chính + form + modal) — phức tạp nhất cùng DASHBOARD | ↑ |
| 12 | **Tab DASHBOARD** | Bảng Chỉ Số (3 biến thể theo role) | ↑ |
| 13 | **Login + phụ trợ** | Màn đăng nhập, bell dropdown, toast, modal đổi mật khẩu | ↑ |
| 14 | **Responsive tablet** | Breakpoint 768/1280, sidebar thu gọn | Đợt đầu: desktop + tablet |
| 15 | **Cleanup + Validation** | Xóa class chết (shadow-2xs/3xs...), quét lại hard-code còn sót, chạy full checklist `20-quality/ui-checklist.md` | Báo cáo tổng kết |

> **Mobile (Card List + bottom navigation)**: để đợt 2, ngoài phạm vi đợt này (đã thống nhất hướng với chị — chờ xác nhận cuối).

## 3 quyết định chờ chị chốt

1. **Màu chủ đạo**: chuyển primary từ xanh dương → **xanh lá `#60BB46`**; xanh dương `#0969A7` chỉ còn là màu nhấn/link/thông tin. *(Khuyến nghị: theo chuẩn — CLAUDE.md công ty cấm tự đổi màu thương hiệu.)*
2. **Cỡ chữ**: nâng nền chữ lên chuẩn (body 14px, bảng 14px, caption 12px, không dưới 12px cho nội dung quan trọng). App hiện dùng 9–11px dày đặc → giao diện sẽ thoáng/to hơn. *(Khuyến nghị: theo chuẩn, riêng Kanban/Gantt mật độ cao xin chị duyệt mức 12px tối thiểu.)*
3. **Phạm vi đợt đầu**: desktop + tablet; mobile đợt sau. *(Khuyến nghị: đồng ý.)*

## Quy tắc an toàn xuyên suốt

- Làm trên nhánh `ui-hpcons` (worktree `App-UI-HPCons`) — master không bị đụng.
- Mỗi phase 1 commit riêng, message rõ ràng.
- Không sửa: server.ts, lib/firebase.ts, utils/taskTree.ts, data/*, types.ts (trừ khi lỗi import do refactor — sửa tối thiểu và ghi vào PROGRESS).
- Export báo cáo HTML (Excel/chiến lược) trong App.tsx có CSS nội tuyến riêng phục vụ in ấn — **ngoài phạm vi UI app**, giữ nguyên.
