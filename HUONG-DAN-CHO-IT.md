# HƯỚNG DẪN TRIỂN KHAI — HP-CONS ERP (App Báo cáo Tiến độ Phòng Đấu Thầu)

> Bàn giao bởi: Ngô Trâm (ngotram@hpcons.com.vn) · Cập nhật: 30-07-2026

## 1. Tổng quan kỹ thuật

- **Framework**: Next.js 15 (App Router) + React 19 + TypeScript + Tailwind CSS v4 (giao diện theo
  HPCons Design System, tài liệu trong `docs/design-system/`).
- **API**: route handler của Next.js trong `app/api/` (chạy dạng serverless trên Vercel, hoặc
  cùng tiến trình Node khi tự host) — cầu nối SSO với App Tổng (`app/api/auth/hpcore-session`),
  lọc/nhập dự án (`app/api/projects/*`), tra vai trò (`app/api/roles`).
- **Dữ liệu & đăng nhập**: người dùng đăng nhập qua App Tổng (account.hpcore.vn) — app đọc cookie
  phiên `session` của hpcore.vn, xác minh rồi cấp Custom Token cho Firebase Auth của project
  RIÊNG (`hpcons-dauthau`). Dữ liệu nghiệp vụ (dự án, nhân sự, thông báo) lưu & đồng bộ realtime
  qua Firestore của project đó. Không còn `server.ts`/`dist/server.cjs`/file JSON runtime như bản
  Vite cũ — toàn bộ đã chuyển sang Next.js + Firestore.
- **Bắt buộc chạy trên subdomain của hpcore.vn** (production: `dauthau.hpcore.vn`) — cookie phiên
  `session` của App Tổng không gửi tới domain khác (kể cả `localhost`), nên SSO chỉ hoạt động khi
  app được deploy đúng subdomain đó. Muốn thử trên máy cá nhân thì dùng "Bản thử" (xem mục 3).

## 1b. CHECKLIST BẮT BUỘC trước khi bàn giao / deploy production

Kiểm 4 mục này trước khi đóng gói gửi IT. Bỏ sót mục 1 hoặc 2 là app lên web vẫn "chạy" nhưng
sai dữ liệu — không có thông báo lỗi nào cả.

| # | Kiểm gì | Cách kiểm | Phải ra |
|---|---------|-----------|---------|
| 1 | Config Firebase đúng project thật | `grep -n "projectId" src/lib/firebase.ts` | `projectId: 'hpcons-dauthau'` |
| 2 | Đã tắt cờ dev & demo | `grep -nE "NEXT_PUBLIC_(DEV|DEMO|FIREBASE_CONFIG)" .env.local` | không có, hoặc đều `=0` |
| 3 | TypeScript sạch | `npm run lint` | không lỗi |
| 4 | Build sạch | `npm run build` | không lỗi |

**Vì sao mục 1 dễ sai:** web config của Firebase nằm **cứng trong `src/lib/firebase.ts`**, không đọc
từ `.env`. Mỗi lần thử trên một project Firebase khác (project test) là phải sửa thẳng vào file đó,
nên rất dễ quên đổi lại. Bản gửi IT mà còn trỏ project test thì production chạy trên Firestore rỗng,
dữ liệu thật vẫn nằm ở `hpcons-dauthau` — cả phòng mở app ra thấy trắng mà không hiểu vì sao.

**Nhắc IT 2 điều để không mất thời gian:**

- App này **không nhúng vào App Tổng** dạng copy thư mục. Nó phải deploy thành **subdomain riêng
  `dauthau.hpcore.vn`**, App Tổng chỉ trỏ link tới. Lý do ở mục 1 (cookie phiên).
- Vì vậy IT **không test được SSO trên máy cá nhân** (kể cả `localhost`) — chỉ chạy được "Bản thử"
  ở mục 3. Đăng nhập thật không được trên máy IT là **đúng thiết kế**, không phải lỗi.

## 2. Yêu cầu môi trường

