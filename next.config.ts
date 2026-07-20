import type { NextConfig } from "next";

// output: 'standalone' chỉ cần cho bản đóng gói desktop (Electron spawn
// .next/standalone/server.js làm server nội bộ). Trên Vercel (biến env VERCEL
// tự có sẵn lúc build) KHÔNG được bật — Vercel dùng định dạng build/routing
// riêng của họ, bật standalone ở đây làm Vercel trả 404 cho mọi route.
const nextConfig: NextConfig = {
  ...(process.env.VERCEL ? {} : { output: "standalone" }),
};

export default nextConfig;
