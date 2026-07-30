// next.config.ts dùng output: 'standalone' — Next.js KHÔNG tự copy .next/static và public/
// vào bên trong .next/standalone (đây là hành vi có chủ đích của Next, xem docs "output: standalone").
// Chạy sau `next build` để .next/standalone/server.js tự phục vụ được static assets khi
// Electron spawn nó làm server nội bộ.
import { cpSync, existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const standaloneDir = path.join(root, ".next", "standalone");

if (!existsSync(standaloneDir)) {
  console.error("[copy-standalone-assets] Không tìm thấy .next/standalone — chạy `next build` trước.");
  process.exit(1);
}

cpSync(path.join(root, ".next", "static"), path.join(standaloneDir, ".next", "static"), { recursive: true });
cpSync(path.join(root, "public"), path.join(standaloneDir, "public"), { recursive: true });

console.log("[copy-standalone-assets] Đã copy .next/static + public vào .next/standalone.");
