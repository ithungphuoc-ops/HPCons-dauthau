import type { NextConfig } from "next";

// output: 'standalone' — dùng chung cho cả deploy Vercel lẫn đóng gói desktop (Electron
// spawn .next/standalone/server.js làm server nội bộ thay cho server Express cũ).
const nextConfig: NextConfig = {
  output: "standalone",
};

export default nextConfig;
