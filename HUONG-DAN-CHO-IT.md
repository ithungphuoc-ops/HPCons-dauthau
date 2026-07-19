# HƯỚNG DẪN TRIỂN KHAI — HP-CONS ERP (App Báo cáo Tiến độ Phòng Đấu Thầu)

> Bàn giao bởi: Ngô Trâm (ngotram@hpcons.com.vn) · Cập nhật: 18-07-2026

## 1. Tổng quan kỹ thuật
- **Frontend**: React + TypeScript + Vite + Tailwind CSS (giao diện theo HPCons Design System, tài liệu trong `docs/design-system/`).
- **Backend**: Node.js (file `server.ts`, build ra `dist/server.cjs`) — phục vụ web tĩnh + API import Excel.
- **Dữ liệu & đăng nhập**: Firebase Authentication (đăng nhập) + Firestore (đồng bộ realtime giữa các máy). Cấu hình tại `src/lib/firebase.ts`.
- Server còn ghi file dữ liệu runtime `src/data/db.json`, `src/data/staff.json` (không nằm trong mã nguồn — tự sinh khi chạy).

## 2. Yêu cầu môi trường
- **Node.js LTS ≥ 20** (đang phát triển trên v24.18.0) + npm.
- Máy chủ mở được cổng tùy chọn (mặc định **3000**, đổi bằng biến môi trường `PORT`).
- Kết nối Internet tới Firebase (dự án Firebase hiện dùng của phòng Đấu Thầu).

## 3. Chạy thử (development)
```bash
npm install
npm run dev        # → http://localhost:3000
```

## 4. Triển khai production
```bash
npm install
npm run build      # build frontend (dist/) + backend (dist/server.cjs)
set PORT=8080      # (tùy chọn — Linux: export PORT=8080)
npm start          # chạy node dist/server.cjs, lắng nghe 0.0.0.0:PORT
```
Đưa lên app tổng: reverse-proxy (IIS/Nginx) trỏ về cổng trên, hoặc chạy như một service (pm2 / NSSM / Windows Service).

## 5. Kiểm tra chất lượng
```bash
npm run lint       # = tsc --noEmit (kiểm tra TypeScript)
npm run build      # build phải sạch, không lỗi
```

## 6. Bản desktop (tùy chọn, không bắt buộc)
```bash
npm run build:exe  # electron-builder → file .exe portable cho Windows
```

## 7. Mã nguồn chuẩn (khuyến nghị)
- Repo GitHub: `ksngotram14-collab/App-bao-cao-tien-do-du-an` — nhánh `master`.
- **Khuyến nghị IT nhận quyền truy cập repo** (chị Trâm mời qua GitHub → Settings → Collaborators) thay vì nhận file nén, để về sau kéo bản cập nhật bằng `git pull` thay vì gửi zip lại từ đầu.

## 8. Lưu ý bảo mật
- Tài khoản đăng nhập do Trưởng phòng cấp trong app (tab Đội Ngũ & KPI); mật khẩu mã hóa qua Firebase Auth.
- Không commit file `.env*` và `src/data/*.json` (đã có trong `.gitignore`).
- Ứng dụng không hiển thị giá trị tiền trong UI/export (quy định bảo mật nội bộ).
