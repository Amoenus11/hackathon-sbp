import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// La web (React) vive en web/ y se compila a dist/, que sirve el servidor Node.
// En desarrollo, Vite (5173) reenvía /api al servidor (3000).
export default defineConfig({
  root: 'web',
  plugins: [react()],
  build: { outDir: '../dist', emptyOutDir: true, chunkSizeWarningLimit: 2000 },
  server: { port: 5173, proxy: { '/api': 'http://localhost:3000' } },
});
