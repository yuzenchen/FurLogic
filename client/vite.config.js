import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // .env / .env.local 放在 repo 根目錄,與 server 共用同一份
  envDir: '..',
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
  build: {
    outDir: 'dist',
    // 不產 sourcemap:nginx 會把 dist 內所有檔案(含 .map)公開出去
    sourcemap: false,
  },
});
