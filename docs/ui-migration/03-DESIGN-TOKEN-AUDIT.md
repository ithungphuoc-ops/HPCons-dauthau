# 03 — AUDIT DESIGN TOKEN

> Số liệu quét tự động trên `src/**/*.tsx` (Tailwind v4, arbitrary values `-[...]`).
> Tổng giá trị hard-code arbitrary: **467 lượt**, trong đó **391 lượt chữ < 12px**.

## 1. Chữ (font-size) — vi phạm nặng nhất

| Giá trị hiện tại | Số lần | Token/Class đích | Hành động |
|---|---:|---|---|
| `text-[10px]` | 184 | `text-xs` (12px) hoặc `text-caption` | Nâng lên ≥12px; Kanban/Gantt tối thiểu 12px |
| `text-[9px]` | 102 | `text-caption` (12px) | Nâng lên 12px |
| `text-[11px]` | 66 | `text-xs`/`text-caption` | Nâng lên 12px |
| `text-[8px]` | 19 | `text-caption` | Nâng lên 12px (nhãn/badge) |
| `text-[7px]` | 2 | `text-caption` | Nâng lên 12px |
| `text-[0.72rem]`, `text-[0.66rem]`, `text-[0.62rem]`, `text-[0.58rem]`, `text-[0.78rem]` | ~15 | thang chữ chuẩn | Về `text-xs/text-sm` |
| `text-[9.5px]`, `text-[10.5px]`, `text-[13px]` | 3 | thang chữ chuẩn | Về `text-xs/text-sm/text-base` |

**Kết luận**: đây là hạng mục vi phạm CLAUDE.md công ty rõ nhất — cần quyết định "nâng nền chữ" (đã được chị duyệt).

## 2. Màu (hard-code hex)

| Giá trị | Số lần | File | Token đích | Hành động |
|---|---:|---|---|---|
| `bg-[#121214]` | 5 | App.tsx (login) | `--hp-surface-2` (nền tối) | Token hóa |
| `bg-[#0e0e10]` | 5 | App.tsx (login) | `--hp-surface-1` | Token hóa |
| `bg-[#131316]` | 2 | App.tsx (login) | `--hp-surface-3` | Token hóa |
| `#2563eb`, `#4f46e5` (style inline nút) | vài | App.tsx | `brand-accent`/token | Bỏ inline, dùng class token |

## 3. Bảng màu Tailwind (không hard-code hex nhưng KHÔNG phải brand token)

| Họ màu | Số lần | Vai trò đang bị dùng | Token HPCons đích |
|---|---:|---|---|
| `slate` | 1987 | nền/chữ/viền/muted | `background/foreground/border/muted` (nền dark HPCons) |
| `blue` | 414 | **primary de-facto** | → phần lớn về `brand-primary #60BB46`; link/thông tin về `brand-accent #0969A7` |
| `emerald` | 273 | hoàn thành/đúng hạn | `brand-primary #60BB46` |
| `rose` | 258 | lỗi/trễ/rớt/xóa | `danger #E53935` |
| `amber` | 249 | chờ duyệt/cảnh báo/dời hạn | `warning #FFA726` |
| `indigo` | 136 | điểm nhấn phụ | `brand-accent` hoặc bỏ bớt |
| `violet/cyan/teal/purple/red/orange` | ~24 | Kanban/badge tùy hứng | Gom về thang trạng thái chuẩn |

## 4. Kích thước tùy ý (width/height/min/max)

| Nhóm | Ví dụ | Số lần | Hành động |
|---|---|---:|---|
| Width % / vw | `w-[60%]`, `w-[80%]`, `w-[32%]`, `w-[24%]`, `w-[15%]`, `w-[1%]` | ~8 | Giữ nếu là bố cục động; còn lại về `w-*` chuẩn |
| Height cố định/vh | `h-[80vh]`, `h-[60%]`, `h-[450px]` | ~6 | Giữ (vùng cuộn modal/panel) — chấp nhận |
| Min/Max width | `min-w-[210px]`, `min-w-[200px]`, `max-w-[150px]` | ~5 | Chuẩn hóa hoặc giữ có chủ đích |
| Offset ambient (login) | `top-[-20%]`, `right-[-10%]` | 2 | Giữ (hiệu ứng nền login) |

## 5. Inline style (`style={{...}}`)

| File | Số lần | Bản chất | Hành động |
|---|---:|---|---|
| GanttChart.tsx | 10 | `width/left` bar động theo dữ liệu | **GIỮ** (không thể thay bằng class tĩnh) |
| App.tsx | 6 | vài width động + 2 nút màu inline | Bỏ 2 nút màu inline → class token; giữ phần động |
| SubtaskHierarchy/StatsDashboard/ProjectForm/... | ~10 | width thanh tiến độ/gantt động | **GIỮ** (động theo %) |

**Quy tắc**: inline style **chỉ chấp nhận cho giá trị động theo dữ liệu** (thanh %, bar gantt). Màu/kích thước tĩnh phải về token/class.

## 6. Token cần bổ sung vào `@theme` (src/index.css) — Phase 2

```
--color-hp-primary: #60BB46;        /* brand-primary */
--color-hp-accent:  #0969A7;        /* brand-accent  */
--color-hp-nav:     #4B4F55;        /* nav-base      */
--color-hp-danger:  #E53935;
--color-hp-warning: #FFA726;
--color-hp-muted:   #9E9E9E;
/* + thang nền dark surfaces, foreground, border theo docs 03-theme */
```
(Chi tiết token nền/dark-mode lấy từ `docs/design-system/03-theme/` ở Phase 2.)
