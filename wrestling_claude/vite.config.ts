import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5190,
    host: true,
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      // The game, plus the character style mockups as a second page.
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        mockups: fileURLToPath(new URL('./mockups.html', import.meta.url)),
      },
    },
  },
});
