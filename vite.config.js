import { defineConfig } from 'vite';
import { resolve } from 'path';
export default defineConfig({
  server: { port: +(process.env.PORT || 5174), strictPort: true, host: '127.0.0.1', fs: { allow: ['.'] } },
  build: { rollupOptions: { input: { main: resolve(import.meta.dirname, 'index.html'), house: resolve(import.meta.dirname, 'house.html') } }, chunkSizeWarningLimit: 3000 },
  assetsInclude: ['**/*.glb', '**/*.hdr', '**/*.ktx2'],
  publicDir: 'public',
});
