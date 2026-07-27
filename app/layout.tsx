import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "vietnamese"],
  variable: "--font-inter",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: "Hệ Thống Quản Trị Tiến Độ Phòng Đấu Thầu - ERP BPM",
  icons: { icon: "/logo-hung-phuoc.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-slate-50 text-slate-800 antialiased selection:bg-blue-600 selection:text-white">
        {children}
        {/* Bong bóng góp ý/báo lỗi xuyên suốt hệ sinh thái (27/07/2026) — file
            phục vụ từ app tổng, đọc cookie SSO .hpcore.vn có sẵn để xác
            thực, không cần code riêng ở đây ngoài đúng 1 dòng này. */}
        <script src="https://account.hpcore.vn/feedback-widget.js" data-app="HPC Đấu Thầu" async />
      </body>
    </html>
  );
}