- **Node.js LTS ≥ 20** + npm.
- Biến môi trường (đặt trong `.env.local` khi chạy dev, hoặc trong dashboard của nơi deploy khi
  production) — xem mẫu đầy đủ ở [.env.example](.env.example):
  - `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY` —
    3 trường tách rời của service account project Firebase riêng `hpcons-dauthau` (KHÔNG gộp
    thành 1 JSON, khác với biến bên dưới).
  - `HPCORE_FIREBASE_SERVICE_ACCOUNT` — nguyên khối JSON service account của project
    `hpcons-portal` (App Tổng), dùng để xác minh phiên đăng nhập SSO. Hai bộ khóa này thuộc
    **2 project Firebase khác nhau**, đừng nhầm lẫn.
  - `NEXT_PUBLIC_DEV_SANDBOX` — chỉ đặt `1` khi chạy thử trên máy cá nhân (mục 3).
    **Tuyệt đối không đặt biến này trên production.**
- Cả 4 biến trên đều là bí mật thật (khóa riêng tư, không phải public web config của Firebase
  client SDK — cấu hình client đã nằm sẵn trong mã nguồn ở `src/lib/firebase.ts` vì không phải bí
  mật). Xin file service account trực tiếp từ Sếp (chủ project Firebase), không lấy qua kênh chat
  thường — xem mục 6.

## 3. Chạy thử (development / "Bản thử")

```bash
npm install
npm run dev        # → http://localhost:3000
```

Chưa có đủ biến môi trường SSO/Firebase Admin thì đặt `NEXT_PUBLIC_DEV_SANDBOX=1` trong
`.env.local` — app hiện màn "Chọn vai trò" thay vì đăng nhập thật, dữ liệu chỉ lưu trong
`localStorage` của trình duyệt, không đụng Firestore thật. Đủ để nghiệm thu tính năng trước khi
có domain `dauthau.hpcore.vn` thật để test SSO đầy đủ.

### 3b. Chế độ "Thử-cloud" — khi cần nghiệm thu phần đồng bộ Firestore

Bản thử **không kết nối Firestore**, nên có 2 thứ nó không kiểm được: **Sao lưu / Khôi phục có đẩy
lên cloud** và **đồng bộ realtime giữa nhiều máy**. Cho 2 việc đó, dùng `NEXT_PUBLIC_DEV_CLOUD_TEST=1`
(và `NEXT_PUBLIC_DEV_SANDBOX=0`): vẫn bỏ qua SSO như Bản thử nhưng **đọc/ghi Firestore thật**, phiên
Firebase lấy bằng **đăng nhập ẩn danh** nên Rules vẫn giữ chuẩn "phải đăng nhập mới được ghi".

Trước khi bật, phải làm đủ 3 việc — thiếu việc 1 là cờ tự tắt:

1. Đổi khối config trong `src/lib/firebase.ts` sang **project Firebase THỬ**. Cờ này có khóa an
   toàn: còn trỏ `hpcons-dauthau` (project thật) là app **chặn hẳn và hiện thông báo**, không ghi
   một byte nào lên Firestore của Phòng.
2. Firebase Console (project thử) → **Authentication → Sign-in method → bật "Anonymous"**.
3. Firestore **Rules** của project thử cho phép người đã đăng nhập đọc/ghi.

Khi đang chạy chế độ này, thanh góc dưới trái và màn chọn vai trò chuyển **màu đỏ** và ghi rõ tên
project đang ghi vào — để không bao giờ lẫn với Bản thử (chỉ lưu trong máy).

**Xong việc nhớ đổi config `firebase.ts` về `hpcons-dauthau`** — xem checklist mục 1b.

### 3c. Bản DEMO trên web (deploy cho người khác xem thử)

Muốn cho ai đó xem app qua link (điện thoại, máy khác) mà **chưa có domain `dauthau.hpcore.vn`**:
đặt 2 biến môi trường ở nơi deploy (Vercel → Settings → Environment Variables):

```
NEXT_PUBLIC_DEMO_WEB=1
NEXT_PUBLIC_FIREBASE_CONFIG={"apiKey":"...","authDomain":"...","projectId":"<project THỬ>","storageBucket":"...","messagingSenderId":"...","appId":"..."}
```

