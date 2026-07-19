"use client";

import dynamic from "next/dynamic";

// App gốc (src/App.tsx) là 1 SPA client-nặng: đọc localStorage ngay trong các
// useState lazy-initializer và có side-effect ở module top-level. ssr:false giữ
// nguyên hành vi "chỉ chạy ở trình duyệt" y hệt bản Vite cũ — tránh crash SSR
// (localStorage không tồn tại trên server) và tránh hydration mismatch.
const ErpApp = dynamic(() => import("../src/App"), { ssr: false });

export default function ErpAppLoader() {
  return <ErpApp />;
}
