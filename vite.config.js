import { defineConfig } from 'vite';
import { resolve } from 'path';
export default defineConfig({
  server: { port: 5173, strictPort: true, host: '127.0.0.1', fs: { allow: ['.'] } },
  build: { rollupOptions: { input: { main: resolve(__dirname, 'index.html'), house: resolve(__dirname, 'house.html') } }, chunkSizeWarningLimit: 3000 },
  assetsInclude: ['**/*.glb', '**/*.hdr', '**/*.ktx2'],
  publicDir: 'public',
});