Bản demo bỏ qua SSO và hiện màn chọn vai trò, nên **ai có link cũng vào được và sửa được dữ liệu**.
Vì vậy app tự **CHẶN không cho vào** nếu `NEXT_PUBLIC_DEMO_WEB=1` mà config vẫn trỏ project thật
`hpcons-dauthau` — dữ liệu của Phòng không thể bị bản demo chạm tới. Trên bản demo, thanh góc dưới
trái và màn chọn vai trò ghi rõ **"BẢN DEMO"** kèm tên project.

**Bản production thật: KHÔNG đặt 2 biến này** (không đặt là chạy đúng project thật + SSO như thường).

## 4. Triển khai production

### Cách đang dùng: Vercel (khuyến nghị)

Repo đã có sẵn cấu hình cho Vercel (`next.config.ts` tự tắt `output: standalone` khi phát hiện
biến môi trường `VERCEL`). Kết nối repo GitHub với dự án Vercel, khai đủ 4 biến môi trường ở mục 2
trong Vercel dashboard (Project Settings → Environment Variables, **không** đặt
`NEXT_PUBLIC_DEV_SANDBOX`), trỏ domain phụ `dauthau.hpcore.vn` về dự án Vercel này. Từ đó mỗi lần
`git push` lên nhánh production là tự động build & deploy.

### Cách khác: tự host Node server

```bash
npm install
npm run build      # next build
set PORT=8080       # (tùy chọn — Linux/macOS: export PORT=8080)
npm start           # next start, lắng nghe 0.0.0.0:PORT
```

Đưa lên app tổng: reverse-proxy (IIS/Nginx) trỏ về cổng trên, hoặc chạy như một service
(pm2 / NSSM / Windows Service). Vẫn phải chạy đúng subdomain `dauthau.hpcore.vn` để SSO hoạt động.

## 5. Kiểm tra chất lượng

```bash
npm run lint       # = tsc --noEmit (kiểm tra TypeScript)
npm run build      # build phải sạch, không lỗi
```

## 6. Bản desktop (tùy chọn, không bắt buộc)

```bash
npm run build:exe  # electron-builder → file .exe portable cho Windows
```

Bản desktop đóng gói `next build` ở chế độ `output: standalone` rồi Electron tự chạy server nội
bộ — không cần SSO/domain hpcore.vn, phù hợp dùng offline hoặc demo cục bộ. `npm run electron:dev`
để chạy thử ngay trong lúc phát triển.

## 7. Mã nguồn chuẩn (khuyến nghị)

- Repo GitHub: `ksngotram14-collab/App-bao-cao-tien-do-du-an-ver2` — nhánh `main`. Đây là **nguồn
  duy nhất** kể từ 29-07-2026; push lên `main` là Vercel tự build & deploy.
- Repo cũ `ithungphuoc-ops/HPCons-dauthau` (nhánh `master`) đã **ngừng dùng** — chỉ còn bản Vite cũ,
  không nhận code mới. Đừng lấy mã nguồn từ đó.
- **Khuyến nghị IT nhận quyền truy cập repo** (mời qua GitHub → Settings → Collaborators) thay vì
  nhận file nén, để về sau kéo bản cập nhật bằng `git pull` thay vì gửi zip lại từ đầu.

## 8. Lưu ý bảo mật

- Tài khoản & phân quyền do App Tổng (account.hpcore.vn) quản lý tập trung — Trưởng phòng gán
  quyền dùng app này tại "Quản lý ứng dụng" bên đó, không đăng ký/đặt mật khẩu riêng trong app.
- File `.env*` (trừ `.env.example`) đã có trong `.gitignore` — **không commit**, không gửi qua
  kênh chat/email thường. 4 biến bí mật ở mục 2 nên gửi qua kênh riêng (password manager, hoặc
  Sếp tự nhập thẳng vào Vercel dashboard) thay vì kèm trong file bàn giao chung.
- Ứng dụng không hiển thị giá trị tiền trong UI/export (quy định bảo mật nội bộ).
