import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths so the build works under any GitHub Pages subpath.
  base: './',
  plugins: [react(), tailwindcss()],
  // The JPEG XL decoder worker is an ES module, so the decoder can locate its .wasm file.
  worker: { format: 'es' },
  // Pre-bundling would move the decoder away from its .wasm file.
  optimizeDeps: { exclude: ['@jsquash/jxl'] },
});
