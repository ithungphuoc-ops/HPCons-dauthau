import type { NextConfig } from "next";

// output: 'standalone' chỉ cần cho bản đóng gói desktop (Electron spawn
// .next/standalone/server.js làm server nội bộ). Trên Vercel (biến env VERCEL
// tự có sẵn lúc build) KHÔNG được bật — Vercel dùng định dạng build/routing
// riêng của họ, bật standalone ở đây làm Vercel trả 404 cho mọi route.
// NEXT_DIST_DIR: chỗ đổ thư mục build. Chỉ dùng khi làm việc trên máy có thư mục dự án nằm
// trong Google Drive — Drive vừa đồng bộ vừa bị Next ghi đè liên tục sẽ làm build chết giữa
// chừng với EINVAL/EPERM. Lúc đó trỏ biến này ra một thư mục trên ổ local là build chạy trót lọt.
// KHÔNG khai biến thì giữ nguyên mặc định ".next" — máy chủ và Vercel không bị ảnh hưởng gì.
const nextConfig: NextConfig = {
  ...(process.env.VERCEL ? {} : { output: "standalone" }),
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
};

export default nextConfig;
