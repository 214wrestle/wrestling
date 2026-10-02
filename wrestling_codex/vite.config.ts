import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { host: '0.0.0.0', port: 5188, strictPort: true },
  build: { target: 'es2022', chunkSizeWarningLimit: 1800 },
});
