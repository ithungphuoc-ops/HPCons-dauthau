# 07 — BÁO CÁO KẾT QUẢ CHUẨN HÓA GIAO DIỆN (theo mục X của prompt)

> Nhánh: `ui-hpcons` (worktree riêng, master không bị đụng) · Hoàn tất: 2026-07-14
> Phạm vi đã được chốt ngày 13/07: **chỉ chỉnh theo luật `design-system/CLAUDE.md`, không tự thêm chuẩn.**

## 1. Tổng quan

| Chỉ số | Kết quả |
|---|---:|
| Tài liệu chuẩn đã đọc | CLAUDE.md + trọng tâm 78 file HPCons Design System V1.0 |
| Tab đã chuẩn hóa | **8/8** (Dashboard, Báo Cáo Tiến Độ, Kanban, Gantt, Nhân sự, Schema, Workflow, Nhật Ký) + Login + Form + 3 Modal |
| Component đã kiểm & chỉnh | 17 file component + App.tsx (~4.300 dòng) |
| Số phép thay class màu | ~1.100 (712 phụ trợ + ~400 các tab) |
| Commit trên nhánh | 20 (mỗi phase 1 commit, có nhật ký) |

## 2. Các chuẩn đã áp dụng

- **Color**: 100% qua token — primary `#60BB46`, accent `#0969A7` (+ dải 50→950 sinh từ màu gốc), nav-base `#4B4F55`, danger `#E53935`, warning `#FFA726`, muted `#9E9E9E`. **0 hex trong class, 0 màu palette Tailwind cũ.**
- **Layout/Navigation**: sidebar nền nav-base, active = accent; **thu gọn 72px** (tablet mặc định thu, desktop mở, nhớ lựa chọn).
- **Trạng thái**: mọi badge/trạng thái đều **màu + chữ** (luật 11).
- **Accessibility**: focus-visible toàn cục (outline accent khi dùng bàn phím); nút icon có title/aria-label; ô tìm kiếm có aria-label; chữ nút sidebar thu gọn dạng sr-only.
- **Component**: gom 3 bản copy y hệt cụm lọc trạng thái → `StatusFilterPills` dùng chung (luật 8).
- **Dọn dẹp**: 8 hex cứng cuối → slate scale; 5 class chết `shadow-3xs` gỡ bỏ.

## 3. Các file chính đã thay đổi

| File | Nội dung | Ảnh hưởng |
|---|---|---|
| `src/index.css` | Token thương hiệu + dải màu, CSS sidebar thu gọn, focus-visible | Cao (nền tảng) |
| `src/App.tsx` | Shell/sidebar/8 tab/login/topbar/chuông/toast + StatusFilterPills | Cao |
| `StatsDashboard.tsx` | Donut + legend + hero cards → token | Trung bình |
| `KanbanBoard.tsx`, `GanttChart.tsx` | 7 cột bước / bars / critical-path → token | Trung bình |
| `ProjectForm.tsx` (236 chỗ) | Toàn bộ form → token | Trung bình |
| `SchemaExplorer/WorkflowViewer/TenderMindmap` | 2 tab tĩnh + mindmap → token | Thấp |
| `SubtaskGantt/Hierarchy, MyTasksPanel, StaffTaskResultPanel, FileDropZone, 3 Modal` | Token + aria-label | Thấp |

## 4. Component đã hợp nhất

| Component cũ | Component mới | Nơi sử dụng |
|---|---|---|
| 3 bản copy cụm nút "Đang làm/Đã xong/Tất cả" | `StatusFilterPills` (App.tsx) | Dashboard tổng hợp · Danh sách Dự án cha · Bảng Công việc |

*(4 empty-state na ná nhưng khác icon/cỡ/màu → giữ nguyên theo phạm vi "chỉ gom trùng lặp thật".)*

## 5. Kết quả kiểm tra

- **TypeScript** (`tsc --noEmit`): ✅ sạch (chạy sau mỗi phase)
- **Build** (`vite build + esbuild`): ✅ sạch
- **Nghiệm thu 5 điểm**: 0 class palette cũ · 0 hex trong class · 0 class chết · 0 class brand thiếu tiền tố · đo màu runtime đúng token (#FFA726, #60BB46, #0969A7, #4B4F55)
- **Responsive**: tablet 768 sidebar tự thu 72px ✓, desktop mở 256px ✓, toggle + nhớ ✓
- **Nghiệp vụ**: không đổi logic/Firestore/route/phân quyền (chỉ className + 1 component trình bày)

## 6. Các vấn đề còn lại

| Vấn đề | Mức độ | Đề xuất |
|---|---|---|
| ~~Mobile: bảng → Card List, bottom nav, dialog full-screen~~ | ✅ **Đợt 2 xong** (14/07 chiều) | Commit `e5dbed3`/`f7526e0`/`b8e0fbb` |
| ~~Focus-trap cho modal (Esc/khóa Tab trong dialog)~~ | ✅ **Đợt 2 xong** | Hook `useModalA11y` — commit `27e0285` |
| ~~Nền dark chưa theo bộ chuẩn dark-mode.md~~ | ✅ **Đợt 2 xong** | Token dark-bg/card/elevated — commit `d967b18` |
| Chữ <12px vùng mật độ cao (Kanban/Gantt) | — | Giữ theo quyết định phạm vi 13/07 |
| Loading state đồng bộ các tab | — | Ngoài phạm vi (chị đã loại) |
| Sự cố Phase 13 (script rơi tiền tố) — đã vá `2ea2d5f` | Đã xử lý | Bài học ghi trong PROGRESS |

## 7. Đợt 2 (14/07 chiều) — tóm tắt

- **Nền dark chuẩn**: 294 chỗ → `#0F1720/#18232E/#1E2B36`; gỡ 2 inline style đè token (lỗi cũ, thêm phép kiểm mới).
- **A11y dialog**: hook `useModalA11y` (Esc/trap/khóa cuộn/trả focus) cho 4 dialog; giữ chặn Esc khi bắt buộc đổi mật khẩu.
- **Mobile**: bottom nav 5 mục + sheet "Thêm"; 3 modal form full-screen + 1 bottom sheet; bảng công việc & Schema reflow Card List cùng DOM, delay-log form có card list riêng; Gantt con cuộn khung riêng; vùng chạm ≥44px.
- **Nghiệm thu**: 5 viewport không tràn ngang; quét 0 palette cũ / 0 hex / 0 thiếu tiền tố / 0 inline màu; tsc + build sạch từng phase; hành vi test thật trên preview (Tab/Esc/chạm hàng/chọn tab).
- Chi tiết từng phase: xem `UI-MIGRATION-PROGRESS.md` mục "ĐỢT 2".
