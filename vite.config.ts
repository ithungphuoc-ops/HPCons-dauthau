import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      // Bỏ qua các file dữ liệu JSON (db.json, staff.json...) để server ghi dữ liệu
      // không làm Vite full-reload app và mất trạng thái đang thao tác.
      watch: process.env.DISABLE_HMR === 'true' ? null : { ignored: ['**/src/data/*.json'] },
    },
  };
});
